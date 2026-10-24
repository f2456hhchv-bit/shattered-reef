import { mulberry32 } from '../../art/noise';
import { TOWN, LAYOUT, LAGOON, SEA_SPOTS, PATHS, BEACH, coastPoint, coastDist, nearestPathDist, FLATS } from './island';
import { World } from './world';
import { buildingSolids, doorPoints, toLocal, toWorld, type BuildingDef } from './buildings';

// Everything placed on Bellwether, derived deterministically. Shared by simulation and renderer.

export type BuildingKind = 'tent' | 'smithy';
export interface Building { kind: BuildingKind; x: number; z: number; rot: number; w: number; d: number; seed: number }
/** `scenery` nodes are the island's ordinary trees, boulders, bushes and kelp: drawn instanced, still usable. */
export interface NodePlacement { uid: string; def: string; x: number; z: number; seed: number; scenery?: boolean; s?: number; rot?: number }
export type DecorKind = 'leviathan' | 'crater' | 'netrack' | 'rowboat' | 'signpost' | 'fence' | 'well' | 'driftwood' | 'shells' | 'pots' | 'cannon' | 'wreck' | 'woodpile' | 'flowers';
export interface Prop { kind: 'pine' | 'broadleaf' | 'rock' | 'crate' | 'barrel' | 'lantern' | 'pillar' | 'campfire' | DecorKind; x: number; z: number; rot: number; s: number; seed: number; aux?: number[] }
export interface SpawnPoint { enemy: string; x: number; z: number }

export interface IslandLayout {
  world: World;
  dock: { x: number; zStart: number; len: number; headWidth: number; deckY: number; headZ: number };
  mooring: { x: number; z: number; heading: number };
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
  ruin: { x: number; z: number; r: number };
  plinth: { x: number; z: number };
  respawn: { x: number; z: number };
}

export function buildIsland(seed = 1): IslandLayout {
  const rnd = mulberry32(seed);
  const world = new World();
  const V = LAYOUT.village;

  // ---- dock: walk out from the beach until the water is deep enough for the ship
  const deckY = 1.0;
  const zStart = LAYOUT.dockBase.z - 1.5;
  let len = 8;
  while (len < 30 && world.ground(0, zStart + len + 4) > -2.2) len += 1;
  const headZ = zStart + len;
  const headWidth = 9;
  world.decks.push({ x: 0, z: zStart + len / 2, w: 2.4, d: len, y: deckY });
  world.decks.push({ x: 0, z: headZ + 1.0, w: headWidth, d: 2.2, y: deckY });
  const mooring = { x: 0.6, z: headZ + 2.1 + 1.45 + 1.1, heading: 0 };

  // ---- village
  const buildings: Building[] = [
    { kind: 'smithy', x: LAYOUT.smithy.x, z: LAYOUT.smithy.z, rot: 0, w: 5, d: 3.6, seed: 15 },
  ];
  const C = LAYOUT.camp;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    buildings.push({ kind: 'tent', x: C.x + Math.cos(a) * 4.2, z: C.z + Math.sin(a) * 4.2, rot: -a + Math.PI / 2, w: 2.6, d: 3.0, seed: 20 + k });
  }
  for (const b of buildings) {
    if (b.kind === 'smithy') continue; // open-sided: stations are the solids
    world.solids.push({ x: b.x, z: b.z, w: b.w + 0.3, d: b.d + 0.3, rot: b.rot });
  }

  const S = LAYOUT.smithy;
  const stations: IslandLayout['stations'] = [
    { id: 'furnace', x: S.x + 1.4, z: S.z - 0.6 },
    { id: 'anvil', x: S.x - 1.4, z: S.z + 0.4 },
    { id: 'fire', x: LAYOUT.cookfire.x, z: LAYOUT.cookfire.z },
    { id: 'bench', x: S.x + 4.2, z: S.z + 1.2 },
    // outlying camps: a forge at the foot of Ironcrag, cookfires at the fen and the cove
    { id: 'furnace', x: LAYOUT.peak.x + 9, z: LAYOUT.peak.z + 19 },
    { id: 'anvil', x: LAYOUT.peak.x + 6, z: LAYOUT.peak.z + 20.5 },
    { id: 'fire', x: LAYOUT.fen.x + 2.5, z: LAYOUT.fen.z + 3 },
    { id: 'fire', x: LAYOUT.cove.x - 2.5, z: LAYOUT.cove.z + 1.5 },
    // the vent forge on Ironcrag's summit: the only heat that melts Cinderite
    { id: 'vent', x: LAYOUT.summit.x, z: LAYOUT.summit.z },
  ];
  // strongboxes: one at the quay, one at the Ironcrag mining camp
  const bankB = TOWN.buildings.find((x) => x.id === 'bank')!, [bkx, bkz] = toWorld(bankB, 0, 0.1);
  const banks: IslandLayout['banks'] = [{ x: V.x + 4.6, z: V.z + 2.2 }, { x: LAYOUT.peak.x + 2.5, z: LAYOUT.peak.z + 21 }, { x: bkx, z: bkz, booth: true }];
  for (const b of banks) if (!b.booth) world.solids.push({ x: b.x, z: b.z, w: 1.2, d: 0.8 });
  const solidOf = { furnace: 1.0, anvil: 0.45, fire: 0.7, vent: 1.2 } as const;
  for (const st of stations) world.solids.push(st.id === 'bench' ? { x: st.x, z: st.z, w: 1.8, d: 0.9 } : { x: st.x, z: st.z, r: solidOf[st.id] });

  // the town: walls and furniture are solid; townsfolk stand at their posts inside
  for (const tb of TOWN.buildings) world.solids.push(...buildingSolids(tb));
  const inside = (id: string, lx: number, lz: number) => { const tb = TOWN.buildings.find((x) => x.id === id)!; const [x, z] = toWorld(tb, lx, lz); return { x, z, facing: Math.atan2(Math.cos(tb.rot), -Math.sin(tb.rot)) }; };
  for (const s of TOWN.stalls) world.solids.push({ x: s.x, z: s.z, w: 2.4, d: 1.4, rot: s.rot });
  const DB = LAYOUT.dockBase, X = LAYOUT.crossroads;
  const npcs = [
    ...TOWN.npcs.map((n) => ({ id: n.id, ...inside(n.building, n.x, n.z) })),
    { id: 'wynn', x: DB.x + 3.2, z: DB.z - 1.0, facing: Math.PI / 2 },
    { id: 'watch_n', x: X.x + 0.6, z: X.z - 9.5, facing: Math.PI / 2 },
    { id: 'watch_e', x: X.x + 11, z: X.z + 2.5, facing: Math.PI },
    { id: 'bram', x: S.x - 1.4, z: S.z + 1.9, facing: Math.PI / 2 },
  ];
  for (const n of npcs) world.solids.push({ x: n.x, z: n.z, r: 0.35 });

  // ---- ruin: ring of broken pillars around a bell plinth, walled with fallen masonry (mineable like any rock;
  // mining only changes its look, the wall stays)
  const rubble: { x: number; z: number; rot: number; s: number; seed: number }[] = [];
  const R = LAYOUT.ruin;
  const props: Prop[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    if (k === 2) continue; // the "broken" gap faces the path
    const px = R.x + Math.cos(a) * 7, pz = R.z + Math.sin(a) * 7;
    props.push({ kind: 'pillar', x: px, z: pz, rot: a, s: 0.7 + rnd() * 0.6, seed: 400 + k });
    world.solids.push({ x: px, z: pz, r: 0.75 });
    // fallen masonry closes the ring between pillars, so a fight stays in the arena; the gap is the way in
    if (k === 1) continue;
    for (const f of [1 / 3, 2 / 3]) {
      const b = a + (f * Math.PI * 2) / 9;
      const rx = R.x + Math.cos(b) * 7, rz = R.z + Math.sin(b) * 7, s = 0.7 + rnd() * 0.25;
      rubble.push({ x: rx, z: rz, rot: rnd() * 6.28, s, seed: 500 + k * 2 + Math.round(f * 3) });
      world.solids.push({ x: rx, z: rz, r: 0.95 });
    }
  }
  // bell plinth sits just inside the gap, so the arena centre stays clear
  const plinth = { x: R.x, z: R.z + 4.6 };
  world.solids.push({ x: plinth.x, z: plinth.z, r: 0.7 });

  // ---- resource nodes
  const nodes: NodePlacement[] = [];
  let uid = 0;
  for (const r of rubble) nodes.push({ uid: `n${uid++}`, def: 'rock_boulder', x: r.x, z: r.z, seed: r.seed, scenery: true, s: r.s, rot: r.rot });
  // inside (or within `m` of) a town building's walls, in front of its door, or on a market stall / the square
  const nearTown = (x: number, z: number, m: number, square = true) => {
    for (const tb of TOWN.buildings) {
      const [lx, lz] = toLocal(tb, x, z);
      if (Math.abs(lx) < tb.w / 2 + m && Math.abs(lz) < tb.d / 2 + m) return true;
      const o = doorPoints(tb).out;
      if (Math.hypot(x - o[0], z - o[1]) < m + 1.6) return true;
    }
    for (const st of TOWN.stalls) if (Math.hypot(x - st.x, z - st.z) < m + 1.6) return true;
    return square && Math.hypot(x - TOWN.square.x, z - TOWN.square.z) < TOWN.square.r + m;
  };
  const free = (x: number, z: number, minCoast = 4, clearance = 2.2) => {
    if (coastDist(x, z) < minCoast) return false;
    const p = nearestPathDist(x, z);
    if (p.d < p.width + 1.2) return false;
    for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 2) return false;
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) + 1.5) return false;
    if (nearTown(x, z, 2.5)) return false;
    for (const n of nodes) if (Math.hypot(x - n.x, z - n.z) < clearance) return false;
    for (const pr of props) if (Math.hypot(x - pr.x, z - pr.z) < clearance) return false;
    for (const st of [...stations, ...banks]) if (Math.hypot(x - st.x, z - st.z) < 3.5) return false;
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
      made++;
    }
  };
  const F = LAYOUT.forest, H = LAYOUT.hills, GV = LAYOUT.grove;
  scatter('tree_pine', F.x + 4, F.z + 4, 12, 16, 3.2);
  scatter('tree_oak', GV.x, GV.z, 8, 7, 3.6);
  scatter('rock_copper', H.x - 6, H.z + 5, 6, 5, 2.4);
  scatter('rock_tin', H.x - 2, H.z + 8, 6, 5, 2.4);
  scatter('rock_iron', H.x + 3, H.z - 2, 5, 3, 2.6);
  // Mirewater Fen: willows ring the lagoon
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    scatter('tree_willow', LAGOON.x + Math.cos(a) * (LAGOON.r + 6), LAGOON.z + Math.sin(a) * (LAGOON.r + 6), 3, 1, 3.4);
  }
  // Heartwood: the deeper you go, the older the trees
  const HW = LAYOUT.heartwood;
  scatter('tree_amber', HW.x + 6, HW.z + 8, 10, 6, 3.6);
  scatter('tree_yew', HW.x - 2, HW.z - 2, 8, 5, 4);
  scatter('tree_star', HW.x - 9, HW.z - 7, 6, 3, 4.2);
  scatter('tree_cedar', HW.x - 14, HW.z + 2, 6, 2, 4.6);
  // Ironcrag: coal and gold at the foot, stormsilver and abyssite up the slopes
  const M = LAYOUT.peak;
  scatter('rock_coal', M.x - 8, M.z + 15, 7, 6, 2.6);
  scatter('rock_coal', M.x + 13, M.z + 12, 5, 3, 2.6);
  scatter('rock_gold', M.x + 15, M.z + 7, 5, 3, 2.8);
  scatter('rock_storm', M.x - 6, M.z + 5, 6, 4, 2.8);
  scatter('rock_abyss', M.x + 4, M.z - 3, 6, 3, 3);
  // Wreckers' Point: tidecore veins in the rocks
  scatter('rock_tide', LAYOUT.wreck.x - 3, LAYOUT.wreck.z + 3, 7, 3, 3);
  // the high metals: Cinderite vents round the summit forge, fallen stars at Starfall
  scatter('rock_cinder', LAYOUT.summit.x, LAYOUT.summit.z, 10, 3, 3);
  scatter('rock_sky', LAYOUT.starfall.x, LAYOUT.starfall.z, 6, 3, 3.2);
  // Leviathan's Rest: the bones lie along the islet's crown (no free() here: it's off the main coast)
  const IS = LAYOUT.islet;
  for (let k = 0, made = 0; k < 40 && made < 3; k++) {
    const a = k * 2.1, r = 3.5 + (k % 3) * 1.5, x = IS.x + Math.cos(a) * r, z = IS.z + Math.sin(a) * r;
    if (world.ground(x, z) < 0.6 || nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 3.2)) continue;
    nodes.push({ uid: `n${uid++}`, def: 'rock_levi', x, z, seed: 900 + k });
    made++;
  }
  for (const n of nodes) world.solids.push({ x: n.x, z: n.z, r: n.def.startsWith('tree') ? 0.45 : 0.75 });

  // fishing: sprats off the dock head (reachable on foot), shore spots found by walking from land into water
  nodes.push({ uid: `n${uid++}`, def: 'spot_sprat', x: -headWidth / 2 - 1.6, z: headZ + 1.0, seed: 1 });
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
  // lagoon: walk inward from the shore toward the centre
  const lagoonIn = (a: number) => [LAGOON.x + Math.cos(a) * (LAGOON.r + 6), LAGOON.z + Math.sin(a) * (LAGOON.r + 6), a + Math.PI] as const;
  for (const [a, def] of [[0.2, 'spot_trout'], [1.6, 'spot_trout'], [3.4, 'spot_salmon'], [4.8, 'spot_salmon']] as const) { const [fx, fz, ang] = lagoonIn(a); placeShore(def, fx, fz, [ang]); }
  const outward = (p: { x: number; z: number }) => Math.atan2(p.z, p.x);
  placeShore('spot_lobster', LAYOUT.cove.x, LAYOUT.cove.z, [outward(LAYOUT.cove) - 0.5, outward(LAYOUT.cove) + 0.5, outward(LAYOUT.cove)]);
  placeShore('spot_gloom', LAYOUT.wreck.x, LAYOUT.wreck.z, [outward(LAYOUT.wreck) - 0.6, outward(LAYOUT.wreck) + 0.6]);
  // the Drowned Spire stands in open water: mined from the deck
  nodes.push({ uid: `n${uid++}`, def: 'rock_ori', x: LAYOUT.spire.x, z: LAYOUT.spire.z, seed: 77 });
  for (const [def, list] of Object.entries(SEA_SPOTS)) for (const [deg, inset] of list) {
    const [x, z] = coastPoint(deg, inset);
    nodes.push({ uid: `n${uid++}`, def, x, z, seed: deg });
  }

  // ---- reefs / sea stacks
  const reefs: IslandLayout['reefs'] = [];
  for (let tries = 0; tries < 600 && reefs.length < 22; tries++) {
    const [x, z] = coastPoint(rnd() * 360, -(4 + rnd() * 26));
    if (Math.hypot(x - mooring.x, z - mooring.z) < 18) continue;
    if (nodes.some((n) => (n.def.startsWith('spot_') || n.def === 'rock_ori') && Math.hypot(n.x - x, n.z - z) < 9)) continue;
    if (Math.hypot(x - LAYOUT.islet.x, z - LAYOUT.islet.z) < 24) continue; // keep the islet's landing clear
    if (world.ground(x, z) > -0.6) continue;
    reefs.push({ x, z, r: 0.8 + rnd() * 1.2 });
  }
  world.reefs.push(...reefs);

  // ---- decorative vegetation and rocks (solid): woods are dense, open country is sparse
  const woods = [{ x: F.x, z: F.z, r: 20 }, { x: GV.x, z: GV.z, r: 13 }, { x: LAYOUT.heartwood.x, z: LAYOUT.heartwood.z, r: 20 }, { x: LAYOUT.fen.x, z: LAYOUT.fen.z, r: 16 }];
  const keepClear = [{ x: LAYOUT.starfall.x, z: LAYOUT.starfall.z, r: 10 }, { x: R.x, z: R.z, r: 11 }, { x: C.x, z: C.z, r: 9 }, { x: LAYOUT.cove.x, z: LAYOUT.cove.z, r: 9 }, { x: LAYOUT.crossroads.x, z: LAYOUT.crossroads.z, r: 6 }];
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
  for (let tries = 0, made = 0; tries < 2400 && made < 80; tries++) {
    const a = rnd() * Math.PI * 2, r = 15 + rnd() * 75;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z, 1, 2)) continue;
    const s = 0.35 + rnd() * 0.7;
    // every rock on the island can be mined
    nodes.push({ uid: `n${uid++}`, def: 'rock_boulder', x, z, seed: Math.floor(rnd() * 1e6), scenery: true, s, rot: rnd() * 6.28 });
    world.solids.push({ x, z, r: Math.max(0.45, s * 0.9) });
    made++;
  }

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
  // kelp beds just off the beaches, all the way round
  for (let deg = 0; deg < 360; deg += 9) {
    const [lx, lz] = coastPoint(deg + rnd() * 6, 6);
    const p = shoreSpot(lx, lz, Math.atan2(lz, lx), -0.04); // kelp likes the shallows
    if (p && Math.hypot(p[0] - mooring.x, p[1] - mooring.z) > 14 && !nodes.some((n) => Math.hypot(n.x - p[0], n.z - p[1]) < 6))
      nodes.push({ uid: `n${uid++}`, def: 'kelp_bed', x: p[0], z: p[1], seed: deg, scenery: true, s: 0.9 + rnd() * 0.3, rot: rnd() * 6.28 });
  }
  // disturbed sand: candidate dig spots on beaches and dirt tracks (only a few are active at a time)
  for (let k = 0, made = 0; k < 400 && made < 30; k++) {
    let x: number, z: number;
    if (k % 2) { const [cx, cz] = coastPoint(rnd() * 360, 2.5 + rnd() * 3); x = cx; z = cz; }
    else { const pth = PATHS[Math.floor(rnd() * PATHS.length)]; const i = Math.floor(rnd() * (pth.pts.length - 1)); const t = rnd(); x = pth.pts[i][0] + (pth.pts[i + 1][0] - pth.pts[i][0]) * t + (rnd() - 0.5) * 3; z = pth.pts[i][1] + (pth.pts[i + 1][1] - pth.pts[i][1]) * t + (rnd() - 0.5) * 3; }
    if (world.ground(x, z) < 0.3 || Math.hypot(x - V.x, z - V.z) < 20) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 4) || props.some((p) => Math.hypot(p.x - x, p.z - z) < 2)) continue;
    nodes.push({ uid: `n${uid++}`, def: 'dig_spot', x, z, seed: k });
    made++;
  }

  // village dressing
  const dress: [Prop['kind'], number, number][] = [
    ['crate', -2.6, LAYOUT.dockBase.z - 1.8], ['crate', -2.9, LAYOUT.dockBase.z - 2.7], ['barrel', 2.4, LAYOUT.dockBase.z - 2.6], ['barrel', 3.0, LAYOUT.dockBase.z - 2.0],
    ['lantern', 2.0, LAYOUT.dockBase.z - 1.0], ['lantern', -6, V.z + 2], ['lantern', 7, V.z - 1], ['lantern', S.x + 3.2, S.z + 2.4],
    ['campfire', C.x, C.z], ['crate', C.x + 1.8, C.z - 1.5], ['barrel', C.x - 2, C.z + 1.2],
  ];
  for (const [kind, x, z] of dress) {
    props.push({ kind, x, z, rot: rnd() * 6.28, s: 1, seed: Math.floor(rnd() * 1e6) });
    world.solids.push({ x, z, r: kind === 'lantern' ? 0.2 : 0.5 });
  }

  // ---- set dressing: quay gear, village life, beachcombing, the cove's guns and an old wreck. Nothing may
  // crowd a path, a door, a station, a person or anything you can use.
  const clearOf = (x: number, z: number, r: number) => {
    const p = nearestPathDist(x, z);
    if (p.d < p.width + r + 0.6) return false;
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) * 0.75 + r + 1.2) return false;
    if (nearTown(x, z, r + 0.8, false)) return false;
    for (const q of [...stations, ...banks, ...npcs]) if (Math.hypot(x - q.x, z - q.z) < r + 2.6) return false;
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
  decor('netrack', DB.x - 6.5, DB.z - 1.5, 1.3, 0.15, true);
  decor('pots', DB.x + 5.5, DB.z - 1.2, 0.8, -0.3, true);
  decor('cannon', DB.x - 9, DB.z - 3.5, 0.7, -0.2, true); // muzzles out to sea (+z)
  decor('cannon', DB.x + 9, DB.z - 3.5, 0.7, 0.2, true);
  decor('well', V.x - 6, V.z - 7, 1.0, 0.3, true);
  decor('woodpile', S.x + 4.5, S.z - 2, 0.8, -0.4, true);
  const cw = TOWN.buildings.find((x) => x.id === 'cottage_w')!, ce = TOWN.buildings.find((x) => x.id === 'cottage_e')!;
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
  // beachcombing: driftwood and shells all round the shore, flowers in the meadows
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
  // the leviathan's skeleton (the bones you mine are the loose ones) and the star's scorched crater
  props.push({ kind: 'leviathan', x: LAYOUT.islet.x, z: LAYOUT.islet.z, rot: 0.6, s: 1, seed: 5 });
  world.solids.push({ x: LAYOUT.islet.x, z: LAYOUT.islet.z, r: 1.4 });
  props.push({ kind: 'crater', x: LAYOUT.starfall.x, z: LAYOUT.starfall.z, rot: 0, s: 1, seed: 6 });
  for (let k = 0, made = 0; k < 200 && made < 30; k++) {
    const a = rnd() * Math.PI * 2, r = 10 + rnd() * 55, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (coastDist(x, z) < BEACH + 2 || world.ground(x, z) > 6) continue;
    if (decor('flowers', x, z, 0.4, 0, false)) made++;
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
  for (let k = 0; k < 6; k++) { const [x, z] = coastPoint(118 + k * 9, 3 + (k % 2) * 2.5); spawn('reef_crab', x, z); }
  for (let k = 0; k < 3; k++) { const [x, z] = coastPoint(62 + k * 8, 3.5); spawn('reef_crab', x, z); }
  spawn('brigand', C.x - 2.5, C.z + 2); spawn('brigand', C.x + 2.5, C.z + 1.5); spawn('brigand', C.x, C.z - 2.5);
  spawn('gunner', C.x + 4, C.z - 3); spawn('gunner', C.x - 5, C.z - 1);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.7; spawn('mire_crab', LAGOON.x + Math.cos(a) * (LAGOON.r + 2.5), LAGOON.z + Math.sin(a) * (LAGOON.r + 2.5)); }
  const SC = LAYOUT.cove;
  spawn('smuggler', SC.x - 3, SC.z - 2); spawn('smuggler', SC.x + 2, SC.z - 4); spawn('smuggler', SC.x - 5, SC.z - 6);
  spawn('smuggler_gunner', SC.x + 4, SC.z - 1); spawn('smuggler_gunner', SC.x - 1, SC.z - 8);
  spawn('ironshell_crab', M.x - 12, M.z + 18); spawn('ironshell_crab', M.x - 3, M.z + 19); spawn('ironshell_crab', M.x + 16, M.z + 14); spawn('ironshell_crab', M.x - 14, M.z + 11);
  spawn('poacher', HW.x + 2, HW.z + 4); spawn('poacher', HW.x - 6, HW.z); spawn('poacher', HW.x + 8, HW.z - 4);
  spawn('poacher_gunner', HW.x - 2, HW.z + 10); spawn('poacher_gunner', HW.x - 10, HW.z - 3);
  const W = LAYOUT.wreck;
  spawn('drowned', W.x - 4, W.z + 2); spawn('drowned', W.x + 2, W.z + 4); spawn('drowned', W.x - 8, W.z + 6); spawn('drowned', W.x - 2, W.z + 9);
  spawn('wreck_captain', W.x - 5, W.z + 5);
  spawn('stone_sentinel', M.x - 5, M.z - 1); spawn('stone_sentinel', M.x + 7, M.z + 1);

  // townsfolk walking their rounds between the squares and front doors (paths found once, on the baked grid)
  const door = (id: string) => doorPoints(TOWN.buildings.find((b) => b.id === id)!).out;
  const rounds: { look: string; stops: [number, number][] }[] = [
    { look: 'towns_a', stops: [[X.x - 4, X.z + 2], door('inn'), [X.x - 22, X.z + 1], door('house_2'), [X.x - 6, X.z + 8]] },
    { look: 'towns_b', stops: [[X.x + 4, X.z - 2], door('bank'), door('chapel'), [X.x + 25, X.z + 1], door('house_3')] },
    { look: 'towns_c', stops: [[V.x + 2, V.z + 1], door('chart'), [V.x + 2, V.z - 10], [X.x + 1.5, X.z + 6], door('store')] },
    { look: 'towns_d', stops: [[V.x - 3, V.z + 9], door('tackle'), door('warehouse'), [V.x - 14, V.z + 1.6], [DB.x - 2, DB.z - 2]] },
    { look: 'towns_e', stops: [door('hall'), door('house_4'), [X.x + 3, X.z - 12], door('house_1'), door('house_5')] },
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

  const respawnPt = world.nearestWalkable(0, V.z + 6, 6) ?? [0, V.z + 6];
  return {
    world,
    dock: { x: 0, zStart, len, headWidth, deckY, headZ },
    mooring,
    buildings,
    nodes,
    props,
    reefs,
    stations,
    banks,
    town: TOWN.buildings,
    stalls: TOWN.stalls,
    wanderers,
    npcs,
    spawns,
    ruin: { x: R.x, z: R.z, r: 7 },
    plinth,
    respawn: { x: respawnPt[0], z: respawnPt[1] },
  };
}
