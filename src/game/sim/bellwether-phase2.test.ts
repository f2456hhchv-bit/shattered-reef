import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { xpForLevel } from './xp';
import { NODES } from '../data/content';
import { LAYOUT } from '../world/island';
import { regionLayout } from '../world/layout';
import { BELLWETHER_REDESIGN } from '../world/variant';

// These run against the opt-in production variant, rather than a mocked coastline.
const phase2 = describe.skipIf(!BELLWETHER_REDESIGN);
const tick = 1 / 20;
function run(g: Game, seconds: number, until: () => boolean) {
  for (let t = 0; t < seconds; t += tick) {
    g.step(tick);
    if (until()) return true;
  }
  return false;
}
function fresh(seed = 13) {
  const l = regionLayout('bellwether');
  const g = new Game({ seed, save: defaultSave(l.respawn, l.mooring!) });
  // Navigation tests isolate terrain and interaction access from roaming encounters.
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
  return g;
}
function use(g: Game, key: string) {
  const target = g.targets().find(t => t.key === key);
  expect(target, key).toBeDefined();
  expect(g.interact(key), key).toBe(true);
  expect(run(g, 240, () => !g.pending && !g.path.length), key).toBe(true);
  if (!g.p.onShip && target!.kind !== 'portal') {
    expect(Math.hypot(g.p.x - target!.x, g.p.z - target!.z), key).toBeLessThanOrEqual(target!.range + 0.4);
    expect(g.world.walkable(g.p.x, g.p.z), key).toBe(true);
  }
}

phase2('Bellwether Phase 2 gameplay on the authored coastline', () => {
  it('walks from the harbour to the actual Wreckers Point endpoint', () => {
    const g = fresh();
    g.moveTo(LAYOUT.wreck.x, LAYOUT.wreck.z);
    expect(run(g, 240, () => !g.path.length)).toBe(true);
    expect(Math.hypot(g.p.x - LAYOUT.wreck.x, g.p.z - LAYOUT.wreck.z)).toBeLessThan(2);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });

  for (const [def, skill] of [['tree_pine', 'woodcutting'], ['rock_copper', 'mining'], ['spot_sprat', 'fishing']] as const) {
    it(`walks to ${def} and earns its resource and ${skill} XP`, () => {
      const g = fresh(19);
      const node = g.nodes.find(n => n.def === def)!;
      const item = NODES[def].item;
      const before = count(g.p.inv, item), xp = g.p.xp[skill];
      use(g, `node:${node.uid}`);
      expect(run(g, 90, () => count(g.p.inv, item) > before)).toBe(true);
      expect(g.p.xp[skill]).toBeGreaterThan(xp);
    });
  }

  it('mines both ores, reaches the furnace, and smelts a bronze bar', () => {
    const g = fresh(23);
    for (const [def, item] of [['rock_copper', 'ore_copper'], ['rock_tin', 'ore_tin']]) {
      const node = g.nodes.find(n => n.def === def)!;
      use(g, `node:${node.uid}`);
      expect(run(g, 90, () => count(g.p.inv, item) > 0)).toBe(true);
    }
    const furnace = g.layout.stations.findIndex(s => s.id === 'furnace');
    use(g, `station:${furnace}`);
    const copper = count(g.p.inv, 'ore_copper'), tin = count(g.p.inv, 'ore_tin'), xp = g.p.xp.smithing;
    g.craft('smelt_bronze', 1);
    expect(run(g, 10, () => count(g.p.inv, 'bar_bronze') === 1)).toBe(true);
    expect(count(g.p.inv, 'ore_copper')).toBe(copper - 1);
    expect(count(g.p.inv, 'ore_tin')).toBe(tin - 1);
    expect(g.p.xp.smithing).toBeGreaterThan(xp);
  });

  it('reaches town banking and shop counters, and advances the relocated lantern quest', () => {
    const g = fresh();
    const events: string[] = [];
    g.on(e => events.push(e.type));
    g.give('logs_pine', 2);
    use(g, 'bank:0');
    expect(events).toContain('openBank');
    g.deposit(g.p.inv.findIndex(s => s?.id === 'logs_pine'));
    expect(count(g.p.inv, 'logs_pine')).toBe(0);
    g.withdraw(g.s.bank.findIndex(s => s.id === 'logs_pine'), 2);
    expect(count(g.p.inv, 'logs_pine')).toBe(2);
    use(g, 'npc:marta');
    expect(g.openShopOf('marta')).toBe(true);
    const stock = g.shop.stock[0];
    g.give('coins', g.buyPrice(stock.id));
    const coins = count(g.p.inv, 'coins'), before = count(g.p.inv, stock.id);
    g.buy(stock.id);
    expect(count(g.p.inv, stock.id)).toBe(before + stock.qty);
    expect(count(g.p.inv, 'coins')).toBeLessThan(coins);
    use(g, 'npc:corwin');
    expect(g.questStage('wreckers')).toBe(1);
    use(g, 'quest:wreckers:lantern');
    expect(g.questStage('wreckers')).toBe(2);
  });

  it('reaches a coastal crab and earns combat XP from a simulated kill', () => {
    const g = fresh(11);
    const crab = g.enemies.find(e => e.def.id === 'reef_crab' && !e.elite)!;
    crab.alive = true;
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[skill] = xpForLevel(30);
    g.recalc(); g.p.hp = g.stats.maxHp;
    const xp = g.p.xp.attack;
    expect(g.interact(`enemy:${crab.id}`)).toBe(true);
    expect(run(g, 240, () => !crab.alive)).toBe(true);
    expect(g.p.xp.attack).toBeGreaterThan(xp);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });

  it('walks to the relocated coastal NPCs and starts their conversations', () => {
    const g = fresh();
    const talked: string[] = [];
    g.on(e => { if (e.type === 'dialog') talked.push(e.npc); });
    for (const id of ['gull', 'muirne', 'dougal']) {
      use(g, `npc:${id}`);
      expect(talked).toContain(id);
    }
  });

  it('boards from land, sails out and back, lands, and walks through the cave and back', () => {
    const g = fresh();
    use(g, 'ship');
    expect(g.p.onShip).toBe(true);
    const mooring = { ...g.layout.mooring! };
    g.moveTo(0, 500);
    expect(run(g, 240, () => Math.hypot(g.ship.x, g.ship.z - 500) < 3)).toBe(true);
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
    g.moveTo(mooring.x, mooring.z);
    const returned = run(g, 240, () => !g.shipTarget && !g.shipRoute.length);
    expect(returned, JSON.stringify({ ship: g.ship, mooring, target: g.shipTarget, route: g.shipRoute })).toBe(true);
    expect(Math.hypot(g.ship.x - mooring.x, g.ship.z - mooring.z)).toBeLessThan(4);
    expect(g.landingPoint()).not.toBeNull();
    g.interact('disembark');
    expect(g.p.onShip).toBe(false);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
    use(g, 'portal:0');
    expect(g.s.region).toBe('smugglers_caves');
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
    use(g, 'portal:0');
    expect(g.s.region).toBe('bellwether');
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });

  it('sails through the eastern sea lane to Sunreach and back to Bellwether', () => {
    const g = fresh();
    use(g, 'ship');
    g.moveTo(610, 450);
    expect(run(g, 360, () => g.s.region === 'sunreach')).toBe(true);
    expect(g.p.onShip).toBe(true);
    expect(g.ship.region).toBe('sunreach');
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
    const b = g.region.bounds;
    g.moveTo(b.cx - b.half + 4, g.ship.z);
    expect(run(g, 90, () => g.s.region === 'bellwether')).toBe(true);
    expect(g.p.onShip).toBe(true);
    expect(g.ship.region).toBe('bellwether');
    expect(g.hullFits(g.ship.x, g.ship.z, g.ship.heading)).toBe(true);
    const mooring = g.layout.mooring!;
    // The return trip must navigate the redesigned east coast back into the harbour.
    for (const f of g.naval.foes) { f.alive = false; f.respawnAt = Infinity; }
    g.moveTo(mooring.x, mooring.z);
    expect(run(g, 360, () => !g.shipTarget && !g.shipRoute.length)).toBe(true);
    expect(g.landingPoint()).not.toBeNull();
    g.interact('disembark');
    expect(g.p.onShip).toBe(false);
    expect(g.world.walkable(g.p.x, g.p.z)).toBe(true);
  });
});
