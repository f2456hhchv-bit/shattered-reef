import { fbm, lerp, smooth } from '../../art/noise';

// Bellwether Isle: terrain shape + named layout. Pure data/maths, no rendering.
// Coordinates: metres. +x east, +z south (camera looks north). Sea level y = 0.
//
// The starter island holds a zone for every level band of every skill, so it grows outward
// from the quay: easy content near the village, harder content toward the far coasts and peak.

export const WORLD_HALF = 150; // world spans [-150, 150] on both axes
export const ISLAND_RADIUS = 80;

export interface Flat { x: number; z: number; r: number; h: number | 'auto' } // 'auto': level at the natural height there
export interface Hill { x: number; z: number; r: number; h: number }
export interface Dip { x: number; z: number; r: number; floor: number }
export interface PathDef { pts: [number, number][]; width: number }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (d: number) => (d * Math.PI) / 180;
/** Gaussian bump over angle: shapes headlands (+) and coves (-). */
const lobe = (theta: number, centreDeg: number, widthDeg: number, amount: number) => {
  const d = wrap(theta - deg(centreDeg)) / deg(widthDeg);
  return amount * Math.exp(-d * d);
};

/** Angle convention: radians, 0 = east, PI/2 = south, PI = west, 3PI/2 = north. */
export function coastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return ISLAND_RADIUS + (fbm(c * 2.1 + 7, s * 2.1 + 7, 4, 17) - 0.5) * 30
    - lobe(theta, 90, 9, 9) // the quay's sheltered bay
    + lobe(theta, 36, 9, 20) // Smugglers' headland
    - lobe(theta, 62, 6, 7) // the cove's inlet
    + lobe(theta, 316, 7, 18) // Wreckers' Point
    + lobe(theta, 226, 16, 10) // Heartwood shoulder
    - lobe(theta, 178, 7, 11) // west cove
    - lobe(theta, 282, 8, 6); // north bight under the peak
}

/** Point at angle theta, `inset` metres inside the coastline (negative = out at sea). */
export function coastPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg);
  const r = coastR(t) - inset;
  return [Math.cos(t) * r, Math.sin(t) * r];
}

const at = (thetaDeg: number, inset: number) => { const [x, z] = coastPoint(thetaDeg, inset); return { x, z }; };

// ---- named layout -----------------------------------------------------------
const villageZ = coastPoint(90, 0)[1] - 14;
export const LAYOUT = {
  village: { x: 0, z: villageZ },
  dockBase: { x: 0, z: coastPoint(90, 0)[1] - 2.5 },
  crossroads: { x: 0, z: villageZ - 22 },
  store: { x: -10, z: villageZ - 2 },
  chartHouse: { x: 10, z: villageZ - 4 },
  smithy: { x: 15, z: villageZ + 4 },
  cookfire: { x: -4, z: villageZ + 5 },
  strand: at(138, 4), // crabs, shore fishing
  forest: { x: -36, z: 20 }, // Saltpine Wood: low trees
  grove: { x: -54, z: 4 }, // oak grove
  fen: { x: -21, z: -16 }, // Mirewater Fen: east shore of the lagoon
  heartwood: { x: -46, z: -50 }, // ancient trees, deep west
  hills: { x: 20, z: -6 }, // Copperback Hills: low ores
  peak: { x: 2, z: -54 }, // Ironcrag: high ores on the mountain
  ruin: { x: 38, z: -32 }, // the Broken Ring (quest boss)
  camp: { x: 48, z: 16 }, // Brigand Camp
  cove: at(36, 13), // Smugglers' Cove on the SE headland
  wreck: at(316, 10), // Wreckers' Point, NE
};

const L = LAYOUT;
export const LAGOON = { x: -34, z: -22, r: 9 };

export const FLATS: Flat[] = [
  { x: L.village.x, z: L.village.z, r: 16, h: 1.1 },
  { x: L.dockBase.x, z: L.dockBase.z - 1, r: 3, h: 1.0 },
  { x: L.ruin.x, z: L.ruin.z, r: 9, h: 3.0 },
  { x: L.camp.x, z: L.camp.z, r: 6, h: 1.6 },
  { x: L.cove.x, z: L.cove.z, r: 6, h: 1.2 },
  { x: L.crossroads.x, z: L.crossroads.z, r: 4, h: 1.5 },
  // the smithy and its gunsmith's bench sit at the village's edge: same level as the square
  { x: L.smithy.x + 1.5, z: L.smithy.z + 0.5, r: 5.5, h: 1.1 },
  // pads under the outlying cottages and the Ironcrag camp (forge, anvil, strongbox) so nothing sits in a slope
  { x: L.village.x - 19, z: L.village.z + 3, r: 3.6, h: 'auto' },
  { x: L.village.x + 21, z: L.village.z - 7, r: 3.6, h: 'auto' },
  { x: L.peak.x + 6, z: L.peak.z + 20, r: 5.5, h: 'auto' },
];

export const HILLS: Hill[] = [
  { x: L.peak.x, z: L.peak.z - 6, r: 19, h: 12 },
  { x: L.peak.x - 17, z: L.peak.z + 4, r: 11, h: 5.5 },
  { x: L.peak.x + 17, z: L.peak.z + 1, r: 10, h: 6 },
  { x: L.hills.x + 6, z: L.hills.z - 5, r: 11, h: 5 },
  { x: L.hills.x - 7, z: L.hills.z + 4, r: 7, h: 2.5 },
  { x: L.heartwood.x - 6, z: L.heartwood.z - 6, r: 14, h: 3.5 },
  { x: L.forest.x - 8, z: L.forest.z - 6, r: 14, h: 2.5 },
  { x: L.cove.x + 5, z: L.cove.z - 6, r: 8, h: 3 },
];

export const DIPS: Dip[] = [{ x: LAGOON.x, z: LAGOON.z, r: LAGOON.r, floor: -1.8 }];

const V = L.village, X = L.crossroads, F = L.forest, HW = L.heartwood, CH = L.hills, M = L.peak;
const R = L.ruin, C = L.camp, SC = L.cove, W = L.wreck, ST = L.strand;
export const PATHS: PathDef[] = [
  // quay road: dock -> village -> crossroads
  { width: 1.5, pts: [[0, L.dockBase.z], [0, V.z + 3], [0, X.z]] },
  // west road: Saltpine -> lagoon shore -> Heartwood
  { width: 1.3, pts: [[0, X.z], [-14, X.z - 2], [F.x + 9, F.z + 3], [F.x, F.z], [F.x - 4, F.z - 14], [LAGOON.x + LAGOON.r + 4, LAGOON.z + 6], [HW.x + 12, HW.z + 14], [HW.x, HW.z]] },
  // north road: Copperback Hills -> foot of Ironcrag
  { width: 1.3, pts: [[0, X.z], [5, X.z - 14], [CH.x - 7, CH.z + 7], [CH.x - 5, CH.z - 6], [M.x + 6, M.z + 22], [M.x + 3, M.z + 13]] },
  // hills -> Broken Ring -> Wreckers' Point
  { width: 1.1, pts: [[CH.x - 5, CH.z - 6], [R.x - 10, R.z + 12], [R.x, R.z + 7]] },
  { width: 1.1, pts: [[R.x + 7, R.z], [W.x - 8, W.z + 8], [W.x, W.z]] },
  // east road: Brigand Camp -> Smugglers' Cove
  { width: 1.2, pts: [[0, X.z], [16, X.z - 3], [C.x - 9, C.z + 5], [C.x, C.z]] },
  { width: 1.1, pts: [[C.x + 2, C.z + 6], [SC.x - 5, SC.z - 9], [SC.x, SC.z]] },
  // village -> Crab Strand
  { width: 1.1, pts: [[-8, V.z + 3], [ST.x + 9, ST.z - 6], [ST.x, ST.z]] },
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
  return shapedHeight(x, z, true);
}

/** Natural ground height, optionally levelled by the flats (auto flats take the natural height at their centre). */
function shapedHeight(x: number, z: number, levelled: boolean): number {
  const d = coastDist(x, z);
  const n = fbm(x * 0.06 + 40, z * 0.06 + 40, 4, 3);
  let h: number;
  if (d > 0) {
    const broad = fbm(x * 0.022 + 3, z * 0.022 + 3, 3, 9);
    h = 0.05 + Math.min(d / 5, 1) * 0.5 + smooth(d, 4, 18) * (0.5 + n * 2.0 + broad * 1.6);
    for (const hl of HILLS) {
      const k = Math.exp(-((x - hl.x) ** 2 + (z - hl.z) ** 2) / (hl.r * hl.r));
      h += hl.h * k * smooth(d, 2, 10);
    }
  } else {
    h = 0.05 + d * 0.35 * (0.8 + n * 0.5);
    h = Math.max(h, -6 + n);
  }
  if (levelled) for (const f of FLATS) {
    const k = 1 - smooth(Math.hypot(x - f.x, z - f.z), f.r, f.r + 4);
    if (k > 0) h = lerp(h, f.h === 'auto' ? (f.h = Math.max(0.6, shapedHeight(f.x, f.z, false))) : f.h, k);
  }
  for (const dp of DIPS) {
    const k = 1 - smooth(Math.hypot(x - dp.x, z - dp.z), dp.r * 0.45, dp.r + 2.5);
    h = lerp(h, dp.floor + n * 0.6, k);
  }
  if (d > 1.5) {
    const p = nearestPathDist(x, z);
    h -= (1 - smooth(p.d, p.width * 0.5, p.width + 1.5)) * 0.12;
  }
  return h;
}

// Offshore fishing grounds (ship only), as [angle in degrees, metres out from the coast].
export const SEA_SPOTS: Record<string, [number, number][]> = {
  spot_bell: [[20, -16], [200, -16], [295, -17]],
  spot_sword: [[52, -22], [70, -24]],
  spot_shark: [[262, -26], [248, -27]],
  spot_angler: [[165, -28]],
};

// ---- named places (discovery) ------------------------------------------------
// A place is only listed once it has something to do; new zones join as their content lands.
export interface Place { id: string; name: string; x: number; z: number; r: number; sea?: boolean }

export const PLACES: Place[] = [
  { id: 'quay', name: 'Bellwether Quay', x: V.x, z: V.z + 6, r: 18 },
  { id: 'strand', name: 'Crab Strand', x: ST.x, z: ST.z, r: 14 },
  { id: 'wood', name: 'Saltpine Wood', x: F.x, z: F.z, r: 18 },
  { id: 'hills', name: 'Copperback Hills', x: CH.x, z: CH.z, r: 16 },
  { id: 'camp', name: 'Brigand Camp', x: C.x, z: C.z, r: 11 },
  { id: 'ruin', name: 'The Broken Ring', x: R.x, z: R.z, r: 11 },
  { id: 'grove', name: 'Sea-oak Grove', x: L.grove.x, z: L.grove.z, r: 12 },
  { id: 'fen', name: 'Mirewater Fen', x: LAGOON.x, z: LAGOON.z, r: 18 },
  { id: 'heartwood', name: 'Heartwood', x: HW.x, z: HW.z, r: 20 },
  { id: 'peak', name: 'Ironcrag', x: M.x, z: M.z + 6, r: 20 },
  { id: 'cove', name: 'Smugglers\' Cove', x: SC.x, z: SC.z, r: 12 },
  { id: 'wreck', name: 'Wreckers\' Point', x: W.x, z: W.z, r: 13 },
  ...([['shallows', 'Bellfish Shallows', 20, -16], ['swordrun', 'Swordfish Run', 60, -23], ['deeps', 'Shark Deeps', 255, -26], ['trench', 'Angler\'s Trench', 165, -28]] as const)
    .map(([id, name, a, i]) => { const [x, z] = coastPoint(a, i); return { id, name, x, z, r: 16, sea: true }; }),
];
