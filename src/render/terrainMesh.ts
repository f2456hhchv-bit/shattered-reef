import * as THREE from 'three';
import { fbm, smooth } from '../art/noise';
import type { Look } from '../art/looks';
import { BELL_TOWN, coastDist, nearestPathDist, FLATS, LAYOUT, BEACH, SUN_LAYOUT, SUN, SUN_RADIUS, WRACK, WRACK_RADIUS, WRACK_LAYOUT, AMBER, AMBER_RADIUS, AMBER_LAYOUT } from '../game/world/island';
import { World, HCELL } from '../game/world/world';
import { CAVE_FLOOR } from '../game/world/caves';

// Smooth terrain from the simulation's height grid: shared vertices, smooth normals,
// colours blended per vertex (no triangle checkerboard), plus drifting cloud shadows.

export interface TerrainView {
  group: THREE.Group; uniforms: { uTime: { value: number } };
  /** Keep the chunks round (x, z) built and drop the far ones; `budget` chunks at most this call (all if Infinity). */
  stream: (x: number, z: number, budget?: number, loadR?: number) => void;
  /** every chunk, built now (tests, map shots) */
  buildAll: () => void;
}
/** chunks within this many metres of the player are built; past UNLOAD_R they're freed */
export const LOAD_R = 120, UNLOAD_R = 160;

const CHUNK = 32; // cells per chunk side (40 m): off-screen chunks are frustum-culled

export function buildTerrainMesh(world: World, look: Look, cave = false): TerrainView {
  const HN = world.HN, OX = world.ox, OZ = world.oz;
  const g = look.ground;
  const C = (hex: number) => new THREE.Color(hex);
  const sand = C(g.sand), wet = C(g.wetSand), grass = C(g.grass), grassD = C(g.grassDark), dirt = C(g.dirt);
  const rock = C(g.rock), rockD = C(g.rockDark), bed = C(g.seabed), bedD = C(g.seabedDeep);
  const meadow = C(0x86ad55), moss = C(0x4f7a3a);
  const cobble = C(0xb3a486), cobbleD = C(0x9a8c72);
  const R = HN + 1, H = world.heights;
  // cobbled squares (Bellwether's quay, Port Halyard's) and paved ruins (the Broken Ring, the Sunken Temple)
  const squares = [...BELL_TOWN.squares, FLATS[0], FLATS.find((f) => f.x === SUN_LAYOUT.port.x && f.z === SUN_LAYOUT.port.z)!, FLATS.find((f) => f.x === WRACK_LAYOUT.landing.x && f.z === WRACK_LAYOUT.landing.z)!, FLATS.find((f) => f.x === AMBER_LAYOUT.landing.x && f.z === AMBER_LAYOUT.landing.z)!];
  const paved = [LAYOUT.ruin, SUN_LAYOUT.temple];
  // Sunreach is warmer: paler sand, lusher jungle green
  const jungle = C(0x3f7a34), jungleD = C(0x2c5a2c), palmSand = C(0xeedcab);
  // Stormwrack is wind-scoured: grey-green heath and dark shingle
  const heath = C(0x66704f), heathD = C(0x4c5440), shingle = C(0x9a9484);
  // Amberhold is autumnal: gold-touched grass, the amberwood's floor russet
  const autumn = C(0x8f9440), autumnD = C(0x7a5a2c);
  const tmp = new THREE.Color();
  // underground: packed earth and wet stone underfoot, the walls darkening into a black crown
  const caveFloor = C(0x7a6a58), caveFloorD = C(0x5a4e42), caveWall = C(0x4a423a), caveTop = C(0x1c1916), ember = C(0x8a4228);
  const slopeAt = (i: number, j: number) => {
    const h = (a: number, b: number) => H[Math.max(0, Math.min(HN, b)) * R + Math.max(0, Math.min(HN, a))];
    return Math.hypot(h(i + 1, j) - h(i - 1, j), h(i, j + 1) - h(i, j - 1)) / (2 * HCELL);
  };
  // one vertex's colour (into tmp) and cobble weight: the same for a chunk built now or later
  const colourAt = (i: number, j: number): number => {
    {
      const x = OX + i * HCELL, z = OZ + j * HCELL, y = H[j * R + i];
      if (cave) {
        const n = fbm(x * 0.12, z * 0.12, 3, 5), n2 = fbm(x * 0.4 + 9, z * 0.4 + 9, 2, 6), up = y - CAVE_FLOOR;
        tmp.copy(caveFloor).lerp(caveFloorD, smooth(n, 0.35, 0.75)).lerp(caveWall, smooth(up, 0.25, 0.9)).lerp(caveTop, smooth(up, 1.2, 2.2));
        if (world.cz > 900 && world.cx > 200) tmp.lerp(ember, 0.25 * (1 - smooth(up, 0.2, 1.2)) * smooth(n2, 0.4, 0.8)); // the Ember Deep runs hot
        tmp.multiplyScalar(0.92 + n2 * 0.16);
        return 0;
      }
      if (y < -0.05) {
        // seabed: no land detail to work out (most of the world)
        tmp.copy(bed).lerp(bedD, smooth(-y, 0.3, 3.5));
        return 0;
      }
      let cobW = 0;
      const d = coastDist(x, z);
      const n = fbm(x * 0.05, z * 0.05, 3, 5); // large soft patches
      const n2 = fbm(x * 0.22 + 9, z * 0.22 + 9, 2, 6); // small variation
      const slope = slopeAt(i, j);
      const sunny = 1 - smooth(Math.hypot(x - SUN.x, z - SUN.z), SUN_RADIUS + 10, SUN_RADIUS + 30);
      const stormy = 1 - smooth(Math.hypot(x - WRACK.x, z - WRACK.z), WRACK_RADIUS + 10, WRACK_RADIUS + 30);
      const golden = 1 - smooth(Math.hypot(x - AMBER.x, z - AMBER.z), AMBER_RADIUS + 10, AMBER_RADIUS + 30);
      {
        // grass with meadow / moss patches, easing into sand near the shore
        tmp.copy(grass).lerp(meadow, smooth(n, 0.45, 0.7) * 0.7).lerp(grassD, smooth(n2, 0.45, 0.8) * 0.45).lerp(moss, smooth(1 - n, 0.55, 0.8) * 0.35);
        if (sunny > 0) tmp.lerp(jungle.clone().lerp(jungleD, smooth(n2, 0.4, 0.8) * 0.6), sunny * 0.7);
        if (stormy > 0) tmp.lerp(heath.clone().lerp(heathD, smooth(n2, 0.4, 0.8) * 0.6), stormy * 0.75);
        if (golden > 0) tmp.lerp(autumn.clone().lerp(autumnD, smooth(n2, 0.45, 0.85) * 0.5), golden * 0.55);
        const shore = 1 - smooth(d, BEACH - 2.5 + n * 3, BEACH + 1.5 + n * 3); // the beach belt, edge wandering
        tmp.lerp(sunny > 0 ? sand.clone().lerp(palmSand, sunny) : stormy > 0 ? sand.clone().lerp(shingle, stormy) : sand, shore);
        tmp.lerp(wet, 1 - smooth(y, 0.05, 0.35));
        let cw = 0;
        for (const sq of squares) cw = Math.max(cw, 1 - smooth(Math.hypot(x - sq.x, z - sq.z), sq.r - 3, sq.r + 0.5));
        cobW = cw;
        tmp.lerp(cobble.clone().lerp(cobbleD, n2), cw);
        for (const rp of paved) tmp.lerp(rock.clone().lerp(grassD, 0.3 + n2 * 0.3), 1 - smooth(Math.hypot(x - rp.x, z - rp.z), 6, 9));
        const pd = nearestPathDist(x, z), on = (1 - smooth(pd.d, pd.width * 0.8, pd.width + 0.35)) * (y > 0.2 ? 1 : 0);
        if (pd.paved) { tmp.lerp(cobble.clone().lerp(cobbleD, n2), on); cobW = Math.max(cobW, on); }
        else tmp.lerp(dirt.clone().lerp(sand, 0.2 * n2), on);
      }
      // altitude: grass thins to scree, then bare rock toward Ironcrag's summit
      // (Bellwether at 4.5x is a taller island: its scree starts higher, on Ironcrag and the hilltops)
      const alt = Math.abs(x) < 700 && Math.abs(z) < 700 ? 7 : 0;
      if (y > 5 + alt) tmp.lerp(rock.clone().lerp(grassD, 0.35 * n2), smooth(y + (n2 - 0.5) * 2.5, 5.5 + alt, 9.5 + alt) * 0.85);
      if (y > 0.25) tmp.lerp(rock.clone().lerp(rockD, smooth(slope, 0.9, 1.6)), smooth(slope, 0.55, 0.95));
      return cobW;
    }
  };
  // baked ambient occlusion: (1) horizon occlusion from the terrain itself, so hollows and valley floors
  // sit in soft shade; (2) contact shadows where every tree, rock and building meets the ground
  const DIRS = 8, STEPS = [1.25, 2.5, 4, 6.5, 10];
  /** horizon occlusion at one vertex: hollows and valley floors sit in soft shade */
  const horizonAo = (i: number, j: number) => {
    const x = OX + i * HCELL, z = OZ + j * HCELL, y = H[j * R + i];
    if (y < -1) return 1; // deep seabed is under water anyway
    let occ = 0;
    for (let k = 0; k < DIRS; k++) {
      const a = (k / DIRS) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      let m = 0;
      for (const d of STEPS) m = Math.max(m, (world.ground(x + cx * d, z + cz * d) - y) / d);
      occ += Math.atan(m) / (Math.PI / 2);
    }
    return 1 - 0.7 * (occ / DIRS);
  };
  // contact shadows where every tree, rock and building meets the ground: solids bucketed by chunk, so a chunk only
  // looks at the ones that reach it
  const nC = Math.ceil(HN / CHUNK), CM = CHUNK * HCELL;
  const solidsBy = new Map<number, { x: number; z: number; r: number; ext: number }[]>();
  for (const so of world.solids) {
    const r = 'r' in so ? so.r : Math.hypot(so.w, so.d) * 0.42, ext = r + 1.4;
    for (let cj = Math.max(0, Math.floor((so.z - ext - OZ) / CM)); cj <= Math.min(nC - 1, Math.floor((so.z + ext - OZ) / CM)); cj++)
      for (let ci = Math.max(0, Math.floor((so.x - ext - OX) / CM)); ci <= Math.min(nC - 1, Math.floor((so.x + ext - OX) / CM)); ci++) {
        const k = cj * nC + ci; let l = solidsBy.get(k); if (!l) solidsBy.set(k, (l = [])); l.push({ x: so.x, z: so.z, r, ext });
      }
  }
  // smooth normals straight from the height grid, so chunk edges match exactly
  const hAt = (a: number, b: number) => H[Math.max(0, Math.min(HN, b)) * R + Math.max(0, Math.min(HN, a))];
  const chunkGeo = (ci: number, cj: number) => {
    const i0 = ci * CHUNK, j0 = cj * CHUNK, i1 = Math.min(HN, i0 + CHUNK), j1 = Math.min(HN, j0 + CHUNK);
    const cw = i1 - i0 + 1, chh = j1 - j0 + 1;
    const P = new Float32Array(cw * chh * 3), N = new Float32Array(cw * chh * 3), Cc = new Float32Array(cw * chh * 3), B = new Float32Array(cw * chh);
    const near = solidsBy.get(cj * nC + ci) ?? [];
    for (let j = 0; j < chh; j++)
      for (let i = 0; i < cw; i++) {
        const gi = i0 + i, gj = j0 + j, dst = j * cw + i, x = OX + gi * HCELL, z = OZ + gj * HCELL;
        P[dst * 3] = x; P[dst * 3 + 1] = H[gj * R + gi]; P[dst * 3 + 2] = z;
        B[dst] = colourAt(gi, gj);
        let ao = horizonAo(gi, gj);
        for (const so of near) { const d = Math.hypot(x - so.x, z - so.z); if (d < so.ext) ao *= 1 - 0.32 * (1 - smooth(d, so.r * 0.5, so.ext)); }
        Cc[dst * 3] = tmp.r * ao; Cc[dst * 3 + 1] = tmp.g * ao; Cc[dst * 3 + 2] = tmp.b * ao;
        const nx = hAt(gi - 1, gj) - hAt(gi + 1, gj), nz = hAt(gi, gj - 1) - hAt(gi, gj + 1), ny = 2 * HCELL, l = Math.hypot(nx, ny, nz);
        N[dst * 3] = nx / l; N[dst * 3 + 1] = ny / l; N[dst * 3 + 2] = nz / l;
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
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: cave ? 0.8 : 0.95, metalness: 0 });
  mat.customProgramCacheKey = () => (cave ? 'terrain-cave' : 'terrain');
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
${cave ? '' : `vec2 cuv = vCloudUv * 0.018 + vec2(uTime * 0.006, uTime * 0.004);
float cloud = cNoise(cuv) * 0.65 + cNoise(cuv * 2.3) * 0.35;
gl_FragColor.rgb *= 1.0 - smoothstep(0.55, 0.75, cloud) * 0.18;`}`);
  };
  // streaming (Tom: big islands that load in as you go): chunks are built when you come near, freed when you leave
  const group = new THREE.Group();
  const live = new Map<number, THREE.Mesh>();
  const build = (ci: number, cj: number) => {
    const k = cj * nC + ci;
    if (live.has(k)) return;
    const mesh = new THREE.Mesh(chunkGeo(ci, cj), mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    live.set(k, mesh);
  };
  const centre = (ci: number, cj: number): [number, number] => [OX + (ci + 0.5) * CM, OZ + (cj + 0.5) * CM];
  const stream = (x: number, z: number, budget = Infinity, loadR = LOAD_R) => {
    const unloadR = loadR + (UNLOAD_R - LOAD_R);
    // drop the far ones
    for (const [k, mesh] of live) {
      const [cx, cz] = centre(k % nC, (k / nC) | 0);
      if (Math.hypot(cx - x, cz - z) > unloadR + CM * 0.7) { group.remove(mesh); mesh.geometry.dispose(); live.delete(k); }
    }
    // build the near ones, nearest first, up to the budget
    const want: [number, number, number][] = [];
    const r = Math.ceil((loadR + CM) / CM);
    const pci = Math.floor((x - OX) / CM), pcj = Math.floor((z - OZ) / CM);
    for (let cj = Math.max(0, pcj - r); cj <= Math.min(nC - 1, pcj + r); cj++)
      for (let ci = Math.max(0, pci - r); ci <= Math.min(nC - 1, pci + r); ci++) {
        if (live.has(cj * nC + ci)) continue;
        const [cx, cz] = centre(ci, cj), d = Math.hypot(cx - x, cz - z);
        if (d < loadR + CM * 0.7) want.push([d, ci, cj]);
      }
    want.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(budget, want.length); n++) build(want[n][1], want[n][2]);
  };
  const buildAll = () => { for (let cj = 0; cj < nC; cj++) for (let ci = 0; ci < nC; ci++) build(ci, cj); };
  return { group, uniforms, stream, buildAll };
}
