import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash2 } from './noise';

// Shared, cached flat-shaded materials. Models only reference palette keys,
// so the whole game's colour language lives in one place.
export const PAL = {
  woodDark: 0x4e3424,
  wood: 0x7a5534,
  woodLight: 0xa98055,
  plank: 0x9a7650,
  plankWorn: 0x86694a,
  rope: 0xb59a6a,
  iron: 0x3b3f42,
  brass: 0xc9a050,
  copper: 0xc27a45,
  stone: 0x8d8a82,
  stoneDark: 0x6a6862,
  sail: 0xe6dcc0,
  sailPatch: 0xd2c29a,
  teal: 0x2f7f86,
  hullRed: 0x7a3b2e,
  roof: 0x5b4a5a,
  skin: 0xd9a77c,
  coat: 0x2d4f63,
  coatTrim: 0xc9a050,
  shirt: 0xe8dcc0,
  trousers: 0x5a4636,
  leather: 0x3d2a1d,
  hat: 0x252a2e,
  hair: 0x3a2618,
  crabShell: 0xc04a2c,
  crabDark: 0x8a2e1e,
  crabBelly: 0xe6b48a,
  barnacle: 0xcfc6b0,
  eye: 0x111111,
  pine: 0x2f5a3c,
  pineLight: 0x3f6e45,
  leaf: 0x557d3a,
  leafLight: 0x6a8f45,
  trunk: 0x5c4130,
  grassTuft: 0x6f9a4a,
  glass: 0xffc26b,
} as const;

export type PalKey = keyof typeof PAL;

const cache = new Map<string, THREE.Material>();

export function mat(key: PalKey | number, opts: { side?: THREE.Side; emissive?: number; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial {
  const color = typeof key === 'number' ? key : PAL[key];
  const id = `${color}|${opts.side ?? 0}|${opts.emissive ?? 0}|${opts.emissiveIntensity ?? 0}`;
  let m = cache.get(id) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
      side: opts.side ?? THREE.FrontSide,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
    cache.set(id, m);
  }
  return m;
}

export function clearMaterialCache() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}

/** Weld vertices then nudge them deterministically: turns perfect primitives into hand-made-looking forms. */
export function jitter(geo: THREE.BufferGeometry, amount: number, seed = 1): THREE.BufferGeometry {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const welded = mergeVertices(geo, 1e-4);
  const pos = welded.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const kx = Math.round(x * 1000), ky = Math.round(y * 1000), kz = Math.round(z * 1000);
    pos.setXYZ(
      i,
      x + (hash2(kx, ky + kz, seed) - 0.5) * amount,
      y + (hash2(ky, kz + kx, seed + 7) - 0.5) * amount,
      z + (hash2(kz, kx + ky, seed + 13) - 0.5) * amount,
    );
  }
  welded.computeVertexNormals();
  return welded;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, cast = true, receive = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Swap palette colours on an un-baked model (e.g. a mossy crab, an amber canopy). Glow adds a soft emissive. */
export function recolour(root: THREE.Object3D, map: Partial<Record<PalKey, number>>, glow: Partial<Record<PalKey, number>> = {}) {
  const byHex = new Map<number, PalKey>();
  for (const k of Object.keys(map) as PalKey[]) byHex.set(PAL[k], k);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const cur = m.material as THREE.MeshStandardMaterial;
    const key = byHex.get(cur.color.getHex());
    if (!key) return;
    const g = glow[key];
    m.material = mat(map[key]!, { side: cur.side, ...(g ? { emissive: map[key]!, emissiveIntensity: g } : {}) });
  });
}
