import { BELLWETHER_REDESIGN } from './variant';
// Keep the exact prototype data in separate chunks: classic sessions never download or parse them.
const prototype = BELLWETHER_REDESIGN ? await Promise.all([
  import('./bellwether-shore-data'), import('./bellwether-outline.json'),
]) : null;
export const BELLWETHER_OUTLINE: readonly number[][] = prototype?.[1].default ?? [];
let field: Float32Array | undefined;
/** Bilinear lookup of the signed Phase 1 coast; positive inland. The source field is unchanged. */
export function bellwetherCoastDistance(x: number, z: number): number {
  if (!field) {
    const bytes = Uint8Array.from(atob(prototype![0].SHORE_BYTES), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    field = Float32Array.from({ length: bytes.length / 4 }, (_, i) => view.getFloat32(i * 4, true));
  }
  const u = Math.max(0, Math.min(619.999999, (x + 620) / 2));
  const v = Math.max(0, Math.min(619.999999, (z + 620) / 2));
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * 621 + i;
  return (1 - b) * ((1 - a) * field[k] + a * field[k + 1]) + b * ((1 - a) * field[k + 621] + a * field[k + 622]);
}
/** The first land-to-sea crossing gives shore placements a safe inner shore even in hooked bays.
 * Inset is measured along the local signed-distance gradient, rather than the ray. */
export function bellwetherCoastPoint(theta: number, inset: number): [number, number] {
  const c = Math.cos(theta), s = Math.sin(theta);
  let lo = 0, hi = 2;
  while (hi < 610 && bellwetherCoastDistance(c * hi, s * hi) > 0) { lo = hi; hi += 2; }
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (bellwetherCoastDistance(c * mid, s * mid) > 0) lo = mid; else hi = mid;
  }
  let x = c * (lo + hi) / 2, z = s * (lo + hi) / 2;
  // Small steps follow curved coves without jumping across an inlet's opposing arm.
  for (let left = Math.abs(inset); left > 1e-6;) {
    const dx = bellwetherCoastDistance(x + 0.5, z) - bellwetherCoastDistance(x - 0.5, z);
    const dz = bellwetherCoastDistance(x, z + 0.5) - bellwetherCoastDistance(x, z - 0.5);
    const len = Math.hypot(dx, dz) || 1, step = Math.min(1, left) * Math.sign(inset);
    x += dx / len * step; z += dz / len * step; left -= Math.abs(step);
  }
  return [x, z];
}
