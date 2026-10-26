import { mulberry32 } from '../../art/noise';
import { BELL_TOWN, PORT_TOWN, LAYOUT, LAGOON, SEA_SPOTS, PATHS, BEACH, coastPoint, coastDist, nearestPathDist, FLATS, SUN, SUN_LAYOUT, SUN_RADIUS, SUN_SEA_SPOTS, sunPoint, WRACK, WRACK_LAYOUT, WRACK_RADIUS, WRACK_SEA_SPOTS, wrackPoint, AMBER, AMBER_LAYOUT, AMBER_RADIUS, AMBER_SEA_SPOTS, amberPoint, rawHeight } from './island';
import { World } from './world';
import { buildingSolids, doorPoints, toLocal, toWorld, type BuildingDef } from './buildings';
import type { TownPlan } from './town';
import { REGIONS, type IslandId, type RegionId } from './regions';
import { CAVES, CAVE_WALK_MAX, caveHeight, caveOpen, chamberAt } from './caves';

// Everything placed in a region, derived deterministically. Shared by simulation and renderer.

export type BuildingKind = 'tent' | 'smithy';
export interface Building { kind: BuildingKind; x: number; z: number; rot: number; w: number; d: number; seed: number }
/** `scenery` nodes are the island's ordinary trees, boulders, bushes and kelp: drawn instanced, still usable. */
export interface NodePlacement { uid: string; def: string; x: number; z: number; seed: number; scenery?: boolean; s?: number; rot?: number }
export type DecorKind = 'leviathan' | 'crater' | 'netrack' | 'rowboat' | 'signpost' | 'fence' | 'well' | 'driftwood' | 'shells' | 'pots' | 'cannon' | 'wreck' | 'woodpile' | 'flowers';
export type CaveKind = 'cavemouth' | 'rope' | 'web' | 'crystal' | 'torch' | 'stalagmite' | 'lava';
export interface Prop { kind: 'pine' | 'broadleaf' | 'rock' | 'crate' | 'barrel' | 'lantern' | 'pillar' | 'campfire' | DecorKind | CaveKind; x: number; z: number; rot: number; s: number; seed: number; aux?: number[] }
export interface SpawnPoint { enemy: string; x: number; z: number }
export interface Dock { x: number; zStart: number; len: number; headWidth: number; deckY: number; headZ: number }
/** A way into another region on foot: a cave mouth, or the rope back up. `out` is where you stand on arrival. */
export interface Portal { id: string; x: number; z: number; to: RegionId; label: string; verb: string; out: { x: number; z: number } }
/** A boss arena: ring of stones round a point you strike to wake its guardian. */
export interface Arena { boss: string; x: number; z: number; r: number; altar: { x: number; z: number }; label: string; verb: string }

export interface IslandLayout {
  region: RegionId;
  world: World;
  dock: Dock | null;
  /** where the ferry leaves you and your ship at this island's harbour */
  port: { name: string; ship: { x: number; z: number; heading: number }; land: { x: number; z: number } } | null;
  mooring: { x: number; z: number; heading: number } | null;
  buildings: Building[];
  nodes: NodePlacement[];
  props: Prop[];
  reefs: { x: number; z: number; r: number }[];
  stations: { id: 'furnace' | 'anvil' | 'fire' | 'bench' | 'vent'; x: number; z: number }[];
  banks: { x: number; z: number; booth?: boolean }[]; // strongboxes (booth: the bank's counter, no chest drawn)
  town: BuildingDef[]; // enterable buildings
  stalls: { x: number; z: number; rot: number; colour: number }[];
  wanderers: { look: string; path: [number, number][] }[]; // townsfolk walking their rounds (visual only)
  npcs: { id: string; x: number; z: number; facing: number }[];
  spawns: SpawnPoint[];
  arenas: Arena[];
  portals: Portal[];
  respawn: { x: number; z: number };
}

const cache = new Map<RegionId, IslandLayout>();
/** A region's layout (built once, then shared: it's read-only after the build). */
export function regionLayout(id: RegionId): IslandLayout {
  let l = cache.get(id);
  if (!l) cache.set(id, (l = REGIONS[id].kind === 'cave' ? buildCave(id) : buildIslandRegion(id as IslandId)));
  return l;
}
/** A region's layout if it has been built this session (no build: for lists that mustn't stall the UI). */
export function cachedLayout(id: RegionId): IslandLayout | null { return cache.get(id) ?? null; }
/** The starter island (defaults, tests). */
export function buildIsland(_seed = 1): IslandLayout { return regionLayout('bellwether'); }

// Cave mouths on the islands, and where each leads
const CAVE_MOUTHS: { id: string; island: RegionId; cave: RegionId; at: () => { x: number; z: number; facing: number } }[] = [
  // Smugglers' Caves: in the headland's rock behind the cove camp
  { id: 'mouth_smugglers', island: 'bellwether', cave: 'smugglers_caves', at: () => ({ x: LAYOUT.cove.x + 6.5, z: LAYOUT.cove.z - 7.5, facing: Math.PI * 0.75 }) },
  // the Ember Deep: in Ember Hill's south-west flank
  { id: 'mouth_ember', island: 'sunreach', cave: 'ember_deep', at: () => ({ x: SUN_LAYOUT.ember.x - 9, z: SUN_LAYOUT.ember.z + 9, facing: Math.PI * 0.6 }) },
];

/** Amberhold and Stormwrack have no town: an outpost of stations, a strongbox and the harbourmaster. */
const NO_TOWN: TownPlan = { buildings: [], npcs: [], stalls: [], squares: [] };

function buildIslandRegion(region: IslandId): IslandLayout {
  const bell = region === 'bellwether', sun = region === 'sunreach', amb = region === 'amberhold', wrack = region === 'wrack';
  const rnd = mulberry32(bell ? 1 : sun ? 2 : wrack ? 3 : 4);
  const world = new World(REGIONS[region].bounds, rawHeight);
  const T: TownPlan = bell ? BELL_TOWN : sun ? PORT_TOWN : NO_TOWN;
  const SL = SUN_LAYOUT, WL = WRACK_LAYOUT, AL = AMBER_LAYOUT;
  /** a point `inset` metres inside this island's coast at angle `deg` (negative: out at sea) */
  const cp = (deg: number, inset: number): [number, number] => (bell ? coastPoint : sun ? sunPoint : amb ? amberPoint : wrackPoint)(deg, inset);
  const V = LAYOUT.village;

  // ---- the harbour's pier: walk out from the beach until the water is deep enough for the ship
  const deckY = 1.0, headWidth = 9;
  const base = bell ? LAYOUT.dockBase : sun ? SL.dockBase : amb ? AL.dockBase : WL.dockBase;
  const dock: Dock = (() => {
    const x = base.x, zs = base.z - 1.5;
    let n = 8;
    while (n < 30 && world.ground(x, zs + n + 4) > -2.2) n += 1;
    world.decks.push({ x, z: zs + n / 2, w: 2.4, d: n, y: deckY });
    world.decks.push({ x, z: zs + n + 1.0, w: headWidth, d: 2.2, y: deckY });
    return { x, zStart: zs, len: n, headWidth, deckY, headZ: zs + n };
  })();
  const mooring = { x: dock.x + 0.6, z: dock.headZ + 2.1 + 1.45 + 1.1, heading: 0 };
  const port = { name: bell ? 'Bellwether' : sun ? 'Port Halyard' : amb ? 'Tollhouse Landing' : 'Gallows Landing', ship: mooring, land: { x: dock.x, z: dock.headZ + 0.4 } };

  const buildings: Building[] = [];
  const stations: IslandLayout['stations'] = [];
  const props: Prop[] = [];
  const nodes: NodePlacement[] = [];
  const npcs: IslandLayout['npcs'] = [];
  const arenas: Arena[] = [];
  const portals: Portal[] = [];
  let uid = 0;
  const S = LAYOUT.smithy, C = LAYOUT.camp, R = LAYOUT.ruin, M = LAYOUT.peak, HW = LAYOUT.heartwood;
  const F = LAYOUT.forest, H = LAYOUT.hills, GV = LAYOUT.grove;
  const DB = LAYOUT.dockBase, X = LAYOUT.crossroads;

  if (bell) {
    buildings.push({ kind: 'smithy', x: S.x, z: S.z, rot: 0, w: 5, d: 3.6, seed: 15 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      buildings.push({ kind: 'tent', x: C.x + Math.cos(a) * 4.2, z: C.z + Math.sin(a) * 4.2, rot: -a + Math.PI / 2, w: 2.6, d: 3.0, seed: 20 + k });
    }
    stations.push(
      { id: 'furnace', x: S.x + 1.4, z: S.z - 0.6 }, { id: 'anvil', x: S.x - 1.4, z: S.z + 0.4 }, { id: 'fire', x: LAYOUT.cookfire.x, z: LAYOUT.cookfire.z }, { id: 'bench', x: S.x + 4.2, z: S.z + 1.2 },
      // outlying camps: a forge at the foot of Ironcrag, cookfires at the fen and the cove
      { id: 'furnace', x: M.x + 9, z: M.z + 19 }, { id: 'anvil', x: M.x + 6, z: M.z + 20.5 },
      { id: 'fire', x: LAYOUT.fen.x + 2.5, z: LAYOUT.fen.z + 3 }, { id: 'fire', x: LAYOUT.cove.x - 2.5, z: LAYOUT.cove.z + 1.5 },
    );
  } else if (amb) {
    // Tollhouse Landing's open-air outpost
    const LD = AL.landing;
    stations.push({ id: 'furnace', x: LD.x + 5.5, z: LD.z - 3 }, { id: 'anvil', x: LD.x + 3, z: LD.z - 5.5 }, { id: 'bench', x: LD.x - 5.5, z: LD.z - 4 },
      { id: 'fire', x: LD.x - 4, z: LD.z + 2.5 });
  } else if (wrack) {
    // Gallows Landing's open-air outpost, and the vent forge on Thunder Crag (the only heat that melts Cinderite)
    const LD = WL.landing;
    stations.push({ id: 'furnace', x: LD.x + 5.5, z: LD.z - 3 }, { id: 'anvil', x: LD.x + 3, z: LD.z - 5.5 }, { id: 'bench', x: LD.x - 5.5, z: LD.z - 4 },
      { id: 'fire', x: LD.x - 4, z: LD.z + 2.5 }, { id: 'vent', x: WL.crag.x, z: WL.crag.z - 6 });
  } else {
    // Port Halyard's open forge on its quay square, and a cookfire
    stations.push({ id: 'furnace', x: SL.port.x + 5.5, z: SL.port.z - 5 }, { id: 'anvil', x: SL.port.x + 3, z: SL.port.z - 7.5 },
      { id: 'bench', x: SL.port.x + 6.5, z: SL.port.z - 8.5 }, { id: 'fire', x: SL.port.x - 5, z: SL.port.z - 5.5 });
  }
  for (const b of buildings) if (b.kind !== 'smithy') world.solids.push({ x: b.x, z: b.z, w: b.w + 0.3, d: b.d + 0.3, rot: b.rot }); // the smithy is open-sided: its stations are the solids

  // strongboxes (the quay, the Ironcrag camp) and a counter in front of every bank's grille
  const booths = T.buildings.filter((x) => x.id === 'bank' || x.id === 'p_bank').map((bb) => { const [x, z] = toWorld(bb, 0, 0.1); return { x, z, booth: true }; });
  const banks: IslandLayout['banks'] = [...(bell ? [{ x: V.x + 4.6, z: V.z + 2.2 }, { x: M.x + 2.5, z: M.z + 21 }] : wrack ? [{ x: WL.landing.x + 1.5, z: WL.landing.z - 6.5 }] : amb ? [{ x: AL.landing.x + 1.5, z: AL.landing.z - 6.5 }] : []), ...booths];
  for (const b of banks) if (!b.booth) world.solids.push({ x: b.x, z: b.z, w: 1.2, d: 0.8 });
  const solidOf = { furnace: 1.0, anvil: 0.45, fire: 0.7, vent: 1.2 } as const;
  for (const st of stations) world.solids.push(st.id === 'bench' ? { x: st.x, z: st.z, w: 1.8, d: 0.9 } : { x: st.x, z: st.z, r: solidOf[st.id] });

  // the town: walls and furniture are solid; townsfolk stand at their posts inside
  for (const tb of T.buildings) world.solids.push(...buildingSolids(tb));
  const inside = (id: string, lx: number, lz: number) => { const tb = T.buildings.find((x) => x.id === id)!; const [x, z] = toWorld(tb, lx, lz); return { x, z, facing: Math.atan2(Math.cos(tb.rot), -Math.sin(tb.rot)) }; };
  for (const s of T.stalls) world.solids.push({ x: s.x, z: s.z, w: 2.4, d: 1.4, rot: s.rot });
  npcs.push(...T.npcs.map((n) => ({ id: n.id, ...inside(n.building, n.x, n.z) })));
  if (bell) npcs.push(
    { id: 'wynn', x: DB.x + 3.2, z: DB.z - 1.0, facing: Math.PI / 2 },
    { id: 'watch_n', x: X.x + 0.6, z: X.z - 9.5, facing: Math.PI / 2 },
    { id: 'watch_e', x: X.x + 11, z: X.z + 2.5, facing: Math.PI },
    { id: 'bram', x: S.x - 1.4, z: S.z + 1.9, facing: Math.PI / 2 },
    // the quest folk: Old Pellow at the Ironcrag camp, Muirne on the strand's rocks, Dougal mending nets nearby
    { id: 'pellow', x: M.x - 1.5, z: M.z + 23.5, facing: Math.PI / 2 },
    { id: 'muirne', x: coastPoint(136, 2.6)[0], z: coastPoint(136, 2.6)[1], facing: Math.atan2(coastPoint(136, -5)[1] - coastPoint(136, 2.6)[1], coastPoint(136, -5)[0] - coastPoint(136, 2.6)[0]) },
    { id: 'dougal', x: LAYOUT.strand.x + 7, z: LAYOUT.strand.z - 4, facing: Math.PI },
  );
  else if (sun) npcs.push(
    { id: 'halyard_watch', x: SL.plaza.x + 3, z: SL.plaza.z - 7, facing: Math.PI / 2 },
    // the quest folk (slice 2): Abena at her fruit stand, Nana Ayo by the plaza's shade tree
    { id: 'abena', x: SL.plaza.x - 5, z: SL.plaza.z + 2, facing: 0 },
    { id: 'nana_ayo', x: SL.plaza.x + 6, z: SL.plaza.z + 3, facing: Math.PI },
  );
  else if (amb) npcs.push(
    { id: 'jory', x: AL.dockBase.x + 3.2, z: AL.dockBase.z - 1.0, facing: Math.PI / 2 },
    // the quest folk (slice 3): Sigrun the skald and Ingrid the fiddler at the landing
    { id: 'sigrun', x: AL.landing.x - 5, z: AL.landing.z - 2, facing: 0 },
    { id: 'ingrid', x: AL.landing.x + 5, z: AL.landing.z - 3, facing: Math.PI },
  );
  else npcs.push({ id: 'mercy', x: WL.dockBase.x + 3.2, z: WL.dockBase.z - 1.0, facing: Math.PI / 2 });
  for (const n of npcs) world.solids.push({ x: n.x, z: n.z, r: 0.35 });

  // ---- boss arenas: a ring of broken pillars round the point that wakes the guardian, walled with fallen
  // masonry (mineable like any rock; mining only changes its look, the wall stays)
  const rubble: { x: number; z: number; rot: number; s: number; seed: number }[] = [];
  const ring = (cx: number, cz: number, gapAt: number, seedBase: number) => {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      if (k === gapAt) continue; // the "broken" gap is the way in
      const px = cx + Math.cos(a) * 7, pz = cz + Math.sin(a) * 7;
      props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.7 + rnd() * 0.6, seed: seedBase + k });
      world.solids.push({ x: px, z: pz, r: 0.75 });
      if (k === (gapAt + 8) % 9) continue;
      for (const f of [1 / 3, 2 / 3]) {
        const b = a + (f * Math.PI * 2) / 9;
        const rx = cx + Math.cos(b) * 7, rz = cz + Math.sin(b) * 7, s = 0.7 + rnd() * 0.25;
        rubble.push({ x: rx, z: rz, rot: rnd() * 6.28, s, seed: seedBase + 100 + k * 2 + Math.round(f * 3) });
        world.solids.push({ x: rx, z: rz, r: 0.95 });
      }
    }
  };
  if (bell) {
    ring(R.x, R.z, 2, 400);
    const plinth = { x: R.x, z: R.z + 4.6 }; // just inside the gap, so the arena centre stays clear
    world.solids.push({ x: plinth.x, z: plinth.z, r: 0.7 });
    arenas.push({ boss: 'guardian', x: R.x, z: R.z, r: 7, altar: plinth, label: 'Bell hollow', verb: 'Ring' });
  } else if (sun) {
    // the Sunken Temple: its gap faces the jungle trail (south); the serpent's gong stands just inside
    const TP = SL.temple;
    ring(TP.x, TP.z, 2, 700);
    const gong = { x: TP.x, z: TP.z + 4.6 };
    world.solids.push({ x: gong.x, z: gong.z, r: 0.7 });
    arenas.push({ boss: 'temple_serpent', x: TP.x, z: TP.z, r: 7, altar: gong, label: 'Temple gong', verb: 'Strike' });
  } else if (amb) {
    // Weaver Hollow: old standing stones, webbed over; the gap faces the trail from the landing (south-west)
    const HO = AL.hollow, gap = 4, ga = (gap / 9) * Math.PI * 2 + Math.PI / 9;
    ring(HO.x, HO.z, gap, 900);
    const bones = { x: HO.x + Math.cos(ga) * 4.6, z: HO.z + Math.sin(ga) * 4.6 };
    world.solids.push({ x: bones.x, z: bones.z, r: 0.7 });
    arenas.push({ boss: 'broodmother', x: HO.x, z: HO.z, r: 7, altar: bones, label: 'Web-wrapped bones', verb: 'Disturb' });
  }

  // ---- cave mouths
  for (const m of CAVE_MOUTHS.filter((c) => c.island === region)) {
    const a = m.at();
    props.push({ kind: 'cavemouth', x: a.x, z: a.z, rot: a.facing, s: 1, seed: 31 });
    world.solids.push({ x: a.x - Math.cos(a.facing) * 0.6, z: a.z - Math.sin(a.facing) * 0.6, r: 1.6 });
    portals.push({ id: m.id, x: a.x, z: a.z, to: m.cave, label: REGIONS[m.cave].name, verb: 'Enter', out: { x: a.x + Math.cos(a.facing) * 2.6, z: a.z + Math.sin(a.facing) * 2.6 } });
  }

  // ---- resource nodes
  for (const r of rubble) nodes.push({ uid: `n${uid++}`, def: 'rock_boulder', x: r.x, z: r.z, seed: r.seed, scenery: true, s: r.s, rot: r.rot });
  // inside (or within `m` of) a town building's walls, in front of its door, or on a market stall / the square
  const nearTown = (x: number, z: number, m: number, square = true) => {
    for (const tb of T.buildings) {
      const [lx, lz] = toLocal(tb, x, z);
      if (Math.abs(lx) < tb.w / 2 + m && Math.abs(lz) < tb.d / 2 + m) return true;
      const o = doorPoints(tb).out;
      if (Math.hypot(x - o[0], z - o[1]) < m + 1.6) return true;
    }
    for (const st of T.stalls) if (Math.hypot(x - st.x, z - st.z) < m + 1.6) return true;
    return square && T.squares.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + m);
  };
  const free = (x: number, z: number, minCoast = 4, clearance = 2.2) => {
    if (!world.inside(x, z, 2) || coastDist(x, z) < minCoast) return false;
    const p = nearestPathDist(x, z);
    if (p.d < p.width + 1.2) return false;
    for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 2) return false;
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) + 1.5) return false;
    if (nearTown(x, z, 2.5)) return false;
    for (const n of nodes) if (Math.hypot(x - n.x, z - n.z) < clearance) return false;
    for (const pr of props) if (Math.hypot(x - pr.x, z - pr.z) < clearance + (pr.kind === 'cavemouth' ? 3 : 0)) return false;
    for (const st of [...stations, ...banks]) if (Math.hypot(x - st.x, z - st.z) < 3.5) return false;
    for (const a of arenas) if (Math.hypot(x - a.x, z - a.z) < a.r + 3) return false;
    return true;
  };
  const scatter = (def: string, cx: number, cz: number, radius: number, count: number, clearance: number) => {
    for (let tries = 0, made = 0; tries < 400 && made < count; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!free(x, z, 5, clearance)) continue;
      if (world.ground(x, z) < 0.5) continue; // not in the lagoon
      const sx = world.ground(x + 0.6, z) - world.ground(x - 0.6, z), sz = world.ground(x, z + 0.6) - world.ground(x, z - 0.6);
      if (Math.hypot(sx, sz) > 0.9) continue;
      nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.floor(rnd() * 1e6) });
      world.solids.push({ x, z, r: def.startsWith('tree') ? 0.45 : 0.75 });
      made++;
    }
  };
  if (bell) {
    scatter('tree_pine', F.x + 4, F.z + 4, 12, 16, 3.2);
    scatter('tree_oak', GV.x, GV.z, 8, 7, 3.6);
    scatter('rock_copper', H.x - 6, H.z + 5, 6, 5, 2.4);
    scatter('rock_tin', H.x - 2, H.z + 8, 6, 5, 2.4);
    scatter('rock_iron', H.x + 3, H.z - 2, 5, 3, 2.6);
    // Mirewater Fen: sea-oaks ring the lagoon
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      scatter('tree_oak', LAGOON.x + Math.cos(a) * (LAGOON.r + 6), LAGOON.z + Math.sin(a) * (LAGOON.r + 6), 3, 1, 3.4);
    }
    // Heartwood (Bellwether is the first island, levels 1-20: Tom, 2026-10-25): sea-oaks and saltpine
    scatter('tree_oak', HW.x + 4, HW.z + 6, 10, 5, 3.6);
    scatter('tree_oak', HW.x - 6, HW.z - 4, 9, 4, 3.6);
    // Ironcrag: iron all the way up (coal starts on Sunreach)
    scatter('rock_iron', M.x - 8, M.z + 15, 7, 5, 2.6);
    scatter('rock_iron', M.x + 13, M.z + 12, 5, 3, 2.6);
    scatter('rock_iron', M.x - 6, M.z + 5, 6, 4, 2.8);
  } else if (wrack) {
    // Stormwrack (levels 55 and up): the Old Wood's ancient trees, the crag's high metals, the fallen star,
    // tidecore in the Wrack's rocks
    const OW = WL.oldwood, CR = WL.crag;
    scatter('tree_yew', OW.x + 6, OW.z + 6, 9, 4, 4);
    scatter('tree_star', OW.x - 4, OW.z - 3, 7, 3, 4.2);
    scatter('tree_cedar', OW.x - 11, OW.z + 3, 6, 2, 4.6);
    scatter('rock_abyss', CR.x - 8, CR.z + 12, 7, 4, 3);
    scatter('rock_cinder', CR.x, CR.z - 6, 9, 3, 3);
    scatter('rock_sky', WL.starfall.x, WL.starfall.z, 6, 3, 3.2);
    scatter('rock_tide', WL.wreck.x - 3, WL.wreck.z + 3, 7, 3, 3);
    // Leviathan's Rest: the bones lie along the islet's crown (no free() here: it's off the main coast)
    const IS = WL.islet;
    for (let k = 0, made = 0; k < 40 && made < 3; k++) {
      const a = k * 2.1, r = 3.5 + (k % 3) * 1.5, x = IS.x + Math.cos(a) * r, z = IS.z + Math.sin(a) * r;
      if (world.ground(x, z) < 0.6 || nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 3.2)) continue;
      nodes.push({ uid: `n${uid++}`, def: 'rock_levi', x, z, seed: 900 + k });
      world.solids.push({ x, z, r: 0.75 });
      made++;
    }
  } else if (amb) {
    // Amberhold (levels 25-50): amber and willow in the amberwood, Goldvein Hill's ores
    const AW = AL.amberwood, GH = AL.goldhill;
    scatter('tree_amber', AW.x - 3, AW.z - 3, 9, 6, 3.6);
    scatter('tree_willow', AW.x + 6, AW.z + 7, 7, 4, 3.6);
    scatter('rock_coal', GH.x - 7, GH.z + 9, 7, 5, 2.6);
    scatter('rock_gold', GH.x + 4, GH.z + 4, 6, 4, 2.8);
    scatter('rock_storm', GH.x, GH.z - 4, 6, 3, 2.8);
  } else {
    // Sunreach (levels 15-30): the Greenheart's willows and sea-oaks, Ember Hill's coal and iron
    scatter('tree_willow', SL.jungle.x, SL.jungle.z, 11, 6, 3.6);
    scatter('tree_oak', SL.jungle.x - 6, SL.jungle.z - 8, 8, 4, 3.6);
    scatter('rock_coal', SL.ember.x - 4, SL.ember.z + 8, 7, 5, 2.6);
    scatter('rock_iron', SL.ember.x + 6, SL.ember.z + 6, 5, 4, 2.8);
    scatter('rock_coal', SL.ember.x + 2, SL.ember.z - 4, 6, 3, 2.8);
  }

  // fishing: shore spots found by walking from land into water
  const shoreSpot = (fx: number, fz: number, ang: number, deep = -0.35): [number, number] | null => {
    let lastLand: [number, number] | null = null;
    for (let r = 0; r < 40; r += 0.25) {
      const x = fx + Math.cos(ang) * r, z = fz + Math.sin(ang) * r, h = world.ground(x, z);
      if (h > 0.16) lastLand = [x, z]; // walkable shore
      else if (h < deep && lastLand) {
        if (Math.hypot(x - lastLand[0], z - lastLand[1]) > 2.9) return null; // shelving shore: too far to cast
        return [x, z];
      }
    }
    return null;
  };
  const placeShore = (def: string, fx: number, fz: number, angles: number[]) => {
    for (const a of angles) {
      const p = shoreSpot(fx, fz, a);
      if (p && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 5)) nodes.push({ uid: `n${uid++}`, def, x: p[0], z: p[1], seed: Math.round(a * 100) });
    }
  };
  const sunOut = (th: number) => (th * Math.PI) / 180;
  if (bell) {
    nodes.push({ uid: `n${uid++}`, def: 'spot_sprat', x: dock.x - headWidth / 2 - 1.6, z: dock.headZ + 1.0, seed: 1 }); // off the dock head
    // lagoon: walk inward from the shore toward the centre
    const lagoonIn = (a: number) => [LAGOON.x + Math.cos(a) * (LAGOON.r + 6), LAGOON.z + Math.sin(a) * (LAGOON.r + 6), a + Math.PI] as const;
    for (const [a, def] of [[0.2, 'spot_trout'], [1.6, 'spot_trout'], [3.4, 'spot_salmon'], [4.8, 'spot_salmon']] as const) { const [fx, fz, ang] = lagoonIn(a); placeShore(def, fx, fz, [ang]); }
    for (const [def, list] of Object.entries(SEA_SPOTS)) for (const [deg, inset] of list) {
      const [x, z] = coastPoint(deg, inset);
      nodes.push({ uid: `n${uid++}`, def, x, z, seed: deg });
    }
    // the Storm Tide's shoals, either side of the pier (they only run while the storm does)
    for (const [dx, f] of [[-3.7, 0.55], [3.7, 0.6], [-3.7, 0.9]] as const) nodes.push({ uid: `n${uid++}`, def: 'spot_storm', x: dock.x + dx, z: dock.zStart + dock.len * f, seed: 70 + Math.round(f * 10) });
    // sunken wrecks to salvage from the deck (Sailing)
    for (const [deg, out] of [[140, 15], [330, 17], [245, 15]] as const) { const [x, z] = coastPoint(deg, -out); nodes.push({ uid: `n${uid++}`, def: 'wreck_salvage', x, z, seed: deg }); }
  } else if (wrack) {
    // gloomfish off the Wrack's rocks; the Drowned Spire in open water, mined from the deck; the deep-water grounds
    const wOut = Math.atan2(WL.wreck.z - WRACK.z, WL.wreck.x - WRACK.x);
    placeShore('spot_gloom', WL.wreck.x, WL.wreck.z, [wOut - 0.6, wOut + 0.6]);
    nodes.push({ uid: `n${uid++}`, def: 'rock_ori', x: WL.spire.x, z: WL.spire.z, seed: 77 });
    for (const [def, list] of Object.entries(WRACK_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
  } else if (amb) {
    // the Amber Seep's seams on Goldvein Hill's west flank (they only run while the hill is open: amberseep.ts)
    for (const [dx, dz] of [[-26, -8], [-22, -10], [-18, -8]]) nodes.push({ uid: `n${uid++}`, def: 'amber_seep', x: AL.goldhill.x + dx, z: AL.goldhill.z + dz, seed: 600 + dx });
    // lobster pots along the Ironshell Shore, swordfish out in the sound
    for (const [def, th] of [['spot_lobster', 0], ['spot_lobster', 22], ['spot_salmon', 200]] as const) {
      const [fx, fz] = amberPoint(th, 8), p = shoreSpot(fx, fz, sunOut(th));
      if (p && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 5)) nodes.push({ uid: `n${uid++}`, def, x: p[0], z: p[1], seed: th });
    }
    for (const [def, list] of Object.entries(AMBER_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
  } else {
    // the Greenheart Fire's bamboo by the fire camp (it only grows back while the fire burns: greenfire.ts)
    for (const [dx, dz] of [[-18, 13], [-19, 8], [-15, 16]]) nodes.push({ uid: `n${uid++}`, def: 'bamboo_fire', x: SL.jungle.x + dx, z: SL.jungle.z + dz, seed: 300 + dx });
    // sprat by the harbour, trout and salmon off the reef shore and the north-west rocks
    for (const [def, th] of [['spot_sprat', 120], ['spot_sprat', 150], ['spot_trout', 15], ['spot_salmon', 35], ['spot_salmon', 240]] as const) {
      const [fx, fz] = sunPoint(th, 8), p = shoreSpot(fx, fz, sunOut(th));
      if (p && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 5)) nodes.push({ uid: `n${uid++}`, def, x: p[0], z: p[1], seed: th });
    }
    for (const [def, list] of Object.entries(SUN_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
  }

  // ---- reefs / sea stacks
  const reefs: IslandLayout['reefs'] = [];
  for (let tries = 0, made = 0; tries < 600 && made < (bell ? 22 : sun ? 9 : amb ? 10 : 14); tries++) {
    const [x, z] = bell ? coastPoint(rnd() * 360, -(4 + rnd() * 26)) : cp(rnd() * 360, -(5 + rnd() * 16));
    if (Math.hypot(x - mooring.x, z - mooring.z) < (bell ? 18 : 22)) continue; // keep the harbour mouth clear
    if (nodes.some((n) => (n.def.startsWith('spot_') || n.def === 'rock_ori') && Math.hypot(n.x - x, n.z - z) < 9)) continue;
    if (bell && Math.hypot(x - LAYOUT.islet.x, z - LAYOUT.islet.z) < 24) continue; // keep the islet's landing clear
    if (sun && (x < SUN.x - SUN_RADIUS - 4 || x > SUN.x + SUN_RADIUS + 4)) continue; // both sea lanes stay open
    if (amb && (x < AMBER.x - AMBER_RADIUS - 4 || x > AMBER.x + AMBER_RADIUS + 4)) continue;
    if (wrack && x < WRACK.x - WRACK_RADIUS - 4) continue; // the western approach (from Sunreach) stays open
    if (wrack && Math.hypot(x - WRACK_LAYOUT.islet.x, z - WRACK_LAYOUT.islet.z) < 24) continue;
    if (world.ground(x, z) > -0.6) continue;
    reefs.push({ x, z, r: 0.8 + rnd() * 1.2 });
    made++;
  }
  world.reefs.push(...reefs);

  // ---- vegetation and rocks (solid, every one usable): woods are dense, open country is sparse
  const centre = bell ? { x: 0, z: 0 } : sun ? SUN : amb ? AMBER : WRACK;
  const keepClear = bell
    ? [{ x: R.x, z: R.z, r: 11 }, { x: C.x, z: C.z, r: 9 }, { x: LAYOUT.cove.x, z: LAYOUT.cove.z, r: 9 }, { x: X.x, z: X.z, r: 6 }, { x: LAYOUT.howes.x, z: LAYOUT.howes.z, r: 11 }]
    : sun ? [{ x: SL.temple.x, z: SL.temple.z, r: 11 }, { x: SL.plaza.x, z: SL.plaza.z, r: 12 }, { x: SL.port.x, z: SL.port.z, r: 16 },
      { x: SL.jungle.x - 24, z: SL.jungle.z, r: 12 }, { x: SL.jungle.x - 14, z: SL.jungle.z + 11, r: 5 }] // the Greenheart Fire's grove and camp
    : amb ? [{ x: AL.landing.x, z: AL.landing.z, r: 14 }, { x: AL.camp.x, z: AL.camp.z, r: 9 }, { x: AL.hollow.x, z: AL.hollow.z, r: 11 }, { x: AL.goldhill.x - 22, z: AL.goldhill.z - 4, r: 9 }] // the Amber Seep's ground
    : [{ x: WL.starfall.x, z: WL.starfall.z, r: 10 }, { x: WL.landing.x, z: WL.landing.z, r: 14 }, { x: WL.crag.x, z: WL.crag.z - 6, r: 7 }];
  if (bell) {
    const woods = [{ x: F.x, z: F.z, r: 20 }, { x: GV.x, z: GV.z, r: 13 }, { x: HW.x, z: HW.z, r: 20 }, { x: LAYOUT.fen.x, z: LAYOUT.fen.z, r: 16 }];
    for (let tries = 0, made = 0; tries < 9000 && made < 260; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 92;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const inWood = woods.some((w) => Math.hypot(x - w.x, z - w.z) < w.r);
      if (!inWood && rnd() < 0.6) continue;
      if (!free(x, z, BEACH + 1, 2.6)) continue; // trees stop where the sand starts
      if (keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      if (Math.hypot(x - H.x, z - H.z) < 12 && rnd() < 0.7) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 9) continue; // nothing on the bare upper peak
      const kind = inWood || rnd() < 0.6 ? 'pine' : 'broadleaf';
      // every tree on the island can be felled: pines are saltpine, broadleafs sea-oak
      nodes.push({ uid: `n${uid++}`, def: kind === 'pine' ? 'tree_pine' : 'tree_oak', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.85 + rnd() * 0.35, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
  } else if (amb) {
    // mixed woods, thickest in the amberwood; Goldvein Hill's top bare
    for (let tries = 0, made = 0; tries < 6000 && made < 120; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (AMBER_RADIUS + 6), x = AMBER.x + Math.cos(a) * r, z = AMBER.z + Math.sin(a) * r;
      const inWood = Math.hypot(x - AL.amberwood.x, z - AL.amberwood.z) < 17;
      if (!inWood && rnd() < 0.5) continue;
      if (!free(x, z, BEACH + 1, 2.6) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 7) continue;
      nodes.push({ uid: `n${uid++}`, def: rnd() < 0.55 ? 'tree_oak' : 'tree_pine', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.85 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
  } else if (wrack) {
    // a windswept island: storm-bent pines, thick only in the Old Wood, nothing on the crag's bare top
    for (let tries = 0, made = 0; tries < 6000 && made < 110; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (WRACK_RADIUS + 6), x = WRACK.x + Math.cos(a) * r, z = WRACK.z + Math.sin(a) * r;
      const inWood = Math.hypot(x - WL.oldwood.x, z - WL.oldwood.z) < 16;
      if (!inWood && rnd() < 0.55) continue;
      if (!free(x, z, BEACH + 1, 2.6) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 8) continue;
      nodes.push({ uid: `n${uid++}`, def: inWood && rnd() < 0.3 ? 'tree_oak' : 'tree_pine', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.85 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
  } else {
    // dense jungle (broadleaf sea-oak, all fellable), coconut palms round the beaches
    for (let tries = 0, made = 0; tries < 6000 && made < 150; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (SUN_RADIUS + 6), x = SUN.x + Math.cos(a) * r, z = SUN.z + Math.sin(a) * r;
      if (!free(x, z, BEACH + 1, 2.4) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 10) continue;
      if (Math.hypot(x - SL.ember.x, z - SL.ember.z) < 13 && rnd() < 0.75) continue;
      nodes.push({ uid: `n${uid++}`, def: 'tree_oak', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.9 + rnd() * 0.45, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
    for (let th = 0; th < 360; th += 11) {
      const [x, z] = sunPoint(th + rnd() * 5, 3.5 + rnd() * 4);
      if (!free(x, z, 1.5, 3) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r - 4) || world.ground(x, z) < 0.3) continue;
      nodes.push({ uid: `n${uid++}`, def: 'palm', x, z, seed: Math.floor(rnd() * 1e6), rot: rnd() * 6.28 });
      world.solids.push({ x, z, r: 0.4 });
    }
  }
  for (let tries = 0, made = 0; tries < (bell ? 2400 : 900) && made < (bell ? 80 : sun ? 22 : 40); tries++) {
    const a = rnd() * Math.PI * 2, r = bell ? 15 + rnd() * 75 : Math.sqrt(rnd()) * (sun ? SUN_RADIUS : amb ? AMBER_RADIUS : WRACK_RADIUS);
    const x = centre.x + Math.cos(a) * r, z = centre.z + Math.sin(a) * r;
    if (!free(x, z, 1, 2) || (!bell && keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r))) continue;
    const s = 0.35 + rnd() * 0.7;
    nodes.push({ uid: `n${uid++}`, def: 'rock_boulder', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s, rot: rnd() * 6.28 });
    world.solids.push({ x, z, r: Math.max(0.45, s * 0.9) });
    made++;
  }
  if (bell) {
    // bramble bushes: meadows and wood edges
    for (let tries = 0, made = 0; tries < 3000 && made < 36; tries++) {
      const a = rnd() * Math.PI * 2, r = 12 + Math.sqrt(rnd()) * 75;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!free(x, z, BEACH, 2.2) || world.ground(x, z) < 0.5 || world.ground(x, z) > 7) continue;
      if (keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      nodes.push({ uid: `n${uid++}`, def: 'bush_berry', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.8 + rnd() * 0.4, rot: rnd() * 6.28 });
      world.solids.push({ x, z, r: 0.5 });
      made++;
    }
  }
  // kelp beds just off the beaches, all the way round
  for (let deg = 0; deg < 360; deg += bell ? 9 : 10) {
    const [lx, lz] = cp(deg + rnd() * 6, 6);
    const p = shoreSpot(lx, lz, bell ? Math.atan2(lz, lx) : sunOut(deg), -0.04); // kelp likes the shallows
    if (p && Math.hypot(p[0] - mooring.x, p[1] - mooring.z) > 14 && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 6))
      nodes.push({ uid: `n${uid++}`, def: 'kelp_bed', x: p[0], z: p[1], seed: deg + (bell ? 0 : sun ? 1000 : amb ? 3000 : 2000), scenery: true, s: 0.9 + rnd() * 0.3, rot: rnd() * 6.28 });
  }
  // disturbed sand: candidate dig spots on beaches and dirt tracks (only a few are active at a time)
  const paths = PATHS.filter((pth) => pth.pts.every(([x, z]) => world.inside(x, z, 4)));
  for (let k = 0, made = 0; k < 400 && made < (bell ? 30 : 14); k++) {
    let x: number, z: number;
    if (k % 2) { const [cx, cz] = cp(rnd() * 360, 2.5 + rnd() * 3); x = cx; z = cz; }
    else { const pth = paths[Math.floor(rnd() * paths.length)]; const i = Math.floor(rnd() * (pth.pts.length - 1)); const t = rnd(); x = pth.pts[i][0] + (pth.pts[i + 1][0] - pth.pts[i][0]) * t + (rnd() - 0.5) * 3; z = pth.pts[i][1] + (pth.pts[i + 1][1] - pth.pts[i][1]) * t + (rnd() - 0.5) * 3; }
    if (world.ground(x, z) < 0.3 || Math.hypot(x - port.land.x, z - port.land.z) < 26) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 4) || props.some((p) => Math.hypot(p.x - x, p.z - z) < 2)) continue;
    nodes.push({ uid: `n${uid++}`, def: 'dig_spot', x, z, seed: k });
    made++;
  }

  // ---- set dressing: nothing may crowd a path, a door, a station, a person or anything you can use
  const clearOf = (x: number, z: number, r: number) => {
    const p = nearestPathDist(x, z);
    if (p.d < p.width + r + 0.6) return false;
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) * 0.75 + r + 1.2) return false;
    if (nearTown(x, z, r + 0.8, false)) return false;
    for (const q of [...stations, ...banks, ...npcs, ...portals]) if (Math.hypot(x - q.x, z - q.z) < r + 2.6) return false;
    for (const n of nodes) if (Math.hypot(x - n.x, z - n.z) < r + 1.6) return false;
    for (const pr of props) if (Math.hypot(x - pr.x, z - pr.z) < r + 1.0) return false;
    if (Math.hypot(x - mooring.x, z - mooring.z) < r + 6) return false;
    return true;
  };
  const decor = (kind: DecorKind, x: number, z: number, r: number, rot: number, solid: boolean, aux?: number[]) => {
    for (let k = 0; k < 8; k++) {
      const a = k * 2.4, d = k * 0.7, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; // nudge outward if crowded
      if (!clearOf(px, pz, r)) continue;
      props.push({ kind, x: px, z: pz, rot, s: 1, seed: Math.floor(rnd() * 1e6), aux });
      if (solid) world.solids.push({ x: px, z: pz, r });
      return true;
    }
    return false;
  };
  const dress = (list: [Prop['kind'], number, number][]) => {
    for (const [kind, x, z] of list) {
      props.push({ kind, x, z, rot: rnd() * 6.28, s: 1, seed: Math.floor(rnd() * 1e6) });
      world.solids.push({ x, z, r: kind === 'lantern' ? 0.2 : 0.5 });
    }
  };
  if (bell) {
    dress([
      ['crate', -2.6, DB.z - 1.8], ['crate', -2.9, DB.z - 2.7], ['barrel', 2.4, DB.z - 2.6], ['barrel', 3.0, DB.z - 2.0],
      ['lantern', 2.0, DB.z - 1.0], ['lantern', -6, V.z + 2], ['lantern', 7, V.z - 1], ['lantern', S.x + 3.2, S.z + 2.4],
      ['campfire', C.x, C.z], ['crate', C.x + 1.8, C.z - 1.5], ['barrel', C.x - 2, C.z + 1.2],
    ]);
    decor('netrack', DB.x - 6.5, DB.z - 1.5, 1.3, 0.15, true);
    // standing stones round the Howes
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4, BW = LAYOUT.howes;
      props.push({ kind: 'pillar', x: BW.x + Math.cos(a) * 10, z: BW.z + Math.sin(a) * 10, rot: a, s: 0.55 + rnd() * 0.3, seed: 1200 + k });
      world.solids.push({ x: BW.x + Math.cos(a) * 10, z: BW.z + Math.sin(a) * 10, r: 0.6 });
    }
    decor('pots', DB.x + 5.5, DB.z - 1.2, 0.8, -0.3, true);
    decor('cannon', DB.x - 9, DB.z - 3.5, 0.7, -0.2, true); // muzzles out to sea (+z)
    decor('cannon', DB.x + 9, DB.z - 3.5, 0.7, 0.2, true);
    decor('well', V.x - 6, V.z - 7, 1.0, 0.3, true);
    decor('woodpile', S.x + 4.5, S.z - 2, 0.8, -0.4, true);
    const cw = T.buildings.find((x) => x.id === 'cottage_w')!, ce = T.buildings.find((x) => x.id === 'cottage_e')!;
    decor('woodpile', ...toWorld(cw, 2.0, -3.4), 0.8, cw.rot, true);
    for (const [cx, cz, rot] of [[...toWorld(cw, 0, -6), cw.rot], [...toWorld(ce, 0, -6), ce.rot]] as const) {
      // a garden fence behind each cottage, with flowers inside it
      const bx = cx + Math.sin(rot) * 4.2, bz = cz - Math.cos(rot) * 4.2;
      decor('fence', bx, bz, 0.3, -rot, false, [4.8]);
      decor('flowers', bx + Math.cos(rot) * 1.2, bz + Math.sin(rot) * 1.2 + 1, 0.4, 0, false);
    }
    const toward = (t: { x: number; z: number }) => Math.atan2(t.z - X.z, t.x - X.x);
    decor('signpost', X.x + 2.8, X.z + 2.2, 0.25, 0, true, [toward(LAYOUT.village), toward(LAYOUT.camp), toward(LAGOON), toward(LAYOUT.ruin)]);
    const CV = LAYOUT.cove;
    decor('cannon', CV.x + 3.5, CV.z + 2.5, 0.7, Math.atan2(CV.x, CV.z), true);
    decor('cannon', CV.x - 1, CV.z + 4.5, 0.7, Math.atan2(CV.x, CV.z) + 0.3, true);
    decor('rowboat', ...coastPoint(36 + 6, 2.2), 1.2, 0.8, true);
    decor('rowboat', ...coastPoint(104, 2.4), 1.2, -0.6, true);
    decor('rowboat', ...coastPoint(150, 2.2), 1.2, 2.2, true);
    {
      const [wx, wz] = coastPoint(316, 0.8);
      if (decor('wreck', wx, wz, 2.2, Math.atan2(wz, wx) + Math.PI / 2, false)) {
        const w = props[props.length - 1];
        for (const d of [-2.6, 0, 2.6]) world.solids.push({ x: w.x + Math.cos(w.rot - Math.PI / 2) * d, z: w.z - Math.sin(w.rot - Math.PI / 2) * d, r: 1.1 });
      }
    }
    // beachcombing: driftwood and shells all round the shore
    for (let k = 0; k < 26; k++) { const th = k * 13.8 + rnd() * 6, [x, z] = coastPoint(th, 2.5 + rnd() * 5); if (Math.hypot(x - V.x, z - V.z) > 22) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
    for (let k = 0; k < 34; k++) { const th = k * 10.6 + rnd() * 5, [x, z] = coastPoint(th, 1 + rnd() * 6); if (Math.hypot(x - V.x, z - V.z) > 18) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    // salt pans on the beaches (sea salt flux for Tidecore and Leviathite)
    for (let th = 7, made = 0; th < 367 && made < 7; th += 9) {
      const [x, z] = coastPoint(th, 4.5);
      if (!clearOf(x, z, 1.2) || nodes.some((n) => n.def === 'salt_pan' && Math.hypot(n.x - x, n.z - z) < 30)) continue;
      nodes.push({ uid: `n${uid++}`, def: 'salt_pan', x, z, seed: th });
      world.solids.push({ x, z, r: 1.0 });
      made++;
    }
    for (let k = 0, made = 0; k < 200 && made < 30; k++) {
      const a = rnd() * Math.PI * 2, r = 10 + rnd() * 55, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (coastDist(x, z) < BEACH + 2 || world.ground(x, z) > 6) continue;
      if (decor('flowers', x, z, 0.4, 0, false)) made++;
    }
  } else if (amb) {
    const D = AL.dockBase, LD = AL.landing;
    dress([['crate', D.x - 2.6, D.z - 1.8], ['barrel', D.x + 2.6, D.z - 2.4], ['lantern', D.x + 2, D.z - 1.0], ['lantern', LD.x - 3, LD.z + 4], ['lantern', LD.x + 4, LD.z - 7], ['crate', LD.x - 7, LD.z - 6], ['barrel', LD.x + 7.5, LD.z + 1],
      ['campfire', AL.camp.x, AL.camp.z], ['crate', AL.camp.x + 2, AL.camp.z - 1.5], ['barrel', AL.camp.x - 2, AL.camp.z + 1.2]]);
    decor('netrack', D.x - 7, D.z - 1.5, 1.3, -0.1, true);
    decor('pots', D.x + 6, D.z - 1.2, 0.8, 0.3, true);
    decor('woodpile', AL.amberwood.x + 9, AL.amberwood.z + 9, 0.8, 0.4, true);
    for (let k = 0; k < 14; k++) { const [x, z] = amberPoint(k * 25.7 + rnd() * 8, 1.5 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 20) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    for (let k = 0; k < 10; k++) { const [x, z] = amberPoint(k * 36 + 12 + rnd() * 8, 2.5 + rnd() * 4); if (Math.hypot(x - D.x, z - D.z) > 20) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
  } else if (wrack) {
    const D = WL.dockBase, LD = WL.landing;
    dress([['crate', D.x - 2.6, D.z - 1.8], ['barrel', D.x + 2.6, D.z - 2.4], ['lantern', D.x + 2, D.z - 1.0], ['lantern', LD.x - 3, LD.z + 4], ['lantern', LD.x + 4, LD.z - 7], ['crate', LD.x - 7, LD.z - 6], ['barrel', LD.x + 7.5, LD.z + 1]]);
    decor('netrack', D.x - 7, D.z - 1.5, 1.3, -0.1, true);
    {
      // the Wrack's namesake: a ship broken on the point
      const [wx, wz] = wrackPoint(316, 0.8);
      if (decor('wreck', wx, wz, 2.2, Math.atan2(wz - WRACK.z, wx - WRACK.x) + Math.PI / 2, false)) {
        const w = props[props.length - 1];
        for (const d of [-2.6, 0, 2.6]) world.solids.push({ x: w.x + Math.cos(w.rot - Math.PI / 2) * d, z: w.z - Math.sin(w.rot - Math.PI / 2) * d, r: 1.1 });
      }
    }
    // the leviathan's skeleton (the bones you mine are the loose ones) and the star's scorched crater
    props.push({ kind: 'leviathan', x: WL.islet.x, z: WL.islet.z, rot: 0.6, s: 1, seed: 5 });
    world.solids.push({ x: WL.islet.x, z: WL.islet.z, r: 1.4 });
    props.push({ kind: 'crater', x: WL.starfall.x, z: WL.starfall.z, rot: 0, s: 1, seed: 6 });
    for (let k = 0; k < 16; k++) { const [x, z] = wrackPoint(k * 22.5 + rnd() * 8, 2 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 20) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
    for (let k = 0; k < 10; k++) { const [x, z] = wrackPoint(k * 36 + rnd() * 8, 1.5 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 20) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
  } else {
    const P = SL.port;
    dress([['crate', P.x - 2.6, SL.dockBase.z - 1.8], ['barrel', P.x + 2.6, SL.dockBase.z - 2.4], ['lantern', P.x + 2, SL.dockBase.z - 1.0], ['lantern', SL.plaza.x - 4, SL.plaza.z + 3]]);
    decor('netrack', SL.dockBase.x - 7, SL.dockBase.z - 1.5, 1.3, -0.1, true);
    decor('pots', SL.dockBase.x + 6, SL.dockBase.z - 1.2, 0.8, 0.3, true);
    for (let k = 0; k < 14; k++) { const [x, z] = sunPoint(k * 25.7 + rnd() * 8, 1.5 + rnd() * 5); if (Math.hypot(x - P.x, z - P.z) > 24) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    for (let k = 0; k < 10; k++) { const [x, z] = sunPoint(k * 36 + 12 + rnd() * 8, 2.5 + rnd() * 4); if (Math.hypot(x - P.x, z - P.z) > 24) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
  }

  world.bake();
  // a tree or rock nobody can stand beside would be the one thing on the island you can't use: leave it out
  const unreachable = nodes.filter((n) => n.scenery && !world.nearestWalkable(n.x, n.z, n.def === 'kelp_bed' ? 3.1 : 1.6));
  if (unreachable.length) {
    const gone = new Set(unreachable);
    for (let i = nodes.length - 1; i >= 0; i--) if (gone.has(nodes[i])) nodes.splice(i, 1);
    // and its collision with it, so no invisible wall is left behind
    for (let i = world.solids.length - 1; i >= 0; i--) { const so = world.solids[i]; if (unreachable.some((n) => n.x === so.x && n.z === so.z)) world.solids.splice(i, 1); }
    world.bake();
  }

  // ---- enemies, zone by zone (snapped to walkable ground)
  const spawns: SpawnPoint[] = [];
  const spawn = (enemy: string, x: number, z: number) => { const q = world.nearestWalkable(x, z, 5); if (q) spawns.push({ enemy, x: q[0], z: q[1] }); };
  if (bell) {
    for (let k = 0; k < 6; k++) { const [x, z] = coastPoint(118 + k * 9, 3 + (k % 2) * 2.5); spawn('reef_crab', x, z); }
    for (let k = 0; k < 3; k++) { const [x, z] = coastPoint(62 + k * 8, 3.5); spawn('reef_crab', x, z); }
    spawn('brigand', C.x - 2.5, C.z + 2); spawn('brigand', C.x + 2.5, C.z + 1.5); spawn('brigand', C.x, C.z - 2.5);
    spawn('gunner', C.x + 4, C.z - 3); spawn('gunner', C.x - 5, C.z - 1);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.7; spawn('mire_crab', LAGOON.x + Math.cos(a) * (LAGOON.r + 2.5), LAGOON.z + Math.sin(a) * (LAGOON.r + 2.5)); }
    // bog leeches in the fen's shallows; beetles on the strand; spriggans in the oak grove; knockers in Ironcrag
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.2; spawn('bog_leech', LAGOON.x + Math.cos(a) * (LAGOON.r + 4), LAGOON.z + Math.sin(a) * (LAGOON.r + 4)); }
    for (let k = 0; k < 4; k++) { const [x, z] = coastPoint(150 + k * 8, 3.5); spawn('shore_beetle', x, z); }
    for (const [dx, dz] of [[-8, -3], [-6, -9], [-12, 2]]) spawn('spriggan', GV.x + dx, GV.z + dz); // the grove's far side, away from Saltpine Wood
    for (const [dx, dz] of [[-7, 10], [6, 12], [-3, 2]]) spawn('knocker', M.x + dx, M.z + dz);
    // the Howes: the haugbui keep their grave goods
    const BW = LAYOUT.howes;
    for (const [dx, dz] of [[-6, 1], [6, 0], [-2, -6], [3, 8]]) spawn('haugbui', BW.x + dx, BW.z + dz);
    const SC = LAYOUT.cove;
    spawn('smuggler', SC.x - 3, SC.z - 2); spawn('smuggler', SC.x + 2, SC.z - 4); spawn('smuggler', SC.x - 5, SC.z - 6);
    spawn('smuggler_gunner', SC.x + 4, SC.z - 1); spawn('smuggler_gunner', SC.x - 1, SC.z - 8);
    // Wreckers' Point: gulls over the wreck, beetles picking at it
    const W = LAYOUT.wreck;
    for (const [dx, dz] of [[-4, 2], [2, 4], [-6, 7]]) spawn('gull', W.x + dx, W.z + dz);
    for (const [dx, dz] of [[3, 9], [-8, 3]]) spawn('shore_beetle', W.x + dx, W.z + dz);
  } else if (wrack) {
    const W = WL.wreck, CR = WL.crag, OW = WL.oldwood;
    spawn('drowned', W.x - 4, W.z + 2); spawn('drowned', W.x + 2, W.z + 4); spawn('sea_draugr', W.x - 8, W.z + 6); spawn('sea_draugr', W.x - 2, W.z + 9);
    spawn('wreck_captain', W.x - 5, W.z + 5);
    spawn('stone_sentinel', CR.x - 5, CR.z + 2); spawn('stone_sentinel', CR.x + 7, CR.z + 3);
    spawn('crag_troll', CR.x - 9, CR.z - 4); spawn('crag_troll', CR.x + 9, CR.z - 6);
    // the Old Wood's own: oakhearts, and a sea-draugr walked up from the Wrack (islands past 50 mix their levels)
    spawn('oakheart', OW.x + 2, OW.z + 4); spawn('oakheart', OW.x - 6, OW.z - 2); spawn('sea_draugr', OW.x + 6, OW.z - 5);
  } else if (amb) {
    // boars at the amberwood's edge, ironshells on the shore, poachers on the headland, weavers in the hollow
    const AW = AL.amberwood, CP = AL.camp, HO = AL.hollow;
    for (const [dx, dz] of [[10, 8], [4, 12]]) spawn('boar', AW.x + dx, AW.z + dz);
    // the amberwood's own (slice 3): hornets from the hives, bark beetles chewing the amber trees, wargs on the prowl
    for (const [dx, dz] of [[-6, -8], [-10, 2], [2, -14]]) spawn('amber_hornet', AW.x + dx, AW.z + dz);
    for (const [dx, dz] of [[-14, 8], [6, -4]]) spawn('bark_beetle', AW.x + dx, AW.z + dz);
    for (const [dx, dz] of [[12, -6], [-18, -6]]) spawn('warg', AW.x + dx, AW.z + dz);
    // nøkk in the pools behind the Ironshell Shore
    { const IS = AL.ironshore, k = 0.22; for (const o of [-4, 4]) spawn('nokk', IS.x + (AMBER.x - IS.x) * k + o, IS.z + (AMBER.z - IS.z) * k - o); }
    // Goldvein Hill: moss trolls on its flanks, and the barrow dead walking out of the hill
    for (const [dx, dz] of [[-6, 6], [8, 2]]) spawn('moss_troll', AL.goldhill.x + dx, AL.goldhill.z + dz);
    for (const [dx, dz] of [[-2, -6], [5, -9]]) spawn('barrow_draugr', AL.goldhill.x + dx, AL.goldhill.z + dz);
    spawn('draugr_troll', AL.goldhill.x + 1, AL.goldhill.z - 12);
    for (let k = 0; k < 4; k++) { const [x, z] = amberPoint(-4 + k * 10, 3.5); spawn('ironshell_crab', x, z); }
    spawn('poacher', CP.x - 3, CP.z + 2); spawn('poacher', CP.x + 3, CP.z + 1.5); spawn('poacher', CP.x, CP.z - 3);
    spawn('poacher_gunner', CP.x + 5, CP.z - 3); spawn('poacher_gunner', CP.x - 5, CP.z - 1);
    for (const [dx, dz] of [[-13, -6], [2, -13], [12, 8]]) spawn('giant_spider', HO.x + dx, HO.z + dz); // round the hollow's rim
  } else {
    // boars root along the jungle's edge, snakes coil in the Greenheart, mire crabs work the reef shore
    for (const [dx, dz] of [[-30, 0], [-26, 12], [-20, -14], [-34, -10], [-10, -30]]) spawn('boar', SUN.x + dx, SUN.z + dz); // the jungle's west edge, away from town
    for (const [dx, dz] of [[-4, 2], [-10, -10], [-18, -6], [2, -12]]) spawn('jungle_snake', SL.jungle.x + dx, SL.jungle.z + dz);
    for (let k = 0; k < 4; k++) { const [x, z] = sunPoint(8 + k * 11, 3.5); spawn('mire_crab', x, z); }
    // the Greenheart's own (docs/ISLANDS.md slice 2): a leafcutter column on the path in, mantises in the trees,
    // and douen deeper in, where the backward tracks start
    for (let k = 0; k < 5; k++) spawn('leafcutter_ant', SUN.x + (SL.jungle.x - SUN.x) * (0.45 + k * 0.08), SUN.z + (SL.jungle.z - SUN.z) * (0.45 + k * 0.08) + (k % 2 ? 1.2 : -1.2));
    for (const [dx, dz] of [[10, 6], [-6, 12], [12, -10]]) spawn('jungle_mantis', SL.jungle.x + dx, SL.jungle.z + dz);
    for (const [dx, dz] of [[8, -4], [-12, 4], [-2, -18]]) spawn('douen', SL.jungle.x + dx, SL.jungle.z + dz);
  }

  // townsfolk walking their rounds between the squares and front doors (paths found once, on the baked grid)
  const door = (id: string) => doorPoints(T.buildings.find((b) => b.id === id)!).out;
  const P = SL.plaza;
  const rounds: { look: string; stops: [number, number][] }[] = wrack || amb ? [] : bell ? [
    { look: 'towns_a', stops: [[X.x - 4, X.z + 2], door('inn'), [X.x - 22, X.z + 1], door('house_2'), [X.x - 6, X.z + 8]] },
    { look: 'towns_b', stops: [[X.x + 4, X.z - 2], door('bank'), door('chapel'), [X.x + 25, X.z + 1], door('house_3')] },
    { look: 'towns_c', stops: [[V.x + 2, V.z + 1], door('chart'), [V.x + 2, V.z - 10], [X.x + 1.5, X.z + 6], door('store')] },
    { look: 'towns_d', stops: [[V.x - 3, V.z + 9], door('tackle'), door('warehouse'), [V.x - 14, V.z + 1.6], [DB.x - 2, DB.z - 2]] },
    { look: 'towns_e', stops: [door('hall'), door('house_4'), [X.x + 3, X.z - 12], door('house_1'), door('house_5')] },
  ] : [
    { look: 'towns_b', stops: [[P.x - 3, P.z + 3], door('p_inn'), door('p_house_2'), [P.x + 2, P.z - 4], door('p_bank')] },
    { look: 'towns_d', stops: [[SL.port.x + 2, SL.port.z + 3], door('p_trader'), door('p_warehouse'), [SL.dockBase.x - 2, SL.dockBase.z - 2], door('p_harbour')] },
  ];
  const wanderers: IslandLayout['wanderers'] = [];
  for (const rd of rounds) {
    const path: [number, number][] = [];
    for (let i = 0; i < rd.stops.length; i++) {
      const a = rd.stops[i], b = rd.stops[(i + 1) % rd.stops.length];
      const leg = world.findPath(a[0], a[1], b[0], b[1]);
      if (leg) path.push(...leg);
    }
    if (path.length > 4) wanderers.push({ look: rd.look, path });
  }

  const home = bell ? { x: 0, z: V.z + 6 } : sun ? { x: P.x, z: P.z + 2 } : amb ? { x: AL.landing.x, z: AL.landing.z + 2 } : { x: WL.landing.x, z: WL.landing.z + 2 };
  const respawnPt = world.nearestWalkable(home.x, home.z, 6) ?? [home.x, home.z];
  return {
    region, world, dock, port, mooring, buildings, nodes, props, reefs, stations, banks,
    town: T.buildings, stalls: T.stalls, wanderers, npcs, spawns, arenas, portals,
    respawn: { x: respawnPt[0], z: respawnPt[1] },
  };
}

// ---------------------------------------------------------------- caves
function buildCave(region: RegionId): IslandLayout {
  const shape = CAVES[region]!, b = REGIONS[region].bounds;
  const rnd = mulberry32(region === 'smugglers_caves' ? 31 : 37);
  const world = new World(b, caveHeight(region));
  world.walkMaxH = CAVE_WALK_MAX;
  const props: Prop[] = [], nodes: NodePlacement[] = [], spawns: SpawnPoint[] = [], stations: IslandLayout['stations'] = [];
  let uid = 0;
  const ch = (id: string) => chamberAt(region, id);
  const open = (x: number, z: number) => caveOpen(shape, x - b.cx, z - b.cz);

  // the way out: a rope up into daylight in the mouth chamber
  const mouth = ch('mouth');
  const island = REGIONS[region].home;
  const back = CAVE_MOUTHS.find((m) => m.cave === region)!;
  props.push({ kind: 'rope', x: mouth.x, z: mouth.z + 2, rot: 0, s: 1, seed: 3 });
  world.solids.push({ x: mouth.x, z: mouth.z + 2, r: 0.5 });
  const portals: Portal[] = [{ id: `${back.id}_up`, x: mouth.x, z: mouth.z + 2, to: island, label: 'Rope to the surface', verb: 'Climb', out: { x: mouth.x, z: mouth.z - 1.5 } }];

  // anything placed must stand on open floor, clear of what's already there
  const clear = (x: number, z: number, r: number) => open(x, z) > r + 0.6 && !nodes.some((n) => Math.hypot(n.x - x, n.z - z) < r + 1.6) && !props.some((p) => Math.hypot(p.x - x, p.z - z) < r + 1.2) && Math.hypot(x - mouth.x, z - mouth.z - 2) > 3.5;
  const scatter = (def: string, at: { x: number; z: number; r: number }, count: number) => {
    for (let tries = 0, made = 0; tries < 300 && made < count; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * at.r, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
      if (!clear(x, z, 0.8)) continue;
      nodes.push({ uid: `c${uid++}`, def, x, z, seed: Math.floor(rnd() * 1e6) });
      world.solids.push({ x, z, r: 0.75 });
      made++;
    }
  };
  const put = (kind: Prop['kind'], x: number, z: number, r: number, solid: boolean, s = 1) => {
    if (!clear(x, z, r)) return false;
    props.push({ kind, x, z, rot: rnd() * 6.28, s, seed: Math.floor(rnd() * 1e6) });
    if (solid) world.solids.push({ x, z, r });
    return true;
  };
  // torches along the walls of every chamber and tunnel bend: the only light down here
  for (const c of shape.chambers) {
    const at = ch(c.id);
    for (let k = 0; k < (c.id === 'mouth' ? 1 : 3); k++) {
      const a = (k / 3) * Math.PI * 2 + rnd();
      for (let r = at.r - 1.2; r > at.r - 3.5; r -= 0.4) if (put('torch', at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 0.3, true)) break;
    }
    // stalagmites and loose rock round the edges
    for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, r = at.r - 1 - rnd() * 1.5; put('stalagmite', at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 0.5, true, 0.6 + rnd() * 0.7); }
  }

  if (region === 'smugglers_caves') {
    const hold = ch('hold'), grotto = ch('grotto'), pool = ch('pool'), hall = ch('hall');
    // the smugglers' stash: crates and barrels, a cookfire, a strongbox they don't know you can open
    for (let k = 0; k < 7; k++) { const a = rnd() * 6.28, r = 3 + rnd() * 4; put(k % 2 ? 'crate' : 'barrel', hold.x + Math.cos(a) * r, hold.z + Math.sin(a) * r, 0.5, true); }
    stations.push({ id: 'fire', x: hold.x + 1, z: hold.z + 1 });
    world.solids.push({ x: hold.x + 1, z: hold.z + 1, r: 0.7 });
    spawns.push({ enemy: 'smuggler', x: hold.x - 3, z: hold.z - 2 }, { enemy: 'smuggler', x: hold.x + 3, z: hold.z - 3 }, { enemy: 'smuggler_gunner', x: hold.x - 1, z: hold.z + 4 });
    // Glimmer Grotto: crystals light it; iron veins
    scatter('rock_iron', grotto, 7); scatter('rock_tin', hall, 3); scatter('rock_copper', hall, 3);
    for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, r = 2 + rnd() * (grotto.r - 3); put('crystal', grotto.x + Math.cos(a) * r, grotto.z + Math.sin(a) * r, 0.5, true, 0.7 + rnd() * 0.6); }
    // the Drip Pool: cave spiders under the webs
    for (let k = 0; k < 5; k++) { const a = rnd() * 6.28, r = 2 + rnd() * (pool.r - 3); put('web', pool.x + Math.cos(a) * r, pool.z + Math.sin(a) * r, 0.9, false, 0.8 + rnd() * 0.5); }
    for (const [dx, dz] of [[-3, 2], [3, -2], [0, -5], [4, 3]]) spawns.push({ enemy: 'cave_spider', x: pool.x + dx, z: pool.z + dz });
    spawns.push({ enemy: 'cave_spider', x: hall.x - 6, z: hall.z - 6 });
    for (const [dx, dz] of [[3, 3], [-3, 4], [5, -2]]) spawns.push({ enemy: 'cave_bat', x: hall.x + dx, z: hall.z + dz });
    for (const [dx, dz] of [[-3, 3], [3, -2]]) spawns.push({ enemy: 'knocker', x: grotto.x + dx, z: grotto.z + dz }); // tapping at the veins
  } else {
    const hall = ch('hall'), nest = ch('nest'), vein = ch('vein'), magma = ch('magma');
    scatter('rock_coal', hall, 5); scatter('rock_iron', hall, 3);
    scatter('rock_coal', vein, 4); scatter('rock_iron', vein, 3);
    for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, r = 2 + rnd() * (vein.r - 3); put('crystal', vein.x + Math.cos(a) * r, vein.z + Math.sin(a) * r, 0.5, true, 0.8 + rnd() * 0.6); }
    // the Weaver's Nest: webs everywhere, the giant weavers' young
    for (let k = 0; k < 9; k++) { const a = rnd() * 6.28, r = 1.5 + rnd() * (nest.r - 2.5); put('web', nest.x + Math.cos(a) * r, nest.z + Math.sin(a) * r, 0.9, false, 0.9 + rnd() * 0.6); }
    for (const [dx, dz] of [[-3, 2], [3, -3], [0, 4], [-4, -4], [5, 2]]) spawns.push({ enemy: 'weaver_young', x: nest.x + dx, z: nest.z + dz });
    // the Magma Pool: lava you can't cross, a vent forge, ember asps
    props.push({ kind: 'lava', x: magma.x + 2, z: magma.z - 3, rot: 0, s: 3.2, seed: 9 });
    world.solids.push({ x: magma.x + 2, z: magma.z - 3, r: 3.4 });
    stations.push({ id: 'vent', x: magma.x - 4.5, z: magma.z + 4 });
    world.solids.push({ x: magma.x - 4.5, z: magma.z + 4, r: 1.2 });
    for (const [dx, dz] of [[4, 4], [-5, -2], [6, -6]]) spawns.push({ enemy: 'ember_snake', x: magma.x + dx, z: magma.z + dz });
    spawns.push({ enemy: 'weaver_young', x: hall.x - 7, z: hall.z - 4 });
    for (const [dx, dz] of [[3, 3], [-2, 5], [4, -3]]) spawns.push({ enemy: 'ember_bat', x: vein.x + dx, z: vein.z + dz });
    // giant centipedes in the hall's warm cracks
    for (const [dx, dz] of [[5, 4], [-5, 5], [6, -4]]) spawns.push({ enemy: 'giant_centipede', x: hall.x + dx, z: hall.z + dz });
  }

  world.bake();
  for (const s of spawns) { const q = world.nearestWalkable(s.x, s.z, 5); if (q) [s.x, s.z] = q; }
  const out = world.nearestWalkable(portals[0].out.x, portals[0].out.z, 3);
  if (out) portals[0].out = { x: out[0], z: out[1] };
  return {
    region, world, dock: null, port: null, mooring: null, buildings: [], nodes, props, reefs: [], stations, banks: [],
    town: [], stalls: [], wanderers: [], npcs: [], spawns: spawns.filter((s) => world.walkable(s.x, s.z)), arenas: [], portals,
    respawn: portals[0].out,
  };
}
