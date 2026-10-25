import { it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { ENEMIES } from '../data/content';
import { regionLayout } from '../world/layout';
import { REGIONS, type RegionId } from '../world/regions';

// Balance guard for the regular foes (Tom, 2026-10-24: "some enemies can be very hard"): every foe placed in the
// world, fought one-on-one by a player of the foe's own level in that level's metal, with a little food. A fair
// fight should be won nearly every time; a foe that isn't is an outlier to retune.
const METAL: [number, string][] = [[0, 'bronze'], [10, 'iron'], [20, 'steel'], [30, 'storm'], [50, 'abyss'], [60, 'tide']];
const metalAt = (lvl: number) => [...METAL].reverse().find(([l]) => lvl >= l)![1];

function duel(region: RegionId, foe: string, lvl: number, seed: number): boolean {
  const L = regionLayout(region);
  const g = new Game({ seed, save: { ...defaultSave(L.respawn, (L.mooring ?? regionLayout('bellwether').mooring)!), region } });
  const e = g.enemies.find((x) => x.def.id === foe && !x.elite && !x.summoned);
  if (!e) return true;
  // just the two of them
  for (const o of g.enemies) if (o !== e) { o.alive = false; o.respawnAt = Infinity; }
  for (const k of ['attack', 'strength', 'defence'] as const) g.p.xp[k] = xpForLevel(lvl);
  g.p.xp.hitpoints = xpForLevel(Math.max(10, lvl)); // Hitpoints starts at 10
  const m = metalAt(lvl);
  g.p.equip.weapon = { id: `cutlass_${m}`, qty: 1 }; g.p.equip.head = { id: `helm_${m}`, qty: 1 }; g.p.equip.body = { id: `plate_${m}`, qty: 1 };
  g.recalc(); g.p.hp = g.stats.maxHp;
  const q = g.world.nearestWalkable(e.x + 2.5, e.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
  let food = 4; const heal = Math.round(g.stats.maxHp * 0.25);
  for (let t = 0; t < 120; t += 1 / 30) {
    if (e.alive && g.target !== e.id) g.interact(`enemy:${e.id}`); // as a player would: tap it once, again if it drops
    if (g.p.hp < g.stats.maxHp * 0.4 && food > 0 && g.eatCd === 0) { g.p.hp = Math.min(g.stats.maxHp, g.p.hp + heal); food--; g.eatCd = 1.2; }
    g.step(1 / 30);
    if (!e.alive) return true;
    if (g.dead) return false;
  }
  return false;
}

it('every regular foe is a fair fight for a player of its level in that level\'s metal', () => {
  const results: Record<string, number> = {};
  for (const region of Object.keys(REGIONS) as RegionId[]) {
    const foes = new Set(regionLayout(region).spawns.map((s) => s.enemy));
    for (const foe of foes) {
      if (results[foe] !== undefined) continue;
      const lvl = ENEMIES[foe].level;
      let wins = 0;
      for (let s = 0; s < 8; s++) if (duel(region, foe, lvl, 500 + s)) wins++;
      results[foe] = wins;
    }
  }
  console.log(JSON.stringify(results));
  const unfair = Object.entries(results).filter(([, w]) => w < 6).map(([f, w]) => `${f} (level ${ENEMIES[f].level}): ${w}/8`);
  expect(unfair).toEqual([]);
}, 300_000);
