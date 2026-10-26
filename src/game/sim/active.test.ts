import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { ACTIVE } from '../data/active';

// Active skilling (docs/ISLANDS.md): a gold window each swing and craft; tap in it for a bonus, never a penalty.
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
  it('a tap in the gold window is perfect; too soon or a second tap is not', () => {
    const g = fresh();
    g.give('hatchet_bronze', 1);
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`node:${n.uid}`);
    g.step(0.05);
    expect(g.cueState()!.t).toBeLessThan(ACTIVE.window[0]);
    expect(g.strike()).toBe('miss'); // too soon
    expect(g.strike()).toBeNull(); // one tap a swing
    // next swing: wait for the window
    while (g.cueState()!.struck) g.step(1 / 30);
    while (g.cueState()!.t < ACTIVE.window[0] + 0.02) g.step(1 / 30);
    expect(g.strike()).toBe('perfect');
  });

  it('a run of perfect swings pays a bonus log; a mistimed swing breaks the run', () => {
    const g = fresh();
    g.give('hatchet_bronze', 1);
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`node:${n.uid}`);
    const swing = (when: number) => { let s = 0; while (g.action && s++ < 300) { const c = g.cueState()!; if (!c.struck && c.t >= when) g.strike(); const was = g.streak; g.step(1 / 30); if (g.streak !== was || (c.struck && g.cueState() && !g.cueState()!.struck)) return; } };
    for (let k = 0; k < ACTIVE.streakEvery - 1; k++) swing(0.75);
    expect(g.streak).toBe(ACTIVE.streakEvery - 1);
    g.p.inv.forEach((s, i) => { if (s?.id === 'logs_pine') g.p.inv[i] = null; });
    swing(0.75);
    expect(g.streak).toBe(ACTIVE.streakEvery);
    expect(count(g.p.inv, 'logs_pine')).toBeGreaterThanOrEqual(1); // the bonus, even on a swing that landed nothing
    swing(0.2);
    expect(g.streak).toBe(0);
  });

  it('perfect timing every swing nearly doubles logs (a third more XP); mistimed taps and no taps give the same', () => {
    const afk = chop(null), perfect = chop(0.75), early = chop(0.2);
    console.log('CHOP', JSON.stringify({ afk, perfect, early }));
    // checked 2026-10-26, oak at Woodcutting 30: 8.7 logs/min idle, 16.3 perfect (bonus logs from runs carry no XP)
    expect(perfect.perMin / afk.perMin).toBeGreaterThan(1.6);
    expect(perfect.perMin / afk.perMin).toBeLessThan(2.1);
    expect(perfect.xp / afk.xp).toBeGreaterThan(1.25);
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
