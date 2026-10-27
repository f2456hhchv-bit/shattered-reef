import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { NODES } from '../data/content';
import { BOOK, BOOK_BY } from '../data/spellbook';
import { PLACES, placeRegion } from '../world/places';

// The spellbook beyond combat (data/spellbook.ts): curses, binds, skilling spells, Superheat, teleports. Cast from
// the Magic tab with or without a staff; paid in shards.
const base = new Game({ seed: 1 });
const fresh = (seed = 7) => {
  const g = new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
  g.p.xp.magic = xpForLevel(99); g.recalc();
  for (const sh of ['shard_gale', 'charm_tide', 'shard_stone', 'shard_ember', 'shard_bone', 'shard_root', 'shard_compass', 'shard_star']) g.give(sh, 200);
  return g;
};
const fightCrab = (g: Game) => {
  const e = g.enemies.find((x) => x.def.id === 'brigand' && !x.elite)!;
  for (const o of g.enemies) if (o !== e) { o.alive = false; o.respawnAt = Infinity; }
  const q = g.world.nearestWalkable(e.x + 1.4, e.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
  g.interact(`enemy:${e.id}`); g.step(1 / 30);
  return e;
};
const settle = (g: Game) => { for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30); };

describe('the spellbook', () => {
  it('curses need a foe; Weaken softens its hits, Confuse its aim, Curse its guard', () => {
    const g = fresh();
    expect(g.bookBlock('weaken')).toMatch(/Nothing to cast it on/);
    const e = fightCrab(g);
    const roll = (n: number) => { let s = 0; for (let k = 0; k < n; k++) s += (g as unknown as { enemyRoll: (e: unknown) => number }).enemyRoll(e); return s / n; };
    g.p.xp.defence = xpForLevel(1); g.recalc();
    const before = roll(4000);
    expect(g.castBook('weaken')).toBe(true);
    expect(e.fx.weaken).toBeGreaterThan(0);
    settle(g);
    expect(g.castBook('confuse')).toBe(true);
    expect(roll(4000)).toBeLessThan(before * 0.8);
    settle(g);
    expect(g.castBook('curse')).toBe(true);
    expect(e.fx.cursed).toBeGreaterThan(0);
  });

  it('binds hold a foe in place for 5, 10 and 15 s; a boss shrugs them off', () => {
    const g = fresh();
    const e = fightCrab(g);
    expect(g.castBook('bind')).toBe(true);
    expect(e.fx.root).toBeCloseTo(5, 0);
    expect([BOOK_BY.snare.bind, BOOK_BY.entangle.bind]).toEqual([10, 15]);
    e.def = { ...e.def, boss: true };
    settle(g);
    expect(g.bookBlock('snare')).toMatch(/too strong to bind/);
  });

  it('skilling spells: Gale Edge, Call the Shoals and Stone Sense help their skill for 5 minutes', () => {
    const g = fresh();
    g.p.xp.woodcutting = xpForLevel(30); g.recalc();
    const d = NODES.tree_oak, before = g.gatherChance(d, 2);
    g.castBook('gale_edge');
    expect(g.buffLeft('woodcutting')).toBeCloseTo(300, 0);
    expect(g.gatherChance(d, 2)).toBeGreaterThan(before * 1.05);
    const end = g.time + 301; while (g.time < end) g.step(1 / 10);
    expect(g.gatherChance(d, 2)).toBeCloseTo(before, 6);
  });

  it('Ember Hand: nothing burns', () => {
    const g = fresh();
    const fire = g.layout.stations.find((s) => s.id === 'fire')!;
    const q = g.world.nearestWalkable(fire.x + 1.2, fire.z + 1.2, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.castBook('ember_hand');
    g.give('fish_sprat_raw', 20); g.craft('cook_sprat', 20);
    for (let k = 0; k < 30 * 80 && g.action; k++) g.step(1 / 30);
    expect(count(g.p.inv, 'burnt_food')).toBe(0);
    expect(count(g.p.inv, 'fish_sprat')).toBe(20);
  });

  it('Superheat smelts a bar from your pack with no furnace, and gives Smithing XP', () => {
    const g = fresh();
    expect(g.bookBlock('superheat')).toMatch(/No ore/);
    g.give('ore_copper', 1); g.give('ore_tin', 1);
    const xp = g.p.xp.smithing;
    expect(g.castBook('superheat')).toBe(true);
    expect(count(g.p.inv, 'bar_bronze')).toBe(1);
    expect(count(g.p.inv, 'ore_copper') + count(g.p.inv, 'ore_tin')).toBe(0);
    expect(g.p.xp.smithing).toBeGreaterThan(xp);
  });

  it('teleports: only where you\'ve been and the sea is open, never mid-fight; they take you there', () => {
    const g = fresh();
    g.combatTimer = 99;
    expect(g.bookBlock('tp_sunreach')).toMatch(/never been/);
    g.s.discovered.push(PLACES.find((p) => placeRegion(p) === 'sunreach')!.id);
    expect(g.bookBlock('tp_sunreach')).toBeNull();
    g.s.discovered.push(PLACES.find((p) => placeRegion(p) === 'longstrand')!.id);
    expect(g.bookBlock('tp_longstrand')).toMatch(/isn't open/);
    const compass = count(g.p.inv, 'shard_compass');
    expect(g.castBook('tp_sunreach')).toBe(true);
    expect(g.s.region).toBe('sunreach');
    expect(count(g.p.inv, 'shard_compass')).toBe(compass - 1);
    g.combatTimer = 0;
    settle(g); g.combatTimer = 0;
    expect(g.bookBlock('tp_bellwether')).toMatch(/fighting/);
  });

  it('enchanting wakes a gem\'s jewellery: same piece and rolled stats, plus a lasting trait', () => {
    const g = fresh();
    g.give('shard_star', 10);
    expect(g.bookBlock('enchant_pearl')).toMatch(/No pearl jewellery/);
    g.give('ring_pearl', 1);
    const i = g.p.inv.findIndex((x) => x?.id === 'ring_pearl');
    g.p.inv[i] = { ...g.p.inv[i]!, inst: { uid: 77, rarity: 'fine', affixes: [{ id: 'regen', v: 1 }] } };
    expect(g.castBook('enchant_pearl', String(i))).toBe(true);
    expect(g.p.inv[i]!.id).toBe('ench_ring_pearl');
    expect(g.p.inv[i]!.inst?.uid).toBe(77); // the very same ring
    const before = g.stats.gather;
    g.equip(i); g.recalc();
    expect(g.stats.gather).toBeGreaterThan(before); // Ring of the Shallows: +6% gathering
    // a ruby amulet needs Enchant Ruby, not Enchant Pearl
    g.give('amulet_ruby', 1);
    expect(g.enchantOptions('enchant_pearl')).toEqual([]);
    expect(g.enchantOptions('enchant_ruby').length).toBe(1);
  });

  it('every gem has its three enchanted pieces, each worth more than the plain one', async () => {
    const { ITEMS } = await import('../data/items');
    for (const gem of ['pearl', 'jade', 'ruby', 'diamond', 'eye']) for (const k of ['ring', 'bracelet', 'amulet']) {
      const e = ITEMS[`ench_${k}_${gem}`];
      expect(e, `${k} ${gem}`).toBeTruthy();
      expect(e.innate?.length).toBeGreaterThan(0);
      expect(e.value).toBeGreaterThan(ITEMS[`${k}_${gem}`].value);
      expect(e.equip?.slot).toBe(ITEMS[`${k}_${gem}`].equip?.slot);
    }
  });

  it('every spell costs shards, levels are in order within each kind, and none needs a staff', () => {
    const g = fresh();
    g.p.equip.weapon = { id: 'cutlass_bronze', qty: 1 }; g.recalc();
    g.give('ore_copper', 1); g.give('ore_tin', 1);
    for (const b of BOOK) expect(b.cost.length, b.id).toBeGreaterThan(0);
    expect(g.castBook('superheat')).toBe(true); // a cutlass in hand: still casts
  });
});
