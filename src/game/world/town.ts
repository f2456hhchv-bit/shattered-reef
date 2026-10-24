import type { BuildingDef, Furniture } from './buildings';

// Bellwether as a proper town: a quay quarter by the dock (store, chart house, tackle shop, warehouse, two
// cottages) and an upper town on the shelf above it (market square at the crossroads, the Drowned Bell inn,
// the bank, the chapel, the town hall and its houses). Every building can be walked into.
//
// Facing: `rot` uses World's rect convention, so the door (local +z) faces world (-sin rot, cos rot):
// 0 = south (toward the sea), PI = north, -PI/2 = east, PI/2 = west.

const E = -Math.PI / 2, Wt = Math.PI / 2, S = 0;
const F = (kind: Furniture['kind'], x: number, z: number, rot = 0, w?: number): Furniture => ({ kind, x, z, rot, w });

export interface TownNpc { id: string; building: string; x: number; z: number; facing: number } // local coords

export interface TownPlan { buildings: BuildingDef[]; npcs: TownNpc[]; stalls: { x: number; z: number; rot: number; colour: number }[]; square: { x: number; z: number; r: number } }

/** `V` = the quay square, `X` = the crossroads (market square). */
export function townPlan(V: { x: number; z: number }, X: { x: number; z: number }): TownPlan {
  const b: BuildingDef[] = [
    // ---- quay quarter
    { id: 'store', name: 'Gell\'s Harbour Goods', style: 'timber', x: V.x - 11, z: V.z - 4, rot: E, w: 6, d: 5, door: 0, seed: 11, sign: 0x7a3b3b,
      furniture: [F('counter', 0, -0.6, 0, 2.6), F('shelf', -1.6, -2.1), F('shelf', 1.6, -2.1), F('barrel', -2.3, 1.3), F('crate', 2.2, 1.4), F('sacks', -2.1, 0.2, Math.PI / 2)] },
    { id: 'chart', name: 'The Chart House', style: 'plaster', x: V.x + 11, z: V.z - 5, rot: Wt, w: 6, d: 5, door: 0, seed: 12, sign: 0x2f5a6a,
      furniture: [F('maptable', 0, -0.4), F('globe', 2.2, -1.5), F('bookshelf', -1.5, -2.1), F('rug', 0, 0.6), F('stool', -1.1, 0.4)] },
    { id: 'tackle', name: 'Reed\'s Tackle & Fish', style: 'timber', x: V.x - 9, z: V.z + 8.5, rot: E, w: 5, d: 4.6, door: 0, seed: 16, sign: 0x2f6a8a, chimney: false,
      furniture: [F('counter', 0, -0.5, 0, 2.2), F('nets', -1.4, -1.95), F('barrel', 1.8, -1.6), F('barrel', 1.8, 1.4), F('crate', -1.8, 1.3)] },
    { id: 'warehouse', name: 'Harbour warehouse', style: 'timber', x: V.x - 22, z: V.z + 6.5, rot: E, w: 7, d: 6, door: 0, seed: 17, chimney: false,
      furniture: [F('crate', -2.4, -2), F('crate', -1.6, -2.1), F('crate', -2.4, -1.2), F('kegs', 1.5, -2.2), F('sacks', 2.2, 1.7), F('barrel', -2.5, 1.9), F('barrel', -1.8, 2.0), F('nets', 0.5, -2.45)] },
    { id: 'cottage_w', name: 'A fisher\'s cottage', style: 'timber', x: V.x - 21, z: V.z - 11.5, rot: E, w: 5.5, d: 4.6, door: 0.8, seed: 13,
      furniture: [F('bed', -1.7, -0.6), F('table', 1.0, -1.2), F('stool', 1.0, -0.3), F('fireplace', 1.3, -1.95), F('chest', -1.7, 1.4), F('rug', 0.3, 0.4)] },
    { id: 'cottage_e', name: 'A sailmaker\'s cottage', style: 'plaster', x: V.x + 22, z: V.z - 7, rot: Wt, w: 5.5, d: 4.6, door: -0.8, seed: 14,
      furniture: [F('bed', 1.7, -0.6), F('loom', -1.1, -1.4), F('fireplace', 0.4, -1.95), F('chest', 1.7, 1.4), F('plant', -1.9, 1.5)] },
    // ---- upper town round the market square
    { id: 'inn', name: 'The Drowned Bell', style: 'plaster', x: X.x - 13, z: X.z - 7.5, rot: S, w: 11, d: 8, door: 0, seed: 21, storeys: 2, sign: 0x8a5a2a,
      furniture: [F('bar', 0, -2.4, 0, 4), F('kegs', -3.6, -3.4), F('kegs', 3.6, -3.4), F('table', -3.2, 0.6), F('stool', -3.9, 0.6), F('stool', -2.5, 0.6), F('table', 3.2, 0.6), F('stool', 3.9, 0.6), F('stool', 2.5, 0.6),
        F('table', 0, 1.5), F('stool', -0.7, 1.5), F('stool', 0.7, 1.5), F('fireplace', -4.6, -1, Math.PI / 2), F('rug', 0, -0.3), F('plant', 4.8, 3.2)] },
    { id: 'bank', name: 'The Bank of Bellwether', style: 'stone', x: X.x + 13, z: X.z - 6, rot: S, w: 9, d: 6.5, door: 0, seed: 22, sign: 0xc9a050,
      furniture: [F('grille', 0, -0.9, 0, 6), F('chest', -2.5, -2.5), F('chest', -1, -2.6), F('chest', 1, -2.6), F('chest', 2.5, -2.5), F('plant', -3.8, 2.4), F('plant', 3.8, 2.4)] },
    { id: 'chapel', name: 'Chapel of the Tides', style: 'stone', x: X.x + 24, z: X.z - 10.5, rot: S, w: 7, d: 11, door: 0, seed: 23, chimney: false,
      furniture: [F('altar', 0, -4.2), F('pew', -1.5, -1.8), F('pew', 1.5, -1.8), F('pew', -1.5, 0), F('pew', 1.5, 0), F('pew', -1.5, 1.8), F('pew', 1.5, 1.8), F('plant', -2.8, -4.4), F('plant', 2.8, -4.4)] },
    { id: 'hall', name: 'Bellwether Town Hall', style: 'plaster', x: X.x - 3, z: X.z - 19.5, rot: E, w: 9, d: 7, door: 0, seed: 24, storeys: 2, sign: 0x2f4a6a,
      furniture: [F('table', 0, -1.4, 0), F('table', 1.3, -1.4), F('table', -1.3, -1.4), F('bench', 0, -0.6), F('bench', 0, -2.3), F('bookshelf', -3.3, -2.9), F('bookshelf', 3.3, -2.9), F('fireplace', 3.9, 0.5, -Math.PI / 2), F('rug', -1.5, 1.6)] },
    { id: 'house_1', name: 'A quiet house', style: 'timber', x: X.x - 19, z: X.z - 17.5, rot: Wt, w: 5.5, d: 4.6, door: 0.6, seed: 31,
      furniture: [F('bed', -1.7, -0.6), F('table', 1.0, -1.2), F('stool', 1.0, -0.3), F('fireplace', 1.2, -1.95), F('chest', -1.7, 1.4)] },
    { id: 'house_2', name: 'The weaver\'s house', style: 'plaster', x: X.x - 30, z: X.z + 5, rot: E, w: 5.5, d: 4.6, door: -0.6, seed: 32,
      furniture: [F('loom', 1.2, -1.4), F('bed', -1.7, -0.5), F('chest', 1.7, 1.4), F('rug', 0, 0.3)] },
    { id: 'house_3', name: 'The cooper\'s house', style: 'timber', x: X.x + 29, z: X.z + 6, rot: Wt, w: 5.5, d: 4.6, door: 0.6, seed: 33,
      furniture: [F('barrel', -1.8, -1.5), F('barrel', -1.1, -1.6), F('bed', 1.7, -0.6), F('table', -0.6, 0.3), F('stool', -0.6, 1.0)] },
    { id: 'house_4', name: 'A fisherwife\'s house', style: 'plaster', x: X.x + 13, z: X.z - 20.5, rot: Wt, w: 5.5, d: 4.6, door: -0.8, seed: 34,
      furniture: [F('bed', 1.7, -0.6), F('cauldron', -1.3, -1.4), F('table', -0.5, 0.5), F('stool', 0.2, 0.5), F('nets', 1.6, 1.9, Math.PI)] },
    { id: 'house_5', name: 'An old sailor\'s house', style: 'timber', x: X.x - 23, z: X.z - 26.5, rot: S, w: 5.5, d: 4.6, door: 0.8, seed: 35,
      furniture: [F('bed', -1.7, -0.6), F('chest', 1.7, -1.5), F('table', 1.0, 0.6), F('stool', 1.0, 1.3), F('globe', -1.9, 1.5)] },
  ];
  const npcs: TownNpc[] = [
    { id: 'marta', building: 'store', x: 0, z: -1.5, facing: 0 },
    { id: 'iven', building: 'chart', x: 0.4, z: -1.6, facing: 0 },
    { id: 'silas', building: 'tackle', x: 0, z: -1.4, facing: 0 },
    { id: 'hob', building: 'inn', x: 0, z: -3.3, facing: 0 },
    { id: 'ada', building: 'bank', x: 0, z: -1.9, facing: 0 },
    { id: 'maren', building: 'chapel', x: 0, z: -3.2, facing: 0 },
    { id: 'corwin', building: 'hall', x: 0, z: -2.6, facing: 0 },
  ];
  // market stalls along the square's south side, facing in (the inn and bank fronts take the north side)
  const stalls = [
    { x: X.x - 6.5, z: X.z + 4.5, rot: 0.4, colour: 0xb8332a }, { x: X.x + 6.5, z: X.z + 4.5, rot: -0.4, colour: 0x2f6a8a },
    { x: X.x - 12, z: X.z + 5.5, rot: 0.25, colour: 0xc9a050 }, { x: X.x + 12, z: X.z + 5.5, rot: -0.25, colour: 0x4f8a4a },
  ];
  return { buildings: b, npcs, stalls, square: { x: X.x, z: X.z, r: 10 } };
}
