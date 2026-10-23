import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { ITEMS } from '../data/items';
import { NODES, RECIPES, ENEMIES, LOOT, SHOP, UNLOCKS, SKILLS } from '../data/content';

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
    for (const s of SHOP.stock) need(s.id, 'shop');
    for (const e of Object.values(ENEMIES)) if (!LOOT[e.loot]) missing.push(`loot table ${e.loot}`);
    expect(missing).toEqual([]);
  });

  it('every gathering and production skill has something to do at every level, 1 to its top tier', () => {
    const tops: Record<string, number> = { woodcutting: 90, mining: 85, fishing: 85, smithing: 99, gunsmithing: 90, cooking: 84, magic: 80 };
    for (const s of SKILLS) {
      const lv = [...new Set((UNLOCKS[s.id] ?? []).map((u) => u.level))].sort((a, b) => a - b);
      if (!(s.id in tops)) continue;
      expect(lv[0], s.id).toBeLessThanOrEqual(1);
      expect(lv[lv.length - 1], s.id).toBeGreaterThanOrEqual(tops[s.id]);
      for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1], `${s.id} gap ${lv[i - 1]}->${lv[i]}`).toBeLessThanOrEqual(15);
    }
  });

  it('enemies cover combat levels 2 to 80 without a gap over 15', () => {
    const lv = Object.values(ENEMIES).map((e) => e.level).sort((a, b) => a - b);
    expect(lv[0]).toBeLessThanOrEqual(2);
    expect(lv[lv.length - 1]).toBeGreaterThanOrEqual(80);
    for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1]).toBeLessThanOrEqual(15);
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

  it('land nodes can be used from walkable ground; ship nodes sit in open water', () => {
    const bad: string[] = [];
    for (const n of g.layout.nodes) {
      const d = NODES[n.def];
      if (d.fromShip) { if (!g.world.sailable(n.x, n.z)) bad.push(n.def); continue; }
      const reach = d.skill === 'fishing' ? 2.9 : 1.6;
      if (!g.world.nearestWalkable(n.x, n.z, reach)) bad.push(`${n.def}@${n.x.toFixed(0)},${n.z.toFixed(0)}`);
    }
    expect(bad).toEqual([]);
  });

  it('one of each node type and every enemy spawn is reachable on foot from the quay', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const n of g.layout.nodes) {
      if (NODES[n.def].fromShip || seen.has(n.def)) continue;
      seen.add(n.def);
      if (!g.world.findPath(g.p.x, g.p.z, n.x, n.z)) bad.push(n.def);
    }
    for (const s of g.layout.spawns) if (!g.world.findPath(g.p.x, g.p.z, s.x, s.z)) bad.push(s.enemy);
    expect(bad).toEqual([]);
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
      expect(run(g, 60, () => count(g.p.inv, NODES[def].item) >= 1), def).toBe(true);
    }
  });

  it('smelts tidecore and forges tidecore plate at the Ironcrag forge', () => {
    const g = maxed();
    g.give('ore_tide', 5); g.give('ore_coal', 40);
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
