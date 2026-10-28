import * as THREE from 'three';
import { mat, mesh } from '../materials';
import { mulberry32 } from '../noise';
import { collapse } from './props';

type Ring = readonly [number, number, number, number, number]; // x,y,z, x-radius,z-radius

/** Authored cross-sections joined with shared vertices: smooth normals survive the colour bake. */
function loft(rings: readonly Ring[], sides: number, contour: (a: number, t: number) => number = () => 1): THREE.BufferGeometry {
  const p: number[] = [], ix: number[] = [];
  rings.forEach(([x, y, z, rx, rz], k) => {
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, r = contour(a, k / (rings.length - 1));
      p.push(x + Math.cos(a) * rx * r, y, z + Math.sin(a) * rz * r);
      if (k) {
        const a0 = (k - 1) * sides + j, b = (k - 1) * sides + (j + 1) % sides, c = k * sides + j, d = k * sides + (j + 1) % sides;
        ix.push(a0, c, b, b, c, d);
      }
    }
  });
  // Closed caps also make the foliage silhouettes solid from the approved overhead camera.
  const bottom = p.length / 3; p.push(rings[0][0], rings[0][1], rings[0][2]);
  const last = rings[rings.length - 1], top = p.length / 3; p.push(last[0], last[1], last[2]);
  for (let j = 0; j < sides; j++) ix.push(bottom, j, (j + 1) % sides, top, (rings.length - 1) * sides + (j + 1) % sides, (rings.length - 1) * sides + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(ix); geo.computeVertexNormals();
  return geo;
}

/** Tapered wood follows a spline with cross-sections perpendicular to the branch, never stacked cylinders. */
function limb(points: readonly (readonly [number, number, number])[], radius: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const p: number[] = [], ix: number[] = [], sides = 7, steps = 8;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, center = curve.getPoint(t), tangent = curve.getTangent(t);
    const u = new THREE.Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize();
    const r = radius * (1 - t * 0.93) * (1 + 0.24 * Math.exp(-t * 12));
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2;
      const q = center.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r * 0.9);
      p.push(q.x, q.y, q.z);
      if (k) { const b = (k - 1) * sides + j, c = (k - 1) * sides + (j + 1) % sides; ix.push(b, k * sides + j, c, c, k * sides + j, k * sides + (j + 1) % sides); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(ix); geo.computeVertexNormals(); return geo;
}

function foliage(width: number, depth: number, height: number, phase: number) {
  // Broad shoulders, off-centre crown and scalloped lower edges. These are authored lobes, not vertex noise.
  const profile = [[0, .12], [.14, .64], [.39, 1], [.66, .94], [.87, .65], [1, .025]];
  return loft(profile.map(([t, r]) => [Math.sin(t * 2) * width * .13, t * height, t * depth * .1, width * r, depth * r]), 24,
    (a, t) => 1 + .12 * Math.sin(a * 3 + phase) + .07 * Math.cos(a * 5 - phase) + (1 - t) * .055 * Math.sin(a * 7));
}

/** Coastal Scots pine: wind-bent scaffold and a broad, interlocking crown of drooping needle sprays. */
export function buildCoastalPine(seed: number, height = 1): THREE.Group {
  const rnd = mulberry32(seed), g = new THREE.Group(), lean = .26 + rnd() * .15;
  g.add(mesh(limb([[0,0,0],[-.08,1.1,.03],[lean,2.5,-.08],[lean + .36,3.9,-.18]], .23), mat('trunk')));
  // Authored bough positions and lengths: an unequal lower skirt under a joined, wind-combed crown.
  const boughs = [
    [-2.7,2.05,1.0,.99,.61,.48], [.3,2.28,1.02,1.08,.64,.44],
    [1.8,2.65,.79,1.04,.66,.48], [-1.1,2.89,.85,1.03,.61,.49],
    [-2.9,3.19,.53,.91,.64,.49], [.35,3.36,.58,.91,.63,.47],
    [1.5,3.66,.32,.77,.58,.51],
  ];
  boughs.forEach(([a,y,reach,w,d,h], i) => {
    const x = lean * (y / 4) + Math.cos(a) * reach, z = Math.sin(a) * reach;
    g.add(mesh(limb([[lean * .5,y - .65,0],[x * .56,y + .13,z * .55],[x,y + .14,z]], .085 - i * .006), mat('trunk')));
    // Scalloped, elongated needle fans have broad shoulders and downturned ends, without upright tips.
    const profile = [[0,.28],[.15,.81],[.36,1],[.59,.94],[.83,.69],[1,.19]];
    const geo = loft(profile.map(([t,r]) => [t * .13,t * h,0,w * r,d * r]), 20,
      (angle,t) => 1 + .13 * Math.sin(angle * 5 + i * .8) + .06 * Math.cos(angle * 3) + .05 * (1-t) * Math.sin(angle * 7));
    const p = geo.getAttribute('position');
    for (let j = 0; j < p.count; j++) {
      const u = p.getX(j) / w, v = p.getZ(j) / d;
      p.setY(j,p.getY(j) - .14 * (u*u + v*v));
    }
    geo.computeVertexNormals();
    const spray = mesh(geo,mat(i === 4 || i === 6 ? 'pineLight' : 'pine'));
    spray.position.set(x,y,z); spray.rotation.y = -a; spray.rotation.z = Math.cos(a) * -.08; g.add(spray);
  });
  const out = collapse(g); out.rotation.y = rnd() * Math.PI * 2; out.scale.setScalar(height * (.94 + rnd() * .12)); return out;
}

export function buildCoastalOak(seed: number): THREE.Group {
  const rnd = mulberry32(seed), g = new THREE.Group();
  g.add(mesh(limb([[0, 0, 0], [-.12, .65, .02], [.02, 1.45, .08], [.3, 2.4, -.06]], .28), mat('trunk')));
  // Intentional branch architecture and a low, spreading oak crown with an open underside.
  const boughs = [[-.92, 2.05, .18, 1.02, .83, 1.25], [.83, 2.21, -.4, 1.05, .88, 1.32], [.13, 2.5, -.68, .97, .78, 1.35], [.48, 2.05, .83, .93, .8, 1.22], [-.52, 2.32, .65, .95, .86, 1.23]];
  boughs.forEach(([x,y,z,w,d,h], i) => {
    g.add(mesh(limb([[0, .8 + i * .1, 0], [x * .35, 1.55, z * .38], [x * .88, y + .3, z * .88]], .12 - i * .009), mat('trunk')));
    const crown = mesh(foliage(w, d, h, i * .8 + seed * .03), mat(i === 2 || i === 4 ? 'leafLight' : 'leaf'));
    crown.position.set(x, y - .2, z); crown.rotation.y = i * .8; g.add(crown);
  });
  const out = collapse(g); out.rotation.y = rnd() * Math.PI * 2; out.scale.setScalar(.95 + rnd() * .1); return out;
}

export function buildErodedRock(seed: number, size = 1, colour: 'stone' | 'stoneDark' = 'stone'): THREE.Mesh {
  const rnd = mulberry32(seed), phase = rnd() * .45;
  // Undercut foot, weathered shoulder, sloping crown: one continuous rounded bedding form.
  const rings: Ring[] = [[0,-.3,0,.65,.59],[-.08,-.12,.02,1,.79],[-.1,.12,.03,1.1,.88],[0,.39,.02,1.02,.82],[.11,.65,-.04,.83,.66],[.21,.81,-.07,.48,.43],[.23,.86,-.09,.025,.025]];
  const geo = loft(rings, 20, (a,t) => 1 + .075 * Math.cos(a * 3 + phase) + .04 * Math.sin(a * 2 + t * 3));
  const rock = mesh(geo, mat(colour)); rock.scale.set(size * (1 + rnd() * .13), size * (.87 + rnd() * .18), size); rock.rotation.y = rnd() * Math.PI * 2; return rock;
}

export function buildOrganicOre(seed: number): THREE.Group {
  const g = new THREE.Group(), rock = buildErodedRock(seed, 1, 'stoneDark'); rock.position.y = .22; g.add(rock);
  for (const [i, [x,y,z]] of [[-.52,.75,.1],[.35,.87,-.18],[.63,.58,.41],[-.21,.49,.7]].entries()) {
    const seam = mesh(loft([[0,0,0,.08,.13],[.015,.025,0,.19,.24],[.04,.07,-.01,.15,.2],[.05,.1,-.02,.025,.025]], 10), mat('copper'));
    seam.position.set(x,y,z); seam.rotation.set(.15, i * 1.3, .1); g.add(seam);
  }
  return collapse(g);
}
