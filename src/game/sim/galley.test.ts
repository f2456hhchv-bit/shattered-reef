import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/content';

const base = new Game({ seed: 1 });
const fresh = () => new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

describe('the galley', () => {
  it('every meal is cooked from things that exist', () => {
    const meals = Object.values(ITEMS).filter((d) => d.meal);
    expect(meals.length).toBeGreaterThanOrEqual(6);
    for (const m of meals) {
      const r = RECIPES.find((x) => x.output.id === m.id);
      expect(r, m.id).toBeTruthy();
      for (const i of r!.inputs) expect(ITEMS[i.id], `${m.id}: ${i.id}`).toBeTruthy();
    }
  });

  it('a meal works at full health, lasts its time, one at a time, and survives a save', () => {
    const g = fresh();
    const hit0 = g.stats.maxHit;
    g.give('pepperpot', 1); g.give('fiskesuppe', 1);
    g.p.hp = g.stats.maxHp;
    g.eat(g.p.inv.findIndex((s) => s?.id === 'pepperpot'));
    expect(g.s.meal?.id).toBe('pepperpot');
    expect(g.stats.maxHit).toBe(Math.floor(hit0 * 1.06));
    const sv = JSON.parse(JSON.stringify(g.serialize()));
    const g2 = new Game({ seed: 3, save: sv });
    expect(g2.stats.maxHit).toBe(Math.floor(hit0 * 1.06));
    // a second meal replaces the first
    g.eatCd = 0;
    const dr0 = g.stats.dr;
    g.eat(g.p.inv.findIndex((s) => s?.id === 'fiskesuppe'));
    expect(g.s.meal?.id).toBe('fiskesuppe');
    expect(g.stats.maxHit).toBe(hit0);
    expect(g.stats.dr).toBeCloseTo(dr0 + 0.05);
    // and wears off
    for (let t = 0; t < 490; t += 0.1) g.step(0.1);
    expect(g.s.meal).toBeUndefined();
    expect(g.stats.dr).toBeCloseTo(dr0);
  }, 60_000);
});
