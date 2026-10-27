import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';
import { DOORS } from '../data/doors';
import { KEY } from '../data/keys';
import { ITEMS } from '../data/items';

// Wardwright doors (data/doors.ts): each opens to its House's key, or the Skeleton Key; once; the record is kept.
const at = (region: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack') => { const L = regionLayout(region); const g = new Game({ seed: 5, save: { ...defaultSave(L.respawn, L.mooring!), region } }); for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } return g; };
const walkTo = (g: Game, key: string) => { const t = g.targets().find((x) => x.key === key)!; expect(g.interact(key)).toBe(true); for (let k = 0; k < 4000 && (g.pending || g.path.length); k++) g.step(1 / 30); return t; };

describe('Wardwright doors', () => {
  it('every door wants a real key and gives real things, one per House', () => {
    expect(new Set(DOORS.map((d) => d.id)).size).toBe(DOORS.length);
    for (const d of DOORS) {
      expect(KEY[d.key]).toBeTruthy();
      for (const r of d.reward) expect(ITEMS[r.id]).toBeTruthy();
      expect(d.record.lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('without the key it stays shut and says which key it wants; with it, it opens once; the Skeleton Key fits too', () => {
    const g = at('bellwether');
    const said: string[] = [], reads: string[] = [];
    g.on((e) => { if (e.type === 'msg') said.push(e.text); if (e.type === 'read') reads.push(e.title); });
    const d = DOORS.find((x) => x.id === 'green')!;
    walkTo(g, 'door:green');
    expect(g.s.flags.door_green).toBeFalsy();
    expect(said.some((t) => t.includes('Woodsman'))).toBe(true);
    g.s.keyring.push('woodsman');
    walkTo(g, 'door:green');
    expect(g.s.flags.door_green).toBe(true);
    expect(count(g.p.inv, 'logs_yew')).toBe(d.reward.find((r) => r.id === 'logs_yew')!.qty);
    expect(reads).toContain(d.record.title);
    // again: no second helping
    walkTo(g, 'door:green');
    expect(count(g.p.inv, 'logs_yew')).toBe(d.reward.find((r) => r.id === 'logs_yew')!.qty);
    // the Skeleton Key opens another House's door
    g.s.keyring.push('skeleton');
    walkTo(g, 'door:vein');
    expect(g.s.flags.door_vein).toBe(true);
  });
});
