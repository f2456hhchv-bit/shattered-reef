import { ITEMS, METALS, WOODS, FISH, type SkillId, type CombatStyle } from './items';
import { PERKS, perkText } from './perks';
import { GEMS } from './drops';

// Skills, resource nodes, recipes, shop, spells, enemies, loot. All tunable here.

export type SkillGroup = 'Combat' | 'Gathering' | 'Production' | 'Sea';
/** Health and damage are shown and stored ×10 (Tom: 100 health at the start, 990 at Hitpoints 99, like RuneScape 3's
 * life points). The data below stays in RuneScape's small numbers; the game multiplies at the point of use. */
export const HP_SCALE = 10;

export const SKILLS: { id: SkillId; name: string; colour: string; group: SkillGroup; blurb: string }[] = [
  { id: 'attack', name: 'Attack', colour: '#c9584a', group: 'Combat', blurb: 'Melee accuracy. Train with the Accurate stance. Unlocks better weapons.' },
  { id: 'strength', name: 'Strength', colour: '#4f9a52', group: 'Combat', blurb: 'Melee max hit. Train with the Aggressive stance.' },
  { id: 'defence', name: 'Defence', colour: '#6b8fc9', group: 'Combat', blurb: 'Avoid hits and wear heavier armour. Train with the Defensive stance.' },
  { id: 'hitpoints', name: 'Hitpoints', colour: '#d8584a', group: 'Combat', blurb: 'Your health. Rises with all combat.' },
  { id: 'ranged', name: 'Ranged', colour: '#7aa83e', group: 'Combat', blurb: 'Pistols, bows and crossbows. Each needs its own ammo in your ammo slot: shot, arrows or bolts.' },
  { id: 'magic', name: 'Magic', colour: '#59d0c4', group: 'Combat', blurb: 'Tide spells, cast with a staff. Brine Spray is free; stronger spells burn tide charms.' },
  { id: 'woodcutting', name: 'Woodcutting', colour: '#6f9a4a', group: 'Gathering', blurb: 'Chop trees for logs.' },
  { id: 'mining', name: 'Mining', colour: '#a07a5a', group: 'Gathering', blurb: 'Mine ore from rocks.' },
  { id: 'fishing', name: 'Fishing', colour: '#4fa7c2', group: 'Gathering', blurb: 'Fish from the quay, or better fish from your ship.' },
  { id: 'smithing', name: 'Smithing', colour: '#c9a050', group: 'Production', blurb: 'Smelt bars and forge tools, blades and armour.' },
  { id: 'gunsmithing', name: 'Gunsmithing', colour: '#9a8a6a', group: 'Production', blurb: 'Make pistols and shot at the workbench. Two pistols make a pair.' },
  { id: 'fletching', name: 'Fletching', colour: '#8aa04a', group: 'Production', blurb: 'Carve bows from logs, fit crossbows, make arrows and bolts at the workbench.' },
  { id: 'cooking', name: 'Cooking', colour: '#d88a4a', group: 'Production', blurb: 'Cook food that heals you in a fight.' },
  { id: 'sailing', name: 'Sailing', colour: '#3a8ab0', group: 'Sea', blurb: 'Captain your sloop: fight at sea with broadsides, salvage wrecks, chart the waters. Higher levels toughen the hull and speed the reload.' },
  { id: 'crafting', name: 'Crafting', colour: '#b0785a', group: 'Production', blurb: 'Tan hides and stitch leather, snakeskin, silk and sunscale armour at the workbench; cast jewellery at the furnace; bind spellbooks.' },
];
export const COMBAT_SKILLS: SkillId[] = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic'];

export interface NodeDef {
  id: string;
  name: string;
  skill?: SkillId; // none for picking and digging: anyone can, nobody levels it (yet)
  level: number;
  xp: number;
  item: string;
  difficulty: number; // legacy tier hint (kept for saves/tests); success comes from `rate`
  tier: number; // 0 = starter; a tool of matching tier (power tier+1) gives the base rate
  rate: number; // success chance per 2.4 s swing at the level requirement with a matching tool
  /** how many items it gives before it runs out, rolled afresh each time it grows back (null: never runs out) */
  yield: [number, number] | null;
  respawn: number; // seconds
  verb: string;
  fromShip?: boolean; // only reachable by boat
  tool?: string; // the specific tool item this node needs (fishing gear, spade)
  drops?: { item: string; w: number }[]; // weighted alternatives to `item` (boulders: copper or tin)
  catches?: { item: string; level: number; xp: number }[]; // fishing spots holding several fish, each at its own level (lowest first)
  bonus?: { item: string; chance: number }; // rare extra per success (geodes)
  loot?: string; // a loot table rolled on success instead of `item` (treasure)
  reach?: number; // interaction range override (kelp grows just offshore)
  islet?: boolean; // on an offshore islet: walk to it from a beach you sail to
}

// XP per action follows RuneScape's values (logs 25 ... redwood 380, copper 17.5 ... runite 125, shrimp 10 ... anglerfish 120).
// `rate` is tuned so XP/hour at the requirement is RuneScape-like (~9k/h at Saltpine up to ~60k/h at cedar):
// 99 in a gathering skill is a few hundred hours, not a weekend. Level and tool raise it (see Game.gatherChance).
const tree = (t: number, level: number, xp: number, rate: number, respawn: number): NodeDef => {
  const w = WOODS[t];
  return { id: `tree_${w.key}`, name: w.name, skill: 'woodcutting', level, xp, item: `logs_${w.key}`, difficulty: 0.45 + 0.3 * t, tier: t, rate, yield: t === 0 ? [3, 6] : [4, 6 + Math.ceil(t / 2)], respawn, verb: 'Chop' }; // old trees give more logs
};
const rock = (id: string, name: string, item: string, t: number, level: number, xp: number, rate: number, respawn: number): NodeDef =>
  ({ id, name, skill: 'mining', level, xp, item, difficulty: 0.45 + 0.3 * t, tier: t, rate, yield: t >= 6 ? [2, 4] : [2, 5], respawn, verb: 'Mine' });
// Fishing level and XP per fish (FISH order). A spot holds one or more of them (RuneScape: trout and salmon share
// a spot); you catch what your level allows, the best of it more often as you level.
// RuneScape's own: shrimp 1/10, herring 10/30, trout 20/50, salmon 30/70, tuna 35/80, lobster 40/90, mackerel 16/20, bass 46/100,
// swordfish 50/100, monkfish 62/120, shark 76/110, anglerfish 82/120
const FISH_LV: [number, number][] = [[1, 10], [10, 30], [20, 50], [30, 70], [40, 90], [50, 100], [62, 120], [76, 110], [82, 120], [16, 20], [46, 100], [35, 80], [68, 115]];
const spot = (key: string, fish: number[], rate: number, tool: string, fromShip = false): NodeDef => {
  const order = [...fish].sort((a, b) => FISH_LV[a][0] - FISH_LV[b][0]);
  const catches = order.map((t) => ({ item: `fish_${FISH[t].key}_raw`, level: FISH_LV[t][0], xp: FISH_LV[t][1] }));
  const names = order.map((t) => FISH[t].name);
  const label = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
  return { id: `spot_${key}`, name: `${label[0].toUpperCase()}${label.slice(1)} ${tool === 'lobster_pot' ? 'pots' : 'shoal'}`, skill: 'fishing', level: catches[0].level, xp: catches[0].xp, item: catches[0].item,
    catches: catches.length > 1 ? catches : undefined, difficulty: 0.45 + 0.06 * order[0], tier: order[0], rate, yield: null, respawn: 0, verb: tool === 'lobster_pot' ? 'Set pot' : tool === 'harpoon' ? 'Harpoon' : 'Fish', tool, fromShip: fromShip || undefined };
};
export const NODES: Record<string, NodeDef> = Object.fromEntries(([
  tree(0, 1, 25, 0.33, 14), tree(1, 15, 37.5, 0.25, 25), tree(2, 30, 67.5, 0.25, 30), tree(3, 45, 100, 0.22, 40), tree(4, 60, 175, 0.15, 60), tree(5, 75, 250, 0.133, 90), tree(6, 90, 380, 0.105, 120),
  // mining follows the metal ladder: each metal's ore sits ~10 levels apart, tier = the metal it makes
  rock('rock_copper', 'Copper rock', 'ore_copper', 0, 1, 17.5, 0.42, 6), rock('rock_tin', 'Tin rock', 'ore_tin', 0, 1, 17.5, 0.42, 6), rock('rock_iron', 'Iron rock', 'ore_iron', 1, 15, 35, 0.29, 10),
  rock('rock_coal', 'Coal seam', 'ore_coal', 2, 30, 50, 0.29, 25), rock('rock_gold', 'Gold vein', 'ore_gold', 2, 40, 65, 0.29, 40), rock('rock_storm', 'Stormsilver vein', 'ore_storm', 3, 50, 80, 0.28, 70),
  rock('rock_abyss', 'Abyssite vein', 'ore_abyss', 4, 60, 95, 0.27, 100), rock('rock_tide', 'Tidecore vein', 'ore_tide', 5, 70, 125, 0.25, 150),
  rock('rock_cinder', 'Cinderite vent', 'ore_cinder', 6, 75, 145, 0.22, 180), rock('rock_sky', 'Fallen star', 'ore_sky', 7, 82, 170, 0.2, 220),
  { ...rock('rock_levi', 'Leviathan bones', 'ore_levi', 8, 88, 190, 0.19, 260), islet: true }, { ...rock('rock_ori', 'Drowned spire', 'ore_ori', 9, 94, 220, 0.17, 300), fromShip: true },
  spot('sprat', [0, 9], 0.56, 'fishing_rod'), spot('bell', [1, 10], 0.29, 'fishing_rod', true), spot('trout', [2, 3], 0.27, 'fishing_rod'), spot('salmon', [2, 3], 0.25, 'fishing_rod'), spot('lobster', [4], 0.22, 'lobster_pot'),
  spot('sword', [11, 5], 0.23, 'harpoon', true), spot('gloom', [6, 12], 0.22, 'harpoon'), spot('shark', [7], 0.27, 'harpoon', true), spot('angler', [7, 8], 0.28, 'harpoon', true),
  // the living island: every boulder can be mined, bushes and kelp picked, disturbed sand dug
  { id: 'rock_boulder', name: 'Boulder', skill: 'mining', level: 1, xp: 10, item: 'ore_copper', drops: [{ item: 'ore_copper', w: 1 }, { item: 'ore_tin', w: 1 }], bonus: { item: 'geode', chance: 0.04 },
    difficulty: 0.45, tier: 0, rate: 0.4, yield: [2, 5], respawn: 45, verb: 'Mine' },
  { id: 'bush_berry', name: 'Bramble bush', level: 1, xp: 0, item: 'berries', difficulty: 0, tier: 0, rate: 0.9, yield: [2, 4], respawn: 60, verb: 'Pick' },
  { id: 'palm', name: 'Coconut palm', level: 1, xp: 0, item: 'coconut', difficulty: 0, tier: 0, rate: 0.7, yield: [2, 3], respawn: 70, verb: 'Pick' },
  { id: 'kelp_bed', name: 'Kelp bed', level: 1, xp: 0, item: 'kelp', difficulty: 0, tier: 0, rate: 0.8, yield: [2, 4], respawn: 50, verb: 'Gather', reach: 3.4 },
  { id: 'salt_pan', name: 'Salt pan', level: 1, xp: 0, item: 'sea_salt', difficulty: 0, tier: 0, rate: 0.6, yield: [2, 4], respawn: 90, verb: 'Scrape' },
  // the Storm Tide's shoals by Bellwether's dock: only there while the storm is (stormtide.ts)
  { id: 'spot_storm', name: 'Storm shoal', skill: 'fishing', level: 1, xp: 15, item: 'storm_herring_raw', tool: 'fishing_rod', difficulty: 0.3, tier: 0, rate: 0.7, yield: null, respawn: 0, verb: 'Fish' },
  // the Greenheart Fire's bamboo by the fire camp: only there while the fire is (greenfire.ts)
  { id: 'bamboo_fire', name: 'Bamboo stand', skill: 'woodcutting', level: 1, xp: 12, item: 'bamboo', difficulty: 0.3, tier: 0, rate: 0.7, yield: null, respawn: 0, verb: 'Chop' },
  // the Amber Seep's seams inside Goldvein Hill: only there while the hill is open (amberseep.ts)
  { id: 'amber_seep', name: 'Amber seam', skill: 'mining', level: 1, xp: 14, item: 'raw_amber', difficulty: 0.3, tier: 0, rate: 0.65, yield: null, respawn: 0, verb: 'Mine' },
  // a wreck on the seabed, worked from the deck with a salvage hook (Sailing)
  { id: 'wreck_salvage', name: 'Sunken wreck', skill: 'sailing', level: 3, xp: 28, item: 'coins', loot: 'salvage', tool: 'salvage_hook', difficulty: 0.4, tier: 0, rate: 0.45, yield: [3, 5], respawn: 150, verb: 'Salvage', fromShip: true },
  { id: 'dig_spot', name: 'Disturbed sand', level: 1, xp: 0, item: 'coins', loot: 'treasure', tool: 'spade', difficulty: 0, tier: 0, rate: 0.45, yield: [1, 1], respawn: 420, verb: 'Dig' },
] as NodeDef[]).map((d) => [d.id, d]));

export type Station = 'furnace' | 'anvil' | 'fire' | 'bench' | 'vent';

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

// Smithing follows RuneScape's shape (bar XP 6.25 bronze ... 50 rune) stretched over ten metals. From Abyssite up
// each bar needs a flux from another skill: kelp ash (cooking), sea salt (salt pans), geode crystals (mining and
// digging), and Cinderite only melts in the volcanic vent forge on Ironcrag's summit.
// Tools and pistols need a log of the matching tier, so woodcutting feeds the forge.
const SMELT: { metal: string; level: number; xp: number; station: Station; inputs: { id: string; qty: number }[] }[] = [
  { metal: 'bronze', level: 1, xp: 6.25, station: 'furnace', inputs: [{ id: 'ore_copper', qty: 1 }, { id: 'ore_tin', qty: 1 }] },
  { metal: 'iron', level: 15, xp: 12.5, station: 'furnace', inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'logs_pine', qty: 1 }] },
  { metal: 'steel', level: 30, xp: 17.5, station: 'furnace', inputs: [{ id: 'ore_iron', qty: 1 }, { id: 'ore_coal', qty: 2 }] },
  { metal: 'storm', level: 50, xp: 30, station: 'furnace', inputs: [{ id: 'ore_storm', qty: 1 }, { id: 'ore_coal', qty: 3 }] },
  { metal: 'abyss', level: 60, xp: 37.5, station: 'furnace', inputs: [{ id: 'ore_abyss', qty: 1 }, { id: 'ore_coal', qty: 3 }, { id: 'kelp_ash', qty: 1 }] },
  { metal: 'tide', level: 70, xp: 50, station: 'furnace', inputs: [{ id: 'ore_tide', qty: 1 }, { id: 'ore_coal', qty: 4 }, { id: 'sea_salt', qty: 1 }] },
  { metal: 'cinder', level: 75, xp: 60, station: 'vent', inputs: [{ id: 'ore_cinder', qty: 1 }, { id: 'ore_coal', qty: 2 }] },
  { metal: 'sky', level: 82, xp: 70, station: 'furnace', inputs: [{ id: 'ore_sky', qty: 1 }, { id: 'ore_coal', qty: 4 }, { id: 'crystal_geode', qty: 1 }] },
  { metal: 'levi', level: 88, xp: 80, station: 'furnace', inputs: [{ id: 'ore_levi', qty: 1 }, { id: 'ore_coal', qty: 4 }, { id: 'sea_salt', qty: 2 }] },
  { metal: 'ori', level: 94, xp: 90, station: 'furnace', inputs: [{ id: 'ore_ori', qty: 1 }, { id: 'ore_coal', qty: 5 }, { id: 'crystal_geode', qty: 1 }] },
];
const PER_BAR = [12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100, 112.5, 125];
const TOOL_LOG = ['pine', 'oak', 'willow', 'amber', 'yew', 'star', 'star', 'cedar', 'cedar', 'cedar'];
const PISTOL_LOG = ['pine', 'oak', 'willow', 'amber', 'yew', 'star', 'star', 'cedar', 'cedar', 'cedar'];
const SHOT_LVL = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90]; // gunsmithing (ours, not RuneScape's)
// RuneScape's Fletching: arrows bronze 1, iron 15, steel 30, mithril 45, adamant 60, rune 75, dragon 90; crossbows 9 ... 78
const ARROW_LVL = [1, 15, 30, 45, 52, 60, 68, 75, 82, 90];
const XBOW_LVL = [9, 39, 46, 54, 58, 61, 65, 69, 74, 78];
const PISTOL_LVL = [5, 15, 25, 35, 45, 55, 65, 75, 85, 93];

function buildRecipes(): Recipe[] {
  const out: Recipe[] = [];
  for (const s of SMELT) out.push({ id: `smelt_${s.metal}`, station: s.station, skill: 'smithing', level: s.level, xp: s.xp, inputs: s.inputs, output: { id: `bar_${s.metal}`, qty: 1 } });
  // ship's stores (Sailing): chain shot, depth charges and the salvage hook, at the anvil
  out.push({ id: 'forge_chain_shot', station: 'anvil', skill: 'smithing', level: 5, xp: 12, inputs: [{ id: 'bar_bronze', qty: 1 }], output: { id: 'chain_shot', qty: 8 } });
  out.push({ id: 'forge_salvage_hook', station: 'anvil', skill: 'smithing', level: 3, xp: 20, inputs: [{ id: 'bar_bronze', qty: 2 }], output: { id: 'salvage_hook', qty: 1 } });
  // fire barrels: oak casks packed with Greenheart resin (Fletching, for Sunreach's waters)
  out.push({ id: 'fletch_fire_barrel', station: 'bench', skill: 'fletching', level: 20, xp: 30, inputs: [{ id: 'logs_oak', qty: 1 }, { id: 'resin', qty: 2 }], output: { id: 'fire_barrel', qty: 3 } });
  out.push({ id: 'forge_depth_charge', station: 'anvil', skill: 'smithing', level: 10, xp: 25, inputs: [{ id: 'bar_bronze', qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: 'depth_charge', qty: 2 } });
  out.push({ id: 'smelt_gold', station: 'furnace', skill: 'smithing', level: 40, xp: 22.5, inputs: [{ id: 'ore_gold', qty: 1 }], output: { id: 'bar_gold', qty: 1 } });
  // high staffs are smithed too (never drop-only): metal fittings, a rare haft, and charms to wake the focus
  out.push({ id: 'forge_staff_storm', station: 'anvil', skill: 'smithing', level: 52, xp: 140, inputs: [{ id: 'bar_storm', qty: 2 }, { id: 'logs_amber', qty: 1 }, { id: 'charm_tide', qty: 50 }], output: { id: 'staff_storm', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_staff_tide', station: 'anvil', skill: 'smithing', level: 88, xp: 260, inputs: [{ id: 'bar_tide', qty: 2 }, { id: 'logs_cedar', qty: 1 }, { id: 'charm_tide', qty: 100 }], output: { id: 'staff_tide', qty: 1 }, rarityRoll: true });
  // wands and orbs beside the staffs: a metal-capped wand, a crystal set in metal (books wait for Crafting)
  out.push({ id: 'forge_wand_storm', station: 'anvil', skill: 'smithing', level: 51, xp: 80, inputs: [{ id: 'bar_storm', qty: 1 }, { id: 'logs_amber', qty: 1 }, { id: 'charm_tide', qty: 30 }], output: { id: 'wand_storm', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_orb_storm', station: 'anvil', skill: 'smithing', level: 53, xp: 90, inputs: [{ id: 'bar_storm', qty: 1 }, { id: 'crystal_geode', qty: 1 }, { id: 'charm_tide', qty: 30 }], output: { id: 'orb_storm', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_wand_tide', station: 'anvil', skill: 'smithing', level: 86, xp: 150, inputs: [{ id: 'bar_tide', qty: 1 }, { id: 'logs_cedar', qty: 1 }, { id: 'charm_tide', qty: 60 }], output: { id: 'wand_tide', qty: 1 }, rarityRoll: true });
  out.push({ id: 'forge_orb_tide', station: 'anvil', skill: 'smithing', level: 89, xp: 170, inputs: [{ id: 'bar_tide', qty: 1 }, { id: 'crystal_geode', qty: 2 }, { id: 'charm_tide', qty: 60 }], output: { id: 'orb_tide', qty: 1 }, rarityRoll: true });
  METALS.forEach((mt, m) => {
    const L = SMELT[m].level, bar = `bar_${mt.key}`, xp = PER_BAR[m];
    const forge = (kind: string, lvl: number, bars: number, extra: { id: string; qty: number }[] = [], roll = true) =>
      out.push({ id: `forge_${kind}_${mt.key}`, station: 'anvil', skill: 'smithing', level: Math.min(99, lvl), xp: xp * bars, inputs: [{ id: bar, qty: bars }, ...extra], output: { id: `${kind}_${mt.key}`, qty: 1 }, rarityRoll: roll || undefined });
    // RuneScape's anvil: within each bar's tier a new item every few levels: dagger +0, axe +1, med helm +3,
    // scimitar +5, spear/longsword +6, two-hander +14, platebody +18 (rune platebody is the famous 99);
    // boots +2, gauntlets +4, kiteshield +12, platelegs +16 fill the gaps
    forge('dagger', L, 1);
    forge('hatchet', L + 1, 1, [{ id: `logs_${TOOL_LOG[m]}`, qty: 1 }], false);
    forge('pickaxe', L + 2, 2, [{ id: `logs_${TOOL_LOG[m]}`, qty: 1 }], false);
    forge('boots', L + 2, 1);
    forge('helm', L + 3, 1);
    forge('gloves', L + 4, 1);
    forge('cutlass', L + 5, 2);
    forge('pike', L + 6, 2, [{ id: `logs_${TOOL_LOG[m]}`, qty: 1 }]);
    forge('shield', L + 12, 2);
    forge('greatsword', L + 14, 3);
    forge('legs', L + 16, 3);
    forge('plate', L + 18, 5);
    // fletching: crossbows (a metal prod on a wooden stock), arrows (metal heads on saltpine shafts), bolts
    out.push({ id: `fletch_crossbow_${mt.key}`, station: 'bench', skill: 'fletching', level: XBOW_LVL[m], xp: xp * 2, inputs: [{ id: bar, qty: 1 }, { id: `logs_${TOOL_LOG[m]}`, qty: 1 }], output: { id: `crossbow_${mt.key}`, qty: 1 }, rarityRoll: true });
    out.push({ id: `fletch_arrow_${mt.key}`, station: 'bench', skill: 'fletching', level: ARROW_LVL[m], xp: xp * 0.8, inputs: [{ id: bar, qty: 1 }, { id: 'logs_pine', qty: 1 }], output: { id: `arrow_${mt.key}`, qty: 15 } });
    out.push({ id: `fletch_bolt_${mt.key}`, station: 'bench', skill: 'fletching', level: Math.min(99, ARROW_LVL[m] + 3), xp: xp * 0.9, inputs: [{ id: bar, qty: 1 }], output: { id: `bolt_${mt.key}`, qty: 12 } });
    out.push({ id: `gun_shot_${mt.key}`, station: 'bench', skill: 'gunsmithing', level: SHOT_LVL[m], xp: xp, inputs: [{ id: bar, qty: 1 }], output: { id: `shot_${mt.key}`, qty: 15 } });
    out.push({ id: `gun_pistol_${mt.key}`, station: 'bench', skill: 'gunsmithing', level: PISTOL_LVL[m], xp: xp * 2.4, inputs: [{ id: bar, qty: 1 }, { id: `logs_${PISTOL_LOG[m]}`, qty: 1 }], output: { id: m === 0 ? 'pistol_flintlock' : `pistol_${mt.key}`, qty: 1 }, rarityRoll: true });
  });
  // bows: a shortbow then a longbow from every wood (RuneScape-like spacing)
  const BOW_LVL: [number, number][] = [[5, 10], [20, 25], [35, 40], [50, 55], [65, 70], [80, 85], [90, 95]], BOW_XP = [10, 25, 42, 65, 90, 120, 160];
  WOODS.forEach((w, t) => {
    out.push({ id: `fletch_shortbow_${w.key}`, station: 'bench', skill: 'fletching', level: BOW_LVL[t][0], xp: BOW_XP[t], inputs: [{ id: `logs_${w.key}`, qty: 2 }], output: { id: `shortbow_${w.key}`, qty: 1 }, rarityRoll: true });
    out.push({ id: `fletch_longbow_${w.key}`, station: 'bench', skill: 'fletching', level: BOW_LVL[t][1], xp: BOW_XP[t] * 1.5, inputs: [{ id: `logs_${w.key}`, qty: 3 }], output: { id: `longbow_${w.key}`, qty: 1 }, rarityRoll: true });
  });
  // cooking: RuneScape's levels, XP and burn-stop levels (shrimp 1/30/34, herring 5, trout 15/70/49, salmon 25/90/58,
  // tuna 30/100/63, lobster 40/120/74, bass 43/130/80, swordfish 45/140/86, monkfish 62/150/92, shark 80/210/99, anglerfish 84/230/99)
  const COOK: [number, number, number][] = [[1, 30, 34], [5, 50, 38], [15, 70, 49], [25, 90, 58], [40, 120, 74], [45, 140, 86], [62, 150, 92], [80, 210, 99], [84, 230, 99], [10, 60, 45], [43, 130, 80], [30, 100, 63], [68, 165, 94]];
  FISH.forEach((f, t) => out.push({ id: `cook_${f.key}`, station: 'fire', skill: 'cooking', level: COOK[t][0], xp: COOK[t][1], inputs: [{ id: `fish_${f.key}_raw`, qty: 1 }], output: { id: `fish_${f.key}`, qty: 1 }, burn: { item: 'burnt_food', stopLevel: COOK[t][2] } }));
  out.push({ id: 'cook_parcel_sprat', station: 'fire', skill: 'cooking', level: 5, xp: 40, inputs: [{ id: 'fish_sprat_raw', qty: 1 }, { id: 'kelp', qty: 1 }], output: { id: 'parcel_sprat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 25 } });
  out.push({ id: 'cook_parcel_trout', station: 'fire', skill: 'cooking', level: 22, xp: 85, inputs: [{ id: 'fish_trout_raw', qty: 1 }, { id: 'kelp', qty: 1 }], output: { id: 'parcel_trout', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 46 } });
  // the inn's dishes, which you can learn to make yourself
  // more dishes from what you already gather, so Cooking has something new every few levels
  out.push({ id: 'cook_crabcake', station: 'fire', skill: 'cooking', level: 18, xp: 75, inputs: [{ id: 'crab_meat_raw', qty: 2 }, { id: 'bread', qty: 1 }], output: { id: 'crab_cakes', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 42 } });
  out.push({ id: 'cook_fishpie', station: 'fire', skill: 'cooking', level: 35, xp: 135, inputs: [{ id: 'fish_trout_raw', qty: 1 }, { id: 'fish_salmon_raw', qty: 1 }, { id: 'bread', qty: 1 }], output: { id: 'fish_pie', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 62 } });
  out.push({ id: 'cook_bisque', station: 'fire', skill: 'cooking', level: 62, xp: 210, inputs: [{ id: 'fish_lobster_raw', qty: 1 }, { id: 'kelp', qty: 1 }, { id: 'sea_salt', qty: 1 }], output: { id: 'lobster_bisque', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 86 } });
  out.push({ id: 'cook_kelpsword', station: 'fire', skill: 'cooking', level: 77, xp: 250, inputs: [{ id: 'fish_sword_raw', qty: 1 }, { id: 'kelp', qty: 2 }], output: { id: 'sword_kelp', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 96 } });
  out.push({ id: 'cook_feast', station: 'fire', skill: 'cooking', level: 92, xp: 320, inputs: [{ id: 'fish_shark_raw', qty: 1 }, { id: 'fish_angler_raw', qty: 1 }, { id: 'sea_salt', qty: 1 }], output: { id: 'captains_feast', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 99 } });
  out.push({ id: 'cook_pie_berry', station: 'fire', skill: 'cooking', level: 10, xp: 50, inputs: [{ id: 'berries', qty: 3 }, { id: 'bread', qty: 1 }], output: { id: 'pie_berry', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 34 } });
  out.push({ id: 'cook_stew', station: 'fire', skill: 'cooking', level: 30, xp: 120, inputs: [{ id: 'fish_salmon_raw', qty: 1 }, { id: 'kelp', qty: 1 }, { id: 'sea_salt', qty: 1 }], output: { id: 'fish_stew', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 58 } });
  // Wardwright keycutting: single-turn keys at the anvil (items.ts `turn`)
  out.push({ id: 'cut_mend', station: 'anvil', skill: 'smithing', level: 55, xp: 220, inputs: [{ id: 'bar_tide', qty: 1 }, { id: 'gem_jade', qty: 1 }], output: { id: 'key_mend', qty: 2 } });
  out.push({ id: 'cut_hush', station: 'anvil', skill: 'smithing', level: 62, xp: 260, inputs: [{ id: 'bar_cinder', qty: 1 }, { id: 'gem_pearl', qty: 1 }], output: { id: 'key_hush', qty: 2 } });
  out.push({ id: 'cut_gust', station: 'anvil', skill: 'smithing', level: 68, xp: 300, inputs: [{ id: 'bar_sky', qty: 1 }, { id: 'crystal_geode', qty: 1 }], output: { id: 'key_gust', qty: 2 } });
  out.push({ id: 'cut_home', station: 'anvil', skill: 'smithing', level: 75, xp: 340, inputs: [{ id: 'bar_levi', qty: 1 }, { id: 'gem_ruby', qty: 1 }], output: { id: 'key_home', qty: 3 } });
  // the galley: meals that do something for a while (items.ts MEAL_TEXT)
  out.push({ id: 'cook_grog', station: 'fire', skill: 'cooking', level: 15, xp: 55, inputs: [{ id: 'berries', qty: 3 }, { id: 'sea_salt', qty: 1 }], output: { id: 'grog', qty: 1 } });
  out.push({ id: 'cook_stargazy', station: 'fire', skill: 'cooking', level: 28, xp: 110, inputs: [{ id: 'fish_sprat_raw', qty: 3 }, { id: 'bread', qty: 1 }], output: { id: 'stargazy_pie', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 55 } });
  out.push({ id: 'cook_honey_salmon', station: 'fire', skill: 'cooking', level: 45, xp: 160, inputs: [{ id: 'fish_salmon_raw', qty: 1 }, { id: 'honeycomb', qty: 1 }], output: { id: 'honey_salmon', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 72 } });
  out.push({ id: 'cook_pepperpot', station: 'fire', skill: 'cooking', level: 52, xp: 185, inputs: [{ id: 'boar_meat_raw', qty: 1 }, { id: 'berries', qty: 2 }, { id: 'sea_salt', qty: 1 }], output: { id: 'pepperpot', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 78 } });
  out.push({ id: 'cook_fiskesuppe', station: 'fire', skill: 'cooking', level: 60, xp: 205, inputs: [{ id: 'fish_salmon_raw', qty: 1 }, { id: 'fish_lobster_raw', qty: 1 }, { id: 'kelp', qty: 1 }], output: { id: 'fiskesuppe', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 85 } });
  out.push({ id: 'cook_chowder', station: 'fire', skill: 'cooking', level: 75, xp: 260, inputs: [{ id: 'fish_lobster_raw', qty: 1 }, { id: 'crab_meat_raw', qty: 2 }, { id: 'sea_salt', qty: 1 }], output: { id: 'bosun_chowder', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 95 } });
  out.push({ id: 'burn_kelp', station: 'fire', skill: 'cooking', level: 12, xp: 12, inputs: [{ id: 'kelp', qty: 2 }], output: { id: 'kelp_ash', qty: 1 } });
  out.push({ id: 'cook_storm_herring', station: 'fire', skill: 'cooking', level: 1, xp: 12, inputs: [{ id: 'storm_herring_raw', qty: 1 }], output: { id: 'storm_herring', qty: 1 } }); // never burns: the storm won't wait
  out.push({ id: 'cook_crab', station: 'fire', skill: 'cooking', level: 4, xp: 35, inputs: [{ id: 'crab_meat_raw', qty: 1 }], output: { id: 'crab_meat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 26 } });
  out.push({ id: 'cook_boar', station: 'fire', skill: 'cooking', level: 24, xp: 92, inputs: [{ id: 'boar_meat_raw', qty: 1 }], output: { id: 'boar_meat', qty: 1 }, burn: { item: 'burnt_food', stopLevel: 52 } });
  // ---- Crafting (RuneScape's shape: leather from 1, gold jewellery 5-8 at the furnace, then our own materials)
  const craft = (id: string, station: Station, level: number, xp: number, inputs: [string, number][], output: string, qty = 1, roll = true) =>
    out.push({ id: `craft_${id}`, station, skill: 'crafting', level, xp, inputs: inputs.map(([i, q]) => ({ id: i, qty: q })), output: { id: output, qty }, rarityRoll: roll || undefined });
  craft('tan', 'bench', 1, 8, [['boar_hide', 1], ['sea_salt', 1]], 'leather', 1, false);
  craft('gloves_leather', 'bench', 1, 14, [['leather', 1]], 'gloves_leather');
  craft('ring_gold', 'furnace', 5, 15, [['bar_gold', 1]], 'ring_gold');
  craft('boots_leather', 'bench', 7, 16, [['leather', 1]], 'boots_leather');
  craft('bracelet_gold', 'furnace', 7, 25, [['bar_gold', 1]], 'bracelet_gold');
  craft('amulet_gold', 'furnace', 8, 30, [['bar_gold', 2]], 'amulet_gold');
  craft('cap_leather', 'bench', 9, 18, [['leather', 1]], 'cap_leather');
  craft('amulet_sharktooth', 'bench', 15, 45, [['shark_tooth', 3], ['leather', 1]], 'amulet_sharktooth');
  // chitin: shore-beetle shell, laced with leather; light armour that turns blades (Bellwether, Crafting 12-18)
  craft('helm_chitin', 'bench', 12, 30, [['chitin', 3], ['leather', 1]], 'helm_chitin');
  craft('legs_chitin', 'bench', 15, 40, [['chitin', 4], ['leather', 1]], 'legs_chitin');
  craft('body_chitin', 'bench', 18, 55, [['chitin', 6], ['leather', 2]], 'body_chitin');
  // Sunreach's insects: a mantis's forelimb, set in resin for a grip
  craft('dagger_mantis', 'bench', 20, 45, [['mantis_blade', 2], ['resin', 2]], 'dagger_mantis');
  craft('orb_glass', 'furnace', 10, 30, [['charm_tide', 20], ['sea_salt', 1]], 'orb_glass');
  craft('chaps_leather', 'bench', 11, 27, [['leather', 2]], 'chaps_leather');
  craft('coat_padded', 'bench', 14, 35, [['leather', 3]], 'coat_padded');
  craft('hood_silk', 'bench', 25, 50, [['spider_silk', 2]], 'hood_silk');
  craft('gloves_silk', 'bench', 30, 55, [['spider_silk', 2]], 'gloves_silk');
  craft('vambraces_snake', 'bench', 30, 60, [['snake_skin', 1], ['leather', 1]], 'vambraces_snake');
  craft('orb_coral', 'furnace', 30, 70, [['shell_fragment', 8], ['charm_tide', 30]], 'orb_coral');
  craft('boots_snake', 'bench', 33, 64, [['snake_skin', 1], ['leather', 1]], 'boots_snake');
  craft('book_coral', 'bench', 35, 80, [['leather', 2], ['spider_silk', 1], ['charm_tide', 20]], 'book_coral');
  craft('boots_silk', 'bench', 35, 60, [['spider_silk', 2]], 'boots_silk');
  craft('chaps_snake', 'bench', 37, 90, [['snake_skin', 2], ['leather', 1]], 'chaps_snake');
  craft('ring_crystal', 'furnace', 40, 85, [['bar_gold', 1], ['crystal_geode', 1]], 'ring_crystal');
  craft('cowl_snake', 'bench', 40, 80, [['snake_skin', 1], ['leather', 1]], 'cowl_snake');
  craft('skirt_silk', 'bench', 45, 110, [['spider_silk', 4]], 'skirt_silk');
  craft('bracelet_crystal', 'furnace', 45, 95, [['bar_gold', 1], ['crystal_geode', 1]], 'bracelet_crystal');
  craft('body_snake', 'bench', 45, 140, [['snake_skin', 3], ['leather', 2]], 'body_snake');
  craft('amulet_crystal', 'furnace', 50, 120, [['bar_gold', 2], ['crystal_geode', 2]], 'amulet_crystal');
  craft('book_storm', 'bench', 55, 150, [['leather', 2], ['spider_silk', 2], ['bar_storm', 1], ['charm_tide', 40]], 'book_storm');
  craft('robe_silk', 'bench', 55, 160, [['spider_silk', 6]], 'robe_silk');
  craft('shield_sunscale', 'bench', 70, 260, [['sunscale', 2], ['leather', 2]], 'shield_sunscale');
  craft('ring_sunscale', 'furnace', 75, 240, [['bar_gold', 1], ['sunscale', 1]], 'ring_sunscale');
  craft('legs_sunscale', 'bench', 78, 330, [['sunscale', 3], ['leather', 2]], 'legs_sunscale');
  craft('book_tide', 'bench', 80, 280, [['leather', 3], ['spider_silk', 3], ['bar_tide', 1], ['charm_tide', 80]], 'book_tide');
  craft('amulet_sunscale', 'furnace', 82, 360, [['bar_gold', 2], ['sunscale', 2]], 'amulet_sunscale');
  craft('body_sunscale', 'bench', 85, 480, [['sunscale', 5], ['leather', 3]], 'body_sunscale');
  craft('helm_sunscale', 'bench', 90, 300, [['sunscale', 2], ['leather', 1], ['crystal_geode', 1]], 'helm_sunscale');
  // gems: polish at the bench (RuneScape's cutting levels and XP), then set in gold at the furnace
  for (const g of GEMS) {
    craft(`polish_${g.key}`, 'bench', g.cut, g.xp, [[`gem_${g.key}_rough`, 1]], `gem_${g.key}`, 1, false);
    craft(`ring_${g.key}`, 'furnace', g.cut, g.xp * 0.8, [['bar_gold', 1], [`gem_${g.key}`, 1]], `ring_${g.key}`);
    craft(`bracelet_${g.key}`, 'furnace', Math.min(99, g.cut + 3), g.xp * 0.9, [['bar_gold', 1], [`gem_${g.key}`, 1]], `bracelet_${g.key}`);
    craft(`amulet_${g.key}`, 'furnace', Math.min(99, g.cut + 8), g.xp * 1.1, [['bar_gold', 2], [`gem_${g.key}`, 1]], `amulet_${g.key}`);
  }
  return out;
}
export const RECIPES: Recipe[] = buildRecipes();

/** One line of a skill guide: what unlocks at a level, the item that shows it, and the guide tab it lives on. */
export interface Unlock { level: number; text: string; cat: string; icon?: string; perk?: boolean }

/** What each level unlocks, generated from the data so it can never drift from the game. Grouped into the tabs of
 * a RuneScape skill guide (Trees / Hatchets, Rocks / Pickaxes, Bars / Weapons / Armour ...). */
function buildUnlocks(): Record<SkillId, Unlock[]> {
  const u: Record<string, Unlock[]> = {};
  const put = (skill: string, level: number, text: string, cat: string, icon?: string, perk?: boolean) => (u[skill] ??= []).push({ level, text, cat, icon, perk });
  const NODE_CAT: Partial<Record<SkillId, string>> = { woodcutting: 'Trees', mining: 'Rocks', fishing: 'Fish' };
  const TOOL_CAT: Partial<Record<SkillId, string>> = { woodcutting: 'Hatchets', mining: 'Pickaxes', fishing: 'Gear' };
  // what a made item is, for the guide tab it goes under
  const madeCat = (id: string) => {
    const it = ITEMS[id];
    if (id.startsWith('bar_')) return 'Bars';
    if (it.tool) return 'Tools';
    if (it.heal) return id.startsWith('fish_') ? 'Fish' : 'Dishes';
    if (it.equip?.slot === 'ammo') return 'Ammo';
    if (it.equip?.off === 'orb' || it.equip?.off === 'book') return 'Magic';
    if (it.equip?.slot === 'weapon') return it.equip.style === 'magic' ? 'Magic' : it.equip.kind === 'crossbow' ? 'Crossbows' : it.equip.kind === 'shortbow' || it.equip.kind === 'longbow' ? 'Bows' : it.equip.style === 'ranged' ? 'Guns' : 'Weapons';
    if (it.equip?.slot === 'ring' || it.equip?.slot === 'neck' || it.equip?.slot === 'wrist') return 'Jewellery';
    if (it.equip) return 'Armour';
    return 'Other';
  };
  for (const n of Object.values(NODES)) if (n.skill) put(n.skill, n.level, `${n.name}${n.skill === 'woodcutting' && n.id.startsWith('tree_') ? ' trees' : ''}${n.fromShip ? ' (from your ship)' : ''}`, NODE_CAT[n.skill] ?? 'Other', n.catches?.[0].item ?? n.item);
  for (const n of Object.values(NODES)) for (const c of n.catches ?? []) if (c.level > n.level) put('fishing', c.level, `${ITEMS[c.item].name.replace(/^Raw /, '')} at the ${n.name.toLowerCase()}`, 'Fish', c.item);
  for (const r of RECIPES) put(r.skill, r.level, ITEMS[r.output.id].name, madeCat(r.output.id), r.output.id);
  for (const it of Object.values(ITEMS)) {
    if (it.tool && it.tool.level > 1) put(it.tool.skill, it.tool.level, ITEMS[it.id].name, TOOL_CAT[it.tool.skill] ?? 'Tools', it.id);
    if (!it.equip) continue;
    for (const [k, v] of Object.entries(it.equip.reqs)) if ((v ?? 0) > 1) put(k, v!, ITEMS[it.id].name, madeCat(it.id), it.id);
  }
  for (const sp of SPELLS) put('magic', sp.level, `${sp.name} (max hit ${sp.maxHit * HP_SCALE})`, 'Spells', 'charm_tide');
  for (const x of Object.values(UTILITY_SPELLS)) put('magic', x.level, `${x.name} (${x === UTILITY_SPELLS.alchemy ? 'turn an item into coins' : 'teleport to Bellwether'})`, 'Spells', x === UTILITY_SPELLS.alchemy ? 'coins' : 'charm_tide');
  for (const e of Object.values(ENEMIES)) if (!e.boss) put('attack', Math.max(1, Math.round(e.level * 0.8)), `Fight: ${e.name} (level ${e.level})`, 'Foes');
  put('hitpoints', 11, '+10 health every level', 'Other');
  put('strength', 10, 'Max hit +10 roughly every 4 levels', 'Other');
  for (const [skill, list] of Object.entries(PERKS)) for (const p of list) put(skill, p.level, `${p.name}: ${perkText(p)}`, 'Perks', undefined, true);
  for (const k of Object.keys(u)) {
    const seen = new Set<string>();
    u[k] = u[k].sort((a, b) => a.level - b.level).filter((x) => (seen.has(x.cat + x.text) ? false : (seen.add(x.cat + x.text), true)));
  }
  return u as Record<SkillId, Unlock[]>;
}

export interface Shop {
  id: string;
  name: string;
  keeper: string; // npc id
  stock: { id: string; qty: number }[];
  buyMul: number; // player pays value * qty * buyMul
  sellMul: number; // player receives value * sellMul
  /** Items this trader pays extra for (multiplier on sellMul), by id prefix. */
  wants?: { prefix: string; mul: number; note: string }[];
}

export const SHOPS: Record<string, Shop> = {
  general: {
    id: 'general', name: 'Gell\'s Harbour Goods', keeper: 'marta',
    stock: [
      { id: 'bread', qty: 1 }, { id: 'hatchet_chipped', qty: 1 }, { id: 'pickaxe_chipped', qty: 1 },
      { id: 'pistol_flintlock', qty: 1 }, { id: 'shot_bronze', qty: 25 }, { id: 'shortbow_pine', qty: 1 }, { id: 'arrow_bronze', qty: 25 }, { id: 'dagger_bronze', qty: 1 }, { id: 'staff_driftwood', qty: 1 }, { id: 'charm_tide', qty: 25 },
      { id: 'cap_leather', qty: 1 }, { id: 'coat_padded', qty: 1 }, { id: 'chaps_leather', qty: 1 }, { id: 'boots_leather', qty: 1 }, { id: 'gloves_leather', qty: 1 }, { id: 'leather', qty: 5 },
      { id: 'spade', qty: 1 }, { id: 'staff_coral', qty: 1 }, { id: 'wand_driftwood', qty: 1 }, { id: 'orb_glass', qty: 1 }, { id: 'book_almanac', qty: 1 },
      { id: 'shield_bronze', qty: 1 }, { id: 'amulet_brass', qty: 1 }, { id: 'bracelet_brass', qty: 1 },
    ],
    buyMul: 1.0, sellMul: 0.5,
  },
  tackle: {
    id: 'tackle', name: 'Reed\'s Tackle & Fish', keeper: 'silas',
    stock: [{ id: 'fishing_rod', qty: 1 }, { id: 'lobster_pot', qty: 1 }, { id: 'harpoon', qty: 1 }, { id: 'kelp', qty: 5 }, { id: 'sea_salt', qty: 5 }, { id: 'fish_sprat_raw', qty: 5 }],
    buyMul: 1.1, sellMul: 0.5,
    wants: [{ prefix: 'fish_', mul: 1.5, note: 'Silas pays half as much again for fish.' }],
  },
  inn: {
    id: 'inn', name: 'The Drowned Bell', keeper: 'hob',
    stock: [{ id: 'ale', qty: 1 }, { id: 'bread', qty: 1 }, { id: 'fish_stew', qty: 1 }, { id: 'pie_berry', qty: 1 }],
    buyMul: 1.2, sellMul: 0.4,
    wants: [{ prefix: 'berries', mul: 2, note: 'Hob pays double for berries.' }, { prefix: 'crab_meat', mul: 1.6, note: 'and well for crab.' }],
  },
};
// Sunreach's traders: mid-tier gear for a captain who's outgrown Bellwether, and the Gilded Anchor's kitchen
SHOPS.sunreach = {
  id: 'sunreach', name: 'Sunreach Trading Post', keeper: 'tamsin',
  stock: [
    { id: 'shortbow_oak', qty: 1 }, { id: 'longbow_willow', qty: 1 }, { id: 'crossbow_iron', qty: 1 }, { id: 'arrow_iron', qty: 25 }, { id: 'bolt_iron', qty: 20 }, { id: 'shot_steel', qty: 25 },
    { id: 'cutlass_steel', qty: 1 }, { id: 'pike_iron', qty: 1 }, { id: 'helm_steel', qty: 1 }, { id: 'shield_steel', qty: 1 }, { id: 'legs_iron', qty: 1 },
    { id: 'wand_coral', qty: 1 }, { id: 'orb_coral', qty: 1 }, { id: 'book_coral', qty: 1 }, { id: 'harpoon', qty: 1 }, { id: 'lobster_pot', qty: 1 }, { id: 'charm_tide', qty: 50 }, { id: 'sea_salt', qty: 5 }, { id: 'fire_barrel', qty: 20 },
  ],
  buyMul: 1.15, sellMul: 0.55,
  wants: [{ prefix: 'ore_', mul: 1.3, note: 'Tamsin pays well for ore,' }, { prefix: 'logs_', mul: 1.3, note: 'timber' }, { prefix: 'spider_silk', mul: 1.5, note: 'and spider silk.' }],
};
// Amberhold's toll-market at the landing: stormsilver gear, gunnery and the island's honey, for a 25-50 captain
SHOPS.tollmarket = {
  id: 'tollmarket', name: 'Tollhouse Market', keeper: 'brita',
  stock: [
    { id: 'cutlass_storm', qty: 1 }, { id: 'greatsword_storm', qty: 1 }, { id: 'helm_storm', qty: 1 }, { id: 'plate_storm', qty: 1 }, { id: 'legs_storm', qty: 1 }, { id: 'shield_storm', qty: 1 },
    { id: 'longbow_amber', qty: 1 }, { id: 'arrow_storm', qty: 25 }, { id: 'shot_storm', qty: 25 }, { id: 'staff_storm', qty: 1 }, { id: 'charm_tide', qty: 80 },
    { id: 'fire_barrel', qty: 20 }, { id: 'depth_charge', qty: 10 }, { id: 'chain_shot', qty: 20 }, { id: 'honeycomb', qty: 1 }, { id: 'fish_salmon', qty: 1 },
  ],
  buyMul: 1.2, sellMul: 0.5,
  wants: [{ prefix: 'logs_amber', mul: 1.5, note: 'Brita pays well for amber logs,' }, { prefix: 'ore_gold', mul: 1.4, note: 'gold ore' }, { prefix: 'honeycomb', mul: 1.5, note: 'and honeycomb.' }],
};
// Stormwrack's outpost store at Gallows Landing: the high metals' gear, deep-sea food and gunnery, for 50+
SHOPS.gallows = {
  id: 'gallows', name: 'Gallows Landing Store', keeper: 'osric',
  stock: [
    { id: 'cutlass_tide', qty: 1 }, { id: 'helm_tide', qty: 1 }, { id: 'plate_tide', qty: 1 }, { id: 'legs_tide', qty: 1 }, { id: 'shield_tide', qty: 1 }, { id: 'staff_tide', qty: 1 },
    { id: 'arrow_tide', qty: 25 }, { id: 'shot_tide', qty: 25 }, { id: 'bolt_tide', qty: 20 }, { id: 'charm_tide', qty: 120 },
    { id: 'fish_shark', qty: 1 }, { id: 'fish_sword', qty: 1 }, { id: 'depth_charge', qty: 20 }, { id: 'fire_barrel', qty: 30 }, { id: 'sea_salt', qty: 10 },
  ],
  buyMul: 1.3, sellMul: 0.5,
  wants: [{ prefix: 'ore_', mul: 1.3, note: 'Osric pays well for the high ores,' }, { prefix: 'bar_', mul: 1.2, note: 'bars' }, { prefix: 'fish_gloom', mul: 1.5, note: 'and gloomfish.' }],
};
SHOPS.anchor = {
  id: 'anchor', name: 'The Gilded Anchor', keeper: 'rell',
  stock: [{ id: 'coconut', qty: 1 }, { id: 'ale', qty: 1 }, { id: 'crab_cakes', qty: 1 }, { id: 'boar_meat', qty: 1 }, { id: 'fish_stew', qty: 1 }, { id: 'fish_pie', qty: 1 }],
  buyMul: 1.25, sellMul: 0.45,
  wants: [{ prefix: 'fish_', mul: 1.4, note: 'Rell pays well for fish' }, { prefix: 'boar_meat', mul: 1.5, note: 'and boar.' }],
};

/** Marta's store: the shop the tutorial and older code mean by "the shop". */
export const SHOP = SHOPS.general;

// ---- magic -------------------------------------------------------------------
export interface Spell { id: string; name: string; level: number; maxHit: number; baseXp: number; charms: number; /** taught by a quest: this flag must be set */ quest?: string }
// RuneScape's spell book by max hit: strikes 1-13, bolts to 35, blasts to 59, waves to 75, surges to 95.
export const SPELLS: Spell[] = [
  { id: 'spray', name: 'Brine Spray', level: 1, maxHit: 2, baseXp: 5.5, charms: 0 }, // free: magic is always usable
  { id: 'bolt', name: 'Tide Bolt', level: 5, maxHit: 5, baseXp: 11.5, charms: 2 },
  { id: 'lash', name: 'Wave Lash', level: 9, maxHit: 6, baseXp: 14, charms: 2 },
  { id: 'undertow', name: 'Undertow', level: 13, maxHit: 8, baseXp: 17.5, charms: 2 },
  { id: 'souc_fire', name: 'Soucouyant\'s Fire', level: 20, maxHit: 9, baseXp: 19, charms: 2, quest: 'souc_done' }, // Salt for the Soucouyant
  { id: 'surge', name: 'Surge Bolt', level: 23, maxHit: 10, baseXp: 21, charms: 3 },
  { id: 'blast', name: 'Brine Blast', level: 35, maxHit: 12, baseXp: 25, charms: 3 },
  { id: 'tidecall', name: 'Tidecall', level: 47, maxHit: 14, baseXp: 28.5, charms: 3 },
  { id: 'riptide', name: 'Riptide', level: 59, maxHit: 16, baseXp: 32.5, charms: 4 },
  { id: 'lance', name: 'Abyssal Lance', level: 65, maxHit: 18, baseXp: 36, charms: 4 },
  { id: 'maelstrom', name: 'Maelstrom', level: 75, maxHit: 20, baseXp: 40, charms: 5 },
  { id: 'tempest', name: 'Tempest', level: 81, maxHit: 22, baseXp: 44, charms: 5 },
  { id: 'wrath', name: 'Leviathan\'s Wrath', level: 90, maxHit: 24, baseXp: 47.5, charms: 6 },
  { id: 'deluge', name: 'Deluge', level: 95, maxHit: 27, baseXp: 55, charms: 7 },
];
/** Utility spells (RuneScape's High Alchemy and Home Teleport, in the island's terms). */
export const UTILITY_SPELLS = {
  alchemy: { name: 'Brine Alchemy', level: 21, charms: 2, xp: 31, rate: 0.6, cooldown: 1.8 },
  home: { name: 'Tide-walk Home', level: 25, charms: 3, xp: 35, cooldown: 30 },
};

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
export type EnemyModel = 'crab' | 'brigand' | 'gunner' | 'guardian' | 'boar' | 'spider' | 'snake' | 'golem' | 'hound' | 'bat' | 'beetle' | 'door';
/** Visual variant: crab shell / humanoid outfit / stone tint, chosen by the renderer. */
export type EnemyLook = 'reef' | 'mire' | 'ironshell' | 'brigand' | 'gunner' | 'smuggler' | 'poacher' | 'drowned' | 'captain' | 'sentinel' | 'cave' | 'giant' | 'jungle' | 'ember' | 'sunscale' | 'hunter' | 'moon' | 'amber' | 'oak' | 'queen' | 'shore' | 'gull' | 'thorn' | 'knocker' | 'leech' | 'howe' | 'troll' | 'seadraugr' | 'wrecker' | 'ant' | 'mantis' | 'douen' | 'centipede' | 'souc' | 'warg' | 'nokk' | 'hornet' | 'bark' | 'mosstroll' | 'draugr' | 'draugrtroll' | 'jotunn' | 'starstruck' | 'hushed' | 'greenteeth' | 'ninefold' | 'corva' | 'lockjaw' | 'elder';

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
  attack: { kind: 'melee'; range: number; windup: number; cooldown: number } | { kind: 'shot'; range: number; windup: number; cooldown: number }; // regular foes walk up and fight: no kiting (Tom, 2026-10-25)
  loot: string;
  respawn: number;
  scale: number;
  look?: EnemyLook;
  boss?: boolean;
  /** attacks on sight (camps, lairs, late-game zones); everything else only fights back when you attack it */
  hostile?: boolean;
}

// OSRS-scale numbers: you start with 10 health; a reef crab hits at most 1.
export const ENEMIES: Record<string, EnemyDef> = {
  reef_crab: { id: 'reef_crab', name: 'Reef crab', model: 'crab', level: 2, hp: 4, att: 1, def: 1, defBonus: { melee: 10, ranged: 5, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 0, maxHit: 1,
    speed: 2.4, radius: 0.7, aggro: 6, attack: { kind: 'melee', range: 1.5, windup: 0.45, cooldown: 2.4 }, loot: 'crab', respawn: 20, scale: 1.1 },
  brigand: { hostile: true, id: 'brigand', name: 'Brigand', model: 'brigand', level: 9, hp: 16, att: 8, def: 6, defBonus: { melee: 10, ranged: -10, magic: 5 }, weakness: 'ranged', style: 'melee', accBonus: 8, maxHit: 3,
    speed: 3.3, radius: 0.45, aggro: 9, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'brigand', respawn: 30, scale: 1.2 },
  gunner: { hostile: true, id: 'gunner', name: 'Brigand gunner', model: 'gunner', level: 11, hp: 13, att: 12, def: 4, defBonus: { melee: -10, ranged: 15, magic: 5 }, weakness: 'melee', style: 'ranged', accBonus: 12, maxHit: 4,
    speed: 3.0, radius: 0.45, aggro: 12, attack: { kind: 'shot', range: 10, windup: 0.9, cooldown: 3.6 }, loot: 'brigand', respawn: 30, scale: 1.2 },
  guardian: { id: 'guardian', name: 'The Lockbound Guardian', model: 'guardian', level: 22, hp: 40, att: 20, def: 8, defBonus: { melee: 15, ranged: 5, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 15, maxHit: 5,
    speed: 2.2, radius: 1.4, aggro: 30, attack: { kind: 'melee', range: 3.2, windup: 0.8, cooldown: 2.4 }, loot: 'guardian', respawn: 0, scale: 1.0, boss: true },
  // ---- the rest of the island, by zone. Each foe is weak to one style (the combat triangle).
  mire_crab: { id: 'mire_crab', name: 'Mire crab', model: 'crab', look: 'mire', level: 14, hp: 18, att: 10, def: 12, defBonus: { melee: 15, ranged: 10, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 6, maxHit: 2,
    speed: 2.6, radius: 0.8, aggro: 7, attack: { kind: 'melee', range: 1.6, windup: 0.45, cooldown: 2.4 }, loot: 'mire', respawn: 25, scale: 1.3 },
  smuggler: { hostile: true, id: 'smuggler', name: 'Smuggler', model: 'brigand', look: 'smuggler', level: 18, hp: 22, att: 16, def: 13, defBonus: { melee: 20, ranged: -5, magic: 10 }, weakness: 'ranged', style: 'melee', accBonus: 13, maxHit: 4,
    speed: 3.4, radius: 0.45, aggro: 9, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'smuggler', respawn: 35, scale: 1.2 },
  smuggler_gunner: { hostile: true, id: 'smuggler_gunner', name: 'Smuggler gunner', model: 'gunner', look: 'smuggler', level: 20, hp: 20, att: 18, def: 10, defBonus: { melee: -5, ranged: 25, magic: 10 }, weakness: 'melee', style: 'ranged', accBonus: 15, maxHit: 4,
    speed: 3.0, radius: 0.45, aggro: 12, attack: { kind: 'shot', range: 10, windup: 0.85, cooldown: 3.4 }, loot: 'smuggler', respawn: 35, scale: 1.2 },
  ironshell_crab: { id: 'ironshell_crab', name: 'Ironshell crab', model: 'crab', look: 'ironshell', level: 33, hp: 40, att: 28, def: 38, defBonus: { melee: 40, ranged: 30, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 20, maxHit: 5,
    speed: 2.2, radius: 0.95, aggro: 7, attack: { kind: 'melee', range: 1.9, windup: 0.55, cooldown: 2.8 }, loot: 'ironshell', respawn: 30, scale: 1.7 },
  poacher: { hostile: true, id: 'poacher', name: 'Heartwood poacher', model: 'brigand', look: 'poacher', level: 38, hp: 45, att: 36, def: 30, defBonus: { melee: 30, ranged: 0, magic: 20 }, weakness: 'ranged', style: 'melee', accBonus: 30, maxHit: 6,
    speed: 3.5, radius: 0.45, aggro: 10, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'poacher', respawn: 40, scale: 1.2 },
  poacher_gunner: { hostile: true, id: 'poacher_gunner', name: 'Poacher marksman', model: 'gunner', look: 'poacher', level: 42, hp: 40, att: 42, def: 26, defBonus: { melee: 0, ranged: 35, magic: 20 }, weakness: 'melee', style: 'ranged', accBonus: 38, maxHit: 7,
    speed: 3.1, radius: 0.45, aggro: 13, attack: { kind: 'shot', range: 11, windup: 0.8, cooldown: 3.2 }, loot: 'poacher', respawn: 40, scale: 1.2 },
  drowned: { hostile: true, id: 'drowned', name: 'Drowned wrecker', model: 'brigand', look: 'drowned', level: 55, hp: 65, att: 52, def: 45, defBonus: { melee: 45, ranged: 40, magic: 0 }, weakness: 'magic', style: 'melee', accBonus: 45, maxHit: 9,
    speed: 3.0, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 1.8, windup: 0.5, cooldown: 2.6 }, loot: 'drowned', respawn: 45, scale: 1.25 },
  wreck_captain: { hostile: true, id: 'wreck_captain', name: 'Drowned captain', model: 'brigand', look: 'captain', level: 70, hp: 90, att: 66, def: 60, defBonus: { melee: 60, ranged: 25, magic: 45 }, weakness: 'ranged', style: 'melee', accBonus: 60, maxHit: 12,
    speed: 3.2, radius: 0.6, aggro: 11, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.6 }, loot: 'captain', respawn: 90, scale: 1.45 },
  stone_sentinel: { hostile: true, id: 'stone_sentinel', name: 'Stone sentinel', model: 'guardian', look: 'sentinel', level: 80, hp: 110, att: 75, def: 80, defBonus: { melee: 70, ranged: 60, magic: 10 }, weakness: 'magic', style: 'melee', accBonus: 70, maxHit: 14,
    speed: 1.9, radius: 1.2, aggro: 9, attack: { kind: 'melee', range: 2.8, windup: 0.8, cooldown: 3.0 }, loot: 'sentinel', respawn: 120, scale: 0.8 },
  // ---- Sunreach and the caves (stage 2): beasts with their own bodies
  cave_spider: { id: 'cave_spider', name: 'Cave spider', model: 'spider', look: 'cave', level: 16, hp: 18, att: 14, def: 10, defBonus: { melee: 5, ranged: 10, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 10, maxHit: 3,
    speed: 3.6, radius: 0.6, aggro: 7, attack: { kind: 'melee', range: 1.5, windup: 0.35, cooldown: 2.0 }, loot: 'cave_spider', respawn: 25, scale: 1.0 },
  boar: { id: 'boar', name: 'Greenheart boar', model: 'boar', level: 26, hp: 34, att: 24, def: 22, defBonus: { melee: 25, ranged: -10, magic: 10 }, weakness: 'ranged', style: 'melee', accBonus: 18, maxHit: 5,
    speed: 4.0, radius: 0.7, aggro: 6, attack: { kind: 'melee', range: 1.7, windup: 0.5, cooldown: 2.6 }, loot: 'boar', respawn: 30, scale: 1.0 },
  jungle_snake: { id: 'jungle_snake', name: 'Gold-banded snake', model: 'snake', look: 'jungle', level: 30, hp: 28, att: 32, def: 16, defBonus: { melee: -10, ranged: 25, magic: 15 }, weakness: 'melee', style: 'melee', accBonus: 26, maxHit: 5,
    speed: 2.8, radius: 0.5, aggro: 6, attack: { kind: 'melee', range: 1.9, windup: 0.3, cooldown: 2.2 }, loot: 'snake', respawn: 30, scale: 1.4 },
  giant_spider: { hostile: true, id: 'giant_spider', name: 'Giant weaver', model: 'spider', look: 'giant', level: 46, hp: 55, att: 44, def: 36, defBonus: { melee: 35, ranged: 40, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 36, maxHit: 8,
    speed: 3.4, radius: 1.0, aggro: 9, attack: { kind: 'melee', range: 2.2, windup: 0.45, cooldown: 2.4 }, loot: 'spider', respawn: 45, scale: 1.7 },
  weaver_young: { hostile: true, id: 'weaver_young', name: 'Young weaver', model: 'spider', look: 'giant', level: 27, hp: 32, att: 26, def: 20, defBonus: { melee: 20, ranged: 25, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 20, maxHit: 5,
    speed: 3.4, radius: 0.8, aggro: 8, attack: { kind: 'melee', range: 1.9, windup: 0.45, cooldown: 2.4 }, loot: 'weaver_young', respawn: 35, scale: 1.25 },
  ember_snake: { hostile: true, id: 'ember_snake', name: 'Ember asp', model: 'snake', look: 'ember', level: 28, hp: 30, att: 28, def: 20, defBonus: { melee: -5, ranged: 25, magic: 15 }, weakness: 'melee', style: 'ranged', accBonus: 24, maxHit: 5,
    speed: 2.6, radius: 0.6, aggro: 11, attack: { kind: 'shot', range: 9, windup: 0.7, cooldown: 3.0 }, loot: 'ember', respawn: 50, scale: 1.7 },
  temple_serpent: { id: 'temple_serpent', name: 'The Sunscale', model: 'snake', look: 'sunscale', boss: true, level: 32, hp: 50, att: 30, def: 22, defBonus: { melee: 25, ranged: 5, magic: 20 }, weakness: 'ranged', style: 'melee', accBonus: 26, maxHit: 5,
    speed: 2.7, radius: 1.5, aggro: 20, attack: { kind: 'melee', range: 3.5, windup: 0.6, cooldown: 3 }, loot: 'serpent', respawn: 0, scale: 3.0 },
  // ---- the islands' stranger folk (Tom, 2026-10-25: "creatures, bugs, fantasy"; plain fighters, no special attacks)
  // Bellwether (1-20): Celtic shore folklore (docs/ISLANDS.md)
  shore_beetle: { id: 'shore_beetle', name: 'Shore beetle', model: 'beetle', look: 'shore', level: 2, hp: 5, att: 1, def: 2, defBonus: { melee: 5, ranged: 15, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 0, maxHit: 1,
    speed: 2.6, radius: 0.55, aggro: 5, attack: { kind: 'melee', range: 1.4, windup: 0.5, cooldown: 2.4 }, loot: 'shore_beetle', respawn: 20, scale: 0.8 },
  gull: { id: 'gull', name: 'Herring gull', model: 'bat', look: 'gull', level: 5, hp: 8, att: 4, def: 3, defBonus: { melee: 5, ranged: -10, magic: 5 }, weakness: 'ranged', style: 'melee', accBonus: 3, maxHit: 1,
    speed: 4.0, radius: 0.45, aggro: 6, attack: { kind: 'melee', range: 1.5, windup: 0.3, cooldown: 2.0 }, loot: 'gull', respawn: 20, scale: 0.8 },
  spriggan: { id: 'spriggan', name: 'Bramble spriggan', model: 'golem', look: 'thorn', level: 9, hp: 15, att: 8, def: 7, defBonus: { melee: 15, ranged: 10, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 7, maxHit: 2,
    speed: 2.8, radius: 0.5, aggro: 7, attack: { kind: 'melee', range: 1.6, windup: 0.45, cooldown: 2.4 }, loot: 'spriggan', respawn: 25, scale: 0.85 },
  knocker: { hostile: true, id: 'knocker', name: 'Knocker', model: 'brigand', look: 'knocker', level: 12, hp: 15, att: 11, def: 9, defBonus: { melee: 15, ranged: -10, magic: 10 }, weakness: 'ranged', style: 'melee', accBonus: 9, maxHit: 3,
    speed: 3.0, radius: 0.4, aggro: 7, attack: { kind: 'melee', range: 1.5, windup: 0.4, cooldown: 2.4 }, loot: 'knocker', respawn: 25, scale: 0.7 },
  bog_leech: { hostile: true, id: 'bog_leech', name: 'Bog leech', model: 'snake', look: 'leech', level: 14, hp: 17, att: 12, def: 9, defBonus: { melee: -10, ranged: 15, magic: 10 }, weakness: 'melee', style: 'melee', accBonus: 10, maxHit: 3,
    speed: 2.4, radius: 0.5, aggro: 5, attack: { kind: 'melee', range: 1.5, windup: 0.4, cooldown: 2.2 }, loot: 'bog_leech', respawn: 25, scale: 0.9 },
  haugbui: { hostile: true, id: 'haugbui', name: 'Haugbui', model: 'brigand', look: 'howe', level: 18, hp: 22, att: 17, def: 14, defBonus: { melee: 20, ranged: 15, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 13, maxHit: 4,
    speed: 2.6, radius: 0.45, aggro: 8, attack: { kind: 'melee', range: 1.7, windup: 0.5, cooldown: 2.6 }, loot: 'haugbui', respawn: 35, scale: 1.15 },
  // Sunreach (15-30): Caribbean jungle folklore and giant insects (docs/ISLANDS.md slice 2)
  leafcutter_ant: { id: 'leafcutter_ant', name: 'Leafcutter ant', model: 'beetle', look: 'ant', level: 16, hp: 18, att: 14, def: 12, defBonus: { melee: 15, ranged: 20, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 10, maxHit: 3,
    speed: 3.0, radius: 0.5, aggro: 6, attack: { kind: 'melee', range: 1.5, windup: 0.4, cooldown: 2.4 }, loot: 'ant', respawn: 25, scale: 0.95 },
  jungle_mantis: { hostile: true, id: 'jungle_mantis', name: 'Jungle mantis', model: 'beetle', look: 'mantis', level: 20, hp: 22, att: 20, def: 12, defBonus: { melee: 10, ranged: -10, magic: 15 }, weakness: 'ranged', style: 'melee', accBonus: 15, maxHit: 4,
    speed: 3.4, radius: 0.55, aggro: 8, attack: { kind: 'melee', range: 1.8, windup: 0.35, cooldown: 2.2 }, loot: 'mantis', respawn: 30, scale: 1.15 },
  douen: { hostile: true, id: 'douen', name: 'Douen', model: 'brigand', look: 'douen', level: 22, hp: 26, att: 21, def: 15, defBonus: { melee: 15, ranged: 10, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 16, maxHit: 4,
    speed: 3.6, radius: 0.4, aggro: 9, attack: { kind: 'melee', range: 1.5, windup: 0.4, cooldown: 2.3 }, loot: 'douen', respawn: 30, scale: 0.72 },
  giant_centipede: { hostile: true, id: 'giant_centipede', name: 'Giant centipede', model: 'snake', look: 'centipede', level: 24, hp: 28, att: 24, def: 18, defBonus: { melee: -5, ranged: 20, magic: 15 }, weakness: 'melee', style: 'melee', accBonus: 18, maxHit: 4,
    speed: 3.0, radius: 0.55, aggro: 8, attack: { kind: 'melee', range: 1.8, windup: 0.35, cooldown: 2.3 }, loot: 'centipede', respawn: 30, scale: 1.5 },
  // quest foes (they appear for their quest, once)
  knocker_elder: { hostile: true, id: 'knocker_elder', name: 'Knocker Elder', model: 'brigand', look: 'knocker', level: 16, hp: 34, att: 15, def: 13, defBonus: { melee: 20, ranged: -5, magic: 10 }, weakness: 'ranged', style: 'melee', accBonus: 12, maxHit: 4,
    speed: 2.8, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 1.7, windup: 0.5, cooldown: 2.4 }, loot: 'knocker_elder', respawn: 0, scale: 0.95 },
  wrecker_chief: { hostile: true, id: 'wrecker_chief', name: 'Wreckers\' chief', model: 'brigand', look: 'wrecker', level: 17, hp: 38, att: 16, def: 14, defBonus: { melee: 15, ranged: 10, magic: 0 }, weakness: 'magic', style: 'melee', accBonus: 14, maxHit: 4,
    speed: 3.2, radius: 0.45, aggro: 11, attack: { kind: 'melee', range: 1.7, windup: 0.45, cooldown: 2.4 }, loot: 'wrecker_chief', respawn: 0, scale: 1.2 },
  douen_elder: { hostile: true, id: 'douen_elder', name: 'Douen elder', model: 'brigand', look: 'douen', level: 24, hp: 42, att: 23, def: 17, defBonus: { melee: 15, ranged: 10, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 18, maxHit: 4,
    speed: 3.4, radius: 0.45, aggro: 11, attack: { kind: 'melee', range: 1.6, windup: 0.45, cooldown: 2.4 }, loot: 'douen_elder', respawn: 0, scale: 0.95 },
  soucouyant: { hostile: true, id: 'soucouyant', name: 'Soucouyant', model: 'bat', look: 'souc', level: 26, hp: 46, att: 25, def: 18, defBonus: { melee: 20, ranged: 15, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 20, maxHit: 5,
    speed: 3.8, radius: 0.5, aggro: 12, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'soucouyant', respawn: 0, scale: 1.2 },
  barrow_king: { hostile: true, id: 'barrow_king', name: 'The Barrow King', model: 'golem', look: 'draugrtroll', level: 50, hp: 55, att: 48, def: 42, defBonus: { melee: 45, ranged: -10, magic: 40 }, weakness: 'ranged', style: 'melee', accBonus: 40, maxHit: 8,
    speed: 2.3, radius: 1.2, aggro: 12, attack: { kind: 'melee', range: 2.8, windup: 0.75, cooldown: 3.0 }, loot: 'barrow_king', respawn: 0, scale: 1.8 },
  // The Key Collector (Stormwrack): a hunter of keys, quick with a blade and hard to pin down
  starstruck: { hostile: true, id: 'starstruck', name: 'Tobin, star-struck', model: 'brigand', look: 'starstruck', level: 62, hp: 80, att: 58, def: 48, defBonus: { melee: 40, ranged: 40, magic: 60 }, weakness: 'melee', style: 'melee', accBonus: 50, maxHit: 10,
    speed: 3.6, radius: 0.5, aggro: 14, attack: { kind: 'melee', range: 1.9, windup: 0.45, cooldown: 2.3 }, loot: 'starstruck', respawn: 0, scale: 1.1 },
  // Halvdan Ninefold, in his duel (the Tides): he fights to win, or to die well
  ninefold_duel: { hostile: true, id: 'ninefold_duel', name: 'Halvdan Ninefold', model: 'brigand', look: 'ninefold', level: 82, hp: 170, att: 80, def: 70, defBonus: { melee: 70, ranged: 55, magic: 40 }, weakness: 'magic', style: 'melee', accBonus: 74, maxHit: 15,
    speed: 3.8, radius: 0.55, aggro: 16, attack: { kind: 'melee', range: 2.2, windup: 0.55, cooldown: 2.6 }, loot: 'ninefold', respawn: 0, scale: 1.3 },
  // Jenny Greenteeth (English fen folklore): the green-toothed hag under the weed who drags people down; she has the Second Lockkey
  greenteeth: { hostile: true, id: 'greenteeth', name: 'Jenny Greenteeth', model: 'brigand', look: 'greenteeth', level: 66, hp: 150, att: 62, def: 52, defBonus: { melee: 50, ranged: 35, magic: 20 }, weakness: 'magic', style: 'melee', accBonus: 60, maxHit: 12,
    speed: 3.0, radius: 0.6, aggro: 12, attack: { kind: 'melee', range: 2.3, windup: 0.6, cooldown: 2.4 }, loot: 'greenteeth', respawn: 0, scale: 1.45 },
  // the Hushed (docs/STORY.md): they listen at keyholes until the song answers; they fight with their hands, quietly
  hushed_listener: { hostile: true, id: 'hushed_listener', name: 'Hushed listener', model: 'brigand', look: 'hushed', level: 58, hp: 72, att: 56, def: 50, defBonus: { melee: 40, ranged: 30, magic: 55 }, weakness: 'ranged', style: 'melee', accBonus: 52, maxHit: 9,
    speed: 3.4, radius: 0.5, aggro: 14, attack: { kind: 'melee', range: 1.8, windup: 0.5, cooldown: 2.1 }, loot: 'hushed', respawn: 0, scale: 1.05 },
  // Sister Corva (the Tides): she fights the way the Hushed do, without a sound, with the lantern-pole she listens by
  corva: { hostile: true, id: 'corva', name: 'Sister Corva', model: 'brigand', look: 'corva', boss: true, level: 86, hp: 210, att: 82, def: 70, defBonus: { melee: 60, ranged: 70, magic: 30 }, weakness: 'magic', style: 'melee', accBonus: 80, maxHit: 17,
    speed: 3.9, radius: 0.5, aggro: 16, attack: { kind: 'melee', range: 2.4, windup: 0.5, cooldown: 2.3 }, loot: 'corva', respawn: 0, scale: 1.25 },
  // the Undertow's crew (A Parley of Tides): sailors who stopped ageing at the twelfth Lock; they don't hurry, and they don't stop
  undertow_hand: { hostile: true, id: 'undertow_hand', name: 'Hand of the Undertow', model: 'brigand', look: 'seadraugr', level: 78, hp: 115, att: 74, def: 66, defBonus: { melee: 55, ranged: 50, magic: 35 }, weakness: 'magic', style: 'melee', accBonus: 70, maxHit: 14,
    speed: 3.2, radius: 0.5, aggro: 16, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.3 }, loot: 'undertow_hand', respawn: 0, scale: 1.15 },
  // Lockhaven's own (levels 60-90): Hushed pilgrims at the doors, the Undertow's deckhands on the shore, crabs whose
  // shells have grown keyholes
  hushed_pilgrim: { hostile: true, id: 'hushed_pilgrim', name: 'Hushed pilgrim', model: 'brigand', look: 'hushed', level: 62, hp: 70, att: 60, def: 48, defBonus: { melee: 45, ranged: 30, magic: 50 }, weakness: 'ranged', style: 'melee', accBonus: 52, maxHit: 10,
    speed: 3.0, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 1.8, windup: 0.5, cooldown: 2.6 }, loot: 'hushed', respawn: 60, scale: 1.05 },
  undertow_deckhand: { hostile: true, id: 'undertow_deckhand', name: 'Undertow deckhand', model: 'brigand', look: 'seadraugr', level: 72, hp: 90, att: 66, def: 60, defBonus: { melee: 55, ranged: 40, magic: 30 }, weakness: 'magic', style: 'melee', accBonus: 60, maxHit: 12,
    speed: 3.0, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.6 }, loot: 'undertow_hand', respawn: 80, scale: 1.1 },
  lockshell_crab: { hostile: true, id: 'lockshell_crab', name: 'Lockshell crab', model: 'crab', look: 'ironshell', level: 64, hp: 72, att: 58, def: 56, defBonus: { melee: 55, ranged: 40, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 48, maxHit: 10,
    speed: 2.4, radius: 1.0, aggro: 8, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.8 }, loot: 'lockshell', respawn: 60, scale: 2.1 },
  // the Doorwarden (The Third Lock): what the Wardwrights set at the bottom of the Locksmith's Well to keep it shut
  doorwarden: { hostile: true, id: 'doorwarden', name: 'The Doorwarden', model: 'golem', look: 'sentinel', boss: true, level: 88, hp: 300, att: 84, def: 80, defBonus: { melee: 75, ranged: 70, magic: 20 }, weakness: 'magic', style: 'melee', accBonus: 80, maxHit: 18,
    speed: 2.2, radius: 1.2, aggro: 16, attack: { kind: 'melee', range: 2.8, windup: 0.75, cooldown: 3.0 }, loot: 'doorwarden', respawn: 0, scale: 1.7 },
  // the Lockjaw (Lockhaven): a door that has stood too long with nothing behind it. It looks like a door until it doesn't
  lockjaw: { hostile: true, id: 'lockjaw', name: 'Lockjaw', model: 'door', look: 'lockjaw', level: 68, hp: 80, att: 62, def: 58, defBonus: { melee: 50, ranged: 60, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 54, maxHit: 11,
    speed: 2.6, radius: 0.7, aggro: 5, attack: { kind: 'melee', range: 2.0, windup: 0.6, cooldown: 2.8 }, loot: 'lockjaw', respawn: 70, scale: 1.25 },
  // the Elder Lockjaw (Lockhaven's arena): the oldest door in the Field, iron-black, brass-bound; it has been a mouth longest
  elder_lockjaw: { id: 'elder_lockjaw', name: 'The Elder Lockjaw', model: 'door', look: 'elder', boss: true, level: 88, hp: 380, att: 84, def: 78, defBonus: { melee: 70, ranged: 75, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 80, maxHit: 22,
    speed: 2.4, radius: 1.3, aggro: 30, attack: { kind: 'melee', range: 3.0, windup: 0.8, cooldown: 2.6 }, loot: 'elder_lockjaw', respawn: 0, scale: 2.4 },
  key_collector: { hostile: true, id: 'key_collector', name: 'The Key Collector', model: 'brigand', look: 'hunter', level: 78, hp: 95, att: 74, def: 64, defBonus: { melee: 55, ranged: 45, magic: 30 }, weakness: 'ranged', style: 'melee', accBonus: 66, maxHit: 13,
    speed: 3.8, radius: 0.5, aggro: 14, attack: { kind: 'melee', range: 1.9, windup: 0.4, cooldown: 2.2 }, loot: 'key_collector', respawn: 0, scale: 1.3 },
  // further out (their islands' slices replace the rest of this list)
  cave_bat: { hostile: true, id: 'cave_bat', name: 'Cave bat', model: 'bat', look: 'cave', level: 17, hp: 16, att: 16, def: 10, defBonus: { melee: 10, ranged: -10, magic: 5 }, weakness: 'ranged', style: 'melee', accBonus: 12, maxHit: 3,
    speed: 4.2, radius: 0.5, aggro: 8, attack: { kind: 'melee', range: 1.6, windup: 0.3, cooldown: 2.0 }, loot: 'cave_bat', respawn: 25, scale: 0.9 },
  ember_bat: { hostile: true, id: 'ember_bat', name: 'Ember bat', model: 'bat', look: 'ember', level: 26, hp: 26, att: 25, def: 16, defBonus: { melee: 15, ranged: -10, magic: 15 }, weakness: 'ranged', style: 'melee', accBonus: 18, maxHit: 4,
    speed: 4.2, radius: 0.5, aggro: 9, attack: { kind: 'melee', range: 1.6, windup: 0.3, cooldown: 2.0 }, loot: 'ember_bat', respawn: 30, scale: 1.1 },
  // Amberhold (25-50): Norse autumn folklore, trolls, the barrow dead and the amberwood's hives (docs/ISLANDS.md slice 3)
  amber_hornet: { hostile: true, id: 'amber_hornet', name: 'Amber hornet', model: 'bat', look: 'hornet', level: 30, hp: 30, att: 29, def: 18, defBonus: { melee: 15, ranged: -10, magic: 15 }, weakness: 'ranged', style: 'melee', accBonus: 22, maxHit: 5,
    speed: 4.4, radius: 0.45, aggro: 9, attack: { kind: 'melee', range: 1.6, windup: 0.3, cooldown: 2.0 }, loot: 'hornet', respawn: 30, scale: 0.9 },
  bark_beetle: { id: 'bark_beetle', name: 'Bark beetle', model: 'beetle', look: 'bark', level: 34, hp: 42, att: 30, def: 34, defBonus: { melee: 35, ranged: 30, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 24, maxHit: 5,
    speed: 2.6, radius: 0.9, aggro: 6, attack: { kind: 'melee', range: 2.0, windup: 0.55, cooldown: 2.6 }, loot: 'bark_beetle', respawn: 35, scale: 1.8 },
  warg: { hostile: true, id: 'warg', name: 'Warg', model: 'hound', look: 'warg', level: 36, hp: 42, att: 35, def: 26, defBonus: { melee: 25, ranged: 20, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 26, maxHit: 6,
    speed: 4.6, radius: 0.6, aggro: 10, attack: { kind: 'melee', range: 1.8, windup: 0.35, cooldown: 2.2 }, loot: 'warg', respawn: 35, scale: 1.25 },
  nokk: { hostile: true, id: 'nokk', name: 'Nøkk', model: 'hound', look: 'nokk', level: 38, hp: 46, att: 37, def: 28, defBonus: { melee: 30, ranged: -10, magic: 20 }, weakness: 'ranged', style: 'melee', accBonus: 28, maxHit: 6,
    speed: 4.2, radius: 0.7, aggro: 8, attack: { kind: 'melee', range: 2.0, windup: 0.45, cooldown: 2.4 }, loot: 'nokk', respawn: 40, scale: 1.2 },
  moss_troll: { hostile: true, id: 'moss_troll', name: 'Moss troll', model: 'golem', look: 'mosstroll', level: 42, hp: 60, att: 38, def: 36, defBonus: { melee: 40, ranged: 30, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 28, maxHit: 7,
    speed: 2.2, radius: 0.9, aggro: 8, attack: { kind: 'melee', range: 2.2, windup: 0.7, cooldown: 3.0 }, loot: 'moss_troll', respawn: 45, scale: 1.25 },
  barrow_draugr: { hostile: true, id: 'barrow_draugr', name: 'Barrow draugr', model: 'brigand', look: 'draugr', level: 44, hp: 55, att: 42, def: 36, defBonus: { melee: 40, ranged: 35, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 34, maxHit: 7,
    speed: 2.8, radius: 0.5, aggro: 9, attack: { kind: 'melee', range: 1.9, windup: 0.5, cooldown: 2.6 }, loot: 'draugr', respawn: 45, scale: 1.2 },
  draugr_troll: { hostile: true, id: 'draugr_troll', name: 'Draugr troll', model: 'golem', look: 'draugrtroll', level: 48, hp: 70, att: 46, def: 42, defBonus: { melee: 45, ranged: -10, magic: 40 }, weakness: 'ranged', style: 'melee', accBonus: 38, maxHit: 8,
    speed: 2.2, radius: 1.0, aggro: 9, attack: { kind: 'melee', range: 2.4, windup: 0.75, cooldown: 3.0 }, loot: 'draugr_troll', respawn: 60, scale: 1.45 },
  crag_troll: { hostile: true, id: 'crag_troll', name: 'Crag troll', model: 'golem', look: 'troll', level: 58, hp: 70, att: 56, def: 46, defBonus: { melee: 45, ranged: 45, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 46, maxHit: 9,
    speed: 2.4, radius: 1.0, aggro: 9, attack: { kind: 'melee', range: 2.4, windup: 0.7, cooldown: 3.0 }, loot: 'crag_troll', respawn: 60, scale: 1.3 },
  sea_draugr: { hostile: true, id: 'sea_draugr', name: 'Sea-draugr', model: 'brigand', look: 'seadraugr', level: 66, hp: 72, att: 64, def: 50, defBonus: { melee: 50, ranged: -10, magic: 50 }, weakness: 'ranged', style: 'melee', accBonus: 55, maxHit: 11,
    speed: 3.0, radius: 0.5, aggro: 10, attack: { kind: 'melee', range: 2.0, windup: 0.5, cooldown: 2.6 }, loot: 'sea_draugr', respawn: 60, scale: 1.25 },
  oakheart: { hostile: true, id: 'oakheart', name: 'Oakheart', model: 'golem', look: 'oak', level: 76, hp: 100, att: 70, def: 72, defBonus: { melee: 65, ranged: 70, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 64, maxHit: 13,
    speed: 2.0, radius: 1.1, aggro: 8, attack: { kind: 'melee', range: 2.6, windup: 0.8, cooldown: 3.2 }, loot: 'oakheart', respawn: 90, scale: 1.45 },
  // Amberhold's finale: the giant weavers' mother, under Weaver Hollow
  broodmother: { id: 'broodmother', name: 'The Broodmother', model: 'spider', look: 'queen', boss: true, level: 52, hp: 115, att: 50, def: 38, defBonus: { melee: 30, ranged: 40, magic: -10 }, weakness: 'magic', style: 'melee', accBonus: 44, maxHit: 9,
    speed: 2.8, radius: 1.6, aggro: 20, attack: { kind: 'melee', range: 3.4, windup: 0.6, cooldown: 3 }, loot: 'broodmother', respawn: 0, scale: 2.8 },
  // Stormwrack's finale (the first island past 50): a storm giant on Thunder Crag, calling lightning
  storm_jotunn: { id: 'storm_jotunn', name: 'The Thunder Jötunn', model: 'golem', look: 'jotunn', boss: true, level: 82, hp: 360, att: 80, def: 74, defBonus: { melee: 60, ranged: 60, magic: -15 }, weakness: 'magic', style: 'melee', accBonus: 78, maxHit: 24,
    speed: 2.3, radius: 1.8, aggro: 20, attack: { kind: 'melee', range: 3.8, windup: 0.7, cooldown: 3.2 }, loot: 'jotunn', respawn: 0, scale: 2.4 },
  // bounty hunters (bounties.ts): they come for you once your bounty is big enough; three tiers by your bounty
  bounty_hunter_1: { hostile: true, id: 'bounty_hunter_1', name: 'Bounty hunter', model: 'brigand', look: 'hunter', level: 22, hp: 30, att: 20, def: 16, defBonus: { melee: 15, ranged: 10, magic: 0 }, weakness: 'magic', style: 'melee', accBonus: 16, maxHit: 4,
    speed: 3.5, radius: 0.45, aggro: 14, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'hunter', respawn: 0, scale: 1.2 },
  bounty_gunman_1: { hostile: true, id: 'bounty_gunman_1', name: 'Bounty gunman', model: 'gunner', look: 'hunter', level: 24, hp: 24, att: 22, def: 12, defBonus: { melee: -5, ranged: 15, magic: 5 }, weakness: 'melee', style: 'ranged', accBonus: 18, maxHit: 4,
    speed: 3.2, radius: 0.45, aggro: 16, attack: { kind: 'shot', range: 10, windup: 0.9, cooldown: 3.4 }, loot: 'hunter', respawn: 0, scale: 1.2 },
  bounty_hunter_2: { hostile: true, id: 'bounty_hunter_2', name: 'Veteran bounty hunter', model: 'brigand', look: 'hunter', level: 45, hp: 55, att: 42, def: 36, defBonus: { melee: 35, ranged: 25, magic: 10 }, weakness: 'magic', style: 'melee', accBonus: 38, maxHit: 7,
    speed: 3.6, radius: 0.45, aggro: 14, attack: { kind: 'melee', range: 1.7, windup: 0.4, cooldown: 2.4 }, loot: 'hunter2', respawn: 0, scale: 1.22 },
  bounty_gunman_2: { hostile: true, id: 'bounty_gunman_2', name: 'Veteran bounty gunman', model: 'gunner', look: 'hunter', level: 47, hp: 45, att: 44, def: 30, defBonus: { melee: 5, ranged: 35, magic: 15 }, weakness: 'melee', style: 'ranged', accBonus: 40, maxHit: 7,
    speed: 3.3, radius: 0.45, aggro: 16, attack: { kind: 'shot', range: 11, windup: 0.85, cooldown: 3.3 }, loot: 'hunter2', respawn: 0, scale: 1.22 },
  bounty_hunter_3: { hostile: true, id: 'bounty_hunter_3', name: 'Famed bounty hunter', model: 'brigand', look: 'hunter', level: 68, hp: 85, att: 62, def: 55, defBonus: { melee: 55, ranged: 40, magic: 25 }, weakness: 'magic', style: 'melee', accBonus: 58, maxHit: 11,
    speed: 3.7, radius: 0.5, aggro: 14, attack: { kind: 'melee', range: 1.8, windup: 0.4, cooldown: 2.4 }, loot: 'hunter3', respawn: 0, scale: 1.3 },
  bounty_gunman_3: { hostile: true, id: 'bounty_gunman_3', name: 'Famed bounty gunman', model: 'gunner', look: 'hunter', level: 70, hp: 70, att: 64, def: 48, defBonus: { melee: 15, ranged: 55, magic: 30 }, weakness: 'melee', style: 'ranged', accBonus: 60, maxHit: 10,
    speed: 3.4, radius: 0.45, aggro: 16, attack: { kind: 'shot', range: 12, windup: 0.8, cooldown: 3.2 }, loot: 'hunter3', respawn: 0, scale: 1.3 },
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
  /** a signature weapon: very rare, always a relic */
  sig?: { item: string; chance: number };
}

export const LOOT: Record<string, LootTable> = {
  crab: { coins: [1, 4], drops: [{ item: 'crab_meat_raw', chance: 0.6 }, { item: 'shell_fragment', chance: 0.2 }, { item: 'charm_tide', chance: 0.25, qty: [2, 5] }], gear: { chance: 0.03, items: ['ring_brass'], weights: { common: 60, fine: 35, rare: 5 } } },
  brigand: { coins: [5, 15], drops: [{ item: 'bread', chance: 0.3 }, { item: 'shot_bronze', chance: 0.3, qty: [4, 10] }, { item: 'arrow_bronze', chance: 0.25, qty: [5, 12] }, { item: 'ore_iron', chance: 0.12 }],
    gear: { chance: 0.15, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass', 'pistol_flintlock', 'dagger_bronze', 'shortbow_pine', 'amulet_brass', 'bracelet_brass', 'boots_leather'], weights: { common: 50, fine: 38, rare: 12 } } },
  elite: { coins: [12, 30], drops: [], gear: { chance: 0.6, items: ['cutlass_brigand', 'cap_leather', 'coat_padded', 'ring_brass', 'cutlass_bronze', 'pistol_flintlock', 'staff_driftwood'], weights: { fine: 65, rare: 35 } } },
  mire: { coins: [4, 12], drops: [{ item: 'crab_meat_raw', chance: 0.6 }, { item: 'charm_tide', chance: 0.4, qty: [3, 8] }, { item: 'logs_willow', chance: 0.15, qty: [1, 3] }], gear: { chance: 0.05, items: ['ring_brass', 'helm_iron'], weights: { common: 55, fine: 38, rare: 7 } } },
  smuggler: { coins: [15, 40], drops: [{ item: 'fish_lobster', chance: 0.25 }, { item: 'shot_steel', chance: 0.3, qty: [5, 12] }, { item: 'bar_steel', chance: 0.12 }, { item: 'charm_tide', chance: 0.3, qty: [5, 12] }],
    gear: { chance: 0.12, items: ['cutlass_steel', 'helm_steel', 'pistol_steel', 'staff_coral', 'ring_gold', 'shield_steel', 'pike_steel', 'boots_steel', 'wand_coral'], weights: { common: 50, fine: 38, rare: 12 } } },
  ironshell: { coins: [10, 30], drops: [{ item: 'ore_coal', chance: 0.5, qty: [2, 5] }, { item: 'ore_gold', chance: 0.2 }, { item: 'shell_fragment', chance: 0.5, qty: [1, 3] }], gear: { chance: 0.06, items: ['helm_steel', 'plate_steel', 'legs_steel', 'gloves_steel'], weights: { common: 50, fine: 40, rare: 10 } } },
  poacher: { coins: [25, 60], drops: [{ item: 'logs_amber', chance: 0.25, qty: [1, 3] }, { item: 'arrow_storm', chance: 0.3, qty: [6, 15] }, { item: 'fish_salmon', chance: 0.3 }],
    gear: { chance: 0.12, items: ['cutlass_storm', 'helm_storm', 'longbow_amber', 'shortbow_amber', 'crossbow_storm', 'ring_gold', 'book_storm', 'shield_storm', 'amulet_gold'], weights: { common: 48, fine: 38, rare: 14 } } },
  drowned: { sig: { item: 'sig_lash', chance: 1 / 400 }, coins: [40, 90], drops: [{ item: 'charm_tide', chance: 0.6, qty: [10, 25] }, { item: 'fish_gloom', chance: 0.3 }, { item: 'bar_abyss', chance: 0.08 }],
    gear: { chance: 0.12, items: ['cutlass_abyss', 'helm_abyss', 'plate_abyss', 'pistol_abyss', 'staff_tide', 'greatsword_abyss', 'legs_abyss', 'book_storm', 'orb_storm'], weights: { common: 45, fine: 38, rare: 15, relic: 2 } } },
  hunter: { coins: [40, 120], drops: [{ item: 'shot_steel', chance: 0.4, qty: [6, 14] }, { item: 'fish_lobster', chance: 0.3 }, { item: 'charm_tide', chance: 0.4, qty: [6, 14] }],
    gear: { chance: 0.25, items: ['cutlass_storm', 'pistol_storm', 'shield_storm', 'boots_storm', 'gloves_storm', 'amulet_gold'], weights: { common: 40, fine: 45, rare: 15 } } },
  hunter2: { coins: [120, 300], drops: [{ item: 'shot_tide', chance: 0.4, qty: [8, 16] }, { item: 'fish_sword', chance: 0.3 }, { item: 'charm_tide', chance: 0.5, qty: [10, 20] }],
    gear: { chance: 0.3, items: ['cutlass_tide', 'pistol_tide', 'shield_tide', 'legs_tide', 'gloves_tide', 'ring_crystal'], weights: { common: 30, fine: 45, rare: 22, relic: 3 } } },
  hunter3: { sig: { item: 'sig_flintlock', chance: 1 / 150 }, coins: [300, 700], drops: [{ item: 'shot_cinder', chance: 0.4, qty: [8, 16] }, { item: 'fish_shark', chance: 0.4 }, { item: 'crystal_geode', chance: 0.3 }],
    gear: { chance: 0.35, items: ['cutlass_sky', 'pistol_sky', 'shield_sky', 'legs_sky', 'gloves_sky', 'amulet_crystal'], weights: { fine: 45, rare: 45, relic: 10 } } },
  captain: { sig: { item: 'sig_jaw', chance: 1 / 250 }, coins: [120, 260], drops: [{ item: 'bar_abyss', chance: 0.4, qty: [1, 2] }, { item: 'sea_salt', chance: 0.4, qty: [2, 5] }, { item: 'fish_shark', chance: 0.4, qty: [1, 2] }],
    gear: { chance: 0.4, items: ['cutlass_tide', 'pistol_tide', 'staff_tide', 'plate_abyss', 'ring_gold', 'book_tide', 'wand_tide'], weights: { fine: 50, rare: 40, relic: 10 } } },
  sentinel: { sig: { item: 'sig_stormcaller', chance: 1 / 300 }, coins: [150, 320], drops: [{ item: 'ore_tide', chance: 0.35 }, { item: 'ore_cinder', chance: 0.25 }, { item: 'crystal_geode', chance: 0.2 }, { item: 'ore_storm', chance: 0.5, qty: [1, 3] }, { item: 'charm_tide', chance: 1, qty: [20, 40] }],
    gear: { chance: 0.35, items: ['helm_tide', 'plate_tide', 'cutlass_tide', 'staff_tide', 'book_tide', 'shield_tide', 'bracelet_gold'], weights: { fine: 50, rare: 40, relic: 10 } } },
  salvage: { coins: [5, 30], drops: [{ item: 'bar_bronze', chance: 0.25 }, { item: 'bar_iron', chance: 0.15 }, { item: 'chain_shot', chance: 0.25, qty: [3, 8] }, { item: 'charm_tide', chance: 0.4, qty: [4, 10] }, { item: 'sea_salt', chance: 0.2, qty: [1, 3] }, { item: 'casket', chance: 0.04 }],
    gear: { chance: 0.05, items: ['cutlass_iron', 'pistol_flintlock', 'ring_brass', 'amulet_brass'], weights: { common: 55, fine: 37, rare: 8 } } },
  geode: { coins: [10, 60], drops: [{ item: 'crystal_geode', chance: 0.4 }, { item: 'charm_tide', chance: 0.5, qty: [3, 10] }, { item: 'ore_gold', chance: 0.15 }, { item: 'shell_fragment', chance: 0.3 }] },
  nest: { coins: [5, 40], drops: [{ item: 'charm_tide', chance: 0.4, qty: [3, 8] }, { item: 'berries', chance: 0.4, qty: [2, 5] }, { item: 'crystal_geode', chance: 0.08 }],
    gear: { chance: 0.05, items: ['ring_brass', 'ring_gold'], weights: { common: 50, fine: 40, rare: 10 } } },
  treasure: { coins: [20, 120], drops: [{ item: 'treasure_map', chance: 0.1 }, { item: 'charm_tide', chance: 0.5, qty: [5, 15] }, { item: 'geode', chance: 0.25 }, { item: 'bar_iron', chance: 0.15 }, { item: 'bar_steel', chance: 0.07 }, { item: 'ore_gold', chance: 0.15 }],
    gear: { chance: 0.08, items: ['ring_brass', 'ring_gold', 'cutlass_steel', 'pistol_steel', 'helm_steel'], weights: { common: 50, fine: 40, rare: 10 } } },
  // a treasure map's chest, hauled up from the deck
  sea_chest: { coins: [150, 450], drops: [{ item: 'casket', chance: 1, qty: [1, 2] }, { item: 'charm_tide', chance: 0.8, qty: [20, 50] }, { item: 'bar_steel', chance: 0.35, qty: [2, 4] },
    { item: 'ore_gold', chance: 0.3, qty: [3, 6] }, { item: 'crystal_geode', chance: 0.2 }, { item: 'bar_storm', chance: 0.12, qty: [1, 3] }, { item: 'treasure_map', chance: 0.15 }] },
  cave_spider: { coins: [3, 12], drops: [{ item: 'spider_silk', chance: 0.45 }, { item: 'charm_tide', chance: 0.3, qty: [3, 6] }], gear: { chance: 0.04, items: ['ring_brass', 'dagger_iron'], weights: { common: 55, fine: 38, rare: 7 } } },
  boar: { coins: [6, 20], drops: [{ item: 'boar_meat_raw', chance: 0.9 }, { item: 'boar_hide', chance: 0.7 }, { item: 'boar_meat_raw', chance: 0.25 }, { item: 'charm_tide', chance: 0.2, qty: [3, 8] }], gear: { chance: 0.04, items: ['cap_leather', 'coat_padded', 'chaps_leather', 'boots_leather', 'gloves_leather'], weights: { common: 55, fine: 38, rare: 7 } } },
  snake: { coins: [8, 25], drops: [{ item: 'snake_skin', chance: 0.55 }, { item: 'charm_tide', chance: 0.35, qty: [4, 9] }], gear: { chance: 0.05, items: ['ring_gold', 'dagger_steel'], weights: { common: 50, fine: 40, rare: 10 } } },
  spider: { sig: { item: 'sig_skypiercer', chance: 1 / 350 }, coins: [30, 70], drops: [{ item: 'spider_silk', chance: 0.8, qty: [1, 3] }, { item: 'crystal_geode', chance: 0.06 }, { item: 'charm_tide', chance: 0.5, qty: [8, 16] }],
    gear: { chance: 0.1, items: ['helm_abyss', 'dagger_abyss', 'ring_gold', 'crossbow_storm'], weights: { common: 48, fine: 38, rare: 14 } } },
  ember: { sig: { item: 'sig_maelstrom', chance: 1 / 350 }, coins: [20, 50], drops: [{ item: 'snake_skin', chance: 0.5 }, { item: 'ore_coal', chance: 0.5, qty: [2, 4] }, { item: 'ore_iron', chance: 0.3, qty: [1, 3] }],
    gear: { chance: 0.1, items: ['cutlass_steel', 'staff_storm', 'plate_steel', 'crossbow_steel'], weights: { common: 45, fine: 40, rare: 13, relic: 2 } } },
  weaver_young: { coins: [12, 30], drops: [{ item: 'spider_silk', chance: 0.6, qty: [1, 2] }, { item: 'charm_tide', chance: 0.4, qty: [5, 10] }], gear: { chance: 0.06, items: ['ring_gold', 'dagger_steel', 'wand_storm'], weights: { common: 50, fine: 38, rare: 12 } } },
  serpent: { sig: { item: 'sig_fang', chance: 1 / 40 }, coins: [150, 300], drops: [{ item: 'sunscale', chance: 1, qty: [1, 3] }, { item: 'snake_skin', chance: 1, qty: [3, 6] }, { item: 'bar_storm', chance: 0.5, qty: [1, 3] }, { item: 'charm_tide', chance: 1, qty: [40, 80] }],
    gear: { chance: 1, items: ['cutlass_storm', 'pistol_storm', 'staff_storm', 'helm_storm', 'plate_storm', 'longbow_amber'], weights: { rare: 65, relic: 35 } } },
  ninefold: { coins: [0, 0], drops: [] },
  greenteeth: { coins: [0, 0], drops: [{ item: 'fen_lockkey', chance: 1 }, { item: 'sword_kelp', chance: 1, qty: [3, 6] }] },
  hushed: { coins: [40, 120], drops: [{ item: 'charm_tide', chance: 0.8, qty: [10, 25] }, { item: 'crystal_geode', chance: 0.2 }] },
  starstruck: { coins: [0, 0], drops: [{ item: 'ore_sky', chance: 1, qty: [2, 3] }] },
  corva: { coins: [600, 1200], drops: [{ item: 'orb_lantern', chance: 1 }, { item: 'casket', chance: 1, qty: [2, 3] }] },
  undertow_hand: { coins: [80, 180], drops: [{ item: 'charm_tide', chance: 0.8, qty: [15, 30] }, { item: 'casket', chance: 0.15 }, { item: 'bar_levi', chance: 0.1 }] },
  lockshell: { coins: [30, 80], drops: [{ item: 'fish_lobster_raw', chance: 0.5, qty: [1, 2] }, { item: 'gem_pearl_rough', chance: 0.12 }, { item: 'ore_levi', chance: 0.1 }] },
  doorwarden: { coins: [1500, 2500], drops: [{ item: 'casket', chance: 1, qty: [3, 4] }, { item: 'bar_ori', chance: 1, qty: [2, 4] }, { item: 'crystal_geode', chance: 1, qty: [3, 5] }] },
  lockjaw: { coins: [40, 110], drops: [{ item: 'logs_star', chance: 0.25 }, { item: 'bar_levi', chance: 0.08 }, { item: 'casket', chance: 0.05 }, { item: 'crystal_geode', chance: 0.15 }],
    gear: { chance: 0.07, items: ['shield_tide', 'helm_tide', 'staff_tide'], weights: { common: 45, fine: 40, rare: 13, relic: 2 } } },
  elder_lockjaw: { coins: [800, 1600], drops: [{ item: 'casket', chance: 1, qty: [2, 3] }, { item: 'bar_ori', chance: 0.6, qty: [1, 3] }, { item: 'logs_star', chance: 1, qty: [4, 8] }, { item: 'crystal_geode', chance: 1, qty: [2, 4] }],
    gear: { chance: 0.35, items: ['shield_tide', 'helm_tide', 'staff_tide', 'cutlass_tide'], weights: { common: 20, fine: 45, rare: 28, relic: 7 } } },
  key_collector: { coins: [400, 800], drops: [{ item: 'casket', chance: 1, qty: [2, 3] }, { item: 'crystal_geode', chance: 1, qty: [2, 3] }] },
  barrow_king: { coins: [150, 300], drops: [{ item: 'bar_storm', chance: 1, qty: [2, 4] }, { item: 'crystal_geode', chance: 0.5 }] },
  douen_elder: { coins: [40, 80], drops: [{ item: 'charm_tide', chance: 1, qty: [10, 20] }] },
  soucouyant: { coins: [30, 60], drops: [{ item: 'charm_tide', chance: 1, qty: [12, 24] }] },
  hornet: { coins: [10, 25], drops: [{ item: 'honeycomb', chance: 0.5 }, { item: 'charm_tide', chance: 0.3, qty: [5, 10] }] },
  bark_beetle: { coins: [8, 20], drops: [{ item: 'chitin', chance: 0.7, qty: [1, 3] }, { item: 'logs_amber', chance: 0.4, qty: [1, 2] }] },
  warg: { coins: [18, 45], drops: [{ item: 'boar_hide', chance: 0.6, qty: [1, 2] }, { item: 'logs_amber', chance: 0.2 }] },
  nokk: { coins: [20, 50], drops: [{ item: 'kelp', chance: 0.6, qty: [2, 4] }, { item: 'fish_salmon_raw', chance: 0.4 }], gear: { chance: 0.04, items: ['ring_gold', 'amulet_gold'], weights: { common: 50, fine: 40, rare: 10 } } },
  moss_troll: { coins: [25, 55], drops: [{ item: 'ore_coal', chance: 0.5, qty: [2, 4] }, { item: 'logs_amber', chance: 0.3 }],
    gear: { chance: 0.08, items: ['helm_storm', 'plate_storm', 'greatsword_storm', 'shield_storm'], weights: { common: 50, fine: 38, rare: 12 } } },
  draugr: { coins: [25, 60], drops: [{ item: 'ore_gold', chance: 0.5, qty: [1, 3] }, { item: 'ore_storm', chance: 0.2 }, { item: 'crystal_geode', chance: 0.06 }],
    gear: { chance: 0.1, items: ['cutlass_storm', 'helm_storm', 'greatsword_storm', 'legs_storm'], weights: { common: 45, fine: 40, rare: 15 } } },
  draugr_troll: { coins: [40, 90], drops: [{ item: 'ore_gold', chance: 0.6, qty: [1, 3] }, { item: 'bar_storm', chance: 0.3 }, { item: 'crystal_geode', chance: 0.08 }] },
  ant: { coins: [2, 6], drops: [{ item: 'resin', chance: 0.6, qty: [1, 2] }, { item: 'chitin', chance: 0.25 }] },
  mantis: { coins: [4, 10], drops: [{ item: 'mantis_blade', chance: 0.45 }, { item: 'chitin', chance: 0.2 }, { item: 'resin', chance: 0.2 }] },
  douen: { coins: [8, 20], drops: [{ item: 'charm_tide', chance: 0.6, qty: [4, 10] }, { item: 'casket', chance: 0.02 }],
    gear: { chance: 0.04, items: ['amulet_brass', 'ring_brass', 'wand_coral'], weights: { common: 55, fine: 38, rare: 7 } } },
  centipede: { coins: [6, 15], drops: [{ item: 'chitin', chance: 0.5, qty: [1, 3] }, { item: 'ore_coal', chance: 0.3 }] },
  shore_beetle: { coins: [1, 3], drops: [{ item: 'chitin', chance: 0.6 }, { item: 'shell_fragment', chance: 0.2 }] },
  gull: { coins: [1, 5], drops: [{ item: 'fish_sprat_raw', chance: 0.5 }, { item: 'charm_tide', chance: 0.2, qty: [2, 4] }] }, // the fish it stole off someone
  spriggan: { coins: [3, 10], drops: [{ item: 'logs_oak', chance: 0.5, qty: [1, 2] }, { item: 'berries', chance: 0.5, qty: [2, 4] }],
    gear: { chance: 0.05, items: ['staff_driftwood', 'wand_driftwood', 'ring_brass'], weights: { common: 55, fine: 37, rare: 8 } } },
  knocker: { coins: [4, 14], drops: [{ item: 'ore_copper', chance: 0.3, qty: [1, 2] }, { item: 'ore_tin', chance: 0.3, qty: [1, 2] }, { item: 'ore_iron', chance: 0.3 }],
    gear: { chance: 0.06, items: ['pickaxe_bronze', 'pickaxe_iron', 'helm_bronze'], weights: { common: 55, fine: 37, rare: 8 } } },
  bog_leech: { coins: [3, 12], drops: [{ item: 'kelp', chance: 0.4, qty: [1, 3] }, { item: 'charm_tide', chance: 0.5, qty: [3, 7] }] },
  haugbui: { coins: [12, 30], drops: [{ item: 'charm_tide', chance: 0.5, qty: [5, 10] }, { item: 'bar_iron', chance: 0.15 }],
    gear: { chance: 0.14, items: ['cutlass_iron', 'helm_iron', 'shield_iron', 'amulet_brass', 'bracelet_brass', 'ring_brass', 'greatsword_iron'], weights: { common: 45, fine: 40, rare: 15 } } }, // grave goods
  knocker_elder: { coins: [20, 40], drops: [{ item: 'ore_iron', chance: 1, qty: [2, 4] }, { item: 'gem_pearl_rough', chance: 0.3 }] },
  wrecker_chief: { coins: [40, 80], drops: [{ item: 'chain_shot', chance: 1, qty: [10, 20] }, { item: 'depth_charge', chance: 0.6, qty: [2, 4] }],
    gear: { chance: 1, items: ['cutlass_iron', 'pistol_iron', 'helm_iron'], weights: { fine: 70, rare: 30 } } },
  crag_troll: { coins: [40, 90], drops: [{ item: 'ore_abyss', chance: 0.3 }, { item: 'ore_coal', chance: 0.5, qty: [2, 4] }, { item: 'crystal_geode', chance: 0.05 }],
    gear: { chance: 0.07, items: ['pike_abyss', 'helm_abyss', 'shield_abyss'], weights: { common: 45, fine: 40, rare: 13, relic: 2 } } },
  sea_draugr: { coins: [50, 110], drops: [{ item: 'charm_tide', chance: 0.6, qty: [12, 24] }, { item: 'sea_salt', chance: 0.4, qty: [2, 4] }, { item: 'ore_tide', chance: 0.15 }],
    gear: { chance: 0.08, items: ['cutlass_tide', 'helm_tide', 'book_storm'], weights: { common: 45, fine: 40, rare: 13, relic: 2 } } },
  cave_bat: { coins: [5, 16], drops: [{ item: 'charm_tide', chance: 0.35, qty: [3, 7] }, { item: 'ore_iron', chance: 0.2 }] },
  ember_bat: { coins: [10, 28], drops: [{ item: 'ore_coal', chance: 0.4, qty: [1, 3] }, { item: 'charm_tide', chance: 0.4, qty: [5, 10] }] },
  oakheart: { coins: [60, 140], drops: [{ item: 'logs_cedar', chance: 0.35 }, { item: 'logs_star', chance: 0.25, qty: [1, 2] }, { item: 'logs_yew', chance: 0.5, qty: [2, 4] }],
    gear: { chance: 0.08, items: ['staff_tide', 'longbow_amber', 'shield_tide'], weights: { common: 45, fine: 40, rare: 13, relic: 2 } } },
  jotunn: { coins: [800, 1600], drops: [{ item: 'bar_sky', chance: 0.6, qty: [2, 4] }, { item: 'ore_levi', chance: 0.5, qty: [2, 4] }, { item: 'crystal_geode', chance: 1, qty: [1, 3] }, { item: 'charm_tide', chance: 1, qty: [100, 200] }],
    gear: { chance: 1, items: ['cutlass_sky', 'helm_sky', 'plate_sky', 'staff_tide', 'greatsword_sky', 'shield_sky'], weights: { rare: 70, relic: 30 } } },
  broodmother: { sig: { item: 'sig_skypiercer', chance: 1 / 30 }, coins: [300, 600], drops: [{ item: 'spider_silk', chance: 1, qty: [6, 12] }, { item: 'bar_storm', chance: 0.6, qty: [2, 4] }, { item: 'crystal_geode', chance: 0.5 }, { item: 'charm_tide', chance: 1, qty: [60, 120] }],
    gear: { chance: 1, items: ['cutlass_abyss', 'pistol_abyss', 'staff_tide', 'helm_abyss', 'plate_abyss', 'longbow_amber'], weights: { rare: 65, relic: 35 } } },
  guardian: { sig: { item: 'sig_bell', chance: 1 / 80 }, coins: [80, 130], drops: [{ item: 'bar_iron', chance: 1, qty: [2, 4] }, { item: 'charm_tide', chance: 1, qty: [20, 40] }],
    gear: { chance: 1, items: ['lockplate', 'cutlass_iron', 'ring_brass', 'pistol_iron'], weights: { rare: 70, relic: 30 } } },
};

/** XP per point of damage, RuneScape rates. */
export const XP_PER_DAMAGE = { style: 4, hitpoints: 4 / 3, magic: 2 };

export const UNLOCKS = buildUnlocks();
