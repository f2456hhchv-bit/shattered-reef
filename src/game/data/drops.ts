// Shared drop tables, RuneScape-style (Tom, 2026-10-25: "think RuneScape's drop tables: some items dropped by every
// creature, some crafting materials unique, some generic"). Every creature's own table (content.ts LOOT) holds its
// unique drops; on top of that any kill can reach the shared tables below, at the odds in DROP_CONFIG.

export const DROP_CONFIG = {
  gemChance: 1 / 48, // any kill: a roll on the gem table
  rareChance: 1 / 96, // kills of level RARE_FROM+: a roll on the rare drop table
  rareFrom: 15,
  eliteMul: 3, // elites reach the shared tables this many times as often
  commonChance: 1 / 4, // any kill: a roll on the common table (coins, charms, food, ammo for your level)
  miningGem: 1 / 256, // each ore mined can turn up a rough gem
};

/** Gems, common to rare. Rough ones drop; polishing them is Crafting; set in gold they're jewellery. */
export const GEMS = [
  { key: 'pearl', name: 'Sea pearl', colour: '#efe6dc', w: 32, cut: 20, xp: 50 },
  { key: 'jade', name: 'Kelp jade', colour: '#3e9a5a', w: 16, cut: 27, xp: 67.5 },
  { key: 'ruby', name: 'Coral ruby', colour: '#d8442a', w: 8, cut: 34, xp: 85 },
  { key: 'diamond', name: 'Storm diamond', colour: '#cfe6ff', w: 3, cut: 43, xp: 107.5 },
  { key: 'eye', name: 'Leviathan\'s eye', colour: '#7a3ad8', w: 1, cut: 55, xp: 137.5 },
] as const;

export type Pick = { item: string; qty: [number, number] };

/** The rare drop table: big coin piles, gold, crystals, gems, caskets. `lvl` scales the coins. */
export function rareTable(lvl: number): { w: number; pick: Pick | 'gem' }[] {
  return [
    { w: 30, pick: { item: 'coins', qty: [lvl * 25, lvl * 60] } },
    { w: 12, pick: { item: 'bar_gold', qty: [2, 4] } },
    { w: 12, pick: { item: 'crystal_geode', qty: [1, 2] } },
    { w: 20, pick: 'gem' },
    { w: 10, pick: { item: 'casket', qty: [1, 1] } },
    { w: 8, pick: { item: 'geode', qty: [2, 3] } },
    { w: 8, pick: { item: 'charm_tide', qty: [40, 80] } },
  ];
}

const FOOD_BY_LEVEL: [number, string][] = [[0, 'fish_sprat'], [10, 'fish_bell'], [20, 'fish_trout'], [30, 'fish_salmon'], [40, 'fish_lobster'], [50, 'fish_sword'], [62, 'fish_gloom'], [76, 'fish_shark']];
const METAL_BY_LEVEL: [number, string][] = [[0, 'bronze'], [10, 'iron'], [20, 'steel'], [30, 'storm'], [45, 'abyss'], [60, 'tide'], [75, 'cinder']];
const at = (list: [number, string][], lvl: number) => [...list].reverse().find(([l]) => lvl >= l)![1];

/** The tier shard (RuneScape's catalyst runes) a creature of this level carries. */
const CATALYST_BY_LEVEL: [number, string][] = [[0, 'shard_whisper'], [15, 'shard_squall'], [35, 'shard_grave'], [55, 'shard_heart'], [75, 'shard_wrath']];
/** The common table: coins, shards, a meal and ammunition that suit the creature's level. */
export function commonTable(lvl: number): { w: number; pick: Pick }[] {
  const metal = at(METAL_BY_LEVEL, lvl);
  return [
    { w: 40, pick: { item: 'coins', qty: [lvl * 2 + 2, lvl * 6 + 6] } },
    // shards: the elements (gale most, as in spells), and the catalyst for spells of the creature's level
    { w: 6, pick: { item: 'shard_gale', qty: [4, 10 + Math.floor(lvl / 3)] } },
    { w: 4, pick: { item: 'charm_tide', qty: [3, 8 + Math.floor(lvl / 4)] } },
    { w: 3, pick: { item: 'shard_stone', qty: [3, 8 + Math.floor(lvl / 4)] } },
    { w: 3, pick: { item: 'shard_ember', qty: [3, 8 + Math.floor(lvl / 4)] } },
    { w: 4, pick: { item: at(CATALYST_BY_LEVEL, lvl), qty: [1, 3 + Math.floor(lvl / 20)] } },
    { w: 2, pick: { item: 'shard_bone', qty: [1, 3] } },
    { w: 1, pick: { item: 'shard_star', qty: [1, 2] } },
    ...(lvl >= 20 ? [{ w: 1, pick: { item: 'shard_root', qty: [1, 2] as [number, number] } }, { w: 1, pick: { item: 'shard_compass', qty: [1, 2] as [number, number] } }] : []),
    { w: 15, pick: { item: at(FOOD_BY_LEVEL, lvl), qty: [1, 2] } },
    { w: 10, pick: { item: `shot_${metal}`, qty: [5, 15] } },
    { w: 8, pick: { item: `arrow_${metal}`, qty: [5, 15] } },
    { w: 7, pick: { item: `bolt_${metal}`, qty: [4, 12] } },
  ];
}
