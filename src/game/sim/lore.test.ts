import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { regionLayout } from '../world/layout';
import { LORE, KEEL_PAGES } from '../data/lore';
import { DIARIES } from '../data/diaries';

// Keel's Log (data/lore.ts): pages found where they lie, read like dialogue, kept in the journal.
describe('Keel\'s Log', () => {
  it('pages are numbered within the log, ids are unique, every island has some', () => {
    expect(new Set(LORE.map((l) => l.id)).size).toBe(LORE.length);
    for (const l of LORE.filter((x) => x.set === 'keel')) {
      const roman = l.title.split('page ')[1];
      const n = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'].indexOf(roman) + 1;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(KEEL_PAGES);
    }
    for (const r of ['bellwether', 'sunreach', 'amberhold', 'wrack']) expect(LORE.some((l) => l.region === r)).toBe(true);
  });

  it('walk up to a page and read it: it shows as a page, goes in the journal once, and counts for the diary', () => {
    const L = regionLayout('sunreach');
    const g = new Game({ seed: 2, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    const reads: string[] = [], said: string[] = [];
    g.on((e) => { if (e.type === 'read') reads.push(e.title); if (e.type === 'msg') said.push(e.text); });
    const pages = LORE.filter((l) => l.region === 'sunreach');
    for (const l of pages) {
      const q = g.world.nearestWalkable(l.x + 1.2, l.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
      expect(g.interact(`lore:${l.id}`)).toBe(true);
      for (let k = 0; k < 90 && !g.s.flags[`lore_${l.id}`]; k++) g.step(1 / 30);
      expect(g.s.flags[`lore_${l.id}`]).toBe(true);
    }
    expect(reads.length).toBe(pages.length);
    expect(said.filter((t) => t.includes('Keel\'s Log (')).length).toBe(pages.filter((l) => l.set === 'keel').length);
    // again from the journal: shown, not counted twice
    g.readLore(pages[0].id);
    expect(reads.length).toBe(pages.length + 1);
    expect(said.filter((t) => t.includes('journal')).length).toBe(pages.length);
    const d = DIARIES.find((x) => x.island === 'sunreach')!;
    expect(d.tasks.find((t) => t.id === 'lore')!.done(g)).toBe(true);
  });
});
