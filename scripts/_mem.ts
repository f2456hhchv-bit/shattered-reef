import { Game } from '../src/game/sim/game';
const t = performance.now();
const g = new Game({ seed: 1 });
console.log('ms', Math.round(performance.now() - t), 'heap MB', Math.round(process.memoryUsage().heapUsed / 1e6), 'rss', Math.round(process.memoryUsage().rss / 1e6), g.enemies.length, g.nodes.length);
