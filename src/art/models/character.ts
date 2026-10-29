import * as THREE from 'three';
import { mat, mesh, type PalKey } from '../materials';
import { buildToy } from './toy';
import { buildLowPoly } from './lowpoly';
import { buildWoodenShield } from './playerEquipment';

// Jointed humanoid, ~1.8m. Faces +z. Rigid parts on pivots, animated in code (no skinning).
// Built from turned (lathe) profiles, capsules and spheres so every silhouette is rounded:
// tapered limbs, a shaped torso, a flared coat, a sculpted head and a real folded tricorn.

export type HeldKind = 'cutlass' | 'musket' | 'hammer' | 'pistol' | 'staff' | 'dagger' | 'pike' | 'greatsword' | 'bow' | 'longbow' | 'crossbow' | 'wand' | 'shield' | 'orb' | 'book' | 'none';

export interface HumanoidLook {
  skin: PalKey | number;
  coat: PalKey | number;
  coatTrim: PalKey | number;
  shirt: PalKey | number;
  trousers: PalKey | number;
  boots: PalKey | number;
  hat: PalKey | number;
  hair: PalKey | number;
  hatStyle?: 'tricorn' | 'bandana' | 'cap' | 'straw' | 'none';
  /** worn gloves: the hands take their colour */
  gloves?: PalKey | number;
  /** feet on backwards (Sunreach's douen) */
  feetBack?: boolean;
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
  head: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  kneeL: THREE.Object3D;
  kneeR: THREE.Object3D;
  elbowL: THREE.Object3D;
  elbowR: THREE.Object3D;
  held: THREE.Group;
  leftHand?: THREE.Object3D;
  offhand?: THREE.Group | null;
  setOffhand?(enabled: boolean): void;
}

/** Turned profile: [radius, y] pairs from top to bottom; closed at both ends when radius 0. */
const lathe = (pts: [number, number][], seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const cylr = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

export function buildHumanoid(look: HumanoidLook): HumanoidRig {
  return look.style === 'toy' ? buildToy(look, buildHeld) : buildLowPoly(look, buildHeld);
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
  } else if (kind === 'wand') {
    // a short tapered rod with a glowing tip
    const rod = mesh(cylr(0.012, 0.02, 0.38, 7), mat('woodLight'));
    put(rod, 0, 0, 0.13, Math.PI / 2);
    const tip = mesh(sphere(0.032, 10, 8), mat(0x59d0c4, { emissive: 0x59d0c4, emissiveIntensity: 1.4 }), false);
    put(tip, 0, 0, 0.33);
    const ferrule = mesh(cylr(0.024, 0.024, 0.03, 8), mat('brass'));
    put(ferrule, 0, 0, 0.3, Math.PI / 2);
    held.add(rod, tip, ferrule);
  } else if (kind === 'orb') {
    // held up in the palm, glowing
    const orb = mesh(sphere(0.075, 16, 12), mat(0x59d0c4, { emissive: 0x59d0c4, emissiveIntensity: 1.1 }), false);
    put(orb, 0, 0.04, 0.08);
    held.add(orb);
  } else if (kind === 'book') {
    const cover = mesh(new THREE.BoxGeometry(0.05, 0.24, 0.18), mat('leather'));
    put(cover, 0, 0.02, 0.07);
    const pages = mesh(new THREE.BoxGeometry(0.042, 0.22, 0.17), mat(0xefe7d2));
    put(pages, 0.006, 0.02, 0.072);
    const clasp = mesh(new THREE.BoxGeometry(0.056, 0.03, 0.03), mat('brass'));
    put(clasp, 0, 0.02, 0.16);
    held.add(cover, pages, clasp);
  } else if (kind === 'shield') {
    // a round shield on the forearm, its face turned forward and a little outward so the camera sees it
    const sh = put(new THREE.Group(), -0.05, 0.14, 0.05, 0, -0.55, 0);
    sh.add(put(mesh(cylr(0.26, 0.26, 0.04, 16), mat('iron')), 0, 0, 0, Math.PI / 2));
    sh.add(mesh(new THREE.TorusGeometry(0.26, 0.018, 6, 20), mat('brass')));
    sh.add(put(mesh(sphere(0.06, 10, 8), mat('brass')), 0, 0, 0.03));
    held.add(sh);
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

/** Whatever is in the left hand: a second weapon, a shield, an orb or a book, mirroring the right hand's grip. */
export function addOffhand(rig: HumanoidRig, kind: HeldKind) {
  if (kind === 'shield' && rig.setOffhand && rig.offhand !== undefined) {
    rig.setOffhand(true);
    return rig.offhand!;
  }
  const g = new THREE.Group();
  g.position.copy(rig.held.position);
  g.scale.copy(rig.held.scale);
  (rig.leftHand ?? rig.elbowL).add(g);
  if (rig.leftHand && kind === 'shield') g.add(buildWoodenShield());
  else buildHeld(g, rig.body, kind);
  return g;
}
