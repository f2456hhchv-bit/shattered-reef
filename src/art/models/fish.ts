import * as THREE from 'three';
import { m, shade, add } from './itemkit';

// One model per species, built to be recognisable at icon size: a lofted body (its own profile, back and
// belly colours), species fins, eyes and markings. Cooked fish keep their shape but brown, lose the wet
// sheen, get grill marks and a pale eye. Head points +x.

interface Spec {
  len: number;
  /** body half-heights above / below the centre line and half-width, at u (0 nose .. 1 tail root) */
  prof: (u: number) => [number, number, number];
  back: string; belly: string; fin: string;
  /** centre-line height along the body (a hooked jaw, a hunched back) */
  mid?: (u: number) => number;
}

const bell = (u: number, peak: number, tip = 0.08) => Math.sin(Math.PI * Math.min(1, Math.max(0, u)) ** peak) * (1 - tip) + tip;

const SPECS: Record<string, Spec> = {
  sprat: { len: 0.5, prof: (u) => [0.07 * bell(u, 0.8), 0.06 * bell(u, 0.8), 0.035 * bell(u, 0.8)], back: '#3f6a7c', belly: '#e9eff1', fin: '#9fb7bf' },
  bell: { len: 0.4, prof: (u) => [0.17 * bell(u, 0.75, 0.12), 0.15 * bell(u, 0.75, 0.12), 0.045 * bell(u, 0.8)], back: '#3f6f92', belly: '#dfe8ec', fin: '#e3c25e' },
  trout: { len: 0.6, prof: (u) => [0.085 * bell(u, 0.85), 0.075 * bell(u, 0.85), 0.045 * bell(u, 0.85)], back: '#5a6a36', belly: '#efe2c4', fin: '#8a8a5a' },
  salmon: { len: 0.66, prof: (u) => [0.1 * bell(u, 0.9), 0.085 * bell(u, 0.9), 0.05 * bell(u, 0.9)], back: '#44586c', belly: '#f2ece6', fin: '#6a7a8a', mid: (u) => (u < 0.12 ? -0.012 * (1 - u / 0.12) : 0) },
  sword: { len: 0.62, prof: (u) => [0.1 * bell(u, 0.7), 0.08 * bell(u, 0.7), 0.055 * bell(u, 0.7)], back: '#243656', belly: '#c9d3dc', fin: '#2e4468' },
  gloom: { len: 0.48, prof: (u) => [0.12 * bell(u, 0.55, 0.06), 0.11 * bell(u, 0.55, 0.06), 0.06 * bell(u, 0.6)], back: '#26243a', belly: '#4a4660', fin: '#3a3450' },
  shark: { len: 0.78, prof: (u) => [0.095 * bell(u, 0.75, 0.05), 0.085 * bell(u, 0.75, 0.05), 0.075 * bell(u, 0.75, 0.05)], back: '#6f808e', belly: '#eef1f3', fin: '#64737f', mid: (u) => -0.01 * u },
  angler: { len: 0.5, prof: (u) => [0.15 * bell(u, 0.45, 0.06), 0.16 * bell(u, 0.45, 0.06), 0.12 * bell(u, 0.5)], back: '#3e3328', belly: '#6a5644', fin: '#4a3c30' },
};

/** Lofted body with back/belly vertex colours. */
function body(sp: Spec, back: THREE.Color, belly: THREE.Color, rough: number) {
  const N = 30, M = 18, L = sp.len, pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, [top, bot, w] = sp.prof(u), mid = sp.mid?.(u) ?? 0;
    for (let j = 0; j < M; j++) {
      const a = (j / M) * Math.PI * 2, sy = Math.sin(a);
      const y = mid + (sy > 0 ? sy * top : sy * bot);
      pos.push(L / 2 - u * L, y, Math.cos(a) * w);
      const t = Math.min(1, Math.max(0, (sy + 0.25) / 0.9));
      const c = belly.clone().lerp(back, t * t * (3 - 2 * t));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), c2 = a + M, d = b + M;
    idx.push(a, c2, b, b, c2, d);
  }
  // nose cap
  const tip = pos.length / 3;
  pos.push(L / 2 + 0.008, sp.mid?.(0) ?? 0, 0); col.push(back.r, back.g, back.b);
  for (let j = 0; j < M; j++) idx.push(tip, j, (j + 1) % M);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: rough < 0.5 ? 0.25 : 0 }));
}

/** A thin fin from 2D points (x along the body, y up), placed at (x, y) on the body's centre plane. */
function fin(g: THREE.Group, pts: [number, number][], colour: string, at: [number, number, number], rot: [number, number, number] = [0, 0, 0], depth = 0.006) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  return add(g, geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), at, rot);
}

const curvy = (pts: [number, number][], n = 6): [number, number][] => {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return c.getPoints(pts.length * n).map((v) => [v.x, v.y]);
};

function eye(g: THREE.Group, x: number, y: number, z: number, r: number, cooked: boolean, glow?: string) {
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(r, 10, 8), m(cooked ? '#e8e2d2' : '#f2efe6', 'gloss'), [x, y, s * z]);
    if (!cooked) add(g, new THREE.SphereGeometry(r * 0.62, 8, 6), glow ? m(glow, 'glow') : m('#0d0d0d', 'gloss'), [x + r * 0.15, y, s * (z + r * 0.45)]);
  }
}

export function buildFish(species: string, cooked: boolean, doneCol: string): THREE.Group {
  const sp = SPECS[species] ?? SPECS.sprat;
  const g = new THREE.Group();
  const L = sp.len, tailX = -L / 2;
  const done = new THREE.Color(doneCol);
  const back = cooked ? done.clone().multiplyScalar(0.72) : new THREE.Color(sp.back);
  const belly = cooked ? done.clone().lerp(new THREE.Color('#f0d8a8'), 0.35) : new THREE.Color(sp.belly);
  const finCol = cooked ? '#' + done.clone().multiplyScalar(0.6).getHexString() : sp.fin;
  g.add(body(sp, back, belly, cooked ? 0.85 : 0.35));
  const at = (u: number) => L / 2 - u * L; // x at a fraction along the body
  const [, , wHead] = sp.prof(0.15);

  switch (species) {
    case 'sprat': {
      fin(g, curvy([[0, 0], [-0.04, 0.07], [-0.11, 0.075], [-0.08, 0], [-0.11, -0.075], [-0.04, -0.07]]), finCol, [tailX + 0.01, 0, 0]);
      fin(g, [[0, 0], [-0.03, 0.05], [-0.07, 0]], finCol, [at(0.42), 0.055, 0]);
      add(g, new THREE.BoxGeometry(L * 0.62, 0.008, 0.002), m('#c9d8de', 'metal'), [0.0, 0.005, wHead * 0.98]); // silver stripe
      eye(g, at(0.12), 0.015, wHead * 0.75, 0.016, cooked);
      break;
    }
    case 'bell': {
      // deep, round body with long golden fins top and bottom: a bell when seen side-on
      fin(g, curvy([[0, 0], [-0.06, 0.09], [-0.14, 0.11], [-0.2, 0.02]]), finCol, [at(0.25), 0.13, 0]);
      fin(g, curvy([[0, 0], [-0.06, -0.08], [-0.14, -0.1], [-0.19, -0.02]]), finCol, [at(0.3), -0.115, 0]);
      fin(g, curvy([[0, 0], [-0.05, 0.07], [-0.09, 0.03], [-0.09, -0.03], [-0.05, -0.07]]), finCol, [tailX + 0.01, 0, 0]);
      for (const x of [0.02, -0.05]) add(g, new THREE.TorusGeometry(0.11, 0.006, 4, 20, Math.PI), m('#e3c25e', cooked ? 'matte' : 'metal'), [x, -0.02, 0.0], [0, 0, -Math.PI / 2], [0.55, 1, 0.45]); // golden bands
      eye(g, at(0.14), 0.035, wHead * 0.8, 0.02, cooked);
      break;
    }
    case 'trout':
    case 'salmon': {
      const salmon = species === 'salmon';
      fin(g, salmon ? curvy([[0, 0], [-0.05, 0.08], [-0.11, 0.1], [-0.08, 0], [-0.11, -0.1], [-0.05, -0.08]]) : curvy([[0, 0], [-0.05, 0.075], [-0.1, 0.085], [-0.095, 0], [-0.1, -0.085], [-0.05, -0.075]]), finCol, [tailX + 0.01, 0, 0]);
      fin(g, [[0, 0], [-0.025, 0.06], [-0.075, 0.055], [-0.08, 0]], finCol, [at(0.38), salmon ? 0.088 : 0.075, 0]);
      fin(g, [[0, 0], [-0.015, 0.025], [-0.035, 0]], finCol, [at(0.74), salmon ? 0.05 : 0.045, 0]); // adipose fin
      fin(g, [[0, 0], [-0.03, -0.04], [-0.06, 0]], finCol, [at(0.62), -0.06, 0]);
      for (const s of [-1, 1]) fin(g, [[0, 0], [-0.06, -0.025], [-0.05, 0.005]], finCol, [at(0.24), -0.03, s * wHead * 0.9], [s * 0.4, 0, 0]);
      if (!cooked && !salmon) add(g, new THREE.BoxGeometry(L * 0.62, 0.022, 0.002), m('#d88a8a'), [-0.02, 0.0, 0.046], [0, 0, 0], [1, 1, 1]); // rosy band
      if (!cooked && salmon) add(g, new THREE.BoxGeometry(L * 0.5, 0.03, 0.002), m('#e8b0a0'), [-0.03, -0.02, 0.05]);
      // spots: dark on the back, red with pale rings on a trout
      const rnd = (k: number) => (Math.sin(k * 91.7 + 3.1) * 43758.5) % 1;
      for (let k = 0; k < (salmon ? 10 : 14); k++) {
        const u = 0.22 + Math.abs(rnd(k)) * 0.6, [top, , w] = sp.prof(u), y = top * (0.3 + Math.abs(rnd(k + 9)) * 0.55);
        const red = !salmon && k % 3 === 0;
        add(g, new THREE.SphereGeometry(red ? 0.009 : 0.007, 6, 4), m(cooked ? '#3a2414' : red ? '#c03a2a' : '#1d1a14'), [at(u), y, w * Math.sqrt(Math.max(0, 1 - (y / top) ** 2)) + 0.002]);
      }
      if (salmon) add(g, new THREE.ConeGeometry(0.012, 0.03, 5), m(shade(sp.back, 1.1).getHex()), [L / 2 - 0.005, -0.018, 0], [0, 0, Math.PI * 0.8]); // hooked jaw (kype)
      eye(g, at(0.1), 0.02, wHead * 0.78, 0.017, cooked);
      break;
    }
    case 'sword': {
      add(g, new THREE.ConeGeometry(0.018, 0.34, 8), m(cooked ? finCol : '#1e2c46', cooked ? 'matte' : 'gloss'), [L / 2 + 0.16, 0.005, 0], [0, 0, -Math.PI / 2], [1, 1, 0.45]); // the sword
      fin(g, curvy([[0, 0], [0.01, 0.15], [-0.05, 0.13], [-0.09, 0]]), finCol, [at(0.18), 0.09, 0]); // sickle dorsal
      fin(g, curvy([[0, 0], [-0.04, 0.03], [-0.13, 0.16], [-0.08, 0.02], [-0.08, -0.02], [-0.13, -0.16], [-0.04, -0.03]]), finCol, [tailX + 0.015, 0, 0]); // lunate tail
      for (const s of [-1, 1]) fin(g, [[0, 0], [-0.1, -0.06], [-0.08, -0.01]], finCol, [at(0.24), -0.03, s * 0.05], [s * 0.3, 0, 0]);
      eye(g, at(0.06), 0.02, 0.035, 0.018, cooked);
      break;
    }
    case 'gloom': {
      // deep-water oddity: ragged long fins, fangs and a lamp-bright eye
      fin(g, curvy([[0, 0], [-0.04, 0.06], [-0.1, 0.04], [-0.16, 0.08], [-0.22, 0.03], [-0.26, 0]]), finCol, [at(0.2), 0.1, 0]);
      fin(g, curvy([[0, 0], [-0.04, 0.09], [-0.12, 0.05], [-0.09, 0], [-0.12, -0.05], [-0.04, -0.09]]), finCol, [tailX + 0.01, 0, 0]);
      for (let k = 0; k < 5; k++) for (const s of [-1, 1]) add(g, new THREE.ConeGeometry(0.006, 0.03, 4), m('#e9e3d0'), [L / 2 - 0.01 - k * 0.012, -0.01, s * (0.02 + k * 0.004)], [0, 0, s > 0 ? Math.PI : 0]);
      for (let k = 0; k < 6; k++) add(g, new THREE.SphereGeometry(0.008, 6, 4), m(cooked ? '#5a4a3a' : '#7fe0d8', cooked ? 'matte' : 'glow'), [at(0.3 + k * 0.08), -0.04, 0.055 - k * 0.004]); // photophores
      eye(g, at(0.1), 0.03, 0.05, 0.03, cooked, '#9ff0e8');
      break;
    }
    case 'shark': {
      fin(g, [[0, 0], [-0.03, 0.14], [-0.06, 0.12], [-0.13, 0]], finCol, [at(0.32), 0.085, 0]); // dorsal
      fin(g, curvy([[0, 0], [-0.06, 0.04], [-0.17, 0.17], [-0.12, 0.03], [-0.08, -0.02], [-0.11, -0.08], [-0.03, -0.02]]), finCol, [tailX + 0.02, 0.0, 0]); // heterocercal tail
      for (const s of [-1, 1]) fin(g, [[0, 0], [-0.07, -0.14], [-0.11, -0.12], [-0.08, 0]], finCol, [at(0.28), -0.04, s * 0.07], [s * 0.55, 0, 0]);
      fin(g, [[0, 0], [-0.02, 0.04], [-0.05, 0]], finCol, [at(0.78), 0.03, 0]);
      for (let k = 0; k < 4; k++) add(g, new THREE.BoxGeometry(0.004, 0.05, 0.003), m(cooked ? '#3a2414' : '#3f4a52'), [at(0.2) - k * 0.016, -0.005, 0.073 - k * 0.002], [0, 0, 0.15]); // gill slits
      add(g, new THREE.TorusGeometry(0.03, 0.004, 4, 10, Math.PI), m('#2a2a2a'), [L / 2 - 0.05, -0.035, 0.0], [Math.PI / 2, 0, Math.PI], [1, 1.5, 1]); // mouth
      eye(g, at(0.1), 0.025, 0.05, 0.012, cooked);
      break;
    }
    case 'angler': {
      // huge head and jaw, needle teeth, and the lure on its stalk
      add(g, new THREE.TorusGeometry(0.1, 0.012, 5, 18, Math.PI), m('#1e1812'), [L / 2 - 0.08, -0.03, 0], [Math.PI / 2, 0, -Math.PI / 2], [1, 1.1, 1]);
      for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k / 8) * Math.PI; add(g, new THREE.ConeGeometry(0.007, 0.04, 4), m('#efe6d0'), [L / 2 - 0.06, -0.02, Math.sin(a) * 0.09], [0, 0, Math.PI]); }
      const stalk = new THREE.QuadraticBezierCurve3(new THREE.Vector3(at(0.2), 0.14, 0), new THREE.Vector3(at(0.0) + 0.05, 0.3, 0), new THREE.Vector3(L / 2 + 0.1, 0.2, 0));
      add(g, new THREE.TubeGeometry(stalk, 12, 0.006, 5), m(finCol));
      add(g, new THREE.SphereGeometry(0.03, 10, 8), m(cooked ? '#8a6a3a' : '#ffe27a', cooked ? 'matte' : 'glow'), [L / 2 + 0.1, 0.19, 0]);
      fin(g, curvy([[0, 0], [-0.04, 0.06], [-0.09, 0.02], [-0.09, -0.02], [-0.04, -0.06]]), finCol, [tailX + 0.01, 0, 0]);
      for (let k = 0; k < 8; k++) add(g, new THREE.SphereGeometry(0.014, 6, 4), m(shade(cooked ? doneCol : sp.back, 0.75).getHex()), [at(0.2 + (k % 4) * 0.15), 0.06 + (k >> 2) * 0.05, 0.1 - (k % 4) * 0.02]); // warty skin
      eye(g, at(0.18), 0.09, 0.08, 0.016, cooked);
      break;
    }
  }
  // grill marks: slim dark bands through the body, so they show as stripes on both flanks
  if (cooked) for (const u of [0.3, 0.45, 0.6]) {
    const [top, bot, w] = sp.prof(u);
    add(g, new THREE.BoxGeometry(0.011, (top + bot) * 0.55, w * 2 + 0.003), m('#2a1a0e'), [at(u), (sp.mid?.(u) ?? 0) + (top - bot) * 0.25, 0], [0, 0, 0.3]);
  }
  return g;
}

/** A thick shark steak: skin rim, pale flesh, grill marks. */
export function buildSteak(doneCol: string): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.22, 0.15, 0, Math.PI * 2, false, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  add(g, geo, m(doneCol));
  add(g, new THREE.TorusGeometry(0.21, 0.025, 6, 28), m('#5a5a60'), [0, 0.05, 0], [Math.PI / 2, 0, 0], [1, 0.72, 1]);
  add(g, new THREE.CircleGeometry(0.035, 12), m('#e8d2b0'), [0.02, 0.102, 0], [-Math.PI / 2, 0, 0]); // the bone
  for (const x of [-0.1, 0, 0.1]) add(g, new THREE.BoxGeometry(0.02, 0.008, 0.26), m('#2a1a0e'), [x, 0.104, 0], [0, 0.6, 0]);
  return g;
}
