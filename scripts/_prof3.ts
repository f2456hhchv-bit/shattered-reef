import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
const base = new Game({ seed: 1 });
const g = new Game({ seed: 5, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const px = g.p.x, pz = g.p.z;
const far = g.enemies.filter((e) => Math.abs(px - e.x) + Math.abs(pz - e.z) > 120).length;
console.log('enemies', g.enemies.length, 'far', far, 'states', JSON.stringify(g.enemies.reduce((a: any, e) => (a[e.state] = (a[e.state] ?? 0) + 1, a), {})));
const t = performance.now(); for (let k = 0; k < 900; k++) (g as any).stepEnemies(1 / 30); console.log('stepEnemies x900', Math.round(performance.now() - t));
const t2 = performance.now(); for (let k = 0; k < 900; k++) for (const n of g.nodes) if (n.depletedUntil && n.depletedUntil <= g.time) n.depletedUntil = 0; console.log('nodes', Math.round(performance.now() - t2));
