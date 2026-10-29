import * as THREE from 'three';
import { mat } from '../materials';

export type PlayerArmourSet = 'starter' | 'leather' | 'iron';

export interface PlayerArmourPieces {
  chest: THREE.Group;
  head: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
}

interface ArmourRing { y: number; x: number; rx: number; rz: number }

function armourLoft(profile: ArmourRing[], segments = 24): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (const ring of profile) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2;
    positions.push(ring.x + Math.cos(a) * ring.rx, ring.y, Math.sin(a) * ring.rz);
  }
  for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < segments; i++) {
    const a = row * segments + i, b = row * segments + (i + 1) % segments;
    indices.push(a, a + segments, b + segments, a, b + segments, b);
  }
  const bottom = positions.length / 3;
  positions.push(profile[0].x, profile[0].y, 0);
  const top = positions.length / 3;
  positions.push(profile.at(-1)!.x, profile.at(-1)!.y, 0);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(bottom, next, i);
    const a = (profile.length - 1) * segments + i;
    const b = (profile.length - 1) * segments + next;
    indices.push(top, a, b);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}

function armourMesh(parent: THREE.Group, name: string, profile: ArmourRing[], colour: number): THREE.Mesh {
  const object = solid(parent, name, armourLoft(profile), colour);
  (object.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  return object;
}

function solid(root: THREE.Group, name: string, geometry: THREE.BufferGeometry, colour: number): THREE.Mesh {
  const object = new THREE.Mesh(geometry, mat(colour));
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  root.add(object);
  return object;
}

/** Compact, straight sword sized for the starter character's right hand. */
export function buildPlayerSword(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'StraightSword';
  const blade = new THREE.Shape();
  blade.moveTo(-0.043, 0.08);
  blade.lineTo(-0.035, 0.57);
  blade.lineTo(0, 0.76);
  blade.lineTo(0.035, 0.57);
  blade.lineTo(0.043, 0.08);
  blade.closePath();
  solid(root, 'Sword_Blade', new THREE.ExtrudeGeometry(blade, { depth: 0.026, bevelEnabled: false }), 0xd2d6d6)
    .position.z = -0.013;
  const guardShape = new THREE.Shape();
  guardShape.moveTo(-0.13, 0.045); guardShape.lineTo(-0.12, 0.075);
  guardShape.lineTo(0.12, 0.075); guardShape.lineTo(0.13, 0.045);
  guardShape.lineTo(0.10, 0.02); guardShape.lineTo(-0.10, 0.02); guardShape.closePath();
  solid(root, 'Sword_Guard', new THREE.ExtrudeGeometry(guardShape, { depth: 0.04, bevelEnabled: false }), 0xa97837).position.z = -0.02;
  solid(root, 'Sword_Grip', new THREE.CylinderGeometry(0.022, 0.024, 0.2, 8), 0x63452f).position.y = -0.075;
  solid(root, 'Sword_Pommel', new THREE.SphereGeometry(0.03, 10, 8), 0xa97837).position.y = -0.185;
  return root;
}

/** Plain plank-built shield, with a readable silhouette and no engraved ornament. */
export function buildWoodenShield(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'WoodenShield';
  const shape = new THREE.Shape();
  shape.moveTo(-0.25, 0.34); shape.lineTo(-0.19, 0.45); shape.lineTo(0, 0.52);
  shape.lineTo(0.19, 0.45); shape.lineTo(0.25, 0.34); shape.lineTo(0.20, -0.12);
  shape.quadraticCurveTo(0.14, -0.32, 0, -0.46);
  shape.quadraticCurveTo(-0.14, -0.32, -0.20, -0.12); shape.closePath();
  solid(root, 'Shield_Backing', new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), 0x503624).position.z = -0.03;
  const face = solid(root, 'Shield_Face', new THREE.ShapeGeometry(shape, 8), 0x805a3c);
  face.position.z = 0.032;
  for (let i = -1; i <= 1; i++) {
    const board = solid(root, `Shield_Plank_${i + 2}`, new THREE.BoxGeometry(0.071, 0.68, 0.008), i === 0 ? 0x8d6543 : 0x765133);
    board.position.set(i * 0.073, 0.025, 0.038);
  }
  // The grip sits on the plain reverse face and follows the left hand attachment point.
  solid(root, 'Shield_Grip', new THREE.BoxGeometry(0.035, 0.22, 0.045), 0x63452f).position.set(0, 0.01, -0.055);
  root.scale.setScalar(0.76);
  root.position.set(-0.055, 0.08, 0.02);
  root.rotation.y = -0.18;
  return root;
}

/** Simple driftwood staff with a small opaque blue stone, kept intentionally matte. */
export function buildPlayerStaff(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'BasicStaff';
  solid(root, 'Staff_Shaft', new THREE.CylinderGeometry(0.022, 0.03, 1.25, 10), 0x805a3c).position.y = 0.25;
  solid(root, 'Staff_Collar', new THREE.CylinderGeometry(0.045, 0.045, 0.07, 10), 0xa97837).position.y = 0.87;
  solid(root, 'Staff_Orb', new THREE.OctahedronGeometry(0.105, 1), 0x377d91).position.y = 1.015;
  return root;
}

/** Plain, matte shoulder cape for the existing cloak equipment item. */
export function buildPlayerCape(colour = 0x6a6e72): THREE.Mesh {
  const rows = 6, columns = 4, positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const y = THREE.MathUtils.lerp(1.42, 0.62, t);
    const halfWidth = THREE.MathUtils.lerp(0.12, 0.245, t);
    for (let column = 0; column <= columns; column++) {
      const u = column / columns * 2 - 1;
      positions.push(u * halfWidth, y, -0.105 - Math.sin(t * Math.PI) * 0.09 + u * u * 0.025);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * stride + column, b = a + stride;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const object = new THREE.Mesh(geometry, mat(colour, { side: THREE.DoubleSide }));
  object.name = 'PlayerCape'; object.castShadow = true; object.receiveShadow = true;
  return object;
}

/** Small shared-skeleton overlays for the first two armour silhouettes. */
export function buildPlayerArmourPieces(set: Exclude<PlayerArmourSet, 'starter'>): PlayerArmourPieces {
  const chest = new THREE.Group(); chest.name = `Chest_${set}`;
  const head = new THREE.Group(); head.name = `Head_${set}`;
  const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  legs[0].name = `Leg_L_${set}`; legs[1].name = `Leg_R_${set}`;
  const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  arms[0].name = `Arm_L_${set}`; arms[1].name = `Arm_R_${set}`;
  const iron = set === 'iron';
  const chestColour = iron ? 0x9da5aa : 0x60432f;
  armourMesh(chest, `${set}_Chestplate`, [
    { y: 0.86, x: 0, rx: 0.16, rz: 0.098 }, { y: 0.91, x: 0, rx: 0.178, rz: 0.11 },
    { y: 1.04, x: 0, rx: 0.202, rz: 0.124 },
    { y: 1.2, x: 0, rx: 0.218, rz: 0.13 }, { y: 1.32, x: 0, rx: 0.232, rz: 0.136 },
    { y: 1.38, x: 0, rx: 0.205, rz: 0.12 }, { y: 1.42, x: 0, rx: 0.137, rz: 0.086 },
    { y: 1.46, x: 0, rx: 0.054, rz: 0.052 },
  ], chestColour);
  if (iron) {
    armourMesh(head, 'Iron_Helm_Dome', [
      { y: 1.735, x: 0, rx: 0.089, rz: 0.084 }, { y: 1.75, x: 0, rx: 0.101, rz: 0.094 },
      { y: 1.81, x: 0, rx: 0.096, rz: 0.09 }, { y: 1.85, x: 0, rx: 0.065, rz: 0.062 },
      { y: 1.875, x: 0, rx: 0.018, rz: 0.02 },
    ], 0x9da5aa);
  } else {
    armourMesh(head, 'Leather_Cap', [
      { y: 1.72, x: 0, rx: 0.088, rz: 0.08 }, { y: 1.75, x: 0, rx: 0.098, rz: 0.092 },
      { y: 1.81, x: 0, rx: 0.087, rz: 0.083 }, { y: 1.84, x: 0, rx: 0.046, rz: 0.045 },
    ], 0x60432f);
  }
  for (const side of [-1, 1] as const) {
    const i = side < 0 ? 0 : 1;
    armourMesh(legs[i], `${set}_Greave_${i}`, [
      { y: 0.39, x: side * 0.12, rx: 0.064, rz: 0.077 },
      { y: 0.45, x: side * 0.12, rx: 0.074, rz: 0.084 },
      { y: 0.78, x: side * 0.12, rx: 0.088, rz: 0.094 },
      { y: 0.94, x: side * 0.12, rx: 0.084, rz: 0.09 },
    ], iron ? 0x9da5aa : 0x60432f);
    if (iron) {
      armourMesh(arms[i], `Iron_Gauntlet_${i}`, [
        { y: 0.85, x: side * 0.347, rx: 0.052, rz: 0.055 },
        { y: 0.9, x: side * 0.347, rx: 0.062, rz: 0.063 },
        { y: 1.11, x: side * 0.333, rx: 0.06, rz: 0.062 },
        { y: 1.15, x: side * 0.33, rx: 0.05, rz: 0.052 },
      ], 0xaab2b6);
    }
  }
  return { chest, head, legs, arms };
}
