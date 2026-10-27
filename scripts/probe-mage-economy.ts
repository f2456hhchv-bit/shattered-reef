// An hour of a mage's grind at several levels, with real drops: shards burnt against shards picked up, coins earned,
// and what the shortfall costs at the shop (npx vite-node scripts/probe-mage-economy.ts).
import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { xpForLevel } from '../src/game/sim/xp';
import { count } from '../src/game/sim/inventory';
import { regionLayout } from '../src/game/world/layout';
import { SPELLS, SHARD } from '../src/game/data/content';
import { ITEMS } from '../src/game/data/items';
import type { RegionId } from '../src/game/world/regions';
const BANDS: [number, RegionId, string][] = [[5, 'bellwether', 'gull'], [12, 'bellwether', 'knocker'], [20, 'bellwether', 'smuggler'], [30, 'sunreach', 'jungle_snake'], [45, 'amberhold', 'giant_spider'], [60, 'wrack', 'sea_draugr'], [80, 'saltglass', 'reflection']];
const staffAt = (l: number) => (l >= 60 ? 'staff_tide' : l >= 40 ? 'staff_storm' : l >= 20 ? 'staff_coral' : 'staff_driftwood');
for (const [lvl, region, foe] of BANDS) {
  const L = regionLayout(region);
  const g = new Game({ seed: 5, save: { ...defaultSave(L.respawn, (L.mooring ?? regionLayout('bellwether').mooring)!), region } });
  g.p.xp.magic = xpForLevel(lvl); g.p.xp.defence = xpForLevel(lvl); g.p.xp.hitpoints = xpForLevel(Math.max(10, lvl));
  const spell = [...SPELLS].reverse().find((s) => s.level <= lvl && !s.quest)!;
  // a sensible mage: the staff of the element the spell burns most of (RuneScape's battlestaff), or the best magic staff
  const STAFF = process.env.ELSTAFF ? `staff_el_${[...spell.cost].sort((a, b) => b.qty - a.qty)[0].id === 'charm_tide' ? 'tide' : [...spell.cost].sort((a, b) => b.qty - a.qty)[0].id.replace('shard_', '')}` : staffAt(lvl);
  g.p.equip.weapon = { id: STAFF, qty: 1 }; g.s.combat.spell = spell.id; g.recalc(); g.p.hp = g.stats.maxHp;
  g.p.inv = g.p.inv.map(() => null);
  for (const sh of Object.values(SHARD)) g.give(sh, 20000);
  g.give('fish_shark', 25); // plenty of food: we're measuring the economy, not survival
  const sh0 = Object.fromEntries(Object.values(SHARD).map((s) => [s, count(g.p.inv, s)])), coins0 = count(g.p.inv, 'coins');
  const xp0 = g.p.xp.magic; let kills = 0, deaths = 0;
  g.on((e) => { if (e.type === 'enemyDeath') kills++; if (e.type === 'playerDeath') deaths++; });
  const home = { x: g.p.x, z: g.p.z };
  const sp = g.enemies.filter((e) => e.def.id === foe);
  const c = sp.length ? { x: sp[0].spawnX, z: sp[0].spawnZ } : home;
  const q = g.world.nearestWalkable(c.x + 4, c.z, 6)!; g.p.x = q[0]; g.p.z = q[1];
  for (let t = 0; t < 3600; t += 1 / 30) {
    if (g.p.hp < g.stats.maxHp * 0.5 && g.bestFood() !== null) g.quickEat();
    if (count(g.p.inv, 'fish_shark') < 5) g.give('fish_shark', 20);
    if (g.target === null || !g.enemies.some((e) => e.id === g.target && e.alive)) {
      const e = g.enemies.filter((x) => x.alive && x.def.id === foe).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
      if (e) g.interact(`enemy:${e.id}`);
    }
    g.step(1 / 30);
  }
  const used: string[] = []; let shortfallCoins = 0;
  for (const s of Object.values(SHARD)) { const d = count(g.p.inv, s) - sh0[s]; if (d) used.push(`${s.replace('shard_', '').replace('charm_', '')} ${d > 0 ? '+' : ''}${d}`); if (d < 0) shortfallCoins += -d * ITEMS[s].value; }
  const coins = count(g.p.inv, 'coins') - coins0;
  console.log(`L${lvl} ${spell.name.padEnd(12)} [${STAFF}] vs ${foe.padEnd(13)} | kills ${kills} deaths ${deaths} | magic xp/h ${Math.round(g.p.xp.magic - xp0)} | coins +${coins} | shards ${used.join(', ')} | shortfall at shop ≈ ${Math.round(shortfallCoins)}c → net ${coins - Math.round(shortfallCoins)}c/h`);
}
