import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { item, type IconShape } from '../../game/data/items';
import { hash2, mulberry32 } from '../noise';

// Item models: one small, readable 3D object per item. Used for inventory icons (rendered on a
// slate tile) and inside the sea-glass shards that loot washes up in. ~0.6 units across.

const c = (hex: string | number) => new THREE.Color(hex);
const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Matte for organic things, a little sheen for metal, gloss for glass. */
function m(colour: string | number, kind: 'matte' | 'metal' | 'gloss' | 'glow' = 'matte'): THREE.MeshStandardMaterial {
  const key = `${colour}|${kind}`;
  let mt = matCache.get(key);
  if (!mt) {
    const col = c(colour);
    mt = new THREE.MeshStandardMaterial({
      color: col,
      roughness: kind === 'metal' ? 0.32 : kind === 'gloss' ? 0.15 : 0.82,
      metalness: kind === 'metal' ? 0.55 : 0,
      emissive: kind === 'glow' ? col : 0x000000,
      emissiveIntensity: kind === 'glow' ? 0.9 : 0,
    });
    matCache.set(key, mt);
  }
  return mt;
}

function nudge(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const w = mergeVertices(geo, 1e-4);
  const p = w.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const kx = Math.round(p.getX(i) * 1000), ky = Math.round(p.getY(i) * 1000), kz = Math.round(p.getZ(i) * 1000);
    p.setXYZ(i, p.getX(i) + (hash2(kx, ky + kz, seed) - 0.5) * amount, p.getY(i) + (hash2(ky, kz + kx, seed + 3) - 0.5) * amount, p.getZ(i) + (hash2(kz, kx + ky, seed + 7) - 0.5) * amount);
  }
  w.computeVertexNormals();
  return w;
}

const shade = (hex: string, k: number) => c(hex).multiplyScalar(k);

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) {
  const me = new THREE.Mesh(geo, mat);
  me.position.set(...pos);
  me.rotation.set(...rot);
  if (scale) me.scale.set(...scale);
  me.castShadow = true;
  g.add(me);
  return me;
}

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
    case 'ring': {
      add(g, new THREE.TorusGeometry(0.14, 0.035, 10, 24), m(col, 'metal'), [0, 0, 0], [0.9, 0, 0]);
      add(g, new THREE.OctahedronGeometry(0.06, 0), m(acc ?? '#59d0c4', 'gloss'), [0, 0.1, 0.11], [0.9, 0.4, 0]);
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
    case 'charm': {
      add(g, nudge(new THREE.OctahedronGeometry(0.12, 1), 0.02, seed), m(col, 'gloss'), [0, 0, 0], [0, 0.3, 0], [0.8, 1.4, 0.8]);
      add(g, new THREE.TorusGeometry(0.1, 0.01, 4, 16), m(acc ?? '#2a7f78'), [0, 0.05, 0], [1.2, 0, 0]);
      break;
    }
  }
  return g;
}

/** Fresh model for an item id (qty only changes coin piles). Centred on the origin. */
export function buildItemModel(id: string, qty = 1): THREE.Group {
  const d = item(id);
  const g = builders(d.icon.shape, d.icon.color, d.icon.accent, id.length * 31 + id.charCodeAt(0), qty, !id.endsWith('_raw'));
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
