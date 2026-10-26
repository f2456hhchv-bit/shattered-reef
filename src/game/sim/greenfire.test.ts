import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';
import { FIRE } from './greenfire';

// The Greenheart Fire (docs/ISLANDS.md, slice 2): Sunreach's skilling boss, played in the simulation.
const sun = (seed = 7) => { const L = regionLayout('sunreach'); return new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } }); };
const near = (g: Game, x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 3)!; g.p.x = q[0]; g.p.z = q[1]; };
const run = (g: Game, secs: number, until?: () => boolean) => { for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until?.()) return true; } return false; };
const use = (g: Game, key: string) => { const t = g.fire.targets().find((x) => x.key === key)!; near(g, t.x, t.z); g.interact(key); g.step(1 / 30); };
/** Keep the player alive and fed through a long run (the heat bites). */
const hold = (g: Game) => { for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } };

describe('the Greenheart Fire', () => {
  it('the grove and camp stand on open ground in Sunreach; the bamboo only grows while the fire burns', () => {
    const g = sun(), s = g.fire.spots()!;
    for (const p of [...s.cells, s.horn, s.bench, s.stream]) expect(g.world.walkable(p.x, p.z)).toBe(true);
    const bamboo = g.nodes.filter((n) => n.def === 'bamboo_fire');
    expect(bamboo.length).toBe(3);
    expect(bamboo.every((n) => n.depletedUntil === Infinity)).toBe(true);
    use(g, 'event:gf:horn');
    expect(g.fire.running).toBe(true);
    expect(g.fire.cells.filter((c) => c === 'fire').length).toBe(2);
    expect(bamboo.every((n) => n.depletedUntil === 0)).toBe(true);
  });

  it('cut bamboo, lash buckets, fill them, douse a fire; fell a firebreak beside one', () => {
    const g = sun();
    hold(g);
    g.give('hatchet_bronze', 1);
    use(g, 'event:gf:horn');
    // a real bamboo stand
    const n = g.nodes.find((x) => x.def === 'bamboo_fire')!;
    near(g, n.x + 1.2, n.z);
    g.interact(`node:${n.uid}`);
    run(g, 60, () => count(g.p.inv, 'bamboo') >= 2);
    expect(count(g.p.inv, 'bamboo')).toBeGreaterThanOrEqual(2);
    g.stopAction();
    use(g, 'event:gf:bench');
    expect(count(g.p.inv, 'bucket_bamboo')).toBeGreaterThanOrEqual(1);
    use(g, 'event:gf:stream');
    expect(count(g.p.inv, 'bucket_water')).toBeGreaterThanOrEqual(1);
    const k = g.fire.cells.indexOf('fire');
    use(g, `event:gf:cell:${k}`);
    expect(g.fire.cells[k]).toBe('green');
    expect(g.fire.doused).toBe(1);
    // a thicket in the fire's path can be felled into a firebreak
    const lit = g.fire.cells.indexOf('fire');
    const path = g.fire.neighbours(lit).find((j) => g.fire.cells[j] === 'green')!;
    use(g, `event:gf:cell:${path}`);
    expect(g.fire.cells[path]).toBe('break');
  });

  it('left alone, the fire spreads and burns the grove: the event is lost', () => {
    const g = sun();
    hold(g);
    use(g, 'event:gf:horn');
    near(g, g.fire.spots()!.horn.x, g.fire.spots()!.horn.z + 4); // well back from the heat
    run(g, 240, () => !g.fire.running);
    expect(g.fire.running).toBe(false);
    expect(g.s.flags.greenfire_won).toBeFalsy();
  });

  it('ten fires doused saves the Greenheart and pays out by the work', () => {
    const g = sun();
    hold(g);
    use(g, 'event:gf:horn');
    g.fire.doused = FIRE.win - 1; g.fire.points = 30;
    g.give('bucket_water', 1);
    const k = g.fire.cells.indexOf('fire');
    const items = g.p.inv.filter(Boolean).length;
    use(g, `event:gf:cell:${k}`);
    expect(g.fire.running).toBe(false);
    expect(g.s.flags.greenfire_won).toBe(true);
    expect(g.p.inv.filter(Boolean).length).toBeGreaterThan(items);
    expect(count(g.p.inv, 'bucket_bamboo') + count(g.p.inv, 'bucket_water')).toBe(0); // the buckets stay at the camp
  });
});

/** A bot that plays it on foot: bamboo, buckets, water, douse the oldest fire; fell a break when it has nothing else to do. */
function play(seed: number, breaks: boolean) {
  const g = sun(seed);
  hold(g);
  g.give('hatchet_bronze', 1);
  const s = g.fire.spots()!;
  near(g, s.horn.x, s.horn.z);
  g.interact('event:gf:horn'); g.step(1 / 30);
  const go = (key: string) => { if (g.pending !== key) g.interact(key); };
  for (let t = 0; t < 900 && g.fire.running; t += 1 / 30) {
    g.p.hp = Math.max(g.p.hp, g.stats.maxHp * 0.5); // eats between trips (food isn't the test)
    const fires = g.fire.cells.map((c, k) => (c === 'fire' ? k : -1)).filter((k) => k >= 0).sort((a, b) => g.fire.lit[a] - g.fire.lit[b]);
    if (count(g.p.inv, 'bucket_water') > 0 && fires.length) go(`event:gf:cell:${fires[0]}`);
    else if (count(g.p.inv, 'bucket_bamboo') >= 2 || (count(g.p.inv, 'bucket_bamboo') > 0 && count(g.p.inv, 'bamboo') < 2)) go('event:gf:stream');
    else if (count(g.p.inv, 'bamboo') >= 2 && count(g.p.inv, 'bucket_bamboo') + count(g.p.inv, 'bucket_water') < 2) go('event:gf:bench');
    else if (breaks && g.fire.targets().some((x) => x.verb === 'Fell') && !g.action) go(g.fire.targets().find((x) => x.verb === 'Fell')!.key);
    else if (!g.action || g.action.type !== 'gather') { const n = g.nodes.find((x) => x.def === 'bamboo_fire' && x.depletedUntil <= g.time)!; go(`node:${n.uid}`); }
    g.step(1 / 30);
  }
  return { won: !!g.s.flags.greenfire_won, doused: g.fire.doused, ash: g.fire.ashed, secs: Math.round(g.time) };
}

describe('the Greenheart Fire, played', () => {
  it('balance: a level-1 bot that keeps at it saves the grove most times; it takes a few minutes', () => {
    const r = [1, 2, 3, 4, 5, 6].map((s) => play(400 + s, true));
    console.log('FIRE', JSON.stringify(r));
    expect(r.filter((x) => x.won).length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...r.filter((x) => x.won).map((x) => x.secs))).toBeGreaterThan(120);
  }, 120_000);
});
