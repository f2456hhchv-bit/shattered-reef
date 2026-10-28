import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
const base = new Game({ seed: 1 });
let t = performance.now();
const g = new Game({ seed: 5, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
console.log('ctor', Math.round(performance.now() - t));
t = performance.now();
for (let k = 0; k < 30 * 30; k++) g.step(1 / 30);
console.log('30s of steps', Math.round(performance.now() - t));
