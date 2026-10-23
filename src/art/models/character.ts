import * as THREE from 'three';
import { mat, mesh, jitter, type PalKey } from '../materials';

// Jointed humanoid, ~1.8m. Faces +z. Rigid parts on pivots, animated in code (no skinning).

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

const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);

export function buildHumanoid(look: HumanoidLook): HumanoidRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.12 * side, 0.92, 0);
    const thigh = mesh(cyl(0.1, 0.085, 0.5), mat(look.trousers));
    thigh.position.y = -0.25;
    const shin = mesh(cyl(0.085, 0.075, 0.38), mat(look.trousers));
    shin.position.y = -0.64;
    const boot = mesh(jitter(new THREE.BoxGeometry(0.17, 0.2, 0.3), 0.02, side + 3), mat(look.boots));
    boot.position.set(0, -0.82, 0.04);
    const cuff = mesh(cyl(0.1, 0.1, 0.08), mat(look.boots));
    cuff.position.y = -0.7;
    leg.add(thigh, shin, boot, cuff);
    body.add(leg);
    return leg;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  const coat = mesh(jitter(cyl(0.21, 0.26, 0.62, 7), 0.015, 5), mat(look.coat));
  coat.position.y = 1.24;
  const skirt = mesh(cyl(0.27, 0.33, 0.42, 7), mat(look.coat));
  skirt.position.y = 0.76;
  const shirt = mesh(new THREE.BoxGeometry(0.16, 0.34, 0.05), mat(look.shirt));
  shirt.position.set(0, 1.34, 0.2);
  shirt.rotation.x = -0.12;
  const belt = mesh(cyl(0.255, 0.255, 0.08, 7), mat('leather'));
  belt.position.y = 0.98;
  const buckle = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), mat('brass'));
  buckle.position.set(0, 0.98, 0.26);
  const trimL = mesh(new THREE.BoxGeometry(0.04, 0.95, 0.03), mat(look.coatTrim));
  trimL.position.set(-0.11, 1.0, 0.25);
  trimL.rotation.x = -0.08;
  const trimR = trimL.clone();
  trimR.position.x = 0.11;
  const shoulders = mesh(jitter(new THREE.BoxGeometry(0.58, 0.14, 0.32), 0.02, 6), mat(look.coat));
  shoulders.position.y = 1.52;
  body.add(coat, skirt, shirt, belt, buckle, trimL, trimR, shoulders);
  if (look.apron !== undefined) {
    const apron = mesh(new THREE.BoxGeometry(0.4, 0.75, 0.04), mat(look.apron));
    apron.position.set(0, 0.85, 0.3);
    apron.rotation.x = -0.12;
    body.add(apron);
  }

  const head = new THREE.Group();
  head.position.y = 1.6;
  const neck = mesh(cyl(0.06, 0.07, 0.1), mat(look.skin));
  neck.position.y = 0.02;
  const skull = mesh(jitter(new THREE.IcosahedronGeometry(0.15, 1), 0.02, 8), mat(look.skin));
  skull.scale.set(0.95, 1.08, 1);
  skull.position.y = 0.17;
  const nose = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), mat(look.skin));
  nose.position.set(0, 0.15, 0.15);
  const eyeL = mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), mat('eye'), false);
  eyeL.position.set(-0.055, 0.2, 0.14);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.055;
  const hair = mesh(jitter(new THREE.BoxGeometry(0.3, 0.14, 0.24), 0.03, 10), mat(look.hair));
  hair.position.set(0, 0.2, -0.06);
  head.add(neck, skull, nose, eyeL, eyeR, hair);
  if (look.beard !== false) {
    const beard = mesh(jitter(new THREE.BoxGeometry(0.2, 0.12, 0.1), 0.02, 9), mat(look.hair));
    beard.position.set(0, 0.06, 0.1);
    head.add(beard);
  }
  if (look.spectacles) {
    const sp = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), mat('brass'), false);
    sp.position.set(0, 0.2, 0.155);
    head.add(sp);
  }
  const style = look.hatStyle ?? 'tricorn';
  if (style === 'tricorn') {
    const brim = mesh(jitter(cyl(0.34, 0.32, 0.06, 3), 0.02, 11), mat(look.hat));
    brim.position.y = 0.3;
    brim.rotation.y = Math.PI;
    const crown = mesh(jitter(cyl(0.14, 0.17, 0.16, 7), 0.015, 12), mat(look.hat));
    crown.position.y = 0.39;
    const band = mesh(cyl(0.172, 0.172, 0.04, 7), mat(look.coatTrim));
    band.position.y = 0.34;
    head.add(brim, crown, band);
  } else if (style === 'bandana') {
    const wrap = mesh(jitter(new THREE.IcosahedronGeometry(0.165, 1), 0.02, 14), mat(look.hat));
    wrap.scale.set(1, 0.62, 1.05);
    wrap.position.y = 0.26;
    const knot = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat(look.hat));
    knot.rotation.x = -1.9;
    knot.position.set(0, 0.24, -0.18);
    head.add(wrap, knot);
  } else if (style === 'cap') {
    const cap = mesh(jitter(cyl(0.15, 0.17, 0.12, 7), 0.01, 15), mat(look.hat));
    cap.position.y = 0.31;
    const peak = mesh(new THREE.BoxGeometry(0.24, 0.03, 0.14), mat(look.hat));
    peak.position.set(0, 0.27, 0.17);
    head.add(cap, peak);
  }
  body.add(head);

  const held = new THREE.Group();
  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.3 * side, 1.5, 0);
    const upper = mesh(cyl(0.08, 0.07, 0.36), mat(look.coat));
    upper.position.y = -0.18;
    const lower = mesh(cyl(0.07, 0.075, 0.3), mat(look.coat));
    lower.position.set(0, -0.48, 0.03);
    const cuff = mesh(cyl(0.085, 0.085, 0.07), mat(look.coatTrim));
    cuff.position.set(0, -0.62, 0.04);
    const hand = mesh(jitter(new THREE.IcosahedronGeometry(0.065, 0), 0.01, 13 + side), mat(look.skin));
    hand.position.set(0, -0.7, 0.05);
    arm.add(upper, lower, cuff, hand);
    arm.rotation.z = 0.08 * side;
    body.add(arm);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  held.position.set(0, -0.72, 0.06);
  armR.add(held);
  const kind = look.held ?? 'none';
  if (kind === 'cutlass') {
    const blade = mesh(new THREE.BoxGeometry(0.04, 0.75, 0.09), mat(0xc9ccc8));
    blade.position.set(0, -0.05, 0.42);
    blade.rotation.x = Math.PI / 2 - 0.25;
    const guard = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), mat('brass'));
    guard.position.set(0, 0, 0.06);
    held.add(blade, guard);
  } else if (kind === 'musket') {
    const barrel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), mat('iron'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.45);
    const stock = mesh(new THREE.BoxGeometry(0.07, 0.12, 0.45), mat('wood'));
    stock.position.set(0, -0.03, -0.05);
    held.add(barrel, stock);
  } else if (kind === 'pistol') {
    const barrel = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.45, 6), mat('iron'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.28);
    const grip = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), mat('wood'));
    grip.position.set(0, -0.05, 0.02);
    held.add(barrel, grip);
  } else if (kind === 'staff') {
    const pole = mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 5), mat('wood'));
    pole.position.set(0, 0.25, 0.08);
    const orb = mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0x59d0c4, { emissive: 0x59d0c4, emissiveIntensity: 1.2 }), false);
    orb.position.set(0, 1.05, 0.08);
    held.add(pole, orb);
  } else if (kind === 'hammer') {
    const haft = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 5), mat('wood'));
    haft.rotation.x = Math.PI / 2;
    haft.position.z = 0.15;
    const headM = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.18), mat('iron'));
    headM.position.z = 0.38;
    headM.rotation.y = Math.PI / 2;
    held.add(haft, headM);
  } else {
    // sheathed cutlass on the hip for the player look in the style test
    const scabbard = mesh(new THREE.BoxGeometry(0.05, 0.7, 0.09), mat('leather'));
    scabbard.position.set(-0.3, 0.72, 0.05);
    scabbard.rotation.set(0.35, 0, 0.15);
    const hilt = mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), mat('brass'));
    hilt.position.set(-0.27, 1.06, 0.17);
    hilt.rotation.z = 0.15;
    body.add(scabbard, hilt);
  }

  return { root, body, head, armL, armR, legL, legR, held };
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
