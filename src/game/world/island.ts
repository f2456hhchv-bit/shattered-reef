import { fbm, lerp, smooth } from '../../art/noise';
import { townPlan, portPlan, mergePlans } from './town';
import type { RegionId } from './regions';

// The islands: terrain shape + named layout. Pure data/maths, no rendering. Bellwether (the starter island) sits at
// the origin; Sunreach Isle lies far to the east. Each island is its own region (regions.ts), loaded one at a time:
// sail off the edge of the chart toward the other, or take the ferry.
// Coordinates: metres. +x east, +z south (camera looks north). Sea level y = 0.
//
// The starter island holds a zone for every level band of every skill, so it grows outward
// from the quay: easy content near the village, harder content toward the far coasts and peak.

export const ISLAND_RADIUS = 80;
/** Width of the sand belt around the island, in metres (the beach climbs gently to grass beyond it). */
export const BEACH = 10;

// 'auto': level at the natural height there; 'pad': level at the height the earlier flats left there (a building's pad)
export interface Flat { x: number; z: number; r: number; h: number | 'auto' | 'pad'; soft?: number } // soft: blend width (m, default 4)
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

// ---- Sunreach Isle: a warm jungle island east of Bellwether, its harbour in a bay on the south shore ----------
export const SUN = { x: 420, z: -20 }; // far enough east that neither island's waters reach the other's region
export const SUN_RADIUS = 54;
export function sunCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return SUN_RADIUS + (fbm(c * 2.3 + 31, s * 2.3 + 31, 4, 23) - 0.5) * 22
    - lobe(theta, 90, 9, 8) // Port Halyard's bay
    + lobe(theta, 120, 10, 9) // the harbour's western arm
    + lobe(theta, 330, 12, 10) // Ember Head, north-east
    - lobe(theta, 210, 8, 7) // Palm Cove, west
    + lobe(theta, 25, 9, 7); // the east reef shore
}
/** Point on Sunreach at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function sunPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = sunCoastR(t) - inset;
  return [SUN.x + Math.cos(t) * r, SUN.z + Math.sin(t) * r];
}
const sunAt = (thetaDeg: number, inset: number) => { const [x, z] = sunPoint(thetaDeg, inset); return { x, z }; };
/** Which island a point belongs to (the nearer coast). */
export function islandOf(x: number, z: number): 'bellwether' | 'sunreach' {
  return Math.hypot(x - SUN.x, z - SUN.z) - SUN_RADIUS < Math.hypot(x, z) - ISLAND_RADIUS ? 'sunreach' : 'bellwether';
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
  summit: { x: 2, z: -60 }, // Ironcrag's summit: the vent forge and Cinderite
  starfall: { x: 21, z: -40 }, // where the star came down, between the peak and the Ring
  islet: at(215, -42), // Leviathan's Rest, an islet off the north-west coast
  spire: at(240, -34), // the Drowned Spire, mined from the deck
};
const sunQuay = sunAt(90, 0);
export const SUN_LAYOUT = {
  dockBase: { x: SUN.x, z: sunQuay.z - 2.5 },
  port: { x: SUN.x, z: sunQuay.z - 13 }, // Port Halyard's quay square
  plaza: { x: SUN.x, z: sunQuay.z - 27 },
  jungle: { x: SUN.x - 14, z: SUN.z - 8 }, // the Greenheart: amber and ghost yew under the canopy
  ember: { x: SUN.x + 18, z: SUN.z - 22 }, // Ember Hill: coal, gold and stormsilver
  palms: sunAt(205, 6), // Palm Cove
  reefshore: sunAt(20, 5), // the east reef shore: lobster pots and ironshells
  temple: { x: SUN.x - 6, z: SUN.z - 38 }, // the Sunken Temple (its guardian comes with the next stage)
};

const L = LAYOUT;
/** Bellwether town and Port Halyard: every building, its furniture and who works there. */
export const BELL_TOWN = townPlan(L.village, L.crossroads);
export const PORT_TOWN = portPlan(SUN_LAYOUT.port);
export const TOWN = mergePlans(BELL_TOWN, PORT_TOWN);
const SL = SUN_LAYOUT;
/** Offshore islets: land you reach by ship. */
export const ISLETS = [{ x: L.islet.x, z: L.islet.z, r: 13 }];
export const LAGOON = { x: -34, z: -22, r: 9 };

export const FLATS: Flat[] = [
  { x: L.village.x, z: L.village.z, r: 16, h: 1.1 },
  { x: L.dockBase.x, z: L.dockBase.z - 1, r: 3, h: 1.0 },
  { x: L.ruin.x, z: L.ruin.z, r: 9, h: 3.0 },
  { x: L.camp.x, z: L.camp.z, r: 6, h: 1.6 },
  { x: L.cove.x, z: L.cove.z, r: 6, h: 1.2 },
  { x: L.crossroads.x, z: L.crossroads.z, r: 11, h: 'auto' }, // the market square
  // the smithy and its gunsmith's bench sit at the village's edge: same level as the square
  { x: L.smithy.x + 1.5, z: L.smithy.z + 0.5, r: 5.5, h: 1.1 },
  // a pad under the Ironcrag camp (forge, anvil, strongbox) so nothing sits in a slope
  { x: L.peak.x + 6, z: L.peak.z + 20, r: 5.5, h: 'auto' },
  { x: L.summit.x, z: L.summit.z, r: 4.5, h: 'auto' }, // the vent forge stands on a levelled summit
  // Port Halyard: the quay square and the plaza, the dock's landing, the temple's floor
  { x: SL.port.x, z: SL.port.z, r: 17, h: 1.1 },
  { x: SL.plaza.x, z: SL.plaza.z, r: 9, h: 'pad', soft: 3 }, // levelled from the quay square's height, so the forge between them sits flat
  { x: SL.dockBase.x, z: SL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: SL.temple.x, z: SL.temple.z, r: 8, h: 'auto' },
  // a level pad under every town building, at the height of the ground already there (so the quay's stay on the quay)
  ...TOWN.buildings.map((b) => ({ x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 + 0.6, h: 'pad' as const, soft: 2.5 })),
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
  { x: SL.ember.x, z: SL.ember.z, r: 15, h: 9 },
  { x: SL.ember.x + 8, z: SL.ember.z + 10, r: 9, h: 4 },
  { x: SL.jungle.x - 4, z: SL.jungle.z - 6, r: 16, h: 3 },
];

export const DIPS: Dip[] = [{ x: LAGOON.x, z: LAGOON.z, r: LAGOON.r, floor: -1.8 }];

const V = L.village, X = L.crossroads, F = L.forest, HW = L.heartwood, CH = L.hills, M = L.peak;
const R = L.ruin, C = L.camp, SC = L.cove, W = L.wreck, ST = L.strand;
export const PATHS: PathDef[] = [
  // quay road: dock -> village -> crossroads
  { width: 1.5, pts: [[0, L.dockBase.z], [0, V.z + 3], [0, X.z]] },
  // west road: Saltpine -> lagoon shore -> Heartwood
  { width: 1.3, pts: [[0, X.z], [-24, X.z], [F.x + 9, F.z + 3], [F.x, F.z], [F.x - 4, F.z - 14], [LAGOON.x + LAGOON.r + 4, LAGOON.z + 6], [HW.x + 12, HW.z + 14], [HW.x, HW.z]] },
  // north road: Copperback Hills -> foot of Ironcrag
  { width: 1.3, pts: [[0, X.z], [5, X.z - 14], [CH.x - 7, CH.z + 7], [CH.x - 5, CH.z - 6], [M.x + 6, M.z + 22], [M.x + 3, M.z + 13]] },
  // a switchback trail from the Ironcrag camp up to the summit
  { width: 1.0, pts: [[M.x + 3, M.z + 13], [M.x - 6, M.z + 6], [M.x + 4, M.z - 1], [L.summit.x, L.summit.z + 3]] },
  // hills -> Broken Ring -> Wreckers' Point
  { width: 1.1, pts: [[CH.x - 5, CH.z - 6], [R.x - 10, R.z + 12], [R.x, R.z + 7]] },
  { width: 1.1, pts: [[R.x + 7, R.z], [W.x - 8, W.z + 8], [W.x, W.z]] },
  // east road: Brigand Camp -> Smugglers' Cove
  { width: 1.2, pts: [[0, X.z], [28, X.z], [C.x - 9, C.z + 5], [C.x, C.z]] },
  { width: 1.1, pts: [[C.x + 2, C.z + 6], [SC.x - 5, SC.z - 9], [SC.x, SC.z]] },
  // village -> Crab Strand
  { width: 1.1, pts: [[-6, V.z + 3], [-16, V.z + 1.4], [ST.x + 9, ST.z - 6], [ST.x, ST.z]] },
  // Sunreach: the high street from the dock through the quay square and plaza, on into the jungle
  { width: 1.5, pts: [[SL.dockBase.x, SL.dockBase.z], [SL.port.x, SL.port.z], [SL.plaza.x, SL.plaza.z], [SL.jungle.x + 6, SL.jungle.z + 8], [SL.jungle.x, SL.jungle.z]] },
  { width: 1.2, pts: [[SL.plaza.x, SL.plaza.z], [SL.ember.x - 6, SL.ember.z + 14], [SL.ember.x - 2, SL.ember.z + 6]] },
  { width: 1.1, pts: [[SL.jungle.x, SL.jungle.z], [SL.temple.x - 2, SL.temple.z + 12], [SL.temple.x, SL.temple.z + 6]] },
  { width: 1.1, pts: [[SL.port.x - 6, SL.port.z + 2], [SL.palms.x + 10, SL.palms.z + 2], [SL.palms.x, SL.palms.z]] },
  { width: 1.1, pts: [[SL.ember.x - 2, SL.ember.z + 6], [SL.reefshore.x - 8, SL.reefshore.z], [SL.reefshore.x, SL.reefshore.z]] },
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

// The coastlines depend only on the angle, so they're tabulated once (the world build asks ~10^6 times)
const COAST_STEPS = 2048;
const tabulate = (f: (t: number) => number) => Float32Array.from({ length: COAST_STEPS + 1 }, (_, i) => f((i / COAST_STEPS) * Math.PI * 2 - Math.PI));
let bellTable: Float32Array | null = null, sunTable: Float32Array | null = null;
function fromTable(t: Float32Array, theta: number): number {
  const f = ((theta + Math.PI) / (Math.PI * 2)) * COAST_STEPS, i = Math.max(0, Math.min(COAST_STEPS - 1, Math.floor(f)));
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}
/** Signed distance inside the nearest coastline (positive on land), over both islands. */
export function coastDist(x: number, z: number): number {
  bellTable ??= tabulate(coastR);
  sunTable ??= tabulate(sunCoastR);
  const b = fromTable(bellTable, Math.atan2(z, x)) - Math.hypot(x, z);
  const dx = x - SUN.x, dz = z - SUN.z;
  return Math.max(b, fromTable(sunTable, Math.atan2(dz, dx)) - Math.hypot(dx, dz));
}

export function rawHeight(x: number, z: number): number {
  return shapedHeight(x, z, true);
}

/** Natural ground height, optionally levelled by the flats (auto flats take the natural height at their centre). */
function shapedHeight(x: number, z: number, levelled: boolean, upto = FLATS.length): number {
  const d = coastDist(x, z);
  const n = fbm(x * 0.06 + 40, z * 0.06 + 40, 4, 3);
  // open sea (most of the world): nothing but seabed out here, so skip the flats, roads and hills
  if (d < -10 && !ISLETS.some((is) => Math.hypot(x - is.x, z - is.z) < is.r + 14)) return Math.max(0.05 + d * 0.35 * (0.8 + n * 0.5), -6 + n);
  let h: number;
  if (d > 0) {
    const broad = fbm(x * 0.022 + 3, z * 0.022 + 3, 3, 9);
    // a wide, gently climbing beach, then the island's rolling ground. The toe keeps the seabed's slope
    // going for the first few metres, so the waterline crosses a real slope instead of hugging a flat shelf
    // (a shelf just above the water makes the shoreline trace the height grid as a staircase)
    h = 0.05 + 0.3 * (1 - Math.exp(-d / 1.1)) + Math.min(d / BEACH, 1) * 0.3 + smooth(d, BEACH - 1, BEACH + 12) * (0.5 + n * 2.0 + broad * 1.6);
    for (const hl of HILLS) {
      const k = Math.exp(-((x - hl.x) ** 2 + (z - hl.z) ** 2) / (hl.r * hl.r));
      h += hl.h * k * smooth(d, BEACH * 0.4, BEACH + 6);
    }
  } else {
    h = 0.05 + d * 0.35 * (0.8 + n * 0.5);
    h = Math.max(h, -6 + n);
  }
  if (levelled) for (let i = 0; i < upto; i++) {
    const f = FLATS[i];
    const k = 1 - smooth(Math.hypot(x - f.x, z - f.z), f.r, f.r + (f.soft ?? 4));
    if (k > 0) h = lerp(h, f.h === 'auto' ? (f.h = Math.max(0.6, shapedHeight(f.x, f.z, false))) : f.h === 'pad' ? (f.h = Math.max(0.6, shapedHeight(f.x, f.z, true, i))) : f.h, k);
  }
  for (const dp of DIPS) {
    const k = 1 - smooth(Math.hypot(x - dp.x, z - dp.z), dp.r * 0.45, dp.r + 2.5);
    h = lerp(h, dp.floor + n * 0.6, k);
  }
  if (d > 1.5) {
    const p = nearestPathDist(x, z);
    h -= (1 - smooth(p.d, p.width * 0.5, p.width + 1.5)) * 0.12;
  }
  for (const is of ISLETS) {
    const a = Math.atan2(z - is.z, x - is.x);
    const di = is.r + Math.sin(a * 3 + 1) * 1.6 + Math.sin(a * 5) * 0.8 - Math.hypot(x - is.x, z - is.z);
    if (di < -12) continue;
    // a sandy beach rising to a low, rocky crown (same shoreline profile as the main island)
    const hi = di > 0 ? 0.05 + 0.3 * (1 - Math.exp(-di / 1.1)) + smooth(di, 2, 9) * (0.7 + n * 0.8) : 0.05 + di * 0.35;
    h = Math.max(h, hi);
  }
  return h;
}

// Offshore fishing grounds (ship only), as [angle in degrees, metres out from the coast].
/** Ship-only fishing grounds off Sunreach (world x, z). */
export const SUN_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_sword: [sunPoint(150, -18), sunPoint(60, -20)],
  spot_shark: [sunPoint(300, -24)],
};
export const SEA_SPOTS: Record<string, [number, number][]> = {
  spot_bell: [[20, -16], [200, -16], [295, -17]],
  spot_sword: [[52, -22], [70, -24]],
  spot_shark: [[262, -26], [248, -27]],
  spot_angler: [[165, -28]],
};

// ---- named places (discovery) ------------------------------------------------
// A place is only listed once it has something to do; new zones join as their content lands.
export interface Place { id: string; name: string; x: number; z: number; r: number; sea?: boolean; region?: RegionId } // no region: Bellwether

/** The islands' places; `places.ts` adds the caves'. */
export const ISLAND_PLACES: Place[] = [
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
  { id: 'summit', name: 'Ironcrag Summit', x: L.summit.x, z: L.summit.z, r: 7 },
  { id: 'starfall', name: 'Starfall', x: L.starfall.x, z: L.starfall.z, r: 9 },
  { id: 'islet', name: 'Leviathan\'s Rest', x: L.islet.x, z: L.islet.z, r: 16 },
  { id: 'spire', name: 'The Drowned Spire', x: L.spire.x, z: L.spire.z, r: 14, sea: true },
  ...([['shallows', 'Bellfish Shallows', 20, -16], ['swordrun', 'Swordfish Run', 60, -23], ['deeps', 'Shark Deeps', 255, -26], ['trench', 'Angler\'s Trench', 165, -28]] as const)
    .map(([id, name, a, i]) => { const [x, z] = coastPoint(a, i); return { id, name, x, z, r: 16, sea: true }; }),
  // Sunreach Isle
  { id: 'halyard', name: 'Port Halyard', x: SL.port.x, z: SL.port.z - 6, r: 18, region: 'sunreach' },
  { id: 'greenheart', name: 'The Greenheart', x: SL.jungle.x, z: SL.jungle.z, r: 16, region: 'sunreach' },
  { id: 'ember', name: 'Ember Hill', x: SL.ember.x, z: SL.ember.z + 4, r: 15, region: 'sunreach' },
  { id: 'palmcove', name: 'Palm Cove', x: SL.palms.x, z: SL.palms.z, r: 13, region: 'sunreach' },
  { id: 'reefshore', name: 'The Reef Shore', x: SL.reefshore.x, z: SL.reefshore.z, r: 13, region: 'sunreach' },
  { id: 'channel', name: 'Halyard Channel', x: SUN.x - 75, z: 10, r: 18, sea: true, region: 'sunreach' },
];
