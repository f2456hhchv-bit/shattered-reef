import { it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { ENEMIES } from '../data/content';

// Tom, 2026-10-27, on melee flow: "it's the amount of misses for definite". An even fight misses about a quarter of the
// time (RuneScape's roll misses ~40%); the bosses keep the roll their balance tests were tuned to.
const base = new Game({ seed: 1 });
const missRate = (foe: string, lvl: number, weapon: string) => {
  const g = new Game({ seed: 2, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
  for (const k of ['attack', 'strength', 'defence'] as const) g.p.xp[k] = xpForLevel(lvl);
  g.p.equip.weapon = { id: weapon, qty: 1 }; g.recalc();
  const e = { def: ENEMIES[foe], elite: null, fx: { shatter: 0, marks: 0, root: 0, disarm: 0, slow: 0, lesson: 0, weak: 0, ward: 0, spoil: 0, bite: 0 } };
  let miss = 0; for (let k = 0; k < 4000; k++) if ((g as unknown as { rollAgainst: (e: unknown) => { dmg: number } }).rollAgainst(e).dmg === 0) miss++;
  return miss / 4000;
};

it('an even melee fight misses about a quarter of the time, not two in five', () => {
  for (const [foe, lvl, w] of [['brigand', 9, 'cutlass_bronze'], ['haugbui', 18, 'cutlass_iron'], ['moss_troll', 42, 'cutlass_storm'], ['oakheart', 76, 'cutlass_tide']] as const) {
    const m = missRate(foe, lvl, w);
    expect(m, foe).toBeLessThan(0.3);
    expect(m, foe).toBeGreaterThan(0.1); // still a fight: you do miss
  }
});

it('bosses keep RuneScape\'s roll', () => {
  expect(missRate('guardian', 12, 'cutlass_bronze')).toBeGreaterThan(0.35);
});
