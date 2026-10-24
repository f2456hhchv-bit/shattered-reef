import * as THREE from 'three';
import { mat, mesh, PAL, type PalKey } from '../materials';
import { buildToy } from './toy';

// Jointed humanoid, ~1.8m. Faces +z. Rigid parts on pivots, animated in code (no skinning).
// Built from turned (lathe) profiles, capsules and spheres so every silhouette is rounded:
// tapered limbs, a shaped torso, a flared coat, a sculpted head and a real folded tricorn.

export type HeldKind = 'cutlass' | 'musket' | 'hammer' | 'pistol' | 'staff' | 'dagger' | 'pike' | 'greatsword' | 'bow' | 'longbow' | 'crossbow' | 'none';

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
  held?: HeldKind;
  beard?: boolean;
  apron?: PalKey | number;
  spectacles?: boolean;
  eyes?: number; // iris colour
  style?: 'toy'; // big-headed vinyl-toy build (toy.ts)
}

export interface HumanoidRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
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
  if (look.style === 'toy') return buildToy(look, buildHeld);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---- legs: thigh on the hip, shin and boot on a knee pivot so walking bends naturally
  const knees: THREE.Group[] = [];
  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.11 * side, 0.92, 0);
    const thigh = mesh(lathe([[0, 0.04], [0.085, 0.02], [0.1, -0.08], [0.092, -0.3], [0.076, -0.44], [0, -0.47]], 12), mat(look.trousers));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = mesh(lathe([[0, 0.04], [0.074, 0.02], [0.078, -0.08], [0.064, -0.22], [0, -0.24]], 12), mat(look.trousers));
    // boot: shaft with a turned-down top, rounded toe, darker sole
    const shaft = mesh(lathe([[0, -0.06], [0.094, -0.06], [0.1, -0.1], [0.08, -0.15], [0.078, -0.36], [0.084, -0.42], [0, -0.42]], 12), mat(look.boots));
    const fold = mesh(new THREE.TorusGeometry(0.092, 0.022, 6, 16), mat(look.boots));
    put(fold, 0, -0.08, 0, Math.PI / 2);
    const foot = mesh(sphere(0.085, 14, 10), mat(look.boots));
    foot.scale.set(0.95, 0.7, 1.65);
    put(foot, 0, -0.41, 0.06);
    const sole = mesh(cylr(0.085, 0.085, 0.03, 12), mat('woodDark'));
    sole.scale.set(0.95, 1, 1.7);
    put(sole, 0, -0.46, 0.06);
    knee.add(shin, shaft, fold, foot, sole);
    leg.add(thigh, knee);
    body.add(leg);
    knees.push(knee);
    return leg;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  const [kneeL, kneeR] = knees;

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
  // a stand-up collar, a row of brass buttons each side of the opening, a pouch on the belt
  const collar = mesh(new THREE.TorusGeometry(0.085, 0.03, 8, 20), mat(look.coat));
  put(collar, 0, 1.56, 0.0, Math.PI / 2 - 0.15);
  collar.scale.set(1, 1, 0.8);
  body.add(collar);
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) body.add(put(mesh(sphere(0.014, 8, 6), mat('brass')), 0.085 * side, 1.38 - k * 0.11, 0.158 - k * 0.006));
  const pouch = mesh(sphere(0.06, 10, 8), mat('leather'));
  pouch.scale.set(1.1, 1, 0.6);
  body.add(put(pouch, -0.16, 0.92, 0.1, 0, 0.5));
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
  head.scale.setScalar(1.1); // a touch larger than life: faces have to read from the overhead camera
  const neck = mesh(cylr(0.055, 0.068, 0.12, 10), mat(look.skin));
  neck.position.y = 0.03;
  // one sculpted head (cranium, cheekbones, jaw and chin in a single surface) wearing a painted face
  const headGeo = new THREE.SphereGeometry(0.145, 32, 24);
  const hp = headGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    const below = Math.max(0, -y / 0.145); // 0 at the eyes' level, 1 at the chin
    x *= 1 - 0.28 * below * below; // jaw tapers to the chin
    if (z > 0) z *= 1 + 0.12 * below - 0.05 * Math.max(0, y / 0.145); // chin forward, brow back a touch
    y *= y < 0 ? 1.12 : 1.02; // a longer face than a ball
    hp.setXYZ(i, x * 0.92, y, z * 1.02);
  }
  headGeo.computeVertexNormals();
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(look), roughness: 0.72 });
  const skull = mesh(headGeo, faceMat);
  skull.position.y = 0.16;
  // nose: a bridge and a rounded tip, low-profile so it shapes the face rather than sticking out
  const nose = mesh(sphere(0.021, 12, 8), mat(look.skin));
  nose.scale.set(0.9, 1.15, 0.95);
  put(nose, 0, 0.143, 0.146);
  const bridge = mesh(capsule(0.011, 0.035), mat(look.skin));
  put(bridge, 0, 0.17, 0.146, -0.35);
  head.add(bridge);
  head.add(neck, skull, nose);
  for (const side of [-1, 1]) {
    const ear = mesh(sphere(0.03, 10, 8), mat(look.skin));
    ear.scale.set(0.55, 1.15, 0.9);
    put(ear, 0.13 * side, 0.165, -0.005);
    head.add(ear);
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
    // a full beard along the jaw and chin, leaving the painted mouth and moustache clear
    const beard = mesh(new THREE.SphereGeometry(0.105, 18, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), mat(look.hair));
    beard.scale.set(1.0, 1.05, 0.95);
    put(beard, 0, 0.1, 0.035);
    head.add(beard);
  }
  if (look.spectacles) {
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 14), mat('brass'), false);
      put(rim, 0.045 * side, 0.185, 0.15);
      head.add(rim);
    }
    const bridge = mesh(capsule(0.005, 0.03), mat('brass'), false);
    put(bridge, 0, 0.19, 0.156, 0, 0, Math.PI / 2);
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
  const elbows: THREE.Group[] = [];
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.27 * side, 1.47, 0);
    const upper = mesh(lathe([[0, 0.05], [0.07, 0.03], [0.076, -0.08], [0.068, -0.26], [0, -0.29]], 12), mat(look.coat));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    const fore = mesh(lathe([[0, 0.03], [0.066, 0.01], [0.062, -0.14], [0.06, -0.25], [0, -0.26]], 12), mat(look.coat));
    const cuff = mesh(lathe([[0.062, -0.19], [0.086, -0.23], [0.09, -0.31], [0.07, -0.315], [0.058, -0.23]], 12), mat(look.coatTrim));
    // hand: palm, a mitten of fingers and a thumb (slightly oversized so it reads at a distance)
    const palm = mesh(sphere(0.058, 12, 10), mat(look.skin));
    palm.scale.set(0.85, 1.05, 0.7);
    put(palm, 0, -0.37, 0.03);
    const fingers = mesh(capsule(0.036, 0.05), mat(look.skin));
    fingers.scale.set(1.25, 1, 0.75);
    put(fingers, 0, -0.43, 0.04, 0.25);
    const thumb = mesh(capsule(0.018, 0.04), mat(look.skin));
    put(thumb, -0.04 * side, -0.36, 0.07, 0.6, 0, 0.5 * side);
    elbow.add(fore, cuff, palm, fingers, thumb);
    arm.add(upper, elbow);
    arm.rotation.z = 0.1 * side;
    body.add(arm);
    elbows.push(elbow);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  const [elbowL, elbowR] = elbows;
  held.position.set(0, -0.4, 0.05);
  elbowR.add(held);
  buildHeld(held, body, look.held ?? 'none');

  return { root, body, head, armL, armR, legL, legR, kneeL, kneeR, elbowL, elbowR, held };
}

/** Weapons and tools in hand (+z = pointing forward when the arm is lowered). */
export function buildHeld(held: THREE.Group, body: THREE.Group, kind: HeldKind) {
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
  } else if (kind === 'dagger') {
    const blade = mesh(lathe([[0, 0.3], [0.03, 0.2], [0.035, 0.05], [0.02, 0], [0, 0]], 4), mat(0xd2d5d2));
    blade.scale.z = 0.3;
    put(blade, 0, 0, 0.06, Math.PI / 2);
    const guard = mesh(cylr(0.012, 0.012, 0.13, 6), mat('brass'));
    put(guard, 0, 0, 0.06, 0, 0, Math.PI / 2);
    const g = grip();
    put(g, 0, 0, 0, Math.PI / 2);
    held.add(blade, guard, g);
  } else if (kind === 'greatsword') {
    const blade = mesh(lathe([[0, 1.0], [0.035, 0.9], [0.045, 0.1], [0.045, 0], [0, 0]], 4), mat(0xd2d5d2));
    blade.scale.z = 0.28;
    put(blade, 0, 0, 0.1, Math.PI / 2);
    const guard = mesh(cylr(0.016, 0.016, 0.34, 6), mat('iron'));
    put(guard, 0, 0, 0.1, 0, 0, Math.PI / 2);
    const g = mesh(cylr(0.022, 0.024, 0.26, 8), mat('leather'));
    put(g, 0, 0, -0.04, Math.PI / 2);
    const pommel = mesh(sphere(0.03, 8, 6), mat('iron'));
    put(pommel, 0, 0, -0.18);
    held.add(blade, guard, g, pommel);
  } else if (kind === 'pike') {
    const pole = mesh(cylr(0.018, 0.022, 2.3, 8), mat('wood'));
    put(pole, 0, 0, 0.55, Math.PI / 2);
    const tip = mesh(lathe([[0, 0.3], [0.035, 0.1], [0.03, 0.0], [0, 0]], 4), mat(0xd2d5d2));
    tip.scale.z = 0.35;
    put(tip, 0, 0, 1.68, Math.PI / 2);
    const socket = mesh(cylr(0.026, 0.022, 0.1, 8), mat('iron'));
    put(socket, 0, 0, 1.66, Math.PI / 2);
    held.add(pole, tip, socket);
  } else if (kind === 'bow' || kind === 'longbow') {
    // held upright in front of the hand: a curved stave with its string
    const h = kind === 'longbow' ? 0.72 : 0.5, d = kind === 'longbow' ? 0.12 : 0.17;
    const curve = new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((t) => new THREE.Vector3(0, t * h, d * (1 - t * t))));
    const stave = mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6), mat('wood'));
    const string = mesh(cylr(0.004, 0.004, h * 2, 4), mat(0xefe7d2));
    put(stave, 0, 0, -0.02);
    put(string, 0, 0, -0.02);
    held.add(stave, string);
  } else if (kind === 'crossbow') {
    const stock = mesh(new THREE.BoxGeometry(0.06, 0.07, 0.62), mat('wood'));
    put(stock, 0, 0.03, 0.2);
    const prod = mesh(new THREE.TorusGeometry(0.26, 0.016, 6, 18, Math.PI * 0.75), mat('iron'));
    put(prod, 0, 0.06, 0.44, Math.PI / 2, 0, Math.PI * 0.625);
    const bolt = mesh(cylr(0.01, 0.01, 0.34, 5), mat('wood'));
    put(bolt, 0, 0.075, 0.33, Math.PI / 2);
    held.add(stock, prod, bolt);
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

const relax = (r: HumanoidRig) => {
  r.kneeL.rotation.x = r.kneeR.rotation.x = 0;
  r.elbowL.rotation.x = r.elbowR.rotation.x = -0.12;
  r.body.rotation.x = 0;
};

export function animateIdle(r: HumanoidRig, t: number) {
  const b = Math.sin(t * 1.8);
  relax(r);
  r.body.position.y = b * 0.008; // breathing
  r.armL.rotation.x = b * 0.04;
  r.armR.rotation.x = -b * 0.04;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
  r.head.rotation.y = Math.sin(t * 0.45) * 0.35; // looks about
}

/** Walk cycle: hips swing the thighs, knees bend on the forward swing and lift the foot, arms counter-swing. */
export function animateWalk(r: HumanoidRig, t: number, speed = 1) {
  const ph = t * 9 * speed, s = Math.sin(ph);
  r.legL.rotation.x = s * 0.55;
  r.legR.rotation.x = -s * 0.55;
  r.kneeL.rotation.x = Math.max(0, Math.cos(ph)) * 0.9; // bend while the leg passes forward
  r.kneeR.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9;
  r.armL.rotation.x = -s * 0.45;
  r.armR.rotation.x = s * 0.45;
  r.elbowL.rotation.x = -0.25 - Math.max(0, -s) * 0.35;
  r.elbowR.rotation.x = -0.25 - Math.max(0, s) * 0.35;
  r.body.position.y = Math.abs(Math.cos(ph)) * 0.05;
  r.body.rotation.x = 0.04;
  r.head.rotation.y = 0;
}

/** 0..1 swing progress: wind back then slash across. */
export function animateSwing(r: HumanoidRig, k: number) {
  const a = k < 0.3 ? -k / 0.3 : -1 + (k - 0.3) / 0.7 * 2.4;
  r.armR.rotation.x = a * 1.3;
  r.armR.rotation.z = 0.08 + (k < 0.3 ? 0 : Math.sin((k - 0.3) / 0.7 * Math.PI) * 0.5);
  r.elbowR.rotation.x = k < 0.3 ? -1.0 * (k / 0.3) : -1.0 + (k - 0.3) / 0.7; // cock the arm, then extend through the cut
  r.body.rotation.y = Math.sin(k * Math.PI) * -0.35;
  r.kneeL.rotation.x = r.kneeR.rotation.x = 0.15; // braced
}

/** Repeating work motion for chopping / mining / hammering. */
export function animateWork(r: HumanoidRig, t: number) {
  const s = (Math.sin(t * 5.2) + 1) / 2;
  relax(r);
  r.armR.rotation.x = -2.2 + s * 2.0;
  r.armL.rotation.x = -1.6 + s * 1.6;
  r.elbowR.rotation.x = -0.6 * (1 - s);
  r.elbowL.rotation.x = -0.6 * (1 - s);
  r.body.rotation.x = s * 0.15;
  r.kneeL.rotation.x = r.kneeR.rotation.x = 0.1 + s * 0.12;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
}

export function animateFish(r: HumanoidRig, t: number) {
  relax(r);
  r.armR.rotation.x = -1.1 + Math.sin(t * 1.3) * 0.08;
  r.armL.rotation.x = -0.9;
  r.elbowR.rotation.x = -0.35;
  r.elbowL.rotation.x = -0.5;
  r.legL.rotation.x = 0;
  r.legR.rotation.x = 0;
}

// ---- painted faces ------------------------------------------------------------------------
// The head is a UV sphere, so its texture is an equirectangular map: the face is centred at u = 0.25
// (the sphere's front), 1 px = 0.7 degrees both ways. Features are placed where the sculpted head puts
// the eyes, nose and mouth. Cached per look so a crowd of brigands shares one texture.
const faceCache = new Map<string, THREE.CanvasTexture>();
const hex = (v: PalKey | number) => `#${new THREE.Color(typeof v === 'number' ? v : PAL[v]).getHexString()}`;

function faceTexture(look: HumanoidLook): THREE.CanvasTexture {
  const female = look.beard === false;
  const iris = look.eyes ?? [0x4a3020, 0x3a6a9a, 0x4a6a3a, 0x5a4030][Math.abs(Math.round(new THREE.Color(typeof look.hair === 'number' ? look.hair : PAL[look.hair]).getHSL({ h: 0, s: 0, l: 0 }).l * 97)) % 4];
  const key = `${hex(look.skin)}|${hex(look.hair)}|${iris}|${female}|${look.beard !== false}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256, cx = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  // canvas wants display (sRGB) values; THREE.Color holds linear ones, so convert before writing
  const skin = new THREE.Color(hex(look.skin)), rgb = { r: 0, g: 0, b: 0 };
  const shade = (k: number, a = 1) => { skin.clone().multiplyScalar(k).getRGB(rgb, THREE.SRGBColorSpace); return `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},${a})`; };
  // skin, a little warmer in the cheeks and darker under the jaw
  c.fillStyle = shade(1); c.fillRect(0, 0, W, H);
  const jaw = c.createLinearGradient(0, 150, 0, 230); jaw.addColorStop(0, shade(1, 0)); jaw.addColorStop(1, shade(0.78, 0.7));
  c.fillStyle = jaw; c.fillRect(0, 150, W, 80);
  for (const s of [-1, 1]) {
    const g = c.createRadialGradient(cx + s * 34, 140, 2, cx + s * 34, 140, 22);
    g.addColorStop(0, female ? 'rgba(210,90,90,0.35)' : 'rgba(190,90,70,0.22)'); g.addColorStop(1, 'rgba(190,90,70,0)');
    c.fillStyle = g; c.fillRect(cx + s * 34 - 24, 116, 48, 48);
  }
  // hair over the back and sides of the head (the hair cap covers the crown)
  c.fillStyle = hex(look.hair);
  c.beginPath(); c.moveTo(200, 0); c.lineTo(200, 120); c.quadraticCurveTo(210, 178, 250, 176); c.lineTo(518, 176); c.lineTo(518, 0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(56, 0); c.lineTo(56, 120); c.quadraticCurveTo(46, 178, 6, 176); c.lineTo(-6, 176); c.lineTo(-6, 0); c.closePath(); c.fill();
  c.fillRect(0, 0, W, 64); // hairline above the brow
  // eyes: socket shadow, white, iris, pupil, catch-light, upper lid
  for (const s of [-1, 1]) {
    const ex = cx + s * 28, ey = 110;
    const sock = c.createRadialGradient(ex, ey - 2, 4, ex, ey - 2, 18);
    sock.addColorStop(0, shade(0.82, 0.6)); sock.addColorStop(1, shade(0.82, 0));
    c.fillStyle = sock; c.fillRect(ex - 20, ey - 20, 40, 40);
    c.fillStyle = '#f4efe6'; c.beginPath(); c.ellipse(ex, ey, 10.5, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hex(iris); c.beginPath(); c.arc(ex + s * -1, ey + 0.5, 5.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#100c0a'; c.beginPath(); c.arc(ex + s * -1, ey + 0.5, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(ex + s * -1 - 1.8, ey - 1.6, 1.3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a1a12'; c.lineWidth = female ? 3 : 2.4; c.beginPath(); c.ellipse(ex, ey + 1, 11, 7.5, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    // brow
    c.strokeStyle = hex(look.hair); c.lineWidth = female ? 3 : 4.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ex - s * 11, 99); c.quadraticCurveTo(ex, 93, ex + s * 12, 97); c.stroke();
  }
  // nose: a soft shadow down one side and under the tip (the 3D nose catches the light)
  c.fillStyle = shade(0.8, 0.5); c.beginPath(); c.ellipse(cx + 5, 128, 3, 12, 0.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(0.62, 0.7); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 5, 140, 2.6, 1.6, 0, 0, Math.PI * 2); c.fill(); }
  // mouth: lip line, a fuller lower lip, a hint of a smile
  c.fillStyle = female ? '#b0484a' : shade(0.72); c.beginPath(); c.ellipse(cx, 159, 13, female ? 4.2 : 3.2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3a1a14'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 14, 156); c.quadraticCurveTo(cx, 160, cx + 14, 156); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(cx, 162, 6, 1.4, 0, 0, Math.PI * 2); c.fill();
  if (look.beard !== false) {
    // moustache and a stubble shadow; the 3D beard covers the jaw
    c.fillStyle = hex(look.hair);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, 149); c.quadraticCurveTo(cx + s * 12, 145, cx + s * 20, 158); c.quadraticCurveTo(cx + s * 10, 153, cx, 154); c.closePath(); c.fill(); }
    // stubble: a soft shadow along the jaw in the hair colour, not dots
    const hc = new THREE.Color(hex(look.hair)); hc.getRGB(rgb, THREE.SRGBColorSpace);
    const sg = c.createRadialGradient(cx, 150, 18, cx, 150, 52);
    sg.addColorStop(0, `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},0)`);
    sg.addColorStop(0.5, `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},0.22)`);
    sg.addColorStop(1, `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},0)`);
    c.fillStyle = sg; c.fillRect(cx - 56, 128, 112, 80);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

/** A second weapon in the left hand (a brace of pistols), mirroring the right hand's grip. */
export function addOffhand(rig: HumanoidRig, kind: HeldKind) {
  const g = new THREE.Group();
  g.position.copy(rig.held.position);
  g.scale.copy(rig.held.scale);
  rig.elbowL.add(g);
  buildHeld(g, rig.body, kind);
  return g;
}
