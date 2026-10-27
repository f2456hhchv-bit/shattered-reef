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

describe('The Broodmother', () => {
  it('follow the silk in order, cut Leif free, beat the Broodmother, and Eir gives you the Weaver\'s ring', () => {
    const L = regionLayout('amberhold');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'eir');
    expect(g.questStage('brood')).toBe(1);
    for (const m of ['trail', 'cocoon', 'lair']) use(g, 'brood', m);
    expect(g.questStage('brood')).toBe(2);
    g.questKill('broodmother');
    expect(g.questStage('brood')).toBe(3);
    talk(g, 'eir');
    expect(g.questStage('brood')).toBe(QUESTS.brood.stages.length - 1);
    expect(count(g.p.inv, 'ring_weaver')).toBe(1);
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

describe('Fire on the Greenheart', () => {
  it('learn the camp in order, save the grove, and the camp keeps four buckets for you after', () => {
    const L = regionLayout('sunreach');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'ama');
    expect(g.questStage('greenheart')).toBe(1);
    use(g, 'greenheart', 'stream'); // out of order
    expect(g.questStage('greenheart')).toBe(1);
    use(g, 'greenheart', 'bench'); use(g, 'greenheart', 'stream');
    expect(g.questStage('greenheart')).toBe(2);
    g.give('hatchet_bronze', 1);
    g.fire.start();
    expect(count(g.p.inv, 'bucket_water')).toBe(2);
    (g.fire as unknown as { end(won: boolean): void }).end(true);
    expect(g.questStage('greenheart')).toBe(3);
    talk(g, 'ama');
    expect(g.questStage('greenheart')).toBe(QUESTS.greenheart.stages.length - 1);
    g.fire.start();
    expect(count(g.p.inv, 'bucket_water')).toBe(4);
  });
});

describe('The First Lock (Act II)', () => {
  it('ledger to tide table, Keel\'s Tooth turned in the Spire from the deck, the Hushed, Corva\'s letter, the Listener\'s Key', () => {
    let g = fresh();
    g.s.flags.collector_done = true; g.s.quests.collector = QUESTS.collector.stages.length - 1; g.s.flags.bell_done = true; g.s.quests.bell = QUESTS.bell.stages.length - 1;
    talk(g, 'iven');
    expect(g.questStage('firstlock')).toBe(1);
    // to Stormwrack
    const L = regionLayout('wrack'), sv = g.serialize();
    sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
    Object.assign(sv.ship, { ...L.mooring!, region: 'wrack' });
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    talk(g, 'mercy');
    expect(g.questStage('firstlock')).toBe(2);
    expect(count(g.p.inv, 'tide_table')).toBe(1);
    // not on foot
    expect(g.targets().some((t) => t.key === 'quest:firstlock:spire')).toBe(false);
    // without the Tooth on the keyring the Lock won't turn
    g.s.keyring = g.s.keyring.filter((k) => k !== 'keels_tooth');
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    const visions: string[] = [];
    g.on((e) => { if (e.type === 'read') visions.push(e.title); });
    expect(g.interact('quest:firstlock:spire')).toBe(true);
    for (let t = 0; t < 150 && !g.s.flags.firstlock_opened && g.questStage('firstlock') === 2 && !(g.pending === null && t > 1); t += 1 / 30) g.step(1 / 30);
    for (let t = 0; t < 150 && g.pending; t += 1 / 30) g.step(1 / 30);
    expect(g.questStage('firstlock')).toBe(2);
    g.s.keyring.push('keels_tooth');
    g.interact('quest:firstlock:spire');
    for (let t = 0; t < 30 && g.questStage('firstlock') === 2; t += 1 / 30) g.step(1 / 30);
    expect(g.questStage('firstlock')).toBe(3);
    expect(visions).toContain('The First Lock');
    // ashore: the Hushed
    g.disembark();
    if (g.p.onShip) { g.p.onShip = false; g.p.x = L.respawn.x; g.p.z = L.respawn.z; }
    for (let k = 0; k < 3; k++) expect(beat(g, 'hushed_listener', 70, 'cutlass_tide')).toBe(true);
    expect(g.questStage('firstlock')).toBe(4);
    talk(g, 'mercy');
    expect(g.questStage('firstlock')).toBe(5);
    // home to Iven
    const L2 = regionLayout('bellwether'), sv2 = g.serialize();
    sv2.player.x = L2.respawn.x; sv2.player.z = L2.respawn.z; sv2.player.onShip = false;
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv2)), region: 'bellwether' } });
    talk(g, 'iven');
    expect(g.questStage('firstlock')).toBe(QUESTS.firstlock.stages.length - 1);
    expect(g.s.keyring).toContain('listener');
  }, 120_000);

  it('talking to Iven mid-Collector still finishes the Collector (the next act waits its turn)', () => {
    const g = fresh();
    g.s.quests.collector = 4; g.s.flags.bell_done = true; g.s.flags.temple_done = true; g.s.flags.barrow_done = true;
    talk(g, 'iven');
    expect(g.questStage('collector')).toBe(QUESTS.collector.stages.length - 1);
    expect(g.questStage('firstlock')).toBe(0);
  });
});

describe('The Salt in the Fen (Act II, the Second Lock)', () => {
  it('Muirne (either way the selkie went), three bells in order, Jenny Greenteeth, the green key, the Mire Key', () => {
    const g = fresh();
    for (const f of ['bell_done', 'collector_done', 'firstlock_done', 'palewing_done', 'selkie_kept']) g.s.flags[f] = true;
    for (const q of ['bell', 'collector', 'firstlock', 'palewing', 'selkie']) g.s.quests[q] = QUESTS[q].stages.length - 1;
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'iven');
    expect(g.questStage('fen')).toBe(1);
    talk(g, 'muirne');
    expect(g.questStage('fen')).toBe(2);
    use(g, 'fen', 'west'); // out of order
    use(g, 'fen', 'north'); use(g, 'fen', 'west'); use(g, 'fen', 'south');
    expect(g.questStage('fen')).toBe(3);
    expect(beat(g, 'greenteeth', 75, 'cutlass_tide')).toBe(true);
    expect(g.questStage('fen')).toBe(4);
    // her loot: the green bronze key, picked up off the mud
    run0(g, 3, () => count(g.p.inv, 'fen_lockkey') > 0);
    if (!count(g.p.inv, 'fen_lockkey')) g.give('fen_lockkey', 1);
    const reads: string[] = []; g.on((e) => { if (e.type === 'read') reads.push(e.title); });
    use(g, 'fen', 'lock');
    expect(reads).toContain('The Second Lock');
    expect(count(g.p.inv, 'fen_lockkey')).toBe(0);
    talk(g, 'iven');
    expect(g.questStage('fen')).toBe(QUESTS.fen.stages.length - 1);
    expect(g.s.keyring).toContain('mire_key');
  });
});

describe('The Brinewife\'s Children (Mother Brine)', () => {
  const amb = () => { const L = regionLayout('amberhold'); const g = new Game({ seed: 4, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } }); for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } g.s.quests.toll = QUESTS.toll.stages.length - 1; return g; };
  it('pay her tolls yourself: Pip joins your crew, and finds turn up more often', () => {
    const g = amb();
    talk(g, 'halvard'); expect(g.questStage('brinewife')).toBe(1);
    talk(g, 'brine'); expect(g.questStage('brinewife')).toBe(2);
    talk(g, 'halvard'); expect(g.questStage('brinewife')).toBe(2); // no silver
    g.give('coins', 5000);
    talk(g, 'halvard'); expect(g.questStage('brinewife')).toBe(3);
    talk(g, 'brine'); expect(g.questStage('brinewife')).toBe(4);
    expect(g.s.crew).toContain('pip');
    expect(g.crewV('finds')).toBe(15);
  });
  it('or sign the warrant: paid, and she\'s gone, and she remembers you', () => {
    const g = amb();
    talk(g, 'halvard'); talk(g, 'brine');
    use(g, 'brinewife', 'warrant');
    expect(g.questStage('brinewife')).toBe(3);
    const c = count(g.p.inv, 'coins');
    talk(g, 'halvard');
    expect(g.questStage('brinewife')).toBe(4);
    expect(count(g.p.inv, 'coins')).toBe(c + 2500);
    expect(g.s.flags.tide_brine_enemy).toBe(true);
    expect(g.targets().some((t) => t.key === 'npc:brine')).toBe(false);
  });
});

describe('A Fight Worth a Saga (Halvdan Ninefold)', () => {
  const wr = () => { const L = regionLayout('wrack'); const g = new Game({ seed: 6, save: { ...defaultSave(L.respawn, L.mooring!), region: 'wrack' } }); for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } return g; };
  it('not until you\'ve beaten the Jötunn; then the duel, and you spare him: he joins your crew', () => {
    const g = wr();
    talk(g, 'ninefold');
    expect(g.questStage('saga')).toBe(0);
    g.s.flags.jotunn_defeated = true;
    talk(g, 'ninefold');
    expect(g.questStage('saga')).toBe(1);
    expect(g.targets().some((t) => t.key === 'npc:ninefold')).toBe(false); // he's gone to the road
    expect(beat(g, 'ninefold_duel', 90, 'sig_jaw')).toBe(true);
    expect(g.questStage('saga')).toBe(2);
    use(g, 'saga', 'spare');
    expect(g.s.crew).toContain('halvdan');
    expect(g.questStage('saga')).toBe(QUESTS.saga.stages.length - 1);
  });
  it('or give him the death he asked for: his sword is yours', () => {
    const g = wr();
    g.s.flags.jotunn_defeated = true;
    talk(g, 'ninefold');
    g.questKill('ninefold_duel');
    use(g, 'saga', 'grant');
    expect(count(g.p.inv, 'sword_ninefold')).toBe(1);
    expect(g.s.crew).not.toContain('halvdan');
  });
});

describe('Charted Waters (Bastian Gull)', () => {
  it('Iven\'s rival at Wreckers\' Point, four fresh soundings, and Gull signs on as chartmaster', () => {
    const g = fresh();
    g.s.quests.bell = QUESTS.bell.stages.length - 1; g.s.flags.bell_done = true;
    talk(g, 'iven'); // the main story first: The Key Collector
    expect(g.questStage('collector')).toBe(1);
    expect(g.questStage('palewing')).toBe(0);
    talk(g, 'iven'); // the Collector waits on keys; now Iven gets to Gull
    expect(g.questStage('palewing')).toBe(1);
    talk(g, 'gull');
    expect(g.questStage('palewing')).toBe(2);
    // the soundings: the charting marks, flown over from the deck (the same flags the sea sets)
    for (const m of ['bw_gullrock', 'bw_eastdeep', 'bw_northdeep']) g.s.flags[`chart_${m}`] = true;
    run0(g, 2, () => false);
    expect(g.questStage('palewing')).toBe(2);
    g.s.flags.chart_bw_wreckers = true;
    run0(g, 2, () => false);
    expect(g.questStage('palewing')).toBe(3);
    talk(g, 'gull');
    expect(g.s.crew).toContain('gull');
    const xp = g.p.xp.sailing;
    g.addXp('sailing', 100);
    expect(g.p.xp.sailing - xp).toBeGreaterThanOrEqual(109); // +10% from his passive
    // he's gone from the shore
    expect(g.targets().some((t) => t.key === 'npc:gull')).toBe(false);
    talk(g, 'iven');
    expect(g.questStage('palewing')).toBe(QUESTS.palewing.stages.length - 1);
  });
});

describe('The Ransom Note (the first Tide)', () => {
  const sun = () => { const L = regionLayout('sunreach'); const g = new Game({ seed: 9, save: { ...defaultSave(L.respawn, L.mooring!), region: 'sunreach' } }); for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; } return g; };

  it('pay it yourself: Marisol owes you, gives half back, and her ship lets you pass', () => {
    const g = sun();
    talk(g, 'sefa');
    expect(g.questStage('ransom')).toBe(1);
    talk(g, 'marisol');
    expect(g.questStage('ransom')).toBe(1); // no silver yet
    g.give('coins', 2000);
    talk(g, 'marisol');
    expect(g.questStage('ransom')).toBe(2);
    expect(g.s.flags.tide_marisol_friend).toBe(true);
    const before = count(g.p.inv, 'coins');
    talk(g, 'marisol');
    expect(g.questStage('ransom')).toBe(3);
    expect(count(g.p.inv, 'coins')).toBe(before + 1000);
    talk(g, 'sefa');
    expect(g.questStage('ransom')).toBe(QUESTS.ransom.stages.length - 1);
    expect(g.s.flags.ransom_pennant).toBeFalsy();
  });

  it('or sink the Dear Hostage: she gives you her pennant instead', () => {
    const g = sun();
    talk(g, 'sefa');
    g.questKill('red_ransom');
    expect(g.questStage('ransom')).toBe(2);
    talk(g, 'marisol');
    expect(g.questStage('ransom')).toBe(3);
    expect(g.s.flags.ransom_pennant).toBe(true);
    expect(g.s.flags.tide_marisol_friend).toBeFalsy();
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

describe('The Lantern Burns Low (Act II)', () => {
  it('Iven taken, Maren, Wynn, the Lantern sunk at sea, the Hushed and Corva on the islet, V. H.\'s letter, Iven home', () => {
    const g = fresh();
    for (const q of ['bell', 'collector', 'firstlock', 'palewing', 'fen']) { g.s.quests[q] = QUESTS[q].stages.length - 1; g.s.flags[`${q}_done`] = true; }
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    talk(g, 'iven');
    expect(g.questStage('lantern')).toBe(1);
    // he's gone: no one to talk to on the quay
    expect(g.npcGone('iven')).toBe(true);
    expect(g.targets().some((t) => t.key === 'npc:iven')).toBe(false);
    talk(g, 'maren'); talk(g, 'wynn');
    expect(g.questStage('lantern')).toBe(3);
    // the Lantern is put in the water once, and stays sunk
    g.step(1 / 30);
    const brig = g.naval.foes.filter((f) => f.def.id === 'lantern');
    expect(brig.length).toBe(1);
    (g.naval as unknown as { sink(f: unknown): void }).sink(brig[0]);
    expect(g.questStage('lantern')).toBe(4);
    run(g, 2);
    expect(g.naval.foes.some((f) => f.def.id === 'lantern')).toBe(false);
    // the islet: three Hushed, then Corva
    for (let k = 0; k < 3; k++) expect(beat(g, 'hushed_listener', 70, 'cutlass_tide')).toBe(true);
    expect(g.questStage('lantern')).toBe(5);
    expect(beat(g, 'corva', 90, 'cutlass_tide')).toBe(true);
    expect(g.questStage('lantern')).toBe(6);
    // her lantern falls where she stood
    expect(g.drops.some((d) => d.stack.id === 'orb_lantern') || count(g.p.inv, 'orb_lantern') === 1).toBe(true);
    const visions: string[] = [];
    g.on((e) => { if (e.type === 'read') visions.push(e.title); });
    use(g, 'lantern', 'iven');
    run(g, 20, () => g.questStage('lantern') === 7);
    expect(g.questStage('lantern')).toBe(7);
    expect(visions).toContain('A letter in Corva\'s coat');
    expect(g.npcGone('iven')).toBe(false);
    talk(g, 'iven');
    expect(g.questStage('lantern')).toBe(QUESTS.lantern.stages.length - 1);
    expect(count(g.p.inv, 'corva_letter')).toBe(0);
    expect(g.s.flags.lantern_done).toBe(true);
  }, 120_000);
});

describe('Second Chance (the Tides: Ash Tolliver)', () => {
  it('the letter to Eir, the names on the stones, Halvard, two longships sunk, the stones at low water, Ash joins as gunner', () => {
    const S = regionLayout('sunreach');
    let g = new Game({ seed: 7, save: { ...defaultSave(S.respawn, S.mooring!), region: 'sunreach' } });
    g.s.flags.firstlock_done = true;
    talk(g, 'ash');
    expect(g.questStage('secondchance')).toBe(1);
    expect(count(g.p.inv, 'ash_letter')).toBe(1);
    const L = regionLayout('amberhold'), sv = g.serialize();
    sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
    Object.assign(sv.ship, { ...L.mooring!, region: 'amberhold' });
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: 'amberhold' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    talk(g, 'eir');
    expect(g.questStage('secondchance')).toBe(2);
    use(g, 'secondchance', 'stones');
    run(g, 20, () => g.questStage('secondchance') === 3);
    talk(g, 'halvard');
    expect(g.questStage('secondchance')).toBe(4);
    g.s.quests.secondchance = 5; // (Ash is back at Port Halyard: his line is played in the Sunreach half)
    const sink = (g.naval as unknown as { sink(f: unknown): void }).sink.bind(g.naval);
    for (let k = 0; k < 2; k++) sink(g.naval.foes.find((f) => f.def.id === 'raider_longship' && f.alive)!);
    expect(g.questStage('secondchance')).toBe(6);
    use(g, 'secondchance', 'meet');
    run(g, 30, () => g.questStage('secondchance') === 7);
    expect(g.questStage('secondchance')).toBe(QUESTS.secondchance.stages.length - 1);
    expect(g.s.crew).toContain('ash');
    expect(g.crewV('cannon')).toBe(8);
  }, 120_000);
});

describe('Thirteen\'s in the Belly (Act II ends)', () => {
  it('compass at the ribs, Sigrun\'s horn for honey, the horn blown from the deck, the leviathan beaten, the thirteenth Lockkey home to Iven', () => {
    let g = fresh();
    for (const q of ['bell', 'collector', 'firstlock', 'palewing', 'fen', 'lantern']) { g.s.quests[q] = QUESTS[q].stages.length - 1; g.s.flags[`${q}_done`] = true; }
    g.s.flags.iven_taken = true; g.s.flags.iven_back = true;
    talk(g, 'iven');
    expect(g.questStage('belly')).toBe(1);
    const hop = (to: 'wrack' | 'amberhold' | 'bellwether') => {
      const L = regionLayout(to), sv = g.serialize();
      sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
      Object.assign(sv.ship, { ...L.mooring!, region: to });
      g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: to } });
      for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
      g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    };
    hop('wrack');
    use(g, 'belly', 'ribs');
    run(g, 20, () => g.questStage('belly') === 2);
    expect(g.questStage('belly')).toBe(2);
    hop('amberhold');
    talk(g, 'sigrun');
    expect(g.questStage('belly')).toBe(2); // no honey, no horn
    g.give('honeycomb', 5);
    talk(g, 'sigrun');
    expect(g.questStage('belly')).toBe(3);
    expect(count(g.p.inv, 'sleeper_horn')).toBe(1);
    hop('wrack');
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    g.interact('quest:belly:deep');
    run(g, 60, () => g.questStage('belly') === 4);
    expect(g.questStage('belly')).toBe(4);
    g.step(1 / 30);
    const lev = g.naval.foes.find((f) => f.def.id === 'leviathan')!;
    expect(lev).toBeTruthy();
    (g.naval as unknown as { sink(f: unknown): void }).sink(lev);
    expect(g.questStage('belly')).toBe(5);
    const seen: string[] = [];
    g.on((e) => { if (e.type === 'read') seen.push(e.title); });
    g.interact('quest:belly:cough');
    run(g, 60, () => g.questStage('belly') === 6);
    expect(count(g.p.inv, 'thirteenth_key')).toBe(1);
    expect(seen).toContain('The thirteenth Lockkey');
    hop('bellwether');
    talk(g, 'iven');
    expect(g.questStage('belly')).toBe(QUESTS.belly.stages.length - 1);
    expect(g.s.flags.belly_done).toBe(true);
    expect(count(g.p.inv, 'thirteenth_key')).toBe(1); // kept, not turned
  }, 120_000);
});

describe('Coral Key (the Tides: Marisol Ransom)', () => {
  it('Ada\'s deed, four harbourmasters\' seals (Jory\'s toll, Mercy\'s reason), the deed to Marisol, her tricorn', () => {
    let g: Game;
    const go = (to: 'wrack' | 'amberhold' | 'bellwether' | 'sunreach') => {
      const L = regionLayout(to), sv = g ? g.serialize() : { ...defaultSave(L.respawn, L.mooring!) };
      sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
      Object.assign(sv.ship, { ...L.mooring!, region: to });
      g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: to } });
      for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    };
    go('sunreach');
    g!.s.flags.ransom_done = true; g!.s.flags.tide_marisol_friend = true; g!.s.quests.ransom = QUESTS.ransom.stages.length - 1;
    talk(g!, 'marisol');
    expect(g!.questStage('coralkey')).toBe(1);
    go('bellwether');
    talk(g!, 'ada');
    expect(count(g!.p.inv, 'coral_deed')).toBe(1);
    talk(g!, 'wynn');
    expect(g!.questStage('coralkey')).toBe(3);
    go('sunreach');
    talk(g!, 'sefa');
    expect(g!.questStage('coralkey')).toBe(4);
    go('amberhold');
    talk(g!, 'jory');
    expect(g!.questStage('coralkey')).toBe(4); // no toll, no seal
    g!.give('coins', 10000);
    talk(g!, 'jory');
    expect(g!.questStage('coralkey')).toBe(5);
    go('wrack');
    talk(g!, 'mercy');
    expect(g!.questStage('coralkey')).toBe(5); // she wants a reason
    g!.s.flags.lore_varrow_charter = true;
    talk(g!, 'mercy');
    expect(g!.questStage('coralkey')).toBe(6);
    go('sunreach');
    talk(g!, 'marisol');
    expect(g!.questStage('coralkey')).toBe(QUESTS.coralkey.stages.length - 1);
    expect(count(g!.p.inv, 'hat_ransom')).toBe(1);
    expect(count(g!.p.inv, 'coral_deed')).toBe(0);
  }, 120_000);
});

describe('The Eighty-First Child (the Tides: Mother Brine)', () => {
  it('Ulla, the small footprints in order (the barefoot decoy starts again), the Hushed, Sela at the barrow, home to Brine', () => {
    const L = regionLayout('amberhold');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'amberhold' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    for (const f of ['tide_brine_friend', 'lantern_done']) g.s.flags[f] = true;
    talk(g, 'brine');
    expect(g.questStage('eightyfirst')).toBe(1);
    talk(g, 'ulla');
    expect(g.questStage('eightyfirst')).toBe(2);
    use(g, 'eightyfirst', 'f1'); use(g, 'eightyfirst', 'decoy');
    use(g, 'eightyfirst', 'f2');
    expect(g.questStage('eightyfirst')).toBe(2);
    for (const m of ['f1', 'f2', 'f3']) use(g, 'eightyfirst', m);
    expect(g.questStage('eightyfirst')).toBe(3);
    for (let k = 0; k < 3; k++) expect(beat(g, 'hushed_listener', 70, 'cutlass_tide')).toBe(true);
    expect(g.questStage('eightyfirst')).toBe(4);
    use(g, 'eightyfirst', 'sela');
    run(g, 20, () => g.questStage('eightyfirst') === 5);
    talk(g, 'brine');
    expect(g.questStage('eightyfirst')).toBe(QUESTS.eightyfirst.stages.length - 1);
    expect(count(g.p.inv, 'brine_locket')).toBe(1);
  }, 120_000);
});

describe('A Parley of Tides (Act III begins)', () => {
  it('Mercy hosts; the parley remembers who you befriended, beat and lost; the Undertow\'s hands; Hale\'s letter; Iven', () => {
    let g = fresh();
    for (const q of ['bell', 'collector', 'firstlock', 'palewing', 'fen', 'lantern', 'belly']) { g.s.quests[q] = QUESTS[q].stages.length - 1; g.s.flags[`${q}_done`] = true; }
    for (const f of ['iven_taken', 'iven_back', 'tide_marisol_cove', 'tide_marisol_friend', 'tide_ninefold_dead', 'tide_gull_crew']) g.s.flags[f] = true;
    const said: string[][] = [];
    g.on((e) => { if (e.type === 'dialog' || e.type === 'read') said.push(e.lines); });
    talk(g, 'iven');
    expect(g.questStage('parley')).toBe(1);
    const L = regionLayout('wrack'), sv = g.serialize();
    sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.on((e) => { if (e.type === 'dialog' || e.type === 'read') said.push(e.lines); });
    talk(g, 'mercy');
    expect(g.questStage('parley')).toBe(2);
    expect(said.flat().some((l) => l.includes('one goat'))).toBe(true);
    use(g, 'parley', 'table');
    run(g, 20, () => g.questStage('parley') === 3);
    const parley = said.find((ls) => ls.some((l) => l.includes('long table into the yard')))!;
    expect(parley.some((l) => l.includes('Nine goats'))).toBe(true); // Marisol, Coral Key home
    expect(parley.some((l) => l.includes('boots on the table'))).toBe(false); // not both Marisols
    expect(parley.some((l) => l.includes('horn of mead'))).toBe(true); // Ninefold, dead
    expect(parley.some((l) => l.includes('Mother Brine'))).toBe(false); // never met her
    expect(parley[parley.length - 1]).toContain('bone-grey sails');
    for (let k = 0; k < 4; k++) expect(beat(g, 'undertow_hand', 99, 'cutlass_tide')).toBe(true);
    expect(g.questStage('parley')).toBe(4);
    use(g, 'parley', 'letter');
    run(g, 20, () => g.questStage('parley') === 5);
    expect(g.s.flags.hale_letter).toBe(true);
    const L2 = regionLayout('bellwether'), sv2 = g.serialize();
    sv2.player.x = L2.respawn.x; sv2.player.z = L2.respawn.z;
    g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv2)), region: 'bellwether' } });
    g.on((e) => { if (e.type === 'dialog') said.push(e.lines); });
    talk(g, 'iven');
    expect(g.questStage('parley')).toBe(QUESTS.parley.stages.length - 1);
    expect(said[said.length - 1].some((l) => l.includes('insufferable'))).toBe(true);
  }, 120_000);
});

describe('The Third Lock (Act IV, Lockhaven)', () => {
  it('Orla\'s ring, listening at the doors (the Listener\'s Key), the Undertow\'s hands, the well, the Doorwarden, a name lost, Ilse\'s Door Key', () => {
    const L = regionLayout('lockhaven');
    const g = new Game({ seed: 7, save: { ...defaultSave(L.respawn, L.mooring!), region: 'lockhaven' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.s.flags.parley_done = true;
    talk(g, 'orla');
    expect(g.questStage('thirdlock')).toBe(1);
    expect(count(g.p.inv, 'orla_ring')).toBe(1);
    // without the Listener's Key the doors are only doors
    g.s.keyring = g.s.keyring.filter((k) => k !== 'listener');
    use(g, 'thirdlock', 'd3');
    expect(g.questStage('thirdlock')).toBe(1);
    g.s.keyring.push('listener');
    use(g, 'thirdlock', 'd1');
    expect(g.questStage('thirdlock')).toBe(1);
    use(g, 'thirdlock', 'd3');
    run(g, 5, () => g.questStage('thirdlock') === 2);
    expect(g.questStage('thirdlock')).toBe(2);
    expect(count(g.p.inv, 'door_lockkey')).toBe(1);
    for (let k = 0; k < 3; k++) expect(beat(g, 'undertow_hand', 99, 'cutlass_tide')).toBe(true);
    expect(g.questStage('thirdlock')).toBe(3);
    const seen: string[] = [];
    g.on((e) => { if (e.type === 'read') seen.push(e.title); });
    use(g, 'thirdlock', 'well');
    run(g, 20, () => g.questStage('thirdlock') === 4);
    expect(seen).toContain('The Third Lock');
    expect(beat(g, 'doorwarden', 99, 'cutlass_ori')).toBe(true);
    expect(g.questStage('thirdlock')).toBe(5);
    talk(g, 'orla');
    expect(g.questStage('thirdlock')).toBe(QUESTS.thirdlock.stages.length - 1);
    expect(g.s.keyring).toContain('ilse_key');
  }, 120_000);
});

describe('The Name on the Frame (Lockhaven)', () => {
  it('Keel\'s page, the blank on the Keepers\' frame, Mercy\'s register, Maud\'s name given back', () => {
    let g: Game;
    const go = (to: 'wrack' | 'lockhaven') => {
      const L = regionLayout(to), sv = g ? g.serialize() : { ...defaultSave(L.respawn, L.mooring!) };
      sv.player.x = L.respawn.x; sv.player.z = L.respawn.z; sv.player.onShip = false;
      Object.assign(sv.ship, { ...L.mooring!, region: to });
      g = new Game({ seed: 7, save: { ...JSON.parse(JSON.stringify(sv)), region: to } });
      for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    };
    go('lockhaven');
    g!.s.flags.thirdlock_done = true; g!.s.quests.thirdlock = QUESTS.thirdlock.stages.length - 1;
    talk(g!, 'orla');
    expect(g!.questStage('maud')).toBe(0); // hasn't read page X
    g!.s.flags.lore_keel_10 = true;
    talk(g!, 'orla');
    expect(g!.questStage('maud')).toBe(1);
    use(g!, 'maud', 'frame');
    run(g!, 10, () => g!.questStage('maud') === 2);
    talk(g!, 'orla');
    expect(g!.questStage('maud')).toBe(3);
    go('wrack');
    talk(g!, 'mercy');
    expect(g!.questStage('maud')).toBe(4);
    go('lockhaven');
    talk(g!, 'orla');
    expect(g!.questStage('maud')).toBe(QUESTS.maud.stages.length - 1);
    expect(count(g!.p.inv, 'ring_keeper')).toBe(1);
  }, 120_000);
});
