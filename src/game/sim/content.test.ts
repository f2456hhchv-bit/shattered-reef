import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave, parseSave } from './save';
import { xpForLevel } from './xp';
import { count, stackValue } from './inventory';
import { ITEMS } from '../data/items';
import { levelForXp } from './xp';
import { NODES, RECIPES, ENEMIES, LOOT, SHOPS, UNLOCKS, SKILLS } from '../data/content';
import { LAYOUT, nearestPathDist } from '../world/island';
import { toWorld, toLocal, doorPoints, isInside } from '../world/buildings';
import { regionLayout } from '../world/layout';
import { REGIONS, type RegionId } from '../world/regions';

const base = new Game({ seed: 3 });
const fresh = () => new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const IDS = Object.keys(REGIONS) as RegionId[];
const ISLANDS = IDS.filter((id) => REGIONS[id].kind === 'island');
/** A fresh game standing at a region's start (town or cave mouth). */
const inRegion = (id: RegionId, seed = 3) => {
  const L = regionLayout(id), sv = defaultSave(L.respawn, base.layout.mooring!);
  return new Game({ seed, save: { ...sv, region: id } });
};
/** Where you start out on foot in a region: its harbour, or beside the rope in a cave. */
const startOf = (id: RegionId) => { const L = regionLayout(id); return L.port ? L.port.land : L.portals[0].out; };
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
    const tops: Record<string, number> = { woodcutting: 90, mining: 85, fishing: 85, smithing: 99, gunsmithing: 90, fletching: 95, cooking: 84, magic: 80, crafting: 90 };
    for (const s of SKILLS) {
      const lv = [...new Set((UNLOCKS[s.id] ?? []).map((u) => u.level))].sort((a, b) => a - b);
      if (!(s.id in tops)) continue;
      expect(lv[0], s.id).toBeLessThanOrEqual(1);
      expect(lv[lv.length - 1], s.id).toBeGreaterThanOrEqual(tops[s.id]);
      for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1], `${s.id} gap ${lv[i - 1]}->${lv[i]}`).toBeLessThanOrEqual(15);
    }
  });

  it('every item has a use: an input, gear, food, a tool, a quest item, or a declared trade good', () => {
    const TRADE = new Set(['coins', 'shell_fragment', 'burnt_food', 'charm_tide', 'spider_silk', 'snake_skin', 'sunscale']); // charms are burnt by spells; silk, skins and scales are traders' goods
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
      const g = new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
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
  it('every node type and every non-boss enemy is placed somewhere, and every boss has an arena', () => {
    const all = IDS.map(regionLayout);
    const placed = new Set(all.flatMap((L) => L.nodes.map((n) => n.def)));
    expect(Object.keys(NODES).filter((id) => !placed.has(id))).toEqual([]);
    const spawned = new Set(all.flatMap((L) => L.spawns.map((s) => s.enemy)));
    // bounty hunters aren't placed: they come looking for you (bounties.ts)
    expect(Object.values(ENEMIES).filter((e) => !e.boss && !spawned.has(e.id) && !e.id.startsWith('bounty_')).map((e) => e.id)).toEqual([]);
    const arenas = new Set(all.flatMap((L) => L.arenas.map((a) => a.boss)));
    expect(Object.values(ENEMIES).filter((e) => e.boss && !arenas.has(e.id)).map((e) => e.id)).toEqual([]);
  });

  it('places report their danger and what can be gathered there', () => {
    expect(g.placeInfo('ruin')!.foes).toEqual([22, 22]); // the Guardian, though it is not a regular spawn
    const peak = g.placeInfo('peak')!;
    expect(peak.foes![0]).toBeGreaterThanOrEqual(30);
    expect(peak.gather.map((n) => n.name)).toContain('Stormsilver vein');
    expect(g.placeInfo('wood')!.foes).toBeNull();
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

  it('land nodes can be used from walkable ground; ship nodes sit in open water (every region)', () => {
    const bad: string[] = [];
    for (const id of IDS) {
      const L = regionLayout(id);
      for (const n of L.nodes) {
        const d = NODES[n.def];
        if (d.fromShip) { if (!L.world.sailable(n.x, n.z)) bad.push(`${id}:${n.def}`); continue; }
        const reach = g.nodeReach(d) - 0.3;
        if (!L.world.nearestWalkable(n.x, n.z, reach)) bad.push(`${id}:${n.def}@${n.x.toFixed(0)},${n.z.toFixed(0)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('in every region, one of each node type, every spawn, arena and way out is reachable on foot from where you arrive', () => {
    const bad: string[] = [];
    for (const id of IDS) {
      const L = regionLayout(id), w = L.world, f = startOf(id), seen = new Set<string>();
      for (const n of L.nodes) {
        if (NODES[n.def].fromShip || NODES[n.def].islet || seen.has(n.def)) continue;
        seen.add(n.def);
        if (!w.findPath(f.x, f.z, n.x, n.z)) bad.push(`${id}:${n.def}`);
      }
      for (const s of L.spawns) if (!w.findPath(f.x, f.z, s.x, s.z)) bad.push(`${id}:${s.enemy}`);
      for (const a of L.arenas) if (!w.findPath(f.x, f.z, a.altar.x, a.altar.z)) bad.push(`${id}:arena ${a.boss}`);
      for (const p of L.portals) if (!w.findPath(f.x, f.z, p.out.x, p.out.z)) bad.push(`${id}:portal ${p.id}`);
      for (const st of L.stations) if (!w.findPath(f.x, f.z, st.x, st.z)) bad.push(`${id}:station ${st.id}`);
    }
    expect(bad).toEqual([]);
  });

  it('one region at a time: sail off Bellwether\'s east edge to Sunreach and back, with only that island loaded', () => {
    const f = fresh();
    const events: string[] = [];
    f.on((e) => { if (e.type === 'travel' || e.type === 'region') events.push(`${e.type}:${e.type === 'travel' ? e.to : e.region}`); });
    const b = REGIONS.bellwether.bounds;
    // the lane is open water: a route from the quay to the crossing line exists
    expect(f.world.findSeaPath(f.layout.mooring!.x, f.layout.mooring!.z, b.cx + b.half - 20, 0)).not.toBeNull();
    f.p.onShip = true;
    f.ship.x = b.cx + b.half - 20; f.ship.z = 5; f.ship.heading = 0;
    expect(f.hullFits(f.ship.x, f.ship.z, 0)).toBe(true);
    f.setMoveDir(1, 0);
    run(f, 12, () => f.s.region === 'sunreach');
    expect(events).toEqual(['travel:sunreach', 'region:sunreach']);
    expect(f.s.region).toBe('sunreach');
    expect(f.p.onShip).toBe(true);
    expect(f.shipHere).toBe(true);
    expect(f.world.inside(f.ship.x, f.ship.z, 10)).toBe(true);
    expect(f.layout.npcs.some((n) => n.id === 'sefa')).toBe(true);
    expect(f.layout.npcs.some((n) => n.id === 'wynn')).toBe(false); // Bellwether isn't loaded
    // from the arrival point the ship can sail into Port Halyard
    f.setMoveDir(0, 0);
    expect(f.world.findSeaPath(f.ship.x, f.ship.z, f.layout.mooring!.x, f.layout.mooring!.z)).not.toBeNull();
    // and back west
    const s = REGIONS.sunreach.bounds;
    f.ship.x = s.cx - s.half + 20; f.ship.z = s.cz; f.ship.heading = Math.PI;
    f.setMoveDir(-1, 0);
    run(f, 12, () => f.s.region === 'bellwether');
    expect(f.s.region).toBe('bellwether');
    expect(f.world.findSeaPath(f.ship.x, f.ship.z, f.layout.mooring!.x, f.layout.mooring!.z)).not.toBeNull();
  });

  it('Sunreach: the ferry carries you and your ship both ways; Port Halyard has a bank and a forge', () => {
    const f = fresh();
    const near = (gg: Game, x: number, z: number) => { const q = gg.world.nearestWalkable(x, z, 3)!; gg.p.x = q[0]; gg.p.z = q[1]; };
    f.give('coins', 100);
    const wynn = f.layout.npcs.find((n) => n.id === 'wynn')!;
    near(f, wynn.x, wynn.z);
    f.takeFerry('wynn');
    expect(f.s.region).toBe('sunreach');
    const port = f.layout.port!;
    expect(Math.hypot(f.ship.x - port.ship.x, f.ship.z - port.ship.z)).toBeLessThan(0.01);
    expect(f.ship.region).toBe('sunreach');
    expect(f.layout.banks.some((b) => b.booth)).toBe(true);
    for (const st of ['furnace', 'anvil', 'fire', 'bench'] as const) expect(f.layout.stations.some((s) => s.id === st), st).toBe(true);
    const sefa = f.layout.npcs.find((n) => n.id === 'sefa')!;
    near(f, sefa.x, sefa.z);
    f.takeFerry('sefa');
    expect(f.s.region).toBe('bellwether');
    expect(count(f.p.inv, 'coins')).toBe(100 + 25 - 60); // started with 25
  });

  it('caves: walk in through the mouth, gather and fight inside, climb the rope back out where you came in', () => {
    for (const [island, cave] of [['bellwether', 'smugglers_caves'], ['sunreach', 'ember_deep']] as const) {
      const f = inRegion(island);
      const mouth = f.layout.portals.find((p) => p.to === cave)!;
      const q = f.world.nearestWalkable(mouth.out.x, mouth.out.z, 2)!; f.p.x = q[0]; f.p.z = q[1];
      f.interact(`portal:${f.layout.portals.indexOf(mouth)}`);
      run(f, 10, () => f.s.region === cave);
      expect(f.s.region, cave).toBe(cave);
      expect(f.world.walkable(f.p.x, f.p.z)).toBe(true);
      expect(f.enemies.length).toBeGreaterThan(3);
      expect(f.nodes.some((n) => NODES[n.def].skill === 'mining')).toBe(true);
      // the cave's rock is solid: no walking over the top of it
      expect(f.world.walkable(f.world.cx + f.world.half - 2, f.world.cz)).toBe(false);
      const rope = f.layout.portals[0];
      const r = f.world.nearestWalkable(rope.out.x, rope.out.z, 2)!; f.p.x = r[0]; f.p.z = r[1];
      for (const e of f.enemies) e.alive = false;
      f.interact('portal:0');
      run(f, 10, () => f.s.region === island);
      expect(f.s.region).toBe(island);
      expect(Math.hypot(f.p.x - mouth.out.x, f.p.z - mouth.out.z)).toBeLessThan(2);
    }
  });

  it('old one-world saves load into the right region (Sunreach moved east); a cave save reloads in the cave', () => {
    const fb = defaultSave(base.layout.respawn, base.layout.mooring!);
    const v3 = { ...structuredClone(fb), version: 3, player: { ...fb.player, x: 190, z: 14 }, ship: { x: 190.6, z: 40, heading: 0 } } as Record<string, unknown>;
    delete v3.region;
    const d = parseSave(JSON.stringify(v3), fb)!;
    expect(d.region).toBe('sunreach');
    expect(d.player.x).toBe(420);
    expect(d.ship.region).toBe('sunreach');
    const g1 = new Game({ seed: 1, save: d });
    expect(g1.world.walkable(g1.p.x, g1.p.z)).toBe(true);
    const c = inRegion('smugglers_caves');
    const back = parseSave(JSON.stringify(c.serialize()), fb)!;
    expect(back.region).toBe('smugglers_caves');
    expect(back.ship.region).toBe('bellwether');
    // a Bellwether save from before regions stays put
    const old = { ...structuredClone(fb), version: 3 } as Record<string, unknown>;
    delete old.region;
    expect(parseSave(JSON.stringify(old), fb)!.region).toBe('bellwether');
  });

  it('a death underground wakes you in the island\'s town', () => {
    const f = inRegion('ember_deep');
    f.applyPlayerDamage(999);
    run(f, 5, () => f.s.region !== 'ember_deep');
    expect(f.s.region).toBe('sunreach');
    expect(Math.hypot(f.p.x - f.layout.respawn.x, f.p.z - f.layout.respawn.z)).toBeLessThan(0.5);
  });

  it('the Sunken Temple: the gong wakes the Sunscale, which spits, lashes, summons and drops sunscales', () => {
    const f = inRegion('sunreach');
    for (const s of SKILLS) f.p.xp[s.id] = xpForLevel(75);
    f.p.equip.weapon = { id: 'cutlass_tide', qty: 1 }; f.recalc(); f.p.hp = f.stats.maxHp;
    const a = f.layout.arenas[0];
    expect(a.boss).toBe('temple_serpent');
    for (const e of f.enemies) if (Math.hypot(e.x - a.x, e.z - a.z) < 30) { e.alive = false; e.respawnAt = Infinity; }
    const q = f.world.nearestWalkable(a.altar.x, a.altar.z + 1.5, 2)!; f.p.x = q[0]; f.p.z = q[1];
    f.interact('arena:0');
    expect(f.boss?.def.id).toBe('temple_serpent');
    const kinds = new Set<string>();
    let summoned = false;
    for (let t = 0; t < 120 && f.boss; t += 1 / 30) {
      f.step(1 / 30);
      for (const tg of f.telegraphs) kinds.add(tg.kind);
      if (f.enemies.some((e) => e.summoned)) summoned = true;
      f.p.hp = f.stats.maxHp; // this test is about the fight's moves, not its balance
      if (f.boss) f.target = f.boss.id;
    }
    expect(f.boss).toBeNull();
    expect(kinds.has('line')).toBe(true); // venom spit
    expect(summoned).toBe(true);
    expect(f.s.flags.serpent_defeated).toBe(true);
    expect(f.drops.some((d) => d.stack.id === 'sunscale') || count(f.p.inv, 'sunscale') > 0).toBe(true);
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

  it('Crafting: tans a boar hide, stitches leather gloves at the workbench, casts a gold ring at the furnace', () => {
    const g = fresh();
    g.give('boar_hide', 2); g.give('sea_salt', 2); g.give('bar_gold', 1);
    (g.p.xp as Record<string, number>).crafting = 600; // level 5 for the ring
    const bench = g.layout.stations.find((s) => s.id === 'bench')!;
    goTo(g, bench.x + 1.2, bench.z + 1.2);
    g.craft('craft_tan', 2);
    run(g, 20, () => count(g.p.inv, 'leather') >= 2);
    expect(count(g.p.inv, 'leather')).toBe(2);
    g.craft('craft_gloves_leather', 1);
    run(g, 10, () => count(g.p.inv, 'gloves_leather') >= 1);
    expect(count(g.p.inv, 'gloves_leather')).toBe(1);
    const furnace = g.layout.stations.find((s) => s.id === 'furnace')!;
    goTo(g, furnace.x + 1.6, furnace.z + 1.6);
    g.craft('craft_ring_gold', 1);
    run(g, 10, () => count(g.p.inv, 'ring_gold') >= 1);
    expect(count(g.p.inv, 'ring_gold')).toBe(1);
    expect(g.p.xp.crafting).toBeGreaterThan(600);
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
    for (const id of IDS) {
      const L = regionLayout(id), w = L.world;
      const spots = [...L.buildings.map((b) => ({ x: b.x, z: b.z, r: Math.max(b.w, b.d) / 2, id: b.kind })), ...L.stations.map((s) => ({ x: s.x, z: s.z, r: 0.8, id: s.id })), ...L.banks.map((b) => ({ x: b.x, z: b.z, r: 0.7, id: 'bank' }))];
      for (const sp of spots) {
        const hs: number[] = [];
        for (let a = 0; a < 8; a++) hs.push(w.ground(sp.x + Math.cos(a) * sp.r, sp.z + Math.sin(a) * sp.r));
        expect(Math.max(...hs) - Math.min(...hs), `${id} ${sp.id} at ${sp.x.toFixed(0)},${sp.z.toFixed(0)}`).toBeLessThan(0.45);
      }
    }
  });

  it('every town building stands on a level pad, and every door can be walked to and through', () => {
    for (const id of ISLANDS) for (const b of regionLayout(id).town) {
      const L = regionLayout(id), w = L.world;
      const hs: number[] = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const [x, z] = toWorld(b, sx * b.w / 2, sz * b.d / 2); hs.push(w.ground(x, z)); }
      expect(Math.max(...hs) - Math.min(...hs), `${b.id} floor`).toBeLessThan(0.15);
      const d = doorPoints(b);
      const from = L.respawn;
      expect(w.findPath(from.x, from.z, d.out[0], d.out[1]), `${b.id} door`).not.toBeNull();
      const inn = w.findPath(d.out[0], d.out[1], d.in[0], d.in[1]);
      expect(inn, `${b.id} doorway`).not.toBeNull();
      const end = inn![inn!.length - 1];
      expect(isInside(b, end[0], end[1]), `${b.id} inside`).toBe(true);
    }
    // walls hold: you can't walk straight through a back wall
    const inn = base.layout.town.find((b) => b.id === 'inn')!;
    const [bx, bz] = toWorld(inn, 0, -inn.d / 2 + 0.15);
    expect(base.world.walkable(bx, bz)).toBe(false);
  });

  it('fishing spots hold several fish, each caught only from its own level', () => {
    const sp = NODES.spot_sprat;
    expect(sp.catches?.map((c) => c.item)).toEqual(['fish_sprat_raw', 'fish_mackerel_raw']);
    const catchAt = (level: number) => {
      const g = fresh();
      g.p.xp.fishing = xpForLevel(level);
      const pick = (g as unknown as { pickCatch(l: unknown): { item: string } }).pickCatch.bind(g);
      const got: Record<string, number> = {};
      for (let k = 0; k < 400; k++) { const c = pick(sp.catches!).item; got[c] = (got[c] ?? 0) + 1; }
      return got;
    };
    expect(catchAt(1)).toEqual({ fish_sprat_raw: 400 }); // mackerel needs 14
    const at60 = catchAt(60);
    expect(at60.fish_mackerel_raw).toBeGreaterThan(at60.fish_sprat_raw ?? 0); // the better fish, more often
    for (const n of Object.values(NODES)) for (const c of n.catches ?? []) expect(ITEMS[c.item], c.item).toBeTruthy();
  });

  it('market stalls stand clear of every building and road', () => {
    for (const id of ISLANDS) for (const st of regionLayout(id).stalls) {
      for (const [dx, dz] of [[-1.25, -0.8], [1.25, -0.8], [-1.25, 0.8], [1.25, 0.8], [0, 0]]) {
        const c = Math.cos(st.rot), s = Math.sin(st.rot), x = st.x + dx * c - dz * s, z = st.z + dx * s + dz * c;
        for (const b of regionLayout(id).town) {
          const [lx, lz] = toLocal(b, x, z);
          expect(Math.max(Math.abs(lx) - b.w / 2, Math.abs(lz) - b.d / 2), `stall at ${st.x.toFixed(0)},${st.z.toFixed(0)} vs ${b.id}`).toBeGreaterThan(1);
        }
      }
      const p = nearestPathDist(st.x, st.z);
      expect(p.d - p.width).toBeGreaterThan(1);
    }
  });

  it('every shopkeeper, the banker and the chapel do their jobs', () => {
    for (const sh of Object.values(SHOPS)) {
      const id = ISLANDS.find((r) => regionLayout(r).npcs.some((x) => x.id === sh.keeper))!;
      expect(id, sh.keeper).toBeTruthy();
      const g = inRegion(id);
      const n = g.layout.npcs.find((x) => x.id === sh.keeper)!;
      let opened = '';
      const off = g.on((e) => { if (e.type === 'openShop') opened = e.shop; });
      near(g, n.x, n.z); g.interact(`npc:${n.id}`);
      run(g, 60, () => opened !== '');
      off?.();
      expect(opened, sh.keeper).toBe(sh.id);
      expect(g.nearShop()).toBe(true);
    }
    // Silas pays more for fish than Marta does
    const g = fresh();
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
  it('levels follow RuneScape: oak 15, iron ore 15, coal 30, gold 40; steel gear 5, rune-tier 40; bars 1/15/30; no XP boost', () => {
    const lv = (id: string) => NODES[id].level;
    expect([lv('tree_oak'), lv('tree_willow'), lv('tree_amber'), lv('tree_yew')]).toEqual([15, 30, 45, 60]);
    expect([lv('rock_iron'), lv('rock_coal'), lv('rock_gold')]).toEqual([15, 30, 40]);
    expect([ITEMS.cutlass_steel.equip!.reqs.attack, ITEMS.plate_storm.equip!.reqs.defence, ITEMS.cutlass_cinder.equip!.reqs.attack]).toEqual([5, 10, 40]);
    expect(['smelt_bronze', 'smelt_iron', 'smelt_steel'].map((id) => RECIPES.find((r) => r.id === id)!.level)).toEqual([1, 15, 30]);
    // the anvil: a new item every few levels within a bar's tier (dagger +0, boots +2 ... platebody +18)
    const bronze = RECIPES.filter((r) => r.station === 'anvil' && r.output.id.endsWith('_bronze')).map((r) => r.level).sort((a, b) => a - b);
    expect(bronze).toEqual([1, 2, 3, 3, 4, 5, 6, 7, 13, 15, 17, 19]);
    const g = fresh();
    g.s.key = null; // the starter key's +3% is the only boost, and it's a key's
    g.addXp('woodcutting', 25);
    expect(g.p.xp.woodcutting).toBe(25); // RuneScape's normal log, no boost
    // every skill's guide is grouped into tabs, and the items in it carry their icons
    expect(new Set(UNLOCKS.woodcutting.map((u) => u.cat))).toEqual(new Set(['Trees', 'Hatchets', 'Perks']));
    expect(UNLOCKS.mining.filter((u) => u.cat === 'Rocks').every((u) => ITEMS[u.icon!])).toBe(true);
  });

  it('only camps, lairs and late-game foes attack on sight; the rest fight back when hit. Health is x10', () => {
    const g = fresh();
    expect(g.stats.maxHp).toBe(100);
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab')!;
    for (const e of g.enemies) if (e !== crab) e.alive = false;
    const q = g.world.nearestWalkable(crab.x + 1.2, crab.z, 2)!; g.p.x = q[0]; g.p.z = q[1];
    run(g, 5);
    expect(crab.state).not.toBe('chase'); // a crab minds its own business
    expect(g.p.hp).toBe(100);
    g.target = crab.id;
    run(g, 3, () => crab.state === 'chase' || !crab.alive);
    expect(crab.state === 'chase' || !crab.alive).toBe(true); // hit it and it fights back
    const h = fresh();
    const brig = h.enemies.find((e) => e.def.id === 'brigand')!;
    expect(brig.def.hostile).toBe(true);
    for (const e of h.enemies) if (e !== brig) e.alive = false;
    const r = h.world.nearestWalkable(brig.x + 3, brig.z, 2)!; h.p.x = r[0]; h.p.z = r[1];
    run(h, 3, () => brig.state === 'chase');
    expect(brig.state).toBe('chase'); // a brigand guarding his camp comes for you
  });

  it('the pack sorts by type, value and quality', () => {
    const g = fresh();
    g.p.inv = g.p.inv.map(() => null);
    g.p.inv[3] = { id: 'ore_copper', qty: 5 }; g.p.inv[7] = { id: 'coins', qty: 100 }; g.p.inv[9] = { id: 'hatchet_bronze', qty: 1 };
    g.p.inv[12] = { id: 'fish_shark', qty: 2 }; g.p.inv[15] = { id: 'bread', qty: 3 };
    g.p.inv[20] = { id: 'cutlass_steel', qty: 1, inst: { uid: 1, rarity: 'rare', affixes: [] } }; g.p.inv[21] = { id: 'cutlass_steel', qty: 1 };
    g.sortPack('type');
    expect(g.p.inv.slice(0, 8).map((s) => s?.id ?? null)).toEqual(['coins', 'hatchet_bronze', 'cutlass_steel', 'cutlass_steel', 'fish_shark', 'bread', 'ore_copper', null]);
    g.sortPack('quality');
    expect(g.p.inv[0]?.inst?.rarity).toBe('rare');
    g.sortPack('value');
    const vals = g.p.inv.filter(Boolean).map((s) => stackValue(s!) * s!.qty);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
    expect(g.p.inv.filter(Boolean).length).toBe(7); // nothing lost
  });

  it('rocks and trees give 2-5+ items before they run out, then you carry on to the next one by yourself', () => {
    const g = fresh();
    g.p.xp.mining = xpForLevel(12); g.give('pickaxe_iron', 1); // below the Lasting and double-haul perks, so the count is exact
    const rocks = g.nodes.filter((n) => n.def === 'rock_copper');
    const seen = new Set<number>();
    for (const r of rocks) { expect(r.left).toBeGreaterThanOrEqual(2); expect(r.left).toBeLessThanOrEqual(5); seen.add(r.left); }
    expect(seen.size).toBeGreaterThan(1); // not the same every time
    for (const t of g.nodes.filter((n) => n.def === 'tree_pine')) expect(t.left).toBeGreaterThanOrEqual(3);
    // mine one rock dry with a single click: every ore it held lands, then the miner walks to the next rock
    for (const e of g.enemies) if (Math.hypot(e.x - rocks[0].x, e.z - rocks[0].z) < 30) { e.alive = false; e.respawnAt = Infinity; }
    const first = rocks[0], held = first.left;
    near(g, first.x, first.z);
    g.interact(`node:${first.uid}`);
    expect(run(g, 120, () => first.depletedUntil > g.time)).toBe(true);
    expect(count(g.p.inv, 'ore_copper')).toBe(held);
    expect(run(g, 20, () => g.action?.type === 'gather' && (g.action as { node: string }).node !== first.uid)).toBe(true);
    expect(run(g, 60, () => count(g.p.inv, 'ore_copper') > held)).toBe(true); // still mining, no second click
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
