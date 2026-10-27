import { it, expect } from 'vitest';
import { World } from './world';

// Big islands (Tom, 2026-10-28: "make each island 450% bigger"): pathfinding must cross a 4.5x island without a
// full-map scratch (that alone was ~120 MB on a phone), by windowed A* and a coarse plan for long walks.
const R = 600; // a round island 1200 m across: Bellwether at 4.5x
const big = new World({ cx: 0, cz: 0, half: 675 }, (x, z) => {
  const d = Math.hypot(x, z);
  if (d > R) return -2;
  // a water channel across the middle with one ford, so the route has to find it
  if (Math.abs(z) < 3 && Math.abs(x - 200) > 6) return -2;
  return 2;
});
big.bake();

it('crosses a 4.5x island through the one gap, with small scratch memory', () => {
  const t0 = performance.now();
  const path = big.findPath(-400, -300, -380, 300)!;
  const ms = performance.now() - t0;
  expect(path).toBeTruthy();
  const end = path[path.length - 1];
  expect(Math.hypot(end[0] + 380, end[1] - 300)).toBeLessThan(2);
  // it went through the gap at x ~ 200
  expect(path.some(([x, z]) => Math.abs(z) < 8 && Math.abs(x - 200) < 12)).toBe(true);
  // every step is walkable ground
  let [px, pz] = [-400, -300];
  for (const [x, z] of path) { for (let k = 1; k <= 10; k++) expect(big.walkable(px + ((x - px) * k) / 10, pz + ((z - pz) * k) / 10)).toBe(true); [px, pz] = [x, z]; }
  const scratch = (big as unknown as { pg: Float32Array }).pg.length;
  expect(scratch * 13).toBeLessThan(20e6); // under 20 MB of search scratch
  expect(ms).toBeLessThan(1500);
});

it('a short walk on a big island searches only a window round it', () => {
  const fresh = new World({ cx: 0, cz: 0, half: 675 }, () => 2); fresh.bake();
  expect(fresh.findPath(10, 10, 40, 30)).toBeTruthy();
  expect((fresh as unknown as { pg: Float32Array }).pg.length).toBe(0); // a straight line needs no search at all
  // blocked straight line: a window search, sized to the box, not the map
  const walled = new World({ cx: 0, cz: 0, half: 675 }, (x, z) => (Math.abs(x - 25) < 1 && z < 40 ? 30 : 2)); walled.bake();
  expect(walled.findPath(10, 10, 40, 10)).toBeTruthy();
  expect((walled as unknown as { pg: Float32Array }).pg.length).toBeLessThan(400 * 400);
});
