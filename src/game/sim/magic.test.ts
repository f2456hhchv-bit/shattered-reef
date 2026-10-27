import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { SPELLS, SHARD, ELEMENT_WEAK, ENEMIES, SHOPS, LOOT, spellById, HP_SCALE } from '../data/content';
import { commonTable } from '../data/drops';

// The spellbook (Tom, 2026-10-27: "look at RuneScape's magic spells... different types of runes... the shards of
// different types"): four elements through strike, bolt, blast, wave and surge, paid in shards.
const base = new Game({ seed: 1 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const ALL = Object.values(SHARD);

describe('the spellbook', () => {
  it('follows RuneScape: levels, max hits and rune costs, element by element', () => {
    const lv = (id: string) => spellById(id)!.level, hit = (id: string) => spellById(id)!.maxHit;
    expect(['gale_strike', 'tide_strike', 'stone_strike', 'ember_strike'].map(lv)).toEqual([1, 5, 9, 13]);
    expect(['gale_bolt', 'tide_bolt', 'stone_bolt', 'ember_bolt'].map(lv)).toEqual([17, 23, 29, 35]);
    expect(['gale_blast', 'tide_blast', 'stone_blast', 'ember_blast'].map(lv)).toEqual([41, 47, 53, 59]);
    expect(['gale_wave', 'tide_wave', 'stone_wave', 'ember_wave'].map(lv)).toEqual([62, 65, 70, 75]);
    expect(['gale_surge', 'tide_surge', 'stone_surge', 'ember_surge'].map(lv)).toEqual([81, 85, 90, 95]);
    expect(['gale_strike', 'ember_strike', 'gale_bolt', 'ember_bolt', 'ember_blast', 'ember_wave', 'ember_surge'].map(hit)).toEqual([2, 8, 9, 12, 16, 20, 24]);
    // Fire Strike: 3 fire, 2 air, 1 mind. Air Surge: 7 air, 1 wrath
    expect(spellById('ember_strike')!.cost).toEqual([{ id: SHARD.ember, qty: 3 }, { id: SHARD.gale, qty: 2 }, { id: SHARD.whisper, qty: 1 }]);
    expect(spellById('gale_surge')!.cost).toEqual([{ id: SHARD.gale, qty: 7 }, { id: SHARD.wrath, qty: 1 }]);
    // every combat spell needs its tier's catalyst; Brine Spray costs nothing
    for (const sp of SPELLS) if (sp.id !== 'spray') expect(sp.cost.some((c) => [SHARD.whisper, SHARD.squall, SHARD.grave, SHARD.heart, SHARD.wrath].includes(c.id as never)), sp.id).toBe(true);
    expect(spellById('spray')!.cost).toEqual([]);
  });

  it('a save\'s old spell becomes the new spell nearest its level', () => {
    const g = fresh();
    g.p.xp.magic = xpForLevel(99);
    g.s.combat.spell = 'deluge'; g.p.equip.weapon = { id: 'staff_driftwood', qty: 1 }; g.recalc();
    expect(g.stats.spell!.id).toBe('ember_surge');
    g.p.xp.magic = xpForLevel(3); g.recalc();
    expect(g.stats.spell!.id).toBe('spray'); // not yet able: the free spell
  });

  it('casting burns the spell\'s shards; short of one, it says which and how many you have', () => {
    const g = fresh();
    g.p.inv = g.p.inv.map(() => null); // no starter shards: counting from nothing
    g.p.xp.magic = xpForLevel(13); g.p.equip.weapon = { id: 'staff_driftwood', qty: 1 };
    g.setSpell('ember_strike'); g.recalc();
    expect(g.ammoBlock()).toMatch(/needs 3 ember shards \(you have 0\)/i);
    g.give(SHARD.ember, 30); g.give(SHARD.gale, 20);
    expect(g.ammoBlock()).toMatch(/needs 1 whisper shard \(you have 0\)/i);
    g.give(SHARD.whisper, 10);
    expect(g.ammoBlock()).toBeNull();
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    const q = g.world.nearestWalkable(crab.x + 5, crab.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact(`enemy:${crab.id}`);
    for (let t = 0; t < 30 && crab.alive; t += 1 / 30) g.step(1 / 30);
    const casts = 10 - count(g.p.inv, SHARD.whisper);
    expect(casts).toBeGreaterThan(0);
    expect(30 - count(g.p.inv, SHARD.ember)).toBe(casts * 3);
    expect(20 - count(g.p.inv, SHARD.gale)).toBe(casts * 2);
  });

  it('an elemental staff supplies its element without end', () => {
    const g = fresh();
    g.p.xp.magic = xpForLevel(13); g.p.equip.weapon = { id: 'staff_el_ember', qty: 1 };
    g.setSpell('ember_strike'); g.recalc();
    g.give(SHARD.gale, 20); g.give(SHARD.whisper, 10);
    expect(g.ammoBlock()).toBeNull(); // no ember shards at all, and none needed
    expect(g.shardNeed(spellById('ember_strike')!.cost)).toEqual([{ id: SHARD.gale, qty: 2 }, { id: SHARD.whisper, qty: 1 }]);
  });

  it('a spell in the foe\'s weak element hits harder and more often (the Guardian fears the tide)', () => {
    expect(ELEMENT_WEAK.guardian).toBe('tide');
    const avg = (spell: string) => {
      const g = fresh(3);
      g.p.xp.magic = xpForLevel(40); g.p.equip.weapon = { id: 'staff_driftwood', qty: 1 };
      g.setSpell(spell); g.recalc();
      const e = { def: ENEMIES.guardian, elite: null, fx: { shatter: 0, marks: 0, root: 0, disarm: 0, slow: 0, lesson: 0, weak: 0, ward: 0, spoil: 0, bite: 0 } };
      let sum = 0; for (let k = 0; k < 4000; k++) sum += (g as unknown as { rollAgainst: (e: unknown) => { dmg: number } }).rollAgainst(e).dmg;
      return sum / 4000 / HP_SCALE;
    };
    // Tide Bolt has the lower max hit (10 to Stone Bolt's 11), and still wins clearly
    expect(avg('tide_bolt')).toBeGreaterThan(avg('stone_bolt') * 1.08);
  });

  it('every foe named weak to an element exists; every shard has a shop or a drop', () => {
    for (const id of Object.keys(ELEMENT_WEAK)) expect(ENEMIES[id], id).toBeTruthy();
    const sold = new Set(Object.values(SHOPS).flatMap((sh) => sh.stock.map((x) => x.id)));
    const dropped = new Set([...Object.values(LOOT).flatMap((l) => l.drops.map((d) => d.item)), ...[1, 20, 40, 60, 80].flatMap((l) => commonTable(l).map((x) => x.pick.item))]);
    for (const sh of ALL) { expect(sold.has(sh), `${sh} sold`).toBe(true); expect(dropped.has(sh), `${sh} dropped`).toBe(true); }
  });
});

describe('magic review fixes (2026-10-28)', () => {
  const setup = (weapon: string, spell: string, lvl = 30) => {
    const g = fresh(11);
    g.p.inv = g.p.inv.map(() => null);
    g.p.xp.magic = xpForLevel(lvl); g.p.equip.weapon = { id: weapon, qty: 1 }; g.setSpell(spell); g.recalc();
    const crab = g.enemies.find((e) => e.def.id === 'reef_crab' && !e.elite)!;
    for (const o of g.enemies) if (o !== crab) { o.alive = false; o.respawnAt = Infinity; }
    const q = g.world.nearestWalkable(crab.x + 5, crab.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    return { g, crab };
  };
  it('out of shards mid-fight, a mage falls back on Brine Spray instead of standing there', () => {
    const { g, crab } = setup('staff_driftwood', 'ember_strike');
    const said: string[] = []; g.on((e) => { if (e.type === 'msg') said.push(e.text); });
    g.interact(`enemy:${crab.id}`);
    for (let t = 0; t < 60 && crab.alive; t += 1 / 30) g.step(1 / 30);
    expect(crab.alive).toBe(false);
    expect(said.some((t) => /Casting Brine Spray/.test(t))).toBe(true);
  });
  it('two wands with shards for one cast: one still fires', () => {
    const { g, crab } = setup('wand_driftwood', 'gale_strike');
    g.p.equip.offhand = { id: 'wand_driftwood', qty: 1 }; g.recalc();
    expect(g.stats.dual).toBeTruthy();
    g.give(SHARD.gale, 1); g.give(SHARD.whisper, 1);
    g.interact(`enemy:${crab.id}`);
    for (let t = 0; t < 3; t += 1 / 30) g.step(1 / 30);
    expect(count(g.p.inv, SHARD.whisper)).toBe(0); // the one cast was paid and cast
  });
  it('a new voyage starts with fifty Gale Strikes\' worth of shards', () => {
    const g = fresh();
    expect(count(g.p.inv, SHARD.gale)).toBe(50);
    expect(count(g.p.inv, SHARD.whisper)).toBe(50);
  });
  it('Superheat with ore beyond your Smithing says which level it needs', () => {
    const g = fresh();
    g.p.xp.magic = xpForLevel(50); g.recalc();
    g.give(SHARD.ember, 10); g.give('shard_root', 2); g.give('ore_iron', 1); g.give('ore_coal', 2);
    expect(g.bookBlock('superheat')).toMatch(/Needs Smithing \d+ for/);
  });
  it('shards cost what a mage can earn: elements and whisper a coin, the tier shards rising to wrath', async () => {
    const { ITEMS } = await import('../data/items');
    expect([SHARD.gale, SHARD.tide, SHARD.stone, SHARD.ember, SHARD.whisper].map((s) => ITEMS[s].value)).toEqual([1, 1, 1, 1, 1]);
    const tiers = [SHARD.squall, SHARD.grave, SHARD.heart, SHARD.wrath].map((s) => ITEMS[s].value);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });
});
