import { regionLayout } from '../src/game/world/layout';
import { toWorld, toLocal, doorPoints, isInside } from '../src/game/world/buildings';
import { nearestPathDist } from '../src/game/world/island';
const L = regionLayout('bellwether'), w = L.world;
for (const b of L.town) {
  const hs: number[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const [x, z] = toWorld(b, sx * b.w / 2, sz * b.d / 2); hs.push(w.ground(x, z)); }
  const dh = Math.max(...hs) - Math.min(...hs);
  const d = doorPoints(b);
  const p1 = w.findPath(L.respawn.x, L.respawn.z, d.out[0], d.out[1]);
  const inn = w.findPath(d.out[0], d.out[1], d.in[0], d.in[1]);
  const ok = inn && isInside(b, inn[inn.length - 1][0], inn[inn.length - 1][1]);
  if (dh >= 0.15 || !p1 || !ok) console.log('BAD', b.id, b.name, dh.toFixed(2), !!p1, !!ok, b.x.toFixed(0), b.z.toFixed(0));
}
for (const st of L.stalls) {
  for (const b of L.town) { const [lx, lz] = toLocal(b, st.x, st.z); const m = Math.max(Math.abs(lx) - b.w / 2, Math.abs(lz) - b.d / 2); if (m < 2.5) console.log('stall near', b.id, m.toFixed(1)); }
  const p = nearestPathDist(st.x, st.z); if (p.d - p.width < 1) console.log('stall road', st.x.toFixed(0), st.z.toFixed(0), (p.d - p.width).toFixed(1));
}
console.log('buildings', L.town.length, 'npcs', L.npcs.length, 'wanderers', L.wanderers.length, 'spawns', L.spawns.length);
