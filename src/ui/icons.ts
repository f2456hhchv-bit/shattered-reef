import * as THREE from 'three';
import { RARITY } from '../game/data/items';
import type { Stack } from '../game/sim/inventory';
import { buildItemModel } from '../art/models/items';

// Inventory icons are renders of each item's real 3D model: same camera, same lighting, transparent
// background. The slate tile, brass corner and rarity rim are drawn by CSS around them.

const cache = new Map<string, string>();
let icon: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;

function iconRenderer() {
  if (icon) return icon;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x3a3024, 1.3));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.6);
  key.position.set(-1.5, 2.5, 2);
  const rim = new THREE.DirectionalLight(0x9fe8f0, 1.4);
  rim.position.set(2, 1, -2);
  scene.add(key, rim);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
  icon = { r, scene, cam };
  return icon;
}

/** Coin piles change shape with quantity, like RuneScape. */
const tierOf = (id: string, qty: number) => (id === 'coins' ? (qty >= 100 ? 100 : qty >= 10 ? 10 : qty > 1 ? 2 : 1) : 1);

export function itemIcon(id: string, qty = 1): string {
  const tier = tierOf(id, qty);
  const key = `${id}|${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { r, scene, cam } = iconRenderer();
  const model = buildItemModel(id, tier);
  model.rotation.set(0.15, -0.55, 0);
  scene.add(model);
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.8;
  cam.position.set(0, 0.55, 1).normalize().multiplyScalar(dist).add(sphere.center);
  cam.lookAt(sphere.center);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.remove(model);
  model.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.geometry.dispose(); });
  cache.set(key, url);
  return url;
}

export function rarityColour(s: Stack | null | undefined): string {
  return s?.inst ? RARITY[s.inst.rarity].color : '#e8dcc0';
}

// Tab icons: simple, bold, same stroke weight as item icons.
export const TAB_ICONS: Record<string, string> = {
  pack: '<svg viewBox="0 0 32 32"><path d="M8 12h16l2 15H6z" fill="#8a6440" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><path d="M12 12V8a4 4 0 0 1 8 0v4" fill="none" stroke="#1a120a" stroke-width="2.5"/><path d="M13 17h6" stroke="#d6b07a" stroke-width="2.5" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 32 32"><path d="M8 18c0-7 4-12 8-12s8 5 8 12v4h-4v-6h-8v6H8z" fill="#9aa0a4" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><path d="M12 11c1-2 2-3 4-3" stroke="#e9e5d5" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  skills: '<svg viewBox="0 0 32 32"><rect x="5" y="17" width="5" height="10" fill="#6f9a4a" stroke="#1a120a" stroke-width="2"/><rect x="13.5" y="11" width="5" height="16" fill="#c9a050" stroke="#1a120a" stroke-width="2"/><rect x="22" y="5" width="5" height="22" fill="#d0604c" stroke="#1a120a" stroke-width="2"/></svg>',
  quests: '<svg viewBox="0 0 32 32"><path d="M9 5h14a3 3 0 0 1 3 3v19H12a3 3 0 0 1-3-3z" fill="#e6dcc0" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><path d="M13 11h9M13 15h9M13 19h6" stroke="#8a6440" stroke-width="2" stroke-linecap="round"/></svg>',
  map: '<svg viewBox="0 0 32 32"><path d="M4 8l8-3 8 3 8-3v19l-8 3-8-3-8 3z" fill="#4fa7c2" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><path d="M12 9c3 1 5 4 5 7s-3 5-6 5c-2-3-2-9 1-12z" fill="#6f9a4a" stroke="#1a120a" stroke-width="1.6"/></svg>',
  settings: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="8" fill="#9aa0a4" stroke="#1a120a" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#1a120a"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l3.5 3.5M21.5 21.5L25 25M7 25l3.5-3.5M21.5 10.5L25 7" stroke="#1a120a" stroke-width="3" stroke-linecap="round"/></svg>',
};
