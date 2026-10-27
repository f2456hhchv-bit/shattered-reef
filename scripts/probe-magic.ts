// Every combat spell at its own level against a foe of about that level: time to kill, health lost, casts and shards
// per kill, Magic XP an hour; melee at the same level in that level's metal for comparison (npx vite-node ...).
import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { xpForLevel } from '../src/game/sim/xp';
import { regionLayout } from '../src/game/world/layout';
import { REGIONS, type RegionId } from '../src/game/world/regions';
import { SPELLS, ENEMIES, ELEMENT_WEAK, SHARD } from '../src/game/data/content';
const METAL: [number, string][] = [[0, 'bronze'], [10, 'iron'], [20, 'steel'], [30, 'storm'], [50, 'abyss'], [60, 'tide']];
const metalAt = (l: number) => [...METAL].reverse().find(([x]) => l >= x)![1];
const staffAt = (l: number) => (l >= 60 ? 'staff_tide' : l >= 40 ? 'staff_storm' : l >= 20 ? 'staff_coral' : 'staff_driftwood');
// every placed foe and where
const placed: { id: string; region: RegionId }[] = [];
for (const r of Object.keys(REGIONS) as RegionId[]) for (const sp of regionLayout(r).spawns) if (!placed.some((p) => p.id === sp.enemy) && !ENEMIES[sp.enemy].boss) placed.push({ id: sp.enemy, region: r });
function duel(foe: string, region: RegionId, lvl: number, setup: (g: Game) => void, seed: number) {
  const L = regionLayout(region);
  const g = new Game({ seed, save: { ...defaultSave(L.respawn, (L.mooring ?? regionLayout('bellwether').mooring)!), region } });
  const e = g.enemies.find((x) => x.def.id === foe && !x.elite && !x.summoned)!;
  for (const o of g.enemies) if (o !== e) { o.alive = false; o.respawnAt = Infinity; }
  for (const k of ['attack', 'strength', 'defence', 'magic'] as const) g.p.xp[k] = xpForLevel(lvl);
  g.p.xp.hitpoints = xpForLevel(Math.max(10, lvl));
  g.p.equip.head = { id: `helm_${metalAt(lvl)}`, qty: 1 }; setup(g); g.recalc(); g.p.hp = g.stats.maxHp;
  for (const sh of Object.values(SHARD)) g.give(sh, 5000);
  const before = Object.values(SHARD).reduce((a, sh) => a + g.p.inv.reduce((s, x) => s + (x?.id === sh ? x.qty : 0), 0), 0);
  const q = g.world.nearestWalkable(e.x + 5, e.z, 4)!; g.p.x = q[0]; g.p.z = q[1];
  const xp0 = g.p.xp.magic + g.p.xp.attack + g.p.xp.strength + g.p.xp.defence, hp0 = g.p.hp; let t = 0, casts = 0, minHp = hp0;
  g.on((ev) => { if (ev.type === 'shoot' || ev.type === 'swing') casts++; });
  for (; t < 120; t += 1 / 30) { if (e.alive && g.target !== e.id) g.interact(`enemy:${e.id}`); g.step(1 / 30); minHp = Math.min(minHp, g.p.hp); if (!e.alive || g.dead) break; }
  const after = Object.values(SHARD).reduce((a, sh) => a + g.p.inv.reduce((s, x) => s + (x?.id === sh ? x.qty : 0), 0), 0);
  return { won: !e.alive, t, lost: (hp0 - minHp) / g.stats.maxHp, xp: g.p.xp.magic + g.p.xp.attack + g.p.xp.strength + g.p.xp.defence - xp0, shards: before - after, casts };
}
const rows: string[] = [];
for (const sp of SPELLS.filter((s) => s.id !== 'spray' && !s.quest)) {
  const L = sp.level;
  const foe = [...placed].sort((a, b) => Math.abs(ENEMIES[a.id].level - Math.max(L, 2)) - Math.abs(ENEMIES[b.id].level - Math.max(L, 2)))[0];
  const avg = (f: (s: number) => ReturnType<typeof duel>) => { const r = [1, 2, 3].map(f); return { won: r.filter((x) => x.won).length, t: r.reduce((a, x) => a + x.t, 0) / 3, lost: r.reduce((a, x) => a + x.lost, 0) / 3, xp: r.reduce((a, x) => a + x.xp, 0) / 3, shards: r.reduce((a, x) => a + x.shards, 0) / 3, casts: r.reduce((a, x) => a + x.casts, 0) / 3 }; };
  const m = avg((s) => duel(foe.id, foe.region, L, (g) => { g.p.equip.weapon = { id: staffAt(L), qty: 1 }; g.s.combat.spell = sp.id; }, s));
  const me = avg((s) => duel(foe.id, foe.region, L, (g) => { g.p.equip.weapon = { id: `cutlass_${metalAt(L)}`, qty: 1 }; }, s));
  const weak = ELEMENT_WEAK[foe.id] === sp.element ? ' WEAK' : '';
  rows.push(`${sp.name.padEnd(13)} L${String(L).padStart(2)} vs ${ENEMIES[foe.id].name.slice(0, 16).padEnd(16)} L${String(ENEMIES[foe.id].level).padStart(2)}${weak.padEnd(5)} | magic ${m.won}/3 ${m.t.toFixed(0).padStart(3)}s hp-${Math.round(m.lost * 100)}% ${m.shards.toFixed(0).padStart(3)} shards ${Math.round(m.xp / (m.t + 5) * 3600)} xp/h | melee ${me.won}/3 ${me.t.toFixed(0).padStart(3)}s hp-${Math.round(me.lost * 100)}% ${Math.round(me.xp / (me.t + 5) * 3600)} xp/h`);
}
console.log(rows.join('\n'));
