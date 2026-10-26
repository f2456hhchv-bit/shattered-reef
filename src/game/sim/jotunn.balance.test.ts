import { it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { SPELLS } from '../data/content';
import { regionLayout } from '../world/layout';
const SL = regionLayout('wrack');
const fresh = (seed: number) => { const g = new Game({ seed, save: { ...defaultSave(SL.respawn, SL.mooring!), region: 'wrack' } }); for (const e of g.enemies) if (Math.hypot(e.x - SL.arenas[0].x, e.z - SL.arenas[0].z) < 30) { e.alive = false; e.respawnAt = Infinity; } return g; };
// Balance guard: simulated fights with a simple bot that dodges, eats and keeps to the arena.
it('Thunder Jötunn balance (Stormwrack, 50+): lost under 70, won at 82 in sky gear, easier with its weakness (magic)', () => {
  const results: Record<string, number> = {};
  for (const [lvl, weapon] of [[66, 'cutlass_cinder'], [75, 'cutlass_sky'], [82, 'cutlass_sky'], [75, 'staff_tide']] as const) {
    let wins = 0, foodUsed = 0, time = 0;
    for (let s = 0; s < 16; s++) {
      const g = fresh(100 + s);
      for (const k of ['attack', 'strength', 'defence', 'hitpoints', 'magic', 'ranged'] as const) g.p.xp[k] = xpForLevel(lvl);
      g.p.equip.weapon = { id: weapon, qty: 1 }; g.p.equip.head = { id: 'helm_cinder', qty: 1 }; g.p.equip.body = { id: 'plate_cinder', qty: 1 }; g.p.equip.legs = { id: 'legs_cinder', qty: 1 }; g.give('charm_tide', 300);
      g.s.combat.spell = [...SPELLS].reverse().find((sp) => sp.level <= lvl)!.id as typeof g.s.combat.spell; g.recalc(); g.p.hp = g.stats.maxHp; // the best spell for the level
      g.give('tuning_bell', 1);
      const q = g.world.nearestWalkable(g.layout.arenas[0].altar.x, g.layout.arenas[0].altar.z + 1.6, 4)!; g.p.x = q[0]; g.p.z = q[1];
      g.interact('arena:0'); let food = 10; const t0 = g.time;
      for (let t = 0; t < 400; t += 1 / 30) {
        if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id;
        // dodge like a competent player: head for the nearest walkable spot outside the telegraph, staying in the ring
        const danger = g.telegraphs.find((tg) => tg.damage > 0 && g.insideTelegraph(tg, g.p.x, g.p.z));
        const R = g.layout.arenas[0];
        if (danger) {
          let best: [number, number] | null = null, bd = Infinity;
          for (let k = 0; k < 16; k++) for (const r of [1.5, 2.5, 3.5, 4.5]) {
            const a = (k / 16) * Math.PI * 2, x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r;
            if (g.insideTelegraph(danger, x, z) || !g.world.lineWalkable(g.p.x, g.p.z, x, z) || Math.hypot(x - R.x, z - R.z) > 6.3) continue;
            const cost = r + Math.hypot(x - R.x, z - R.z) * 0.3;
            if (cost < bd) { bd = cost; best = [x, z]; }
          }
          const b = g.boss ?? { x: R.x, z: R.z };
          const [tx, tz] = best ?? [g.p.x * 2 - b.x, g.p.z * 2 - b.z];
          const a = Math.atan2(tz - g.p.z, tx - g.p.x);
          if (danger.dur - danger.t < 0.22 && g.rollCd === 0) { g.setMoveDir(Math.cos(a), Math.sin(a)); g.useRoll(); g.setMoveDir(0, 0); }
          else g.setMoveDir(Math.cos(a), Math.sin(a));
        } else if (g.stats.style !== 'melee' && g.boss && Math.hypot(g.boss.x - g.p.x, g.boss.z - g.p.z) < 5) {
          // ranged/magic kite: step to the walkable spot in the ring furthest from the boss
          let best: [number, number] | null = null, bd = -Infinity;
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2, x = g.p.x + Math.cos(a) * 2.5, z = g.p.z + Math.sin(a) * 2.5;
            if (!g.world.lineWalkable(g.p.x, g.p.z, x, z) || Math.hypot(x - R.x, z - R.z) > 6.3) continue;
            const score = Math.hypot(x - g.boss.x, z - g.boss.z);
            if (score > bd) { bd = score; best = [x, z]; }
          }
          if (best) { const a = Math.atan2(best[1] - g.p.z, best[0] - g.p.x); g.setMoveDir(Math.cos(a), Math.sin(a)); } else g.setMoveDir(0, 0);
        } else g.setMoveDir(0, 0);
        if (g.p.hp < g.stats.maxHp * 0.45 && food > 0 && g.eatCd === 0) { g.p.hp = Math.min(g.stats.maxHp, g.p.hp + 200); food--; g.eatCd = 1.2; } // a 20-heal food (shark), ×10
        g.step(1 / 30);
        if (g.s.flags.jotunn_defeated || g.dead) break;
      }
      if (g.s.flags.jotunn_defeated) { wins++; time += g.time - t0; } foodUsed += 10 - food;
    }
    results[`${weapon}@${lvl}`] = wins;
  }
  console.log(JSON.stringify(results));
  // checked 2026-10-26: cinder@66 3, sky@75 12, sky@82 13, tide staff@75 16 (of 16)
  expect(results['cutlass_cinder@66']).toBeLessThanOrEqual(6); // under-levelled: mostly a loss
  expect(results['cutlass_sky@82']).toBeGreaterThanOrEqual(12);
  expect(results['staff_tide@75']).toBeGreaterThanOrEqual(results['cutlass_sky@75']); // its weakness
}, 180_000);
