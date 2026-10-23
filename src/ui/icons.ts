import { item, RARITY } from '../game/data/items';
import type { Stack } from '../game/sim/inventory';

// Item icons painted in code: chunky silhouettes, top-left light, one shared style.

const cache = new Map<string, string>();

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Ctx = CanvasRenderingContext2D;

function poly(c: Ctx, pts: number[][], fill: string, stroke = 'rgba(20,14,8,.85)') {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = stroke;
  c.stroke();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = 'rgba(20,14,8,.85)';
  c.stroke();
}

function paint(c: Ctx, shape: string, col: string, acc?: string) {
  const hi = shade(col, 1.25), lo = shade(col, 0.72);
  switch (shape) {
    case 'log':
      poly(c, [[10, 40], [44, 16], [56, 28], [22, 52]], col);
      poly(c, [[10, 40], [44, 16], [48, 22], [14, 46]], hi, 'transparent');
      ellipse(c, 50, 22, 7, 9, acc ?? hi, -0.6);
      ellipse(c, 50, 22, 3, 4, lo, -0.6);
      break;
    case 'ore':
      poly(c, [[12, 44], [16, 22], [32, 12], [50, 20], [54, 42], [36, 54]], col);
      poly(c, [[16, 22], [32, 12], [40, 18], [22, 30]], hi, 'transparent');
      for (const [x, y, r] of [[28, 34, 5], [40, 28, 4], [38, 44, 4.5]]) ellipse(c, x, y, r, r * 0.8, acc ?? '#c77');
      break;
    case 'bar':
      poly(c, [[8, 40], [20, 26], [56, 26], [44, 40]], hi);
      poly(c, [[8, 40], [44, 40], [44, 50], [8, 50]], col);
      poly(c, [[44, 40], [56, 26], [56, 36], [44, 50]], lo);
      break;
    case 'fish':
      ellipse(c, 30, 34, 20, 11, col);
      poly(c, [[48, 34], [60, 22], [58, 46]], lo);
      ellipse(c, 22, 30, 7, 3, hi);
      ellipse(c, 16, 32, 2.6, 2.6, '#111');
      if (acc) poly(c, [[30, 23], [36, 14], [40, 25]], acc);
      break;
    case 'meat':
      ellipse(c, 28, 36, 18, 13, col, -0.3);
      ellipse(c, 24, 32, 9, 5, hi, -0.3);
      poly(c, [[42, 26], [56, 14], [60, 20], [48, 32]], '#efe3c4');
      break;
    case 'burnt':
      ellipse(c, 32, 36, 18, 12, col);
      ellipse(c, 28, 32, 6, 3, '#4a3a30');
      break;
    case 'coins':
      for (const [x, y] of [[22, 44], [40, 44], [31, 34], [26, 24]]) { ellipse(c, x, y, 12, 6, col); ellipse(c, x, y - 1, 7, 3, hi); }
      break;
    case 'bread':
      ellipse(c, 32, 38, 22, 13, col);
      ellipse(c, 32, 32, 18, 9, hi);
      for (const x of [22, 32, 42]) { c.beginPath(); c.moveTo(x - 3, 28); c.lineTo(x + 3, 36); c.strokeStyle = lo; c.lineWidth = 2.5; c.stroke(); }
      break;
    case 'hatchet':
      poly(c, [[16, 54], [40, 14], [45, 17], [21, 57]], '#8a6440');
      poly(c, [[34, 10], [54, 14], [52, 32], [40, 26]], col);
      poly(c, [[34, 10], [54, 14], [53, 20], [37, 17]], hi, 'transparent');
      break;
    case 'pickaxe':
      poly(c, [[30, 56], [34, 14], [39, 14], [35, 56]], '#8a6440');
      poly(c, [[8, 22], [36, 8], [60, 22], [54, 24], [36, 16], [14, 26]], col);
      break;
    case 'rod':
      c.beginPath(); c.moveTo(10, 56); c.quadraticCurveTo(30, 30, 56, 8); c.lineWidth = 5; c.strokeStyle = col; c.stroke();
      c.beginPath(); c.moveTo(56, 8); c.lineTo(52, 44); c.lineWidth = 1.5; c.strokeStyle = '#e9e5d5'; c.stroke();
      ellipse(c, 16, 50, 5, 5, '#5a4636');
      break;
    case 'cutlass':
      poly(c, [[14, 52], [46, 14], [56, 10], [52, 20], [20, 56]], col);
      poly(c, [[14, 52], [46, 14], [50, 13], [17, 54]], hi, 'transparent');
      poly(c, [[10, 46], [22, 58], [26, 54], [14, 42]], acc ?? '#c9a050');
      poly(c, [[6, 58], [12, 52], [16, 56], [10, 62]], '#5a3a26');
      break;
    case 'helm':
      poly(c, [[12, 42], [14, 24], [32, 12], [50, 24], [52, 42], [44, 46], [44, 34], [20, 34], [20, 46]], col);
      poly(c, [[14, 24], [32, 12], [40, 16], [20, 26]], hi, 'transparent');
      break;
    case 'cap':
      ellipse(c, 32, 32, 18, 14, col);
      poly(c, [[14, 36], [50, 36], [54, 44], [10, 44]], lo);
      break;
    case 'coat':
      poly(c, [[18, 12], [46, 12], [56, 24], [50, 30], [46, 26], [46, 56], [18, 56], [18, 26], [14, 30], [8, 24]], col);
      poly(c, [[30, 12], [34, 12], [34, 56], [30, 56]], acc ?? lo, 'transparent');
      break;
    case 'ring':
      c.beginPath(); c.arc(32, 36, 15, 0, Math.PI * 2); c.lineWidth = 9; c.strokeStyle = 'rgba(20,14,8,.85)'; c.stroke();
      c.lineWidth = 6; c.strokeStyle = col; c.stroke();
      ellipse(c, 32, 20, 6, 5, acc ?? '#59d0c4');
      break;
    case 'bell':
      poly(c, [[18, 46], [22, 22], [32, 14], [42, 22], [46, 46]], col);
      poly(c, [[14, 46], [50, 46], [50, 50], [14, 50]], lo);
      ellipse(c, 32, 54, 4, 4, lo);
      break;
    case 'tooth':
      poly(c, [[22, 10], [42, 10], [46, 26], [38, 56], [32, 40], [26, 56], [18, 26]], col);
      poly(c, [[29, 22], [35, 22], [35, 34], [29, 34]], acc ?? '#59d0c4', 'transparent');
      break;
    case 'pistol':
      poly(c, [[8, 26], [44, 22], [48, 30], [12, 34]], acc ?? '#9aa0a4');
      poly(c, [[30, 28], [46, 26], [52, 48], [40, 54], [34, 36]], col);
      poly(c, [[44, 18], [50, 18], [50, 24], [44, 24]], '#3b3f42');
      break;
    case 'shot':
      for (const [x, y] of [[22, 40], [38, 40], [30, 28], [44, 26], [18, 26]]) { ellipse(c, x, y, 7, 7, col); ellipse(c, x - 2, y - 2, 2.5, 2.5, hi); }
      break;
    case 'staff':
      poly(c, [[14, 58], [42, 14], [46, 16], [18, 60]], col);
      ellipse(c, 46, 13, 8, 8, acc ?? '#59d0c4');
      ellipse(c, 44, 11, 3, 3, '#e9fbf8');
      break;
    case 'charm':
      poly(c, [[32, 8], [46, 26], [32, 56], [18, 26]], col);
      poly(c, [[32, 8], [40, 20], [32, 26], [24, 20]], hi, 'transparent');
      c.beginPath(); c.moveTo(14, 30); c.quadraticCurveTo(32, 44, 50, 30); c.lineWidth = 3; c.strokeStyle = acc ?? '#2a7f78'; c.stroke();
      break;
    case 'shell':
      poly(c, [[10, 46], [18, 22], [32, 12], [46, 22], [54, 46]], col);
      for (const x of [20, 32, 44]) { c.beginPath(); c.moveTo(32, 14); c.lineTo(x, 46); c.lineWidth = 2; c.strokeStyle = lo; c.stroke(); }
      ellipse(c, 24, 30, 4, 3, acc ?? '#c04a2c');
      break;
  }
}

export function itemIcon(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const d = item(id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  c.lineJoin = 'round';
  c.translate(0, 1);
  // soft drop shadow first (light from top-left)
  c.save();
  c.translate(3, 3);
  c.globalAlpha = 0.28;
  paint(c, d.icon.shape, '#000000', '#000000');
  c.restore();
  paint(c, d.icon.shape, d.icon.color, d.icon.accent);
  const url = cv.toDataURL();
  cache.set(id, url);
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
