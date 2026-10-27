import { ENEMIES, LOOT } from './content';
import { ITEMS } from './items';

// The collection log (RuneScape's, as the standard): every notable thing each source can give you, ticked off the
// first time it lands in your pack. Built from the loot tables, so a new foe or a new drop joins it by itself.

export interface CollectionGroup { id: string; name: string; level: number; boss: boolean; items: string[] }

/** worth a line in the log: gear, signature weapons, and anything rare enough to be worth a tick */
const notable = (id: string) => { const d = ITEMS[id]; return !!d && id !== 'coins' && (!!d.equip || d.value >= 400 || d.quest === true); };

const NAMES: Record<string, string> = { casket: 'Caskets', sea_chest: 'Sunken chests', treasure: 'Treasure' };

let cached: CollectionGroup[] | null = null;
export function collectionGroups(): CollectionGroup[] {
  if (cached) return cached;
  const out: CollectionGroup[] = [];
  for (const [key, t] of Object.entries(LOOT)) {
    const items = [...new Set([...t.drops.map((d) => d.item), ...(t.gear?.items ?? []), ...(t.sig ? [t.sig.item] : [])])].filter(notable);
    if (!items.length) continue;
    const foes = Object.values(ENEMIES).filter((e) => e.loot === key);
    const names = [...new Set(foes.map((e) => e.name))];
    const name = names.length ? names.slice(0, 2).join(' · ') + (names.length > 2 ? ` and ${names.length - 2} more` : '') : NAMES[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    out.push({ id: key, name, level: foes.length ? Math.min(...foes.map((e) => e.level)) : 999, boss: foes.some((e) => e.boss), items });
  }
  out.sort((a, b) => Number(b.boss) - Number(a.boss) || a.level - b.level);
  // made, not dropped: the jewellery you've enchanted (data/spellbook.ts)
  out.push({ id: 'enchanted', name: 'Enchanted jewellery', level: 999, boss: false, items: Object.keys(ITEMS).filter((id) => id.startsWith('ench_')) });
  return (cached = out);
}
export const COLLECTIBLE = (() => { const s = new Set<string>(); for (const g of collectionGroups()) for (const i of g.items) s.add(i); return s; })();
