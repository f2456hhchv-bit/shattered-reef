import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAL, mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

export function buildPine(seed: number, height = 1): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const trunk = mesh(jitter(new THREE.CylinderGeometry(0.12, 0.22, 1.4, 8), 0.035, seed), mat('trunk'));
  trunk.position.y = 0.7;
  g.add(trunk);
  const tiers = [
    [1.45, 1.7, 1.25],
    [1.15, 1.5, 2.05],
    [0.82, 1.3, 2.8],
    [0.48, 1.0, 3.45],
  ];
  tiers.forEach(([r, h, y], i) => {
    const cone = mesh(jitter(new THREE.ConeGeometry(r, h, 10, 2), 0.14, seed + i * 3), mat(i % 2 ? 'pineLight' : 'pine'));
    cone.position.y = y;
    cone.rotation.y = rnd() * Math.PI;
    g.add(cone);
  });
  g.scale.setScalar(height * (0.85 + rnd() * 0.35));
  g.rotation.set((rnd() - 0.5) * 0.08, rnd() * Math.PI, (rnd() - 0.5) * 0.08);
  return g;
}

export function buildBroadleaf(seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const trunk = mesh(jitter(new THREE.CylinderGeometry(0.14, 0.24, 1.8, 9), 0.045, seed), mat('trunk'));
  trunk.position.y = 0.9;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const r = 0.8 + rnd() * 0.5;
    const blob = mesh(jitter(new THREE.IcosahedronGeometry(r, 2), 0.2, seed + i), mat(i % 2 ? 'leafLight' : 'leaf'));
    const a = rnd() * Math.PI * 2;
    blob.position.set(Math.cos(a) * 0.55, 2.2 + rnd() * 0.8, Math.sin(a) * 0.55);
    blob.scale.y = 0.8;
    g.add(blob);
  }
  g.scale.setScalar(0.9 + rnd() * 0.3);
  g.rotation.y = rnd() * Math.PI;
  return g;
}

export function buildRock(seed: number, size = 1, colour: 'stone' | 'stoneDark' = 'stone'): THREE.Mesh {
  const rnd = mulberry32(seed);
  const m = mesh(jitter(new THREE.DodecahedronGeometry(size, 1), size * 0.22, seed), mat(colour));
  m.scale.set(1 + rnd() * 0.4, 0.55 + rnd() * 0.3, 1 + rnd() * 0.3);
  m.rotation.y = rnd() * Math.PI;
  return m;
}

/** A gatherable copper outcrop: stone with ore nodules that read clearly at phone size. */
export function buildOreRock(seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const base = buildRock(seed, 1.0, 'stoneDark');
  base.position.y = 0.3;
  g.add(base);
  for (let i = 0; i < 6; i++) {
    const n = mesh(jitter(new THREE.OctahedronGeometry(0.16 + rnd() * 0.1, 0), 0.05, seed + i), mat('copper', { emissive: PAL.copper, emissiveIntensity: 0.08 }));
    const a = rnd() * Math.PI * 2;
    n.position.set(Math.cos(a) * 0.6, 0.55 + rnd() * 0.25, Math.sin(a) * 0.5);
    g.add(n);
  }
  return g;
}

export function buildCrate(seed: number, s = 0.7): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(jitter(new THREE.BoxGeometry(s, s, s), 0.02, seed), mat('plank'));
  box.position.y = s / 2;
  g.add(box);
  const e = s * 0.08;
  for (const [x, z, w, d] of [[0, s / 2, s + 0.02, e], [0, -s / 2, s + 0.02, e], [s / 2, 0, e, s + 0.02], [-s / 2, 0, e, s + 0.02]] as const) {
    for (const y of [e / 2, s - e / 2]) {
      const bar = mesh(new THREE.BoxGeometry(w, e, d), mat('woodDark'), false);
      bar.position.set(x, y, z);
      g.add(bar);
    }
  }
  return g;
}

export interface Lantern { group: THREE.Group; light: THREE.PointLight }

export function buildLanternPost(): Lantern {
  const g = new THREE.Group();
  const pole = mesh(jitter(new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6), 0.02, 3), mat('woodDark'));
  pole.position.y = 1.2;
  const arm = mesh(new THREE.BoxGeometry(0.55, 0.07, 0.07), mat('woodDark'));
  arm.position.set(0.24, 2.3, 0);
  const cage = mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.3, 6), mat(PAL.glass, { emissive: PAL.glass, emissiveIntensity: 1.6 }), false);
  cage.position.set(0.45, 2.05, 0);
  const cap = mesh(new THREE.ConeGeometry(0.17, 0.14, 6), mat('iron'));
  cap.position.set(0.45, 2.26, 0);
  const light = new THREE.PointLight(0xffa850, 0, 9, 1.6);
  light.position.set(0.45, 2.0, 0);
  g.add(pole, arm, cage, cap, light);
  return { group: g, light };
}

export interface Shack { group: THREE.Group; windowMat: THREE.MeshStandardMaterial }

export function buildShack(seed: number): Shack {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const W = 4.2, D = 3.4, H = 2.2;
  // stone footing: individual blocks so it reads as built, not extruded
  const blocks: THREE.BufferGeometry[] = [];
  for (let x = -W / 2; x < W / 2 - 0.01; x += 0.6) {
    for (const z of [-D / 2, D / 2]) {
      const b = jitter(new THREE.DodecahedronGeometry(0.33, 1), 0.06, seed + Math.round(x * 10) + (z > 0 ? 100 : 0));
      b.scale(0.95, 0.72, 0.8);
      b.translate(x + 0.3, 0.2, z);
      blocks.push(b);
    }
  }
  for (let z = -D / 2 + 0.5; z < D / 2 - 0.3; z += 0.6) {
    for (const x of [-W / 2, W / 2]) {
      const b = jitter(new THREE.DodecahedronGeometry(0.33, 1), 0.06, seed + 300 + Math.round(z * 10) + (x > 0 ? 50 : 0));
      b.scale(0.8, 0.72, 0.95);
      b.translate(x, 0.2, z + 0.3);
      blocks.push(b);
    }
  }
  g.add(mesh(mergeGeometries(blocks), mat('stone')));

  // plank walls (vertical boards with slight colour variation)
  const wallA: THREE.BufferGeometry[] = [], wallB: THREE.BufferGeometry[] = [];
  for (let x = -W / 2 + 0.15; x < W / 2; x += 0.3) {
    for (const z of [-D / 2 + 0.05, D / 2 - 0.05]) {
      const b = new THREE.BoxGeometry(0.29, H, 0.08);
      b.translate(x, 0.4 + H / 2 + (rnd() - 0.5) * 0.04, z);
      (rnd() > 0.5 ? wallA : wallB).push(b);
    }
  }
  for (let z = -D / 2 + 0.15; z < D / 2; z += 0.3) {
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
      const b = new THREE.BoxGeometry(0.08, H, 0.29);
      b.translate(x, 0.4 + H / 2, z);
      (rnd() > 0.5 ? wallA : wallB).push(b);
    }
  }
  g.add(mesh(mergeGeometries(wallA), mat('plank')));
  g.add(mesh(mergeGeometries(wallB), mat('plankWorn')));

  // gable ends
  const gable = new THREE.Shape();
  gable.moveTo(-D / 2, 0);
  gable.lineTo(D / 2, 0);
  gable.lineTo(0, 1.3);
  gable.lineTo(-D / 2, 0);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
    const gm = mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.08, bevelEnabled: false }), mat('plankWorn'));
    gm.rotation.y = Math.PI / 2;
    gm.position.set(x - 0.04, 0.4 + H, 0);
    g.add(gm);
  }

  // corner posts
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as const) {
    const p = mesh(jitter(new THREE.CylinderGeometry(0.11, 0.13, H + 0.1, 10), 0.012, seed + Math.round(x * 7 + z)), mat('woodDark'));
    p.position.set(x, 0.4 + H / 2, z);
    g.add(p);
  }

  // roof: two slabs with overhang, shingle rows for texture-by-geometry
  const slope = Math.atan2(1.3, D / 2);
  const slabLen = Math.hypot(1.3, D / 2) + 0.5;
  for (const s of [-1, 1]) {
    const roofSide = new THREE.Group();
    roofSide.position.set(0, 0.4 + H + 1.3, 0);
    roofSide.rotation.x = s * slope;
    for (let r = 0; r < 5; r++) {
      const row = mesh(jitter(new THREE.BoxGeometry(W + 0.7, 0.1, slabLen / 5 + 0.08), 0.03, seed + r * 7 + s), mat(r % 2 ? 'roof' : 0x4f4050));
      row.position.set(0, -r * 0.02, s * (slabLen / 5) * (r + 0.5));
      roofSide.add(row);
    }
    g.add(roofSide);
  }
  const ridge = mesh(new THREE.CylinderGeometry(0.1, 0.1, W + 0.8, 10), mat('woodDark'));
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = 0.4 + H + 1.36;
  g.add(ridge);

  // chimney
  // chimney: a stack of rounded stones, narrowing to a lip
  for (let k = 0; k < 5; k++) {
    const st = mesh(jitter(new THREE.CylinderGeometry(0.3 - k * 0.012, 0.32 - k * 0.012, 0.34, 12), 0.04, seed + 77 + k), mat(k % 2 ? 'stone' : 'stoneDark'));
    st.position.set(W / 2 - 0.8, 0.4 + H + 0.65 + k * 0.32, -0.5);
    st.rotation.y = k * 0.7;
    g.add(st);
  }

  // door + window on the front (+z)
  // arched door
  const ds = new THREE.Shape();
  ds.moveTo(-0.45, 0); ds.lineTo(0.45, 0); ds.lineTo(0.45, 1.15); ds.absarc(0, 1.15, 0.45, 0, Math.PI, false); ds.lineTo(-0.45, 0);
  const door = mesh(new THREE.ExtrudeGeometry(ds, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 }), mat('woodDark'));
  door.position.set(-0.8, 0.4, D / 2 - 0.02);
  const handle = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('brass'));
  handle.position.set(-0.5, 1.2, D / 2 + 0.07);
  const windowMat = mat(PAL.glass, { emissive: PAL.glass, emissiveIntensity: 0.2 }).clone();
  const win = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), windowMat, false);
  win.position.set(0.9, 1.6, D / 2 + 0.03);
  const frameH = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), mat('woodDark'));
  frameH.rotation.z = Math.PI / 2;
  frameH.position.set(0.9, 1.6, D / 2 + 0.05);
  const frameV = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), mat('woodDark'));
  frameV.position.set(0.9, 1.6, D / 2 + 0.05);
  const sill = mesh(new THREE.CapsuleGeometry(0.05, 0.9, 3, 8), mat('woodDark'));
  sill.rotation.z = Math.PI / 2;
  sill.position.set(0.9, 1.27, D / 2 + 0.08);
  g.add(door, handle, win, frameH, frameV, sill);
  return { group: g, windowMat };
}

export interface Dock { group: THREE.Group; bollards: THREE.Vector3[] }

/** Dock: stem from (x, zStart) heading +z for `length`, then a T-head of `headWidth` along x. Deck at y = deckY. */
export function buildDock(x: number, zStart: number, length: number, headWidth: number, deckY: number, seed: number): Dock {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const width = 2.4;
  const planksA: THREE.BufferGeometry[] = [], planksB: THREE.BufferGeometry[] = [];
  const addPlank = (px: number, pz: number, w: number, d: number) => {
    const b = new THREE.BoxGeometry(w, 0.12, d);
    b.rotateY((rnd() - 0.5) * 0.03);
    b.translate(px, deckY + (rnd() - 0.5) * 0.03, pz);
    (rnd() > 0.45 ? planksA : planksB).push(b);
  };
  for (let z = zStart; z < zStart + length; z += 0.36) addPlank(x, z, width + (rnd() - 0.5) * 0.15, 0.32);
  const headZ = zStart + length;
  for (let px = x - headWidth / 2; px < x + headWidth / 2; px += 0.36) addPlank(px, headZ + 1.0, 0.32, 2.2 + (rnd() - 0.5) * 0.15);
  g.add(mesh(mergeGeometries(planksA), mat('plank')));
  g.add(mesh(mergeGeometries(planksB), mat('plankWorn')));

  const posts: THREE.BufferGeometry[] = [];
  const postAt = (px: number, pz: number, top: number) => {
    const p = jitter(new THREE.CylinderGeometry(0.13, 0.16, top + 4, 6), 0.03, Math.round(px * 13 + pz * 7));
    p.translate(px, (top - 4) / 2, pz);
    posts.push(p);
  };
  for (let z = zStart + 1; z <= headZ; z += 2.4) {
    postAt(x - width / 2 - 0.05, z, deckY + 0.05);
    postAt(x + width / 2 + 0.05, z, deckY + 0.05);
  }
  const bollards: THREE.Vector3[] = [];
  for (let px = x - headWidth / 2; px <= x + headWidth / 2 + 0.01; px += headWidth / 3) {
    postAt(px, headZ + 2.15, deckY + 0.45);
    bollards.push(new THREE.Vector3(px, deckY + 0.4, headZ + 2.15));
    postAt(px, headZ - 0.1, deckY + 0.05);
  }
  g.add(mesh(mergeGeometries(posts), mat('woodDark')));

  // stringers under the stem
  for (const s of [-1, 1]) {
    const beam = mesh(new THREE.BoxGeometry(0.16, 0.2, length), mat('woodDark'));
    beam.position.set(x + s * (width / 2 - 0.2), deckY - 0.16, zStart + length / 2);
    g.add(beam);
  }
  return { group: g, bollards };
}

export function rope(a: THREE.Vector3, b: THREE.Vector3, sag = 0.5): THREE.Mesh {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return mesh(new THREE.TubeGeometry(curve, 10, 0.035, 4), mat('rope'), true, false);
}

/** Instanced grass tufts (one draw call). */
export function buildGrass(points: THREE.Vector3[], seed: number): THREE.InstancedMesh {
  const rnd = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.ConeGeometry(0.06, 0.38 + i * 0.05, 3);
    c.translate(0, 0.19, 0);
    c.rotateZ((i - 1.5) * 0.25);
    c.rotateY(i * 1.7);
    c.translate(Math.cos(i * 2) * 0.06, 0, Math.sin(i * 2) * 0.06);
    parts.push(c);
  }
  const geo = mergeGeometries(parts);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const uniforms = { uTime: { value: 0 } };
  // wind: tips sway, roots stay put; phase varies per instance
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
      transformed.x += sin(uTime * 1.7 + ph) * position.y * 0.18;
      transformed.z += cos(uTime * 1.3 + ph) * position.y * 0.1;`);
  };
  const m = new THREE.InstancedMesh(geo, material, points.length);
  m.userData.uniforms = uniforms;
  const o = new THREE.Object3D();
  const base = new THREE.Color(PAL.grassTuft);
  const c = new THREE.Color();
  points.forEach((p, i) => {
    o.position.copy(p);
    o.rotation.y = rnd() * Math.PI * 2;
    o.scale.setScalar(0.7 + rnd() * 0.7);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    c.copy(base).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08);
    m.setColorAt(i, c);
  });
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

export function buildBuoy(): THREE.Group {
  const g = new THREE.Group();
  const float = mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 8), mat(PAL.hullRed));
  const band = mesh(new THREE.CylinderGeometry(0.43, 0.46, 0.16, 8), mat('shirt'));
  band.position.y = 0.12;
  const cage = mesh(new THREE.ConeGeometry(0.3, 0.9, 4), mat(PAL.hullRed));
  cage.position.y = 0.7;
  const bell = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 6), mat('brass'));
  bell.position.y = 0.5;
  g.add(float, band, cage, bell);
  return g;
}
