import { fbm, lerp, smooth } from '../../art/noise';

// Bellwether Isle: terrain shape + named layout. Pure data/maths, no rendering.
// Coordinates: metres. +x east, +z south (camera looks north). Sea level y = 0.

export const WORLD_HALF = 100; // world spans [-100, 100] on both axes
export const ISLAND_RADIUS = 50;

export interface Flat { x: number; z: number; r: number; h: number }
export interface Hill { x: number; z: number; r: number; h: number }
export interface PathDef { pts: [number, number][]; width: number }

/** Angle convention: radians, 0 = east, PI/2 = south, PI = west, 3PI/2 = north. */
export function coastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  const bayDelta = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const bay = 6 * Math.exp(-(bayDelta * bayDelta) / 0.06);
  return ISLAND_RADIUS + (fbm(c * 1.6 + 7, s * 1.6 + 7, 4, 17) - 0.5) * 20 - bay;
}

/** Point at angle theta, `inset` metres inside the coastline (negative = out at sea). */
export function coastPoint(thetaDeg: number, inset: number): [number, number] {
  const t = (thetaDeg * Math.PI) / 180;
  const r = coastR(t) - inset;
  return [Math.cos(t) * r, Math.sin(t) * r];
}

const P = (deg: number, inset: number) => coastPoint(deg, inset);

// ---- named layout -----------------------------------------------------------
const villageZ = coastPoint(90, 0)[1] - 12;
export const LAYOUT = {
  village: { x: 0, z: villageZ },
  dockBase: { x: 0, z: coastPoint(90, 0)[1] - 2.5 },
  store: { x: -10, z: villageZ - 2 },
  chartHouse: { x: 10, z: villageZ - 4 },
  smithy: { x: 15, z: villageZ + 4 },
  cookfire: { x: -4, z: villageZ + 5 },
  ruin: (() => { const [x, z] = P(270, 15); return { x, z }; })(),
  camp: (() => { const [x, z] = P(355, 16); return { x, z }; })(),
  hills: (() => { const [x, z] = P(312, 15); return { x, z }; })(),
  forest: (() => { const [x, z] = P(215, 22); return { x, z }; })(),
  strand: (() => { const [x, z] = P(150, 4); return { x, z }; })(),
};

export const FLATS: Flat[] = [
  { x: LAYOUT.village.x, z: LAYOUT.village.z, r: 15, h: 1.1 },
  { x: LAYOUT.dockBase.x, z: LAYOUT.dockBase.z - 1, r: 3, h: 1.0 },
  { x: LAYOUT.ruin.x, z: LAYOUT.ruin.z, r: 9, h: 2.6 },
  { x: LAYOUT.camp.x, z: LAYOUT.camp.z, r: 6, h: 1.6 },
];

export const HILLS: Hill[] = [
  { x: LAYOUT.hills.x + 6, z: LAYOUT.hills.z - 6, r: 13, h: 7 },
  { x: LAYOUT.hills.x - 8, z: LAYOUT.hills.z + 3, r: 8, h: 3.5 },
  { x: LAYOUT.forest.x - 6, z: LAYOUT.forest.z - 8, r: 14, h: 2.5 },
];

const V = LAYOUT.village, R = LAYOUT.ruin, H = LAYOUT.hills, F = LAYOUT.forest, C = LAYOUT.camp;
export const PATHS: PathDef[] = [
  { width: 1.4, pts: [[0, LAYOUT.dockBase.z], [0, V.z + 3], [0, V.z - 4]] },
  { width: 1.2, pts: [[0, V.z - 4], [-14, V.z - 10], [F.x + 8, F.z + 6], [F.x, F.z]] },
  { width: 1.2, pts: [[0, V.z - 4], [8, V.z - 14], [H.x - 8, H.z + 10], [H.x - 6, H.z + 2]] },
  { width: 1.1, pts: [[H.x - 8, H.z + 10], [R.x + 8, R.z + 12], [R.x, R.z + 6]] },
  { width: 1.1, pts: [[8, V.z - 14], [C.x - 8, C.z + 8], [C.x, C.z]] },
];

function pathDist(p: PathDef, x: number, z: number): number {
  let best = Infinity;
  for (let k = 0; k < p.pts.length - 1; k++) {
    const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export function nearestPathDist(x: number, z: number): { d: number; width: number } {
  let d = Infinity, width = 1;
  for (const p of PATHS) {
    const pd = pathDist(p, x, z);
    if (pd < d) { d = pd; width = p.width; }
  }
  return { d, width };
}

/** Signed distance inside the coastline (positive on land). */
export function coastDist(x: number, z: number): number {
  return coastR(Math.atan2(z, x)) - Math.hypot(x, z);
}

export function rawHeight(x: number, z: number): number {
  const d = coastDist(x, z);
  const n = fbm(x * 0.06 + 40, z * 0.06 + 40, 4, 3);
  let h: number;
  if (d > 0) {
    h = 0.05 + Math.min(d / 5, 1) * 0.5 + smooth(d, 4, 18) * (0.5 + n * 2.0);
    for (const hl of HILLS) {
      const k = Math.exp(-((x - hl.x) ** 2 + (z - hl.z) ** 2) / (hl.r * hl.r));
      h += hl.h * k * smooth(d, 2, 10);
    }
  } else {
    h = 0.05 + d * 0.35 * (0.8 + n * 0.5);
    h = Math.max(h, -6 + n);
  }
  for (const f of FLATS) {
    const k = 1 - smooth(Math.hypot(x - f.x, z - f.z), f.r, f.r + 4);
    h = lerp(h, f.h, k);
  }
  if (d > 1.5) {
    const p = nearestPathDist(x, z);
    h -= (1 - smooth(p.d, p.width * 0.5, p.width + 1.5)) * 0.12;
  }
  return h;
}

// ---- named places (discovery) ------------------------------------------------
export interface Place { id: string; name: string; x: number; z: number; r: number; sea?: boolean }

export const PLACES: Place[] = [
  { id: 'quay', name: 'Bellwether Quay', x: V.x, z: V.z + 6, r: 16 },
  { id: 'strand', name: 'Crab Strand', x: LAYOUT.strand.x, z: LAYOUT.strand.z, r: 14 },
  { id: 'wood', name: 'Saltpine Wood', x: F.x, z: F.z, r: 18 },
  { id: 'hills', name: 'Copperback Hills', x: H.x, z: H.z, r: 16 },
  { id: 'camp', name: 'Brigand Camp', x: C.x, z: C.z, r: 11 },
  { id: 'ruin', name: 'The Broken Ring', x: R.x, z: R.z, r: 11 },
  (() => { const [x, z] = coastPoint(35, -16); return { id: 'shallows', name: 'Bellfish Shallows', x, z, r: 16, sea: true }; })(),
];
