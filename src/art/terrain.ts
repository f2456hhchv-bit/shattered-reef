import * as THREE from 'three';
import { fbm, hash2, lerp, smooth } from './noise';
import type { Look } from './looks';

// Style-test coastline for Bellwether. Land to the north (-z), sea to the south (+z).
export const TERRAIN_SIZE = 110;
export const CELL = 1;
const N = Math.round(TERRAIN_SIZE / CELL);
const HALF = TERRAIN_SIZE / 2;

export function coastZ(x: number): number {
  return -2 + x * 0.16 + Math.sin(x * 0.13) * 2.0 + (fbm(x * 0.05, 3.7, 3, 11) - 0.5) * 5;
}

export interface Flatten { x: number; z: number; r: number; h: number }

export interface PathLine { pts: [number, number][]; width: number }

export class Terrain {
  readonly heights = new Float32Array((N + 1) * (N + 1));
  readonly flats: Flatten[] = [];
  path: PathLine = { pts: [], width: 1.3 };

  build() {
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        this.heights[j * (N + 1) + i] = this.rawHeight(i * CELL - HALF, j * CELL - HALF);
      }
    }
  }

  pathDist(x: number, z: number): number {
    let best = Infinity;
    const p = this.path.pts;
    for (let k = 0; k < p.length - 1; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  }

  rawHeight(x: number, z: number): number {
    const d = coastZ(x) - z; // > 0 on land
    const n = fbm(x * 0.07 + 40, z * 0.07 + 40, 4, 3);
    let h: number;
    if (d > 0) {
      h = 0.05 + Math.min(d / 4, 1) * 0.5 + smooth(d, 3, 14) * (0.6 + n * 1.8);
      const cliff = smooth(x, 8, 15) * smooth(d, 1.5, 6);
      h += cliff * (1.8 + n * 2.2);
    } else {
      h = 0.05 + d * 0.42 * (0.8 + n * 0.5);
      h = Math.max(h, -4.5 + n);
    }
    for (const f of this.flats) {
      const k = 1 - smooth(Math.hypot(x - f.x, z - f.z), f.r, f.r + 2.5);
      h = lerp(h, f.h, k);
    }
    if (d > 1 && this.path.pts.length) {
      const k = 1 - smooth(this.pathDist(x, z), 0.4, 2.2);
      h -= k * 0.12;
    }
    return h;
  }

  /** Exact height of the rendered (triangulated) surface. */
  heightAt(x: number, z: number): number {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    const i = Math.max(0, Math.min(N - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(N - 1, Math.floor(fz)));
    const u = fx - i, v = fz - j;
    const H = this.heights, R = N + 1;
    const ha = H[j * R + i], hc = H[j * R + i + 1], hb = H[(j + 1) * R + i], hd = H[(j + 1) * R + i + 1];
    if (u + v <= 1) return ha + (hc - ha) * u + (hb - ha) * v;
    return hd + (hb - hd) * (1 - u) + (hc - hd) * (1 - v);
  }

  createMesh(look: Look): THREE.Mesh {
    const g = look.ground;
    const C = (hex: number) => new THREE.Color(hex);
    const sand = C(g.sand), wet = C(g.wetSand), grass = C(g.grass), grassD = C(g.grassDark), dirt = C(g.dirt);
    const rock = C(g.rock), rockD = C(g.rockDark), bed = C(g.seabed), bedD = C(g.seabedDeep);

    const triCount = N * N * 2;
    const pos = new Float32Array(triCount * 9);
    const col = new Float32Array(triCount * 9);
    const H = this.heights, R = N + 1;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
    const tmp = new THREE.Color();
    let p = 0;

    const emit = (va: THREE.Vector3, vb: THREE.Vector3, vc: THREE.Vector3, seed: number) => {
      e1.subVectors(vb, va);
      e2.subVectors(vc, va);
      nrm.crossVectors(e1, e2).normalize();
      const cx = (va.x + vb.x + vc.x) / 3, cz = (va.z + vb.z + vc.z) / 3, hy = (va.y + vb.y + vc.y) / 3;
      const d = coastZ(cx) - cz;
      const n = fbm(cx * 0.21, cz * 0.21, 2, 5);
      if (hy < -0.05) {
        tmp.copy(bed).lerp(bedD, smooth(-hy, 0.3, 2.6));
      } else if (hy < 0.12) {
        tmp.copy(wet);
      } else if (d < 3.2 + n * 2) {
        tmp.copy(sand).lerp(wet, smooth(-hy, -0.35, -0.12) * 0.4);
      } else {
        tmp.copy(grass).lerp(grassD, smooth(n, 0.35, 0.7));
        const toSand = 1 - smooth(d, 3.2 + n * 2, 5 + n * 2);
        tmp.lerp(sand, toSand * 0.6);
        const pd = this.pathDist(cx, cz);
        if (pd < this.path.width) tmp.copy(dirt).lerp(sand, 0.15 * n);
        else if (pd < this.path.width + 0.6) tmp.lerp(dirt, 0.45);
      }
      if (nrm.y < 0.78 && hy > 0.2) tmp.copy(rock).lerp(rockD, smooth(nrm.y, 0.75, 0.45));
      const j = 0.94 + hash2(seed, seed * 7, 9) * 0.1;
      tmp.multiplyScalar(j);
      for (const v of [va, vb, vc]) {
        pos[p] = v.x; pos[p + 1] = v.y; pos[p + 2] = v.z;
        col[p] = tmp.r; col[p + 1] = tmp.g; col[p + 2] = tmp.b;
        p += 3;
      }
    };

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x0 = i * CELL - HALF, x1 = x0 + CELL, z0 = j * CELL - HALF, z1 = z0 + CELL;
        a.set(x0, H[j * R + i], z0);
        b.set(x0, H[(j + 1) * R + i], z1);
        c.set(x1, H[j * R + i + 1], z0);
        emit(a, b, c, j * N + i);
        a.set(x1, H[j * R + i + 1], z0);
        b.set(x0, H[(j + 1) * R + i], z1);
        c.set(x1, H[(j + 1) * R + i + 1], z1);
        emit(a, b, c, j * N + i + 99991);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
    m.receiveShadow = true;
    m.castShadow = true;
    return m;
  }
}
