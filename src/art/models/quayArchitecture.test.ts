import { expect, it } from 'vitest';
import * as THREE from 'three';
import { townPlan } from '../../game/world/town';
import { buildingSolids, doorPoints, type BuildingDef } from '../../game/world/buildings';
import { buildEnterable } from './buildings';
import { applyQuayArchitecture } from './quayArchitecture';

const quay = townPlan({x:0,z:307},{x:0,z:285}).buildings;
function measure(b: BuildingDef) {
  const v = buildEnterable(b,true);
  const before = { solids: buildingSolids(b), door: doorPoints(b), interior: v.interior.children.length };
  expect(applyQuayArchitecture(v,b)).toBe(true);
  const box = new THREE.Box3().setFromObject(v.roof);
  return {v,box,before};
}

it('gives three functional quay buildings three distinct roof volumes while keeping their entrances and interiors',()=>{
  const selected = ['store','chart','tackle'].map(id=>quay.find(b=>b.id===id)!);
  const roofs = selected.map(measure);
  expect(roofs.map(r=>Math.round(r.box.max.y*100))).toEqual([expect.any(Number),expect.any(Number),expect.any(Number)]);
  expect(new Set(roofs.map(r=>Math.round((r.box.max.y-r.box.min.y)*100)) ).size).toBe(3);
  for (let i=0;i<3;i++) {
    const b=selected[i], {v,box,before}=roofs[i];
    expect(v.roof.children.some(c=>c.userData.authoredRoof)).toBe(true);
    if(b.id!=='chart')expect(v.roof.children.some(c=>c.userData.gableInfill)).toBe(true);
    expect(v.interior.children.length).toBe(before.interior);
    expect(doorPoints(b)).toEqual(before.door);
    expect(buildingSolids(b)).toEqual(before.solids);
    expect(box.min.x).toBeGreaterThan(-b.w/2-1);
    expect(box.max.x).toBeLessThan(b.w/2+1);
    v.roof.visible=false;
    expect(v.interior).toBeTruthy();
  }
});
