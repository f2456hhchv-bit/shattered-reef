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

describe('passage to Lockhaven', () => {
  it('Mercy won\'t ferry you to an uncharted island; after the parley she will', () => {
    const W = regionLayout('wrack');
    const g = new Game({ seed: 4, save: { ...defaultSave(W.respawn, W.mooring!), region: 'wrack' } });
    g.give('coins', 1000);
    const n = W.npcs.find((x) => x.id === 'mercy')!;
    const q = g.world.nearestWalkable(n.x + 1, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    let to = '';
    g.on((e) => { if (e.type === 'travel') to = e.to; });
    g.takeFerry('mercy', 'lockhaven');
    expect(to).toBe('');
    g.s.flags.parley_done = true;
    g.takeFerry('mercy', 'lockhaven');
    expect(to).toBe('lockhaven');
  });
});

describe('the Elder Lockjaw', () => {
  it('knock at the oldest door in the Ring of Thirteen; beat it; it scores its feats and nothing else\'s', () => {
    const L = regionLayout('lockhaven');
    const g = new Game({ seed: 9, save: { ...defaultSave(L.respawn, L.mooring!), region: 'lockhaven' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = 13_034_431; // 99
    g.p.equip.weapon = { id: 'cutlass_tide', qty: 1 }; g.recalc(); g.p.hp = g.stats.maxHp;
    const A = L.arenas.find((a) => a.boss === 'elder_lockjaw')!;
    const q = g.world.nearestWalkable(A.altar.x, A.altar.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`arena:${L.arenas.indexOf(A)}`);
    for (let t = 0; t < 300 && !g.s.flags.elderjaw_defeated; t += 1 / 30) { if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id; g.p.hp = g.stats.maxHp; g.step(1 / 30); }
    expect(g.s.flags.elderjaw_defeated).toBe(true);
    expect(g.s.flags.guardian_defeated).toBeFalsy();
    expect(g.s.feats).toContain('elder_lockjaw_kill');
  }, 60_000);
});
