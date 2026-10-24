import * as THREE from 'three';
import { mat, mesh, jitter, PAL } from '../materials';
import { mulberry32 } from '../noise';
import { buildBarrel } from './ship';
import { buildCrate } from './props';
import { WALL, DOOR_W, WALL_H, type BuildingDef, type Furniture } from '../../game/world/buildings';

// Enterable buildings in the island's style: plank, stone or timber-framed plaster walls on a stone footing,
// shingled gable roof, glazed windows, a proper doorway and a furnished interior. The roof is its own group
// so it can be lifted off (and the walls lowered) when you walk in. Built in local space: +z is the front.

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const box = (w: number, h: number, d: number, m: THREE.Material, cast = true) => mesh(new THREE.BoxGeometry(w, h, d), m, cast);
const FLOOR_Y = 0.12;

const WALL_COL = { timber: 'plank', stone: 'stone', plaster: 0xe6dcc6 } as const;

/** `trim` (windows, sign) sits on the walls and hides as you walk in, since it can't be cut down with them. */
export interface EnterableView { group: THREE.Group; walls: THREE.Group; trim: THREE.Group; roof: THREE.Group; interior: THREE.Group }

export function buildEnterable(b: BuildingDef): EnterableView {
  const rnd = mulberry32(b.seed);
  const group = new THREE.Group(), walls = new THREE.Group(), roof = new THREE.Group(), interior = new THREE.Group();
  const trim = new THREE.Group();
  group.add(walls, trim, roof, interior);
  const W = b.w, D = b.d, H = WALL_H * (b.storeys ?? 1), hw = W / 2, hd = D / 2;
  const wallMat = mat(WALL_COL[b.style] as never), beam = mat('woodDark'), glass = mat(PAL.glass, { emissive: PAL.glass, emissiveIntensity: 0.25 });

  // ---- floor: planks over a stone footing
  interior.add(at(box(W - WALL, 0.12, D - WALL, mat('plank'), false), 0, FLOOR_Y - 0.06, 0));
  for (let x = -hw + 0.6; x < hw - 0.3; x += 0.55) interior.add(at(box(0.03, 0.01, D - WALL - 0.1, mat('woodDark'), false), x, FLOOR_Y + 0.005, 0));
  for (const [x, z, w, d] of [[0, -hd, W + 0.2, 0.5], [0, hd, W + 0.2, 0.5], [-hw, 0, 0.5, D], [hw, 0, 0.5, D]] as const) {
    walls.add(at(mesh(jitter(new THREE.BoxGeometry(w, 0.32, d), 0.03, b.seed + x * 3 + z), mat('stone')), x, 0.1, z));
  }

  // ---- walls: four segments, the front split round the door, with a lintel over it
  const wallSeg = (cx: number, cz: number, len: number, alongX: boolean, h = H, y0 = FLOOR_Y) => {
    const m = box(alongX ? len : WALL, h, alongX ? WALL : len, wallMat);
    walls.add(at(m, cx, y0 + h / 2, cz));
    if (b.style === 'plaster') {
      // timber framing: sill and top beams plus uprights every ~1.2 m
      for (const y of [y0 + 0.1, y0 + h / 2, y0 + h - 0.08]) walls.add(at(box(alongX ? len + 0.02 : WALL + 0.06, 0.14, alongX ? WALL + 0.06 : len + 0.02, beam), cx, y, cz));
      const n = Math.max(1, Math.round(len / 1.2));
      for (let k = 0; k <= n; k++) {
        const t = -len / 2 + (k * len) / n;
        walls.add(at(box(alongX ? 0.14 : WALL + 0.06, h, alongX ? WALL + 0.06 : 0.14, beam), alongX ? cx + t : cx, y0 + h / 2, alongX ? cz : cz + t));
      }
    } else if (b.style === 'timber') {
      for (let k = 0; k < Math.floor(len / 0.3); k++) {
        const t = -len / 2 + 0.15 + k * 0.3;
        if (rnd() < 0.35) walls.add(at(box(alongX ? 0.28 : WALL + 0.02, h, alongX ? WALL + 0.02 : 0.28, mat('plankWorn')), alongX ? cx + t : cx, y0 + h / 2, alongX ? cz : cz + t));
      }
    } else {
      for (let k = 0; k < len * h * 0.9; k++) {
        const t = (rnd() - 0.5) * len, y = y0 + 0.2 + rnd() * (h - 0.4);
        const st = mesh(jitter(new THREE.BoxGeometry(0.42, 0.22, 0.06), 0.02, b.seed + k), mat(rnd() > 0.5 ? 'stoneDark' : 'stone'), false);
        for (const side of [-1, 1]) walls.add(at(st.clone(), alongX ? cx + t : cx + side * (WALL / 2 + 0.02), y, alongX ? cz + side * (WALL / 2 + 0.02) : cz + t, 0, alongX ? 0 : Math.PI / 2, 0));
      }
    }
  };
  wallSeg(0, -hd + WALL / 2, W, true);
  wallSeg(-hw + WALL / 2, 0, D, false);
  wallSeg(hw - WALL / 2, 0, D, false);
  const dl = b.door - DOOR_W / 2, dr = b.door + DOOR_W / 2, doorH = 2.15;
  if (dl > -hw) wallSeg((-hw + dl) / 2, hd - WALL / 2, dl + hw, true);
  if (dr < hw) wallSeg((dr + hw) / 2, hd - WALL / 2, hw - dr, true);
  wallSeg(b.door, hd - WALL / 2, DOOR_W, true, H - doorH, FLOOR_Y + doorH); // lintel
  // door frame and the door itself, swung open inward
  for (const s of [-1, 1]) walls.add(at(box(0.14, doorH, WALL + 0.08, beam), b.door + s * (DOOR_W / 2 + 0.03), FLOOR_Y + doorH / 2, hd - WALL / 2));
  walls.add(at(box(DOOR_W + 0.3, 0.16, WALL + 0.1, beam), b.door, FLOOR_Y + doorH + 0.04, hd - WALL / 2));
  const leaf = box(DOOR_W - 0.15, doorH - 0.08, 0.07, mat('woodDark'));
  leaf.geometry.translate((DOOR_W - 0.15) / 2, 0, 0);
  walls.add(at(leaf, b.door - DOOR_W / 2 + 0.05, FLOOR_Y + doorH / 2, hd - WALL - 0.04, 0, -1.35, 0));
  // corner posts
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]] as const) walls.add(at(mesh(new THREE.CylinderGeometry(0.13, 0.15, H + 0.1, 10), beam), x, FLOOR_Y + H / 2, z));
  // windows: glazed, framed, with a sill; on every wall that has room
  const windows: [number, number, boolean][] = []; // [along, offset, alongX] positions on the outer wall plane
  for (let x = -hw + 1.2; x <= hw - 1.2; x += 2.2) { windows.push([x, -hd, true]); if (Math.abs(x - b.door) > DOOR_W / 2 + 0.9) windows.push([x, hd, true]); }
  for (let z = -hd + 1.3; z <= hd - 1.3; z += 2.4) { windows.push([z, -hw, false]); windows.push([z, hw, false]); }
  const storeys = b.storeys ?? 1;
  for (let s = 0; s < storeys; s++) for (const [t, off, ax] of windows) {
    const y = FLOOR_Y + 1.5 + s * WALL_H;
    const out = off > 0 ? 1 : -1, ww = 0.8, wh = 0.7;
    const [x, z] = ax ? [t, off + out * 0.02] : [off + out * 0.02, t];
    trim.add(at(box(ax ? ww : WALL + 0.06, wh, ax ? WALL + 0.06 : ww, glass, false), x, y, z));
    trim.add(at(box(ax ? ww + 0.16 : WALL + 0.12, 0.08, ax ? WALL + 0.12 : ww + 0.16, beam), x, y + wh / 2, z));
    trim.add(at(box(ax ? ww + 0.24 : WALL + 0.2, 0.08, ax ? WALL + 0.2 : ww + 0.24, beam), x, y - wh / 2, z));
    trim.add(at(box(ax ? 0.06 : WALL + 0.1, wh, ax ? WALL + 0.1 : 0.06, beam), x, y, z));
  }
  if (b.sign !== undefined) {
    // a hanging shop sign by the door
    const [sx, sz] = [b.door + (b.door > 0 ? -1 : 1) * (DOOR_W / 2 + 0.7), hd + 0.35];
    trim.add(at(box(0.08, 0.08, 0.6, beam), sx, FLOOR_Y + 2.45, hd + 0.05));
    trim.add(at(box(0.9, 0.55, 0.06, mat(b.sign)), sx, FLOOR_Y + 2.05, sz));
    trim.add(at(box(0.5, 0.2, 0.08, mat('brass')), sx, FLOOR_Y + 2.05, sz + 0.02));
  }

  // ---- roof: gable along x, shingle rows, gable ends and a chimney (all lifted off together)
  const rise = D * 0.42, top = FLOOR_Y + H;
  const slope = Math.atan2(rise, hd), slab = Math.hypot(rise, hd) + 0.45;
  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.position.set(0, top + rise, 0);
    side.rotation.x = s * slope;
    const rows = Math.max(4, Math.round(slab / 0.55));
    for (let r = 0; r < rows; r++) side.add(at(mesh(jitter(new THREE.BoxGeometry(W + 0.75, 0.1, slab / rows + 0.08), 0.03, b.seed + r * 7 + s), mat(r % 2 ? 'roof' : 0x4f4050)), 0, -r * 0.02, s * (slab / rows) * (r + 0.5)));
    roof.add(side);
  }
  roof.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, W + 0.85, 10), beam), 0, top + rise + 0.06, 0, 0, 0, Math.PI / 2));
  const gable = new THREE.Shape();
  gable.moveTo(-hd, 0); gable.lineTo(hd, 0); gable.lineTo(0, rise); gable.lineTo(-hd, 0);
  for (const x of [-hw + 0.02, hw - 0.1]) roof.add(at(mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.08, bevelEnabled: false }), b.style === 'stone' ? mat('stone') : wallMat), x, top, 0, 0, Math.PI / 2, 0));
  if (b.chimney !== false) for (let k = 0; k < 6; k++) roof.add(at(mesh(jitter(new THREE.CylinderGeometry(0.32 - k * 0.012, 0.34 - k * 0.012, 0.34, 12), 0.04, b.seed + 77 + k), mat(k % 2 ? 'stone' : 'stoneDark')), hw - 0.9, top + rise * 0.4 + k * 0.32, -hd * 0.45, 0, k * 0.7, 0));

  for (const f of b.furniture) interior.add(furniture(f, rnd));
  return { group, walls, trim, roof, interior };
}

function furniture(f: Furniture, rnd: () => number): THREE.Object3D {
  const g = new THREE.Group();
  const y = FLOOR_Y;
  const wood = mat('wood'), dark = mat('woodDark');
  const legs = (w: number, d: number, h: number) => { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.add(at(box(0.08, h, 0.08, dark), x * (w / 2 - 0.08), y + h / 2, z * (d / 2 - 0.08))); };
  switch (f.kind) {
    case 'table': legs(1.3, 0.85, 0.72); g.add(at(box(1.3, 0.08, 0.85, wood), 0, y + 0.76, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), mat(0x8a8a90)), 0.3, y + 0.86, 0.1), at(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), mat(0xd8d2c0)), -0.25, y + 0.81, -0.1)); break;
    case 'stool': g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), wood), 0, y + 0.45, 0)); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; g.add(at(box(0.05, 0.45, 0.05, dark), Math.cos(a) * 0.13, y + 0.22, Math.sin(a) * 0.13)); } break;
    case 'bench': legs(1.4, 0.4, 0.42); g.add(at(box(1.4, 0.07, 0.4, wood), 0, y + 0.45, 0)); break;
    case 'bed': g.add(at(box(1.0, 0.35, 2.0, dark), 0, y + 0.18, 0), at(box(0.9, 0.16, 1.85, mat(0xe8dcc0)), 0, y + 0.42, 0.02), at(box(0.92, 0.18, 1.2, mat(0x6a3b3b)), 0, y + 0.47, 0.35), at(box(0.6, 0.12, 0.3, mat(0xf4efe6)), 0, y + 0.55, -0.75), at(box(1.0, 0.7, 0.1, dark), 0, y + 0.55, -1.0)); break;
    case 'chest': g.add(at(box(0.9, 0.45, 0.55, dark), 0, y + 0.23, 0), at(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12, 1, false, 0, Math.PI), wood), 0, y + 0.45, 0, 0, 0, Math.PI / 2)); for (const x of [-0.3, 0.3]) g.add(at(box(0.05, 0.75, 0.6, mat('iron')), x, y + 0.42, 0)); break;
    case 'shelf': case 'bookshelf': {
      g.add(at(box(1.6, 2.0, 0.08, dark), 0, y + 1.0, -0.2));
      for (const x of [-0.78, 0.78]) g.add(at(box(0.06, 2.0, 0.45, dark), x, y + 1.0, 0));
      for (let r = 0; r < 4; r++) {
        g.add(at(box(1.55, 0.05, 0.42, wood), 0, y + 0.25 + r * 0.5, 0));
        for (let k = 0; k < 6; k++) {
          const x = -0.62 + k * 0.25, hh = f.kind === 'bookshelf' ? 0.28 + rnd() * 0.1 : 0.18;
          if (f.kind === 'bookshelf') g.add(at(box(0.18, hh, 0.26, mat([0x7a3b3b, 0x2f5a6a, 0x5a6a3a, 0x8a6a30][k % 4])), x, y + 0.28 + r * 0.5 + hh / 2, 0.02));
          else g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.08, hh, 8), mat([0xc9a050, 0x8a5a3a, 0x6a8a9a, 0xd8cfb8][(k + r) % 4])), x, y + 0.28 + r * 0.5 + hh / 2, 0));
        }
      }
      break;
    }
    case 'counter': case 'bar': case 'grille': {
      const w = f.w ?? (f.kind === 'bar' ? 3.4 : f.kind === 'grille' ? 3.0 : 2.4);
      g.add(at(box(w, 1.0, 0.6, dark), 0, y + 0.5, 0), at(box(w + 0.1, 0.08, 0.7, wood), 0, y + 1.04, 0));
      if (f.kind === 'bar') for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.14, 8), mat(0xc9a050)), -w / 2 + 0.5 + k * 0.8, y + 1.15, 0.1));
      if (f.kind === 'grille') for (let k = 0; k <= Math.floor(w / 0.2); k++) g.add(at(box(0.025, 0.8, 0.025, mat('brass')), -w / 2 + k * 0.2, y + 1.48, 0.25));
      if (f.kind === 'counter') g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), mat('brass')), w / 2 - 0.35, y + 1.14, 0.05), at(box(0.4, 0.12, 0.3, mat(0xd8cfb8)), -w / 2 + 0.4, y + 1.14, 0));
      break;
    }
    case 'barrel': { const b = buildBarrel(0.32, 0.75); b.position.set(0, y, 0); g.add(b); break; }
    case 'kegs': for (let k = 0; k < 3; k++) { const b = buildBarrel(0.28, 0.65); b.rotation.z = Math.PI / 2; b.position.set(-0.6 + k * 0.6, y + 0.3, 0); g.add(b); } break;
    case 'crate': { const c = buildCrate(Math.round(rnd() * 99), 0.7); c.position.y = y; g.add(c); break; }
    case 'sacks': for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0xc9b28a)); s.scale.set(1, 1.3, 0.9); g.add(at(s, -0.3 + k * 0.3, y + 0.35, (k % 2) * 0.1)); } break;
    case 'fireplace': {
      g.add(at(mesh(jitter(new THREE.BoxGeometry(1.6, 1.3, 0.6), 0.03, 9), mat('stone')), 0, y + 0.65, 0));
      g.add(at(box(0.9, 0.7, 0.4, mat(0x1a1410)), 0, y + 0.4, 0.12));
      g.add(at(mesh(new THREE.ConeGeometry(0.22, 0.45, 7), mat(0xff8a3a, { emissive: 0xff6a1a, emissiveIntensity: 2 }), false), 0, y + 0.3, 0.2));
      g.add(at(box(1.8, 0.12, 0.7, mat('stoneDark')), 0, y + 1.32, 0.05));
      // no point light: a dozen hearths would each cost every material in the scene a light
      break;
    }
    case 'rug': g.add(at(box(2.0, 0.02, 1.4, mat(0x7a3b3b), false), 0, y + 0.01, 0), at(box(1.6, 0.025, 1.0, mat(0xc9a050), false), 0, y + 0.012, 0)); break;
    case 'maptable': legs(1.8, 1.2, 0.8); g.add(at(box(1.8, 0.08, 1.2, wood), 0, y + 0.84, 0), at(box(1.4, 0.01, 0.9, mat(0xe6dcc0), false), 0, y + 0.89, 0));
      g.add(at(box(0.3, 0.012, 0.06, mat(0x2f5a6a), false), 0.2, y + 0.9, 0.1, 0, 0.5, 0), at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), mat('brass')), -0.5, y + 0.9, -0.3)); break;
    case 'globe': g.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.2, 0.8, 8), dark), 0, y + 0.4, 0), at(mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0x4f8aa0)), 0, y + 1.05, 0), at(mesh(new THREE.TorusGeometry(0.31, 0.015, 6, 20), mat('brass')), 0, y + 1.05, 0, 0.4, 0, 0)); break;
    case 'pew': legs(2.2, 0.55, 0.45); g.add(at(box(2.2, 0.07, 0.5, wood), 0, y + 0.47, 0), at(box(2.2, 0.6, 0.06, wood), 0, y + 0.8, -0.24)); break;
    case 'altar': g.add(at(box(1.6, 1.0, 0.8, mat('stone')), 0, y + 0.5, 0), at(box(1.7, 0.03, 0.85, mat(0xe8dcc0)), 0, y + 1.01, 0)); for (const x of [-0.55, 0.55]) g.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), mat(0xf4efe6, { emissive: 0xffd9a0, emissiveIntensity: 0.6 }), false), x, y + 1.17, 0)); g.add(at(box(0.5, 0.5, 0.05, mat('brass')), 0, y + 1.3, -0.2)); break;
    case 'cauldron': g.add(at(mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), mat('iron')), 0, y + 0.45, 0), at(mesh(new THREE.CircleGeometry(0.36, 14), mat(0x6a8a3a)), 0, y + 0.62, 0, -Math.PI / 2)); break;
    case 'loom': legs(1.4, 0.9, 1.3); g.add(at(box(1.3, 0.9, 0.04, mat(0xd8cfb8)), 0, y + 0.95, 0), at(box(1.4, 0.08, 0.1, dark), 0, y + 1.4, 0)); break;
    case 'nets': g.add(at(box(1.6, 1.4, 0.04, mat('rope')), 0, y + 0.9, 0)); for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xc04a2c)), -0.6 + k * 0.4, y + 0.3, 0.05)); break;
    case 'plant': g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 10), mat(0x9a5a3a)), 0, y + 0.18, 0), at(mesh(new THREE.IcosahedronGeometry(0.3, 0), mat('leaf')), 0, y + 0.55, 0)); break;
  }
  g.position.set(f.x, 0, f.z);
  g.rotation.y = -(f.rot ?? 0);
  return g;
}

/** A market stall: four posts, a counter of goods and a striped awning in the trader's colour. Local +z is the front. */
export function buildStall(colour: number, seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group(), wood = mat('wood'), dark = mat('woodDark'), cloth = mat(colour), pale = mat(0xeee4cc);
  for (const [x, z, h] of [[-1.1, 0.6, 2.2], [1.1, 0.6, 2.2], [-1.1, -0.6, 2.5], [1.1, -0.6, 2.5]] as const) g.add(at(box(0.1, h, 0.1, dark), x, h / 2, z));
  g.add(at(box(2.3, 0.85, 0.9, dark), 0, 0.43, 0.15), at(box(2.4, 0.07, 1.0, wood), 0, 0.88, 0.15));
  // awning: alternating stripes, sloping down to the front
  for (let k = 0; k < 6; k++) g.add(at(box(0.42, 0.04, 1.6, k % 2 ? pale : cloth), -1.05 + k * 0.42, 2.38, 0, 0.19, 0, 0));
  for (let k = 0; k < 6; k++) g.add(at(box(0.42, 0.22, 0.03, k % 2 ? cloth : pale), -1.05 + k * 0.42, 2.12, 0.8));
  // goods: baskets of fruit and fish, a crate behind
  const goods = [0xc04a2c, 0xd8a030, 0x6a9a3a, 0x9ab0c0];
  for (let k = 0; k < 3; k++) {
    const x = -0.75 + k * 0.75;
    g.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.16, 10), mat('rope')), x, 1.0, 0.25));
    const c = goods[Math.floor(rnd() * goods.length)];
    for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(c)), x + (rnd() - 0.5) * 0.3, 1.12 + rnd() * 0.04, 0.25 + (rnd() - 0.5) * 0.25));
  }
  const cr = buildCrate(seed, 0.6); cr.position.set(0.7, 0, -0.75); g.add(cr);
  return g;
}
