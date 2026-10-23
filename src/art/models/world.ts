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
  const glow = new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 2.2, flatShading: false });
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
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff7a1a, emissiveIntensity: 2.5, flatShading: false });
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
  // canvas draped over a ridge: the cross-section sags between pole and pegs, the ends bell outward
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(2.8, 3.2, 14, 12);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / 1.4, v = pos.getY(i) / 1.6; // u: -1..1 across, v: -1..1 along
    const across = Math.abs(u);
    const sag = Math.sin(across * Math.PI) * 0.18; // cloth droops between ridge and ground
    const flare = 1 + Math.abs(v) ** 3 * 0.12;
    pos.setXYZ(i, Math.sign(u) * across * 1.35 * flare, (1 - across) * 1.95 - sag - Math.abs(v) ** 4 * 0.12, v * 1.55);
  }
  geo.computeVertexNormals();
  const cloth = mesh(geo, mat(rnd() > 0.5 ? 0x8a5a44 : 0x6f6450, { side: THREE.DoubleSide }));
  const back = mesh(new THREE.CircleGeometry(1.1, 3, Math.PI / 6), mat(0x5a4a3a, { side: THREE.DoubleSide }));
  back.scale.set(1.2, 1.0, 1);
  back.position.set(0, 0.55, -1.5);
  const flap = mesh(new THREE.CircleGeometry(0.7, 3, Math.PI / 6), mat(0x2a211b, { side: THREE.DoubleSide }));
  flap.position.set(0, 0.36, 1.52);
  const ridge = mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 8), mat('woodDark'));
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 1.95;
  const poleF = mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.2, 8), mat('woodDark'));
  poleF.position.set(0, 1.0, 1.62);
  const poleB = poleF.clone();
  poleB.position.z = -1.62;
  g.add(cloth, back, flap, ridge, poleF, poleB);
  return g;
}

export function buildSmithyShed(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-2.4, -1.7], [2.4, -1.7], [-2.4, 1.7], [2.4, 1.7]] as const) {
    const p = mesh(jitter(new THREE.CylinderGeometry(0.12, 0.15, 2.6, 10), 0.015, Math.round(x * 10 + z)), mat('woodDark'));
    p.position.set(x, 1.3, z);
    g.add(p);
  }
  // roof: a gently arched shell of tiles, lower at the back
  const roofGeo = new THREE.CylinderGeometry(6, 6, 5.6, 24, 1, true, -0.38, 0.76);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = mesh(roofGeo, mat('roof', { side: THREE.DoubleSide }));
  roof.position.set(0, 2.72 - 6 + 0.05, 0);
  roof.rotation.x = -0.12;
  g.add(roof);
  const beam = mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 10), mat('woodDark'));
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 2.6, 1.7);
  const beamB = beam.clone();
  beamB.position.z = -1.7;
  const back = mesh(jitter(new THREE.CapsuleGeometry(0.42, 4.4, 4, 10), 0.03, 92), mat('plankWorn'));
  back.rotation.z = Math.PI / 2;
  back.scale.set(1.2, 1, 0.25);
  back.position.set(0, 0.5, -1.75);
  g.add(beam, beamB, back);
  return g;
}

export function buildPillar(seed: number, height: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const col = mesh(jitter(new THREE.CylinderGeometry(0.55, 0.64, height * 3, 14, 4), 0.06, seed), mat('stone'));
  col.position.y = (height * 3) / 2;
  col.rotation.z = (rnd() - 0.5) * 0.12;
  const base = mesh(jitter(new THREE.LatheGeometry([[0, 0.4], [0.7, 0.4], [0.85, 0.22], [0.9, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 14), 0.05, seed + 1), mat('stoneDark'));
  g.add(base, col);
  if (height > 0.9) {
    const cap = mesh(jitter(new THREE.LatheGeometry([[0, 0.34], [0.78, 0.34], [0.8, 0.2], [0.6, 0.0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 14), 0.04, seed + 2), mat('stoneDark'));
    cap.position.y = height * 3;
    g.add(cap);
  }
  // teal glyph band: the Locks' visual signature
  const glyph = mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 24), mat(0x2f9a92, { emissive: 0x59d0c4, emissiveIntensity: 0.6 }), false, false);
  glyph.rotation.x = Math.PI / 2;
  glyph.position.y = 1.0;
  g.add(glyph);
  return g;
}

export function buildPlinth(): THREE.Group {
  const g = new THREE.Group();
  const block = mesh(jitter(new THREE.LatheGeometry([[0, 1.0], [0.62, 1.0], [0.72, 0.9], [0.62, 0.75], [0.58, 0.2], [0.75, 0.08], [0.78, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 16), 0.03, 101), mat('stoneDark'));
  // the bell-shaped hollow
  const hollow = mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.12, 16), mat(0x101a1c, { emissive: 0x59d0c4, emissiveIntensity: 0.35 }), false);
  hollow.position.y = 1.03;
  g.add(block, hollow);
  return g;
}

export interface GuardianRig { root: THREE.Group; body: THREE.Group; armL: THREE.Group; armR: THREE.Group; head: THREE.Group; core: THREE.MeshStandardMaterial }

export function buildGuardian(): GuardianRig {
  // An ancient brass-bound stone automaton: turned and weathered forms, no blocks.
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const core = new THREE.MeshStandardMaterial({ color: 0x59d0c4, emissive: 0x59d0c4, emissiveIntensity: 1.6, flatShading: false });
  const brass = mat(0xb08a3e);
  const turned = (pts: [number, number][], seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const stone = (geo: THREE.BufferGeometry, seed: number, k: 'stone' | 'stoneDark' = 'stone') => mesh(jitter(geo, 0.035, seed), mat(k));
  for (const s of [-1, 1]) {
    // legs: squat carved columns with a plinth foot and a brass knee ring
    const leg = stone(turned([[0, 1.15], [0.3, 1.12], [0.34, 0.9], [0.3, 0.45], [0.42, 0.25], [0.46, 0.0], [0, 0]], 14), 110 + s, 'stoneDark');
    leg.position.set(0.52 * s, 0, 0);
    leg.scale.z = 0.9;
    const knee = mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 18), brass);
    knee.position.set(0.52 * s, 0.72, 0);
    knee.rotation.x = Math.PI / 2;
    body.add(leg, knee);
  }
  // torso: a broad turned barrel, flattened front to back, belted in brass
  const torso = stone(turned([[0, 2.75], [0.55, 2.7], [0.95, 2.45], [1.05, 2.0], [0.92, 1.5], [0.72, 1.2], [0, 1.15]], 20), 113);
  torso.scale.z = 0.68;
  const belt = mesh(new THREE.TorusGeometry(0.78, 0.07, 8, 28), brass);
  belt.scale.set(1, 0.68, 1);
  belt.position.y = 1.32;
  belt.rotation.x = Math.PI / 2;
  // brass chest plate: a domed shield with a keyhole of light
  const plate = mesh(new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), brass);
  plate.rotation.x = Math.PI / 2;
  plate.scale.set(1, 0.55, 1.1);
  plate.position.set(0, 1.98, 0.38);
  const keyRing = mesh(new THREE.SphereGeometry(0.11, 14, 10), core, false);
  keyRing.position.set(0, 2.08, 0.72);
  const keySlot = mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 10), core, false);
  keySlot.position.set(0, 1.88, 0.72);
  // the chest-bell on its back
  const bell = mesh(turned([[0.08, 0.55], [0.18, 0.5], [0.24, 0.3], [0.3, 0.08], [0.38, 0.0], [0.3, 0.02], [0.08, 0.5]], 18), brass);
  bell.position.set(0, 2.62, -0.32);
  body.add(torso, belt, plate, keyRing, keySlot, bell);
  // head: a rounded helm-like dome with a glowing visor slit
  const head = new THREE.Group();
  head.position.y = 2.72;
  const skull = stone(new THREE.SphereGeometry(0.42, 18, 12), 115, 'stoneDark');
  skull.scale.set(1, 0.82, 0.95);
  skull.position.set(0, 0.25, 0.3);
  const crest = mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 24, Math.PI), brass);
  crest.position.set(0, 0.25, 0.3);
  crest.rotation.y = Math.PI / 2;
  const visor = mesh(new THREE.CapsuleGeometry(0.045, 0.36, 4, 10), core, false);
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, 0.27, 0.68);
  head.add(skull, crest, visor);
  body.add(head);
  const mkArm = (s: number) => {
    const arm = new THREE.Group();
    arm.position.set(1.22 * s, 2.45, 0);
    const shoulder = stone(new THREE.SphereGeometry(0.52, 16, 12), 120 + s, 'stoneDark');
    const pauldron = mesh(new THREE.SphereGeometry(0.56, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), brass);
    pauldron.position.y = 0.06;
    const fore = stone(turned([[0, 0.05], [0.34, 0.0], [0.4, -0.5], [0.34, -1.2], [0.42, -1.45], [0, -1.5]], 14), 122 + s);
    fore.position.y = -0.35;
    const band = mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 20), brass);
    band.position.y = -0.85;
    band.rotation.x = Math.PI / 2;
    const fist = stone(new THREE.SphereGeometry(0.5, 16, 12), 124 + s, 'stoneDark');
    fist.scale.set(1, 0.85, 1);
    fist.position.y = -1.95;
    arm.add(shoulder, pauldron, fore, band, fist);
    for (let k = 0; k < 4; k++) { // knuckles
      const kn = stone(new THREE.SphereGeometry(0.13, 10, 8), 130 + k + s * 10, 'stoneDark');
      kn.position.set((k - 1.5) * 0.2, -2.05, 0.38);
      arm.add(kn);
    }
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

export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(jitter(new THREE.BoxGeometry(1.8, 0.12, 0.85), 0.02, 141), mat('woodLight'));
  top.position.y = 0.85;
  g.add(top);
  for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]] as const) {
    const leg = mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), mat('woodDark'));
    leg.position.set(x, 0.42, z);
    g.add(leg);
  }
  const vice = mesh(new THREE.BoxGeometry(0.25, 0.22, 0.3), mat('iron'));
  vice.position.set(-0.6, 1.02, 0.1);
  const barrel = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), mat('iron'));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.1, 0.96, 0.1);
  const stock = mesh(new THREE.BoxGeometry(0.35, 0.08, 0.12), mat('wood'));
  stock.position.set(0.55, 0.95, 0.1);
  const powder = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.26, 7), mat(0x3a2a1e));
  powder.position.set(0.6, 1.04, -0.22);
  g.add(vice, barrel, stock, powder);
  return g;
}
