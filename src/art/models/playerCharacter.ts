import * as THREE from 'three';
import { mat } from '../materials';

type Ring = { y: number; rx: number; rz: number; x?: number; z?: number };

const COLOR = {
  skin: 0xc98250,
  skinLight: 0xd89460,
  shirt: 0xe9ddc4,
  shirtShadow: 0xcfc2a8,
  trousers: 0x3b3b3d,
  sash: 0x873238,
  sashLight: 0x9b3d3f,
  leather: 0x63452f,
  leatherLight: 0x805a3c,
  hair: 0x503322,
  hairLight: 0x67432d,
  eye: 0x241b16,
  brass: 0xa97837,
};

function loftGeometry(profile: Ring[], segments = 12, caps = true): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const ring of profile) {
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2;
      positions.push((ring.x ?? 0) + Math.cos(angle) * ring.rx, ring.y, (ring.z ?? 0) + Math.sin(angle) * ring.rz);
    }
  }
  for (let row = 0; row < profile.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * segments + i;
      const b = row * segments + (i + 1) % segments;
      indices.push(a, a + segments, b + segments, a, b + segments, b);
    }
  }
  if (caps) {
    const bottom = positions.length / 3;
    positions.push(profile[0].x ?? 0, profile[0].y, profile[0].z ?? 0);
    const top = positions.length / 3;
    positions.push(profile.at(-1)!.x ?? 0, profile.at(-1)!.y, profile.at(-1)!.z ?? 0);
    for (let i = 0; i < segments; i++) {
      indices.push(bottom, (i + 1) % segments, i);
      const a = (profile.length - 1) * segments + i;
      const b = (profile.length - 1) * segments + (i + 1) % segments;
      indices.push(top, a, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function mesh(root: THREE.Group, name: string, geometry: THREE.BufferGeometry, colour: number, side: THREE.Side = THREE.FrontSide): THREE.Mesh {
  const material = mat(colour, { side });
  material.roughness = 0.92;
  material.metalness = 0;
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  root.add(result);
  return result;
}

function loft(root: THREE.Group, name: string, profile: Ring[], colour: number, segments = 12, caps = true): THREE.Mesh {
  return mesh(root, name, loftGeometry(profile, segments, caps), colour, THREE.DoubleSide);
}

/** Elliptical, tapered limb volume aligned between two joints (the basis follows the limb axis). */
function limbGeometry(start: THREE.Vector3, end: THREE.Vector3, startRadius: number, endRadius: number, depth: number, segments = 14): THREE.BufferGeometry {
  const axis = end.clone().sub(start).normalize();
  const cross = new THREE.Vector3(axis.y, -axis.x, 0).normalize();
  const forward = new THREE.Vector3(0, 0, 1);
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = [
    { t: -0.04, r: startRadius * 0.8 },
    { t: 0, r: startRadius },
    { t: 0.22, r: THREE.MathUtils.lerp(startRadius, endRadius, 0.22) },
    { t: 0.78, r: THREE.MathUtils.lerp(startRadius, endRadius, 0.78) },
    { t: 1, r: endRadius },
    { t: 1.04, r: endRadius * 0.8 },
  ];
  for (const ring of rings) {
    const center = start.clone().lerp(end, ring.t);
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(cross, Math.cos(a) * ring.r)
        .addScaledVector(forward, Math.sin(a) * Math.min(ring.r, depth));
      positions.push(point.x, point.y, point.z);
    }
  }
  for (let row = 0; row < rings.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * segments + i, b = row * segments + (i + 1) % segments;
      indices.push(a, a + segments, b + segments, a, b + segments, b);
    }
  }
  const startCenter = positions.length / 3;
  positions.push(start.x, start.y, start.z);
  const endCenter = positions.length / 3;
  positions.push(end.x, end.y, end.z);
  const lastRing = (rings.length - 1) * segments;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(startCenter, next, i);
    indices.push(endCenter, lastRing + i, lastRing + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function limb(root: THREE.Group, name: string, start: THREE.Vector3, end: THREE.Vector3, startRadius: number, endRadius: number, depth: number, colour: number): THREE.Mesh {
  return mesh(root, name, limbGeometry(start, end, startRadius, endRadius, depth), colour, THREE.DoubleSide);
}

function ribbonGeometry(points: THREE.Vector3[], width: number, depth = 0.004): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector2(after.x - before.x, after.y - before.y).normalize();
    const perpendicular = new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(width / 2);
    const point = points[i];
    positions.push(point.x + perpendicular.x, point.y + perpendicular.y, point.z + depth);
    positions.push(point.x - perpendicular.x, point.y - perpendicular.y, point.z + depth);
    positions.push(point.x + perpendicular.x, point.y + perpendicular.y, point.z - depth);
    positions.push(point.x - perpendicular.x, point.y - perpendicular.y, point.z - depth);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
    indices.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3);
    indices.push(a, b, b + 2, a, b + 2, a + 2);
    indices.push(a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function panelGeometry(points: [number, number][], z: number, depth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const dz of [depth / 2, -depth / 2]) for (const [x, y] of points) positions.push(x, y, z + dz);
  const count = points.length;
  const contour = points.map(([x, y]) => new THREE.Vector2(x, y));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    indices.push(a, b, c);
    indices.push(count + c, count + b, count + a);
  }
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    indices.push(i, j, count + j, i, count + j, count + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A restrained, code-authored starter outfit: tapered lofts and shaped panels follow the approved reference. */
export function buildPlayerCharacterGeometry(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'PlayerCharacter_Geometry';

  loft(root, 'Torso_Shirt', [
    { y: 0.88, rx: 0.16, rz: 0.09 }, { y: 0.91, rx: 0.17, rz: 0.098 },
    { y: 0.96, rx: 0.184, rz: 0.105 }, { y: 1.04, rx: 0.19, rz: 0.108 }, { y: 1.20, rx: 0.205, rz: 0.115 },
    { y: 1.33, rx: 0.218, rz: 0.12 }, { y: 1.39, rx: 0.19, rz: 0.11 },
    { y: 1.43, rx: 0.145, rz: 0.087 }, { y: 1.46, rx: 0.078, rz: 0.06 },
  ], COLOR.shirt, 32);
  loft(root, 'Neck', [
    { y: 1.45, rx: 0.052, rz: 0.052 }, { y: 1.53, rx: 0.056, rz: 0.058 },
    { y: 1.62, rx: 0.048, rz: 0.05 },
  ], COLOR.skin, 10);

  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? 'L' : 'R';
    const x = side * 0.12;
    loft(root, `Starter_Trousers_${suffix}`, [
      { y: 0.38, x, rx: 0.064, rz: 0.07 }, { y: 0.49, x, rx: 0.073, rz: 0.078 },
      { y: 0.72, x: side * 0.13, rx: 0.087, rz: 0.088 }, { y: 0.91, x: side * 0.115, rx: 0.096, rz: 0.091 },
      { y: 0.98, x: side * 0.105, rx: 0.082, rz: 0.08 },
    ], COLOR.trousers, 12);
    const shoulder = new THREE.Vector3(side * 0.03, 1.33, 0);
    const elbow = new THREE.Vector3(side * 0.325, 1.15, 0);
    const wrist = new THREE.Vector3(side * 0.347, 0.875, 0);
    const palm = new THREE.Vector3(side * 0.35, 0.735, 0.005);
    // Each sleeve overlaps the chest and bare upper arm so no open end reads as a detached primitive.
    limb(root, `Sleeve_${suffix}`, shoulder, new THREE.Vector3(side * 0.312, 1.205, 0), 0.084, 0.066, 0.074, COLOR.shirt);
    limb(root, `UpperArm_${suffix}`, new THREE.Vector3(side * 0.07, 1.37, 0), elbow, 0.061, 0.052, 0.057, COLOR.skin);
    limb(root, `Forearm_${suffix}`, elbow, wrist, 0.052, 0.042, 0.048, COLOR.skin);
    limb(root, `Forearm_Guard_${suffix}`, new THREE.Vector3(side * 0.332, 1.13, 0), new THREE.Vector3(side * 0.346, 0.90, 0), 0.065, 0.057, 0.062, COLOR.leather);
    limb(root, `Hand_${suffix}`, new THREE.Vector3(side * 0.347, 0.90, 0), palm, 0.05, 0.046, 0.044, COLOR.skin);

    loft(root, `Boot_${suffix}`, [
      { y: 0.02, x, z: 0.045, rx: 0.07, rz: 0.124 }, { y: 0.09, x, z: 0.035, rx: 0.073, rz: 0.12 },
      { y: 0.18, x, rx: 0.067, rz: 0.08 }, { y: 0.35, x, rx: 0.069, rz: 0.073 },
      { y: 0.42, x, rx: 0.064, rz: 0.069 },
    ], COLOR.leather, 12);
    loft(root, `Boot_Cuff_${suffix}`, [
      { y: 0.32, x, rx: 0.075, rz: 0.078 }, { y: 0.34, x, rx: 0.078, rz: 0.081 },
      { y: 0.40, x, rx: 0.074, rz: 0.078 }, { y: 0.42, x, rx: 0.067, rz: 0.071 },
    ], COLOR.leatherLight, 12);
  }

  loft(root, 'Sash_Waist', [
    { y: 0.88, rx: 0.205, rz: 0.125 }, { y: 0.91, rx: 0.216, rz: 0.132 },
    { y: 1.015, rx: 0.212, rz: 0.13 }, { y: 1.045, rx: 0.202, rz: 0.12 },
  ], COLOR.sash, 14);
  mesh(root, 'Sash_Tail', panelGeometry([[0.11, 0.95], [0.20, 0.975], [0.17, 0.57], [0.10, 0.64]], 0.045, 0.012), COLOR.sashLight, THREE.DoubleSide);
  mesh(root, 'Shoulder_Strap_Front', ribbonGeometry([
    new THREE.Vector3(-0.14, 1.37, 0.088), new THREE.Vector3(-0.12, 1.30, 0.112),
    new THREE.Vector3(-0.015, 1.14, 0.133), new THREE.Vector3(0.145, 0.98, 0.105),
  ], 0.06), COLOR.leather);
  mesh(root, 'Shoulder_Strap_Back', ribbonGeometry([
    new THREE.Vector3(0.14, 1.37, -0.088), new THREE.Vector3(0.12, 1.30, -0.112),
    new THREE.Vector3(0.015, 1.14, -0.133), new THREE.Vector3(-0.145, 0.98, -0.105),
  ], 0.06), COLOR.leather);
  mesh(root, 'Strap_Buckle', panelGeometry([[-0.142, 1.293], [-0.112, 1.276], [-0.139, 1.246], [-0.169, 1.264]], 0.14, 0.01), COLOR.brass, THREE.DoubleSide);

  loft(root, 'Head_Skin', [
    { y: 1.56, rx: 0.052, rz: 0.055, z: 0.008 }, { y: 1.59, rx: 0.076, rz: 0.078, z: 0.007 },
    { y: 1.64, rx: 0.093, rz: 0.091, z: 0 }, { y: 1.70, rx: 0.097, rz: 0.092, z: -0.004 },
    { y: 1.77, rx: 0.091, rz: 0.085, z: -0.008 }, { y: 1.81, rx: 0.061, rz: 0.057, z: -0.009 },
    { y: 1.825, rx: 0.026, rz: 0.025, z: -0.009 },
  ], COLOR.skin, 20);
  loft(root, 'Hair_Cap', [
    { y: 1.725, rx: 0.092, rz: 0.09, z: -0.014 }, { y: 1.75, rx: 0.102, rz: 0.098, z: -0.012 },
    { y: 1.82, rx: 0.09, rz: 0.087, z: -0.012 }, { y: 1.86, rx: 0.061, rz: 0.059, z: -0.012 },
    { y: 1.875, rx: 0.015, rz: 0.016, z: -0.012 },
  ], COLOR.hair, 20, false);
  for (const side of [-1, 1] as const) {
    const x = side * 0.101;
    loft(root, `Ear_${side < 0 ? 'L' : 'R'}`, [
      { y: 1.63, x, rx: 0.016, rz: 0.019 }, { y: 1.65, x: side * 1.01 * 0.098, rx: 0.021, rz: 0.021 },
      { y: 1.675, x, rx: 0.016, rz: 0.018 },
    ], COLOR.skin, 8);
    const eyeX = side * 0.039;
    mesh(root, `Eye_${side < 0 ? 'L' : 'R'}`, panelGeometry([[eyeX - 0.012, 1.69], [eyeX + 0.012, 1.692], [eyeX + 0.009, 1.704], [eyeX - 0.009, 1.704]], 0.091, 0.005), COLOR.eye, THREE.DoubleSide);
    mesh(root, `Brow_${side < 0 ? 'L' : 'R'}`, panelGeometry([[eyeX - 0.022, 1.715], [eyeX + 0.02, 1.718], [eyeX + 0.018, 1.726], [eyeX - 0.023, 1.724]], 0.091, 0.006), COLOR.hair, THREE.DoubleSide);
  }
  // A low-relief nose and compact swept fringe keep the face readable without mascot-like features.
  loft(root, 'Nose', [
    { y: 1.655, rx: 0.009, rz: 0.01, z: 0.082 }, { y: 1.667, rx: 0.012, rz: 0.014, z: 0.09 },
    { y: 1.682, rx: 0.009, rz: 0.012, z: 0.085 },
  ], COLOR.skin, 8);
  mesh(root, 'Hair_Fringe', panelGeometry([
    [-0.09, 1.765], [-0.075, 1.8], [-0.035, 1.785], [0.0, 1.812], [0.035, 1.782],
    [0.082, 1.798], [0.064, 1.75], [0.024, 1.758], [-0.02, 1.747], [-0.058, 1.758],
  ], 0.098, 0.018), COLOR.hair, THREE.DoubleSide);

  return root;
}
