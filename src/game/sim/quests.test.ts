import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { count } from './inventory';
import { QUESTS } from '../data/quests';
import { STORM } from './stormtide';
import { regionLayout } from '../world/layout';
import { SPELLS } from '../data/content';

// Bellwether's quests and the Storm Tide (docs/ISLANDS.md, slice 1), played through in the simulation.
const base = new Game({ seed: 1 });
const fresh = (seed = 7) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const near = (g: Game, x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 3)!; g.p.x = q[0]; g.p.z = q[1]; };
const run0 = (g: Game, secs: number, until: () => boolean) => { for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until()) return; } };
/** Walk up and talk (some folk stand indoors: let the walk finish). */
const talk = (g: Game, id: string) => { const n = g.layout.npcs.find((x) => x.id === id)!; near(g, n.x + 1, n.z); g.interact(`npc:${id}`); g.step(1 / 30); run0(g, 15, () => !g.pending && g.path.length === 0); };
const use = (g: Game, quest: string, mark: string) => { const m = g.questMarks().find((x) => x.quest === quest && x.mark.id === mark)!; near(g, m.mark.x, m.mark.z); g.interact(`quest:${quest}:${mark}`); g.step(1 / 30); };
const run = (g: Game, secs: number, until?: () => boolean) => { for (let t = 0; t < secs; t += 1 / 30) { g.step(1 / 30); if (until?.()) return true; } return false; };
/** A strong fighter with the foe in reach: beat it the honest way. */
function beat(g: Game, foe: string, lvl = 40, weapon = 'cutlass_steel') {
  for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = xpForLevel(lvl);
  g.p.equip.weapon = { id: weapon, qty: 1 }; g.recalc(); g.p.hp = g.stats.maxHp;
  run(g, 3, () => g.enemies.some((e) => e.def.id === foe && e.alive));
  const e = g.enemies.find((x) => x.def.id === foe && x.alive)!;
  near(g, e.x + 1.5, e.z);
  g.interact(`enemy:${e.id}`);
  return run(g, 90, () => { g.p.hp = g.stats.maxHp; return !e.alive; });
}

describe('Bellwether\'s quests', () => {
  it('Knock Three Times: listen in order (a wrong one starts again), beat the Elder, take Pellow\'s lamp', () => {
    const g = fresh();
    talk(g, 'pellow');
    expect(g.questStage('knock')).toBe(1);
    use(g, 'knock', 'k1'); use(g, 'knock', 'k3'); // out of order
    expect(g.questStage('knock')).toBe(1);
    use(g, 'knock', 'k1'); use(g, 'knock', 'k2'); use(g, 'knock', 'k3');
    expect(g.questStage('knock')).toBe(2);
    expect(beat(g, 'knocker_elder')).toBe(true);
    expect(g.questStage('knock')).toBe(3);
    talk(g, 'pellow');
    expect(g.questStage('knock')).toBe(QUESTS.knock.stages.length - 1);
    expect(count(g.p.inv, 'knockers_lamp')).toBe(1);
  });

  it('The Selkie\'s Skin: dig the wet sand, then give the skin back (ring) or to Dougal (cloak)', () => {
    for (const who of ['muirne', 'dougal'] as const) {
      const g = fresh();
      talk(g, 'muirne'); talk(g, 'dougal');
      expect(g.questStage('selkie')).toBe(2);
      use(g, 'selkie', 'dry1');
      expect(count(g.p.inv, 'sealskin')).toBe(0);
      use(g, 'selkie', 'wet');
      expect(count(g.p.inv, 'sealskin')).toBe(1);
      talk(g, who);
      expect(g.questStage('selkie')).toBe(QUESTS.selkie.stages.length - 1);
      expect(count(g.p.inv, 'sealskin')).toBe(0);
      expect(count(g.p.inv, who === 'muirne' ? 'ring_selkie' : 'cloak_selkie')).toBe(1);
      expect(g.s.flags[who === 'muirne' ? 'selkie_freed' : 'selkie_kept']).toBe(true);
    }
  });

  it('Wreckers\' Lantern: douse the light, sink two cutters at sea, beat the chief; the swivel gun hits harder', () => {
    const g = fresh();
    talk(g, 'corwin');
    use(g, 'wreckers', 'lantern');
    expect(g.questStage('wreckers')).toBe(2);
    // a real sinking at sea counts
    const f = g.naval.foes.find((x) => x.def.id === 'wreckers_cutter')!;
    const q = g.nearestSea(f.x + 8, f.z)!;
    Object.assign(g.ship, { x: q[0], z: q[1], heading: Math.atan2(f.z - q[1], f.x - q[0]) - Math.PI / 2 }); g.p.onShip = true; g.p.x = q[0]; g.p.z = q[1];
    f.hp = 1;
    g.naval.fire();
    run(g, 2, () => !f.alive);
    expect(f.alive).toBe(false);
    expect(g.questStage('wreckers')).toBe(2);
    g.questKill('wreckers_cutter');
    expect(g.questStage('wreckers')).toBe(3);
    g.p.onShip = false;
    const before = g.naval;
    expect(beat(g, 'wrecker_chief')).toBe(true);
    talk(g, 'corwin');
    expect(g.questStage('wreckers')).toBe(QUESTS.wreckers.stages.length - 1);
    expect(g.s.flags.swivel_gun).toBe(true);
    expect(before).toBe(g.naval);
  });

  it('quest progress (an order half done, a count) survives a save and reload', () => {
    const g = fresh();
    talk(g, 'pellow');
    use(g, 'knock', 'k1');
    const back = new Game({ seed: 7, save: JSON.parse(JSON.stringify(g.serialize())) });
    use(back, 'knock', 'k2'); use(back, 'knock', 'k3');
    expect(back.questStage('knock')).toBe(2);
  });
});

describe('Sunreach\'s quests', () => {
  const sun = (seed = 7) => { const L = regionLayout('sunreach'); return new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } }); };

  it('Backward Tracks: read the trail the opposite way to the toes (a false lead starts again), beat the elder, get the hat', () => {
    const g = sun();
    talk(g, 'abena');
    expect(g.questStage('tracks')).toBe(1);
    use(g, 'tracks', 't1'); use(g, 'tracks', 't2');
    use(g, 'tracks', 'd1'); // a false lead
    use(g, 'tracks', 't3');
    expect(g.questStage('tracks')).toBe(1);
    for (const m of ['t1', 't2', 't3', 't4']) use(g, 'tracks', m);
    expect(g.questStage('tracks')).toBe(2);
    expect(beat(g, 'douen_elder')).toBe(true);
    talk(g, 'abena');
    expect(g.questStage('tracks')).toBe(QUESTS.tracks.stages.length - 1);
    expect(count(g.p.inv, 'hat_douen')).toBe(1);
  });

  it('The Sunken Temple: read the glyphs in the sun\'s order, strike the gong, beat the Sunscale, take the Sun Key', () => {
    const g = sun();
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'halyard_watch');
    expect(g.questStage('temple')).toBe(1);
    use(g, 'temple', 'rise'); use(g, 'temple', 'set'); // setting before high: wrong
    expect(g.questStage('temple')).toBe(1);
    for (const m of ['rise', 'high', 'set']) use(g, 'temple', m);
    expect(g.questStage('temple')).toBe(2);
    for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = xpForLevel(50);
    g.p.equip.weapon = { id: 'cutlass_storm', qty: 1 }; g.recalc(); g.p.hp = g.stats.maxHp;
    const a = g.layout.arenas.findIndex((x) => x.boss === 'temple_serpent');
    near(g, g.layout.arenas[a].altar.x, g.layout.arenas[a].altar.z + 1.5);
    g.interact(`arena:${a}`);
    run(g, 120, () => { g.p.hp = g.stats.maxHp; if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id; return g.questStage('temple') === 3; });
    expect(g.questStage('temple')).toBe(3);
    talk(g, 'halyard_watch');
    expect(g.questStage('temple')).toBe(QUESTS.temple.stages.length - 1);
    expect(g.s.keyring).toContain('sun_key');
  });

  it('Salt for the Soucouyant: no salt, no progress; salted skin brings her down; the fire spell is hers to teach', () => {
    const g = sun();
    for (const k of ['magic'] as const) g.p.xp[k] = xpForLevel(25);
    talk(g, 'nana_ayo');
    expect(g.questStage('souc')).toBe(1);
    use(g, 'souc', 'tree');
    expect(g.questStage('souc')).toBe(1); // no salt
    g.give('sea_salt', 3);
    use(g, 'souc', 'tree');
    expect(g.questStage('souc')).toBe(2);
    expect(count(g.p.inv, 'sea_salt')).toBe(0);
    g.setSpell('souc_fire');
    expect(g.s.combat.spell).not.toBe('souc_fire'); // not taught yet
    expect(beat(g, 'soucouyant')).toBe(true);
    talk(g, 'nana_ayo');
    expect(g.s.flags.souc_done).toBe(true);
    g.setSpell('souc_fire');
    expect(g.s.combat.spell).toBe('souc_fire');
    expect(SPELLS.find((sp) => sp.id === 'souc_fire')!.quest).toBe('souc_done');
  });
});

describe('Amberhold\'s quests', () => {
  const amb = (seed = 7) => { const L = regionLayout('amberhold'); return new Game({ seed, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } }); };
  const quiet = (g: Game) => { for (const e of g.enemies) if (!e.def.id.startsWith('barrow_king')) { e.alive = false; e.respawnAt = Infinity; } };

  it('The Barrow King: light the lamps in the song\'s order, beat the king, take his helm and the Draugr\'s Key', () => {
    const g = amb();
    quiet(g);
    talk(g, 'sigrun');
    expect(g.questStage('barrow')).toBe(1);
    use(g, 'barrow', 'ln'); use(g, 'barrow', 'lw'); // sunset before sunrise: wrong
    use(g, 'barrow', 'le'); use(g, 'barrow', 'ls');
    expect(g.questStage('barrow')).toBe(1);
    for (const m of ['ln', 'le', 'lw', 'ls']) use(g, 'barrow', m);
    expect(g.questStage('barrow')).toBe(2);
    expect(beat(g, 'barrow_king', 50, 'cutlass_tide')).toBe(true);
    talk(g, 'sigrun');
    expect(g.questStage('barrow')).toBe(QUESTS.barrow.stages.length - 1);
    expect(count(g.p.inv, 'helm_barrow')).toBe(1);
    expect(g.s.keyring).toContain('draugr_key');
  });

  it('The Nøkk\'s Fiddle: listen, play the tune back in order, take the bridle; the figurehead toughens the sloop', () => {
    const g = amb();
    quiet(g);
    const hull = g.naval.hullMax();
    talk(g, 'ingrid');
    use(g, 'fiddle', 'listen');
    expect(g.questStage('fiddle')).toBe(2);
    use(g, 'fiddle', 'high'); // out of order
    use(g, 'fiddle', 'low'); use(g, 'fiddle', 'high'); use(g, 'fiddle', 'mid');
    expect(g.questStage('fiddle')).toBe(3);
    use(g, 'fiddle', 'bridle');
    expect(count(g.p.inv, 'nokk_bridle')).toBe(1);
    talk(g, 'ingrid');
    expect(g.questStage('fiddle')).toBe(QUESTS.fiddle.stages.length - 1);
    expect(g.s.flags.nokk_figurehead).toBe(true);
    expect(g.naval.hullMax()).toBeGreaterThan(hull);
  });
});

describe('Stormwrack\'s quest', () => {
  it('The Drowned Captain\'s Log: find the pages in order, beat the captain, dig up the hoard', () => {
    const L = regionLayout('wrack');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'wrack' } });
    for (const e of g.enemies) if (e.def.id !== 'wreck_captain') { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'mercy');
    expect(g.questStage('captain')).toBe(1);
    for (const m of ['p1', 'p2', 'p3']) use(g, 'captain', m);
    expect(g.questStage('captain')).toBe(2);
    expect(beat(g, 'wreck_captain', 80, 'cutlass_tide')).toBe(true);
    expect(g.questStage('captain')).toBe(3);
    use(g, 'captain', 'dig');
    expect(count(g.p.inv, 'hat_captain')).toBe(1);
    talk(g, 'mercy');
    expect(g.questStage('captain')).toBe(QUESTS.captain.stages.length - 1);
  });
});

describe('Star-Struck', () => {
  it('search the camp in order, beat Tobin, take the shard, quench it at the vent forge for the pendant', () => {
    const L = regionLayout('wrack');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'edda');
    expect(g.questStage('starfall')).toBe(1);
    for (const m of ['journal', 'glass', 'tracks']) use(g, 'starfall', m);
    expect(g.questStage('starfall')).toBe(2);
    expect(beat(g, 'starstruck', 70, 'cutlass_tide')).toBe(true);
    expect(g.questStage('starfall')).toBe(3);
    use(g, 'starfall', 'shard');
    expect(count(g.p.inv, 'star_shard')).toBe(1);
    use(g, 'starfall', 'quench');
    expect(count(g.p.inv, 'star_shard')).toBe(0);
    expect(count(g.p.inv, 'amulet_starfall')).toBe(1);
    talk(g, 'edda');
    expect(g.questStage('starfall')).toBe(QUESTS.starfall.stages.length - 1);
    expect(g.s.flags.starfall_done).toBe(true);
  });
});

describe('The Key Collector', () => {
  it('waits on the bell, then on the Sun and Draugr keys; the trail leads to Stormwrack; the Skeleton Key at the end', () => {
    let g = fresh();
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(0); // the bell quest comes first
    g.s.quests.bell = QUESTS.bell.stages.length - 1; g.s.flags.bell_done = true;
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(1);
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(1); // not without both keys
    g.s.flags.temple_done = true; g.s.flags.barrow_done = true;
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(2);
    // to Stormwrack
    const L = regionLayout('wrack'), sv = g.serialize();
    sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    use(g, 'collector', 'camp');
    expect(g.questStage('collector')).toBe(3);
    expect(beat(g, 'key_collector', 80, 'cutlass_tide')).toBe(true);
    expect(g.questStage('collector')).toBe(4);
    const L2 = regionLayout('bellwether'), sv2 = g.serialize();
    sv2.player.x = L2.respawn.x; sv2.player.z = L2.respawn.z;
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv2)), region: 'bellwether' } });
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(QUESTS.collector.stages.length - 1);
    expect(g.s.keyring).toContain('skeleton');
  });
});

describe('The Toll of Tollhouse', () => {
  const at = (region: 'amberhold' | 'sunreach', save?: unknown) => {
    const L = regionLayout(region);
    const sv = save ? { ...(JSON.parse(JSON.stringify(save))), region } : { ...defaultSave(L.respawn, L.mooring!), region };
    const g = new Game({ seed: 7, save: sv });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    return g;
  };
  /** sail across: the same save, loaded in the other region at its harbour */
  const cross = (g: Game, to: 'amberhold' | 'sunreach') => { const L = regionLayout(to); const sv = g.serialize(); sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false; return at(to, sv); };

  for (const side of ['toll', 'poachers'] as const) {
    it(`side with the ${side}: the run to Port Halyard and back, and the side's reward`, () => {
      let g = at('amberhold');
      talk(g, 'halvard'); talk(g, 'ulla');
      expect(g.questStage('toll')).toBe(2);
      talk(g, side === 'toll' ? 'halvard' : 'ulla');
      expect(g.questStage('toll')).toBe(3);
      g = cross(g, 'sunreach');
      talk(g, side === 'toll' ? 'tamsin' : 'sefa'); // the wrong recipient: nothing happens
      expect(g.questStage('toll')).toBe(3);
      talk(g, side === 'toll' ? 'sefa' : 'tamsin');
      expect(g.questStage('toll')).toBe(4);
      g = cross(g, 'amberhold');
      talk(g, side === 'toll' ? 'halvard' : 'ulla');
      expect(g.questStage('toll')).toBe(QUESTS.toll.stages.length - 1);
      if (side === 'toll') { expect(g.s.flags.toll_pennant).toBe(true); expect(count(g.p.inv, 'ring_toll')).toBe(1); }
      else { expect(g.s.flags.poachers_friend).toBe(true); expect(count(g.p.inv, 'longbow_amber')).toBe(1); }
    });
  }
});

describe('the Storm Tide', () => {
  const ring = (g: Game) => { const t = g.storm.targets().find((x) => x.key === 'event:bell')!; near(g, t.x, t.z); g.interact('event:bell'); g.step(1 / 30); };

  it('the bell starts it: the shoals run, fish fired from the cannon wound the serpent, cooked fish twice as hard', () => {
    const g = fresh();
    expect(g.targets().some((t) => t.label === 'Storm shoal')).toBe(false);
    ring(g);
    expect(g.storm.running).toBe(true);
    expect(g.targets().some((t) => t.label === 'Storm shoal')).toBe(true);
    // fish a real shoal
    const n = g.nodes.find((x) => x.def === 'spot_storm')!;
    near(g, n.x + (n.x > g.layout.dock!.x ? -2 : 2), n.z);
    g.interact(`node:${n.uid}`);
    run(g, 40, () => count(g.p.inv, 'storm_herring_raw') >= 2);
    expect(count(g.p.inv, 'storm_herring_raw')).toBeGreaterThanOrEqual(2);
    const raw = count(g.p.inv, 'storm_herring_raw');
    g.give('storm_herring', 3);
    const c = g.storm.targets().find((x) => x.key === 'event:cannon')!;
    near(g, c.x, c.z);
    g.stopAction();
    g.interact('event:cannon'); g.step(1 / 30);
    expect(g.storm.serpent).toBeCloseTo(STORM.serpent - raw * STORM.rawHit - 3 * STORM.cookedHit, 5);
  });

  it('smashed planks drain the pier; patching one with a log stops the leak; a lost pier ends it', () => {
    const g = fresh();
    ring(g);
    g.storm.broken[1] = true;
    const d0 = g.storm.dock;
    for (let k = 0; k < 30; k++) g.step(1 / 30);
    expect(g.storm.dock).toBeLessThan(d0);
    g.give('logs_pine', 1);
    const pl = g.storm.targets().find((x) => x.key === 'event:plank:1')!;
    near(g, pl.x, pl.z);
    g.interact('event:plank:1'); g.step(1 / 30);
    expect(g.storm.broken[1]).toBe(false);
    expect(count(g.p.inv, 'logs_pine')).toBe(0);
    g.storm.broken.fill(true); g.storm.dock = 0.5;
    for (let k = 0; k < 30 && g.storm.running; k++) g.step(1 / 30);
    expect(g.storm.running).toBe(false);
    expect(g.targets().some((t) => t.label === 'Storm shoal')).toBe(false);
  });

  it('beating the serpent pays out by the work you put in', () => {
    const g = fresh();
    ring(g);
    g.give('storm_herring', 30);
    const c = g.storm.targets().find((x) => x.key === 'event:cannon')!;
    near(g, c.x, c.z);
    const coins = count(g.p.inv, 'coins');
    g.interact('event:cannon'); g.step(1 / 30);
    expect(g.storm.running).toBe(false);
    expect(g.s.flags.storm_tide_won).toBe(true);
    expect(g.p.inv.filter(Boolean).length).toBeGreaterThan(2);
    expect(count(g.p.inv, 'coins') + g.p.inv.filter((s) => s && s.id !== 'coins').length).toBeGreaterThan(coins);
  });
});
