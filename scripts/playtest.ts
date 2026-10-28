import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { QUESTS } from '../src/game/data/quests';
import { count } from '../src/game/sim/inventory';
import { createPlaytester } from './playtester';

const MINUTES = Number(process.argv[2] ?? 60), SEED = Number(process.argv[3] ?? 11);
const base = new Game({ seed: 1 });
const g = new Game({ seed: SEED, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const { think, stats, log, note } = createPlaytester(g, SEED, !!process.env.TRACE);
const DT = 1 / 30;
const end = MINUTES * 60;
let nextThink = 0, nextTrace = 0;
while (g.time < end) {
  g.step(DT);
  if (process.env.TRACE && g.time >= nextTrace) {
    nextTrace = g.time + 60;
    note(`STATE ${JSON.stringify({ x: Math.round(g.p.x), z: Math.round(g.p.z), hp: Math.round(g.p.hp), action: g.action, path: g.path.length, pending: g.pending, target: g.target, combat: g.stats.combatLevel })}`);
  }
  if (g.time >= nextThink) { nextThink = g.time + 0.5; think(); }
}

const lv = (k: string) => g.level(k as never);
console.log('=== PLAYTEST', MINUTES, 'min, seed', SEED, '===');
console.log('combat', g.stats.combatLevel, 'skills', ['attack', 'strength', 'defence', 'hitpoints', 'woodcutting', 'mining', 'fishing', 'cooking', 'smithing', 'crafting', 'fletching'].map((k) => `${k} ${lv(k)}`).join(', '));
console.log('quests', Object.entries(g.s.quests).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}/${QUESTS[k].stages.length - 1}`).join(', '));
console.log('deaths', stats.deaths, 'fled', stats.fled, 'kills', stats.kills, 'ate', stats.ate, 'eat attempts', stats.eatAttempts, 'idle thinks', stats.idle, 'wrong mark orders', stats.wrongMarks);
console.log('coins', count(g.p.inv, 'coins'), 'gear', Object.values(g.p.equip).map((s) => s?.id).join(','));
console.log('--- blocked'); for (const [k, v] of stats.blocked) console.log(v, k);
console.log('--- quest timeline'); for (const q of stats.quests) console.log(q);
console.log('--- levels'); console.log(stats.levels.join(' | '));
console.log('--- top messages'); for (const [k, v] of [...stats.msgs].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v, k);
console.log('--- log (last 80)'); for (const l of log.slice(-80)) console.log(l);
