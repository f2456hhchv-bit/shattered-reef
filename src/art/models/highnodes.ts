import * as THREE from 'three';
import { mat, mesh, jitter, PAL } from '../materials';
import { mulberry32 } from '../noise';

// The high-level gathering spots and their stations. Each has a silhouette and colour of its own, so you
// can tell a level-75 vent from a level-25 coal seam at a glance: glow and size grow with the level.

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const BONE = 0xe6dcc4, BONE_D = 0xb8ab90, BASALT = 0x2a2624, EMBER = 0xff6a1a, SKY = 0x9a8aff, ORI = 0xf2b84a;

/** Cinderite vent: a black basalt mound split by glowing cracks, an ember core showing through. */
export function buildCinderVent(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const mound = mesh(jitter(new THREE.DodecahedronGeometry(0.85, 1), 0.12, seed), mat(BASALT));
  mound.scale.set(1.2, 0.75, 1.05);
  g.add(at(mound, 0, 0.45, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rnd() * 0.4;
    const crack = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.5 + rnd() * 0.3), mat(EMBER, { emissive: EMBER, emissiveIntensity: 1.6 }), false);
    g.add(at(crack, Math.cos(a) * 0.55, 0.62 + rnd() * 0.15, Math.sin(a) * 0.5, 0.5, -a, 0.3));
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xffa040, { emissive: 0xff7a20, emissiveIntensity: 2.2 }), false), 0, 0.98, 0));
  for (let k = 0; k < 4; k++) { const a = rnd() * 6.28; g.add(at(mesh(new THREE.ConeGeometry(0.12, 0.5, 5), mat(BASALT)), Math.cos(a) * 0.75, 0.3, Math.sin(a) * 0.7, rnd() * 0.4, 0, rnd() * 0.4)); }
  return g;
}

/** Fallen star: a pitted, charred lump bristling with violet skyglass. */
export function buildFallenStar(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const rock = mesh(jitter(new THREE.IcosahedronGeometry(0.75, 1), 0.16, seed), mat(0x3a3448));
  rock.scale.set(1.15, 0.8, 1);
  g.add(at(rock, 0, 0.45, 0));
  for (let k = 0; k < 7; k++) {
    const a = rnd() * Math.PI * 2, tilt = 0.3 + rnd() * 0.6, len = 0.35 + rnd() * 0.45;
    const c = mesh(new THREE.OctahedronGeometry(0.17, 0), mat(SKY, { emissive: SKY, emissiveIntensity: 1.3 }), false);
    c.scale.set(0.75, len / 0.17 * 0.8, 0.75);
    g.add(at(c, Math.cos(a) * 0.45, 0.75 + rnd() * 0.15, Math.sin(a) * 0.4, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt));
  }
  return g;
}

/** Leviathan bones: one great rib arching out of the sand beside a vertebra. */
export function buildBones(seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const rib = mesh(new THREE.TorusGeometry(1.1, 0.13, 8, 18, Math.PI * 0.85), mat(BONE));
  g.add(at(rib, 0, 0, 0, 0, rnd() * 3, 0.15));
  const vert = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.45, 10), mat(BONE_D));
  g.add(at(vert, 0.6, 0.2, 0.4, 0.3, 0, 0.4));
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.ConeGeometry(0.1, 0.45, 6), mat(BONE)), 0.6 + s * 0.3, 0.35, 0.4, 0, 0, s * 1.2));
  g.add(at(mesh(new THREE.ConeGeometry(0.09, 0.5, 6), mat(BONE)), 0.6, 0.55, 0.45, 0.3, 0, 0.4));
  // a vein of metal where the bone has turned
  g.add(at(mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), mat(0xefe6cf, { emissive: 0xfff2d0, emissiveIntensity: 0.5 }), false), -0.95, 0.45, 0.05, 0, 0, 0.6));
  return g;
}

/** The Drowned Spire: a carved column of the sunken city rising from deep water, veined with orichalcum. */
export function buildSpire(seed: number, height: number, mined = false): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const col = mesh(jitter(new THREE.CylinderGeometry(0.7, 1.3, height, 9, 8), 0.08, seed), mat(0x5a6a68));
  g.add(at(col, 0, height / 2, 0));
  for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.TorusGeometry(0.85 + k * 0.08, 0.07, 6, 18), mat(0x4a5856)), 0, height - 0.8 - k * 1.6, 0, Math.PI / 2));
  // broken capital at the top
  const cap = mesh(jitter(new THREE.CylinderGeometry(1.0, 0.75, 0.6, 9), 0.1, seed + 1), mat(0x6a7a76));
  g.add(at(cap, 0, height + 0.2, 0, 0.12, 0, 0.08));
  if (!mined) for (let k = 0; k < 6; k++) {
    const y = height - 1 - rnd() * 3.5, a = rnd() * Math.PI * 2;
    g.add(at(mesh(new THREE.BoxGeometry(0.12, 0.8 + rnd() * 0.6, 0.12), mat(ORI, { emissive: ORI, emissiveIntensity: 0.7 }), false), Math.cos(a) * 0.82, y, Math.sin(a) * 0.82, 0, -a, 0.3));
  }
  for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, y = height - 3 - rnd() * 1.4; g.add(at(mesh(new THREE.SphereGeometry(0.08 + rnd() * 0.05, 6, 4), mat(PAL.barnacle)), Math.cos(a) * 0.95, y, Math.sin(a) * 0.95)); }
  return g;
}

/** Salt pan: a shallow, rimmed evaporation pool with a white crust and a heap of scraped salt. */
export function buildSaltPan(seed: number, full = true): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  for (const [x, z, w, d] of [[0, 0.9, 2.2, 0.25], [0, -0.9, 2.2, 0.25], [1.0, 0, 0.25, 1.6], [-1.0, 0, 0.25, 1.6]] as const) g.add(at(mesh(jitter(new THREE.BoxGeometry(w, 0.18, d), 0.03, seed + x * 10 + z), mat('stone')), x, 0.09, z));
  g.add(at(mesh(new THREE.PlaneGeometry(1.8, 1.6), mat(0x8fc8d0)), 0, 0.05, 0, -Math.PI / 2));
  if (full) {
    for (let k = 0; k < 7; k++) { const c = mesh(new THREE.CircleGeometry(0.18 + rnd() * 0.2, 9), mat(0xf4f0e6), false); g.add(at(c, (rnd() - 0.5) * 1.4, 0.06, (rnd() - 0.5) * 1.2, -Math.PI / 2)); }
    g.add(at(mesh(new THREE.ConeGeometry(0.28, 0.3, 9), mat(0xf6f2ea)), 1.45, 0.15, 0.6));
  }
  g.add(at(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), mat('wood')), 1.45, 0.25, -0.3, 0.2, 0, 1.1));
  return g;
}

/** The vent forge: a stone hearth built over a magma fissure on the summit. Returns the glow material to flicker. */
export function buildVentForge(): { group: THREE.Group; glow: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff5a10, emissiveIntensity: 2.4 });
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; g.add(at(mesh(jitter(new THREE.DodecahedronGeometry(0.35, 0), 0.06, k + 3), mat(BASALT)), Math.cos(a) * 1.05, 0.25, Math.sin(a) * 1.05)); }
  g.add(at(mesh(new THREE.CircleGeometry(0.85, 14), glow, false), 0, 0.12, 0, -Math.PI / 2));
  g.add(at(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.08), glow, false), 0.3, 0.14, 1.3, 0, 0.3, 0)); // the fissure runs out under the rim
  g.add(at(mesh(jitter(new THREE.CylinderGeometry(0.25, 0.42, 1.6, 7), 0.05, 11), mat('stoneDark')), -0.6, 0.9, -0.85));
  g.add(at(mesh(new THREE.BoxGeometry(0.8, 0.12, 0.45), mat('iron')), 0, 0.55, 0)); // a crucible grate over the fire
  const light = new THREE.PointLight(0xff7a2a, 5, 7, 1.6);
  light.position.set(0, 1.0, 0);
  g.add(light);
  return { group: g, glow };
}

/** The leviathan: skull, a curving spine and ribs half-sunk in the islet's sand. */
export function buildLeviathan(): THREE.Group {
  const g = new THREE.Group();
  const skull = mesh(jitter(new THREE.SphereGeometry(1.6, 14, 10), 0.12, 3), mat(BONE));
  skull.scale.set(2.2, 0.7, 1.0);
  g.add(at(skull, 8.5, 0.6, 0));
  const jaw = mesh(new THREE.TorusGeometry(2.8, 0.18, 6, 18, Math.PI * 0.55), mat(BONE_D));
  g.add(at(jaw, 9.5, 0.3, 0.9, Math.PI / 2, 0, -0.2));
  for (let k = 0; k < 16; k++) {
    const x = 6.5 - k * 0.95, y = 0.35 + Math.sin(k * 0.4) * 0.25 - k * 0.02, r = Math.max(0.35, 2.5 - Math.abs(k - 4) * 0.22);
    g.add(at(mesh(new THREE.CylinderGeometry(0.34 - k * 0.012, 0.34 - k * 0.012, 0.6, 8), mat(k % 2 ? BONE : BONE_D)), x, y, 0, 0, 0, Math.PI / 2));
    g.add(at(mesh(new THREE.ConeGeometry(0.1, 0.55, 5), mat(BONE)), x, y + 0.45, 0));
    if (k < 11) for (const s of [-1, 1]) {
      const rib = mesh(new THREE.TorusGeometry(r, 0.11, 5, 12, Math.PI * 0.55), mat(BONE));
      g.add(at(rib, x, y + r * 0.55, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, -Math.PI / 2 - 0.25));
    }
  }
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.CapsuleGeometry(0.16, 2.2, 4, 8), mat(BONE_D)), 5.5, 0.15, s * 2.6, Math.PI / 2, 0, s * 0.5)); // flipper bones
  g.position.y = -0.25;
  return g;
}

/** Where the star came down: a dark scorch with crystal grit and a few charred stumps. */
export function buildCrater(): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(17);
  g.add(at(mesh(new THREE.CircleGeometry(6.5, 28), mat(0x6a5a48), false, true), 0, 0.04, 0, -Math.PI / 2));
  g.add(at(mesh(new THREE.RingGeometry(6.3, 8, 28), mat(0x7f7058), false, true), 0, 0.03, 0, -Math.PI / 2));
  for (let k = 0; k < 18; k++) { const a = rnd() * 6.28, r = rnd() * 6; g.add(at(mesh(new THREE.OctahedronGeometry(0.06 + rnd() * 0.05, 0), mat(SKY, { emissive: SKY, emissiveIntensity: 0.9 }), false), Math.cos(a) * r, 0.08, Math.sin(a) * r, rnd(), rnd(), rnd())); }
  for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, r = 7 + rnd() * 2; g.add(at(mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.6 + rnd() * 0.8, 7), mat(0x1a1612)), Math.cos(a) * r, 0.3, Math.sin(a) * r, rnd() * 0.3, 0, rnd() * 0.3)); }
  return g;
}
