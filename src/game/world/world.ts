// World collision + navigation for one region (an island and its waters, or a cave). Pure TS so the whole game
// can be simulated in tests. Coordinates are world metres; the region's grids cover [cx-half, cx+half] x [cz-half, cz+half].

export const HCELL = 1.25; // terrain height grid spacing (also the render mesh spacing)
export const WCELL = 0.5; // walk grid spacing
export const SCELL = 1; // sail grid spacing
/** the biggest A* search window, in cells a side (an island's whole grid up to now fits); and the margin round a route */
const MAX_WINDOW = 1024, WINDOW_MARGIN = 96;
/** fine walk cells per coarse cell, for planning long routes on big islands (4 m) */
const WALK_COARSE = 8;

export const WATER_WALK_MIN = 0.14; // ground must be above this to walk on
export const SAIL_MAX_H = -0.9; // seabed must be below this to sail over

export interface Circle { x: number; z: number; r: number }
export interface Rect { x: number; z: number; w: number; d: number; rot?: number }
export interface Deck extends Rect { y: number }

export interface Bounds { cx: number; cz: number; half: number }

export class World {
  readonly cx: number; readonly cz: number; readonly half: number;
  /** grid origin (the region's north-west corner) */
  readonly ox: number; readonly oz: number;
  readonly HN: number; readonly WN: number; readonly SN: number;
  readonly heights: Float32Array;
  readonly walk: Uint8Array; // 1 = walkable
  readonly sail: Uint8Array; // 1 = navigable
  readonly sea: Uint8Array; // 1 = navigable with hull clearance on every side
  readonly decks: Deck[] = [];
  readonly solids: (Circle | Rect)[] = [];
  readonly reefs: Circle[] = []; // sea obstacles
  /** Ground above this can't be walked on (a cave's rock mass between its tunnels). */
  walkMaxH = Infinity;
  // A* scratch, reused between searches: a cell's g/came/closed are valid only if stamp[n] === gen
  // sized to the search window, not the whole map: a 4.5x island's full grid would need ~120 MB of scratch
  private pg = new Float32Array(0);
  private pcame = new Int32Array(0);
  private pstamp = new Uint32Array(0);
  private pclosed = new Uint32Array(0);
  private gen = 0;
  /** coarse walk grid (WALK_COARSE fine cells a side) for planning long routes on big islands; built on first need */
  private coarse: Uint8Array | null = null;

  constructor(b: Bounds, height: (x: number, z: number) => number) {
    this.cx = b.cx; this.cz = b.cz; this.half = b.half;
    this.ox = b.cx - b.half; this.oz = b.cz - b.half;
    const HN = (this.HN = Math.round((b.half * 2) / HCELL)), WN = (this.WN = Math.round((b.half * 2) / WCELL));
    this.SN = Math.round((b.half * 2) / SCELL);
    this.heights = new Float32Array((HN + 1) * (HN + 1));
    this.walk = new Uint8Array(WN * WN);
    this.sail = new Uint8Array(this.SN * this.SN);
    this.sea = new Uint8Array(this.SN * this.SN);
    for (let j = 0; j <= HN; j++)
      for (let i = 0; i <= HN; i++) this.heights[j * (HN + 1) + i] = height(this.ox + i * HCELL, this.oz + j * HCELL);
  }

  /** Inside this region's square (with a margin). */
  inside(x: number, z: number, margin = 0) { return Math.abs(x - this.cx) <= this.half - margin && Math.abs(z - this.cz) <= this.half - margin; }

  /** Height of the triangulated terrain surface (matches the render mesh exactly). */
  ground(x: number, z: number): number {
    const HN = this.HN;
    const fx = (x - this.ox) / HCELL, fz = (z - this.oz) / HCELL;
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
    const agentR = 0.35, WN = this.WN, SN = this.SN, ox = this.ox, oz = this.oz;
    for (let j = 0; j < WN; j++) {
      for (let i = 0; i < WN; i++) {
        const x = ox + (i + 0.5) * WCELL, z = oz + (j + 0.5) * WCELL;
        let ok = false;
        if (this.deckAt(x, z)) ok = true;
        else {
          const h = this.ground(x, z);
          if (h > WATER_WALK_MIN && h < this.walkMaxH) {
            const sx = this.ground(x + 0.5, z) - this.ground(x - 0.5, z);
            const sz = this.ground(x, z + 0.5) - this.ground(x, z - 0.5);
            ok = Math.hypot(sx, sz) < 1.15; // ~30 degrees
          }
        }
        this.walk[j * WN + i] = ok ? 1 : 0;
      }
    }
    // stamp solids over just the cells their bounds cover (the grid is too big to test every solid per cell)
    for (const s of this.solids) {
      const ext = ('r' in s ? s.r : Math.hypot(s.w, s.d) / 2) + agentR;
      const i0 = Math.max(0, Math.floor((s.x - ext - ox) / WCELL)), i1 = Math.min(WN - 1, Math.floor((s.x + ext - ox) / WCELL));
      const j0 = Math.max(0, Math.floor((s.z - ext - oz) / WCELL)), j1 = Math.min(WN - 1, Math.floor((s.z + ext - oz) / WCELL));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++)
          if (hitsSolid(s, ox + (i + 0.5) * WCELL, oz + (j + 0.5) * WCELL, agentR)) this.walk[j * WN + i] = 0;
    }
    for (let j = 0; j < SN; j++) {
      for (let i = 0; i < SN; i++) {
        const x = ox + (i + 0.5) * SCELL, z = oz + (j + 0.5) * SCELL;
        let ok = this.ground(x, z) < SAIL_MAX_H && this.inside(x, z, 4);
        if (ok) for (const r of this.reefs) if ((x - r.x) ** 2 + (z - r.z) ** 2 < (r.r + 0.6) ** 2) { ok = false; break; }
        if (ok) for (const d of this.decks) if (inRect(d, x, z, 0.5)) { ok = false; break; }
        this.sail[j * SN + i] = ok ? 1 : 0;
      }
    }
    // erode the sail grid by the hull's turning clearance
    const CLEAR = 3;
    for (let j = 0; j < SN; j++)
      for (let i = 0; i < SN; i++) {
        let ok = this.sail[j * SN + i] === 1;
        for (let dj = -CLEAR; ok && dj <= CLEAR; dj++)
          for (let di = -CLEAR; di <= CLEAR; di++) {
            if (di * di + dj * dj > CLEAR * CLEAR) continue;
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= SN || b >= SN || !this.sail[b * SN + a]) { ok = false; break; }
          }
        this.sea[j * SN + i] = ok ? 1 : 0;
      }
  }

  walkable(x: number, z: number): boolean { return this.onGrid(this.walk, this.WN, WCELL, x, z); }
  sailable(x: number, z: number): boolean { return this.onGrid(this.sail, this.SN, SCELL, x, z); }
  /** Open water with room for the hull to turn: what the ship's route planner uses. */
  seaClear(x: number, z: number): boolean { return this.onGrid(this.sea, this.SN, SCELL, x, z); }

  /** Straight walk check, sampled every 0.25 m. */
  lineWalkable(ax: number, az: number, bx: number, bz: number): boolean { return this.lineOn(this.walk, this.WN, WCELL, ax, az, bx, bz); }

  /** Nearest walkable point to (x, z) within maxR, or null. */
  nearestWalkable(x: number, z: number, maxR = 6): [number, number] | null { return this.nearestOn(this.walk, this.WN, WCELL, x, z, maxR); }

  /** A* over the walk grid (8-way, no corner cutting) + line-of-sight smoothing. */
  findPath(sx: number, sz: number, tx: number, tz: number, maxNodes = 160000): [number, number][] | null {
    const goal = this.nearestWalkable(tx, tz, 4);
    if (!goal) return null;
    const start = this.nearestWalkable(sx, sz, 2);
    if (!start) return null;
    // a long walk on a big island: plan it on the coarse grid, then walk it out leg by leg on the fine one
    if (Math.max(Math.abs(goal[0] - start[0]), Math.abs(goal[1] - start[1])) / WCELL > MAX_WINDOW - 2 * WINDOW_MARGIN) return this.longPath(start, goal, maxNodes);
    return this.astar(this.walk, this.WN, WCELL, start, goal, maxNodes);
  }

  /** A route too long for one search window: coarse A* for the line of it, then fine A* between waypoints. */
  private longPath(start: [number, number], goal: [number, number], maxNodes: number): [number, number][] | null {
    const C = WALK_COARSE, CN = Math.ceil(this.WN / C), cell = WCELL * C;
    if (!this.coarse) {
      // a coarse cell is open if most of it is walkable: a wall's edges mustn't read as a way through
      const g = (this.coarse = new Uint8Array(CN * CN)), W = this.WN, n = new Uint16Array(CN * CN);
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) if (this.walk[j * W + i]) n[((j / C) | 0) * CN + ((i / C) | 0)]++;
      for (let k = 0; k < CN * CN; k++) g[k] = n[k] > C * C * 0.4 ? 1 : 0;
    }
    const plan = this.astar(this.coarse, CN, cell, start, goal, maxNodes);
    if (!plan) return null;
    // fine legs between waypoints no further apart than a window can hold
    const out: [number, number][] = [];
    let from = start;
    const hop = (MAX_WINDOW - 2 * WINDOW_MARGIN) * WCELL * 0.8;
    const pts: [number, number][] = [];
    let ax = start[0], az = start[1];
    for (const p of plan) {
      const d = Math.hypot(p[0] - ax, p[1] - az), n = Math.ceil(d / hop);
      for (let k = 1; k <= n; k++) pts.push([ax + ((p[0] - ax) * k) / n, az + ((p[1] - az) * k) / n]);
      [ax, az] = p;
    }
    pts[pts.length - 1] = goal;
    for (const p of pts) {
      const to = this.nearestWalkable(p[0], p[1], cell) ?? p;
      const leg = this.astar(this.walk, this.WN, WCELL, from, to, maxNodes);
      if (!leg) return out.length ? out : null; // as far as the way goes
      out.push(...leg);
      from = to;
    }
    return out;
  }

  /**
   * Route for the ship: A* over clear water, so it rounds headlands instead of beaching.
   * The last leg goes straight to the exact target (a mooring sits closer to the dock than the clear-water margin).
   */
  findSeaPath(sx: number, sz: number, tx: number, tz: number): [number, number][] | null {
    const SN = this.SN;
    const goal = this.nearestOn(this.sea, SN, SCELL, tx, tz, 26); // wide enough to find water round an islet's shallows
    const start = this.nearestOn(this.sea, SN, SCELL, sx, sz, 8);
    if (!goal || !start) return null;
    const route = this.astar(this.sea, SN, SCELL, start, goal, 90000);
    if (!route) return null;
    if ((start[0] !== sx || start[1] !== sz) && !this.lineOn(this.sail, SN, SCELL, sx, sz, route[0][0], route[0][1])) route.unshift(start);
    if (this.sailable(tx, tz) && this.lineOn(this.sail, SN, SCELL, goal[0], goal[1], tx, tz)) route.push([tx, tz]);
    return route;
  }

  private lineOn(grid: Uint8Array, n: number, cell: number, ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(d / (cell / 2)));
    for (let k = 1; k <= steps; k++) if (!this.onGrid(grid, n, cell, ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps)) return false;
    return true;
  }

  private nearestOn(grid: Uint8Array, n: number, cell: number, x: number, z: number, maxR: number): [number, number] | null {
    if (this.onGrid(grid, n, cell, x, z)) return [x, z];
    for (let r = cell; r <= maxR; r += cell) {
      const steps = Math.max(8, Math.round((r * Math.PI * 2) / cell));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.onGrid(grid, n, cell, px, pz)) return [px, pz];
      }
    }
    return null;
  }

  private astar(grid: Uint8Array, N: number, cell: number, start: [number, number], goal: [number, number], maxNodes: number): [number, number][] | null {
    if (this.lineOn(grid, N, cell, start[0], start[1], goal[0], goal[1])) return [goal];
    const ox = this.ox, oz = this.oz;
    const si = Math.floor((start[0] - ox) / cell), sj = Math.floor((start[1] - oz) / cell), gi = Math.floor((goal[0] - ox) / cell), gj = Math.floor((goal[1] - oz) / cell);
    // the search window: the whole grid when it's small (every island up to now), else the start-goal box plus a margin
    const whole = N <= MAX_WINDOW;
    const wi0 = whole ? 0 : Math.max(0, Math.min(si, gi) - WINDOW_MARGIN), wj0 = whole ? 0 : Math.max(0, Math.min(sj, gj) - WINDOW_MARGIN);
    const wi1 = whole ? N - 1 : Math.min(N - 1, Math.max(si, gi) + WINDOW_MARGIN), wj1 = whole ? N - 1 : Math.min(N - 1, Math.max(sj, gj) + WINDOW_MARGIN);
    const WW = wi1 - wi0 + 1, WH = wj1 - wj0 + 1;
    if (this.pg.length < WW * WH) { const n = WW * WH; this.pg = new Float32Array(n); this.pcame = new Int32Array(n); this.pstamp = new Uint32Array(n); this.pclosed = new Uint32Array(n); this.gen = 0; }
    // window-local cell index (scratch) from grid i, j
    const L = (i: number, j: number) => i - wi0 + (j - wj0) * WW;
    const S = L(si, sj), G = L(gi, gj);
    const gen = ++this.gen;
    const g = this.pg, came = this.pcame, stamp = this.pstamp, closed = this.pclosed;
    const gOf = (n: number) => (stamp[n] === gen ? g[n] : Infinity);
    const heap = new MinHeap();
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi), dz = Math.abs(j - gj);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    stamp[S] = gen; g[S] = 0; came[S] = -1;
    heap.push(S, h(si, sj));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === G) break;
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (++expanded > maxNodes) return null;
      const ci = wi0 + (cur % WW), cj = wj0 + ((cur / WW) | 0);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < wi0 || nj < wj0 || ni > wi1 || nj > wj1) continue;
          const n = L(ni, nj);
          if (!grid[ni + nj * N] || closed[n] === gen) continue;
          if (di && dj && (!grid[ci + di + cj * N] || !grid[ci + (cj + dj) * N])) continue;
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (ng < gOf(n)) {
            stamp[n] = gen;
            g[n] = ng;
            came[n] = cur;
            heap.push(n, ng + h(ni, nj));
          }
        }
      }
    }
    if (stamp[G] !== gen) return null;
    const cells: [number, number][] = [];
    for (let c = G; c !== S && c !== -1; c = came[c]) cells.push([ox + (wi0 + (c % WW) + 0.5) * cell, oz + (wj0 + ((c / WW) | 0) + 0.5) * cell]);
    cells.reverse();
    cells[cells.length - 1] = goal;
    // string-pull
    const out: [number, number][] = [];
    let ax = start[0], az = start[1];
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (this.lineOn(grid, N, cell, ax, az, cells[m][0], cells[m][1])) { far = m; break; }
      }
      out.push(cells[far]);
      [ax, az] = cells[far];
      k = far + 1;
    }
    return out;
  }

  private onGrid(grid: Uint8Array, n: number, cell: number, x: number, z: number): boolean {
    const i = Math.floor((x - this.ox) / cell), j = Math.floor((z - this.oz) / cell);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    return grid[j * n + i] === 1;
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
