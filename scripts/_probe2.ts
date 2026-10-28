import { regionLayout } from '../src/game/world/layout';
const L = regionLayout('bellwether'), w = L.world, f = L.respawn;
const seen = new Set<string>();
for (const n of L.nodes) { if (seen.has(n.def) || n.scenery) continue; seen.add(n.def);
  const t = performance.now(); const p = w.findPath(f.x, f.z, n.x, n.z); const ms = performance.now() - t;
  if (!p || ms > 300) console.log(n.def, Math.round(n.x), Math.round(n.z), !!p, Math.round(ms) + 'ms', 'nw', !!w.nearestWalkable(n.x, n.z, 4)); }
