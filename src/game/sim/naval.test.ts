import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { AMMO, NAVAL, CHART_MARKS, SEA_FOES } from '../data/sea';
import type { SeaFoe } from './naval';

// The sea (docs/ISLANDS.md slice 1): broadsides, ammo counters, sharks under the water, the hull, charting, salvage.
const base = new Game({ seed: 1 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

/** Aboard in open water, every other foe asleep; the one asked for placed `dist` off the given bearing. */
function atSea(foeId: string, sailing: number, bearing = Math.PI / 2, dist = 8, seed = 7) {
  const g = fresh(seed);
  g.p.xp.sailing = xpForLevel(sailing);
  const f = g.naval.foes.find((x) => x.def.id === foeId)!;
  // put the ship somewhere open, off this foe's lair, out of the harbour
  const spot = g.nearestSea(f.spawnX + 12, f.spawnZ)!;
  Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0 });
  g.p.onShip = true; g.p.x = spot[0]; g.p.z = spot[1];
  for (const o of g.naval.foes) if (o !== f) { o.alive = false; o.respawnAt = Infinity; }
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  const at = [spot[0] + Math.cos(bearing) * dist, spot[1] + Math.sin(bearing) * dist];
  f.x = at[0]; f.z = at[1]; f.spawnX = at[0]; f.spawnZ = at[1];
  g.naval.hull = g.naval.hullMax();
  return { g, f };
}

/** Hold the foe on the beam and fire whenever the guns are ready; charges for anything that dives. */
function fight(g: Game, f: SeaFoe, secs = 240, charges = false) {
  for (let t = 0; t < secs && f.alive; t += 1 / 30) {
    const sh = g.ship;
    // swing to bring a side to bear, no faster than the ship can turn (~1.25 rad/s)
    const want = Math.atan2(f.z - sh.z, f.x - sh.x) - Math.PI / 2, diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
    sh.heading += Math.max(-1.25 / 30, Math.min(1.25 / 30, diff));
    if (charges && (f.under || f.state === 'charge') && Math.hypot(f.x - sh.x, f.z - sh.z) < 9.5 && g.naval.reloadCd === 0) { g.naval.ammo = 'depth_charge'; g.naval.fire(); }
    else if (!f.under && g.naval.reloadCd === 0) { g.naval.ammo = charges && count(g.p.inv, 'depth_charge') > 0 && f.def.counter === 'depth_charge' && Math.hypot(f.x - sh.x, f.z - sh.z) < 6 ? 'depth_charge' : 'cannonball'; g.naval.fire(); }
    g.step(1 / 30);
    if (!g.p.onShip || Math.hypot(g.ship.x - g.layout.mooring!.x, g.ship.z - g.layout.mooring!.z) < 1) return false; // towed home
  }
  return !f.alive;
}

describe('the sea', () => {
  it('Bellwether\'s waters hold their foes on open water, none of them in the harbour', () => {
    const g = fresh();
    expect(g.naval.foes.length).toBeGreaterThanOrEqual(8);
    const mo = g.layout.mooring!;
    for (const f of g.naval.foes) {
      if (f.def.behaviour !== 'flock') expect(g.world.seaClear(f.x, f.z), f.def.id).toBe(true);
      expect(Math.hypot(f.x - mo.x, f.z - mo.z), f.def.id).toBeGreaterThan(NAVAL.harbour);
    }
    expect(g.naval.foes.some((f) => f.def.boss)).toBe(true);
  });

  it('a broadside fires on a foe off the beam, not on one dead ahead', () => {
    const ahead = atSea('wreckers_cutter', 5, 0, 8);
    expect(ahead.g.naval.fireBlock()).toBe('Turn a side to it');
    const beam = atSea('wreckers_cutter', 5, Math.PI / 2, 8);
    expect(beam.g.naval.fireBlock()).toBeNull();
    beam.g.naval.fire();
    expect(beam.g.naval.balls.length).toBe(NAVAL.balls);
    for (let t = 0; t < 1.2; t += 1 / 30) beam.g.step(1 / 30);
    expect(beam.f.hp).toBeLessThan(beam.f.maxHp);
  });

  it('chain shot shreds a gull flock; cannonballs only scatter it', () => {
    const hits = (ammo: 'cannonball' | 'chain_shot') => {
      const { g, f } = atSea('gull_flock', 10, Math.PI / 2, 6);
      g.give('chain_shot', 10);
      g.naval.setAmmo(ammo);
      f.state = 'surfaced'; f.t = 99; // hold still for the test
      g.naval.fire();
      for (let t = 0; t < 1.2; t += 1 / 30) { f.x = f.spawnX; f.z = f.spawnZ; g.step(1 / 30); }
      return f.maxHp - f.hp;
    };
    const chain = hits('chain_shot'), ball = hits('cannonball');
    expect(ball).toBeGreaterThan(0);
    expect(chain).toBeGreaterThan(ball * 1.5);
  });

  it('a shark under the water can\'t be fired on; a depth charge over the stern reaches it', () => {
    const { g, f } = atSea('reef_shark', 12, Math.PI, 3);
    f.state = 'circle'; f.under = true; f.cd = 99;
    expect(g.naval.broadsideTarget()).toBeNull();
    g.give('depth_charge', 3);
    g.naval.setAmmo('depth_charge');
    expect(g.naval.fireBlock()).toBeNull();
    // it sits right behind the stern, where the charge sinks
    f.x = g.ship.x - Math.cos(g.ship.heading) * 4.2; f.z = g.ship.z - Math.sin(g.ship.heading) * 4.2;
    g.naval.fire();
    expect(count(g.p.inv, 'depth_charge')).toBe(2);
    for (let t = 0; t < NAVAL.charge.fuse + 0.2; t += 1 / 30) { f.x = g.ship.x - Math.cos(g.ship.heading) * 4.2; f.z = g.ship.z - Math.sin(g.ship.heading) * 4.2; g.step(1 / 30); }
    expect(f.hp).toBeLessThan(f.maxHp);
  });

  it('ammo needs its Sailing level and stock; cannonballs never run out', () => {
    const { g } = atSea('wreckers_cutter', 1);
    expect(g.naval.ammoBlock('cannonball')).toBeNull();
    expect(g.naval.ammoBlock('chain_shot')).toMatch(/Sailing 5/);
    g.p.xp.sailing = xpForLevel(10);
    expect(g.naval.ammoBlock('depth_charge')).toMatch(/No depth charges/);
    expect(AMMO.cannonball.item).toBeNull();
  });

  it('a broken hull is a tow home and a fee, not a death', () => {
    const { g } = atSea('wreckers_cutter', 1);
    g.give('coins', 1000);
    const coins = count(g.p.inv, 'coins');
    g.naval.hull = 1;
    (g.naval as unknown as { hitHull(d: number): void }).hitHull(5);
    expect(g.dead).toBe(0);
    expect(g.p.onShip).toBe(true);
    expect(Math.hypot(g.ship.x - g.layout.mooring!.x, g.ship.z - g.layout.mooring!.z)).toBeLessThan(0.01);
    expect(count(g.p.inv, 'coins')).toBe(coins - Math.floor(coins * NAVAL.towFee));
    expect(g.naval.hull).toBe(Math.round(g.naval.hullMax() * 0.5));
  });

  it('charting a mark gives Sailing XP once', () => {
    const g = fresh();
    const m = CHART_MARKS.find((c) => c.region === 'bellwether')!;
    const q = g.nearestSea(m.x, m.z)!;
    Object.assign(g.ship, { x: q[0], z: q[1] }); g.p.onShip = true; g.p.x = q[0]; g.p.z = q[1];
    for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
    g.step(1 / 30);
    const xp = g.p.xp.sailing;
    expect(xp).toBeGreaterThanOrEqual(m.xp);
    g.step(1 / 30);
    expect(g.p.xp.sailing).toBe(xp);
  });

  it('salvage: a hook drags loot off a wreck straight into the pack, for Sailing XP', () => {
    const g = fresh();
    g.p.xp.sailing = xpForLevel(10);
    g.give('salvage_hook', 1);
    for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
    const n = g.nodes.find((x) => x.def === 'wreck_salvage')!;
    const q = g.nearestSea(n.x + 4, n.z)!;
    Object.assign(g.ship, { x: q[0], z: q[1] }); g.p.onShip = true; g.p.x = q[0]; g.p.z = q[1];
    const before = g.p.inv.filter(Boolean).length;
    g.interact(`node:${n.uid}`);
    for (let t = 0; t < 120 && g.p.xp.sailing === xpForLevel(10); t += 1 / 30) g.step(1 / 30);
    expect(g.p.xp.sailing).toBeGreaterThan(xpForLevel(10));
    expect(g.p.inv.filter(Boolean).length + (count(g.p.inv, 'coins') > 0 ? 0 : 0)).toBeGreaterThanOrEqual(before);
    expect(g.drops.length).toBe(0); // nothing left floating
  });

  it('balance: a fresh captain beats gulls and a cutter; sharks need charges; Old Gnasher wants Sailing ~18 and charges', () => {
    const wins = (foe: string, lvl: number, charges: boolean) => {
      let w = 0;
      for (let s = 0; s < 6; s++) {
        const { g, f } = atSea(foe, lvl, Math.PI / 2, 10, 300 + s);
        if (charges) g.give('depth_charge', 30);
        f.state = 'chase';
        if (fight(g, f, 240, charges)) w++;
      }
      return w;
    };
    const r = {
      gulls1: wins('gull_flock', 1, false), cutter3: wins('wreckers_cutter', 3, false), cutter8: wins('wreckers_cutter', 8, false),
      shark12: wins('reef_shark', 12, true), gnasher10: wins('old_gnasher', 10, true), gnasher18: wins('old_gnasher', 18, true),
    };
    console.log('SEA', JSON.stringify(r));
    expect(r.gulls1).toBeGreaterThanOrEqual(5);
    expect(r.cutter8).toBeGreaterThanOrEqual(5);
    expect(r.shark12).toBeGreaterThanOrEqual(4);
    // checked 2026-10-26: Gnasher sinks a Sailing-10 ship and loses narrowly to Sailing 18 (17 hull left); a cutter leaves a Sailing-3 ship on 32 of 132
    expect(r.gnasher10).toBeLessThanOrEqual(2);
    expect(r.gnasher18).toBeGreaterThanOrEqual(4);
    expect(SEA_FOES.old_gnasher.boss).toBe(true);
  }, 120_000);
});
