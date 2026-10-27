// XP per hour for every gathering spot, and hours from 1 to 99 per skill training at the best spot each level
// allows (npx vite-node scripts/probe-skills.ts). Swing time only: no walking, no banking, no depletion waits.
import { Game } from '../src/game/sim/game';
import { NODES, RECIPES } from '../src/game/data/content';
import { xpForLevel } from '../src/game/sim/xp';
const g = new Game({ seed: 1 });
const SWING = 2.4;
const rate = (id: string, lvl: number) => {
  const d = NODES[id]; g.p.xp[d.skill!] = xpForLevel(lvl); g.recalc();
  return (3600 / SWING) * g.gatherChance(d, Math.min(10, d.tier + 1)) * d.xp;
};
const bySkill: Record<string, string[]> = {};
for (const [id, d] of Object.entries(NODES)) if (d.skill && !d.loot) (bySkill[d.skill] ??= []).push(id);
for (const [sk, ids] of Object.entries(bySkill)) {
  ids.sort((a, b) => NODES[a].level - NODES[b].level);
  console.log(`\n== ${sk}`);
  for (const id of ids) { const d = NODES[id]; console.log(`${id.padEnd(22)} lvl ${String(d.level).padStart(2)} xp ${String(d.xp).padStart(5)} rate ${d.rate.toFixed(2)}  xp/h at req ${Math.round(rate(id, d.level)).toString().padStart(6)}  +20 ${Math.round(rate(id, Math.min(99, d.level + 20))).toString().padStart(6)}${d.fromShip ? ' (ship)' : ''}`); }
  // hours 1 -> 99 at the best spot each level
  let hrs = 0; const marks: string[] = [];
  for (let L = 1; L < 99; L++) {
    const best = Math.max(...ids.filter((i) => NODES[i].level <= L).map((i) => rate(i, L)));
    hrs += (xpForLevel(L + 1) - xpForLevel(L)) / best;
    if ([10, 20, 30, 50, 70, 90, 98].includes(L)) marks.push(`to ${L + 1}: ${hrs.toFixed(1)}h`);
  }
  console.log(`  ${marks.join(' | ')}`);
}
// production skills: xp/h making the best thing each level allows (1.8 s a craft), inputs assumed in hand
const crafts: Record<string, typeof RECIPES> = {};
for (const r of RECIPES) (crafts[r.skill] ??= []).push(r);
console.log('\n== production (xp/h at the best recipe for the level; 1.8 s a craft)');
for (const [sk, rs] of Object.entries(crafts)) {
  let hrs = 0; const marks: string[] = [];
  for (let L = 1; L < 99; L++) {
    const best = Math.max(...rs.filter((r) => r.level <= L).map((r) => (3600 / 1.8) * r.xp), 1);
    hrs += (xpForLevel(L + 1) - xpForLevel(L)) / best;
    if ([10, 30, 50, 70, 98].includes(L)) marks.push(`to ${L + 1}: ${hrs.toFixed(1)}h`);
  }
  console.log(`${sk.padEnd(12)} recipes ${String(rs.length).padStart(3)} | ${marks.join(' | ')}`);
}
