import * as THREE from 'three';
import { PAL, type PalKey } from '../materials';
import type { HeldKind, HumanoidLook, HumanoidRig } from './character';

// "Vinyl toy" characters: a big rounded-box head (about 40% of their height), glossy black eyes, a short
// barrel body, stubby limbs, mitten hands and big boots, all in smooth soft-sheen vinyl. Same rig as the
// realistic humanoid (and the same ~1.8 m height), so every animation, hit box and label still fits.

const col = (v: PalKey | number) => new THREE.Color(typeof v === 'number' ? v : PAL[v]);
const vinylCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** Soft vinyl: smooth, a little clear-coat sheen, no texture noise. */
function vinyl(v: PalKey | number, gloss = 0.35): THREE.MeshPhysicalMaterial {
  const c = col(v), key = `${c.getHex()}|${gloss}`;
  let m = vinylCache.get(key);
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.48, metalness: 0, clearcoat: gloss, clearcoatRoughness: 0.35 }); vinylCache.set(key, m); }
  return m;
}
const EYE = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff });

const mk = (geo: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const sph = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 14);
const lathe = (pts: [number, number][], seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** A sphere pushed toward a rounded box (superellipsoid), the classic toy-head shape. */
function roundedBox(w: number, h: number, d: number, p = 2.8, seg = 40): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const a = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const k = Math.pow(Math.abs(x) ** p + Math.abs(y) ** p + Math.abs(z) ** p, -1 / p);
    a.setXYZ(i, x * k * w, y * k * h, z * k * d);
  }
  g.computeVertexNormals();
  return g;
}

/** Tricorn brim pinned up on three sides (corners front and back-sides). */
function tricornBrim(r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, 0.05, 48, 1, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rr = Math.hypot(x, z);
    if (rr < 1e-4) continue;
    const th = Math.atan2(x, z), corner = Math.cos(3 * th);
    const k = (0.86 + 0.16 * corner) * (rr / r), up = (1 - corner) * 0.5 * 0.22 * (rr / r) ** 2;
    pos.setXYZ(i, Math.sin(th) * r * k, y + up, Math.cos(th) * r * k);
  }
  g.computeVertexNormals();
  return g;
}

export function buildToy(look: HumanoidLook, buildHeld: (held: THREE.Group, body: THREE.Group, kind: HeldKind) => void): HumanoidRig {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const female = look.beard === false;

  // ---- legs: short, round, ending in big chunky boots
  const knees: THREE.Group[] = [];
  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.12 * side, 0.46, 0);
    leg.add(put(mk(cap(0.095, 0.1), vinyl(look.trousers)), 0, -0.08, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.17;
    knee.add(put(mk(cap(0.088, 0.06), vinyl(look.trousers)), 0, -0.05, 0));
    const boot = mk(sph(0.12), vinyl(look.boots, 0.5));
    boot.scale.set(0.95, 0.72, 1.35);
    knee.add(put(boot, 0, -0.2, 0.045));
    knee.add(put(mk(new THREE.TorusGeometry(0.095, 0.026, 8, 20), vinyl(look.boots, 0.5)), 0, -0.12, 0, Math.PI / 2));
    leg.add(knee);
    body.add(leg);
    knees.push(knee);
    return leg;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  const [kneeL, kneeR] = knees;

  // ---- torso: a short barrel coat with a flared hem, lapels, big buttons and a belt
  body.add(mk(lathe([[0, 0.92], [0.13, 0.91], [0.21, 0.86], [0.235, 0.74], [0.225, 0.58], [0.25, 0.42], [0.255, 0.36], [0, 0.36]]), vinyl(look.coat)));
  const shirt = mk(sph(0.1), vinyl(look.shirt));
  shirt.scale.set(0.75, 1.3, 0.35);
  body.add(put(shirt, 0, 0.78, 0.17));
  for (const s of [-1, 1]) {
    body.add(put(mk(cap(0.022, 0.2), vinyl(look.coatTrim)), 0.07 * s, 0.76, 0.19, -0.2, 0, -0.32 * s));
    for (let k = 0; k < 2; k++) body.add(put(mk(sph(0.022, 10, 8), vinyl('brass', 0.8)), 0.1 * s, 0.68 - k * 0.1, 0.205 - k * 0.006));
  }
  body.add(put(mk(new THREE.TorusGeometry(0.235, 0.035, 8, 28), vinyl('leather')), 0, 0.5, 0, Math.PI / 2));
  const buckle = mk(new THREE.BoxGeometry(0.09, 0.07, 0.03), vinyl('brass', 0.8));
  body.add(put(buckle, 0, 0.5, 0.24));
  if (look.apron !== undefined) {
    const apron = mk(sph(0.2, 18, 12), vinyl(look.apron));
    apron.scale.set(1.05, 1.45, 0.42);
    body.add(put(apron, 0, 0.55, 0.13));
  }

  // ---- head: rounded box, ears, nose, glossy black eyes with a catch-light, chunky brows
  const head = new THREE.Group();
  head.position.y = 0.88;
  head.userData.toy = { centre: 0.36, size: 0.78 };
  const skin = vinyl(look.skin, 0.25);
  const skull = mk(roundedBox(0.36, 0.34, 0.31), skin);
  skull.position.y = 0.36;
  head.add(skull);
  head.add(put(mk(cap(0.06, 0.04), skin), 0, 0.02, 0)); // neck stub
  for (const s of [-1, 1]) { const ear = mk(sph(0.06), skin); ear.scale.set(0.5, 0.95, 0.75); head.add(put(ear, 0.355 * s, 0.33, -0.02)); }
  const nose = mk(sph(0.035), skin);
  nose.scale.set(1.1, 0.8, 0.8);
  head.add(put(nose, 0, 0.29, 0.305));
  for (const s of [-1, 1]) {
    // small glossy eyes (Tom preferred these to big Funko eyes)
    const eye = mk(sph(0.075, 20, 16), EYE, false);
    eye.scale.set(0.82, 1.0, 0.42);
    head.add(put(eye, 0.135 * s, 0.33, 0.27));
    head.add(put(mk(sph(0.017, 10, 8), SHINE, false), 0.135 * s - 0.022, 0.365, 0.302));
    head.add(put(mk(sph(0.008, 8, 6), SHINE, false), 0.135 * s + 0.025, 0.3, 0.3));
    // brows: thick and readable; set a little stern for men, softer for women
    const brow = mk(cap(0.017, 0.08), vinyl(look.hair));
    head.add(put(brow, 0.135 * s, 0.45, 0.285, 0, 0, Math.PI / 2 + s * (female ? -0.12 : 0.18)));
    if (female) { const blush = mk(sph(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe88a7a, transparent: true, opacity: 0.45 }), false); blush.scale.set(1.2, 0.6, 0.2); head.add(put(blush, 0.2 * s, 0.24, 0.27)); }
  }
  const mouth = mk(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a1a14 }), false);
  head.add(put(mouth, 0, 0.215, 0.3, 0, 0, Math.PI));

  // hair: a chunky cap over the crown and back, plus a few big locks
  const hairM = vinyl(look.hair, 0.4);
  const hairCap = mk(roundedBox(0.375, 0.3, 0.335, 2.6, 32), hairM);
  // keep the crown and the back; flatten the front's lower half up to a hairline above the brows
  const hc = hairCap.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hc.count; i++) if (hc.getY(i) < 0 && hc.getZ(i) > -0.05) hc.setY(i, 0);
  hairCap.geometry.computeVertexNormals();
  const hatted = (look.hatStyle ?? 'tricorn') !== 'none';
  if (hatted) hairCap.scale.y = 0.55; // only the part under the brim shows
  head.add(put(hairCap, 0, 0.5, -0.02));
  const hs = look.hairStyle ?? (female ? 'bun' : 'queue');
  for (let k = 0; k < 6; k++) { // chunky fringe locks hanging over the brow, a little uneven
    const x = (k - 2.5) * 0.065, len = 0.11 + ((k * 37) % 5) * 0.012;
    const lock = mk(new THREE.ConeGeometry(0.045, len, 8), hairM);
    head.add(put(lock, x, 0.535, 0.3 - Math.abs(x) * 0.3, Math.PI - 0.35, 0, x * 1.4));
  }
  if (female) for (const sd of [-1, 1]) { // side locks framing the face
    const side = mk(cap(0.055, 0.2), hairM);
    head.add(put(side, 0.33 * sd, 0.36, 0.06, 0.1, 0, sd * 0.12));
  }
  if (hs === 'bun') head.add(put(mk(sph(0.11), hairM), 0, 0.78, -0.12));
  if (hs === 'queue') { head.add(put(mk(cap(0.05, 0.12), hairM), 0, 0.25, -0.33, 0.4)); head.add(put(mk(new THREE.TorusGeometry(0.05, 0.016, 6, 12), vinyl(look.coatTrim)), 0, 0.33, -0.31, Math.PI / 2 + 0.4)); }
  if (look.beard !== false && look.hatStyle === 'none') {
    // the smith: a big rounded beard under a bushy moustache
    const beard = mk(sph(0.2, 20, 14), hairM);
    beard.scale.set(1.2, 0.85, 0.75);
    head.add(put(beard, 0, 0.13, 0.18));
    for (const s of [-1, 1]) head.add(put(mk(cap(0.03, 0.07), hairM), 0.05 * s, 0.245, 0.31, 0, 0, Math.PI / 2 + s * 0.35));
  }
  if (look.spectacles) {
    for (const s of [-1, 1]) head.add(put(mk(new THREE.TorusGeometry(0.085, 0.011, 8, 24), vinyl('brass', 0.8), false), 0.135 * s, 0.33, 0.31));
    head.add(put(mk(cap(0.008, 0.05), vinyl('brass', 0.8), false), 0, 0.345, 0.315, 0, 0, Math.PI / 2));
  }
  const style = look.hatStyle ?? 'tricorn';
  if (style === 'tricorn') {
    head.add(put(mk(tricornBrim(0.5), vinyl(look.hat)), 0, 0.64, 0));
    head.add(mk(lathe([[0, 0.92], [0.16, 0.91], [0.27, 0.84], [0.3, 0.74], [0.31, 0.64], [0, 0.64]]), vinyl(look.hat)));
    head.add(put(mk(new THREE.TorusGeometry(0.305, 0.022, 8, 32), vinyl(look.coatTrim)), 0, 0.68, 0, Math.PI / 2));
  } else if (style === 'cap') {
    const crown = mk(roundedBox(0.39, 0.17, 0.36, 2.4, 28), vinyl(look.hat));
    head.add(put(crown, 0, 0.6, -0.01));
    const peak = mk(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), vinyl(look.hat));
    peak.scale.set(1.25, 1, 0.9);
    head.add(put(peak, 0, 0.58, 0.18, 0.15));
  } else if (style === 'bandana') {
    head.add(put(mk(roundedBox(0.385, 0.2, 0.34, 2.6, 28), vinyl(look.hat)), 0, 0.56, -0.01));
    head.add(put(mk(sph(0.06), vinyl(look.hat)), 0, 0.5, -0.34));
  }
  body.add(head);

  // ---- arms: short and round, mitten hands
  const held = new THREE.Group();
  const elbows: THREE.Group[] = [];
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.27 * side, 0.83, 0);
    arm.add(put(mk(sph(0.085), vinyl(look.coat)), 0, 0, 0));
    arm.add(put(mk(cap(0.07, 0.08), vinyl(look.coat)), 0, -0.08, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.16;
    elbow.add(put(mk(cap(0.064, 0.05), vinyl(look.coat)), 0, -0.04, 0));
    elbow.add(put(mk(new THREE.TorusGeometry(0.066, 0.02, 8, 16), vinyl(look.coatTrim)), 0, -0.09, 0, Math.PI / 2));
    const hand = mk(sph(0.075), skin);
    hand.scale.set(0.9, 1, 0.85);
    elbow.add(put(hand, 0, -0.16, 0.01));
    elbow.add(put(mk(cap(0.026, 0.03), skin), -0.05 * side, -0.14, 0.05, 0.4, 0, 0.6 * side));
    arm.add(elbow);
    arm.rotation.z = 0.14 * side;
    body.add(arm);
    elbows.push(elbow);
    return arm;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const [elbowL, elbowR] = elbows;
  held.position.set(0, -0.17, 0.04);
  held.scale.setScalar(0.85);
  elbowR.add(held);
  buildHeld(held, body, look.held ?? 'none');
  if ((look.held ?? 'none') === 'none') {
    // the hip scabbard is placed for the tall body: lift it onto the toy's hip
    for (const c of body.children.slice(-2)) { c.position.y -= 0.33; c.position.x *= 0.95; c.scale.setScalar(0.75); }
  }
  return { root, body, head, armL, armR, legL, legR, kneeL, kneeR, elbowL, elbowR, held };
}
