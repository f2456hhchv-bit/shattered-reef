import { ITEMS, AFFIXES, RARITY, type Slot, type SkillId } from '../data/items';
import { QUESTS } from '../data/quests';
import { INV_SIZE, emptyInventory, type Inventory, type Stack } from './inventory';
import { MAX_XP, xpForLevel } from './xp';
import type { Stance } from './gear';
import { WORLD_HALF } from '../world/island';

// Versioned, validated save. Anything invalid is dropped or defaulted, never trusted.

export const SAVE_VERSION = 3;
export const BANK_MAX = 400; // distinct entries in the strongbox
export const SAVE_KEY = 'shattered-reef.save';

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  player: { x: number; z: number; hp: number; onShip: boolean; xp: Record<SkillId, number>; inv: Inventory; equip: Partial<Record<Slot, Stack>> };
  bank: Stack[]; // harbour strongbox: everything stacks unless it carries a rolled instance
  ship: { x: number; z: number; heading: number };
  quests: Record<string, number>;
  flags: Record<string, boolean>;
  discovered: string[];
  nextUid: number;
  settings: { quality: 'high' | 'low'; showDamage: boolean };
  combat: { stance: Stance; spell: string };
}

export const SKILL_IDS: SkillId[] = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'woodcutting', 'mining', 'fishing', 'smithing', 'gunsmithing', 'cooking'];
const SLOTS: Slot[] = ['weapon', 'ammo', 'head', 'body', 'ring'];
export const HP_START_XP = xpForLevel(10); // Hitpoints starts at 10, like RuneScape

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function validStack(v: unknown, banked = false): Stack | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== 'string' || !ITEMS[s.id]) return null;
  const qty = Math.floor(num(s.qty, 0, 0, 1e9));
  if (qty <= 0) return null;
  const out: Stack = { id: s.id, qty: ITEMS[s.id].stackable || (banked && !s.inst) ? qty : 1 };
  if (s.inst && typeof s.inst === 'object') {
    const i = s.inst as Record<string, unknown>;
    const rarity = typeof i.rarity === 'string' && i.rarity in RARITY ? (i.rarity as keyof typeof RARITY) : 'common';
    const affixes = Array.isArray(i.affixes)
      ? i.affixes.filter((a): a is { id: string; v: number } => !!a && typeof a.id === 'string' && !!AFFIXES[a.id] && typeof a.v === 'number').slice(0, 3)
      : [];
    out.inst = { uid: Math.floor(num(i.uid, 0)), rarity, affixes: affixes.map((a) => ({ id: a.id, v: a.v })) };
  }
  return out;
}

export function defaultSave(spawn: { x: number; z: number }, ship: { x: number; z: number; heading: number }): SaveData {
  const inv = emptyInventory();
  inv[0] = { id: 'hatchet_chipped', qty: 1 };
  inv[1] = { id: 'pickaxe_chipped', qty: 1 };
  inv[2] = { id: 'fishing_rod', qty: 1 };
  inv[3] = { id: 'bread', qty: 3 };
  inv[4] = { id: 'coins', qty: 25 };
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    playTime: 0,
    player: {
      x: spawn.x, z: spawn.z, hp: 10, onShip: false,
      xp: Object.fromEntries(SKILL_IDS.map((k) => [k, k === 'hitpoints' ? HP_START_XP : 0])) as Record<SkillId, number>,
      inv,
      equip: { weapon: { id: 'cutlass_rusty', qty: 1 } },
    },
    ship: { ...ship },
    quests: { bell: 0 },
    flags: {},
    discovered: [],
    bank: [],
    nextUid: 1,
    settings: { quality: 'high', showDamage: true },
    combat: { stance: 'accurate', spell: 'spray' },
  };
}

/** Migrations: add a function per version bump, keyed by the version it upgrades FROM. */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 had one "combat" skill: share its XP across the melee skills, keep Hitpoints at least level 10
  1: (d) => {
    const p = (d.player ?? {}) as Record<string, unknown>;
    const xp = { ...((p.xp ?? {}) as Record<string, unknown>) };
    const c = typeof xp.combat === 'number' && Number.isFinite(xp.combat) ? xp.combat : 0;
    delete xp.combat;
    xp.attack = xp.strength = xp.defence = Math.floor(c / 4);
    xp.hitpoints = Math.max(HP_START_XP, HP_START_XP + Math.floor(c / 4));
    return { ...d, version: 2, player: { ...p, xp, hp: 10 } };
  },
  // v2 had no strongbox
  2: (d) => ({ ...d, version: 3, bank: [] }),
};

/** Parse + validate untrusted JSON. Returns null when unusable (caller starts fresh). */
export function parseSave(json: string | null, fallback: SaveData): SaveData | null {
  if (!json) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  let v = num(raw.version, 0);
  if (v > SAVE_VERSION || v < 1) return null;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) return null;
    raw = m(raw);
    v++;
  }
  const d = structuredClone(fallback);
  const p = (raw.player ?? {}) as Record<string, unknown>;
  d.player.x = num(p.x, d.player.x, -WORLD_HALF, WORLD_HALF);
  d.player.z = num(p.z, d.player.z, -WORLD_HALF, WORLD_HALF);
  d.player.hp = num(p.hp, d.player.hp, 1, 10000);
  d.player.onShip = p.onShip === true;
  const xp = (p.xp ?? {}) as Record<string, unknown>;
  for (const k of SKILL_IDS) d.player.xp[k] = Math.floor(num(xp[k], d.player.xp[k], 0, MAX_XP));
  d.player.xp.hitpoints = Math.max(HP_START_XP, d.player.xp.hitpoints);
  if (Array.isArray(p.inv)) {
    const inv = emptyInventory();
    for (let i = 0; i < INV_SIZE; i++) inv[i] = validStack(p.inv[i]);
    d.player.inv = inv;
  }
  const eq = (p.equip ?? {}) as Record<string, unknown>;
  d.player.equip = {};
  for (const sl of SLOTS) {
    const s = validStack(eq[sl]);
    if (s && ITEMS[s.id].equip?.slot === sl) d.player.equip[sl] = sl === 'ammo' ? s : { ...s, qty: 1 };
  }
  const sh = (raw.ship ?? {}) as Record<string, unknown>;
  d.ship = { x: num(sh.x, d.ship.x, -WORLD_HALF, WORLD_HALF), z: num(sh.z, d.ship.z, -WORLD_HALF, WORLD_HALF), heading: num(sh.heading, d.ship.heading) };
  if (Array.isArray(raw.bank)) d.bank = raw.bank.map((b) => validStack(b, true)).filter((b): b is Stack => !!b).slice(0, BANK_MAX);
  const q = (raw.quests ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(QUESTS)) d.quests[id] = Math.floor(num(q[id], 0, 0, QUESTS[id].stages.length - 1));
  const f = (raw.flags ?? {}) as Record<string, unknown>;
  for (const [k, val] of Object.entries(f)) if (val === true) d.flags[k] = true;
  if (Array.isArray(raw.discovered)) d.discovered = raw.discovered.filter((x): x is string => typeof x === 'string').slice(0, 100);
  d.nextUid = Math.floor(num(raw.nextUid, 1, 1));
  d.playTime = num(raw.playTime, 0, 0);
  d.savedAt = num(raw.savedAt, 0, 0);
  const st = (raw.settings ?? {}) as Record<string, unknown>;
  d.settings = { quality: st.quality === 'low' ? 'low' : 'high', showDamage: st.showDamage !== false };
  const cb = (raw.combat ?? {}) as Record<string, unknown>;
  d.combat = {
    stance: cb.stance === 'aggressive' || cb.stance === 'defensive' ? cb.stance : 'accurate',
    spell: typeof cb.spell === 'string' ? cb.spell : 'spray',
  };
  return d;
}
