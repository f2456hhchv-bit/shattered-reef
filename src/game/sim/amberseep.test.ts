import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';
import { SEEP } from './amberseep';

// The Amber Seep (docs/ISLANDS.md, slice 3): Amberhold's skilling boss, played in the simulation.
const amb = (seed = 7) => { const L = regionLayout('amberhold'); return new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } }); };
const near = (g: Game, x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 3)!; g.p.x = q[0]; g.p.z = q[1]; };
const run = (g: Game, secs: number, until?: () => boolean) => { for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until?.()) return true; } return false; };
const use = (g: Game, key: string) => { const t = g.seep.targets().find((x) => x.key === key)!; near(g, t.x, t.z); g.interact(key); g.step(1 / 30); };
const quiet = (g: Game) => { for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } };

describe('the Amber Seep', () => {
  it('stands on open ground on Goldvein Hill; the seams only run while the hill is open; it needs a pickaxe', () => {
    const g = amb(), s = g.seep.spots()!;
    for (const p of [s.crack, s.bench, s.cart, ...s.supports]) expect(g.world.walkable(p.x, p.z)).toBe(true);
    const seams = g.nodes.filter((n) => n.def === 'amber_seep');
    expect(seams.length).toBe(3);
    expect(seams.every((n) => n.depletedUntil === Infinity)).toBe(true);
    g.p.inv = g.p.inv.map((st) => (st?.id.startsWith('pickaxe') ? null : st));
    use(g, 'event:seep:crack');
    expect(g.seep.running).toBe(false);
    g.give('pickaxe_bronze', 1);
    use(g, 'event:seep:crack');
    expect(g.seep.running).toBe(true);
    expect(seams.every((n) => n.depletedUntil === 0)).toBe(true);
  });

  it('mine amber, cart it for points; brace a support with amber and a log to shore the tunnel up', () => {
    const g = amb();
    quiet(g);
    g.give('pickaxe_bronze', 1); g.give('logs_pine', 2);
    use(g, 'event:seep:crack');
    const n = g.nodes.find((x) => x.def === 'amber_seep')!;
    near(g, n.x + 1.2, n.z);
    g.interact(`node:${n.uid}`);
    run(g, 60, () => count(g.p.inv, 'raw_amber') >= 4);
    expect(count(g.p.inv, 'raw_amber')).toBeGreaterThanOrEqual(4);
    g.stopAction();
    use(g, 'event:seep:bench');
    expect(count(g.p.inv, 'amber_brace')).toBe(2);
    g.seep.stability = 40;
    use(g, 'event:seep:prop:0');
    expect(g.seep.stability).toBeCloseTo(40 + SEEP.brace, 0);
    g.give('raw_amber', 3);
    const pts = g.seep.points;
    use(g, 'event:seep:cart');
    expect(g.seep.points).toBe(pts + 6);
  });

  it('left alone the tunnel gives way; held to the end with work done, it pays', () => {
    const lost = amb();
    quiet(lost); lost.give('pickaxe_bronze', 1);
    use(lost, 'event:seep:crack');
    run(lost, SEEP.duration + 5, () => !lost.seep.running);
    expect(lost.seep.running).toBe(false);
    expect(lost.s.flags.seep_held).toBeFalsy();
    const won = amb();
    quiet(won); won.give('pickaxe_bronze', 1);
    use(won, 'event:seep:crack');
    won.seep.points = 40;
    const items = won.p.inv.filter(Boolean).length;
    run(won, SEEP.duration + 5, () => { won.seep.stability = 80; return !won.seep.running; });
    expect(won.s.flags.seep_held).toBe(true);
    expect(won.p.inv.filter(Boolean).length).toBeGreaterThan(items);
  });

  it('balance: a level-1 bot on foot that mines, braces and carts holds the tunnel and earns several rolls', () => {
    const r = [1, 2, 3, 4].map((seed) => {
      const g = amb(700 + seed);
      quiet(g);
      g.give('pickaxe_bronze', 1); g.give('logs_pine', 20);
      const s = g.seep.spots()!;
      near(g, s.crack.x, s.crack.z);
      g.interact('event:seep:crack'); g.step(1 / 30);
      const go = (key: string) => { if (g.pending !== key) g.interact(key); };
      let prop = 0;
      for (let t = 0; t < SEEP.duration + 5 && g.seep.running; t += 1 / 30) {
        g.p.hp = Math.max(g.p.hp, g.stats.maxHp * 0.5);
        if (count(g.p.inv, 'amber_brace') > 0 && g.seep.stability < 70) go(`event:seep:prop:${prop % 3}`);
        else if (count(g.p.inv, 'raw_amber') >= 2 && g.seep.stability < 75 && count(g.p.inv, 'amber_brace') === 0) go('event:seep:bench');
        else if (count(g.p.inv, 'raw_amber') >= 6) go('event:seep:cart');
        else if (!g.action || g.action.type !== 'gather') { const n = g.nodes.find((x) => x.def === 'amber_seep' && x.depletedUntil <= g.time)!; go(`node:${n.uid}`); }
        const before = count(g.p.inv, 'amber_brace');
        g.step(1 / 30);
        if (count(g.p.inv, 'amber_brace') < before) prop++;
      }
      return { held: !!g.s.flags.seep_held, points: g.seep.points };
    });
    console.log('SEEP', JSON.stringify(r));
    expect(r.filter((x) => x.held).length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...r.map((x) => x.points))).toBeGreaterThanOrEqual(SEEP.pointsPerRoll * 2);
  }, 120_000);
});
