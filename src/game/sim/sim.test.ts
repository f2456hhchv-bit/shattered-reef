import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { PERKS } from '../data/perks';
import { levelForXp, xpForLevel, MAX_LEVEL, MAX_XP } from './xp';
import { add, count, emptyInventory, remove, INV_SIZE } from './inventory';
import { parseSave, defaultSave, SAVE_VERSION, HP_START_XP } from './save';
import { hitChance, combatLevel, levelsOf } from './gear';
import { NODES } from '../data/content';
import { ITEMS } from '../data/items';
import { KEY_CONFIG, KEYS, KEY } from '../data/keys';
import { LAYOUT } from '../world/island';

// One shared island (building it is the slow part); fresh Game state per test via the save.
const base = new Game({ seed: 7 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

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
    expect(add(inv, { id: 'hatchet_chipped', qty: INV_SIZE + 2 })).toBe(2);
  });
});

describe('save', () => {
  it('round-trips and rejects garbage', () => {
    const g = fresh();
    g.give('ore_tin', 4);
    g.p.xp.mining = 500;
    const json = JSON.stringify(g.serialize());
    const fb = defaultSave(base.layout.respawn, base.layout.mooring!);
    const back = parseSave(json, fb)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.player.xp.mining).toBe(500);
    expect(back.player.inv.some((s) => s?.id === 'ore_tin' && s.qty === 4)).toBe(true);
    expect(parseSave('{not json', fb)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 99 }), fb)).toBeNull();
  });
  it('strips unknown items, bad numbers and wrong-slot gear', () => {
    const fb = defaultSave(base.layout.respawn, base.layout.mooring!);
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
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring!))!;
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
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring!))!;
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
    const m = parseSave(JSON.stringify(v2), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.bank).toEqual([]);
  });
  it('keeps far-out positions on reload (the world is wider than it used to be)', () => {
    const g = fresh();
    g.s.ship.z = -125;
    const back = parseSave(JSON.stringify(g.s), defaultSave(base.layout.respawn, base.layout.mooring!))!;
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
    expect(g.world.findPath(g.p.x, g.p.z, L.arenas[0].x, L.arenas[0].z + 3)).not.toBeNull();
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
    const M = g.layout.mooring!;
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
    expect(g.p.xp.smithing).toBeCloseTo(6.4, 1); // RuneScape's bronze bar (6.25) + the starter key's 3%
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
    goNear(g, g.ship.x - 0.5, g.layout.dock!.headZ + 1);
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
    g.moveTo(g.layout.mooring!.x, g.layout.mooring!.z);
    run(g, 90, () => Math.hypot(g.ship.x - g.layout.mooring!.x, g.ship.z - g.layout.mooring!.z) < 3);
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
    goNear(g, g.layout.arenas[0].altar.x, g.layout.arenas[0].altar.z + 1.6);
    g.interact('arena:0');
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
    const back = parseSave(JSON.stringify(g.serialize()), defaultSave(g.layout.respawn, g.layout.mooring!))!;
    expect(back.quests.bell).toBe(4);
    expect(back.flags.guardian_defeated).toBe(true);
  });

  it('player death respawns at the quay and resets the boss', () => {
    const g = fresh(17);
    g.give('tuning_bell', 1);
    goNear(g, g.layout.arenas[0].altar.x, g.layout.arenas[0].altar.z + 1.6);
    g.interact('arena:0');
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
    expect(g.stats.maxHp).toBe(100); // health is ×10: 100 at the start, 990 at 99
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

  it('pistols burn shot and train Ranged; staffs burn shards and train Magic', () => {
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

    // Tide Strike burns its shards (a save's old 'bolt' is the same spell now)...
    const m = fresh(34);
    m.p.equip.weapon = { id: 'staff_driftwood', qty: 1 };
    m.p.xp.magic = xpForLevel(9);
    m.setSpell('bolt');
    expect(m.s.combat.spell).toBe('tide_strike');
    m.give('charm_tide', 40); m.give('shard_gale', 40); m.give('shard_whisper', 40);
    const whisper0 = count(m.p.inv, 'shard_whisper'); // the starter pack has some too
    m.recalc();
    const c2 = m.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    goNear(m, c2.x + 5, c2.z);
    m.interact(`enemy:${c2.id}`);
    run(m, 60, () => !c2.alive);
    expect(c2.alive).toBe(false);
    expect(count(m.p.inv, 'charm_tide')).toBeLessThan(40);
    expect(count(m.p.inv, 'shard_whisper')).toBeLessThan(whisper0);
    expect(m.p.xp.magic).toBeGreaterThan(xpForLevel(9));
    // ...but Brine Spray is free: magic works with no shards at all
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

  it('utility spells: Brine Alchemy turns an item into coins, Tide-walk Home teleports to the quay', () => {
    const g = fresh(40);
    for (const sh of ['shard_ember', 'shard_root', 'shard_gale', 'shard_compass']) g.give(sh, 20);
    g.give('bar_iron', 2);
    const i = g.p.inv.findIndex((s) => s?.id === 'bar_iron');
    expect(g.utilityBlock('alchemy')).toMatch(/Magic level 21/);
    g.p.xp.magic = xpForLevel(25);
    g.recalc();
    const coins = count(g.p.inv, 'coins');
    g.alchemy(i);
    expect(count(g.p.inv, 'bar_iron')).toBe(1);
    expect(count(g.p.inv, 'coins')).toBe(coins + Math.floor(40 * 0.6));
    expect(g.utilityBlock('alchemy')).toMatch(/Ready in/); // a short cooldown between casts
    run(g, 3);
    g.p.x += 40; g.p.z -= 30; g.combatTimer = 99;
    g.teleportHome();
    expect(Math.hypot(g.p.x - g.layout.respawn.x, g.p.z - g.layout.respawn.z)).toBeLessThan(0.01);
  });

  it('half-step perks: every skill earns something at 5, 15 ... 95', () => {
    for (const [sk, list] of Object.entries(PERKS)) {
      const lv = new Set(list.map((p) => p.level));
      for (let L = 5; L <= 95; L += 10) expect(lv.has(L), `${sk} ${L}`).toBe(true);
    }
    const g = fresh(41);
    g.p.xp.attack = xpForLevel(15);
    g.recalc();
    expect(g.stats.specCut).toBeCloseTo(0.05, 5);
  });

  it('every weapon family plays differently: bows need arrows, two pistols fire twice, pikes reach and pierce, greatswords cleave', () => {
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
    // a crab dies to one arrow and Ranged 40 can save an arrow, so shoot a few
    for (const c of b.enemies.filter((e) => e.def.id === 'reef_crab' && !e.elite).slice(0, 4)) {
      goNear(b, c.x + 6, c.z);
      b.interact(`enemy:${c.id}`);
      run(b, 60, () => !c.alive);
      expect(c.alive).toBe(false);
    }
    expect(b.p.equip.ammo!.qty).toBeLessThan(30);

    // a pistol in each hand fires two shots a volley
    const p = fresh(37);
    p.p.equip.weapon = { id: 'pistol_flintlock', qty: 1 };
    p.p.equip.offhand = { id: 'pistol_flintlock', qty: 1 };
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
    const fb = defaultSave(base.layout.respawn, base.layout.mooring!);
    const v1 = { version: 1, player: { xp: { combat: 4000, mining: 300 }, inv: [], equip: {} }, quests: { bell: 2 } };
    const d = parseSave(JSON.stringify(v1), fb)!;
    expect(d.version).toBe(SAVE_VERSION); // migrates all the way up
    expect(d.player.xp.attack).toBe(1000);
    expect(d.player.xp.hitpoints).toBeGreaterThanOrEqual(HP_START_XP);
    expect(d.player.xp.mining).toBe(300);
    expect(d.quests.bell).toBe(2);
  });

  it('pacing: 10 minutes of crab fighting at level 1 lands around Attack 5-10 (RuneScape: 4 XP a damage, no boost), not 20+', () => {
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
    expect(g.level('attack')).toBeGreaterThanOrEqual(5);
    expect(g.level('attack')).toBeLessThanOrEqual(10);
  });
});

describe('gear slots and the off-hand (Tom, 2026-10-25)', () => {
  const slotOf = (g: Game, id: string) => g.p.inv.findIndex((s) => s?.id === id);
  const lv = (g: Game, k: Record<string, number>) => { for (const [s, l] of Object.entries(k)) (g.p.xp as Record<string, number>)[s] = xpForLevel(l); g.recalc(); };

  it('a two-handed weapon empties the off-hand; a shield sends a two-hander back to the pack', () => {
    const g = fresh(50);
    lv(g, { attack: 20, strength: 20, defence: 20 });
    g.give('shield_bronze', 1); g.give('greatsword_bronze', 1);
    g.equip(slotOf(g, 'shield_bronze'));
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    g.equip(slotOf(g, 'greatsword_bronze'));
    expect(g.p.equip.weapon?.id).toBe('greatsword_bronze');
    expect(g.p.equip.offhand).toBeUndefined();
    expect(count(g.p.inv, 'shield_bronze')).toBe(1); // back in the pack, not lost
    g.equip(slotOf(g, 'shield_bronze'));
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    expect(g.p.equip.weapon).toBeUndefined();
    expect(count(g.p.inv, 'greatsword_bronze')).toBe(1);
  });

  it('orbs and books need a wand; a shield fits beside a wand or a pistol; blades pair with blades only', () => {
    const g = fresh(51);
    lv(g, { magic: 30, ranged: 30, attack: 30, defence: 30 });
    g.give('orb_glass', 1); g.give('wand_driftwood', 1); g.give('book_almanac', 1); g.give('shield_bronze', 1);
    g.equip(slotOf(g, 'orb_glass'));
    expect(g.p.equip.offhand).toBeUndefined(); // the cutlass is no wand
    g.equip(slotOf(g, 'wand_driftwood'));
    g.equip(slotOf(g, 'orb_glass'));
    expect(g.p.equip.offhand?.id).toBe('orb_glass');
    g.equip(slotOf(g, 'shield_bronze'));
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    // swapping the wand for a cutlass keeps the shield; a book then can't go in
    g.give('cutlass_bronze', 1);
    g.equip(slotOf(g, 'cutlass_bronze'));
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    g.equip(slotOf(g, 'book_almanac'));
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    // a dagger pairs with the cutlass; a pistol doesn't
    g.give('dagger_bronze', 1); g.give('pistol_flintlock', 1);
    g.equip(slotOf(g, 'pistol_flintlock'), true);
    expect(g.p.equip.offhand?.id).toBe('shield_bronze');
    g.equip(slotOf(g, 'dagger_bronze'), true);
    expect(g.p.equip.offhand?.id).toBe('dagger_bronze');
    expect(g.stats.dual).not.toBeNull();
    // the pistol into the main hand: the dagger no longer pairs, so it goes back to the pack
    g.equip(slotOf(g, 'pistol_flintlock'));
    expect(g.p.equip.offhand).toBeUndefined();
    expect(count(g.p.inv, 'dagger_bronze')).toBe(1);
  });

  it('a second weapon strikes at half its max hit and slows the pair a little; a shield adds defence instead', () => {
    const g = fresh(52);
    lv(g, { attack: 30, strength: 30, defence: 30 });
    g.p.equip.weapon = { id: 'cutlass_steel', qty: 1 }; g.recalc();
    const one = { ...g.stats };
    g.p.equip.offhand = { id: 'cutlass_steel', qty: 1 }; g.recalc();
    expect(g.stats.dual!.maxHit).toBeGreaterThanOrEqual(Math.floor(one.maxHit * 0.4));
    expect(g.stats.dual!.maxHit).toBeLessThanOrEqual(Math.ceil(one.maxHit * 0.6));
    expect(g.stats.speed).toBeGreaterThan(one.speed);
    expect(g.stats.maxHit).toBe(one.maxHit); // the off-hand isn't added to the main hit
    g.p.equip.offhand = { id: 'shield_steel', qty: 1 }; g.recalc();
    expect(g.stats.dual).toBeNull();
    expect(g.stats.def.melee).toBeGreaterThan(one.def.melee);
  });

  it('rings fill both ring slots; the five worn armour pieces add up to what helm and plate gave before', () => {
    const g = fresh(53);
    g.give('ring_brass', 1); g.give('ring_brass', 1); g.give('ring_brass', 1);
    g.equip(slotOf(g, 'ring_brass')); g.equip(slotOf(g, 'ring_brass'));
    expect([g.p.equip.ring?.id, g.p.equip.ring2?.id]).toEqual(['ring_brass', 'ring_brass']);
    g.equip(slotOf(g, 'ring_brass')); // a third swaps with the first
    expect(count(g.p.inv, 'ring_brass')).toBe(1);
    // steel: old helm 12 + plate 32 = 44 melee defence
    const sum = (ids: string[]) => ids.reduce((a, id) => a + (ITEMS[id].equip!.bonus.defMelee ?? 0), 0);
    const suit = sum(['helm_steel', 'plate_steel', 'legs_steel', 'boots_steel', 'gloves_steel']);
    expect(suit).toBeGreaterThanOrEqual(40);
    expect(suit).toBeLessThanOrEqual(46);
  });

  it('an old save with a pistol brace loads as two pistols: one in each hand, or the spare in the pack', () => {
    const d = defaultSave(base.layout.respawn, base.layout.mooring!) as unknown as Record<string, unknown>;
    const p = d.player as Record<string, unknown>;
    p.equip = { weapon: { id: 'pistols_steel', qty: 1, inst: { uid: 4, rarity: 'fine', affixes: [{ id: 'crit', v: 5 }] } } };
    (p.inv as unknown[])[10] = { id: 'pistols_bronze', qty: 1 };
    d.bank = [{ id: 'pistols_iron', qty: 2 }];
    const out = parseSave(JSON.stringify({ ...d, version: 5 }), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect(out.player.equip.weapon?.id).toBe('pistol_steel');
    expect(out.player.equip.weapon?.inst?.rarity).toBe('fine');
    expect(out.player.equip.offhand?.id).toBe('pistol_steel');
    expect(count(out.player.inv, 'pistol_flintlock')).toBe(2);
    expect(out.bank.find((b) => b.id === 'pistol_iron')?.qty).toBe(4);
  });
});

describe('keys and keyholes (docs/KEYS.md)', () => {
  const atBank = (g: Game) => { const b = g.layout.banks[0]; g.p.x = b.x + 1.5; g.p.z = b.z + 1.5; };
  const crabNear = (g: Game) => {
    const c = g.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite && e.alive)!;
    g.p.x = c.x + 2; g.p.z = c.z; g.combatTimer = 99;
    return c;
  };

  it('everyone starts with Quick Study slotted and awake: +3% skilling XP, combat XP untouched', () => {
    const g = fresh(60);
    expect(g.s.keyring).toEqual(['quick_study']);
    expect(g.activeKey()?.id).toBe('quick_study');
    g.addXp('woodcutting', 100); g.addXp('attack', 100);
    expect(g.p.xp.woodcutting).toBeCloseTo(103, 5);
    expect(g.p.xp.attack).toBeCloseTo(100, 5);
  });

  it('swapping: only at a safe spot and never mid-fight; a new key sleeps 30 minutes unless free swaps are on', () => {
    const g = fresh(61);
    g.giveKey('duellist');
    const c = crabNear(g);
    g.slotKey('duellist');
    expect(g.s.key).toBe('quick_study'); // not a safe spot
    atBank(g); g.combatTimer = 0;
    g.slotKey('duellist');
    expect(g.s.key).toBe('quick_study'); // fighting
    g.combatTimer = 99;
    g.slotKey('duellist');
    expect(g.s.key).toBe('duellist');
    expect(g.s.keyDormant).toBe(KEY_CONFIG.dormantS);
    expect(g.activeKey()).toBeNull(); // asleep: no passive, no power
    g.p.equip.weapon = { id: 'cutlass_bronze', qty: 1 }; g.recalc();
    const sleeping = g.stats.attRoll;
    g.s.keyDormant = 0.05; run(g, 0.2);
    expect(g.activeKey()?.id).toBe('duellist');
    expect(g.stats.attRoll).toBeGreaterThan(sleeping); // +6 melee accuracy once awake
    g.s.settings.devFreeKeys = true; g.combatTimer = 99;
    g.slotKey('quick_study');
    expect(g.s.keyDormant).toBe(0);
    expect(c.alive).toBe(true);
  });

  it('powers: Root holds a foe, Disarm stops its attacks, Mark lands two max hits, Drain heals you, bosses take half', () => {
    const g = fresh(62);
    g.s.settings.devFreeKeys = true;
    for (const k of ['woodsman', 'duellist', 'marksman', 'leech']) g.giveKey(k);
    const slot = (id: string) => { atBank(g); g.combatTimer = 99; g.slotKey(id); g.keyCd = 0; };
    // Root
    slot('woodsman');
    let c = crabNear(g); g.p.x = c.x + 2.4; // inside the key's 3 m reach, clear of the push-apart that would nudge it
    g.useKey();
    expect(c.fx.root).toBeGreaterThan(3.9);
    const x0 = c.x; run(g, 1.5);
    expect(Math.abs(c.x - x0)).toBeLessThan(0.05);
    // Disarm: no attack while it lasts
    slot('duellist'); c = crabNear(g); g.p.x = c.x + 1.2;
    const hp0 = g.p.hp; g.useKey();
    expect(c.fx.disarm).toBeGreaterThan(3.9);
    run(g, 3.5);
    expect(g.p.hp).toBe(hp0);
    // Mark: the next two landed hits are max hits
    slot('marksman'); c = crabNear(g); g.p.x = c.x + 1.2;
    g.useKey();
    expect(c.fx.marks).toBe(2);
    // Drain: takes 15% of its health and gives it to you
    slot('leech'); c = crabNear(g); g.p.x = c.x + 1.2; g.p.hp = 50;
    const before = c.hp; g.useKey();
    expect(c.hp).toBeLessThan(before);
    expect(g.p.hp).toBeGreaterThan(50);
    // cooldown blocks a second turn
    expect(g.keyBlock()).toMatch(/Ready in/);
  });

  it('keys turn up anywhere: a kill or a gather can find one you lack, most often from its own line of work', () => {
    const g = fresh(63);
    const kc = KEY_CONFIG.killChance;
    KEY_CONFIG.killChance = 1; // force the roll
    let found = '';
    g.on((e) => { if (e.type === 'keyFound') found = e.id; });
    const c = crabNear(g); g.p.x = c.x + 1.2;
    g.p.equip.weapon = { id: 'cutlass_steel', qty: 1 }; (g.p.xp as Record<string, number>).attack = 2e5; (g.p.xp as Record<string, number>).strength = 2e5; g.recalc();
    g.interact(`enemy:${c.id}`);
    run(g, 30, () => !c.alive);
    KEY_CONFIG.killChance = kc;
    expect(c.alive).toBe(false);
    expect(found).not.toBe('');
    expect(g.s.keyring).toContain(found);
    expect(g.s.keyring.length).toBe(2);
  });

  it('saves keep the keyring: unknown ids dropped, the starter always there, v6 saves get Quick Study', () => {
    const d = defaultSave(base.layout.respawn, base.layout.mooring!) as unknown as Record<string, unknown>;
    const v6 = { ...d, version: 6 } as Record<string, unknown>;
    delete v6.keyring; delete v6.key; delete v6.keyDormant;
    const a = parseSave(JSON.stringify(v6), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect([a.keyring, a.key, a.keyDormant]).toEqual([['quick_study'], 'quick_study', 0]);
    const b = parseSave(JSON.stringify({ ...d, keyring: ['leech', 'nonsense', 7], key: 'leech', keyDormant: 99999 }), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect(b.keyring).toEqual(['quick_study', 'leech']);
    expect(b.key).toBe('leech');
    expect(b.keyDormant).toBeLessThanOrEqual(3600);
    const c = parseSave(JSON.stringify({ ...d, keyring: [], key: 'wanderer' }), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect(c.key).toBe('quick_study'); // can't slot a key you don't have
  });
});

describe('bounties and crew', () => {
  const strong = (g: Game) => { for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = xpForLevel(60); g.p.equip.weapon = { id: 'cutlass_steel', qty: 1 }; g.recalc(); g.p.hp = g.stats.maxHp; };
  const killNear = (g: Game, e: { x: number; z: number; id: number; alive: boolean }) => { g.p.x = e.x + 1.4; g.p.z = e.z; g.interact(`enemy:${e.id}`); run(g, 40, () => !e.alive); };

  it('the board posts contracts; a hunt pays coins and bounty the moment it is done', () => {
    const g = fresh(70);
    strong(g);
    const offers = g.boardOffers('bellwether');
    expect(offers.length).toBeGreaterThanOrEqual(2);
    g.s.boards.bellwether = { offers: [{ id: 999, board: 'bellwether', kind: 'hunt', enemy: 'reef_crab', need: 2, have: 0, coins: 40, bounty: 30 }], refreshAt: 1e9 };
    g.acceptContract('bellwether', 999);
    expect(g.s.contracts.length).toBe(1);
    const coins0 = count(g.p.inv, 'coins');
    for (let k = 0; k < 2; k++) killNear(g, g.enemies.find((e) => e.def.id === 'reef_crab' && e.alive && !e.elite)!);
    expect(g.s.contracts.length).toBe(0);
    expect(count(g.p.inv, 'coins')).toBeGreaterThanOrEqual(coins0 + 40);
    expect(g.s.bounty).toBeGreaterThanOrEqual(30);
  });

  it('a wanted target appears where it lurks, named and tough; beating it completes the contract and it never comes back', () => {
    const g = fresh(71);
    strong(g);
    const w = g.boardOffers('bellwether').find((c) => c.kind === 'wanted')!;
    expect(w).toBeTruthy();
    expect(w.region).toBe('bellwether');
    g.acceptContract('bellwether', w.id);
    run(g, 0.2);
    const e = g.enemies.find((x) => x.contract === w.id)!;
    expect(e).toBeTruthy();
    expect(g.enemyName(e)).toContain(w.name!);
    expect(e.maxHp).toBe(e.def.hp * 10 * 3);
    e.hp = 10;
    killNear(g, e);
    expect(g.s.contracts.length).toBe(0);
    expect(g.s.bounty).toBeGreaterThanOrEqual(w.bounty);
    run(g, 2);
    expect(g.enemies.some((x) => x.contract === w.id)).toBe(false);
  });

  it('a big bounty sends hunters after you, away from town', () => {
    const g = fresh(72);
    let warned = false;
    g.on((e) => { if (e.type === 'hunters') warned = true; });
    g.addBounty(6000);
    expect(g.s.hunterAt).toBeGreaterThan(0);
    const far = g.enemies.find((e) => e.def.id === 'reef_crab')!;
    g.p.x = far.x + 3; g.p.z = far.z;
    g.s.playTime = g.s.hunterAt + 1;
    run(g, 0.2);
    expect(warned).toBe(true);
    const hunters = g.enemies.filter((e) => e.def.id.startsWith('bounty_'));
    expect(hunters.length).toBeGreaterThanOrEqual(2);
    expect(hunters.every((h) => h.state === 'chase' && h.once)).toBe(true);
  });

  it('crew: sign a sailor (bounty and fee), their bonus counts, and your first mate fights beside you for no XP', () => {
    const g = fresh(73);
    expect(g.recruitBlock('jory')).toMatch(/bounty/);
    g.give('coins', 500);
    const heal0 = g.stats.healBonus;
    g.recruit('nell');
    expect(g.s.crew).toEqual(['nell']);
    expect(g.s.mate).toBe('nell');
    expect(g.stats.healBonus).toBeCloseTo(heal0 + 0.1, 5);
    const c = g.enemies.find((e) => e.def.id === 'reef_crab' && e.alive && !e.elite)!;
    g.p.x = c.x + 4; g.p.z = c.z;
    run(g, 0.5);
    expect(g.mate).not.toBeNull();
    c.state = 'chase'; // it's coming for you
    let mateHits = 0;
    g.on((e) => { if (e.type === 'mateAttack') mateHits++; });
    g.p.equip.weapon = undefined; g.recalc();
    run(g, 8, () => mateHits > 0);
    expect(mateHits).toBeGreaterThan(0);
    g.setMate(null);
    run(g, 0.1);
    expect(g.mate).toBeNull();
  });

  it('saves keep bounty, contracts and crew; junk is dropped; v7 saves start at zero', () => {
    const d = defaultSave(base.layout.respawn, base.layout.mooring!) as unknown as Record<string, unknown>;
    const v7 = { ...d, version: 7 } as Record<string, unknown>;
    for (const k of ['bounty', 'boards', 'contracts', 'crew', 'mate', 'hunterAt']) delete v7[k];
    const a = parseSave(JSON.stringify(v7), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect([a.bounty, a.contracts, a.crew, a.mate]).toEqual([0, [], [], null]);
    const b = parseSave(JSON.stringify({ ...d, bounty: 1234, crew: ['nell', 'ghost'], mate: 'ghost',
      contracts: [{ id: 1, board: 'bellwether', kind: 'hunt', enemy: 'reef_crab', need: 5, have: 2, coins: 10, bounty: 5 }, { id: 2, board: 'nowhere', enemy: 'reef_crab' }, { id: 3, board: 'sunreach', kind: 'wanted', enemy: 'nobody' }] }), defaultSave(base.layout.respawn, base.layout.mooring!))!;
    expect(b.bounty).toBe(1234);
    expect(b.crew).toEqual(['nell']);
    expect(b.mate).toBeNull();
    expect(b.contracts.map((c) => c.id)).toEqual([1]);
  });
});

describe('the second ring of keys', () => {
  const setup = (seed: number, key: string) => {
    const g = fresh(seed);
    g.s.settings.devFreeKeys = true;
    g.giveKey(key);
    const b = g.layout.banks[0]; g.p.x = b.x + 1.5; g.p.z = b.z + 1.5; g.combatTimer = 99;
    g.slotKey(key);
    return g;
  };
  const near = (g: Game, id = 'reef_crab') => { const c = g.enemies.find((e) => e.def.id === id && e.alive && !e.elite)!; g.p.x = c.x + 1.3; g.p.z = c.z; g.keyCd = 0; return c; };

  it('there are 25 keys; Keel\'s Tooth never drops but comes with the bell quest (and to anyone who finished it already)', () => {
    expect(KEYS.length).toBe(28);
    expect(KEY.keels_tooth.rarity).toBe('quest');
    expect(KEY.draugr_key.rarity).toBe('quest'); // The Barrow King's
    const d = defaultSave(base.layout.respawn, base.layout.mooring!);
    d.flags.bell_done = true;
    const g = new Game({ seed: 80, save: d });
    expect(g.s.keyring).toContain('keels_tooth');
  });

  it('Rust halves a foe\'s blows; Ward stops them; Spoil rots it; Pickpocket works once per foe', () => {
    let g = setup(81, 'smith'); let c = near(g);
    g.useKey(); expect(c.fx.weak).toBeGreaterThan(5);
    g = setup(82, 'bulwark'); c = near(g);
    const hp = g.p.hp; g.useKey(); c.state = 'chase'; run(g, 4.5);
    expect(g.p.hp).toBe(hp);
    g = setup(83, 'cook'); c = near(g);
    const before = c.hp; g.useKey(); run(g, 3, () => !c.alive);
    expect(c.hp).toBeLessThan(before);
    g = setup(84, 'finder'); c = near(g);
    g.useKey(); expect(c.fx.picked).toBe(true);
    g.keyCd = 0; g.useKey(); expect(g.keyCd).toBe(0); // refused: no cooldown spent
  });

  it('Knockdown hurls and stuns; Fuse bursts; Chain jumps; Toll stuns everything near', () => {
    let g = setup(85, 'brute'); let c = near(g);
    const d0 = Math.hypot(c.x - g.p.x, c.z - g.p.z); g.useKey();
    expect(Math.hypot(c.x - g.p.x, c.z - g.p.z)).toBeGreaterThan(d0 + 0.5);
    expect(c.fx.root).toBeGreaterThan(1.9);
    g = setup(86, 'powder'); c = near(g);
    const h = c.hp; g.useKey(); run(g, 2.5);
    expect(c.hp < h || !c.alive).toBe(true);
    g = setup(87, 'bell'); c = near(g);
    g.useKey(); expect(c.fx.disarm).toBeGreaterThan(1.4);
    expect(g.utilityCost('home')).toEqual([]);
  });

  it('Steal only works on elites and lends their power; Turncoat sets a foe on its own side; bosses refuse it', () => {
    const g = setup(88, 'skeleton');
    const c = near(g);
    g.useKey(); expect(g.keyCd).toBe(0); // not an elite: refused
    c.elite = 'barnacled'; const dr = g.stats.dr;
    g.useKey(); expect(g.stolen?.affix).toBe('barnacled'); expect(g.stats.dr).toBeGreaterThan(dr);
    const t = setup(89, 'mutineer'); const a = near(t);
    t.useKey(); expect(a.fx.turn).toBeGreaterThan(7);
  });
});
