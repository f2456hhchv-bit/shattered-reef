import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { NAVAL, AMMO, KRAKEN } from '../data/sea';
import { regionLayout } from '../world/layout';
import { AMBER as SUN } from '../world/island';
import { REGIONS } from '../world/regions';
import type { SeaFoe } from './naval';
import type { AmmoId } from '../data/sea';

// Amberhold's waters (docs/ISLANDS.md slice 3): raider longships, lindworms and the Kraken's first sighting.
const L = regionLayout('amberhold');
const sun = (seed = 7) => new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } });

/** Aboard in open water off this foe's lair, every other foe asleep; the foe placed `dist` off the given bearing. */
function atSea(foeId: string, sailing: number, bearing = Math.PI / 2, dist = 10, seed = 7) {
  const g = sun(seed);
  g.p.xp.sailing = xpForLevel(sailing);
  const f = g.naval.foes.find((x) => x.def.id === foeId)!;
  const spot = g.nearestSea(f.spawnX + (SUN.x - f.spawnX) * 0.18, f.spawnZ + (SUN.z - f.spawnZ) * 0.18)!; // in from its lair, toward the island
  Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0, region: 'amberhold' });
  g.p.onShip = true; g.p.x = spot[0]; g.p.z = spot[1];
  for (const o of g.naval.foes) if (o !== f) { o.alive = false; o.respawnAt = Infinity; }
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  const at = [spot[0] + Math.cos(bearing) * dist, spot[1] + Math.sin(bearing) * dist];
  f.x = at[0]; f.z = at[1]; f.spawnX = at[0]; f.spawnZ = at[1];
  g.naval.hull = g.naval.hullMax();
  return { g, f };
}

/** Hold the foe on the beam and fire with the given ammo; charges at anything under; turn away from a lit fire ship. */
function fight(g: Game, f: SeaFoe, ammo: AmmoId, secs = 300) {
  const sh = g.ship;
  for (let t = 0; t < secs && f.alive; t += 1 / 30) {
    const fuse = f.def.behaviour === 'fireship' && f.state === 'aim';
    const toward = Math.atan2(f.z - sh.z, f.x - sh.x);
    const want = fuse ? toward + Math.PI : toward - Math.PI / 2; // run from a lit fire ship; otherwise beam-on
    const diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
    sh.heading += Math.max(-1.25 / 30, Math.min(1.25 / 30, diff));
    if (fuse) g.shipSpeed = Math.max(g.shipSpeed, 5);
    if (g.naval.reloadCd === 0) {
      if ((f.under || f.state === 'charge') && Math.hypot(f.x - sh.x, f.z - sh.z) < 7 && count(g.p.inv, 'depth_charge') > 0) { g.naval.ammo = 'depth_charge'; g.naval.fire(); }
      else if (!f.under) { g.naval.ammo = AMMO[ammo].item && count(g.p.inv, AMMO[ammo].item!) === 0 ? 'cannonball' : ammo; g.naval.fire(); }
    }
    g.step(1 / 30);
    if (!g.p.onShip || Math.hypot(sh.x - g.layout.mooring!.x, sh.z - g.layout.mooring!.z) < 1) return false; // towed home
  }
  return !f.alive && f.hp <= 0;
}

describe('Amberhold\'s waters', () => {
  it('longships and lindworms wait on open water, clear of the harbour and the lanes; nothing hunts in the North Deep', () => {
    const g = sun();
    const ids = new Set(g.naval.foes.map((f) => f.def.id));
    for (const id of ['raider_longship', 'lindworm']) expect(ids.has(id), id).toBe(true);
    const mo = g.layout.mooring!, b = REGIONS.amberhold.bounds;
    for (const f of g.naval.foes) {
      expect(g.world.seaClear(f.x, f.z), f.def.id).toBe(true);
      expect(Math.hypot(f.x - mo.x, f.z - mo.z), f.def.id).toBeGreaterThan(NAVAL.harbour);
      expect(Math.abs(f.x - b.cx), f.def.id).toBeLessThan(b.half - 22);
      expect(Math.hypot(f.x - KRAKEN.x, f.z - KRAKEN.z), f.def.id).toBeGreaterThan(KRAKEN.escape);
    }
    expect(g.world.seaClear(KRAKEN.x, KRAKEN.z)).toBe(true);
  });

  const deep = () => {
    const g = sun();
    g.p.xp.sailing = xpForLevel(35);
    for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
    Object.assign(g.ship, { x: KRAKEN.x, z: KRAKEN.z, heading: Math.PI / 2, region: 'amberhold' }); g.p.onShip = true; g.p.x = KRAKEN.x; g.p.z = KRAKEN.z;
    g.naval.hull = g.naval.hullMax();
    return g;
  };

  it('the Kraken: sit still in the North Deep and its arms come down on you', () => {
    const g = deep();
    const hull = g.naval.hull;
    for (let t = 0; t < 6; t += 1 / 30) g.step(1 / 30);
    expect(g.naval.kraken).not.toBeNull();
    expect(g.naval.hull).toBeLessThan(hull);
    expect(g.s.flags.kraken_escaped).toBeFalsy();
  });

  it('the Kraken: sail hard for the island and you get clear, battered, for Sailing XP, once', () => {
    const g = deep();
    g.step(1 / 30);
    const xp = g.p.xp.sailing;
    // run east along the deep at full sail, weaving off the marks
    for (let t = 0; t < 40 && !g.s.flags.kraken_escaped; t += 1 / 30) {
      const want = Math.sin(t * 1.5) * 0.35;
      g.setMoveDir(Math.cos(want), Math.sin(want));
      g.step(1 / 30);
    }
    expect(g.s.flags.kraken_escaped).toBe(true);
    expect(g.p.xp.sailing).toBeGreaterThanOrEqual(xp + KRAKEN.xp);
    expect(g.p.onShip).toBe(true);
    // the deep is quiet after
    Object.assign(g.ship, { x: KRAKEN.x, z: KRAKEN.z });
    for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
    expect(g.naval.kraken).toBeNull();
  });

  it('balance: a Sailing-36 captain with fire barrels sinks a longship; Sailing 42 with charges beats a lindworm', () => {
    const wins = (foe: string, lvl: number, ammo: AmmoId, kit: [string, number][]) => {
      let w = 0;
      for (let s = 0; s < 6; s++) {
        const { g, f } = atSea(foe, lvl, Math.PI / 2, 12, 600 + s);
        for (const [i, q] of kit) g.give(i, q);
        f.state = 'chase';
        if (fight(g, f, ammo)) w++;
      }
      return w;
    };
    const r = {
      long36: wins('raider_longship', 36, 'fire_barrel', [['fire_barrel', 60]]),
      long28ball: wins('raider_longship', 28, 'cannonball', []),
      worm42: wins('lindworm', 42, 'cannonball', [['depth_charge', 40]]),
    };
    console.log('AMBSEA', JSON.stringify(r));
    expect(r.long36).toBeGreaterThanOrEqual(5);
    expect(r.long28ball).toBeLessThanOrEqual(3);
    expect(r.worm42).toBeGreaterThanOrEqual(4);
  }, 180_000);
});
