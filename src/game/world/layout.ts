import { mulberry32 } from '../../art/noise';
import { LAYOUT, coastPoint, coastDist, nearestPathDist, FLATS } from './island';
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
  stations: { id: 'furnace' | 'anvil' | 'fire'; x: number; z: number }[];
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
  ];
  world.solids.push({ x: stations[0].x, z: stations[0].z, r: 1.0 }, { x: stations[1].x, z: stations[1].z, r: 0.45 }, { x: stations[2].x, z: stations[2].z, r: 0.7 });

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
    return true;
  };
  const scatter = (def: string, cx: number, cz: number, radius: number, count: number, clearance: number) => {
    for (let tries = 0, made = 0; tries < 400 && made < count; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!free(x, z, 5, clearance)) continue;
      const sx = world.ground(x + 0.6, z) - world.ground(x - 0.6, z), sz = world.ground(x, z + 0.6) - world.ground(x, z - 0.6);
      if (Math.hypot(sx, sz) > 0.9) continue;
      nodes.push({ uid: `n${uid++}`, def, x, z, seed: Math.floor(rnd() * 1e6) });
      made++;
    }
  };
  const F = LAYOUT.forest, H = LAYOUT.hills;
  scatter('tree_pine', F.x + 4, F.z + 4, 12, 14, 3.2);
  scatter('tree_oak', F.x - 8, F.z - 6, 7, 5, 3.6);
  scatter('rock_copper', H.x - 6, H.z + 5, 6, 5, 2.4);
  scatter('rock_tin', H.x - 2, H.z + 8, 6, 5, 2.4);
  scatter('rock_iron', H.x + 3, H.z - 2, 5, 3, 2.6);
  for (const n of nodes) world.solids.push({ x: n.x, z: n.z, r: n.def.startsWith('tree') ? 0.45 : 0.75 });

  // fishing: sprats off the dock head (reachable on foot), bellfish shoals offshore (ship only)
  nodes.push({ uid: `n${uid++}`, def: 'spot_sprat', x: -headWidth / 2 - 1.6, z: headZ + 1.0, seed: 1 });
  for (const [deg, inset] of [[35, -17], [205, -16], [300, -17]] as const) {
    const [x, z] = coastPoint(deg, inset);
    nodes.push({ uid: `n${uid++}`, def: 'spot_bell', x, z, seed: deg });
  }

  // ---- reefs / sea stacks
  const reefs: IslandLayout['reefs'] = [];
  for (let tries = 0; tries < 300 && reefs.length < 12; tries++) {
    const [x, z] = coastPoint(rnd() * 360, -(4 + rnd() * 26));
    if (Math.hypot(x - mooring.x, z - mooring.z) < 18) continue;
    if (nodes.some((n) => n.def === 'spot_bell' && Math.hypot(n.x - x, n.z - z) < 9)) continue;
    if (world.ground(x, z) > -0.6) continue;
    reefs.push({ x, z, r: 0.8 + rnd() * 1.2 });
  }
  world.reefs.push(...reefs);

  // ---- decorative vegetation and rocks (solid)
  for (let tries = 0, made = 0; tries < 2500 && made < 95; tries++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const inForest = Math.hypot(x - F.x, z - F.z) < 20;
    if (!inForest && rnd() < 0.45) continue;
    if (!free(x, z, 7, 2.6)) continue;
    if (Math.hypot(x - R.x, z - R.z) < 11 || Math.hypot(x - C.x, z - C.z) < 9) continue;
    if (Math.hypot(x - H.x, z - H.z) < 12 && rnd() < 0.7) continue;
    if (world.ground(x, z) < 0.5) continue;
    const kind = inForest || rnd() < 0.6 ? 'pine' : 'broadleaf';
    props.push({ kind, x, z, rot: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.35, seed: Math.floor(rnd() * 1e6) });
    world.solids.push({ x, z, r: 0.45 });
    made++;
  }
  for (let tries = 0, made = 0; tries < 800 && made < 30; tries++) {
    const a = rnd() * Math.PI * 2, r = 15 + rnd() * 45;
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

  // ---- enemies
  const spawns: SpawnPoint[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, z] = coastPoint(118 + k * 9, 3 + (k % 2) * 2.5);
    spawns.push({ enemy: 'reef_crab', x, z });
  }
  for (let k = 0; k < 3; k++) {
    const [x, z] = coastPoint(20 + k * 14, 3.5);
    spawns.push({ enemy: 'reef_crab', x, z });
  }
  spawns.push({ enemy: 'brigand', x: C.x - 2.5, z: C.z + 2 }, { enemy: 'brigand', x: C.x + 2.5, z: C.z + 1.5 }, { enemy: 'brigand', x: C.x, z: C.z - 2.5 });
  spawns.push({ enemy: 'gunner', x: C.x + 4, z: C.z - 3 }, { enemy: 'gunner', x: C.x - 5, z: C.z - 1 });

  world.bake();
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
