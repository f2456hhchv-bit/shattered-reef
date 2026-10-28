import { describe, expect, it } from 'vitest';
import { coastDist, coastPoint, LAYOUT, rawHeight, LAGOON, BELL_TOWN } from './island';

describe('Bellwether authored geography', () => {
  it('uses the approved shore field when enabled', () => {
    if (!BELLWETHER_REDESIGN) return;
    expect(coastDist(305, -285)).toBeLessThan(-10);
    expect(coastDist(-110, -450)).toBeGreaterThan(0);
    expect(coastDist(LAGOON.x, LAGOON.z)).toBeGreaterThan(70);
    expect(rawHeight(LAGOON.x, LAGOON.z)).toBeLessThan(0);
    expect(LAYOUT.wreck).toEqual({ x: 365, z: -267 });
    expect(coastDist(LAYOUT.gullhaven.x, LAYOUT.gullhaven.z)).toBeGreaterThan(25);
    for (let angle = 0; angle < 360; angle += 10) {
      const [x, z] = coastPoint(angle, 0);
      expect(Math.abs(coastDist(x, z))).toBeLessThan(0.15);
    }
  });
});

import { regionLayout } from './layout';
import baseline from './bellwether-classic-nodes.json';
import { NODES } from '../data/content';
import { bellwetherRedesignEnabled, BELLWETHER_REDESIGN } from './variant';

describe('Bellwether compatibility and access', () => {
  it('requires explicit opt-in and allows classic override', () => {
    expect(bellwetherRedesignEnabled('', undefined)).toBe(false);
    expect(bellwetherRedesignEnabled('?bellwether=phase2', undefined)).toBe(true);
    expect(bellwetherRedesignEnabled('?bellwether=classic', '1')).toBe(false);
  });
  it('retains every classic resource identity and type without increasing rewards', () => {
    if (!BELLWETHER_REDESIGN) return;
    const L = regionLayout('bellwether');
    expect(L.nodes.length).toBe(baseline.length);
    expect(L.nodes.every((n,i) => n.uid===baseline[i].uid && n.def===baseline[i].def && n.seed===baseline[i].seed)).toBe(true);
  });
  it('connects coastal people, quests, harbour and resources to usable ground or water', () => {
    if (!BELLWETHER_REDESIGN) return;
    const L = regionLayout('bellwether'), w = L.world;
    const targets = [LAYOUT.wreck, {x:LAYOUT.wreck.x+3,z:LAYOUT.wreck.z+3}, ...L.npcs.filter(n => ['gull','muirne','dougal'].includes(n.id)), ...L.portals.map(p=>p.out)];
    for (const p of targets) {
      const q = w.nearestWalkable(p.x,p.z, 2);
      expect(q, JSON.stringify(p)).not.toBeNull();
      const route = q && w.findPath(L.respawn.x,L.respawn.z,q[0],q[1]);
      const end = route?.at(-1);
      expect(end, JSON.stringify(p)).toBeDefined();
      expect(end && Math.hypot(end[0]-q![0],end[1]-q![1]), JSON.stringify(p)).toBeLessThan(2);
    }
    expect(w.sailable(L.mooring!.x,L.mooring!.z)).toBe(true);
    const sea = w.findSeaPath(L.mooring!.x,L.mooring!.z,0,500)?.at(-1);
    expect(sea && Math.hypot(sea[0],sea[1]-500)).toBeLessThan(2);
    const inaccessible = L.nodes.filter(n => !NODES[n.def].fromShip && !w.nearestWalkable(n.x,n.z,n.def==='kelp_bed'?3.1:2.4));
    expect(inaccessible.map(n => n.uid+':'+n.def)).toEqual([]);
    const misplacedBones = L.nodes.filter(n => n.def === 'rock_levi' && Math.hypot(n.x-LAYOUT.islet.x,n.z-LAYOUT.islet.z)>13);
    expect(misplacedBones.map(n=>n.uid)).toEqual([]);
    const dryShipNodes = L.nodes.filter(n => NODES[n.def].fromShip && w.ground(n.x,n.z)>-0.5);
    expect(dryShipNodes.map(n=>n.uid+':'+n.def)).toEqual([]);
  });
});

import classicTown from './bellwether-classic-town.json';
it('retains the complete original town footprint', () => {
 expect(BELL_TOWN.buildings.map(b => [b.id,b.x,b.z,b.w,b.d])).toEqual(classicTown);
});

it('retains open approaches around the shark boss reef', async () => {
  if (!BELLWETHER_REDESIGN) return;
  const { SEA_SPAWNS } = await import('../data/sea');
  const lair = SEA_SPAWNS.bellwether!.find(s=>s.foe==='old_gnasher')!;
  const w = regionLayout('bellwether').world;
  for(let angle=0;angle<Math.PI;angle+=Math.PI/12) {
    expect(w.seaClear(lair.x+12+Math.cos(angle)*22,lair.z+Math.sin(angle)*22), `${angle}`).toBe(true);
  }
});

it('forms a physical cliff on the exposed northeastern headland while leaving its inland approach gentle', () => {
  if (!BELLWETHER_REDESIGN) return;
  expect(rawHeight(422,-240)).toBeGreaterThan(10);
  expect(rawHeight(422,-240)-rawHeight(428,-240)).toBeGreaterThan(7);
  expect(Math.abs(rawHeight(402,-240)-rawHeight(398,-240))/4).toBeLessThan(1);
  expect(rawHeight(432,-240)).toBeLessThan(0);
});
