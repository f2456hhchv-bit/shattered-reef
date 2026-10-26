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
    const afk = chop(null), gold = chop(0.66), red = chop(0.77), early = chop(0.2);
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
