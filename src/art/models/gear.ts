import * as THREE from 'three';
import { m, shade, add } from './itemkit';

// Weapons, tools and armour for icons and loot. Shapes are built to read at 60 px: strong silhouettes,
// a honed edge picked out in a lighter shade, and ornament that grows with the metal's tier (rivets,
// then brass trim, then a sea-glass gem), so better gear looks better at a glance.
// `tier`: -1 = worn starter kit, 0 = bronze, 1 = iron, 2 = steel, 3+ = the island's rarer metals.

const WOOD = '#7a5534', GRIP = '#3d2a1d', BRASS = '#c9a050', GEM = '#59d0c4';

/** Extrude a 2D outline, then thin it toward one side (a blade edge) with `taper(x, y) -> 0..1` of full thickness. */
function plate2d(shape: THREE.Shape, depth: number, taper?: (x: number, y: number) => number, bevel = 0.006): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
  geo.translate(0, 0, -depth / 2);
  if (taper) {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * taper(p.getX(i), p.getY(i)));
    geo.computeVertexNormals();
  }
  return geo;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A wooden haft along y, slightly bowed, with a leather grip and an end knob. */
function haft(g: THREE.Group, len: number, y0: number, bow = 0.03) {
  const geo = new THREE.CylinderGeometry(0.021, 0.027, len, 10, 8);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setX(i, p.getX(i) + bow * (1 - 4 * t * t)); }
  geo.computeVertexNormals();
  add(g, geo, m(WOOD), [0, y0, 0]);
  const bottom = y0 - len / 2;
  for (let k = 0; k < 4; k++) add(g, new THREE.TorusGeometry(0.029, 0.009, 5, 12), m(GRIP), [bow * 0.2, bottom + 0.05 + k * 0.035, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.SphereGeometry(0.033, 10, 8), m(GRIP), [0, bottom, 0], [0, 0, 0], [1, 0.75, 1]);
}

function ornament(g: THREE.Group, tier: number, at: [number, number, number], z: number) {
  if (tier >= 2) for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.014, 8, 6), m(tier >= 3 ? BRASS : '#e9e5d5', 'metal'), [at[0], at[1], s * z]);
  if (tier >= 4) for (const s of [-1, 1]) add(g, new THREE.OctahedronGeometry(0.022, 0), m(GEM, 'glow'), [at[0] - 0.05, at[1], s * (z + 0.004)]);
}

export function buildHatchet(col: string, tier: number): THREE.Group {
  const g = new THREE.Group();
  haft(g, 0.68, -0.02);
  // bearded axe head: poll at the back, eye round the haft, blade sweeping down into a beard
  const s = new THREE.Shape();
  s.moveTo(-0.075, 0.045); s.lineTo(0.02, 0.05); s.quadraticCurveTo(0.11, 0.06, 0.2, 0.14);
  s.quadraticCurveTo(0.265, 0.02, 0.215, -0.13); s.quadraticCurveTo(0.13, -0.11, 0.08, -0.04);
  s.lineTo(0.02, -0.045); s.lineTo(-0.075, -0.04); s.lineTo(-0.075, 0.045);
  const head = plate2d(s, 0.07, (x) => 1 - smooth(0.06, 0.23, x) * 0.82);
  add(g, head, m(col, 'metal'), [0, 0.27, 0]);
  // honed edge
  const e = new THREE.Shape();
  e.moveTo(0.2, 0.14); e.quadraticCurveTo(0.265, 0.02, 0.215, -0.13); e.quadraticCurveTo(0.235, 0.02, 0.18, 0.12); e.lineTo(0.2, 0.14);
  add(g, plate2d(e, 0.026, undefined, 0.003), m(shade(col, 1.45).getHex(), 'metal'), [0, 0.27, 0]);
  add(g, new THREE.CylinderGeometry(0.036, 0.036, 0.1, 10), m(shade(col, 0.75).getHex(), 'metal'), [0, 0.27, 0]); // eye collar
  if (tier < 0) for (const [x, y] of [[0.22, 0.02], [0.205, -0.07]]) add(g, new THREE.BoxGeometry(0.03, 0.02, 0.06), m('#3a2a1a'), [x, 0.27 + y, 0], [0, 0, 0.6]); // notches
  ornament(g, tier, [0.06, 0.27, 0], 0.03);
  g.rotation.z = -0.55;
  return g;
}

export function buildPickaxe(col: string, tier: number): THREE.Group {
  const g = new THREE.Group();
  haft(g, 0.68, -0.04, 0.02);
  // a curved, two-pointed pick head
  const s = new THREE.Shape();
  s.moveTo(-0.3, -0.09); s.quadraticCurveTo(-0.16, 0.07, 0, 0.065); s.quadraticCurveTo(0.16, 0.07, 0.3, -0.09);
  s.quadraticCurveTo(0.15, 0.0, 0, -0.005); s.quadraticCurveTo(-0.15, 0.0, -0.3, -0.09);
  add(g, plate2d(s, 0.06, (x) => 1 - smooth(0.12, 0.3, Math.abs(x)) * 0.7), m(col, 'metal'), [0, 0.28, 0]);
  for (const sx of [-1, 1]) add(g, new THREE.ConeGeometry(0.012, 0.05, 6), m(shade(col, 1.45).getHex(), 'metal'), [sx * 0.29, 0.2, 0], [0, 0, sx * 2.2]); // bright tips
  add(g, new THREE.BoxGeometry(0.075, 0.1, 0.075), m(shade(col, 0.75).getHex(), 'metal'), [0, 0.29, 0]);
  if (tier < 0) add(g, new THREE.BoxGeometry(0.05, 0.03, 0.07), m('#3a2a1a'), [-0.27, 0.205, 0], [0, 0, 0.6]); // a chipped point
  ornament(g, tier, [0.0, 0.29, 0], 0.04);
  g.rotation.z = -0.5;
  return g;
}

export function buildCutlass(col: string, guard: string, tier: number, brigand: boolean): THREE.Group {
  const g = new THREE.Group();
  // blade: narrow at the hilt, curving and widening toward a clipped point (the cutlass flare)
  const s = new THREE.Shape();
  s.moveTo(0, 0.02); s.quadraticCurveTo(0.28, 0.06, 0.5, 0.075); s.lineTo(0.56, 0.05);
  s.quadraticCurveTo(0.52, -0.02, 0.4, -0.035); s.quadraticCurveTo(0.2, -0.04, 0, -0.022); s.lineTo(0, 0.02);
  add(g, plate2d(s, 0.02, (x, y) => 1 - smooth(0.0, -0.035, y - x * 0.08) * 0.75, 0.004), m(col, 'metal'));
  const e = new THREE.Shape();
  e.moveTo(0, -0.022); e.quadraticCurveTo(0.2, -0.04, 0.4, -0.035); e.quadraticCurveTo(0.52, -0.02, 0.56, 0.05); e.quadraticCurveTo(0.5, -0.006, 0.4, -0.022); e.quadraticCurveTo(0.2, -0.027, 0, -0.012);
  add(g, plate2d(e, 0.009, undefined, 0.002), m(shade(col, 1.5).getHex(), 'metal'));
  add(g, new THREE.BoxGeometry(0.34, 0.007, 0.024), m(shade(col, 0.7).getHex(), 'metal'), [0.21, 0.022, 0], [0, 0, 0.1]); // fuller
  if (tier < 0) for (const [x, y] of [[0.25, 0.0], [0.42, 0.02], [0.12, 0.0]]) add(g, new THREE.SphereGeometry(0.02, 6, 4), m('#7a4a2a'), [x, y, 0], [0, 0, 0], [1.4, 0.8, 0.4]); // rust
  // hilt: cup guard, knuckle bow, wrapped grip, pommel
  add(g, new THREE.SphereGeometry(0.065, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(guard, 'metal'), [-0.005, 0, 0], [0, 0, Math.PI / 2], [1, 0.6, 1]);
  add(g, new THREE.TorusGeometry(0.075, 0.011, 6, 16, Math.PI * 1.05), m(guard, 'metal'), [-0.085, -0.035, 0], [0, 0, Math.PI * 0.55]);
  add(g, new THREE.CylinderGeometry(0.022, 0.025, 0.13, 10), m(brigand ? '#5a1a14' : GRIP), [-0.08, 0, 0], [0, 0, Math.PI / 2]);
  for (let k = 0; k < 3; k++) add(g, new THREE.TorusGeometry(0.025, 0.006, 4, 10), m(BRASS, 'metal'), [-0.04 - k * 0.04, 0, 0], [0, Math.PI / 2, 0]);
  add(g, new THREE.SphereGeometry(0.032, 10, 8), m(guard, 'metal'), [-0.155, 0, 0]);
  if (brigand) add(g, new THREE.BoxGeometry(0.02, 0.16, 0.012), m('#a02a22'), [-0.16, -0.08, 0.02], [0, 0, 0.25]); // a red tassel
  if (tier >= 4) add(g, new THREE.OctahedronGeometry(0.022, 0), m(GEM, 'glow'), [-0.155, 0, 0.03]);
  g.rotation.z = 0.62;
  g.position.set(-0.05, -0.05, 0);
  return g;
}

export function buildHelm(col: string, tier: number): THREE.Group {
  // a morion: tall combed crown and a brim swept up into peaks fore and aft
  const g = new THREE.Group();
  const crown = new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  crown.scale(0.92, 1.05, 1.15);
  add(g, crown, m(col, 'metal'), [0, 0, 0]);
  const comb = new THREE.Shape();
  comb.moveTo(-0.17, 0.0); comb.quadraticCurveTo(-0.16, 0.3, 0, 0.31); comb.quadraticCurveTo(0.16, 0.3, 0.17, 0.0); comb.lineTo(-0.17, 0);
  add(g, plate2d(comb, 0.016, undefined, 0.004), m(shade(col, 1.1).getHex(), 'metal'), [0, 0, 0], [0, Math.PI / 2, 0]);
  const brimProf = [[0.15, 0.0], [0.19, -0.008], [0.225, 0.004], [0.235, 0.016]].map(([r, y]) => new THREE.Vector2(r, y));
  const brim = new THREE.LatheGeometry(brimProf, 32);
  const p = brim.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i) * 1.2, x = p.getX(i) * 0.8; p.setXYZ(i, x, p.getY(i) + Math.max(0, Math.abs(z) - 0.16) ** 2 * 3.2, z); }
  brim.computeVertexNormals();
  add(g, brim, new THREE.MeshStandardMaterial({ color: m(col, 'metal').color, roughness: 0.32, metalness: 0.55, side: THREE.DoubleSide }), [0, 0.0, 0]);
  add(g, new THREE.TorusGeometry(0.17, 0.012, 6, 28), m(tier >= 3 ? BRASS : shade(col, 0.75).getHex(), 'metal'), [0, 0.008, 0], [Math.PI / 2, 0, 0], [0.92, 1.15, 1]);
  if (tier >= 1) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add(g, new THREE.SphereGeometry(0.012, 6, 4), m('#e9e5d5', 'metal'), [Math.cos(a) * 0.156, 0.03, Math.sin(a) * 0.19]); }
  if (tier >= 3) {
    // a plume: a few curved feathers off the back of the comb
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.2, -0.12), new THREE.Vector3(0, 0.36, -0.22), new THREE.Vector3(0, 0.3, -0.36));
    for (const dx of [-0.02, 0, 0.02]) add(g, new THREE.TubeGeometry(curve, 10, 0.022, 6), m(tier >= 5 ? GEM : '#b8332a'), [dx, 0, 0]);
  }
  if (tier >= 4) add(g, new THREE.OctahedronGeometry(0.026, 0), m(GEM, 'glow'), [0, 0.06, 0.18]);
  g.position.y = -0.08;
  g.rotation.set(-0.3, 1.4, 0); // tipped back, nearly side-on: the comb and swept brim are the morion's silhouette
  return g;
}

/** A shaped breastplate surface: grid points inside the torso outline, bowed like a barrel with a raised ridge. */
function cuirassSurface(outline: THREE.Vector2[], depth: (x: number, y: number) => number, cell = 0.008): THREE.BufferGeometry {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const v of outline) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i], b = outline[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1;
  const pos: number[] = [], idx: number[] = [], id = new Int32Array(nx * ny).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell;
    if (!inside(x, y)) continue;
    id[j * nx + i] = pos.length / 3;
    pos.push(x, y, depth(x, y));
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = id[j * nx + i], b = id[j * nx + i + 1], c2 = id[(j + 1) * nx + i], d = id[(j + 1) * nx + i + 1];
    if (a >= 0 && b >= 0 && c2 >= 0) idx.push(a, b, c2);
    if (b >= 0 && d >= 0 && c2 >= 0) idx.push(b, d, c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildPlate(col: string, tier: number): THREE.Group {
  const g = new THREE.Group();
  // torso outline: neck scoop, shoulders, arm-holes, a narrow waist flaring to a pointed peascod front
  const s = new THREE.Shape();
  s.moveTo(-0.12, 0.2); s.quadraticCurveTo(0, 0.12, 0.12, 0.2); s.lineTo(0.2, 0.17);
  s.quadraticCurveTo(0.14, 0.1, 0.15, -0.02); s.quadraticCurveTo(0.15, -0.12, 0.17, -0.18);
  s.quadraticCurveTo(0.08, -0.2, 0, -0.24); s.quadraticCurveTo(-0.08, -0.2, -0.17, -0.18);
  s.quadraticCurveTo(-0.15, -0.12, -0.15, -0.02); s.quadraticCurveTo(-0.14, 0.1, -0.2, 0.17); s.lineTo(-0.12, 0.2);
  const outline = s.getPoints(10);
  const bow = (x: number, y: number) => 0.12 * Math.sqrt(Math.max(0, 1 - (x / 0.26) ** 2)) + 0.022 * Math.max(0, 1 - Math.abs(x) / 0.035) * smooth(0.16, -0.05, y) + 0.018 * Math.exp(-((Math.abs(x) - 0.08) ** 2 + (y - 0.07) ** 2) / 0.004) + 0.03 * smooth(-0.1, -0.24, y) * (1 - Math.abs(x) / 0.2);
  const metal = new THREE.MeshStandardMaterial({ color: m(col, 'metal').color, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
  add(g, cuirassSurface(outline, bow), metal);
  // backplate for depth
  add(g, cuirassSurface(outline, (x, y) => -bow(x, y) * 0.55 - 0.02), new THREE.MeshStandardMaterial({ color: shade(col, 0.6), roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
  // rolled edges all round (and they hide the surface's stepped rim)
  const trim = tier >= 3 ? BRASS : shade(col, 0.8).getHex();
  const edge = new THREE.CatmullRomCurve3(outline.map((v) => new THREE.Vector3(v.x * 0.985, v.y * 0.985, bow(v.x * 0.985, v.y * 0.985))), true);
  add(g, new THREE.TubeGeometry(edge, 120, 0.012, 6, true), m(trim, 'metal'));
  // pauldrons: three overlapping lames over each shoulder
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const lame = new THREE.SphereGeometry(0.1 - k * 0.012, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2);
    add(g, lame, m(k === 0 ? col : shade(col, 0.92 - k * 0.06).getHex(), 'metal'), [sx * (0.2 + k * 0.03), 0.17 - k * 0.045, 0.02], [0, 0, -sx * (0.55 + k * 0.25)], [1.05, 0.55, 1]);
  }
  // fauld: two lames below the waist
  for (let k = 0; k < 2; k++) {
    const band = new THREE.CylinderGeometry(0.16 + k * 0.02, 0.175 + k * 0.02, 0.05, 20, 1, true, -Math.PI * 0.55, Math.PI * 1.1);
    add(g, band, new THREE.MeshStandardMaterial({ color: shade(col, 0.88 - k * 0.08), roughness: 0.32, metalness: 0.55, side: THREE.DoubleSide }), [0, -0.235 - k * 0.045, -0.02], [0, 0, 0], [1, 1, 0.75]);
  }
  if (tier >= 1) for (const [x, y] of [[-0.1, 0.15], [0.1, 0.15], [-0.13, -0.15], [0.13, -0.15]]) add(g, new THREE.SphereGeometry(0.013, 6, 4), m(tier >= 3 ? BRASS : '#e9e5d5', 'metal'), [x, y, bow(x, y) + 0.008]);
  if (tier >= 4) add(g, new THREE.OctahedronGeometry(0.03, 0), m(GEM, 'glow'), [0, 0.06, bow(0, 0.06) + 0.02]);
  if (tier >= 5) { // tidecore: a wave crest worked across the chest
    const curve = new THREE.CatmullRomCurve3([-0.11, -0.06, 0, 0.06, 0.11].map((x, i) => new THREE.Vector3(x, 0.0 + (i % 2 ? 0.02 : -0.01), bow(x, 0) + 0.006)));
    add(g, new THREE.TubeGeometry(curve, 30, 0.007, 5), m(GEM, 'glow'));
  }
  return g;
}

export function buildPistol(stock: string, metal: string, tier: number): THREE.Group {
  // a flintlock: long banded barrel, curved stock ending in a capped butt, lock and cock, guard and ramrod
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.028); s.lineTo(-0.05, 0.028); s.quadraticCurveTo(-0.11, 0.02, -0.15, -0.05);
  s.quadraticCurveTo(-0.19, -0.13, -0.2, -0.18); s.quadraticCurveTo(-0.24, -0.215, -0.28, -0.185);
  s.quadraticCurveTo(-0.27, -0.12, -0.2, -0.02); s.quadraticCurveTo(-0.15, 0.055, -0.08, 0.06); s.lineTo(0.25, 0.06); s.lineTo(0.25, 0.028);
  add(g, plate2d(s, 0.05, undefined, 0.01), m(stock));
  add(g, new THREE.CylinderGeometry(0.021, 0.026, 0.44, 12), m(metal, 'metal'), [0.13, 0.078, 0], [0, 0, Math.PI / 2]);
  for (const x of [0.33, 0.19, 0.04]) add(g, new THREE.TorusGeometry(0.025, 0.006, 6, 14), m(tier >= 3 ? BRASS : shade(metal, 0.75).getHex(), 'metal'), [x, 0.078, 0], [0, Math.PI / 2, 0]);
  add(g, new THREE.TorusGeometry(0.022, 0.008, 6, 14), m(shade(metal, 0.8).getHex(), 'metal'), [0.35, 0.078, 0], [0, Math.PI / 2, 0]); // muzzle
  add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.36, 6), m(WOOD), [0.13, 0.035, 0], [0, 0, Math.PI / 2]); // ramrod
  add(g, new THREE.SphereGeometry(0.01, 6, 4), m(BRASS, 'metal'), [0.31, 0.035, 0]);
  add(g, new THREE.SphereGeometry(0.04, 12, 8), m(BRASS, 'metal'), [-0.255, -0.19, 0], [0, 0, 0.5], [1.2, 0.8, 0.9]); // butt cap
  add(g, new THREE.BoxGeometry(0.09, 0.04, 0.054), m(shade(metal, 0.85).getHex(), 'metal'), [-0.06, 0.05, 0]); // lock plate
  const cock = new THREE.TorusGeometry(0.03, 0.009, 5, 10, Math.PI * 0.9);
  add(g, cock, m(shade(metal, 0.9).getHex(), 'metal'), [-0.085, 0.085, 0.02], [0, 0, 0.6]);
  add(g, new THREE.BoxGeometry(0.012, 0.035, 0.02), m(shade(metal, 0.9).getHex(), 'metal'), [-0.035, 0.1, 0.02], [0, 0, -0.2]); // frizzen
  add(g, new THREE.TorusGeometry(0.035, 0.007, 5, 12, Math.PI), m(BRASS, 'metal'), [-0.07, 0.022, 0], [0, 0, Math.PI]);
  add(g, new THREE.BoxGeometry(0.007, 0.03, 0.01), m(shade(metal, 0.7).getHex(), 'metal'), [-0.07, 0.01, 0], [0, 0, 0.3]);
  if (tier >= 4) add(g, new THREE.OctahedronGeometry(0.02, 0), m(GEM, 'glow'), [-0.18, -0.06, 0.03]);
  g.rotation.z = 0.15;
  return g;
}

export function buildStaff(wood: string, crystal: string, tier: number): THREE.Group {
  // a gnarled driftwood staff whose top splits into three prongs cradling a glowing crystal
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.02, 0.03, 0.82, 8, 16);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 9) * 0.012 + Math.sin(y * 23) * 0.004); p.setZ(i, p.getZ(i) + Math.cos(y * 7) * 0.01); }
  geo.computeVertexNormals();
  add(g, geo, m(wood), [0, -0.08, 0]);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(Math.cos(a) * 0.08, 0.36, Math.sin(a) * 0.08), new THREE.Vector3(Math.cos(a) * 0.03, 0.47, Math.sin(a) * 0.03));
    add(g, new THREE.TubeGeometry(curve, 8, 0.011, 5), m(wood));
  }
  add(g, new THREE.OctahedronGeometry(0.055, 0), m(crystal, 'glow'), [0, 0.4, 0], [0, 0.4, 0], [0.8, 1.5, 0.8]);
  for (let k = 0; k < 3; k++) add(g, new THREE.TorusGeometry(0.03, 0.007, 4, 10), m(GRIP), [0, 0.05 - k * 0.03, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(0.03, 0.006, 4, 10), m(tier >= 1 ? BRASS : GRIP, tier >= 1 ? 'metal' : 'matte'), [0, 0.29, 0], [Math.PI / 2, 0, 0]);
  if (tier >= 1) for (const dy of [0, -0.05]) add(g, new THREE.SphereGeometry(0.012, 6, 4), m(crystal, 'gloss'), [0.035, 0.0 + dy, 0.02]); // hanging beads
  g.rotation.z = -0.4;
  return g;
}
