import { ITEMS, AFFIXES, RARITY, type Slot, type SkillId } from '../data/items';
import { QUESTS } from '../data/quests';
import { INV_SIZE, emptyInventory, type Inventory, type Stack } from './inventory';
import { MAX_XP } from './xp';

// Versioned, validated save. Anything invalid is dropped or defaulted, never trusted.

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'shattered-reef.save';

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  player: { x: number; z: number; hp: number; onShip: boolean; xp: Record<SkillId, number>; inv: Inventory; equip: Partial<Record<Slot, Stack>> };
  ship: { x: number; z: number; heading: number };
  quests: Record<string, number>;
  flags: Record<string, boolean>;
  discovered: string[];
  nextUid: number;
  settings: { quality: 'high' | 'low'; showDamage: boolean };
}

const SKILL_IDS: SkillId[] = ['combat', 'woodcutting', 'mining', 'smithing', 'fishing', 'cooking'];
const SLOTS: Slot[] = ['weapon', 'head', 'body', 'ring'];

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function validStack(v: unknown): Stack | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== 'string' || !ITEMS[s.id]) return null;
  const qty = Math.floor(num(s.qty, 0, 0, 1e9));
  if (qty <= 0) return null;
  const out: Stack = { id: s.id, qty: ITEMS[s.id].stackable ? qty : 1 };
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
      x: spawn.x, z: spawn.z, hp: 40, onShip: false,
      xp: Object.fromEntries(SKILL_IDS.map((k) => [k, 0])) as Record<SkillId, number>,
      inv,
      equip: { weapon: { id: 'cutlass_rusty', qty: 1 } },
    },
    ship: { ...ship },
    quests: { bell: 0 },
    flags: {},
    discovered: [],
    nextUid: 1,
    settings: { quality: 'high', showDamage: true },
  };
}

/** Migrations: add a function per version bump, keyed by the version it upgrades FROM. */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

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
  d.player.x = num(p.x, d.player.x, -100, 100);
  d.player.z = num(p.z, d.player.z, -100, 100);
  d.player.hp = num(p.hp, d.player.hp, 1, 10000);
  d.player.onShip = p.onShip === true;
  const xp = (p.xp ?? {}) as Record<string, unknown>;
  for (const k of SKILL_IDS) d.player.xp[k] = Math.floor(num(xp[k], 0, 0, MAX_XP));
  if (Array.isArray(p.inv)) {
    const inv = emptyInventory();
    for (let i = 0; i < INV_SIZE; i++) inv[i] = validStack(p.inv[i]);
    d.player.inv = inv;
  }
  const eq = (p.equip ?? {}) as Record<string, unknown>;
  d.player.equip = {};
  for (const sl of SLOTS) {
    const s = validStack(eq[sl]);
    if (s && ITEMS[s.id].equip?.slot === sl) d.player.equip[sl] = s;
  }
  const sh = (raw.ship ?? {}) as Record<string, unknown>;
  d.ship = { x: num(sh.x, d.ship.x, -100, 100), z: num(sh.z, d.ship.z, -100, 100), heading: num(sh.heading, d.ship.heading) };
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
  return d;
}
