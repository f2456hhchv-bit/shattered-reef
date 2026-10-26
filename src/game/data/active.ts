import type { SkillId } from './items';

export type Struck = 'perfect' | 'red' | 'miss';

// Active skilling (Tom, 2026-10-25, docs/ISLANDS.md): a timing bar with a gold window near its end, on every craft and
// on the swing that's about to land an item. Tap in the gold and that item comes twice, in its red heart three times;
// a craft gets more XP. It's a bonus for paying attention, never a tax: leave it alone and every skill runs as it did.
export const ACTIVE = {
  /** the gold window, as a fraction of the cycle (a 2.4 s swing: about 0.7 s, closing just before the swing lands) */
  window: [0.62, 0.92] as [number, number],
  /** the red heart of the gold window: harder, worth more */
  red: [0.73, 0.81] as [number, number],
  /** items from the swing that lands one (the timing bar only shows on that swing): no tap or a miss one, gold two,
   *  red three (Tom: "should it not just give 2, maybe a small red section that gives 3?"). XP counts for each. */
  times: { miss: 1, perfect: 2, red: 3 } as Record<Struck, number>,
  /** a perfect craft gives this much more XP; cooking can't burn; forging gains this much masterwork chance */
  craftXp: 1.33,
  fineBonus: 0.1,
  /** what you hear when you nail it */
  calls: {
    woodcutting: 'Clean cut!', mining: 'Seam struck!', fishing: 'On the strike!', cooking: 'Off the heat!', smithing: 'On the beat!',
    fletching: 'True cut!', gunsmithing: 'Tight fit!', crafting: 'Neat stitch!',
  } as Partial<Record<SkillId, string>>,
};
