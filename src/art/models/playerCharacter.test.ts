import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPlayerCharacterGeometry } from './playerCharacter';

describe('code-authored starter player character', () => {
  it('has the approved starter silhouette and named clothing forms', () => {
    const root = buildPlayerCharacterGeometry();
    root.updateMatrixWorld(true);
    const names: string[] = [];
    const meshes: THREE.Mesh[] = [];
    root.traverse(object => {
      names.push(object.name);
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
    });

    for (const part of [
      'Torso_Shirt', 'Sleeve_L', 'Sleeve_R', 'Starter_Trousers_L', 'Starter_Trousers_R',
      'Forearm_Guard_L', 'Forearm_Guard_R', 'Boot_L', 'Boot_R', 'Sash_Waist',
      'Shoulder_Strap_Front', 'Head_Skin', 'Hair_Cap',
    ]) expect(names, `missing player form ${part}`).toContain(part);

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    expect(bounds.min.y).toBeLessThan(0.05);
    expect(size.y).toBeGreaterThan(1.72);
    expect(size.y).toBeLessThan(1.95);
    expect(size.x).toBeLessThan(0.9);
    const head = root.getObjectByName('Head_Skin') as THREE.Mesh;
    const headBounds = new THREE.Box3().setFromObject(head);
    const headHeight = headBounds.getSize(new THREE.Vector3()).y;
    expect(headHeight / size.y).toBeGreaterThan(0.12);
    expect(headHeight / size.y).toBeLessThan(0.19);
    const shirt = root.getObjectByName('Torso_Shirt') as THREE.Mesh;
    const shirtBounds = new THREE.Box3().setFromObject(shirt).getSize(new THREE.Vector3());
    expect(shirtBounds.x).toBeGreaterThan(0.43);
    expect(shirtBounds.y).toBeGreaterThan(0.5);
    expect(meshes.length).toBeLessThanOrEqual(36);
  });

  it('uses matte authored buffer meshes with finite geometry and normals', () => {
    const root = buildPlayerCharacterGeometry();
    const meshes: THREE.Mesh[] = [];
    root.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
    expect(meshes.length).toBeGreaterThan(12);
    for (const mesh of meshes) {
      expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
      const positions = mesh.geometry.getAttribute('position');
      const normals = mesh.geometry.getAttribute('normal');
      expect(positions.count).toBeGreaterThan(0);
      expect(normals.count).toBe(positions.count);
      for (let i = 0; i < positions.count; i++) {
        expect(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i))).toBe(true);
        expect(Number.isFinite(normals.getX(i) + normals.getY(i) + normals.getZ(i))).toBe(true);
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        const standard = material as THREE.MeshStandardMaterial;
        expect(standard.roughness).toBeGreaterThanOrEqual(0.82);
        expect(standard.metalness).toBeLessThanOrEqual(0.12);
      }
    }
  });
});
