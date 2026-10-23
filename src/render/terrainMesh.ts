import * as THREE from 'three';
import { fbm, smooth } from '../art/noise';
import type { Look } from '../art/looks';
import { coastDist, nearestPathDist, FLATS, LAYOUT } from '../game/world/island';
import { World, HCELL, HN } from '../game/world/world';
import { WORLD_HALF } from '../game/world/island';

// Smooth terrain from the simulation's height grid: shared vertices, smooth normals,
// colours blended per vertex (no triangle checkerboard), plus drifting cloud shadows.

export interface TerrainView { group: THREE.Group; uniforms: { uTime: { value: number } } }

const CHUNK = 32; // cells per chunk side (40 m): off-screen chunks are frustum-culled

export function buildTerrainMesh(world: World, look: Look): TerrainView {
  const g = look.ground;
  const C = (hex: number) => new THREE.Color(hex);
  const sand = C(g.sand), wet = C(g.wetSand), grass = C(g.grass), grassD = C(g.grassDark), dirt = C(g.dirt);
  const rock = C(g.rock), rockD = C(g.rockDark), bed = C(g.seabed), bedD = C(g.seabedDeep);
  const meadow = C(0x86ad55), moss = C(0x4f7a3a);
  const cobble = C(0xb3a486), cobbleD = C(0x9a8c72);
  const R = HN + 1, H = world.heights;
  const pos = new Float32Array(R * R * 3);
  const col = new Float32Array(R * R * 3);
  const cob = new Float32Array(R * R); // cobblestone mask for the village square
  const village = FLATS[0];
  const ruin = LAYOUT.ruin;
  const tmp = new THREE.Color();
  const slopeAt = (i: number, j: number) => {
    const h = (a: number, b: number) => H[Math.max(0, Math.min(HN, b)) * R + Math.max(0, Math.min(HN, a))];
    return Math.hypot(h(i + 1, j) - h(i - 1, j), h(i, j + 1) - h(i, j - 1)) / (2 * HCELL);
  };
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < R; i++) {
      const x = i * HCELL - WORLD_HALF, z = j * HCELL - WORLD_HALF, y = H[j * R + i];
      const k = (j * R + i) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      const d = coastDist(x, z);
      const n = fbm(x * 0.05, z * 0.05, 3, 5); // large soft patches
      const n2 = fbm(x * 0.22 + 9, z * 0.22 + 9, 2, 6); // small variation
      const slope = slopeAt(i, j);
      if (y < -0.05) tmp.copy(bed).lerp(bedD, smooth(-y, 0.3, 3.5));
      else {
        // grass with meadow / moss patches, easing into sand near the shore
        tmp.copy(grass).lerp(meadow, smooth(n, 0.45, 0.7) * 0.7).lerp(grassD, smooth(n2, 0.45, 0.8) * 0.45).lerp(moss, smooth(1 - n, 0.55, 0.8) * 0.35);
        const shore = 1 - smooth(d, 2.5 + n * 3, 6.5 + n * 3);
        tmp.lerp(sand, shore);
        tmp.lerp(wet, 1 - smooth(y, 0.05, 0.35));
        const vd = Math.hypot(x - village.x, z - village.z);
        const cw = 1 - smooth(vd, village.r - 3, village.r + 0.5);
        cob[j * R + i] = cw;
        tmp.lerp(cobble.clone().lerp(cobbleD, n2), cw);
        tmp.lerp(rock.clone().lerp(grassD, 0.3 + n2 * 0.3), 1 - smooth(Math.hypot(x - ruin.x, z - ruin.z), 6, 9));
        const pd = nearestPathDist(x, z);
        tmp.lerp(dirt.clone().lerp(sand, 0.2 * n2), (1 - smooth(pd.d, pd.width * 0.8, pd.width + 0.35)) * (y > 0.2 ? 1 : 0));
      }
      // altitude: grass thins to scree, then bare rock toward Ironcrag's summit
      if (y > 5) tmp.lerp(rock.clone().lerp(grassD, 0.35 * n2), smooth(y + (n2 - 0.5) * 2.5, 5.5, 9.5) * 0.85);
      if (y > 0.25) tmp.lerp(rock.clone().lerp(rockD, smooth(slope, 0.9, 1.6)), smooth(slope, 0.55, 0.95));
      col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
    }
  }
  // smooth normals straight from the height grid, so chunk edges match exactly
  const nrm = new Float32Array(R * R * 3);
  const hAt = (a: number, b: number) => H[Math.max(0, Math.min(HN, b)) * R + Math.max(0, Math.min(HN, a))];
  for (let j = 0; j < R; j++)
    for (let i = 0; i < R; i++) {
      const nx = hAt(i - 1, j) - hAt(i + 1, j), nz = hAt(i, j - 1) - hAt(i, j + 1), ny = 2 * HCELL;
      const l = Math.hypot(nx, ny, nz), k = (j * R + i) * 3;
      nrm[k] = nx / l; nrm[k + 1] = ny / l; nrm[k + 2] = nz / l;
    }
  const chunkGeo = (ci: number, cj: number) => {
    const i0 = ci * CHUNK, j0 = cj * CHUNK, i1 = Math.min(HN, i0 + CHUNK), j1 = Math.min(HN, j0 + CHUNK);
    const cw = i1 - i0 + 1, chh = j1 - j0 + 1;
    const P = new Float32Array(cw * chh * 3), N = new Float32Array(cw * chh * 3), Cc = new Float32Array(cw * chh * 3), B = new Float32Array(cw * chh);
    for (let j = 0; j < chh; j++)
      for (let i = 0; i < cw; i++) {
        const src = (j0 + j) * R + i0 + i, dst = j * cw + i;
        for (let c = 0; c < 3; c++) { P[dst * 3 + c] = pos[src * 3 + c]; N[dst * 3 + c] = nrm[src * 3 + c]; Cc[dst * 3 + c] = col[src * 3 + c]; }
        B[dst] = cob[src];
      }
    const idx = new Uint32Array((cw - 1) * (chh - 1) * 6);
    let p = 0;
    for (let j = 0; j < chh - 1; j++)
      for (let i = 0; i < cw - 1; i++) {
        const a = j * cw + i, b = (j + 1) * cw + i, c = j * cw + i + 1, d2 = (j + 1) * cw + i + 1;
        idx[p++] = a; idx[p++] = b; idx[p++] = c; // same split as World.ground()
        idx[p++] = c; idx[p++] = b; idx[p++] = d2;
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    geo.setAttribute('aCobble', new THREE.BufferAttribute(B, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  };
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloudUv;\nattribute float aCobble;\nvarying float vCobble;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCloudUv = (modelMatrix * vec4(transformed, 1.0)).xz;\nvCobble = aCobble;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec2 vCloudUv;
varying float vCobble;
// cobbles: distance to nearest and second-nearest jittered cell centre gives stone edges
vec2 cH2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 cells(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + cH2(i + o) * 0.8 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(sqrt(d1), sqrt(d2)); }
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
// ground detail: two octaves of soft speckle so grass and sand never read as flat paint
float g1 = cNoise(vCloudUv * 1.7), g2 = cNoise(vCloudUv * 5.3 + 7.0);
gl_FragColor.rgb *= 0.9 + g1 * 0.12 + g2 * 0.08;
if (vCobble > 0.01) {
  vec2 cc = cells(vCloudUv * 1.6);
  float edge = smoothstep(0.02, 0.12, cc.y - cc.x);
  float stone = 0.86 + cH2(floor(vCloudUv * 1.6 + 0.5)).x * 0.2;
  gl_FragColor.rgb *= mix(1.0, mix(0.55, stone, edge), vCobble);
}
vec2 cuv = vCloudUv * 0.018 + vec2(uTime * 0.006, uTime * 0.004);
float cloud = cNoise(cuv) * 0.65 + cNoise(cuv * 2.3) * 0.35;
gl_FragColor.rgb *= 1.0 - smoothstep(0.55, 0.75, cloud) * 0.18;`);
  };
  const group = new THREE.Group();
  const nC = Math.ceil(HN / CHUNK);
  for (let cj = 0; cj < nC; cj++)
    for (let ci = 0; ci < nC; ci++) {
      const mesh = new THREE.Mesh(chunkGeo(ci, cj), mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  return { group, uniforms };
}
