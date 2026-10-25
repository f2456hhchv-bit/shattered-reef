import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// Sunreach's beasts and the cave crawlers: a boar, spiders (cave and giant), snakes (jungle, ember, the Sunscale).
// Low-poly, faceted like the people; every moving part is its own pivot so bakeRig keeps it animatable. Face +z.

export interface BoarRig { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] }
export interface SpiderRig { root: THREE.Group; body: THREE.Group; legs: THREE.Group[]; fangs: THREE.Group }
export interface SnakeRig { root: THREE.Group; segs: THREE.Group[]; head: THREE.Group; jaw: THREE.Group }



export function buildBoar(seed = 3): BoarRig {
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.62;
  root.add(body);
  const hide = 0x5a4232, dark = 0x3a2a20, snout = 0xc08a78, tusk = 0xeee4cc, bristle = 0x2a1e18;
  // barrel body, higher at the shoulders, with a bristled ridge down the spine
  const torso = mesh(jitter(new THREE.IcosahedronGeometry(0.5, 1), 0.05, seed), mat(hide));
  torso.scale.set(0.82, 0.78, 1.45);
  const shoulder = mesh(jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.04, seed + 1), mat(dark));
  shoulder.scale.set(0.95, 0.9, 0.9);
  shoulder.position.set(0, 0.12, 0.32);
  body.add(torso, shoulder);
  for (let i = 0; i < 6; i++) {
    const b = mesh(new THREE.ConeGeometry(0.07, 0.22, 4), mat(bristle));
    b.position.set(0, 0.42 - i * 0.03, 0.42 - i * 0.18);
    b.rotation.x = -0.5;
    body.add(b);
  }
  const tail = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), mat(dark));
  tail.position.set(0, 0.1, -0.72);
  tail.rotation.x = 0.9;
  body.add(tail);
  // head: wedge skull, snout disc, tusks, small ears and eyes
  const head = new THREE.Group();
  head.position.set(0, 0.02, 0.72);
  const skull = mesh(jitter(new THREE.ConeGeometry(0.3, 0.6, 6), 0.03, seed + 2), mat(dark));
  skull.rotation.x = Math.PI / 2;
  skull.position.z = 0.18;
  const nose = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 7), mat(snout));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.04, 0.48);
  head.add(skull, nose);
  for (const s of [-1, 1]) {
    const t = mesh(new THREE.ConeGeometry(0.035, 0.22, 4), mat(tusk));
    t.position.set(0.11 * s, -0.02, 0.36);
    t.rotation.set(-0.6, 0, s * 0.5);
    const ear = mesh(new THREE.ConeGeometry(0.08, 0.16, 3), mat(hide));
    ear.position.set(0.16 * s, 0.2, -0.02);
    ear.rotation.z = -s * 0.6;
    const eye = mesh(new THREE.IcosahedronGeometry(0.035, 0), mat('eye'));
    eye.position.set(0.15 * s, 0.1, 0.16);
    head.add(t, ear, eye);
  }
  body.add(head);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.24, 0.42], [0.24, 0.42], [-0.24, -0.42], [0.24, -0.42]]) {
    const leg = new THREE.Group();
    leg.position.set(x, -0.18, z);
    const thigh = mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.36, 5), mat(hide));
    thigh.position.y = -0.14;
    const hoof = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 5), mat(bristle));
    hoof.position.y = -0.36;
    leg.add(thigh, hoof);
    body.add(leg);
    legs.push(leg);
  }
  return { root, body, head, legs };
}

export function animateBoar(r: BoarRig, t: number, moving: boolean, charging: boolean) {
  const f = charging ? 16 : 11;
  r.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 : 0; });
  r.body.position.y = 0.62 + (moving ? Math.abs(Math.sin(t * f)) * 0.05 : Math.sin(t * 1.6) * 0.01);
  // head low when charging, rooting about when idle
  r.head.rotation.x = charging ? 0.35 : moving ? 0.1 : 0.25 + Math.max(0, Math.sin(t * 1.3)) * 0.3;
}

const SPIDER_LOOK: Record<string, { body: number; dark: number; mark: number; eye: number }> = {
  cave: { body: 0x4a3e36, dark: 0x2a221e, mark: 0xb89a6a, eye: 0xe8402a },
  giant: { body: 0x2c2a30, dark: 0x16151a, mark: 0xc84a2a, eye: 0xf2c84a },
  queen: { body: 0x3a2440, dark: 0x1e1222, mark: 0xe8a83a, eye: 0xff6a3a }, // the Broodmother
};

export function buildSpider(look = 'cave', seed = 5): SpiderRig {
  const L = SPIDER_LOOK[look] ?? SPIDER_LOOK.cave;
  const rnd = mulberry32(seed);
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.42;
  root.add(body);
  const abdomen = mesh(jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.05, seed), mat(L.body));
  abdomen.scale.set(0.95, 0.8, 1.15);
  abdomen.position.set(0, 0.14, -0.42);
  const thorax = mesh(jitter(new THREE.IcosahedronGeometry(0.24, 1), 0.03, seed + 1), mat(L.dark));
  thorax.scale.set(1.1, 0.7, 1.1);
  thorax.position.set(0, 0.02, 0.05);
  const headM = mesh(jitter(new THREE.IcosahedronGeometry(0.15, 0), 0.02, seed + 2), mat(L.dark));
  headM.position.set(0, 0.02, 0.3);
  body.add(abdomen, thorax, headM);
  // an hourglass mark on the back, and a cluster of glinting eyes
  for (const [dz, s] of [[-0.3, 0.11], [-0.5, 0.09]] as const) {
    const m = mesh(new THREE.ConeGeometry(s, 0.05, 3), mat(L.mark));
    m.position.set(0, 0.46, dz);
    body.add(m);
  }
  for (let i = 0; i < 6; i++) {
    const e = mesh(new THREE.IcosahedronGeometry(0.03 + (i < 2 ? 0.015 : 0), 0), mat(L.eye, { emissive: L.eye, emissiveIntensity: 0.8 }));
    e.position.set((i % 3 - 1) * 0.06 + (rnd() - 0.5) * 0.01, 0.1 + Math.floor(i / 3) * 0.05, 0.42);
    body.add(e);
  }
  const fangs = new THREE.Group();
  fangs.position.set(0, -0.04, 0.4);
  for (const s of [-1, 1]) {
    const f = mesh(new THREE.ConeGeometry(0.03, 0.14, 4), mat(0xe8e0c8));
    f.position.set(0.05 * s, -0.04, 0.02);
    f.rotation.x = Math.PI * 0.85;
    fangs.add(f);
  }
  body.add(fangs);
  // eight legs, each a knee-up arch: upper rises from the thorax, lower comes down to the ground
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group();
    leg.position.set(0.16 * s, 0.02, 0.18 - i * 0.12);
    leg.rotation.y = s > 0 ? -0.9 + i * 0.6 : Math.PI + 0.9 - i * 0.6;
    const upper = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4), mat(L.dark));
    upper.rotation.z = -0.9;
    upper.position.set(0.22, 0.17, 0);
    const lower = mesh(new THREE.ConeGeometry(0.035, 0.7, 4), mat(L.body));
    lower.rotation.z = Math.PI + 0.35;
    lower.position.set(0.56, -0.12, 0);
    leg.add(upper, lower);
    body.add(leg);
    legs.push(leg);
  }
  return { root, body, legs, fangs };
}

export function animateSpider(r: SpiderRig, t: number, moving: boolean, windup: boolean) {
  r.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(t * 18 + (i % 2) * Math.PI + i * 0.3) * 0.3 : Math.sin(t * 2.5 + i) * 0.04; });
  r.body.position.y = 0.42 + (moving ? Math.abs(Math.sin(t * 18)) * 0.03 : 0);
  // reared up before a bite, fangs spread
  r.body.rotation.x = windup ? -0.35 : 0;
  r.fangs.scale.x = windup ? 1.5 : 1 + Math.max(0, Math.sin(t * 3)) ** 8 * 0.3;
}

const SNAKE_LOOK: Record<string, { a: number; b: number; belly: number; eye: number; hood?: boolean }> = {
  jungle: { a: 0x4f7a2a, b: 0xd8b03a, belly: 0xd8d0a0, eye: 0xf2d04a },
  ember: { a: 0x3a1e18, b: 0xe8602a, belly: 0xc8783a, eye: 0xffb040 },
  sunscale: { a: 0xc89a2a, b: 0x7a4a1a, belly: 0xf2dca0, eye: 0x59d0c4, hood: true },
};
export const SNAKE_SEGS = 9;

/** A snake as a chain of segments, head first; animateSnake slithers the chain. */
export function buildSnake(look = 'jungle', seed = 9): SnakeRig {
  const L = SNAKE_LOOK[look] ?? SNAKE_LOOK.jungle;
  const root = new THREE.Group();
  const segs: THREE.Group[] = [];
  for (let i = 0; i < SNAKE_SEGS; i++) {
    const g = new THREE.Group();
    const r = 0.17 * (1 - (i / SNAKE_SEGS) * 0.7);
    const m = mesh(jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.08, seed + i), mat(i % 2 ? L.b : L.a));
    m.scale.set(1, 0.8, 1.7);
    const belly = mesh(new THREE.IcosahedronGeometry(r * 0.85, 0), mat(L.belly));
    belly.scale.set(0.9, 0.5, 1.6);
    belly.position.y = -r * 0.35;
    g.add(m, belly);
    g.position.set(0, r * 0.8, -i * 0.26);
    root.add(g);
    segs.push(g);
  }
  // head raised off the ground on the first segment
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.22);
  const skull = mesh(jitter(new THREE.IcosahedronGeometry(0.17, 1), 0.02, seed + 30), mat(L.a));
  skull.scale.set(1.1, 0.7, 1.45);
  head.add(skull);
  if (L.hood) {
    // the Sunscale's crest: a fan of gold spines behind the skull, like a sunburst
    for (let k = 0; k < 7; k++) {
      const a = -0.9 + (k / 6) * 1.8;
      const sp = mesh(new THREE.ConeGeometry(0.05, 0.36, 4), mat(L.b));
      sp.position.set(Math.sin(a) * 0.16, 0.08 + Math.cos(a) * 0.12, -0.12);
      sp.rotation.set(-0.5, 0, -a);
      head.add(sp);
    }
  }
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.035, 0), mat(L.eye, { emissive: L.eye, emissiveIntensity: 0.9 }));
    eye.position.set(0.1 * s, 0.06, 0.12);
    head.add(eye);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.05, 0.05);
  const jm = mesh(jitter(new THREE.IcosahedronGeometry(0.13, 0), 0.01, seed + 31), mat(L.belly));
  jm.scale.set(1, 0.4, 1.4);
  jm.position.z = 0.08;
  jaw.add(jm);
  head.add(jaw);
  // a neck rising from the first segment to the head
  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.42, 6), mat(L.a));
  neck.position.set(0, -0.2, -0.08);
  neck.rotation.x = 0.5;
  head.add(neck);
  root.add(head);
  return { root, segs, head, jaw };
}

export function animateSnake(r: SnakeRig, t: number, moving: boolean, windup: boolean) {
  const sp = moving ? 7 : 1.6, amp = moving ? 0.22 : 0.08;
  r.segs.forEach((g, i) => { g.position.x = Math.sin(t * sp - i * 0.8) * amp * Math.min(1, i / 2 + 0.3); });
  // coiled back to strike, then lunging
  r.head.position.z = windup ? 0.02 : 0.22;
  r.head.position.y = windup ? 0.6 : 0.42 + Math.sin(t * 2.2) * 0.03;
  r.head.position.x = r.segs[0].position.x;
  r.jaw.rotation.x = windup ? 0.6 : Math.max(0, Math.sin(t * 1.7)) ** 10 * 0.3;
}
