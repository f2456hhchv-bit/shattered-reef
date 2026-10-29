import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPlayerSword, buildWoodenShield, buildPlayerStaff } from './playerEquipment';

describe('player weapon and shield attachments', () => {
  it('builds simple three-dimensional sword, shield and staff equipment', () => {
    const sword = buildPlayerSword();
    const shield = buildWoodenShield();
    const staff = buildPlayerStaff();
    expect(sword.name).toBe('StraightSword');
    expect(shield.name).toBe('WoodenShield');
    expect(staff.name).toBe('BasicStaff');
    for (const root of [sword, shield, staff]) {
      const meshes: THREE.Mesh[] = [];
      root.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
      expect(meshes.length).toBeGreaterThan(0);
      for (const m of meshes) {
        expect(m.geometry).toBeInstanceOf(THREE.BufferGeometry);
        expect(m.geometry.getAttribute('position').count).toBeGreaterThan(0);
      }
    }
    expect(sword.getObjectByName('Sword_Blade')).toBeTruthy();
    expect(shield.getObjectByName('Shield_Face')).toBeTruthy();
    expect(staff.getObjectByName('Staff_Orb')).toBeTruthy();
  });
});
