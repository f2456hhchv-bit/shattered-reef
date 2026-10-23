// Item definitions. Content only: game logic reads these, UI renders them.

export type SkillId =
  | 'attack' | 'strength' | 'defence' | 'hitpoints' | 'ranged' | 'magic'
  | 'woodcutting' | 'mining' | 'fishing'
  | 'smithing' | 'gunsmithing' | 'cooking';
export type CombatStyle = 'melee' | 'ranged' | 'magic';
export type Slot = 'weapon' | 'ammo' | 'head' | 'body' | 'ring';
export type IconShape = 'log' | 'ore' | 'bar' | 'fish' | 'meat' | 'coins' | 'bread' | 'hatchet' | 'pickaxe' | 'rod' | 'cutlass' | 'helm' | 'cap' | 'coat' | 'ring' | 'bell' | 'tooth' | 'shell' | 'burnt' | 'pistol' | 'shot' | 'staff' | 'charm';

/** RuneScape-style equipment bonuses. Accuracy applies to the weapon's own style. */
export interface Bonuses {
  acc?: number; // melee / ranged / magic accuracy (weapon's style)
  str?: number; // melee strength
  rangedStr?: number; // from ammunition
  magicDmg?: number; // % bonus to spell max hit
  defMelee?: number;
  defRanged?: number;
  defMagic?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  icon: { shape: IconShape; color: string; accent?: string };
  stackable: boolean; // equipment is never stackable, except ammunition
  value: number; // base coin value
  heal?: number;
  tool?: { skill: SkillId; power: number; level: number };
  equip?: {
    slot: Slot;
    reqs: Partial<Record<SkillId, number>>;
    style?: CombatStyle; // weapons only
    speed?: number; // seconds between attacks
    range?: number; // metres (melee weapons use the default reach)
    bonus: Bonuses;
    affixPool: string[];
  };
  quest?: boolean;
}

const I = (d: ItemDef) => d;
const MELEE_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'cleave', 'elite_dmg', 'accuracy'];
const RANGED_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'elite_dmg', 'accuracy', 'leech'];
const ARMOUR_AFFIX = ['max_hp', 'armour', 'regen'];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    I({ id: 'coins', name: 'Coins', desc: 'Bellwether silver, stamped with a bell.', icon: { shape: 'coins', color: '#e3c25e' }, stackable: true, value: 1 }),
    // ---- resources
    I({ id: 'logs_pine', name: 'Saltpine logs', desc: 'Resinous and light. Burns hot.', icon: { shape: 'log', color: '#8a6440', accent: '#d6b07a' }, stackable: true, value: 4 }),
    I({ id: 'logs_oak', name: 'Sea-oak logs', desc: 'Dense wind-twisted oak.', icon: { shape: 'log', color: '#6b4a30', accent: '#c49a64' }, stackable: true, value: 10 }),
    I({ id: 'ore_copper', name: 'Copper ore', desc: 'Green-flecked copper.', icon: { shape: 'ore', color: '#6c6a66', accent: '#d07a42' }, stackable: true, value: 5 }),
    I({ id: 'ore_tin', name: 'Tin ore', desc: 'Pale, soft tin.', icon: { shape: 'ore', color: '#6c6a66', accent: '#c9ccc8' }, stackable: true, value: 5 }),
    I({ id: 'ore_iron', name: 'Iron ore', desc: 'Rust-red and heavy.', icon: { shape: 'ore', color: '#5a5552', accent: '#a5543a' }, stackable: true, value: 14 }),
    I({ id: 'bar_bronze', name: 'Bronze bar', desc: 'Copper and tin, married in fire.', icon: { shape: 'bar', color: '#c08a4a' }, stackable: true, value: 18 }),
    I({ id: 'bar_iron', name: 'Iron bar', desc: 'Grey and honest.', icon: { shape: 'bar', color: '#8f9396' }, stackable: true, value: 40 }),
    I({ id: 'shell_fragment', name: 'Reef shell', desc: 'Barnacle-crusted shell. Traders like it.', icon: { shape: 'shell', color: '#d8c7a8', accent: '#c04a2c' }, stackable: true, value: 7 }),
    I({ id: 'charm_tide', name: 'Tide charm', desc: 'Sea-glass knotted with kelp. Spells burn them like candles.', icon: { shape: 'charm', color: '#59d0c4', accent: '#2a7f78' }, stackable: true, value: 3 }),
    // ---- food (heals are RuneScape-scale: you start with 10 health)
    I({ id: 'fish_sprat_raw', name: 'Raw reef sprat', desc: 'Small, silver, wriggling.', icon: { shape: 'fish', color: '#9fb7bf' }, stackable: true, value: 3 }),
    I({ id: 'fish_sprat', name: 'Grilled sprat', desc: 'Heals 3.', icon: { shape: 'fish', color: '#c9934f' }, stackable: true, value: 6, heal: 3 }),
    I({ id: 'fish_bell_raw', name: 'Raw bellfish', desc: 'Its swim bladder hums faintly.', icon: { shape: 'fish', color: '#6f9fbf', accent: '#e3c25e' }, stackable: true, value: 14 }),
    I({ id: 'fish_bell', name: 'Seared bellfish', desc: 'Heals 8.', icon: { shape: 'fish', color: '#b77a3e', accent: '#e3c25e' }, stackable: true, value: 26, heal: 8 }),
    I({ id: 'crab_meat_raw', name: 'Raw crab meat', desc: 'Needs cooking.', icon: { shape: 'meat', color: '#e7a58a' }, stackable: true, value: 4 }),
    I({ id: 'crab_meat', name: 'Cooked crab meat', desc: 'Heals 5.', icon: { shape: 'meat', color: '#d0703f' }, stackable: true, value: 10, heal: 5 }),
    I({ id: 'burnt_food', name: 'Burnt food', desc: 'A lesson in patience.', icon: { shape: 'burnt', color: '#2c2622' }, stackable: true, value: 0 }),
    I({ id: 'bread', name: 'Ship\'s bread', desc: 'Heals 4. Hard as a hull plank.', icon: { shape: 'bread', color: '#c99b5c' }, stackable: true, value: 6, heal: 4 }),
    // ---- tools
    I({ id: 'hatchet_chipped', name: 'Chipped hatchet', desc: 'It still cuts. Mostly.', icon: { shape: 'hatchet', color: '#7d7a74' }, stackable: false, value: 4, tool: { skill: 'woodcutting', power: 0, level: 1 } }),
    I({ id: 'hatchet_bronze', name: 'Bronze hatchet', desc: 'Chops faster than a chipped one.', icon: { shape: 'hatchet', color: '#c08a4a' }, stackable: false, value: 30, tool: { skill: 'woodcutting', power: 1, level: 1 } }),
    I({ id: 'hatchet_iron', name: 'Iron hatchet', desc: 'Bites deep into sea-oak.', icon: { shape: 'hatchet', color: '#9aa0a4' }, stackable: false, value: 80, tool: { skill: 'woodcutting', power: 2, level: 10 } }),
    I({ id: 'pickaxe_chipped', name: 'Chipped pickaxe', desc: 'Blunt, but stubborn.', icon: { shape: 'pickaxe', color: '#7d7a74' }, stackable: false, value: 4, tool: { skill: 'mining', power: 0, level: 1 } }),
    I({ id: 'pickaxe_bronze', name: 'Bronze pickaxe', desc: 'Mines faster than a chipped one.', icon: { shape: 'pickaxe', color: '#c08a4a' }, stackable: false, value: 30, tool: { skill: 'mining', power: 1, level: 1 } }),
    I({ id: 'pickaxe_iron', name: 'Iron pickaxe', desc: 'Makes short work of iron veins.', icon: { shape: 'pickaxe', color: '#9aa0a4' }, stackable: false, value: 80, tool: { skill: 'mining', power: 2, level: 10 } }),
    I({ id: 'fishing_rod', name: 'Fishing rod', desc: 'Driftwood rod and gut line.', icon: { shape: 'rod', color: '#8a6440' }, stackable: false, value: 8, tool: { skill: 'fishing', power: 0, level: 1 } }),
    // ---- melee weapons (Attack requirement, Strength for damage)
    I({ id: 'cutlass_rusty', name: 'Rusty cutlass', desc: 'Your father\'s. It has seen better tides.', icon: { shape: 'cutlass', color: '#8d7a66' }, stackable: false, value: 5,
      equip: { slot: 'weapon', reqs: {}, style: 'melee', speed: 2.4, bonus: { acc: 4, str: 3 }, affixPool: [] } }),
    I({ id: 'cutlass_bronze', name: 'Bronze cutlass', desc: 'A proper blade.', icon: { shape: 'cutlass', color: '#c08a4a' }, stackable: false, value: 40,
      equip: { slot: 'weapon', reqs: { attack: 1 }, style: 'melee', speed: 2.4, bonus: { acc: 9, str: 8 }, affixPool: MELEE_AFFIX } }),
    I({ id: 'cutlass_brigand', name: 'Brigand\'s hanger', desc: 'Short, curved, quick. Nicked from use.', icon: { shape: 'cutlass', color: '#b9b2a2', accent: '#7a2e22' }, stackable: false, value: 60,
      equip: { slot: 'weapon', reqs: { attack: 5 }, style: 'melee', speed: 1.8, bonus: { acc: 10, str: 9 }, affixPool: [...MELEE_AFFIX, 'leech'] } }),
    I({ id: 'cutlass_iron', name: 'Iron cutlass', desc: 'Heavier, meaner.', icon: { shape: 'cutlass', color: '#9aa0a4' }, stackable: false, value: 110,
      equip: { slot: 'weapon', reqs: { attack: 10 }, style: 'melee', speed: 2.4, bonus: { acc: 14, str: 13 }, affixPool: [...MELEE_AFFIX, 'leech'] } }),
    // ---- ranged (Ranged requirement; damage comes from the shot)
    I({ id: 'pistol_flintlock', name: 'Flintlock pistol', desc: 'Loud, smoky, honest. Fires shot from your ammo slot.', icon: { shape: 'pistol', color: '#8a6440', accent: '#9aa0a4' }, stackable: false, value: 45,
      equip: { slot: 'weapon', reqs: { ranged: 1 }, style: 'ranged', speed: 2.4, range: 9, bonus: { acc: 10 }, affixPool: RANGED_AFFIX } }),
    I({ id: 'pistol_iron', name: 'Iron-banded pistol', desc: 'A longer barrel and a truer aim.', icon: { shape: 'pistol', color: '#6b4a30', accent: '#c9ccc8' }, stackable: false, value: 140,
      equip: { slot: 'weapon', reqs: { ranged: 15 }, style: 'ranged', speed: 2.4, range: 10, bonus: { acc: 22 }, affixPool: RANGED_AFFIX } }),
    I({ id: 'shot_bronze', name: 'Bronze shot', desc: 'Pistol balls. Equip in the ammo slot.', icon: { shape: 'shot', color: '#c08a4a' }, stackable: true, value: 1,
      equip: { slot: 'ammo', reqs: { ranged: 1 }, bonus: { rangedStr: 7 }, affixPool: [] } }),
    I({ id: 'shot_iron', name: 'Iron shot', desc: 'Heavier balls. Equip in the ammo slot.', icon: { shape: 'shot', color: '#8f9396' }, stackable: true, value: 3,
      equip: { slot: 'ammo', reqs: { ranged: 10 }, bonus: { rangedStr: 13 }, affixPool: [] } }),
    // ---- magic (any staff casts your chosen spell; spells burn tide charms)
    I({ id: 'staff_driftwood', name: 'Driftwood staff', desc: 'Casts your chosen spell. Burns tide charms.', icon: { shape: 'staff', color: '#8a6440', accent: '#59d0c4' }, stackable: false, value: 30,
      equip: { slot: 'weapon', reqs: { magic: 1 }, style: 'magic', speed: 2.4, range: 9, bonus: { acc: 8, defMagic: 4 }, affixPool: ['dmg_pct', 'crit', 'elite_dmg', 'accuracy', 'leech'] } }),
    // ---- armour (Defence requirement)
    I({ id: 'helm_bronze', name: 'Bronze helm', desc: 'Good against blades, poor against spells.', icon: { shape: 'helm', color: '#c08a4a' }, stackable: false, value: 36,
      equip: { slot: 'head', reqs: { defence: 1 }, bonus: { defMelee: 5, defRanged: 4, defMagic: -1 }, affixPool: ARMOUR_AFFIX } }),
    I({ id: 'cap_leather', name: 'Leather cap', desc: 'Light. Good against shot.', icon: { shape: 'cap', color: '#7a5534' }, stackable: false, value: 15,
      equip: { slot: 'head', reqs: { defence: 1 }, bonus: { defMelee: 2, defRanged: 4, defMagic: 2 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] } }),
    I({ id: 'coat_padded', name: 'Padded coat', desc: 'Quilted and patched. Good against shot.', icon: { shape: 'coat', color: '#5a4636' }, stackable: false, value: 30,
      equip: { slot: 'body', reqs: { defence: 1 }, bonus: { defMelee: 4, defRanged: 8, defMagic: 3 }, affixPool: ARMOUR_AFFIX } }),
    I({ id: 'lockplate', name: 'Lockbound plate', desc: 'Brass armour from the Guardian\'s chest. The keyhole still hums.', icon: { shape: 'coat', color: '#b08a3e', accent: '#59d0c4' }, stackable: false, value: 300,
      equip: { slot: 'body', reqs: { defence: 10 }, bonus: { defMelee: 20, defRanged: 16, defMagic: -6 }, affixPool: [...ARMOUR_AFFIX, 'elite_dmg', 'dmg_pct'] } }),
    I({ id: 'ring_brass', name: 'Brass ring', desc: 'Engraved with waves.', icon: { shape: 'ring', color: '#d4b25a' }, stackable: false, value: 40,
      equip: { slot: 'ring', reqs: {}, bonus: {}, affixPool: ['gather_speed', 'xp_bonus', 'crit', 'max_hp', 'dmg_pct', 'accuracy'] } }),
    // ---- quest
    I({ id: 'tuning_bell', name: 'Tuning bell', desc: 'Cast by Iven Marr from your bronze. Ring it at the Broken Ring.', icon: { shape: 'bell', color: '#c08a4a' }, stackable: false, value: 0, quest: true }),
    I({ id: 'keels_tooth', name: 'Keel\'s Tooth', desc: 'A key shaped like a tooth, warm as a living thing.', icon: { shape: 'tooth', color: '#efe3c4', accent: '#59d0c4' }, stackable: false, value: 0, quest: true }),
  ].map((d) => [d.id, d]),
);

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item: ${id}`);
  return d;
}

// ---- rarity + affixes (Diablo-lite) -----------------------------------------
export type Rarity = 'common' | 'fine' | 'rare' | 'relic';
export const RARITY: Record<Rarity, { label: string; color: string; affixes: number; valueMul: number }> = {
  common: { label: 'Common', color: '#d8d2c0', affixes: 0, valueMul: 1 },
  fine: { label: 'Fine', color: '#7fc0ff', affixes: 1, valueMul: 2 },
  rare: { label: 'Rare', color: '#f2cf5b', affixes: 2, valueMul: 4 },
  relic: { label: 'Relic', color: '#ee8a4e', affixes: 3, valueMul: 8 },
};

export interface AffixDef { id: string; prefix: string; suffix: string; min: number; max: number; fmt: (v: number) => string }

export const AFFIXES: Record<string, AffixDef> = {
  dmg_pct: { id: 'dmg_pct', prefix: 'Keen', suffix: 'of Edges', min: 5, max: 12, fmt: (v) => `+${v}% max hit` },
  accuracy: { id: 'accuracy', prefix: 'True', suffix: 'of Aim', min: 4, max: 12, fmt: (v) => `+${v} accuracy` },
  atk_speed: { id: 'atk_speed', prefix: 'Quick', suffix: 'of Haste', min: 6, max: 15, fmt: (v) => `+${v}% attack speed` },
  crit: { id: 'crit', prefix: 'Lucky', suffix: 'of Fortune', min: 3, max: 8, fmt: (v) => `${v}% chance to hit your maximum` },
  cleave: { id: 'cleave', prefix: 'Broad', suffix: 'of Sweeping', min: 25, max: 50, fmt: (v) => `Swings also hit nearby foes for ${v}%` },
  elite_dmg: { id: 'elite_dmg', prefix: 'Hunter\'s', suffix: 'of the Hunt', min: 10, max: 25, fmt: (v) => `+${v}% damage to elites and bosses` },
  leech: { id: 'leech', prefix: 'Thirsty', suffix: 'of Leeching', min: 5, max: 12, fmt: (v) => `Heal ${v}% of damage dealt` },
  max_hp: { id: 'max_hp', prefix: 'Hale', suffix: 'of Vigour', min: 1, max: 4, fmt: (v) => `+${v} max health` },
  armour: { id: 'armour', prefix: 'Sturdy', suffix: 'of the Bulwark', min: 2, max: 7, fmt: (v) => `+${v} defence against everything` },
  regen: { id: 'regen', prefix: 'Mending', suffix: 'of Mending', min: 1, max: 2, fmt: (v) => `+${v} health every 10s` },
  gather_speed: { id: 'gather_speed', prefix: 'Diligent', suffix: 'of Labour', min: 4, max: 10, fmt: (v) => `+${v}% gathering success` },
  xp_bonus: { id: 'xp_bonus', prefix: 'Studious', suffix: 'of Learning', min: 2, max: 5, fmt: (v) => `+${v}% skill experience` },
};
