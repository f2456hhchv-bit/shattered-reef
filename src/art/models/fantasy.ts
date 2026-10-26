import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// The islands' stranger folk (Tom, 2026-10-25: "creatures, bugs, fantasy"; docs/ISLANDS.md): golems (spriggans,
// trolls), hounds, winged things (bats, gulls) and beetles. Four bodies, each with looks; every moving part is its own
// pivot so bakeRig keeps it animatable. Faces +z. One rig shape for all of them keeps the renderer to a single case.

export type FantasyModel = 'golem' | 'hound' | 'bat' | 'beetle';
export interface FantasyRig { model: FantasyModel; root: THREE.Group; body: THREE.Group; a: THREE.Group[]; b: THREE.Group[]; form?: 'mantis' }

const glow = (c: number, k = 1) => mat(c, { emissive: c, emissiveIntensity: k });

// ---- golems: a lumbering body of whatever the island is made of, with glowing eyes
const GOLEM: Record<string, { body: number; dark: number; accent: number; eye: number; spikes?: boolean; leaves?: boolean }> = {
  drift: { body: 0x8a6a4a, dark: 0x5a4430, accent: 0x6a8a4a, eye: 0xb8f07a }, // driftwood lashed with weed
  amber: { body: 0x7a6a58, dark: 0x4e4438, accent: 0xe8a83a, eye: 0xffc04a, spikes: true }, // rock grown with amber
  oak: { body: 0x4a3a2a, dark: 0x2e241a, accent: 0x3e6a2a, eye: 0xd8f070, leaves: true }, // the Old Wood's heart
  thorn: { body: 0x5a4a2e, dark: 0x3a2e1c, accent: 0x6a8a3a, eye: 0xe8d84a, leaves: true }, // a bramble spriggan: roots, thorns, leaves
  troll: { body: 0x6a7060, dark: 0x4a5044, accent: 0x5a7a3a, eye: 0xe8b84a, leaves: true }, // grey hide grown with moss
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
const BAT: Record<string, { fur: number; wing: number; eye: number; beak?: number }> = {
  cave: { fur: 0x3a2e2a, wing: 0x5a443a, eye: 0xe8402a },
  ember: { fur: 0x2a1a14, wing: 0x9a3a1a, eye: 0xffb040 },
  gull: { fur: 0xeeeeea, wing: 0xb8bcc2, eye: 0x1a1a1a, beak: 0xe8b83a }, // a herring gull: white, grey wings, yellow bill
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
  if (L.beak) {
    const beak = mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mat(L.beak));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.04, 0.5);
    body.add(beak);
  }
  for (const s of [-1, 1]) {
    if (!L.beak) {
      const ear = mesh(new THREE.ConeGeometry(0.06, 0.2, 3), mat(L.wing));
      ear.position.set(0.08 * s, 0.22, 0.26);
      body.add(ear);
    }
    const eye = mesh(new THREE.IcosahedronGeometry(0.03, 0), L.beak ? mat(L.eye) : glow(L.eye, 1));
    eye.position.set(0.06 * s, 0.09, 0.42);
    body.add(eye);
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

// ---- beetles: a domed shell over six jointed legs, mandibles in front
const BEETLE: Record<string, { shell: number; dark: number; leg: number; eye: number }> = {
  shore: { shell: 0xb89a6a, dark: 0x6a5a3e, leg: 0x4a3e2a, eye: 0x1a1a1a }, // sand-coloured, on Bellwether's beaches
  ant: { shell: 0x8a3a1e, dark: 0x5a2414, leg: 0x4a1e10, eye: 0x1a1a1a }, // a Sunreach leafcutter: rust-red, a leaf held high
  mantis: { shell: 0x6a9a3a, dark: 0x4a7a2a, leg: 0x5a8a30, eye: 0xe8e07a }, // a jungle mantis: leaf-green, forelimbs folded
};
function beetle(look: string, seed: number): FantasyRig {
  if (look === 'ant') return ant(seed);
  if (look === 'mantis') return mantis(seed);
  const L = BEETLE[look] ?? BEETLE.shore;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.32;
  root.add(body);
  const shell = mesh(jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.03, seed), mat(L.shell));
  shell.scale.set(0.85, 0.55, 1.2);
  shell.position.z = -0.08;
  // the seam down the wing-cases
  const seam = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.9), mat(L.dark));
  seam.position.set(0, 0.22, -0.08);
  const head = mesh(jitter(new THREE.IcosahedronGeometry(0.18, 0), 0.02, seed + 1), mat(L.dark));
  head.scale.set(1.1, 0.7, 0.9);
  head.position.set(0, 0, 0.46);
  body.add(shell, seam, head);
  const jaws = new THREE.Group();
  jaws.position.set(0, -0.02, 0.6);
  for (const s of [-1, 1]) {
    const m = mesh(new THREE.ConeGeometry(0.04, 0.2, 4), mat(L.dark));
    m.rotation.set(Math.PI / 2, 0, 0);
    m.rotation.y = s * 0.5;
    m.position.set(0.06 * s, 0, 0.05);
    const eye = mesh(new THREE.IcosahedronGeometry(0.035, 0), mat(L.eye));
    eye.position.set(0.12 * s, 0.07, 0.52);
    jaws.add(m);
    body.add(eye);
  }
  body.add(jaws);
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = new THREE.Group();
    leg.position.set(0.24 * s, -0.08, 0.22 - i * 0.24);
    leg.rotation.y = s > 0 ? -0.3 + i * 0.3 : Math.PI + 0.3 - i * 0.3;
    const up = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 4), mat(L.leg));
    up.rotation.z = -1.1;
    up.position.set(0.13, 0.05, 0);
    const low = mesh(new THREE.ConeGeometry(0.025, 0.32, 4), mat(L.leg));
    low.rotation.z = Math.PI + 0.4;
    low.position.set(0.3, -0.12, 0);
    leg.add(up, low);
    body.add(leg);
    legs.push(leg);
  }
  return { model: 'beetle', root, body, a: [jaws], b: legs };
}

/** Six jointed legs on a body group (shared by the insect forms). */
function sixLegs(body: THREE.Group, col: number, spread: number, y: number, z0: number, step: number, len = 1) {
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = new THREE.Group();
    leg.position.set(spread * s, y, z0 - i * step);
    leg.rotation.y = s > 0 ? -0.3 + i * 0.3 : Math.PI + 0.3 - i * 0.3;
    const up = mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3 * len, 4), mat(col));
    up.rotation.z = -1.1;
    up.position.set(0.13 * len, 0.05 * len, 0);
    const low = mesh(new THREE.ConeGeometry(0.022, 0.34 * len, 4), mat(col));
    low.rotation.z = Math.PI + 0.4;
    low.position.set(0.3 * len, -0.12 * len, 0);
    leg.add(up, low);
    body.add(leg);
    legs.push(leg);
  }
  return legs;
}

// a leafcutter ant: head, thorax and gaster in a row, a cut leaf held up in the jaws
function ant(seed: number): FantasyRig {
  const L = BEETLE.ant;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.32;
  root.add(body);
  const gaster = mesh(jitter(new THREE.IcosahedronGeometry(0.26, 1), 0.02, seed), mat(L.shell));
  gaster.scale.set(0.9, 0.8, 1.25); gaster.position.set(0, 0.04, -0.42);
  const thorax = mesh(jitter(new THREE.IcosahedronGeometry(0.14, 1), 0.01, seed + 1), mat(L.dark));
  thorax.scale.set(0.9, 0.8, 1.4); thorax.position.set(0, 0.02, -0.06);
  const head = mesh(jitter(new THREE.IcosahedronGeometry(0.17, 1), 0.015, seed + 2), mat(L.shell));
  head.scale.set(1.15, 0.9, 1); head.position.set(0, 0.06, 0.24);
  body.add(gaster, thorax, head);
  for (const s of [-1, 1]) {
    const ant = mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 3), mat(L.leg));
    ant.position.set(0.07 * s, 0.22, 0.34); ant.rotation.set(0.8, 0, -0.4 * s);
    const eye = mesh(new THREE.IcosahedronGeometry(0.03, 0), mat(L.eye));
    eye.position.set(0.13 * s, 0.1, 0.3);
    body.add(ant, eye);
  }
  // the jaws carry the leaf, so it bobs and dips when it bites
  const jaws = new THREE.Group();
  jaws.position.set(0, 0.02, 0.4);
  for (const s of [-1, 1]) { const m = mesh(new THREE.ConeGeometry(0.035, 0.16, 4), mat(L.dark)); m.rotation.set(Math.PI / 2, 0.5 * s, 0); m.position.set(0.05 * s, 0, 0.03); jaws.add(m); }
  const leaf = mesh(new THREE.CircleGeometry(0.28, 7), mat(0x5a9a3a, { side: THREE.DoubleSide }));
  leaf.scale.set(0.8, 1.2, 1); leaf.position.set(0, 0.32, -0.1); leaf.rotation.set(-0.3, 0.4, 0.2);
  jaws.add(leaf);
  body.add(jaws);
  const legs = sixLegs(body, L.leg, 0.12, -0.04, 0.02, 0.12, 0.95);
  return { model: 'beetle', root, body, a: [jaws], b: legs };
}

// a jungle mantis: a long body reared up, a triangle head, folded forelimbs that snap out to strike
function mantis(seed: number): FantasyRig {
  const L = BEETLE.mantis;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.42;
  root.add(body);
  const abdomen = mesh(jitter(new THREE.IcosahedronGeometry(0.2, 1), 0.02, seed), mat(L.shell));
  abdomen.scale.set(0.8, 0.6, 2.2); abdomen.position.set(0, 0, -0.38);
  const wings = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.62), mat(L.dark));
  wings.position.set(0, 0.11, -0.36);
  const thorax = mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.5, 6), mat(L.shell));
  thorax.position.set(0, 0.2, 0.06); thorax.rotation.x = -0.9;
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.24);
  const skull = mesh(new THREE.ConeGeometry(0.12, 0.16, 3), mat(L.shell));
  skull.rotation.set(Math.PI, 0, 0); skull.scale.set(1.3, 1, 0.6);
  head.add(skull);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(L.eye, { emissive: L.eye, emissiveIntensity: 0.4 }));
    eye.position.set(0.1 * s, 0.04, 0.02);
    const ant = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.3, 3), mat(L.leg));
    ant.position.set(0.05 * s, 0.16, 0.06); ant.rotation.set(-0.5, 0, -0.3 * s);
    head.add(eye, ant);
  }
  body.add(abdomen, wings, thorax, head);
  // the raptorial forelimbs, folded under the head; they open on the wind-up and snap down on the strike
  const arms = new THREE.Group();
  arms.position.set(0, 0.3, 0.2);
  for (const s of [-1, 1]) {
    const up = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), mat(L.dark));
    up.position.set(0.08 * s, 0, 0.12);
    const blade = mesh(new THREE.ConeGeometry(0.03, 0.3, 4), mat(L.leg));
    blade.position.set(0.08 * s, -0.12, 0.24); blade.rotation.x = Math.PI;
    arms.add(up, blade);
  }
  body.add(arms);
  // four walking legs (the front pair are the arms)
  const legs = sixLegs(body, L.leg, 0.1, -0.06, -0.08, 0.16, 1.15).filter((_, i) => i % 3 !== 0);
  return { model: 'beetle', root, body, a: [arms], b: legs, form: 'mantis' };
}

export function buildFantasy(model: FantasyModel, look = '', seed = 7): FantasyRig {
  switch (model) {
    case 'golem': return golem(look, seed);
    case 'hound': return hound(look, seed);
    case 'bat': return bat(look, seed);
    default: return beetle(look, seed);
  }
}

/** Idle, moving and wind-up poses for any of the five bodies. */
export function animateFantasy(r: FantasyRig, t: number, moving: boolean, windup: boolean) {
  switch (r.model) {
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
    default: {
      if (r.form === 'mantis') {
        // stalks, swaying; forelimbs raised on the wind-up, then snapped down
        r.b.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * 14 + (i % 2) * Math.PI) * 0.3 : 0; });
        r.body.position.y = 0.42 + Math.sin(t * 1.6) * 0.02;
        r.a[0].rotation.x = windup ? -1.1 : Math.sin(t * 1.3) * 0.08;
        r.body.rotation.z = moving ? 0 : Math.sin(t * 0.9) * 0.06;
        break;
      }
      // scuttle: alternating tripods, jaws working before a bite
      r.b.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * 20 + (i % 2) * Math.PI) * 0.35 : 0; });
      r.body.position.y = 0.32 + (moving ? Math.abs(Math.sin(t * 20)) * 0.02 : 0);
      r.a[0].scale.x = windup ? 1.6 : 1 + Math.max(0, Math.sin(t * 3)) ** 6 * 0.3;
      r.body.rotation.x = windup ? -0.25 : 0;
    }
  }
}
