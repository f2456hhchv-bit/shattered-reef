import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCoastalPine, buildCoastalOak, buildErodedRock, buildOrganicOre } from './organic';
import { mergeColoured } from '../../render/bake';

describe('Bellwether authored organic geometry', () => {
  for (const [name, build, budget] of [
    ['pine', buildCoastalPine, 2600], ['oak', buildCoastalOak, 2600],
    ['rock', buildErodedRock, 550], ['ore', buildOrganicOre, 850],
  ] as const) {
    it(`${name} has finite smooth normals, bounded geometry and one instancable colour mesh`, () => {
      for (const seed of [0, 11, 23, 4096]) {
        const model = build(seed);
        const geo = mergeColoured(model);
        expect(geo.getAttribute('position').count / 3).toBeLessThanOrEqual(budget);
        for (const attr of ['position', 'normal', 'color']) {
          expect(Array.from(geo.getAttribute(attr).array).every(Number.isFinite)).toBe(true);
        }
        geo.computeBoundingBox();
        const bounds = geo.boundingBox!;
        expect(bounds.min.y).toBeGreaterThan(-1.1);
        expect(bounds.max.y).toBeLessThan(6);
        expect(bounds.getSize(new THREE.Vector3()).length()).toBeLessThan(9);
        const n = geo.getAttribute('normal');
        for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 3);
      }
    });
    it(`${name} varies deliberately and reproducibly by seed`, () => {
      const a = mergeColoured(build(11)).getAttribute('position').array;
      expect(Array.from(a)).toEqual(Array.from(mergeColoured(build(11)).getAttribute('position').array));
      expect(Array.from(a)).not.toEqual(Array.from(mergeColoured(build(23)).getAttribute('position').array));
    });
  }
});
it('windgrown coastal pine has a broad continuous crown rather than a tall stack of pointed tiers', () => {
  const model = buildCoastalPine(11);
  const crown = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const material = m.material as THREE.MeshStandardMaterial;
    if (material.color.getHex() === 0x5c4130) return;
    m.geometry.computeBoundingBox();
    crown.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  const size = crown.getSize(new THREE.Vector3());
  expect(Math.max(size.x, size.z)).toBeGreaterThan(size.y * 1.25);
});
