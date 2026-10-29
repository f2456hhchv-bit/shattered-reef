import { expect, it } from 'vitest';
import { regionLayout } from '../../game/world/layout';
import { BELLWETHER_REDESIGN } from '../../game/world/variant';
import * as THREE from 'three';
import { buildHarbourGrass, buildQuayPlanting } from './quayPlanting';

it('places the harbour oak and eroded rocks on walkable verges clear of buildings',()=>{
  if(!BELLWETHER_REDESIGN) return;
  const world=regionLayout('bellwether').world, planted=buildQuayPlanting(world);
  expect(planted.userData.oak).toBeDefined();
  expect(planted.userData.oak[0]).toBe(-16);
  expect(planted.userData.rockCluster).toBeDefined();
  expect(planted.userData.shrubCount).toBeGreaterThan(0);
  for(const [x,z] of [planted.userData.oak,planted.userData.rockCluster] as [number,number][]) expect(world.walkable(x,z)).toBe(true);
});

it('uses one instanced mesh for curved harbour grass fans',()=>{
  const grass=buildHarbourGrass([new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0)],9);
  expect(grass.count).toBe(2);
  expect(grass.geometry.getAttribute('position').count).toBeLessThan(50);
  expect(grass.geometry.getIndex()?.count).toBeGreaterThan(50);
  expect(grass.userData.uniforms.uTime.value).toBe(0);
});
