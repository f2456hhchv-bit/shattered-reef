import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { BOTTLES, BOTTLE_CONFIG } from '../data/bottles';

const base = new Game({ seed: 1 });

describe('messages in bottles', () => {
  it('out at sea a bottle turns up ahead; sail over it and it\'s read and kept; once all are read, maps and charms', () => {
    const g = new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    // out of harbour, on open water
    const mo = g.layout.mooring!;
    let spot: [number, number] | null = null;
    for (let r = 60; r < 200 && !spot; r += 10) for (let k = 0; k < 16 && !spot; k++) { const a = (k / 16) * Math.PI * 2, x = mo.x + Math.cos(a) * r, z = mo.z + Math.sin(a) * r; if (g.world.seaClear(x, z) && g.world.seaClear(x + Math.cos(a) * 30, z + Math.sin(a) * 30)) { spot = [x, z]; g.ship.heading = a; } }
    g.ship.x = spot![0]; g.ship.z = spot![1]; g.p.x = g.ship.x; g.p.z = g.ship.z;
    const titles: string[] = [];
    g.on((e) => { if (e.type === 'read') titles.push(e.title); });
    for (let t = 0; t < BOTTLE_CONFIG.every[1] + 30 && !g.bottles.bottle; t += 0.1) { g.step(0.1); g.ship.x = spot![0]; g.ship.z = spot![1]; }
    const b = g.bottles.bottle!;
    expect(b).toBeTruthy();
    g.ship.x = b.x; g.ship.z = b.z; g.p.x = b.x; g.p.z = b.z;
    g.step(1 / 30);
    expect(g.bottles.bottle).toBeNull();
    expect(g.s.bottles?.length).toBe(1);
    expect(titles.length).toBe(1);
    // every note read: the sea sends maps and charms instead
    g.s.bottles = BOTTLES.map((x) => x.id);
    const before = JSON.stringify(g.p.inv);
    (g.bottles as unknown as { haul(): void }).haul();
    expect(JSON.stringify(g.p.inv)).not.toBe(before);
    expect(titles.length).toBe(1);
  }, 60_000);
});
