import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { regionLayout } from '../world/layout';
import { RACES, BUOY_REACH } from '../data/regatta';

describe('the Gull Race', () => {
  it('every course can be sailed: each buoy in open water, every leg a route the ship can take', () => {
    const bad: string[] = [];
    for (const c of RACES) {
      const L = regionLayout(c.region), w = L.world, pts = [c.start, ...c.buoys, c.start];
      for (const [x, z] of pts) if (!w.seaClear(x, z)) bad.push(`${c.id}: buoy at ${Math.round(x)},${Math.round(z)} not in open water`);
      for (let k = 0; k < pts.length - 1; k++) {
        const route = w.findSeaPath(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]), end = route?.[route.length - 1];
        if (!end || Math.hypot(end[0] - pts[k + 1][0], end[1] - pts[k + 1][1]) > BUOY_REACH) bad.push(`${c.id}: leg ${k}`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('start at the buoy, round them in order, home: a time, a medal, a best kept; gold flies the gull pennant', () => {
    const L = regionLayout('bellwether');
    const g = new Game({ seed: 5, save: defaultSave(L.respawn, L.mooring!) });
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    g.p.xp.sailing = xpForLevel(10);
    const c = RACES[0], put = (p: [number, number]) => { g.ship.x = p[0]; g.ship.z = p[1]; g.p.x = p[0]; g.p.z = p[1]; };
    g.p.onShip = true; put(c.start);
    expect(g.targets().some((t) => t.key === 'event:rg:start')).toBe(true);
    g.interact('event:rg:start');
    g.step(1 / 30);
    expect(g.regatta.run).toBeTruthy();
    // skipping a buoy does nothing
    put(c.buoys[1]); g.step(1 / 30);
    expect(g.regatta.run!.next).toBe(0);
    for (const b of c.buoys) { for (let t = 0; t < 4; t += 1 / 30) g.step(1 / 30); put(b); g.step(1 / 30); }
    expect(g.regatta.run!.next).toBe(c.buoys.length);
    put(c.start); g.step(1 / 30);
    expect(g.regatta.run).toBeNull();
    expect(g.s.races?.bellwether).toBeGreaterThan(0);
    expect(g.s.raceMedals?.bellwether).toBe(0); // teleporting is fast
    expect(g.s.flags.gull_pennant).toBe(true);
  });
});
