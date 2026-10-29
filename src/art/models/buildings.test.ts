import { expect, it } from 'vitest';
import * as THREE from 'three';
import { buildEnterable } from './buildings';
import { applyQuayArchitecture } from './quayArchitecture';
import { mergeColoured } from '../../render/bake';
import type { BuildingDef } from '../../game/world/buildings';
const b: BuildingDef = { id: 'test', name: 'Quay', style: 'timber', x:0,z:0,rot:0,w:6,d:5,door:0,seed:11,furniture:[] };
it('Bellwether architectural finish remains on liftable roof and removable wall trim', () => {
  const old = buildEnterable(b), finished = buildEnterable(b, true);
  expect(mergeColoured(finished.roof).getAttribute('position').count).toBeGreaterThan(mergeColoured(old.roof).getAttribute('position').count);
  expect(mergeColoured(finished.trim).getAttribute('position').count).toBeGreaterThan(mergeColoured(old.trim).getAttribute('position').count);
  expect(mergeColoured(finished.interior).getAttribute('position').array).toEqual(mergeColoured(old.interior).getAttribute('position').array);
  const bounds = new THREE.Box3().setFromObject(finished.group);
  expect(bounds.min.x).toBeGreaterThan(-b.w / 2 - .8);
  expect(bounds.max.x).toBeLessThan(b.w / 2 + .8);
});

it('three Bellwether quay buildings have distinct authored facade assemblies', () => {
  const definitions: BuildingDef[] = [
    { ...b, id: 'store', name: 'Harbour Goods', style: 'timber', seed: 11 },
    { ...b, id: 'chart', name: 'Chart House', style: 'plaster', seed: 12 },
    { ...b, id: 'tackle', name: 'Tackle', style: 'timber', w: 5, d: 4.6, seed: 16 },
  ];
  const signatures = definitions.map(def => {
    const view = buildEnterable(def, true);
    expect(applyQuayArchitecture(view, def)).toBe(true);
    const features: string[] = [];
    view.group.traverse(object => { if (typeof object.userData.quayFacade === 'string') features.push(object.userData.quayFacade); });
    expect(features.length).toBeGreaterThan(0);
    return features;
  });
  expect(new Set(signatures.map(items => items.join(','))).size).toBe(3);
});
