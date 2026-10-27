import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';
import { BELL_SPOTS, BELL_LISTENERS, BELLTIME } from '../data/belltime';
import { ENEMIES } from '../data/content';
import type { RegionId } from '../world/regions';

describe('bell-time', () => {
  it('every bell can be walked to, out of the harbour\'s safe circle, and every listener exists', () => {
    const bad: string[] = [];
    for (const [r, spots] of Object.entries(BELL_SPOTS) as [RegionId, NonNullable<(typeof BELL_SPOTS)[RegionId]>][]) {
      const L = regionLayout(r), w = L.world;
      expect(ENEMIES[BELL_LISTENERS[r]!], r).toBeTruthy();
      for (const s of spots) {
        const at = w.nearestWalkable(s.x, s.z, 4);
        if (!at || !w.findPath(L.respawn.x, L.respawn.z, at[0], at[1])) bad.push(`${r} ${s.where}`);
        else if (Math.hypot(at[0] - L.respawn.x, at[1] - L.respawn.z) < 22) bad.push(`${r} ${s.where} (safe circle)`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('low water comes, the bell rings, you ring it back: a tithe, a song-touched listener, and the first thing you hear', () => {
    const L = regionLayout('bellwether');
    const g = new Game({ seed: 5, save: defaultSave(L.respawn, L.mooring!) });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.belltime.next = g.time;
    g.step(1 / 30);
    const b = g.belltime.here()!;
    expect(b).toBeTruthy();
    expect(g.targets().some((t) => t.key === 'event:bt:ring')).toBe(true);
    const heard: string[] = [];
    g.on((e) => { if (e.type === 'read') heard.push(e.title); });
    const c0 = count(g.p.inv, 'coins');
    const q = g.world.nearestWalkable(b.x + 1, b.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.interact('event:bt:ring');
    for (let t = 0; t < 2 && g.belltime.here(); t += 1 / 30) g.step(1 / 30);
    expect(g.belltime.here()).toBeNull();
    expect(count(g.p.inv, 'coins')).toBeGreaterThan(c0);
    expect(g.s.bellsRung).toBe(1);
    expect(heard).toContain('The first bell');
    const l = g.enemies.find((e) => e.alive && e.def.id === BELL_LISTENERS.bellwether);
    expect(l?.elite).toBeTruthy();
    // unanswered, the water comes back
    g.belltime.next = g.time;
    g.step(1 / 30);
    expect(g.belltime.here()).toBeTruthy();
    for (let t = 0; t < BELLTIME.lasts + 2; t += 0.1) g.step(0.1);
    expect(g.belltime.here()).toBeNull();
  }, 60_000);
});
