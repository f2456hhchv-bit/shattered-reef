import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash2 } from '../noise';

// Shared helpers for item models (items.ts, gear.ts, fish.ts).

export const c = (hex: string | number) => new THREE.Color(hex);
const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Matte for organic things, a little sheen for metal, gloss for glass. */
export function m(colour: string | number, kind: 'matte' | 'metal' | 'gloss' | 'glow' = 'matte'): THREE.MeshStandardMaterial {
  const key = `${colour}|${kind}`;
  let mt = matCache.get(key);
  if (!mt) {
    const col = c(colour);
    mt = new THREE.MeshStandardMaterial({
      color: col,
      roughness: kind === 'metal' ? 0.32 : kind === 'gloss' ? 0.15 : 0.82,
      metalness: kind === 'metal' ? 0.55 : 0,
      emissive: kind === 'glow' ? col : 0x000000,
      emissiveIntensity: kind === 'glow' ? 0.9 : 0,
    });
    matCache.set(key, mt);
  }
  return mt;
}

export function nudge(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const w = mergeVertices(geo, 1e-4);
  const p = w.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const kx = Math.round(p.getX(i) * 1000), ky = Math.round(p.getY(i) * 1000), kz = Math.round(p.getZ(i) * 1000);
    p.setXYZ(i, p.getX(i) + (hash2(kx, ky + kz, seed) - 0.5) * amount, p.getY(i) + (hash2(ky, kz + kx, seed + 3) - 0.5) * amount, p.getZ(i) + (hash2(kz, kx + ky, seed + 7) - 0.5) * amount);
  }
  w.computeVertexNormals();
  return w;
}

export const shade = (hex: string, k: number) => c(hex).multiplyScalar(k);

export function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) {
  const me = new THREE.Mesh(geo, mat);
  me.position.set(...pos);
  me.rotation.set(...rot);
  if (scale) me.scale.set(...scale);
  me.castShadow = true;
  g.add(me);
  return me;
}

