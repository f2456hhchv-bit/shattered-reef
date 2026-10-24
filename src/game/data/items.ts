// Item definitions. Content only: game logic reads these, UI renders them.

export type SkillId =
  | 'attack' | 'strength' | 'defence' | 'hitpoints' | 'ranged' | 'magic'
  | 'woodcutting' | 'mining' | 'fishing'
  | 'smithing' | 'gunsmithing' | 'fletching' | 'cooking';
export type CombatStyle = 'melee' | 'ranged' | 'magic';
export type Slot = 'weapon' | 'ammo' | 'head' | 'body' | 'ring';
/** Weapon families: each plays differently (reach, speed, cleave, shots per attack, which ammo). */
export type WeaponKind = 'cutlass' | 'dagger' | 'pike' | 'greatsword' | 'pistol' | 'pistols' | 'shortbow' | 'longbow' | 'crossbow' | 'staff';
export type AmmoKind = 'shot' | 'arrow' | 'bolt';
export const AMMO_FOR: Partial<Record<WeaponKind, AmmoKind>> = { pistol: 'shot', pistols: 'shot', shortbow: 'arrow', longbow: 'arrow', crossbow: 'bolt' };
export const AMMO_NAME: Record<AmmoKind, string> = { shot: 'shot', arrow: 'arrows', bolt: 'bolts' };
export type IconShape = 'log' | 'ore' | 'bar' | 'fish' | 'meat' | 'coins' | 'bread' | 'hatchet' | 'pickaxe' | 'rod' | 'cutlass' | 'helm' | 'cap' | 'coat' | 'plate' | 'ring' | 'bell' | 'tooth' | 'shell' | 'burnt' | 'pistol' | 'shot' | 'staff' | 'charm' | 'harpoon' | 'pot' | 'lobster' | 'berries' | 'kelp' | 'geode' | 'spade' | 'parcel' | 'ash' | 'salt' | 'crystal' | 'nest' | 'casket' | 'mug' | 'bowl' | 'pie' | 'dagger' | 'pike' | 'greatsword' | 'pistols' | 'bow' | 'crossbow' | 'arrow' | 'bolt';

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
    ammo?: AmmoKind; // ammunition: which weapons fire it
    speed?: number; // seconds between attacks
    range?: number; // metres (melee weapons use the default reach)
    bonus: Bonuses;
    affixPool: string[];
  };
  quest?: boolean;
  opens?: string; // using it rolls this loot table (geodes)
  innate?: { id: string; v: number }[]; // traits every copy has (the metal's signature), on top of rolled affixes
}

const I = (d: ItemDef) => d;
/** A weapon's family (older items only say their style). */
export function weaponKind(d: ItemDef | undefined): WeaponKind {
  const e = d?.equip;
  return e?.kind ?? (e?.style === 'ranged' ? 'pistol' : e?.style === 'magic' ? 'staff' : 'cutlass');
}
/** Which ammunition an ammo item is (older shot items only say rangedStr). */
export function ammoKind(d: ItemDef | undefined): AmmoKind | null {
  if (!d?.equip || d.equip.slot !== 'ammo') return null;
  return d.equip.ammo ?? 'shot';
}
const MELEE_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'cleave', 'elite_dmg', 'accuracy'];
const RANGED_AFFIX = ['dmg_pct', 'atk_speed', 'crit', 'elite_dmg', 'accuracy', 'leech'];
const ARMOUR_AFFIX = ['max_hp', 'armour', 'regen'];


// ---- tiers: generated so every metal, wood and fish follows one rule set --------------------------
/** Metals, low to high. `m` indexes the gear stat tables below. Existing early ids are kept for saves. */
export const METALS = [
  { key: 'bronze', name: 'Bronze', color: '#c08a4a', req: 1, toolReq: 1 },
  { key: 'iron', name: 'Iron', color: '#9aa0a4', req: 10, toolReq: 10 },
  { key: 'steel', name: 'Steel', color: '#b9c4cc', req: 20, toolReq: 20 },
  { key: 'storm', name: 'Stormsilver', color: '#86b6dc', req: 30, toolReq: 30 },
  { key: 'abyss', name: 'Abyssite', color: '#3f7a66', req: 40, toolReq: 40 },
  { key: 'tide', name: 'Tidecore', color: '#3cc6c4', req: 50, toolReq: 50 },
  { key: 'cinder', name: 'Cinderite', color: '#b8452a', req: 60, toolReq: 60 },
  { key: 'sky', name: 'Skyglass', color: '#8a7ae0', req: 70, toolReq: 70 },
  { key: 'levi', name: 'Leviathite', color: '#d8cdb4', req: 80, toolReq: 80 },
  { key: 'ori', name: 'Orichalcum', color: '#e0a33a', req: 90, toolReq: 90 },
] as const;
const CUT = { acc: [9, 14, 21, 30, 40, 52, 64, 77, 90, 104], str: [8, 13, 20, 29, 39, 51, 63, 76, 89, 103] };
const HELM = [5, 8, 12, 17, 23, 30, 37, 45, 53, 62];
const PLATE = [14, 21, 32, 46, 62, 80, 98, 118, 140, 164];
const SHOT_STR = [7, 13, 20, 28, 37, 47, 57, 68, 80, 92];
const PISTOL = { acc: [10, 22, 32, 44, 58, 72, 86, 100, 115, 130], req: [1, 15, 25, 35, 45, 55, 65, 75, 85, 92], range: [9, 10, 10, 11, 11, 12, 12, 13, 13, 14] };
const BOW_REQ = [1, 10, 20, 30, 45, 60, 75], BOW_ACC = [8, 18, 28, 40, 56, 76, 98];
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
    equip: { slot: 'ring', reqs: { defence: 1 }, bonus: { acc: 2, defMelee: 1, defRanged: 1, defMagic: 2 }, affixPool: ['gather_speed', 'xp_bonus', 'crit', 'max_hp', 'dmg_pct', 'accuracy', 'regen'] } }));
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
    out.push(I({ id: `pistols_${mt.key}`, name: `${nm} pistol brace`, desc: 'A pistol in each hand: two shots every volley, each a little wilder. Burns shot twice as fast.', icon: { shape: 'pistols', color: '#5a3e28', accent: col }, stackable: false, value: BAR_VALUE[m] * 6,
      equip: { slot: 'weapon', reqs: { ranged: Math.min(99, PISTOL.req[m] + 5) }, style: 'ranged', kind: 'pistols', speed: 2.6, range: PISTOL.range[m] - 2, bonus: { acc: Math.round(PISTOL.acc[m] * 0.85) }, affixPool: RANGED_AFFIX }, innate: wTrait }));
    out.push(I({ id: `crossbow_${mt.key}`, name: `${nm} crossbow`, desc: 'Slow to wind, rarely misses. Fires bolts.', icon: { shape: 'crossbow', color: '#6a4a30', accent: col }, stackable: false, value: BAR_VALUE[m] * 3,
      equip: { slot: 'weapon', reqs: { ranged: mt.req }, style: 'ranged', kind: 'crossbow', speed: 3.0, range: 11 + Math.floor(m / 3), bonus: { acc: Math.round(PISTOL.acc[m] * 1.2) }, affixPool: RANGED_AFFIX }, innate: wTrait }));
    out.push(I({ id: `arrow_${mt.key}`, name: `${nm} arrows`, desc: 'For shortbows and longbows. Equip in the ammo slot.', icon: { shape: 'arrow', color: col, accent: '#e9e3d0' }, stackable: true, value: Math.max(1, Math.ceil(BAR_VALUE[m] / 15)),
      equip: { slot: 'ammo', ammo: 'arrow', reqs: { ranged: mt.req }, bonus: { rangedStr: Math.round(SHOT_STR[m] * 0.85) }, affixPool: [] } }));
    out.push(I({ id: `bolt_${mt.key}`, name: `${nm} bolts`, desc: 'Short, heavy crossbow bolts. Equip in the ammo slot.', icon: { shape: 'bolt', color: col }, stackable: true, value: Math.max(1, Math.ceil(BAR_VALUE[m] / 11)),
      equip: { slot: 'ammo', ammo: 'bolt', reqs: { ranged: mt.req }, bonus: { rangedStr: Math.round(SHOT_STR[m] * 1.15) }, affixPool: [] } }));
    if (m >= 1) out.push(I({ id: `helm_${mt.key}`, name: `${nm} helm`, desc: 'Good against blades, poor against spells.', icon: { shape: 'helm', color: col }, stackable: false, value: BAR_VALUE[m] * 2,
      equip: { slot: 'head', reqs: { defence: mt.req }, bonus: { defMelee: HELM[m], defRanged: Math.round(HELM[m] * 0.85), defMagic: -1 - m }, affixPool: ARMOUR_AFFIX }, innate: aTrait }));
    out.push(I({ id: `plate_${mt.key}`, name: `${nm} plate`, desc: 'Heavy chest armour. Spells find the gaps.', icon: { shape: 'plate', color: col }, stackable: false, value: BAR_VALUE[m] * 5,
      equip: { slot: 'body', reqs: { defence: mt.req }, bonus: { defMelee: PLATE[m], defRanged: Math.round(PLATE[m] * 0.85), defMagic: -3 - m * 2 }, affixPool: ARMOUR_AFFIX }, innate: aTrait }));
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
  out.push(I({ id: 'harpoon', name: 'Harpoon', desc: 'For fish that fight back.', icon: { shape: 'harpoon', color: '#9aa0a4' }, stackable: false, value: 60, tool: { skill: 'fishing', power: 0, level: 1 } }));
  const STAFFS: [string, string, number, number, number, string][] = [
    ['staff_coral', 'Coral staff', 20, 14, 5, '#e07a6a'], ['staff_storm', 'Stormsilver staff', 40, 22, 10, '#86b6dc'], ['staff_tide', 'Tidecore staff', 60, 32, 15, '#3cc6c4'],
  ];
  // the living island: foraging, treasure
  out.push(I({ id: 'berries', name: 'Bramble berries', desc: 'Heals 2. Sharp, sweet, slightly squashed.', icon: { shape: 'berries', color: '#7a2a5a', accent: '#3e7a3a' }, stackable: true, value: 2, heal: 2 }));
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
    equip: { slot: 'weapon', reqs: { magic: req }, style: 'magic', speed: 2.4, range: 9 + Math.floor(req / 30), bonus: { acc, magicDmg: dmg, defMagic: 4 + req / 5 }, affixPool: ['dmg_pct', 'crit', 'elite_dmg', 'accuracy', 'leech'] } }));
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
  max_hp: { id: 'max_hp', prefix: 'Hale', suffix: 'of Vigour', min: 1, max: 4, fmt: (v) => `+${v} max health` },
  armour: { id: 'armour', prefix: 'Sturdy', suffix: 'of the Bulwark', min: 2, max: 7, fmt: (v) => `+${v} defence against everything` },
  regen: { id: 'regen', prefix: 'Mending', suffix: 'of Mending', min: 1, max: 2, fmt: (v) => `+${v} health every 10s` },
  gather_speed: { id: 'gather_speed', prefix: 'Diligent', suffix: 'of Labour', min: 4, max: 10, fmt: (v) => `+${v}% gathering success` },
  xp_bonus: { id: 'xp_bonus', prefix: 'Studious', suffix: 'of Learning', min: 2, max: 5, fmt: (v) => `+${v}% skill experience` },
  // signature traits only (never rolled)
  durable: { id: 'durable', prefix: 'Tough', suffix: 'of Endurance', min: 40, max: 40, fmt: (v) => `Wears ${v}% slower` },
  sea_dmg: { id: 'sea_dmg', prefix: 'Sea-bane', suffix: 'of the Deep', min: 15, max: 15, fmt: (v) => `+${v}% damage to crabs and the Drowned` },
};
