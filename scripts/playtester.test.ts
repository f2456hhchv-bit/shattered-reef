import { describe, it, expect, vi } from 'vitest';
import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { QUESTS } from '../src/game/data/quests';
import { xpForLevel } from '../src/game/sim/xp';
import { createPlaytester } from './playtester';

const base = new Game({ seed: 1 });
function fresh() {
  const g = new Game({ seed: 11, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  return g;
}
const step = (g: Game, secs: number) => { for (let t = 0; t < secs; t += 1 / 30) g.step(1 / 30); };

describe('scripted player decisions', () => {
  it('walks past the closest incorrect rock face and completes the ordered puzzle', () => {
    const g = fresh();
    for (const skill of ['attack', 'strength', 'defence'] as const) g.p.xp[skill] = xpForLevel(30);
    g.recalc(); g.p.hp = g.stats.maxHp;
    g.s.quests.knock = 1; g.s.track = 'knock';
    const m = QUESTS.knock.stages[1].marks!.find(m => m.id === 'k3')!;
    const q = g.world.nearestWalkable(m.x, m.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    const bot = createPlaytester(g);
    for (let t = 0; t < 120 && g.questStage('knock') === 1; t += .5) { bot.think(); step(g, .5); }
    expect(g.questStage('knock')).toBe(2);
    expect(bot.stats.wrongMarks).toBe(0);
  });

  it('resumes the next marker after saved partial progress', () => {
    const g = fresh();
    for (const skill of ['attack', 'strength', 'defence'] as const) g.p.xp[skill] = xpForLevel(30);
    g.recalc(); g.p.hp = g.stats.maxHp;
    g.s.quests.knock = 1; g.s.track = 'knock'; g.s.flags.knock_1_s1 = true;
    const m = QUESTS.knock.stages[1].marks!.find(m => m.id === 'k3')!;
    const q = g.world.nearestWalkable(m.x, m.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    const bot = createPlaytester(g);
    for (let t = 0; t < 120 && g.questStage('knock') === 1; t += .5) { bot.think(); step(g, .5); }
    expect(g.questStage('knock')).toBe(2);
    expect(bot.stats.wrongMarks).toBe(0);
  });

  it('keeps escaping while the same enemy pursues instead of attacking it again', () => {
    const g = fresh(); const e = g.enemies.find(e => e.def.id === 'knocker')!;
    const m = g.world.nearestWalkable(e.spawnX + 2, e.spawnZ, 5)!;
    g.p.x = m[0]; g.p.z = m[1]; g.p.hp = g.stats.maxHp * .3;
    g.p.inv.fill(null); e.alive = true; e.x = g.p.x + 1; e.z = g.p.z; e.state = 'chase';
    const bot = createPlaytester(g);
    for (let k = 0; k < 6; k++) bot.think();
    expect(bot.stats.fled).toBe(1);
    expect(bot.log.filter(l => l.includes('FIGHT'))).toHaveLength(0);
    expect(g.target).toBe(null);
    expect(g.path.length).toBeGreaterThan(0);
  });
  it('defers a quest fight above the existing combat recommendation', () => {
    const g = fresh(); g.s.quests.selkie = 3; g.s.track = 'selkie';
    const e = g.enemies.find(e => e.def.id === 'smuggler')!; e.alive = true;
    const bot = createPlaytester(g); bot.think();
    expect(g.target).toBe(null);
    expect(bot.log.some(l => l.includes('TRAIN first:') && l.includes('recommended'))).toBe(true);
  });

  it('does not keep training Attack when Strength and Defence are behind', () => {
    const g = fresh(); g.s.quests.bell = 2;
    g.p.xp.attack = 1000; g.recalc();
    const e = g.enemies.find(e => e.def.id === 'reef_crab')!;
    e.alive = true; e.state = 'chase'; e.x = g.p.x + 1; e.z = g.p.z;
    const bot = createPlaytester(g); bot.think();
    expect(g.s.combat.stance).toBe('aggressive');
    expect(g.target).toBe(e.id);
  });

  it('counts a fatal fight as a loss even when no retreat decision was possible', () => {
    const g = fresh(); const e = g.enemies.find(e => e.def.id === 'reef_crab')!;
    e.alive = true; e.state = 'chase'; e.x = g.p.x + 1; e.z = g.p.z;
    const bot = createPlaytester(g); bot.think();
    g.applyPlayerDamage(10000);
    expect(bot.stats.deaths).toBe(1);
    expect(bot.stats.lostFights).toBe(1);
    bot.think(); step(g, 4);
    expect(g.dead).toBe(0);
    expect(g.target).toBe(null);
  });

  it('reports food actually consumed rather than repeated attempts during the eating cooldown', () => {
    const g = fresh(); const bot = createPlaytester(g);
    g.p.hp = 20; bot.think();
    g.p.hp = 20; bot.think();
    expect(g.p.inv[3]?.qty).toBe(2);
    expect(bot.stats.ate).toBe(1);
  });

  it('uses seeded decisions rather than ambient Math.random for training', () => {
    const g = fresh(); g.s.quests.bell = 2;
    const e = g.enemies.find(e => e.def.id === 'reef_crab')!;
    e.alive = true; e.state = 'idle'; e.x = g.p.x + 3; e.z = g.p.z;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('unseeded decision'); });
    try { expect(() => createPlaytester(g).think()).not.toThrow(); }
    finally { random.mockRestore(); }
  });

  it('travels to a level-appropriate training foe when none are within 80 metres', () => {
    const g = fresh(); g.s.quests.bell = 2;
    const camp = g.layout.npcs.find(n => n.id === 'pellow')!;
    const q = g.world.nearestWalkable(camp.x + 1, camp.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    const e = g.enemies.find(e => e.def.id === 'reef_crab')!; e.alive = true;
    expect(Math.hypot(e.x - g.p.x, e.z - g.p.z)).toBeGreaterThan(80);
    const bot = createPlaytester(g);
    for (let k = 0; k < 5 && g.target === null; k++) { bot.think(); g.stopAction(); g.path = []; g.pending = null; }
    expect(g.target).toBe(e.id);
  });

  it('ignores a nearby decoy while following Backward Tracks', () => {
    const save = defaultSave(base.layout.respawn, base.layout.mooring!); save.region = 'sunreach';
    const g = new Game({ seed: 11, save });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    for (const skill of ['attack', 'strength', 'defence'] as const) g.p.xp[skill] = xpForLevel(40);
    g.recalc(); g.p.hp = g.stats.maxHp; g.s.quests.tracks = 1; g.s.track = 'tracks';
    const m = QUESTS.tracks.stages[1].marks!.find(m => m.id === 'd1')!;
    const q = g.world.nearestWalkable(m.x, m.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    const bot = createPlaytester(g);
    for (let t = 0; t < 120 && g.questStage('tracks') === 1; t += .5) { bot.think(); step(g, .5); }
    expect(g.questStage('tracks')).toBe(2);
    expect(bot.stats.wrongMarks).toBe(0);
  });

  it('still uses quest spots that have no ordered sequence', () => {
    const g = fresh();
    for (const skill of ['attack', 'strength', 'defence'] as const) g.p.xp[skill] = xpForLevel(40);
    g.recalc(); g.p.hp = g.stats.maxHp; g.s.quests.wreckers = 1; g.s.track = 'wreckers';
    const m = QUESTS.wreckers.stages[1].marks![0];
    const q = g.world.nearestWalkable(m.x, m.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    const bot = createPlaytester(g);
    for (let t = 0; t < 20 && g.questStage('wreckers') === 1; t += .5) { bot.think(); step(g, .5); }
    expect(g.questStage('wreckers')).toBe(2);
  });

  it('resumes other decisions after arriving safely from a retreat', () => {
    const g = fresh(); const e = g.enemies.find(e => e.def.id === 'knocker')!;
    g.p.inv.fill(null); g.p.hp = 20;
    e.alive = true; e.state = 'chase'; e.x = g.p.x + 1; e.z = g.p.z;
    const bot = createPlaytester(g); bot.think();
    e.state = 'return'; e.x = e.spawnX; e.z = e.spawnZ;
    g.p.x = g.layout.respawn.x; g.p.z = g.layout.respawn.z; g.path = [];
    bot.think();
    expect(bot.stats.fled).toBe(1);
    expect(bot.log.some(l => l.includes('SAFE after retreat'))).toBe(true);
    expect(g.pending).toBe('npc:iven');
  });

  it('reconsiders gathering even when successive small nodes keep depleting', () => {
    const g = fresh(); g.s.quests.bell = 2; g.s.track = 'bell';
    const trees = g.nodes.filter(n => n.def === 'tree_pine').sort((a,b) => Math.hypot(a.x + 55, a.z - 226) - Math.hypot(b.x + 55, b.z - 226));
    for (const n of trees) n.left = 1;
    const q = g.world.nearestWalkable(trees[0].x + 1, trees[0].z, 4)!; g.p.x = q[0]; g.p.z = q[1];
    g.time = 2100;
    g.interact(`node:${trees[0].uid}`);
    const bot = createPlaytester(g);
    for (let t = 0; t < 300; t += .5) { bot.think(); step(g, .5); }
    expect(bot.log.some(l => l.includes('ACTIVITY combat'))).toBe(true);
  });

  it('walks an actual retreat route to safety under pursuit without re-engaging', () => {
    const g = fresh(); const e = g.enemies.find(e => e.def.id === 'reef_crab')!;
    const q = g.world.nearestWalkable(e.spawnX + 2, e.spawnZ, 4)!;
    g.p.x = q[0]; g.p.z = q[1]; g.p.hp = 40; g.p.inv.fill(null);
    e.alive = true; e.state = 'chase'; e.x = e.spawnX; e.z = e.spawnZ;
    const bot = createPlaytester(g);
    for (let t = 0; t < 90 && !bot.log.some(l => l.includes('SAFE after retreat')); t += .5) {
      bot.think(); step(g, .5);
    }
    expect(bot.stats.fled).toBe(1);
    expect(bot.stats.deaths).toBe(0);
    expect(bot.log.some(l => l.includes('SAFE after retreat'))).toBe(true);
    expect(bot.log.some(l => l.includes('FIGHT'))).toBe(false);
    expect(Math.hypot(g.p.x - g.layout.respawn.x, g.p.z - g.layout.respawn.z)).toBeLessThan(6);
  });

});
