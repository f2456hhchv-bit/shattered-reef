import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { regionLayout } from '../world/layout';
import { REGIONS } from '../world/regions';
import { LOCK } from '../world/island';
import { DOORS } from '../data/doors';
import { LORE } from '../data/lore';

describe('Lockhaven', () => {
  it('is its own region with a landing, Orla, stations, a bank, the island\'s foes, doors and pages', () => {
    const L = regionLayout('lockhaven');
    expect(L.npcs.some((n) => n.id === 'orla')).toBe(true);
    expect(L.stations.length).toBeGreaterThanOrEqual(4);
    expect(L.banks.length).toBe(1);
    expect(L.spawns.length).toBeGreaterThanOrEqual(10);
    expect(L.nodes.filter((n) => !n.scenery).length).toBeGreaterThan(10);
    expect(DOORS.filter((d) => d.region === 'lockhaven').length).toBe(4);
    expect(LORE.filter((l) => l.region === 'lockhaven').length).toBe(3);
    expect(Math.hypot(L.respawn.x - LOCK.x, L.respawn.z - LOCK.z)).toBeLessThan(70);
  });

  it('is uncharted until the parley: sailing east from Stormwrack turns you back; after it, you cross', () => {
    const W = regionLayout('wrack'), b = REGIONS.wrack.bounds;
    const mk = (flag: boolean) => {
      const g = new Game({ seed: 4, save: { ...defaultSave(W.respawn, W.mooring!), region: 'wrack' } });
      g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
      if (flag) g.s.flags.parley_done = true;
      g.p.onShip = true;
      // just shy of the eastern edge, heading east
      g.ship.x = b.cx + b.half - 17; g.ship.z = b.cz + 60; g.ship.heading = 0; g.p.x = g.ship.x; g.p.z = g.ship.z;
      return g;
    };
    const shut = mk(false), warns: string[] = [];
    shut.on((e) => { if (e.type === 'msg') warns.push(e.text); });
    shut.setMoveDir(1, 0);
    for (let t = 0; t < 4; t += 1 / 30) shut.step(1 / 30);
    expect(shut.s.region).toBe('wrack');
    expect(warns.some((w) => w.includes('chart ends'))).toBe(true);
    const open = mk(true);
    let went = false;
    open.on((e) => { if (e.type === 'travel' && e.to === 'lockhaven') went = true; });
    open.setMoveDir(1, 0);
    for (let t = 0; t < 4 && !went; t += 1 / 30) open.step(1 / 30);
    expect(went).toBe(true);
  }, 60_000);
});
