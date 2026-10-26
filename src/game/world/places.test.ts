import { describe, it, expect } from 'vitest';
import { PLACES, placeRegion } from './places';
import { regionLayout } from './layout';
import { ISLETS } from './island';
import type { RegionId } from './regions';

// The island diaries ask you to discover every place on an island: every place must be somewhere you can walk to.
describe('places', () => {
  const regions = [...new Set(PLACES.map(placeRegion))] as RegionId[];
  for (const r of regions) {
    it(`${r}: every place can be reached (on foot, or by ship for sea places)`, () => {
      const L = regionLayout(r);
      const bad: string[] = [];
      for (const p of PLACES.filter((x) => placeRegion(x) === r)) {
        // you discover a place by walking within its radius: some walkable point inside it must be on a path from the landing
        const islet = ISLETS.find((i) => Math.hypot(i.x - p.x, i.z - p.z) < i.r);
        if (p.sea || islet) {
          // a sea place is found from the deck: the ship must be able to sail somewhere inside its radius
          const route = L.mooring && L.world.findSeaPath(L.mooring.x, L.mooring.z, p.x, p.z);
          const end = route?.[route.length - 1];
          // an islet: you sail alongside and step ashore (within the islet and a disembark's reach of it)
          if (!end || Math.hypot(end[0] - p.x, end[1] - p.z) >= (islet ? islet.r + 8 : p.r)) bad.push(p.id);
          continue;
        }
        const goal = L.world.nearestWalkable(p.x, p.z, Math.max(2, p.r - 1));
        const path = goal && L.world.findPath(L.respawn.x, L.respawn.z, goal[0], goal[1]);
        if (!path) bad.push(p.id);
      }
      expect(bad).toEqual([]);
    });
  }
});

describe('islets', () => {
  it('tap Leviathan\'s Rest from the deck: the ship sails round to it and you can step ashore', async () => {
    const { Game } = await import('../sim/game');
    const { defaultSave } = await import('../sim/save');
    const { WRACK_LAYOUT } = await import('./island');
    const L = regionLayout('wrack');
    const g = new Game({ seed: 4, save: { ...defaultSave(L.respawn, L.mooring!), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    const I = WRACK_LAYOUT.islet;
    g.moveTo(I.x, I.z);
    for (let t = 0; t < 120; t += 1 / 30) { g.step(1 / 30); if (g.landingPoint() && Math.hypot(g.ship.x - I.x, g.ship.z - I.z) < 24) break; }
    expect(Math.hypot(g.ship.x - I.x, g.ship.z - I.z)).toBeLessThan(24);
    g.disembark();
    expect(g.p.onShip).toBe(false);
    expect(Math.hypot(g.p.x - I.x, g.p.z - I.z)).toBeLessThan(16);
  }, 60_000);
});
