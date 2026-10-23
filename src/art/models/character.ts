import * as THREE from 'three';
import { mat, mesh, type PalKey } from '../materials';

// Jointed humanoid, ~1.8m. Faces +z. Rigid parts on pivots, animated in code (no skinning).
// Built from turned (lathe) profiles, capsules and spheres so every silhouette is rounded:
// tapered limbs, a shaped torso, a flared coat, a sculpted head and a real folded tricorn.

export interface HumanoidLook {
  skin: PalKey | number;
  coat: PalKey | number;
  coatTrim: PalKey | number;
  shirt: PalKey | number;
  trousers: PalKey | number;
  boots: PalKey | number;
  hat: PalKey | number;
  hair: PalKey | number;
  hatStyle?: 'tricorn' | 'bandana' | 'cap' | 'none';
  hairStyle?: 'short' | 'queue' | 'bun';
  held?: 'cutlass' | 'musket' | 'hammer' | 'pistol' | 'staff' | 'none';
  beard?: boolean;
  apron?: PalKey | number;
  spectacles?: boolean;
}

export interface HumanoidRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  held: THREE.Group;
}

/** Turned profile: [radius, y] pairs from top to bottom; closed at both ends when radius 0. */
const lathe = (pts: [number, number][], seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const cylr = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

/** Tricorn: a round brim pinned up on three sides, corners pointing front and back-sides. */
function tricornBrim(r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, 0.025, 48, 1, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr < 1e-4) continue;
    const th = Math.atan2(x, z); // 0 = front
    const corner = Math.cos(3 * th); // 1 at the three corners
    const k = (0.86 + 0.16 * corner) * (rr / r);
    const up = (1 - corner) * 0.5 * 0.13 * (rr / r) ** 2;
    pos.setXYZ(i, Math.sin(th) * r * k, y + up, Math.cos(th) * r * k);
  }
  g.computeVertexNormals();
  return g;
}

export function buildHumanoid(look: HumanoidLook): HumanoidRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---- legs: one turned profile each (hip -> knee -> ankle), cuffed boots with a rounded toe
  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.11 * side, 0.92, 0);
    const trouser = mesh(lathe([[0, 0.04], [0.085, 0.02], [0.1, -0.08], [0.092, -0.3], [0.072, -0.46], [0.074, -0.52], [0.064, -0.66], [0, -0.68]], 12), mat(look.trousers));
    const shaft = mesh(lathe([[0, -0.5], [0.092, -0.5], [0.098, -0.55], [0.08, -0.6], [0.078, -0.8], [0.084, -0.86], [0, -0.86]], 12), mat(look.boots));
    const foot = mesh(sphere(0.085, 12, 8), mat(look.boots));
    foot.scale.set(0.95, 0.7, 1.65);
    put(foot, 0, -0.85, 0.06);
    const sole = mesh(cylr(0.085, 0.085, 0.03, 12), mat('woodDark'));
    sole.scale.set(0.95, 1, 1.7);
    put(sole, 0, -0.9, 0.06);
    leg.add(trouser, shaft, foot, sole);
    body.add(leg);
    return leg;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // ---- torso: tapered waist, full chest, sloped shoulders; flattened front-to-back
  const torso = mesh(lathe([[0, 1.6], [0.07, 1.58], [0.17, 1.53], [0.225, 1.44], [0.23, 1.3], [0.195, 1.12], [0.18, 0.98], [0, 0.96]], 16), mat(look.coat));
  torso.scale.z = 0.74;
  // coat skirt: a thick turned shell flaring to the knee
  const skirt = mesh(lathe([[0.17, 1.0], [0.205, 0.92], [0.26, 0.74], [0.31, 0.56], [0.29, 0.54], [0.235, 0.7], [0.18, 0.9], [0.15, 1.0]], 16), mat(look.coat));
  skirt.scale.z = 0.8;
  // shirt front and lapels show the coat is open
  // shirt shows in a narrow V between the lapels, sitting flush with the chest
  const shirt = mesh(sphere(0.1, 12, 10), mat(look.shirt));
  shirt.scale.set(0.6, 1.4, 0.22);
  put(shirt, 0, 1.36, 0.135, -0.12);
  const lapel = (side: number) => {
    const l = mesh(capsule(0.016, 0.3), mat(look.coatTrim));
    return put(l, 0.06 * side, 1.34, 0.152, -0.14, 0, -0.2 * side);
  };
  const edge = (side: number) => put(mesh(capsule(0.012, 0.36), mat(look.coatTrim)), 0.06 * side, 0.78, 0.232, 0.33, 0, 0.1 * side);
  const belt = mesh(new THREE.TorusGeometry(0.185, 0.03, 6, 20), mat('leather'));
  belt.scale.set(1, 0.76, 1);
  put(belt, 0, 1.0, 0, Math.PI / 2);
  const buckle = mesh(cylr(0.045, 0.045, 0.025, 10), mat('brass'));
  put(buckle, 0, 1.0, 0.142, Math.PI / 2);
  body.add(torso, skirt, shirt, lapel(-1), lapel(1), edge(-1), edge(1), belt, buckle);
  for (const side of [-1, 1]) {
    const delt = mesh(sphere(0.105, 12, 8), mat(look.coat));
    delt.scale.set(1, 0.85, 0.9);
    put(delt, 0.235 * side, 1.47, 0);
    const pad = mesh(sphere(0.1, 12, 6), mat(look.coatTrim));
    pad.scale.set(1.1, 0.3, 0.95);
    put(pad, 0.245 * side, 1.545, 0);
    body.add(delt, pad);
  }
  if (look.apron !== undefined) {
    const apron = mesh(lathe([[0.2, 1.22], [0.21, 1.0], [0.26, 0.62], [0.255, 0.6], [0.2, 0.98], [0.19, 1.22]], 10), mat(look.apron));
    apron.scale.z = 0.82;
    // only the front arc: squash the back half behind the body so it reads as an apron
    const ap = apron.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < ap.count; i++) if (ap.getZ(i) < 0) ap.setZ(i, ap.getZ(i) * 0.15);
    apron.geometry.computeVertexNormals();
    put(apron, 0, 0, 0.03);
    body.add(apron);
  }

  // ---- head: skull, jaw, nose, ears, brows, eyes, hair
  const head = new THREE.Group();
  head.position.y = 1.58;
  const neck = mesh(cylr(0.055, 0.068, 0.12, 10), mat(look.skin));
  neck.position.y = 0.03;
  const skull = mesh(sphere(0.135, 16, 12), mat(look.skin));
  skull.scale.set(0.93, 1.06, 1.02);
  skull.position.y = 0.19;
  const jaw = mesh(sphere(0.1, 14, 10), mat(look.skin));
  jaw.scale.set(1.02, 0.85, 0.95);
  put(jaw, 0, 0.12, 0.035);
  const nose = mesh(sphere(0.026, 8, 6), mat(look.skin));
  nose.scale.set(0.9, 1.3, 1.25);
  put(nose, 0, 0.165, 0.13);
  head.add(neck, skull, jaw, nose);
  for (const side of [-1, 1]) {
    const ear = mesh(sphere(0.03, 8, 6), mat(look.skin));
    ear.scale.set(0.55, 1.15, 0.9);
    put(ear, 0.128 * side, 0.18, -0.005);
    const eye = mesh(sphere(0.016, 8, 6), mat('eye'), false);
    put(eye, 0.047 * side, 0.2, 0.118);
    const brow = mesh(capsule(0.011, 0.045), mat(look.hair), false);
    put(brow, 0.05 * side, 0.232, 0.118, 0, 0, Math.PI / 2 + 0.18 * side);
    head.add(ear, eye, brow);
  }
  const hairCap = mesh(new THREE.SphereGeometry(0.143, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), mat(look.hair));
  hairCap.scale.set(0.95, 1.05, 1.06);
  put(hairCap, 0, 0.2, -0.012, -0.32);
  head.add(hairCap);
  const hs = look.hairStyle ?? (look.beard === false ? 'bun' : 'queue');
  if (hs === 'queue') {
    const tail = mesh(capsule(0.03, 0.14), mat(look.hair));
    put(tail, 0, 0.09, -0.15, 0.35);
    const tie = mesh(new THREE.TorusGeometry(0.032, 0.012, 6, 12), mat(look.coatTrim));
    put(tie, 0, 0.17, -0.135, Math.PI / 2 + 0.35);
    head.add(tail, tie);
  } else if (hs === 'bun') {
    const bun = mesh(sphere(0.065, 12, 8), mat(look.hair));
    put(bun, 0, 0.27, -0.12);
    head.add(bun);
  }
  if (look.beard !== false) {
    const beard = mesh(sphere(0.095, 14, 10), mat(look.hair));
    beard.scale.set(1.0, 0.95, 0.8);
    put(beard, 0, 0.085, 0.05);
    const tash = mesh(capsule(0.017, 0.07), mat(look.hair));
    put(tash, 0, 0.138, 0.118, 0, 0, Math.PI / 2);
    head.add(beard, tash);
  }
  if (look.spectacles) {
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 14), mat('brass'), false);
      put(rim, 0.047 * side, 0.2, 0.128);
      head.add(rim);
    }
    const bridge = mesh(capsule(0.005, 0.03), mat('brass'), false);
    put(bridge, 0, 0.205, 0.132, 0, 0, Math.PI / 2);
    head.add(bridge);
  }
  const style = look.hatStyle ?? 'tricorn';
  if (style === 'tricorn') {
    const brim = mesh(tricornBrim(0.3), mat(look.hat));
    brim.position.y = 0.3;
    const crown = mesh(lathe([[0, 0.48], [0.08, 0.475], [0.135, 0.44], [0.15, 0.38], [0.155, 0.31], [0, 0.31]], 16), mat(look.hat));
    const band = mesh(new THREE.TorusGeometry(0.153, 0.014, 6, 24), mat(look.coatTrim));
    put(band, 0, 0.33, 0, Math.PI / 2);
    head.add(brim, crown, band);
  } else if (style === 'bandana') {
    const wrap = mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(look.hat));
    wrap.scale.set(0.98, 0.95, 1.06);
    put(wrap, 0, 0.21, -0.008, -0.15);
    const knot = mesh(sphere(0.035, 8, 6), mat(look.hat));
    put(knot, 0, 0.22, -0.15);
    const tailA = put(mesh(capsule(0.022, 0.13), mat(look.hat)), 0.03, 0.14, -0.17, 0.5, 0, 0.25);
    const tailB = put(mesh(capsule(0.02, 0.1), mat(look.hat)), -0.03, 0.15, -0.165, 0.45, 0, -0.3);
    head.add(wrap, knot, tailA, tailB);
  } else if (style === 'cap') {
    const cap = mesh(new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(look.hat));
    cap.scale.set(1, 0.9, 1.05);
    cap.position.y = 0.23;
    const peak = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.018, 16, 1, false, -Math.PI / 2, Math.PI), mat(look.hat));
    peak.scale.set(1.1, 1, 0.9);
    put(peak, 0, 0.27, 0.07, 0.18);
    head.add(cap, peak);
  }
  body.add(head);

  // ---- arms: tapered sleeves, flared cuffs, shaped hands with a thumb
  const held = new THREE.Group();
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.27 * side, 1.47, 0);
    const sleeve = mesh(lathe([[0, 0.05], [0.07, 0.03], [0.076, -0.08], [0.066, -0.28], [0.064, -0.34], [0.06, -0.52], [0, -0.53]], 12), mat(look.coat));
    sleeve.rotation.x = -0.06;
    const cuff = mesh(lathe([[0.062, -0.46], [0.086, -0.5], [0.09, -0.58], [0.07, -0.585], [0.058, -0.5]], 12), mat(look.coatTrim));
    const hand = mesh(sphere(0.055, 12, 8), mat(look.skin));
    hand.scale.set(0.8, 1.15, 0.95);
    put(hand, 0, -0.64, 0.035);
    const thumb = mesh(capsule(0.017, 0.035), mat(look.skin));
    put(thumb, -0.035 * side, -0.62, 0.075, 0.6, 0, 0.5 * side);
    arm.add(sleeve, cuff, hand, thumb);
    arm.rotation.z = 0.1 * side;
    body.add(arm);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  held.position.set(0, -0.66, 0.05);
  armR.add(held);
  buildHeld(held, body, look.held ?? 'none');

  return { root, body, head, armL, armR, legL, legR, held };
}

/** Weapons and tools in hand (+z = pointing forward when the arm is lowered). */
function buildHeld(held: THREE.Group, body: THREE.Group, kind: NonNullable<HumanoidLook['held']>) {
  const grip = () => mesh(cylr(0.022, 0.024, 0.13, 8), mat('leather'));
  if (kind === 'cutlass') {
    // curved single-edged blade swept from a basket guard
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.018);
    shape.quadraticCurveTo(0.36, -0.05, 0.7, 0.05);
    shape.quadraticCurveTo(0.72, 0.075, 0.69, 0.085);
    shape.quadraticCurveTo(0.36, 0.035, 0, 0.032);
    shape.lineTo(0, -0.018);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
    bladeGeo.translate(0, 0, -0.006);
    const blade = mesh(bladeGeo, mat(0xd2d5d2));
    put(blade, 0, 0, 0.09, 0, -Math.PI / 2, Math.PI / 2 - 0.1);
    const basket = mesh(new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('brass'));
    put(basket, 0, 0.0, 0.085, -Math.PI / 2);
    const g = grip();
    put(g, 0, 0, 0.0, Math.PI / 2);
    const pommel = mesh(sphere(0.025, 8, 6), mat('brass'));
    put(pommel, 0, 0, -0.075);
    held.add(blade, basket, g, pommel);
  } else if (kind === 'musket') {
    const barrel = mesh(cylr(0.022, 0.026, 1.05, 10), mat('iron'));
    put(barrel, 0, 0.03, 0.48, Math.PI / 2);
    const stock = mesh(lathe([[0, 0.3], [0.03, 0.29], [0.035, 0.0], [0.055, -0.2], [0.06, -0.3], [0, -0.31]], 10), mat('wood'));
    stock.scale.x = 0.7;
    put(stock, 0, -0.01, 0.02, Math.PI / 2);
    const band = mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), mat('brass'));
    put(band, 0, 0.03, 0.5);
    held.add(barrel, stock, band);
  } else if (kind === 'pistol') {
    const barrel = mesh(cylr(0.022, 0.028, 0.36, 10), mat('iron'));
    put(barrel, 0, 0.035, 0.24, Math.PI / 2);
    const muzzle = mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 12), mat('brass'));
    put(muzzle, 0, 0.035, 0.42);
    const butt = mesh(lathe([[0, 0.09], [0.028, 0.08], [0.03, -0.02], [0.045, -0.1], [0, -0.12]], 10), mat('wood'));
    butt.scale.x = 0.75;
    put(butt, 0, -0.02, 0.03, 0.5);
    const cap = mesh(sphere(0.03, 8, 6), mat('brass'));
    put(cap, 0, -0.08, -0.03);
    held.add(barrel, muzzle, butt, cap);
  } else if (kind === 'staff') {
    const pole = mesh(cylr(0.024, 0.032, 1.5, 8), mat('woodLight'));
    put(pole, 0, 0.25, 0.06);
    const orb = mesh(sphere(0.085, 16, 12), mat(0x59d0c4, { emissive: 0x59d0c4, emissiveIntensity: 1.2 }), false);
    put(orb, 0, 1.07, 0.06);
    held.add(pole, orb);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const claw = mesh(capsule(0.012, 0.12), mat('woodLight'));
      put(claw, Math.cos(a) * 0.06, 1.02, 0.06 + Math.sin(a) * 0.06, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      held.add(claw);
    }
  } else if (kind === 'hammer') {
    const haft = mesh(cylr(0.02, 0.024, 0.46, 8), mat('wood'));
    put(haft, 0, 0, 0.15, Math.PI / 2);
    const headM = mesh(cylr(0.05, 0.05, 0.17, 12), mat('iron'));
    put(headM, 0, 0, 0.37);
    held.add(haft, headM);
  } else {
    // sheathed cutlass on the hip
    const scabbard = mesh(capsule(0.026, 0.6), mat('leather'));
    put(scabbard, -0.27, 0.74, 0.06, 0.35, 0, 0.15);
    const hilt = mesh(sphere(0.045, 10, 8), mat('brass'));
    put(hilt, -0.24, 1.06, 0.16);
    body.add(scabbard, hilt);
  }
}

export function animateIdle(r: HumanoidRig, t: number) {
  const b = Math.sin(t * 1.8);
  r.body.position.y = b * 0.008;
  r.armL.rotation.x = Math.sin(t * 1.8) * 0.04;
  r.armR.rotation.x = -Math.sin(t * 1.8) * 0.04;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
  r.head.rotation.y = Math.sin(t * 0.45) * 0.35;
}

export function animateWalk(r: HumanoidRig, t: number, speed = 1) {
  const s = Math.sin(t * 9 * speed);
  r.legL.rotation.x = s * 0.6;
  r.legR.rotation.x = -s * 0.6;
  r.armL.rotation.x = -s * 0.45;
  r.armR.rotation.x = s * 0.45;
  r.body.position.y = Math.abs(Math.cos(t * 9 * speed)) * 0.05;
  r.head.rotation.y = 0;
}

/** 0..1 swing progress: wind back then slash across. */
export function animateSwing(r: HumanoidRig, k: number) {
  const a = k < 0.3 ? -k / 0.3 : -1 + (k - 0.3) / 0.7 * 2.4;
  r.armR.rotation.x = a * 1.3;
  r.armR.rotation.z = 0.08 + (k < 0.3 ? 0 : Math.sin((k - 0.3) / 0.7 * Math.PI) * 0.5);
  r.body.rotation.y = Math.sin(k * Math.PI) * -0.35;
}

/** Repeating work motion for chopping / mining / hammering. */
export function animateWork(r: HumanoidRig, t: number) {
  const s = (Math.sin(t * 5.2) + 1) / 2;
  r.armR.rotation.x = -2.2 + s * 2.0;
  r.armL.rotation.x = -1.6 + s * 1.6;
  r.body.rotation.x = s * 0.15;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
}

export function animateFish(r: HumanoidRig, t: number) {
  r.armR.rotation.x = -1.1 + Math.sin(t * 1.3) * 0.08;
  r.armL.rotation.x = -0.9;
  r.body.rotation.x = 0;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
}
