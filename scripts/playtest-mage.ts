// A brand-new character who wants to be a mage (npx vite-node scripts/playtest-mage.ts [minutes] [seed]). It plays
// as a person would: walks to Marta's for shards and a staff when it can afford them, casts the best spell it has
// shards for, fights foes about its level, curses or binds anything tougher, eats, banks nothing (pack only), and
// reports how the mage's life actually goes: levels, coins, shard shortages, deaths, what it bought.
import { Game, type Enemy } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { count } from '../src/game/sim/inventory';
import { SPELLS, SHOPS } from '../src/game/data/content';
import { BOOK_BY } from '../src/game/data/spellbook';

const MIN = Number(process.argv[2] ?? 60), SEED = Number(process.argv[3] ?? 3);
const base = new Game({ seed: 1 });
const g = new Game({ seed: SEED, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
const log: string[] = [];
let fighting: Enemy | null = null;
let shopping = false;
const T = () => `${String(Math.floor(g.time / 60)).padStart(3)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`;
const note = (s: string) => log.push(`${T()} ${s}`);
const st = { deaths: 0, kills: 0, sprays: 0, bought: new Map<string, number>(), spent: 0, curses: 0, binds: 0, levels: [] as string[], ate: 0 };
g.on((e) => {
  if (e.type === 'enemyDeath') st.kills++;
  if (e.type === 'playerDeath') { st.deaths++; note('DIED'); fighting = null; }
  if (e.type === 'level' && e.skill === 'magic') st.levels.push(`${T()} ${e.level}`);
  if (e.type === 'msg' && /Casting Brine Spray/.test(e.text)) st.sprays++;
});
const marta = g.layout.npcs.find((n) => n.id === SHOPS.general.keeper)!;
const shop = SHOPS.general;
const priceOf = (id: string) => { g.openShopOf(marta.id); return g.buyPrice(id); };
const near = (x: number, z: number, r = 3) => Math.hypot(x - g.p.x, z - g.p.z) < r;

/** the spell a sensible mage would cast: the strongest it knows and has shards for */
function pickSpell() {
  const lvl = g.level('magic');
  const ok = SPELLS.filter((sp) => sp.level <= lvl && !sp.quest && sp.id !== 'spray' && !g.shardBlock(sp.cost, 1));
  const best = ok.sort((a, b) => b.maxHit - a.maxHit)[0];
  const id = best?.id ?? 'spray';
  if (g.s.combat.spell !== id) { g.setSpell(id); note(`SPELL ${id}`); }
}
/** shopping list: topping up the best spell in reach at Marta's to 80 casts once under 40, and a staff */
function shoppingNeed(): string | null {
  if (!g.p.equip.weapon || g.p.equip.weapon.id === 'cutlass_rusty') return count(g.p.inv, 'coins') >= priceOf('staff_driftwood') ? 'staff_driftwood' : null;
  const lvl = g.level('magic');
  const sold = new Set(shop.stock.map((x) => x.id));
  const target = [...SPELLS].reverse().find((sp) => sp.level <= lvl && !sp.quest && sp.id !== 'spray' && g.shardNeed(sp.cost).every((c) => sold.has(c.id)));
  if (!target) return null;
  const low = g.shardNeed(target.cost, 40).some((c) => count(g.p.inv, c.id) < c.qty);
  if (low || shopping) { shopping = true; for (const c of g.shardNeed(target.cost, 80)) if (count(g.p.inv, c.id) < c.qty) return c.id; shopping = false; }
  return null;
}
function think() {
  if (g.dead) return;
  if (g.p.hp < g.stats.maxHp * 0.45 && g.bestFood() !== null) { g.quickEat(); st.ate++; }
  if (fighting && !fighting.alive) fighting = null;
  pickSpell();
  if (fighting) {
    // a tough foe: curse it, bind it if it's closing in
    const lvl = g.level('magic');
    if (fighting.def.level > g.stats.combatLevel + 3) {
      if (lvl >= BOOK_BY.weaken.level && !fighting.fx.weaken && !g.bookBlock('weaken')) { g.castBook('weaken'); st.curses++; }
      else if (lvl >= BOOK_BY.bind.level && fighting.fx.root <= 0 && Math.hypot(fighting.x - g.p.x, fighting.z - g.p.z) < 4 && !g.bookBlock('bind')) { g.castBook('bind'); st.binds++; }
    }
    return;
  }
  if (g.path.length || g.pending) return;
  // shopping at Marta's
  const need = shoppingNeed();
  if (need) {
    const price = priceOf(need);
    if (count(g.p.inv, 'coins') >= price) {
      if (!near(marta.x, marta.z)) { g.interact(`npc:${marta.id}`); return; }
      g.openShopOf(marta.id); g.buy(need); st.spent += price; st.bought.set(need, (st.bought.get(need) ?? 0) + 1);
      if (need.startsWith('staff')) { const i = g.p.inv.findIndex((x) => x?.id === need); g.equip(i); note(`BOUGHT AND WIELD ${need}`); }
      return;
    }
  }
  // fight: the nearest foe about my level (a little above once I have curses)
  // broke and down to Brine Spray: back to the crabs for coins, as a person would
  const cap = g.s.combat.spell === 'spray' ? 2 : g.stats.combatLevel + (g.level('magic') >= 11 ? 3 : 1);
  const foe = g.enemies.filter((e) => e.alive && !e.def.boss && e.def.level <= Math.max(2, cap)).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
  if (foe) { fighting = foe; g.interact(`enemy:${foe.id}`); }
}
// a person's first move: the staff from Marta (the starting pack has some shards)
const end = MIN * 60; let next = 0, lastCoins = 0, lastLog = 0;
while (g.time < end) {
  g.step(1 / 30);
  if (g.time >= next) { next = g.time + 0.5; think(); }
  if (g.time - lastLog > 600) { lastLog = g.time; note(`STATUS magic ${g.level('magic')} combat ${g.stats.combatLevel} coins ${count(g.p.inv, 'coins')} (${count(g.p.inv, 'coins') - lastCoins >= 0 ? '+' : ''}${count(g.p.inv, 'coins') - lastCoins}) spell ${g.s.combat.spell} free slots ${g.p.inv.filter((x) => !x).length}`); lastCoins = count(g.p.inv, 'coins'); }
}
console.log(`=== MAGE ${MIN} min seed ${SEED}: magic ${g.level('magic')}, combat ${g.stats.combatLevel}, kills ${st.kills}, deaths ${st.deaths}, ate ${st.ate}, Brine Spray fallbacks ${st.sprays}, curses ${st.curses}, binds ${st.binds}, coins ${count(g.p.inv, 'coins')}, spent ${st.spent}`);
console.log('bought', JSON.stringify(Object.fromEntries(st.bought)));
console.log('levels', st.levels.join(' | '));
console.log(log.slice(-40).join('\n'));
