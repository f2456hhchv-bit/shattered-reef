import { ITEMS, METALS, WOODS, FISH, type SkillId, type CombatStyle } from './items';

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

export interface NodeDef {
  id: string;
  name: string;
  skill: SkillId;
  level: number;
  xp: number;
  item: string;
  difficulty: number; // legacy tier hint (kept for saves/tests); success comes from `rate`
  tier: number; // 0 = starter; a tool of matching tier (power tier+1) gives the base rate
  rate: number; // success chance per 2.4 s swing at the level requirement with a matching tool
  depleteChance: number; // per successful gather
  respawn: number; // seconds
  verb: string;
  fromShip?: boolean; // only reachable by boat
  tool?: string; // fishing: the specific tool item this spot needs
}

// XP per action follows RuneScape's values (logs 25 ... redwood 380, copper 17.5 ... runite 125, shrimp 10 ... anglerfish 120).
// `rate` is tuned so XP/hour at the requirement is RuneScape-like (~9k/h at Saltpine up to ~60k/h at cedar):
// 99 in a gathering skill is a few hundred hours, not a weekend. Level and tool raise it (see Game.gatherChance).
const tree = (t: number, level: number, xp: number, rate: number, respawn: number): NodeDef => {
  const w = WOODS[t];
  return { id: `tree_${w.key}`, name: w.name, skill: 'woodcutting', level, xp, item: `logs_${w.key}`, difficulty: 0.45 + 0.3 * t, tier: t, rate, depleteChance: t === 0 ? 0.2 : 0.15 - t * 0.01, respawn, verb: 'Chop' };
};
const rock = (id: string, name: string, item: string, t: number, level: number, xp: number, rate: number, respawn: number): NodeDef =>
  ({ id, name, skill: 'mining', level, xp, item, difficulty: 0.45 + 0.3 * t, tier: t, rate, depleteChance: 1, respawn, verb: 'Mine' });
const spot = (t: number, level: number, xp: number, rate: number, tool: string, fromShip = false): NodeDef => {
  const f = FISH[t];
  return { id: `spot_${f.key}`, name: `${f.name[0].toUpperCase()}${f.name.slice(1)} ${tool === 'lobster_pot' ? 'pots' : 'shoal'}`, skill: 'fishing', level, xp, item: `fish_${f.key}_raw`, difficulty: 0.45 + 0.06 * t, tier: t, rate, depleteChance: 0, respawn: 0, verb: tool === 'lobster_pot' ? 'Set pot' : tool === 'harpoon' ? 'Harpoon' : 'Fish', tool, fromShip: fromShip || undefined };
};
export const NODES: Record<string, NodeDef> = Object.fromEntries([
  tree(0, 1, 25, 0.24, 14), tree(1, 15, 37.5, 0.25, 25), tree(2, 30, 67.5, 0.25, 30), tree(3, 45, 100, 0.22, 40), tree(4, 60, 175, 0.15, 60), tree(5, 75, 250, 0.133, 90), tree(6, 90, 380, 0.105, 120),
  rock('rock_copper', 'Copper rock', 'ore_copper', 0, 1, 17.5, 0.3, 6), rock('rock_tin', 'Tin rock', 'ore_tin', 0, 1, 17.5, 0.3, 6), rock('rock_iron', 'Iron rock', 'ore_iron', 1, 15, 35, 0.29, 10),
  rock('rock_coal', 'Coal seam', 'ore_coal', 2, 30, 50, 0.29, 25), rock('rock_gold', 'Gold vein', 'ore_gold', 3, 40, 65, 0.29, 40), rock('rock_storm', 'Stormsilver vein', 'ore_storm', 4, 55, 80, 0.29, 70),
  rock('rock_abyss', 'Abyssite vein', 'ore_abyss', 5, 70, 95, 0.29, 120), rock('rock_tide', 'Tidecore vein', 'ore_tide', 6, 85, 125, 0.27, 240),
  spot(0, 1, 10, 0.4, 'fishing_rod'), spot(1, 8, 35, 0.29, 'fishing_rod', true), spot(2, 20, 50, 0.27, 'fishing_rod'), spot(3, 30, 70, 0.25, 'fishing_rod'), spot(4, 40, 90, 0.22, 'lobster_pot'),
  spot(5, 50, 100, 0.23, 'harpoon', true), spot(6, 62, 120, 0.22, 'harpoon'), spot(7, 76, 110, 0.27, 'harpoon', true), spot(8, 85, 120, 0.28, 'harpoon', true),
].map((d) => [d.id, d]));

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

// Smithing follows RuneScape: bar XP 6.25 (bronze) ... 50 (rune); items 12.5 XP per bar for bronze up to 75 for rune.
// Tools and pistols need a log of the matching tier, so woodcutting feeds the forge.
const SMELT: { metal: string; level: number; xp: number; inputs: { id: string; qty: number }[] }[] = [
  { metal: 'bronze', level: 1, xp: 6.25, inputs: [{ id: 'ore_copper', qty: 1 }, { id: 'ore_tin', qty: 1 }] },
  { metal: 'iron', level: 15, xp: 12.5, inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'logs_pine', qty: 1 }] },
  { metal: 'steel', level: 30, xp: 17.5, inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'ore_coal', qty: 2 }] },
  { metal: 'storm', level: 50, xp: 30, inputs: [{ id: 'ore_storm', qty: 1 }, { id: 'ore_coal', qty: 4 }] },
  { metal: 'abyss', level: 70, xp: 37.5, inputs: [{ id: 'ore_abyss', qty: 1 }, { id: 'ore_coal', qty: 6 }] },
  { metal: 'tide', level: 85, xp: 50, inputs: [{ id: 'ore_tide', qty: 1 }, { id: 'ore_coal', qty: 8 }] },
];
const PER_BAR = [12.5, 25, 37.5, 50, 62.5, 75];
const TOOL_LOG = ['pine', 'oak', 'willow', 'amber', 'yew', 'star'];
const PISTOL_LOG = ['pine', 'oak', 'willow', 'amber', 'yew', 'cedar'];
const SHOT_LVL = [1, 15, 30, 50, 70, 85];
const PISTOL_LVL = [5, 20, 35, 55, 75, 90];

function buildRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const s of SMELT) out.push({ id: `smelt_${s.metal}`, station: 'furnace', skill: 'smithing', level: s.level, xp: s.xp, inputs: s.inputs, output: { id: `bar_${s.metal}`, qty: 1 } });
  out.push({ id: 'smelt_gold', station: 'furnace', skill: 'smithing', level: 40, xp: 22.5, inputs: [{ id: 'ore_gold', qty: 1 }], output: { id: 'bar_gold', qty: 1 } });
  // high staffs are smithed too (never drop-only): metal fittings, a rare haft, and charms to wake the focus
  out.push({ id: 'forge_staff_storm', station: 'anvil', skill: 'smithing', level: 52, xp: 140, inputs: [{ id: 'bar_storm', qty: 2 }, { id: 'logs_amber', qty: 1 }, { id: 'charm_tide', qty: 50 }], output: { id: 'staff_storm', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_staff_tide', station: 'anvil', skill: 'smithing', level: 88, xp: 260, inputs: [{ id: 'bar_tide', qty: 2 }, { id: 'logs_cedar', qty: 1 }, { id: 'charm_tide', qty: 100 }], output: { id: 'staff_tide', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_ring_gold', station: 'anvil', skill: 'smithing', level: 42, xp: 45, inputs: [{ id: 'bar_gold', qty: 1 }], output: { id: 'ring_gold', qty: 1 }, rarityRoll: true });
  METALS.forEach((mt, m) => {
    const L = SMELT[m].level, bar = `bar_${mt.key}`, xp = PER_BAR[m];
    const forge = (kind: string, lvl: number, bars: number, extra: { id: string; qty: number }[] = [], roll = true) =>
      out.push({ id: `forge_${kind}_${mt.key}`, station: 'anvil', skill: 'smithing', level: Math.min(99, lvl), xp: xp * bars, inputs: [{ id: bar, qty: bars }, ...extra], output: { id: `${kind}_${mt.key}`, qty: 1 }, rarityRoll: roll || undefined });
    forge('hatchet', L, 1, [{ id: `logs_${TOOL_LOG[m]}`, qty: 1 }], false);
    forge('pickaxe', L, 1, [{ id: `logs_${TOOL_LOG[m]}`, qty: 1 }], false);
    forge('cutlass', L + 3, 2);
    forge('helm', L + 5, 2);
    forge('plate', L + (m === 5 ? 14 : 12), 5);
    out.push({ id: `gun_shot_${mt.key}`, station: 'bench', skill: 'gunsmithing', level: SHOT_LVL[m], xp: xp, inputs: [{ id: bar, qty: 1 }], output: { id: `shot_${mt.key}`, qty: 15 } });
    out.push({ id: `gun_pistol_${mt.key}`, station: 'bench', skill: 'gunsmithing', level: PISTOL_LVL[m], xp: xp * 2.4, inputs: [{ id: bar, qty: 1 }, { id: `logs_${PISTOL_LOG[m]}`, qty: 1 }], output: { id: m === 0 ? 'pistol_flintlock' : `pistol_${mt.key}`, qty: 1 }, rarityRoll: true });
  });
  // cooking: RuneScape-like levels and XP; burning stops ~20 levels above the requirement
  const COOK: [number, number, number][] = [[1, 30, 20], [10, 60, 34], [15, 70, 40], [25, 90, 50], [40, 120, 64], [45, 140, 70], [55, 150, 80], [70, 210, 92], [84, 230, 99]];
  FISH.forEach((f, t) => out.push({ id: `cook_${f.key}`, station: 'fire', skill: 'cooking', level: COOK[t][0], xp: COOK[t][1], inputs: [{ id: `fish_${f.key}_raw`, qty: 1 }], output: { id: `fish_${f.key}`, qty: 1 }, burn: { item: 'burnt_food', stopLevel: COOK[t][2] } }));
  out.push({ id: 'cook_crab', station: 'fire', skill: 'cooking', level: 4, xp: 35, inputs: [{ id: 'crab_meat_raw', qty: 1 }], output: { id: 'crab_meat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 26 } });
  return out;
}
export const RECIPES: Recipe[] = buildRecipes();

/** What each level unlocks, generated from the data so it can never drift from the game. */
function buildUnlocks(): Record<SkillId, { level: number; text: string }[]> {
  const u: Record<string, { level: number; text: string }[]> = {};
  const put = (skill: string, level: number, text: string) => (u[skill] ??= []).push({ level, text });
  for (const n of Object.values(NODES)) put(n.skill, n.level, `${n.name}${n.fromShip ? ' (from your ship)' : ''}`);
  for (const r of RECIPES) put(r.skill, r.level, ITEMS[r.output.id].name);
  for (const it of Object.values(ITEMS)) {
    if (it.tool && it.tool.level > 1) put(it.tool.skill, it.tool.level, ITEMS[it.id].name);
    if (!it.equip) continue;
    for (const [k, v] of Object.entries(it.equip.reqs)) if ((v ?? 0) > 1) put(k, v!, ITEMS[it.id].name);
  }
  for (const sp of SPELLS) put('magic', sp.level, sp.name);
  for (const e of Object.values(ENEMIES)) if (!e.boss) put('attack', Math.max(1, Math.round(e.level * 0.8)), `Fight: ${e.name} (level ${e.level})`);
  put('hitpoints', 11, '+1 health every level');
  put('strength', 10, 'Max hit +1 roughly every 4 levels');
  for (const k of Object.keys(u)) {
    const seen = new Set<string>();
    u[k] = u[k].sort((a, b) => a.level - b.level).filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
  }
  return u as Record<SkillId, { level: number; text: string }[]>;
}

export const SHOP = {
  name: 'Gell\'s Harbour Goods',
  stock: [
    { id: 'bread', qty: 1 }, { id: 'fishing_rod', qty: 1 }, { id: 'hatchet_chipped', qty: 1 }, { id: 'pickaxe_chipped', qty: 1 },
    { id: 'pistol_flintlock', qty: 1 }, { id: 'shot_bronze', qty: 25 }, { id: 'staff_driftwood', qty: 1 }, { id: 'charm_tide', qty: 25 },
    { id: 'cap_leather', qty: 1 }, { id: 'coat_padded', qty: 1 }, { id: 'lobster_pot', qty: 1 }, { id: 'harpoon', qty: 1 }, { id: 'staff_coral', qty: 1 },
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
  { id: 'undertow', name: 'Undertow', level: 20, maxHit: 8, baseXp: 17.5, charms: 2 },
  { id: 'blast', name: 'Brine Blast', level: 35, maxHit: 12, baseXp: 25, charms: 3 },
  { id: 'riptide', name: 'Riptide', level: 50, maxHit: 16, baseXp: 32.5, charms: 4 },
  { id: 'maelstrom', name: 'Maelstrom', level: 65, maxHit: 20, baseXp: 40, charms: 5 },
  { id: 'wrath', name: 'Leviathan\'s Wrath', level: 80, maxHit: 24, baseXp: 47.5, charms: 6 },
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
/** Visual variant: crab shell / humanoid outfit / stone tint, chosen by the renderer. */
export type EnemyLook = 'reef' | 'mire' | 'ironshell' | 'brigand' | 'gunner' | 'smuggler' | 'poacher' | 'drowned' | 'captain' | 'sentinel';

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
  look?: EnemyLook;
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
  // ---- the rest of the island, by zone. Each foe is weak to one style (the combat triangle).
  mire_crab: { id: 'mire_crab', name: 'Mire crab', model: 'crab', look: 'mire', level: 14, hp: 18, att: 10, def: 12, defBonus: { melee: 15, ranged: 10, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 6, maxHit: 2,
    speed: 2.6, radius: 0.8, aggro: 7, attack: { kind: 'melee', range: 1.6, windup: 0.45, cooldown: 2.4 }, loot: 'mire', respawn: 25, scale: 1.3 },
  smuggler: { id: 'smuggler', name: 'Smuggler', model: 'brigand', look: 'smuggler', level: 24, hp: 30, att: 22, def: 18, defBonus: { melee: 20, ranged: -5, magic: 10 }, weakness: 'ranged', style: 'melee', accBonus: 18, maxHit: 4,
    speed: 3.4, radius: 0.45, aggro: 9, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'smuggler', respawn: 35, scale: 1.2 },
  smuggler_gunner: { id: 'smuggler_gunner', name: 'Smuggler gunner', model: 'gunner', look: 'smuggler', level: 28, hp: 26, att: 26, def: 14, defBonus: { melee: -5, ranged: 25, magic: 10 }, weakness: 'melee', style: 'ranged', accBonus: 22, maxHit: 5,
    speed: 3.0, radius: 0.45, aggro: 12, attack: { kind: 'shot', range: 10, windup: 0.85, cooldown: 3.4, keepAway: 6 }, loot: 'smuggler', respawn: 35, scale: 1.2 },
  ironshell_crab: { id: 'ironshell_crab', name: 'Ironshell crab', model: 'crab', look: 'ironshell', level: 33, hp: 40, att: 28, def: 38, defBonus: { melee: 40, ranged: 30, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 20, maxHit: 5,
    speed: 2.2, radius: 0.95, aggro: 7, attack: { kind: 'melee', range: 1.9, windup: 0.55, cooldown: 2.8 }, loot: 'ironshell', respawn: 30, scale: 1.7 },
  poacher: { id: 'poacher', name: 'Heartwood poacher', model: 'brigand', look: 'poacher', level: 38, hp: 45, att: 36, def: 30, defBonus: { melee: 30, ranged: 0, magic: 20 }, weakness: 'ranged', style: 'melee', accBonus: 30, maxHit: 6,
    speed: 3.5, radius: 0.45, aggro: 10, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'poacher', respawn: 40, scale: 1.2 },
  poacher_gunner: { id: 'poacher_gunner', name: 'Poacher marksman', model: 'gunner', look: 'poacher', level: 42, hp: 40, att: 42, def: 26, defBonus: { melee: 0, ranged: 35, magic: 20 }, weakness: 'melee', style: 'ranged', accBonus: 38, maxHit: 7,
    speed: 3.1, radius: 0.45, aggro: 13, attack: { kind: 'shot', range: 11, windup: 0.8, cooldown: 3.2, keepAway: 7 }, loot: 'poacher', respawn: 40, scale: 1.2 },
  drowned: { id: 'drowned', name: 'Drowned wrecker', model: 'brigand', look: 'drowned', level: 55, hp: 65, att: 52, def: 45, defBonus: { melee: 45, ranged: 40, magic: 0 }, weakness: 'magic', style: 'melee', accBonus: 45, maxHit: 9,
    speed: 3.0, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 1.8, windup: 0.5, cooldown: 2.6 }, loot: 'drowned', respawn: 45, scale: 1.25 },
  wreck_captain: { id: 'wreck_captain', name: 'Drowned captain', model: 'brigand', look: 'captain', level: 70, hp: 90, att: 66, def: 60, defBonus: { melee: 60, ranged: 25, magic: 45 }, weakness: 'ranged', style: 'melee', accBonus: 60, maxHit: 12,
    speed: 3.2, radius: 0.6, aggro: 11, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.6 }, loot: 'captain', respawn: 90, scale: 1.45 },
  stone_sentinel: { id: 'stone_sentinel', name: 'Stone sentinel', model: 'guardian', look: 'sentinel', level: 80, hp: 110, att: 75, def: 80, defBonus: { melee: 70, ranged: 60, magic: 10 }, weakness: 'magic', style: 'melee', accBonus: 70, maxHit: 14,
    speed: 1.9, radius: 1.2, aggro: 9, attack: { kind: 'melee', range: 2.8, windup: 0.8, cooldown: 3.0 }, loot: 'sentinel', respawn: 120, scale: 0.8 },
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
  mire: { coins: [4, 12], drops: [{ item: 'crab_meat_raw', chance: 0.6 }, { item: 'charm_tide', chance: 0.4, qty: [3, 8] }, { item: 'logs_willow', chance: 0.15, qty: [1, 3] }], gear: { chance: 0.05, items: ['ring_brass', 'helm_iron'], weights: { common: 55, fine: 38, rare: 7 } } },
  smuggler: { coins: [15, 40], drops: [{ item: 'fish_lobster', chance: 0.25 }, { item: 'shot_steel', chance: 0.3, qty: [5, 12] }, { item: 'bar_steel', chance: 0.12 }, { item: 'charm_tide', chance: 0.3, qty: [5, 12] }],
    gear: { chance: 0.12, items: ['cutlass_steel', 'helm_steel', 'pistol_steel', 'staff_coral', 'ring_gold'], weights: { common: 50, fine: 38, rare: 12 } } },
  ironshell: { coins: [10, 30], drops: [{ item: 'ore_coal', chance: 0.5, qty: [2, 5] }, { item: 'ore_gold', chance: 0.2 }, { item: 'shell_fragment', chance: 0.5, qty: [1, 3] }], gear: { chance: 0.06, items: ['helm_steel', 'plate_steel'], weights: { common: 50, fine: 40, rare: 10 } } },
  poacher: { coins: [25, 60], drops: [{ item: 'logs_amber', chance: 0.25, qty: [1, 3] }, { item: 'shot_storm', chance: 0.25, qty: [5, 12] }, { item: 'fish_salmon', chance: 0.3 }],
    gear: { chance: 0.12, items: ['cutlass_storm', 'helm_storm', 'pistol_storm', 'staff_storm', 'ring_gold'], weights: { common: 48, fine: 38, rare: 14 } } },
  drowned: { coins: [40, 90], drops: [{ item: 'charm_tide', chance: 0.6, qty: [10, 25] }, { item: 'fish_gloom', chance: 0.3 }, { item: 'bar_abyss', chance: 0.08 }],
    gear: { chance: 0.12, items: ['cutlass_abyss', 'helm_abyss', 'plate_abyss', 'pistol_abyss', 'staff_tide'], weights: { common: 45, fine: 38, rare: 15, relic: 2 } } },
  captain: { coins: [120, 260], drops: [{ item: 'bar_abyss', chance: 0.4, qty: [1, 2] }, { item: 'fish_shark', chance: 0.4, qty: [1, 2] }],
    gear: { chance: 0.4, items: ['cutlass_tide', 'pistol_tide', 'staff_tide', 'plate_abyss', 'ring_gold'], weights: { fine: 50, rare: 40, relic: 10 } } },
  sentinel: { coins: [150, 320], drops: [{ item: 'ore_tide', chance: 0.35 }, { item: 'ore_storm', chance: 0.5, qty: [1, 3] }, { item: 'charm_tide', chance: 1, qty: [20, 40] }],
    gear: { chance: 0.35, items: ['helm_tide', 'plate_tide', 'cutlass_tide', 'staff_tide'], weights: { fine: 50, rare: 40, relic: 10 } } },
  guardian: { coins: [80, 130], drops: [{ item: 'bar_iron', chance: 1, qty: [2, 4] }, { item: 'charm_tide', chance: 1, qty: [20, 40] }],
    gear: { chance: 1, items: ['lockplate', 'cutlass_iron', 'ring_brass', 'pistol_iron'], weights: { rare: 70, relic: 30 } } },
};

/** XP per point of damage, RuneScape rates. */
export const XP_PER_DAMAGE = { style: 4, hitpoints: 4 / 3, magic: 2 };

export const UNLOCKS = buildUnlocks();
