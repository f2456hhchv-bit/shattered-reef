import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BELL_TOWN } from '../../game/world/island';
import { buildQuayPaving, planQuayStones } from './quayPaving';

const mockWorld = { solids: [], ground: () => 0 };

describe('Bellwether quay paving', () => {
  it('places deterministic, non-overlapping setts clear of building footprints', () => {
    const stones = planQuayStones(mockWorld), repeat = planQuayStones(mockWorld);
    expect(stones.length).toBeGreaterThan(700);
    expect(stones.length).toBeLessThanOrEqual(1250);
    expect(stones).toEqual(repeat);
    const buckets = new Map<string, typeof stones>();
    for (const a of stones) {
      expect([a.x, a.z, a.radius, a.variant, a.colour].every(Number.isFinite)).toBe(true);
      for (const b of BELL_TOWN.buildings) {
        const clearX = Math.abs(a.x - b.x) >= b.w / 2 + a.radius + .12;
        const clearZ = Math.abs(a.z - b.z) >= b.d / 2 + a.radius + .12;
        expect(clearX || clearZ).toBe(true);
      }
      const cx = Math.floor(a.x / .68), cz = Math.floor(a.z / .68);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
        for (const b of buckets.get(`${cx + dx},${cz + dz}`) ?? [])
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(a.radius + b.radius + .025 - 1e-9);
      const key = `${cx},${cz}`, bucket = buckets.get(key);
      if (bucket) bucket.push(a); else buckets.set(key, [a]);
    }
  }, 30000);

  it('batches the beveled sett field into one finite vertex-coloured mesh', () => {
    const paving = buildQuayPaving(mockWorld);
    expect(paving.children).toHaveLength(1);
    const mesh = paving.children[0] as THREE.Mesh;
    expect(mesh.isMesh).toBe(true);
    expect(mesh.userData.stoneCount).toBe(paving.userData.stoneCount);
    expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(Array.from(mesh.geometry.getAttribute('color').array).every(Number.isFinite)).toBe(true);
    expect(mesh.geometry.index!.count / 3).toBeLessThan(1250 * 60);
  });
});
