import type { RegionId } from '../world/regions';
import type { ShardCost } from './content';

// The spellbook beyond combat (Tom, 2026-10-27: "we need to introduce other spells... spells that may affect skilling,
// teleport etc."), RuneScape's standard book in the islands' terms. Cast from the Magic tab, any time, with or
// without a staff: your chosen combat spell is untouched. Costs in shards, like runes.

export type BookKind = 'curse' | 'bind' | 'buff' | 'superheat' | 'teleport';
export interface BookSpell {
  id: string; name: string; level: number; xp: number; cost: ShardCost; kind: BookKind; text: string;
  /** curse: what it lowers on the foe, by how much, for how long */
  curse?: { stat: 'acc' | 'dmg' | 'def'; pct: number; secs: number };
  /** bind: seconds the foe is held */
  bind?: number;
  /** buff: what it helps, by how much, for how long */
  buff?: { what: 'woodcutting' | 'fishing' | 'mining' | 'cooking'; pct: number; secs: number };
  /** teleport: where to */
  to?: RegionId;
}

const c = (...pairs: [string, number][]): ShardCost => pairs.map(([id, qty]) => ({ id, qty }));
const G = 'shard_gale', T = 'charm_tide', S = 'shard_stone', E = 'shard_ember', B = 'shard_bone', R = 'shard_root', C = 'shard_compass';

export const BOOK: BookSpell[] = [
  // curses, on the foe you're fighting (RuneScape's Confuse, Weaken, Curse: water, earth and a body rune)
  { id: 'confuse', name: 'Confuse', level: 3, xp: 13, kind: 'curse', cost: c([T, 3], [S, 2], [B, 1]), curse: { stat: 'acc', pct: 20, secs: 30 }, text: 'Your foe\'s attacks land less often: −20% accuracy for 30 s.' },
  { id: 'weaken', name: 'Weaken', level: 11, xp: 21, kind: 'curse', cost: c([T, 3], [S, 2], [B, 1]), curse: { stat: 'dmg', pct: 20, secs: 30 }, text: 'Your foe hits softer: −20% damage for 30 s.' },
  { id: 'curse', name: 'Curse', level: 19, xp: 29, kind: 'curse', cost: c([T, 2], [S, 3], [B, 1]), curse: { stat: 'def', pct: 20, secs: 30 }, text: 'Your foe guards worse: −20% defence for 30 s.' },
  // binds: hold a foe where it stands (it still swings at anything in reach). Bosses shrug them off
  { id: 'bind', name: 'Bind', level: 20, xp: 30, kind: 'bind', cost: c([S, 3], [T, 3], [R, 2]), bind: 5, text: 'Roots grip your foe\'s feet: it can\'t move for 5 s.' },
  { id: 'snare', name: 'Snare', level: 50, xp: 60, kind: 'bind', cost: c([S, 4], [T, 4], [R, 3]), bind: 10, text: 'Roots and weed hold your foe for 10 s.' },
  { id: 'entangle', name: 'Entangle', level: 79, xp: 89, kind: 'bind', cost: c([S, 5], [T, 5], [R, 4]), bind: 15, text: 'The ground itself holds your foe for 15 s.' },
  // skilling: the work goes better for a while
  { id: 'gale_edge', name: 'Gale Edge', level: 27, xp: 35, kind: 'buff', cost: c([G, 3], [R, 1]), buff: { what: 'woodcutting', pct: 15, secs: 300 }, text: 'Wind behind your hatchet: +15% woodcutting success for 5 minutes.' },
  { id: 'call_shoals', name: 'Call the Shoals', level: 33, xp: 40, kind: 'buff', cost: c([T, 3], [R, 1]), buff: { what: 'fishing', pct: 15, secs: 300 }, text: 'The fish come to your line: +15% fishing success for 5 minutes.' },
  { id: 'stone_sense', name: 'Stone Sense', level: 39, xp: 45, kind: 'buff', cost: c([S, 3], [R, 1]), buff: { what: 'mining', pct: 15, secs: 300 }, text: 'You feel where the rock will split: +15% mining success for 5 minutes.' },
  { id: 'superheat', name: 'Superheat', level: 43, xp: 53, kind: 'superheat', cost: c([E, 4], [R, 1]), text: 'Smelt one bar from the ore in your pack, no furnace needed. Smithing XP as if you\'d used one.' },
  { id: 'ember_hand', name: 'Ember Hand', level: 47, xp: 55, kind: 'buff', cost: c([E, 3], [T, 1], [R, 1]), buff: { what: 'cooking', pct: 100, secs: 300 }, text: 'You feel the heat in the food: nothing burns for 5 minutes.' },
  // teleports: to an island's harbour, once you've been there and the sea's open (RuneScape's law-rune teleports)
  { id: 'tp_bellwether', name: 'Bellwether Teleport', level: 25, xp: 35, kind: 'teleport', cost: c([G, 3], [C, 1]), to: 'bellwether', text: 'To Bellwether quay. (Tide-walk Home.)' },
  { id: 'tp_sunreach', name: 'Sunreach Teleport', level: 31, xp: 41, kind: 'teleport', cost: c([G, 3], [S, 1], [C, 1]), to: 'sunreach', text: 'To Sunreach harbour.' },
  { id: 'tp_amberhold', name: 'Amberhold Teleport', level: 37, xp: 48, kind: 'teleport', cost: c([G, 3], [T, 1], [C, 1]), to: 'amberhold', text: 'To Tollhouse on Amberhold.' },
  { id: 'tp_wrack', name: 'Stormwrack Teleport', level: 45, xp: 55, kind: 'teleport', cost: c([G, 5], [C, 1]), to: 'wrack', text: 'To Gallows Landing on Stormwrack.' },
  { id: 'tp_lockhaven', name: 'Lockhaven Teleport', level: 51, xp: 61, kind: 'teleport', cost: c([T, 2], [C, 2]), to: 'lockhaven', text: 'To the Lockhaven quay.' },
  { id: 'tp_saltglass', name: 'Saltglass Teleport', level: 58, xp: 68, kind: 'teleport', cost: c([S, 2], [C, 2]), to: 'saltglass', text: 'To the Saltglass landing.' },
  { id: 'tp_longstrand', name: 'Longstrand Teleport', level: 64, xp: 74, kind: 'teleport', cost: c([E, 2], [C, 2]), to: 'longstrand', text: 'To the Longstrand landing.' },
];
export const BOOK_BY: Record<string, BookSpell> = Object.fromEntries(BOOK.map((b) => [b.id, b]));
/** seconds between book spells (RuneScape's cast delay); teleports also wait out a fight */
export const BOOK_COOLDOWN = 1.8;
