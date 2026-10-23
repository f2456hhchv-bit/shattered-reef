import { it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
const base = new Game({ seed: 1 });
const fresh = (seed: number) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring) });
// Balance guard: simulated fights with a simple bot that dodges, eats and keeps to the arena.
it('Lockbound Guardian balance: needs ~12 melee, easier with its weakness (magic)', () => {
  const results: Record<string, number> = {};
  for (const [lvl, weapon] of [[8, 'cutlass_bronze'], [12, 'cutlass_bronze'], [15, 'cutlass_bronze'], [10, 'staff_driftwood'], [10, 'pistol_flintlock']] as const) {
    let wins = 0, foodUsed = 0, time = 0;
    for (let s = 0; s < 8; s++) {
      const g = fresh(100 + s);
      for (const k of ['attack', 'strength', 'defence', 'hitpoints', 'magic', 'ranged'] as const) g.p.xp[k] = xpForLevel(lvl);
      g.p.equip.weapon = { id: weapon, qty: 1 }; g.p.equip.head = { id: 'helm_bronze', qty: 1 }; g.p.equip.ammo = { id: 'shot_bronze', qty: 300 }; g.give('charm_tide', 300);
      g.s.combat.spell = 'bolt'; g.recalc(); g.p.hp = g.stats.maxHp;
      g.give('tuning_bell', 1);
      const q = g.world.nearestWalkable(g.layout.plinth.x, g.layout.plinth.z + 1.6, 4)!; g.p.x = q[0]; g.p.z = q[1];
      g.interact('ruin'); let food = 10; const t0 = g.time;
      for (let t = 0; t < 400; t += 1 / 30) {
        if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id;
        const danger = g.telegraphs.find((tg) => tg.damage > 0 && g.insideTelegraph(tg, g.p.x, g.p.z));
        const R = g.layout.ruin;
        let a = danger ? Math.atan2(g.p.z - danger.z, g.p.x - danger.x) + (danger.kind === 'cone' ? 1.2 : 0) : 0;
        if (Math.hypot(g.p.x - R.x, g.p.z - R.z) > 6) a = Math.atan2(R.z - g.p.z, R.x - g.p.x) + 0.6;
        if (danger && danger.dur - danger.t < 0.22 && g.rollCd === 0) { g.setMoveDir(Math.cos(a), Math.sin(a)); g.useRoll(); g.setMoveDir(0, 0); }
        else if (danger) g.setMoveDir(Math.cos(a), Math.sin(a));
        else g.setMoveDir(0, 0);
        if (g.p.hp < g.stats.maxHp * 0.45 && food > 0 && g.eatCd === 0) { g.p.hp = Math.min(g.stats.maxHp, g.p.hp + 5); food--; g.eatCd = 1.2; }
        g.step(1 / 30);
        if (g.s.flags.guardian_defeated || g.dead) break;
      }
      if (g.s.flags.guardian_defeated) { wins++; time += g.time - t0; } foodUsed += 10 - food;
    }
    results[`${weapon}@${lvl}`] = wins;
  }
  expect(results['cutlass_bronze@8']).toBeLessThanOrEqual(2);
  expect(results['cutlass_bronze@15']).toBeGreaterThanOrEqual(6);
  expect(results['staff_driftwood@10']).toBeGreaterThanOrEqual(7);
  expect(results['pistol_flintlock@10']).toBeGreaterThanOrEqual(6);
}, 30_000);
