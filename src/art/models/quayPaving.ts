import * as THREE from 'three';
import { PAL } from '../materials';
import { fbm, mulberry32 } from '../noise';
import { BELL_TOWN, LAYOUT } from '../../game/world/island';
import type { World } from '../../game/world/world';

export interface QuayStone { x: number; z: number; radius: number; variant: number; colour: number }

const SITE_TARGET = 1250, GAP = .025, HASH_CELL = .58;
const STONE_COLOURS = [PAL.quayStone, PAL.quayStoneWarm, PAL.quayStoneCool, PAL.quayStonePale] as const;

/** Deterministic, irregular site centers for the interlocking stones in the old quay footprint. */
export function planQuayStones(world: Pick<World, 'solids'>, seed = 41621): QuayStone[] {
  const rnd = mulberry32(seed), stones: QuayStone[] = [], cells = new Map<string, number[]>();
  const key = (x: number, z: number) => `${x},${z}`;
  const buildings = BELL_TOWN.buildings.filter(b => Math.abs(b.x - LAYOUT.village.x) < 17 && Math.abs(b.z - LAYOUT.village.z) < 17);
  const nearbySolids = world.solids.filter(s => Math.abs(s.x - LAYOUT.village.x) < 17 + ('r' in s ? s.r : s.w / 2)
    && Math.abs(s.z - LAYOUT.village.z) < 17 + ('r' in s ? s.r : s.d / 2));
  const isBlocked = (x: number, z: number, r: number) => {
    if (buildings.some(b => Math.abs(x - b.x) < b.w / 2 + r + .12 && Math.abs(z - b.z) < b.d / 2 + r + .12)) return true;
    return nearbySolids.some(s => {
      if ('r' in s) return Math.hypot(x - s.x, z - s.z) < s.r + r + .08;
      return Math.abs(x - s.x) < s.w / 2 + r + .08 && Math.abs(z - s.z) < s.d / 2 + r + .08;
    });
  };
  for (let attempt = 0; attempt < SITE_TARGET * 150 && stones.length < SITE_TARGET; attempt++) {
    const angle = rnd() * Math.PI * 2, distance = Math.sqrt(rnd()) * 14.1;
    const x = LAYOUT.village.x + Math.cos(angle) * distance, z = LAYOUT.village.z + Math.sin(angle) * distance;
    const radius = .19 + rnd() * .12;
    const edge = 13.15 + fbm(x * .13, z * .13, 2, 11) * 2.8;
    if (distance > edge - radius * .55 || isBlocked(x, z, radius)) continue;
    const cx = Math.floor(x / HASH_CELL), cz = Math.floor(z / HASH_CELL);
    let overlaps = false;
    for (let dz = -2; dz <= 2 && !overlaps; dz++) for (let dx = -2; dx <= 2 && !overlaps; dx++) {
      for (const index of cells.get(key(cx + dx, cz + dz)) ?? []) {
        const other = stones[index];
        if (Math.hypot(x - other.x, z - other.z) < radius + other.radius + GAP) { overlaps = true; break; }
      }
    }
    if (overlaps) continue;
    const stone: QuayStone = { x, z, radius, variant: Math.floor(rnd() * 4), colour: STONE_COLOURS[Math.floor(rnd() * STONE_COLOURS.length)] };
    const index = stones.push(stone) - 1, bucket = cells.get(key(cx, cz));
    if (bucket) bucket.push(index); else cells.set(key(cx, cz), [index]);
  }
  return stones;
}

type Point = { x: number; z: number };
/** Clip a convex polygon to the half-plane that is nearer to the current stone site. */
function clip(poly: Point[], nx: number, nz: number, limit: number): Point[] {
  const output: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = a.x * nx + a.z * nz - limit, db = b.x * nx + b.z * nz - limit;
    const insideA = da <= 1e-8, insideB = db <= 1e-8;
    if (insideA) output.push(a);
    if (insideA !== insideB) {
      const t = da / (da - db);
      output.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return output;
}

function touchesBuilding(p: Point, buildings: typeof BELL_TOWN.buildings): boolean {
  return buildings.some(b => Math.abs(p.x - (b.x - LAYOUT.village.x)) < b.w / 2 + .2
    && Math.abs(p.z - (b.z - LAYOUT.village.z)) < b.d / 2 + .2);
}

/** Build shallow bevelled Voronoi setts as one vertex-coloured mesh; no texture repetition or collision changes. */
export function buildQuayPaving(world: Pick<World, 'solids' | 'ground'>): THREE.Group {
  const sites = planQuayStones(world), buildings = BELL_TOWN.buildings.filter(b => Math.abs(b.x - LAYOUT.village.x) < 17 && Math.abs(b.z - LAYOUT.village.z) < 17);
  const boundary: Point[] = Array.from({ length: 64 }, (_, i) => {
    const a = i / 64 * Math.PI * 2;
    const r = 14.2 + .4 * Math.sin(a * 3 + .2) + .22 * Math.cos(a * 5 - .7);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
  const siteBuckets = new Map<string, number[]>();
  sites.forEach((site, i) => {
    const key = `${Math.floor(site.x / HASH_CELL)},${Math.floor(site.z / HASH_CELL)}`;
    const bucket = siteBuckets.get(key); if (bucket) bucket.push(i); else siteBuckets.set(key, [i]);
  });
  const positions: number[] = [], colours: number[] = [], indices: number[] = [];
  let renderedStones = 0;
  const base = new THREE.Color();
  for (let s = 0; s < sites.length; s++) {
    const site = sites[s], sx = site.x - LAYOUT.village.x, sz = site.z - LAYOUT.village.z;
    let poly = boundary;
    const cx = Math.floor(site.x / HASH_CELL), cz = Math.floor(site.z / HASH_CELL);
    const neighbours: number[] = [];
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) neighbours.push(...(siteBuckets.get(`${cx + dx},${cz + dz}`) ?? []));
    for (const n of neighbours) {
      if (n === s || poly.length < 3) continue;
      const other = sites[n], nx = other.x - site.x, nz = other.z - site.z;
      if (nx * nx + nz * nz > 2.4 * 2.4) continue;
      const ox = other.x - LAYOUT.village.x, oz = other.z - LAYOUT.village.z;
      poly = clip(poly, nx, nz, (ox * ox + oz * oz - sx * sx - sz * sz) / 2);
    }
    if (poly.length < 3) continue;
    const centre = poly.reduce((p, v) => ({ x: p.x + v.x / poly.length, z: p.z + v.z / poly.length }), { x: 0, z: 0 });
    const worldCentre = { x: centre.x + LAYOUT.village.x, z: centre.z + LAYOUT.village.z };
    if (touchesBuilding(worldCentre, buildings)) continue;
    const count = poly.length, first = positions.length / 3;
    base.setHex(site.colour);
    const addRing = (scale: number, lift: number, tint: number) => {
      for (const v of poly) {
        const x = worldCentre.x + (v.x - centre.x) * scale, z = worldCentre.z + (v.z - centre.z) * scale;
        positions.push(x, world.ground(x, z) + lift, z);
        colours.push(base.r * tint, base.g * tint, base.b * tint);
      }
    };
    addRing(1, .008, .72); addRing(1, .034, .84); addRing(.92, .091, 1);
    const top = positions.length / 3;
    positions.push(worldCentre.x, world.ground(worldCentre.x, worldCentre.z) + .105, worldCentre.z);
    colours.push(base.r * .98, base.g * .98, base.b * .98);
    for (let i = 0; i < count; i++) {
      const a = first + i, b = first + (i + 1) % count, c = first + count + i, d = first + count + (i + 1) % count;
      const e = first + count * 2 + i, f = first + count * 2 + (i + 1) % count;
      indices.push(a, c, b, b, c, d, c, e, d, d, e, f, top, f, e);
    }
    renderedStones++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, metalness: 0, flatShading: false });
  const paving = new THREE.Mesh(geometry, material);
  paving.name = 'bellwether-quay-setts'; paving.castShadow = false; paving.receiveShadow = true;
  paving.userData.stoneCount = renderedStones;
  const group = new THREE.Group(); group.name = 'bellwether-quay-paving'; group.userData.stoneCount = renderedStones; group.add(paving);
  return group;
}
