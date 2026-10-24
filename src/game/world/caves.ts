import { fbm } from '../../art/noise';
import { REGIONS, type RegionId } from './regions';

// Caves: chambers joined by tunnels, carved out of solid rock. The floor is a gently uneven walkable height; the
// rock between rises steeply to a dark crown nobody can climb (World.walkMaxH). Shapes are in metres relative to the
// cave region's centre, so a cave reads like a hand-drawn dungeon map.

export interface Chamber { id: string; name?: string; x: number; z: number; r: number }
export interface Tunnel { pts: [number, number][]; w: number }
export interface CaveShape { chambers: Chamber[]; tunnels: Tunnel[] }

export const CAVE_FLOOR = 0.6;
export const CAVE_WALL = 2.5; // the rock crown, metres above the floor
export const CAVE_WALK_MAX = CAVE_FLOOR + 0.9;

export const CAVES: Partial<Record<RegionId, CaveShape>> = {
  smugglers_caves: {
    chambers: [
      { id: 'mouth', x: 0, z: 30, r: 6 },
      { id: 'hall', name: 'The Echo Hall', x: 0, z: 8, r: 10 },
      { id: 'hold', name: 'The Smugglers\' Hold', x: -25, z: 1, r: 8.5 },
      { id: 'grotto', name: 'Glimmer Grotto', x: 23, z: -4, r: 8.5 },
      { id: 'pool', name: 'The Drip Pool', x: 2, z: -26, r: 9 },
    ],
    tunnels: [
      { w: 5, pts: [[0, 30], [1, 18], [0, 8]] },
      { w: 4.5, pts: [[0, 8], [-12, 7], [-25, 1]] },
      { w: 4.5, pts: [[0, 8], [12, 3], [23, -4]] },
      { w: 4.5, pts: [[0, 8], [-5, -8], [2, -26]] },
    ],
  },
  ember_deep: {
    chambers: [
      { id: 'mouth', x: 0, z: 33, r: 6 },
      { id: 'hall', name: 'The Cinder Hall', x: 0, z: 10, r: 11 },
      { id: 'nest', name: 'The Weaver\'s Nest', x: -27, z: -3, r: 10 },
      { id: 'vein', name: 'The Abyss Vein', x: 26, z: -9, r: 9 },
      { id: 'magma', name: 'The Magma Pool', x: 2, z: -29, r: 10 },
    ],
    tunnels: [
      { w: 5, pts: [[0, 33], [-2, 21], [0, 10]] },
      { w: 4.6, pts: [[0, 10], [-14, 6], [-27, -3]] },
      { w: 4.6, pts: [[0, 10], [14, 1], [26, -9]] },
      { w: 4.6, pts: [[0, 10], [6, -9], [2, -29]] },
    ],
  },
};

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Signed distance inside the cave's open space (positive = floor), local coordinates. */
export function caveOpen(c: CaveShape, lx: number, lz: number): number {
  let d = -Infinity;
  for (const ch of c.chambers) d = Math.max(d, ch.r - Math.hypot(lx - ch.x, lz - ch.z));
  for (const t of c.tunnels) for (let k = 0; k < t.pts.length - 1; k++) d = Math.max(d, t.w / 2 - segDist(lx, lz, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]));
  return d;
}

export function caveHeight(id: RegionId): (x: number, z: number) => number {
  const c = CAVES[id]!, b = REGIONS[id].bounds;
  return (x, z) => {
    const lx = x - b.cx, lz = z - b.cz;
    const n = fbm(x * 0.13 + 5, z * 0.13 + 5, 3, 11);
    const d = caveOpen(c, lx, lz) + (n - 0.5) * 2.2; // wobbly walls, never ruler-straight
    const floor = CAVE_FLOOR + (n - 0.5) * 0.25;
    if (d > 0) return floor;
    // the wall climbs fast, then the crown is lumpy rock
    return floor + Math.min(CAVE_WALL, 0.35 - d * 2.4) + (d < -1.5 ? (fbm(x * 0.4, z * 0.4, 2, 4) - 0.5) * 0.9 : 0);
  };
}

/** A cave chamber's centre in world coordinates. */
export function chamberAt(id: RegionId, chamber: string): { x: number; z: number; r: number } {
  const ch = CAVES[id]!.chambers.find((c) => c.id === chamber)!, b = REGIONS[id].bounds;
  return { x: b.cx + ch.x, z: b.cz + ch.z, r: ch.r };
}
