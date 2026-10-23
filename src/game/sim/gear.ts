import { item, AFFIXES, RARITY, type Rarity, type Slot } from '../data/items';
import { PLAYER_BASE } from '../data/content';
import type { Inst, Stack } from './inventory';
import { levelForXp } from './xp';

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
    // higher rarity rolls toward the top of the range
    const bias = rarity === 'relic' ? 0.5 : rarity === 'rare' ? 0.25 : 0;
    const t = bias + rnd() * (1 - bias);
    affixes.push({ id: a.id, v: Math.round(a.min + (a.max - a.min) * t) });
  }
  return { uid, rarity: n === RARITY[rarity].affixes ? rarity : 'common', affixes };
}

export interface PlayerStats {
  level: number;
  maxHp: number;
  damage: [number, number];
  swing: number; // seconds between swings
  crit: number; // 0..1
  armour: number;
  cleave: number; // 0..1
  eliteDmg: number; // 0..1
  leech: number; // 0..1
  regen: number; // hp per 5s
  gather: number; // 0..1
  xpBonus: number; // 0..1
}

export function computeStats(combatXp: number, equip: Partial<Record<Slot, Stack>>): PlayerStats {
  const level = levelForXp(combatXp);
  const s: PlayerStats = {
    level,
    maxHp: PLAYER_BASE.hp + PLAYER_BASE.hpPerLevel * (level - 1),
    damage: [1, 3],
    swing: 1.0,
    crit: 0.05,
    armour: 0,
    cleave: 0,
    eliteDmg: 0,
    leech: 0,
    regen: 0,
    gather: 0,
    xpBonus: 0,
  };
  let dmgPct = 0, speedPct = 0;
  for (const st of Object.values(equip)) {
    if (!st) continue;
    const e = item(st.id).equip;
    if (!e) continue;
    if (e.damage) s.damage = [...e.damage] as [number, number];
    if (e.speed) s.swing = e.speed;
    s.armour += e.armour ?? 0;
    s.maxHp += e.maxHp ?? 0;
    for (const a of st.inst?.affixes ?? []) {
      switch (a.id) {
        case 'dmg_pct': dmgPct += a.v; break;
        case 'atk_speed': speedPct += a.v; break;
        case 'crit': s.crit += a.v / 100; break;
        case 'cleave': s.cleave = Math.max(s.cleave, a.v / 100); break;
        case 'elite_dmg': s.eliteDmg += a.v / 100; break;
        case 'leech': s.leech += a.v / 100; break;
        case 'max_hp': s.maxHp += a.v; break;
        case 'armour': s.armour += a.v; break;
        case 'regen': s.regen += a.v; break;
        case 'gather_speed': s.gather += a.v / 100; break;
        case 'xp_bonus': s.xpBonus += a.v / 100; break;
      }
    }
  }
  const lvlMul = 1 + (level - 1) * 0.04;
  s.damage = [Math.max(1, Math.round(s.damage[0] * lvlMul * (1 + dmgPct / 100))), Math.max(1, Math.round(s.damage[1] * lvlMul * (1 + dmgPct / 100)))];
  s.swing = s.swing / (1 + speedPct / 100);
  return s;
}

/** Damage after armour. Diminishing returns: 30 armour halves damage. */
export const mitigate = (dmg: number, armour: number) => Math.max(1, Math.round(dmg * (30 / (30 + armour))));
