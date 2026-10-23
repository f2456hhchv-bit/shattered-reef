import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { levelForXp, xpForLevel, MAX_LEVEL, MAX_XP } from './xp';
import { add, count, emptyInventory, remove } from './inventory';
import { parseSave, defaultSave, SAVE_VERSION } from './save';
import { NODES } from '../data/content';

// One shared island (building it is the slow part); fresh Game state per test via the save.
const base = new Game({ seed: 7 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring) });

function run(g: Game, seconds: number, until?: () => boolean) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    g.step(1 / 30);
    if (until?.()) return true;
  }
  return false;
}

function goNear(g: Game, x: number, z: number) {
  const p = g.world.nearestWalkable(x, z, 4);
  if (!p) throw new Error(`no walkable spot near ${x},${z}`);
  g.p.x = p[0];
  g.p.z = p[1];
}

describe('xp curve', () => {
  it('matches RuneScape anchors and continues past 99', () => {
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(99)).toBe(13034431);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(13034431)).toBe(99);
    expect(levelForXp(13034430)).toBe(98);
    expect(MAX_LEVEL).toBeGreaterThan(99);
    expect(levelForXp(MAX_XP)).toBe(MAX_LEVEL);
  });
});

describe('inventory', () => {
  it('stacks resources, never stacks gear, and removal is all-or-nothing', () => {
    const inv = emptyInventory();
    add(inv, { id: 'ore_copper', qty: 3 });
    add(inv, { id: 'ore_copper', qty: 2 });
    expect(count(inv, 'ore_copper')).toBe(5);
    expect(inv.filter(Boolean).length).toBe(1);
    add(inv, { id: 'cutlass_bronze', qty: 2 });
    expect(inv.filter(Boolean).length).toBe(3);
    expect(remove(inv, 'ore_copper', 6)).toBe(false);
    expect(count(inv, 'ore_copper')).toBe(5);
    expect(remove(inv, 'ore_copper', 5)).toBe(true);
    expect(count(inv, 'ore_copper')).toBe(0);
  });
  it('reports overflow when full', () => {
    const inv = emptyInventory();
    expect(add(inv, { id: 'hatchet_chipped', qty: 30 })).toBe(2);
  });
});

describe('save', () => {
  it('round-trips and rejects garbage', () => {
    const g = fresh();
    g.give('ore_tin', 4);
    g.addXp('mining', 500);
    const json = JSON.stringify(g.serialize());
    const fb = defaultSave(base.layout.respawn, base.layout.mooring);
    const back = parseSave(json, fb)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.player.xp.mining).toBe(500);
    expect(back.player.inv.some((s) => s?.id === 'ore_tin' && s.qty === 4)).toBe(true);
    expect(parseSave('{not json', fb)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 99 }), fb)).toBeNull();
  });
  it('strips unknown items, bad numbers and wrong-slot gear', () => {
    const fb = defaultSave(base.layout.respawn, base.layout.mooring);
    const evil = { version: 1, player: { x: 'NaN', hp: -5, xp: { mining: 1e12, fishing: 'lots' }, inv: [{ id: 'dragon_scimitar', qty: 1 }, { id: 'coins', qty: 10 }], equip: { head: { id: 'cutlass_bronze', qty: 1 } } }, quests: { bell: 99 } };
    const d = parseSave(JSON.stringify(evil), fb)!;
    expect(d.player.inv[0]).toBeNull();
    expect(d.player.inv[1]?.qty).toBe(10);
    expect(d.player.xp.mining).toBe(MAX_XP);
    expect(d.player.xp.fishing).toBe(0);
    expect(d.player.hp).toBeGreaterThanOrEqual(1);
    expect(d.player.equip.head).toBeUndefined();
    expect(d.quests.bell).toBeLessThanOrEqual(4);
  });
});

describe('world', () => {
  it('spawns on walkable ground, ship in navigable water', () => {
    const g = fresh();
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
  });
  it('finds a path from the quay to the hills, the forest and the ruin', () => {
    const g = fresh();
    const L = g.layout;
    for (const def of ['rock_copper', 'tree_pine']) {
      const n = L.nodes.find((x) => x.def === def)!;
      const path = g.world.findPath(g.p.x, g.p.z, n.x + 1.2, n.z);
      expect(path, def).not.toBeNull();
    }
    expect(g.world.findPath(g.p.x, g.p.z, L.ruin.x, L.ruin.z + 3)).not.toBeNull();
  });
  it('bellfish shoals are only reachable by ship', () => {
    const g = fresh();
    for (const n of g.layout.nodes.filter((x) => NODES[x.def].fromShip)) {
      expect(g.world.walkable(n.x, n.z)).toBe(false);
      expect(g.world.sailable(n.x, n.z)).toBe(true);
    }
  });
  it('blocks walking into the sea and through buildings', () => {
    const g = fresh();
    g.setMoveDir(0, 1); // south, off the end of the quay eventually
    run(g, 20);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });
});

describe('gameplay loop', () => {
  it('gathers copper and tin, smelts bronze, earns xp', () => {
    const g = fresh();
    for (const def of ['rock_copper', 'rock_tin']) {
      const n = g.nodes.find((x) => x.def === def)!;
      goNear(g, n.x + 1.4, n.z);
      g.interact(`node:${n.uid}`);
      const got = run(g, 60, () => count(g.p.inv, def === 'rock_copper' ? 'ore_copper' : 'ore_tin') >= 1);
      expect(got, def).toBe(true);
    }
    expect(g.p.xp.mining).toBeGreaterThan(0);
    const furnace = g.layout.stations.find((s) => s.id === 'furnace')!;
    goNear(g, furnace.x - 1.5, furnace.z + 1.2);
    expect(g.nearStation('furnace')).toBe(true);
    g.craft('smelt_bronze', 1);
    run(g, 5, () => count(g.p.inv, 'bar_bronze') >= 1);
    expect(count(g.p.inv, 'bar_bronze')).toBe(1);
    expect(count(g.p.inv, 'ore_copper')).toBe(0);
    expect(g.p.xp.smithing).toBe(12);
  });

  it('refuses to craft without ingredients and consumes nothing', () => {
    const g = fresh();
    const anvil = g.layout.stations.find((s) => s.id === 'anvil')!;
    goNear(g, anvil.x, anvil.z + 1.3);
    g.craft('forge_cutlass_bronze', 1);
    run(g, 3);
    expect(count(g.p.inv, 'cutlass_bronze')).toBe(0);
    expect(g.action).toBeNull();
  });

  it('walks to a tree via interact and chops logs', () => {
    const g = fresh(3);
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    goNear(g, n.x + 5, n.z + 3);
    g.interact(`node:${n.uid}`);
    expect(run(g, 60, () => count(g.p.inv, 'logs_pine') >= 1)).toBe(true);
  });

  it('boards, sails to a bellfish shoal, fishes, sails back and disembarks', () => {
    const g = fresh(5);
    goNear(g, g.ship.x - 0.5, g.layout.dock.headZ + 1);
    g.interact('ship');
    expect(g.p.onShip).toBe(true);
    g.addXp('fishing', 1200); // level 8+
    const spot = g.nodes.find((x) => x.def === 'spot_bell')!;
    // place ship near the shoal in open water, then fish
    g.ship.x = spot.x + 4; g.ship.z = spot.z;
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
    g.step(0.01);
    g.interact(`node:${spot.uid}`);
    expect(run(g, 60, () => count(g.p.inv, 'fish_bell_raw') >= 1)).toBe(true);
    // sail home by clicking the mooring
    g.moveTo(g.layout.mooring.x, g.layout.mooring.z);
    run(g, 90, () => Math.hypot(g.ship.x - g.layout.mooring.x, g.ship.z - g.layout.mooring.z) < 3);
    expect(g.landingPoint()).not.toBeNull();
    g.interact('disembark');
    expect(g.p.onShip).toBe(false);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });

  it('kills a crab, collects loot, gains combat xp', () => {
    const g = fresh(11);
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab')!;
    goNear(g, crab.x + 1, crab.z);
    g.interact(`enemy:${crab.id}`);
    const coinsBefore = count(g.p.inv, 'coins');
    run(g, 40, () => !crab.alive);
    expect(crab.alive).toBe(false);
    expect(g.p.xp.combat).toBeGreaterThan(0);
    run(g, 3);
    expect(count(g.p.inv, 'coins')).toBeGreaterThan(coinsBefore);
  });

  it('completes The Bell at Low Water end to end', () => {
    const g = fresh(13);
    const iven = g.layout.npcs.find((n) => n.id === 'iven')!;
    goNear(g, iven.x, iven.z + 1.5);
    g.interact('npc:iven');
    expect(g.questStage('bell')).toBe(1);
    // talking again without bronze must not advance
    g.interact('npc:iven');
    expect(g.questStage('bell')).toBe(1);
    g.give('bar_bronze', 1);
    g.interact('npc:iven');
    expect(g.questStage('bell')).toBe(2);
    expect(count(g.p.inv, 'tuning_bell')).toBe(1);
    // strong enough to win quickly; the fight itself is still simulated
    g.addXp('combat', xpForLevel(30));
    g.p.equip.weapon = { id: 'cutlass_iron', qty: 1 };
    g.recalc();
    g.p.hp = g.stats.maxHp;
    goNear(g, g.layout.plinth.x, g.layout.plinth.z + 1.6);
    g.interact('ruin');
    expect(g.boss).not.toBeNull();
    const won = run(g, 240, () => {
      if (g.p.hp < g.stats.maxHp * 0.5) { g.p.hp = g.stats.maxHp; }
      if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id;
      return g.questStage('bell') === 3;
    });
    expect(won).toBe(true);
    expect(g.s.flags.guardian_defeated).toBe(true);
    run(g, 4, () => count(g.p.inv, 'keels_tooth') >= 1);
    // walk onto the tooth if the magnet didn't reach it
    const tooth = g.drops.find((d) => d.stack.id === 'keels_tooth');
    if (tooth) { g.p.x = tooth.x; g.p.z = tooth.z; run(g, 2); }
    expect(count(g.p.inv, 'keels_tooth')).toBe(1);
    goNear(g, iven.x, iven.z + 1.5);
    g.interact('npc:iven');
    expect(g.questStage('bell')).toBe(4);
    expect(count(g.p.inv, 'keels_tooth')).toBe(0);
    // state survives a save/load cycle
    const back = parseSave(JSON.stringify(g.serialize()), defaultSave(g.layout.respawn, g.layout.mooring))!;
    expect(back.quests.bell).toBe(4);
    expect(back.flags.guardian_defeated).toBe(true);
  });

  it('player death respawns at the quay and resets the boss', () => {
    const g = fresh(17);
    g.give('tuning_bell', 1);
    goNear(g, g.layout.plinth.x, g.layout.plinth.z + 1.6);
    g.interact('ruin');
    expect(g.boss).not.toBeNull();
    g.damagePlayer(9999);
    expect(g.boss).toBeNull();
    run(g, 4);
    expect(g.dead).toBe(0);
    expect(Math.hypot(g.p.x - g.layout.respawn.x, g.p.z - g.layout.respawn.z)).toBeLessThan(0.1);
  });
});
