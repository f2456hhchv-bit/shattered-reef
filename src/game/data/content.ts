import type { SkillId, CombatStyle } from './items';

// Skills, resource nodes, recipes, shop, spells, enemies, loot. All tunable here.

export type SkillGroup = 'Combat' | 'Gathering' | 'Production';
export const SKILLS: { id: SkillId; name: string; colour: string; group: SkillGroup; blurb: string }[] = [
  { id: 'attack', name: 'Attack', colour: '#c9584a', group: 'Combat', blurb: 'Melee accuracy. Train with the Accurate stance. Unlocks better weapons.' },
  { id: 'strength', name: 'Strength', colour: '#4f9a52', group: 'Combat', blurb: 'Melee max hit. Train with the Aggressive stance.' },
  { id: 'defence', name: 'Defence', colour: '#6b8fc9', group: 'Combat', blurb: 'Avoid hits and wear heavier armour. Train with the Defensive stance.' },
  { id: 'hitpoints', name: 'Hitpoints', colour: '#d8584a', group: 'Combat', blurb: 'Your health. Rises with all combat.' },
  { id: 'ranged', name: 'Ranged', colour: '#7aa83e', group: 'Combat', blurb: 'Pistol accuracy and damage. Needs shot in your ammo slot.' },
  { id: 'magic', name: 'Magic', colour: '#59d0c4', group: 'Combat', blurb: 'Tide spells. Needs a staff and tide charms.' },
  { id: 'woodcutting', name: 'Woodcutting', colour: '#6f9a4a', group: 'Gathering', blurb: 'Chop trees for logs.' },
  { id: 'mining', name: 'Mining', colour: '#a07a5a', group: 'Gathering', blurb: 'Mine ore from rocks.' },
  { id: 'fishing', name: 'Fishing', colour: '#4fa7c2', group: 'Gathering', blurb: 'Fish from the quay, or better fish from your ship.' },
  { id: 'smithing', name: 'Smithing', colour: '#c9a050', group: 'Production', blurb: 'Smelt bars and forge tools, blades and armour.' },
  { id: 'gunsmithing', name: 'Gunsmithing', colour: '#9a8a6a', group: 'Production', blurb: 'Make pistols and shot at the gunsmith\'s bench.' },
  { id: 'cooking', name: 'Cooking', colour: '#d88a4a', group: 'Production', blurb: 'Cook food that heals you in a fight.' },
];
export const COMBAT_SKILLS: SkillId[] = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic'];

/** What each level unlocks, shown in the Skills tab so the next goal is always visible. */
export const UNLOCKS: Record<SkillId, { level: number; text: string }[]> = {
  attack: [{ level: 1, text: 'Bronze cutlass' }, { level: 5, text: 'Brigand\'s hanger' }, { level: 10, text: 'Iron cutlass' }],
  strength: [{ level: 10, text: 'Max hit +1 roughly every 4 levels' }],
  defence: [{ level: 1, text: 'Bronze helm, leather' }, { level: 10, text: 'Lockbound plate' }],
  hitpoints: [{ level: 11, text: '+1 health every level' }],
  ranged: [{ level: 1, text: 'Flintlock pistol, bronze shot' }, { level: 5, text: 'Scatter shot special' }, { level: 10, text: 'Iron shot' }, { level: 15, text: 'Iron-banded pistol' }],
  magic: [{ level: 1, text: 'Brine Spray' }, { level: 5, text: 'Squall special' }, { level: 9, text: 'Tide Bolt' }],
  woodcutting: [{ level: 1, text: 'Saltpine trees' }, { level: 10, text: 'Iron hatchet' }, { level: 15, text: 'Sea-oak trees' }],
  mining: [{ level: 1, text: 'Copper and tin rocks' }, { level: 10, text: 'Iron pickaxe' }, { level: 15, text: 'Iron rocks' }],
  fishing: [{ level: 1, text: 'Reef sprats (quay)' }, { level: 8, text: 'Bellfish (from your ship)' }],
  smithing: [{ level: 1, text: 'Bronze bars, hatchet, pickaxe' }, { level: 3, text: 'Bronze cutlass' }, { level: 5, text: 'Bronze helm' }, { level: 15, text: 'Iron bars' }, { level: 18, text: 'Iron tools and cutlass' }],
  gunsmithing: [{ level: 1, text: 'Bronze shot' }, { level: 5, text: 'Flintlock pistol' }, { level: 15, text: 'Iron shot' }, { level: 20, text: 'Iron-banded pistol' }],
  cooking: [{ level: 1, text: 'Sprats' }, { level: 4, text: 'Crab meat' }, { level: 10, text: 'Bellfish' }],
};

export interface NodeDef {
  id: string;
  name: string;
  skill: SkillId;
  level: number;
  xp: number;
  item: string;
  difficulty: number; // higher = lower base success chance
  depleteChance: number; // per successful gather
  respawn: number; // seconds
  verb: string;
  fromShip?: boolean; // only reachable by boat
}

// XP per action follows RuneScape's early values (copper 17.5, logs 25, shrimp 10).
export const NODES: Record<string, NodeDef> = {
  tree_pine: { id: 'tree_pine', name: 'Saltpine', skill: 'woodcutting', level: 1, xp: 25, item: 'logs_pine', difficulty: 0.45, depleteChance: 0.2, respawn: 14, verb: 'Chop' },
  tree_oak: { id: 'tree_oak', name: 'Sea-oak', skill: 'woodcutting', level: 15, xp: 37.5, item: 'logs_oak', difficulty: 0.6, depleteChance: 0.15, respawn: 25, verb: 'Chop' },
  rock_copper: { id: 'rock_copper', name: 'Copper rock', skill: 'mining', level: 1, xp: 17.5, item: 'ore_copper', difficulty: 0.45, depleteChance: 1, respawn: 6, verb: 'Mine' },
  rock_tin: { id: 'rock_tin', name: 'Tin rock', skill: 'mining', level: 1, xp: 17.5, item: 'ore_tin', difficulty: 0.45, depleteChance: 1, respawn: 6, verb: 'Mine' },
  rock_iron: { id: 'rock_iron', name: 'Iron rock', skill: 'mining', level: 15, xp: 35, item: 'ore_iron', difficulty: 0.55, depleteChance: 1, respawn: 10, verb: 'Mine' },
  spot_sprat: { id: 'spot_sprat', name: 'Sprat shoal', skill: 'fishing', level: 1, xp: 10, item: 'fish_sprat_raw', difficulty: 0.45, depleteChance: 0, respawn: 0, verb: 'Fish' },
  spot_bell: { id: 'spot_bell', name: 'Bellfish shoal', skill: 'fishing', level: 8, xp: 35, item: 'fish_bell_raw', difficulty: 0.55, depleteChance: 0, respawn: 0, verb: 'Fish', fromShip: true },
};

export type Station = 'furnace' | 'anvil' | 'fire' | 'bench';

export interface Recipe {
  id: string;
  station: Station;
  skill: SkillId;
  level: number;
  xp: number;
  inputs: { id: string; qty: number }[];
  output: { id: string; qty: number };
  burn?: { item: string; stopLevel: number }; // cooking: chance to burn falls to 0 at stopLevel
  rarityRoll?: boolean; // forged equipment can roll Fine/Rare
}

export const RECIPES: Recipe[] = [
  { id: 'smelt_bronze', station: 'furnace', skill: 'smithing', level: 1, xp: 6.25, inputs: [{ id: 'ore_copper', qty: 1 }, { id: 'ore_tin', qty: 1 }], output: { id: 'bar_bronze', qty: 1 } },
  { id: 'smelt_iron', station: 'furnace', skill: 'smithing', level: 15, xp: 12.5, inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'bar_iron', qty: 1 } },
  { id: 'forge_hatchet_bronze', station: 'anvil', skill: 'smithing', level: 1, xp: 12.5, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'hatchet_bronze', qty: 1 } },
  { id: 'forge_pickaxe_bronze', station: 'anvil', skill: 'smithing', level: 1, xp: 12.5, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'pickaxe_bronze', qty: 1 } },
  { id: 'forge_cutlass_bronze', station: 'anvil', skill: 'smithing', level: 3, xp: 25, inputs: [{ id: 'bar_bronze', qty: 2 }], output: { id: 'cutlass_bronze', qty: 1 }, rarityRoll: true },
  { id: 'forge_helm_bronze', station: 'anvil', skill: 'smithing', level: 5, xp: 25, inputs: [{ id: 'bar_bronze', qty: 2 }], output: { id: 'helm_bronze', qty: 1 }, rarityRoll: true },
  { id: 'forge_hatchet_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 25, inputs: [{ id: 'bar_iron', qty: 1 }, { id: 'logs_oak', qty: 1 }], output: { id: 'hatchet_iron', qty: 1 } },
  { id: 'forge_pickaxe_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 25, inputs: [{ id: 'bar_iron', qty: 1 }, { id: 'logs_oak', qty: 1 }], output: { id: 'pickaxe_iron', qty: 1 } },
  { id: 'forge_cutlass_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 50, inputs: [{ id: 'bar_iron', qty: 2 }], output: { id: 'cutlass_iron', qty: 1 }, rarityRoll: true },
  { id: 'gun_shot_bronze', station: 'bench', skill: 'gunsmithing', level: 1, xp: 12.5, inputs: [{ id: 'bar_bronze', qty: 1 }], output: { id: 'shot_bronze', qty: 15 } },
  { id: 'gun_pistol', station: 'bench', skill: 'gunsmithing', level: 5, xp: 30, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'pistol_flintlock', qty: 1 }, rarityRoll: true },
  { id: 'gun_shot_iron', station: 'bench', skill: 'gunsmithing', level: 15, xp: 25, inputs: [{ id: 'bar_iron', qty: 1 }], output: { id: 'shot_iron', qty: 15 } },
  { id: 'gun_pistol_iron', station: 'bench', skill: 'gunsmithing', level: 20, xp: 60, inputs: [{ id: 'bar_iron', qty: 1 }, { id: 'logs_oak', qty: 1 }], output: { id: 'pistol_iron', qty: 1 }, rarityRoll: true },
  { id: 'cook_sprat', station: 'fire', skill: 'cooking', level: 1, xp: 30, inputs: [{ id: 'fish_sprat_raw', qty: 1 }], output: { id: 'fish_sprat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 20 } },
  { id: 'cook_crab', station: 'fire', skill: 'cooking', level: 4, xp: 35, inputs: [{ id: 'crab_meat_raw', qty: 1 }], output: { id: 'crab_meat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 26 } },
  { id: 'cook_bell', station: 'fire', skill: 'cooking', level: 10, xp: 60, inputs: [{ id: 'fish_bell_raw', qty: 1 }], output: { id: 'fish_bell', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 34 } },
];

export const SHOP = {
  name: 'Gell\'s Harbour Goods',
  stock: [
    { id: 'bread', qty: 1 }, { id: 'fishing_rod', qty: 1 }, { id: 'hatchet_chipped', qty: 1 }, { id: 'pickaxe_chipped', qty: 1 },
    { id: 'pistol_flintlock', qty: 1 }, { id: 'shot_bronze', qty: 25 }, { id: 'staff_driftwood', qty: 1 }, { id: 'charm_tide', qty: 25 },
    { id: 'cap_leather', qty: 1 }, { id: 'coat_padded', qty: 1 },
  ],
  buyMul: 1.0, // player pays value * qty * buyMul
  sellMul: 0.5, // player receives value * sellMul
};

// ---- magic -------------------------------------------------------------------
export interface Spell { id: string; name: string; level: number; maxHit: number; baseXp: number; charms: number }
// RuneScape's Wind Strike: max 2, 5.5 base xp; Water Bolt-ish at 9.
export const SPELLS: Spell[] = [
  { id: 'spray', name: 'Brine Spray', level: 1, maxHit: 2, baseXp: 5.5, charms: 1 },
  { id: 'bolt', name: 'Tide Bolt', level: 9, maxHit: 5, baseXp: 11.5, charms: 2 },
];

// ---- player tuning -------------------------------------------------------------
export const PLAYER_BASE = {
  speed: 4.6,
  meleeReach: 1.6,
  regenEvery: 6, // seconds per 1 health out of combat
  rollCooldown: 3, rollTime: 0.32, rollSpeed: 13, // dodge: invulnerable while rolling
  special: {
    melee: { name: 'Whirl', cooldown: 8, level: 1, skill: 'attack' as SkillId, radius: 3.2, mul: 1.0 },
    ranged: { name: 'Scatter shot', cooldown: 8, level: 5, skill: 'ranged' as SkillId, shots: 3, spread: 0.35 },
    magic: { name: 'Squall', cooldown: 10, level: 5, skill: 'magic' as SkillId, radius: 4, charms: 3, maxHit: 3, knock: 2.5 },
  },
};

// ---- enemies -------------------------------------------------------------------
export type EnemyModel = 'crab' | 'brigand' | 'gunner' | 'guardian';

export interface EnemyDef {
  id: string;
  name: string;
  model: EnemyModel;
  level: number; // combat level (display)
  hp: number;
  att: number; // attack level
  def: number; // defence level
  defBonus: Record<CombatStyle, number>; // the combat triangle lives here
  weakness: CombatStyle;
  style: CombatStyle;
  accBonus: number;
  maxHit: number;
  speed: number;
  radius: number;
  aggro: number;
  attack: { kind: 'melee'; range: number; windup: number; cooldown: number } | { kind: 'shot'; range: number; windup: number; cooldown: number; keepAway: number };
  loot: string;
  respawn: number;
  scale: number;
  boss?: boolean;
}

// OSRS-scale numbers: you start with 10 health; a reef crab hits at most 1.
export const ENEMIES: Record<string, EnemyDef> = {
  reef_crab: { id: 'reef_crab', name: 'Reef crab', model: 'crab', level: 2, hp: 4, att: 1, def: 1, defBonus: { melee: 10, ranged: 5, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 0, maxHit: 1,
    speed: 2.4, radius: 0.7, aggro: 6, attack: { kind: 'melee', range: 1.5, windup: 0.45, cooldown: 2.4 }, loot: 'crab', respawn: 20, scale: 1.1 },
  brigand: { id: 'brigand', name: 'Brigand', model: 'brigand', level: 9, hp: 16, att: 8, def: 6, defBonus: { melee: 10, ranged: -10, magic: 5 }, weakness: 'ranged', style: 'melee', accBonus: 8, maxHit: 3,
    speed: 3.3, radius: 0.45, aggro: 9, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'brigand', respawn: 30, scale: 1.2 },
  gunner: { id: 'gunner', name: 'Brigand gunner', model: 'gunner', level: 11, hp: 13, att: 12, def: 4, defBonus: { melee: -10, ranged: 15, magic: 5 }, weakness: 'melee', style: 'ranged', accBonus: 12, maxHit: 4,
    speed: 3.0, radius: 0.45, aggro: 12, attack: { kind: 'shot', range: 10, windup: 0.9, cooldown: 3.6, keepAway: 6 }, loot: 'brigand', respawn: 30, scale: 1.2 },
  guardian: { id: 'guardian', name: 'The Lockbound Guardian', model: 'guardian', level: 22, hp: 40, att: 20, def: 8, defBonus: { melee: 15, ranged: 5, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 15, maxHit: 5,
    speed: 2.2, radius: 1.4, aggro: 30, attack: { kind: 'melee', range: 3.2, windup: 0.8, cooldown: 2.4 }, loot: 'guardian', respawn: 0, scale: 1.0, boss: true },
};

export interface EliteAffix { id: string; name: string; desc: string; colour: string }
export const ELITE_AFFIXES: EliteAffix[] = [
  { id: 'barnacled', name: 'Barnacled', desc: 'Triple health, hard to knock back', colour: '#cfc6b0' },
  { id: 'frenzied', name: 'Frenzied', desc: 'Moves and attacks 40% faster', colour: '#e05a3c' },
  { id: 'volatile', name: 'Volatile', desc: 'Explodes shortly after death', colour: '#f2a43a' },
];

export interface LootTable {
  coins?: [number, number];
  drops: { item: string; chance: number; qty?: [number, number] }[];
  gear?: { chance: number; items: string[]; weights: Partial<Record<'common' | 'fine' | 'rare' | 'relic', number>> };
}

export const LOOT: Record<string, LootTable> = {
  crab: { coins: [1, 4], drops: [{ item: 'crab_meat_raw', chance: 0.6 }, { item: 'shell_fragment', chance: 0.2 }, { item: 'charm_tide', chance: 0.25, qty: [2, 5] }], gear: { chance: 0.03, items: ['ring_brass'], weights: { common: 60, fine: 35, rare: 5 } } },
  brigand: { coins: [5, 15], drops: [{ item: 'bread', chance: 0.3 }, { item: 'shot_bronze', chance: 0.3, qty: [4, 10] }, { item: 'ore_iron', chance: 0.12 }],
    gear: { chance: 0.15, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass', 'pistol_flintlock'], weights: { common: 50, fine: 38, rare: 12 } } },
  elite: { coins: [12, 30], drops: [], gear: { chance: 0.6, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass', 'cutlass_bronze', 'pistol_flintlock', 'staff_driftwood'], weights: { fine: 65, rare: 35 } } },
  guardian: { coins: [80, 130], drops: [{ item: 'bar_iron', chance: 1, qty: [2, 4] }, { item: 'charm_tide', chance: 1, qty: [20, 40] }],
    gear: { chance: 1, items: ['lockplate', 'cutlass_iron', 'ring_brass', 'pistol_iron'], weights: { rare: 70, relic: 30 } } },
};

/** XP per point of damage, RuneScape rates. */
export const XP_PER_DAMAGE = { style: 4, hitpoints: 4 / 3, magic: 2 };
