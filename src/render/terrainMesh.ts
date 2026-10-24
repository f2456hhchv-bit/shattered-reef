import * as THREE from 'three';
import { fbm, smooth } from '../art/noise';
import type { Look } from '../art/looks';
import { coastDist, nearestPathDist, FLATS, LAYOUT, BEACH, SUN_LAYOUT, SUN, SUN_RADIUS } from '../game/world/island';
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
  // cobbled squares (Bellwether's quay, Port Halyard's) and paved ruins (the Broken Ring, the Sunken Temple)
  const squares = [FLATS[0], FLATS.find((f) => f.x === SUN_LAYOUT.port.x && f.z === SUN_LAYOUT.port.z)!];
  const paved = [LAYOUT.ruin, SUN_LAYOUT.temple];
  // Sunreach is warmer: paler sand, lusher jungle green
  const jungle = C(0x3f7a34), jungleD = C(0x2c5a2c), palmSand = C(0xeedcab);
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
      if (y < -0.05) {
        // seabed: no land detail to work out (most of the world)
        tmp.copy(bed).lerp(bedD, smooth(-y, 0.3, 3.5));
        col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
        continue;
      }
      const d = coastDist(x, z);
      const n = fbm(x * 0.05, z * 0.05, 3, 5); // large soft patches
      const n2 = fbm(x * 0.22 + 9, z * 0.22 + 9, 2, 6); // small variation
      const slope = slopeAt(i, j);
      const sunny = 1 - smooth(Math.hypot(x - SUN.x, z - SUN.z), SUN_RADIUS + 10, SUN_RADIUS + 30);
      {
        // grass with meadow / moss patches, easing into sand near the shore
        tmp.copy(grass).lerp(meadow, smooth(n, 0.45, 0.7) * 0.7).lerp(grassD, smooth(n2, 0.45, 0.8) * 0.45).lerp(moss, smooth(1 - n, 0.55, 0.8) * 0.35);
        if (sunny > 0) tmp.lerp(jungle.clone().lerp(jungleD, smooth(n2, 0.4, 0.8) * 0.6), sunny * 0.7);
        const shore = 1 - smooth(d, BEACH - 2.5 + n * 3, BEACH + 1.5 + n * 3); // the beach belt, edge wandering
        tmp.lerp(sunny > 0 ? sand.clone().lerp(palmSand, sunny) : sand, shore);
        tmp.lerp(wet, 1 - smooth(y, 0.05, 0.35));
        let cw = 0;
        for (const sq of squares) cw = Math.max(cw, 1 - smooth(Math.hypot(x - sq.x, z - sq.z), sq.r - 3, sq.r + 0.5));
        cob[j * R + i] = cw;
        tmp.lerp(cobble.clone().lerp(cobbleD, n2), cw);
        for (const rp of paved) tmp.lerp(rock.clone().lerp(grassD, 0.3 + n2 * 0.3), 1 - smooth(Math.hypot(x - rp.x, z - rp.z), 6, 9));
        const pd = nearestPathDist(x, z);
        tmp.lerp(dirt.clone().lerp(sand, 0.2 * n2), (1 - smooth(pd.d, pd.width * 0.8, pd.width + 0.35)) * (y > 0.2 ? 1 : 0));
      }
      // altitude: grass thins to scree, then bare rock toward Ironcrag's summit
      if (y > 5) tmp.lerp(rock.clone().lerp(grassD, 0.35 * n2), smooth(y + (n2 - 0.5) * 2.5, 5.5, 9.5) * 0.85);
      if (y > 0.25) tmp.lerp(rock.clone().lerp(rockD, smooth(slope, 0.9, 1.6)), smooth(slope, 0.55, 0.95));
      col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
    }
  }
  // baked ambient occlusion: (1) horizon occlusion from the terrain itself, so hollows and valley floors
  // sit in soft shade; (2) contact shadows where every tree, rock and building meets the ground
  const ao = new Float32Array(R * R).fill(1);
  const DIRS = 8, STEPS = [1.25, 2.5, 4, 6.5, 10];
  for (let j = 0; j < R; j++)
    for (let i = 0; i < R; i++) {
      const x = i * HCELL - WORLD_HALF, z = j * HCELL - WORLD_HALF, y = H[j * R + i];
      if (y < -1) continue; // deep seabed is under water anyway
      let occ = 0;
      for (let k = 0; k < DIRS; k++) {
        const a = (k / DIRS) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
        let m = 0;
        for (const d of STEPS) m = Math.max(m, (world.ground(x + cx * d, z + cz * d) - y) / d);
        occ += Math.atan(m) / (Math.PI / 2);
      }
      ao[j * R + i] = 1 - 0.7 * (occ / DIRS);
    }
  for (const so of world.solids) {
    const r = 'r' in so ? so.r : Math.hypot(so.w, so.d) * 0.42;
    const ext = r + 1.4;
    const i0 = Math.max(0, Math.floor((so.x - ext + WORLD_HALF) / HCELL)), i1 = Math.min(HN, Math.ceil((so.x + ext + WORLD_HALF) / HCELL));
    const j0 = Math.max(0, Math.floor((so.z - ext + WORLD_HALF) / HCELL)), j1 = Math.min(HN, Math.ceil((so.z + ext + WORLD_HALF) / HCELL));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i * HCELL - WORLD_HALF - so.x, j * HCELL - WORLD_HALF - so.z);
        ao[j * R + i] *= 1 - 0.32 * (1 - smooth(d, r * 0.5, ext));
      }
  }
  for (let v = 0; v < R * R; v++) { col[v * 3] *= ao[v]; col[v * 3 + 1] *= ao[v]; col[v * 3 + 2] *= ao[v]; }

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
vec2 cells(vec2 p, out vec2 cid) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; cid = i;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + cH2(i + o) * 0.8 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; cid = i + o; } else if (d < d2) d2 = d; }
  return vec2(sqrt(d1), sqrt(d2)); }
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
// ground detail: two octaves of soft speckle so grass and sand never read as flat paint
float g1 = cNoise(vCloudUv * 1.7), g2 = cNoise(vCloudUv * 5.3 + 7.0);
gl_FragColor.rgb *= 0.9 + g1 * 0.12 + g2 * 0.08;
if (vCobble > 0.01) {
  vec2 cid; vec2 cc = cells(vCloudUv * 1.6, cid);
  vec2 sh = cH2(cid); // one random pair per stone: brightness and warm/cool tint
  float edge = smoothstep(0.03, 0.14, cc.y - cc.x);
  float dome = 1.06 - smoothstep(0.0, 0.6, cc.x) * 0.14; // worn, rounded tops catch more light
  vec3 stone = (0.82 + sh.x * 0.24) * dome * mix(vec3(1.05, 1.0, 0.92), vec3(0.94, 0.98, 1.04), sh.y);
  gl_FragColor.rgb *= mix(vec3(1.0), mix(vec3(0.5, 0.48, 0.45), stone, edge), vCobble);
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
