// Top-down debug render of the island layout (no browser needed).
// Usage: npx vite-node scripts/mapshot.ts <out.ppm>   -> also writes <out>.json with labels
// Colours: height bands, walk grid, paths, nodes by skill, enemy spawns, solids.
import { writeFileSync } from 'node:fs';
import { buildIsland } from '../src/game/world/layout';
import { LAYOUT, nearestPathDist } from '../src/game/world/island';
import { REGIONS } from '../src/game/world/regions';
const WORLD_HALF = REGIONS.bellwether.bounds.half; // Bellwether's region (centred on the origin)
import { NODES } from '../src/game/data/content';

const out = process.argv[2] ?? 'map.ppm';
const t0 = performance.now();
const L = buildIsland(1);
const built = performance.now() - t0;
const S = 900, k = S / (WORLD_HALF * 2);
const px = new Uint8Array(S * S * 3);
const w = L.world;
for (let j = 0; j < S; j++) {
  for (let i = 0; i < S; i++) {
    const x = i / k - WORLD_HALF, z = j / k - WORLD_HALF;
    const h = w.ground(x, z);
    let c: [number, number, number];
    if (h < 0) c = h < -0.9 ? [40, 90, 130] : [80, 150, 170];
    else if (!w.walkable(x, z)) c = h > 0.14 ? [110, 100, 90] : [200, 190, 150];
    else {
      const t = Math.min(1, h / 12);
      c = [Math.round(90 + t * 120), Math.round(150 - t * 30), Math.round(70 + t * 80)];
      if (nearestPathDist(x, z).d < 1.2) c = [190, 160, 110];
    }
    const o = (j * S + i) * 3;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
  }
}
const dot = (x: number, z: number, r: number, c: [number, number, number]) => {
  const ci = Math.round((x + WORLD_HALF) * k), cj = Math.round((z + WORLD_HALF) * k);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j > r * r) continue;
    const a = ci + i, b = cj + j;
    if (a < 0 || b < 0 || a >= S || b >= S) continue;
    const o = (b * S + a) * 3;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
  }
};
const skillCol: Record<string, [number, number, number]> = { woodcutting: [20, 90, 20], mining: [200, 90, 40], fishing: [30, 200, 255] };
for (const n of L.nodes) dot(n.x, n.z, 3, skillCol[NODES[n.def].skill] ?? [255, 255, 255]);
for (const s of L.spawns) dot(s.x, s.z, 3, [230, 20, 20]);
for (const st of L.stations) dot(st.x, st.z, 3, [255, 230, 0]);
for (const r of L.reefs) dot(r.x, r.z, 2, [60, 60, 60]);
dot(L.mooring.x, L.mooring.z, 4, [255, 255, 255]);
writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${S} ${S} 255\n`), Buffer.from(px)]));
const labels = Object.entries(LAYOUT).map(([id, p]) => ({ id, x: (p.x + WORLD_HALF) * k, y: (p.z + WORLD_HALF) * k }));
writeFileSync(out.replace(/\.ppm$/, '') + '.json', JSON.stringify({ labels, buildMs: Math.round(built), nodes: L.nodes.length, props: L.props.length, solids: w.solids.length }));
console.log(`built in ${built.toFixed(0)} ms; nodes ${L.nodes.length}, props ${L.props.length}, solids ${w.solids.length}`);
