import * as THREE from 'three';
import { mat, mesh, jitter, type PalKey } from '../materials';

// Jointed humanoid, ~1.8m. Faces +z. Rigid parts on pivots, animated in code (no skinning).

export interface HumanoidLook {
  skin: PalKey;
  coat: PalKey;
  coatTrim: PalKey;
  shirt: PalKey;
  trousers: PalKey;
  boots: PalKey;
  hat: PalKey;
  hair: PalKey;
}

export interface HumanoidRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);

export function buildHumanoid(look: HumanoidLook): HumanoidRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // legs
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

  // torso: long coat with flared skirt
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

  // cutlass on hip
  const scabbard = mesh(new THREE.BoxGeometry(0.05, 0.7, 0.09), mat('leather'));
  scabbard.position.set(-0.3, 0.72, 0.05);
  scabbard.rotation.set(0.35, 0, 0.15);
  const hilt = mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), mat('brass'));
  hilt.position.set(-0.27, 1.06, 0.17);
  hilt.rotation.z = 0.15;
  body.add(scabbard, hilt);

  // head
  const head = new THREE.Group();
  head.position.y = 1.6;
  const neck = mesh(cyl(0.06, 0.07, 0.1), mat(look.skin));
  neck.position.y = 0.02;
  const skull = mesh(jitter(new THREE.IcosahedronGeometry(0.15, 1), 0.02, 8), mat(look.skin));
  skull.scale.set(0.95, 1.08, 1);
  skull.position.y = 0.17;
  const nose = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), mat(look.skin));
  nose.position.set(0, 0.15, 0.15);
  const beard = mesh(jitter(new THREE.BoxGeometry(0.2, 0.12, 0.1), 0.02, 9), mat(look.hair));
  beard.position.set(0, 0.06, 0.1);
  const eyeL = mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), mat('eye'), false);
  eyeL.position.set(-0.055, 0.2, 0.14);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.055;
  const hair = mesh(jitter(new THREE.BoxGeometry(0.3, 0.14, 0.24), 0.03, 10), mat(look.hair));
  hair.position.set(0, 0.2, -0.06);
  // tricorn: a three-sided brim is literally a 3-segment cylinder
  const brim = mesh(jitter(cyl(0.34, 0.32, 0.06, 3), 0.02, 11), mat(look.hat));
  brim.position.y = 0.3;
  brim.rotation.y = Math.PI; // one point forward
  const crown = mesh(jitter(cyl(0.14, 0.17, 0.16, 7), 0.015, 12), mat(look.hat));
  crown.position.y = 0.39;
  const band = mesh(cyl(0.172, 0.172, 0.04, 7), mat(look.coatTrim));
  band.position.y = 0.34;
  head.add(neck, skull, nose, beard, eyeL, eyeR, hair, brim, crown, band);
  body.add(head);

  // arms
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

  return { root, body, head, armL, armR, legL, legR };
}

export function animateIdle(r: HumanoidRig, t: number) {
  const b = Math.sin(t * 1.8);
  r.body.position.y = b * 0.008;
  r.armL.rotation.x = Math.sin(t * 1.8) * 0.04;
  r.armR.rotation.x = -Math.sin(t * 1.8) * 0.04;
  r.head.rotation.y = Math.sin(t * 0.45) * 0.35;
}

export function animateWalk(r: HumanoidRig, t: number, speed = 1) {
  const s = Math.sin(t * 8 * speed);
  r.legL.rotation.x = s * 0.55;
  r.legR.rotation.x = -s * 0.55;
  r.armL.rotation.x = -s * 0.45;
  r.armR.rotation.x = s * 0.45;
  r.body.position.y = Math.abs(Math.cos(t * 8 * speed)) * 0.05;
}
