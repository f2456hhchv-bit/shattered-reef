import type { SkillId } from './items';

// Active skilling (Tom, 2026-10-25, docs/ISLANDS.md): every swing and every craft has a gold window near its end. Tap
// in it and that cycle is "perfect". It's a bonus for paying attention, never a tax: leave it alone and every skill
// runs at the same pace it always has.
export const ACTIVE = {
  /** the gold window, as a fraction of the cycle (a 2.4 s swing: about 0.7 s, closing just before the swing lands) */
  window: [0.62, 0.92] as [number, number],
  /** a perfect swing fills progress toward the next item this much faster, and never by less than `perfectMin`
   *  of an item, so you can see it land (Tom: "it may as well not be there") */
  gatherBonus: 1.33,
  perfectMin: 0.35,
  /** every this many perfect swings in a row, a bonus item on top; a mistimed or untapped swing breaks the run */
  streakEvery: 6,
  /** a perfect craft gives this much more XP; cooking can't burn; forging gains this much masterwork chance */
  craftXp: 1.33,
  fineBonus: 0.1,
  /** what you hear when you nail it */
  calls: {
    woodcutting: 'Clean cut!', mining: 'Seam struck!', fishing: 'On the strike!', cooking: 'Off the heat!', smithing: 'On the beat!',
    fletching: 'True cut!', gunsmithing: 'Tight fit!', crafting: 'Neat stitch!',
  } as Partial<Record<SkillId, string>>,
};
