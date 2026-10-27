import { ITEMS, AFFIXES, RARITY, pairGroup, offhandBlock, type Slot, type SkillId } from '../data/items';
import { QUESTS } from '../data/quests';
import { INV_SIZE, emptyInventory, type Inventory, type Stack } from './inventory';
import { MAX_XP, xpForLevel } from './xp';
import type { Stance } from './gear';
import { REGIONS, regionAt, type RegionId } from '../world/regions';
import { SUN } from '../world/island';
import { KEY, STARTER_KEY } from '../data/keys';
import { BOARDS, CREW_BY, BOUNTY_CONFIG, type Contract } from '../data/bounties';
import { ENEMIES } from '../data/content';

// Versioned, validated save. Anything invalid is dropped or defaulted, never trusted.

export const SAVE_VERSION = 8;
export const BANK_MAX = 400;
const KEY_DORMANT_MAX = 3600; // distinct entries in the strongbox
export const SAVE_KEY = 'shattered-reef.save';

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  /** the region the player is in (only that one is loaded) */
  region: RegionId;
  player: { x: number; z: number; hp: number; onShip: boolean; xp: Record<SkillId, number>; inv: Inventory; equip: Partial<Record<Slot, Stack>> };
  bank: Stack[]; // harbour strongbox: everything stacks unless it carries a rolled instance
  ship: { x: number; z: number; heading: number; region: RegionId };
  quests: Record<string, number>;
  flags: Record<string, boolean>;
  discovered: string[];
  nextUid: number;
  settings: { quality: 'auto' | 'max' | 'low'; showDamage: boolean; music: boolean; sfx: boolean; nodeLevels: boolean; showFps: boolean; devFreeKeys: boolean };
  /** keys you've found (permanent), the one slotted in you, and how long it still sleeps after a swap (seconds of play) */
  keyring: string[];
  key: string | null;
  keyDormant: number;
  combat: { stance: Stance; spell: string };
  /** your own bounty, the boards' current offers, the contracts you carry, your crew and who comes ashore */
  bounty: number;
  boards: Record<string, { offers: Contract[]; refreshAt: number }>;
  contracts: Contract[];
  crew: string[];
  /** the shipwright's refits: tier per part (data/shipyard.ts) */
  shipyard?: Partial<Record<'hull' | 'sails' | 'guns' | 'plating', number>>;
  mate: string | null;
  hunterAt: number; // play time of the next bounty-hunter ambush (once your bounty is big enough)
  /** the treasure map you're following: an X in the water off an island */
  treasure: { region: RegionId; x: number; z: number } | null;
}

export const SKILL_IDS: SkillId[] = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'woodcutting', 'mining', 'fishing', 'smithing', 'gunsmithing', 'fletching', 'cooking', 'crafting', 'sailing'];
const SLOTS: Slot[] = ['weapon', 'offhand', 'ammo', 'head', 'body', 'legs', 'feet', 'hands', 'neck', 'wrist', 'ring', 'ring2'];
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
  if (typeof s.cond === 'number' && Number.isFinite(s.cond) && s.cond < 100) out.cond = Math.max(0, s.cond);
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
    region: 'bellwether',
    player: {
      x: spawn.x, z: spawn.z, hp: 100, onShip: false,
      xp: Object.fromEntries(SKILL_IDS.map((k) => [k, k === 'hitpoints' ? HP_START_XP : 0])) as Record<SkillId, number>,
      inv,
      equip: { weapon: { id: 'cutlass_rusty', qty: 1 } },
    },
    ship: { ...ship, region: 'bellwether' },
    quests: { bell: 0 },
    flags: {},
    discovered: [],
    bank: [],
    nextUid: 1,
    settings: { quality: 'auto', showDamage: true, music: true, sfx: true, nodeLevels: true, showFps: false, devFreeKeys: false },
    keyring: [STARTER_KEY],
    key: STARTER_KEY,
    keyDormant: 0,
    combat: { stance: 'accurate', spell: 'spray' },
    bounty: 0,
    boards: {},
    contracts: [],
    crew: [],
    mate: null,
    hunterAt: 0,
    treasure: null,
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
  // v3 had one seamless world with Sunreach at x = 190; v4 loads one region at a time and moved Sunreach east
  3: (d) => {
    const OLD_SUN_X = 190, shift = SUN.x - OLD_SUN_X;
    const onSun = (x: unknown, z: unknown) => typeof x === 'number' && typeof z === 'number' && Math.hypot(x - OLD_SUN_X, z - SUN.z) < 115 && x > 95;
    const p = { ...((d.player ?? {}) as Record<string, unknown>) }, sh = { ...((d.ship ?? {}) as Record<string, unknown>) };
    const pSun = onSun(p.x, p.z), sSun = onSun(sh.x, sh.z);
    if (pSun) p.x = (p.x as number) + shift;
    if (sSun) sh.x = (sh.x as number) + shift;
    return { ...d, version: 4, player: p, ship: { ...sh, region: sSun ? 'sunreach' : 'bellwether' }, region: pSun ? 'sunreach' : 'bellwether' };
  },
  // v4 kept health in RuneScape's small numbers; v5 stores it ×10 (100 at the start, 990 at 99)
  4: (d) => {
    const p = { ...((d.player ?? {}) as Record<string, unknown>) };
    if (typeof p.hp === 'number') p.hp = p.hp * 10;
    return { ...d, version: 5, player: p };
  },
  // v5 had the pistol brace (one item, two pistols); v6 has a real off-hand, so each brace becomes two pistols:
  // worn, one in each hand; in the pack, the second goes in a free slot (or the strongbox when the pack is full)
  5: (d) => {
    const PAIR: Record<string, string> = { bronze: 'pistol_flintlock', iron: 'pistol_iron' };
    const single = (id: unknown) => (typeof id === 'string' && id.startsWith('pistols_') ? PAIR[id.slice(8)] ?? `pistol_${id.slice(8)}` : null);
    const p = { ...((d.player ?? {}) as Record<string, unknown>) };
    const inv = Array.isArray(p.inv) ? [...p.inv] : [];
    const bank = Array.isArray(d.bank) ? [...d.bank] : [];
    const spare: Record<string, unknown>[] = [];
    const conv = (st: unknown): Record<string, unknown> | null => {
      const o = st as Record<string, unknown> | null;
      const to = o && single(o.id);
      if (!o || !to) return null;
      spare.push({ id: to, qty: 1 });
      return { ...o, id: to };
    };
    const eq = { ...((p.equip ?? {}) as Record<string, unknown>) };
    const w = conv(eq.weapon);
    if (w) { eq.weapon = w; eq.offhand = spare.pop(); }
    for (let i = 0; i < inv.length; i++) { const c = conv(inv[i]); if (c) inv[i] = c; }
    for (const sp of spare) { const free = inv.findIndex((x, i) => !x && i < INV_SIZE); if (free >= 0) inv[free] = sp; else bank.push(sp); }
    const bank2 = bank.map((b) => { const o = b as Record<string, unknown>; const to = o && single(o.id); return to ? { ...o, id: to, qty: (typeof o.qty === 'number' ? o.qty : 1) * 2 } : b; });
    return { ...d, version: 6, bank: bank2, player: { ...p, inv, equip: eq } };
  },
  // v6 had no keys: everyone gets the starter key, slotted and awake
  6: (d) => ({ ...d, version: 7, keyring: [STARTER_KEY], key: STARTER_KEY, keyDormant: 0 }),
  // v7 had no bounties or crew
  7: (d) => ({ ...d, version: 8, bounty: 0, boards: {}, contracts: [], crew: [], mate: null, hunterAt: 0 }),
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
  const isRegion = (v: unknown): v is RegionId => typeof v === 'string' && v in REGIONS;
  d.player.x = num(p.x, d.player.x, -5000, 5000);
  d.player.z = num(p.z, d.player.z, -5000, 5000);
  d.region = isRegion(raw.region) ? raw.region : regionAt(d.player.x, d.player.z);
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
    const at = s && ITEMS[s.id].equip?.slot;
    // rings fit either ring slot; the off-hand also takes a one-handed weapon (checked against the main hand below)
    const fits = !!at && (at === sl || (sl === 'ring2' && at === 'ring') || (sl === 'offhand' && !!pairGroup(ITEMS[s!.id])));
    if (fits) d.player.equip[sl] = sl === 'ammo' ? s! : { ...s!, qty: 1 };
  }
  // an off-hand that can't sit beside the weapon goes to the pack (or the strongbox): never lost
  const off = d.player.equip.offhand, main = d.player.equip.weapon;
  let offOut: Stack | null = null;
  if (off && offhandBlock(main ? ITEMS[main.id] : undefined, ITEMS[off.id])) {
    delete d.player.equip.offhand;
    const free = d.player.inv.indexOf(null);
    if (free >= 0) d.player.inv[free] = off; else offOut = off;
  }
  const sh = (raw.ship ?? {}) as Record<string, unknown>;
  d.ship = { x: num(sh.x, d.ship.x, -5000, 5000), z: num(sh.z, d.ship.z, -5000, 5000), heading: num(sh.heading, d.ship.heading), region: 'bellwether' };
  d.ship.region = isRegion(sh.region) && REGIONS[sh.region].kind === 'island' ? sh.region : regionAt(d.ship.x, d.ship.z);
  if (REGIONS[d.ship.region].kind !== 'island') d.ship.region = 'bellwether';
  // a position outside its region's square is corrupt: the game puts you back at that region's start
  const rb = REGIONS[d.region].bounds;
  if (Math.abs(d.player.x - rb.cx) > rb.half || Math.abs(d.player.z - rb.cz) > rb.half) { d.player.x = rb.cx; d.player.z = rb.cz; d.player.onShip = false; }
  if (REGIONS[d.region].kind === 'cave' || d.ship.region !== d.region) d.player.onShip = false;
  if (Array.isArray(raw.bank)) d.bank = raw.bank.map((b) => validStack(b, true)).filter((b): b is Stack => !!b).slice(0, BANK_MAX);
  if (offOut) d.bank.push(offOut);
  const q = (raw.quests ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(QUESTS)) d.quests[id] = Math.floor(num(q[id], 0, 0, QUESTS[id].stages.length - 1));
  const f = (raw.flags ?? {}) as Record<string, unknown>;
  for (const [k, val] of Object.entries(f)) if (val === true) d.flags[k] = true;
  if (Array.isArray(raw.discovered)) d.discovered = raw.discovered.filter((x): x is string => typeof x === 'string').slice(0, 100);
  d.nextUid = Math.floor(num(raw.nextUid, 1, 1));
  d.playTime = num(raw.playTime, 0, 0);
  d.savedAt = num(raw.savedAt, 0, 0);
  const st = (raw.settings ?? {}) as Record<string, unknown>;
  // the old 'high' was everyone's default before Auto existed, so it becomes Auto; 'max' is a deliberate choice
  d.settings = { quality: st.quality === 'low' ? 'low' : st.quality === 'max' ? 'max' : 'auto', showDamage: st.showDamage !== false, music: st.music !== false, sfx: st.sfx !== false, nodeLevels: st.nodeLevels !== false, showFps: st.showFps === true, devFreeKeys: st.devFreeKeys === true };
  // keys: only known ids; the starter is always on the ring; a slotted key must be on it
  const ring = Array.isArray(raw.keyring) ? raw.keyring.filter((k): k is string => typeof k === 'string' && !!KEY[k]) : [];
  d.keyring = [...new Set([STARTER_KEY, ...ring])];
  d.key = typeof raw.key === 'string' && d.keyring.includes(raw.key) ? raw.key : raw.key === null ? null : STARTER_KEY;
  d.keyDormant = num(raw.keyDormant, 0, 0, KEY_DORMANT_MAX);
  // bounties and crew: contracts must name a real board and foe; only known crew; the mate must be crew
  const contract = (c: unknown): Contract | null => {
    const o = c as Record<string, unknown>;
    if (!o || typeof o !== 'object' || typeof o.board !== 'string' || !BOARDS[o.board] || typeof o.enemy !== 'string' || !ENEMIES[o.enemy]) return null;
    const kind = o.kind === 'wanted' ? 'wanted' : 'hunt';
    const out: Contract = { id: Math.floor(num(o.id, 0)), board: o.board, kind, enemy: o.enemy, need: Math.floor(num(o.need, 1, 1, 100)), have: Math.floor(num(o.have, 0, 0, 100)), coins: Math.floor(num(o.coins, 0, 0, 1e7)), bounty: Math.floor(num(o.bounty, 0, 0, 1e7)) };
    if (kind === 'wanted') {
      if (typeof o.region !== 'string' || !(o.region in REGIONS)) return null;
      out.name = typeof o.name === 'string' ? o.name.slice(0, 40) : 'Nameless'; out.region = o.region as RegionId; out.x = num(o.x, 0, -5000, 5000); out.z = num(o.z, 0, -5000, 5000);
    }
    return out;
  };
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map(contract).filter((c): c is Contract => !!c).slice(0, max) : []);
  d.bounty = Math.floor(num(raw.bounty, 0, 0, 1e9));
  d.contracts = list(raw.contracts, BOUNTY_CONFIG.maxActive);
  const bd = (raw.boards ?? {}) as Record<string, unknown>;
  d.boards = {};
  for (const id of Object.keys(BOARDS)) { const b = bd[id] as Record<string, unknown> | undefined; if (b) d.boards[id] = { offers: list(b.offers, BOUNTY_CONFIG.offers), refreshAt: num(b.refreshAt, 0, 0) }; }
  d.crew = Array.isArray(raw.crew) ? [...new Set(raw.crew.filter((c): c is string => typeof c === 'string' && !!CREW_BY[c]))] : [];
  d.mate = typeof raw.mate === 'string' && d.crew.includes(raw.mate) ? raw.mate : null;
  d.hunterAt = num(raw.hunterAt, 0, 0);
  const tr = raw.treasure as Record<string, unknown> | null | undefined;
  d.treasure = tr && typeof tr === 'object' && isRegion(tr.region) ? { region: tr.region, x: num(tr.x, 0, -5000, 5000), z: num(tr.z, 0, -5000, 5000) } : null;
  const cb = (raw.combat ?? {}) as Record<string, unknown>;
  d.combat = {
    stance: cb.stance === 'aggressive' || cb.stance === 'defensive' ? cb.stance : 'accurate',
    spell: typeof cb.spell === 'string' ? cb.spell : 'spray',
  };
  return d;
}
