import { mulberry32 } from '../../art/noise';
import { LAYOUT, LAGOON, SEA_SPOTS, coastPoint, coastDist, nearestPathDist, FLATS } from './island';
import { World } from './world';

// Everything placed on Bellwether, derived deterministically. Shared by simulation and renderer.

export type BuildingKind = 'store' | 'chart' | 'house' | 'tent' | 'smithy';
export interface Building { kind: BuildingKind; x: number; z: number; rot: number; w: number; d: number; seed: number }
export interface NodePlacement { uid: string; def: string; x: number; z: number; seed: number }
export interface Prop { kind: 'pine' | 'broadleaf' | 'rock' | 'crate' | 'barrel' | 'lantern' | 'pillar' | 'campfire'; x: number; z: number; rot: number; s: number; seed: number }
export interface SpawnPoint { enemy: string; x: number; z: number }

export interface IslandLayout {
  world: World;
  dock: { x: number; zStart: number; len: number; headWidth: number; deckY: number; headZ: number };
  mooring: { x: number; z: number; heading: number };
  buildings: Building[];
  nodes: NodePlacement[];
  props: Prop[];
  reefs: { x: number; z: number; r: number }[];
  stations: { id: 'furnace' | 'anvil' | 'fire' | 'bench'; x: number; z: number }[];
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
    { kind: 'store', x: LAYOUT.store.x, z: LAYOUT.store.z, rot: 0.08, w: 4.6, d: 3.8, seed: 11 },
    { kind: 'chart', x: LAYOUT.chartHouse.x, z: LAYOUT.chartHouse.z, rot: -0.12, w: 4.2, d: 3.4, seed: 12 },
    { kind: 'house', x: V.x - 19, z: V.z + 3, rot: 0.35, w: 4.0, d: 3.2, seed: 13 },
    { kind: 'house', x: V.x + 21, z: V.z - 7, rot: -0.4, w: 4.0, d: 3.2, seed: 14 },
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
  ];
  const solidOf = { furnace: 1.0, anvil: 0.45, fire: 0.7 } as const;
  for (const st of stations) world.solids.push(st.id === 'bench' ? { x: st.x, z: st.z, w: 1.8, d: 0.9 } : { x: st.x, z: st.z, r: solidOf[st.id] });

  const npcs = [
    { id: 'iven', x: LAYOUT.chartHouse.x - 0.5, z: LAYOUT.chartHouse.z + 3.2, facing: Math.PI / 2 },
    { id: 'marta', x: LAYOUT.store.x + 0.6, z: LAYOUT.store.z + 3.3, facing: Math.PI / 2 },
    { id: 'bram', x: S.x - 1.4, z: S.z + 1.9, facing: Math.PI / 2 },
  ];
  for (const n of npcs) world.solids.push({ x: n.x, z: n.z, r: 0.35 });

  // ---- ruin: ring of broken pillars around a bell plinth
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
      props.push({ kind: 'rock', x: rx, z: rz, rot: rnd() * 6.28, s, seed: 500 + k * 2 + Math.round(f * 3) });
      world.solids.push({ x: rx, z: rz, r: 0.95 });
    }
  }
  // bell plinth sits just inside the gap, so the arena centre stays clear
  const plinth = { x: R.x, z: R.z + 4.6 };
  world.solids.push({ x: plinth.x, z: plinth.z, r: 0.7 });

  // ---- resource nodes
  const nodes: NodePlacement[] = [];
  let uid = 0;
  const free = (x: number, z: number, minCoast = 4, clearance = 2.2) => {
    if (coastDist(x, z) < minCoast) return false;
    const p = nearestPathDist(x, z);
    if (p.d < p.width + 1.2) return false;
    for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 2) return false;
    for (const b of buildings) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) + 1.5) return false;
    for (const n of nodes) if (Math.hypot(x - n.x, z - n.z) < clearance) return false;
    for (const pr of props) if (Math.hypot(x - pr.x, z - pr.z) < clearance) return false;
    for (const st of stations) if (Math.hypot(x - st.x, z - st.z) < 3.5) return false;
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
  for (const n of nodes) world.solids.push({ x: n.x, z: n.z, r: n.def.startsWith('tree') ? 0.45 : 0.75 });

  // fishing: sprats off the dock head (reachable on foot), shore spots found by walking from land into water
  nodes.push({ uid: `n${uid++}`, def: 'spot_sprat', x: -headWidth / 2 - 1.6, z: headZ + 1.0, seed: 1 });
  const shoreSpot = (fx: number, fz: number, ang: number): [number, number] | null => {
    let lastLand: [number, number] | null = null;
    for (let r = 0; r < 40; r += 0.25) {
      const x = fx + Math.cos(ang) * r, z = fz + Math.sin(ang) * r, h = world.ground(x, z);
      if (h > 0.16) lastLand = [x, z]; // walkable shore
      else if (h < -0.35 && lastLand) {
        if (Math.hypot(x - lastLand[0], z - lastLand[1]) > 2.4) return null; // shelving shore: too far to cast
        return [x + Math.cos(ang) * 0.3, z + Math.sin(ang) * 0.3];
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
  for (const [def, list] of Object.entries(SEA_SPOTS)) for (const [deg, inset] of list) {
    const [x, z] = coastPoint(deg, inset);
    nodes.push({ uid: `n${uid++}`, def, x, z, seed: deg });
  }

  // ---- reefs / sea stacks
  const reefs: IslandLayout['reefs'] = [];
  for (let tries = 0; tries < 600 && reefs.length < 22; tries++) {
    const [x, z] = coastPoint(rnd() * 360, -(4 + rnd() * 26));
    if (Math.hypot(x - mooring.x, z - mooring.z) < 18) continue;
    if (nodes.some((n) => n.def.startsWith('spot_') && Math.hypot(n.x - x, n.z - z) < 9)) continue;
    if (world.ground(x, z) > -0.6) continue;
    reefs.push({ x, z, r: 0.8 + rnd() * 1.2 });
  }
  world.reefs.push(...reefs);

  // ---- decorative vegetation and rocks (solid): woods are dense, open country is sparse
  const woods = [{ x: F.x, z: F.z, r: 20 }, { x: GV.x, z: GV.z, r: 13 }, { x: LAYOUT.heartwood.x, z: LAYOUT.heartwood.z, r: 20 }, { x: LAYOUT.fen.x, z: LAYOUT.fen.z, r: 16 }];
  const keepClear = [{ x: R.x, z: R.z, r: 11 }, { x: C.x, z: C.z, r: 9 }, { x: LAYOUT.cove.x, z: LAYOUT.cove.z, r: 9 }, { x: LAYOUT.crossroads.x, z: LAYOUT.crossroads.z, r: 6 }];
  for (let tries = 0, made = 0; tries < 9000 && made < 260; tries++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 92;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const inWood = woods.some((w) => Math.hypot(x - w.x, z - w.z) < w.r);
    if (!inWood && rnd() < 0.6) continue;
    if (!free(x, z, 7, 2.6)) continue;
    if (keepClear.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
    if (Math.hypot(x - H.x, z - H.z) < 12 && rnd() < 0.7) continue;
    const gy = world.ground(x, z);
    if (gy < 0.5 || gy > 9) continue; // nothing on the bare upper peak
    const kind = inWood || rnd() < 0.6 ? 'pine' : 'broadleaf';
    props.push({ kind, x, z, rot: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.35, seed: Math.floor(rnd() * 1e6) });
    world.solids.push({ x, z, r: 0.45 });
    made++;
  }
  for (let tries = 0, made = 0; tries < 2400 && made < 80; tries++) {
    const a = rnd() * Math.PI * 2, r = 15 + rnd() * 75;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z, 1, 2)) continue;
    const s = 0.35 + rnd() * 0.7;
    props.push({ kind: 'rock', x, z, rot: rnd() * 6.28, s, seed: Math.floor(rnd() * 1e6) });
    if (s > 0.6) world.solids.push({ x, z, r: s * 0.9 });
    made++;
  }

  // village dressing
  const dress: [Prop['kind'], number, number][] = [
    ['crate', -2.6, LAYOUT.dockBase.z - 1.8], ['crate', -2.9, LAYOUT.dockBase.z - 2.7], ['barrel', 2.4, LAYOUT.dockBase.z - 2.6], ['barrel', 3.0, LAYOUT.dockBase.z - 2.0],
    ['lantern', 2.0, LAYOUT.dockBase.z - 1.0], ['lantern', -6, V.z + 2], ['lantern', 7, V.z - 1], ['lantern', S.x + 3.2, S.z + 2.4],
    ['barrel', LAYOUT.store.x - 3, LAYOUT.store.z + 2.5], ['crate', LAYOUT.store.x + 3.2, LAYOUT.store.z + 2.2],
    ['campfire', C.x, C.z], ['crate', C.x + 1.8, C.z - 1.5], ['barrel', C.x - 2, C.z + 1.2],
  ];
  for (const [kind, x, z] of dress) {
    props.push({ kind, x, z, rot: rnd() * 6.28, s: 1, seed: Math.floor(rnd() * 1e6) });
    world.solids.push({ x, z, r: kind === 'lantern' ? 0.2 : 0.5 });
  }

  world.bake();

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
    npcs,
    spawns,
    ruin: { x: R.x, z: R.z, r: 7 },
    plinth,
    respawn: { x: respawnPt[0], z: respawnPt[1] },
  };
}
