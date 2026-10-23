import * as THREE from 'three';
import { mat, mesh, jitter, PAL } from '../materials';
import { mulberry32 } from '../noise';

// Island set dressing and stations: furnace, anvil, cookfire, tents, ruin, guardian, stumps, drops.

export function buildFurnace(): { group: THREE.Group; glow: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const base = mesh(jitter(new THREE.CylinderGeometry(1.0, 1.15, 0.5, 8), 0.06, 61), mat('stoneDark'));
  base.position.y = 0.25;
  const dome = mesh(jitter(new THREE.SphereGeometry(0.95, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.07, 62), mat('stone'));
  dome.position.y = 0.5;
  const stack = mesh(jitter(new THREE.CylinderGeometry(0.28, 0.35, 1.4, 6), 0.04, 63), mat('stoneDark'));
  stack.position.set(-0.2, 1.6, -0.3);
  const glow = new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 2.2, flatShading: true });
  const mouth = mesh(new THREE.BoxGeometry(0.6, 0.45, 0.2), glow, false);
  mouth.position.set(0, 0.62, 0.86);
  g.add(base, dome, stack, mouth);
  const light = new THREE.PointLight(0xff8a3a, 4, 6, 1.8);
  light.position.set(0, 0.8, 1.3);
  g.add(light);
  return { group: g, glow };
}

export function buildAnvil(): THREE.Group {
  const g = new THREE.Group();
  const stump = mesh(jitter(new THREE.CylinderGeometry(0.32, 0.38, 0.55, 7), 0.03, 71), mat('trunk'));
  stump.position.y = 0.27;
  const body = mesh(new THREE.BoxGeometry(0.75, 0.22, 0.3), mat('iron'));
  body.position.y = 0.66;
  const horn = mesh(new THREE.ConeGeometry(0.12, 0.38, 5), mat('iron'));
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(0.55, 0.7, 0);
  const waist = mesh(new THREE.BoxGeometry(0.35, 0.12, 0.22), mat('iron'));
  waist.position.y = 0.5;
  g.add(stump, body, horn, waist);
  return g;
}

export function buildCookfire(): { group: THREE.Group; flames: THREE.Mesh[] } {
  const g = new THREE.Group();
  const rnd = mulberry32(81);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const s = mesh(jitter(new THREE.DodecahedronGeometry(0.17, 0), 0.05, 82 + k), mat(k % 2 ? 'stone' : 'stoneDark'));
    s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
    g.add(s);
  }
  for (let k = 0; k < 3; k++) {
    const log = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 5), mat('trunk'));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (k / 3) * Math.PI + rnd() * 0.2;
    log.position.y = 0.12;
    g.add(log);
  }
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff7a1a, emissiveIntensity: 2.5, flatShading: true });
  const flames: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const f = mesh(new THREE.ConeGeometry(0.16 - k * 0.03, 0.55 - k * 0.1, 5), flameMat, false, false);
    f.position.set((k - 1) * 0.12, 0.4, (k % 2) * 0.1 - 0.05);
    g.add(f);
    flames.push(f);
  }
  // spit with a pot so it reads as cooking, not just a campfire
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 4), mat('woodDark'));
    post.position.set(s * 0.6, 0.45, 0);
    g.add(post);
  }
  const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 4), mat('iron'));
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 0.88;
  const pot = mesh(new THREE.SphereGeometry(0.2, 7, 5, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), mat('iron'));
  pot.position.y = 0.78;
  g.add(bar, pot);
  const light = new THREE.PointLight(0xffa04a, 3.5, 7, 1.8);
  light.position.y = 0.7;
  g.add(light);
  return { group: g, flames };
}

export function buildTent(seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-1.3, 0);
  shape.lineTo(1.3, 0);
  shape.lineTo(0, 1.9);
  shape.lineTo(-1.3, 0);
  const cloth = mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }), mat(rnd() > 0.5 ? 0x8a5a44 : 0x6f6450));
  cloth.position.z = -1.5;
  const flap = mesh(new THREE.BoxGeometry(0.9, 1.2, 0.05), mat(0x2a211b));
  flap.position.set(0, 0.6, 1.53);
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 4), mat('woodDark'));
  pole.position.set(0, 1.0, 1.6);
  g.add(cloth, flap, pole);
  return g;
}

export function buildSmithyShed(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-2.4, -1.7], [2.4, -1.7], [-2.4, 1.7], [2.4, 1.7]] as const) {
    const p = mesh(jitter(new THREE.BoxGeometry(0.22, 2.6, 0.22), 0.02, Math.round(x * 10 + z)), mat('woodDark'));
    p.position.set(x, 1.3, z);
    g.add(p);
  }
  const roof = mesh(jitter(new THREE.BoxGeometry(5.6, 0.14, 4.2), 0.04, 91), mat('roof'));
  roof.position.y = 2.65;
  roof.rotation.x = -0.18;
  g.add(roof);
  const back = mesh(new THREE.BoxGeometry(5.0, 1.0, 0.12), mat('plankWorn'));
  back.position.set(0, 0.5, -1.75);
  g.add(back);
  return g;
}

export function buildPillar(seed: number, height: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const col = mesh(jitter(new THREE.CylinderGeometry(0.55, 0.65, height * 3, 6), 0.12, seed), mat('stone'));
  col.position.y = (height * 3) / 2;
  col.rotation.z = (rnd() - 0.5) * 0.12;
  const base = mesh(jitter(new THREE.BoxGeometry(1.5, 0.35, 1.5), 0.08, seed + 1), mat('stoneDark'));
  base.position.y = 0.17;
  g.add(base, col);
  if (height > 0.9) {
    const cap = mesh(jitter(new THREE.BoxGeometry(1.4, 0.3, 1.0), 0.06, seed + 2), mat('stoneDark'));
    cap.position.y = height * 3 + 0.15;
    g.add(cap);
  }
  // teal glyph band: the Locks' visual signature
  const glyph = mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.08, 6, 1, true), mat(0x2f9a92, { emissive: 0x59d0c4, emissiveIntensity: 0.5 }), false, false);
  glyph.position.y = 1.0;
  g.add(glyph);
  return g;
}

export function buildPlinth(): THREE.Group {
  const g = new THREE.Group();
  const block = mesh(jitter(new THREE.BoxGeometry(1.3, 0.9, 1.0), 0.05, 101), mat('stoneDark'));
  block.position.y = 0.45;
  const top = mesh(new THREE.BoxGeometry(1.45, 0.14, 1.15), mat('stone'));
  top.position.y = 0.95;
  // the bell-shaped hollow
  const hollow = mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.12, 8), mat(0x101a1c, { emissive: 0x59d0c4, emissiveIntensity: 0.35 }), false);
  hollow.position.y = 1.03;
  g.add(block, top, hollow);
  return g;
}

export interface GuardianRig { root: THREE.Group; body: THREE.Group; armL: THREE.Group; armR: THREE.Group; head: THREE.Group; core: THREE.MeshStandardMaterial }

export function buildGuardian(): GuardianRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const core = new THREE.MeshStandardMaterial({ color: 0x59d0c4, emissive: 0x59d0c4, emissiveIntensity: 1.6, flatShading: true });
  for (const s of [-1, 1]) {
    const leg = mesh(jitter(new THREE.BoxGeometry(0.7, 1.1, 0.8), 0.08, 110 + s), mat('stoneDark'));
    leg.position.set(0.5 * s, 0.55, 0);
    body.add(leg);
  }
  const torso = mesh(jitter(new THREE.BoxGeometry(2.0, 1.6, 1.3), 0.14, 113), mat('stone'));
  torso.position.y = 1.9;
  const plate = mesh(jitter(new THREE.BoxGeometry(1.3, 1.1, 0.2), 0.04, 114), mat(0xb08a3e));
  plate.position.set(0, 1.95, 0.7);
  const keyhole = mesh(new THREE.BoxGeometry(0.16, 0.42, 0.08), core, false);
  keyhole.position.set(0, 1.9, 0.82);
  const keyholeTop = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8), core, false);
  keyholeTop.rotation.x = Math.PI / 2;
  keyholeTop.position.set(0, 2.15, 0.82);
  const bell = mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.45, 8), mat(0xb08a3e));
  bell.position.set(0, 2.95, 0.2);
  body.add(torso, plate, keyhole, keyholeTop, bell);
  const head = new THREE.Group();
  head.position.y = 2.75;
  const skull = mesh(jitter(new THREE.BoxGeometry(0.8, 0.6, 0.7), 0.06, 115), mat('stoneDark'));
  skull.position.set(0, 0.25, 0.35);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), core, false);
    eye.position.set(0.18 * s, 0.3, 0.72);
    head.add(eye);
  }
  head.add(skull);
  body.add(head);
  const mkArm = (s: number) => {
    const arm = new THREE.Group();
    arm.position.set(1.25 * s, 2.45, 0);
    const shoulder = mesh(jitter(new THREE.DodecahedronGeometry(0.55, 0), 0.08, 120 + s), mat('stoneDark'));
    const fore = mesh(jitter(new THREE.BoxGeometry(0.75, 1.5, 0.75), 0.1, 122 + s), mat('stone'));
    fore.position.y = -1.0;
    const band = mesh(new THREE.BoxGeometry(0.85, 0.16, 0.85), mat(0xb08a3e));
    band.position.y = -0.6;
    const fist = mesh(jitter(new THREE.BoxGeometry(0.9, 0.7, 0.9), 0.1, 124 + s), mat('stoneDark'));
    fist.position.y = -1.95;
    arm.add(shoulder, fore, band, fist);
    body.add(arm);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  return { root, body, armL, armR, head, core };
}

export function buildStump(seed: number): THREE.Mesh {
  const m = mesh(jitter(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 6), 0.04, seed), mat('trunk'));
  m.position.y = 0.17;
  return m;
}

export function buildDropPile(kind: 'coins' | 'sack' | 'gear' | 'quest', colour: number): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'coins') {
    for (let k = 0; k < 4; k++) {
      const c = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 7), mat(PAL.brass, { emissive: PAL.brass, emissiveIntensity: 0.25 }));
      c.position.set((k % 2) * 0.12 - 0.06, 0.02 + Math.floor(k / 2) * 0.045, (k * 0.07) % 0.12);
      g.add(c);
    }
  } else if (kind === 'sack') {
    const s = mesh(jitter(new THREE.IcosahedronGeometry(0.2, 1), 0.04, 131), mat(0xb59a6a));
    s.scale.y = 0.8;
    s.position.y = 0.15;
    g.add(s);
  } else {
    const box = mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3), mat(kind === 'quest' ? 0x59d0c4 : 'woodDark', kind === 'quest' ? { emissive: 0x59d0c4, emissiveIntensity: 0.8 } : {}));
    box.position.y = 0.14;
    const lid = mesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), mat(colour, { emissive: colour, emissiveIntensity: 0.6 }));
    lid.position.y = 0.31;
    g.add(box, lid);
  }
  return g;
}

/** Ring of ripples for a fishing spot (animated by scaling). */
export function buildRipples(colour = 0xe9f5f2): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, depthWrite: false });
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 20), m.clone());
    r.rotation.x = -Math.PI / 2;
    r.userData.phase = k / 3;
    g.add(r);
  }
  return g;
}
