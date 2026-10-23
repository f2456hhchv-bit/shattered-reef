import { WORLD_HALF, rawHeight } from './island';

// World collision + navigation. Pure TS so the whole game can be simulated in tests.

export const HCELL = 1.25; // terrain height grid spacing (also the render mesh spacing)
export const HN = Math.round((WORLD_HALF * 2) / HCELL);
export const WCELL = 0.5; // walk grid spacing
export const WN = Math.round((WORLD_HALF * 2) / WCELL);
export const SCELL = 1; // sail grid spacing
export const SN = Math.round((WORLD_HALF * 2) / SCELL);

export const WATER_WALK_MIN = 0.14; // ground must be above this to walk on
export const SAIL_MAX_H = -0.9; // seabed must be below this to sail over

export interface Circle { x: number; z: number; r: number }
export interface Rect { x: number; z: number; w: number; d: number; rot?: number }
export interface Deck extends Rect { y: number }

export class World {
  readonly heights = new Float32Array((HN + 1) * (HN + 1));
  readonly walk = new Uint8Array(WN * WN); // 1 = walkable
  readonly sail = new Uint8Array(SN * SN); // 1 = navigable
  readonly decks: Deck[] = [];
  readonly solids: (Circle | Rect)[] = [];
  readonly reefs: Circle[] = []; // sea obstacles

  constructor() {
    for (let j = 0; j <= HN; j++)
      for (let i = 0; i <= HN; i++) this.heights[j * (HN + 1) + i] = rawHeight(i * HCELL - WORLD_HALF, j * HCELL - WORLD_HALF);
  }

  /** Height of the triangulated terrain surface (matches the render mesh exactly). */
  ground(x: number, z: number): number {
    const fx = (x + WORLD_HALF) / HCELL, fz = (z + WORLD_HALF) / HCELL;
    const i = Math.max(0, Math.min(HN - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(HN - 1, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const H = this.heights, R = HN + 1;
    const ha = H[j * R + i], hc = H[j * R + i + 1], hb = H[(j + 1) * R + i], hd = H[(j + 1) * R + i + 1];
    if (u + v <= 1) return ha + (hc - ha) * u + (hb - ha) * v;
    return hd + (hb - hd) * (1 - u) + (hc - hd) * (1 - v);
  }

  deckAt(x: number, z: number): Deck | null {
    for (const d of this.decks) if (inRect(d, x, z, 0)) return d;
    return null;
  }

  /** Standing height for a walker: dock deck if on one, else ground. */
  standY(x: number, z: number): number {
    const d = this.deckAt(x, z);
    return d ? d.y : this.ground(x, z);
  }

  /** Rebuild walk/sail grids after decks/solids/reefs are registered. */
  bake() {
    const agentR = 0.35;
    for (let j = 0; j < WN; j++) {
      for (let i = 0; i < WN; i++) {
        const x = (i + 0.5) * WCELL - WORLD_HALF, z = (j + 0.5) * WCELL - WORLD_HALF;
        let ok = false;
        if (this.deckAt(x, z)) ok = true;
        else {
          const h = this.ground(x, z);
          if (h > WATER_WALK_MIN) {
            const sx = this.ground(x + 0.5, z) - this.ground(x - 0.5, z);
            const sz = this.ground(x, z + 0.5) - this.ground(x, z - 0.5);
            ok = Math.hypot(sx, sz) < 1.15; // ~30 degrees
          }
        }
        if (ok) for (const s of this.solids) if (hitsSolid(s, x, z, agentR)) { ok = false; break; }
        this.walk[j * WN + i] = ok ? 1 : 0;
      }
    }
    for (let j = 0; j < SN; j++) {
      for (let i = 0; i < SN; i++) {
        const x = (i + 0.5) * SCELL - WORLD_HALF, z = (j + 0.5) * SCELL - WORLD_HALF;
        let ok = this.ground(x, z) < SAIL_MAX_H && Math.abs(x) < WORLD_HALF - 4 && Math.abs(z) < WORLD_HALF - 4;
        if (ok) for (const r of this.reefs) if ((x - r.x) ** 2 + (z - r.z) ** 2 < (r.r + 0.6) ** 2) { ok = false; break; }
        if (ok) for (const d of this.decks) if (inRect(d, x, z, 0.5)) { ok = false; break; }
        this.sail[j * SN + i] = ok ? 1 : 0;
      }
    }
  }

  walkable(x: number, z: number): boolean {
    const i = Math.floor((x + WORLD_HALF) / WCELL), j = Math.floor((z + WORLD_HALF) / WCELL);
    if (i < 0 || j < 0 || i >= WN || j >= WN) return false;
    return this.walk[j * WN + i] === 1;
  }

  sailable(x: number, z: number): boolean {
    const i = Math.floor((x + WORLD_HALF) / SCELL), j = Math.floor((z + WORLD_HALF) / SCELL);
    if (i < 0 || j < 0 || i >= SN || j >= SN) return false;
    return this.sail[j * SN + i] === 1;
  }

  /** Straight walk check, sampled every 0.25 m. */
  lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.25));
    for (let k = 1; k <= n; k++) if (!this.walkable(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false;
    return true;
  }

  /** Nearest walkable point to (x, z) within maxR, or null. */
  nearestWalkable(x: number, z: number, maxR = 6): [number, number] | null {
    if (this.walkable(x, z)) return [x, z];
    for (let r = WCELL; r <= maxR; r += WCELL) {
      const steps = Math.max(8, Math.round((r * Math.PI * 2) / WCELL));
      let best: [number, number] | null = null;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.walkable(px, pz)) { best = [px, pz]; break; }
      }
      if (best) return best;
    }
    return null;
  }

  /** A* over the walk grid (8-way, no corner cutting) + line-of-sight smoothing. */
  findPath(sx: number, sz: number, tx: number, tz: number, maxNodes = 60000): [number, number][] | null {
    const goal = this.nearestWalkable(tx, tz, 4);
    if (!goal) return null;
    const start = this.nearestWalkable(sx, sz, 2);
    if (!start) return null;
    if (this.lineWalkable(start[0], start[1], goal[0], goal[1])) return [goal];
    const toI = (x: number) => Math.floor((x + WORLD_HALF) / WCELL);
    const si = toI(start[0]), sj = toI(start[1]), gi = toI(goal[0]), gj = toI(goal[1]);
    const S = si + sj * WN, G = gi + gj * WN;
    const g = new Float32Array(WN * WN).fill(Infinity);
    const came = new Int32Array(WN * WN).fill(-1);
    const closed = new Uint8Array(WN * WN);
    const heap = new MinHeap();
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi), dz = Math.abs(j - gj);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    g[S] = 0;
    heap.push(S, h(si, sj));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === G) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxNodes) return null;
      const ci = cur % WN, cj = (cur / WN) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= WN || nj >= WN) continue;
          const n = ni + nj * WN;
          if (!this.walk[n] || closed[n]) continue;
          if (di && dj && (!this.walk[ci + di + cj * WN] || !this.walk[ci + (cj + dj) * WN])) continue;
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (ng < g[n]) {
            g[n] = ng;
            came[n] = cur;
            heap.push(n, ng + h(ni, nj));
          }
        }
      }
    }
    if (came[G] === -1) return null;
    const cells: [number, number][] = [];
    for (let c = G; c !== S && c !== -1; c = came[c]) cells.push([((c % WN) + 0.5) * WCELL - WORLD_HALF, (((c / WN) | 0) + 0.5) * WCELL - WORLD_HALF]);
    cells.reverse();
    cells[cells.length - 1] = goal;
    // string-pull
    const out: [number, number][] = [];
    let ax = start[0], az = start[1];
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (this.lineWalkable(ax, az, cells[m][0], cells[m][1])) { far = m; break; }
      }
      out.push(cells[far]);
      [ax, az] = cells[far];
      k = far + 1;
    }
    return out;
  }
}

export function inRect(r: Rect, x: number, z: number, pad: number): boolean {
  const c = Math.cos(-(r.rot ?? 0)), s = Math.sin(-(r.rot ?? 0));
  const dx = x - r.x, dz = z - r.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= r.w / 2 + pad && Math.abs(lz) <= r.d / 2 + pad;
}

function hitsSolid(s: Circle | Rect, x: number, z: number, pad: number): boolean {
  if ('r' in s) return (x - s.x) ** 2 + (z - s.z) ** 2 < (s.r + pad) ** 2;
  return inRect(s, x, z, pad);
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, key: number) {
    const ids = this.ids, keys = this.keys;
    let i = ids.length;
    ids.push(id); keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p]; keys[i] = keys[p];
      i = p;
    }
    ids[i] = id; keys[i] = key;
  }
  pop(): number {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    const lastId = ids.pop()!, lastKey = keys.pop()!;
    if (ids.length) {
      let i = 0;
      const n = ids.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= lastKey) break;
        ids[i] = ids[c]; keys[i] = keys[c];
        i = c;
      }
      ids[i] = lastId; keys[i] = lastKey;
    }
    return top;
  }
}
