import { describe, it, expect } from 'vitest';
import { earlyBoost, Game } from './game';
import { levelForXp, xpForLevel, MAX_LEVEL, MAX_XP } from './xp';
import { add, count, emptyInventory, remove } from './inventory';
import { parseSave, defaultSave, SAVE_VERSION, HP_START_XP } from './save';
import { hitChance, combatLevel, levelsOf } from './gear';
import { NODES } from '../data/content';
import { LAYOUT } from '../world/island';

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
    g.p.xp.mining = 500;
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

describe('wear and repair', () => {
  it('gear wears with use, works at reduced effect when worn out, and never breaks', () => {
    const g = fresh();
    g.p.equip.weapon = { id: 'cutlass_bronze', qty: 1, inst: { uid: 9, rarity: 'rare', affixes: [{ id: 'crit', v: 5 }] } };
    g.recalc();
    const fresh100 = g.stats.attRoll;
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(g, crab.x + 1.2, crab.z);
    g.interact(`enemy:${crab.id}`);
    run(g, 20);
    expect(g.p.equip.weapon!.cond).toBeLessThan(100);
    g.p.equip.weapon!.cond = 0.01;
    (g as unknown as { wear: (s: unknown, a: number) => void }).wear(g.p.equip.weapon, 1);
    expect(g.p.equip.weapon!.cond).toBe(0);
    expect(g.p.equip.weapon!.id).toBe('cutlass_bronze'); // still there
    expect(g.stats.attRoll).toBeLessThan(fresh100); // but weaker
  });
  it('repairs at the anvil: yourself with a bar (Smithing XP) or Bram for coins; affixes kept', () => {
    const g = fresh();
    g.p.equip.weapon = { id: 'cutlass_bronze', qty: 1, cond: 0, inst: { uid: 9, rarity: 'rare', affixes: [{ id: 'crit', v: 5 }] } };
    g.give('hatchet_bronze', 1);
    const h = g.p.inv.find((x) => x?.id === 'hatchet_bronze')!; h.cond = 40;
    g.recalc();
    const anvil = g.layout.stations.find((s) => s.id === 'anvil')!;
    goNear(g, anvil.x + 1.2, anvil.z + 1.2);
    const list = g.repairList();
    expect(list.map((r) => r.st.id).sort()).toEqual(['cutlass_bronze', 'hatchet_bronze']);
    g.give('bar_bronze', 1);
    const xp0 = g.p.xp.smithing;
    g.repair('equip:weapon', true);
    expect(g.p.equip.weapon!.cond).toBe(100);
    expect(g.p.equip.weapon!.inst!.affixes[0].id).toBe('crit');
    expect(g.p.xp.smithing).toBeGreaterThan(xp0);
    expect(count(g.p.inv, 'bar_bronze')).toBe(0);
    const coins0 = count(g.p.inv, 'coins');
    const key = g.repairList()[0].key;
    g.repair(key, false);
    expect(h.cond).toBe(100);
    expect(count(g.p.inv, 'coins')).toBeLessThan(coins0);
  });
  it('condition survives a save and the strongbox', () => {
    const g = fresh();
    g.give('helm_bronze', 1);
    const i = g.p.inv.findIndex((x) => x?.id === 'helm_bronze'); g.p.inv[i]!.cond = 33;
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring))!;
    expect(back.player.inv[i]!.cond).toBe(33);
    const b = g.layout.banks[0]; goNear(g, b.x + 1.5, b.z + 1.5);
    g.give('helm_bronze', 1);
    g.deposit('all');
    expect(g.s.bank.filter((e) => e.id === 'helm_bronze').map((e) => e.cond ?? 100).sort()).toEqual([100, 33]);
  });
});

describe('strongbox (bank)', () => {
  it('deposits everything but tools, stacks plain items, withdraws, and survives a save', () => {
    const g = fresh();
    const b = g.layout.banks[0];
    const q = g.world.nearestWalkable(b.x + 1.5, b.z + 1.5, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.give('logs_pine', 12); g.give('helm_bronze', 1); g.give('helm_bronze', 1);
    g.deposit('all');
    expect(count(g.p.inv, 'logs_pine')).toBe(0);
    expect(count(g.p.inv, 'hatchet_chipped')).toBe(1); // tools stay
    expect(g.s.bank.find((e) => e.id === 'logs_pine')!.qty).toBe(12);
    expect(g.s.bank.find((e) => e.id === 'helm_bronze')!.qty).toBe(2); // plain gear stacks in the box
    const i = g.s.bank.findIndex((e) => e.id === 'helm_bronze');
    g.withdraw(i, 1);
    expect(count(g.p.inv, 'helm_bronze')).toBe(1);
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring))!;
    expect(back.bank.find((e) => e.id === 'logs_pine')!.qty).toBe(12);
    expect(back.bank.find((e) => e.id === 'helm_bronze')!.qty).toBe(1);
  });
  it('refuses away from a strongbox, and v2 saves migrate with an empty box', () => {
    const g = fresh();
    g.give('logs_pine', 3);
    g.deposit('all');
    expect(count(g.p.inv, 'logs_pine')).toBe(3);
    const v2 = { ...JSON.parse(JSON.stringify(g.s)), version: 2 };
    delete v2.bank;
    const m = parseSave(JSON.stringify(v2), defaultSave(base.layout.respawn, base.layout.mooring))!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.bank).toEqual([]);
  });
  it('keeps far-out positions on reload (the world is wider than it used to be)', () => {
    const g = fresh();
    g.s.ship.z = -125;
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring))!;
    expect(back.ship.z).toBe(-125);
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
  it('every zone of the starter island is reachable on foot from the quay', () => {
    const g = fresh();
    for (const [id, p] of Object.entries(LAYOUT)) {
      if (id === 'islet' || id === 'spire') continue; // reached by ship (content.test checks those)
      const path = g.world.findPath(g.p.x, g.p.z, p.x, p.z);
      expect(path, id).not.toBeNull();
      const [ex, ez] = path![path!.length - 1];
      expect(Math.hypot(ex - p.x, ez - p.z), id).toBeLessThan(4.5);
    }
  });
  it('sea routes round the headlands without crossing land', () => {
    const g = fresh();
    const M = g.layout.mooring;
    for (const n of g.layout.nodes.filter((x) => NODES[x.def].fromShip)) {
      const route = g.world.findSeaPath(n.x + 4, n.z, M.x, M.z);
      expect(route, n.uid).not.toBeNull();
      let [ax, az] = [n.x + 4, n.z];
      for (const [bx, bz] of route!) {
        for (let k = 1; k <= 20; k++) expect(g.world.sailable(ax + ((bx - ax) * k) / 20, az + ((bz - az) * k) / 20), n.uid).toBe(true);
        [ax, az] = [bx, bz];
      }
    }
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
    expect(g.p.xp.smithing).toBeCloseTo(6.25 * earlyBoost(1), 0); // RuneScape's bronze bar, with the early-levels boost
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
    expect(g.p.xp.attack).toBeGreaterThan(0);
    expect(g.p.xp.hitpoints).toBeGreaterThan(HP_START_XP);
    expect(g.level('attack')).toBeLessThanOrEqual(2); // one crab must not be a big jump
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
    for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = xpForLevel(30);
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

  it('the melee special (whirl) swings at every enemy in range, then goes on cooldown', () => {
    const g = fresh(21);
    g.p.xp.attack = xpForLevel(40);
    g.recalc();
    const crabs = g.enemies.filter((e) => e.def.id === 'reef_crab').slice(0, 3);
    goNear(g, crabs[0].x, crabs[0].z);
    for (const [k, c] of crabs.entries()) { const a = (k / 3) * Math.PI * 2; c.x = g.p.x + Math.cos(a) * 1.6; c.z = g.p.z + Math.sin(a) * 1.6; c.elite = null; }
    const hits = new Set<number>();
    g.on((e) => { if (e.type === 'hit' && e.target === 'enemy') hits.add(e.id); });
    g.useSpecial();
    for (const c of crabs) expect(hits.has(c.id)).toBe(true);
    expect(g.specialCd).toBeGreaterThan(0);
    hits.clear();
    g.useSpecial();
    expect(hits.size).toBe(0);
  });

  it('a dodge roll avoids telegraphed damage and moves the player', () => {
    const g = fresh(23);
    const x0 = g.p.x, z0 = g.p.z;
    g.telegraphs.push({ id: 999, kind: 'circle', x: g.p.x, z: g.p.z, r: 3, angle: 0, width: 0, t: 0, dur: 0.1, damage: 30, source: 0 });
    g.setMoveDir(0, -1);
    g.useRoll();
    const hp = g.p.hp;
    run(g, 0.2);
    expect(g.p.hp).toBe(hp);
    run(g, 0.3);
    expect(Math.hypot(g.p.x - x0, g.p.z - z0)).toBeGreaterThan(2);
    expect(g.rollCd).toBeGreaterThan(0);
  });
});

describe('combat skills (RuneScape model)', () => {
  it('a new character is combat level 3 with 10 hitpoints', () => {
    const g = fresh();
    expect(g.level('hitpoints')).toBe(10);
    expect(g.stats.maxHp).toBe(10);
    expect(combatLevel(levelsOf(g.p.xp))).toBe(3);
  });

  it('hit chance follows the OSRS formula', () => {
    expect(hitChance(1000, 1000)).toBeCloseTo(1000 / 2002, 5);
    expect(hitChance(3000, 1000)).toBeCloseTo(1 - 1002 / 6002, 5);
    expect(hitChance(100, 5000)).toBeLessThan(0.02);
  });

  it('stance decides which skill gets the 4 xp per damage', () => {
    for (const [stance, skill] of [['accurate', 'attack'], ['aggressive', 'strength'], ['defensive', 'defence']] as const) {
      const g = fresh(31);
      g.setStance(stance);
      g.p.xp.attack = g.p.xp.strength = g.p.xp.defence = g.p.xp.hitpoints = xpForLevel(30); // past the early-levels boost
      g.recalc();
      const before = { ...g.p.xp };
      const crab = g.enemies.find((e) => e.def.id === 'reef_crab')!;
      goNear(g, crab.x + 1, crab.z);
      g.interact(`enemy:${crab.id}`);
      run(g, 60, () => !crab.alive);
      expect(crab.alive).toBe(false);
      expect(g.p.xp[skill] - before[skill]).toBeCloseTo(crab.def.hp * 4, 0);
      expect(g.p.xp.hitpoints - before.hitpoints).toBeCloseTo(crab.def.hp * 4 / 3, 0);
    }
  });

  it('pistols burn shot and train Ranged; staffs burn charms and train Magic', () => {
    const g = fresh(33);
    g.p.equip.weapon = { id: 'pistol_flintlock', qty: 1 };
    g.p.equip.ammo = { id: 'shot_bronze', qty: 30 };
    g.recalc();
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!; // elites have triple health
    goNear(g, crab.x + 5, crab.z);
    g.interact(`enemy:${crab.id}`);
    run(g, 60, () => !crab.alive);
    expect(crab.alive).toBe(false);
    expect(g.p.equip.ammo!.qty).toBeLessThan(30);
    expect(g.p.xp.ranged).toBeGreaterThan(0);
    expect(g.p.xp.attack).toBe(0);

    // Tide Bolt burns charms...
    const m = fresh(34);
    m.p.equip.weapon = { id: 'staff_driftwood', qty: 1 };
    m.p.xp.magic = xpForLevel(9);
    m.setSpell('bolt');
    m.give('charm_tide', 40);
    m.recalc();
    const c2 = m.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(m, c2.x + 5, c2.z);
    m.interact(`enemy:${c2.id}`);
    run(m, 60, () => !c2.alive);
    expect(c2.alive).toBe(false);
    expect(count(m.p.inv, 'charm_tide')).toBeLessThan(40);
    expect(m.p.xp.magic).toBeGreaterThan(xpForLevel(9));
    // ...but Brine Spray is free: magic works with no charms at all
    const f = fresh(35);
    f.p.equip.weapon = { id: 'staff_driftwood', qty: 1 };
    f.recalc();
    expect(count(f.p.inv, 'charm_tide')).toBe(0);
    expect(f.ammoBlock()).toBeNull();
    const c3 = f.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(f, c3.x + 5, c3.z);
    f.interact(`enemy:${c3.id}`);
    run(f, 90, () => !c3.alive);
    expect(c3.alive).toBe(false);
    expect(f.p.xp.magic).toBeGreaterThan(0);
  });

  it('every weapon family plays differently: bows need arrows, braces fire twice, pikes reach and pierce, greatswords cleave', () => {
    // a bow won't fire shot; with arrows it fires and burns them
    const b = fresh(36);
    b.p.equip.weapon = { id: 'shortbow_pine', qty: 1 };
    b.p.equip.ammo = { id: 'shot_bronze', qty: 30 };
    b.recalc();
    expect(b.ammoBlock()).toMatch(/needs arrows/);
    b.p.xp.ranged = xpForLevel(40);
    b.recalc();
    const wrongAmmoHit = b.stats.maxHit; // shot adds nothing to a bow
    b.p.equip.ammo = { id: 'arrow_steel', qty: 30 };
    b.recalc();
    expect(b.ammoBlock()).toBeNull();
    expect(b.stats.maxHit).toBeGreaterThan(wrongAmmoHit);
    const c = b.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(b, c.x + 6, c.z);
    b.interact(`enemy:${c.id}`);
    run(b, 60, () => !c.alive);
    expect(c.alive).toBe(false);
    expect(b.p.equip.ammo!.qty).toBeLessThan(30);

    // a pistol brace fires two shots a volley
    const p = fresh(37);
    p.p.equip.weapon = { id: 'pistols_bronze', qty: 1 };
    p.p.equip.ammo = { id: 'shot_bronze', qty: 30 };
    p.p.xp.ranged = xpForLevel(10);
    p.recalc();
    const c2 = p.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(p, c2.x + 5, c2.z);
    p.interact(`enemy:${c2.id}`);
    let shots = 0;
    p.on((e) => { if (e.type === 'shoot') shots++; });
    run(p, 10, () => shots >= 2);
    expect(shots).toBe(2);
    expect(p.p.equip.ammo!.qty).toBeLessThanOrEqual(28 + 1); // two used (a perk could save one)

    // weapon families: reach, speed, cleave
    const w = fresh(38);
    const stat = (id: string) => { w.p.equip.weapon = { id, qty: 1 }; w.recalc(); return { ...w.stats }; };
    const cut = stat('cutlass_bronze'), dag = stat('dagger_bronze'), pike = stat('pike_bronze'), gs = stat('greatsword_bronze');
    expect(pike.range).toBeGreaterThan(cut.range + 1);
    expect(dag.speed).toBeLessThan(cut.speed);
    expect(gs.speed).toBeGreaterThan(cut.speed);
    expect(gs.cleave).toBeGreaterThanOrEqual(0.4);
    expect(gs.kind).toBe('greatsword');

    // a pike thrust runs through a second crab standing in line behind the first
    const k = fresh(39);
    for (const e of k.enemies) { e.alive = false; e.respawnAt = Infinity; }
    const [a1, a2] = k.enemies.filter((e) => e.def.id === 'reef_crab' && !e.elite);
    k.p.equip.weapon = { id: 'pike_bronze', qty: 1 };
    k.p.xp.attack = k.p.xp.strength = xpForLevel(40);
    k.recalc();
    goNear(k, a1.x, a1.z);
    for (const [e, d] of [[a1, 1.6], [a2, 2.6]] as const) { e.alive = true; e.hp = 999; e.x = k.p.x + d; e.z = k.p.z; e.state = 'idle'; }
    for (let t = 0; t < 20 && (a1.hp === 999 || a2.hp === 999); t++) { k.attackCd = 0; (k as unknown as { performAttack(e: unknown): boolean }).performAttack(a1); }
    expect(a1.hp).toBeLessThan(999);
    expect(a2.hp).toBeLessThan(999);
  });

  it('refuses to fire without ammo', () => {
    const g = fresh(35);
    g.p.equip.weapon = { id: 'pistol_flintlock', qty: 1 };
    g.recalc();
    expect(g.ammoBlock()).not.toBeNull();
  });

  it('migrates a v1 save: old Combat XP is shared out, Hitpoints at least 10', () => {
    const fb = defaultSave(base.layout.respawn, base.layout.mooring);
    const v1 = { version: 1, player: { xp: { combat: 4000, mining: 300 }, inv: [], equip: {} }, quests: { bell: 2 } };
    const d = parseSave(JSON.stringify(v1), fb)!;
    expect(d.version).toBe(SAVE_VERSION); // migrates all the way up
    expect(d.player.xp.attack).toBe(1000);
    expect(d.player.xp.hitpoints).toBeGreaterThanOrEqual(HP_START_XP);
    expect(d.player.xp.mining).toBe(300);
    expect(d.quests.bell).toBe(2);
  });

  it('pacing: 10 minutes of crab fighting at level 1 lands around Attack 9-14 (early-level boost), not 20+', () => {
    const g = fresh(41);
    let kills = 0;
    g.on((e) => { if (e.type === 'enemyDeath') kills++; });
    for (let t = 0; t < 600; t += 1 / 30) {
      if (g.dead === 0 && g.target === null) {
        const c = g.enemies.filter((e) => e.def.id === 'reef_crab' && e.alive).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
        if (c) g.interact(`enemy:${c.id}`);
      }
      if (g.p.hp < 5) g.p.hp = g.stats.maxHp; // eats food
      g.step(1 / 30);
    }
    expect(kills).toBeGreaterThan(5);
    expect(g.level('attack')).toBeGreaterThanOrEqual(8);
    expect(g.level('attack')).toBeLessThanOrEqual(16);
  });
});
