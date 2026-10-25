import { item, ITEMS, RARITY, AFFIXES, type Rarity } from '../data/items';

export const INV_SIZE = 40;

export interface Affix { id: string; v: number }
export interface Inst { uid: number; rarity: Rarity; affixes: Affix[] }
export interface Stack { id: string; qty: number; inst?: Inst; cond?: number } // cond: 0..100 condition (absent = 100)

const WEARING_SLOTS = new Set(['weapon', 'offhand', 'head', 'body', 'legs', 'feet', 'hands']);
/** Weapons, armour, off-hands and tools wear with use; ammo, jewellery and consumables don't. */
export function wears(id: string): boolean {
  const d = ITEMS[id];
  if (!d) return false;
  if (d.tool) return true;
  return !!d.equip && WEARING_SLOTS.has(d.equip.slot);
}
export const condOf = (s: Stack | null | undefined) => (s && wears(s.id) ? s.cond ?? 100 : 100);
/** A worn-out item still works, at reduced effect: nothing ever breaks or vanishes. */
export const WORN_OUT_EFFECT = 0.7;
export type Inventory = (Stack | null)[];

export const emptyInventory = (): Inventory => Array.from({ length: INV_SIZE }, () => null);

export function count(inv: Inventory, id: string): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.qty;
  return n;
}

export function freeSlots(inv: Inventory): number {
  return inv.reduce((n, s) => n + (s ? 0 : 1), 0);
}

export function canAdd(inv: Inventory, id: string, qty = 1): boolean {
  const d = item(id);
  if (d.stackable && inv.some((s) => s && s.id === id && !s.inst)) return true;
  return freeSlots(inv) >= (d.stackable ? 1 : qty);
}

/** Adds as much as fits. Returns the quantity that did NOT fit. */
export function add(inv: Inventory, stack: Stack): number {
  const d = item(stack.id);
  if (d.stackable && !stack.inst) {
    const existing = inv.find((s) => s && s.id === stack.id && !s.inst);
    if (existing) { existing.qty += stack.qty; return 0; }
    const i = inv.indexOf(null);
    if (i < 0) return stack.qty;
    inv[i] = { id: stack.id, qty: stack.qty };
    return 0;
  }
  let left = stack.qty;
  while (left > 0) {
    const i = inv.indexOf(null);
    if (i < 0) break;
    inv[i] = { id: stack.id, qty: 1, inst: stack.inst };
    left--;
  }
  return left;
}

/** Removes qty of id if available. All-or-nothing. */
export function remove(inv: Inventory, id: string, qty: number): boolean {
  if (count(inv, id) < qty) return false;
  let left = qty;
  for (let i = 0; i < inv.length && left > 0; i++) {
    const s = inv[i];
    if (!s || s.id !== id) continue;
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
    if (s.qty <= 0) inv[i] = null;
  }
  return true;
}

export function displayName(s: Stack): string {
  const base = item(s.id).name;
  if (!s.inst || !s.inst.affixes.length) return base;
  const a = s.inst.affixes;
  const pre = AFFIXES[a[0].id]?.prefix ?? '';
  const suf = a.length > 1 ? ` ${AFFIXES[a[1].id]?.suffix ?? ''}` : '';
  return `${pre} ${base}${suf}`.trim();
}

export function stackValue(s: Stack): number {
  const d = item(s.id);
  return Math.floor(d.value * (s.inst ? RARITY[s.inst.rarity].valueMul : 1));
}

export type SortMode = 'type' | 'value' | 'quality';
const RARITY_RANK = { common: 0, fine: 1, rare: 2, relic: 3 } as const;
/** Group order for "type": coins, quest items, tools, weapons, armour, ammo, food (best first), things to open, materials. */
function typeRank(s: Stack): number {
  const d = item(s.id);
  if (s.id === 'coins') return 0;
  if (d.quest) return 1;
  if (d.tool) return 2;
  if (d.equip?.slot === 'weapon') return 3;
  if (d.equip?.slot === 'ammo') return 5;
  if (d.equip) return 4;
  if (d.heal) return 6;
  if (d.opens) return 7;
  return 8;
}
const MAT_ORDER = ['logs_', 'ore_', 'bar_', 'fish_'];
/** Auto-sort the pack (Tom: by value, quality etc.). Items keep their stacks; empty slots go to the end. */
export function sortInventory(inv: Inventory, mode: SortMode) {
  const items = inv.filter((s): s is Stack => !!s);
  const unit = (s: Stack) => stackValue({ ...s, qty: 1 });
  const mat = (s: Stack) => { const k = MAT_ORDER.findIndex((p) => s.id.startsWith(p)); return k < 0 ? MAT_ORDER.length : k; };
  const rank = (s: Stack) => RARITY_RANK[s.inst?.rarity ?? 'common'];
  items.sort((a, b) => {
    if (mode === 'value') return unit(b) * b.qty - unit(a) * a.qty || item(a.id).name.localeCompare(item(b.id).name); // the whole stack's worth
    if (mode === 'quality') return rank(b) - rank(a) || unit(b) - unit(a) || item(a.id).name.localeCompare(item(b.id).name);
    return typeRank(a) - typeRank(b) || (item(b.id).heal ?? 0) - (item(a.id).heal ?? 0) || mat(a) - mat(b) || unit(b) - unit(a) || item(a.id).name.localeCompare(item(b.id).name);
  });
  for (let i = 0; i < inv.length; i++) inv[i] = items[i] ?? null;
}
