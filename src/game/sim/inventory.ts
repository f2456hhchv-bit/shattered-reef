import { item, ITEMS, RARITY, AFFIXES, type Rarity } from '../data/items';

export const INV_SIZE = 28;

export interface Affix { id: string; v: number }
export interface Inst { uid: number; rarity: Rarity; affixes: Affix[] }
export interface Stack { id: string; qty: number; inst?: Inst; cond?: number } // cond: 0..100 condition (absent = 100)

/** Weapons, armour and tools wear with use; ammo, rings and consumables don't. */
export function wears(id: string): boolean {
  const d = ITEMS[id];
  if (!d) return false;
  if (d.tool) return true;
  return !!d.equip && (d.equip.slot === 'weapon' || d.equip.slot === 'head' || d.equip.slot === 'body');
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
