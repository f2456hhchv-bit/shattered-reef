import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { collectionGroups, COLLECTIBLE } from '../data/collection';

const base = new Game({ seed: 1 });

describe('the collection log', () => {
  it('is built from every loot table: bosses first, each item real, no coins or common stuff', () => {
    const groups = collectionGroups();
    expect(groups.length).toBeGreaterThan(20);
    expect(groups[0].boss).toBe(true);
    expect(COLLECTIBLE.has('orb_lantern')).toBe(true); // Corva's
    expect(COLLECTIBLE.has('coins')).toBe(false);
    expect(COLLECTIBLE.has('bread')).toBe(false);
  });

  it('ticks an entry the first time it lands in your pack (given or picked up), once', () => {
    const g = new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
    const msgs: string[] = [];
    g.on((e) => { if (e.type === 'msg') msgs.push(e.text); });
    g.give('orb_lantern', 1);
    expect(g.s.collected).toContain('orb_lantern');
    g.give('orb_lantern', 1);
    expect(msgs.filter((m) => m.includes('New collection log entry')).length).toBe(1);
    // picked up off the ground
    const id = [...COLLECTIBLE].find((x) => x !== 'orb_lantern')!;
    g.dropAt(g.p.x, g.p.z, { id, qty: 1 });
    for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
    expect(g.s.collected).toContain(id);
  });
});
