import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { xpForLevel } from './xp';
import { FEATS, FEAT_TIERS } from '../data/feats';
import { ENEMIES } from '../data/content';

const base = new Game({ seed: 1 });
const fresh = (seed: number) => new Game({ seed, save: defaultSave(base.layout.respawn, base.layout.mooring!) });

/** a strong fighter wakes the Guardian and stands toe to toe (health kept up without eating) */
function fightGuardian(g: Game, eat: boolean) {
  for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) g.p.xp[k] = xpForLevel(70);
  g.p.equip.weapon = { id: 'cutlass_tide', qty: 1 }; g.recalc(); g.p.hp = g.stats.maxHp;
  for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
  g.give('tuning_bell', 1); g.give('pepperpot', 1);
  const A = g.layout.arenas[0], q = g.world.nearestWalkable(A.altar.x, A.altar.z + 1.6, 4)!; g.p.x = q[0]; g.p.z = q[1];
  g.interact('arena:0');
  let ate = false;
  for (let t = 0; t < 300 && !g.s.flags.guardian_defeated; t += 1 / 30) {
    if (g.boss && g.boss.state !== 'rise') g.target = g.boss.id;
    if (eat && !ate && g.boss && g.boss.state !== 'rise') { g.eat(g.p.inv.findIndex((s) => s?.id === 'pepperpot')); ate = true; }
    g.p.hp = g.stats.maxHp;
    g.step(1 / 30);
  }
}

describe('feats', () => {
  it('every feat names a real boss, and the tiers can all be reached', () => {
    for (const f of FEATS) expect(ENEMIES[f.boss]?.boss, f.id).toBe(true);
    expect(FEATS.reduce((a, f) => a + f.pts, 0)).toBeGreaterThanOrEqual(FEAT_TIERS[FEAT_TIERS.length - 1].pts);
  });

  it('beating the Guardian scores the kill; without eating, Empty stomach too; eating once loses it', () => {
    const g = fresh(11);
    fightGuardian(g, false);
    expect(g.s.flags.guardian_defeated).toBe(true);
    expect(g.s.bossKills?.guardian).toBe(1);
    expect(g.s.feats).toContain('guardian_kill');
    expect(g.s.feats).toContain('guardian_nofood');
    const g2 = fresh(12);
    fightGuardian(g2, true);
    expect(g2.s.feats).toContain('guardian_kill');
    expect(g2.s.feats).not.toContain('guardian_nofood');
  }, 120_000);

  it('points earn the tiers for good', () => {
    const g = fresh(13);
    const e0 = g.stats.eliteDmg;
    g.s.feats = FEATS.slice(0, 6).map((f) => f.id); // 1+2+3+3+3+1 = 13 points
    g.recalc();
    expect(g.featPoints()).toBe(13);
    expect(g.stats.eliteDmg).toBeCloseTo(e0 + 0.02);
  });
});
