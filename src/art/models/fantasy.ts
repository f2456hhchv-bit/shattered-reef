import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// The islands' stranger folk (Tom, 2026-10-25: "not all just humans, think fantasy"): wisps, golems, hounds, bats
// and wraiths. Five bodies, each with looks; every moving part is its own pivot so bakeRig keeps it animatable.
// Faces +z. One rig shape for all five keeps the renderer to a single case.

export type FantasyModel = 'wisp' | 'golem' | 'hound' | 'bat' | 'wraith';
export interface FantasyRig { model: FantasyModel; root: THREE.Group; body: THREE.Group; a: THREE.Group[]; b: THREE.Group[] }

const glow = (c: number, k = 1) => mat(c, { emissive: c, emissiveIntensity: k });

// ---- wisps: a glowing core with motes circling it; they drift a man's height off the ground
const WISP: Record<string, { core: number; halo: number }> = {
  bog: { core: 0xb8f07a, halo: 0x4f8a3a },
  storm: { core: 0xbfe6ff, halo: 0x3a6a9a },
};
function wisp(look: string, seed: number): FantasyRig {
  const L = WISP[look] ?? WISP.bog;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1.3;
  root.add(body);
  const core = mesh(jitter(new THREE.IcosahedronGeometry(0.28, 1), 0.04, seed), glow(L.core, 1.4));
  const halo = mesh(new THREE.IcosahedronGeometry(0.42, 1), glow(L.halo, 0.5));
  halo.scale.set(1, 1.25, 1);
  // a trailing tail that tapers to nothing below it
  const tail = mesh(new THREE.ConeGeometry(0.22, 0.8, 6), glow(L.halo, 0.6));
  tail.rotation.x = Math.PI;
  tail.position.y = -0.55;
  body.add(core, halo, tail);
  const motes: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group();
    const m = mesh(new THREE.IcosahedronGeometry(0.07, 0), glow(L.core, 1.2));
    m.position.x = 0.62;
    g.add(m);
    g.rotation.y = (k / 4) * Math.PI * 2;
    body.add(g);
    motes.push(g);
  }
  return { model: 'wisp', root, body, a: motes, b: [] };
}

// ---- golems: a lumbering body of whatever the island is made of, with glowing eyes
const GOLEM: Record<string, { body: number; dark: number; accent: number; eye: number; spikes?: boolean; leaves?: boolean }> = {
  drift: { body: 0x8a6a4a, dark: 0x5a4430, accent: 0x6a8a4a, eye: 0xb8f07a }, // driftwood lashed with weed
  amber: { body: 0x7a6a58, dark: 0x4e4438, accent: 0xe8a83a, eye: 0xffc04a, spikes: true }, // rock grown with amber
  oak: { body: 0x4a3a2a, dark: 0x2e241a, accent: 0x3e6a2a, eye: 0xd8f070, leaves: true }, // the Old Wood's heart
};
function golem(look: string, seed: number): FantasyRig {
  const L = GOLEM[look] ?? GOLEM.drift;
  const rnd = mulberry32(seed);
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1.0;
  root.add(body);
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(0.5, 1), 0.08, seed), mat(L.body));
  torso.scale.set(1.15, 1.05, 0.85);
  torso.position.y = 0.35;
  const hips = mesh(jitter(new THREE.IcosahedronGeometry(0.34, 0), 0.05, seed + 1), mat(L.dark));
  hips.scale.set(1.2, 0.7, 0.9);
  const head = mesh(jitter(new THREE.IcosahedronGeometry(0.24, 0), 0.04, seed + 2), mat(L.dark));
  head.position.set(0, 0.9, 0.12);
  body.add(torso, hips, head);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.05, 0), glow(L.eye, 1.3));
    eye.position.set(0.09 * s, 0.93, 0.32);
    body.add(eye);
  }
  // amber crystals jutting from the shoulders; weed or leaves trailing off the back
  for (let k = 0; k < 6; k++) {
    const a = rnd() * Math.PI * 2;
    const p = L.spikes ? mesh(new THREE.ConeGeometry(0.09, 0.4, 5), glow(L.accent, 0.5)) : mesh(new THREE.IcosahedronGeometry(L.leaves ? 0.16 : 0.1, 0), mat(L.accent));
    p.position.set(Math.cos(a) * 0.42, 0.55 + rnd() * 0.3, Math.sin(a) * 0.3 - 0.1);
    p.rotation.set(rnd() - 0.5, 0, Math.cos(a) * -0.8);
    body.add(p);
  }
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.62 * s, 0.6, 0);
    const up = mesh(jitter(new THREE.CylinderGeometry(0.15, 0.13, 0.55, 6), 0.03, seed + 4), mat(L.body));
    up.position.y = -0.28;
    const fist = mesh(jitter(new THREE.IcosahedronGeometry(0.2, 0), 0.04, seed + 5), mat(L.dark));
    fist.position.y = -0.66;
    arm.add(up, fist);
    body.add(arm);
    arms.push(arm);
  }
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.24 * s, -0.15, 0);
    const l = mesh(jitter(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 6), 0.03, seed + 6), mat(L.dark));
    l.position.y = -0.38;
    leg.add(l);
    body.add(leg);
    legs.push(leg);
  }
  return { model: 'golem', root, body, a: arms, b: legs };
}

// ---- hounds: lean four-legged hunters
const HOUND: Record<string, { coat: number; dark: number; eye: number; spots?: number }> = {
  stalker: { coat: 0x8a6a2a, dark: 0x3a2a18, eye: 0xf2d04a, spots: 0x2a1e12 }, // the Greenheart's spotted cat-dog
  moon: { coat: 0x9a9aa8, dark: 0x4e4e5c, eye: 0x9ad8ff }, // the amberwood's pale hounds
};
function hound(look: string, seed: number): FantasyRig {
  const L = HOUND[look] ?? HOUND.moon;
  const rnd = mulberry32(seed);
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.66;
  root.add(body);
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(0.4, 1), 0.04, seed), mat(L.coat));
  torso.scale.set(0.7, 0.72, 1.6);
  const chest = mesh(jitter(new THREE.IcosahedronGeometry(0.34, 1), 0.03, seed + 1), mat(L.coat));
  chest.position.set(0, 0.06, 0.4);
  body.add(torso, chest);
  if (L.spots) for (let k = 0; k < 7; k++) {
    const sp = mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(L.spots));
    sp.position.set((rnd() - 0.5) * 0.4, 0.22 + rnd() * 0.06, (rnd() - 0.5) * 1.0);
    sp.scale.y = 0.4;
    body.add(sp);
  }
  // a mane ridge of dark fur along the spine
  for (let i = 0; i < 5; i++) {
    const b = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat(L.dark));
    b.position.set(0, 0.32 - i * 0.02, 0.45 - i * 0.2);
    b.rotation.x = -0.6;
    body.add(b);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.24, 0.72);
  const skull = mesh(jitter(new THREE.IcosahedronGeometry(0.22, 1), 0.02, seed + 2), mat(L.coat));
  skull.scale.set(0.9, 0.85, 1.1);
  const muzzle = mesh(new THREE.ConeGeometry(0.12, 0.34, 6), mat(L.dark));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.05, 0.26);
  head.add(skull, muzzle);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.07, 0.22, 4), mat(L.dark));
    ear.position.set(0.12 * s, 0.22, -0.04);
    ear.rotation.z = -s * 0.25;
    const eye = mesh(new THREE.IcosahedronGeometry(0.035, 0), glow(L.eye, 0.9));
    eye.position.set(0.1 * s, 0.06, 0.16);
    head.add(ear, eye);
  }
  body.add(head);
  const tail = mesh(new THREE.ConeGeometry(0.06, 0.6, 5), mat(L.dark));
  tail.position.set(0, 0.12, -0.82);
  tail.rotation.x = -2.2;
  body.add(tail);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.18, 0.48], [0.18, 0.48], [-0.18, -0.45], [0.18, -0.45]]) {
    const leg = new THREE.Group();
    leg.position.set(x, -0.12, z);
    const l = mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.5, 5), mat(L.coat));
    l.position.y = -0.25;
    const paw = mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(L.dark));
    paw.position.set(0, -0.5, 0.03);
    leg.add(l, paw);
    body.add(leg);
    legs.push(leg);
  }
  return { model: 'hound', root, body, a: [head], b: legs };
}

// ---- bats: leathery wings, flitting above head height
const BAT: Record<string, { fur: number; wing: number; eye: number }> = {
  cave: { fur: 0x3a2e2a, wing: 0x5a443a, eye: 0xe8402a },
  ember: { fur: 0x2a1a14, wing: 0x9a3a1a, eye: 0xffb040 },
};
function bat(look: string, seed: number): FantasyRig {
  const L = BAT[look] ?? BAT.cave;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1.5;
  root.add(body);
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(0.22, 1), 0.03, seed), mat(L.fur));
  torso.scale.set(0.9, 0.9, 1.3);
  const head = mesh(jitter(new THREE.IcosahedronGeometry(0.15, 0), 0.02, seed + 1), mat(L.fur));
  head.position.set(0, 0.06, 0.28);
  body.add(torso, head);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.06, 0.2, 3), mat(L.wing));
    ear.position.set(0.08 * s, 0.22, 0.26);
    const eye = mesh(new THREE.IcosahedronGeometry(0.03, 0), glow(L.eye, 1));
    eye.position.set(0.06 * s, 0.09, 0.42);
    body.add(ear, eye);
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(0.16 * s, 0.04, 0);
    // a wing is three fingers of membrane fanned out from the shoulder
    for (let k = 0; k < 3; k++) {
      const m = mesh(new THREE.ConeGeometry(0.22 - k * 0.04, 0.8 - k * 0.15, 3), mat(L.wing, { side: THREE.DoubleSide }));
      m.scale.z = 0.12;
      m.rotation.z = s * (Math.PI / 2 + (k - 1) * 0.35);
      m.position.set(s * (0.36 - k * 0.04), 0, -k * 0.08);
      w.add(m);
    }
    body.add(w);
    wings.push(w);
  }
  return { model: 'bat', root, body, a: wings, b: [] };
}

// ---- wraiths: a hooded cloak with nothing in it but two eyes, hands of mist
const WRAITH: Record<string, { cloak: number; trim: number; eye: number }> = {
  brine: { cloak: 0x24403e, trim: 0x5ab8a8, eye: 0x8affe8 },
};
function wraith(look: string, seed: number): FantasyRig {
  const L = WRAITH[look] ?? WRAITH.brine;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.3;
  root.add(body);
  const robe = mesh(jitter(new THREE.ConeGeometry(0.5, 1.6, 7, 2, true), 0.05, seed), mat(L.cloak, { side: THREE.DoubleSide }));
  robe.position.y = 0.8;
  const hem = mesh(new THREE.TorusGeometry(0.44, 0.05, 4, 10), glow(L.trim, 0.5));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.06;
  const hood = mesh(jitter(new THREE.IcosahedronGeometry(0.3, 1), 0.03, seed + 1), mat(L.cloak));
  hood.scale.set(1, 1.15, 1.05);
  hood.position.set(0, 1.62, -0.02);
  const face = mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0x0a0e10));
  face.position.set(0, 1.58, 0.1);
  body.add(robe, hem, hood, face);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.045, 0), glow(L.eye, 1.6));
    eye.position.set(0.08 * s, 1.62, 0.28);
    body.add(eye);
  }
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.36 * s, 1.3, 0.05);
    const sleeve = mesh(new THREE.ConeGeometry(0.13, 0.7, 6, 1, true), mat(L.cloak, { side: THREE.DoubleSide }));
    sleeve.position.y = -0.3;
    sleeve.rotation.x = Math.PI;
    const hand = mesh(new THREE.IcosahedronGeometry(0.09, 0), glow(L.trim, 0.9));
    hand.position.y = -0.7;
    arm.add(sleeve, hand);
    body.add(arm);
    arms.push(arm);
  }
  return { model: 'wraith', root, body, a: arms, b: [] };
}

export function buildFantasy(model: FantasyModel, look = '', seed = 7): FantasyRig {
  switch (model) {
    case 'wisp': return wisp(look, seed);
    case 'golem': return golem(look, seed);
    case 'hound': return hound(look, seed);
    case 'bat': return bat(look, seed);
    default: return wraith(look, seed);
  }
}

/** Idle, moving and wind-up poses for any of the five bodies. */
export function animateFantasy(r: FantasyRig, t: number, moving: boolean, windup: boolean) {
  switch (r.model) {
    case 'wisp':
      r.body.position.y = 1.3 + Math.sin(t * 2.2) * 0.12;
      r.a.forEach((g, i) => { g.rotation.y = t * (moving ? 3 : 1.6) + (i / r.a.length) * Math.PI * 2; g.position.y = Math.sin(t * 3 + i) * 0.12; });
      r.body.scale.setScalar(windup ? 1.25 + Math.sin(t * 30) * 0.05 : 1);
      break;
    case 'golem': {
      const f = 5;
      r.b.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * f + i * Math.PI) * 0.45 : 0; });
      r.a.forEach((arm, i) => { arm.rotation.x = windup ? -2.3 : moving ? -Math.sin(t * f + i * Math.PI) * 0.35 : Math.sin(t * 1.2 + i) * 0.05; });
      r.body.position.y = 1.0 + (moving ? Math.abs(Math.sin(t * f)) * 0.06 : 0);
      r.body.rotation.z = moving ? Math.sin(t * f) * 0.05 : 0;
      break;
    }
    case 'hound': {
      const f = moving ? 15 : 0;
      r.b.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 : 0; });
      r.body.position.y = 0.66 + (moving ? Math.abs(Math.sin(t * f)) * 0.06 : Math.sin(t * 2) * 0.01);
      r.a[0].rotation.x = windup ? -0.4 : moving ? 0.15 : Math.sin(t * 1.4) * 0.08; // jaws up before a bite
      break;
    }
    case 'bat': {
      const flap = Math.sin(t * (moving ? 22 : 14));
      r.a[0].rotation.z = flap * 0.8; r.a[1].rotation.z = -flap * 0.8;
      r.body.position.y = 1.5 + Math.sin(t * 3) * 0.15 + (windup ? -0.4 : 0);
      r.body.rotation.x = windup ? 0.5 : 0;
      break;
    }
    default:
      r.body.position.y = 0.3 + Math.sin(t * 1.8) * 0.1;
      r.body.rotation.z = Math.sin(t * 1.1) * 0.05;
      r.a.forEach((arm, i) => { arm.rotation.x = windup ? -2.0 : -0.3 + Math.sin(t * 1.5 + i) * 0.15; });
  }
}
