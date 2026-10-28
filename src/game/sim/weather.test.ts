import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { WEATHER } from '../data/sea';
import { regionLayout } from '../world/layout';
import type { RegionId } from '../world/regions';

// Weather at sea (docs/ISLANDS.md): spells of gale, fog and thunder on open water, fair to both sides.
const atSea = (region: RegionId, seed = 7) => {
  const L = regionLayout(region);
  const g = new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region } });
  g.p.xp.sailing = xpForLevel(30);
  for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
  // open water well out from the harbour, toward the island's middle
  const f0 = g.naval.foes[0] ?? { spawnX: L.mooring!.x, spawnZ: L.mooring!.z - 60 };
  const spot = g.nearestSea(f0.spawnX, f0.spawnZ)!;
  Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0, region }); g.p.onShip = true; g.p.x = spot[0]; g.p.z = spot[1];
  g.naval.hull = g.naval.hullMax();
  return g;
};
const run = (g: Game, secs: number, until?: () => boolean) => { for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until?.()) return true; } return false; };

describe('weather at sea', () => {
  it('Bellwether\'s waters stay sheltered; out from Sunreach a spell blows in, blows out, and pays a little Sailing XP', () => {
    const bell = atSea('bellwether');
    run(bell, WEATHER.every[1] + 5);
    expect(bell.naval.weather.kind).toBeNull();
    const g = atSea('sunreach');
    expect(run(g, WEATHER.every[0] + 5, () => g.naval.weather.kind !== null)).toBe(true);
    expect(WEATHER.kinds.sunreach).toContain(g.naval.weather.kind);
    const xp = g.p.xp.sailing;
    // ride it out at anchor (a gale would carry a drifting ship off the chart, whichever way the dice blow it)
    const hold = { x: g.ship.x, z: g.ship.z };
    run(g, WEATHER.lasts[1] + 2, () => { Object.assign(g.ship, hold); g.p.x = hold.x; g.p.z = hold.z; return g.naval.weather.kind === null; });
    expect(g.naval.weather.kind).toBeNull();
    expect(g.p.xp.sailing).toBeGreaterThanOrEqual(xp + WEATHER.xp);
  });

  it('a gale carries the ship downwind; fog halves how far foes see you', () => {
    const g = atSea('amberhold');
    g.naval.weather = { kind: 'gale', until: g.time + 30, next: 0, wind: 0, strikes: [], nextStrike: 0 };
    const x = g.ship.x;
    run(g, 2);
    expect(g.ship.x).toBeGreaterThan(x + 2);
    const f = atSea('amberhold', 9);
    const foe = f.naval.foes.find((o) => o.def.id === 'raider_longship')!;
    Object.assign(foe, { alive: true, respawnAt: 0, state: 'idle' });
    const d = foe.def.aggro * 0.75;
    foe.x = f.ship.x + d; foe.z = f.ship.z; foe.spawnX = foe.x; foe.spawnZ = foe.z;
    f.naval.weather = { kind: 'fog', until: f.time + 30, next: 0, wind: 0, strikes: [], nextStrike: 0 };
    run(f, 0.5);
    expect(foe.state).toBe('idle'); // can't see you
    f.naval.weather.kind = null;
    run(f, 0.5);
    expect(foe.state).not.toBe('idle');
  });

  it('thunder: marked strikes near the ship, and they hurt foes caught in them too', () => {
    const g = atSea('amberhold');
    const foe = g.naval.foes.find((o) => o.def.id === 'lindworm')!;
    Object.assign(foe, { alive: true, respawnAt: 0, state: 'surfaced', under: false, t: 99, cd: 99 });
    foe.x = g.ship.x + 8; foe.z = g.ship.z; foe.spawnX = foe.x; foe.spawnZ = foe.z;
    g.naval.weather = { kind: 'thunder', until: g.time + 30, next: 0, wind: 0, strikes: [{ id: 1, x: foe.x, z: foe.z, t: 0 }], nextStrike: g.time + 99 };
    const hp = foe.hp, hull = g.naval.hull;
    run(g, WEATHER.strikeWarn + 0.2);
    expect(foe.hp).toBeLessThan(hp);
    expect(g.naval.hull).toBe(hull); // it struck the foe, not you
  });
});
