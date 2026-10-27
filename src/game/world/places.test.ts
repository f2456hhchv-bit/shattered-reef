import { describe, it, expect } from 'vitest';
import { PLACES, placeRegion } from './places';
import { regionLayout } from './layout';
import { ISLETS } from './island';
import type { RegionId } from './regions';

// The island diaries ask you to discover every place on an island: every place must be somewhere you can walk to.
describe('places', () => {
  const regions = [...new Set(PLACES.map(placeRegion))] as RegionId[];
  for (const r of regions) {
    it(`${r}: every place can be reached (on foot, or by ship for sea places)`, () => {
      const L = regionLayout(r);
      const bad: string[] = [];
      for (const p of PLACES.filter((x) => placeRegion(x) === r)) {
        // you discover a place by walking within its radius: some walkable point inside it must be on a path from the landing
        const islet = ISLETS.find((i) => Math.hypot(i.x - p.x, i.z - p.z) < i.r);
        if (p.sea || islet) {
          // a sea place is found from the deck: the ship must be able to sail somewhere inside its radius
          const route = L.mooring && L.world.findSeaPath(L.mooring.x, L.mooring.z, p.x, p.z);
          const end = route?.[route.length - 1];
          // an islet: you sail alongside and step ashore (within the islet and a disembark's reach of it)
          if (!end || Math.hypot(end[0] - p.x, end[1] - p.z) >= (islet ? islet.r + 8 : p.r)) bad.push(p.id);
          continue;
        }
        const goal = L.world.nearestWalkable(p.x, p.z, Math.max(2, p.r - 1));
        const path = goal && L.world.findPath(L.respawn.x, L.respawn.z, goal[0], goal[1]);
        if (!path) bad.push(p.id);
      }
      expect(bad).toEqual([]);
    });
  }
});

describe('islets', () => {
  it('tap Leviathan\'s Rest from the deck: the ship sails round to it and you can step ashore', async () => {
    const { Game } = await import('../sim/game');
    const { defaultSave } = await import('../sim/save');
    const { WRACK_LAYOUT } = await import('./island');
    const L = regionLayout('wrack');
    const g = new Game({ seed: 4, save: { ...defaultSave(L.respawn, L.mooring!), region: 'wrack' } });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.naval.foes.forEach((f) => { f.alive = false; f.respawnAt = Infinity; });
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    const I = WRACK_LAYOUT.islet;
    g.moveTo(I.x, I.z);
    for (let t = 0; t < 120; t += 1 / 30) { g.step(1 / 30); if (g.landingPoint() && Math.hypot(g.ship.x - I.x, g.ship.z - I.z) < 24) break; }
    expect(Math.hypot(g.ship.x - I.x, g.ship.z - I.z)).toBeLessThan(24);
    g.disembark();
    expect(g.p.onShip).toBe(false);
    expect(Math.hypot(g.p.x - I.x, g.p.z - I.z)).toBeLessThan(16);
  }, 60_000);
});

describe('reachability audit', () => {
  for (const r of ['bellwether', 'sunreach', 'amberhold', 'wrack', 'smugglers_caves', 'ember_deep'] as RegionId[]) {
    it(`${r}: every NPC, station, bank, arena, quest spot, land node and foe can be walked up to`, async () => {
      const { QUESTS } = await import('../data/quests');
      const { NODES } = await import('../data/content');
      const L = regionLayout(r), w = L.world;
      // reachable = a walkable point within (reach) of it that has a path from where you arrive
      const ok = (x: number, z: number, reach: number) => {
        for (let k = 0; k < 16; k++) for (const d of [0.6, 1.2, Math.max(0.6, reach - 0.4)]) {
          const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
          if (w.walkable(px, pz) && w.findPath(L.respawn.x, L.respawn.z, px, pz)) return true;
        }
        return false;
      };
      const bad: string[] = [];
      const onIsletL = (x: number, z: number) => ISLETS.some((i) => Math.hypot(i.x - x, i.z - z) < i.r);
      for (const n of L.npcs) if (!ok(n.x, n.z, 2.2)) bad.push(`npc ${n.id}`);
      L.stations.forEach((s) => { if (!ok(s.x, s.z, 2.3)) bad.push(`station ${s.id}`); });
      L.banks.forEach((b, i) => { if (!ok(b.x, b.z, 2.2)) bad.push(`bank ${i}`); });
      const { LORE } = await import('../data/lore');
      const { DOORS } = await import('../data/doors');
      for (const d of DOORS) if (d.region === r && !ok(d.x, d.z, 2.2)) bad.push(`door ${d.id}`);
      for (const l of LORE) if (l.region === r && !onIsletL(l.x, l.z) && !ok(l.x, l.z, 2.2)) bad.push(`lore ${l.id}`);
      for (const a of L.arenas) if (!ok(a.altar.x, a.altar.z, 2.2)) bad.push(`arena ${a.boss}`);
      for (const q of Object.values(QUESTS)) for (const st of q.stages) for (const m of st.marks ?? []) {
        if (m.region !== r) continue;
        if (m.fromShip) {
          // used from the deck: the ship must get within the 6 m a sea mark allows
          const route = L.mooring && w.findSeaPath(L.mooring.x, L.mooring.z, m.x, m.z), end = route?.[route.length - 1];
          if (!end || Math.hypot(end[0] - m.x, end[1] - m.z) > 6) bad.push(`sea quest ${q.id}:${m.id}`);
        } else if (!ok(m.x, m.z, 2.2)) bad.push(`quest ${q.id}:${m.id}`);
      }
      // (islets are reached by ship: what stands on one is checked from its own shore, below)
      const onIslet = (x: number, z: number) => ISLETS.some((i) => Math.hypot(i.x - x, i.z - z) < i.r);
      for (const n of L.nodes) { const d = NODES[n.def]; if (d.fromShip || n.scenery || onIslet(n.x, n.z)) continue; if (!ok(n.x, n.z, d.reach ?? 2.2)) bad.push(`node ${n.def}@${Math.round(n.x)},${Math.round(n.z)}`); }
      for (const i of ISLETS) {
        const shore = w.nearestWalkable(i.x, i.z, i.r);
        if (!shore) continue;
        for (const n of L.nodes.filter((x) => !x.scenery && Math.hypot(i.x - x.x, i.z - x.z) < i.r)) {
          const reach = NODES[n.def].reach ?? 2.2;
          let found = false;
          for (let k = 0; k < 16 && !found; k++) { const a = (k / 16) * Math.PI * 2, px = n.x + Math.cos(a) * (reach - 0.4), pz = n.z + Math.sin(a) * (reach - 0.4); found = w.walkable(px, pz) && !!w.findPath(shore[0], shore[1], px, pz); }
          if (!found) bad.push(`islet node ${n.def}`);
        }
        for (const l of LORE.filter((x) => x.region === r && Math.hypot(i.x - x.x, i.z - x.z) < i.r)) {
          let found = false;
          for (let k = 0; k < 16 && !found; k++) { const a = (k / 16) * Math.PI * 2, px = l.x + Math.cos(a) * 1.6, pz = l.z + Math.sin(a) * 1.6; found = w.walkable(px, pz) && !!w.findPath(shore[0], shore[1], px, pz); }
          if (!found) bad.push(`islet lore ${l.id}`);
        }
      }
      // every foe stands somewhere you can walk up and fight it (melee reach ~1.6 m)
      for (const q of Object.values(QUESTS)) for (const st of q.stages) { const k = st.kill?.spawn; if (k && k.region === r) { const at = w.nearestWalkable(k.x, k.z, 6); if (!at || !ok(at[0], at[1], 1.6)) bad.push(`quest foe ${st.kill!.foe}`);
        // a foe inside the landing's safe circle (16 m: SAFE_RADIUS in game.ts) breaks off and goes home: it can't be fought
        else if (Math.hypot(at[0] - L.respawn.x, at[1] - L.respawn.z) < 18) bad.push(`quest foe ${st.kill!.foe} in the safe harbour`); } }
      for (const sp of L.spawns) if (!onIslet(sp.x, sp.z) && !ok(sp.x, sp.z, 1.6)) bad.push(`foe ${sp.enemy}@${Math.round(sp.x)},${Math.round(sp.z)}`);
      expect(bad).toEqual([]);
    }, 120_000);
  }
});
