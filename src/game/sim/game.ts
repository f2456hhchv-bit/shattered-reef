import { mulberry32 } from '../../art/noise';
import { item, type Slot, type SkillId, type CombatStyle } from '../data/items';
import { NODES, RECIPES, ENEMIES, LOOT, ELITE_AFFIXES, SHOP, PLAYER_BASE, COMBAT_SKILLS, XP_PER_DAMAGE, type EnemyDef, type Recipe, type Station } from '../data/content';
import { NPCS, QUESTS, type DialogueNode, type Effect } from '../data/quests';
import { PLACES } from '../world/island';
import { buildIsland, type IslandLayout } from '../world/layout';
import type { World } from '../world/world';
import { add, canAdd, count, remove, displayName, stackValue, type Stack } from './inventory';
import { computeStats, makeInstance, rollRarity, hitChance, reqBlock, type PlayerStats, type Stance } from './gear';
import { levelForXp, MAX_XP } from './xp';
import { defaultSave, SAVE_VERSION, type SaveData } from './save';

// The whole game, minus pixels. Deterministic given a seed; driven by step(dt) and commands.

export type MsgKind = 'info' | 'warn' | 'good' | 'loot' | 'quest' | 'combat';

export type GameEvent =
  | { type: 'msg'; text: string; kind: MsgKind }
  | { type: 'xp'; skill: SkillId; amount: number }
  | { type: 'level'; skill: SkillId; level: number }
  | { type: 'gain'; id: string; qty: number; name: string }
  | { type: 'pickup'; x: number; z: number; tint: 'common' | 'fine' | 'rare' | 'relic' | 'quest' }
  | { type: 'hit'; target: 'player' | 'enemy'; id: number; amount: number; crit: boolean; x: number; z: number }
  | { type: 'swing' }
  | { type: 'whirl' }
  | { type: 'squall' }
  | { type: 'roll' }
  | { type: 'dodge'; x: number; z: number }
  | { type: 'shoot'; x: number; z: number; tx: number; tz: number }
  | { type: 'enemyAttack'; id: number }
  | { type: 'enemyDeath'; id: number; x: number; z: number; elite: boolean; boss: boolean }
  | { type: 'playerDeath' }
  | { type: 'gatherFx'; kind: 'wood' | 'stone' | 'water'; x: number; z: number; success: boolean }
  | { type: 'craftFx'; station: Station }
  | { type: 'dialog'; npc: string; lines: string[] }
  | { type: 'openStation'; station: Station }
  | { type: 'openShop' }
  | { type: 'quest'; id: string; stage: number }
  | { type: 'boss'; state: 'rise' | 'defeat' | 'reset' | 'summon' }
  | { type: 'board' }
  | { type: 'disembark' }
  | { type: 'discover'; id: string; name: string }
  | { type: 'explode'; x: number; z: number; r: number };

export interface NodeRt { uid: string; def: string; x: number; z: number; seed: number; depletedUntil: number }

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number; z: number; facing: number;
  spawnX: number; spawnZ: number;
  hp: number; maxHp: number;
  alive: boolean;
  state: 'idle' | 'chase' | 'windup' | 'return' | 'rise';
  t: number; // state timer
  cd: number;
  aim: { x: number; z: number } | null;
  elite: string | null;
  respawnAt: number;
  summoned: boolean;
  wander: { x: number; z: number } | null;
  hitFlash: number;
  moving: boolean;
}

export interface Drop { id: number; x: number; z: number; stack: Stack; t: number }
export interface Projectile { id: number; x: number; z: number; vx: number; vz: number; life: number; damage: number; from: 'player' | 'enemy'; kind?: 'shot' | 'magic'; crit?: boolean; style?: CombatStyle; spellBase?: number; knock?: number }
export interface Telegraph { id: number; kind: 'circle' | 'cone' | 'line'; x: number; z: number; r: number; angle: number; width: number; t: number; dur: number; damage: number; source: number }

type Action =
  | { type: 'gather'; node: string; next: number }
  | { type: 'craft'; recipe: string; remaining: number; next: number }
  | null;

export interface Target { key: string; kind: 'node' | 'npc' | 'station' | 'ship' | 'ruin' | 'enemy' | 'drop' | 'mooring'; x: number; z: number; range: number; label: string; verb: string }

// RuneScape's 4-tick rhythm for gathering; production a little quicker.
const DT_GATHER = 2.4;
const DT_CRAFT = 1.8;
const SAFE_RADIUS = 16;
export const STATION_NAMES: Record<Station, string> = { furnace: 'Furnace', anvil: 'Anvil', fire: 'Cookfire', bench: 'Gunsmith\'s bench' };

export class Game {
  readonly layout: IslandLayout;
  readonly world: World;
  s: SaveData;
  rnd: () => number;
  time = 0;
  /** increments on any change the UI should redraw (inventory, skills, quests, equipment) */
  rev = 0;

  // runtime
  nodes: NodeRt[];
  enemies: Enemy[] = [];
  drops: Drop[] = [];
  projectiles: Projectile[] = [];
  telegraphs: Telegraph[] = [];
  private nextId = 1;
  private listeners: ((e: GameEvent) => void)[] = [];

  // player runtime
  facing = Math.PI / 2;
  moveDir = { x: 0, z: 0 };
  path: [number, number][] = [];
  pending: string | null = null; // interaction to perform on arrival
  action: Action = null;
  attackCd = 0;
  specialCd = 0;
  rollCd = 0;
  rollT = 0; // > 0 while rolling (invulnerable)
  private rollDir = { x: 0, z: 1 };
  eatCd = 0;
  combatTimer = 99;
  regenTimer = 0;
  dead = 0; // seconds until respawn, 0 = alive
  moving = false;
  target: number | null = null; // enemy explicitly targeted
  stats!: PlayerStats;
  private fullWarned = 0;

  // ship runtime
  shipSpeed = 0;
  shipTarget: { x: number; z: number } | null = null;
  private shoalWarned = 0;

  // boss
  boss: Enemy | null = null;
  bossCast = 0;
  bossSummons = 0;

  constructor(opts: { seed?: number; save?: SaveData | null } = {}) {
    this.layout = buildIsland(1);
    this.world = this.layout.world;
    this.rnd = mulberry32(opts.seed ?? (Date.now() & 0xffffffff));
    const fresh = defaultSave(this.layout.respawn, this.layout.mooring);
    this.s = opts.save ?? fresh;
    this.nodes = this.layout.nodes.map((n) => ({ ...n, depletedUntil: 0 }));
    for (const sp of this.layout.spawns) this.spawnEnemy(ENEMIES[sp.enemy], sp.x, sp.z, false);
    this.recalc();
    if (!this.s.player.onShip && !this.world.walkable(this.s.player.x, this.s.player.z)) {
      this.s.player.x = this.layout.respawn.x;
      this.s.player.z = this.layout.respawn.z;
    }
    if (!this.world.sailable(this.s.ship.x, this.s.ship.z)) Object.assign(this.s.ship, this.layout.mooring);
    if (this.s.player.onShip) { this.s.player.x = this.s.ship.x; this.s.player.z = this.s.ship.z; }
    this.s.player.hp = Math.min(this.s.player.hp, this.stats.maxHp);
  }

  // ------------------------------------------------------------------ events
  on(fn: (e: GameEvent) => void) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  private emit(e: GameEvent) { for (const f of this.listeners) f(e); }
  msg(text: string, kind: MsgKind = 'info') { this.emit({ type: 'msg', text, kind }); }

  get p() { return this.s.player; }
  get ship() { return this.s.ship; }
  level(skill: SkillId) { return levelForXp(this.p.xp[skill]); }
  recalc() { this.stats = computeStats(this.p.xp, this.p.equip, this.s.combat.stance, this.s.combat.spell); this.rev++; }

  // ------------------------------------------------------------------ xp + items
  addXp(skill: SkillId, amount: number) {
    const amt = Math.round(amount * (1 + (COMBAT_SKILLS.includes(skill) ? 0 : this.stats.xpBonus)) * 10) / 10;
    if (amt <= 0) return;
    const before = this.level(skill);
    this.p.xp[skill] = Math.min(MAX_XP, this.p.xp[skill] + amt);
    const after = this.level(skill);
    this.emit({ type: 'xp', skill, amount: amt });
    if (after > before) {
      this.emit({ type: 'level', skill, level: after });
      this.msg(`${skill[0].toUpperCase()}${skill.slice(1)} level ${after}!`, 'good');
      if (COMBAT_SKILLS.includes(skill)) { this.recalc(); if (skill === 'hitpoints') this.p.hp = Math.min(this.stats.maxHp, this.p.hp + (after - before)); }
    }
    this.rev++;
  }

  give(id: string, qty: number, inst?: Stack['inst']): boolean {
    const left = add(this.p.inv, { id, qty, inst });
    this.rev++;
    if (left < qty) this.emit({ type: 'gain', id, qty: qty - left, name: inst ? displayName({ id, qty: 1, inst }) : item(id).name });
    if (left > 0) {
      this.dropAt(this.p.x, this.p.z, { id, qty: left, inst });
      this.msg('Your pack is full. It dropped at your feet.', 'warn');
      return false;
    }
    return true;
  }

  private uid() { return this.s.nextUid++; }

  bestTool(skill: SkillId) {
    let best: { id: string; power: number } | null = null;
    const lvl = this.level(skill);
    for (const st of this.p.inv) {
      const t = st && item(st.id).tool;
      if (t && t.skill === skill && t.level <= lvl && (!best || t.power > best.power)) best = { id: st!.id, power: t.power };
    }
    return best;
  }

  // ------------------------------------------------------------------ targets
  targets(): Target[] {
    const out: Target[] = [];
    const onShip = this.p.onShip;
    for (const n of this.nodes) {
      const d = NODES[n.def];
      if (n.depletedUntil > this.time) continue;
      if (!!d.fromShip !== onShip) continue;
      out.push({ key: `node:${n.uid}`, kind: 'node', x: n.x, z: n.z, range: d.fromShip ? 7 : d.skill === 'fishing' ? 3.2 : 1.9, label: d.name, verb: d.verb });
    }
    if (!onShip) {
      for (const n of this.layout.npcs) out.push({ key: `npc:${n.id}`, kind: 'npc', x: n.x, z: n.z, range: 2.2, label: NPCS[n.id].name, verb: NPCS[n.id].shop ? 'Trade' : 'Talk' });
      for (const st of this.layout.stations) out.push({ key: `station:${st.id}`, kind: 'station', x: st.x, z: st.z, range: 2.3, label: STATION_NAMES[st.id], verb: st.id === 'fire' ? 'Cook' : st.id === 'furnace' ? 'Smelt' : st.id === 'bench' ? 'Craft' : 'Forge' });
      out.push({ key: 'ship', kind: 'ship', x: this.ship.x, z: this.ship.z, range: 4.2, label: 'Your sloop', verb: 'Board' });
      out.push({ key: 'ruin', kind: 'ruin', x: this.layout.plinth.x, z: this.layout.plinth.z, range: 2.2, label: 'Bell hollow', verb: 'Ring' });
      const mo = this.layout.mooring;
      if (Math.hypot(this.ship.x - mo.x, this.ship.z - mo.z) > 6) {
        const d = this.layout.dock;
        out.push({ key: 'mooring', kind: 'mooring', x: d.x + 3, z: d.headZ + 1.6, range: 2.4, label: 'Mooring bell', verb: 'Call ship' });
      }
      for (const e of this.enemies) if (e.alive && e.state !== 'rise') out.push({ key: `enemy:${e.id}`, kind: 'enemy', x: e.x, z: e.z, range: 1.6 + e.def.radius, label: this.enemyName(e), verb: 'Attack' });
    }
    return out;
  }

  enemyName(e: Enemy) {
    const a = e.elite ? ELITE_AFFIXES.find((x) => x.id === e.elite) : null;
    return a ? `${a.name} ${e.def.name.toLowerCase()}` : e.def.name;
  }

  /** Best thing to interact with right now, for the context button. */
  contextTarget(): Target | null {
    if (this.p.onShip) {
      const spot = this.targets().find((t) => t.kind === 'node' && Math.hypot(t.x - this.p.x, t.z - this.p.z) <= t.range);
      if (spot) return spot;
      const land = this.landingPoint();
      if (land) return { key: 'disembark', kind: 'ship', x: land[0], z: land[1], range: 99, label: 'Shore', verb: 'Go ashore' };
      return null;
    }
    let best: Target | null = null, bd = Infinity;
    for (const t of this.targets()) {
      if (t.kind === 'enemy') continue;
      const d = Math.hypot(t.x - this.p.x, t.z - this.p.z) - t.range;
      if (d < 1.2 && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ------------------------------------------------------------------ commands
  setMoveDir(x: number, z: number) {
    const m = Math.hypot(x, z);
    this.moveDir = m > 1 ? { x: x / m, z: z / m } : { x, z };
    if (m > 0.05) {
      this.path = [];
      this.pending = null;
      this.shipTarget = null;
      if (this.action) this.stopAction();
      this.target = null;
    }
  }

  moveTo(x: number, z: number) {
    if (this.dead) return;
    if (this.action) this.stopAction();
    this.pending = null;
    this.target = null;
    if (this.p.onShip) { this.shipTarget = { x, z }; return; }
    this.path = this.world.findPath(this.p.x, this.p.z, x, z) ?? [];
    if (!this.path.length) this.msg('You can\'t reach that.', 'warn');
  }

  interact(key: string) {
    if (this.dead) return;
    if (key === 'disembark') { this.disembark(); return; }
    const t = this.targets().find((x) => x.key === key);
    if (!t) return;
    if (this.action) this.stopAction();
    if (t.kind === 'enemy') { this.target = Number(key.split(':')[1]); this.pending = null; this.path = []; return; }
    this.target = null;
    if (Math.hypot(t.x - this.p.x, t.z - this.p.z) <= t.range) { this.perform(t); return; }
    if (this.p.onShip) { this.shipTarget = { x: t.x, z: t.z }; this.pending = key; return; }
    // walk to the nearest reachable point beside the target
    const ang = Math.atan2(this.p.z - t.z, this.p.x - t.x);
    let path: [number, number][] | null = null;
    for (const off of [0, 0.6, -0.6, 1.3, -1.3, 2.2, -2.2, Math.PI]) {
      const r = Math.max(0.6, t.range - 0.5);
      const gx = t.x + Math.cos(ang + off) * r, gz = t.z + Math.sin(ang + off) * r;
      if (!this.world.walkable(gx, gz)) continue;
      path = this.world.findPath(this.p.x, this.p.z, gx, gz);
      if (path) break;
    }
    if (!path) { this.msg('You can\'t reach that.', 'warn'); return; }
    this.path = path;
    this.pending = key;
  }

  private perform(t: Target) {
    this.path = [];
    this.pending = null;
    this.facing = Math.atan2(t.z - this.p.z, t.x - this.p.x);
    switch (t.kind) {
      case 'node': return this.startGather(t.key.slice(5));
      case 'npc': return this.talk(t.key.slice(4));
      case 'station': this.emit({ type: 'openStation', station: t.key.slice(8) as Station }); return;
      case 'ship': return this.board();
      case 'ruin': return this.ringBell();
      case 'mooring': return this.callShip();
    }
  }

  stopAction() {
    this.action = null;
  }

  // ------------------------------------------------------------------ gathering
  private startGather(uid: string) {
    const n = this.nodes.find((x) => x.uid === uid);
    if (!n) return;
    const d = NODES[n.def];
    if (this.level(d.skill) < d.level) { this.msg(`You need ${d.skill} level ${d.level} for ${d.name.toLowerCase()}.`, 'warn'); return; }
    const tool = this.bestTool(d.skill);
    if (!tool) { this.msg(`You need a ${d.skill === 'woodcutting' ? 'hatchet' : d.skill === 'mining' ? 'pickaxe' : 'fishing rod'}.`, 'warn'); return; }
    if (!canAdd(this.p.inv, d.item)) { this.msg('Your pack is full.', 'warn'); return; }
    this.action = { type: 'gather', node: uid, next: this.time + DT_GATHER * 0.6 };
    this.msg(d.skill === 'fishing' ? 'You cast your line...' : `You swing at the ${d.name.toLowerCase()}...`);
  }

  private tickGather(a: Extract<NonNullable<Action>, { type: 'gather' }>) {
    const n = this.nodes.find((x) => x.uid === a.node)!;
    const d = NODES[n.def];
    const range = d.fromShip ? 7.5 : d.skill === 'fishing' ? 3.6 : 2.4;
    if (n.depletedUntil > this.time || Math.hypot(n.x - this.p.x, n.z - this.p.z) > range) { this.stopAction(); return; }
    this.facing = Math.atan2(n.z - this.p.z, n.x - this.p.x);
    if (this.time < a.next) return;
    const tool = this.bestTool(d.skill);
    if (!tool) { this.stopAction(); return; }
    a.next = this.time + DT_GATHER - tool.power * 0.15;
    const lvl = this.level(d.skill);
    const chance = Math.min(0.92, Math.max(0.15, 0.55 - d.difficulty * 0.4 + (lvl - d.level) * 0.025 + tool.power * 0.12 + this.stats.gather));
    const ok = this.rnd() < chance;
    this.emit({ type: 'gatherFx', kind: d.skill === 'woodcutting' ? 'wood' : d.skill === 'mining' ? 'stone' : 'water', x: n.x, z: n.z, success: ok });
    if (!ok) return;
    if (!canAdd(this.p.inv, d.item)) { this.msg('Your pack is full.', 'warn'); this.stopAction(); return; }
    this.give(d.item, 1);
    this.addXp(d.skill, d.xp);
    if (d.depleteChance > 0 && this.rnd() < d.depleteChance) {
      n.depletedUntil = this.time + d.respawn;
      this.rev++;
      this.stopAction();
    }
  }

  // ------------------------------------------------------------------ crafting
  nearStation(st: Station) {
    const s = this.layout.stations.find((x) => x.id === st)!;
    return !this.p.onShip && Math.hypot(s.x - this.p.x, s.z - this.p.z) < 3.2;
  }

  /** Why a recipe can't be made right now, or null if it can. */
  recipeBlock(r: Recipe): string | null {
    if (this.level(r.skill) < r.level) return `Needs ${r.skill} level ${r.level}`;
    for (const i of r.inputs) if (count(this.p.inv, i.id) < i.qty) return `Needs ${i.qty} × ${item(i.id).name}`;
    const freed = r.inputs.some((i) => count(this.p.inv, i.id) === i.qty && item(i.id).stackable);
    if (!freed && !canAdd(this.p.inv, r.output.id)) return 'Pack is full';
    return null;
  }

  craft(recipeId: string, times: number) {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return;
    if (!this.nearStation(r.station)) { this.msg('Move closer to the station.', 'warn'); return; }
    const block = this.recipeBlock(r);
    if (block) { this.msg(block + '.', 'warn'); return; }
    this.path = [];
    this.action = { type: 'craft', recipe: r.id, remaining: Math.max(1, times), next: this.time + 0.4 };
  }

  private tickCraft(a: Extract<NonNullable<Action>, { type: 'craft' }>) {
    if (this.time < a.next) return;
    const r = RECIPES.find((x) => x.id === a.recipe)!;
    if (!this.nearStation(r.station)) { this.stopAction(); return; }
    const block = this.recipeBlock(r);
    if (block) { this.msg(block + '.', 'warn'); this.stopAction(); return; }
    for (const i of r.inputs) remove(this.p.inv, i.id, i.qty); // validated above: all-or-nothing
    this.emit({ type: 'craftFx', station: r.station });
    const lvl = this.level(r.skill);
    if (r.burn) {
      const span = Math.max(1, r.burn.stopLevel - r.level);
      const burnChance = Math.max(0, 0.45 * (1 - (lvl - r.level) / span));
      if (this.rnd() < burnChance) {
        this.give(r.burn.item, 1);
        this.msg(`You burn the ${item(r.inputs[0].id).name.toLowerCase().replace('raw ', '')}.`, 'warn');
        return this.afterCraft(a);
      }
    }
    if (r.rarityRoll) {
      const fine = 0.08 + lvl * 0.01, rare = 0.015 + lvl * 0.003;
      const roll = this.rnd();
      const rarity = roll < rare ? 'rare' : roll < rare + fine ? 'fine' : 'common';
      const inst = makeInstance(r.output.id, rarity, this.rnd, this.uid());
      this.give(r.output.id, 1, inst);
      if (rarity !== 'common') this.msg(`Masterwork! ${displayName({ id: r.output.id, qty: 1, inst })}.`, 'loot');
    } else {
      this.give(r.output.id, r.output.qty);
    }
    this.addXp(r.skill, r.xp);
    this.afterCraft(a);
  }

  private afterCraft(a: Extract<NonNullable<Action>, { type: 'craft' }>) {
    a.remaining--;
    a.next = this.time + DT_CRAFT;
    if (a.remaining <= 0) this.stopAction();
    this.rev++;
  }

  // ------------------------------------------------------------------ inventory actions
  useSlot(i: number) {
    const st = this.p.inv[i];
    if (!st) return;
    const d = item(st.id);
    if (d.heal) return this.eat(i);
    if (d.equip) return this.equip(i);
    this.msg(d.desc);
  }

  eat(i: number) {
    const st = this.p.inv[i];
    if (!st || !item(st.id).heal || this.dead) return;
    if (this.eatCd > 0) return;
    const heal = item(st.id).heal!;
    if (this.p.hp >= this.stats.maxHp) { this.msg('You are already at full health.'); return; }
    st.qty--;
    if (st.qty <= 0) this.p.inv[i] = null;
    this.p.hp = Math.min(this.stats.maxHp, this.p.hp + heal);
    this.eatCd = 1.2;
    this.msg(`You eat the ${item(st.id).name.toLowerCase()}. +${heal} health.`, 'good');
    this.rev++;
  }

  equipBlock(st: Stack): string | null {
    const e = item(st.id).equip;
    if (!e) return 'Not wearable';
    return reqBlock(st.id, this.p.xp);
  }

  equip(i: number) {
    const st = this.p.inv[i];
    if (!st) return;
    const e = item(st.id).equip;
    if (!e) return;
    const block = this.equipBlock(st);
    if (block) { this.msg(`${block}.`, 'warn'); return; }
    const old = this.p.equip[e.slot];
    if (old && old.id === st.id && item(st.id).stackable) { old.qty += st.qty; this.p.inv[i] = null; }
    else { this.p.inv[i] = old ?? null; this.p.equip[e.slot] = st; }
    this.recalc();
    this.p.hp = Math.min(this.p.hp, this.stats.maxHp);
    this.msg(`You equip the ${displayName(st)}.`);
  }

  unequip(slot: Slot) {
    const st = this.p.equip[slot];
    if (!st) return;
    if (!canAdd(this.p.inv, st.id)) { this.msg('Your pack is full.', 'warn'); return; }
    add(this.p.inv, st);
    delete this.p.equip[slot];
    this.recalc();
    this.p.hp = Math.min(this.p.hp, this.stats.maxHp);
  }

  dropSlot(i: number) {
    const st = this.p.inv[i];
    if (!st) return;
    if (item(st.id).quest) { this.msg('You should keep that.', 'warn'); return; }
    this.p.inv[i] = null;
    this.dropAt(this.p.x, this.p.z, st, 4);
    this.rev++;
  }

  // ------------------------------------------------------------------ shop
  nearShop() {
    const n = this.layout.npcs.find((x) => x.id === 'marta')!;
    return !this.p.onShip && Math.hypot(n.x - this.p.x, n.z - this.p.z) < 3.5;
  }
  buyPrice(id: string) {
    const e = SHOP.stock.find((x) => x.id === id);
    return Math.max(1, Math.ceil(item(id).value * (e?.qty ?? 1) * SHOP.buyMul));
  }
  sellPrice(st: Stack) { return Math.floor(stackValue(st) * SHOP.sellMul); }

  buy(id: string) {
    const entry = SHOP.stock.find((x) => x.id === id);
    if (!this.nearShop() || !entry) return;
    const price = this.buyPrice(id);
    if (count(this.p.inv, 'coins') < price) { this.msg(`You need ${price} coins.`, 'warn'); return; }
    if (!canAdd(this.p.inv, id)) { this.msg('Your pack is full.', 'warn'); return; }
    remove(this.p.inv, 'coins', price);
    this.give(id, entry.qty);
  }

  sell(i: number, all = false) {
    const st = this.p.inv[i];
    if (!st || !this.nearShop()) return;
    const d = item(st.id);
    if (d.quest || st.id === 'coins') { this.msg('Marta won\'t buy that.', 'warn'); return; }
    const qty = all ? st.qty : 1;
    const each = this.sellPrice({ ...st, qty: 1 });
    st.qty -= qty;
    if (st.qty <= 0) this.p.inv[i] = null;
    if (each * qty > 0) add(this.p.inv, { id: 'coins', qty: each * qty });
    this.msg(`Sold ${qty} × ${displayName(st)} for ${each * qty} coins.`);
    this.rev++;
  }

  // ------------------------------------------------------------------ npcs + quests
  questStage(id: string) { return this.s.quests[id] ?? 0; }

  private talk(npcId: string) {
    const npc = NPCS[npcId];
    for (const q of Object.values(QUESTS)) {
      const stage = q.stages[this.questStage(q.id)];
      if (stage?.talk?.npc === npcId) {
        const node = stage.talk.node;
        if (node.requires && count(this.p.inv, node.requires.id) < node.requires.qty) {
          this.emit({ type: 'dialog', npc: npcId, lines: node.missing ?? npc.idle });
          return;
        }
        this.emit({ type: 'dialog', npc: npcId, lines: node.lines });
        if (node.effect) this.applyEffect(q.id, node.effect, node);
        return;
      }
    }
    if (npc.shop) { this.emit({ type: 'openShop' }); return; }
    this.emit({ type: 'dialog', npc: npcId, lines: npc.idle });
  }

  private applyEffect(questId: string, e: Effect, _node?: DialogueNode) {
    for (const t of e.take ?? []) remove(this.p.inv, t.id, t.qty);
    for (const g of e.give ?? []) this.give(g.id, g.qty);
    for (const x of e.xp ?? []) this.addXp(x.skill, x.amount);
    if (e.flag) this.s.flags[e.flag] = true;
    if (e.stage !== undefined) this.setStage(questId, e.stage);
    this.rev++;
  }

  setStage(questId: string, stage: number) {
    this.s.quests[questId] = stage;
    const q = QUESTS[questId];
    this.emit({ type: 'quest', id: questId, stage });
    if (stage === q.stages.length - 1) this.msg(`Quest complete: ${q.name}!`, 'quest');
    else if (stage === 1) this.msg(`New quest: ${q.name}`, 'quest');
    else this.msg(`Quest updated: ${q.name}`, 'quest');
    this.rev++;
  }

  // ------------------------------------------------------------------ ship
  board() {
    if (this.p.onShip) return;
    if (Math.hypot(this.ship.x - this.p.x, this.ship.z - this.p.z) > 4.6) return;
    this.p.onShip = true;
    this.path = [];
    this.stopAction();
    this.target = null;
    this.shipSpeed = 0;
    this.p.x = this.ship.x;
    this.p.z = this.ship.z;
    this.emit({ type: 'board' });
    this.msg('You take the tiller. Drag or click to sail.');
    this.rev++;
  }

  landingPoint(): [number, number] | null {
    if (!this.p.onShip) return null;
    const sx = this.ship.x, sz = this.ship.z;
    let best: [number, number] | null = null, bd = Infinity;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      for (let r = 2; r <= 6.5; r += 0.5) {
        const x = sx + Math.cos(ang) * r, z = sz + Math.sin(ang) * r;
        if (this.world.walkable(x, z)) { if (r < bd) { bd = r; best = [x, z]; } break; }
      }
    }
    return best;
  }

  disembark() {
    const land = this.landingPoint();
    if (!land) { this.msg('No shore close enough. Sail nearer to land or the quay.', 'warn'); return; }
    const mo = this.layout.mooring;
    if (Math.hypot(this.ship.x - mo.x, this.ship.z - mo.z) < 7) Object.assign(this.ship, mo);
    this.p.onShip = false;
    this.shipSpeed = 0;
    this.shipTarget = null;
    this.stopAction();
    [this.p.x, this.p.z] = land;
    this.emit({ type: 'disembark' });
    this.msg('You step ashore.');
    this.rev++;
  }

  callShip() {
    Object.assign(this.ship, this.layout.mooring);
    this.msg('Harbour hands row your sloop back to the quay.');
    this.rev++;
  }

  private stepShip(dt: number) {
    const sh = this.ship;
    let want: number | null = null, throttle = 0;
    const m = Math.hypot(this.moveDir.x, this.moveDir.z);
    if (m > 0.1) { want = Math.atan2(this.moveDir.z, this.moveDir.x); throttle = Math.min(1, m); }
    else if (this.shipTarget) {
      const dx = this.shipTarget.x - sh.x, dz = this.shipTarget.z - sh.z, d = Math.hypot(dx, dz);
      const stopAt = this.pending ? 5 : 2.5;
      if (d < stopAt) {
        this.shipTarget = null;
        if (this.pending) { const t = this.targets().find((x) => x.key === this.pending); this.pending = null; if (t && Math.hypot(t.x - sh.x, t.z - sh.z) <= t.range + 0.5) this.perform(t); }
      } else { want = Math.atan2(dz, dx); throttle = Math.min(1, d / 8 + 0.3); }
    }
    if (want !== null) {
      const diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
      sh.heading += Math.max(-1, Math.min(1, diff * 2.2)) * 1.25 * dt;
      throttle *= Math.max(0.25, Math.cos(diff) * 0.5 + 0.5);
    }
    const maxSpeed = 7.5;
    const targetSpeed = throttle * maxSpeed;
    this.shipSpeed += (targetSpeed - this.shipSpeed) * Math.min(1, dt * (targetSpeed > this.shipSpeed ? 0.7 : 1.2));
    if (this.shipSpeed > 0.01) {
      const nx = sh.x + Math.cos(sh.heading) * this.shipSpeed * dt, nz = sh.z + Math.sin(sh.heading) * this.shipSpeed * dt;
      if (this.hullFits(nx, nz, sh.heading)) { sh.x = nx; sh.z = nz; }
      else {
        this.shipSpeed = 0;
        this.shipTarget = null;
        if (this.time - this.shoalWarned > 3) { this.shoalWarned = this.time; this.msg('Shallows! The hull scrapes. Steer for deeper water.', 'warn'); }
      }
    }
    this.p.x = sh.x;
    this.p.z = sh.z;
    this.facing = sh.heading;
  }

  hullFits(x: number, z: number, h: number) {
    const c = Math.cos(h), s = Math.sin(h);
    for (const [lx, lz] of [[4.6, 0], [-3.8, 0], [0.5, 1.3], [0.5, -1.3], [2.5, 0.8], [2.5, -0.8], [-2, 1.1], [-2, -1.1]]) {
      if (!this.world.sailable(x + lx * c - lz * s, z + lx * s + lz * c)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ combat
  private spawnEnemy(def: EnemyDef, x: number, z: number, summoned: boolean): Enemy {
    const e: Enemy = {
      id: this.nextId++, def, x, z, facing: this.rnd() * Math.PI * 2, spawnX: x, spawnZ: z,
      hp: def.hp, maxHp: def.hp, alive: true, state: 'idle', t: 0, cd: 0, aim: null, elite: null, respawnAt: 0, summoned, wander: null, hitFlash: 0, moving: false,
    };
    this.rollElite(e);
    this.enemies.push(e);
    return e;
  }

  private rollElite(e: Enemy) {
    e.elite = null;
    e.maxHp = e.def.hp;
    if (!e.def.boss && !e.summoned && this.rnd() < 0.1) {
      e.elite = ELITE_AFFIXES[Math.floor(this.rnd() * ELITE_AFFIXES.length)].id;
      e.maxHp = Math.round(e.def.hp * (e.elite === 'barnacled' ? 3 : 2));
    }
    e.hp = e.maxHp;
  }

  // ---- stances, ammo, specials -------------------------------------------------
  setStance(st: Stance) { this.s.combat.stance = st; this.recalc(); }
  setSpell(id: string) { this.s.combat.spell = id; this.recalc(); }

  /** Why the equipped weapon can't attack right now, or null. */
  ammoBlock(n = 1): string | null {
    const st = this.stats;
    if (st.style === 'ranged') {
      const a = this.p.equip.ammo;
      if (!a || a.qty < n) return 'You have no shot in your ammo slot.';
    }
    if (st.style === 'magic' && count(this.p.inv, 'charm_tide') < (st.spell?.charms ?? 1) * n) return 'You need more tide charms to cast.';
    return null;
  }

  private consumeAmmo(n = 1) {
    if (this.stats.style === 'ranged') {
      const a = this.p.equip.ammo!;
      a.qty -= n;
      if (a.qty <= 0) { delete this.p.equip.ammo; this.recalc(); this.msg('You are out of shot.', 'warn'); }
    } else if (this.stats.style === 'magic') {
      remove(this.p.inv, 'charm_tide', (this.stats.spell?.charms ?? 1) * n);
    }
    this.rev++;
  }

  private ammoWarned = 0;
  private warnAmmo(text: string) {
    if (this.time - this.ammoWarned > 4) { this.ammoWarned = this.time; this.msg(text, 'warn'); }
  }

  /** Accuracy roll against an enemy's defence for the current style; damage 0..max on a hit. */
  private rollAgainst(e: Enemy, maxHit = this.stats.maxHit): { dmg: number; crit: boolean } {
    const st = this.stats;
    const defLvl = e.def.def + (e.elite === 'barnacled' ? 10 : 0);
    const defRoll = (defLvl + 9) * (e.def.defBonus[st.style] + 64);
    if (this.rnd() >= hitChance(st.attRoll, defRoll)) return { dmg: 0, crit: false };
    const crit = this.rnd() < st.crit;
    // a successful hit always lands at least 1, so a 0 always means a miss
    let dmg = crit ? maxHit : 1 + Math.floor(this.rnd() * maxHit);
    if ((e.elite || e.def.boss) && dmg > 0) dmg = Math.round(dmg * (1 + st.eliteDmg));
    return { dmg, crit };
  }

  /** RuneScape XP: 4 per damage to the trained skill(s), 1.33 to Hitpoints; spells add base XP. */
  private combatXp(dmg: number, style: CombatStyle, spellBase = 0) {
    const tr = this.stats.trains;
    if (style === 'magic') {
      this.addXp('magic', spellBase + dmg * XP_PER_DAMAGE.magic);
      if (tr.includes('defence') && dmg > 0) this.addXp('defence', dmg * 1);
    } else if (dmg > 0) {
      const each = XP_PER_DAMAGE.style / tr.length;
      for (const k of tr) this.addXp(k, dmg * each);
    }
    if (dmg > 0) this.addXp('hitpoints', dmg * XP_PER_DAMAGE.hitpoints);
  }

  private nearestEnemy(range: number, from = { x: this.p.x, z: this.p.z }): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'rise') continue;
      const d = Math.hypot(e.x - from.x, e.z - from.z) - e.def.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** One normal attack with whatever is equipped. Returns false if it couldn't fire. */
  private performAttack(t: Enemy): boolean {
    const st = this.stats;
    if (st.style === 'melee') {
      this.emit({ type: 'swing' });
      const r = this.rollAgainst(t);
      const tx = t.x, tz = t.z;
      this.damageEnemy(t, r.dmg, r.crit, 'melee', 0.35);
      if (st.cleave > 0 && r.dmg > 0) {
        for (const e of this.enemies) if (e !== t && e.alive && Math.hypot(e.x - tx, e.z - tz) < 2.2) this.damageEnemy(e, Math.max(1, Math.round(r.dmg * st.cleave)), false, 'melee', 0.2);
      }
      return true;
    }
    const block = this.ammoBlock();
    if (block) { this.warnAmmo(block); return false; }
    this.consumeAmmo();
    this.fireAt(t, this.rollAgainst(t), st.style, st.spell?.baseXp ?? 0);
    return true;
  }

  private fireAt(t: Enemy, r: { dmg: number; crit: boolean }, style: CombatStyle, spellBase: number, angleOffset = 0, knock = 0.2) {
    const ang = Math.atan2(t.z - this.p.z, t.x - this.p.x) + angleOffset;
    this.facing = ang;
    const speed = style === 'magic' ? 18 : 30;
    const dist = Math.hypot(t.x - this.p.x, t.z - this.p.z) + 1.5;
    this.projectiles.push({ id: this.nextId++, x: this.p.x, z: this.p.z, vx: Math.cos(ang) * speed, vz: Math.sin(ang) * speed, life: dist / speed, damage: r.dmg, from: 'player', kind: style === 'magic' ? 'magic' : 'shot', crit: r.crit, style, spellBase, knock });
    this.emit({ type: 'shoot', x: this.p.x, z: this.p.z, tx: t.x, tz: t.z });
  }

  /** Special attack: depends on the weapon type (Whirl, Scatter shot, Squall). */
  specialInfo(): { name: string; cooldown: number; block: string | null } {
    const st = this.stats, sp = PLAYER_BASE.special[st.style];
    let block: string | null = null;
    if (this.level(sp.skill) < sp.level) block = `Needs ${sp.skill[0].toUpperCase() + sp.skill.slice(1)} level ${sp.level}`;
    else if (st.style === 'ranged') block = this.ammoBlock(PLAYER_BASE.special.ranged.shots);
    else if (st.style === 'magic' && count(this.p.inv, 'charm_tide') < PLAYER_BASE.special.magic.charms) block = 'Needs 3 tide charms';
    return { name: sp.name, cooldown: sp.cooldown, block };
  }

  useSpecial() {
    if (this.dead || this.p.onShip || this.specialCd > 0) return;
    const info = this.specialInfo();
    if (info.block) { this.msg(`${info.name}: ${info.block.toLowerCase()}.`, 'warn'); return; }
    const st = this.stats;
    this.combatTimer = 0;
    if (st.style === 'melee') {
      const sp = PLAYER_BASE.special.melee;
      this.specialCd = sp.cooldown;
      this.emit({ type: 'whirl' });
      let hit = 0;
      for (const e of [...this.enemies]) {
        if (!e.alive || e.state === 'rise') continue;
        if (Math.hypot(e.x - this.p.x, e.z - this.p.z) > sp.radius + e.def.radius) continue;
        const r = this.rollAgainst(e, Math.max(1, Math.round(st.maxHit * sp.mul)));
        this.damageEnemy(e, r.dmg, r.crit, 'melee', 1.4);
        hit++;
      }
      if (!hit) this.msg('Your whirl hits only air.');
    } else if (st.style === 'ranged') {
      const sp = PLAYER_BASE.special.ranged;
      const t = this.nearestEnemy(st.range + 1);
      if (!t) { this.msg('No target in range.', 'warn'); return; }
      this.specialCd = sp.cooldown;
      this.consumeAmmo(sp.shots);
      for (let k = 0; k < sp.shots; k++) this.fireAt(t, this.rollAgainst(t), 'ranged', 0, (k - (sp.shots - 1) / 2) * sp.spread, 0.6);
      this.emit({ type: 'whirl' });
    } else {
      const sp = PLAYER_BASE.special.magic;
      this.specialCd = sp.cooldown;
      remove(this.p.inv, 'charm_tide', sp.charms);
      this.emit({ type: 'squall' });
      for (const e of [...this.enemies]) {
        if (!e.alive || e.state === 'rise') continue;
        if (Math.hypot(e.x - this.p.x, e.z - this.p.z) > sp.radius + e.def.radius) continue;
        const r = this.rollAgainst(e, sp.maxHit);
        this.damageEnemy(e, r.dmg, r.crit, 'magic', sp.knock, 4);
      }
      this.rev++;
    }
  }

  /** Dodge roll: short dash, no damage taken while rolling. */
  useRoll() {
    if (this.dead || this.p.onShip || this.rollCd > 0 || this.rollT > 0) return;
    const m = Math.hypot(this.moveDir.x, this.moveDir.z);
    this.rollDir = m > 0.1 ? { x: this.moveDir.x / m, z: this.moveDir.z / m } : { x: Math.cos(this.facing), z: Math.sin(this.facing) };
    this.rollCd = PLAYER_BASE.rollCooldown;
    this.rollT = PLAYER_BASE.rollTime;
    this.path = [];
    this.pending = null;
    if (this.action) this.stopAction();
    this.emit({ type: 'roll' });
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, style: CombatStyle, knock = 0.35, spellBase = 0) {
    if (!e.alive || e.state === 'rise') return;
    dmg = Math.min(dmg, e.hp);
    e.hp -= dmg;
    if (dmg > 0) e.hitFlash = 0.12;
    this.emit({ type: 'hit', target: 'enemy', id: e.id, amount: dmg, crit, x: e.x, z: e.z });
    this.combatXp(dmg, style, spellBase);
    if (this.stats.leech > 0 && dmg > 0) this.p.hp = Math.min(this.stats.maxHp, this.p.hp + Math.max(1, Math.round(dmg * this.stats.leech)) * (this.rnd() < 0.5 ? 1 : 0));
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
    if (e.hp <= 0) { this.killEnemy(e); return; }
    if (!e.def.boss && knock > 0 && dmg > 0) {
      const dx = e.x - this.p.x, dz = e.z - this.p.z, d = Math.hypot(dx, dz) || 1;
      const k = e.elite === 'barnacled' ? knock * 0.4 : knock;
      const nx = e.x + (dx / d) * k, nz = e.z + (dz / d) * k;
      if (this.world.walkable(nx, nz)) { e.x = nx; e.z = nz; }
    }
  }

  private killEnemy(e: Enemy) {
    e.alive = false;
    e.respawnAt = this.time + e.def.respawn;
    this.emit({ type: 'enemyDeath', id: e.id, x: e.x, z: e.z, elite: !!e.elite, boss: !!e.def.boss });
    if (this.target === e.id) this.target = null;
    if (e.elite === 'volatile') this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: e.x, z: e.z, r: 2.6, angle: 0, width: 0, t: 0, dur: 1.1, damage: 4, source: e.id });
    if (!e.summoned) this.rollLoot(LOOT[e.def.loot], e.x, e.z);
    if (e.elite) this.rollLoot(LOOT.elite, e.x, e.z);
    if (e.def.boss) this.bossDefeated(e);
  }

  private rollLoot(table: (typeof LOOT)[string], x: number, z: number) {
    if (table.coins) {
      const [a, b] = table.coins;
      this.dropAt(x, z, { id: 'coins', qty: a + Math.floor(this.rnd() * (b - a + 1)) });
    }
    for (const d of table.drops) {
      if (this.rnd() >= d.chance) continue;
      const qty = d.qty ? d.qty[0] + Math.floor(this.rnd() * (d.qty[1] - d.qty[0] + 1)) : 1;
      this.dropAt(x, z, { id: d.item, qty });
    }
    if (table.gear && this.rnd() < table.gear.chance) {
      const id = table.gear.items[Math.floor(this.rnd() * table.gear.items.length)];
      const rarity = rollRarity(table.gear.weights, this.rnd);
      this.dropAt(x, z, { id, qty: 1, inst: makeInstance(id, rarity, this.rnd, this.uid()) });
    }
  }

  dropAt(x: number, z: number, stack: Stack, delay = 0) {
    const a = this.rnd() * Math.PI * 2, r = 0.4 + this.rnd() * 1.1;
    let dx = x + Math.cos(a) * r, dz = z + Math.sin(a) * r;
    if (!this.world.walkable(dx, dz)) { dx = x; dz = z; }
    this.drops.push({ id: this.nextId++, x: dx, z: dz, stack, t: -delay });
  }

  /** Enemy accuracy vs your Defence level and armour for that style; 0..maxHit on a hit. */
  private enemyRoll(e: Enemy): number {
    const st = this.stats;
    const att = (e.def.att + 9) * (e.def.accBonus + 64);
    const def = st.defLevel * (st.def[e.def.style] + 64);
    if (this.rnd() >= hitChance(att, def)) return 0;
    return 1 + Math.floor(this.rnd() * (e.def.maxHit + (e.elite ? 1 : 0)));
  }

  /** Unavoidable area damage (telegraphs): only a dodge roll or armour helps. */
  damagePlayer(raw: number) {
    const avgDef = (this.stats.def.melee + this.stats.def.ranged + this.stats.def.magic) / 3;
    this.applyPlayerDamage(Math.max(1, Math.round(raw * (1 - Math.min(0.4, Math.max(0, avgDef) / 150)))));
  }

  applyPlayerDamage(dmg: number) {
    if (this.dead || this.p.onShip) return;
    if (this.rollT > 0) { this.emit({ type: 'dodge', x: this.p.x, z: this.p.z }); return; }
    this.p.hp -= dmg;
    this.combatTimer = 0;
    this.emit({ type: 'hit', target: 'player', id: 0, amount: dmg, crit: false, x: this.p.x, z: this.p.z });
    if (this.p.hp <= 0) {
      this.p.hp = 0;
      this.dead = 3;
      this.path = [];
      this.stopAction();
      this.target = null;
      this.emit({ type: 'playerDeath' });
      this.msg('Oh dear, you are dead. You wake at the quay.', 'warn');
      if (this.boss) this.resetBoss();
    }
  }

  private respawnPlayer() {
    this.dead = 0;
    this.p.hp = this.stats.maxHp;
    this.p.x = this.layout.respawn.x;
    this.p.z = this.layout.respawn.z;
    const lost = Math.floor(count(this.p.inv, 'coins') * 0.1);
    if (lost > 0) { remove(this.p.inv, 'coins', lost); this.msg(`You wake at the quay, ${lost} coins lighter.`, 'warn'); }
    for (const e of this.enemies) if (e.alive && e.state !== 'idle') { e.state = 'return'; }
    this.rev++;
  }

  private stepPlayerCombat(dt: number) {
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (this.p.onShip || this.dead || this.rollT > 0) return;
    const st = this.stats;
    let tgt: Enemy | null = null;
    if (this.target !== null) {
      tgt = this.enemies.find((e) => e.id === this.target && e.alive) ?? null;
      if (!tgt) this.target = null;
    }
    const reach = st.style === 'melee' ? PLAYER_BASE.meleeReach : st.range;
    if (tgt) {
      const d = Math.hypot(tgt.x - this.p.x, tgt.z - this.p.z);
      if (d > reach + tgt.def.radius && !this.path.length && Math.hypot(this.moveDir.x, this.moveDir.z) < 0.05) this.chase(tgt.x, tgt.z, dt);
    }
    // auto-attack: explicit target first; otherwise anything in melee reach, or (ranged/magic) anything fighting you
    let best = tgt && Math.hypot(tgt.x - this.p.x, tgt.z - this.p.z) <= reach + tgt.def.radius ? tgt : null;
    if (!best) {
      let bd = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'rise') continue;
        const d = Math.hypot(e.x - this.p.x, e.z - this.p.z) - e.def.radius;
        const engaged = e.state === 'chase' || e.state === 'windup' || st.style === 'melee';
        if (engaged && d <= reach && d < bd) { bd = d; best = e; }
      }
    }
    if (best) {
      if (this.action?.type === 'gather') this.stopAction();
      this.combatTimer = 0;
      if (!this.moving) this.facing = Math.atan2(best.z - this.p.z, best.x - this.p.x);
      if (this.attackCd <= 0 && this.performAttack(best)) this.attackCd = st.speed;
    }
  }

  private chaseRepath = 0;
  private chase(x: number, z: number, dt: number) {
    const dx = x - this.p.x, dz = z - this.p.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return;
    if (this.walkStep(dx / d, dz / d, PLAYER_BASE.speed * dt)) { this.moving = true; return; }
    // blocked: path around the obstacle (throttled)
    if (this.time > this.chaseRepath) {
      this.chaseRepath = this.time + 0.5;
      this.path = this.world.findPath(this.p.x, this.p.z, x, z) ?? [];
    }
  }

  private stepEnemies(dt: number) {
    const px = this.p.x, pz = this.p.z;
    const playerHittable = !this.dead && !this.p.onShip;
    const inSafe = Math.hypot(px - this.layout.respawn.x, pz - this.layout.respawn.z) < SAFE_RADIUS;
    for (const e of this.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.moving = false;
      if (!e.alive) {
        if (!e.summoned && !e.def.boss && this.time >= e.respawnAt) {
          e.alive = true; e.x = e.spawnX; e.z = e.spawnZ; e.state = 'idle'; e.cd = 0; this.rollElite(e);
        }
        continue;
      }
      if (e.def.boss) { this.stepBoss(e, dt); continue; }
      const fr = e.elite === 'frenzied' ? 1.4 : 1;
      e.cd = Math.max(0, e.cd - dt * fr);
      const dP = Math.hypot(px - e.x, pz - e.z);
      const dS = Math.hypot(e.spawnX - e.x, e.spawnZ - e.z);
      const speed = e.def.speed * fr;
      switch (e.state) {
        case 'idle': {
          if (playerHittable && !inSafe && dP < e.def.aggro) { e.state = 'chase'; break; }
          e.t -= dt;
          if (e.t <= 0) {
            e.t = 2 + this.rnd() * 4;
            const a = this.rnd() * Math.PI * 2;
            e.wander = this.rnd() < 0.6 ? { x: e.spawnX + Math.cos(a) * 3, z: e.spawnZ + Math.sin(a) * 3 } : null;
          }
          if (e.wander) this.enemyMove(e, e.wander.x, e.wander.z, speed * 0.4, dt, 0.3);
          break;
        }
        case 'chase': {
          if (!playerHittable || (inSafe && !e.summoned) || (dS > 22 && !e.summoned)) { e.state = 'return'; break; }
          const atk = e.def.attack;
          if (atk.kind === 'shot') {
            if (dP < atk.keepAway) this.enemyMove(e, e.x - (px - e.x), e.z - (pz - e.z), speed * 0.8, dt, 0);
            else if (dP > atk.range * 0.9) this.enemyMove(e, px, pz, speed, dt, atk.range * 0.8);
            e.facing = Math.atan2(pz - e.z, px - e.x);
            if (dP <= atk.range && e.cd <= 0) {
              e.state = 'windup'; e.t = atk.windup / fr; e.aim = { x: px, z: pz };
              this.telegraphs.push({ id: this.nextId++, kind: 'line', x: e.x, z: e.z, r: atk.range + 2, angle: Math.atan2(pz - e.z, px - e.x), width: 0.7, t: 0, dur: atk.windup / fr, damage: 0, source: e.id });
            }
          } else {
            if (dP > atk.range + e.def.radius * 0.5) this.enemyMove(e, px, pz, speed, dt, atk.range * 0.8);
            else if (e.cd <= 0) { e.state = 'windup'; e.t = atk.windup / fr; this.emit({ type: 'enemyAttack', id: e.id }); }
            e.facing = Math.atan2(pz - e.z, px - e.x);
          }
          break;
        }
        case 'windup': {
          e.t -= dt;
          if (e.t > 0) break;
          const atk = e.def.attack;
          e.cd = atk.cooldown;
          e.state = 'chase';
          const dmg = this.enemyRoll(e);
          if (atk.kind === 'shot' && e.aim) {
            const ang = Math.atan2(e.aim.z - e.z, e.aim.x - e.x);
            this.projectiles.push({ id: this.nextId++, x: e.x, z: e.z, vx: Math.cos(ang) * 22, vz: Math.sin(ang) * 22, life: (atk.range + 2) / 22, damage: dmg, from: 'enemy' });
            this.emit({ type: 'shoot', x: e.x, z: e.z, tx: e.aim.x, tz: e.aim.z });
            e.aim = null;
          } else if (atk.kind === 'melee' && dP <= atk.range + 0.6 && playerHittable) {
            this.applyPlayerDamage(dmg);
          }
          break;
        }
        case 'return': {
          this.enemyMove(e, e.spawnX, e.spawnZ, speed, dt, 0.5);
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
          if (dS < 0.8) { e.state = 'idle'; e.hp = e.maxHp; }
          break;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || !e.summoned);
    // separation so swarms don't stack into one sprite
    const live = this.enemies.filter((e) => e.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.def.radius + b.def.radius;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2, nx = dx / d, nz = dz / d;
          if (!a.def.boss && this.world.walkable(a.x - nx * push, a.z - nz * push)) { a.x -= nx * push; a.z -= nz * push; }
          if (!b.def.boss && this.world.walkable(b.x + nx * push, b.z + nz * push)) { b.x += nx * push; b.z += nz * push; }
        }
      }
    }
  }


  private enemyMove(e: Enemy, tx: number, tz: number, speed: number, dt: number, stopAt: number) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d <= stopAt || d < 0.01) return;
    const step = Math.min(d - stopAt, speed * dt);
    const nx = dx / d, nz = dz / d;
    e.facing = Math.atan2(nz, nx);
    const tries: [number, number][] = [[nx, nz], [nx * 0.7 - nz * 0.7, nz * 0.7 + nx * 0.7], [nx * 0.7 + nz * 0.7, nz * 0.7 - nx * 0.7], [-nz, nx], [nz, -nx]];
    for (const [ux, uz] of tries) {
      const x = e.x + ux * step, z = e.z + uz * step;
      if (this.world.walkable(x, z) && this.world.ground(x, z) > 0.2) { e.x = x; e.z = z; e.moving = true; return; }
    }
  }

  // ------------------------------------------------------------------ boss: the Lockbound Guardian
  private ringBell() {
    if (count(this.p.inv, 'tuning_bell') < 1) {
      this.msg(this.questStage('bell') >= 1 ? 'A bell-shaped hollow. Iven\'s bell would fit here.' : 'A smooth hollow in the stone, shaped like a bell. Odd.');
      return;
    }
    if (this.boss) return;
    const R = this.layout.ruin;
    const def = ENEMIES.guardian;
    const e = this.spawnEnemy(def, R.x, R.z - 1.5, false);
    e.state = 'rise';
    e.t = 2.2;
    this.boss = e;
    this.bossCast = 3.5;
    this.bossSummons = 0;
    this.emit({ type: 'boss', state: 'rise' });
    this.msg('The bell sings. The stone answers. The Lockbound Guardian rises!', 'combat');
  }

  private stepBoss(e: Enemy, dt: number) {
    const R = this.layout.ruin;
    const px = this.p.x, pz = this.p.z;
    if (e.state === 'rise') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; return; }
    if (this.dead || this.p.onShip || Math.hypot(px - R.x, pz - R.z) > 24) { this.resetBoss(); return; }
    const frac = e.hp / e.maxHp;
    const enrage = frac < 0.25 ? 1.35 : 1;
    // summons at 66% and 33%
    if ((this.bossSummons === 0 && frac < 0.66) || (this.bossSummons === 1 && frac < 0.33)) {
      this.bossSummons++;
      for (let k = 0; k < 2; k++) {
        const a = (k / 2) * Math.PI * 2 + this.rnd();
        const x = R.x + Math.cos(a) * 4.5, z = R.z + Math.sin(a) * 4.5;
        const c = this.spawnEnemy(ENEMIES.reef_crab, x, z, true);
        c.state = 'chase';
      }
      this.emit({ type: 'boss', state: 'summon' });
      this.msg('The Guardian strikes its chest-bell. Crabs boil up from the stones!', 'combat');
    }
    e.cd = Math.max(0, e.cd - dt * enrage);
    this.bossCast -= dt * enrage;
    const dP = Math.hypot(px - e.x, pz - e.z);
    if (e.state === 'windup') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; return; }
    e.facing = Math.atan2(pz - e.z, px - e.x);
    // one telegraph at a time: never stack two attacks to land together
    if (this.telegraphs.some((t) => t.source === e.id)) { if (dP > 3.2) this.enemyMove(e, px, pz, e.def.speed * enrage * 0.6, dt, 3.0); return; }
    if (this.bossCast <= 0) {
      // Slam: telegraphed circle where the player stands
      this.bossCast = 7;
      this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: px, z: pz, r: 3.0, angle: 0, width: 0, t: 0, dur: 1.4 / enrage, damage: 5, source: e.id });
      e.state = 'windup'; e.t = 0.6;
      this.emit({ type: 'enemyAttack', id: e.id });
      return;
    }
    if (dP < 4.2 && e.cd <= 0) {
      // Sweep: cone in front
      e.cd = 4;
      this.telegraphs.push({ id: this.nextId++, kind: 'cone', x: e.x, z: e.z, r: 4.8, angle: e.facing, width: 1.9, t: 0, dur: 0.9 / enrage, damage: 3, source: e.id });
      e.state = 'windup'; e.t = 0.9 / enrage;
      this.emit({ type: 'enemyAttack', id: e.id });
      return;
    }
    if (dP > 3.2) this.enemyMove(e, px, pz, e.def.speed * enrage, dt, 3.0);
  }

  private resetBoss() {
    const b = this.boss;
    if (!b) return;
    b.alive = false;
    this.enemies = this.enemies.filter((e) => e !== b && !(e.summoned && e.alive));
    this.telegraphs = this.telegraphs.filter((t) => t.source !== b.id);
    this.boss = null;
    this.emit({ type: 'boss', state: 'reset' });
    this.msg('The Guardian sinks back into the stone. Ring the bell to try again.', 'combat');
  }

  private bossDefeated(e: Enemy) {
    this.boss = null;
    this.enemies = this.enemies.filter((x) => x !== e);
    for (const c of this.enemies) if (c.summoned && c.alive) { c.alive = false; this.emit({ type: 'enemyDeath', id: c.id, x: c.x, z: c.z, elite: false, boss: false }); }
    this.enemies = this.enemies.filter((x) => !x.summoned);
    this.s.flags.guardian_defeated = true;
    this.emit({ type: 'boss', state: 'defeat' });
    this.msg('The Lockbound Guardian falls apart into brass and stone!', 'good');
    if (this.questStage('bell') === 2) {
      this.dropAt(e.x, e.z, { id: 'keels_tooth', qty: 1 });
      this.setStage('bell', 3);
    }
  }

  // ------------------------------------------------------------------ projectiles + telegraphs
  private stepProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt;
      if (pr.from === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || e.state === 'rise') continue;
          if (Math.hypot(e.x - pr.x, e.z - pr.z) < e.def.radius + 0.4) { this.damageEnemy(e, pr.damage, pr.crit ?? false, pr.style ?? 'ranged', pr.knock ?? 0.2, pr.spellBase ?? 0); pr.life = 0; break; }
        }
      } else if (!this.dead && !this.p.onShip && Math.hypot(this.p.x - pr.x, this.p.z - pr.z) < 0.6) {
        this.applyPlayerDamage(pr.damage);
        pr.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
    for (const t of this.telegraphs) {
      t.t += dt;
      if (t.t < t.dur) continue;
      if (t.damage > 0 && this.insideTelegraph(t, this.p.x, this.p.z)) this.damagePlayer(t.damage);
      if (t.kind === 'circle' && t.damage > 0) this.emit({ type: 'explode', x: t.x, z: t.z, r: t.r });
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t < t.dur);
  }

  insideTelegraph(t: Telegraph, x: number, z: number) {
    const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
    if (t.kind === 'circle') return d <= t.r;
    if (d > t.r) return false;
    const rel = Math.atan2(Math.sin(Math.atan2(dz, dx) - t.angle), Math.cos(Math.atan2(dz, dx) - t.angle));
    return Math.abs(rel) <= t.width / 2;
  }

  // ------------------------------------------------------------------ movement
  private walkStep(ux: number, uz: number, dist: number): boolean {
    const p = this.p;
    const nx = p.x + ux * dist, nz = p.z + uz * dist;
    this.facing = Math.atan2(uz, ux);
    if (this.world.walkable(nx, nz)) { p.x = nx; p.z = nz; return true; }
    if (Math.abs(ux) > 0.05 && this.world.walkable(p.x + ux * dist, p.z)) { p.x += ux * dist; return true; }
    if (Math.abs(uz) > 0.05 && this.world.walkable(p.x, p.z + uz * dist)) { p.z += uz * dist; return true; }
    return false;
  }

  private stepFoot(dt: number) {
    const m = Math.hypot(this.moveDir.x, this.moveDir.z);
    this.moving = false;
    if (this.rollT > 0) {
      this.rollT = Math.max(0, this.rollT - dt);
      this.walkStep(this.rollDir.x, this.rollDir.z, PLAYER_BASE.rollSpeed * dt);
      this.moving = true;
      return;
    }
    if (m > 0.05) {
      this.moving = this.walkStep(this.moveDir.x / m, this.moveDir.z / m, PLAYER_BASE.speed * Math.min(1, m) * dt);
    } else if (this.path.length) {
      let budget = PLAYER_BASE.speed * dt;
      while (budget > 0 && this.path.length) {
        const [tx, tz] = this.path[0];
        const dx = tx - this.p.x, dz = tz - this.p.z, d = Math.hypot(dx, dz);
        if (d <= budget) {
          this.p.x = tx; this.p.z = tz; budget -= d; this.path.shift();
          if (d > 0.01) this.facing = Math.atan2(dz, dx);
        } else {
          this.p.x += (dx / d) * budget; this.p.z += (dz / d) * budget; this.facing = Math.atan2(dz, dx); budget = 0;
        }
        this.moving = true;
      }
      if (!this.path.length && this.pending) {
        const t = this.targets().find((x) => x.key === this.pending);
        this.pending = null;
        if (t && Math.hypot(t.x - this.p.x, t.z - this.p.z) <= t.range + 0.4) this.perform(t);
      }
    }
  }

  private stepDrops(dt: number) {
    if (this.dead || this.p.onShip) { for (const d of this.drops) d.t += dt; return; }
    for (const d of this.drops) {
      d.t += dt;
      if (d.t < 0.6) continue;
      const dx = this.p.x - d.x, dz = this.p.z - d.z, dist = Math.hypot(dx, dz);
      if (dist < 3 && dist > 0.01) { d.x += (dx / dist) * Math.min(dist, 6 * dt); d.z += (dz / dist) * Math.min(dist, 6 * dt); }
      if (dist < 0.8) {
        if (!canAdd(this.p.inv, d.stack.id)) {
          if (this.time - this.fullWarned > 4) { this.fullWarned = this.time; this.msg('Your pack is full.', 'warn'); }
          continue;
        }
        add(this.p.inv, d.stack);
        this.emit({ type: 'pickup', x: d.x, z: d.z, tint: item(d.stack.id).quest ? 'quest' : d.stack.inst?.rarity ?? 'common' });
        this.emit({ type: 'gain', id: d.stack.id, qty: d.stack.qty, name: displayName(d.stack) });
        if (d.stack.inst && d.stack.inst.rarity !== 'common') this.msg(`You found: ${displayName(d.stack)}`, 'loot');
        d.t = -999;
        this.rev++;
      }
    }
    this.drops = this.drops.filter((d) => d.t > -900 && d.t < 300);
  }

  private stepDiscovery() {
    for (const pl of PLACES) {
      if (this.s.discovered.includes(pl.id)) continue;
      if (!!pl.sea !== this.p.onShip && pl.sea) continue;
      if (Math.hypot(pl.x - this.p.x, pl.z - this.p.z) < pl.r) {
        this.s.discovered.push(pl.id);
        this.emit({ type: 'discover', id: pl.id, name: pl.name });
        this.msg(`Discovered: ${pl.name}`, 'quest');
        this.rev++;
      }
    }
  }

  // ------------------------------------------------------------------ main step
  step(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.s.playTime += dt;
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.eatCd = Math.max(0, this.eatCd - dt);
    this.combatTimer += dt;
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) this.respawnPlayer();
    } else {
      if (this.p.onShip) this.stepShip(dt);
      else this.stepFoot(dt);
      if (this.action?.type === 'gather') this.tickGather(this.action);
      else if (this.action?.type === 'craft') this.tickCraft(this.action);
      this.stepPlayerCombat(dt);
      // regeneration out of combat (RuneScape-slow, but not a minute per point)
      this.regenTimer += dt;
      if (this.regenTimer >= PLAYER_BASE.regenEvery) {
        this.regenTimer = 0;
        const amt = (this.combatTimer > 6 ? 1 : 0) + (this.rnd() < this.stats.regen * PLAYER_BASE.regenEvery / 10 ? 1 : 0);
        if (amt > 0 && this.p.hp < this.stats.maxHp) this.p.hp = Math.min(this.stats.maxHp, this.p.hp + amt);
      }
      this.stepDiscovery();
    }
    this.stepEnemies(dt);
    this.stepProjectiles(dt);
    this.stepDrops(dt);
    for (const n of this.nodes) if (n.depletedUntil && n.depletedUntil <= this.time) { n.depletedUntil = 0; this.rev++; }
  }

  /** Snapshot of persistent state, ready for JSON. */
  serialize(): SaveData {
    const d = structuredClone(this.s);
    d.version = SAVE_VERSION;
    d.savedAt = Date.now();
    if (this.dead) { d.player.x = this.layout.respawn.x; d.player.z = this.layout.respawn.z; d.player.hp = this.stats.maxHp; }
    d.player.hp = Math.max(1, Math.round(d.player.hp));
    return d;
  }
}
