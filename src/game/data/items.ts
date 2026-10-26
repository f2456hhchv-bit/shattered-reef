// Item definitions. Content only: game logic reads these, UI renders them.
import { GEMS } from './drops';

export type SkillId =
  | 'attack' | 'strength' | 'defence' | 'hitpoints' | 'ranged' | 'magic'
  | 'woodcutting' | 'mining' | 'fishing'
  | 'smithing' | 'gunsmithing' | 'fletching' | 'cooking' | 'crafting'
  | 'sailing';
export type CombatStyle = 'melee' | 'ranged' | 'magic';
/** Where an item is worn. Rings fit either ring slot (`ring` / `ring2`); one-handed weapons also fit the off-hand. */
export type Slot = 'weapon' | 'offhand' | 'ammo' | 'head' | 'body' | 'legs' | 'feet' | 'hands' | 'neck' | 'wrist' | 'ring' | 'ring2';
/** What sits in the off-hand when it isn't a second weapon (Tom, 2026-10-25). */
export type OffhandKind = 'shield' | 'orb' | 'book';
/** Weapon families: each plays differently (reach, speed, cleave, shots per attack, which ammo). */
export type WeaponKind = 'cutlass' | 'dagger' | 'pike' | 'greatsword' | 'pistol' | 'shortbow' | 'longbow' | 'crossbow' | 'staff' | 'wand';
/** Two-handed weapons close the off-hand slot. */
export const TWO_HANDED: ReadonlySet<WeaponKind> = new Set(['pike', 'greatsword', 'shortbow', 'longbow', 'crossbow', 'staff']);
/** Which one-handed weapons pair up in the off-hand: blades with blades, pistols with pistols, wands with wands. */
export const PAIR_GROUP: Partial<Record<WeaponKind, string>> = { cutlass: 'blade', dagger: 'blade', pistol: 'pistol', wand: 'wand' };
export type AmmoKind = 'shot' | 'arrow' | 'bolt';
export const AMMO_FOR: Partial<Record<WeaponKind, AmmoKind>> = { pistol: 'shot', shortbow: 'arrow', longbow: 'arrow', crossbow: 'bolt' };
export const AMMO_NAME: Record<AmmoKind, string> = { shot: 'shot', arrow: 'arrows', bolt: 'bolts' };
export type IconShape = 'log' | 'ore' | 'bar' | 'fish' | 'meat' | 'coins' | 'bread' | 'hatchet' | 'pickaxe' | 'rod' | 'cutlass' | 'helm' | 'cap' | 'coat' | 'plate' | 'ring' | 'bell' | 'tooth' | 'shell' | 'burnt' | 'pistol' | 'shot' | 'staff' | 'charm' | 'harpoon' | 'pot' | 'lobster' | 'berries' | 'kelp' | 'geode' | 'spade' | 'parcel' | 'ash' | 'salt' | 'crystal' | 'nest' | 'casket' | 'mug' | 'bowl' | 'pie' | 'dagger' | 'pike' | 'greatsword' | 'bow' | 'crossbow' | 'arrow' | 'bolt' | 'coconut' | 'wand' | 'orb' | 'book' | 'shield' | 'legs' | 'boots' | 'gloves' | 'amulet' | 'bracelet' | 'hide' | 'gem';

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
    kind?: WeaponKind; // weapons: defaults from the style (cutlass / pistol / staff)
    off?: OffhandKind; // off-hand items
    ammo?: AmmoKind; // ammunition: which weapons fire it
    speed?: number; // seconds between attacks
    range?: number; // metres (melee weapons use the default reach)
    bonus: Bonuses;
    affixPool: string[];
  };
  quest?: boolean;
  opens?: string; // using it rolls this loot table (geodes)
  innate?: { id: string; v: number }[]; // traits every copy has (the metal's signature), on top of rolled affixes
  /** a signature weapon's one rule, and what it says about it */
  sig?: { id: SigId; text: string };
}
/** Signature late-game weapons (Tom, 2026-10-25: "unique late weapons like the abyssal whip, but our own"). */
export type SigId = 'lash' | 'jaw' | 'bell' | 'venom' | 'locksmith' | 'ricochet' | 'storm' | 'pierce' | 'maelstrom';

// food descriptions quote health in the game's ×10 scale ("Heals 5." in the data reads "Heals 50.")
const I = (d: ItemDef) => (d.heal ? { ...d, desc: d.desc.replace(/Heals (\d+)/, (_, n) => `Heals ${Number(n) * 10}`) } : d);
/** A weapon's family (older items only say their style). */
export function weaponKind(d: ItemDef | undefined): WeaponKind {
  const e = d?.equip;
  return e?.kind ?? (e?.style === 'ranged' ? 'pistol' : e?.style === 'magic' ? 'staff' : 'cutlass');
}
/** A weapon that can also be held in the off-hand (one-handed and pairable). */
export function pairGroup(d: ItemDef | undefined): string | null {
  return d?.equip?.slot === 'weapon' ? PAIR_GROUP[weaponKind(d)] ?? null : null;
}
export const isTwoHanded = (d: ItemDef | undefined) => !!d?.equip && d.equip.slot === 'weapon' && TWO_HANDED.has(weaponKind(d));
/** Why `off` can't go in the off-hand beside `main` (the main-hand weapon, if any), or null. Shields fit beside any
 * one-handed weapon; orbs and books need a wand; a second weapon has to pair with the first. */
export function offhandBlock(main: ItemDef | undefined, off: ItemDef): string | null {
  if (main && isTwoHanded(main)) return `Your ${main.name.toLowerCase()} takes both hands`;
  const kind = off.equip?.off;
  if (kind === 'shield') return null;
  if (kind === 'orb' || kind === 'book') return main && weaponKind(main) === 'wand' ? null : `${kind === 'orb' ? 'An orb' : 'A book'} goes beside a wand`;
  const g = pairGroup(off);
  if (!g) return 'That doesn\'t fit in the off-hand';
  if (!main) return null;
  return pairGroup(main) === g ? null : `A ${off.name.toLowerCase()} doesn't pair with your ${main.name.toLowerCase()}`;
}
/** Which ammunition an ammo item is (older shot items only say rangedStr). */
export function ammoKind(d: ItemDef | undefined): AmmoKind | null {
  if (!d?.equip || d.equip.slot !== 'ammo') return null;
  return d.equip.ammo ?? 'shot';
}
const MELEE_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'cleave', 'elite_dmg', 'accuracy'];
const RANGED_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'elite_dmg', 'accuracy', 'leech'];
const ARMOUR_AFFIX = ['max_hp', 'armour', 'regen'];
const JEWEL_AFFIX = ['gather_speed', 'xp_bonus', 'crit', 'max_hp', 'dmg_pct', 'accuracy', 'regen'];
const MAGIC_AFFIX = ['dmg_pct', 'crit', 'elite_dmg', 'accuracy', 'leech'];


// ---- tiers: generated so every metal, wood and fish follows one rule set --------------------------
/** Metals, low to high. `m` indexes the gear stat tables below. Existing early ids are kept for saves.
 * Levels follow RuneScape (Tom, 2026-10-24): gear like bronze/iron 1, steel 5, black 10, mithril 20, adamant 30,
 * rune 40, then 50/60/70 for the high metals (dragon 60, barrows 70); axes and pickaxes 1/1/6/11/21/31/41/51/61/71. */
export const METALS = [
  { key: 'bronze', name: 'Bronze', color: '#c08a4a', req: 1, toolReq: 1 },
  { key: 'iron', name: 'Iron', color: '#9aa0a4', req: 1, toolReq: 1 },
  { key: 'steel', name: 'Steel', color: '#b9c4cc', req: 5, toolReq: 6 },
  { key: 'storm', name: 'Stormsilver', color: '#86b6dc', req: 10, toolReq: 11 },
  { key: 'abyss', name: 'Abyssite', color: '#3f7a66', req: 20, toolReq: 21 },
  { key: 'tide', name: 'Tidecore', color: '#3cc6c4', req: 30, toolReq: 31 },
  { key: 'cinder', name: 'Cinderite', color: '#b8452a', req: 40, toolReq: 41 },
  { key: 'sky', name: 'Skyglass', color: '#8a7ae0', req: 50, toolReq: 51 },
  { key: 'levi', name: 'Leviathite', color: '#d8cdb4', req: 60, toolReq: 61 },
  { key: 'ori', name: 'Orichalcum', color: '#e0a33a', req: 70, toolReq: 71 },
] as const;
const CUT = { acc: [9, 14, 21, 30, 40, 52, 64, 77, 90, 104], str: [8, 13, 20, 29, 39, 51, 63, 76, 89, 103] };
const HELM = [5, 8, 12, 17, 23, 30, 37, 45, 53, 62];
const PLATE = [14, 21, 32, 46, 62, 80, 98, 118, 140, 164];
/** A full suit is spread over six pieces (Tom, 2026-10-25: legs, boots, gloves, shield joined helm and plate). The
 * five worn pieces add up to what helm + plate gave before, so a fully dressed fighter is where they were; a shield
 * is the extra that dual-wielders give up. Each piece: share of HELM or PLATE, and its magic penalty. */
const SUIT: Record<'helm' | 'plate' | 'legs' | 'boots' | 'gloves' | 'shield', { of: 'helm' | 'plate'; k: number; mag: (m: number) => number }> = {
  helm: { of: 'helm', k: 0.65, mag: (m) => -Math.round((1 + m) * 0.6) },
  plate: { of: 'plate', k: 0.6, mag: (m) => -Math.round((3 + 2 * m) * 0.6) },
  legs: { of: 'plate', k: 0.32, mag: (m) => -Math.round((2 + m) * 0.4) },
  boots: { of: 'helm', k: 0.22, mag: () => 0 },
  gloves: { of: 'helm', k: 0.22, mag: () => 0 },
  shield: { of: 'plate', k: 0.28, mag: (m) => -Math.round((1 + m) * 0.5) },
};
const suitDef = (piece: keyof typeof SUIT, m: number) => {
  const p = SUIT[piece], base = (p.of === 'helm' ? HELM : PLATE)[m] * p.k;
  return { defMelee: Math.max(1, Math.round(base)), defRanged: Math.max(1, Math.round(base * 0.85)), defMagic: p.mag(m) };
};
const SHOT_STR = [7, 13, 20, 28, 37, 47, 57, 68, 80, 92];
const PISTOL = { acc: [10, 22, 32, 44, 58, 72, 86, 100, 115, 130], req: [1, 6, 16, 21, 26, 36, 46, 56, 61, 70], range: [9, 10, 10, 11, 11, 12, 12, 13, 13, 14] };
const BOW_REQ = [1, 5, 20, 30, 40, 50, 60], BOW_ACC = [8, 18, 28, 40, 56, 76, 98];
const BAR_VALUE = [18, 40, 70, 140, 280, 560, 900, 1400, 2200, 3400];
/**
 * Each metal has a signature trait, so a higher tier is a choice as well as an upgrade: weapons (and pistols)
 * get the first, armour the second, tools gather faster from Stormsilver up. Values use the affix scale.
 */
export const METAL_TRAITS: Record<string, { weapon: { id: string; v: number }[]; armour: { id: string; v: number }[]; blurb: string }> = {
  steel: { weapon: [{ id: 'durable', v: 40 }], armour: [{ id: 'durable', v: 40 }], blurb: 'Tough: wears 40% slower' },
  storm: { weapon: [{ id: 'atk_speed', v: 6 }], armour: [{ id: 'atk_speed', v: 2 }], blurb: 'Crackling: strikes come faster' },
  abyss: { weapon: [{ id: 'leech', v: 4 }], armour: [{ id: 'regen', v: 1 }], blurb: 'Thirsting: heals the wielder' },
  tide: { weapon: [{ id: 'sea_dmg', v: 15 }], armour: [{ id: 'max_hp', v: 3 }], blurb: 'Sea-bane: bites harder into crabs and the Drowned' },
  cinder: { weapon: [{ id: 'crit', v: 5 }], armour: [{ id: 'armour', v: 4 }], blurb: 'Smouldering: blows land at full force more often' },
  sky: { weapon: [{ id: 'accuracy', v: 12 }], armour: [{ id: 'xp_bonus', v: 2 }], blurb: 'Starlit: rarely misses' },
  levi: { weapon: [{ id: 'dmg_pct', v: 6 }], armour: [{ id: 'max_hp', v: 6 }], blurb: 'Leviathan-bone: heavy and unbreakable' },
  ori: { weapon: [{ id: 'dmg_pct', v: 5 }, { id: 'atk_speed', v: 5 }], armour: [{ id: 'armour', v: 6 }, { id: 'max_hp', v: 4 }], blurb: 'Sunken gold: the best of everything' },
};
const toolTrait = (m: number) => (m >= 3 ? [{ id: 'gather_speed', v: (m - 2) * 2 }] : undefined);

export const WOODS = [
  { key: 'pine', name: 'Saltpine', color: '#8a6440', accent: '#d6b07a', value: 4 },
  { key: 'oak', name: 'Sea-oak', color: '#6b4a30', accent: '#c49a64', value: 10 },
  { key: 'willow', name: 'Mire willow', color: '#7d7448', accent: '#cfc28a', value: 18 },
  { key: 'amber', name: 'Amberwood', color: '#9a5a32', accent: '#eaa250', value: 32 },
  { key: 'yew', name: 'Ghost yew', color: '#5a4a34', accent: '#d8d2b8', value: 60 },
  { key: 'star', name: 'Starbark', color: '#46486a', accent: '#b8c6ff', value: 110 },
  { key: 'cedar', name: 'Leviathan cedar', color: '#7a3424', accent: '#e8805a', value: 200 },
] as const;

export const FISH = [
  { key: 'sprat', name: 'reef sprat', cooked: 'Grilled sprat', raw: '#9fb7bf', done: '#c9934f', heal: 3, value: 3 },
  { key: 'bell', name: 'bellfish', cooked: 'Seared bellfish', raw: '#6f9fbf', done: '#b77a3e', heal: 8, value: 14 },
  { key: 'trout', name: 'lagoon trout', cooked: 'Smoked trout', raw: '#8aa86a', done: '#b8834a', heal: 8, value: 12 },
  { key: 'salmon', name: 'fen salmon', cooked: 'Baked salmon', raw: '#d88a6a', done: '#c0603a', heal: 10, value: 20 },
  { key: 'lobster', name: 'cove lobster', cooked: 'Boiled lobster', raw: '#3a5a7a', done: '#d8442a', heal: 12, value: 34 },
  { key: 'sword', name: 'swordfish', cooked: 'Grilled swordfish', raw: '#5a7aa0', done: '#a8703a', heal: 14, value: 50 },
  { key: 'gloom', name: 'gloomfish', cooked: 'Charred gloomfish', raw: '#4a4a5a', done: '#7a5a4a', heal: 16, value: 70 },
  { key: 'shark', name: 'shark', cooked: 'Shark steak', raw: '#7a8a96', done: '#a87a5a', heal: 20, value: 110 },
  { key: 'angler', name: 'abyssal angler', cooked: 'Roast angler', raw: '#2a3a4a', done: '#8a5a3a', heal: 22, value: 140 },
  // second catches at existing spots (a spot holds several fish, each at its own level)
  { key: 'mackerel', name: 'mackerel', cooked: 'Grilled mackerel', raw: '#4f8a7a', done: '#b8834a', heal: 6, value: 8 },
  { key: 'bass', name: 'sea bass', cooked: 'Pan-fried bass', raw: '#7a8a80', done: '#c08a4a', heal: 9, value: 18 },
  { key: 'tuna', name: 'tuna', cooked: 'Seared tuna', raw: '#2e4a78', done: '#a85a3a', heal: 13, value: 42 },
  { key: 'barracuda', name: 'barracuda', cooked: 'Smoked barracuda', raw: '#8a9aa8', done: '#9a6a40', heal: 18, value: 85 },
] as const;

const ORES = [
  { id: 'ore_coal', name: 'Coal', desc: 'Black, crumbly, burns long. Smelting stronger metals needs it.', accent: '#1d1d1f', value: 22 },
  { id: 'ore_gold', name: 'Gold ore', desc: 'Soft and bright.', accent: '#e3c25e', value: 40 },
  { id: 'ore_storm', name: 'Stormsilver ore', desc: 'Crackles faintly when you hold it.', accent: '#8fc0e8', value: 70 },
  { id: 'ore_abyss', name: 'Abyssite ore', desc: 'Green-black, cold as deep water.', accent: '#3f8f6e', value: 120 },
  { id: 'ore_tide', name: 'Tidecore ore', desc: 'It pulls toward the sea like a compass needle.', accent: '#3fd8d0', value: 220 },
  { id: 'ore_cinder', name: 'Cinderite ore', desc: 'Still warm from the vent. Only volcanic heat will melt it.', accent: '#e0582a', value: 340 },
  { id: 'ore_sky', name: 'Skyglass ore', desc: 'A shard of the fallen star. It hums when you hold it to the sky.', accent: '#a99aff', value: 520 },
  { id: 'ore_levi', name: 'Leviathite', desc: 'Bone turned to metal over a thousand years on the seabed.', accent: '#efe6cf', value: 800 },
  { id: 'ore_ori', name: 'Orichalcum ore', desc: 'Sunken gold from the drowned spire. It never tarnishes.', accent: '#f2b84a', value: 1200 },
];

function tierItems(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const o of ORES) out.push(I({ id: o.id, name: o.name, desc: o.desc, icon: { shape: 'ore', color: '#55524f', accent: o.accent }, stackable: true, value: o.value }));
  // fluxes: the higher metals need something from another skill
  out.push(I({ id: 'kelp_ash', name: 'Kelp ash', desc: 'Burnt kelp. Smiths use it as flux for Abyssite.', icon: { shape: 'ash', color: '#6a6a5a', accent: '#a8a890' }, stackable: true, value: 12 }));
  out.push(I({ id: 'sea_salt', name: 'Sea salt', desc: 'Scraped from the salt pans. Tidecore and Leviathite need it to smelt clean.', icon: { shape: 'salt', color: '#efeae0' }, stackable: true, value: 15 }));
  out.push(I({ id: 'crystal_geode', name: 'Geode crystal', desc: 'A clear crystal from a cracked geode. Skyglass and Orichalcum will not smelt without one.', icon: { shape: 'crystal', color: '#9fe8ff' }, stackable: true, value: 120 }));
  // rare finds from the gathering perks
  out.push(I({ id: 'bird_nest', name: 'Bird\'s nest', desc: 'Knocked from the branches. Something glints inside. Tap it and Search.', icon: { shape: 'nest', color: '#7a5a34', accent: '#e9e3d0' }, stackable: true, value: 30, opens: 'nest' }));
  out.push(I({ id: 'casket', name: 'Sunken casket', desc: 'Barnacled and locked with rust. Tap it and Prise open.', icon: { shape: 'casket', color: '#5a4030', accent: '#c9a050' }, stackable: true, value: 60, opens: 'treasure' }));
  out.push(I({ id: 'bar_gold', name: 'Gold bar', desc: 'Too soft for blades. Perfect for rings.', icon: { shape: 'bar', color: '#e3c25e' }, stackable: true, value: 90 }));
  out.push(I({ id: 'ring_gold', name: 'Gold signet', desc: 'Smith-made. Gold takes enchantment well.', icon: { shape: 'ring', color: '#e3c25e', accent: '#d8442a' }, stackable: false, value: 160,
    equip: { slot: 'ring', reqs: { defence: 1 }, bonus: { acc: 2, defMelee: 1, defRanged: 1, defMagic: 2 }, affixPool: JEWEL_AFFIX } }));
  METALS.forEach((mt, m) => {
    const col = mt.color, nm = mt.name, tr = METAL_TRAITS[mt.key];
    const wTrait = tr?.weapon, aTrait = tr?.armour, tTrait = toolTrait(m);
    if (m >= 2) out.push(I({ id: `bar_${mt.key}`, name: `${nm} bar`, desc: `A bar of ${nm.toLowerCase()}.`, icon: { shape: 'bar', color: col }, stackable: true, value: BAR_VALUE[m] }));
    if (m >= 2) {
      out.push(I({ id: `hatchet_${mt.key}`, name: `${nm} hatchet`, desc: 'A better edge fells trees faster.', icon: { shape: 'hatchet', color: col }, stackable: false, value: BAR_VALUE[m] * 2, tool: { skill: 'woodcutting', power: m + 1, level: mt.toolReq }, innate: tTrait }));
      out.push(I({ id: `pickaxe_${mt.key}`, name: `${nm} pickaxe`, desc: 'A harder point bites harder rock.', icon: { shape: 'pickaxe', color: col }, stackable: false, value: BAR_VALUE[m] * 2, tool: { skill: 'mining', power: m + 1, level: mt.toolReq }, innate: tTrait }));
      out.push(I({ id: `cutlass_${mt.key}`, name: `${nm} cutlass`, desc: `A ${nm.toLowerCase()} blade, balanced for boarding fights.`, icon: { shape: 'cutlass', color: col }, stackable: false, value: BAR_VALUE[m] * 3,
        equip: { slot: 'weapon', reqs: { attack: mt.req }, style: 'melee', speed: 2.4, bonus: { acc: CUT.acc[m], str: CUT.str[m] }, affixPool: [...MELEE_AFFIX, 'leech'] }, innate: wTrait }));
      out.push(I({ id: `shot_${mt.key}`, name: `${nm} shot`, desc: 'Pistol balls. Equip in the ammo slot.', icon: { shape: 'shot', color: col }, stackable: true, value: Math.ceil(BAR_VALUE[m] / 12),
        equip: { slot: 'ammo', reqs: { ranged: mt.req }, bonus: { rangedStr: SHOT_STR[m] }, affixPool: [] } }));
      out.push(I({ id: `pistol_${mt.key}`, name: `${nm} pistol`, desc: 'Fires shot from your ammo slot.', icon: { shape: 'pistol', color: '#5a3e28', accent: col }, stackable: false, value: BAR_VALUE[m] * 3,
        equip: { slot: 'weapon', reqs: { ranged: PISTOL.req[m] }, style: 'ranged', speed: 2.4, range: PISTOL.range[m], bonus: { acc: PISTOL.acc[m] }, affixPool: RANGED_AFFIX }, innate: wTrait }));
    }
    // the rest of the armoury, every metal: daggers, boarding pikes, greatswords, pistol braces, crossbows, arrows, bolts
    const melee = (kind: WeaponKind, name: string, desc: string, speed: number, accMul: number, strMul: number, range: number | undefined, reqs: Partial<Record<SkillId, number>>, valueMul: number) =>
      out.push(I({ id: `${kind}_${mt.key}`, name: `${nm} ${name}`, desc, icon: { shape: kind as IconShape, color: col }, stackable: false, value: BAR_VALUE[m] * valueMul,
        equip: { slot: 'weapon', reqs, style: 'melee', kind, speed, range, bonus: { acc: Math.round(CUT.acc[m] * accMul), str: Math.round(CUT.str[m] * strMul) }, affixPool: [...MELEE_AFFIX, 'leech'] }, innate: wTrait }));
    melee('dagger', 'dagger', 'Quick and sure: stabs land often, but light.', 1.8, 1.15, 0.65, 1.4, { attack: mt.req }, 1);
    melee('pike', 'boarding pike', 'Long reach: strikes from further off and runs through whatever stands behind.', 3.0, 0.95, 1.1, 2.8, { attack: mt.req }, 2.5);
    melee('greatsword', 'greatsword', 'Two hands, slow and brutal: every swing cleaves the crowd around your target.', 3.6, 0.9, 1.55, 1.9, { attack: mt.req, strength: mt.req }, 4);
    out.push(I({ id: `crossbow_${mt.key}`, name: `${nm} crossbow`, desc: 'Slow to wind, rarely misses. Fires bolts.', icon: { shape: 'crossbow', color: '#6a4a30', accent: col }, stackable: false, value: BAR_VALUE[m] * 3,
      equip: { slot: 'weapon', reqs: { ranged: mt.req }, style: 'ranged', kind: 'crossbow', speed: 3.0, range: 11 + Math.floor(m / 3), bonus: { acc: Math.round(PISTOL.acc[m] * 1.2) }, affixPool: RANGED_AFFIX }, innate: wTrait }));
    out.push(I({ id: `arrow_${mt.key}`, name: `${nm} arrows`, desc: 'For shortbows and longbows. Equip in the ammo slot.', icon: { shape: 'arrow', color: col, accent: '#e9e3d0' }, stackable: true, value: Math.max(1, Math.ceil(BAR_VALUE[m] / 15)),
      equip: { slot: 'ammo', ammo: 'arrow', reqs: { ranged: mt.req }, bonus: { rangedStr: Math.round(SHOT_STR[m] * 0.85) }, affixPool: [] } }));
    out.push(I({ id: `bolt_${mt.key}`, name: `${nm} bolts`, desc: 'Short, heavy crossbow bolts. Equip in the ammo slot.', icon: { shape: 'bolt', color: col }, stackable: true, value: Math.max(1, Math.ceil(BAR_VALUE[m] / 11)),
      equip: { slot: 'ammo', ammo: 'bolt', reqs: { ranged: mt.req }, bonus: { rangedStr: Math.round(SHOT_STR[m] * 1.15) }, affixPool: [] } }));
    // a full suit: helm, plate, legs, boots, gauntlets and a shield (gauntlets steady the aim a little)
    const armour = (piece: keyof typeof SUIT, slot: Slot, shape: IconShape, name: string, desc: string, valueMul: number, extra: Bonuses = {}, off?: OffhandKind) =>
      out.push(I({ id: `${piece}_${mt.key}`, name: `${nm} ${name}`, desc, icon: { shape, color: col }, stackable: false, value: BAR_VALUE[m] * valueMul,
        equip: { slot, off, reqs: { defence: mt.req }, bonus: { ...suitDef(piece, m), ...extra }, affixPool: ARMOUR_AFFIX }, innate: aTrait }));
    armour('helm', 'head', 'helm', 'helm', 'Good against blades, poor against spells.', 2);
    armour('plate', 'body', 'plate', 'plate', 'Heavy chest armour. Spells find the gaps.', 5);
    armour('legs', 'legs', 'legs', 'platelegs', 'Plated legs. Heavy, but nothing gets past them.', 3);
    armour('boots', 'feet', 'boots', 'boots', 'Iron-shod boots. Steady footing on a wet deck.', 1);
    armour('gloves', 'hands', 'gloves', 'gauntlets', 'Plated gloves. A steadier grip: a little more accurate.', 1, { acc: 1 + Math.round(m * 0.6) });
    armour('shield', 'offhand', 'shield', 'shield', 'Off-hand. Turns blows; fits beside any one-handed weapon: a blade, a pistol or a wand.', 2, {}, 'shield');
  });
  // bows: one shortbow and one longbow per wood (Fletching), firing arrows
  WOODS.forEach((w, t) => {
    out.push(I({ id: `shortbow_${w.key}`, name: `${w.name} shortbow`, desc: 'Quick to draw: arrows come fast. Fires arrows from your ammo slot.', icon: { shape: 'bow', color: w.color, accent: w.accent }, stackable: false, value: w.value * 6 + 10,
      equip: { slot: 'weapon', reqs: { ranged: BOW_REQ[t] }, style: 'ranged', kind: 'shortbow', speed: 1.8, range: 9 + Math.floor(t / 2), bonus: { acc: BOW_ACC[t] }, affixPool: RANGED_AFFIX } }));
    out.push(I({ id: `longbow_${w.key}`, name: `${w.name} longbow`, desc: 'Slow, sure and far: out-ranges anything that shoots back. Fires arrows.', icon: { shape: 'bow', color: w.color, accent: w.accent }, stackable: false, value: w.value * 9 + 15,
      equip: { slot: 'weapon', reqs: { ranged: BOW_REQ[t] }, style: 'ranged', kind: 'longbow', speed: 3.0, range: 13 + Math.floor(t / 2), bonus: { acc: Math.round(BOW_ACC[t] * 1.3) }, affixPool: RANGED_AFFIX } }));
  });
  WOODS.forEach((w, t) => { if (t >= 2) out.push(I({ id: `logs_${w.key}`, name: `${w.name} logs`, desc: 'Prized by smiths for hafts and stocks.', icon: { shape: 'log', color: w.color, accent: w.accent }, stackable: true, value: w.value })); });
  FISH.forEach((f, t) => {
    if (t < 2) return;
    const shape = f.key === 'lobster' ? 'lobster' : 'fish';
    out.push(I({ id: `fish_${f.key}_raw`, name: `Raw ${f.name}`, desc: 'Needs cooking.', icon: { shape, color: f.raw }, stackable: true, value: f.value }));
    out.push(I({ id: `fish_${f.key}`, name: f.cooked, desc: `Heals ${f.heal}.`, icon: { shape, color: f.done }, stackable: true, value: Math.round(f.value * 1.8), heal: f.heal }));
  });
  // fishing tools and magic staffs
  out.push(I({ id: 'lobster_pot', name: 'Lobster pot', desc: 'Wicker and twine. Lobsters walk in; they rarely walk out.', icon: { shape: 'pot', color: '#a8865a' }, stackable: false, value: 25, tool: { skill: 'fishing', power: 0, level: 1 } }));
  // Bellwether's quest rewards and the Storm Tide (docs/ISLANDS.md, slice 1)
  out.push(I({ id: 'sealskin', name: 'Sealskin', desc: 'Soft as a pelt can be, and cold, and smelling of the sea. It isn\'t yours.', icon: { shape: 'hide', color: '#6a6e72', accent: '#3a3e42' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'knockers_lamp', name: 'Knocker\'s lamp', desc: 'Old Pellow\'s miner\'s lamp. The knockers know its light and show you the good seams.', icon: { shape: 'amulet', color: '#c9a050', accent: '#ffd35a' }, stackable: false, value: 150,
    equip: { slot: 'neck', reqs: {}, bonus: { defMelee: 1, defRanged: 1, defMagic: 1 }, affixPool: JEWEL_AFFIX }, innate: [{ id: 'gather_speed', v: 4 }] }));
  out.push(I({ id: 'ring_selkie', name: 'Selkie\'s pearl ring', desc: 'A pearl from under the sea, on a band of silver. Fish come to whoever wears it.', icon: { shape: 'ring', color: '#cfd5d8', accent: '#efe6dc' }, stackable: false, value: 300,
    equip: { slot: 'ring', reqs: {}, bonus: { defMagic: 2 }, affixPool: JEWEL_AFFIX }, innate: [{ id: 'gather_speed', v: 3 }, { id: 'xp_bonus', v: 2 }] }));
  out.push(I({ id: 'cloak_selkie', name: 'Sealskin cloak', desc: 'Made from a selkie\'s skin. Warm as a seal in winter, and spells slide off it like water.', icon: { shape: 'coat', color: '#6a6e72', accent: '#3a3e42' }, stackable: false, value: 400,
    equip: { slot: 'body', reqs: { defence: 10 }, bonus: { defMelee: 6, defRanged: 8, defMagic: 14 }, affixPool: ARMOUR_AFFIX }, innate: [{ id: 'regen', v: 1 }] }));
  // Amberhold's quest rewards (slice 3)
  out.push(I({ id: 'helm_barrow', name: 'Barrow King\'s helm', desc: 'A grave-king\'s helm, rimed with barrow frost. Blows slide off it.', icon: { shape: 'helm', color: '#8a9aa0', accent: '#c9a050' }, stackable: false, value: 1500,
    equip: { slot: 'head', reqs: { defence: 40 }, bonus: { defMelee: 32, defRanged: 30, defMagic: 12, str: 3 }, affixPool: ARMOUR_AFFIX } }));
  out.push(I({ id: 'nokk_bridle', name: 'Nøkk\'s bridle', desc: 'Woven of river-weed and silver wire, always wet. Ingrid will know what to do with it.', icon: { shape: 'amulet', color: '#3a6a5a', accent: '#cfd5d8' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'toll_ledger', name: 'Toll ledger', desc: 'Tollhouse\'s ledger, heavy with seals. For Sefa Odun at Port Halyard.', icon: { shape: 'book', color: '#5a3a24', accent: '#c9a050' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'toll_receipt', name: 'Sealed receipt', desc: 'Port Halyard\'s seal on the toll ledger. For Halvard at Tollhouse.', icon: { shape: 'parcel', color: '#e6dcc0', accent: '#a83a2a' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'amber_haul', name: 'Poachers\' haul', desc: 'Sacks of uncut amber, knotted the poachers\' way. For Tamsin at Port Halyard.', icon: { shape: 'parcel', color: '#8a6a3a', accent: '#e8902a' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'poachers_silver', name: 'Pouch of silver', desc: 'Tamsin\'s payment for the haul. For Ulla on the headland.', icon: { shape: 'coins', color: '#cfd5d8' }, stackable: false, value: 0, quest: true }));
  out.push(I({ id: 'ring_toll', name: 'Toll-keeper\'s seal', desc: 'Tollhouse\'s seal in gold. Traders look twice at it, and charge you less.', icon: { shape: 'ring', color: '#e3c25e', accent: '#5a3a24' }, stackable: false, value: 400,
    equip: { slot: 'ring', reqs: {}, bonus: { acc: 3, defMelee: 2, defRanged: 2, defMagic: 2 }, affixPool: JEWEL_AFFIX } }));
  // Amberhold's hives (slice 3): the hornets carry comb back from the amberwood
  out.push(I({ id: 'honeycomb', name: 'Amber honeycomb', desc: 'Dark amber honey in the comb, from the hornets of the amberwood. Heals 100.', icon: { shape: 'gem', color: '#e8a83a', accent: '#f8d86a' }, stackable: true, value: 40, heal: 10 }));
  // Sunreach's quest rewards (docs/ISLANDS.md, slice 2)
  out.push(I({ id: 'hat_douen', name: 'Douen\'s straw hat', desc: 'A wide straw hat from the Greenheart glade. Whoever wears it walks the jungle like they were born there.', icon: { shape: 'cap', color: '#d8c07a', accent: '#5a4a2a' }, stackable: false, value: 300,
    equip: { slot: 'head', reqs: {}, bonus: { defMelee: 3, defRanged: 3, defMagic: 3 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] }, innate: [{ id: 'gather_speed', v: 4 }] }));
  out.push(I({ id: 'storm_herring_raw', name: 'Raw storm herring', desc: 'Silver herring the storm drives up to the quay. Fire them at the serpent, or cook them first: cooked ones hit twice as hard.', icon: { shape: 'fish', color: '#9ab8c8' }, stackable: true, value: 1 }));
  out.push(I({ id: 'storm_herring', name: 'Smoked storm herring', desc: 'Hot from the quay fire. Heals 4, or loads the quay cannon for a double blow.', icon: { shape: 'fish', color: '#b8885a' }, stackable: true, value: 3, heal: 4 }));
  // the storm outfit: oilskins for the Storm Tide; every piece makes fishing a little surer
  const oil = (id: string, name: string, slot: Slot, shape: IconShape, dm: number, dg: number) =>
    out.push(I({ id, name, desc: 'Oilskin from the Storm Tide\'s reward chest. Every piece of the set makes fishing a little surer.', icon: { shape, color: '#d8b83a', accent: '#3a3428' }, stackable: false, value: 120,
      equip: { slot, reqs: {}, bonus: { defMelee: dm, defRanged: dm, defMagic: dg }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] }, innate: [{ id: 'gather_speed', v: 2 }] }));
  oil('oilskin_hat', 'Sou\'wester', 'head', 'cap', 2, 2); oil('oilskin_coat', 'Oilskin coat', 'body', 'coat', 4, 3);
  oil('oilskin_legs', 'Oilskin trousers', 'legs', 'legs', 3, 2); oil('sea_boots', 'Sea boots', 'feet', 'boots', 2, 1);
  // the Greenheart Fire (Sunreach's skilling boss): bamboo, buckets, and the fire wardens' outfit
  out.push(I({ id: 'bamboo', name: 'Bamboo', desc: 'A length of green bamboo from the fire camp. Two lash into a bucket at the camp bench.', icon: { shape: 'log', color: '#9ab85a', accent: '#d8e89a' }, stackable: true, value: 0, quest: true }));
  out.push(I({ id: 'bucket_bamboo', name: 'Bamboo bucket', desc: 'Empty. Fill it at the stream below the grove.', icon: { shape: 'pot', color: '#9ab85a', accent: '#6a8a3a' }, stackable: true, value: 0, quest: true }));
  out.push(I({ id: 'bucket_water', name: 'Bucket of water', desc: 'Full to the brim. Throw it on a burning thicket.', icon: { shape: 'pot', color: '#9ab85a', accent: '#4fa7c2' }, stackable: true, value: 0, quest: true }));
  const warden = (id: string, name: string, slot: Slot, shape: IconShape, dm: number, dg: number) =>
    out.push(I({ id, name, desc: 'From the Greenheart fire camp. Every piece of the set makes cutting and gathering a little quicker.', icon: { shape, color: '#7a5a2a', accent: '#d8902a' }, stackable: false, value: 120,
      equip: { slot, reqs: {}, bonus: { defMelee: dm, defRanged: dm, defMagic: dg }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] }, innate: [{ id: 'gather_speed', v: 2 }] }));
  warden('warden_hat', 'Fire warden\'s hat', 'head', 'cap', 2, 2); warden('warden_coat', 'Fire warden\'s coat', 'body', 'coat', 4, 3);
  warden('warden_legs', 'Fire warden\'s trousers', 'legs', 'legs', 3, 2); warden('warden_boots', 'Fire warden\'s boots', 'feet', 'boots', 2, 1);
  // the Amber Seep (Amberhold's skilling boss): amber, braces, and the prospectors' outfit
  out.push(I({ id: 'raw_amber', name: 'Raw amber', desc: 'A lump of amber from the seep, warm to the touch. Tip it in the cart, or set it in a brace.', icon: { shape: 'gem', color: '#e8902a', accent: '#f8c86a' }, stackable: true, value: 0, quest: true }));
  out.push(I({ id: 'amber_brace', name: 'Amber brace', desc: 'A log bound with amber, hard as iron. Hammer it into a groaning support.', icon: { shape: 'log', color: '#8a5a2a', accent: '#e8902a' }, stackable: true, value: 0, quest: true }));
  const prospector = (id: string, name: string, slot: Slot, shape: IconShape, dm: number, dg: number) =>
    out.push(I({ id, name, desc: 'From the Amber Seep\'s cart. Every piece of the set makes mining and gathering a little quicker.', icon: { shape, color: '#6a5a3a', accent: '#e8902a' }, stackable: false, value: 120,
      equip: { slot, reqs: {}, bonus: { defMelee: dm, defRanged: dm, defMagic: dg }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] }, innate: [{ id: 'gather_speed', v: 2 }] }));
  prospector('prospector_hat', 'Prospector\'s helmet', 'head', 'helm', 3, 2); prospector('prospector_coat', 'Prospector\'s jacket', 'body', 'coat', 5, 3);
  prospector('prospector_legs', 'Prospector\'s trousers', 'legs', 'legs', 4, 2); prospector('prospector_boots', 'Prospector\'s boots', 'feet', 'boots', 2, 1);
  // sea gear (Sailing): ship's ammunition, the salvage hook, and what the sea gives back
  out.push(I({ id: 'chain_shot', name: 'Chain shot', desc: 'Two balls on a chain. Shreds sails and whole flocks of gulls. Load it at sea (Sailing 5).', icon: { shape: 'shot', color: '#8a8a95', accent: '#5a5a62' }, stackable: true, value: 3 }));
  out.push(I({ id: 'fire_barrel', name: 'Fire barrel', desc: 'A cask of resin and pitch with a lit fuse. Sets wooden ships ablaze. Fire it from your broadside (Sailing 20).', icon: { shape: 'pot', color: '#6a4a2a', accent: '#e8702a' }, stackable: true, value: 18 }));
  out.push(I({ id: 'depth_charge', name: 'Depth charge', desc: 'A powder keg with a fuse. Roll it over the stern; it finds what swims under you (Sailing 10).', icon: { shape: 'pot', color: '#3a3028', accent: '#c84a2a' }, stackable: true, value: 12 }));
  out.push(I({ id: 'salvage_hook', name: 'Salvage hook', desc: 'A grapnel on a long line. Drags what\'s worth having off a wreck, from the deck.', icon: { shape: 'harpoon', color: '#6a6e72', accent: '#8a5a34' }, stackable: false, value: 40, tool: { skill: 'sailing', power: 0, level: 1 } }));
  out.push(I({ id: 'shark_tooth', name: 'Shark tooth', desc: 'Serrated and white. Strung on leather it makes a lucky charm.', icon: { shape: 'tooth', color: '#efe8d8' }, stackable: true, value: 10 }));
  out.push(I({ id: 'amulet_sharktooth', name: 'Sharktooth necklace', desc: 'Shark teeth on a thong. Sailors swear by them.', icon: { shape: 'amulet', color: '#8a5a34', accent: '#efe8d8' }, stackable: false, value: 120,
    equip: { slot: 'neck', reqs: {}, bonus: { acc: 3, str: 4, defMelee: 1, defRanged: 1, defMagic: 1 }, affixPool: JEWEL_AFFIX } }));
  out.push(I({ id: 'harpoon', name: 'Harpoon', desc: 'For fish that fight back.', icon: { shape: 'harpoon', color: '#9aa0a4' }, stackable: false, value: 60, tool: { skill: 'fishing', power: 0, level: 1 } }));
  const STAFFS: [string, string, number, number, number, string][] = [
    ['staff_coral', 'Coral staff', 20, 14, 5, '#e07a6a'], ['staff_storm', 'Stormsilver staff', 40, 22, 10, '#86b6dc'], ['staff_tide', 'Tidecore staff', 60, 32, 15, '#3cc6c4'],
  ];
  // the living island: foraging, treasure
  out.push(I({ id: 'berries', name: 'Bramble berries', desc: 'Heals 2. Sharp, sweet, slightly squashed.', icon: { shape: 'berries', color: '#7a2a5a', accent: '#3e7a3a' }, stackable: true, value: 2, heal: 2 }));
  out.push(I({ id: 'coconut', name: 'Coconut', desc: 'Heals 5. Crack it on a rock; drink, then eat.', icon: { shape: 'coconut', color: '#6a4a2a', accent: '#f2ece0' }, stackable: true, value: 4, heal: 5 }));
  out.push(I({ id: 'kelp', name: 'Sea kelp', desc: 'Wrap fish in it before cooking: it keeps them moist and doubles the goodness.', icon: { shape: 'kelp', color: '#4a6a2a', accent: '#8a9a3a' }, stackable: true, value: 3 }));
  out.push(I({ id: 'geode', name: 'Geode', desc: 'A plain stone that rattles. Tap it and Crack open.', icon: { shape: 'geode', color: '#8a8478', accent: '#9fe8ff' }, stackable: true, value: 20, opens: 'geode' }));
  out.push(I({ id: 'spade', name: 'Spade', desc: 'For disturbed sand. Somebody always buries something.', icon: { shape: 'spade', color: '#9aa0a4' }, stackable: false, value: 12 }));
  out.push(I({ id: 'parcel_sprat', name: 'Kelp-wrapped sprat', desc: 'Heals 6.', icon: { shape: 'parcel', color: '#4a6a2a', accent: '#c9934f' }, stackable: true, value: 14, heal: 6 }));
  out.push(I({ id: 'ale', name: 'Bellwether ale', desc: 'Heals 4. Brewed in the inn\'s cellar, from what, nobody says.', icon: { shape: 'mug', color: '#8a6a40', accent: '#d8a030' }, stackable: true, value: 5, heal: 4 }));
  out.push(I({ id: 'pie_berry', name: 'Bramble pie', desc: 'Heals 9. Berries baked into a loaf: better than either.', icon: { shape: 'pie', color: '#c9934f', accent: '#7a2a5a' }, stackable: true, value: 18, heal: 9 }));
  out.push(I({ id: 'crab_cakes', name: 'Crab cakes', desc: 'Heals 12. Crab and crumbs, fried golden.', icon: { shape: 'bread', color: '#d0903f' }, stackable: true, value: 30, heal: 12 }));
  out.push(I({ id: 'fish_pie', name: 'Fisherman\'s pie', desc: 'Heals 20. Trout and salmon under a crust.', icon: { shape: 'pie', color: '#d8a860', accent: '#e8d8b8' }, stackable: true, value: 70, heal: 20 }));
  out.push(I({ id: 'lobster_bisque', name: 'Lobster bisque', desc: 'Heals 26. Rich, red and salty.', icon: { shape: 'bowl', color: '#8a5a3a', accent: '#d8442a' }, stackable: true, value: 120, heal: 26 }));
  out.push(I({ id: 'sword_kelp', name: 'Kelp-wrapped swordfish', desc: 'Heals 28. Steamed in its own wrap of kelp.', icon: { shape: 'parcel', color: '#3e5a26', accent: '#a8703a' }, stackable: true, value: 160, heal: 28 }));
  out.push(I({ id: 'captains_feast', name: 'Captain\'s feast', desc: 'Heals 34. Shark and angler, salted and roasted. Fit for a captain.', icon: { shape: 'pie', color: '#a87a5a', accent: '#d88a4a' }, stackable: true, value: 260, heal: 34 }));
  out.push(I({ id: 'fish_stew', name: 'Fisherman\'s stew', desc: 'Heals 18. Salmon, kelp and sea salt, slow-cooked.', icon: { shape: 'bowl', color: '#9a6a40', accent: '#d88a4a' }, stackable: true, value: 55, heal: 18 }));
  out.push(I({ id: 'parcel_trout', name: 'Kelp-wrapped trout', desc: 'Heals 11.', icon: { shape: 'parcel', color: '#3e5a26', accent: '#b8834a' }, stackable: true, value: 30, heal: 11 }));
  for (const [id, name, req, acc, dmg, col] of STAFFS) out.push(I({ id, name, desc: `Casts your chosen spell. +${dmg}% spell damage.`, icon: { shape: 'staff', color: '#6a4a30', accent: col }, stackable: false, value: req * 12,
    equip: { slot: 'weapon', reqs: { magic: req }, style: 'magic', speed: 2.4, range: 9 + Math.floor(req / 30), bonus: { acc, magicDmg: dmg, defMagic: 4 + req / 5 }, affixPool: MAGIC_AFFIX } }));
  // one-handed magic (Tom, 2026-10-25): a wand leaves the off-hand free for an orb (power), a book (thrift and
  // protection), a shield or a second wand. Wand + orb is a staff's equal; the others trade damage for something.
  const MAGIC_TIERS = [
    { key: 'driftwood', wood: '#8a6440', glow: '#59d0c4', req: 1 }, { key: 'coral', wood: '#6a4a30', glow: '#e07a6a', req: 20 },
    { key: 'storm', wood: '#6a4a30', glow: '#86b6dc', req: 40 }, { key: 'tide', wood: '#6a4a30', glow: '#3cc6c4', req: 60 },
  ];
  const WAND = { acc: [5, 9, 14, 20], dmg: [0, 2, 5, 8] }, ORB = { acc: [3, 5, 8, 12], dmg: [1, 3, 5, 7] }, BOOK = { dmg: [0, 1, 2, 4], def: [4, 8, 12, 16], save: [10, 15, 20, 25] };
  const WAND_NAME = ['Driftwood wand', 'Coral wand', 'Stormsilver wand', 'Tidecore wand'];
  const ORB_NAME = ['Sea-glass orb', 'Coral orb', 'Storm orb', 'Tidecore orb'], ORB_ID = ['glass', 'coral', 'storm', 'tide'];
  const BOOK_NAME = ['Sailor\'s almanac', 'Coral codex', 'Storm log', 'Tidecaller\'s grimoire'], BOOK_ID = ['almanac', 'coral', 'storm', 'tide'];
  MAGIC_TIERS.forEach((t, k) => {
    out.push(I({ id: `wand_${t.key}`, name: WAND_NAME[k], desc: 'One-handed: casts your chosen spell and leaves the off-hand free for an orb, a book, a shield or a second wand.', icon: { shape: 'wand', color: t.wood, accent: t.glow }, stackable: false, value: Math.max(20, t.req * 10),
      equip: { slot: 'weapon', reqs: { magic: t.req }, style: 'magic', kind: 'wand', speed: 2.4, range: 8 + Math.floor(t.req / 30), bonus: { acc: WAND.acc[k], magicDmg: WAND.dmg[k], defMagic: 2 + k * 2 }, affixPool: MAGIC_AFFIX } }));
    out.push(I({ id: `orb_${ORB_ID[k]}`, name: ORB_NAME[k], desc: `Off-hand, beside a wand. Focuses your spells: +${ORB.dmg[k]}% spell damage.`, icon: { shape: 'orb', color: t.glow, accent: '#e9fbff' }, stackable: false, value: Math.max(20, t.req * 9),
      equip: { slot: 'offhand', off: 'orb', reqs: { magic: t.req }, bonus: { acc: ORB.acc[k], magicDmg: ORB.dmg[k] }, affixPool: MAGIC_AFFIX } }));
    out.push(I({ id: `book_${BOOK_ID[k]}`, name: BOOK_NAME[k], desc: 'Off-hand, beside a wand. Its pages ward off spells, and its rites waste fewer tide charms.', icon: { shape: 'book', color: k === 0 ? '#7a5534' : '#3a4a6a', accent: t.glow }, stackable: false, value: Math.max(20, t.req * 9),
      equip: { slot: 'offhand', off: 'book', reqs: { magic: t.req }, bonus: { magicDmg: BOOK.dmg[k], defMagic: BOOK.def[k] }, affixPool: ['max_hp', 'regen', 'xp_bonus', 'accuracy'] }, innate: [{ id: 'charm_save', v: BOOK.save[k] }] }));
  });
  // jewellery: a pendant and a bangle beside the rings (gold ones are forged; Crafting will take jewellery over)
  out.push(I({ id: 'amulet_brass', name: 'Brass pendant', desc: 'A wave stamped in brass, on a cord.', icon: { shape: 'amulet', color: '#d4b25a' }, stackable: false, value: 45,
    equip: { slot: 'neck', reqs: {}, bonus: { defMelee: 1, defRanged: 1, defMagic: 2 }, affixPool: JEWEL_AFFIX } }));
  out.push(I({ id: 'amulet_gold', name: 'Gold amulet', desc: 'Heavy gold on a chain. Gold takes enchantment well.', icon: { shape: 'amulet', color: '#e3c25e', accent: '#d8442a' }, stackable: false, value: 200,
    equip: { slot: 'neck', reqs: { defence: 1 }, bonus: { acc: 3, str: 3, defMelee: 2, defRanged: 2, defMagic: 3 }, affixPool: JEWEL_AFFIX } }));
  out.push(I({ id: 'bracelet_brass', name: 'Brass bangle', desc: 'A plain band for the wrist.', icon: { shape: 'bracelet', color: '#d4b25a' }, stackable: false, value: 35,
    equip: { slot: 'wrist', reqs: {}, bonus: { defMelee: 1, defRanged: 1, defMagic: 1 }, affixPool: JEWEL_AFFIX } }));
  out.push(I({ id: 'bracelet_gold', name: 'Gold bracelet', desc: 'A twisted gold band. Gold takes enchantment well.', icon: { shape: 'bracelet', color: '#e3c25e', accent: '#59d0c4' }, stackable: false, value: 180,
    equip: { slot: 'wrist', reqs: { defence: 1 }, bonus: { acc: 2, defMelee: 2, defRanged: 2, defMagic: 2 }, affixPool: JEWEL_AFFIX } }));
  // leather: light, cheap, kind to spellcasters (a full leather set with the cap and padded coat)
  out.push(I({ id: 'chaps_leather', name: 'Leather chaps', desc: 'Light. Good against shot.', icon: { shape: 'legs', color: '#7a5534' }, stackable: false, value: 20,
    equip: { slot: 'legs', reqs: { defence: 1 }, bonus: { defMelee: 2, defRanged: 4, defMagic: 2 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] } }));
  out.push(I({ id: 'boots_leather', name: 'Leather boots', desc: 'Sea-boots, waxed against the wet.', icon: { shape: 'boots', color: '#5a3e28' }, stackable: false, value: 12,
    equip: { slot: 'feet', reqs: {}, bonus: { defMelee: 1, defRanged: 2, defMagic: 1 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] } }));
  out.push(I({ id: 'gloves_leather', name: 'Leather gloves', desc: 'Supple gloves. A surer grip on a trigger or a blade.', icon: { shape: 'gloves', color: '#7a5534' }, stackable: false, value: 12,
    equip: { slot: 'hands', reqs: {}, bonus: { acc: 2, defMelee: 1, defRanged: 1, defMagic: 1 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] } }));
  // ---- Crafting (Tom, 2026-10-25): leather, snakeskin, spider silk, sunscale and jewellery for the new slots
  out.push(I({ id: 'boar_hide', name: 'Boar hide', desc: 'A bristly Greenheart hide. Tan it at a workbench with sea salt.', icon: { shape: 'hide', color: '#8a5a3a', accent: '#5a3a24' }, stackable: true, value: 14 }));
  out.push(I({ id: 'leather', name: 'Leather', desc: 'Tanned hide, ready to cut and stitch.', icon: { shape: 'hide', color: '#a8784a', accent: '#7a5534' }, stackable: true, value: 24 }));
  // a whole set per material: [id, name, slot, shape, defMelee, defRanged, defMagic, extra bonus]
  type Piece = [string, string, Slot, IconShape, number, number, number, Bonuses?];
  const set = (pieces: Piece[], col: string, acc: string, reqs: (k: number) => Partial<Record<SkillId, number>>, desc: string, pool: string[], value: number) =>
    pieces.forEach(([id, name, slot, shape, dm, dr, dg, extra], k) => out.push(I({ id, name, desc, icon: { shape, color: col, accent: acc }, stackable: false, value: value * (k + 2),
      equip: { slot, off: slot === 'offhand' ? 'shield' : undefined, reqs: reqs(k), bonus: { defMelee: dm, defRanged: dr, defMagic: dg, ...extra }, affixPool: pool } })));
  out.push(I({ id: 'chitin', name: 'Chitin', desc: 'A plate of shore-beetle shell. Light and hard; lace it into armour at a workbench.', icon: { shape: 'shell', color: '#7a6a4a', accent: '#c8b088' }, stackable: true, value: 9 }));
  // Sunreach's insects (docs/ISLANDS.md slice 2): leafcutter resin, mantis blades, and the dagger made of them
  out.push(I({ id: 'resin', name: 'Leafcutter resin', desc: 'Sticky amber resin the ants carry. Sets hard as horn; good for a grip.', icon: { shape: 'gem', color: '#d8902a', accent: '#f2c86a' }, stackable: true, value: 12 }));
  out.push(I({ id: 'mantis_blade', name: 'Mantis blade', desc: 'A jungle mantis\'s forelimb, edged like a saw. Set two in resin at a workbench.', icon: { shape: 'dagger', color: '#6a9a3a', accent: '#c8e07a' }, stackable: true, value: 28 }));
  out.push(I({ id: 'dagger_mantis', name: 'Mantis-blade dagger', desc: 'Two mantis forelimbs set in resin. Lighter and quicker than any metal dagger.', icon: { shape: 'dagger', color: '#6a9a3a', accent: '#d8902a' }, stackable: false, value: 220,
    equip: { slot: 'weapon', reqs: { attack: 20 }, style: 'melee', kind: 'dagger', speed: 1.6, range: 1.4, bonus: { acc: 50, str: 27 }, affixPool: [...MELEE_AFFIX, 'leech'] } }));
  // chitin: shore-beetle shell on leather; turns blades, light enough to run in (Defence 10-15)
  set([
    ['helm_chitin', 'Chitin helm', 'head', 'helm', 5, 3, 1], ['legs_chitin', 'Chitin legs', 'legs', 'legs', 8, 5, 2], ['body_chitin', 'Chitin body', 'body', 'plate', 12, 8, 3],
  ], '#7a6a4a', '#c8b088', (k) => ({ defence: [10, 12, 15][k] }), 'Shore-beetle shell laced on leather. It turns a blade and weighs next to nothing.', ARMOUR_AFFIX, 30);
  // snakeskin: archers' armour, tough against shot and spells, light against blades (Ranged 30-45)
  set([
    ['vambraces_snake', 'Snakeskin vambraces', 'hands', 'gloves', 2, 4, 2, { acc: 6 }], ['boots_snake', 'Snakeskin boots', 'feet', 'boots', 3, 5, 2],
    ['chaps_snake', 'Snakeskin chaps', 'legs', 'legs', 10, 18, 7], ['cowl_snake', 'Snakeskin cowl', 'head', 'cap', 5, 9, 4], ['body_snake', 'Snakeskin body', 'body', 'coat', 18, 30, 12],
  ], '#7a9a3a', '#d8b84a', (k) => ({ ranged: [30, 33, 37, 40, 45][k], defence: 20 }), 'Gold-and-green jungle snakeskin. Light, supple, hard for shot to pierce.', [...ARMOUR_AFFIX, 'accuracy', 'crit'], 60);
  // spider silk: casters' robes, no penalty to magic, every piece adds spell damage (Magic 25-55)
  set([
    ['hood_silk', 'Silk hood', 'head', 'cap', 2, 2, 6, { magicDmg: 1 }], ['gloves_silk', 'Silk gloves', 'hands', 'gloves', 1, 1, 4, { acc: 3 }], ['boots_silk', 'Silk boots', 'feet', 'boots', 1, 1, 4, { magicDmg: 1 }],
    ['skirt_silk', 'Silk robe bottom', 'legs', 'legs', 4, 4, 12, { magicDmg: 2 }], ['robe_silk', 'Silk robe top', 'body', 'coat', 6, 6, 20, { magicDmg: 3 }],
  ], '#e8e6dc', '#59d0c4', (k) => ({ magic: [25, 30, 35, 45, 55][k] }), 'Woven from cave-spider silk. Spells pass through it as if it were water.', [...ARMOUR_AFFIX, 'dmg_pct', 'xp_bonus'], 70);
  // sunscale: the temple serpent's scales; heavy armour with no weakness to magic (Defence 60)
  set([
    ['shield_sunscale', 'Sunscale shield', 'offhand', 'shield', 30, 30, 20], ['legs_sunscale', 'Sunscale legs', 'legs', 'legs', 34, 34, 20],
    ['body_sunscale', 'Sunscale body', 'body', 'plate', 70, 70, 40], ['helm_sunscale', 'Sunscale helm', 'head', 'helm', 20, 20, 12],
  ], '#e8b83a', '#a86a1a', () => ({ defence: 60 }), 'Scales from the temple serpent, bright as hammered gold. Spells slide off it.', [...ARMOUR_AFFIX, 'elite_dmg'], 500);
  // jewellery: gold set with a geode crystal, then sunscale (plain gold ones are above)
  const jewel = (id: string, name: string, slot: Slot, shape: IconShape, col: string, acc: string, bonus: Bonuses, value: number, desc: string) =>
    out.push(I({ id, name, desc, icon: { shape, color: col, accent: acc }, stackable: false, value, equip: { slot, reqs: {}, bonus, affixPool: JEWEL_AFFIX } }));
  jewel('ring_crystal', 'Crystal ring', 'ring', 'ring', '#e3c25e', '#9fe8ff', { acc: 4, defMagic: 3 }, 420, 'Gold set with a geode crystal. It hums faintly.');
  jewel('bracelet_crystal', 'Crystal bracelet', 'wrist', 'bracelet', '#e3c25e', '#9fe8ff', { acc: 4, defMelee: 3, defRanged: 3, defMagic: 3 }, 460, 'Gold set with geode crystals.');
  jewel('amulet_crystal', 'Crystal amulet', 'neck', 'amulet', '#e3c25e', '#9fe8ff', { acc: 6, str: 6, defMelee: 3, defRanged: 3, defMagic: 4 }, 600, 'A geode crystal in a gold cage. It throws light on the deck.');
  jewel('ring_sunscale', 'Sunscale ring', 'ring', 'ring', '#e8b83a', '#d8442a', { acc: 6, str: 4, defMagic: 3 }, 1400, 'A band cut from one of the serpent\'s scales.');
  jewel('amulet_sunscale', 'Sunscale amulet', 'neck', 'amulet', '#e8b83a', '#d8442a', { acc: 10, str: 10, defMelee: 5, defRanged: 5, defMagic: 5 }, 2400, 'The serpent\'s brightest scale, on a gold chain. Warm against the skin.');
  // ---- gems (drops.ts): rough from any creature's gem table or from mining; polished at the bench; set in gold at
  // the furnace as a ring, bracelet or amulet (better gem, better piece)
  GEMS.forEach((g, t) => {
    out.push(I({ id: `gem_${g.key}_rough`, name: `Rough ${g.name.toLowerCase()}`, desc: 'Uncut and dull. Polish it at a workbench (Crafting).', icon: { shape: 'crystal', color: g.colour }, stackable: true, value: 30 * (t + 1) ** 2 }));
    out.push(I({ id: `gem_${g.key}`, name: g.name, desc: 'Polished. Set it in gold at a furnace.', icon: { shape: 'gem', color: g.colour }, stackable: true, value: 60 * (t + 1) ** 2 }));
    const v = 200 * (t + 1) ** 2;
    out.push(I({ id: `ring_${g.key}`, name: `${g.name} ring`, desc: `A gold ring set with a ${g.name.toLowerCase()}.`, icon: { shape: 'ring', color: '#e3c25e', accent: g.colour }, stackable: false, value: v,
      equip: { slot: 'ring', reqs: {}, bonus: { acc: 3 + 2 * t, str: 2 + 2 * t, defMagic: 1 + t }, affixPool: JEWEL_AFFIX } }));
    out.push(I({ id: `bracelet_${g.key}`, name: `${g.name} bracelet`, desc: `Gold and ${g.name.toLowerCase()}.`, icon: { shape: 'bracelet', color: '#e3c25e', accent: g.colour }, stackable: false, value: v,
      equip: { slot: 'wrist', reqs: {}, bonus: { acc: 2 + 2 * t, defMelee: 2 + 2 * t, defRanged: 2 + 2 * t, defMagic: 2 + 2 * t }, affixPool: JEWEL_AFFIX } }));
    out.push(I({ id: `amulet_${g.key}`, name: `${g.name} amulet`, desc: `A ${g.name.toLowerCase()} on a gold chain.`, icon: { shape: 'amulet', color: '#e3c25e', accent: g.colour }, stackable: false, value: v * 1.5,
      equip: { slot: 'neck', reqs: {}, bonus: { acc: 4 + 3 * t, str: 4 + 3 * t, defMelee: 2 + t, defRanged: 2 + t, defMagic: 2 + t }, affixPool: JEWEL_AFFIX } }));
  });
  // ---- signature weapons: very rare drops from late foes, each with one rule that changes how it fights
  const SIG_AFFIX = { melee: [...MELEE_AFFIX, 'leech'], ranged: RANGED_AFFIX, magic: MAGIC_AFFIX };
  const sig = (id: string, name: string, desc: string, shape: IconShape, col: string, acc: string, style: CombatStyle, kind: WeaponKind, reqs: Partial<Record<SkillId, number>>, speed: number, range: number | undefined, bonus: Bonuses, s: { id: SigId; text: string }) =>
    out.push(I({ id, name, desc, icon: { shape, color: col, accent: acc }, stackable: false, value: 60000, sig: s,
      equip: { slot: 'weapon', reqs, style, kind, speed, range, bonus, affixPool: SIG_AFFIX[style] } }));
  sig('sig_lash', 'Undertow Lash', 'A whip of living kelp with a barbed tip. It never quite stops moving.', 'cutlass', '#3e7a3a', '#59d0c4', 'melee', 'cutlass', { attack: 70 }, 2.4, 3.0, { acc: 112, str: 90 },
    { id: 'lash', text: 'Reaches 3 m; every hit drags the foe toward you and slows it for 2 s' });
  sig('sig_jaw', 'Leviathan\'s Jaw', 'A greatsword ground from a leviathan\'s jawbone, teeth still in it.', 'greatsword', '#efe6cf', '#a8203a', 'melee', 'greatsword', { attack: 80, strength: 80 }, 3.6, 1.9, { acc: 104, str: 180 },
    { id: 'jaw', text: 'Every fourth swing bites twice and heals you 5% of the damage' });
  sig('sig_bell', 'Bellbreaker', 'A boarding pike capped with a cracked bronze bell. It rings when it hits.', 'pike', '#c08a4a', '#e3c25e', 'melee', 'pike', { attack: 75 }, 3.0, 2.8, { acc: 100, str: 124 },
    { id: 'bell', text: 'Hits have a 25% chance to stun the foe for 1.5 s' });
  sig('sig_fang', 'Sunscale Fang', 'A dagger made from the temple serpent\'s fang. Its venom never dried.', 'dagger', '#e8b83a', '#4f9a52', 'melee', 'dagger', { attack: 72 }, 1.8, 1.4, { acc: 128, str: 74 },
    { id: 'venom', text: 'Hits poison: the foe loses 1% of its health a second for 4 s and can\'t heal' });
  sig('sig_locksmith', 'Locksmith\'s Blade', 'A cutlass with a keyhole through the blade. Whatever it cuts, it opens.', 'cutlass', '#d9b25a', '#59d0c4', 'melee', 'cutlass', { attack: 85 }, 2.4, undefined, { acc: 118, str: 116 },
    { id: 'locksmith', text: '+25% damage to foes under a key power; every kill takes 5 s off your key\'s cooldown' });
  sig('sig_flintlock', 'Drowned Man\'s Flintlock', 'Barnacled, wet, and it still fires. Shots skip like stones on water.', 'pistol', '#3a4a44', '#bfeee4', 'ranged', 'pistol', { ranged: 75 }, 2.4, 14, { acc: 140 },
    { id: 'ricochet', text: 'Shots ricochet to a second foe within 5 m for half damage' });
  sig('sig_stormcaller', 'Stormcaller', 'A crossbow with a stormsilver prod. The air smells of rain around it.', 'crossbow', '#2a3a5a', '#b8c6ff', 'ranged', 'crossbow', { ranged: 85 }, 3.0, 14, { acc: 172 },
    { id: 'storm', text: 'Every bolt arcs lightning to 2 more foes within 5 m for 30%' });
  sig('sig_skypiercer', 'Skypiercer', 'A longbow strung with weaver silk. Its arrows don\'t stop at the first thing they hit.', 'bow', '#46486a', '#e8e6dc', 'ranged', 'longbow', { ranged: 85 }, 3.0, 18, { acc: 152 },
    { id: 'pierce', text: 'Arrows pierce every foe in a line behind the target (70%)' });
  sig('sig_maelstrom', 'Maelstrom Staff', 'Driftwood wrapped round a whirlpool trapped in glass.', 'staff', '#2a4a5a', '#3cc6c4', 'magic', 'staff', { magic: 80 }, 2.4, 11, { acc: 46, magicDmg: 20, defMagic: 20 },
    { id: 'maelstrom', text: 'Spells open a whirlpool: foes within 2.5 m are dragged in and take half the hit' });
  return out;
}

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
    I({ id: 'boar_meat_raw', name: 'Raw boar meat', desc: 'A thick cut from a Greenheart boar. Needs cooking.', icon: { shape: 'meat', color: '#c9605a', accent: '#f2e0d0' }, stackable: true, value: 16 }),
    I({ id: 'boar_meat', name: 'Roast boar', desc: 'Heals 11. Crackling and all.', icon: { shape: 'meat', color: '#9a5a2c', accent: '#e8c27a' }, stackable: true, value: 34, heal: 11 }),
    I({ id: 'spider_silk', name: 'Spider silk', desc: 'A skein of cave-spider silk, strong as wire. Tamsin buys it for sailcloth.', icon: { shape: 'parcel', color: '#e8e6dc', accent: '#b8b4a8' }, stackable: true, value: 22 }),
    I({ id: 'snake_skin', name: 'Snakeskin', desc: 'A shed jungle-snake skin, patterned gold and green.', icon: { shape: 'parcel', color: '#7a9a3a', accent: '#d8b84a' }, stackable: true, value: 18 }),
    I({ id: 'sunscale', name: 'Sunscale', desc: 'A scale from the temple serpent, bright as hammered gold. Worth a fortune.', icon: { shape: 'shell', color: '#e8b83a', accent: '#a86a1a' }, stackable: true, value: 420 }),
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
      equip: { slot: 'weapon', reqs: { magic: 1 }, style: 'magic', speed: 2.4, range: 9, bonus: { acc: 8, defMagic: 4 }, affixPool: MAGIC_AFFIX } }),
    // ---- armour (Defence requirement)
    I({ id: 'cap_leather', name: 'Leather cap', desc: 'Light. Good against shot.', icon: { shape: 'cap', color: '#7a5534' }, stackable: false, value: 15,
      equip: { slot: 'head', reqs: { defence: 1 }, bonus: { defMelee: 2, defRanged: 4, defMagic: 2 }, affixPool: [...ARMOUR_AFFIX, 'gather_speed'] } }),
    I({ id: 'coat_padded', name: 'Padded coat', desc: 'Quilted and patched. Good against shot.', icon: { shape: 'coat', color: '#5a4636' }, stackable: false, value: 30,
      equip: { slot: 'body', reqs: { defence: 1 }, bonus: { defMelee: 4, defRanged: 8, defMagic: 3 }, affixPool: ARMOUR_AFFIX } }),
    I({ id: 'lockplate', name: 'Lockbound plate', desc: 'Brass armour from the Guardian\'s chest. The keyhole still hums.', icon: { shape: 'coat', color: '#b08a3e', accent: '#59d0c4' }, stackable: false, value: 300,
      equip: { slot: 'body', reqs: { defence: 10 }, bonus: { defMelee: 12, defRanged: 10, defMagic: -4 }, affixPool: [...ARMOUR_AFFIX, 'elite_dmg', 'dmg_pct'] } }),
    I({ id: 'ring_brass', name: 'Brass ring', desc: 'Engraved with waves.', icon: { shape: 'ring', color: '#d4b25a' }, stackable: false, value: 40,
      equip: { slot: 'ring', reqs: {}, bonus: {}, affixPool: JEWEL_AFFIX } }),
    // ---- quest
    I({ id: 'tuning_bell', name: 'Tuning bell', desc: 'Cast by Iven Marr from your bronze. Ring it at the Broken Ring.', icon: { shape: 'bell', color: '#c08a4a' }, stackable: false, value: 0, quest: true }),
    I({ id: 'keels_tooth', name: 'Keel\'s Tooth', desc: 'A key shaped like a tooth, warm as a living thing.', icon: { shape: 'tooth', color: '#efe3c4', accent: '#59d0c4' }, stackable: false, value: 0, quest: true }),
    ...tierItems(),
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
  max_hp: { id: 'max_hp', prefix: 'Hale', suffix: 'of Vigour', min: 1, max: 4, fmt: (v) => `+${v * 10} max health` },
  armour: { id: 'armour', prefix: 'Sturdy', suffix: 'of the Bulwark', min: 2, max: 7, fmt: (v) => `+${v} defence against everything` },
  regen: { id: 'regen', prefix: 'Mending', suffix: 'of Mending', min: 1, max: 2, fmt: (v) => `+${v} health every 10s` },
  gather_speed: { id: 'gather_speed', prefix: 'Diligent', suffix: 'of Labour', min: 4, max: 10, fmt: (v) => `+${v}% gathering success` },
  xp_bonus: { id: 'xp_bonus', prefix: 'Studious', suffix: 'of Learning', min: 2, max: 5, fmt: (v) => `+${v}% skill experience` },
  // signature traits only (never rolled)
  durable: { id: 'durable', prefix: 'Tough', suffix: 'of Endurance', min: 40, max: 40, fmt: (v) => `Wears ${v}% slower` },
  charm_save: { id: 'charm_save', prefix: 'Thrifty', suffix: 'of Thrift', min: 10, max: 25, fmt: (v) => `${v}% chance a spell burns no charms` },
  sea_dmg: { id: 'sea_dmg', prefix: 'Sea-bane', suffix: 'of the Deep', min: 15, max: 15, fmt: (v) => `+${v}% damage to crabs and the Drowned` },
};
