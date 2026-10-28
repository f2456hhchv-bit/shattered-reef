import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// The islands' stranger folk (Tom, 2026-10-25: "creatures, bugs, fantasy"; docs/ISLANDS.md): golems (spriggans,
// trolls), hounds, winged things (bats, gulls) and beetles. Four bodies, each with looks; every moving part is its own
// pivot so bakeRig keeps it animatable. Faces +z. One rig shape for all of them keeps the renderer to a single case.

export type FantasyModel = 'golem' | 'hound' | 'bat' | 'beetle' | 'door';
export interface FantasyRig { model: FantasyModel; root: THREE.Group; body: THREE.Group; a: THREE.Group[]; b: THREE.Group[]; form?: 'mantis'; /** body height at rest (a horse stands taller than a hound) */ baseY?: number }

const glow = (c: number, k = 1) => mat(c, { emissive: c, emissiveIntensity: k });

// ---- golems: a lumbering body of whatever the island is made of, with glowing eyes
const GOLEM: Record<string, { body: number; dark: number; accent: number; eye: number; spikes?: boolean; leaves?: boolean }> = {
  drift: { body: 0x8a6a4a, dark: 0x5a4430, accent: 0x6a8a4a, eye: 0xb8f07a }, // driftwood lashed with weed
  amber: { body: 0x7a6a58, dark: 0x4e4438, accent: 0xe8a83a, eye: 0xffc04a, spikes: true }, // rock grown with amber
  oak: { body: 0x4a3a2a, dark: 0x2e241a, accent: 0x3e6a2a, eye: 0xd8f070, leaves: true }, // the Old Wood's heart
  thorn: { body: 0x5a4a2e, dark: 0x3a2e1c, accent: 0x6a8a3a, eye: 0xe8d84a, leaves: true }, // a bramble spriggan: roots, thorns, leaves
  troll: { body: 0x6a7060, dark: 0x4a5044, accent: 0x5a7a3a, eye: 0xe8b84a, leaves: true }, // grey hide grown with moss
  mosstroll: { body: 0x5a6a44, dark: 0x3a4a2e, accent: 0x7a9a3a, eye: 0xe8d84a, leaves: true }, // Amberhold's: green with moss to the brow
  jotunn: { body: 0x4a5260, dark: 0x2a3038, accent: 0x8ad8ff, eye: 0xbfe8ff, spikes: true }, // the Thunder Jötunn: storm-slate, lightning in its cracks
  draugrtroll: { body: 0x7a8a90, dark: 0x4a5a62, accent: 0x9ab8c0, eye: 0x8ae8ff, spikes: true }, // a troll the barrows kept: grey-blue, rimed
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
  if (look === 'jotunn') jotunnKit(body, arms[1], L, seed);
  return { model: 'golem', root, body, a: arms, b: legs };
}

/** The Thunder Jötunn's own silhouette: horns, a rimed beard, lightning in the cracks of its chest, a storm hammer. */
function jotunnKit(body: THREE.Group, hand: THREE.Group, L: (typeof GOLEM)[string], seed: number) {
  const horn = mat(0xd8d0bc), beard = mat(0x9aa8b4), iron = mat(0x3a3e44), bolt = glow(L.accent, 1.6);
  for (const s of [-1, 1]) {
    const h = mesh(new THREE.ConeGeometry(0.08, 0.5, 6), horn);
    h.position.set(0.2 * s, 1.08, 0.08);
    h.rotation.set(-0.3, 0, -0.9 * s);
    const tip = mesh(new THREE.ConeGeometry(0.035, 0.2, 5), horn);
    tip.position.set(0.42 * s, 1.32, 0.04);
    tip.rotation.set(-0.2, 0, -0.1 * s);
    // stone pauldrons: a heavier shoulder line
    const pad = mesh(jitter(new THREE.IcosahedronGeometry(0.24, 0), 0.04, seed + 9 + s), mat(L.dark));
    pad.position.set(0.55 * s, 0.72, 0);
    pad.scale.set(1, 0.7, 1);
    body.add(h, tip, pad);
  }
  const b = mesh(jitter(new THREE.ConeGeometry(0.24, 0.62, 7), 0.03, seed + 11), beard);
  b.position.set(0, 0.5, 0.36);
  b.rotation.x = Math.PI + 0.25;
  body.add(b);
  // a zigzag of lightning down the chest
  const zig = [[-0.12, 0.62, 0.5], [0.06, 0.45, 0.6], [-0.08, 0.26, -0.5], [0.08, 0.1, 0.4]] as const;
  for (const [x, y, rz] of zig) {
    const seg = mesh(new THREE.BoxGeometry(0.035, 0.2, 0.03), bolt, false);
    seg.position.set(x, y, 0.44);
    seg.rotation.z = rz;
    body.add(seg);
  }
  // the storm hammer, held in the right fist so it swings with the arm
  const handle = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat(0x5a4632));
  handle.position.set(0, -0.66, 0.3);
  handle.rotation.x = Math.PI / 2;
  const head = mesh(jitter(new THREE.BoxGeometry(0.32, 0.26, 0.42), 0.02, seed + 13), iron);
  head.position.set(0, -0.66, 0.78);
  const band = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.44), bolt, false);
  band.position.set(0, -0.66, 0.78);
  hand.add(handle, head, band);
}

// ---- hounds: lean four-legged hunters
const HOUND: Record<string, { coat: number; dark: number; eye: number; spots?: number; horse?: boolean }> = {
  moon: { coat: 0x9a9aa8, dark: 0x4e4e5c, eye: 0x9ad8ff }, // pale hounds
  warg: { coat: 0xd8d4c8, dark: 0x6a645a, eye: 0xe8b84a }, // Amberhold's wargs: big, white-grey, amber-eyed
  nokk: { coat: 0x3a4a44, dark: 0x1e2a26, eye: 0x8affe8, horse: true }, // the nøkk: a dark water-horse, weed for a mane
  wolf: { coat: 0x7a7266, dark: 0x3e3a34, eye: 0xd8a83a }, // Bellwether's grey wolves
  greymuzzle: { coat: 0xb8b4aa, dark: 0x5a564e, eye: 0xe8c04a }, // the old pack leader, grey to the muzzle
};
function hound(look: string, seed: number): FantasyRig {
  const L = HOUND[look] ?? HOUND.moon;
  const rnd = mulberry32(seed);
  const root = new THREE.Group(), body = new THREE.Group();
  const H = L.horse ? 1.5 : 1; // a horse: the same body on longer legs, its head carried high
  body.position.y = 0.66 * H;
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
  head.position.set(0, L.horse ? 0.62 : 0.24, L.horse ? 0.86 : 0.72);
  if (L.horse) {
    const neck = mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.62, 6), mat(L.coat));
    neck.position.set(0, 0.36, 0.66); neck.rotation.x = 0.55;
    body.add(neck);
  }
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
    const l = mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.5 * H + (H - 1) * 0.2, 5), mat(L.coat));
    l.position.y = -0.25 * H - (H - 1) * 0.1;
    const paw = mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(L.dark));
    paw.position.set(0, -0.5 * H - (H - 1) * 0.2, 0.03);
    leg.add(l, paw);
    body.add(leg);
    legs.push(leg);
  }
  return { model: 'hound', root, body, a: [head], b: legs, baseY: 0.66 * H };
}

// ---- bats: leathery wings, flitting above head height
const BAT: Record<string, { fur: number; wing: number; eye: number; beak?: number }> = {
  cave: { fur: 0x3a2e2a, wing: 0x5a443a, eye: 0xe8402a },
  ember: { fur: 0x2a1a14, wing: 0x9a3a1a, eye: 0xffb040 },
  gull: { fur: 0xeeeeea, wing: 0xb8bcc2, eye: 0x1a1a1a, beak: 0xe8b83a }, // a herring gull: white, grey wings, yellow bill
  souc: { fur: 0xff8a2a, wing: 0xffc04a, eye: 0xfff2c0 }, // the soucouyant: a ball of fire with wings of flame
  hornet: { fur: 0xd8a02a, wing: 0xe8e4d0, eye: 0x1a1a1a, beak: 0x1a1a14 }, // an amber hornet: gold and black-banded, a sting at the tail
};
function bat(look: string, seed: number): FantasyRig {
  const L = BAT[look] ?? BAT.cave;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1.5;
  root.add(body);
  const fire = look === 'souc';
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(fire ? 0.3 : 0.22, 1), 0.03, seed), fire ? glow(L.fur, 1.6) : mat(L.fur));
  torso.scale.set(0.9, 0.9, 1.3);
  const head = mesh(jitter(new THREE.IcosahedronGeometry(0.15, 0), 0.02, seed + 1), fire ? glow(L.fur, 1.6) : mat(L.fur));
  head.position.set(0, 0.06, 0.28);
  body.add(torso, head);
  if (look === 'hornet') {
    // black bands round the body and a sting at the tail
    for (const z of [-0.08, -0.22]) { const b = mesh(new THREE.TorusGeometry(0.19, 0.045, 4, 10), mat(0x1a1a14)); b.position.z = z; body.add(b); }
    const sting = mesh(new THREE.ConeGeometry(0.05, 0.24, 4), mat(0x1a1a14));
    sting.rotation.x = -Math.PI / 2; sting.position.z = -0.4;
    body.add(sting);
  }
  if (L.beak && look !== 'hornet') {
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
      const m = mesh(new THREE.ConeGeometry(0.22 - k * 0.04, 0.8 - k * 0.15, 3), fire ? mat(L.wing, { side: THREE.DoubleSide, emissive: L.wing, emissiveIntensity: 1.2 }) : mat(L.wing, { side: THREE.DoubleSide }));
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
  bark: { shell: 0x5a4430, dark: 0x3a2c1e, leg: 0x2e2218, eye: 0xe8a83a }, // a bark beetle: the colour of the trees it chews
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

// ---- the Lockjaw (Lockhaven): a Wardwright door left standing so long with nothing behind it that it learned to be
// a mouth. Split across the middle like a stable door, the top half hinges back; teeth where the two halves meet,
// the keyhole a single glowing eye. It hops on its frame's feet.
const DOOR_LOOK: Record<string, { wood: number; dark: number; iron: number; eye: number }> = {
  lockjaw: { wood: 0x6a4a30, dark: 0x3a2818, iron: 0x4a4a4e, eye: 0xe8c060 },
  elder: { wood: 0x3a3a40, dark: 0x1e1e24, iron: 0xc9a050, eye: 0xbcd8ff },
};
function door(look: string): FantasyRig {
  const L = DOOR_LOOK[look] ?? DOOR_LOOK.lockjaw;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.2;
  root.add(body);
  const wood = mat(L.wood), dark = mat(L.dark), iron = mat(L.iron);
  // the bottom half and its frame feet
  const lower = mesh(new THREE.BoxGeometry(1.0, 0.9, 0.16), wood);
  lower.position.y = 0.45;
  const sill = mesh(new THREE.BoxGeometry(1.2, 0.12, 0.3), dark);
  for (const s of [-1, 1]) { const post = mesh(new THREE.BoxGeometry(0.12, 0.95, 0.24), dark); post.position.set(0.56 * s, 0.47, 0); body.add(post); }
  const bandL = mesh(new THREE.BoxGeometry(1.02, 0.08, 0.18), iron); bandL.position.y = 0.25;
  body.add(lower, sill, bandL);
  // the top half: the jaw, hinged at the back of the split
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.92, -0.08);
  const upper = mesh(new THREE.BoxGeometry(1.0, 0.95, 0.16), wood);
  upper.position.set(0, 0.47, 0.08);
  const bandU = mesh(new THREE.BoxGeometry(1.02, 0.08, 0.18), iron); bandU.position.set(0, 0.72, 0.08);
  const lintel = mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3), dark); lintel.position.set(0, 1.0, 0.08);
  // the keyhole eye, and a knocker for a nose
  const eye = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), glow(L.eye, 1.6)); eye.rotation.x = Math.PI / 2; eye.position.set(0.28, 0.5, 0.18);
  const slot = mesh(new THREE.BoxGeometry(0.05, 0.14, 0.04), glow(L.eye, 1.6)); slot.position.set(0.28, 0.4, 0.18);
  const knock = mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14), iron); knock.position.set(0, 0.35, 0.19);
  jaw.add(upper, bandU, lintel, eye, slot, knock);
  // teeth along both edges of the split
  for (let k = 0; k < 7; k++) {
    const x = -0.42 + k * 0.14;
    const top = mesh(new THREE.ConeGeometry(0.045, 0.16, 4), mat(0xe8e0c8)); top.rotation.x = Math.PI; top.position.set(x, -0.04, 0.12); jaw.add(top);
    const bot = mesh(new THREE.ConeGeometry(0.045, 0.14, 4), mat(0xe8e0c8)); bot.position.set(x + 0.07, 0.96, 0.04); body.add(bot);
  }
  body.add(jaw);
  return { model: 'door', root, body, a: [jaw], b: [] };
}

export function buildFantasy(model: FantasyModel, look = '', seed = 7): FantasyRig {
  switch (model) {
    case 'golem': return golem(look, seed);
    case 'hound': return hound(look, seed);
    case 'bat': return bat(look, seed);
    case 'door': return door(look);
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
      r.body.position.y = (r.baseY ?? 0.66) + (moving ? Math.abs(Math.sin(t * f)) * 0.06 : Math.sin(t * 2) * 0.01);
      r.a[0].rotation.x = windup ? -0.4 : moving ? 0.15 : Math.sin(t * 1.4) * 0.08; // jaws up before a bite
      break;
    }
    case 'door': {
      // hops on its frame; the top half yawns open on the wind-up and slams shut on the bite
      const hop = moving ? Math.abs(Math.sin(t * 7)) : 0;
      r.body.position.y = 0.2 + hop * 0.35;
      r.body.rotation.x = moving ? -0.08 + hop * 0.12 : 0;
      r.a[0].rotation.x = windup ? -1.15 : moving ? -0.15 - hop * 0.25 : -0.05 - Math.max(0, Math.sin(t * 0.9)) ** 8 * 0.4;
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
