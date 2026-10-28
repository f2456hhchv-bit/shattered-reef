import type { SkillId } from './items';

export type Struck = 'perfect' | 'red' | 'miss';

// Active skilling (Tom, 2026-10-25, docs/ISLANDS.md): a timing bar with a gold window near its end, on every craft and
// on the swing that's about to land an item. Tap in the gold and that item comes twice, in its red heart three times;
// a craft gets more XP. It's a bonus for paying attention, never a tax: leave it alone and every skill runs as it did.
export const ACTIVE = {
  /** the gold window, as a fraction of the cycle (a 2.4 s swing: about 0.4 s, closing just before the swing lands) */
  window: [0.70, 0.86] as [number, number],
  /** the red heart of the gold window: harder, worth more (about 0.1 s) */
  red: [0.76, 0.80] as [number, number],
  /** a lucky swing (Tom, 2026-10-27: "a 'rare' random event, like once every 5 mins"): the bar only shows once this
   *  many seconds have passed since the last one, on the next swing that lands an item or the next craft */
  cooldown: [240, 360] as [number, number],
  /** items from the swing that lands one (the timing bar only shows on that swing): no tap or a miss one, gold two,
   *  red three (Tom: "should it not just give 2, maybe a small red section that gives 3?"). */
  times: { miss: 1, perfect: 2, red: 3 } as Record<Struck, number>,
  /** XP for that swing: softer than the items, so focused play doesn't level three times as fast (Tom, 2026-10-26) */
  xpTimes: { miss: 1, perfect: 1.5, red: 2 } as Record<Struck, number>,
  /** a perfect craft gives this much more XP; cooking can't burn; forging gains this much masterwork chance */
  craftXp: 1.33,
  fineBonus: 0.1,
  /** what you hear when you nail it */
  calls: {
    woodcutting: 'Clean cut!', mining: 'Seam struck!', fishing: 'On the strike!', cooking: 'Off the heat!', smithing: 'On the beat!',
    fletching: 'True cut!', gunsmithing: 'Tight fit!', crafting: 'Neat stitch!', shardcraft: 'Bright!',
  } as Partial<Record<SkillId, string>>,
};

/** Gathering moments (docs/ISLANDS.md, slice 1b's rare events): now and then the item a swing lands sets off
 * something you have to answer with the timing tap. A nest falls (catch it), something big takes the line (three
 * pulls, each on the gold), a hidden seam cracks open (strike it before it crumbles). Ignore one and you lose
 * only what it offered; answer it and it pays well. */
export type MomentKind = 'nest' | 'tug' | 'seam' | 'line';
export interface MomentDef {
  /** seconds for each tap, how many taps in a row, and the gold window and red heart of each */
  secs: number; steps: number; window: [number, number]; red: [number, number];
  start: string; label: string; win: string; lose: string;
}
export const MOMENTS = {
  /** chance per landed item (skills with a moment only), once the cooldown has run */
  chance: 0.02,
  /** seconds after one moment before another can start (a playtest saw the big fish bite every 2 minutes of
   *  fishing: fishing lands items fast, so a per-item chance alone isn't rare) */
  cooldown: 300,
  bySkill: { woodcutting: 'nest', fishing: 'tug', mining: 'seam' } as Partial<Record<SkillId, MomentKind>>,
  defs: {
    nest: { secs: 1.3, steps: 1, window: [0.5, 0.92], red: [0.68, 0.8], label: 'Catch!',
      start: 'A nest tumbles out of the branches!', win: 'Caught it, eggs and all.', lose: 'The nest hits the ground and the eggs break.' },
    tug: { secs: 1.15, steps: 3, window: [0.55, 0.9], red: [0.68, 0.78], label: 'Pull!',
      start: 'Something big takes the line! Pull on the gold, three times.', win: 'You haul it in, thrashing, over the side.', lose: 'The line goes slack. Whatever it was, it\'s gone.' },
    line: { secs: 1.0, steps: 5, window: [0.6, 0.88], red: [0.7, 0.78], label: 'Pull!',
      start: 'Something takes Saoirse\'s line and the whole Netting Grounds goes still. Five pulls, each on the gold.', win: 'The Line-fish comes up silver as a coin, and something in its gill flashes.', lose: 'The line goes slack. It\'s still down there. It\'ll bite again.' },
    seam: { secs: 1.2, steps: 1, window: [0.6, 0.9], red: [0.7, 0.8], label: 'Strike!',
      start: 'The rock cracks along a hidden seam!', win: 'The seam splits open. Something glitters inside.', lose: 'The seam crumbles to grit. Chips sting your hands.' },
  } as Record<MomentKind, MomentDef>,
};
