import type { World } from './world';
/** One collision footprint shared by simulation and geometry migration. Local +x is the bow. */
export function shipHullFits(world: Pick<World, 'sailable'>, x: number, z: number, heading: number): boolean {
  const c = Math.cos(heading), s = Math.sin(heading);
  for (const [lx, lz] of [[4.6, 0], [-3.8, 0], [0.5, 1.3], [0.5, -1.3], [2.5, 0.8], [2.5, -0.8], [-2, 1.1], [-2, -1.1]]) {
    if (!world.sailable(x + lx * c - lz * s, z + lx * s + lz * c)) return false;
  }
  return true;
}
