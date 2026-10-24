import type { Rect } from './world';

// Enterable buildings (simulation side): footprint, door, walls and furniture as collision, and an
// "inside" test the renderer uses to lift the roof off. No Three.js here.
//
// Local frame: +z is the front (the door wall), x runs along it. `rot` follows World's Rect convention:
// local x = (cos rot, sin rot), local z = (-sin rot, cos rot) in world (x, z).

export type FurnitureKind =
  | 'table' | 'stool' | 'bench' | 'bed' | 'chest' | 'shelf' | 'counter' | 'barrel' | 'crate' | 'fireplace' | 'rug'
  | 'maptable' | 'bookshelf' | 'globe' | 'sacks' | 'pew' | 'altar' | 'bar' | 'grille' | 'kegs' | 'cauldron' | 'loom' | 'nets' | 'plant';

export interface Furniture { kind: FurnitureKind; x: number; z: number; rot?: number; w?: number }
export type BuildingStyle = 'timber' | 'stone' | 'plaster';

export interface BuildingDef {
  id: string;
  name: string; // shown when you step inside
  style: BuildingStyle;
  x: number; z: number; rot: number;
  w: number; d: number; // outer size (m)
  door: number; // local x of the door's centre in the front wall
  furniture: Furniture[];
  seed: number;
  storeys?: number; // 1 (default) or 2: a taller shell (only the ground floor is walkable)
  chimney?: boolean;
  sign?: number; // signboard colour (shops)
}

export const WALL = 0.3, DOOR_W = 1.7, WALL_H = 2.7;

/** Collision footprint of each piece of furniture (local w x d), 0 = walk over it (rugs). */
export const FURN_SIZE: Record<FurnitureKind, [number, number]> = {
  table: [1.3, 0.85], stool: [0, 0], bench: [1.4, 0.4], bed: [1.0, 2.0], chest: [0.9, 0.55], shelf: [1.6, 0.45], counter: [2.4, 0.7],
  barrel: [0.7, 0.7], crate: [0.75, 0.75], fireplace: [1.6, 0.6], rug: [0, 0], maptable: [1.8, 1.2], bookshelf: [1.6, 0.45], globe: [0.6, 0.6],
  sacks: [0.9, 0.6], pew: [2.2, 0.55], altar: [1.6, 0.8], bar: [3.4, 0.7], grille: [3.0, 0.5], kegs: [1.8, 0.8], cauldron: [0.9, 0.9],
  loom: [1.4, 0.9], nets: [1.6, 0.4], plant: [0.5, 0.5],
};

export function toWorld(b: BuildingDef, lx: number, lz: number): [number, number] {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [b.x + lx * c - lz * s, b.z + lx * s + lz * c];
}

export function toLocal(b: BuildingDef, x: number, z: number): [number, number] {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
  return [dx * c + dz * s, -dx * s + dz * c];
}

/** Standing inside the walls (the doorway counts as outside, so the roof doesn't flicker as you pass). */
export function isInside(b: BuildingDef, x: number, z: number): boolean {
  const [lx, lz] = toLocal(b, x, z);
  return Math.abs(lx) < b.w / 2 - WALL && Math.abs(lz) < b.d / 2 - WALL;
}

/** World point just outside the door, and just inside it. */
export function doorPoints(b: BuildingDef): { out: [number, number]; in: [number, number] } {
  return { out: toWorld(b, b.door, b.d / 2 + 1.2), in: toWorld(b, b.door, b.d / 2 - 1.2) };
}

/** Walls (front wall split round the door) and furniture as world-space rectangles. */
export function buildingSolids(b: BuildingDef): Rect[] {
  const out: Rect[] = [];
  const seg = (lx: number, lz: number, w: number, d: number, rot = 0) => { const [x, z] = toWorld(b, lx, lz); out.push({ x, z, w, d, rot: b.rot + rot }); };
  const hw = b.w / 2, hd = b.d / 2;
  seg(0, -hd + WALL / 2, b.w, WALL); // back
  seg(-hw + WALL / 2, 0, WALL, b.d); // left
  seg(hw - WALL / 2, 0, WALL, b.d); // right
  const dl = b.door - DOOR_W / 2, dr = b.door + DOOR_W / 2;
  if (dl > -hw) seg((-hw + dl) / 2, hd - WALL / 2, dl + hw, WALL);
  if (dr < hw) seg((dr + hw) / 2, hd - WALL / 2, hw - dr, WALL);
  for (const f of b.furniture) {
    const [w, d] = FURN_SIZE[f.kind];
    if (!w || !d) continue;
    seg(f.x, f.z, f.w ?? w, d, f.rot ?? 0);
  }
  return out;
}
