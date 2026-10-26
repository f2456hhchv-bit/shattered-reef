import * as THREE from 'three';
import { PAL, mat, mesh, jitter } from '../materials';

// The Sloop: single mast, gaff mainsail + jib. Bow points along +x. Waterline at y = 0.

const LENGTH = 8.4;
const BEAM = 1.45; // half-width

function halfWidth(t: number): number {
  if (t < 0.42) return BEAM * (0.72 + 0.28 * Math.sin((t / 0.42) * Math.PI * 0.5));
  return Math.max(0.05, BEAM * Math.pow(Math.max(0, Math.cos(((t - 0.42) / 0.58) * Math.PI * 0.5)), 0.75));
}
const sheer = (t: number) => 0.85 + 1.4 * (t - 0.42) * (t - 0.42) + (t > 0.8 ? (t - 0.8) * 0.6 : 0);
const keel = (t: number) => -0.85 + (t > 0.82 ? (t - 0.82) * 2.6 : 0) + (t < 0.06 ? (0.06 - t) * 4 : 0);

function buildHull(stripe: number): THREE.BufferGeometry {
  const S = 14;
  const rings: THREE.Vector3[][] = [];
  const inner: THREE.Vector3[][] = [];
  for (let s = 0; s <= S; s++) {
    const t = s / S;
    const x = -LENGTH / 2 + t * LENGTH;
    const w = halfWidth(t), sh = sheer(t), k = keel(t);
    const wall = 0.32;
    // right side profile, top -> keel
    const right = [
      new THREE.Vector3(x, sh + wall, w),
      new THREE.Vector3(x, sh, w * 1.0),
      new THREE.Vector3(x, sh - 0.55, w * 0.94),
      new THREE.Vector3(x, (sh - 0.55 + k) * 0.5 - 0.05, w * 0.72),
      new THREE.Vector3(x, k, w * 0.28),
      new THREE.Vector3(x, k - 0.18, 0),
    ];
    const left = right.slice(0, -1).reverse().map((v) => new THREE.Vector3(v.x, v.y, -v.z));
    rings.push([...right, ...left]);
    const iw = Math.max(0.02, w - 0.12);
    inner.push([new THREE.Vector3(x, sh + wall, iw), new THREE.Vector3(x, sh - 0.02, iw), new THREE.Vector3(x, sh - 0.02, -iw), new THREE.Vector3(x, sh + wall, -iw)]);
  }

  const pos: number[] = [];
  const col: number[] = [];
  const cStripe = new THREE.Color(stripe), cHull = new THREE.Color(PAL.woodDark), cBottom = new THREE.Color(PAL.hullRed);
  const cDeck = new THREE.Color(PAL.plank), cDeckAlt = new THREE.Color(PAL.plankWorn), cRail = new THREE.Color(PAL.wood), cInner = new THREE.Color(PAL.woodLight);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
  };
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color) => {
    tri(a, c, b, color);
    tri(a, d, c, color);
  };

  for (let s = 0; s < S; s++) {
    const A = rings[s], B = rings[s + 1];
    for (let k = 0; k < A.length - 1; k++) {
      const yAvg = (A[k].y + A[k + 1].y) / 2;
      const color = k === 0 || k === A.length - 2 ? cStripe : yAvg < 0.05 ? cBottom : cHull;
      // outward winding: right side (z>0) vs left handled by ring ordering
      quad(A[k], B[k], B[k + 1], A[k + 1], color);
    }
    const I = inner[s], J = inner[s + 1];
    quad(A[0], I[0], J[0], B[0], cRail); // rail cap right
    quad(I[0], I[1], J[1], J[0], cInner); // inner bulwark right
    // deck, split into planks with alternating tones (texture through geometry, no bitmaps)
    const strips = 9;
    for (let k = 0; k < strips; k++) {
      const a0 = k / strips, a1 = (k + 1) / strips;
      const p0 = new THREE.Vector3().lerpVectors(I[1], I[2], a0), p1 = new THREE.Vector3().lerpVectors(I[1], I[2], a1);
      const q0 = new THREE.Vector3().lerpVectors(J[1], J[2], a0), q1 = new THREE.Vector3().lerpVectors(J[1], J[2], a1);
      quad(p0, p1, q1, q0, k % 2 ? cDeck : cDeckAlt);
    }
    quad(I[2], I[3], J[3], J[2], cInner); // inner bulwark left
    const last = A.length - 1;
    quad(A[last], B[last], J[3], I[3], cRail); // rail cap left
  }
  // transom
  const T = rings[0];
  const centre = new THREE.Vector3(T[0].x, (T[0].y + T[5].y) / 2, 0);
  for (let k = 0; k < T.length - 1; k++) tri(centre, T[k + 1], T[k], k === 0 || k === T.length - 2 ? cStripe : cHull);
  tri(centre, T[0], T[T.length - 1], cHull);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function sailGeometry(corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3], bulge: number, seg = 6): THREE.BufferGeometry {
  // bilinear patch: c0 bottom-front, c1 bottom-back, c2 top-back, c3 top-front
  const [c0, c1, c2, c3] = corners;
  const geo = new THREE.PlaneGeometry(1, 1, seg, seg);
  const pos = geo.getAttribute('position');
  const p = new THREE.Vector3(), lo = new THREE.Vector3(), hi = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, v = pos.getY(i) + 0.5;
    lo.lerpVectors(c0, c1, u);
    hi.lerpVectors(c3, c2, u);
    p.lerpVectors(lo, hi, v);
    p.z += Math.sin(u * Math.PI) * Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.9 + 0.15) * bulge;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface ShipRig {
  root: THREE.Group;
  hull: THREE.Group;
}

export function buildSloop(stripe: number = PAL.teal): ShipRig {
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  const hullMesh = mesh(buildHull(stripe), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  hull.add(hullMesh);

  const mastT = 0.56;
  const mastX = -LENGTH / 2 + mastT * LENGTH;
  const deckY = sheer(mastT);
  const mastH = 7.4;
  const mast = mesh(new THREE.CylinderGeometry(0.09, 0.14, mastH, 7), mat('wood'));
  mast.position.set(mastX, deckY + mastH / 2, 0);
  hull.add(mast);

  // boom + gaff
  const boomLen = 4.0;
  const boom = mesh(new THREE.CylinderGeometry(0.07, 0.07, boomLen, 6), mat('wood'));
  boom.rotation.z = Math.PI / 2;
  boom.position.set(mastX - boomLen / 2, deckY + 1.35, 0);
  hull.add(boom);

  const sailCorners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(mastX - 0.12, deckY + 1.45, 0),
    new THREE.Vector3(mastX - boomLen + 0.15, deckY + 1.45, 0),
    new THREE.Vector3(mastX - boomLen + 0.6, deckY + 6.3, 0),
    new THREE.Vector3(mastX - 0.12, deckY + 5.6, 0),
  ];
  const gaffLen = sailCorners[2].distanceTo(sailCorners[3]);
  const gaff = mesh(new THREE.CylinderGeometry(0.06, 0.06, gaffLen, 6), mat('wood'));
  gaff.position.copy(sailCorners[2]).add(sailCorners[3]).multiplyScalar(0.5);
  gaff.lookAt(sailCorners[2]);
  gaff.rotateX(Math.PI / 2);
  hull.add(gaff);

  const sailMat = mat('sail', { side: THREE.DoubleSide });
  const main = mesh(sailGeometry(sailCorners, 0.55), sailMat, true, false);
  hull.add(main);
  // reef bands (structure the big white shape)
  for (const v of [0.22, 0.38]) {
    const a = new THREE.Vector3().lerpVectors(sailCorners[0], sailCorners[3], v);
    const b = new THREE.Vector3().lerpVectors(sailCorners[1], sailCorners[2], v);
    const band = mesh(new THREE.BoxGeometry(a.distanceTo(b), 0.08, 0.02), mat('sailPatch', { side: THREE.DoubleSide }), false, false);
    band.position.copy(a).add(b).multiplyScalar(0.5);
    band.position.z += Math.sin(v * Math.PI) * 0.35 + 0.18;
    band.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    hull.add(band);
  }

  // bowsprit + jib
  const bowX = LENGTH / 2;
  const bowY = sheer(1);
  const sprit = mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.4, 6), mat('wood'));
  sprit.rotation.z = Math.PI / 2 - 0.18;
  sprit.position.set(bowX + 0.8, bowY + 0.25, 0);
  hull.add(sprit);
  const jib = mesh(
    sailGeometry([
      new THREE.Vector3(mastX + 1.0, deckY + 1.2, 0),
      new THREE.Vector3(bowX + 1.85, bowY + 0.48, 0),
      new THREE.Vector3(mastX + 0.18, deckY + 6.6, 0),
      new THREE.Vector3(mastX + 0.18, deckY + 6.6, 0),
    ], 0.35, 5),
    sailMat,
    true,
    false,
  );
  hull.add(jib);

  // cabin at stern
  const cabin = mesh(jitter(new THREE.BoxGeometry(1.7, 0.6, 1.7), 0.03, 4), mat('woodLight'));
  cabin.position.set(-LENGTH / 2 + 1.35, sheer(0.16) + 0.25, 0);
  hull.add(cabin);
  const cabinRoof = mesh(new THREE.BoxGeometry(1.85, 0.1, 1.85), mat('woodDark'));
  cabinRoof.position.set(cabin.position.x, cabin.position.y + 0.33, 0);
  hull.add(cabinRoof);
  const hatchCol = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(PAL.glass, { emissive: PAL.glass, emissiveIntensity: 0.4 }), false);
  hatchCol.position.set(cabin.position.x, cabin.position.y + 0.39, 0);
  hull.add(hatchCol);

  // tiller
  const tiller = mesh(new THREE.BoxGeometry(1.0, 0.07, 0.07), mat('woodDark'));
  tiller.position.set(-LENGTH / 2 + 0.25, sheer(0.02) + 0.35, 0);
  tiller.rotation.z = 0.15;
  hull.add(tiller);

  // cargo on deck
  for (const [dx, dz] of [[1.3, 0.55], [1.3, -0.5], [1.85, 0.1]] as const) {
    const barrel = buildBarrel(0.32, 0.6);
    barrel.position.set(mastX + dx, sheer(mastT + dx / LENGTH), dz);
    hull.add(barrel);
  }
  const coil = mesh(new THREE.TorusGeometry(0.22, 0.07, 5, 10), mat('rope'));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(mastX - 0.6, deckY + 0.06, -0.6);
  hull.add(coil);

  // pennant
  const flag = mesh(new THREE.ConeGeometry(0.28, 1.3, 3), mat(stripe, { side: THREE.DoubleSide }), true, false);
  flag.rotation.z = Math.PI / 2;
  flag.scale.set(1, 1, 0.12);
  flag.position.set(mastX - 0.7, deckY + mastH - 0.25, 0);
  hull.add(flag);

  // standing rigging: a few chunky lines, not a cobweb
  const ropeMat = mat('woodDark');
  const top = new THREE.Vector3(mastX, deckY + mastH - 0.4, 0);
  for (const end of [
    new THREE.Vector3(bowX + 1.9, bowY + 0.5, 0),
    new THREE.Vector3(mastX - 0.35, sheer(mastT) + 0.3, halfWidth(mastT) - 0.05),
    new THREE.Vector3(mastX - 0.35, sheer(mastT) + 0.3, -halfWidth(mastT) + 0.05),
    new THREE.Vector3(-LENGTH / 2 + 0.3, sheer(0) + 0.3, 0),
  ]) {
    const len = top.distanceTo(end);
    const r = mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 4), ropeMat, false, false);
    r.position.copy(top).add(end).multiplyScalar(0.5);
    r.lookAt(end);
    r.rotateX(Math.PI / 2);
    hull.add(r);
  }

  return { root, hull };
}

export function buildBarrel(r: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(r * (0.82 + 0.18 * Math.sin(t * Math.PI)), t * h));
  }
  const body = mesh(new THREE.LatheGeometry(pts, 9), mat('wood'));
  g.add(body);
  const lid = mesh(new THREE.CircleGeometry(r * 0.82, 9), mat('woodLight'));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = h;
  g.add(lid);
  for (const y of [0.18, 0.82]) {
    const hoop = mesh(new THREE.CylinderGeometry(r * 0.97 + 0.012, r * 0.97 + 0.012, 0.05, 9, 1, true), mat('iron'), false);
    hoop.position.y = y * h;
    g.add(hoop);
  }
  return g;
}

export const SHIP_LENGTH = LENGTH;
export const SHIP_BEAM = BEAM * 2;
