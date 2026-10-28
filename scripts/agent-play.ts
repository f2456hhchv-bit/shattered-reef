// Shattered Reef in plain text, for an AI (or anyone) to play the real game without graphics.
//
//   npx vite-node scripts/agent-play.ts                       interactive: type commands, one per line
//   echo "look\ndo 1\nwait 30" | npx vite-node scripts/agent-play.ts
//   npx vite-node scripts/agent-play.ts -- --save run.json    keep the game between runs (one command per run is fine)
//   npx vite-node scripts/agent-play.ts -- --seed 7           a different world roll
//
// It drives the same Game class the browser runs (src/game/sim/game.ts): every command is a tap the game paths itself,
// nothing is teleported or cheated. Type `help` for the commands. See docs/AI_TESTING.md for a test brief.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Game, STATION_NAMES, type Target } from '../src/game/sim/game';
import { defaultSave, parseSave } from '../src/game/sim/save';
import { QUESTS, NPCS } from '../src/game/data/quests';
import { RECIPES, SKILLS, SHOPS, SPELLS } from '../src/game/data/content';
import { item } from '../src/game/data/items';
import { displayName, count } from '../src/game/sim/inventory';
import { levelForXp, xpForLevel } from '../src/game/sim/xp';
import { PLACES, placeRegion } from '../src/game/world/places';
import { REGIONS } from '../src/game/world/regions';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const SAVE = arg('--save'), SEED = Number(arg('--seed') ?? 11);
const DT = 1 / 30;

const base = new Game({ seed: 1 });
const fresh = defaultSave(base.layout.respawn, base.layout.mooring!);
const loaded = SAVE && existsSync(SAVE) ? parseSave(readFileSync(SAVE, 'utf8'), fresh) : null;
const g = new Game({ seed: SEED, save: loaded ?? fresh });

// ---- what happened since the last command
const out: string[] = [];
const gained = new Map<string, number>();
const fight = { dealt: 0, hits: 0, misses: 0, taken: 0, kills: [] as string[] };
let shopOpen = false, bankOpen = false, station: string | null = null, died = false;
let ferry: { npc: string; to: string; price: number } | null = null;
g.on((e) => {
  switch (e.type) {
    case 'msg': out.push(`  [${e.kind}] ${e.text}`); break;
    case 'dialog': out.push(`  ${NPCS[e.npc]?.name ?? e.npc} says:`, ...e.lines.map((l) => `    "${l}"`)); break;
    case 'read': out.push(`  You read: ${e.title} (${e.sub})`, ...e.lines.map((l) => `    ${l}`)); break;
    case 'banner': out.push(`  *** ${e.title}: ${e.sub} ***`); break;
    case 'gain': gained.set(e.name, (gained.get(e.name) ?? 0) + e.qty); break;
    case 'level': break; // the msg says it
    case 'openShop': shopOpen = true; out.push(`  (shop open: ${SHOPS[e.shop]?.name ?? e.shop}. Type "shop".)`); break;
    case 'openBank': bankOpen = true; out.push('  (bank open. Type "bank".)'); break;
    case 'openStation': station = e.station; out.push(`  (${STATION_NAMES[e.station]} open. Type "recipes".)`); break;
    case 'openBoard': out.push('  (bounty board: not playable in text mode yet)'); break;
    case 'ferryOffer': ferry = { npc: e.npc, to: e.to, price: e.price }; out.push(`  (${NPCS[e.npc].name} offers passage to ${REGIONS[e.to as never]?.name ?? e.to} for ${e.price} coins. Type "ferry".)`); break;
    case 'hit': if (e.target === 'enemy') { fight.dealt += e.amount; if (e.amount > 0) fight.hits++; else fight.misses++; } else fight.taken += e.amount; break;
    case 'enemyDeath': { const en = g.enemies.find((x) => x.id === e.id); fight.kills.push(en ? g.enemyName(en) : 'a foe'); break; }
    case 'playerDeath': died = true; out.push('  !!! You died.'); break;
    case 'region': out.push(`  (now in ${REGIONS[e.region].name})`); break;
    case 'packFull': out.push('  (pack full: "bank" at a bank, or "drop <slot>")'); break;
  }
});

const clock = () => { const t = Math.floor(g.s.playTime); return `${Math.floor(t / 60)}m${String(t % 60).padStart(2, '0')}s`; };
const dist = (x: number, z: number) => Math.hypot(x - g.p.x, z - g.p.z);
let listed: Target[] = [];

/** Run the game until the player is idle (or `max` seconds pass); stops early on death. */
function settle(max: number, keepGoing?: () => boolean) {
  const end = g.time + max;
  while (g.time < end) {
    g.step(DT);
    if (died) break;
    const busy = g.path.length > 0 || !!g.pending || !!g.action || g.target !== null || g.p.onShip && !!g.shipTarget;
    if (!busy && !(keepGoing?.() ?? false)) break;
  }
}

function status() {
  const tq = g.trackedQuest(), goal = tq ? g.questGoal(tq) : null;
  return [`${clock()} · ${g.region.name}${g.p.onShip ? ' (aboard your sloop)' : ''} · at ${g.p.x.toFixed(0)}, ${g.p.z.toFixed(0)} · health ${Math.ceil(g.p.hp)}/${g.stats.maxHp} · combat level ${g.stats.combatLevel} · coins ${count(g.p.inv, 'coins')}`,
    tq ? `Quest: ${QUESTS[tq].name}: ${goal?.text ?? ''}${goal?.x !== undefined ? ` (at ${goal.x.toFixed(0)}, ${goal.z!.toFixed(0)}, ${dist(goal.x, goal.z!).toFixed(0)} m away)` : ''}` : 'Quest: none tracked'];
}

function look() {
  const ts = g.targets().map((t) => ({ t, d: dist(t.x, t.z) })).filter((x) => x.d < 45).sort((a, b) => a.d - b.d);
  // the nearest of each kind of thing, then the rest, so 20 trees don't hide the one person
  const seen = new Set<string>(), first: typeof ts = [], rest: typeof ts = [];
  for (const x of ts) { const k = `${x.t.kind}:${x.t.label}`; (seen.has(k) ? rest : first).push(x); seen.add(k); }
  const pick = [...first.slice(0, 18), ...rest.slice(0, Math.max(0, 22 - first.length))];
  listed = pick.map((x) => x.t);
  const lines = [...status(), 'Nearby (type "do N"):'];
  pick.forEach(({ t, d }, i) => {
    const need = g.targetNeeds(t);
    const e = t.kind === 'enemy' ? g.enemies.find((x) => `enemy:${x.id}` === t.key) : null;
    lines.push(`  ${String(i + 1).padStart(2)}. ${t.verb} ${t.label}${e ? ` (level ${e.def.level}, ${Math.ceil(e.hp)}/${e.maxHp} hp${e.state === 'chase' || e.state === 'attack' ? ', hostile now' : ''})` : ''} · ${d.toFixed(0)} m${need ? ` · ${need.text}` : ''}`);
  });
  if (!pick.length) lines.push('  nothing within 45 m: try "places" and "goto"');
  return lines;
}

function inv() {
  const lines = ['Pack (slot: item):'];
  g.p.inv.forEach((st, i) => { if (st) lines.push(`  ${i}: ${st.qty > 1 ? `${st.qty} × ` : ''}${displayName(st)}${item(st.id).heal ? ` (heals ${g.healOf(st.id)})` : item(st.id).equip ? ' (wearable)' : ''}`); });
  lines.push(`  ${g.p.inv.filter((x) => !x).length} free slots`);
  return lines;
}

const HELP = `Commands:
  look                 where you are, your quest, and numbered things nearby
  do N                 walk to thing N from "look" and use it (talk, chop, mine, fish, attack, open...)
  wait S               let S seconds pass (max 600), e.g. while gathering
  goto X Z             walk to a map position;  places: list known places;  goto PLACE-NAME
  pack | gear | skills | quests
  use N / eat N / equip N / drop N     act on pack slot N;  unequip SLOT (weapon, head, body...)
  shop / buy ITEM-ID / sell N [all]    after talking to a shopkeeper
  bank / deposit N|all / withdraw N QTY   at a bank or strongbox
  recipes / make RECIPE-ID [times]     at a furnace, anvil, fire, bench or shrine
  ferry                accept the passage just offered;  board / land   your ship
  special / roll / stance accurate|aggressive|defensive / spell ID / spells
  save [FILE] / quit`;

function command(line: string): string[] {
  const [cmd, ...a] = line.trim().split(/\s+/);
  const n = (i = 0) => Number(a[i]);
  switch ((cmd ?? '').toLowerCase()) {
    case '': return [];
    case 'help': case '?': return [HELP];
    case 'look': case 'l': return look();
    case 'status': return status();
    case 'do': {
      const t = listed[n() - 1];
      if (!t) return ['No such thing: "look" first, then "do N".'];
      shopOpen = bankOpen = false; station = null;
      if (!g.interact(t.key)) return ['You can\'t use that from here.'];
      const enemy = t.kind === 'enemy';
      // a fight runs to its end; gathering runs until the node or your pack is done (or a minute passes)
      settle(enemy ? 90 : t.kind === 'node' ? 60 : 40);
      if (enemy && !died) settle(2.5, () => true); // the loot flies to you
      return [`(${clock()})`];
    }
    case 'wait': { settle(Math.min(600, Math.max(1, n() || 10)), () => true); return [`(${clock()})`]; }
    case 'goto': {
      let x = n(0), z = n(1);
      if (Number.isNaN(x)) {
        const name = a.join(' ').toLowerCase();
        const pl = PLACES.find((p) => p.name.toLowerCase().includes(name) && placeRegion(p) === g.s.region);
        if (!pl) return [`No place called "${a.join(' ')}" on this island. Try "places".`];
        x = pl.x; z = pl.z;
      }
      const q = g.world.nearestWalkable(x, z, 8) ?? [x, z];
      g.moveTo(q[0], q[1]);
      settle(240);
      return [`(${clock()}) now at ${g.p.x.toFixed(0)}, ${g.p.z.toFixed(0)}`];
    }
    case 'places': return ['Places on this island (* = discovered):', ...PLACES.filter((p) => placeRegion(p) === g.s.region).map((p) => `  ${g.s.discovered.includes(p.id) ? '*' : ' '} ${p.name} · ${p.x.toFixed(0)}, ${p.z.toFixed(0)} · ${dist(p.x, p.z).toFixed(0)} m`)];
    case 'pack': case 'inv': case 'i': return inv();
    case 'gear': return ['Worn:', ...Object.entries(g.p.equip).filter(([, s]) => s).map(([k, s]) => `  ${k}: ${displayName(s!)}`), `Max hit ${g.stats.maxHit}, style ${g.stats.style}, stance ${g.s.combat.stance}`];
    case 'skills': return ['Skills:', ...SKILLS.map((s) => { const xp = g.p.xp[s.id], l = levelForXp(xp); return `  ${s.name.padEnd(12)} ${String(l).padStart(2)}  (${Math.floor(xp)} xp, ${l < 99 ? Math.ceil(xpForLevel(l + 1) - xp) : 0} to next)`; })];
    case 'quests': return ['Quests:', ...Object.values(QUESTS).filter((q) => g.questStage(q.id) > 0 || q.id === g.trackedQuest()).map((q) => { const st = g.questStage(q.id), done = st >= q.stages.length - 1; return `  ${q.name}: ${done ? 'complete' : `stage ${st}/${q.stages.length - 1}: ${g.questGoal(q.id)?.text ?? ''}`}`; }), '(talk to people to find more)'];
    case 'use': g.useSlot(n()); settle(3); return [];
    case 'eat': g.eat(n()); return [];
    case 'equip': g.equip(n()); return [];
    case 'unequip': g.unequip(a[0] as never); return [];
    case 'drop': g.dropSlot(n()); return [];
    case 'shop': {
      if (!shopOpen || !g.nearShop()) return ['No shop open: talk to a shopkeeper first.'];
      return [`${g.shop.name} sells (buy ITEM-ID):`, ...g.shop.stock.map((s) => `  ${s.id}: ${s.qty > 1 ? `${s.qty} × ` : ''}${item(s.id).name} · ${g.buyPrice(s.id)} coins`), 'It buys your things too: "sell N" (pack slot).'];
    }
    case 'buy': if (!shopOpen) return ['No shop open.']; g.buy(a[0]); return [];
    case 'sell': if (!shopOpen) return ['No shop open.']; g.sell(n(), a[1] === 'all'); return [];
    case 'bank': return g.nearBank() ? ['Bank (withdraw N QTY):', ...g.s.bank.map((s, i) => `  ${i}: ${s.qty} × ${displayName(s)}`)] : ['No bank here.'];
    case 'deposit': g.deposit(a[0] === 'all' ? 'all' : n()); return [];
    case 'withdraw': g.withdraw(n(0), n(1) || 1); return [];
    case 'recipes': {
      const near = Object.keys(STATION_NAMES).filter((s) => g.nearStation(s as never));
      if (!near.length) return ['No workstation in reach: "do" one first.'];
      return near.flatMap((s) => [`${STATION_NAMES[s as never]} (make RECIPE-ID [times]):`, ...RECIPES.filter((r) => r.station === s).map((r) => { const b = g.recipeBlock(r); return `  ${r.id}: ${item(r.output.id).name} · ${r.skill} ${r.level} · needs ${r.inputs.map((i) => `${i.qty} ${item(i.id).name}`).join(', ')}${b ? ` · [${b}]` : ' · OK'}`; })]);
    }
    case 'make': g.craft(a[0], n(1) || 1); settle(120); return [`(${clock()})`];
    case 'ferry': if (!ferry) return ['Nobody has offered you passage.']; g.takeFerry(ferry.npc, ferry.to); ferry = null; settle(2); return [];
    case 'board': { const t = g.targets().find((x) => x.key === 'ship'); if (!t) return ['Your ship isn\'t here.']; g.interact('ship'); settle(60); return []; }
    case 'land': g.interact('disembark'); settle(60); return [];
    case 'special': g.useSpecial(); settle(2); return [];
    case 'roll': g.useRoll(); settle(1); return [];
    case 'stance': g.setStance(a[0] as never); return [`Stance: ${g.s.combat.stance}`];
    case 'spells': return ['Spells (spell ID):', ...SPELLS.map((s) => `  ${s.id}: ${s.name} · Magic ${s.level} · ${s.cost.map((c) => `${c.qty} ${item(c.id).name}`).join(', ') || 'free'}`)];
    case 'spell': g.setSpell(a[0]); return [`Spell: ${g.s.combat.spell}`];
    case 'save': { const f = a[0] ?? SAVE ?? 'agent-save.json'; writeFileSync(f, JSON.stringify(g.serialize())); return [`Saved to ${f}.`]; }
    case 'quit': case 'exit': return ['__quit'];
    default: return [`Unknown command "${cmd}". Type "help".`];
  }
}

function run(line: string) {
  out.length = 0; gained.clear(); died = false; Object.assign(fight, { dealt: 0, hits: 0, misses: 0, taken: 0, kills: [] });
  const res = command(line);
  if (res[0] === '__quit') return false;
  if (died) settle(15); // wake up at the respawn point
  const fought = fight.hits + fight.misses + fight.taken > 0 ? [`  Combat: you hit ${fight.hits} times (${fight.misses} misses) for ${fight.dealt} damage, took ${fight.taken} damage${fight.kills.length ? `; killed ${fight.kills.join(', ')}` : ''}. Health ${Math.ceil(g.p.hp)}/${g.stats.maxHp}.`] : [];
  const lines = [...out, ...fought, ...(gained.size ? [`  Gained: ${[...gained].map(([k, v]) => `${v} × ${k}`).join(', ')}`] : []), ...res];
  console.log(`\n> ${line}\n${lines.join('\n') || '(nothing happens)'}`);
  return true;
}

console.log('SHATTERED REEF · text mode. Type "help" for commands.\n');
console.log([...status(), 'Type "look" to see what is around you.'].join('\n'));
const rl = createInterface({ input: process.stdin, terminal: false });
let alive = true;
rl.on('line', (line) => { if (alive && !run(line)) { alive = false; rl.close(); } });
rl.on('close', () => { if (SAVE) writeFileSync(SAVE, JSON.stringify(g.serialize())); process.exit(0); });
