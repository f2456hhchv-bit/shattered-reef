// A scripted new player (npx vite-node scripts/playtest.ts [minutes] [seed]). It plays the way a person would: follows
// the quest tracker, fights back, eats when hurt, runs when losing, trains when a quest is beyond it, gathers and
// cooks, banks when full, equips upgrades. It logs where it gets stuck, dies, waits or grinds, which is what a
// playtest is for. Never teleports: every move is a tap (moveTo / interact) the game paths itself.
import { Game, type Enemy } from '../src/game/sim/game';
import { QUESTS } from '../src/game/data/quests';
import { NODES, RECIPES, SHOPS } from '../src/game/data/content';
import { ITEMS } from '../src/game/data/items';
import { count } from '../src/game/sim/inventory';
import { mulberry32 } from '../src/art/noise';

export function createPlaytester(g: Game, seed = 11, trace = false) {
  const random = mulberry32((seed ^ 0x706c6179) >>> 0);
  { const oi = g.interact.bind(g); let last = ''; (g as { interact: typeof g.interact }).interact = (k: string, q?: boolean) => { const kind = k.replace(/\d+/g, '#'); if (kind !== last && trace) { log.push(`${String(Math.floor(g.time / 60)).padStart(3)}:${String(Math.floor(g.time % 60)).padStart(2, '0')} DO ${k} (${g.trackedQuest()})`); last = kind; } return oi(k, q); }; }
  const DT = 1 / 30;
  const log: string[] = [];
  const T = () => `${String(Math.floor(g.time / 60)).padStart(3)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`;
  const note = (s: string) => log.push(`${T()} ${s}`);
  const stats = { deaths: 0, fled: 0, wrongMarks: 0, blocked: new Map<string, number>(), msgs: new Map<string, number>(), levels: [] as string[], quests: [] as string[], idle: 0, ate: 0, eatAttempts: 0, kills: 0, lostFights: 0 };
  g.on((e) => {
    if (e.type === 'msg') {
      stats.msgs.set(e.text.replace(/\d+/g, '#'), (stats.msgs.get(e.text.replace(/\d+/g, '#')) ?? 0) + 1);
      if (e.kind === 'quest' || /wasn't the right|order/.test(e.text)) note(`MSG ${e.text}`);
      if (/right order|Start again/i.test(e.text)) stats.wrongMarks++;
    }
    if (e.type === 'level') { stats.levels.push(`${T()} ${e.skill} ${e.level}`); }
    if (e.type === 'quest') stats.quests.push(`${T()} ${e.id} -> ${e.stage}`);
    if (e.type === 'playerDeath') {
      stats.deaths++; note('DIED');
      if (fighting) { stats.lostFights++; fightLosses.set(fighting.def.id, (fightLosses.get(fighting.def.id) ?? 0) + 1); }
      fighting = null; fleeing = false;
    }
    if (e.type === 'enemyDeath') stats.kills++;
  });

  const blockedUntil = new Map<string, number>();
  const fightLosses = new Map<string, number>();
  let fighting: Enemy | null = null;
  let fleeing = false;

  function combatLevel() { return g.stats.combatLevel; }
  function hpFrac() { return g.p.hp / g.stats.maxHp; }

  function equipUpgrades() {
    // a person swaps in anything better they can wear (simple: higher item value in the same slot)
    g.p.inv.forEach((st, i) => {
      if (!st) return; const d = ITEMS[st.id]; const e = d?.equip; if (!e || g.equipBlock(st)) return;
      const cur = g.p.equip[e.slot as keyof typeof g.p.equip];
      if (!cur || (ITEMS[cur.id].value ?? 0) < (d.value ?? 0)) { g.equip(i); note(`EQUIP ${d.name}`); }
    });
  }

  function nearestFoe(maxLvl: number, maxDist = 80) {
    let best: Enemy | null = null, bd = maxDist;
    for (const e of g.enemies) {
      if (!e.alive || e.def.level > maxLvl || e.def.boss) continue;
      const d = Math.hypot(e.x - g.p.x, e.z - g.p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function attack(e: Enemy, why: string) {
    if (fighting === e) return;
    // Train the weakest melee skill rather than leaving the default Attack stance on forever.
    if (g.stats.style === 'melee') {
      const skills = ['attack', 'strength', 'defence'] as const;
      const weakest = skills.reduce((a, b) => g.p.xp[b] < g.p.xp[a] ? b : a);
      g.setStance(({ attack: 'accurate', strength: 'aggressive', defence: 'defensive' } as const)[weakest]);
    }
    gatherSince = 0;
    fighting = e;
    g.interact(`enemy:${e.id}`);
    note(`FIGHT ${e.def.name} (lvl ${e.def.level}, me ${combatLevel()}) ${why}`);
  }

  function eatFood() {
    const slot = g.bestFood();
    if (slot === null) return;
    const before = g.p.inv[slot]!.qty;
    stats.eatAttempts++;
    g.quickEat();
    stats.ate += before - (g.p.inv[slot]?.qty ?? 0);
  }

  function bankIfFull() {
    if (g.p.inv.filter((x) => !x).length > 2) return false;
    if (g.nearBank()) {
      const keep = needs();
      g.p.inv.forEach((st, i) => { if (st && !/hatchet|pickaxe|rod|coins/.test(st.id) && !ITEMS[st.id].heal && !ITEMS[st.id].quest && !keep.has(st.id)) g.deposit(i); });
      note(`BANKED, ${g.p.inv.filter((x) => !x).length} free`);
      return true;
    }
    if (!g.path.length) { g.goToBank(); note('WALK to bank (pack full)'); }
    return true;
  }

  function cookIfCan() {
    let raw: { id: string } | null = null, r: (typeof RECIPES)[number] | undefined;
    for (const st of g.p.inv) {
      if (!st || !/_raw$/.test(st.id)) continue;
      r = RECIPES.find((x) => x.station === 'fire' && x.inputs.some((i) => i.id === st.id) && g.level('cooking') >= x.level && x.inputs.every((i) => count(g.p.inv, i.id) >= i.qty));
      if (r) { raw = st; break; }
    }
    if (!raw || !r) return false;
    const fire = g.layout.stations.find((s) => s.id === 'fire');
    if (!fire) return false;
    if (!g.nearStation('fire')) { if (!g.path.length) g.interact(`station:${g.layout.stations.indexOf(fire)}`, true); return true; }
    g.craft(r.id, count(g.p.inv, raw.id));
    note(`COOK ${count(g.p.inv, raw.id)} ${raw.id}`);
    return true;
  }

  function gatherSomething(pref?: string) {
    // the gather a new player would do: the best node their level allows that's close
    let best: { uid: string; d: number } | null = null;
    for (const n of g.nodes) {
      const d = NODES[n.def];
      if (n.depletedUntil > g.time || n.scenery || d.fromShip || !d.skill || (d.skill && g.level(d.skill) < d.level) || d.loot) continue;
      if (d.skill !== 'fishing' && (d.skill === 'woodcutting' || d.skill === 'mining') && !g.bestTool(d.skill)) continue;
      if (pref && d.skill !== pref) continue;
      const dist = Math.hypot(n.x - g.p.x, n.z - g.p.z);
      if (dist < 60 && (!best || dist < best.d)) best = { uid: n.uid, d: dist };
    }
    if (best) { g.interact(`node:${best.uid}`); return true; }
    return false;
  }

  /** Get an item the way a player would work it out: buy it if a shop here has it, gather it, or make it from parts. */
  function obtain(id: string, qty: number, depth = 0): boolean {
    if (count(g.p.inv, id) >= qty || depth > 4) return false;
    // a shop on this island
    const shop = Object.values(SHOPS).find((sh) => sh.stock.some((x) => x.id === id) && g.layout.npcs.some((n) => n.id === sh.keeper));
    if (shop && count(g.p.inv, 'coins') >= g.buyPrice(id)) {
      const k = g.layout.npcs.find((n) => n.id === shop.keeper)!;
      if (Math.hypot(k.x - g.p.x, k.z - g.p.z) > 3) { g.interact(`npc:${shop.keeper}`); return true; }
      g.openShopOf(shop.keeper); g.buy(id); note(`BUY ${id}`); return true;
    }
    // a node that gives it
    const node = g.nodes.filter((n) => { const d = NODES[n.def]; return !n.scenery && !d.fromShip && n.depletedUntil <= g.time && (d.item === id || d.drops?.some((x) => x.item === id) || d.catches?.some((c) => c.item === id)) && (!d.skill || g.level(d.skill) >= d.level); })
      .sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
    if (node) { g.interact(`node:${node.uid}`); if (lastWant !== id) { note(`GATHER ${id} for the quest`); lastWant = id; } return true; }
    const anyNode = g.nodes.find((n) => { const d = NODES[n.def]; return d.item === id || d.drops?.some((x) => x.item === id); });
    if (anyNode && NODES[anyNode.def].skill && g.level(NODES[anyNode.def].skill!) < NODES[anyNode.def].level) { if (lastWant !== id + 'lvl') { note(`CAN'T gather ${id}: needs ${NODES[anyNode.def].skill} ${NODES[anyNode.def].level}`); lastWant = id + 'lvl'; } return gatherSomething(NODES[anyNode.def].skill); }
    // make it
    const r = RECIPES.find((x) => x.output.id === id);
    if (r) {
      for (const i of r.inputs) if (count(g.p.inv, i.id) < i.qty) return obtain(i.id, i.qty, depth + 1);
      if (g.level(r.skill) < r.level) { note(`CAN'T make ${id}: needs ${r.skill} ${r.level}`); return false; }
      const st = g.layout.stations.findIndex((x) => x.id === r.station);
      if (st < 0) { note(`CAN'T make ${id}: no ${r.station} here`); return false; }
      if (!g.nearStation(r.station)) { g.interact(`station:${st}`); return true; }
      g.craft(r.id, 1); note(`MAKE ${id} at the ${r.station}`); return true;
    }
    if (lastWant !== id + 'none') { note(`NO WAY to get ${id}`); lastWant = id + 'none'; }
    return false;
  }
  let lastWant = '';
  let lastMode = '';
  let curQuest = '';
  let gatherSince = 0;
  /** before a boss: some food in the pack (cook what's raw, else fish and cook) */
  function stockFood(): boolean {
    const food = g.p.inv.filter((x) => x && ITEMS[x.id].heal).reduce((a, x) => a + x!.qty, 0);
    if (food >= 5) return false;
    if (cookIfCan()) return true;
    return gatherSomething('fishing');
  }
  /** everything the wanted item takes (the item and, down its recipe, the parts still short) */
  function needs(): Set<string> {
    const out = new Set<string>();
    const walk = (id: string, qty: number, d: number) => {
      if (d > 4 || count(g.p.inv, id) >= qty) return;
      out.add(id);
      const r = RECIPES.find((x) => x.output.id === id);
      if (r) for (const i of r.inputs) walk(i.id, i.qty * qty, d + 1);
    };
    if (wanted) walk(wanted.id, wanted.qty, 0);
    return out;
  }

  function questStep(): boolean {
    // the tracked quest; if that's stuck, another under way here; else a new one from someone with a "!" over them
    const here = (id: string) => g.questGoal(id)?.region === g.s.region;
    const free = (id: string) => (blockedUntil.get(id) ?? 0) <= g.time;
    const t = g.trackedQuest();
    const q = t && free(t) ? t
      : Object.values(QUESTS).find((x) => g.questActive(x.id) && free(x.id) && here(x.id))?.id
      ?? Object.values(QUESTS).find((x) => g.questStage(x.id) === 0 && free(x.id) && g.layout.npcs.some((n) => n.id === x.giver))?.id;
    if (!q) return false;
    if (q !== curQuest) { note(`ON ${QUESTS[q].name} (stage ${g.questStage(q)})`); curQuest = q; }
    const st = QUESTS[q].stages[g.questStage(q)], goal = g.questGoal(q);
    if (!goal) return false;
    if (goal.region && goal.region !== g.s.region) { stats.blocked.set(`${q}: goal in ${goal.region}`, (stats.blocked.get(`${q}: goal in ${goal.region}`) ?? 0) + 1); blockedUntil.set(q, g.time + 600); note(`BLOCKED ${q}: goal in ${goal.region}`); return false; }
    const before = g.questStage(q);
    const recommended = g.questCombat(q);
    // The same recommendation the journal shows: prepare before entering a quest's dangerous stages.
    if (recommended && combatLevel() < recommended && (st.kill || st.at?.arena || st.marks?.length)) {
      note(`TRAIN first: ${QUESTS[q].name}, combat ${recommended} recommended (me ${combatLevel()})`);
      blockedUntil.set(q, g.time + 300);
      return false;
    }
    if (st.talk || st.also) {
      const who = [st.talk, ...(st.also ?? [])].filter(Boolean).map((t) => t!.npc).find((n) => g.layout.npcs.some((x) => x.id === n));
      if (!who) return false;
      const n = g.layout.npcs.find((x) => x.id === who)!;
      if (Math.hypot(n.x - g.p.x, n.z - g.p.z) > 3) { if (!g.path.length && !g.pending) g.interact(`npc:${who}`); return true; }
      g.interact(`npc:${who}`);
      for (let k = 0; k < 10; k++) g.step(DT);
      if (g.questStage(q) === before) {
        const node = [st.talk, ...(st.also ?? [])].find((t) => t?.npc === who)!.node;
        const why = node.requires ? `needs ${node.requires.qty}x ${node.requires.id} (have ${count(g.p.inv, node.requires.id)})` : node.needsFlags ? `needs flags ${node.needsFlags.join(',')}` : 'talk did nothing';
        stats.blocked.set(`${q}@${before}: ${why}`, (stats.blocked.get(`${q}@${before}: ${why}`) ?? 0) + 1);
        note(`BLOCKED ${QUESTS[q].name} stage ${before}: ${why}`);
        blockedUntil.set(q, g.time + 300);
        if (node.requires) wanted = node.requires;
      }
      return true;
    }
    if (st.marks?.length && goal.x !== undefined) {
      // Follow the stage's stated order, not the tracker (which deliberately keeps puzzle answers hidden).
      const ordered = st.marks.filter(m => !m.decoy && m.seq !== undefined).sort((a, b) => a.seq! - b.seq!);
      const m = ordered.length
        ? ordered.find(m => !g.s.flags[`${q}_${before}_s${m.seq}`])
        : st.marks.find(m => !m.decoy && m.x === goal.x && m.z === goal.z);
      if (!m) return false;
      if (m.region !== g.s.region) { blockedUntil.set(q, g.time + 600); return false; }
      if (m.requires && count(g.p.inv, m.requires.id) < m.requires.qty) { wanted = m.requires; note(`BLOCKED mark ${m.id}: needs ${m.requires.id}`); blockedUntil.set(q, g.time + 300); return false; }
      if (Math.hypot(m.x - g.p.x, m.z - g.p.z) > 3) { if (!g.path.length && !g.pending) g.interact(`quest:${q}:${m.id}`); return true; }
      g.interact(`quest:${q}:${m.id}`);
      return true;
    }
    const arenaId = st.at?.arena ?? (st.kill && g.layout.arenas.some((a) => a.boss === st.kill!.foe) ? st.kill.foe : null);
    if (arenaId && !g.enemies.some((e) => e.alive && e.def.id === arenaId)) {
      const i = g.layout.arenas.findIndex((a) => a.boss === arenaId);
      if (i < 0) return false;
      const boss = g.layout.arenas[i];
      if ((fightLosses.get(arenaId) ?? 0) >= 1 && combatLevel() < (fightLosses.get(arenaId)! + 1) * 6) { blockedUntil.set(q, g.time + 600); return false; }
      if (stockFood()) return true; // fish and cook first
      if (g.bestFood() === null) { blockedUntil.set(q, g.time + 120); return false; }
      if (hpFrac() < 0.9) { eatFood(); return true; }
      if (Math.hypot(boss.altar.x - g.p.x, boss.altar.z - g.p.z) > 3) { if (!g.path.length && !g.pending) g.interact(`arena:${i}`); return true; }
      g.interact(`arena:${i}`); note(`RING arena: ${arenaId} (me ${combatLevel()}, food ${g.p.inv.filter((x) => x && ITEMS[x.id].heal).reduce((a, x) => a + x!.qty, 0)})`);
      for (let k = 0; k < 60; k++) g.step(DT);
      const b = g.enemies.find((e) => e.alive && e.def.id === arenaId);
      if (b) attack(b, 'arena boss'); else note('RING did nothing');
      return true;
    }
    if (st.kill) {
      const foe = g.enemies.find((e) => e.alive && e.def.id === st.kill!.foe);
      if (!foe) { note(`WAIT no ${st.kill.foe} alive`); blockedUntil.set(q, g.time + 60); return false; }
      if ((fightLosses.get(foe.def.id) ?? 0) >= 2 && foe.def.level > combatLevel()) { blockedUntil.set(q, g.time + 600); note(`TRAIN first: ${foe.def.name} lvl ${foe.def.level} beat me twice`); return false; }
      attack(foe, `for ${QUESTS[q].name}`);
      return true;
    }
    note(`QUEST ${q} stage ${before} has no action the bot understands (${st.waitFlags ? 'waitFlags' : st.chase ? 'chase' : '?'})`);
    blockedUntil.set(q, g.time + 600);
    return false;
  }
  let wanted: { id: string; qty: number } | null = null;

  function think() {
    if (g.dead) { fighting = null; fleeing = false; return; }
    equipUpgrades();
    const pursuing = g.enemies.filter(e => e.alive && (e.state === 'chase' || e.state === 'windup') && Math.hypot(e.x - g.p.x, e.z - g.p.z) < 30);
    // A retreat is one decision lasting until safety, not a new fight on every tick.
    if (!fleeing && hpFrac() < 0.45 && g.bestFood() === null && (fighting?.alive || pursuing.length)) {
      const foe = fighting?.alive ? fighting : pursuing[0];
      stats.fled++; stats.lostFights++;
      note(`FLEE from ${foe.def.name} (no food, ${Math.round(g.p.hp)} hp)`);
      fightLosses.set(foe.def.id, (fightLosses.get(foe.def.id) ?? 0) + 1);
      fighting = null; fleeing = true;
      g.moveTo(g.layout.respawn.x, g.layout.respawn.z);
    }
    if (fleeing) {
      const home = Math.hypot(g.p.x - g.layout.respawn.x, g.p.z - g.layout.respawn.z) < 6;
      if (!home || pursuing.length) {
        if (!g.path.length) g.moveTo(g.layout.respawn.x, g.layout.respawn.z);
        return;
      }
      fleeing = false; note('SAFE after retreat');
    }
    if (hpFrac() < 0.45 && g.bestFood() !== null) { eatFood(); }
    if (fighting && !fighting.alive) fighting = null;
    if (fighting) return;
    const attacker = pursuing.find(e => Math.hypot(e.x - g.p.x, e.z - g.p.z) < 6);
    if (attacker) { attack(attacker, 'it attacked me'); return; }
    // a person stops chopping or mining once they have what they came for
    if (wanted && g.action?.type === 'gather') {
      const d = NODES[g.nodes.find((n) => n.uid === (g.action as { node: string }).node)!.def];
      const gives = [d.item, ...(d.drops ?? []).map((x) => x.item)];
      if (gives.every((id) => !needs().has(id))) g.stopAction();
    }
    // a person looks up every few minutes and decides whether to keep going
    if (g.action?.type === 'gather' && !gatherSince) gatherSince = g.time;
    // Depleting a small node can automatically select the next one. Keep the activity timer across that gap.
    if (gatherSince && g.time - gatherSince > 180) {
      if (g.action?.type === 'gather') g.stopAction();
      if (g.pending?.startsWith('node:')) g.moveTo(g.p.x, g.p.z);
      gatherSince = 0;
    }
    if (g.action || g.path.length || g.pending) return;
    if (bankIfFull()) return;
    if (hpFrac() < 0.7 && g.bestFood() === null && cookIfCan()) return;
    if (wanted && count(g.p.inv, wanted.id) < wanted.qty && obtain(wanted.id, wanted.qty)) return;
    if (wanted && count(g.p.inv, wanted.id) >= wanted.qty) { note(`GOT ${wanted.id}`); wanted = null; blockedUntil.clear(); }
    if (questStep()) return;
    // nothing to do for quests: train, switching what I do every 8 minutes or so like a person would
    const modes = ['combat', 'fishing', 'woodcutting', 'mining', 'combat'];
    const mode = modes[Math.floor(g.time / 480) % modes.length];
    if (mode !== lastMode) { note(`ACTIVITY ${mode}`); lastMode = mode; }
    if (mode !== 'combat') { if (cookIfCan()) return; if (gatherSomething(mode)) return; }
    // combat time: fight something my level, else gather
    if (cookIfCan()) return;
    const lvl = combatLevel();
    const foe = hpFrac() > 0.7 ? nearestFoe(Math.max(2, lvl + 1), Infinity) : null;
    if (foe && random() < 0.6) { attack(foe, 'training'); return; }
    if (gatherSomething()) return;
    stats.idle++;
  }


  return { think, stats, log, note };
}
