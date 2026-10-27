import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { SHIPYARD, SHIP_PARTS } from '../data/shipyard';
import { ITEMS } from '../data/items';

const base = new Game({ seed: 1 });
const fresh = () => new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

describe('the shipwright', () => {
  it('every refit asks for things that exist, and gets dearer and better each time', () => {
    for (const part of SHIP_PARTS) {
      const tiers = SHIPYARD[part].tiers;
      for (const t of tiers) for (const i of t.items) expect(ITEMS[i.id], `${part}: ${i.id}`).toBeTruthy();
      for (let k = 1; k < tiers.length; k++) { expect(tiers[k].v).toBeGreaterThan(tiers[k - 1].v); expect(tiers[k].sailing).toBeGreaterThan(tiers[k - 1].sailing); }
    }
  });

  it('a refit needs the Sailing, the coins and the goods; it takes them, and the ship is better for good', () => {
    const g = fresh();
    const t1 = SHIPYARD.hull.tiers[0], hull0 = g.naval.hullMax();
    expect(g.refitBlock('hull')).toMatch(/Sailing/);
    g.p.xp.sailing = xpForLevel(t1.sailing);
    const hullAt = g.naval.hullMax();
    expect(g.refitBlock('hull')).toMatch(/coins/);
    const c0 = count(g.p.inv, 'coins');
    g.give('coins', t1.coins);
    expect(g.refitBlock('hull')).toMatch(/Needs/);
    for (const i of t1.items) g.give(i.id, i.qty);
    expect(g.refitBlock('hull')).toBeNull();
    expect(g.refit('hull')).toBe(true);
    expect(g.shipTier('hull')).toBe(1);
    expect(count(g.p.inv, 'coins')).toBe(c0);
    for (const i of t1.items) expect(count(g.p.inv, i.id)).toBe(0);
    expect(g.naval.hullMax()).toBe(Math.round(hullAt * 1.1));
    expect(hull0).toBeLessThanOrEqual(hullAt);
    // it survives a save
    const g2 = new Game({ seed: 3, save: JSON.parse(JSON.stringify(g.serialize())) });
    expect(g2.shipTier('hull')).toBe(1);
    expect(g2.refit('hull')).toBe(false);
  });
});
