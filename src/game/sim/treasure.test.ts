import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave, parseSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';
import { LOOT } from '../data/content';
import { TREASURE } from './treasure';

// Treasure maps (treasure.ts): read on an island, an X in the water; sail out and haul the chest up from the deck.
const at = (region: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack', seed = 7) => {
  const L = regionLayout(region);
  const g = new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region } });
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  return g;
};
const slot = (g: Game, id: string) => g.p.inv.findIndex((s) => s?.id === id);

describe('treasure maps', () => {
  it('dig spots and caskets can turn one up', () => {
    expect(LOOT.treasure.drops.some((d) => d.item === 'treasure_map')).toBe(true);
  });

  for (const region of ['bellwether', 'sunreach', 'amberhold', 'wrack'] as const) {
    it(`${region}: reading puts an X in clear water off the coast; sailing there and hauling pays out once`, () => {
      const g = at(region);
      g.give('treasure_map', 2);
      g.useSlot(slot(g, 'treasure_map'));
      expect(count(g.p.inv, 'treasure_map')).toBe(1); // one read, one kept for later
      const x = g.treasure.here()!;
      expect(x).toBeTruthy();
      expect(g.world.seaClear(x.x, x.z)).toBe(true);
      expect(g.world.findSeaPath(g.ship.x, g.ship.z, x.x, x.z)).toBeTruthy();
      // a second map waits: only one X at a time
      g.useSlot(slot(g, 'treasure_map'));
      expect(count(g.p.inv, 'treasure_map')).toBe(1);
      // not from the shore
      expect(g.treasure.targets().length).toBe(0);
      // aboard, sail out to it
      g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
      expect(g.interact('event:tm:haul')).toBe(true);
      for (let t = 0; t < 240 && g.s.treasure; t += 1 / 30) g.step(1 / 30);
      expect(g.s.treasure).toBeNull();
      expect(count(g.p.inv, 'casket')).toBeGreaterThanOrEqual(1);
      expect(g.p.xp.sailing).toBeGreaterThanOrEqual(TREASURE.xp);
    });
  }

  it('the X survives a save and reload; junk in the save is dropped', () => {
    const g = at('sunreach');
    g.give('treasure_map', 1);
    g.useSlot(slot(g, 'treasure_map'));
    const sv = JSON.parse(JSON.stringify(g.serialize()));
    const back = parseSave(JSON.stringify(sv), g.s)!;
    expect(back.treasure).toEqual(g.s.treasure);
    expect(parseSave(JSON.stringify({ ...sv, treasure: { region: 'atlantis', x: 1, z: 2 } }), g.s)!.treasure).toBeNull();
    expect(parseSave(JSON.stringify({ ...sv, treasure: 'x' }), g.s)!.treasure).toBeNull();
  });
});
