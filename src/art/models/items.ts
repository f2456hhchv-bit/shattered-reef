import * as THREE from 'three';
import { item, METALS, type IconShape } from '../../game/data/items';
import { mulberry32 } from '../noise';
import { m, nudge, shade, add } from './itemkit';
import { buildHatchet, buildPickaxe, buildCutlass, buildHelm, buildPlate, buildPistol, buildStaff, buildDagger, buildGreatsword, buildPike, buildBow, buildCrossbow, buildArrows } from './gear';
import { buildFish, buildSteak } from './fish';

// Item models: one small, readable 3D object per item. Used for inventory icons (rendered on a
// slate tile) and inside the sea-glass shards that loot washes up in. ~0.6 units across.

function bladeShape(len: number, curve: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -width / 2);
  s.quadraticCurveTo(len * 0.55, -width / 2 - curve * 0.2, len, curve);
  s.quadraticCurveTo(len * 0.6, width / 2 + curve * 0.4, 0, width / 2);
  s.lineTo(0, -width / 2);
  return s;
}

function builders(shape: IconShape, col: string, acc: string | undefined, seed: number, qty: number, cooked: boolean): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  switch (shape) {
    case 'log': {
      add(g, nudge(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 10, 2), 0.02, seed), m(col), [0, 0, 0], [0, 0, Math.PI / 2]);
      const cap = m(acc ?? '#d6b07a');
      add(g, new THREE.CircleGeometry(0.125, 12), cap, [0.312, 0, 0], [0, Math.PI / 2, 0]);
      add(g, new THREE.TorusGeometry(0.07, 0.008, 4, 16), m(shade(col, 0.7).getHex()), [0.315, 0, 0], [0, Math.PI / 2, 0]);
      add(g, new THREE.TorusGeometry(0.035, 0.006, 4, 12), m(shade(col, 0.7).getHex()), [0.316, 0, 0], [0, Math.PI / 2, 0]);
      add(g, new THREE.CylinderGeometry(0.02, 0.03, 0.12, 5), m(col), [-0.08, 0.15, 0.02], [0.3, 0, 0.5]); // knot / twig
      break;
    }
    case 'ore': {
      add(g, nudge(new THREE.DodecahedronGeometry(0.22, 1), 0.07, seed), m(col), [0, 0, 0], [0, 0, 0], [1.15, 0.85, 1]);
      for (let k = 0; k < 4; k++) {
        const a = rnd() * Math.PI * 2;
        add(g, nudge(new THREE.OctahedronGeometry(0.06 + rnd() * 0.03, 0), 0.02, seed + k), m(acc ?? '#d07a42', 'metal'), [Math.cos(a) * 0.17, 0.05 + rnd() * 0.1, Math.sin(a) * 0.15 + 0.05], [rnd(), rnd(), rnd()]);
      }
      break;
    }
    case 'bar': {
      const geo = new THREE.BoxGeometry(0.5, 0.14, 0.22);
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.82); p.setZ(i, p.getZ(i) * 0.7); }
      geo.computeVertexNormals();
      add(g, geo, m(col, 'metal'));
      add(g, new THREE.BoxGeometry(0.16, 0.01, 0.06), m(shade(col, 0.75).getHex(), 'metal'), [0, 0.072, 0]); // stamp
      break;
    }
    case 'fish': {
      add(g, nudge(new THREE.SphereGeometry(0.16, 14, 10), 0.01, seed), m(col), [0, 0, 0], [0, 0, 0], [1.7, 0.75, 0.55]);
      const tail = new THREE.ConeGeometry(0.11, 0.18, 4);
      add(g, tail, m(shade(col, 0.8).getHex()), [-0.33, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.25]);
      add(g, new THREE.ConeGeometry(0.06, 0.12, 4), m(acc ?? shade(col, 0.8).getHex()), [0.02, 0.13, 0], [0, 0, -0.3], [1, 1, 0.2]);
      add(g, new THREE.SphereGeometry(0.022, 8, 6), m('#111111', 'gloss'), [0.2, 0.03, 0.065]);
      if (cooked) for (const x of [-0.1, 0.02, 0.14]) add(g, new THREE.BoxGeometry(0.025, 0.02, 0.18), m('#3a2414'), [x, 0.06, 0], [0, 0.4, 0]);
      else add(g, new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.5), m('#e9f3f2', 'gloss'), [0, 0.01, 0], [0, 0, 0], [1.6, 0.6, 0.5]);
      break;
    }
    case 'meat': {
      add(g, nudge(new THREE.SphereGeometry(0.17, 12, 9), 0.04, seed), m(col), [0, 0, 0], [0, 0, 0.4], [1.3, 0.8, 0.9]);
      add(g, new THREE.CylinderGeometry(0.035, 0.05, 0.22, 7), m('#efe3c4'), [0.2, 0.06, 0], [0, 0, -1.0]);
      add(g, new THREE.SphereGeometry(0.06, 8, 6), m('#efe3c4'), [0.29, 0.13, 0]);
      break;
    }
    case 'burnt': {
      add(g, nudge(new THREE.SphereGeometry(0.17, 10, 8), 0.06, seed), m('#1e1915'), [0, 0, 0], [0, 0, 0], [1.4, 0.7, 0.8]);
      add(g, new THREE.SphereGeometry(0.025, 6, 4), m('#ff6a1a', 'glow'), [0.08, 0.1, 0.06]);
      break;
    }
    case 'coins': {
      const n = qty >= 100 ? 7 : qty >= 10 ? 5 : qty > 1 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const stack = k < 4 ? 0 : 1;
        const coin = add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.028, 18), m(col, 'metal'), [stack * 0.2 - 0.06 + rnd() * 0.02, 0.016 + (stack ? k - 4 : k) * 0.03, stack * 0.06 + rnd() * 0.02], [rnd() * 0.15, 0, rnd() * 0.15]);
        void coin;
      }
      // the bell stamped on the top coin
      const topY = 0.016 + (Math.min(n, 4) - 1) * 0.03 + 0.016;
      add(g, new THREE.CylinderGeometry(0.025, 0.045, 0.012, 10), m(shade(col, 0.7).getHex(), 'metal'), [-0.06, topY, 0]);
      break;
    }
    case 'bread': {
      add(g, nudge(new THREE.SphereGeometry(0.2, 14, 10), 0.02, seed), m(col), [0, 0, 0], [0, 0, 0], [1.4, 0.7, 1]);
      for (const x of [-0.12, 0, 0.12]) add(g, new THREE.BoxGeometry(0.02, 0.02, 0.2), m(shade(col, 0.6).getHex()), [x, 0.13, 0], [0, 0.5, 0]);
      break;
    }
    case 'hatchet': {
      add(g, new THREE.CylinderGeometry(0.022, 0.028, 0.62, 8), m('#7a5534'), [0, 0, 0], [0, 0, 0.5]);
      const head = new THREE.Shape();
      head.moveTo(0, -0.05); head.lineTo(0.17, -0.12); head.quadraticCurveTo(0.22, 0, 0.17, 0.12); head.lineTo(0, 0.05); head.lineTo(0, -0.05);
      add(g, new THREE.ExtrudeGeometry(head, { depth: 0.04, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }), m(col, 'metal'), [-0.12, 0.24, -0.02], [0, 0, 0.5 + Math.PI / 2]);
      break;
    }
    case 'pickaxe': {
      add(g, new THREE.CylinderGeometry(0.022, 0.028, 0.62, 8), m('#7a5534'), [0, -0.04, 0], [0, 0, 0.15]);
      add(g, new THREE.TorusGeometry(0.22, 0.03, 6, 14, Math.PI * 0.8), m(col, 'metal'), [-0.05, 0.08, 0], [0, 0, Math.PI * 0.1 + 0.15]);
      break;
    }
    case 'rod': {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.3, -0.2, 0), new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.3, 0.32, 0));
      add(g, new THREE.TubeGeometry(curve, 12, 0.016, 6), m(col));
      add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), m('#3b3f42', 'metal'), [-0.2, -0.13, 0.03], [Math.PI / 2, 0, 0]);
      add(g, new THREE.CylinderGeometry(0.002, 0.002, 0.4, 3), m('#e9e5d5'), [0.3, 0.12, 0]);
      break;
    }
    case 'cutlass': {
      add(g, new THREE.ExtrudeGeometry(bladeShape(0.55, 0.08, 0.075), { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 1 }), m(col, 'metal'), [-0.12, 0, -0.006], [0, 0, 0.55]);
      add(g, new THREE.TorusGeometry(0.06, 0.012, 5, 12, Math.PI), m(acc ?? '#c9a050', 'metal'), [-0.14, -0.04, 0], [0, 0, 0.55 + Math.PI / 2]);
      add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.13, 8), m('#4a3020'), [-0.2, -0.09, 0], [0, 0, 0.55 + Math.PI / 2]);
      add(g, new THREE.SphereGeometry(0.03, 8, 6), m(acc ?? '#c9a050', 'metal'), [-0.26, -0.13, 0]);
      break;
    }
    case 'helm': {
      add(g, nudge(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0.008, seed), m(col, 'metal'), [0, -0.05, 0]);
      add(g, new THREE.TorusGeometry(0.2, 0.025, 6, 20), m(shade(col, 0.8).getHex(), 'metal'), [0, -0.05, 0], [Math.PI / 2, 0, 0]);
      add(g, new THREE.BoxGeometry(0.035, 0.16, 0.03), m(col, 'metal'), [0, -0.09, 0.205]);
      add(g, new THREE.BoxGeometry(0.03, 0.03, 0.36), m(shade(col, 1.15).getHex(), 'metal'), [0, 0.14, 0]); // crest
      break;
    }
    case 'cap': {
      add(g, nudge(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.01, seed), m(col), [0, -0.04, 0]);
      add(g, new THREE.CylinderGeometry(0.16, 0.18, 0.02, 14, 1, false, -Math.PI / 2, Math.PI), m(shade(col, 0.85).getHex()), [0, -0.04, 0.06]);
      break;
    }
    case 'coat': {
      add(g, nudge(new THREE.CylinderGeometry(0.15, 0.2, 0.32, 10), 0.01, seed), m(col), [0, 0.06, 0]);
      add(g, new THREE.CylinderGeometry(0.2, 0.26, 0.2, 10, 1, true), m(col), [0, -0.19, 0]);
      add(g, new THREE.BoxGeometry(0.42, 0.08, 0.2), m(col), [0, 0.2, 0]);
      add(g, new THREE.BoxGeometry(0.03, 0.42, 0.02), m(acc ?? '#c9a050', 'metal'), [-0.05, 0.0, 0.185]);
      add(g, new THREE.BoxGeometry(0.03, 0.42, 0.02), m(acc ?? '#c9a050', 'metal'), [0.05, 0.0, 0.185]);
      break;
    }
    case 'plate': {
      // breastplate: turned torso shell, rounded pauldrons, a raised central ridge and rivets
      const prof = [[0.0, 0.24], [0.13, 0.23], [0.19, 0.16], [0.2, 0.0], [0.17, -0.16], [0.19, -0.22], [0.0, -0.23]].map(([r, y]) => new THREE.Vector2(r, y));
      add(g, new THREE.LatheGeometry(prof, 18), m(col, 'metal'), [0, 0, 0], [0, 0, 0], [1, 1, 0.72]);
      for (const sx of [-1, 1]) {
        add(g, new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(shade(col, 0.85).getHex(), 'metal'), [sx * 0.2, 0.17, 0], [0, 0, -sx * 0.5], [1, 0.8, 1]);
        add(g, new THREE.SphereGeometry(0.018, 6, 4), m('#e9d3a4', 'metal'), [sx * 0.1, 0.12, 0.13]);
      }
      add(g, new THREE.CapsuleGeometry(0.018, 0.32, 3, 8), m(shade(col, 1.2).getHex(), 'metal'), [0, 0, 0.146]);
      add(g, new THREE.TorusGeometry(0.17, 0.016, 6, 22), m(shade(col, 0.7).getHex(), 'metal'), [0, -0.2, 0], [Math.PI / 2, 0, 0], [1, 0.72, 1]);
      break;
    }
    case 'harpoon': {
      add(g, new THREE.CylinderGeometry(0.018, 0.022, 0.7, 8), m('#7a5534'), [0, 0, 0], [0, 0, 0.7]);
      add(g, new THREE.ConeGeometry(0.04, 0.16, 10), m(col, 'metal'), [-0.27, 0.22, 0], [0, 0, 0.7]);
      for (const sx of [-1, 1]) add(g, new THREE.ConeGeometry(0.018, 0.09, 6), m(col, 'metal'), [-0.2 + sx * 0.02, 0.17 + sx * 0.03, 0], [0, 0, 0.7 + Math.PI + sx * 0.5]);
      add(g, new THREE.TorusGeometry(0.05, 0.008, 6, 16), m('#c9b28a'), [0.2, -0.17, 0], [0.4, 0.6, 0]);
      break;
    }
    case 'pot': {
      // wicker cage: hoops and ribs around a dark interior, with a funnel mouth
      add(g, new THREE.CylinderGeometry(0.16, 0.18, 0.26, 14, 1, true), m('#2a1e14'), [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (const z of [-0.12, 0, 0.12]) add(g, new THREE.TorusGeometry(0.17, 0.015, 6, 18), m(col), [0, 0, z]);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.27, 5), m(shade(col, 0.85).getHex()), [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0], [Math.PI / 2, 0, 0]); }
      add(g, new THREE.ConeGeometry(0.11, 0.1, 12, 1, true), m(shade(col, 0.9).getHex()), [0, 0, 0.12], [-Math.PI / 2, 0, 0]);
      break;
    }
    case 'lobster': {
      add(g, nudge(new THREE.CapsuleGeometry(0.075, 0.26, 4, 12), 0.006, seed), m(col), [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]);
      for (let k = 0; k < 4; k++) add(g, new THREE.TorusGeometry(0.07, 0.012, 5, 12, Math.PI), m(shade(col, 0.8).getHex()), [-0.12 + k * 0.05, 0.02, 0], [0, Math.PI / 2, 0]);
      for (const sz of [-1, 1]) {
        add(g, new THREE.CapsuleGeometry(0.02, 0.14, 3, 8), m(col), [0.22, 0, sz * 0.08], [0, sz * 0.5, Math.PI / 2]);
        add(g, nudge(new THREE.SphereGeometry(0.06, 10, 8), 0.004, seed + sz), m(shade(col, 1.1).getHex()), [0.32, 0, sz * 0.14], [0, 0, 0], [1.5, 0.6, 0.9]);
        add(g, new THREE.CylinderGeometry(0.004, 0.002, 0.3, 4), m(shade(col, 0.7).getHex()), [0.3, 0.06, sz * 0.03], [0, sz * 0.3, -1.2]);
      }
      add(g, new THREE.ConeGeometry(0.07, 0.1, 10), m(shade(col, 0.9).getHex()), [-0.22, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.5]);
      break;
    }
    case 'berries': {
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = k === 0 ? 0 : 0.09 + (k % 3) * 0.03; add(g, new THREE.SphereGeometry(0.065, 10, 8), m(k % 3 ? col : '#a02a3a', 'gloss'), [Math.cos(a) * r, (k % 2) * 0.05, Math.sin(a) * r]); }
      add(g, new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), m(acc ?? '#3e7a3a'), [0.02, 0.1, -0.06], [0.4, 0, 0.3], [1.3, 0.4, 0.9]);
      break;
    }
    case 'kelp': {
      for (let k = 0; k < 4; k++) {
        const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-0.25, -0.15 + k * 0.03, 0), new THREE.Vector3(-0.08, 0.15, k * 0.04), new THREE.Vector3(0.08, -0.15, -k * 0.03), new THREE.Vector3(0.27, 0.1 - k * 0.05, 0));
        add(g, new THREE.TubeGeometry(curve, 12, 0.03, 5), m(k % 2 ? col : acc ?? col), [0, 0, 0], [0, 0, 0], [1, 1, 0.4]);
      }
      break;
    }
    case 'geode': {
      add(g, nudge(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0.5, Math.PI - 0.5), 0.03, seed), m(col), [0, 0, 0], [0.3, 0, 0]);
      add(g, new THREE.CircleGeometry(0.17, 14), m('#2a3a44'), [0, 0, 0], [-Math.PI / 2 + 0.3, 0, 0]);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; add(g, new THREE.OctahedronGeometry(0.04, 0), m(acc ?? '#9fe8ff', 'glow'), [Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.09 - 0.02], [0, a, 0.3]); }
      break;
    }
    case 'spade': {
      add(g, new THREE.CylinderGeometry(0.02, 0.025, 0.55, 8), m('#7a5534'), [0.04, 0.12, 0], [0, 0, 0.4]);
      add(g, new THREE.TorusGeometry(0.05, 0.014, 6, 14), m('#7a5534'), [0.15, 0.37, 0], [0, 0, 0.4]);
      add(g, new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI, 0, Math.PI / 2), m(col, 'metal'), [-0.08, -0.2, 0], [Math.PI / 2, 0, 0.4 + Math.PI], [1, 1.5, 0.25]);
      break;
    }
    case 'parcel': {
      add(g, nudge(new THREE.CapsuleGeometry(0.09, 0.26, 4, 12), 0.01, seed), m(col), [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]);
      for (const x of [-0.08, 0.08]) add(g, new THREE.TorusGeometry(0.09, 0.012, 6, 14), m('#c9b28a'), [x, 0, 0], [0, Math.PI / 2, 0], [1, 1, 0.8]);
      add(g, new THREE.ConeGeometry(0.06, 0.1, 6), m(acc ?? '#c9934f'), [-0.25, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.3]);
      break;
    }
    case 'coconut': {
      // a cracked-open coconut: hairy brown shell, white flesh showing in the break
      add(g, nudge(new THREE.SphereGeometry(0.2, 12, 9), 0.015, seed), m(col), [0, 0, 0], [0, 0, 0], [1, 0.92, 1]);
      add(g, new THREE.CircleGeometry(0.15, 14), m(acc ?? '#f2ece0', 'gloss'), [0.06, 0.12, 0.06], [-1.0, 0.4, 0]);
      for (let k = 0; k < 10; k++) { const a = k * 2.1; add(g, new THREE.BoxGeometry(0.06, 0.01, 0.01), m(shade(col, 1.3).getHex()), [Math.cos(a) * 0.19, (k % 3 - 1) * 0.08, Math.sin(a) * 0.19], [0, a, 0.6]); }
      for (const x of [-0.05, 0, 0.05]) add(g, new THREE.SphereGeometry(0.018, 6, 4), m('#2a1a0e'), [x, 0.17, -0.08]);
      break;
    }
    case 'mug': {
      add(g, new THREE.CylinderGeometry(0.13, 0.12, 0.3, 14, 1, true), m(col), [0, 0, 0]);
      add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 14), m(shade(col, 0.6).getHex()), [0, -0.14, 0]);
      for (const y of [-0.09, 0.09]) add(g, new THREE.TorusGeometry(0.132, 0.014, 6, 18), m('#6a6a70', 'metal'), [0, y, 0], [Math.PI / 2, 0, 0]);
      add(g, new THREE.TorusGeometry(0.07, 0.022, 6, 12, Math.PI), m(col), [0.14, 0, 0], [0, 0, -Math.PI / 2]);
      add(g, nudge(new THREE.SphereGeometry(0.125, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.015, seed), m('#f4efe0'), [0, 0.13, 0], [0, 0, 0], [1, 0.5, 1]);
      add(g, new THREE.CylinderGeometry(0.115, 0.115, 0.02, 14), m(acc ?? '#d8a030', 'gloss'), [0, 0.12, 0]);
      break;
    }
    case 'bowl': {
      add(g, new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m(col), [0, 0.06, 0], [0, 0, 0], [1, 0.7, 1]);
      add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), m(acc ?? '#d88a4a', 'gloss'), [0, 0.04, 0]);
      for (let k = 0; k < 5; k++) { const a = k * 1.3; add(g, nudge(new THREE.SphereGeometry(0.04, 7, 5), 0.01, seed + k), m(k % 2 ? '#e8d8b8' : '#4a6a2a'), [Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1]); }
      add(g, new THREE.CylinderGeometry(0.012, 0.016, 0.3, 6), m('#b89a6a'), [0.12, 0.14, 0], [0, 0, -0.7]);
      break;
    }
    case 'pie': {
      add(g, new THREE.CylinderGeometry(0.22, 0.18, 0.1, 18), m(shade(col, 0.85).getHex()), [0, 0, 0]);
      add(g, nudge(new THREE.SphereGeometry(0.21, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.01, seed), m(col), [0, 0.04, 0], [0, 0, 0], [1, 0.35, 1]);
      add(g, new THREE.TorusGeometry(0.21, 0.025, 6, 22), m(shade(col, 1.1).getHex()), [0, 0.05, 0], [Math.PI / 2, 0, 0]);
      for (let k = 0; k < 3; k++) add(g, new THREE.BoxGeometry(0.1, 0.012, 0.025), m(acc ?? '#7a2a5a'), [0, 0.115, 0], [0, (k / 3) * Math.PI, 0]);
      break;
    }
    case 'ring': {
      // nearly face-on to the icon camera (which looks down ~30 degrees), set stone on top
      add(g, new THREE.TorusGeometry(0.14, 0.035, 12, 28), m(col, 'metal'), [0, 0, 0], [-0.25, 0, 0]);
      add(g, new THREE.OctahedronGeometry(0.06, 0), m(acc ?? '#59d0c4', 'gloss'), [0, 0.18, 0.04], [0, 0.4, 0]);
      break;
    }
    case 'bell': {
      const pts = [0, 0.04, 0.09, 0.13, 0.16, 0.2, 0.24].map((t, i) => new THREE.Vector2(0.05 + t * t * 4.2 + (i === 6 ? 0.03 : 0), 0.28 - i * 0.045));
      add(g, new THREE.LatheGeometry(pts, 18), m(col, 'metal'), [0, -0.1, 0]);
      add(g, new THREE.TorusGeometry(0.04, 0.012, 6, 12), m(col, 'metal'), [0, 0.21, 0]);
      add(g, new THREE.SphereGeometry(0.035, 8, 6), m(shade(col, 0.6).getHex(), 'metal'), [0, -0.12, 0]);
      break;
    }
    case 'tooth': {
      const pts = [new THREE.Vector2(0.0, 0.3), new THREE.Vector2(0.06, 0.22), new THREE.Vector2(0.1, 0.05), new THREE.Vector2(0.11, -0.1), new THREE.Vector2(0.08, -0.2), new THREE.Vector2(0.0, -0.22)];
      const tooth = add(g, nudge(new THREE.LatheGeometry(pts, 10), 0.01, seed), m(col, 'gloss'), [0, 0, 0], [0, 0, 0.25]);
      tooth.scale.set(1, 1, 0.7);
      add(g, new THREE.BoxGeometry(0.035, 0.12, 0.02), m(acc ?? '#59d0c4', 'glow'), [0.015, -0.04, 0.075], [0, 0, 0.25]);
      break;
    }
    case 'shell': {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.sin(t * Math.PI * 0.5) * 0.22, Math.cos(t * Math.PI * 0.5) * 0.12)); }
      const geo = new THREE.LatheGeometry(pts, 18);
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const r = 1 + Math.sin(a * 9) * 0.06; p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); }
      geo.computeVertexNormals();
      add(g, geo, m(col), [0, -0.04, 0], [0.2, 0, 0]);
      for (let k = 0; k < 3; k++) add(g, new THREE.SphereGeometry(0.03, 6, 4), m(acc ?? '#c04a2c'), [(k - 1) * 0.08, 0.08, 0.02]);
      break;
    }
    case 'pistol': {
      add(g, new THREE.CylinderGeometry(0.026, 0.032, 0.36, 10), m(acc ?? '#9aa0a4', 'metal'), [0.08, 0.04, 0], [0, 0, Math.PI / 2]);
      const stock = new THREE.Shape();
      stock.moveTo(-0.1, 0.06); stock.lineTo(0.04, 0.06); stock.lineTo(0.04, 0.0); stock.quadraticCurveTo(-0.06, -0.02, -0.16, -0.16); stock.lineTo(-0.22, -0.12); stock.quadraticCurveTo(-0.14, 0.0, -0.1, 0.06);
      add(g, new THREE.ExtrudeGeometry(stock, { depth: 0.05, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), m(col), [0, 0, -0.025]);
      add(g, new THREE.BoxGeometry(0.05, 0.04, 0.03), m('#3b3f42', 'metal'), [-0.03, 0.08, 0]);
      add(g, new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI), m('#c9a050', 'metal'), [-0.04, -0.01, 0], [0, 0, Math.PI]);
      break;
    }
    case 'shot': {
      for (const [x, z, y] of [[-0.08, 0, 0], [0.08, 0.02, 0], [0, 0.1, 0], [0, -0.08, 0], [0.01, 0.01, 0.1]]) add(g, new THREE.SphereGeometry(0.075, 12, 8), m(col, 'metal'), [x, y, z]);
      break;
    }
    case 'staff': {
      add(g, nudge(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 7, 3), 0.01, seed), m(col), [0, -0.05, 0], [0, 0, 0.35]);
      add(g, new THREE.OctahedronGeometry(0.07, 0), m(acc ?? '#59d0c4', 'glow'), [-0.13, 0.33, 0], [0, 0.4, 0.35], [0.8, 1.4, 0.8]);
      add(g, new THREE.TorusGeometry(0.06, 0.012, 5, 10), m('#c9a050', 'metal'), [-0.11, 0.27, 0], [Math.PI / 2, 0, 0.35]);
      break;
    }
    case 'ash': {
      add(g, nudge(new THREE.ConeGeometry(0.24, 0.16, 14), 0.02, seed), m(col), [0, 0, 0], [0, 0, 0], [1.1, 1, 1]);
      for (let k = 0; k < 6; k++) add(g, new THREE.SphereGeometry(0.03, 6, 4), m(acc ?? '#a8a890'), [(rnd() - 0.5) * 0.3, 0.02 + rnd() * 0.04, (rnd() - 0.5) * 0.3]);
      add(g, new THREE.SphereGeometry(0.02, 6, 4), m('#ff7a2a', 'glow'), [0.03, 0.07, 0.02]);
      break;
    }
    case 'salt': {
      add(g, new THREE.CylinderGeometry(0.2, 0.17, 0.12, 14, 1, true), m('#8a6440'), [0, -0.02, 0]);
      add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 14), m('#6a4a30'), [0, -0.08, 0]);
      add(g, nudge(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.015, seed), m(col, 'gloss'), [0, 0.02, 0], [0, 0, 0], [1, 0.7, 1]);
      break;
    }
    case 'crystal': {
      for (let k = 0; k < 4; k++) add(g, new THREE.OctahedronGeometry(0.08 + k * 0.012, 0), m(col, 'gloss'), [(k - 1.5) * 0.08, 0.02 + (k % 2) * 0.04, (k % 2) * 0.05], [0.2, k, (k - 1.5) * 0.25], [0.7, 2.2, 0.7]);
      add(g, nudge(new THREE.DodecahedronGeometry(0.12, 0), 0.02, seed), m('#8a8478'), [0, -0.12, 0], [0, 0, 0], [1.8, 0.6, 1.2]);
      break;
    }
    case 'nest': {
      add(g, new THREE.TorusGeometry(0.18, 0.07, 8, 18), m(col), [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), m('#9a7a4a'), [Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2], [rnd(), a, 1.2]); }
      for (const [x, z] of [[-0.05, 0.02], [0.06, -0.03], [0.0, 0.07]]) add(g, new THREE.SphereGeometry(0.06, 10, 8), m(acc ?? '#e9e3d0', 'gloss'), [x, 0.03, z], [0, 0, 0], [1, 1.3, 1]);
      break;
    }
    case 'casket': {
      add(g, nudge(new THREE.BoxGeometry(0.42, 0.22, 0.28), 0.01, seed), m(col), [0, -0.04, 0]);
      add(g, new THREE.CylinderGeometry(0.14, 0.14, 0.42, 12, 1, false, 0, Math.PI), m(shade(col, 1.1).getHex()), [0, 0.07, 0], [0, 0, Math.PI / 2]);
      for (const x of [-0.15, 0.15]) add(g, new THREE.BoxGeometry(0.03, 0.36, 0.3), m(acc ?? '#c9a050', 'metal'), [x, 0.02, 0]);
      add(g, new THREE.BoxGeometry(0.06, 0.07, 0.02), m(acc ?? '#c9a050', 'metal'), [0, 0.02, 0.15]);
      for (let k = 0; k < 6; k++) add(g, new THREE.SphereGeometry(0.025, 6, 4), m('#cfc6b0'), [(rnd() - 0.5) * 0.4, 0.1 + rnd() * 0.08, (rnd() - 0.5) * 0.25]);
      break;
    }
    case 'charm': {
      add(g, nudge(new THREE.OctahedronGeometry(0.12, 1), 0.02, seed), m(col, 'gloss'), [0, 0, 0], [0, 0.3, 0], [0.8, 1.4, 0.8]);
      add(g, new THREE.TorusGeometry(0.1, 0.01, 4, 16), m(acc ?? '#2a7f78'), [0, 0.05, 0], [1.2, 0, 0]);
      break;
    }
    case 'gem': {
      // a cut stone: a faceted octahedron with a bright table on top
      add(g, new THREE.OctahedronGeometry(0.2, 0), m(col, 'gloss'), [0, 0, 0], [0, 0.4, 0], [1, 0.75, 1]);
      add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.02, 8), m(shade(col, 1.25).getHex(), 'gloss'), [0, 0.15, 0]);
      break;
    }
    case 'hide': {
      // a stretched, folded hide with a rolled edge
      const geo = nudge(new THREE.BoxGeometry(0.5, 0.05, 0.38, 6, 1, 5), 0.03, seed);
      add(g, geo, m(col), [0, 0, 0], [0.15, 0.3, 0]);
      add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.38, 10), m(acc ?? shade(col, 0.75).getHex()), [0.24, 0.04, 0.05], [Math.PI / 2, 0, 0.3]);
      break;
    }
    // ---- the new slots: wand, orb, book, shield, legs, boots, gloves, amulet, bracelet
    case 'wand': {
      add(g, new THREE.CylinderGeometry(0.014, 0.026, 0.56, 7), m(col), [0, -0.04, 0], [0, 0, 0.6]);
      add(g, new THREE.CylinderGeometry(0.032, 0.032, 0.04, 8), m('#c9a050', 'metal'), [-0.15, 0.17, 0], [0, 0, 0.6]);
      add(g, new THREE.OctahedronGeometry(0.05, 0), m(acc ?? '#59d0c4', 'glow'), [-0.18, 0.22, 0], [0, 0.4, 0.6], [0.8, 1.4, 0.8]);
      break;
    }
    case 'orb': {
      add(g, new THREE.SphereGeometry(0.19, 20, 14), m(col, 'glow'), [0, 0.06, 0]);
      add(g, new THREE.SphereGeometry(0.06, 10, 8), m(acc ?? '#e9fbff', 'glow'), [-0.06, 0.12, 0.12]);
      add(g, new THREE.CylinderGeometry(0.12, 0.15, 0.08, 10), m('#6a4a30'), [0, -0.15, 0]);
      add(g, new THREE.TorusGeometry(0.13, 0.015, 5, 14), m('#c9a050', 'metal'), [0, -0.11, 0], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'book': {
      add(g, new THREE.BoxGeometry(0.42, 0.09, 0.32), m(col), [0, 0, 0], [0, 0.35, 0]);
      add(g, new THREE.BoxGeometry(0.4, 0.07, 0.3), m('#efe7d2'), [0.012, 0, 0.012], [0, 0.35, 0]);
      add(g, new THREE.TorusGeometry(0.05, 0.012, 5, 12), m(acc ?? '#59d0c4', 'glow'), [0, 0.05, 0], [Math.PI / 2, 0, 0]);
      add(g, new THREE.BoxGeometry(0.05, 0.1, 0.06), m('#c9a050', 'metal'), [0.17, 0, 0.12], [0, 0.35, 0]);
      break;
    }
    case 'map': {
      // a sheet of parchment, both ends rolled, a red X on it
      const sheet = new THREE.Group();
      sheet.rotation.set(0.55, 0.3, 0);
      g.add(sheet);
      add(sheet, new THREE.BoxGeometry(0.42, 0.012, 0.3), m(col), [0, 0, 0]);
      for (const x of [-0.22, 0.22]) add(sheet, new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10), m(shade(col, 0.85).getHex()), [x, 0.02, 0], [Math.PI / 2, 0, 0]);
      for (const r of [0.8, -0.8]) add(sheet, new THREE.BoxGeometry(0.12, 0.016, 0.024), m(acc ?? '#a83a2a'), [0.03, 0.012, 0], [0, r, 0]);
      break;
    }
    case 'shield': {
      add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.05, 20), m(col, 'metal'), [0, 0, 0], [Math.PI / 2 - 0.35, 0, 0]);
      add(g, new THREE.TorusGeometry(0.27, 0.022, 6, 24), m(shade(col, 0.7).getHex(), 'metal'), [0, 0, 0], [-0.35, 0, 0]);
      add(g, new THREE.SphereGeometry(0.07, 12, 8), m('#c9a050', 'metal'), [0, 0.01, 0.03]);
      break;
    }
    case 'legs': {
      add(g, new THREE.BoxGeometry(0.34, 0.1, 0.16), m(col, 'metal'), [0, 0.22, 0]);
      for (const x of [-0.09, 0.09]) add(g, new THREE.CylinderGeometry(0.075, 0.065, 0.42, 8), m(col, 'metal'), [x, -0.04, 0], [0, 0, x * 0.6]);
      for (const x of [-0.1, 0.1]) add(g, new THREE.SphereGeometry(0.06, 8, 6), m(shade(col, 0.8).getHex(), 'metal'), [x, 0.02, 0.05]);
      break;
    }
    case 'boots': {
      for (const x of [-0.1, 0.1]) {
        add(g, new THREE.CylinderGeometry(0.07, 0.075, 0.22, 8), m(col, 'metal'), [x, 0.06, -0.02]);
        add(g, new THREE.BoxGeometry(0.13, 0.08, 0.26), m(col, 'metal'), [x, -0.08, 0.05]);
      }
      break;
    }
    case 'gloves': {
      add(g, new THREE.BoxGeometry(0.22, 0.24, 0.08), m(col, 'metal'), [0, 0, 0]);
      for (let k = 0; k < 4; k++) add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6), m(col, 'metal'), [-0.08 + k * 0.053, 0.18, 0]);
      add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.11, 6), m(col, 'metal'), [0.14, 0.04, 0], [0, 0, -0.8]);
      add(g, new THREE.CylinderGeometry(0.13, 0.12, 0.1, 10), m(shade(col, 0.8).getHex(), 'metal'), [0, -0.15, 0], [0, 0, 0], [1, 1, 0.6]);
      break;
    }
    case 'amulet': {
      add(g, new THREE.TorusGeometry(0.2, 0.012, 5, 24, Math.PI * 1.4), m(col, 'metal'), [0, 0.08, 0], [0, 0, -Math.PI * 0.2 - Math.PI]);
      add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), m(col, 'metal'), [0, -0.16, 0], [Math.PI / 2, 0, 0]);
      if (acc) add(g, new THREE.OctahedronGeometry(0.045, 0), m(acc, 'gloss'), [0, -0.16, 0.03]);
      break;
    }
    case 'bracelet': {
      add(g, new THREE.TorusGeometry(0.18, 0.035, 8, 24), m(col, 'metal'), [0, 0, 0], [1.1, 0, 0]);
      if (acc) for (const a of [0, 2.1, 4.2]) add(g, new THREE.SphereGeometry(0.03, 8, 6), m(acc, 'gloss'), [Math.cos(a) * 0.18, Math.sin(a) * 0.18 * 0.45, Math.sin(a) * 0.18 * 0.9]);
      break;
    }
  }
  return g;
}

/** Fresh model for an item id (qty only changes coin piles). Centred on the origin. */
/** Metal tier from an id's suffix: -1 for the worn starter kit, 0 bronze, 1 iron, ... */
function tierOf(id: string): number {
  const key = id.slice(id.indexOf('_') + 1);
  if (key === 'chipped' || key === 'rusty') return -1;
  if (key === 'brigand') return 1;
  return METALS.findIndex((mt) => mt.key === key);
}

/** Gear and fish have their own detailed builders; everything else uses the shape table below. */
function special(id: string, shape: IconShape, col: string, acc: string | undefined, qty = 1): THREE.Group | null {
  const tier = tierOf(id);
  switch (shape) {
    case 'hatchet': return buildHatchet(col, tier);
    case 'pickaxe': return buildPickaxe(col, tier);
    case 'cutlass': return buildCutlass(col, acc ?? (tier >= 3 ? '#c9a050' : shade(col, 0.8).getStyle()), tier, id === 'cutlass_brigand');
    case 'helm': return buildHelm(col, tier);
    case 'plate': return buildPlate(col, tier);
    case 'pistol': return buildPistol(col, acc ?? '#9aa0a4', Math.max(0, tier));
    case 'dagger': return buildDagger(col, tier);
    case 'greatsword': return buildGreatsword(col, tier);
    case 'pike': return buildPike(col, tier);
    case 'bow': return buildBow(col, acc ?? col, id.startsWith('longbow'));
    case 'crossbow': return buildCrossbow(col, acc ?? '#9aa0a4', Math.max(0, tierOf(id)));
    case 'arrow': return buildArrows(col, acc ?? '#e9e3d0', false, qty);
    case 'bolt': return buildArrows(col, '#8a6440', true, qty);
    case 'staff': return buildStaff(col, acc ?? '#59d0c4', id === 'staff_driftwood' ? 0 : id === 'staff_coral' ? 1 : id === 'staff_storm' ? 2 : 3);
    case 'fish': {
      const sp = /^fish_([a-z]+?)(_raw)?$/.exec(id)?.[1] ?? 'sprat', cooked = !id.endsWith('_raw');
      return sp === 'shark' && cooked ? buildSteak(col) : buildFish(sp, cooked, col);
    }
  }
  return null;
}

export function buildItemModel(id: string, qty = 1): THREE.Group {
  const d = item(id);
  const sp = special(id, d.icon.shape, d.icon.color, d.icon.accent, qty);
  // special builders lean their own model; wrap it so the icon camera's rotation doesn't overwrite that
  const g = sp ? new THREE.Group().add(sp) : builders(d.icon.shape, d.icon.color, d.icon.accent, id.length * 31 + id.charCodeAt(0), qty, !id.endsWith('_raw'));
  const box = new THREE.Box3().setFromObject(g);
  const centre = box.getCenter(new THREE.Vector3());
  for (const ch of g.children) ch.position.sub(centre);
  return g;
}

// ---- loot: items wash up sealed in a shard of sea-glass ------------------------

export const SHARD_TINT = { common: 0x9fe0c8, fine: 0x7fc0ff, rare: 0xf2cf5b, relic: 0xee8a4e, quest: 0x59d0c4 } as const;
export type ShardKind = keyof typeof SHARD_TINT;

export interface LootShard { group: THREE.Group; glass: THREE.MeshStandardMaterial; ring: THREE.Mesh; inner: THREE.Group }

export function buildLootShard(id: string, qty: number, kind: ShardKind, seed: number): LootShard {
  const tint = SHARD_TINT[kind];
  const group = new THREE.Group();
  // six-sided crystal, pointed at both ends, a little crooked
  const prof = [[0, -0.42], [0.2, -0.22], [0.27, 0.05], [0.24, 0.3], [0.12, 0.48], [0, 0.56]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = nudge(new THREE.LatheGeometry(prof, 6), 0.05, seed);
  const glass = new THREE.MeshStandardMaterial({ color: tint, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.1, emissive: tint, emissiveIntensity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const shell = new THREE.Mesh(geo, glass);
  shell.renderOrder = 3;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.9 }));
  shell.add(edges);
  const inner = buildItemModel(id, qty);
  const sphere = new THREE.Box3().setFromObject(inner).getBoundingSphere(new THREE.Sphere());
  inner.scale.setScalar(0.26 / Math.max(0.05, sphere.radius));
  inner.position.y = 0.06;
  inner.rotation.set(0.3, 0, 0.2);
  group.scale.setScalar(1.25);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.42, 28), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 2;
  group.add(inner, shell, ring);
  return { group, glass, ring, inner };
}
