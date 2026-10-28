import { fbm, lerp, smooth } from '../../art/noise';
import { townPlan, portPlan, mergePlans, type TownPlan } from './town';
import { bellwetherPlan } from './bellwether';
import type { RegionId } from './regions';

// The islands: terrain shape + named layout. Pure data/maths, no rendering. Bellwether (the starter island) sits at
// the origin; Sunreach Isle lies far to the east. Each island is its own region (regions.ts), loaded one at a time:
// sail off the edge of the chart toward the other, or take the ferry.
// Coordinates: metres. +x east, +z south (camera looks north). Sea level y = 0.
//
// The starter island holds a zone for every level band of every skill, so it grows outward
// from the quay: easy content near the village, harder content toward the far coasts and peak.

/** Bellwether is 4.5 times the size it was, every way (Tom, 2026-10-28: "make each island 450% bigger"): its outline,
 * zones and hills are scaled by this; buildings, rooms, stations and people stay life-size. */
export const BS = 4.5;
export const ISLAND_RADIUS = 80 * BS;
/** Width of the sand belt around the island, in metres (the beach climbs gently to grass beyond it). */
export const BEACH = 10;
/** the other islands sit this much further east than they did, clear of Bellwether's bigger waters */
export const EAST = 400;

// 'auto': level at the natural height there; 'pad': level at the height the earlier flats left there (a building's pad)
export interface Flat { x: number; z: number; r: number; h: number | 'auto' | 'pad'; soft?: number; /** a building's footprint: dead level inside it, whatever its neighbours' pads or a road do */ rect?: { w: number; d: number; rot: number } } // soft: blend width (m, default 4)
export interface Hill { x: number; z: number; r: number; h: number }
export interface Dip { x: number; z: number; r: number; floor: number }
/** `paved`: a cobbled street (drawn as stone, not dirt) */
export interface PathDef { pts: [number, number][]; width: number; paved?: boolean }

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
  const old = 80 + (fbm(c * 2.1 + 7, s * 2.1 + 7, 4, 17) - 0.5) * 30
    - lobe(theta, 90, 9, 9) // the quay's sheltered bay
    + lobe(theta, 36, 9, 20) // Smugglers' headland
    - lobe(theta, 62, 6, 7) // the cove's inlet
    + lobe(theta, 316, 7, 18) // Wreckers' Point
    + lobe(theta, 226, 16, 10) // Heartwood shoulder
    - lobe(theta, 178, 7, 11) // west cove
    - lobe(theta, 282, 8, 6); // north bight under the peak
  // at this size the old outline's bays are long sweeps: a finer wobble gives the coasts their own coves and points
  // (left out of the city's bay, so the harbour stays sheltered)
  return old * BS + (fbm(c * 7 + 3, s * 7 + 3, 3, 29) - 0.5) * 44 * (1 - lobe(theta, 90, 16, 1));
}

// ---- Sunreach Isle: a warm jungle island east of Bellwether, its harbour in a bay on the south shore ----------
export const SUN = { x: 420 + EAST, z: -20 }; // far enough east that neither island's waters reach the other's region
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
// ---- Amberhold Isle: the third island (levels 25-50): amberwood, Goldvein Hill, the poachers' camp ---------
export const AMBER = { x: 840 + EAST, z: -20 };
export const AMBER_RADIUS = 56;
export function amberCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return AMBER_RADIUS + (fbm(c * 2.4 + 71, s * 2.4 + 71, 4, 37) - 0.5) * 20
    - lobe(theta, 90, 9, 8) // Tollhouse Landing's bay
    + lobe(theta, 262, 11, 10) // the northern headland under the poachers' camp
    + lobe(theta, 10, 9, 6) // the Ironshell Shore's spit
    - lobe(theta, 160, 8, 6); // a cove under the amberwood
}
/** Point on Amberhold at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function amberPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = amberCoastR(t) - inset;
  return [AMBER.x + Math.cos(t) * r, AMBER.z + Math.sin(t) * r];
}
const amberAt = (thetaDeg: number, inset: number) => { const [x, z] = amberPoint(thetaDeg, inset); return { x, z }; };
// ---- Stormwrack Isle: the first island past 50 (mixed levels), far east: wrecks, storm crags, the high metals --
export const WRACK = { x: 1260 + EAST, z: -20 };
export const WRACK_RADIUS = 58;
export function wrackCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return WRACK_RADIUS + (fbm(c * 2.2 + 53, s * 2.2 + 53, 4, 29) - 0.5) * 24
    - lobe(theta, 90, 9, 8) // Gallows Landing's bay
    + lobe(theta, 316, 9, 16) // the Wrack, a ship-killing point to the north-east
    + lobe(theta, 196, 12, 9) // the Old Wood's shoulder, west
    - lobe(theta, 20, 8, 7); // an inlet on the east shore
}
/** Point on Stormwrack at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function wrackPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = wrackCoastR(t) - inset;
  return [WRACK.x + Math.cos(t) * r, WRACK.z + Math.sin(t) * r];
}
const wrackAt = (thetaDeg: number, inset: number) => { const [x, z] = wrackPoint(thetaDeg, inset); return { x, z }; };

// ---- Lockhaven: the Wardwrights' own island, uncharted since the Breaking (levels 60-90, Act III onward) ------
// A town of thirteen Houses that fell down round their doors: the doors are still standing, in fields, with nothing
// behind them. The forges where the keys were cut. A wood of starbark the Wardwrights planted. A well with a Lock in it.
export const LOCK = { x: 1680 + EAST, z: -20 };
export const LOCK_RADIUS = 54;
export function lockCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return LOCK_RADIUS + (fbm(c * 2.3 + 91, s * 2.3 + 91, 4, 41) - 0.5) * 20
    - lobe(theta, 90, 9, 8) // the Warden's Stair's bay
    + lobe(theta, 270, 14, 12) // the Keyward Cliffs, north
    + lobe(theta, 4, 8, 8) // the Thirteenth Point, east
    - lobe(theta, 186, 8, 6); // a cove under the Keywood
}
/** Point on Lockhaven at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function lockPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = lockCoastR(t) - inset;
  return [LOCK.x + Math.cos(t) * r, LOCK.z + Math.sin(t) * r];
}
const lockAt = (thetaDeg: number, inset: number) => { const [x, z] = lockPoint(thetaDeg, inset); return { x, z }; };

// ---- Saltglass: where the star came down hottest, a thousand years ago (levels 70-95, Act IV) ------------------
// The beaches fused to glass; the pools in the middle are mirrors that show you a moment late. Mira of the Tide's Lock
// lies under the Drowned Mirror at the north end. Hale's charts mark it as an anchorage.
export const SALT = { x: 2100 + EAST, z: -20 };
export const SALT_RADIUS = 52;
export function saltCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return SALT_RADIUS + (fbm(c * 2.5 + 113, s * 2.5 + 113, 4, 51) - 0.5) * 18
    - lobe(theta, 90, 9, 8) // Glasswater Steps' bay
    + lobe(theta, 300, 12, 10) // the Lens Point, north-east
    + lobe(theta, 200, 10, 7) // the grove's shoulder, west
    - lobe(theta, 30, 7, 6); // a glassy inlet, east
}
/** Point on Saltglass at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function saltPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = saltCoastR(t) - inset;
  return [SALT.x + Math.cos(t) * r, SALT.z + Math.sin(t) * r];
}
const saltAt = (thetaDeg: number, inset: number) => { const [x, z] = saltPoint(thetaDeg, inset); return { x, z }; };

// ---- Longstrand: a sandbar island the length of a town, levels 75-99 (Act IV) ---------------------------------
// Saoirse of the Line's island: a fishing village on stilts, drowned to the knees; the Netting Grounds at the east end
// where the Line House hung its brass nets; the Finfolk's haaf at the west end. The Fifth Lock is under the Weir.
export const LONG = { x: 2520 + EAST, z: -20 };
export const LONG_RADIUS = 46;
export function longCoastR(theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  return LONG_RADIUS + (fbm(c * 2.6 + 131, s * 2.6 + 131, 4, 61) - 0.5) * 14
    + lobe(theta, 0, 22, 24) + lobe(theta, 180, 22, 24) // the strand runs east-west
    - lobe(theta, 270, 30, 12) - lobe(theta, 90, 14, 6) // narrow north to south; Weir Landing's bay
    - lobe(theta, 120, 6, 5); // a channel cut by the tide, south-west
}
/** Point on Longstrand at angle `thetaDeg` round its centre, `inset` metres inside its coast. */
export function longPoint(thetaDeg: number, inset: number): [number, number] {
  const t = deg(thetaDeg), r = longCoastR(t) - inset;
  return [LONG.x + Math.cos(t) * r, LONG.z + Math.sin(t) * r];
}
const longAt = (thetaDeg: number, inset: number) => { const [x, z] = longPoint(thetaDeg, inset); return { x, z }; };

// The coastlines depend only on the angle, so they're tabulated once (the world build asks ~10^6 times)
const COAST_STEPS = 2048;
const tabulate = (f: (t: number) => number) => Float32Array.from({ length: COAST_STEPS + 1 }, (_, i) => f((i / COAST_STEPS) * Math.PI * 2 - Math.PI));
let bellTable: Float32Array | null = null, sunTable: Float32Array | null = null, wrackTable: Float32Array | null = null, amberTable: Float32Array | null = null, lockTable: Float32Array | null = null, saltTable: Float32Array | null = null, longTable: Float32Array | null = null;
function fromTable(t: Float32Array, theta: number): number {
  const f = ((theta + Math.PI) / (Math.PI * 2)) * COAST_STEPS, i = Math.max(0, Math.min(COAST_STEPS - 1, Math.floor(f)));
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}
/** Signed distance inside the nearest coastline (positive on land), over both islands. */
export function coastDist(x: number, z: number): number {
  bellTable ??= tabulate(coastR);
  sunTable ??= tabulate(sunCoastR);
  const b = fromTable(bellTable, Math.atan2(z, x)) - Math.hypot(x, z);
  wrackTable ??= tabulate(wrackCoastR);
  amberTable ??= tabulate(amberCoastR);
  lockTable ??= tabulate(lockCoastR);
  saltTable ??= tabulate(saltCoastR);
  longTable ??= tabulate(longCoastR);
  const nx = x - LONG.x, nz = z - LONG.z;
  const dx = x - SUN.x, dz = z - SUN.z, wx = x - WRACK.x, wz = z - WRACK.z, ax = x - AMBER.x, az = z - AMBER.z, kx = x - LOCK.x, kz = z - LOCK.z, gx = x - SALT.x, gz = z - SALT.z;
  return Math.max(b, fromTable(sunTable, Math.atan2(dz, dx)) - Math.hypot(dx, dz), fromTable(wrackTable, Math.atan2(wz, wx)) - Math.hypot(wx, wz),
    fromTable(amberTable, Math.atan2(az, ax)) - Math.hypot(ax, az), fromTable(lockTable, Math.atan2(kz, kx)) - Math.hypot(kx, kz), fromTable(saltTable, Math.atan2(gz, gx)) - Math.hypot(gx, gz), fromTable(longTable, Math.atan2(nz, nx)) - Math.hypot(nx, nz));
}

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
/** an old Bellwether position, at the island's new size */
const I = (x: number, z: number) => ({ x: x * BS, z: z * BS });
export const LAYOUT = {
  village: { x: 0, z: villageZ }, // Bellwether's quay square, in the old town by the harbour
  dockBase: { x: 0, z: coastPoint(90, 0)[1] - 2.5 },
  crossroads: { x: 0, z: villageZ - 22 }, // the market square, where the city's roads leave
  store: { x: -10, z: villageZ - 2 },
  chartHouse: { x: 10, z: villageZ - 4 },
  smithy: { x: 15, z: villageZ + 4 },
  cookfire: { x: -4, z: villageZ + 5 },
  strand: at(138, 4), // Crab Strand: crabs, shore fishing, Muirne on the rocks
  sands: at(108, 4), // Bellwether Sands, the city's own beach: the first crabs and beetles
  forest: I(-36, 20), // Saltpine Wood: low trees
  grove: I(-54, 4), // the Sea-oak Grove
  fen: I(-21, -16), // Mirewater Fen: east shore of the lagoon
  heartwood: I(-46, -50), // ancient trees, deep west
  hills: I(20, -6), // Copperback Hills: copper, tin, iron
  peak: I(2, -54), // Ironcrag: the mountain, iron all the way up
  ruin: I(38, -32), // the Broken Ring (the Guardian)
  camp: I(48, 16), // Brigand Camp, on the east road
  cove: at(36, 13), // Smugglers' Cove on the south-east headland
  wreck: at(316, 10), // Wreckers' Point, north-east
  summit: I(2, -60), // Ironcrag's summit: the vent forge and Cinderite
  howes: I(60, -14), // the Howes: grave mounds east of the Ring, where the haugbui keep their goods
  islet: at(215, -42), // Leviathan's Rest, an islet off the north-west coast
  spire: at(240, -34), // the Drowned Spire, mined from the deck
  // the towns past the city (2026-10-28)
  copperback: { x: 62, z: 42 }, // Copperback: the miners' town under the hills
  saltpine: { x: -118, z: 168 }, // Saltpine: the woodcutters' village at the wood's edge
  mirewater: { x: -70, z: -66 }, // Mirewater: eel-fishers' huts on the fen
  gullhaven: at(296, 40), // Gullhaven: a fishing village on the north shore
  quarry: { x: 58, z: 214 }, // the Old Quarry, a short walk north-east of the city: the first copper and tin
  copse: { x: -66, z: 236 }, // Millbrook Copse, west of the city: the first trees
  pithead: { x: 98, z: -36 }, // Copperback's mine, up the hill north of the town
  bucca: at(301, 4), // the Bucca Stone, on the point by Gullhaven
};
const sunQuay = sunAt(90, 0);
const wrackQuay = wrackAt(90, 0);
const amberQuay = amberAt(90, 0);
const lockQuay = lockAt(90, 0);
const saltQuay = saltAt(90, 0);
const longQuay = longAt(90, 0);
/** Longstrand: Weir Landing mid-south; Stiltwick (the drowned stilt village) west; the Netting Grounds east; the Finfolk's
 * haaf at the far west tip; the Weir north of the landing. */
export const LONG_LAYOUT = {
  dockBase: { x: LONG.x, z: longQuay.z - 2.5 },
  landing: { x: LONG.x, z: longQuay.z - 12 }, // Weir Landing
  stiltwick: { x: LONG.x - 30, z: LONG.z + 2 }, // Stiltwick, drowned to the knees
  netting: { x: LONG.x + 42, z: LONG.z }, // the Netting Grounds
  haaf: longAt(180, 12), // the Finfolk haaf at the west tip
  weir: { x: LONG.x + 6, z: LONG.z - 14 }, // the Weir: the Fifth Lock
  dunes: { x: LONG.x + 22, z: LONG.z - 10 }, // the marram dunes
};
/** Saltglass: Glasswater Steps at the landing; the Mirror Pools west, the Glass Dunes east, the Shattered Grove
 * north-west, the Lens Point north-east, the Drowned Mirror north. */
export const SALT_LAYOUT = {
  dockBase: { x: SALT.x, z: saltQuay.z - 2.5 },
  landing: { x: SALT.x, z: saltQuay.z - 12 }, // Glasswater Steps
  pools: { x: SALT.x - 17, z: SALT.z + 4 }, // the Mirror Pools
  dunes: { x: SALT.x + 20, z: SALT.z - 8 }, // the Glass Dunes
  grove: { x: SALT.x - 20, z: SALT.z - 20 }, // the Shattered Grove
  lens: saltAt(300, 8), // the Lens Point: Sunniva's glassworks
  mirror: { x: SALT.x + 2, z: SALT.z - 30 }, // the Drowned Mirror
};
/** Lockhaven: the Warden's Stair at the landing; the Field of Doors behind it; forges east, the Keywood west, the
 * Locksmith's Well under the northern cliffs. */
export const LOCK_LAYOUT = {
  dockBase: { x: LOCK.x, z: lockQuay.z - 2.5 },
  landing: { x: LOCK.x, z: lockQuay.z - 12 }, // the Warden's Stair
  doorfield: { x: LOCK.x - 4, z: LOCK.z - 6 }, // the Field of Doors: the ruined town, every door still standing
  forges: { x: LOCK.x + 24, z: LOCK.z - 8 }, // the Thirteen Forges
  keywood: { x: LOCK.x - 26, z: LOCK.z + 2 }, // the Keywood: starbark and leviathan cedar
  well: { x: LOCK.x + 2, z: LOCK.z - 32 }, // the Locksmith's Well, under the Keyward Cliffs
  shore: lockAt(18, 6), // the Keyhole Shore: rock-pools with keyholes worn into them
};
/** Amberhold: an outpost at the landing; the amberwood west, Goldvein Hill east, the poachers north. */
export const AMBER_LAYOUT = {
  dockBase: { x: AMBER.x, z: amberQuay.z - 2.5 },
  landing: { x: AMBER.x, z: amberQuay.z - 12 }, // Tollhouse Landing
  amberwood: { x: AMBER.x - 22, z: AMBER.z - 4 }, // amber and willow; boars root at its edge
  goldhill: { x: AMBER.x + 17, z: AMBER.z - 14 }, // gold, stormsilver and coal
  camp: { x: AMBER.x - 4, z: AMBER.z - 34 }, // the poachers' camp on the northern headland
  ironshore: amberAt(10, 6), // ironshell crabs and lobster pots
  hollow: { x: AMBER.x + 24, z: AMBER.z + 10 }, // Weaver Hollow
};
/** Stormwrack: an outpost at the landing, the island climbing north to Thunder Crag. */
export const WRACK_LAYOUT = {
  dockBase: { x: WRACK.x, z: wrackQuay.z - 2.5 },
  landing: { x: WRACK.x, z: wrackQuay.z - 12 }, // Gallows Landing: the outpost's yard
  wreck: wrackAt(316, 10), // the Wrack: the drowned and their captain
  crag: { x: WRACK.x + 3, z: WRACK.z - 24 }, // Thunder Crag: sentinels, Cinderite, the vent forge on top
  starfall: { x: WRACK.x + 24, z: WRACK.z - 2 }, // where the star came down
  oldwood: { x: WRACK.x - 24, z: WRACK.z - 4 }, // the Old Wood: ghost yew, starbark, leviathan cedar
  islet: { x: WRACK.x + Math.cos(deg(232)) * 98, z: WRACK.z + Math.sin(deg(232)) * 98 }, // Leviathan's Rest
  spire: { x: WRACK.x + Math.cos(deg(290)) * 92, z: WRACK.z + Math.sin(deg(290)) * 92 }, // the Drowned Spire
};
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
/** Bellwether city (the old harbour town at its heart) and its four towns: every building, its furniture and who
 * works there; and Port Halyard. */
const BELL = bellwetherPlan({ coastDist, coastPoint, beach: BEACH }, townPlan(L.village, L.crossroads), L.village, L.crossroads,
  { copperback: L.copperback, saltpine: L.saltpine, mirewater: L.mirewater, gullhaven: L.gullhaven });
export const BELL_TOWN: TownPlan = BELL;
/** townsfolk's rounds and the people who stand out of doors, in Bellwether */
export const BELL_ROUNDS = BELL.rounds, BELL_OUTDOOR = BELL.outdoor;
export const PORT_TOWN = portPlan(SUN_LAYOUT.port);
export const TOWN = mergePlans(BELL_TOWN, PORT_TOWN);
const SL = SUN_LAYOUT, WL = WRACK_LAYOUT, AL = AMBER_LAYOUT, KL = LOCK_LAYOUT, GL = SALT_LAYOUT, NL = LONG_LAYOUT;
/** Offshore islets: land you reach by ship. */
export const ISLETS = [{ x: L.islet.x, z: L.islet.z, r: 13 }, { x: WL.islet.x, z: WL.islet.z, r: 13 }];
export const LAGOON = { x: -34 * BS, z: -22 * BS, r: 24 };

export const FLATS: Flat[] = [
  { x: L.village.x, z: L.village.z, r: 16, h: 1.1 },
  { x: L.dockBase.x, z: L.dockBase.z - 1, r: 3, h: 1.0 },
  { x: L.ruin.x, z: L.ruin.z, r: 9, h: 'auto' },
  { x: L.camp.x, z: L.camp.z, r: 7, h: 'auto' },
  { x: L.cove.x, z: L.cove.z, r: 6, h: 1.2 },
  { x: L.crossroads.x, z: L.crossroads.z, r: 11, h: 'auto' }, // the market square
  // the smithy and its gunsmith's bench sit at the village's edge: same level as the square
  { x: L.smithy.x + 1.5, z: L.smithy.z + 0.5, r: 5.5, h: 1.1 },
  // a pad under the Ironcrag camp (forge, anvil, strongbox) so nothing sits in a slope
  { x: L.peak.x + 6, z: L.peak.z + 20, r: 6.5, h: 'auto' },
  { x: L.summit.x, z: L.summit.z, r: 5, h: 'auto' }, // the vent forge stands on a levelled summit
  { x: L.pithead.x, z: L.pithead.z, r: 7, h: 'auto' }, // the pithead's yard
  { x: L.gullhaven.x, z: L.gullhaven.z, r: 24, h: 'auto', soft: 10 }, // Gullhaven sits on a shelf above the shore
  // the towns' squares
  ...([L.copperback, L.saltpine, L.mirewater, L.gullhaven] as const).map((t, i) => ({ x: t.x, z: t.z, r: [10, 8, 6, 8][i], h: 'auto' as const })),
  // Port Halyard: the quay square and the plaza, the dock's landing, the temple's floor
  { x: SL.port.x, z: SL.port.z, r: 17, h: 1.1 },
  { x: SL.plaza.x, z: SL.plaza.z, r: 9, h: 'pad', soft: 3 }, // levelled from the quay square's height, so the forge between them sits flat
  { x: SL.dockBase.x, z: SL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: SL.temple.x, z: SL.temple.z, r: 8, h: 'auto' },
  // Amberhold: the landing yard, the dock, the poachers' camp
  { x: AL.landing.x, z: AL.landing.z, r: 11, h: 1.1 },
  { x: AL.dockBase.x, z: AL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: AL.camp.x, z: AL.camp.z, r: 6, h: 'auto' },
  { x: AL.hollow.x, z: AL.hollow.z, r: 8, h: 'auto' }, // the Broodmother's ring
  // Stormwrack: the landing yard, the dock, the crag's summit (the vent forge)
  { x: WL.landing.x, z: WL.landing.z, r: 11, h: 1.1 },
  { x: WL.dockBase.x, z: WL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: WL.crag.x, z: WL.crag.z - 6, r: 4.5, h: 'auto' },
  // Lockhaven: the Warden's Stair, the dock, the well's paved yard, the Field of Doors' old square
  { x: KL.landing.x, z: KL.landing.z, r: 11, h: 1.1 },
  { x: KL.dockBase.x, z: KL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: KL.well.x, z: KL.well.z, r: 6, h: 'auto' },
  { x: KL.doorfield.x, z: KL.doorfield.z, r: 9, h: 'auto' },
  // Saltglass: Glasswater Steps, the dock, the Drowned Mirror's rim, the Lens Point's glassworks
  { x: GL.landing.x, z: GL.landing.z, r: 11, h: 1.1 },
  { x: GL.dockBase.x, z: GL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: GL.mirror.x, z: GL.mirror.z, r: 7, h: 'auto' },
  { x: GL.lens.x, z: GL.lens.z, r: 5, h: 'auto' },
  // Longstrand: Weir Landing, the dock, the Weir's stone apron, Stiltwick's old square
  { x: NL.landing.x, z: NL.landing.z, r: 10, h: 1.1 },
  { x: NL.dockBase.x, z: NL.dockBase.z - 1, r: 3, h: 1.0 },
  { x: NL.weir.x, z: NL.weir.z, r: 6, h: 'auto' },
  { x: NL.stiltwick.x, z: NL.stiltwick.z, r: 8, h: 'auto' },
  // a level pad under every town building, at the height of the ground already there (so the quay's stay on the quay)
  ...TOWN.buildings.map((b) => ({ x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 + 0.6, h: 'pad' as const, soft: 2.5, rect: { w: b.w + 2.6, d: b.d + 2.6, rot: b.rot } })),
];

export const HILLS: Hill[] = [
  // Ironcrag: a real mountain now, the summit thirty metres up
  { x: L.summit.x, z: L.summit.z, r: 85, h: 30 },
  { x: L.peak.x - 76, z: L.peak.z + 18, r: 50, h: 12 },
  { x: L.peak.x + 76, z: L.peak.z + 4, r: 45, h: 13 },
  // the Copperback Hills
  { x: L.hills.x + 27, z: L.hills.z - 22, r: 50, h: 11 },
  { x: L.hills.x - 31, z: L.hills.z + 18, r: 31, h: 5 },
  { x: L.heartwood.x - 27, z: L.heartwood.z - 27, r: 63, h: 7 },
  { x: L.forest.x - 36, z: L.forest.z - 27, r: 63, h: 5 },
  { x: L.cove.x + 22, z: L.cove.z - 27, r: 36, h: 6 },
  // the Howes: three grassy grave mounds
  { x: L.howes.x - 7, z: L.howes.z - 4, r: 6, h: 2.6 },
  { x: L.howes.x + 7, z: L.howes.z - 6, r: 5.5, h: 2.2 },
  { x: L.howes.x, z: L.howes.z + 7, r: 5.5, h: 2.4 },
  // the downs between the towns: long low rises so the country isn't flat
  { x: -250, z: -110, r: 60, h: 8 }, { x: 110, z: -215, r: 70, h: 8 }, { x: 150, z: 160, r: 55, h: 6 }, { x: -40, z: 60, r: 60, h: 5 },
  { x: 250, z: -10, r: 50, h: 6 }, { x: -200, z: 150, r: 45, h: 4 },
  { x: SL.ember.x, z: SL.ember.z, r: 15, h: 9 },
  { x: SL.ember.x + 8, z: SL.ember.z + 10, r: 9, h: 4 },
  { x: SL.jungle.x - 4, z: SL.jungle.z - 6, r: 16, h: 3 },
  { x: AL.goldhill.x, z: AL.goldhill.z, r: 14, h: 8 },
  { x: AL.goldhill.x - 8, z: AL.goldhill.z + 9, r: 8, h: 3.5 },
  { x: AL.amberwood.x - 4, z: AL.amberwood.z - 5, r: 13, h: 3 },
  { x: AL.camp.x + 6, z: AL.camp.z + 8, r: 9, h: 3 },
  { x: WL.crag.x, z: WL.crag.z - 4, r: 17, h: 12 },
  { x: WL.crag.x + 14, z: WL.crag.z + 6, r: 9, h: 5 },
  { x: WL.oldwood.x - 4, z: WL.oldwood.z - 4, r: 14, h: 3.5 },
  { x: KL.well.x, z: KL.well.z - 10, r: 16, h: 10 }, // the Keyward Cliffs
  { x: KL.forges.x + 4, z: KL.forges.z - 6, r: 10, h: 5 },
  { x: KL.keywood.x - 4, z: KL.keywood.z - 4, r: 13, h: 3 },
  { x: GL.dunes.x, z: GL.dunes.z, r: 12, h: 4.5 }, // the Glass Dunes
  { x: GL.dunes.x + 6, z: GL.dunes.z + 10, r: 8, h: 2.5 },
  { x: GL.grove.x - 4, z: GL.grove.z - 4, r: 12, h: 3 },
  { x: NL.dunes.x, z: NL.dunes.z, r: 10, h: 3 }, // the marram dunes
  { x: NL.dunes.x - 30, z: NL.dunes.z + 2, r: 9, h: 2 },
];

export const MIRROR_POOL = { x: GL.pools.x, z: GL.pools.z, r: 7 };
export const DIPS: Dip[] = [{ x: LAGOON.x, z: LAGOON.z, r: LAGOON.r, floor: -1.8 }, { x: MIRROR_POOL.x, z: MIRROR_POOL.z, r: MIRROR_POOL.r, floor: -1.6 }];

const V = L.village, X = L.crossroads, F = L.forest, HW = L.heartwood, CH = L.hills, M = L.peak;
const R = L.ruin, C = L.camp, SC = L.cove, W = L.wreck, ST = L.strand;
/** a country road: straight legs broken into ~22 m pieces that wander a little either side (the ends stay put) */
function road(width: number, pts: [number, number][], seed: number): PathDef {
  const out: [number, number][] = [pts[0]];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az) || 1, n = Math.max(1, Math.round(len / 22));
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let i = 1; i <= n; i++) {
      const f = i / n, wob = i === n ? 0 : (fbm(seed * 1.7 + k * 3.1 + f * 2.3, seed * 0.7 + 5, 2, 41) - 0.5) * Math.min(14, len * 0.12);
      out.push([ax + (bx - ax) * f + nx * wob, az + (bz - az) * f + nz * wob]);
    }
  }
  return { pts: out, width };
}
const CB = L.copperback, SP = L.saltpine, MW = L.mirewater, GH = L.gullhaven;
const end = (p: [number, number][]) => p[p.length - 1];
const [hsEnd, esEnd, wsEnd, weEnd] = [BELL.streets[2].pts, BELL.streets[3].pts, BELL.streets[4].pts, BELL.streets[1].pts].map(end);
export const PATHS: PathDef[] = [
  // the city: the quay road from the dock to the market square, and its streets
  { width: 2.4, paved: true, pts: [[0, L.dockBase.z], [0, V.z + 3], [0, X.z]] },
  ...BELL.streets.map((st) => ({ width: st.width, pts: st.pts, paved: st.paved })),
  // the North Road: up High Street, out to Copperback, through the hills to the Ironcrag camp
  road(2.0, [hsEnd, [30, 120], [CB.x - 4, CB.z + 11]], 1),
  road(1.4, [[CB.x + 16, CB.z - 62], [L.pithead.x - 6, L.pithead.z + 8]], 16),
  road(1.8, [[CB.x + 16, CB.z - 62], [CH.x - 20, CH.z + 34], [CH.x - 5, CH.z - 6], [M.x + 22, M.z + 70], [M.x + 6, M.z + 24], [M.x + 3, M.z + 13]], 2),
  // a switchback trail from the Ironcrag camp up to the summit
  { width: 1.1, pts: [[M.x + 3, M.z + 13], [M.x - 12, M.z + 2], [M.x + 8, M.z - 12], [M.x - 4, M.z - 20], [L.summit.x, L.summit.z + 4]] },
  // the hills to the Broken Ring, on to Gullhaven and Wreckers' Point; the Ring to the Howes
  road(1.6, [[CH.x - 5, CH.z - 6], [R.x - 30, R.z + 40], [R.x - 2, R.z + 9]], 3),
  road(1.6, [[R.x + 8, R.z - 2], [GH.x + 10, GH.z + 50], [GH.x + 2, GH.z + 9]], 4),
  road(1.4, [[GH.x + 9, GH.z - 2], [W.x - 40, W.z + 16], [W.x, W.z]], 5),
  road(1.4, [[R.x + 8, R.z + 3], [L.howes.x - 30, L.howes.z - 10], [L.howes.x - 10, L.howes.z]], 6),
  // the East Road: out along East Street to the Brigand Camp, and on to Smugglers' Cove
  road(1.8, [esEnd, [150, 190], [C.x - 20, C.z + 20], [C.x - 6, C.z + 5]], 7),
  road(1.5, [[C.x + 5, C.z + 6], [SC.x - 40, SC.z - 40], [SC.x - 5, SC.z - 9], [SC.x, SC.z]], 8),
  // the West Road: West Street to Saltpine, through the wood to Mirewater, on to the Heartwood
  road(1.8, [wsEnd, [L.copse.x - 20, L.copse.z - 14], [SP.x + 10, SP.z + 6]], 9),
  road(1.6, [[SP.x - 6, SP.z - 8], [F.x + 18, F.z + 20], [F.x, F.z], [F.x + 10, F.z - 60], [MW.x - 2, MW.z + 9]], 10),
  road(1.5, [[MW.x - 8, MW.z - 4], [LAGOON.x + 10, LAGOON.z - LAGOON.r - 14], [HW.x + 40, HW.z + 40], [HW.x, HW.z]], 11),
  // Saltpine to the Sea-oak Grove; Mirewater over to the hills; the High Street to the Old Quarry
  road(1.3, [[SP.x - 8, SP.z + 2], [L.grove.x + 50, L.grove.z + 70], [L.grove.x + 6, L.grove.z + 6]], 12),
  road(1.4, [[MW.x + 8, MW.z - 1], [-10, -48], [CH.x - 30, CH.z + 12]], 13),
  road(1.4, [BELL.streets[2].pts[2], [36, X.z - 74], [L.quarry.x - 6, L.quarry.z + 6]], 14),
  // the West End's road along the shore to Crab Strand
  road(1.4, [weEnd, [ST.x + 30, ST.z - 16], [ST.x + 6, ST.z - 4]], 15),
  // Sunreach: the high street from the dock through the quay square and plaza, on into the jungle
  { width: 1.5, pts: [[SL.dockBase.x, SL.dockBase.z], [SL.port.x, SL.port.z], [SL.plaza.x, SL.plaza.z], [SL.jungle.x + 6, SL.jungle.z + 8], [SL.jungle.x, SL.jungle.z]] },
  { width: 1.2, pts: [[SL.plaza.x, SL.plaza.z], [SL.ember.x - 6, SL.ember.z + 14], [SL.ember.x - 2, SL.ember.z + 6]] },
  { width: 1.1, pts: [[SL.jungle.x, SL.jungle.z], [SL.temple.x - 2, SL.temple.z + 12], [SL.temple.x, SL.temple.z + 6]] },
  { width: 1.1, pts: [[SL.port.x - 6, SL.port.z + 2], [SL.palms.x + 10, SL.palms.z + 2], [SL.palms.x, SL.palms.z]] },
  { width: 1.1, pts: [[SL.ember.x - 2, SL.ember.z + 6], [SL.reefshore.x - 8, SL.reefshore.z], [SL.reefshore.x, SL.reefshore.z]] },
  // Amberhold: the landing north through the island's middle to the poachers' camp; branches west, east, south-east
  { width: 1.4, pts: [[AL.dockBase.x, AL.dockBase.z], [AL.landing.x, AL.landing.z], [AMBER.x + 2, AMBER.z + 2], [AL.camp.x + 3, AL.camp.z + 10], [AL.camp.x, AL.camp.z]] },
  { width: 1.1, pts: [[AMBER.x + 2, AMBER.z + 2], [AL.amberwood.x + 10, AL.amberwood.z + 4], [AL.amberwood.x, AL.amberwood.z]] },
  { width: 1.1, pts: [[AMBER.x + 2, AMBER.z + 2], [AL.goldhill.x - 8, AL.goldhill.z + 12], [AL.goldhill.x - 4, AL.goldhill.z + 6]] },
  { width: 1.1, pts: [[AL.goldhill.x - 8, AL.goldhill.z + 12], [AL.ironshore.x - 10, AL.ironshore.z - 2], [AL.ironshore.x - 3, AL.ironshore.z]] },
  { width: 1.1, pts: [[AL.landing.x + 4, AL.landing.z - 3], [AL.hollow.x - 8, AL.hollow.z + 4], [AL.hollow.x, AL.hollow.z]] },
  // Stormwrack: the landing up to the crag's foot; branches to the Wrack, the Old Wood and Starfall
  { width: 1.4, pts: [[WL.dockBase.x, WL.dockBase.z], [WL.landing.x, WL.landing.z], [WL.crag.x - 2, WL.crag.z + 16], [WL.crag.x - 1, WL.crag.z + 9]] },
  { width: 1.1, pts: [[WL.crag.x - 2, WL.crag.z + 16], [WL.oldwood.x + 10, WL.oldwood.z + 6], [WL.oldwood.x, WL.oldwood.z]] },
  { width: 1.1, pts: [[WL.landing.x + 4, WL.landing.z - 4], [WL.starfall.x - 8, WL.starfall.z + 8], [WL.starfall.x, WL.starfall.z + 5]] },
  { width: 1.1, pts: [[WL.crag.x + 6, WL.crag.z + 10], [WL.wreck.x - 8, WL.wreck.z + 8], [WL.wreck.x, WL.wreck.z]] },
  // Lockhaven: the old high street from the Stair up through the Field of Doors to the Well; branches to the forges,
  // the Keywood and the shore
  { width: 1.5, pts: [[KL.dockBase.x, KL.dockBase.z], [KL.landing.x, KL.landing.z], [KL.doorfield.x + 2, KL.doorfield.z + 10], [KL.doorfield.x, KL.doorfield.z], [KL.well.x - 2, KL.well.z + 12], [KL.well.x, KL.well.z + 5]] },
  { width: 1.1, pts: [[KL.doorfield.x + 6, KL.doorfield.z + 4], [KL.forges.x - 10, KL.forges.z + 4], [KL.forges.x - 3, KL.forges.z + 2]] },
  { width: 1.1, pts: [[KL.doorfield.x - 6, KL.doorfield.z + 4], [KL.keywood.x + 10, KL.keywood.z + 2], [KL.keywood.x + 2, KL.keywood.z]] },
  { width: 1.1, pts: [[KL.landing.x + 5, KL.landing.z - 3], [KL.shore.x - 10, KL.shore.z + 4], [KL.shore.x - 3, KL.shore.z]] },
  // Saltglass: the Steps north through the island's middle to the Drowned Mirror; branches to the pools, the dunes,
  // the grove and the Lens Point
  { width: 1.4, pts: [[GL.dockBase.x, GL.dockBase.z], [GL.landing.x, GL.landing.z], [SALT.x + 1, SALT.z + 2], [GL.mirror.x - 1, GL.mirror.z + 10], [GL.mirror.x, GL.mirror.z + 6]] },
  { width: 1.1, pts: [[SALT.x + 1, SALT.z + 2], [GL.pools.x + 12, GL.pools.z], [GL.pools.x + MIRROR_POOL.r + 3, GL.pools.z]] },
  { width: 1.1, pts: [[SALT.x + 1, SALT.z + 2], [GL.dunes.x - 10, GL.dunes.z + 6], [GL.dunes.x - 4, GL.dunes.z + 4]] },
  { width: 1.1, pts: [[GL.mirror.x - 1, GL.mirror.z + 10], [GL.grove.x + 10, GL.grove.z + 4], [GL.grove.x + 2, GL.grove.z]] },
  { width: 1.1, pts: [[GL.mirror.x - 1, GL.mirror.z + 10], [GL.lens.x - 8, GL.lens.z + 6], [GL.lens.x - 2, GL.lens.z + 2]] },
  // Longstrand: the strand road, end to end through Weir Landing, and up to the Weir
  { width: 1.3, pts: [[NL.dockBase.x, NL.dockBase.z], [NL.landing.x, NL.landing.z], [LONG.x - 2, LONG.z + 2], [NL.stiltwick.x + 8, NL.stiltwick.z], [NL.stiltwick.x, NL.stiltwick.z], [NL.haaf.x + 12, NL.haaf.z], [NL.haaf.x + 4, NL.haaf.z]] },
  { width: 1.1, pts: [[LONG.x - 2, LONG.z + 2], [NL.dunes.x - 6, NL.dunes.z + 8], [NL.netting.x - 10, NL.netting.z + 2], [NL.netting.x - 2, NL.netting.z]] },
  { width: 1.1, pts: [[LONG.x - 2, LONG.z + 2], [NL.weir.x - 2, NL.weir.z + 8], [NL.weir.x, NL.weir.z + 4]] },
];

// Paths are many short segments now (roads wander), so they're looked up through a grid: each cell lists the
// segments that pass within PATH_REACH of it. Past that, a path is "far": callers only ever ask about the near ones.
const PATH_CELL = 16, PATH_REACH = 12;
let pathGrid: Map<number, number[]> | null = null;
let pathSegs: { ax: number; az: number; bx: number; bz: number; p: PathDef }[] = [];
const pkey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
function buildPathGrid() {
  pathGrid = new Map();
  pathSegs = [];
  for (const p of PATHS) for (let k = 0; k < p.pts.length - 1; k++) {
    const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1], id = pathSegs.length;
    pathSegs.push({ ax, az, bx, bz, p });
    const r = PATH_REACH + p.width;
    for (let i = Math.floor((Math.min(ax, bx) - r) / PATH_CELL); i <= Math.floor((Math.max(ax, bx) + r) / PATH_CELL); i++)
      for (let j = Math.floor((Math.min(az, bz) - r) / PATH_CELL); j <= Math.floor((Math.max(az, bz) + r) / PATH_CELL); j++) {
        const k2 = pkey(i, j);
        let l = pathGrid.get(k2);
        if (!l) pathGrid.set(k2, (l = []));
        l.push(id);
      }
  }
}

/** The nearest path's distance and width (and whether it's a paved street); nothing within ~12 m reads as far away. */
export function nearestPathDist(x: number, z: number): { d: number; width: number; paved: boolean } {
  if (!pathGrid) buildPathGrid();
  let d = Infinity, width = 1, paved = false;
  const list = pathGrid!.get(pkey(Math.floor(x / PATH_CELL), Math.floor(z / PATH_CELL)));
  if (list) for (const id of list) {
    const s = pathSegs[id], dx = s.bx - s.ax, dz = s.bz - s.az;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
    const pd = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
    if (pd < d) { d = pd; width = s.p.width; paved = !!s.p.paved; }
  }
  return { d: d === Infinity ? 1e3 : d, width, paved };
}

// flats looked up through a grid too (a city's worth of building pads), in their own order: a pad levels to the
// height the flats before it left
const FLAT_CELL = 16;
let flatGrid: Map<number, number[]> | null = null;
const NONE: number[] = [];
/** the flats (by index into FLATS) whose levelled ground reaches (x, z) */
export function flatsAt(x: number, z: number): readonly number[] { return flatsNear(x, z); }
function flatsNear(x: number, z: number): number[] {
  if (!flatGrid) {
    flatGrid = new Map();
    FLATS.forEach((f, idx) => {
      const r = f.r + (f.soft ?? 4) + 0.5;
      for (let i = Math.floor((f.x - r) / FLAT_CELL); i <= Math.floor((f.x + r) / FLAT_CELL); i++)
        for (let j = Math.floor((f.z - r) / FLAT_CELL); j <= Math.floor((f.z + r) / FLAT_CELL); j++) {
          const k = pkey(i, j);
          let l = flatGrid!.get(k);
          if (!l) flatGrid!.set(k, (l = []));
          l.push(idx);
        }
    });
  }
  return flatGrid.get(pkey(Math.floor(x / FLAT_CELL), Math.floor(z / FLAT_CELL))) ?? NONE;
}

export function rawHeight(x: number, z: number): number {
  return shapedHeight(x, z, true);
}

/** Natural ground height, optionally levelled by the flats (auto flats take the natural height at their centre). */
function shapedHeight(x: number, z: number, levelled: boolean, upto = FLATS.length): number {
  const d = coastDist(x, z);
  // the eastern islands moved EAST metres when Bellwether grew: their ground noise is read where it was, so their
  // terrain didn't change
  const qx = x > 650 ? x - EAST : x;
  const n = fbm(qx * 0.06 + 40, z * 0.06 + 40, 4, 3);
  // open sea (most of the world): nothing but seabed out here, so skip the flats, roads and hills
  if (d < -10 && !ISLETS.some((is) => Math.hypot(x - is.x, z - is.z) < is.r + 14)) return Math.max(0.05 + d * 0.35 * (0.8 + n * 0.5), -6 + n);
  let h: number;
  if (d > 0) {
    const broad = fbm(qx * 0.022 + 3, z * 0.022 + 3, 3, 9);
    // a wide, gently climbing beach, then the island's rolling ground. The toe keeps the seabed's slope
    // going for the first few metres, so the waterline crosses a real slope instead of hugging a flat shelf
    // (a shelf just above the water makes the shoreline trace the height grid as a staircase)
    h = 0.05 + 0.3 * (1 - Math.exp(-d / 1.1)) + Math.min(d / BEACH, 1) * 0.3 + smooth(d, BEACH - 1, BEACH + 12) * (0.5 + n * 2.0 + broad * 1.6);
    // (Bellwether's big hills ease down over 45 m to the shore instead of 6, so its coasts stay walkable)
    const inland = smooth(d, BEACH * 0.4, BEACH + (Math.abs(x) < 700 && Math.abs(z) < 700 ? 45 : 6));
    for (const hl of HILLS) {
      const q = ((x - hl.x) ** 2 + (z - hl.z) ** 2) / (hl.r * hl.r);
      if (q < 9) h += hl.h * Math.exp(-q) * inland;
    }
    // Bellwether's wide country rolls: slow swells a few metres high, so a long walk goes up and down
    if (Math.abs(x) < 700 && Math.abs(z) < 700) h += fbm(x * 0.0065 + 11, z * 0.0065 + 11, 3, 13) * 4.5 * smooth(d, BEACH, BEACH + 40);
  } else {
    h = 0.05 + d * 0.35 * (0.8 + n * 0.5);
    h = Math.max(h, -6 + n);
  }
  if (levelled) for (const i of flatsNear(x, z)) {
    if (i >= upto) break;
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
  // a building's floor is its pad's height, edge to edge (in a crowded street the next pad's slope would tilt it)
  if (levelled) for (const i of flatsNear(x, z)) {
    if (i >= upto) break;
    const f = FLATS[i];
    if (!f.rect || typeof f.h !== 'number') continue;
    const c = Math.cos(f.rect.rot), sn = Math.sin(f.rect.rot), dx = x - f.x, dz = z - f.z;
    if (Math.abs(dx * c + dz * sn) <= f.rect.w / 2 && Math.abs(-dx * sn + dz * c) <= f.rect.d / 2) h = f.h;
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
  spot_bell: [sunPoint(150, -18), sunPoint(60, -20)],
};
/** Ship-only fishing grounds off Amberhold (world x, z). */
export const AMBER_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_sword: [amberPoint(150, -18), amberPoint(40, -20)],
};
export const SEA_SPOTS: Record<string, [number, number][]> = {
  spot_bell: [[20, -16], [200, -16], [295, -17]],
};
/** Ship-only fishing grounds off Stormwrack (world x, z): the deep water's big fish. */
export const WRACK_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_sword: [wrackPoint(140, -18)],
  spot_shark: [wrackPoint(30, -24), wrackPoint(350, -26)],
  spot_angler: [wrackPoint(180, -26)],
};

/** Ship-only fishing grounds off Lockhaven (world x, z). */
export const LOCK_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_shark: [lockPoint(320, -22)],
  spot_angler: [lockPoint(200, -24), lockPoint(40, -24)],
};

/** Ship-only fishing grounds off Saltglass (world x, z). */
export const SALT_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_angler: [saltPoint(160, -22)],
  spot_shark: [saltPoint(20, -22), saltPoint(250, -24)],
};

/** Ship-only fishing grounds off Longstrand (world x, z): the best water in the Reef. */
export const LONG_SEA_SPOTS: Record<string, [number, number][]> = {
  spot_angler: [longPoint(60, -20), longPoint(300, -20)],
  spot_shark: [longPoint(240, -22)],
  spot_sword: [longPoint(130, -20)],
};

// ---- named places (discovery) ------------------------------------------------
// A place is only listed once it has something to do; new zones join as their content lands.
export interface Place { id: string; name: string; x: number; z: number; r: number; sea?: boolean; region?: RegionId } // no region: Bellwether

/** The islands' places; `places.ts` adds the caves'. */
export const ISLAND_PLACES: Place[] = [
  { id: 'quay', name: 'Bellwether Quay', x: V.x, z: V.z + 6, r: 18 },
  { id: 'city', name: 'Bellwether', x: X.x, z: X.z - 40, r: 70 },
  { id: 'harbourrow', name: 'Harbour Row', x: coastPoint(76, 30)[0], z: coastPoint(76, 30)[1], r: 30 },
  { id: 'sands', name: 'Bellwether Sands', x: L.sands.x, z: L.sands.z, r: 22 },
  { id: 'quarry', name: 'The Old Quarry', x: L.quarry.x, z: L.quarry.z, r: 16 },
  { id: 'copse', name: 'Millbrook Copse', x: L.copse.x, z: L.copse.z, r: 20 },
  { id: 'copperback', name: 'Copperback', x: L.copperback.x, z: L.copperback.z, r: 26 },
  { id: 'saltpine', name: 'Saltpine', x: L.saltpine.x, z: L.saltpine.z, r: 20 },
  { id: 'mirewater', name: 'Mirewater', x: L.mirewater.x, z: L.mirewater.z, r: 16 },
  { id: 'gullhaven', name: 'Gullhaven', x: L.gullhaven.x, z: L.gullhaven.z, r: 22 },
  { id: 'pithead', name: 'Copperback Mine', x: L.pithead.x, z: L.pithead.z, r: 14 },
  { id: 'strand', name: 'Crab Strand', x: ST.x, z: ST.z, r: 30 },
  { id: 'wood', name: 'Saltpine Wood', x: F.x, z: F.z, r: 60 },
  { id: 'hills', name: 'Copperback Hills', x: CH.x, z: CH.z, r: 50 },
  { id: 'camp', name: 'Brigand Camp', x: C.x, z: C.z, r: 24 },
  { id: 'ruin', name: 'The Broken Ring', x: R.x, z: R.z, r: 20 },
  { id: 'grove', name: 'Sea-oak Grove', x: L.grove.x, z: L.grove.z, r: 40 },
  { id: 'fen', name: 'Mirewater Fen', x: LAGOON.x, z: LAGOON.z, r: 45 },
  { id: 'heartwood', name: 'Heartwood', x: HW.x, z: HW.z, r: 70 },
  { id: 'peak', name: 'Ironcrag', x: M.x, z: M.z + 6, r: 70 },
  { id: 'cove', name: 'Smugglers\' Cove', x: SC.x, z: SC.z, r: 22 },
  { id: 'wreck', name: 'Wreckers\' Point', x: W.x, z: W.z, r: 24 },
  { id: 'howes', name: 'The Howes', x: L.howes.x, z: L.howes.z, r: 24 },
  ...([['shallows', 'Bellfish Shallows', 20, -16], ['gnasher', 'Gnasher\'s Reef', 45, -26]] as const)
    .map(([id, name, a, i]) => { const [x, z] = coastPoint(a, i); return { id, name, x, z, r: 16, sea: true }; }),
  // Sunreach Isle
  { id: 'halyard', name: 'Port Halyard', x: SL.port.x, z: SL.port.z - 6, r: 18, region: 'sunreach' },
  { id: 'greenheart', name: 'The Greenheart', x: SL.jungle.x, z: SL.jungle.z, r: 16, region: 'sunreach' },
  { id: 'ember', name: 'Ember Hill', x: SL.ember.x, z: SL.ember.z + 4, r: 15, region: 'sunreach' },
  { id: 'palmcove', name: 'Palm Cove', x: SL.palms.x, z: SL.palms.z, r: 13, region: 'sunreach' },
  { id: 'reefshore', name: 'The Reef Shore', x: SL.reefshore.x, z: SL.reefshore.z, r: 13, region: 'sunreach' },
  { id: 'channel', name: 'Halyard Channel', x: SUN.x - 75, z: 10, r: 18, sea: true, region: 'sunreach' },
  // Amberhold Isle (levels 25-50)
  { id: 'tollhouse', name: 'Tollhouse Landing', x: AL.landing.x, z: AL.landing.z - 2, r: 16, region: 'amberhold' },
  { id: 'amberwood', name: 'The Amberwood', x: AL.amberwood.x, z: AL.amberwood.z, r: 16, region: 'amberhold' },
  { id: 'goldhill', name: 'Goldvein Hill', x: AL.goldhill.x, z: AL.goldhill.z, r: 15, region: 'amberhold' },
  { id: 'poachcamp', name: 'The Poachers\' Camp', x: AL.camp.x, z: AL.camp.z, r: 12, region: 'amberhold' },
  { id: 'ironshore', name: 'Ironshell Shore', x: AL.ironshore.x, z: AL.ironshore.z, r: 13, region: 'amberhold' },
  { id: 'hollow', name: 'Weaver Hollow', x: AL.hollow.x, z: AL.hollow.z, r: 12, region: 'amberhold' },
  ...([['a_swordrun', 'Amber Sound', 150, -18]] as const)
    .map(([id, name, a, i]) => { const [x, z] = amberPoint(a, i); return { id, name, x, z, r: 16, sea: true, region: 'amberhold' as RegionId }; }),
  // Stormwrack Isle (levels 50 and up, mixed)
  { id: 'gallows', name: 'Gallows Landing', x: WL.landing.x, z: WL.landing.z - 2, r: 16, region: 'wrack' },
  { id: 'thewrack', name: 'The Wrack', x: WL.wreck.x, z: WL.wreck.z, r: 13, region: 'wrack' },
  { id: 'thundercrag', name: 'Thunder Crag', x: WL.crag.x, z: WL.crag.z, r: 16, region: 'wrack' },
  { id: 'w_starfall', name: 'Starfall', x: WL.starfall.x, z: WL.starfall.z, r: 10, region: 'wrack' },
  { id: 'oldwood', name: 'The Old Wood', x: WL.oldwood.x, z: WL.oldwood.z, r: 16, region: 'wrack' },
  { id: 'w_islet', name: 'Leviathan\'s Rest', x: WL.islet.x, z: WL.islet.z, r: 16, region: 'wrack' },
  { id: 'w_spire', name: 'The Drowned Spire', x: WL.spire.x, z: WL.spire.z, r: 14, sea: true, region: 'wrack' },
  ...([['w_swordrun', 'Swordfish Run', 140, -18], ['w_deeps', 'Shark Deeps', 30, -24], ['w_trench', 'Angler\'s Trench', 180, -26]] as const)
    .map(([id, name, a, i]) => { const [x, z] = wrackPoint(a, i); return { id, name, x, z, r: 16, sea: true, region: 'wrack' as RegionId }; }),
  // Lockhaven (levels 60-90): the Wardwrights' island
  { id: 'wardenstair', name: 'The Warden\'s Stair', x: KL.landing.x, z: KL.landing.z - 2, r: 16, region: 'lockhaven' },
  { id: 'doorfield', name: 'The Field of Doors', x: KL.doorfield.x, z: KL.doorfield.z, r: 14, region: 'lockhaven' },
  { id: 'forges', name: 'The Thirteen Forges', x: KL.forges.x, z: KL.forges.z, r: 13, region: 'lockhaven' },
  { id: 'keywood', name: 'The Keywood', x: KL.keywood.x, z: KL.keywood.z, r: 15, region: 'lockhaven' },
  { id: 'lockwell', name: 'The Locksmith\'s Well', x: KL.well.x, z: KL.well.z, r: 10, region: 'lockhaven' },
  { id: 'keyholeshore', name: 'The Keyhole Shore', x: KL.shore.x, z: KL.shore.z, r: 13, region: 'lockhaven' },
  ...([['k_deeps', 'The Lockwater', 200, -24]] as const)
    .map(([id, name, a, i]) => { const [x, z] = lockPoint(a, i); return { id, name, x, z, r: 16, sea: true, region: 'lockhaven' as RegionId }; }),
  // Saltglass (levels 70-95)
  { id: 'glasssteps', name: 'Glasswater Steps', x: GL.landing.x, z: GL.landing.z - 2, r: 16, region: 'saltglass' },
  { id: 'mirrorpools', name: 'The Mirror Pools', x: GL.pools.x, z: GL.pools.z, r: 14, region: 'saltglass' },
  { id: 'glassdunes', name: 'The Glass Dunes', x: GL.dunes.x, z: GL.dunes.z, r: 14, region: 'saltglass' },
  { id: 'shatteredgrove', name: 'The Shattered Grove', x: GL.grove.x, z: GL.grove.z, r: 13, region: 'saltglass' },
  { id: 'lenspoint', name: 'The Lens Point', x: GL.lens.x, z: GL.lens.z, r: 11, region: 'saltglass' },
  { id: 'drownedmirror', name: 'The Drowned Mirror', x: GL.mirror.x, z: GL.mirror.z, r: 10, region: 'saltglass' },
  ...([['g_glassdeep', 'The Glass Deep', 20, -22]] as const)
    .map(([id, name, a, i]) => { const [x, z] = saltPoint(a, i); return { id, name, x, z, r: 16, sea: true, region: 'saltglass' as RegionId }; }),
  // Longstrand (levels 75-99)
  { id: 'weirlanding', name: 'Weir Landing', x: NL.landing.x, z: NL.landing.z - 2, r: 14, region: 'longstrand' },
  { id: 'stiltwick', name: 'Stiltwick', x: NL.stiltwick.x, z: NL.stiltwick.z, r: 13, region: 'longstrand' },
  { id: 'nettinggrounds', name: 'The Netting Grounds', x: NL.netting.x, z: NL.netting.z, r: 13, region: 'longstrand' },
  { id: 'finfolkhaaf', name: 'The Finfolk Haaf', x: NL.haaf.x, z: NL.haaf.z, r: 12, region: 'longstrand' },
  { id: 'theweir', name: 'The Weir', x: NL.weir.x, z: NL.weir.z, r: 9, region: 'longstrand' },
  { id: 'marram', name: 'The Marram Dunes', x: NL.dunes.x, z: NL.dunes.z, r: 11, region: 'longstrand' },
  ...([['n_bestwater', 'The Best Water', 60, -20]] as const)
    .map(([id, name, a, i]) => { const [x, z] = longPoint(a, i); return { id, name, x, z, r: 16, sea: true, region: 'longstrand' as RegionId }; }),
];
