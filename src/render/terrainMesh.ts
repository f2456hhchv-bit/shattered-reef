import * as THREE from 'three';
import { fbm, hash2, smooth } from '../art/noise';
import type { Look } from '../art/looks';
import { coastDist, nearestPathDist, FLATS, LAYOUT } from '../game/world/island';
import { World, HCELL, HN } from '../game/world/world';
import { WORLD_HALF } from '../game/world/island';

// Faceted terrain from the simulation's own height grid, coloured per triangle.

export function buildTerrainMesh(world: World, look: Look): THREE.Mesh {
  const g = look.ground;
  const C = (hex: number) => new THREE.Color(hex);
  const sand = C(g.sand), wet = C(g.wetSand), grass = C(g.grass), grassD = C(g.grassDark), dirt = C(g.dirt);
  const rock = C(g.rock), rockD = C(g.rockDark), bed = C(g.seabed), bedD = C(g.seabedDeep);
  const cobble = C(0xa89a80), cobbleD = C(0x8f8370);
  const N = HN, R = HN + 1, H = world.heights;
  const pos = new Float32Array(N * N * 18);
  const col = new Float32Array(N * N * 18);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  const tmp = new THREE.Color();
  const village = FLATS[0];
  const ruin = LAYOUT.ruin;
  let p = 0;
  const emit = (seed: number) => {
    e1.subVectors(b, a); e2.subVectors(c, a);
    nrm.crossVectors(e1, e2).normalize();
    const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3, hy = (a.y + b.y + c.y) / 3;
    const d = coastDist(cx, cz);
    const n = fbm(cx * 0.18, cz * 0.18, 2, 5);
    if (hy < -0.05) tmp.copy(bed).lerp(bedD, smooth(-hy, 0.4, 3.5));
    else if (hy < 0.16) tmp.copy(wet);
    else if (d < 3.5 + n * 2.5) tmp.copy(sand);
    else {
      tmp.copy(grass).lerp(grassD, smooth(n, 0.35, 0.7));
      tmp.lerp(sand, (1 - smooth(d, 3.5 + n * 2.5, 6 + n * 2)) * 0.6);
      const vd = Math.hypot(cx - village.x, cz - village.z);
      if (vd < village.r - 1) tmp.copy(cobble).lerp(cobbleD, hash2(seed, 3, 1));
      else if (vd < village.r + 1.5) tmp.lerp(dirt, 0.5);
      if (Math.hypot(cx - ruin.x, cz - ruin.z) < 8) tmp.copy(rock).lerp(grassD, 0.35 + n * 0.3);
      const pd = nearestPathDist(cx, cz);
      if (pd.d < pd.width) tmp.copy(dirt).lerp(sand, 0.15 * n);
      else if (pd.d < pd.width + 0.6) tmp.lerp(dirt, 0.45);
    }
    if (nrm.y < 0.8 && hy > 0.25) tmp.copy(rock).lerp(rockD, smooth(nrm.y, 0.78, 0.5));
    tmp.multiplyScalar(0.95 + hash2(seed, seed * 7, 9) * 0.09);
    for (const v of [a, b, c]) {
      pos[p] = v.x; pos[p + 1] = v.y; pos[p + 2] = v.z;
      col[p] = tmp.r; col[p + 1] = tmp.g; col[p + 2] = tmp.b;
      p += 3;
    }
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = i * HCELL - WORLD_HALF, x1 = x0 + HCELL, z0 = j * HCELL - WORLD_HALF, z1 = z0 + HCELL;
      a.set(x0, H[j * R + i], z0); b.set(x0, H[(j + 1) * R + i], z1); c.set(x1, H[j * R + i + 1], z0);
      emit(j * N + i);
      a.set(x1, H[j * R + i + 1], z0); b.set(x0, H[(j + 1) * R + i], z1); c.set(x1, H[(j + 1) * R + i + 1], z1);
      emit(j * N + i + 77777);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}
