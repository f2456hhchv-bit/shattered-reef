import { item, AFFIXES, RARITY, AMMO_FOR, weaponKind, ammoKind, type Rarity, type Slot, type SkillId, type CombatStyle, type WeaponKind, type AmmoKind } from '../data/items';
import { SPELLS } from '../data/content';
import { condOf, WORN_OUT_EFFECT, type Inst, type Stack } from './inventory';
import { levelForXp } from './xp';
import { perkTotal } from '../data/perks';

export function rollRarity(weights: Partial<Record<Rarity, number>>, rnd: () => number): Rarity {
  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** Rolls affixes from the item's own pool. Never duplicates, never invalid for the slot. */
export function makeInstance(id: string, rarity: Rarity, rnd: () => number, uid: number): Inst {
  const pool = [...(item(id).equip?.affixPool ?? [])];
  const n = Math.min(RARITY[rarity].affixes, pool.length);
  const affixes = [];
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rnd() * pool.length);
    const a = AFFIXES[pool.splice(i, 1)[0]];
    const bias = rarity === 'relic' ? 0.5 : rarity === 'rare' ? 0.25 : 0;
    const t = bias + rnd() * (1 - bias);
    affixes.push({ id: a.id, v: Math.round(a.min + (a.max - a.min) * t) });
  }
  return { uid, rarity: n === RARITY[rarity].affixes ? rarity : 'common', affixes };
}

// ---- RuneScape-style combat maths ---------------------------------------------

export type Stance = 'accurate' | 'aggressive' | 'defensive';

/** Chance an attack roll beats a defence roll (OSRS formula). */
export function hitChance(att: number, def: number): number {
  return att > def ? 1 - (def + 2) / (2 * (att + 1)) : att / (2 * (def + 1));
}
export const attackRoll = (effLevel: number, bonus: number) => effLevel * (bonus + 64);
export const maxHitFor = (effStr: number, strBonus: number) => Math.floor(0.5 + (effStr * (strBonus + 64)) / 640);

export type Levels = Record<SkillId, number>;

export function levelsOf(xp: Record<SkillId, number>): Levels {
  const out = {} as Levels;
  for (const k of Object.keys(xp) as SkillId[]) out[k] = levelForXp(xp[k]);
  return out;
}

/** OSRS combat level (no Prayer yet). */
export function combatLevel(l: Levels): number {
  const base = 0.25 * (l.defence + l.hitpoints);
  const melee = 0.325 * (l.attack + l.strength);
  const range = 0.325 * Math.floor(l.ranged * 1.5);
  const mage = 0.325 * Math.floor(l.magic * 1.5);
  return Math.floor(base + Math.max(melee, range, mage));
}

export interface PlayerStats {
  combatLevel: number;
  maxHp: number;
  style: CombatStyle;
  kind: WeaponKind; // weapon family
  needsAmmo: AmmoKind | null; // what the ammo slot must hold for this weapon
  speed: number; // seconds per attack
  range: number; // metres
  attRoll: number;
  maxHit: number;
  def: Record<CombatStyle, number>; // defence bonus per incoming style
  defLevel: number; // effective defence level
  ammo: string | null; // ranged: ammo id in slot
  spell: (typeof SPELLS)[number] | null;
  crit: number; // 0..1 chance to hit max
  cleave: number;
  eliteDmg: number;
  leech: number;
  regen: number; // per 10s
  gather: number;
  xpBonus: number;
  seaDmg: number; // vs crabs and the Drowned
  dr: number; // 0..1 damage reduction (defence perks)
  healBonus: number; // food heals this much more (fraction)
  ammoSave: number; // chance a shot isn't used
  charmSave: number; // chance a spell's charms aren't used
  /** which skills receive the 4 xp/damage */
  trains: SkillId[];
}

const sum = (a: number | undefined) => a ?? 0;

export function computeStats(xp: Record<SkillId, number>, equip: Partial<Record<Slot, Stack>>, stance: Stance, spellId: string): PlayerStats {
  const L = levelsOf(xp);
  const weapon = equip.weapon ? item(equip.weapon.id).equip : undefined;
  const style: CombatStyle = weapon?.style ?? 'melee';
  const kind = weaponKind(equip.weapon ? item(equip.weapon.id) : undefined), needsAmmo = AMMO_FOR[kind] ?? null;
  let acc = 0, str = 0, rangedStr = 0, magicDmg = 0;
  const def: Record<CombatStyle, number> = { melee: 0, ranged: 0, magic: 0 };
  let dmgPct = 0, speedPct = 0, crit = 0, cleave = 0, eliteDmg = 0, leech = 0, regen = 0, gather = 0, xpBonus = 0, hpBonus = 0, accAffix = 0, seaDmg = 0;
  for (const [slot, st] of Object.entries(equip) as [Slot, Stack][]) {
    const e = st && item(st.id).equip;
    if (!e) continue;
    const b = e.bonus;
    const k = condOf(st) <= 0 ? WORN_OUT_EFFECT : 1; // worn out: still works, less well
    if (slot === 'weapon') { acc += sum(b.acc) * k; str += sum(b.str) * k; }
    if (slot === 'ammo' && style === 'ranged' && ammoKind(item(st.id)) === needsAmmo) rangedStr += sum(b.rangedStr); // wrong ammo adds nothing
    magicDmg += sum(b.magicDmg) * k;
    def.melee += sum(b.defMelee) * k; def.ranged += sum(b.defRanged) * k; def.magic += sum(b.defMagic) * k;
    // the metal's signature trait counts like an affix (gathering traits only matter on tools, which aren't worn)
    for (const a of [...(item(st.id).innate ?? []), ...(st.inst?.affixes ?? [])]) {
      switch (a.id) {
        case 'sea_dmg': seaDmg += a.v / 100; break;
        case 'dmg_pct': dmgPct += a.v; break;
        case 'accuracy': accAffix += a.v; break;
        case 'atk_speed': speedPct += a.v; break;
        case 'crit': crit += a.v / 100; break;
        case 'cleave': cleave = Math.max(cleave, a.v / 100); break;
        case 'elite_dmg': eliteDmg += a.v / 100; break;
        case 'leech': leech += a.v / 100; break;
        case 'max_hp': hpBonus += a.v; break;
        case 'armour': def.melee += a.v; def.ranged += a.v; def.magic += a.v; break;
        case 'regen': regen += a.v; break;
        case 'gather_speed': gather += a.v / 100; break;
        case 'xp_bonus': xpBonus += a.v / 100; break;
      }
    }
  }
  const stanceAcc = stance === 'accurate' ? 3 : 0;
  const stanceStr = stance === 'aggressive' ? 3 : 0;
  const stanceDef = stance === 'defensive' ? 3 : 0;
  let attRoll: number, maxHit: number, trains: SkillId[];
  let spell = null;
  let ammo: string | null = null;
  if (style === 'melee') {
    attRoll = attackRoll(L.attack + stanceAcc + 8, acc + accAffix);
    maxHit = maxHitFor(L.strength + stanceStr + 8, str);
    trains = stance === 'accurate' ? ['attack'] : stance === 'aggressive' ? ['strength'] : ['defence'];
  } else if (style === 'ranged') {
    ammo = equip.ammo?.id ?? null;
    attRoll = attackRoll(L.ranged + stanceAcc + 8, acc + accAffix);
    maxHit = maxHitFor(L.ranged + stanceStr + 8, rangedStr);
    trains = stance === 'defensive' ? ['ranged', 'defence'] : ['ranged'];
  } else {
    spell = [...SPELLS].reverse().find((s) => s.id === spellId && s.level <= L.magic) ?? SPELLS[0];
    attRoll = attackRoll(L.magic + 8 + stanceAcc, acc + accAffix);
    maxHit = Math.floor(spell.maxHit * (1 + magicDmg / 100) + (L.magic >= spell.level + 10 ? 1 : 0));
    trains = stance === 'defensive' ? ['magic', 'defence'] : ['magic'];
  }
  // perks from the skills this style uses
  const accSkill: SkillId = style === 'melee' ? 'attack' : style, dmgSkill: SkillId = style === 'melee' ? 'strength' : style;
  attRoll = Math.round(attRoll * (1 + perkTotal(accSkill, L[accSkill], 'acc') / 100));
  dmgPct += perkTotal(dmgSkill, L[dmgSkill], 'dmg');
  crit += perkTotal(accSkill, L[accSkill], 'crit') / 100;
  if (style === 'melee') cleave = Math.max(cleave, perkTotal('strength', L.strength, 'cleave') / 100, kind === 'greatsword' ? 0.4 : 0);
  regen += perkTotal('hitpoints', L.hitpoints, 'regen');
  hpBonus += perkTotal('hitpoints', L.hitpoints, 'hp');
  maxHit = Math.max(1, Math.floor(maxHit * (1 + dmgPct / 100)));
  const baseSpeed = weapon?.speed ?? 2.4;
  return {
    combatLevel: combatLevel(L),
    maxHp: L.hitpoints + hpBonus,
    style,
    kind,
    needsAmmo,
    speed: (style === 'ranged' && stance === 'aggressive' ? baseSpeed * 0.75 : baseSpeed) / (1 + speedPct / 100), // "rapid"
    range: weapon?.range ?? 1.6,
    attRoll,
    maxHit,
    def,
    defLevel: L.defence + stanceDef + 8,
    ammo,
    spell,
    crit,
    cleave,
    eliteDmg,
    leech,
    regen,
    gather,
    xpBonus,
    seaDmg,
    dr: perkTotal('defence', L.defence, 'dr') / 100,
    healBonus: (perkTotal('hitpoints', L.hitpoints, 'heal') + perkTotal('cooking', L.cooking, 'heal')) / 100,
    ammoSave: perkTotal('ranged', L.ranged, 'ammo') / 100,
    charmSave: perkTotal('magic', L.magic, 'charms') / 100,
    trains,
  };
}

/** Requirement text for an item, or null if the player meets it. */
export function reqBlock(id: string, xp: Record<SkillId, number>): string | null {
  const e = item(id).equip;
  if (!e) return 'Not wearable';
  for (const [skill, lvl] of Object.entries(e.reqs) as [SkillId, number][]) {
    if (levelForXp(xp[skill]) < lvl) return `Needs ${skill[0].toUpperCase()}${skill.slice(1)} level ${lvl}`;
  }
  return null;
}
