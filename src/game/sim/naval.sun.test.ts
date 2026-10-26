import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { NAVAL, SEA_FOES, AMMO } from '../data/sea';
import { RECIPES } from '../data/content';
import { regionLayout } from '../world/layout';
import { SUN } from '../world/island';
import { REGIONS } from '../world/regions';
import type { SeaFoe } from './naval';
import type { AmmoId } from '../data/sea';

// Sunreach's waters (docs/ISLANDS.md slice 2): brigs, fire ships, sea serpents and the Red Ransom.
const L = regionLayout('sunreach');
const sun = (seed = 7) => new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } });

/** Aboard in open water off this foe's lair, every other foe asleep; the foe placed `dist` off the given bearing. */
function atSea(foeId: string, sailing: number, bearing = Math.PI / 2, dist = 10, seed = 7) {
  const g = sun(seed);
  g.p.xp.sailing = xpForLevel(sailing);
  const f = g.naval.foes.find((x) => x.def.id === foeId)!;
  const spot = g.nearestSea(f.spawnX + (SUN.x - f.spawnX) * 0.18, f.spawnZ + (SUN.z - f.spawnZ) * 0.18)!; // in from its lair, toward the island
  Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0, region: 'sunreach' });
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

describe('Sunreach\'s waters', () => {
  it('its foes wait on open water, clear of Port Halyard\'s harbour; the Red Ransom is its sea boss', () => {
    const g = sun();
    const ids = new Set(g.naval.foes.map((f) => f.def.id));
    for (const id of ['pirate_brig', 'fire_ship', 'sea_serpent', 'red_ransom']) expect(ids.has(id), id).toBe(true);
    const mo = g.layout.mooring!;
    for (const f of g.naval.foes) {
      expect(g.world.seaClear(f.x, f.z), f.def.id).toBe(true);
      expect(Math.hypot(f.x - mo.x, f.z - mo.z), f.def.id).toBeGreaterThan(NAVAL.harbour);
    }
    expect(SEA_FOES.red_ransom.boss).toBe(true);
    // well inside the chart: nothing waits by the lanes where you'd sail off into the next region mid-fight
    const b = REGIONS.sunreach.bounds;
    for (const f of g.naval.foes) expect(Math.abs(f.x - b.cx), f.def.id).toBeLessThan(b.half - 22);
  });

  it('fire barrels are made from oak and Greenheart resin, and hit a brig far harder than cannonballs', () => {
    expect(RECIPES.some((r) => r.output.id === 'fire_barrel' && r.inputs.some((i) => i.id === 'resin'))).toBe(true);
    const hits = (ammo: AmmoId) => {
      const { g, f } = atSea('pirate_brig', 25, Math.PI / 2, 8);
      g.give('fire_barrel', 5);
      g.naval.setAmmo(ammo);
      f.state = 'chase'; f.cd = 99;
      g.naval.fire();
      for (let t = 0; t < 1.2; t += 1 / 30) { f.x = f.spawnX; f.z = f.spawnZ; g.step(1 / 30); }
      return f.maxHp - f.hp;
    };
    const fire = hits('fire_barrel'), ball = hits('cannonball');
    expect(ball).toBeGreaterThan(0);
    expect(fire).toBeGreaterThan(ball * 1.8);
  });

  it('a fire ship that reaches you goes up and holes the hull; sunk first, it pays', () => {
    const left = atSea('fire_ship', 20, Math.PI / 2, 12);
    const hull = left.g.naval.hull;
    for (let t = 0; t < 10 && left.f.alive; t += 1 / 30) left.g.step(1 / 30);
    expect(left.f.alive).toBe(false);
    expect(left.g.naval.hull).toBeLessThan(hull);
    const sunk = atSea('fire_ship', 20, Math.PI / 2, 18);
    sunk.g.give('chain_shot', 20);
    const xp = sunk.g.p.xp.sailing;
    expect(fight(sunk.g, sunk.f, 'chain_shot', 60)).toBe(true);
    expect(sunk.g.p.xp.sailing).toBeGreaterThan(xp);
  });

  it('balance: a Sailing-20 captain with fire barrels beats a brig; the Red Ransom wants Sailing ~28; serpents need charges', () => {
    const wins = (foe: string, lvl: number, ammo: AmmoId, kit: [string, number][]) => {
      let w = 0;
      for (let s = 0; s < 6; s++) {
        const { g, f } = atSea(foe, lvl, Math.PI / 2, 12, 500 + s);
        for (const [i, q] of kit) g.give(i, q);
        f.state = 'chase';
        if (fight(g, f, ammo)) w++;
      }
      return w;
    };
    const r = {
      brig20: wins('pirate_brig', 20, 'fire_barrel', [['fire_barrel', 40]]),
      brig14ball: wins('pirate_brig', 14, 'cannonball', []),
      serpent22: wins('sea_serpent', 22, 'cannonball', [['depth_charge', 30]]),
      ransom20: wins('red_ransom', 20, 'fire_barrel', [['fire_barrel', 60]]),
      ransom28: wins('red_ransom', 28, 'fire_barrel', [['fire_barrel', 60]]),
    };
    console.log('SUNSEA', JSON.stringify(r));
    expect(r.brig20).toBeGreaterThanOrEqual(5);
    expect(r.brig14ball).toBeLessThanOrEqual(3);
    expect(r.serpent22).toBeGreaterThanOrEqual(4);
    expect(r.ransom20).toBeLessThanOrEqual(2);
    expect(r.ransom28).toBeGreaterThanOrEqual(4);
  }, 180_000);
});
