import * as THREE from 'three';
import { mat, mesh, jitter, PAL } from '../materials';
import { mulberry32 } from '../noise';

// Set dressing in the island's style: chunky primitives, palette materials, a little jitter so nothing
// is ruler-straight. All front-faced and unlit-free, so the static bake merges them into a few draw calls.

const at = (m: THREE.Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
const box = (w: number, h: number, d: number, key: Parameters<typeof mat>[0], seed = 0, j = 0.015) => mesh(j ? jitter(new THREE.BoxGeometry(w, h, d), j, seed) : new THREE.BoxGeometry(w, h, d), mat(key));
const log = (r: number, len: number, key: Parameters<typeof mat>[0], seed: number) => mesh(jitter(new THREE.CylinderGeometry(r, r * 1.08, len, 7), r * 0.12, seed), mat(key));

/** Two posts and a pole hung with net, for the quay. */
export function buildNetRack(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  for (const x of [-1.2, 1.2]) g.add(at(log(0.07, 1.9, 'woodDark', seed + x * 10), x, 0.95, 0, 0, 0, x * 0.04));
  g.add(at(log(0.05, 2.7, 'wood', seed + 3), 0, 1.82, 0, 0, 0, Math.PI / 2));
  // the net: knotted strands drooping from the pole, a few floats along the hem
  for (let i = 0; i <= 9; i++) {
    const x = -1.05 + i * 0.233, len = 1.0 + Math.sin(i * 0.9 + seed) * 0.15 + rnd() * 0.1;
    g.add(at(mesh(new THREE.BoxGeometry(0.02, len, 0.02), mat('rope'), false), x, 1.8 - len / 2, 0.04, 0.06, 0, (rnd() - 0.5) * 0.08));
  }
  for (let k = 0; k < 5; k++) g.add(at(mesh(new THREE.BoxGeometry(2.15, 0.018, 0.02), mat('rope'), false), 0, 1.62 - k * 0.2, 0.05, 0, 0, Math.sin(k + seed) * 0.03));
  for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.SphereGeometry(0.07, 7, 5), mat(k % 2 ? 'brass' : PAL.hullRed)), -0.8 + k * 0.53, 0.78 + rnd() * 0.08, 0.06));
  return g;
}

/** A small rowing boat hauled up the sand, oars inside. */
export function buildRowboat(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const hullGeo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hullGeo.scale(0.75, 0.42, 1.7);
  // lower hemisphere = an open bowl; double-sided so the inside of the hull shows above the boards
  const hull = mesh(jitter(hullGeo, 0.015, seed), mat(rnd() > 0.5 ? PAL.teal : PAL.hullRed, { side: THREE.DoubleSide }));
  hull.position.y = 0.42;
  const inner = mesh(new THREE.CircleGeometry(1, 14), mat('plankWorn'));
  inner.scale.set(0.7, 1.62, 1);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.3;
  const rim = mesh(new THREE.TorusGeometry(1, 0.04, 5, 20), mat('wood'));
  rim.scale.set(0.75, 1.7, 1);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  g.add(hull, inner, rim);
  for (const z of [-0.6, 0.35]) g.add(at(box(1.3, 0.05, 0.22, 'plank'), 0, 0.38, z));
  for (const s of [-1, 1]) {
    g.add(at(log(0.025, 2.2, 'woodLight', seed + s), s * 0.2, 0.42, 0.05, Math.PI / 2 - 0.05, 0, s * 0.12));
    g.add(at(box(0.14, 0.02, 0.45, 'woodLight'), s * 0.32, 0.43, 1.1 - (s > 0 ? 0.1 : 0), 0, s * 0.12, 0));
  }
  g.rotation.z = 0.12; // listing on the sand
  return g;
}

/** Signpost with arrow boards (the boards point along the given bearings). */
export function buildSignpost(seed: number, bearings: number[]): THREE.Group {
  const g = new THREE.Group();
  g.add(at(log(0.07, 2.2, 'woodDark', seed), 0, 1.1, 0));
  bearings.forEach((b, i) => {
    const arm = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.11); shape.lineTo(0.62, -0.11); shape.lineTo(0.76, 0); shape.lineTo(0.62, 0.11); shape.lineTo(0, 0.11); shape.lineTo(0, -0.11);
    const board = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), mat(i % 2 ? 'plank' : 'woodLight'));
    board.position.set(0.06, 0, -0.02);
    arm.add(board);
    for (let k = 0; k < 3; k++) arm.add(at(mesh(new THREE.BoxGeometry(0.1 + k * 0.04, 0.025, 0.01), mat('woodDark'), false), 0.22 + k * 0.14, 0.02 - (k % 2) * 0.04, 0.025));
    arm.position.y = 1.85 - i * 0.3;
    arm.rotation.y = -b;
    g.add(arm);
  });
  g.add(at(mesh(new THREE.ConeGeometry(0.1, 0.12, 6), mat('woodDark')), 0, 2.26, 0));
  return g;
}

/** A run of split-rail fence `len` metres long along +x. */
export function buildFence(seed: number, len: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed), n = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) g.add(at(log(0.06, 1.0, 'woodDark', seed + i), -len / 2 + (i * len) / n, 0.5, 0, (rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08));
  for (const y of [0.42, 0.78]) for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + (i * len) / n, seg = len / n;
    g.add(at(log(0.035, seg + 0.1, 'wood', seed + i * 7 + y * 10), x0 + seg / 2, y + (rnd() - 0.5) * 0.06, 0.06, 0, 0, Math.PI / 2 + (rnd() - 0.5) * 0.06));
  }
  return g;
}

/** Village well: stone drum, two posts, a little roof and a bucket on the windlass. */
export function buildWell(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(jitter(new THREE.CylinderGeometry(0.85, 0.92, 0.8, 10, 1, true), 0.04, 5), mat('stone')), 0, 0.4, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.86, 0.1, 6, 12), mat('stoneDark')), 0, 0.8, 0, Math.PI / 2));
  g.add(at(mesh(new THREE.CircleGeometry(0.8, 12), mat(0x1d2a2e)), 0, 0.45, 0, -Math.PI / 2));
  for (const x of [-0.75, 0.75]) g.add(at(box(0.12, 1.7, 0.12, 'woodDark', 7, 0.01), x, 1.4, 0));
  g.add(at(log(0.08, 1.6, 'wood', 9), 0, 1.65, 0, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) g.add(at(box(1.9, 0.06, 0.8, 'roof', 0, 0), 0, 2.38, s * 0.33, s * 0.55, 0, 0));
  g.add(at(log(0.012, 0.6, 'rope', 11), 0.1, 1.33, 0));
  const bucket = at(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.24, 8), mat('plankWorn')), 0.1, 0.95, 0);
  g.add(bucket, at(mesh(new THREE.TorusGeometry(0.15, 0.015, 4, 10), mat('iron')), 0.1, 1.05, 0, Math.PI / 2));
  return g;
}

/** Bleached driftwood log with a stub branch. */
export function buildDriftwood(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed), len = 1.4 + rnd() * 1.2;
  g.add(at(log(0.11 + rnd() * 0.05, len, 0xb7ab97, seed), 0, 0.1, 0, 0, 0, Math.PI / 2 + (rnd() - 0.5) * 0.1));
  g.add(at(log(0.05, 0.6, 0xa89c88, seed + 1), len * 0.2, 0.2, 0.15, 0.6, 0.4, 0.9));
  return g;
}

/** A scatter of shells and a starfish or two. */
export function buildShells(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.05 : 0.14; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0); }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  for (let k = 0; k < 2; k++) if (rnd() > 0.35) g.add(at(mesh(starGeo, mat(k ? 0xd8743a : 0xc85a4a), false), (rnd() - 0.5) * 1.4, 0.03, (rnd() - 0.5) * 1.4, -Math.PI / 2, 0, rnd() * 6));
  for (let k = 0; k < 5; k++) {
    const s = mesh(new THREE.SphereGeometry(0.06 + rnd() * 0.04, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(rnd() > 0.5 ? 0xe9ddc8 : 0xe6c2a8), false);
    s.scale.set(1, 0.55, 1.3);
    g.add(at(s, (rnd() - 0.5) * 1.6, 0.0, (rnd() - 0.5) * 1.6, 0, rnd() * 6, 0));
  }
  return g;
}

/** Lobster pots stacked beside a coil of rope. */
export function buildPotStack(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const pot = (x: number, y: number, z: number, ry: number) => {
    const p = new THREE.Group();
    p.add(at(box(0.62, 0.05, 0.42, 'plankWorn'), 0, 0.02, 0));
    for (let k = 0; k < 4; k++) p.add(at(mesh(new THREE.TorusGeometry(0.21, 0.018, 4, 10, Math.PI), mat('wood'), false), -0.24 + k * 0.16, 0.04, 0, 0, Math.PI / 2, 0));
    for (let k = 0; k < 3; k++) p.add(at(mesh(new THREE.BoxGeometry(0.6, 0.012, 0.012), mat('rope'), false), 0, 0.12 + k * 0.05, -0.18 + k * 0.18));
    p.position.set(x, y, z);
    p.rotation.y = ry;
    g.add(p);
  };
  pot(0, 0, 0, 0); pot(0.68, 0, 0.05, 0.15); pot(0.32, 0.26, 0.02, -0.1 + rnd() * 0.2);
  for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.TorusGeometry(0.22 - k * 0.035, 0.03, 4, 14), mat('rope')), -0.7, 0.03 + k * 0.05, 0.25, Math.PI / 2));
  return g;
}

/** Iron cannon on a wooden carriage. */
export function buildCannon(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(0.7, 0.28, 1.1, 'wood', 21), 0, 0.32, 0));
  for (const x of [-0.42, 0.42]) for (const z of [-0.38, 0.38]) g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), mat('woodDark')), x, 0.2, z, 0, 0, Math.PI / 2));
  const barrel = mesh(new THREE.CylinderGeometry(0.13, 0.19, 1.5, 12), mat('iron'));
  g.add(at(barrel, 0, 0.62, 0.15, Math.PI / 2 - 0.12, 0, 0));
  g.add(at(mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 12), mat('iron')), 0, 0.71, 0.88, 0.12, 0, 0));
  g.add(at(mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('iron')), 0, 0.53, -0.62));
  for (const [x, z] of [[0.6, -0.5], [0.75, -0.3], [0.68, -0.4]]) g.add(at(mesh(new THREE.SphereGeometry(0.1, 8, 6), mat('iron')), x, 0.1, z));
  return g;
}

/** The ribs and keel of an old wreck, half sunk in the sand. */
export function buildWreckRibs(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  g.add(at(log(0.16, 7.5, 'woodDark', seed), 0, 0.15, 0, Math.PI / 2, 0, 0));
  for (let k = 0; k < 7; k++) {
    const z = -3.2 + k * 1.05, r = 1.9 - Math.abs(k - 3) * 0.18, broken = rnd() > 0.6;
    for (const s of [-1, 1]) {
      if (broken && s > 0) continue;
      // an arc from the keel (bottom of the circle, buried) up the side and curling in at the top
      const rib = mesh(new THREE.TorusGeometry(r, 0.1, 5, 10, Math.PI * (0.5 + rnd() * 0.15)), mat(k % 2 ? 'woodDark' : 'wood'));
      g.add(at(rib, 0, r * 0.95, z, 0, s > 0 ? 0 : Math.PI, -Math.PI / 2));
    }
  }
  for (let k = 0; k < 3; k++) g.add(at(box(0.28, 0.06, 1.6 + rnd(), 'plankWorn', seed + k), (rnd() - 0.5) * 2.6, 0.05, (rnd() - 0.5) * 5, 0, rnd() * 3, 0.1));
  g.rotation.z = 0.15;
  return g;
}

/** Split logs stacked against a wall. */
export function buildWoodpile(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    const l = log(0.13, 1.1, rnd() > 0.5 ? 'wood' : 'trunk', seed + row * 9 + i);
    g.add(at(l, -0.4 + row * 0.13 + i * 0.27, 0.13 + row * 0.23, (rnd() - 0.5) * 0.1, Math.PI / 2, 0, 0));
    g.add(at(mesh(new THREE.CircleGeometry(0.11, 7), mat('woodLight'), false), -0.4 + row * 0.13 + i * 0.27, 0.13 + row * 0.23, 0.56));
  }
  g.add(at(log(0.12, 0.35, 'trunk', seed + 50), 0.9, 0.18, 0.2));
  g.add(at(box(0.04, 0.32, 0.12, 'iron', 0, 0), 0.92, 0.48, 0.2, 0, 0, 0.5));
  g.add(at(log(0.02, 0.5, 'woodLight', seed + 51), 1.0, 0.55, 0.2, 0, 0, 0.5));
  return g;
}

/** A clump of wildflowers. */
export function buildFlowers(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const cols = [0xe8d35a, 0xd8584a, 0xe9e3d0, 0x9a7ad0, 0xf0a04a];
  const c = cols[seed % cols.length];
  for (let k = 0; k < 7; k++) {
    const x = (rnd() - 0.5) * 0.9, z = (rnd() - 0.5) * 0.9, h = 0.2 + rnd() * 0.22;
    g.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.012, h, 4), mat('grassTuft'), false), x, h / 2, z));
    g.add(at(mesh(new THREE.IcosahedronGeometry(0.05 + rnd() * 0.02, 0), mat(rnd() > 0.8 ? cols[(seed + 2) % cols.length] : c), false), x, h, z));
  }
  return g;
}
