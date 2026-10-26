import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';

// Sea foes' bodies (docs/ISLANDS.md, sailing). The cutter is the player's sloop in the wreckers' colours (ship.ts);
// gulls are the winged body (fantasy.ts). The shark lives here: a body that can sink until only its fin shows.

export interface SharkRig { root: THREE.Group; body: THREE.Group; fin: THREE.Group; tail: THREE.Group }

export function buildShark(seed = 3, look: 'reef' | 'gnasher' = 'reef'): SharkRig {
  const skin = look === 'gnasher' ? 0x4e5a62 : 0x6a7a84, belly = 0xd8dcd8, scar = 0xb8a090;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(0.6, 1), 0.04, seed), mat(skin));
  torso.scale.set(0.7, 0.62, 2.1);
  const under = mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(belly));
  under.scale.set(0.62, 0.4, 1.8);
  under.position.y = -0.16;
  const snout = mesh(new THREE.ConeGeometry(0.34, 0.9, 7), mat(skin));
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 1.45;
  body.add(torso, under, snout);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x111111));
    eye.position.set(0.24 * s, 0.1, 1.15);
    const pec = mesh(new THREE.ConeGeometry(0.16, 0.7, 3), mat(skin));
    pec.scale.z = 0.25;
    pec.rotation.set(0, 0, s * 1.2);
    pec.position.set(0.5 * s, -0.18, 0.45);
    body.add(eye, pec);
  }
  if (look === 'gnasher') {
    // old scars and a jaw full of broken teeth
    for (let k = 0; k < 3; k++) { const sc = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.5), mat(scar)); sc.position.set(0.3, 0.3 - k * 0.08, 0.2 - k * 0.3); sc.rotation.y = 0.4; body.add(sc); }
    for (let k = 0; k < 6; k++) { const t = mesh(new THREE.ConeGeometry(0.03, 0.1, 3), mat(0xefe8d8)); t.position.set((k - 2.5) * 0.07, -0.12, 1.55); t.rotation.x = Math.PI; body.add(t); }
  }
  const fin = new THREE.Group();
  fin.position.set(0, 0.32, 0.1);
  const f = mesh(new THREE.ConeGeometry(0.34, 0.9, 3), mat(skin));
  f.scale.z = 0.25;
  f.rotation.x = -0.35;
  f.position.y = 0.4;
  fin.add(f);
  body.add(fin);
  const tail = new THREE.Group();
  tail.position.z = -1.25;
  for (const s of [-1, 1]) {
    const lobe = mesh(new THREE.ConeGeometry(0.2, 0.8, 3), mat(skin));
    lobe.scale.z = 0.25;
    lobe.rotation.x = s * 0.9 + Math.PI;
    lobe.position.set(0, s * 0.25, -0.25);
    tail.add(lobe);
  }
  body.add(tail);
  return { root, body, fin, tail };
}

/** Swimming: a tail beat; `under` sinks the body so only the fin cuts the surface. */
export function animateShark(r: SharkRig, t: number, under: boolean, charging: boolean) {
  r.tail.rotation.y = Math.sin(t * (charging ? 14 : 6)) * 0.5;
  r.body.rotation.y = Math.sin(t * (charging ? 14 : 6)) * 0.06;
  const target = under ? -0.95 : charging ? 0.05 : 0.12; // surfaced, its back breaks the water
  r.body.position.y += (target - r.body.position.y) * 0.15;
}
