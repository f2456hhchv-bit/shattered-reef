import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { ITEMS } from '../data/items';
import { levelForXp } from './xp';
import { NODES, RECIPES, ENEMIES, LOOT, SHOPS, UNLOCKS, SKILLS } from '../data/content';
import { LAYOUT } from '../world/island';
import { toWorld, doorPoints, isInside } from '../world/buildings';

const base = new Game({ seed: 3 });
const fresh = () => new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring) });
const run = (g: Game, secs: number, until?: () => boolean) => {
  for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until?.()) return true; }
  return false;
};

describe('content data', () => {
  it('every referenced item exists', () => {
    const missing: string[] = [];
    const need = (id: string, where: string) => { if (!ITEMS[id]) missing.push(`${where}: ${id}`); };
    for (const r of RECIPES) { r.inputs.forEach((i) => need(i.id, r.id)); need(r.output.id, r.id); if (r.burn) need(r.burn.item, r.id); }
    for (const n of Object.values(NODES)) { need(n.item, n.id); if (n.tool) need(n.tool, n.id); }
    for (const [k, l] of Object.entries(LOOT)) { l.drops.forEach((d) => need(d.item, k)); l.gear?.items.forEach((i) => need(i, k)); }
    for (const sh of Object.values(SHOPS)) for (const s of sh.stock) need(s.id, sh.id);
    for (const e of Object.values(ENEMIES)) if (!LOOT[e.loot]) missing.push(`loot table ${e.loot}`);
    expect(missing).toEqual([]);
  });

  it('every gathering and production skill has something to do at every level, 1 to its top tier', () => {
    const tops: Record<string, number> = { woodcutting: 90, mining: 85, fishing: 85, smithing: 99, gunsmithing: 90, fletching: 95, cooking: 84, magic: 80 };
    for (const s of SKILLS) {
      const lv = [...new Set((UNLOCKS[s.id] ?? []).map((u) => u.level))].sort((a, b) => a - b);
      if (!(s.id in tops)) continue;
      expect(lv[0], s.id).toBeLessThanOrEqual(1);
      expect(lv[lv.length - 1], s.id).toBeGreaterThanOrEqual(tops[s.id]);
      for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1], `${s.id} gap ${lv[i - 1]}->${lv[i]}`).toBeLessThanOrEqual(15);
    }
  });

  it('every item has a use: an input, gear, food, a tool, a quest item, or a declared trade good', () => {
    const TRADE = new Set(['coins', 'shell_fragment', 'burnt_food', 'charm_tide']); // charms are burnt by spells
    const used = new Set([...RECIPES.flatMap((r) => r.inputs.map((i) => i.id)), ...Object.values(NODES).flatMap((n) => (n.tool ? [n.tool] : []))]);
    const idle = Object.values(ITEMS).filter((d) => !used.has(d.id) && !d.equip && !d.heal && !d.tool && !d.quest && !d.opens && !TRADE.has(d.id)).map((d) => d.id);
    expect(idle).toEqual([]);
  });

  it('no gear is drop-only: every weapon and armour piece is craftable, sold, or a quest/boss trophy', () => {
    const made = new Set(RECIPES.map((r) => r.output.id));
    const sold = new Set(Object.values(SHOPS).flatMap((sh) => sh.stock.map((s) => s.id)));
    const TROPHY = new Set(['lockplate', 'cutlass_rusty', 'cutlass_brigand', 'ring_brass']); // boss/starter/flavour pieces with crafted equivalents
    const dropOnly = Object.values(ITEMS).filter((d) => d.equip && !made.has(d.id) && !sold.has(d.id) && !TROPHY.has(d.id)).map((d) => d.id);
    expect(dropOnly).toEqual([]);
  });

  it('starter foes (below level 9) never roll as elites', () => {
    for (let seed = 1; seed < 12; seed++) {
      const g = new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring) });
      expect(g.enemies.filter((e) => e.def.level < 9 && e.elite).map((e) => e.def.id)).toEqual([]);
    }
  }, 30_000);

  it('enemies cover combat levels 2 to 80 without a gap over 15', () => {
    const lv = Object.values(ENEMIES).map((e) => e.level).sort((a, b) => a - b);
    expect(lv[0]).toBeLessThanOrEqual(2);
    expect(lv[lv.length - 1]).toBeGreaterThanOrEqual(80);
    for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1]).toBeLessThanOrEqual(15);
  });
});

describe('pacing (RuneScape-like: 99 is a few hundred hours)', () => {
  it('gathering 1 to 99 takes 150-450 hours of pure gathering at the best node and tool for each level', () => {
    const g = fresh();
    const toolReq = [1, 10, 20, 30, 40, 50];
    for (const skill of ['woodcutting', 'mining', 'fishing'] as const) {
      let hours = 0, at10 = 0;
      for (let L = 1; L < 99; L++) {
        g.p.xp[skill] = xpForLevel(L);
        const power = toolReq.filter((r) => r <= L).length;
        const best = Math.max(...Object.values(NODES).filter((n) => n.skill === skill && n.level <= L).map((n) => (g.gatherChance(n, power) * n.xp * 3600) / 2.4));
        hours += (xpForLevel(L + 1) - xpForLevel(L)) / best;
        if (L + 1 === 10) at10 = hours;
      }
      expect(levelForXp(xpForLevel(99))).toBe(99);
      expect(at10 * 60, `${skill} minutes to 10`).toBeGreaterThan(4);
      expect(hours, `${skill} hours to 99`).toBeGreaterThan(150);
      expect(hours, `${skill} hours to 99`).toBeLessThan(450);
    }
  });
});

describe('content placement', () => {
  const g = fresh();
  it('every node type and every non-boss enemy is placed on the island', () => {
    const placed = new Set(g.layout.nodes.map((n) => n.def));
    expect(Object.keys(NODES).filter((id) => !placed.has(id))).toEqual([]);
    const spawned = new Set(g.layout.spawns.map((s) => s.enemy));
    expect(Object.values(ENEMIES).filter((e) => !e.boss && !spawned.has(e.id)).map((e) => e.id)).toEqual([]);
  });

  it('places report their danger and what can be gathered there', () => {
    expect(g.placeInfo('ruin').foes).toEqual([22, 22]); // the Guardian, though it is not a regular spawn
    const peak = g.placeInfo('peak');
    expect(peak.foes![0]).toBeGreaterThanOrEqual(30);
    expect(peak.gather.map((n) => n.name)).toContain('Stormsilver vein');
    expect(g.placeInfo('wood').foes).toBeNull();
  });

  it('a new player can walk from the quay to every starter zone without passing a foe above the Guardian\'s level', () => {
    const starter = ['strand', 'forest', 'grove', 'hills', 'camp', 'ruin', 'crossroads', 'fen'] as const;
    const threats = g.layout.spawns.filter((s) => ENEMIES[s.enemy].level > 22);
    for (const z of starter) {
      const zone = (LAYOUT as Record<string, { x: number; z: number }>)[z];
      const path = g.world.findPath(g.p.x, g.p.z, zone.x, zone.z)!;
      let [ax, az] = [g.p.x, g.p.z];
      for (const [bx, bz] of path) {
        for (let k = 0; k <= 10; k++) {
          const x = ax + ((bx - ax) * k) / 10, zz = az + ((bz - az) * k) / 10;
          for (const t of threats) expect(Math.hypot(t.x - x, t.z - zz), `${z} path passes ${t.enemy}`).toBeGreaterThan(ENEMIES[t.enemy].aggro + 2);
        }
        [ax, az] = [bx, bz];
      }
    }
  });

  it('land nodes can be used from walkable ground; ship nodes sit in open water', () => {
    const bad: string[] = [];
    for (const n of g.layout.nodes) {
      const d = NODES[n.def];
      if (d.fromShip) { if (!g.world.sailable(n.x, n.z)) bad.push(n.def); continue; }
      const reach = g.nodeReach(d) - 0.3;
      if (!g.world.nearestWalkable(n.x, n.z, reach)) bad.push(`${n.def}@${n.x.toFixed(0)},${n.z.toFixed(0)}`);
    }
    expect(bad).toEqual([]);
  });

  it('one of each node type and every enemy spawn is reachable on foot from the quay', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const n of g.layout.nodes) {
      if (NODES[n.def].fromShip || NODES[n.def].islet || seen.has(n.def)) continue;
      seen.add(n.def);
      if (!g.world.findPath(g.p.x, g.p.z, n.x, n.z)) bad.push(n.def);
    }
    for (const s of g.layout.spawns) if (!g.world.findPath(g.p.x, g.p.z, s.x, s.z)) bad.push(s.enemy);
    expect(bad).toEqual([]);
  });

  it('islet nodes can be reached from a beach the ship can sail up to', () => {
    const I = LAYOUT.islet;
    // a landing: walkable islet ground with open, ship-navigable water within a few metres
    let landing: [number, number] | null = null;
    for (let a = 0; a < Math.PI * 2 && !landing; a += 0.1) for (let r = 8; r < 20 && !landing; r += 0.5) {
      const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
      if (!g.world.walkable(x, z)) continue;
      for (let k = 0; k < 12; k++) { const sx = x + Math.cos(a) * (3 + k), sz = z + Math.sin(a) * (3 + k); if (g.world.seaClear(sx, sz)) { landing = [x, z]; break; } }
    }
    expect(landing).not.toBeNull();
    expect(g.world.findSeaPath(g.ship.x, g.ship.z, landing![0], landing![1])).not.toBeNull();
    const isletNodes = g.layout.nodes.filter((n) => NODES[n.def].islet);
    expect(isletNodes.length).toBeGreaterThanOrEqual(3);
    for (const n of isletNodes) {
      const q = g.world.nearestWalkable(n.x, n.z, 1.6)!;
      expect(g.world.findPath(landing![0], landing![1], q[0], q[1]), n.def).not.toBeNull();
    }
  });
});

describe('end-game content works end to end', () => {
  const maxed = () => {
    const g = fresh();
    for (const s of SKILLS) g.p.xp[s.id] = xpForLevel(99);
    g.recalc();
    g.p.hp = g.stats.maxHp;
    return g;
  };
  const goTo = (g: Game, x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 4)!; g.p.x = q[0]; g.p.z = q[1]; };

  it('chops Leviathan cedar and mines a tidecore vein with tidecore tools', () => {
    const g = maxed();
    g.give('hatchet_tide', 1); g.give('pickaxe_tide', 1);
    for (const def of ['tree_cedar', 'rock_tide'] as const) {
      const n = g.nodes.find((x) => x.def === def)!;
      // these zones are guarded (that's the point); this test is about gathering, so clear the guards
      for (const e of g.enemies) if (Math.hypot(e.x - n.x, e.z - n.z) < 25) { e.alive = false; e.respawnAt = Infinity; }
      goTo(g, n.x + 1.4, n.z);
      g.interact(`node:${n.uid}`);
      expect(run(g, 240, () => count(g.p.inv, NODES[def].item) >= 1), def).toBe(true); // cedar is slow by design (~1 log / 20 s at 99)
    }
  });

  it('smelts tidecore and forges tidecore plate at the Ironcrag forge', () => {
    const g = maxed();
    g.give('ore_tide', 5); g.give('ore_coal', 40); g.give('sea_salt', 5);
    const camp = g.layout.stations.filter((s) => s.id === 'furnace')[1];
    goTo(g, camp.x + 1.6, camp.z + 1.6);
    g.craft('smelt_tide', 5);
    run(g, 30, () => count(g.p.inv, 'bar_tide') >= 5);
    expect(count(g.p.inv, 'bar_tide')).toBe(5);
    const anvil = g.layout.stations.filter((s) => s.id === 'anvil')[1];
    goTo(g, anvil.x + 1.2, anvil.z + 1.2);
    g.craft('forge_plate_tide', 1);
    run(g, 10, () => g.p.inv.some((s) => s?.id === 'plate_tide'));
    expect(g.p.inv.some((s) => s?.id === 'plate_tide')).toBe(true);
  });

  it('harpoons an abyssal angler from the ship and cooks it at the fen fire', () => {
    const g = maxed();
    g.give('harpoon', 1);
    const spot = g.nodes.find((x) => x.def === 'spot_angler')!;
    g.p.onShip = true;
    g.ship.x = spot.x + 4; g.ship.z = spot.z;
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
    g.step(0.01);
    g.interact(`node:${spot.uid}`);
    expect(run(g, 90, () => count(g.p.inv, 'fish_angler_raw') >= 1)).toBe(true);
    g.p.onShip = false;
    const fire = g.layout.stations.filter((s) => s.id === 'fire')[1];
    goTo(g, fire.x + 1.4, fire.z + 1.2);
    g.craft('cook_angler', 1);
    run(g, 10, () => count(g.p.inv, 'fish_angler') + count(g.p.inv, 'burnt_food') >= 1);
    expect(count(g.p.inv, 'fish_angler')).toBe(1); // level 99: past the burn level
  });

  it('a fishing spot refuses the wrong tool', () => {
    const g = maxed();
    const n = g.nodes.find((x) => x.def === 'spot_lobster')!;
    goTo(g, n.x, n.z);
    g.interact(`node:${n.uid}`);
    expect(g.action).toBeNull(); // has a rod, not a pot
  });
});

describe('the living island', () => {
  const near = (g: Game, x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 3)!; g.p.x = q[0]; g.p.z = q[1]; };
  const use = (g: Game, def: string, secs = 90) => {
    const n = g.nodes.find((x) => x.def === def && x.depletedUntil <= g.time && g.layout.nodes.find((l) => l.uid === x.uid)?.scenery !== false)!;
    for (const e of g.enemies) if (Math.hypot(e.x - n.x, e.z - n.z) < 20) { e.alive = false; e.respawnAt = Infinity; }
    near(g, n.x, n.z);
    g.interact(`node:${n.uid}`);
    return { n, done: (until: () => boolean) => run(g, secs, until) };
  };
  it('there are hundreds of usable scenery trees and boulders, plus bushes, kelp and dig spots', () => {
    const c = (def: string) => base.layout.nodes.filter((n) => n.def === def && n.scenery).length;
    expect(c('tree_pine') + c('tree_oak')).toBeGreaterThan(150);
    expect(c('rock_boulder')).toBeGreaterThan(20);
    expect(c('bush_berry')).toBeGreaterThan(20);
    expect(c('kelp_bed')).toBeGreaterThan(10);
    expect(base.layout.nodes.filter((n) => n.def === 'dig_spot').length).toBeGreaterThan(20);
  });
  it('no tree or rock on the island is decoration only', () => {
    expect(base.layout.props.filter((p) => p.kind === 'pine' || p.kind === 'broadleaf' || p.kind === 'rock').length).toBe(0);
    for (const n of base.layout.nodes.filter((x) => x.scenery)) expect(base.world.nearestWalkable(n.x, n.z, n.def === 'kelp_bed' ? 3.1 : 1.6), n.def).not.toBeNull();
  });
  it('every building and camp sits on level ground', () => {
    const spots = [...base.layout.buildings.map((b) => ({ x: b.x, z: b.z, r: Math.max(b.w, b.d) / 2, id: b.kind })), ...base.layout.stations.map((s) => ({ x: s.x, z: s.z, r: 0.8, id: s.id })), ...base.layout.banks.map((b) => ({ x: b.x, z: b.z, r: 0.7, id: 'bank' }))];
    for (const sp of spots) {
      const hs: number[] = [];
      for (let a = 0; a < 8; a++) hs.push(base.world.ground(sp.x + Math.cos(a) * sp.r, sp.z + Math.sin(a) * sp.r));
      expect(Math.max(...hs) - Math.min(...hs), `${sp.id} at ${sp.x.toFixed(0)},${sp.z.toFixed(0)}`).toBeLessThan(0.45);
    }
  });

  it('every town building stands on a level pad, and every door can be walked to and through', () => {
    const w = base.world;
    for (const b of base.layout.town) {
      const hs: number[] = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const [x, z] = toWorld(b, sx * b.w / 2, sz * b.d / 2); hs.push(w.ground(x, z)); }
      expect(Math.max(...hs) - Math.min(...hs), `${b.id} floor`).toBeLessThan(0.15);
      const d = doorPoints(b);
      const from = base.layout.respawn;
      expect(w.findPath(from.x, from.z, d.out[0], d.out[1]), `${b.id} door`).not.toBeNull();
      const inn = w.findPath(d.out[0], d.out[1], d.in[0], d.in[1]);
      expect(inn, `${b.id} doorway`).not.toBeNull();
      const end = inn![inn!.length - 1];
      expect(isInside(b, end[0], end[1]), `${b.id} inside`).toBe(true);
    }
    // walls hold: you can't walk straight through a back wall
    const inn = base.layout.town.find((b) => b.id === 'inn')!;
    const [bx, bz] = toWorld(inn, 0, -inn.d / 2 + 0.15);
    expect(w.walkable(bx, bz)).toBe(false);
  });

  it('every shopkeeper, the banker and the chapel do their jobs', () => {
    const g = fresh();
    for (const sh of Object.values(SHOPS)) {
      const n = g.layout.npcs.find((x) => x.id === sh.keeper)!;
      expect(n, sh.keeper).toBeTruthy();
      let opened = '';
      const off = g.on((e) => { if (e.type === 'openShop') opened = e.shop; });
      near(g, n.x, n.z); g.interact(`npc:${n.id}`);
      run(g, 60, () => opened !== '');
      off?.();
      expect(opened, sh.keeper).toBe(sh.id);
      expect(g.nearShop()).toBe(true);
    }
    // Silas pays more for fish than Marta does
    g.p.inv[20] = { id: 'fish_trout', qty: 1 };
    g.shopId = 'general'; const marta = g.sellPrice(g.p.inv[20]!);
    g.shopId = 'tackle'; expect(g.sellPrice(g.p.inv[20]!)).toBeGreaterThan(marta);
    const ada = g.layout.npcs.find((x) => x.id === 'ada')!;
    near(g, ada.x, ada.z); g.interact('npc:ada');
    expect(run(g, 60, () => g.nearBank())).toBe(true);
    const maren = g.layout.npcs.find((x) => x.id === 'maren')!;
    g.p.hp = 2;
    near(g, maren.x, maren.z); g.interact('npc:maren');
    expect(run(g, 60, () => g.p.hp === g.stats.maxHp)).toBe(true);
  });

  it('fells an ordinary scenery pine and mines an ordinary boulder', () => {
    const g = fresh();
    const pine = g.layout.nodes.find((n) => n.def === 'tree_pine' && n.scenery)!;
    for (const e of g.enemies) if (Math.hypot(e.x - pine.x, e.z - pine.z) < 20) { e.alive = false; e.respawnAt = Infinity; } // it grows in the Fen
    near(g, pine.x, pine.z); g.interact(`node:${pine.uid}`);
    expect(run(g, 120, () => count(g.p.inv, 'logs_pine') >= 1)).toBe(true);
    const b = use(g, 'rock_boulder');
    b.done(() => count(g.p.inv, 'ore_copper') + count(g.p.inv, 'ore_tin') >= 1);
    expect(count(g.p.inv, 'ore_copper') + count(g.p.inv, 'ore_tin')).toBeGreaterThanOrEqual(1);
  });
  it('picks berries bare-handed; kelp-wrapped sprat cooks into better food', () => {
    const g = fresh();
    g.p.inv = g.p.inv.map(() => null); // no tools at all
    use(g, 'bush_berry').done(() => count(g.p.inv, 'berries') >= 1);
    expect(count(g.p.inv, 'berries')).toBeGreaterThanOrEqual(1);
    for (let k = 0; k < 40; k++) g.p.xp.cooking = 2000; // cooking 15+
    g.recalc();
    g.give('kelp', 1); g.give('fish_sprat_raw', 1);
    const fire = g.layout.stations.find((s) => s.id === 'fire')!;
    near(g, fire.x + 1.4, fire.z + 1.2);
    g.craft('cook_parcel_sprat', 1);
    run(g, 10, () => count(g.p.inv, 'parcel_sprat') + count(g.p.inv, 'burnt_food') >= 1);
    expect(count(g.p.inv, 'parcel_sprat') + count(g.p.inv, 'burnt_food')).toBe(1);
  });
  it('digging needs a spade, and turns up treasure; geodes crack open', () => {
    const g = fresh();
    const spot = g.nodes.find((n) => n.def === 'dig_spot')!;
    spot.depletedUntil = 0;
    for (const e of g.enemies) if (Math.hypot(e.x - spot.x, e.z - spot.z) < 25) { e.alive = false; e.respawnAt = Infinity; }
    near(g, spot.x, spot.z);
    g.interact(`node:${spot.uid}`);
    expect(g.action).toBeNull(); // no spade yet
    g.give('spade', 1);
    g.interact(`node:${spot.uid}`);
    expect(run(g, 60, () => g.drops.length > 0)).toBe(true);
    expect(spot.depletedUntil).toBeGreaterThan(g.time); // the sand settles; it surfaces elsewhere later
    const before = g.drops.length;
    g.give('geode', 1);
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'geode'));
    expect(count(g.p.inv, 'geode')).toBe(0);
    expect(g.drops.length).toBeGreaterThan(before);
  });
});
