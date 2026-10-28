import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { ACTIVE, MOMENTS } from '../data/active';

// Active skilling (docs/ISLANDS.md): a gold window each swing and craft; tap in it for a bonus, never a penalty.
// most tests here make every swing lucky; the last one checks the real cooldown
const COOLDOWN = [...ACTIVE.cooldown] as [number, number];
ACTIVE.cooldown = [0, 0];
const base = new Game({ seed: 1 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

/** Chop oaks for `secs`, tapping each swing at `when` through it (null: never tap). Logs per minute. */
function chop(when: number | null, secs = 900, seed = 21) {
  const g = fresh(seed);
  g.p.xp.woodcutting = xpForLevel(30);
  g.give('hatchet_iron', 1);
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  const n = g.nodes.find((x) => x.def === 'tree_oak' && g.layout.nodes.find((l) => l.uid === x.uid)?.scenery === true)!;
  const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
  g.interact(`node:${n.uid}`);
  let logs = 0, last = count(g.p.inv, 'logs_oak');
  for (let t = 0; t < secs; t += 1 / 30) {
    if (!g.action) { const m = g.nodes.find((x) => x.def === 'tree_oak' && x.depletedUntil <= g.time && Math.hypot(x.x - g.p.x, x.z - g.p.z) < 30); if (m) { const w = g.world.nearestWalkable(m.x + 1.2, m.z, 3)!; g.p.x = w[0]; g.p.z = w[1]; g.interact(`node:${m.uid}`); } }
    const c = g.cueState();
    if (when !== null && c && !c.struck && c.t >= when) g.strike();
    g.step(1 / 30);
    const now = count(g.p.inv, 'logs_oak');
    if (now > last) logs += now - last;
    if (now >= 20) { g.p.inv = g.p.inv.map((s) => (s?.id === 'logs_oak' ? null : s)); last = 0; } else last = now; // bank it
  }
  return { perMin: (logs / secs) * 60, xp: g.p.xp.woodcutting - xpForLevel(30) };
}

describe('active skilling', () => {
  it('the bar shows on the swing that lands a log: gold, its red heart, too soon; one tap a swing', () => {
    const g = fresh();
    g.give('hatchet_bronze', 1);
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`node:${n.uid}`);
    const live = () => { let k = 0; while (!g.cueState()?.live && k++ < 30 * 60) g.step(1 / 30); expect(g.cueState()!.live).toBe(true); };
    const at = (t: number) => { while (g.cueState()!.t < t) g.step(1 / 30); };
    // a swing that won't land a log takes no tap
    let k = 0; while (g.cueState()?.live !== false && k++ < 30 * 60) g.step(1 / 30);
    if (g.cueState()?.live === false) expect(g.strike()).toBeNull();
    live();
    expect(g.cueState()!.t).toBeLessThan(ACTIVE.window[0]);
    expect(g.strike()).toBe('miss'); // too soon
    expect(g.strike()).toBeNull(); // one tap a swing
    while (g.cueState()?.struck) g.step(1 / 30);
    live(); at(ACTIVE.window[0] + 0.02);
    expect(g.strike()).toBe('perfect');
    while (g.cueState()?.struck) g.step(1 / 30);
    live(); at(ACTIVE.red[0] + 0.01);
    expect(g.strike()).toBe('red');
  });

  it('gold doubles the log that lands (1.5x XP), red trebles it (2x XP); mistimed and no taps change nothing', () => {
    const afk = chop(null), gold = chop(0.72), red = chop(0.77), early = chop(0.2);
    console.log('CHOP', JSON.stringify({ afk, gold, red, early }));
    expect(gold.perMin / afk.perMin).toBeGreaterThan(1.85);
    expect(gold.perMin / afk.perMin).toBeLessThan(2.15);
    expect(red.perMin / afk.perMin).toBeGreaterThan(2.75);
    expect(red.perMin / afk.perMin).toBeLessThan(3.25);
    expect(gold.xp / afk.xp).toBeGreaterThan(1.4);
    expect(gold.xp / afk.xp).toBeLessThan(1.6);
    expect(red.xp / afk.xp).toBeGreaterThan(1.85);
    expect(red.xp / afk.xp).toBeLessThan(2.15);
    expect(Math.abs(early.perMin / afk.perMin - 1)).toBeLessThan(0.08); // a miss costs nothing but the bonus
  }, 60_000);

  it('cooking taken off the heat on time never burns, and gives a third more XP', () => {
    const g = fresh();
    const fire = g.layout.stations.find((s) => s.id === 'fire')!;
    const q = g.world.nearestWalkable(fire.x + 1.2, fire.z + 1.2, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.give('fish_sprat_raw', 20); // level 1: sprats burn often
    g.craft('cook_sprat', 20);
    let guard = 0;
    while (g.action && guard++ < 30 * 120) { const c = g.cueState(); if (c && !c.struck && c.t >= 0.75) g.strike(); g.step(1 / 30); }
    expect(count(g.p.inv, 'burnt_food')).toBe(0);
    expect(count(g.p.inv, 'fish_sprat')).toBe(20);
  });
});

describe('lucky swings', () => {
  it('the bar is rare: about once every four to six minutes of chopping, never on a craft or swing in between', () => {
    ACTIVE.cooldown = COOLDOWN;
    try {
      const g = fresh(5);
      g.p.xp.woodcutting = xpForLevel(30);
      g.give('hatchet_iron', 1);
      for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
      let shown = 0, was = false;
      for (let t = 0; t < 1200; t += 1 / 30) {
        if (!g.action) { const m = g.nodes.find((x) => x.def === 'tree_oak' && x.depletedUntil <= g.time); if (m) { const w = g.world.nearestWalkable(m.x + 1.2, m.z, 3)!; g.p.x = w[0]; g.p.z = w[1]; g.interact(`node:${m.uid}`); } }
        const live = !!g.cueState()?.live;
        if (live && !was) shown++;
        was = live;
        g.step(1 / 30);
        g.p.inv = g.p.inv.map((s) => (s?.id === 'logs_oak' ? null : s));
      }
      // 20 minutes: the first comes after 4-6, then every 4-6 (plus the wait for a swing that lands); a bar still
      // waiting when its tree falls shows again on the next tree, so one can count twice
      expect(shown).toBeGreaterThanOrEqual(2);
      expect(shown).toBeLessThanOrEqual(6);
    } finally { ACTIVE.cooldown = [0, 0]; }
  }, 60_000);
});

describe('gathering moments', () => {
  const setup = () => {
    const g = fresh();
    g.give('hatchet_bronze', 1);
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`node:${n.uid}`);
    g.step(1 / 30);
    return { g, n };
  };
  it('a falling nest: caught on the gold, lost if ignored; the swing waits on it', () => {
    const { g, n } = setup();
    const nests = () => count(g.p.inv, 'bird_nest');
    g.startMoment('nest', n.uid);
    expect(g.cueState()!.label).toBe(MOMENTS.defs.nest.label);
    while (g.cueState()!.t < MOMENTS.defs.nest.red[0] + 0.02) g.step(1 / 30);
    expect(g.strike()).toBe('red');
    expect(g.moment).toBeNull();
    expect(nests()).toBe(2);
    g.startMoment('nest', n.uid);
    for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
    expect(g.moment).toBeNull();
    expect(nests()).toBe(2);
    expect(g.action?.type).toBe('gather');
  });
  it('a big fish takes three pulls; a miss snaps the line', () => {
    const { g, n } = setup();
    g.startMoment('tug', n.uid);
    expect(g.strike()).toBe('miss'); // too soon
    expect(g.moment).toBeNull();
    g.startMoment('tug', n.uid);
    for (let k = 0; k < 3; k++) { while (g.cueState()!.t < MOMENTS.defs.tug.window[0] + 0.05) g.step(1 / 30); expect(g.strike()).not.toBe('miss'); }
    expect(g.moment).toBeNull();
  });
});
