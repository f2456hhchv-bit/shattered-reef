import * as THREE from 'three';
import { mat, type PalKey } from '../materials';
import type { HeldKind, HumanoidLook, HumanoidRig } from './character';

// RuneScape-style people (Tom, 2026-10-24): realistic proportions in a few hundred flat-shaded facets, so they
// read clearly from the overhead camera and cost a phone ~1/10 of the vinyl toys. Same joints as every other
// humanoid (hips 0.92 m, knees, shoulders 1.47 m, elbows, head 1.58 m), so walking, swinging, gathering and
// held weapons work unchanged. Faceting comes from per-face normals, which survive the rig bake.

type Col = PalKey | number;

/** Per-face normals: the flat-shaded look. */
function facet(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
}
const part = (geo: THREE.BufferGeometry, c: Col, cast = true, opts?: Parameters<typeof mat>[1]) => {
  const m = new THREE.Mesh(facet(geo), mat(c, opts));
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
const lathe = (pts: [number, number][], seg = 7) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
/** Bend vertices: `f(x, y, z) -> [x, y, z]`. */
function shape(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => [number, number, number]): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  return g;
}

export function buildLowPoly(look: HumanoidLook, buildHeld: (held: THREE.Group, body: THREE.Group, kind: HeldKind) => void): HumanoidRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---- legs: straight-cut trousers rolled at the ankle, square-toed boots
  const knees: THREE.Group[] = [];
  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.1 * side, 0.92, 0);
    leg.add(part(lathe([[0, 0.03], [0.092, 0.0], [0.1, -0.1], [0.088, -0.3], [0.074, -0.44], [0, -0.46]]), look.trousers));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    knee.add(part(lathe([[0, 0.03], [0.075, 0.0], [0.078, -0.1], [0.072, -0.3], [0, -0.32]]), look.trousers));
    knee.add(put(part(new THREE.CylinderGeometry(0.09, 0.094, 0.07, 7), look.trousers), 0, -0.32, 0)); // rolled cuff
    knee.add(put(part(new THREE.CylinderGeometry(0.068, 0.074, 0.08, 6), look.boots), 0, -0.39, 0));
    const foot = shape(box(0.12, 0.08, 0.25), (x, y, z) => [x * (z > 0 ? 0.85 : 1), y + (z > 0.08 && y > 0 ? -0.025 : 0), z]);
    knee.add(look.feetBack ? put(part(foot, look.boots), 0, -0.44, -0.045, 0, Math.PI) : put(part(foot, look.boots), 0, -0.44, 0.045));
    leg.add(knee);
    body.add(leg);
    knees.push(knee);
    return leg;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  const [kneeL, kneeR] = knees;

  // ---- torso: broad chest tapering to the waist, a short flared hem, a belt, a V at the neck
  const torso = part(lathe([[0, 1.585], [0.085, 1.575], [0.2, 1.52], [0.245, 1.42], [0.22, 1.26], [0.19, 1.1], [0.2, 0.98], [0, 0.96]], 8), look.coat);
  torso.scale.set(1.08, 1, 0.7);
  const hem = part(lathe([[0.19, 1.0], [0.235, 0.86], [0.215, 0.85], [0.18, 0.98]], 8), look.coat);
  hem.scale.z = 0.72;
  const belt = part(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 8), 'leather');
  belt.scale.z = 0.7;
  put(belt, 0, 0.99, 0);
  const buckle = put(part(box(0.06, 0.05, 0.02), 'brass'), 0, 0.99, 0.145);
  const vee = put(part(new THREE.ConeGeometry(0.065, 0.15, 3), look.shirt, false), 0, 1.51, 0.143, Math.PI, 0, 0);
  vee.scale.z = 0.25;
  const collar = put(part(new THREE.TorusGeometry(0.075, 0.022, 4, 8), look.coatTrim), 0, 1.565, 0, Math.PI / 2 - 0.12);
  collar.scale.set(1, 0.85, 1);
  body.add(torso, hem, belt, buckle, vee, collar);
  for (const side of [-1, 1]) body.add(put(part(new THREE.SphereGeometry(0.1, 6, 4), look.coat), 0.235 * side, 1.46, 0, 0, 0, 0.3 * side));
  if (look.apron !== undefined) {
    const apron = part(shape(lathe([[0.2, 1.22], [0.205, 1.0], [0.25, 0.64], [0.245, 0.62], [0.195, 0.98], [0.19, 1.22]], 8), (x, y, z) => [x, y, z < 0 ? z * 0.15 : z]), look.apron);
    apron.scale.z = 0.8;
    body.add(put(apron, 0, 0, 0.02));
  }

  // ---- head: an angular skull and jaw, wedge nose, slit eyes under heavy brows
  const head = new THREE.Group();
  head.position.y = 1.58;
  head.scale.setScalar(1.18); // a little big, as in RuneScape: faces have to read from the overhead camera
  head.add(put(part(new THREE.CylinderGeometry(0.05, 0.062, 0.1, 6), look.skin), 0, 0.03, 0));
  const skullGeo = shape(new THREE.SphereGeometry(0.13, 8, 7), (x, y, z) => {
    const below = Math.max(0, -y / 0.13);
    return [x * 0.9 * (1 - 0.3 * below * below), y * (y < 0 ? 1.18 : 1.05), z * (z > 0 ? 1 + 0.1 * below : 1.02)];
  });
  head.add(put(part(skullGeo, look.skin), 0, 0.17, 0));
  head.add(put(part(new THREE.ConeGeometry(0.026, 0.065, 4), look.skin), 0, 0.15, 0.13, Math.PI / 2, Math.PI / 4, 0)); // nose
  for (const side of [-1, 1]) {
    head.add(put(part(new THREE.SphereGeometry(0.027, 4, 3), look.skin), 0.122 * side, 0.165, -0.005, 0, 0, 0)); // ear
    const eyeCol = look.eyes ?? 0x1a1210;
    head.add(put(part(box(0.038, 0.013, 0.01), eyeCol, false, look.eyes ? { emissive: look.eyes, emissiveIntensity: 1.4 } : undefined), 0.046 * side, 0.18, 0.121, 0, 0, -0.08 * side));
    head.add(put(part(box(0.052, 0.016, 0.022), look.hair, false), 0.047 * side, 0.205, 0.118, 0, 0, 0.14 * side)); // brow
  }
  head.add(put(part(box(0.048, 0.009, 0.01), 0x6a3a30, false), 0, 0.105, 0.122)); // mouth

  // hair (a faceted cap and a tail or bun) unless the hat covers it all
  const hatStyle = look.hatStyle ?? 'tricorn';
  head.add(put(part(new THREE.SphereGeometry(0.136, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), look.hair), 0, 0.19, -0.012, -0.3));
  const hs = look.hairStyle ?? (look.beard === false ? 'bun' : 'queue');
  if (hs === 'queue') head.add(put(part(new THREE.CylinderGeometry(0.022, 0.03, 0.16, 5), look.hair), 0, 0.1, -0.14, 0.35));
  else if (hs === 'bun') head.add(put(part(new THREE.SphereGeometry(0.06, 6, 4), look.hair), 0, 0.27, -0.11));
  if (look.beard !== false) {
    // goatee and moustache, like the reference: a pointed chin beard and a drooping moustache
    head.add(put(part(new THREE.ConeGeometry(0.048, 0.12, 5), look.hair), 0, 0.045, 0.1, Math.PI + 0.25, 0, 0));
    for (const side of [-1, 1]) head.add(put(part(box(0.06, 0.016, 0.02), look.hair), 0.03 * side, 0.115, 0.122, 0, 0, -0.5 * side));
  }
  if (look.spectacles) {
    for (const side of [-1, 1]) head.add(put(part(new THREE.TorusGeometry(0.026, 0.005, 3, 8), 'brass', false), 0.046 * side, 0.182, 0.13));
    head.add(put(part(box(0.03, 0.006, 0.006), 'brass', false), 0, 0.186, 0.132));
  }
  if (hatStyle === 'tricorn') {
    const brim = shape(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 12), (x, y, z) => {
      const rr = Math.hypot(x, z);
      if (rr < 1e-4) return [x, y, z];
      const th = Math.atan2(x, z), corner = Math.cos(3 * th), k = 0.86 + 0.16 * corner;
      return [Math.sin(th) * rr * k, y + (1 - corner) * 0.5 * 0.13 * (rr / 0.29) ** 2, Math.cos(th) * rr * k];
    });
    head.add(put(part(brim, look.hat), 0, 0.3, 0));
    head.add(part(lathe([[0, 0.47], [0.09, 0.465], [0.14, 0.42], [0.15, 0.31], [0, 0.31]], 8), look.hat));
    head.add(put(part(new THREE.TorusGeometry(0.15, 0.012, 3, 10), look.coatTrim), 0, 0.33, 0, Math.PI / 2));
  } else if (hatStyle === 'bandana') {
    head.add(put(part(new THREE.SphereGeometry(0.143, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), look.hat), 0, 0.2, -0.008, -0.15));
    head.add(put(part(new THREE.SphereGeometry(0.035, 5, 3), look.hat), 0, 0.21, -0.145));
    head.add(put(part(box(0.04, 0.13, 0.015), look.hat), 0.025, 0.13, -0.16, 0.45, 0, 0.25));
  } else if (hatStyle === 'straw') {
    // a wide straw hat tipped forward over the whole face
    head.add(put(part(new THREE.ConeGeometry(0.46, 0.34, 10), look.hat), 0, 0.3, 0.03, 0.18));
    head.add(put(part(new THREE.TorusGeometry(0.2, 0.018, 3, 10), look.coatTrim), 0, 0.26, 0.01, Math.PI / 2 + 0.18));
  } else if (hatStyle === 'cap') {
    head.add(put(part(new THREE.SphereGeometry(0.145, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.42), look.hat), 0, 0.22, 0));
    head.add(put(part(new THREE.CylinderGeometry(0.11, 0.11, 0.018, 8, 1, false, -Math.PI / 2, Math.PI), look.hat), 0, 0.26, 0.07, 0.18));
  }
  body.add(head);

  // ---- arms: long sleeves with a turned cuff, big blocky hands (they have to read at a distance)
  const held = new THREE.Group();
  const elbows: THREE.Group[] = [];
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.27 * side, 1.47, 0);
    arm.add(part(lathe([[0, 0.04], [0.068, 0.02], [0.07, -0.12], [0.058, -0.27], [0, -0.29]], 6), look.coat));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    elbow.add(part(lathe([[0, 0.02], [0.058, 0.0], [0.052, -0.2], [0, -0.22]], 6), look.coat));
    elbow.add(put(part(new THREE.CylinderGeometry(0.064, 0.07, 0.05, 6), look.coatTrim), 0, -0.21, 0));
    const hand = look.gloves ?? look.skin; // gloves, when worn, cover the hand
    elbow.add(put(part(shape(box(0.075, 0.1, 0.055), (x, y, z) => [x * (y < 0 ? 0.85 : 1), y, z]), hand), 0, -0.29, 0.01));
    elbow.add(put(part(box(0.065, 0.05, 0.045), hand), 0, -0.36, 0.025, 0.35)); // curled fingers
    elbow.add(put(part(box(0.024, 0.055, 0.026), hand), -0.042 * side, -0.29, 0.04, 0.4, 0, 0.45 * side)); // thumb
    if (look.gloves !== undefined) elbow.add(put(part(new THREE.CylinderGeometry(0.068, 0.062, 0.07, 6), look.gloves), 0, -0.24, 0)); // a gauntlet's cuff
    arm.add(elbow);
    arm.rotation.z = 0.1 * side;
    body.add(arm);
    elbows.push(elbow);
    return arm;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const [elbowL, elbowR] = elbows;
  held.position.set(0, -0.38, 0.05);
  elbowR.add(held);
  if ((look.held ?? 'none') !== 'none') buildHeld(held, body, look.held!); // townsfolk go unarmed (no hip scabbard)
  return { root, body, head, armL, armR, legL, legR, kneeL, kneeR, elbowL, elbowR, held };
}
