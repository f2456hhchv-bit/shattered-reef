import * as THREE from 'three';
import { mat, mesh, jitter } from '../materials';
import { mulberry32 } from '../noise';

// Cave and temple pieces: the mouth in an island's hillside, the rope back up, webs, glowing crystals, wall torches,
// stalagmites and the magma pool. Flames are tagged `userData.flame` so the renderer can flicker them.

const flameMat = () => new THREE.MeshBasicMaterial({ color: 0xffb04a });

/** A dark opening in a heap of boulders, facing +x (rot turns it like any prop). */
export function buildCaveMouth(seed = 31): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  // the opening: a black half-dome set into the rock, so it reads as depth from above
  const hole = mesh(new THREE.SphereGeometry(1.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050405 }), false, false);
  hole.scale.set(0.8, 1.15, 1.1);
  hole.position.set(0.3, -0.05, 0);
  g.add(hole);
  // the arch of rocks round it, bigger behind
  for (let k = 0; k < 11; k++) {
    const a = Math.PI * 0.55 + (k / 10) * Math.PI * 0.9, r = 1.55 + rnd() * 0.25, s = 0.55 + rnd() * 0.45 + (Math.abs(a - Math.PI) < 0.6 ? 0.35 : 0);
    const rock = mesh(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.18, seed + k), mat(k % 3 ? 'stoneDark' : 'stone'));
    rock.position.set(Math.cos(a) * r * 0.85 + 0.2, s * 0.55 + (Math.abs(a - Math.PI) < 0.5 ? 0.9 : 0), Math.sin(a) * r);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(rock);
  }
  const lintel = mesh(jitter(new THREE.DodecahedronGeometry(0.9, 0), 0.15, seed + 40), mat('stoneDark'));
  lintel.scale.set(0.9, 0.6, 1.6);
  lintel.position.set(-0.3, 1.75, 0);
  g.add(lintel);
  // a lantern on a stake: someone comes and goes
  const stake = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5), mat('woodDark'));
  stake.position.set(1.4, 0.55, 1.2);
  const lamp = mesh(new THREE.OctahedronGeometry(0.12, 0), mat('glass', { emissive: 0xffc26b, emissiveIntensity: 1.6 }));
  lamp.position.set(1.4, 1.15, 1.2);
  g.add(stake, lamp);
  return g;
}

/** The rope up to daylight: a shaft of pale light falling on a coil of rope. */
export function buildRope(): THREE.Group {
  const g = new THREE.Group();
  const rope = mesh(new THREE.CylinderGeometry(0.045, 0.045, 5, 5), mat('rope'));
  rope.position.y = 2.5;
  const coil = mesh(new THREE.TorusGeometry(0.28, 0.07, 5, 10), mat('rope'));
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 0.08;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  shaft.position.y = 3.4;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.04;
  g.add(rope, coil, shaft, pool);
  return g;
}

/** A sheet of web strung between stalks, low to the ground. */
export function buildWeb(seed = 1): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const silk = new THREE.MeshBasicMaterial({ color: 0xe8e6dc, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const R = 1.1, spokes = 7, pts: number[] = [];
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    pts.push(0, 0, 0, Math.cos(a) * R, 0, Math.sin(a) * R);
    for (const rr of [0.35, 0.65, 0.95]) {
      const b = ((k + 1) / spokes) * Math.PI * 2;
      pts.push(Math.cos(a) * R * rr, 0, Math.sin(a) * R * rr, Math.cos(b) * R * rr, 0, Math.sin(b) * R * rr);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const web = new THREE.LineSegments(geo, silk);
  web.rotation.set(-0.5 + rnd() * 0.3, rnd() * 6, 0);
  web.position.y = 0.6;
  // a wrapped bundle: something caught
  const cocoon = mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xd8d4c8));
  cocoon.scale.set(0.8, 0.8, 1.5);
  cocoon.position.set(0.3, 0.2, 0.2);
  g.add(web, cocoon);
  return g;
}

/** A cluster of glowing crystals (the grotto's light). */
export function buildCrystal(seed = 1, colour = 0x6ad8e8): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const glow = mat(colour, { emissive: colour, emissiveIntensity: 1.3 });
  for (let k = 0; k < 5; k++) {
    const h = 0.4 + rnd() * 0.7;
    const c = mesh(new THREE.ConeGeometry(0.1 + rnd() * 0.08, h, 5), glow, false);
    c.position.set((rnd() - 0.5) * 0.5, h / 2 - 0.05, (rnd() - 0.5) * 0.5);
    c.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
    g.add(c);
  }
  const base = mesh(jitter(new THREE.DodecahedronGeometry(0.35, 0), 0.08, seed), mat('stoneDark'));
  base.scale.y = 0.45;
  g.add(base);
  return g;
}

/** A torch on an iron stand. */
export function buildCaveTorch(): THREE.Group {
  const g = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), mat('iron'));
  post.position.y = 0.75;
  const cup = mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.18, 6), mat('iron'));
  cup.position.y = 1.55;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 6), flameMat());
  flame.position.y = 1.8;
  flame.userData.flame = true;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  core.position.y = 1.74;
  core.userData.flame = true;
  g.add(post, cup, flame, core);
  return g;
}

export function buildStalagmite(seed = 1): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) {
    const h = 0.8 + rnd() * 1.4;
    const c = mesh(jitter(new THREE.ConeGeometry(0.22 + rnd() * 0.15, h, 6), 0.04, seed + k), mat(k ? 'stoneDark' : 0x5a5450));
    c.position.set((rnd() - 0.5) * 0.6, h / 2 - 0.1, (rnd() - 0.5) * 0.6);
    g.add(c);
  }
  return g;
}

/** A pool of magma: glowing, crusted at the edge. */
export function buildLava(radius: number, seed = 9): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry32(seed);
  const pool = mesh(new THREE.CircleGeometry(radius, 20), mat(0xff6a1a, { emissive: 0xff5a10, emissiveIntensity: 1.8 }), false);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.12;
  g.add(pool);
  for (let k = 0; k < 7; k++) {
    const a = rnd() * 6.28, r = rnd() * radius * 0.7, s = 0.2 + rnd() * 0.35;
    const crust = mesh(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.2, seed + k), mat(0x2a1a14));
    crust.scale.y = 0.3;
    crust.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r);
    g.add(crust);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * 6.28, s = 0.35 + rnd() * 0.3;
    const rim = mesh(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.2, seed + 20 + k), mat('stoneDark'));
    rim.position.set(Math.cos(a) * (radius + 0.1), 0.1, Math.sin(a) * (radius + 0.1));
    g.add(rim);
  }
  return g;
}

/** The Sunken Temple's gong: a bronze disc hung between carved posts. */
export function buildGong(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), mat('stoneDark'));
    post.position.set(0.95 * s, 1.1, 0);
    const cap = mesh(new THREE.ConeGeometry(0.2, 0.3, 4), mat('stone'));
    cap.position.set(0.95 * s, 2.35, 0);
    cap.rotation.y = Math.PI / 4;
    g.add(post, cap);
  }
  const beam = mesh(new THREE.BoxGeometry(2.3, 0.2, 0.24), mat('woodDark'));
  beam.position.y = 2.05;
  const disc = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 18), mat(0xc8902a));
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 1.25;
  const boss = mesh(new THREE.SphereGeometry(0.16, 10, 6), mat(0xe8b83a));
  boss.scale.z = 0.4;
  boss.position.set(0, 1.25, 0.04);
  for (const s of [-1, 1]) { const cord = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4), mat('rope')); cord.position.set(0.35 * s, 1.92, 0); g.add(cord); }
  const base = mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.18, 8), mat('stone'));
  base.position.y = 0.09;
  g.add(beam, disc, boss, base);
  return g;
}
