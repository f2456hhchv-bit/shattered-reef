import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
const base = new Game({ seed: 1 });
const g = new Game({ seed: 5, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const T: Record<string, number> = {};
const proto = Object.getPrototypeOf(g);
for (const k of Object.getOwnPropertyNames(proto)) {
  const desc = Object.getOwnPropertyDescriptor(proto, k)!; if (desc.get || desc.set) continue; const f = proto[k]; if (typeof f !== 'function' || k === 'constructor' || k === 'step') continue;
  proto[k] = function (...a: unknown[]) { const t = performance.now(); try { return f.apply(this, a); } finally { T[k] = (T[k] ?? 0) + performance.now() - t; } };
}
for (const sub of ['naval', 'belltime', 'bottles', 'regatta', 'storm', 'fire', 'seep']) { const o = (g as any)[sub]; if (!o) continue; const pr = Object.getPrototypeOf(o); for (const k of Object.getOwnPropertyNames(pr)) { const dd = Object.getOwnPropertyDescriptor(pr, k)!; if (dd.get || dd.set) continue; const f = pr[k]; if (typeof f !== 'function' || k === 'constructor') continue; pr[k] = function (...a: unknown[]) { const t = performance.now(); try { return f.apply(this, a); } finally { T[sub + '.' + k] = (T[sub + '.' + k] ?? 0) + performance.now() - t; } }; } }
const t = performance.now();
for (let k = 0; k < 900; k++) g.step(1 / 30);
console.log('total', Math.round(performance.now() - t));
console.log(Object.entries(T).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v.toFixed(0)}`).join('\n'));
