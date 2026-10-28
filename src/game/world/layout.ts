import { mulberry32 } from '../../art/noise';
import { DOORS } from '../data/doors';
import type { ShardKey, Station } from '../data/content';
import { BELL_TOWN, BELL_ROUNDS, BELL_OUTDOOR, flatsAt, PORT_TOWN, LAYOUT, LAGOON, SEA_SPOTS, PATHS, BEACH, coastPoint, coastDist, nearestPathDist, FLATS, SUN, SUN_LAYOUT, SUN_RADIUS, SUN_SEA_SPOTS, sunPoint, WRACK, WRACK_LAYOUT, WRACK_RADIUS, WRACK_SEA_SPOTS, wrackPoint, AMBER, AMBER_LAYOUT, AMBER_RADIUS, AMBER_SEA_SPOTS, amberPoint, LOCK, LOCK_LAYOUT, LOCK_RADIUS, LOCK_SEA_SPOTS, lockPoint, SALT, SALT_LAYOUT, SALT_RADIUS, SALT_SEA_SPOTS, MIRROR_POOL, saltPoint, LONG, LONG_LAYOUT, LONG_RADIUS, LONG_SEA_SPOTS, longPoint, rawHeight } from './island';
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
  stations: { id: Station; x: number; z: number }[];
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
  const bell = region === 'bellwether', sun = region === 'sunreach', amb = region === 'amberhold', wrack = region === 'wrack', lock = region === 'lockhaven', salt = region === 'saltglass', long = region === 'longstrand';
  const rndSeed = bell ? 1 : sun ? 2 : wrack ? 3 : lock ? 5 : salt ? 6 : long ? 7 : 4, rnd = mulberry32(rndSeed);
  const world = new World(REGIONS[region].bounds, rawHeight);
  const T: TownPlan = bell ? BELL_TOWN : sun ? PORT_TOWN : NO_TOWN;
  const SL = SUN_LAYOUT, WL = WRACK_LAYOUT, AL = AMBER_LAYOUT, KL = LOCK_LAYOUT, GL = SALT_LAYOUT, NL = LONG_LAYOUT;
  /** a point `inset` metres inside this island's coast at angle `deg` (negative: out at sea) */
  const cp = (deg: number, inset: number): [number, number] => (bell ? coastPoint : sun ? sunPoint : amb ? amberPoint : lock ? lockPoint : salt ? saltPoint : long ? longPoint : wrackPoint)(deg, inset);
  const V = LAYOUT.village;

  // ---- the harbour's pier: walk out from the beach until the water is deep enough for the ship
  const deckY = 1.0, headWidth = 9;
  const base = bell ? LAYOUT.dockBase : sun ? SL.dockBase : amb ? AL.dockBase : lock ? KL.dockBase : salt ? GL.dockBase : long ? NL.dockBase : WL.dockBase;
  const dock: Dock = (() => {
    const x = base.x, zs = base.z - 1.5;
    let n = 8;
    while (n < 30 && world.ground(x, zs + n + 4) > -2.2) n += 1;
    world.decks.push({ x, z: zs + n / 2, w: 2.4, d: n, y: deckY });
    world.decks.push({ x, z: zs + n + 1.0, w: headWidth, d: 2.2, y: deckY });
    return { x, zStart: zs, len: n, headWidth, deckY, headZ: zs + n };
  })();
  const mooring = { x: dock.x + 0.6, z: dock.headZ + 2.1 + 1.45 + 1.1, heading: 0 };
  const port = { name: bell ? 'Bellwether' : sun ? 'Port Halyard' : amb ? 'Tollhouse Landing' : lock ? 'the Warden\'s Stair' : salt ? 'Glasswater Steps' : long ? 'Weir Landing' : 'Gallows Landing', ship: mooring, land: { x: dock.x, z: dock.headZ + 0.4 } };

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
      // the towns: Copperback's open forge on its square, cookfires on the greens at Saltpine, Mirewater and Gullhaven
      { id: 'furnace', x: LAYOUT.copperback.x + 5.5, z: LAYOUT.copperback.z + 2 }, { id: 'anvil', x: LAYOUT.copperback.x + 5.5, z: LAYOUT.copperback.z - 2.2 },
      { id: 'fire', x: LAYOUT.saltpine.x + 2.5, z: LAYOUT.saltpine.z + 2.5 }, { id: 'bench', x: LAYOUT.saltpine.x - 3, z: LAYOUT.saltpine.z - 3 },
      { id: 'fire', x: LAYOUT.mirewater.x, z: LAYOUT.mirewater.z + 1.5 },
      { id: 'fire', x: LAYOUT.gullhaven.x + 2, z: LAYOUT.gullhaven.z + 2.5 },
    );
  } else if (amb) {
    // Tollhouse Landing's open-air outpost
    const LD = AL.landing;
    stations.push({ id: 'furnace', x: LD.x + 5.5, z: LD.z - 3 }, { id: 'anvil', x: LD.x + 3, z: LD.z - 5.5 }, { id: 'bench', x: LD.x - 5.5, z: LD.z - 4 },
      { id: 'fire', x: LD.x - 4, z: LD.z + 2.5 });
  } else if (long) {
    // Weir Landing: the last of the strand's fishers keep a fire and a forge going
    const LD = NL.landing;
    stations.push({ id: 'furnace', x: LD.x + 5.5, z: LD.z - 3 }, { id: 'anvil', x: LD.x + 3, z: LD.z - 5.5 }, { id: 'bench', x: LD.x - 5.5, z: LD.z - 4 },
      { id: 'fire', x: LD.x - 4, z: LD.z + 2.5 });
  } else if (salt) {
    // Glasswater Steps: Sunniva keeps a forge hot for her glass; it does for bars too
    const LD = GL.landing;
    stations.push({ id: 'furnace', x: LD.x + 5.5, z: LD.z - 3 }, { id: 'anvil', x: LD.x + 3, z: LD.z - 5.5 }, { id: 'bench', x: LD.x - 5.5, z: LD.z - 4 },
      { id: 'fire', x: LD.x - 4, z: LD.z + 2.5 });
  } else if (lock) {
    // the Warden's Stair: Orla Fane keeps a forge and a fire going for whoever lands; the old forges are ruins
    const LD = KL.landing;
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
  const booths = T.buildings.filter((x) => x.furniture.some((f) => f.kind === 'grille')).map((bb) => { const [x, z] = toWorld(bb, 0, 0.1); return { x, z, booth: true }; });
  const banks: IslandLayout['banks'] = [...(bell ? [{ x: V.x + 4.6, z: V.z + 2.2 }, { x: M.x + 2.5, z: M.z + 21 }, { x: LAYOUT.saltpine.x + 4, z: LAYOUT.saltpine.z - 3.5 }, { x: LAYOUT.gullhaven.x - 3.5, z: LAYOUT.gullhaven.z - 3 }] : wrack ? [{ x: WL.landing.x + 1.5, z: WL.landing.z - 6.5 }] : lock ? [{ x: KL.landing.x + 1.5, z: KL.landing.z - 6.5 }] : salt ? [{ x: GL.landing.x + 1.5, z: GL.landing.z - 6.5 }] : long ? [{ x: NL.landing.x + 1.5, z: NL.landing.z - 6.5 }] : amb ? [{ x: AL.landing.x + 1.5, z: AL.landing.z - 6.5 }] : []), ...booths];
  for (const b of banks) if (!b.booth) world.solids.push({ x: b.x, z: b.z, w: 1.2, d: 0.8 });
  const solidOf: Record<string, number> = { furnace: 1.0, anvil: 0.45, fire: 0.7, vent: 1.2 };
  for (const st of stations) world.solids.push(st.id === 'bench' ? { x: st.x, z: st.z, w: 1.8, d: 0.9 } : { x: st.x, z: st.z, r: solidOf[st.id] });

  // the town: walls and furniture are solid; townsfolk stand at their posts inside
  for (const tb of T.buildings) world.solids.push(...buildingSolids(tb));
  const inside = (id: string, lx: number, lz: number) => { const tb = T.buildings.find((x) => x.id === id)!; const [x, z] = toWorld(tb, lx, lz); return { x, z, facing: Math.atan2(Math.cos(tb.rot), -Math.sin(tb.rot)) }; };
  for (const s of T.stalls) world.solids.push({ x: s.x, z: s.z, w: 2.4, d: 1.4, rot: s.rot });
  npcs.push(...T.npcs.map((n) => ({ id: n.id, ...inside(n.building, n.x, n.z) })));
  if (bell) npcs.push(
    ...BELL_OUTDOOR,
    { id: 'wynn', x: DB.x + 3.2, z: DB.z - 1.0, facing: Math.PI / 2 },
    { id: 'wat', x: LAYOUT.pithead.x - 2.5, z: LAYOUT.pithead.z + 3, facing: Math.PI / 2 },
    { id: 'watch_n', x: X.x + 0.6, z: X.z - 9.5, facing: Math.PI / 2 },
    { id: 'watch_e', x: X.x + 11, z: X.z + 2.5, facing: Math.PI },
    { id: 'bram', x: S.x - 1.4, z: S.z + 1.9, facing: Math.PI / 2 },
    // the quest folk: Old Pellow at the Ironcrag camp, Muirne on the strand's rocks, Dougal mending nets nearby
    { id: 'pellow', x: M.x - 1.5, z: M.z + 23.5, facing: Math.PI / 2 },
    { id: 'muirne', x: coastPoint(136, 2.6)[0], z: coastPoint(136, 2.6)[1], facing: Math.atan2(coastPoint(136, -5)[1] - coastPoint(136, 2.6)[1], coastPoint(136, -5)[0] - coastPoint(136, 2.6)[0]) },
    { id: 'dougal', x: LAYOUT.strand.x + 7, z: LAYOUT.strand.z - 4, facing: Math.PI },
    { id: 'gull', x: LAYOUT.wreck.x - 9, z: LAYOUT.wreck.z + 6, facing: Math.PI }, // Bastian Gull, watching the place ships die
  );
  else if (sun) npcs.push(
    { id: 'halyard_watch', x: SL.plaza.x + 3, z: SL.plaza.z - 7, facing: Math.PI / 2 },
    // the quest folk (slice 2): Abena at her fruit stand, Nana Ayo by the plaza's shade tree
    { id: 'abena', x: SL.plaza.x - 5, z: SL.plaza.z + 2, facing: 0 },
    { id: 'nana_ayo', x: SL.plaza.x + 6, z: SL.plaza.z + 3, facing: Math.PI },
    { id: 'ama', x: SL.jungle.x - 16, z: SL.jungle.z + 13, facing: Math.PI / 2 }, // the Greenheart Fire's camp
    { id: 'ash', x: SL.dockBase.x + 3.2, z: SL.dockBase.z - 1.0, facing: Math.PI / 2 }, // Ash Tolliver, on the dock's end where nobody sits with him
    { id: 'marisol', x: SL.palms.x + 2, z: SL.palms.z - 2, facing: 0 }, // the Red Ransom ashore at Palm Cove
  );
  else if (amb) npcs.push(
    { id: 'jory', x: AL.dockBase.x + 3.2, z: AL.dockBase.z - 1.0, facing: Math.PI / 2 },
    // the quest folk (slice 3): Sigrun the skald and Ingrid the fiddler at the landing
    { id: 'sigrun', x: AL.landing.x - 5, z: AL.landing.z - 2, facing: 0 },
    { id: 'ingrid', x: AL.landing.x + 5, z: AL.landing.z - 3, facing: Math.PI },
    // The Toll of Tollhouse: the toll-reeve at his landing, the poachers' chief at the south edge of her camp
    { id: 'halvard', x: AL.landing.x, z: AL.landing.z - 7, facing: Math.PI / 2 },
    { id: 'brita', x: AL.landing.x + 7, z: AL.landing.z + 3, facing: Math.PI },
    { id: 'eir', x: AL.landing.x - 7, z: AL.landing.z + 3, facing: 0 },
    { id: 'brine', x: AL.ironshore.x - 5, z: AL.ironshore.z + 2, facing: Math.PI }, // Mother Brine ashore on the Ironshell Shore
    { id: 'ulla', x: AL.camp.x, z: AL.camp.z + 11, facing: Math.PI / 2 },
  );
  else if (long) npcs.push(
    { id: 'tormod', x: NL.landing.x - 6, z: NL.landing.z - 1, facing: 0 }, // Tormod Linklater, whose wife the Finfolk took
  );
  else if (salt) npcs.push(
    { id: 'sunniva', x: GL.landing.x - 6, z: GL.landing.z - 1, facing: 0 }, // Sunniva Brask, glassblower
  );
  else if (lock) npcs.push(
    { id: 'orla', x: KL.landing.x - 6, z: KL.landing.z - 1, facing: 0 }, // Orla Fane, who stayed
  );
  else npcs.push({ id: 'mercy', x: WL.dockBase.x + 3.2, z: WL.dockBase.z - 1.0, facing: Math.PI / 2 }, { id: 'osric', x: WL.landing.x - 6, z: WL.landing.z + 2, facing: 0 }, { id: 'edda', x: WL.landing.x + 6, z: WL.landing.z + 3, facing: Math.PI }, { id: 'ninefold', x: WL.landing.x - 7, z: WL.landing.z - 4, facing: 0 });
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
  } else if (lock) {
    // the Ring of Thirteen, east of the Field: thirteen Houses' threshold stones round the oldest door on the island
    const RT = { x: LOCK.x + 30, z: LOCK.z + 8 };
    ring(RT.x, RT.z, 4, 1300);
    const knocker = { x: RT.x - 4.6, z: RT.z + 0.4 };
    world.solids.push({ x: knocker.x, z: knocker.z, r: 0.7 });
    arenas.push({ boss: 'elder_lockjaw', x: RT.x, z: RT.z, r: 7, altar: knocker, label: 'The oldest door, alone in a ring of stones', verb: 'Knock' });
  } else if (wrack) {
    // Thunder Crag's crown: a ring of storm-cracked stones north of the vent forge; a war horn at the gap (south)
    const TC = { x: WL.crag.x + 2, z: WL.crag.z - 20 };
    ring(TC.x, TC.z, 2, 1100);
    const horn = { x: TC.x, z: TC.z + 4.6 };
    world.solids.push({ x: horn.x, z: horn.z, r: 0.7 });
    arenas.push({ boss: 'storm_jotunn', x: TC.x, z: TC.z, r: 7, altar: horn, label: 'Storm horn', verb: 'Sound' });
  }

  // ---- Wardwright doors (data/doors.ts): solid stone, walk up to the keyhole
  for (const d of DOORS) if (d.region === region) world.solids.push({ x: d.x, z: d.z, r: 0.9 });

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
      if (Math.abs(x - tb.x) > tb.w + tb.d + m + 2 || Math.abs(z - tb.z) > tb.w + tb.d + m + 2) continue;
      const [lx, lz] = toLocal(tb, x, z);
      if (Math.abs(lx) < tb.w / 2 + m && Math.abs(lz) < tb.d / 2 + m) return true;
      const o = doorPoints(tb).out;
      if (Math.hypot(x - o[0], z - o[1]) < m + 1.6) return true;
    }
    for (const st of T.stalls) if (Math.hypot(x - st.x, z - st.z) < m + 1.6) return true;
    return square && T.squares.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + m);
  };
  // nodes and props looked up through a grid (a 4.5x island has thousands): synced up to the arrays before each ask
  const OCC = 6, occ = new Map<number, { x: number; z: number; mouth: boolean; prop: boolean }[]>();
  let nSeen = 0, pSeen = 0;
  const okey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  const put = (x: number, z: number, prop: boolean, mouth: boolean) => { const k = okey(Math.floor(x / OCC), Math.floor(z / OCC)); let l = occ.get(k); if (!l) occ.set(k, (l = [])); l.push({ x, z, prop, mouth }); };
  /** anything (a node within `rn`, a prop within `rp`, a cave mouth within `rp + 3`) near (x, z)? */
  const crowded = (x: number, z: number, rn: number, rp: number) => {
    for (; nSeen < nodes.length; nSeen++) put(nodes[nSeen].x, nodes[nSeen].z, false, false);
    for (; pSeen < props.length; pSeen++) put(props[pSeen].x, props[pSeen].z, true, props[pSeen].kind === 'cavemouth');
    const R = Math.max(rn, rp + 3), i0 = Math.floor((x - R) / OCC), i1 = Math.floor((x + R) / OCC), j0 = Math.floor((z - R) / OCC), j1 = Math.floor((z + R) / OCC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const o of occ.get(okey(i, j)) ?? []) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (o.prop ? d < rp + (o.mouth ? 3 : 0) : d < rn) return true;
    }
    return false;
  };
  const free = (x: number, z: number, minCoast = 4, clearance = 2.2) => {
    if (!world.inside(x, z, 2) || coastDist(x, z) < minCoast) return false;
    const p = nearestPathDist(x, z);
    if (p.d < p.width + 1.2) return false;
    for (const i of flatsAt(x, z)) { const f = FLATS[i]; if (Math.hypot(x - f.x, z - f.z) < f.r + 2) return false; }
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) + 1.5) return false;
    if (nearTown(x, z, 2.5)) return false;
    if (crowded(x, z, clearance, clearance)) return false;
    for (const st of [...stations, ...banks]) if (Math.hypot(x - st.x, z - st.z) < 3.5) return false;
    for (const a of arenas) if (Math.hypot(x - a.x, z - a.z) < a.r + 3) return false;
    return true;
  };
  const scatter = (def: string, cx: number, cz: number, radius: number, count: number, clearance: number, rng = rnd) => {
    for (let tries = 0, made = 0; tries < Math.max(400, count * 60) && made < count; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!free(x, z, 5, clearance)) continue;
      if (world.ground(x, z) < 0.5) continue; // not in the lagoon
      const sx = world.ground(x + 0.6, z) - world.ground(x - 0.6, z), sz = world.ground(x, z + 0.6) - world.ground(x, z - 0.6);
      if (Math.hypot(sx, sz) > 0.9) continue;
      nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.floor(rng() * 1e6) });
      world.solids.push({ x, z, r: def.startsWith('tree') ? 0.45 : 0.75 });
      made++;
    }
  };
  if (bell) {
    const Q = LAYOUT.quarry, CP = LAYOUT.copse;
    // the first trees and rocks, a short walk from the city
    scatter('tree_pine', CP.x, CP.z, 22, 18, 3.2);
    scatter('tree_oak', CP.x - 14, CP.z - 10, 12, 6, 3.6);
    scatter('rock_copper', Q.x - 5, Q.z + 2, 9, 8, 2.4);
    scatter('rock_tin', Q.x + 5, Q.z - 3, 9, 8, 2.4);
    // Saltpine Wood and the Sea-oak Grove
    scatter('tree_pine', F.x + 4, F.z + 4, 45, 50, 3.2);
    scatter('tree_oak', GV.x, GV.z, 30, 24, 3.6);
    // the Copperback Hills: copper and tin on the lower slopes, iron higher up
    scatter('rock_copper', H.x - 26, H.z + 22, 22, 14, 2.4);
    scatter('rock_tin', H.x - 8, H.z + 34, 22, 14, 2.4);
    scatter('rock_iron', H.x + 12, H.z - 8, 18, 9, 2.6);
    // Mirewater Fen: sea-oaks ring the lagoon
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + 0.3;
      scatter('tree_oak', LAGOON.x + Math.cos(a) * (LAGOON.r + 12), LAGOON.z + Math.sin(a) * (LAGOON.r + 12), 5, 1, 3.4);
    }
    // the Heartwood (Bellwether is the first island, levels 1-20: Tom, 2026-10-25): sea-oaks and saltpine
    scatter('tree_oak', HW.x + 16, HW.z + 26, 36, 22, 3.6);
    scatter('tree_oak', HW.x - 26, HW.z - 18, 30, 16, 3.6);
    // Ironcrag: iron all the way up (coal starts on Sunreach)
    scatter('rock_iron', M.x - 8, M.z + 15, 9, 6, 2.6);
    scatter('rock_iron', M.x + 30, M.z + 20, 16, 8, 2.6);
    scatter('rock_iron', M.x - 26, M.z + 6, 16, 8, 2.8);
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
  } else if (long) {
    // Longstrand (levels 75-99): driftwood cedar on the dunes; leviathite washed up in the shingle
    scatter('tree_cedar', NL.dunes.x - 4, NL.dunes.z + 2, 7, 3, 4.6);
    scatter('tree_yew', NL.stiltwick.x - 6, NL.stiltwick.z - 6, 6, 2, 4);
    scatter('rock_levi', NL.netting.x - 8, NL.netting.z - 4, 6, 3, 3);
    scatter('rock_tide', NL.haaf.x + 10, NL.haaf.z - 4, 6, 3, 3);
  } else if (salt) {
    // Saltglass (levels 70-95): starbark and cedar in the Shattered Grove; the high metals in the fused dunes
    const GV2 = GL.grove, DU = GL.dunes;
    scatter('tree_star', GV2.x, GV2.z, 8, 4, 4.2);
    scatter('tree_cedar', GV2.x + 6, GV2.z + 5, 6, 3, 4.6);
    scatter('rock_cinder', DU.x - 3, DU.z + 2, 6, 3, 3.2);
    scatter('rock_sky', DU.x + 5, DU.z - 3, 6, 3, 3);
    scatter('rock_levi', DU.x + 2, DU.z + 9, 5, 2, 3);
  } else if (lock) {
    // Lockhaven (levels 60-90): the Keywood the Wardwrights planted; the high metals round their forges
    const KW = KL.keywood, FG = KL.forges;
    scatter('tree_star', KW.x - 2, KW.z - 2, 9, 5, 4.2);
    scatter('tree_cedar', KW.x + 4, KW.z + 6, 7, 3, 4.6);
    scatter('tree_yew', KW.x - 8, KW.z + 6, 6, 3, 4);
    scatter('rock_sky', FG.x - 4, FG.z + 4, 6, 3, 3);
    scatter('rock_levi', FG.x + 5, FG.z - 2, 6, 3, 3);
    scatter('rock_cinder', FG.x, FG.z - 8, 6, 2, 3.2);
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
    // shore fishing off the city's beach, Crab Strand, Gullhaven's rocks and the west coast
    for (const [def, th] of [['spot_sprat', 108], ['spot_sprat', 116], ['spot_sprat', 132], ['spot_trout', 170], ['spot_sprat', 288], ['spot_sprat', 300], ['spot_salmon', 236], ['spot_trout', 200], ['spot_salmon', 20]] as const) {
      const [fx, fz] = coastPoint(th, 8), p = shoreSpot(fx, fz, sunOut(th));
      if (p && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 5)) nodes.push({ uid: `n${uid++}`, def, x: p[0], z: p[1], seed: th });
    }
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
  } else if (long) {
    // the Netting Grounds: the best shore fishing in the Reef, and the deep water all round the bar
    const nOut = Math.atan2(NL.netting.z - LONG.z, NL.netting.x - LONG.x);
    placeShore('spot_gloom', NL.netting.x, NL.netting.z, [nOut - 0.8, nOut, nOut + 0.8]);
    placeShore('spot_salmon', NL.stiltwick.x, NL.stiltwick.z, [Math.PI / 2, -Math.PI / 2]);
    for (const [def, list] of Object.entries(LONG_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
  } else if (salt) {
    // the Mirror Pools (walk in toward the middle from the bank), and the deep water off the glass beaches
    for (const [a, def] of [[0.3, 'spot_gloom'], [2.4, 'spot_salmon'], [4.4, 'spot_gloom']] as const) {
      const fx = MIRROR_POOL.x + Math.cos(a) * (MIRROR_POOL.r + 6), fz = MIRROR_POOL.z + Math.sin(a) * (MIRROR_POOL.r + 6);
      placeShore(def, fx, fz, [a + Math.PI]);
    }
    for (const [def, list] of Object.entries(SALT_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
  } else if (lock) {
    // the Keyhole Shore's rock-pools, and the deep water round the island
    const kOut = Math.atan2(KL.shore.z - LOCK.z, KL.shore.x - LOCK.x);
    placeShore('spot_gloom', KL.shore.x, KL.shore.z, [kOut - 0.5, kOut + 0.5]);
    for (const [def, list] of Object.entries(LOCK_SEA_SPOTS)) for (const [x, z] of list) nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.round(x + z) });
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
  for (let tries = 0, made = 0; tries < (bell ? 3000 : 600) && made < (bell ? 80 : sun ? 9 : amb ? 10 : lock || salt || long ? 12 : 14); tries++) {
    const [x, z] = bell ? coastPoint(rnd() * 360, -(4 + rnd() * 26)) : cp(rnd() * 360, -(5 + rnd() * 16));
    if (Math.hypot(x - mooring.x, z - mooring.z) < (bell ? 18 : 22)) continue; // keep the harbour mouth clear
    if (nodes.some((n) => (n.def.startsWith('spot_') || n.def === 'rock_ori') && Math.hypot(n.x - x, n.z - z) < 9)) continue;
    if (bell && Math.hypot(x - LAYOUT.islet.x, z - LAYOUT.islet.z) < 24) continue; // keep the islet's landing clear
    if (sun && (x < SUN.x - SUN_RADIUS - 4 || x > SUN.x + SUN_RADIUS + 4)) continue; // both sea lanes stay open
    if (amb && (x < AMBER.x - AMBER_RADIUS - 4 || x > AMBER.x + AMBER_RADIUS + 4)) continue;
    if ((wrack || lock || salt || long) && x < (wrack ? WRACK.x - WRACK_RADIUS : lock ? LOCK.x - LOCK_RADIUS : salt ? SALT.x - SALT_RADIUS : LONG.x - LONG_RADIUS - 24) - 4) continue; // the western approach stays open
    if (lock && x > LOCK.x + LOCK_RADIUS + 4) continue; // and Lockhaven's eastern, toward Saltglass
    if (wrack && Math.hypot(x - WRACK_LAYOUT.islet.x, z - WRACK_LAYOUT.islet.z) < 24) continue;
    if (world.ground(x, z) > -0.6) continue;
    reefs.push({ x, z, r: 0.8 + rnd() * 1.2 });
    made++;
  }
  world.reefs.push(...reefs);

  // ---- vegetation and rocks (solid, every one usable): woods are dense, open country is sparse
  const centre = bell ? { x: 0, z: 0 } : sun ? SUN : amb ? AMBER : lock ? LOCK : salt ? SALT : long ? LONG : WRACK;
  const hr = coastPoint(76, 30), we = coastPoint(102, 26);
  const keepClear = bell
    ? [{ x: R.x, z: R.z, r: 14 }, { x: C.x, z: C.z, r: 16 }, { x: LAYOUT.cove.x, z: LAYOUT.cove.z, r: 12 }, { x: LAYOUT.howes.x, z: LAYOUT.howes.z, r: 20 },
      // the city and the towns: their streets and gardens, not woods
      { x: X.x, z: X.z - 60, r: 85 }, { x: X.x - 80, z: X.z, r: 40 }, { x: X.x + 85, z: X.z - 5, r: 40 }, { x: hr[0], z: hr[1], r: 45 }, { x: we[0], z: we[1], r: 40 }, { x: V.x, z: V.z, r: 30 },
      { x: LAYOUT.copperback.x, z: LAYOUT.copperback.z - 20, r: 42 }, { x: LAYOUT.saltpine.x, z: LAYOUT.saltpine.z, r: 22 }, { x: LAYOUT.mirewater.x, z: LAYOUT.mirewater.z, r: 15 }, { x: LAYOUT.gullhaven.x, z: LAYOUT.gullhaven.z, r: 24 },
      { x: LAYOUT.quarry.x, z: LAYOUT.quarry.z, r: 14 }]
    : sun ? [{ x: SL.temple.x, z: SL.temple.z, r: 11 }, { x: SL.plaza.x, z: SL.plaza.z, r: 12 }, { x: SL.port.x, z: SL.port.z, r: 16 },
      { x: SL.jungle.x - 24, z: SL.jungle.z, r: 12 }, { x: SL.jungle.x - 14, z: SL.jungle.z + 11, r: 5 }] // the Greenheart Fire's grove and camp
    : amb ? [{ x: AL.landing.x, z: AL.landing.z, r: 14 }, { x: AL.camp.x, z: AL.camp.z, r: 9 }, { x: AL.hollow.x, z: AL.hollow.z, r: 11 }, { x: AL.goldhill.x - 22, z: AL.goldhill.z - 4, r: 9 }] // the Amber Seep's ground
    : long ? [{ x: NL.landing.x, z: NL.landing.z, r: 13 }, { x: NL.weir.x, z: NL.weir.z, r: 9 }, { x: NL.stiltwick.x, z: NL.stiltwick.z, r: 11 }]
    : salt ? [{ x: GL.landing.x, z: GL.landing.z, r: 14 }, { x: GL.mirror.x, z: GL.mirror.z, r: 11 }, { x: GL.lens.x, z: GL.lens.z, r: 8 }, { x: MIRROR_POOL.x, z: MIRROR_POOL.z, r: MIRROR_POOL.r + 4 }, { x: GL.dunes.x, z: GL.dunes.z, r: 12 }]
    : lock ? [{ x: LOCK.x + 30, z: LOCK.z + 8, r: 11 }, { x: KL.landing.x, z: KL.landing.z, r: 14 }, { x: KL.doorfield.x, z: KL.doorfield.z, r: 14 }, { x: KL.well.x, z: KL.well.z, r: 9 }, { x: KL.forges.x, z: KL.forges.z, r: 9 }]
    : [{ x: WL.starfall.x, z: WL.starfall.z, r: 10 }, { x: WL.landing.x, z: WL.landing.z, r: 14 }, { x: WL.crag.x, z: WL.crag.z - 6, r: 7 }, { x: WL.crag.x + 2, z: WL.crag.z - 20, r: 10 }];
  if (bell) {
    const woods = [{ x: F.x, z: F.z, r: 75 }, { x: GV.x, z: GV.z, r: 45 }, { x: HW.x, z: HW.z, r: 80 }, { x: LAGOON.x, z: LAGOON.z, r: 55 }, { x: LAYOUT.copse.x, z: LAYOUT.copse.z, r: 26 }, { x: -260, z: -110, r: 40 }, { x: 230, z: 140, r: 35 }];
    for (let tries = 0, made = 0; tries < 80000 && made < 2600; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 430;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const inWood = woods.some((w) => Math.hypot(x - w.x, z - w.z) < w.r);
      if (!inWood && rnd() < 0.6) continue;
      if (!free(x, z, BEACH + 1, 2.6)) continue; // trees stop where the sand starts
      if (keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      if (Math.hypot(x - H.x, z - H.z) < 55 && rnd() < 0.7) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 15) continue; // nothing on the bare upper peak
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
  } else if (long) {
    // a sandbar: marram and a few wind-bent pines on the dunes, nothing on the shingle
    for (let tries = 0, made = 0; tries < 4000 && made < 40; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (LONG_RADIUS + 24), x = LONG.x + Math.cos(a) * r, z = LONG.z + Math.sin(a) * r * 0.5;
      if (!free(x, z, BEACH + 1, 2.6) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 8) continue;
      nodes.push({ uid: `n${uid++}`, def: 'tree_pine', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.75 + rnd() * 0.35, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
  } else if (salt) {
    // glass-bright sand and little cover: a few pines, thickest in the Shattered Grove
    for (let tries = 0, made = 0; tries < 5000 && made < 60; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (SALT_RADIUS + 6), x = SALT.x + Math.cos(a) * r, z = SALT.z + Math.sin(a) * r;
      const inWood = Math.hypot(x - GL.grove.x, z - GL.grove.z) < 15;
      if (!inWood && rnd() < 0.75) continue;
      if (!free(x, z, BEACH + 1, 2.6) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 8) continue;
      nodes.push({ uid: `n${uid++}`, def: 'tree_pine', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.8 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
      world.solids.push({ x, z, r: 0.45 });
      made++;
    }
  } else if (lock) {
    // the Wardwrights' orchards gone wild: oaks and pines, thick in the Keywood, nothing in the Field of Doors
    for (let tries = 0, made = 0; tries < 6000 && made < 100; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (LOCK_RADIUS + 6), x = LOCK.x + Math.cos(a) * r, z = LOCK.z + Math.sin(a) * r;
      const inWood = Math.hypot(x - KL.keywood.x, z - KL.keywood.z) < 17;
      if (!inWood && rnd() < 0.6) continue;
      if (!free(x, z, BEACH + 1, 2.6) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      const gy = world.ground(x, z);
      if (gy < 0.5 || gy > 8) continue;
      nodes.push({ uid: `n${uid++}`, def: rnd() < 0.5 ? 'tree_oak' : 'tree_pine', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.85 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
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
  for (let tries = 0, made = 0; tries < (bell ? 24000 : 900) && made < (bell ? 700 : sun ? 22 : 40); tries++) {
    const a = rnd() * Math.PI * 2, r = bell ? 30 + rnd() * 400 : Math.sqrt(rnd()) * (sun ? SUN_RADIUS : amb ? AMBER_RADIUS : lock ? LOCK_RADIUS : salt ? SALT_RADIUS : long ? LONG_RADIUS : WRACK_RADIUS);
    const x = centre.x + Math.cos(a) * r, z = centre.z + Math.sin(a) * r;
    if (!free(x, z, 1, 2) || keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r * (bell ? 0.8 : 1))) continue;
    const s = 0.35 + rnd() * 0.7;
    nodes.push({ uid: `n${uid++}`, def: 'rock_boulder', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s, rot: rnd() * 6.28 });
    world.solids.push({ x, z, r: Math.max(0.45, s * 0.9) });
    made++;
  }
  if (bell) {
    // bramble bushes: meadows and wood edges
    for (let tries = 0, made = 0; tries < 30000 && made < 320; tries++) {
      const a = rnd() * Math.PI * 2, r = 30 + Math.sqrt(rnd()) * 380;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!free(x, z, BEACH, 2.2) || world.ground(x, z) < 0.5 || world.ground(x, z) > 12) continue;
      if (keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
      nodes.push({ uid: `n${uid++}`, def: 'bush_berry', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s: 0.8 + rnd() * 0.4, rot: rnd() * 6.28 });
      world.solids.push({ x, z, r: 0.5 });
      made++;
    }
  }
  // kelp beds just off the beaches, all the way round
  for (let deg = 0; deg < 360; deg += bell ? 2.2 : 10) {
    const [lx, lz] = cp(deg + rnd() * 6, 6);
    const p = shoreSpot(lx, lz, bell ? Math.atan2(lz, lx) : sunOut(deg), -0.04); // kelp likes the shallows
    if (p && Math.hypot(p[0] - mooring.x, p[1] - mooring.z) > 14 && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 6))
      nodes.push({ uid: `n${uid++}`, def: 'kelp_bed', x: p[0], z: p[1], seed: deg + (bell ? 0 : sun ? 1000 : amb ? 3000 : lock ? 4000 : salt ? 5000 : long ? 6000 : 2000), scenery: true, s: 0.9 + rnd() * 0.3, rot: rnd() * 6.28 });
  }
  // disturbed sand: candidate dig spots on beaches and dirt tracks (only a few are active at a time)
  const paths = PATHS.filter((pth) => pth.pts.every(([x, z]) => world.inside(x, z, 4)));
  for (let k = 0, made = 0; k < (bell ? 3000 : 400) && made < (bell ? 90 : 14); k++) {
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
    if (crowded(x, z, r + 1.6, r + 1.0)) return false;
    if (Math.hypot(x - mooring.x, z - mooring.z) < r + 6) return false;
    return true;
  };
  const decor = (kind: Prop['kind'], x: number, z: number, r: number, rot: number, solid: boolean, aux?: number[]) => {
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
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.4, BW = LAYOUT.howes;
      props.push({ kind: 'pillar', x: BW.x + Math.cos(a) * 16, z: BW.z + Math.sin(a) * 16, rot: a, s: 0.55 + rnd() * 0.3, seed: 1200 + k });
      world.solids.push({ x: BW.x + Math.cos(a) * 16, z: BW.z + Math.sin(a) * 16, r: 0.6 });
    }
    // the towns: lanterns and barrels round the squares, a well on each green, signposts where the roads meet
    for (const [t, n] of [[LAYOUT.copperback, 6], [LAYOUT.saltpine, 4], [LAYOUT.mirewater, 3], [LAYOUT.gullhaven, 4]] as const) {
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + 0.6, rr = t === LAYOUT.copperback ? 8.4 : t === LAYOUT.mirewater ? 5 : 6.6; decor('lantern', t.x + Math.cos(a) * rr, t.z + Math.sin(a) * rr, 0.2, 0, true); }
      decor('well', t.x - 3, t.z + 3.5, 1.0, 0.3, true);
      decor('woodpile', t.x + 4, t.z - 5, 0.8, 0.5, true);
    }
    // Copperback's mine: the shaft's mouth in the hillside, the pump and its trough, timber and spoil
    { const PH = LAYOUT.pithead; props.push({ kind: 'cavemouth', x: PH.x + 2, z: PH.z - 5.5, rot: Math.PI * 0.5, s: 1, seed: 33 }); world.solids.push({ x: PH.x + 2, z: PH.z - 6.1, r: 1.6 });
      decor('barrel', PH.x + 4, PH.z + 1, 0.4, 0, true); decor('woodpile', PH.x - 4, PH.z - 2, 0.8, 0.3, true); decor('crate', PH.x + 5, PH.z + 3, 0.5, 0.2, true); }
    // the Bucca Stone on Gullhaven's point
    props.push({ kind: 'pillar', x: LAYOUT.bucca.x, z: LAYOUT.bucca.z, rot: 0.4, s: 0.55, seed: 77 }); world.solids.push({ x: LAYOUT.bucca.x, z: LAYOUT.bucca.z, r: 0.6 });
    decor('netrack', LAYOUT.gullhaven.x + 6, LAYOUT.gullhaven.z + 5, 1.3, 0.2, true);
    decor('netrack', LAYOUT.mirewater.x - 5, LAYOUT.mirewater.z - 3, 1.3, -0.4, true);
    decor('pots', LAYOUT.gullhaven.x - 6, LAYOUT.gullhaven.z + 6, 0.8, 0.3, true);
    for (let k = 0; k < 4; k++) { const th = 290 + k * 6, [rx, rz] = coastPoint(th, 2.4); decor('rowboat', rx, rz, 1.2, sunOut(th) + Math.PI / 2, true); }
    // the city: lanterns down the streets, barrels and crates outside the shops, nets on the waterfront
    for (const st of PATHS.filter((p) => p.paved)) {
      for (let k = 1; k < st.pts.length; k++) {
        const [ax, az] = st.pts[k - 1], [bx, bz] = st.pts[k], len = Math.hypot(bx - ax, bz - az);
        for (let t = 6; t < len; t += 16) {
          const nx = -(bz - az) / len, nz = (bx - ax) / len, side = (Math.floor(t / 16) % 2) * 2 - 1, off = st.width / 2 + 0.9;
          decor('lantern', ax + (bx - ax) * (t / len) + nx * off * side, az + (bz - az) * (t / len) + nz * off * side, 0.2, 0, true);
        }
      }
    }
    for (const b of T.buildings.filter((bb) => /shop|chandler|cooper|warehouse|rope|smokehouse|Shipyard|boatyard|spice|Furs|Supplies/i.test(bb.name))) {
      const [x1, z1] = toWorld(b, b.w / 2 + 0.9, b.d / 2 - 0.6), [x2, z2] = toWorld(b, -b.w / 2 - 0.9, b.d / 2 - 0.6);
      decor((rnd() < 0.5 ? 'pots' : 'woodpile'), x1, z1, 0.7, b.rot, true);
      if (rnd() < 0.5) decor('pots', x2, z2, 0.7, b.rot, true);
    }
    for (const [dx, dz, th] of [[0, 0, 80], [0, 0, 72], [0, 0, 98]] as const) { const [nx, nz] = coastPoint(th, 13); decor('netrack', nx + dx, nz + dz, 1.3, sunOut(th) + Math.PI / 2, true); }
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
    const toward = (from: { x: number; z: number }, t: { x: number; z: number }) => Math.atan2(t.z - from.z, t.x - from.x);
    decor('signpost', X.x + 2.8, X.z + 2.2, 0.25, 0, true, [toward(X, LAYOUT.village), toward(X, LAYOUT.copperback), toward(X, LAYOUT.saltpine), toward(X, LAYOUT.camp)]);
    const CBq = LAYOUT.copperback, SPq = LAYOUT.saltpine, MWq = LAYOUT.mirewater, GHq = LAYOUT.gullhaven;
    decor('signpost', CBq.x - 6, CBq.z + 8, 0.25, 0, true, [toward(CBq, X), toward(CBq, LAYOUT.hills), toward(CBq, LAYOUT.ruin), toward(CBq, MWq)]);
    decor('signpost', SPq.x + 6, SPq.z + 6, 0.25, 0, true, [toward(SPq, X), toward(SPq, LAYOUT.forest), toward(SPq, LAYOUT.grove)]);
    decor('signpost', MWq.x + 4, MWq.z + 5, 0.25, 0, true, [toward(MWq, LAYOUT.forest), toward(MWq, LAYOUT.heartwood), toward(MWq, LAYOUT.hills)]);
    decor('signpost', GHq.x + 5, GHq.z + 6, 0.25, 0, true, [toward(GHq, LAYOUT.ruin), toward(GHq, LAYOUT.wreck)]);
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
    const cityShore = (x: number, z: number) => Math.hypot(x - V.x, z - V.z) < 60 || Math.hypot(x - hr[0], z - hr[1]) < 50;
    for (let k = 0; k < 110; k++) { const th = k * 3.27 + rnd() * 2, [x, z] = coastPoint(th, 2.5 + rnd() * 5); if (!cityShore(x, z)) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
    for (let k = 0; k < 150; k++) { const th = k * 2.4 + rnd() * 2, [x, z] = coastPoint(th, 1 + rnd() * 6); if (!cityShore(x, z)) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    // salt pans on the beaches (sea salt flux for Tidecore and Leviathite)
    for (let th = 7, made = 0; th < 367 && made < 22; th += 2.5) {
      const [x, z] = coastPoint(th, 4.5);
      if (cityShore(x, z) || !clearOf(x, z, 1.2) || nodes.some((n) => n.def === 'salt_pan' && Math.hypot(n.x - x, n.z - z) < 60)) continue;
      nodes.push({ uid: `n${uid++}`, def: 'salt_pan', x, z, seed: th });
      world.solids.push({ x, z, r: 1.0 });
      made++;
    }
    for (let k = 0, made = 0; k < 4000 && made < 320; k++) {
      const a = rnd() * Math.PI * 2, r = 30 + rnd() * 380, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (coastDist(x, z) < BEACH + 2 || world.ground(x, z) > 12) continue;
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
  } else if (long) {
    const D = NL.dockBase, LD = NL.landing, SW = NL.stiltwick;
    dress([['crate', D.x - 2.6, D.z - 1.8], ['lantern', D.x + 2, D.z - 1.0], ['lantern', LD.x - 3, LD.z + 4], ['barrel', LD.x + 7, LD.z + 1], ['crate', LD.x - 7, LD.z - 6]]);
    decor('netrack', D.x - 7, D.z - 1.5, 1.3, -0.1, true);
    decor('pots', D.x + 6, D.z - 1.2, 0.8, 0.3, true);
    // Stiltwick: the stilts of houses that stood here, and the boats nobody came back for
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.2, r = 6 + (k % 3) * 2.2, px = SW.x + Math.cos(a) * r, pz = SW.z + Math.sin(a) * r;
      if (!clearOf(px, pz, 0.5)) continue;
      props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.35 + rnd() * 0.25, seed: 1800 + k });
      world.solids.push({ x: px, z: pz, r: 0.4 });
    }
    decor('rowboat', ...longPoint(150, 2.2), 1.2, 0.8, true);
    decor('rowboat', ...longPoint(210, 2.2), 1.2, -0.6, true);
    for (let k = 0; k < 16; k++) { const [x, z] = longPoint(k * 22.5 + rnd() * 8, 2 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 18) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    for (let k = 0; k < 10; k++) { const [x, z] = longPoint(k * 36 + rnd() * 8, 2.5 + rnd() * 4); if (Math.hypot(x - D.x, z - D.z) > 18) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
  } else if (salt) {
    const D = GL.dockBase, LD = GL.landing;
    dress([['crate', D.x - 2.6, D.z - 1.8], ['lantern', D.x + 2, D.z - 1.0], ['lantern', LD.x - 3, LD.z + 4], ['lantern', LD.x + 4, LD.z - 7], ['crate', LD.x - 7, LD.z - 6], ['barrel', LD.x + 7.5, LD.z + 1],
      ['lantern', GL.lens.x - 2, GL.lens.z + 2], ['crate', GL.lens.x + 2, GL.lens.z + 1.5]]);
    // the Drowned Mirror: a ring of glass stones round a pool so still it shows you a moment late
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.25, px = GL.mirror.x + Math.cos(a) * 8.5, pz = GL.mirror.z + Math.sin(a) * 8.5;
      if (!clearOf(px, pz, 0.6)) continue;
      props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.6 + rnd() * 0.4, seed: 1700 + k });
      world.solids.push({ x: px, z: pz, r: 0.55 });
    }
    for (let k = 0; k < 14; k++) { const [x, z] = saltPoint(k * 25.7 + rnd() * 8, 2 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 20) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
  } else if (lock) {
    const D = KL.dockBase, LD = KL.landing, DF = KL.doorfield;
    dress([['crate', D.x - 2.6, D.z - 1.8], ['lantern', D.x + 2, D.z - 1.0], ['lantern', LD.x - 3, LD.z + 4], ['lantern', LD.x + 4, LD.z - 7], ['barrel', LD.x + 7.5, LD.z + 1]]);
    // the Field of Doors: the Houses' broken columns stand among the doors that outlived them
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.35, r = 10 + (k % 3) * 1.6, px = DF.x + Math.cos(a) * r, pz = DF.z + Math.sin(a) * r;
      if (!clearOf(px, pz, 0.7)) continue;
      props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.5 + rnd() * 0.5, seed: 1500 + k });
      world.solids.push({ x: px, z: pz, r: 0.6 });
    }
    // the Thirteen Forges: cold, the anvils long gone; their chimneys still stand
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.2, px = KL.forges.x + Math.cos(a) * 9, pz = KL.forges.z + Math.sin(a) * 9;
      if (!clearOf(px, pz, 0.7)) continue;
      props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.9 + rnd() * 0.4, seed: 1600 + k });
      world.solids.push({ x: px, z: pz, r: 0.65 });
    }
    decor('well', KL.well.x, KL.well.z, 1.0, 0, true);
    for (let k = 0; k < 12; k++) { const [x, z] = lockPoint(k * 30 + rnd() * 8, 2 + rnd() * 5); if (Math.hypot(x - D.x, z - D.z) > 20) decor('shells', x, z, 0.5, rnd() * 6.28, false); }
    for (let k = 0; k < 8; k++) { const [x, z] = lockPoint(k * 45 + 10 + rnd() * 8, 2.5 + rnd() * 4); if (Math.hypot(x - D.x, z - D.z) > 20) decor('driftwood', x, z, 0.6, rnd() * 6.28, false); }
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

  // ---- added 2026-10-28 on their own random stream, so everything else keeps its draws from rnd
  const rnd2 = mulberry32(rndSeed + 1000);
  // ---- Shardcraft's shrines (data/content.ts SHRINES), each on open ground near where it's asked for, with a few
  // glimmerstone veins beside it so the stone needn't be carried across the sea
  const shrine = (key: ShardKey, x0: number, z0: number, veins = 4) => {
    for (let k = 0; k < 900; k++) {
      const a = k * 2.39996, r = Math.sqrt(k) * 1.2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      if (!free(x, z, 6, 4) || world.ground(x, z) < 0.5) continue;
      const sx = world.ground(x + 1.5, z) - world.ground(x - 1.5, z), sz = world.ground(x, z + 1.5) - world.ground(x, z - 1.5);
      if (Math.hypot(sx, sz) > 0.8) continue;
      stations.push({ id: `shrine_${key}`, x, z });
      world.solids.push({ x, z, r: 1.3 });
      if (veins) scatter('rock_glimmer', x, z, 12, veins, 3, rnd2);
      return;
    }
    throw new Error(`no room for the ${key} shrine`);
  };
  if (bell) {
    // glimmerstone in the Old Quarry and at Copperback's pithead
    scatter('rock_glimmer', LAYOUT.quarry.x + 2, LAYOUT.quarry.z + 10, 10, 6, 2.6, rnd2);
    scatter('rock_glimmer', LAYOUT.pithead.x + 8, LAYOUT.pithead.z + 6, 10, 4, 2.6, rnd2);
    shrine('gale', 25, 160, 5); // on the quarry road, a short walk from the city
    shrine('whisper', -100, 210, 0); // by Millbrook Copse
    shrine('tide', -122, -84, 0); // on the shore of the Mirewater lagoon
    shrine('stone', 112, -12, 0); // in the Copperback Hills, below the pithead
    shrine('ember', 26, -214); // at the foot of Ironcrag, by the miners' forge
    shrine('bone', 258, -50, 0); // among the Howes
  } else if (sun) shrine('star', SL.plaza.x - 14, SL.plaza.z - 6);
  else if (amb) { shrine('squall', AL.camp.x + 8, AL.camp.z + 8); shrine('root', AL.amberwood.x + 6, AL.amberwood.z + 12); }
  else if (wrack) { shrine('compass', WL.landing.x - 12, WL.landing.z - 10); shrine('grave', WL.oldwood.x + 8, WL.oldwood.z - 12); }
  else if (lock) shrine('heart', KL.doorfield.x + 12, KL.doorfield.z + 10);
  else if (salt) shrine('wrath', GL.mirror.x + 10, GL.mirror.z + 8);
  // trees in and around the city and the towns (Tom, 2026-10-28: the nearest tree was "quite a walk"): a few
  // between the houses, more just past the last of them. Mostly saltpine, the tree a new player can cut.
  const towns = !bell ? [] : [{ x: X.x, z: X.z - 60, r: 85, n: 70 }, { x: X.x - 80, z: X.z, r: 40, n: 14 }, { x: X.x + 85, z: X.z - 5, r: 40, n: 14 },
    { x: LAYOUT.copperback.x, z: LAYOUT.copperback.z - 20, r: 42, n: 22 }, { x: LAYOUT.saltpine.x, z: LAYOUT.saltpine.z, r: 22, n: 12 },
    { x: LAYOUT.mirewater.x, z: LAYOUT.mirewater.z, r: 15, n: 10 }, { x: LAYOUT.gullhaven.x, z: LAYOUT.gullhaven.z, r: 24, n: 12 }];
  for (const t of towns) for (let tries = 0, made = 0; tries < 4000 && made < t.n; tries++) {
    const a = rnd2() * Math.PI * 2, r = Math.sqrt(rnd2()) * (t.r + 20), x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
    if (!free(x, z, BEACH + 2, 4.5)) continue;
    const p = nearestPathDist(x, z);
    if (p.d < p.width + 2.5) continue; // off the streets and lanes
    const gy = world.ground(x, z);
    if (gy < 0.5 || gy > 15) continue;
    const sx = world.ground(x + 0.6, z) - world.ground(x - 0.6, z), sz = world.ground(x, z + 0.6) - world.ground(x, z - 0.6);
    if (Math.hypot(sx, sz) > 0.9) continue;
    nodes.push({ uid: `n${uid++}`, def: rnd2() < 0.7 ? 'tree_pine' : 'tree_oak', x, z, seed: Math.floor(rnd2() * 1e6), scenery: true, s: 0.85 + rnd2() * 0.3, rot: rnd2() * Math.PI * 2 });
    world.solids.push({ x, z, r: 0.45 });
    made++;
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
    // Bellwether at 4.5x: foes get tougher the further you go from the city (Tom: "masses of creatures")
    const group = (enemy: string, cx: number, cz: number, r: number, n: number) => {
      for (let k = 0; k < n; k++) { const a = k * 2.399 + rnd() * 0.6, rr = r * Math.sqrt((k + 0.5) / n); spawn(enemy, cx + Math.cos(a) * rr, cz + Math.sin(a) * rr); }
    };
    const shore = (enemy: string, from: number, step: number, n: number, inset = 3.5) => { for (let k = 0; k < n; k++) { const [x, z] = coastPoint(from + k * step, inset + (k % 2) * 2.5); spawn(enemy, x, z); } };
    // the city's beaches and Crab Strand: crabs and beetles for the first fights
    shore('reef_crab', 106, 2.2, 8); shore('shore_beetle', 107, 2.6, 5, 6);
    shore('reef_crab', 56, 2.4, 6); shore('reef_crab', 128, 2.6, 10); shore('shore_beetle', 140, 2.8, 8, 5);
    // gulls on the empty west strand; rock crabs on the north shore round Gullhaven; gulls and beetles at Wreckers' Point
    shore('gull', 176, 2.4, 10, 4); shore('gull', 210, 3, 6, 4);
    shore('rock_crab', 270, 2.2, 8); shore('rock_crab', 304, 2.4, 6);
    const W = LAYOUT.wreck;
    group('gull', W.x - 4, W.z + 6, 10, 6); group('shore_beetle', W.x - 6, W.z + 10, 8, 3);
    // the country round the city: wild boar in the meadows, footpads on the roads out of town
    group('wild_boar', LAYOUT.copse.x + 30, LAYOUT.copse.z - 60, 30, 6); group('wild_boar', 120, 110, 30, 6); group('wild_boar', -20, 60, 30, 5); group('wild_boar', LAYOUT.saltpine.x - 30, LAYOUT.saltpine.z - 40, 25, 4);
    group('footpad', 20, 150, 18, 3); group('footpad', -70, 220, 14, 2); group('footpad', 140, 200, 14, 3);
    // the Brigand Camp, and its lookouts on the east road
    spawn('brigand', C.x - 2.5, C.z + 2); spawn('brigand', C.x + 2.5, C.z + 1.5); spawn('brigand', C.x, C.z - 2.5); spawn('brigand', C.x + 6, C.z + 5);
    spawn('gunner', C.x + 4, C.z - 3); spawn('gunner', C.x - 5, C.z - 1); spawn('gunner', C.x - 3, C.z + 7);
    group('brigand', C.x - 30, C.z + 34, 10, 3); group('gunner', C.x + 26, C.z + 14, 8, 2);
    // the Sea-oak Grove's spriggans; wolves in Saltpine Wood and on the Heartwood's edge; spiders in the Heartwood
    for (const [dx, dz] of [[-30, -12], [-24, -36], [-48, 8], [-10, -30], [-40, -24], [-20, 10]]) spawn('spriggan', GV.x + dx, GV.z + dz);
    group('grey_wolf', F.x - 40, F.z - 20, 26, 6); group('grey_wolf', HW.x + 50, HW.z + 50, 24, 5);
    group('wood_spider', HW.x - 10, HW.z - 10, 34, 8);
    // Mirewater Fen: mire crabs on the banks, leeches in the shallows
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.7; spawn('mire_crab', LAGOON.x + Math.cos(a) * (LAGOON.r + 3), LAGOON.z + Math.sin(a) * (LAGOON.r + 3)); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.2; spawn('bog_leech', LAGOON.x + Math.cos(a) * (LAGOON.r + 6), LAGOON.z + Math.sin(a) * (LAGOON.r + 6)); }
    // knockers on Ironcrag and in the hills over Copperback's seam
    for (const [dx, dz] of [[-14, 18], [12, 22], [-6, 4], [20, 2], [-24, -6], [6, -14]]) spawn('knocker', M.x + dx, M.z + dz);
    group('knocker', H.x + 30, H.z - 30, 14, 4);
    group('knocker', LAYOUT.pithead.x + 18, LAYOUT.pithead.z - 16, 8, 4);
    // the Howes: the haugbui keep their grave goods
    const BW = LAYOUT.howes;
    for (const [dx, dz] of [[-9, 2], [9, 0], [-3, -9], [4, 11], [14, -8], [-14, -10]]) spawn('haugbui', BW.x + dx, BW.z + dz);
    // Smugglers' Cove
    const SC = LAYOUT.cove;
    spawn('smuggler', SC.x - 3, SC.z - 2); spawn('smuggler', SC.x + 2, SC.z - 4); spawn('smuggler', SC.x - 5, SC.z - 6);
    spawn('smuggler_gunner', SC.x + 4, SC.z - 1); spawn('smuggler_gunner', SC.x - 1, SC.z - 8);
    group('smuggler', SC.x - 26, SC.z - 24, 10, 3);
  } else if (wrack) {
    const W = WL.wreck, CR = WL.crag, OW = WL.oldwood;
    spawn('drowned', W.x - 4, W.z + 2); spawn('drowned', W.x + 2, W.z + 4); spawn('sea_draugr', W.x - 8, W.z + 6); spawn('sea_draugr', W.x - 2, W.z + 9);
    spawn('wreck_captain', W.x - 5, W.z + 5);
    spawn('stone_sentinel', CR.x - 5, CR.z + 2); spawn('stone_sentinel', CR.x + 7, CR.z + 3);
    spawn('crag_troll', CR.x - 9, CR.z - 4); spawn('crag_troll', CR.x + 9, CR.z - 6);
    // the Old Wood's own: oakhearts, and a sea-draugr walked up from the Wrack (islands past 50 mix their levels)
    spawn('oakheart', OW.x + 2, OW.z + 4); spawn('oakheart', OW.x - 6, OW.z - 2); spawn('sea_draugr', OW.x + 6, OW.z - 5);
  } else if (long) {
    // Longstrand: the Finfolk at their haaf and along the shingle; their finwives in drowned Stiltwick; sentinels on the dunes
    for (const [dx, dz] of [[4, -3], [8, 4], [12, -1]]) spawn('finfolk', NL.haaf.x + dx, NL.haaf.z + dz);
    for (const [dx, dz] of [[-8, -4], [6, 6]]) spawn('finwife', NL.stiltwick.x + dx, NL.stiltwick.z + dz);
    for (const [dx, dz] of [[-6, 2], [5, -2]]) spawn('finfolk', NL.netting.x + dx, NL.netting.z + dz);
    spawn('stone_sentinel', NL.dunes.x + 4, NL.dunes.z - 3);
    spawn('oakheart', NL.dunes.x - 8, NL.dunes.z + 3);
  } else if (salt) {
    // Saltglass: glass crabs on the beaches, reflections round the pools and the Mirror, sentinels in the dunes
    for (let k = 0; k < 4; k++) { const [x, z] = saltPoint(130 + k * 14, 3.5); spawn('glass_crab', x, z); }
    for (let k = 0; k < 2; k++) { const [x, z] = saltPoint(20 + k * 14, 3.5); spawn('glass_crab', x, z); }
    for (const [dx, dz] of [[10, -4], [-2, 10], [8, 8]]) spawn('reflection', MIRROR_POOL.x + dx, MIRROR_POOL.z + dz);
    for (const [dx, dz] of [[-9, 4], [9, 5]]) spawn('reflection', GL.mirror.x + dx, GL.mirror.z + dz);
    for (const [dx, dz] of [[-6, -4], [6, 6]]) spawn('stone_sentinel', GL.dunes.x + dx, GL.dunes.z + dz);
    for (const [dx, dz] of [[2, 4], [-6, -2]]) spawn('oakheart', GL.grove.x + dx, GL.grove.z + dz);
  } else if (lock) {
    // Lockhaven: the island's old wardens and the ones who came for the doors
    const DF = KL.doorfield, FG = KL.forges, KW = KL.keywood, SH = KL.shore;
    // the forges' stone sentinels still keep them; Hale's crew wait on the shore ("I'll be waiting at every one")
    for (const [dx, dz] of [[-5, 4], [6, 2], [0, -7]]) spawn('stone_sentinel', FG.x + dx, FG.z + dz);
    for (const [dx, dz] of [[-6, -2], [-2, 6]]) spawn('undertow_deckhand', SH.x + dx, SH.z + dz);
    for (let k = 0; k < 3; k++) { const [x, z] = lockPoint(352 + k * 12, 3.5); spawn('lockshell_crab', x, z); }
    // the Keywood's oakhearts; the Hushed listening at the doors in the field
    for (const [dx, dz] of [[2, 4], [-6, -3], [-10, 6]]) spawn('oakheart', KW.x + dx, KW.z + dz);
    for (const [dx, dz] of [[-12, -2], [10, -6], [-4, -12]]) spawn('hushed_pilgrim', DF.x + dx, DF.z + dz);
    // and among the Houses' doors, a few that aren't doors any more
    for (const [dx, dz] of [[-14, 6], [14, 6], [6, -14]]) spawn('lockjaw', DF.x + dx, DF.z + dz);
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
  const rounds: { look: string; stops: [number, number][] }[] = amb ? [
    // Tollhouse Landing: a porter between the quay and the market, a carter out toward the poachers' track
    { look: 'towns_d', stops: [[AL.dockBase.x - 2, AL.dockBase.z - 3], [AL.landing.x + 5, AL.landing.z + 5], [AL.landing.x - 4, AL.landing.z - 2], [AL.landing.x + 2, AL.landing.z - 9]] },
    { look: 'towns_a', stops: [[AL.landing.x - 6, AL.landing.z + 6], [AL.landing.x + 8, AL.landing.z - 4], [(AL.landing.x + AL.camp.x) / 2, (AL.landing.z + AL.camp.z) / 2]] },
  ] : lock || salt || long ? [] : wrack ? [
    // Gallows Landing: a lookout walking the yard, a smith's boy fetching from the quay
    { look: 'towns_e', stops: [[WL.landing.x - 5, WL.landing.z + 5], [WL.landing.x + 5, WL.landing.z - 7], [WL.dockBase.x + 2, WL.dockBase.z - 3]] },
    { look: 'towns_b', stops: [[WL.landing.x - 3, WL.landing.z + 3], [WL.landing.x + 7, WL.landing.z + 1], [WL.landing.x - 7, WL.landing.z - 7]] },
  ] : bell ? [
    ...BELL_ROUNDS,
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

  const home = bell ? { x: 0, z: V.z + 6 } : sun ? { x: P.x, z: P.z + 2 } : amb ? { x: AL.landing.x, z: AL.landing.z + 2 } : lock ? { x: KL.landing.x, z: KL.landing.z + 2 } : salt ? { x: GL.landing.x, z: GL.landing.z + 2 } : long ? { x: NL.landing.x, z: NL.landing.z + 2 } : { x: WL.landing.x, z: WL.landing.z + 2 };
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
