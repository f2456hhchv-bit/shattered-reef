import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// Reef crab: ~1.3m across. Barnacled shell, one oversized crusher claw. Faces +z.

export interface CrabRig {
  root: THREE.Group;
  body: THREE.Group;
  clawL: THREE.Group;
  clawR: THREE.Group;
  pincerL: THREE.Object3D;
  pincerR: THREE.Object3D;
  legs: THREE.Group[];
}

function buildClaw(scale: number, seed: number): { group: THREE.Group; pincer: THREE.Object3D } {
  const g = new THREE.Group();
  const arm = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 5), mat('crabShell'));
  arm.rotation.x = Math.PI / 2;
  arm.position.z = 0.2;
  const palm = mesh(jitter(new THREE.IcosahedronGeometry(0.16, 1), 0.03, seed), mat('crabShell'));
  palm.scale.set(0.9, 0.7, 1.3);
  palm.position.z = 0.48;
  const fixed = mesh(jitter(new THREE.ConeGeometry(0.07, 0.32, 4), 0.02, seed + 1), mat('crabDark'));
  fixed.rotation.x = Math.PI / 2;
  fixed.position.set(0.04, -0.02, 0.72);
  const pincerPivot = new THREE.Group();
  pincerPivot.position.set(-0.04, 0.03, 0.6);
  const pincer = mesh(jitter(new THREE.ConeGeometry(0.06, 0.3, 4), 0.02, seed + 2), mat('crabDark'));
  pincer.rotation.x = Math.PI / 2;
  pincer.position.z = 0.12;
  pincerPivot.add(pincer);
  g.add(arm, palm, fixed, pincerPivot);
  g.scale.setScalar(scale);
  return { group: g, pincer: pincerPivot };
}

export function buildCrab(seed = 7): CrabRig {
  const rnd = mulberry32(seed);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.42;
  root.add(body);

  const shell = mesh(jitter(new THREE.IcosahedronGeometry(0.5, 1), 0.07, seed), mat('crabShell'));
  shell.scale.set(1.25, 0.5, 0.95);
  const belly = mesh(jitter(new THREE.IcosahedronGeometry(0.45, 1), 0.05, seed + 1), mat('crabBelly'));
  belly.scale.set(1.15, 0.32, 0.85);
  belly.position.y = -0.1;
  const ridge = mesh(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.05, seed + 2), mat('crabDark'));
  ridge.scale.set(1.4, 0.45, 0.9);
  ridge.position.set(0, 0.17, -0.05);
  body.add(shell, belly, ridge);

  for (let i = 0; i < 9; i++) {
    const b = mesh(jitter(new THREE.DodecahedronGeometry(0.045 + rnd() * 0.04, 0), 0.02, seed + 20 + i), mat('barnacle'));
    const a = rnd() * Math.PI * 2, r = 0.15 + rnd() * 0.35;
    b.position.set(Math.cos(a) * r * 1.2, 0.2 + rnd() * 0.04 - r * 0.15, Math.sin(a) * r * 0.8 - 0.08);
    b.scale.y = 0.7;
    body.add(b);
  }

  // eyes on stalks
  for (const s of [-1, 1]) {
    const stalk = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 5), mat('crabDark'));
    stalk.position.set(0.13 * s, 0.22, 0.38);
    stalk.rotation.x = 0.4;
    const eye = mesh(new THREE.IcosahedronGeometry(0.05, 0), mat('eye'));
    eye.position.set(0.13 * s, 0.32, 0.43);
    body.add(stalk, eye);
  }

  // claws: right is the crusher
  const L = buildClaw(0.85, seed + 40);
  L.group.position.set(-0.45, 0.0, 0.3);
  L.group.rotation.y = -0.5;
  const R = buildClaw(1.35, seed + 50);
  R.group.position.set(0.48, 0.02, 0.28);
  R.group.rotation.y = 0.45;
  body.add(L.group, R.group);

  // legs: 4 per side, two segments each
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Group();
      const z = 0.18 - i * 0.17;
      leg.position.set(0.48 * s, -0.04, z);
      leg.rotation.y = s * (0.25 - i * 0.25) + (s < 0 ? Math.PI : 0);
      const upper = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 5), mat('crabShell'));
      upper.rotation.z = -1.0;
      upper.position.set(0.18, 0.1, 0);
      const lower = mesh(new THREE.ConeGeometry(0.04, 0.5, 5), mat('crabDark'));
      lower.rotation.z = Math.PI + 0.45;
      lower.position.set(0.44, -0.12, 0);
      leg.add(upper, lower);
      body.add(leg);
      legs.push(leg);
    }
  }

  return { root, body, clawL: L.group, clawR: R.group, pincerL: L.pincer, pincerR: R.pincer, legs };
}

export function animateCrab(r: CrabRig, t: number, moving: boolean) {
  r.legs.forEach((leg, i) => {
    const phase = i * 1.7;
    leg.rotation.x = moving ? Math.sin(t * 14 + phase) * 0.25 : Math.sin(t * 2 + phase) * 0.03;
  });
  r.body.position.y = 0.42 + (moving ? Math.abs(Math.sin(t * 14)) * 0.03 : 0);
  const snap = Math.max(0, Math.sin(t * 2.3)) ** 6;
  r.pincerR.rotation.y = -snap * 0.5;
  r.pincerL.rotation.y = -(Math.max(0, Math.sin(t * 3.1 + 1)) ** 6) * 0.4;
  r.clawR.rotation.x = -0.1 - snap * 0.2;
}
