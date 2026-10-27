// For every regular foe: a player of its level in that level's metal fights it. Time to kill, health lost, hits it
// takes, and Attack/Strength XP per hour if you killed nothing else (5 s walk between kills). npx vite-node ...
import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { xpForLevel } from '../src/game/sim/xp';
import { regionLayout } from '../src/game/world/layout';
import { REGIONS, type RegionId } from '../src/game/world/regions';
const METAL: [number, string][] = [[0, 'bronze'], [10, 'iron'], [20, 'steel'], [30, 'storm'], [50, 'abyss'], [60, 'tide']];
const metalAt = (lvl: number) => [...METAL].reverse().find(([l]) => lvl >= l)![1];
const seen = new Set<string>(); const rows: string[] = [];
for (const region of Object.keys(REGIONS) as RegionId[]) {
  const L = regionLayout(region);
  for (const sp of L.spawns) {
    if (seen.has(sp.enemy)) continue; seen.add(sp.enemy);
    let ttk = 0, lost = 0, xp = 0, won = 0, n = 0, swings = 0;
    for (const seed of [1, 2, 3]) {
      const g = new Game({ seed, save: { ...defaultSave(L.respawn, (L.mooring ?? regionLayout('bellwether').mooring)!), region } });
      const e = g.enemies.find((x) => x.def.id === sp.enemy && !x.elite && !x.summoned);
      if (!e || e.def.boss) continue;
      for (const o of g.enemies) if (o !== e) { o.alive = false; o.respawnAt = Infinity; }
      const lvl = e.def.level;
      for (const k of ['attack', 'strength', 'defence'] as const) g.p.xp[k] = xpForLevel(lvl);
      g.p.xp.hitpoints = xpForLevel(Math.max(10, lvl));
      const m = metalAt(lvl);
      g.p.equip.weapon = { id: `cutlass_${m}`, qty: 1 }; g.p.equip.head = { id: `helm_${m}`, qty: 1 }; g.p.equip.body = { id: `plate_${m}`, qty: 1 };
      g.recalc(); g.p.hp = g.stats.maxHp;
      const q = g.world.nearestWalkable(e.x + 2.5, e.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
      const xp0 = g.p.xp.attack + g.p.xp.strength + g.p.xp.defence, hp0 = g.p.hp;
      let t = 0, minHp = hp0;
      g.on((ev) => { if (ev.type === 'swing') swings++; });
      for (; t < 120; t += 1 / 30) { if (e.alive && g.target !== e.id) g.interact(`enemy:${e.id}`); g.step(1 / 30); minHp = Math.min(minHp, g.p.hp); if (!e.alive || g.dead) break; }
      n++; if (!e.alive) won++;
      ttk += t; lost += (hp0 - minHp) / g.stats.maxHp; xp += g.p.xp.attack + g.p.xp.strength + g.p.xp.defence - xp0;
    }
    if (!n) continue;
    rows.push(`${region.padEnd(15)} ${sp.enemy.padEnd(20)} lvl ${String(Math.round(0) + (regionLayout(region), 0)).slice(0, 0)}${String((globalThis as never, '')).slice(0, 0)}ttk ${(ttk / n).toFixed(1).padStart(5)}s  hp lost ${Math.round((lost / n) * 100).toString().padStart(3)}%  won ${won}/${n}  xp/h ${Math.round((xp / n) / ((ttk / n) + 5) * 3600)}`);
  }
}
console.log(rows.join('\n'));
