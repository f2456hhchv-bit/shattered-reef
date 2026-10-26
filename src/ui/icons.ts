import { artOverride, overrideUrl } from '../art/overrides';
import * as THREE from 'three';
import { RARITY, type SkillId } from '../game/data/items';
import type { Stack } from '../game/sim/inventory';
import { buildItemModel } from '../art/models/items';

// Inventory icons are renders of each item's real 3D model: same camera, same lighting, transparent
// background. The slate tile, brass corner and rarity rim are drawn by CSS around them.

const cache = new Map<string, string>();
let icon: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;

function iconRenderer() {
  if (icon) return icon;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256; // phones draw a slot at ~180 device pixels: 128 went soft
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.3;
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

/** Frame the model's actual projected silhouette (not its bounding sphere), so long thin items
 *  like a swordfish or a pistol fill the tile without being clipped. */
function fitCamera(cam: THREE.PerspectiveCamera, model: THREE.Object3D, sphere: THREE.Sphere) {
  const dir = new THREE.Vector3(0, 0.55, 1).normalize();
  const target = sphere.center.clone();
  let dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.8;
  model.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  model.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    const p = me.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(p.count / 400)); // a few hundred points per part is plenty
    for (let i = 0; i < p.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld));
  });
  const v = new THREE.Vector3();
  for (let iter = 0; iter < 3 && pts.length; iter++) {
    cam.position.copy(dir).multiplyScalar(dist).add(target);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { v.copy(p).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    // recentre on the silhouette, then scale the distance so its larger side spans ~84% of the tile
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, ((x0 + x1) / 2) * half).addScaledVector(up, ((y0 + y1) / 2) * half);
    dist *= Math.max(x1 - x0, y1 - y0) / 2 / 0.84;
  }
  cam.position.copy(dir).multiplyScalar(dist).add(target);
  cam.lookAt(target);
}

let ink: { out: HTMLCanvasElement; sil: HTMLCanvasElement; rim: HTMLCanvasElement } | null = null;

/** Painted finish, to sit beside the hand-painted icons (art/items): a bold dark ink outline, a soft drop shadow, a
 * touch more colour, and a light rim along the top-left edge where the painted icons catch their highlight. */
function outlined(src: HTMLCanvasElement): string {
  const n = src.width, k = n / 128;
  if (!ink) {
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
    ink = { out: mk(), sil: mk(), rim: mk() };
  }
  const { out, sil, rim } = ink;
  const s = sil.getContext('2d')!, o = out.getContext('2d')!, r = rim.getContext('2d')!;
  // the silhouette in ink
  s.clearRect(0, 0, n, n);
  s.globalCompositeOperation = 'source-over';
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#140d08';
  s.fillRect(0, 0, n, n);
  // the rim light: the model's own shape, minus itself nudged up-left, kept inside the model
  r.clearRect(0, 0, n, n);
  r.globalCompositeOperation = 'source-over';
  r.drawImage(src, 0, 0);
  r.globalCompositeOperation = 'source-in';
  r.fillStyle = 'rgba(255,246,222,0.55)';
  r.fillRect(0, 0, n, n);
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(src, 2.2 * k, 2.2 * k);
  o.clearRect(0, 0, n, n);
  o.save();
  o.shadowColor = 'rgba(0,0,0,0.5)'; o.shadowBlur = 6 * k; o.shadowOffsetX = 2 * k; o.shadowOffsetY = 4 * k;
  o.drawImage(sil, 0, 0);
  o.restore();
  const w = 2.6 * k;
  for (let a = 0; a < 16; a++) o.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * w, Math.sin((a / 16) * Math.PI * 2) * w);
  o.save();
  o.filter = 'saturate(1.18) contrast(1.06)';
  o.drawImage(src, 0, 0);
  o.restore();
  o.drawImage(rim, 0, 0);
  return out.toDataURL('image/png');
}

/** Coin piles change shape with quantity, like RuneScape. */
const tierOf = (id: string, qty: number) => (id === 'coins' ? (qty >= 100 ? 100 : qty >= 10 ? 10 : qty > 1 ? 2 : 1) : 1);

export function itemIcon(id: string, qty = 1): string {
  const art = artOverride('items', id); // your redrawn icon (art/items) wins
  if (art) return overrideUrl(art);
  const tier = tierOf(id, qty);
  const key = `${id}|${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { r, scene, cam } = iconRenderer();
  const model = buildItemModel(id, tier);
  model.rotation.set(0.15, -0.55, 0);
  // lathed shapes (bell, shell, tooth) are open surfaces: draw both faces so none vanish when seen from inside
  model.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) (me.material as THREE.Material).side = THREE.DoubleSide; });
  scene.add(model);
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  fitCamera(cam, model, sphere);
  r.render(scene, cam);
  const url = outlined(r.domElement);
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

// Skill medallion icons: same bold style as the tabs (flat fills, 2px dark ink outline).
const K = 'stroke="#1a120a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body: string) => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
export const SKILL_ICONS: Record<SkillId, string> = {
  attack: svg(`<path d="M24 4l4 4-15 15-4-4z" fill="#cfd5d8" ${K}/><path d="M7 19l6 6M5 27l4-4" fill="none" ${K}/><path d="M6 17l9 9" stroke="#c9a050" stroke-width="3.5" stroke-linecap="round"/><path d="M22 7l2 2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`),
  strength: svg(`<path d="M8 13a3 3 0 0 1 6 0v-2a3 3 0 0 1 6 0 3 3 0 0 1 6 1v8c0 5-4 8-9 8h-2c-5 0-8-3-8-7z" fill="#d9a77c" ${K}/><path d="M14 11v6M20 11v6M8 17c3 0 5 1 6 3" fill="none" ${K}/>`),
  defence: svg(`<path d="M16 4l10 3v8c0 7-5 11-10 13C11 26 6 22 6 15V7z" fill="#6b8fc9" ${K}/><path d="M16 4v24M6 13h20" stroke="#c9a050" stroke-width="2.5"/><circle cx="16" cy="13" r="3" fill="#f0d49b" ${K}/>`),
  hitpoints: svg(`<path d="M16 27C6 20 4 15 4 11a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-2 9-12 16z" fill="#d8584a" ${K}/><path d="M9 9a3 3 0 0 1 3-1" fill="none" stroke="#ffd0c0" stroke-width="2" stroke-linecap="round"/>`),
  ranged: svg(`<path d="M4 12h20v5H12z" fill="#9aa0a4" ${K}/><path d="M12 15l-2 11h-5l1-11z" fill="#8a6440" ${K}/><circle cx="27" cy="14.5" r="2.5" fill="#f2c94c" ${K}/><path d="M14 17l2 4" fill="none" ${K}/>`),
  magic: svg(`<path d="M4 22c4-8 10-12 18-10-5 1-7 4-6 7 2 3 7 2 10-1-2 6-8 9-14 8-4 0-7-2-8-4z" fill="#59d0c4" ${K}/><path d="M23 4l1.5 3.5L28 9l-3.5 1.5L23 14l-1.5-3.5L18 9l3.5-1.5z" fill="#e9fbff" ${K}/>`),
  woodcutting: svg(`<path d="M9 28L21 9" stroke="#1a120a" stroke-width="5" stroke-linecap="round"/><path d="M9 28L21 9" stroke="#a9794d" stroke-width="2.5" stroke-linecap="round"/><path d="M17 6c4-3 9-1 11 3l-7 4c-1-3-2-5-4-7z" fill="#cfd5d8" ${K}/>`),
  mining: svg(`<path d="M10 28L22 9" stroke="#1a120a" stroke-width="5" stroke-linecap="round"/><path d="M10 28L22 9" stroke="#a9794d" stroke-width="2.5" stroke-linecap="round"/><path d="M6 9c6-6 16-5 22 3-6-3-13-4-22-3z" fill="#9aa0a4" ${K}/>`),
  sailing: svg(`<path d="M16 4v18" fill="none" ${K}/><path d="M16 5l9 13H16z" fill="#efe3c4" ${K}/><path d="M15 8L8 18h7z" fill="#d8ccb0" ${K}/><path d="M4 22h24l-4 6H8z" fill="#8a5a34" ${K}/>`),
  fishing: svg(`<path d="M4 16c5-7 13-8 19-2l5-4v12l-5-4c-6 6-14 5-19-2z" fill="#4fa7c2" ${K}/><circle cx="10" cy="15" r="1.6" fill="#1a120a"/><path d="M14 13c2 2 2 4 0 6" fill="none" stroke="#1a120a" stroke-width="1.5"/>`),
  smithing: svg(`<path d="M5 11h22l-3 5h-5v4l4 6H9l4-6v-4H9c-3 0-4-2-4-5z" fill="#6f777c" ${K}/><path d="M8 13h17" stroke="#b9c2c6" stroke-width="1.5"/><path d="M20 4l5 5" stroke="#c9a050" stroke-width="3" stroke-linecap="round"/>`),
  gunsmithing: svg(`<path d="M6 8c8 0 17 6 20 15l-5 3C17 18 11 13 6 13z" fill="#d9c08a" ${K}/><path d="M5 7v7" stroke="#8a6440" stroke-width="4" stroke-linecap="round"/><circle cx="11" cy="24" r="3" fill="#6f777c" ${K}/><circle cx="17" cy="27" r="2.4" fill="#6f777c" ${K}/>`),
  fletching: svg(`<path d="M9 4c10 3 15 10 14 24" fill="none" stroke="#1a120a" stroke-width="5" stroke-linecap="round"/><path d="M9 4c10 3 15 10 14 24" fill="none" stroke="#a9794d" stroke-width="2.5" stroke-linecap="round"/><path d="M9 4l14 24" stroke="#e9e5d5" stroke-width="1.2"/><path d="M4 21L24 9" ${K}/><path d="M24 9l-5 0 3 4z" fill="#cfd5d8" ${K}/><path d="M4 21l1-4M4 21l4 1" stroke="#c9584a" stroke-width="2" stroke-linecap="round"/>`),
  crafting: svg(`<path d="M7 25L25 7" stroke="#1a120a" stroke-width="4" stroke-linecap="round"/><path d="M7 25L25 7" stroke="#cfd5d8" stroke-width="2" stroke-linecap="round"/><ellipse cx="23" cy="9" rx="1.6" ry="3" transform="rotate(45 23 9)" fill="#1a120a"/><path d="M23 9c6 4-2 9-8 6s-10 2-8 8" fill="none" stroke="#c9584a" stroke-width="2" stroke-linecap="round"/>`),
  cooking: svg(`<path d="M5 14h22v4c0 5-4 9-11 9S5 23 5 18z" fill="#3b3f42" ${K}/><path d="M3 14h26" ${K}/><path d="M11 10c-1-2 1-3 0-5M16 10c-1-2 1-3 0-5M21 10c-1-2 1-3 0-5" fill="none" stroke="#e9e5d5" stroke-width="2" stroke-linecap="round"/><path d="M9 18h14" stroke="#d88a4a" stroke-width="2.5" stroke-linecap="round"/>`),
};

// Faded outlines shown in empty equipment slots, so you can see what goes where.
const S = 'fill="#e9d3a4" fill-opacity=".16" stroke="#e9d3a4" stroke-opacity=".38" stroke-width="1.6" stroke-linejoin="round"';
export const SLOT_ICONS: Record<string, string> = {
  weapon: svg(`<path d="M25 4l3 3-15 15-3-3z" ${S}/><path d="M7 18l7 7M5 27l4-4" ${S}/>`),
  ammo: svg(`<circle cx="11" cy="20" r="5" ${S}/><circle cx="21" cy="20" r="5" ${S}/><circle cx="16" cy="12" r="5" ${S}/>`),
  head: svg(`<path d="M3 19c4-9 22-9 26 0-5 3-21 3-26 0z" ${S}/><path d="M9 15c1-5 4-7 7-7s6 2 7 7" ${S}/>`),
  body: svg(`<path d="M11 5l5 4 5-4 6 4v18h-6v-9h-10v9H5V9z" ${S}/><path d="M16 9v9" ${S}/>`),
  ring: svg(`<circle cx="16" cy="19" r="8" ${S}/><path d="M13 8l3-4 3 4-3 3z" ${S}/>`),
  ring2: svg(`<circle cx="16" cy="19" r="8" ${S}/><path d="M13 8l3-4 3 4-3 3z" ${S}/>`),
  offhand: svg(`<path d="M16 4l11 4v8c0 6-5 10-11 12C10 26 5 22 5 16V8z" ${S}/><path d="M16 8v16" ${S}/>`),
  legs: svg(`<path d="M8 4h16l1 24h-6l-3-16-3 16H7z" ${S}/>`),
  feet: svg(`<path d="M7 6h7v14h10c3 0 4 2 4 5v2H6z" ${S}/>`),
  hands: svg(`<path d="M9 28V14l-3-5 2-2 4 5V5h2v8h1V4h2v9h1V5h2v9h1V7h2v13c0 5-3 8-7 8z" ${S}/>`),
  neck: svg(`<path d="M7 4c0 10 4 15 9 15s9-5 9-15" ${S}/><path d="M16 19l-4 5 4 5 4-5z" ${S}/>`),
  wrist: svg(`<ellipse cx="16" cy="16" rx="11" ry="6" ${S}/><ellipse cx="16" cy="16" rx="7" ry="3" ${S}/>`),
};
