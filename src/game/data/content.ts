import type { SkillId } from './items';

// Skills, resource nodes, recipes, shops, enemies, loot. All tunable here.

export const SKILLS: { id: SkillId; name: string; colour: string; blurb: string }[] = [
  { id: 'combat', name: 'Combat', colour: '#d0604c', blurb: 'Raised by dealing damage. Increases health and damage.' },
  { id: 'woodcutting', name: 'Woodcutting', colour: '#6f9a4a', blurb: 'Chop trees for logs. Logs fuel the furnace and sell well.' },
  { id: 'mining', name: 'Mining', colour: '#a07a5a', blurb: 'Mine ore from rocks for smelting.' },
  { id: 'smithing', name: 'Smithing', colour: '#c9a050', blurb: 'Smelt bars and forge tools, weapons and armour.' },
  { id: 'fishing', name: 'Fishing', colour: '#4fa7c2', blurb: 'Catch fish from the quay, or better fish from your ship.' },
  { id: 'cooking', name: 'Cooking', colour: '#d88a4a', blurb: 'Cook food that heals you in a fight.' },
];

/** What each level unlocks, shown in the Skills tab so the next goal is always visible. */
export const UNLOCKS: Record<SkillId, { level: number; text: string }[]> = {
  combat: [{ level: 5, text: 'Wield the Brigand\'s hanger' }, { level: 8, text: 'Wear the Lockbound plate' }, { level: 10, text: 'Wield an iron cutlass' }],
  woodcutting: [{ level: 1, text: 'Saltpine trees' }, { level: 10, text: 'Iron hatchet' }, { level: 15, text: 'Sea-oak trees' }],
  mining: [{ level: 1, text: 'Copper and tin rocks' }, { level: 10, text: 'Iron pickaxe' }, { level: 15, text: 'Iron rocks' }],
  smithing: [{ level: 1, text: 'Bronze bars, hatchet, pickaxe' }, { level: 3, text: 'Bronze cutlass' }, { level: 5, text: 'Bronze helm' }, { level: 15, text: 'Iron bars' }, { level: 18, text: 'Iron tools and cutlass' }],
  fishing: [{ level: 1, text: 'Reef sprats (quay)' }, { level: 8, text: 'Bellfish (from your ship)' }],
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

export const NODES: Record<string, NodeDef> = {
  tree_pine: { id: 'tree_pine', name: 'Saltpine', skill: 'woodcutting', level: 1, xp: 25, item: 'logs_pine', difficulty: 0.35, depleteChance: 0.2, respawn: 14, verb: 'Chop' },
  tree_oak: { id: 'tree_oak', name: 'Sea-oak', skill: 'woodcutting', level: 15, xp: 45, item: 'logs_oak', difficulty: 0.55, depleteChance: 0.15, respawn: 25, verb: 'Chop' },
  rock_copper: { id: 'rock_copper', name: 'Copper rock', skill: 'mining', level: 1, xp: 17, item: 'ore_copper', difficulty: 0.35, depleteChance: 1, respawn: 6, verb: 'Mine' },
  rock_tin: { id: 'rock_tin', name: 'Tin rock', skill: 'mining', level: 1, xp: 17, item: 'ore_tin', difficulty: 0.35, depleteChance: 1, respawn: 6, verb: 'Mine' },
  rock_iron: { id: 'rock_iron', name: 'Iron rock', skill: 'mining', level: 15, xp: 35, item: 'ore_iron', difficulty: 0.5, depleteChance: 1, respawn: 10, verb: 'Mine' },
  spot_sprat: { id: 'spot_sprat', name: 'Sprat shoal', skill: 'fishing', level: 1, xp: 15, item: 'fish_sprat_raw', difficulty: 0.4, depleteChance: 0, respawn: 0, verb: 'Fish' },
  spot_bell: { id: 'spot_bell', name: 'Bellfish shoal', skill: 'fishing', level: 8, xp: 40, item: 'fish_bell_raw', difficulty: 0.5, depleteChance: 0, respawn: 0, verb: 'Fish', fromShip: true },
};

export type Station = 'furnace' | 'anvil' | 'fire';

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
  { id: 'smelt_bronze', station: 'furnace', skill: 'smithing', level: 1, xp: 12, inputs: [{ id: 'ore_copper', qty: 1 }, { id: 'ore_tin', qty: 1 }], output: { id: 'bar_bronze', qty: 1 } },
  { id: 'smelt_iron', station: 'furnace', skill: 'smithing', level: 15, xp: 25, inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'bar_iron', qty: 1 } },
  { id: 'forge_hatchet_bronze', station: 'anvil', skill: 'smithing', level: 1, xp: 20, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'hatchet_bronze', qty: 1 } },
  { id: 'forge_pickaxe_bronze', station: 'anvil', skill: 'smithing', level: 1, xp: 20, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'pickaxe_bronze', qty: 1 } },
  { id: 'forge_cutlass_bronze', station: 'anvil', skill: 'smithing', level: 3, xp: 40, inputs: [{ id: 'bar_bronze', qty: 2 }], output: { id: 'cutlass_bronze', qty: 1 }, rarityRoll: true },
  { id: 'forge_helm_bronze', station: 'anvil', skill: 'smithing', level: 5, xp: 40, inputs: [{ id: 'bar_bronze', qty: 2 }], output: { id: 'helm_bronze', qty: 1 }, rarityRoll: true },
  { id: 'forge_hatchet_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 50, inputs: [{ id: 'bar_iron', qty: 1 }, { id: 'logs_oak', qty: 1 }], output: { id: 'hatchet_iron', qty: 1 } },
  { id: 'forge_pickaxe_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 50, inputs: [{ id: 'bar_iron', qty: 1 }, { id: 'logs_oak', qty: 1 }], output: { id: 'pickaxe_iron', qty: 1 } },
  { id: 'forge_cutlass_iron', station: 'anvil', skill: 'smithing', level: 18, xp: 80, inputs: [{ id: 'bar_iron', qty: 2 }], output: { id: 'cutlass_iron', qty: 1 }, rarityRoll: true },
  { id: 'cook_sprat', station: 'fire', skill: 'cooking', level: 1, xp: 20, inputs: [{ id: 'fish_sprat_raw', qty: 1 }], output: { id: 'fish_sprat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 12 } },
  { id: 'cook_crab', station: 'fire', skill: 'cooking', level: 4, xp: 30, inputs: [{ id: 'crab_meat_raw', qty: 1 }], output: { id: 'crab_meat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 18 } },
  { id: 'cook_bell', station: 'fire', skill: 'cooking', level: 10, xp: 55, inputs: [{ id: 'fish_bell_raw', qty: 1 }], output: { id: 'fish_bell', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 26 } },
];

export const SHOP = {
  name: 'Gell\'s Harbour Goods',
  stock: ['bread', 'fishing_rod', 'hatchet_chipped', 'pickaxe_chipped', 'cap_leather', 'coat_padded'],
  buyMul: 1.0, // player pays value * buyMul
  sellMul: 0.5, // player receives value * sellMul
};

// ---- enemies ------------------------------------------------------------------
export type EnemyModel = 'crab' | 'brigand' | 'gunner' | 'guardian';

export interface EnemyDef {
  id: string;
  name: string;
  model: EnemyModel;
  level: number;
  hp: number;
  damage: [number, number];
  armour: number;
  speed: number;
  radius: number;
  aggro: number;
  attack: { kind: 'melee'; range: number; windup: number; cooldown: number } | { kind: 'shot'; range: number; windup: number; cooldown: number; keepAway: number };
  xpPerDamage: number;
  loot: string;
  respawn: number;
  scale: number;
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  reef_crab: { id: 'reef_crab', name: 'Reef crab', model: 'crab', level: 2, hp: 22, damage: [2, 4], armour: 2, speed: 2.4, radius: 0.7, aggro: 6,
    attack: { kind: 'melee', range: 1.5, windup: 0.45, cooldown: 1.6 }, xpPerDamage: 4, loot: 'crab', respawn: 20, scale: 1.1 },
  brigand: { id: 'brigand', name: 'Brigand', model: 'brigand', level: 6, hp: 48, damage: [4, 8], armour: 4, speed: 3.3, radius: 0.45, aggro: 9,
    attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 1.4 }, xpPerDamage: 4, loot: 'brigand', respawn: 30, scale: 1.2 },
  gunner: { id: 'gunner', name: 'Brigand gunner', model: 'gunner', level: 7, hp: 34, damage: [7, 11], armour: 2, speed: 3.0, radius: 0.45, aggro: 12,
    attack: { kind: 'shot', range: 10, windup: 0.9, cooldown: 2.6, keepAway: 6 }, xpPerDamage: 4, loot: 'brigand', respawn: 30, scale: 1.2 },
  guardian: { id: 'guardian', name: 'The Lockbound Guardian', model: 'guardian', level: 14, hp: 650, damage: [10, 16], armour: 8, speed: 2.2, radius: 1.4, aggro: 30,
    attack: { kind: 'melee', range: 3.2, windup: 0.8, cooldown: 2.0 }, xpPerDamage: 4, loot: 'guardian', respawn: 0, scale: 1.0, boss: true },
};

export interface EliteAffix { id: string; name: string; desc: string; colour: string }
export const ELITE_AFFIXES: EliteAffix[] = [
  { id: 'barnacled', name: 'Barnacled', desc: 'Double health, takes 30% less damage', colour: '#cfc6b0' },
  { id: 'frenzied', name: 'Frenzied', desc: 'Moves and attacks 40% faster', colour: '#e05a3c' },
  { id: 'volatile', name: 'Volatile', desc: 'Explodes shortly after death', colour: '#f2a43a' },
];

export interface LootTable {
  coins?: [number, number];
  drops: { item: string; chance: number; qty?: [number, number] }[];
  gear?: { chance: number; items: string[]; weights: Partial<Record<'common' | 'fine' | 'rare' | 'relic', number>> };
}

export const LOOT: Record<string, LootTable> = {
  crab: { coins: [1, 5], drops: [{ item: 'crab_meat_raw', chance: 0.75 }, { item: 'shell_fragment', chance: 0.3 }], gear: { chance: 0.04, items: ['ring_brass'], weights: { common: 60, fine: 35, rare: 5 } } },
  brigand: { coins: [6, 18], drops: [{ item: 'bread', chance: 0.3 }, { item: 'ore_iron', chance: 0.15, qty: [1, 2] }],
    gear: { chance: 0.22, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass'], weights: { common: 45, fine: 40, rare: 15 } } },
  elite: { coins: [15, 35], drops: [], gear: { chance: 0.7, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass', 'cutlass_bronze'], weights: { fine: 60, rare: 40 } } },
  guardian: { coins: [90, 140], drops: [{ item: 'bar_iron', chance: 1, qty: [2, 4] }],
    gear: { chance: 1, items: ['lockplate', 'cutlass_iron', 'ring_brass'], weights: { rare: 70, relic: 30 } } },
};

export const PLAYER_BASE = {
  hp: 40, hpPerLevel: 4, speed: 4.6,
  abilityCooldown: 7, abilityRange: 13, abilityDamage: [12, 18] as [number, number], // flintlock
  whirlCooldown: 6, whirlRadius: 3.2, whirlMul: 1.4, // spin attack: weapon damage x mul to everything in radius
  rollCooldown: 3, rollTime: 0.32, rollSpeed: 13, // dodge: invulnerable while rolling
};
