import * as THREE from 'three';
import { mat } from '../materials';

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
