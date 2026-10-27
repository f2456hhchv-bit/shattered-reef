import { StormTide } from './stormtide';
import { GreenheartFire } from './greenfire';
import { AmberSeep } from './amberseep';
import { TreasureHunt } from './treasure';
import { BellTime } from './belltime';
import { COLLECTIBLE } from '../data/collection';
import { Bottles } from './bottles';
import { Regatta } from './regatta';
import { FEATS, FEAT_BY, FEAT_TIERS } from '../data/feats';
import { Naval } from './naval';
import { AMMO, NAVAL } from '../data/sea';
import { SHIPYARD, type ShipPart } from '../data/shipyard';
import { ACTIVE, MOMENTS, type MomentKind, type Struck } from '../data/active';
import { mulberry32 } from '../../art/noise';
import { item, MEAL_TEXT, ammoKind, AMMO_NAME, isTwoHanded, offhandBlock, pairGroup, type ItemDef, type Slot, type SkillId, type CombatStyle } from '../data/items';
import { perkTotal } from '../data/perks';
import { KEY, KEYS, KEY_CONFIG, type KeyDef, type KeyFamily } from '../data/keys';
import { DROP_CONFIG, GEMS, rareTable, commonTable } from '../data/drops';
import { BOARDS, BOUNTY_CONFIG, CREW_BY, WANTED_FIRST, WANTED_LAST, rankOf, type Contract, type CrewPassive } from '../data/bounties';
import { HP_SCALE, NODES, RECIPES, ENEMIES, LOOT, ELITE_AFFIXES, SHOPS, PLAYER_BASE, UTILITY_SPELLS, SPELLS, COMBAT_SKILLS, XP_PER_DAMAGE, type EnemyDef, type Recipe, type Station } from '../data/content';
import { type React, NPCS, QUESTS, type DialogueNode, type Effect, type QuestMark } from '../data/quests';
import { DIARIES, diaryDone } from '../data/diaries';
import { LORE, LORE_BY_ID, KEEL_PAGES } from '../data/lore';
import { DOORS, DOOR_BY_ID } from '../data/doors';
import { PLACES, placeRegion } from '../world/places';
import { regionLayout, cachedLayout, type IslandLayout, type Arena } from '../world/layout';
import { REGIONS, edgeCrossed, arrival, type RegionId } from '../world/regions';
import type { World } from '../world/world';
import { add, canAdd, count, remove, displayName, stackValue, wears, condOf, sortInventory, WORN_OUT_EFFECT, type Stack, type SortMode } from './inventory';
import { computeStats, makeInstance, rollRarity, hitChance, reqBlock, type PlayerStats, type Stance } from './gear';
import { levelForXp, MAX_XP } from './xp';
import { defaultSave, SAVE_VERSION, BANK_MAX, type SaveData } from './save';

/** Worn armour that takes wear when you're hit (the off-hand only when it's a shield). */
const ARMOUR_SLOTS: Slot[] = ['head', 'body', 'legs', 'feet', 'hands', 'offhand'];

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
  | { type: 'teleport'; fromX: number; fromZ: number; x: number; z: number }
  | { type: 'alchemy' }
  | { type: 'keyFound'; id: string }
  | { type: 'sigDrop'; id: string }
  | { type: 'openBoard'; board: string }
  | { type: 'rank'; bounty: number; rank: string }
  | { type: 'hunters'; x: number; z: number }
  | { type: 'mateAttack'; x: number; z: number; tx: number; tz: number; style: CombatStyle }
  | { type: 'keyTurn'; x: number; z: number; power: string }
  | { type: 'ferryOffer'; npc: string; to: string; price: number }
  | { type: 'cue'; perfect: boolean; text: string }
  | { type: 'navalFire'; kind: 'broadside' | 'charge'; side?: 1 | -1 }
  | { type: 'roll' }
  | { type: 'dodge'; x: number; z: number }
  | { type: 'shoot'; x: number; z: number; tx: number; tz: number }
  | { type: 'enemyAttack'; id: number }
  | { type: 'enemyDeath'; id: number; x: number; z: number; elite: boolean; boss: boolean }
  | { type: 'playerDeath' }
  | { type: 'gatherFx'; kind: 'wood' | 'stone' | 'water'; x: number; z: number; success: boolean }
  | { type: 'craftFx'; station: Station }
  | { type: 'dialog'; npc: string; lines: string[] }
  | { type: 'read'; title: string; sub: string; lines: string[] }
  /** a big moment worth a banner across the screen (bell-time) */
  | { type: 'banner'; title: string; sub: string }
  | { type: 'openStation'; station: Station }
  | { type: 'openShop'; shop: string }
  | { type: 'openBank' }
  | { type: 'quest'; id: string; stage: number }
  | { type: 'boss'; state: 'rise' | 'defeat' | 'reset' | 'summon'; /** the banner when it's beaten */ name?: string; sub?: string }
  | { type: 'weather'; kind: 'gale' | 'fog' | 'thunder' | null }
  | { type: 'board' }
  | { type: 'disembark' }
  | { type: 'discover'; id: string; name: string }
  | { type: 'explode'; x: number; z: number; r: number }
  /** leaving for another region: the UI shows its loading screen, then calls finishTravel() */
  | { type: 'travel'; to: RegionId; name: string; tip: string }
  /** the new region is loaded and the player is in it */
  | { type: 'region'; region: RegionId };

/** `left`: items it will give before it runs out (rolled each time it grows back). */
export interface NodeRt { uid: string; def: string; x: number; z: number; seed: number; depletedUntil: number; left: number; scenery?: boolean }

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
  /** key powers on this foe: seconds left of each, and marked hits left */
  fx: { root: number; disarm: number; slow: number; shatter: number; lesson: number; marks: number;
    weak: number; ward: number; spoil: number; fuse: number; turn: number; bite: number; picked: boolean; spoilAcc: number };
  /** a one-off foe (a wanted target, a bounty hunter): drops loot, never respawns */
  once?: boolean;
  /** a wanted target: its name and the contract it belongs to */
  named?: string;
  contract?: number;
}

/** Your first mate, ashore with you. */
export interface Mate { id: string; x: number; z: number; facing: number; cd: number; moving: boolean }


export interface Drop { id: number; x: number; z: number; stack: Stack; t: number; home?: boolean } // home: loot from your kill, flies to you
export interface Projectile { id: number; x: number; z: number; vx: number; vz: number; life: number; damage: number; from: 'player' | 'enemy'; kind?: 'shot' | 'magic' | 'arrow'; crit?: boolean; style?: CombatStyle; spellBase?: number; knock?: number }
export interface Telegraph { id: number; kind: 'circle' | 'cone' | 'line'; x: number; z: number; r: number; angle: number; width: number; t: number; dur: number; damage: number; source: number }

type Action =
  // progress: 0..1 toward the next item; fill: what this swing adds (rolled when it starts, so the game knows which swing lands)
  | { type: 'gather'; node: string; next: number; progress: number; from: number; fill?: number; struck?: Struck }
  | { type: 'craft'; recipe: string; remaining: number; next: number; from: number; struck?: Struck } // from: this cycle's start (active skilling)
  | null;

/** How a trip to another region ends: where the player (and maybe the ship) comes out. */
export type Travel = { to: RegionId; how: 'sail' | 'ferry' | 'portal' | 'home' | 'respawn'; along?: number; from: RegionId };

export interface Target { key: string; kind: 'node' | 'npc' | 'station' | 'bank' | 'ship' | 'arena' | 'portal' | 'enemy' | 'drop' | 'mooring' | 'quest' | 'event' | 'lore' | 'door'; x: number; z: number; range: number; label: string; verb: string }

// RuneScape's 4-tick rhythm for gathering; production a little quicker.
const DT_GATHER = 2.4;
const DT_CRAFT = 1.8;
const SAFE_RADIUS = 16;
/** Condition lost per use: ~1000 swings, ~1250 hits taken, ~2000 gathers from new to worn out. */
const WEAR = { weapon: 0.1, armour: 0.08, tool: 0.05 };
/** Rare finds from the gathering perks. */
const FINDS: Partial<Record<SkillId, string>> = { woodcutting: 'bird_nest', mining: 'geode', fishing: 'casket', sailing: 'casket' };

export const STATION_NAMES: Record<Station, string> = { furnace: 'Furnace', anvil: 'Anvil', fire: 'Cookfire', bench: 'Workbench', vent: 'Vent forge' };

export class Game {
  layout: IslandLayout;
  world: World;
  /** a trip under way (the loading screen is up); the world doesn't step until it's finished */
  travelling: Travel | null = null;
  /** true when a UI shows a loading screen between regions and calls finishTravel(); headless, trips finish at once */
  deferTravel = false;
  s: SaveData;
  rnd: () => number;
  /** key finds roll on their own stream, so adding them never reshuffles fights or gathering */
  private keyRnd: () => number;
  /** bounty boards roll on their own stream too */
  private boardRnd: () => number;
  /** your first mate, when ashore */
  mate: Mate | null = null;
  time = 0;
  /** increments on any change the UI should redraw (inventory, skills, quests, equipment) */
  rev = 0;

  // runtime
  nodes: NodeRt[];
  enemies: Enemy[] = [];
  drops: Drop[] = [];
  projectiles: Projectile[] = [];
  telegraphs: Telegraph[] = [];
  nextId = 1;
  /** the fight and the work at sea (naval.ts) */
  naval: Naval = new Naval(this);
  /** Bellwether's skilling boss on the quay (stormtide.ts) */
  storm: StormTide = new StormTide(this);
  fire: GreenheartFire = new GreenheartFire(this);
  seep: AmberSeep = new AmberSeep(this);
  treasure: TreasureHunt = new TreasureHunt(this);
  belltime!: BellTime;
  bottles!: Bottles;
  regatta!: Regatta;
  private listeners: ((e: GameEvent) => void)[] = [];

  // player runtime
  facing = Math.PI / 2;
  moveDir = { x: 0, z: 0 };
  path: [number, number][] = [];
  pending: string | null = null; // interaction to perform on arrival
  action: Action = null;
  /** a gathering moment in progress (data/active.ts MOMENTS): the swing waits on it */
  moment: { kind: MomentKind; node: string; from: number; step: number; struck?: Struck } | null = null;
  attackCd = 0;
  specialCd = 0;
  /** seconds until the slotted key's power can be turned again */
  keyCd = 0;
  /** an elite's power taken with the Skeleton Key */
  stolen: { affix: string; t: number } | null = null;
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
  shipTarget: { x: number; z: number } | null = null; // current waypoint
  shipRoute: [number, number][] = []; // waypoints after the current one
  private shoalWarned = 0;

  // boss
  boss: Enemy | null = null;
  /** the arena fight in progress, for feats: when it rose, food eaten, marked attacks that caught you */
  fight: { boss: string; start: number; ate: number; caught: number } | null = null;
  bossArena: Arena | null = null;
  bossCast = 0;
  bossSummons = 0;

  constructor(opts: { seed?: number; save?: SaveData | null } = {}) {
    this.rnd = mulberry32(opts.seed ?? (Date.now() & 0xffffffff));
    this.keyRnd = mulberry32(((opts.seed ?? Date.now()) ^ 0x6b657973) >>> 0);
    this.boardRnd = mulberry32(((opts.seed ?? Date.now()) ^ 0x626f6172) >>> 0);
    const home = regionLayout('bellwether');
    this.s = opts.save ?? defaultSave(home.respawn, home.mooring!);
    // the collection log starts with what you already own (saves from before the log existed)
    if (!this.s.collected) this.s.collected = [...new Set([...this.s.player.inv, ...Object.values(this.s.player.equip), ...this.s.bank].filter((x): x is Stack => !!x).map((x) => x.id).filter((id) => COLLECTIBLE.has(id)))];
    if (this.s.flags.bell_done && !this.s.keyring.includes('keels_tooth')) this.s.keyring.push('keels_tooth'); // finished the bell quest before keys
    // layouts are read-only after their build, so every Game shares them (a build takes up to ~0.6 s)
    this.layout = regionLayout(this.s.region);
    this.world = this.layout.world;
    this.nodes = [];
    this.recalc();
    this.enterRegion();
    this.s.player.hp = Math.min(this.s.player.hp, this.stats.maxHp);
  }

  get region() { return REGIONS[this.s.region]; }
  /** Your ship is moored or sailing in the region you're in. */
  get shipHere() { return this.ship.region === this.s.region; }

  /** Fresh runtime state for the region just loaded: its nodes and foes, a valid place to stand. */
  private enterRegion() {
    (this.belltime ??= new BellTime(this)).enterRegion();
    (this.bottles ??= new Bottles(this)).enterRegion();
    (this.regatta ??= new Regatta(this)).enterRegion();
    this.nodes = this.layout.nodes.map((n) => ({ ...n, depletedUntil: 0, left: this.rollYield(n.def) }));
    // only a few dig spots are disturbed at any time; the rest surface later
    for (const n of this.nodes) if (NODES[n.def].verb === 'Dig' && this.rnd() < 0.75) n.depletedUntil = this.rnd() * NODES[n.def].respawn;
    for (const n of this.nodes) if (n.def === 'spot_storm' && !this.storm?.running) n.depletedUntil = Infinity; // the storm's shoals only run in the storm
    for (const n of this.nodes) if (n.def === 'bamboo_fire' && !this.fire?.running) n.depletedUntil = Infinity; // and the fire camp's bamboo only in the fire
    for (const n of this.nodes) if (n.def === 'amber_seep' && !this.seep?.running) n.depletedUntil = Infinity; // the amber seams only while the hill is open
    this.enemies = []; this.drops = []; this.projectiles = []; this.telegraphs = []; this.mate = null;
    this.boss = null; this.bossArena = null;
    for (const sp of this.layout.spawns) this.spawnEnemy(ENEMIES[sp.enemy], sp.x, sp.z, false);
    this.path = []; this.pending = null; this.target = null; this.action = null; this.shipTarget = null; this.shipRoute = [];
    if (this.shipHere && this.layout.mooring && !this.world.sailable(this.s.ship.x, this.s.ship.z)) Object.assign(this.s.ship, this.layout.mooring);
    if (!this.shipHere || !this.layout.mooring) this.s.player.onShip = false;
    this.naval.enterRegion();
    if (this.s.player.onShip) { this.s.player.x = this.s.ship.x; this.s.player.z = this.s.ship.z; }
    else if (!this.world.walkable(this.s.player.x, this.s.player.z)) {
      const q = this.world.nearestWalkable(this.s.player.x, this.s.player.z, 3);
      [this.s.player.x, this.s.player.z] = q ?? [this.layout.respawn.x, this.layout.respawn.z];
    }
  }

  /** How many items a fresh tree, rock or bush gives before it runs out (Tom: sometimes 5, sometimes 2 or 3). */
  private rollYield(def: string) {
    const y = NODES[def].yield;
    return y ? y[0] + Math.floor(this.rnd() * (y[1] - y[0] + 1)) : Infinity;
  }

  /** Start a trip to another region. With a UI (deferTravel) the loading screen comes up first. */
  travel(t: Travel) {
    if (this.travelling) return;
    this.stopAction();
    this.path = []; this.pending = null; this.target = null; this.shipTarget = null; this.shipRoute = []; this.shipSpeed = 0;
    this.travelling = t;
    const r = REGIONS[t.to];
    this.emit({ type: 'travel', to: t.to, name: r.name, tip: r.tip });
    if (!this.deferTravel) this.finishTravel();
  }

  /** Load the destination and put the player (and ship) there. Slow (the region's first build): call it under a loading screen. */
  finishTravel() {
    const t = this.travelling;
    if (!t) return;
    const from = this.layout;
    this.layout = regionLayout(t.to);
    this.world = this.layout.world;
    this.s.region = t.to;
    const L = this.layout, p = this.p;
    if (t.how === 'sail') {
      const a = arrival(REGIONS[t.to], t.from, t.along ?? 0);
      const q = this.nearestSea(a.x, a.z) ?? [a.x, a.z];
      Object.assign(this.ship, { x: q[0], z: q[1], heading: a.heading, region: t.to });
      p.onShip = true;
    } else if (t.how === 'ferry' && L.port) {
      Object.assign(this.ship, { ...L.port.ship, region: t.to });
      p.onShip = false; p.x = L.port.land.x; p.z = L.port.land.z;
    } else if (t.how === 'portal') {
      // come out beside the way back to where you were
      const back = L.portals.find((pt) => pt.to === from.region) ?? L.portals[0];
      p.onShip = false;
      [p.x, p.z] = back ? [back.out.x, back.out.z] : [L.respawn.x, L.respawn.z];
    } else {
      p.onShip = false; p.x = L.respawn.x; p.z = L.respawn.z;
    }
    this.travelling = null;
    this.enterRegion();
    this.emit({ type: 'region', region: t.to });
    if (t.how !== 'respawn') this.msg(t.how === 'sail' ? `You sail into the waters of ${this.region.name}.` : `You arrive: ${this.region.name}.`, 'quest');
    this.rev++;
  }

  nearestSea(x: number, z: number): [number, number] | null {
    for (let r = 0; r <= 30; r += 2) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.world.seaClear(px, pz)) return [px, pz];
      if (r === 0) break;
    }
    return null;
  }

  // ------------------------------------------------------------------ events
  on(fn: (e: GameEvent) => void) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit(e: GameEvent) { for (const f of this.listeners) f(e); }
  msg(text: string, kind: MsgKind = 'info') { this.emit({ type: 'msg', text, kind }); }

  get p() { return this.s.player; }
  get ship() { return this.s.ship; }
  level(skill: SkillId) { return levelForXp(this.p.xp[skill]); }
  recalc() {
    const st = computeStats(this.p.xp, this.p.equip, this.s.combat.stance, this.s.combat.spell, this.activeKey());
    // your crew's passives (every recruit counts, ashore or aboard)
    st.healBonus += this.crewV('heal') / 100;
    st.gather += this.crewV('gather') / 100;
    st.maxHp = Math.round(st.maxHp * (1 + this.crewV('max_hp') / 100));
    if (st.style === 'ranged') st.maxHit = Math.floor(st.maxHit * (1 + this.crewV('ranged_dmg') / 100));
    if (st.style === 'melee') st.maxHit = Math.floor(st.maxHit * (1 + this.crewV('melee_dmg') / 100)); // Halvdan Ninefold
    const kp = this.activeKey()?.passive;
    if (kp?.kind === 'cook') st.healBonus += kp.v / 100;
    if (kp?.kind === 'dr') st.dr += kp.v / 100;
    if (kp?.kind === 'ammo_save') st.ammoSave += kp.v / 100;
    if ((kp?.kind === 'melee_dmg' && st.style === 'melee') || (kp?.kind === 'magic_dmg' && st.style === 'magic')) st.maxHit = Math.floor(st.maxHit * (1 + kp.v / 100));
    // Steal: an elite's power for a while
    if (this.stolen?.affix === 'barnacled') st.dr += 0.33;
    if (this.stolen?.affix === 'frenzied') st.speed /= 1.4;
    // feats: the edges your points have earned
    for (const t of this.featTiers()) { st.eliteDmg += t.eliteDmg; st.healBonus += t.healBonus; }
    // a galley meal, while it lasts
    const meal = this.s.meal && this.s.meal.left > 0 ? item(this.s.meal.id).meal : undefined;
    if (meal?.kind === 'maxhit') st.maxHit = Math.floor(st.maxHit * (1 + meal.v / 100));
    if (meal?.kind === 'acc') st.attRoll = Math.floor(st.attRoll * (1 + meal.v / 100));
    if (meal?.kind === 'dr') st.dr += meal.v / 100;
    if (meal?.kind === 'gather') st.gather += meal.v / 100;
    if (meal?.kind === 'regen') st.regen += meal.v;
    this.stats = st;
    this.rev++;
  }
  /** Sum of a crew passive over everyone you've signed. */
  /** The shipwright (data/shipyard.ts): your ship's refit of each part, its bonus, and why the next can't be done. */
  shipTier(part: ShipPart) { return this.s.shipyard?.[part] ?? 0; }
  shipBonus(part: ShipPart) { const t = this.shipTier(part); return t ? SHIPYARD[part].tiers[t - 1].v : 0; }
  refitBlock(part: ShipPart): string | null {
    const next = SHIPYARD[part].tiers[this.shipTier(part)];
    if (!next) return 'Fully refitted';
    if (this.level('sailing') < next.sailing) return `Needs Sailing ${next.sailing}`;
    if (count(this.p.inv, 'coins') < next.coins) return `Needs ${next.coins.toLocaleString('en-GB')} coins`;
    for (const i of next.items) if (count(this.p.inv, i.id) < i.qty) return `Needs ${i.qty} × ${item(i.id).name}`;
    return null;
  }
  refit(part: ShipPart) {
    const block = this.refitBlock(part);
    if (block) { this.msg(`${block}.`, 'warn'); return false; }
    const t = this.shipTier(part), next = SHIPYARD[part].tiers[t];
    remove(this.p.inv, 'coins', next.coins);
    for (const i of next.items) remove(this.p.inv, i.id, i.qty); // validated above: all-or-nothing
    this.s.shipyard = { ...(this.s.shipyard ?? {}), [part]: t + 1 };
    if (part === 'hull') this.naval.hull = this.naval.hullMax();
    this.msg(`The shipwrights fit your ${SHIPYARD[part].name.toLowerCase()}: ${next.name}: ${SHIPYARD[part].what}.`, 'good');
    this.rev++;
    return true;
  }
  crewV(kind: CrewPassive) { return (this.s.crew ?? []).reduce((a, id) => a + (CREW_BY[id]?.passive.kind === kind ? CREW_BY[id].passive.v : 0), 0); }

  // ------------------------------------------------------------------ xp + items
  addXp(skill: SkillId, amount: number) {
    const keyXp = !COMBAT_SKILLS.includes(skill) && this.activeKey()?.passive.kind === 'skill_xp' ? this.activeKey()!.passive.v / 100 : 0;
    const amt = Math.round(amount * (1 + (COMBAT_SKILLS.includes(skill) ? 0 : this.stats.xpBonus) + keyXp + (skill === 'sailing' ? this.crewV('sailing_xp') / 100 : 0) + perkTotal(skill, this.level(skill), 'xp') / 100) * 10) / 10; // Bastian Gull: +10% Sailing
    if (amt <= 0) return;
    const before = this.level(skill);
    this.p.xp[skill] = Math.min(MAX_XP, this.p.xp[skill] + amt);
    const after = this.level(skill);
    this.emit({ type: 'xp', skill, amount: amt });
    if (after > before) {
      this.emit({ type: 'level', skill, level: after });
      // RuneScape's own words
      this.msg(`Congratulations, you've just advanced ${/^[aeiou]/.test(skill) ? 'an' : 'a'} ${skill[0].toUpperCase()}${skill.slice(1)} level. You are now level ${after}.`, 'good');
      if (COMBAT_SKILLS.includes(skill)) { this.recalc(); if (skill === 'hitpoints') this.p.hp = Math.min(this.stats.maxHp, this.p.hp + (after - before) * HP_SCALE); }
    }
    this.rev++;
  }

  /** The collection log: a notable item's first time in your pack. */
  collect(id: string) {
    if (!COLLECTIBLE.has(id) || (this.s.collected ?? []).includes(id)) return;
    this.s.collected = [...(this.s.collected ?? []), id];
    this.msg(`New collection log entry: ${item(id).name}.`, 'loot');
  }

  give(id: string, qty: number, inst?: Stack['inst']): boolean {
    const left = add(this.p.inv, { id, qty, inst });
    this.rev++;
    if (left < qty) this.collect(id);
    if (left < qty) this.emit({ type: 'gain', id, qty: qty - left, name: inst ? displayName({ id, qty: 1, inst }) : item(id).name });
    if (left > 0) {
      this.dropAt(this.p.x, this.p.z, { id, qty: left, inst });
      this.msg('Your pack is full. It dropped at your feet.', 'warn');
      return false;
    }
    return true;
  }

  private uid() { return this.s.nextUid++; }

  /** Tidy the pack: by type (tools first, food best-first, materials grouped), by value, or by quality. */
  sortPack(mode: SortMode) { sortInventory(this.p.inv, mode); this.rev++; }

  /** Best usable tool for a skill; `only` restricts to one item (fishing spots need a specific tool). */
  bestTool(skill: SkillId, only?: string) {
    let best: { id: string; power: number } | null = null;
    const lvl = this.level(skill);
    for (const st of this.p.inv) {
      const t = st && item(st.id).tool;
      if (only && st?.id !== only) continue;
      const power = t ? t.power - (condOf(st) <= 0 ? 1 : 0) : 0; // a worn-out tool works like the tier below
      if (t && t.skill === skill && t.level <= lvl && (!best || power > best.power)) best = { id: st!.id, power };
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
      out.push({ key: `node:${n.uid}`, kind: 'node', x: n.x, z: n.z, range: this.nodeReach(d), label: d.name, verb: d.verb });
    }
    out.push(...this.treasure.targets());
    out.push(...this.belltime.targets());
    out.push(...this.regatta.targets());
    if (onShip) for (const m of this.questMarks()) if (m.mark.fromShip) out.push({ key: `quest:${m.quest}:${m.mark.id}`, kind: 'quest', x: m.mark.x, z: m.mark.z, range: 6, label: m.mark.label, verb: m.mark.verb });
    if (!onShip) {
      for (const n of this.layout.npcs) if (!this.npcGone(n.id)) out.push({ key: `npc:${n.id}`, kind: 'npc', x: n.x, z: n.z, range: 2.2, label: NPCS[n.id].name, verb: NPCS[n.id].shop ? 'Trade' : NPCS[n.id].bank ? 'Bank' : NPCS[n.id].ferry ? 'Travel' : 'Talk' });
      this.layout.stations.forEach((st, i) => out.push({ key: `station:${i}`, kind: 'station', x: st.x, z: st.z, range: 2.3, label: STATION_NAMES[st.id], verb: st.id === 'fire' ? 'Cook' : st.id === 'furnace' || st.id === 'vent' ? 'Smelt' : st.id === 'bench' ? 'Craft' : 'Forge' }));
      this.layout.banks.forEach((b, i) => out.push({ key: `bank:${i}`, kind: 'bank', x: b.x, z: b.z, range: 2.2, label: b.booth ? 'Bank counter' : 'Strongbox', verb: b.booth ? 'Bank' : 'Open' }));
      if (this.shipHere) out.push({ key: 'ship', kind: 'ship', x: this.ship.x, z: this.ship.z, range: 4.2, label: 'Your sloop', verb: 'Board' });
      this.layout.arenas.forEach((a, i) => out.push({ key: `arena:${i}`, kind: 'arena', x: a.altar.x, z: a.altar.z, range: 2.2, label: a.label, verb: a.verb }));
      this.layout.portals.forEach((pt, i) => out.push({ key: `portal:${i}`, kind: 'portal', x: pt.x, z: pt.z, range: 2.6, label: pt.label, verb: pt.verb }));
      const mo = this.layout.mooring, d = this.layout.dock;
      if (mo && d && (!this.shipHere || Math.hypot(this.ship.x - mo.x, this.ship.z - mo.z) > 6)) {
        out.push({ key: 'mooring', kind: 'mooring', x: d.x + 3, z: d.headZ + 1.6, range: 2.4, label: 'Mooring bell', verb: 'Call ship' });
      }
      for (const e of this.enemies) if (e.alive && e.state !== 'rise') out.push({ key: `enemy:${e.id}`, kind: 'enemy', x: e.x, z: e.z, range: 1.6 + e.def.radius, label: this.enemyName(e), verb: 'Attack' });
      for (const d of DOORS) if (d.region === this.s.region) out.push({ key: `door:${d.id}`, kind: 'door', x: d.x, z: d.z, range: 2.2, label: this.s.flags[`door_${d.id}`] ? `${d.label} (open)` : d.label, verb: this.s.flags[`door_${d.id}`] ? 'Look in' : 'Try the lock' });
      for (const l of LORE) if (l.region === this.s.region) out.push({ key: `lore:${l.id}`, kind: 'lore', x: l.x, z: l.z, range: 2.2, label: l.label, verb: l.verb });
      for (const m of this.questMarks()) if (!m.mark.fromShip) out.push({ key: `quest:${m.quest}:${m.mark.id}`, kind: 'quest', x: m.mark.x, z: m.mark.z, range: 2.2, label: m.mark.label, verb: m.mark.verb });
      out.push(...this.storm.targets(), ...this.fire.targets(), ...this.seep.targets());
    }
    return out;
  }

  /** What a place offers: the level range of its foes and what can be gathered there (for banners and the Places list). */
  /** Null when the place's region hasn't been loaded this session (its layout isn't built yet). */
  placeInfo(id: string): { foes: [number, number] | null; gather: { name: string; level: number }[] } | null {
    const pl = PLACES.find((p) => p.id === id);
    if (!pl) return null;
    const near = (x: number, z: number) => Math.hypot(x - pl.x, z - pl.z) < pl.r + 8;
    const L = cachedLayout(placeRegion(pl));
    if (!L) return null;
    const lv = L.spawns.filter((s) => near(s.x, s.z)).map((s) => ENEMIES[s.enemy].level);
    for (const a of L.arenas) if (near(a.x, a.z)) lv.push(ENEMIES[a.boss].level); // the arena's guardian
    const seen = new Set<string>();
    const gather = L.nodes.filter((n) => near(n.x, n.z) && !seen.has(n.def) && seen.add(n.def)).map((n) => ({ name: NODES[n.def].name, level: NODES[n.def].level })).sort((a, b) => a.level - b.level);
    return { foes: lv.length ? [Math.min(...lv), Math.max(...lv)] : null, gather };
  }

  /** What it takes to use a target, for hover pop-ups: e.g. "Woodcutting 15" (met or not), "Needs a spade". */
  targetNeeds(t: Target): { text: string; ok: boolean; detail?: string } | null {
    if (t.kind === 'node') {
      const d = NODES[this.nodes.find((n) => `node:${n.uid}` === t.key)?.def ?? ''];
      if (!d) return null;
      const skill = d.skill ? `${d.skill[0].toUpperCase()}${d.skill.slice(1)} ${d.level}` : 'Anyone can';
      // what it gives: the item (or loot), its XP, and where it's worked from
      const gives = d.loot ? 'Treasure' : d.catches ? d.catches.map((c) => `${item(c.item).name.replace(/^Raw /, '')} ${c.level}${this.level('fishing') < c.level ? ' 🔒' : ''}`).join(', ')
        : d.drops ? d.drops.map((x) => item(x.item).name).join(' or ') : item(d.item).name;
      const detail = `${gives}${d.xp ? ` · ${d.xp} xp` : ''}${d.fromShip ? ' · from your ship' : ''}`;
      if (d.skill && this.level(d.skill) < d.level) return { text: `Needs ${skill} (you have ${this.level(d.skill)})`, ok: false, detail };
      if (!this.gatherTool(d)) return { text: `${skill} · needs ${d.tool ? `a ${item(d.tool).name.toLowerCase()}` : d.skill === 'woodcutting' ? 'a hatchet' : 'a pickaxe'}`, ok: false, detail };
      return { text: `${skill} ✓`, ok: true, detail };
    }
    if (t.kind === 'enemy') {
      const e = this.enemies.find((x) => `enemy:${x.id}` === t.key);
      if (!e) return null;
      const diff = e.def.level - this.stats.combatLevel;
      return { text: `Level ${e.def.level}${e.def.hostile ? ' · attacks on sight' : ''}${diff > 10 ? ' · very dangerous' : diff > 3 ? ' · dangerous' : ''}`, ok: diff <= 3 };
    }
    return null;
  }

  enemyName(e: Enemy) {
    if (e.named) return `${e.named} (wanted)`;
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
      this.shipRoute = [];
      if (this.action) this.stopAction();
      this.target = null;
    }
  }

  moveTo(x: number, z: number) {
    if (this.dead) return;
    if (this.action) this.stopAction();
    this.pending = null;
    this.target = null;
    if (this.p.onShip) { this.sailTo(x, z); return; }
    this.path = this.world.findPath(this.p.x, this.p.z, x, z) ?? [];
    if (!this.path.length) this.msg('You can\'t reach that.', 'warn');
  }

  /** Walk to (or sail to) a target and use it. `quiet`: no "can't reach" message; returns whether it's under way. */
  interact(key: string, quiet = false): boolean {
    if (this.dead) return false;
    if (key === 'disembark') { this.disembark(); return true; }
    const t = this.targets().find((x) => x.key === key);
    if (!t) return false;
    if (this.action) this.stopAction();
    if (t.kind === 'enemy') { this.target = Number(key.split(':')[1]); this.pending = null; this.path = []; return true; }
    this.target = null;
    if (Math.hypot(t.x - this.p.x, t.z - this.p.z) <= t.range) { this.perform(t); return true; }
    if (this.p.onShip) { this.sailTo(t.x, t.z); this.pending = key; return true; }
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
    if (!path) { if (!quiet) this.msg('You can\'t reach that.', 'warn'); return false; }
    this.path = path;
    this.pending = key;
    return true;
  }

  private perform(t: Target) {
    this.path = [];
    this.pending = null;
    this.facing = Math.atan2(t.z - this.p.z, t.x - this.p.x);
    switch (t.kind) {
      case 'node': return this.startGather(t.key.slice(5));
      case 'npc': return this.talk(t.key.slice(4));
      case 'station': this.emit({ type: 'openStation', station: this.layout.stations[Number(t.key.slice(8))].id }); return;
      case 'bank': this.emit({ type: 'openBank' }); return;
      case 'ship': return this.board();
      case 'arena': return this.wakeGuardian(this.layout.arenas[Number(t.key.slice(6))]);
      case 'portal': { const pt = this.layout.portals[Number(t.key.slice(7))]; this.travel({ to: pt.to, how: 'portal', from: this.s.region }); return; }
      case 'mooring': return this.callShip();
      case 'quest': { const [, q, m] = t.key.split(':'); return this.useMark(q, m); }
      case 'lore': return this.readLore(t.key.slice(5));
      case 'door': return this.openDoor(t.key.slice(5));
      case 'event': return t.key.startsWith('event:gf:') ? this.fire.use(t.key) : t.key.startsWith('event:seep:') ? this.seep.use(t.key) : t.key.startsWith('event:tm:') ? this.treasure.use(t.key) : t.key.startsWith('event:bt:') ? this.belltime.use(t.key) : t.key.startsWith('event:rg:') ? this.regatta.use(t.key) : this.storm.use(t.key);
    }
  }

  stopAction() {
    this.action = null;
    this.moment = null;
  }

  // ------------------------------------------------------------------ gathering
  /** The tool a node needs: skill tools by power; skill-less nodes (picking, digging) by specific item, or bare hands. */
  private gatherTool(d: (typeof NODES)[string]): { id: string; power: number } | null {
    if (d.skill) return this.bestTool(d.skill, d.tool);
    if (!d.tool) return { id: 'hands', power: 0 };
    return count(this.p.inv, d.tool) > 0 ? { id: d.tool, power: 0 } : null;
  }

  private startGather(uid: string) {
    const n = this.nodes.find((x) => x.uid === uid);
    if (!n) return;
    const d = NODES[n.def];
    if (d.skill && this.level(d.skill) < d.level) { this.msg(`You need ${d.skill} level ${d.level} for ${d.name.toLowerCase()}.`, 'warn'); return; }
    const tool = this.gatherTool(d);
    if (!tool) { this.msg(`You need ${d.tool ? `a ${item(d.tool).name.toLowerCase()}${d.tool === 'spade' ? ' (Marta sells them)' : ''}` : d.skill === 'woodcutting' ? 'a hatchet' : 'a pickaxe'}.`, 'warn'); return; }
    if (!d.loot && !canAdd(this.p.inv, d.item)) { this.msg('Your pack is full.', 'warn'); return; }
    this.action = { type: 'gather', node: uid, next: this.time + DT_GATHER * 0.6, progress: this.rnd() * 0.25, from: this.time };
    this.msg(d.verb === 'Dig' ? 'You start digging...' : d.verb === 'Pick' || d.verb === 'Gather' ? `You reach into the ${d.name.toLowerCase()}...` : d.skill === 'fishing' ? 'You cast your line...' : `You swing at the ${d.name.toLowerCase()}...`);
  }

  /**
   * Success chance per swing: the node's rate at its requirement, +1.2% (relative) per level above it,
   * scaled by how the tool compares to the node's tier, then gear bonuses. Capped so it always feels earned.
   */
  gatherChance(d: (typeof NODES)[string], toolPower: number) {
    if (!d.skill) return d.rate;
    const lvl = this.level(d.skill);
    const toolK = d.skill === 'fishing' ? 1 : Math.min(1.6, Math.max(0.45, 1 + 0.15 * (toolPower - Math.min(10, d.tier + 1))));
    const perk = perkTotal(d.skill, lvl, 'speed') / 100;
    // like RuneScape, every level past the requirement makes success likelier (+1.6% of the base rate per level)
    const key = d.skill === 'fishing' && this.activeKey()?.passive.kind === 'fish_success' ? this.activeKey()!.passive.v / 100 : 0;
    return Math.min(0.85, d.rate * (1 + Math.max(0, lvl - d.level) * 0.016) * toolK * (1 + this.stats.gather + perk + key));
  }

  /** Interaction range for a node (ship spots are fished from deck; kelp and fish lie just offshore). */
  nodeReach(d: (typeof NODES)[string]) { return d.fromShip ? 7 : d.reach ?? (d.skill === 'fishing' ? 3.4 : 1.9); }

  private tickGather(a: Extract<NonNullable<Action>, { type: 'gather' }>) {
    const n = this.nodes.find((x) => x.uid === a.node)!;
    const d = NODES[n.def];
    if (n.depletedUntil > this.time || Math.hypot(n.x - this.p.x, n.z - this.p.z) > this.nodeReach(d) + 0.5) { this.stopAction(); return; }
    if (this.moment) { this.stepMoment(); a.next = Math.max(a.next, this.time + 0.4); a.from = this.time; return; }
    this.facing = Math.atan2(n.z - this.p.z, n.x - this.p.x);
    if (this.time < a.next) return;
    const tool = this.gatherTool(d);
    if (!tool) { this.stopAction(); return; }
    a.next = this.time + (d.skill ? DT_GATHER : DT_GATHER * 0.6);
    const struck = a.struck;
    a.struck = undefined; a.from = this.time;
    // steady returns (Tom: one quick, then 30 s of nothing): each swing fills progress by the success chance, a
    // little jittered, and an item lands when it's full. Same average rate as rolling the chance every swing, but
    // the wait between items stays close to the average instead of swinging wildly.
    a.progress += this.swingFill(a, d, tool.power);
    a.fill = undefined; // the next swing rolls its own
    const ok = a.progress >= 1;
    if (ok) a.progress -= 1;
    // active skilling: the swing that lands an item shows the timing bar; gold makes it two, the red heart three
    const strike = ok && d.skill && !d.loot ? struck ?? 'miss' : 'miss', times = ACTIVE.times[strike];
    const fx = d.skill === 'woodcutting' || d.verb === 'Pick' ? 'wood' : d.skill === 'mining' || d.verb === 'Dig' ? 'stone' : 'water';
    this.emit({ type: 'gatherFx', kind: fx, x: n.x, z: n.z, success: ok });
    if (!ok) return;
    let catchOf: { item: string; level: number; xp: number } | null = null;
    if (d.loot && d.fromShip) {
      // salvage comes up on the hook, straight onto the deck (anything that won't fit goes back to the sea)
      const before = this.drops.length;
      this.rollLoot(LOOT[d.loot], n.x, n.z);
      for (const dr of this.drops.splice(before)) if (canAdd(this.p.inv, dr.stack.id)) this.give(dr.stack.id, dr.stack.qty, dr.stack.inst);
      this.msg('Your hook drags something up off the wreck.', 'loot');
    } else if (d.loot) {
      this.rollLoot(LOOT[d.loot], n.x, n.z);
      this.msg('Your spade strikes something! Treasure spills out of the sand.', 'loot');
    } else {
      catchOf = d.catches ? this.pickCatch(d.catches) : null;
      const got = catchOf ? catchOf.item : d.drops ? this.weighted(d.drops) : d.item;
      if (!canAdd(this.p.inv, got)) { this.msg('Your pack is full.', 'warn'); this.stopAction(); return; }
      let n = 0;
      while (n < times && canAdd(this.p.inv, got)) { this.give(got, 1); n++; }
      if (d.bonus && this.rnd() < d.bonus.chance) { this.give(d.bonus.item, 1); this.msg(`You find a ${item(d.bonus.item).name.toLowerCase()}!`, 'loot'); }
      if (d.skill) {
        const lvl = this.level(d.skill);
        if (this.rnd() < perkTotal(d.skill, lvl, 'double') / 100 && canAdd(this.p.inv, got)) { this.give(got, 1); this.msg(`Lucky haul: a second ${item(got).name.toLowerCase()}.`, 'good'); }
        const find = FINDS[d.skill];
        const findMul = (this.activeKey()?.passive.kind === 'find_bonus' ? 1 + this.activeKey()!.passive.v / 100 : 1) * (1 + this.crewV('finds') / 100); // Pip spots them
        if (find && this.rnd() < perkTotal(d.skill, lvl, 'find') / 100 * findMul && canAdd(this.p.inv, find)) { this.give(find, 1); this.msg(`You find a ${item(find).name.toLowerCase()}!`, 'loot'); }
        const kp = this.activeKey()?.passive;
        if (kp && ((kp.kind === 'extra_log' && d.skill === 'woodcutting') || (kp.kind === 'extra_ore' && d.skill === 'mining')) && this.rnd() < kp.v / 100 && canAdd(this.p.inv, got)) {
          this.give(got, 1); this.msg(`Your ${this.activeKey()!.name} turns up a second ${item(got).name.toLowerCase()}.`, 'good');
        }
        if (d.skill === 'mining' && this.rnd() < DROP_CONFIG.miningGem && canAdd(this.p.inv, 'gem_pearl_rough')) {
          let w = this.rnd() * GEMS.reduce((a, g) => a + g.w, 0);
          const gm = GEMS.find((o) => (w -= o.w) <= 0) ?? GEMS[0];
          this.give(`gem_${gm.key}_rough`, 1); this.msg(`You find a rough ${gm.name.toLowerCase()} in the rock!`, 'loot');
        }
        this.rollKeyFind(d.fromShip ? 'sailing' : d.skill as KeyFamily, KEY_CONFIG.gatherChance);
        const mk = MOMENTS.bySkill[d.skill];
        if (mk && this.rnd() < MOMENTS.chance) this.startMoment(mk, a.node);
      }
    }
    if (d.skill) this.addXp(d.skill, (catchOf?.xp ?? d.xp) * ACTIVE.xpTimes[strike]);
    if (tool.id !== 'hands') this.wear(this.p.inv.find((x) => x?.id === tool.id), WEAR.tool * (1 - (d.skill ? perkTotal(d.skill, this.level(d.skill), 'tool_care') / 100 : 0)));
    // each gather uses one of the node's items, unless a Lasting perk spares it
    const lasting = d.skill ? perkTotal(d.skill, this.level(d.skill), 'last') / 100 : 0;
    if (d.yield && !(this.rnd() < lasting)) n.left--;
    if (n.left <= 0) {
      // dig spots wander: they come back after a random while (the sand is disturbed somewhere else meanwhile)
      n.depletedUntil = this.time + d.respawn * (d.verb === 'Dig' ? 0.5 + this.rnd() : 1);
      this.rev++;
      this.stopAction();
      if (d.verb !== 'Dig') this.carryOn(n);
    }
  }

  /** A tree falls or a rock runs dry: walk on to the nearest fresh one of the same kind close by and keep going. */
  private carryOn(from: NodeRt) {
    const near = this.nodes
      .filter((n) => n.def === from.def && n !== from && n.depletedUntil <= this.time && Math.hypot(n.x - this.p.x, n.z - this.p.z) < 12)
      .sort((a, b) => Math.hypot(a.x - this.p.x, a.z - this.p.z) - Math.hypot(b.x - this.p.x, b.z - this.p.z));
    // not into a fight: skip anything with an awake foe beside it
    for (const n of near.slice(0, 3)) {
      if (this.enemies.some((e) => e.alive && Math.hypot(e.x - n.x, e.z - n.z) < e.def.aggro)) continue;
      if (this.interact(`node:${n.uid}`, true)) return;
    }
  }

  /** A mixed spot: try the best fish your level allows first (likelier the further you are past its level), then
   * the next best, down to the lowest. */
  private pickCatch(list: { item: string; level: number; xp: number }[]) {
    const L = this.level('fishing');
    const ok = list.filter((c) => c.level <= L).sort((a, b) => b.level - a.level);
    for (const c of ok) if (this.rnd() < Math.min(0.85, 0.4 + (L - c.level) * 0.012)) return c;
    return ok[ok.length - 1] ?? list[0];
  }

  private weighted(list: { item: string; w: number }[]) {
    let r = this.rnd() * list.reduce((s, x) => s + x.w, 0);
    for (const x of list) { r -= x.w; if (r <= 0) return x.item; }
    return list[list.length - 1].item;
  }

  // ------------------------------------------------------------------ active skilling (data/active.ts)
  /** The current swing or craft's timing: how far through the cycle it is, the gold window, and whether you've tapped. */
  /** What this swing adds toward the next item, rolled once when the swing starts. */
  private swingFill(a: Extract<NonNullable<Action>, { type: 'gather' }>, d: (typeof NODES)[string], power: number) {
    if (a.fill === undefined) a.fill = this.gatherChance(d, power) * (0.75 + this.rnd() * 0.5);
    return a.fill;
  }

  /**
   * The current swing or craft's timing: how far through the cycle it is, the gold window and its red heart, and
   * whether you've tapped. `live`: a gather swing only counts when it's the one that lands an item.
   */
  cueState(): { t: number; window: [number, number]; red: [number, number]; struck: Struck | null; skill: SkillId | null; live: boolean; label?: string } | null {
    const a = this.action;
    if (!a || this.dead) return null;
    if (this.moment) {
      const m = this.moment, def = MOMENTS.defs[m.kind], sk = (Object.entries(MOMENTS.bySkill).find(([, k]) => k === m.kind)?.[0] ?? null) as SkillId | null;
      return { t: Math.max(0, Math.min(1, (this.time - m.from) / def.secs)), window: def.window, red: def.red, struck: null, skill: sk, live: true, label: def.label };
    }
    const skill = a.type === 'gather' ? NODES[this.nodes.find((n) => n.uid === a.node)?.def ?? '']?.skill ?? null : RECIPES.find((r) => r.id === a.recipe)?.skill ?? null;
    if (!skill) return null; // picking and digging have no skill to be good at
    const len = Math.max(0.01, a.next - a.from);
    let live = true;
    if (a.type === 'gather') {
      const n = this.nodes.find((x) => x.uid === a.node)!, d = NODES[n.def], tool = this.gatherTool(d);
      live = !!tool && !d.loot && a.progress + this.swingFill(a, d, tool.power) >= 1;
    }
    return { t: Math.max(0, Math.min(1, (this.time - a.from) / len)), window: ACTIVE.window, red: ACTIVE.red, struck: a.struck ?? null, skill, live };
  }

  /** Tap during a swing or craft: in the gold window it's perfect; outside, that cycle's chance is gone. */
  strike(): Struck | null {
    if (this.moment && this.action) return this.momentTap();
    const c = this.cueState(), a = this.action;
    if (!c || !a || a.struck || !c.live) return null;
    a.struck = c.t >= c.red[0] && c.t <= c.red[1] ? 'red' : c.t >= c.window[0] && c.t <= c.window[1] ? 'perfect' : 'miss';
    const x = a.type === 'gather' && a.struck !== 'miss' ? ` ×${ACTIVE.times[a.struck]}` : '';
    if (a.struck !== 'miss') this.emit({ type: 'cue', perfect: true, text: `${ACTIVE.calls[c.skill!] ?? 'Perfect!'}${x}` });
    else this.emit({ type: 'cue', perfect: false, text: c.t < c.window[0] ? 'Too soon' : 'Too late' });
    return a.struck;
  }

  // ------------------------------------------------------------------ gathering moments (data/active.ts)
  startMoment(kind: MomentKind, node: string) {
    this.moment = { kind, node, from: this.time, step: 0 };
    this.msg(MOMENTS.defs[kind].start, 'quest');
    this.emit({ type: 'cue', perfect: true, text: MOMENTS.defs[kind].label });
  }

  private stepMoment() {
    const m = this.moment!, def = MOMENTS.defs[m.kind];
    if (this.time - m.from >= def.secs) this.endMoment(false);
  }

  private momentTap(): Struck {
    const m = this.moment!, def = MOMENTS.defs[m.kind], t = (this.time - m.from) / def.secs;
    const s: Struck = t >= def.red[0] && t <= def.red[1] ? 'red' : t >= def.window[0] && t <= def.window[1] ? 'perfect' : 'miss';
    if (s === 'miss') { this.emit({ type: 'cue', perfect: false, text: t < def.window[0] ? 'Too soon' : 'Too late' }); this.endMoment(false); return s; }
    m.struck = s === 'red' || m.struck === 'red' ? 'red' : 'perfect';
    if (m.step + 1 < def.steps) { m.step++; m.from = this.time; this.emit({ type: 'cue', perfect: true, text: `${def.label} ${m.step + 1}/${def.steps}` }); return s; }
    this.endMoment(true);
    return s;
  }

  private endMoment(won: boolean) {
    const m = this.moment!, def = MOMENTS.defs[m.kind], n = this.nodes.find((x) => x.uid === m.node), d = n && NODES[n.def];
    this.moment = null;
    if (!won || !d) {
      this.msg(def.lose, 'warn');
      if (m.kind === 'seam') this.p.hp = Math.max(1, this.p.hp - Math.ceil(this.stats.maxHp * 0.04));
      return;
    }
    const red = m.struck === 'red', got: string[] = [];
    const add = (id: string, q: number) => { let k = 0; while (k < q && canAdd(this.p.inv, id)) { this.give(id, 1); k++; } if (k) got.push(`${k > 1 ? `${k} × ` : ''}${item(id).name}`); };
    if (m.kind === 'nest') { add('bird_nest', red ? 2 : 1); this.addXp('woodcutting', d.xp * 3); }
    else if (m.kind === 'tug') {
      const c = d.catches ? this.pickCatch(d.catches) : null, fish = c?.item ?? d.item;
      if (fish) add(fish, red ? 4 : 3);
      this.addXp('fishing', (c?.xp ?? d.xp) * 5);
      if (this.rnd() < 0.15) add('casket', 1);
    } else {
      add('crystal_geode', 1); if (d.item) add(d.item, red ? 3 : 2); this.addXp('mining', d.xp * 3);
      if (this.rnd() < (red ? 0.6 : 0.3)) { const gm = GEMS[Math.floor(this.rnd() * GEMS.length)]; add(`gem_${gm.key}_rough`, 1); }
    }
    this.msg(`${def.win}${got.length ? ` ${got.join(', ')}.` : ''}`, 'good');
    this.emit({ type: 'cue', perfect: true, text: red ? 'Perfect!' : 'Got it!' });
  }

  // ------------------------------------------------------------------ crafting
  /** Any station of this kind within reach (the village and the outlying camps each have their own). */
  nearStation(st: Station) {
    return !this.p.onShip && this.layout.stations.some((s) => s.id === st && Math.hypot(s.x - this.p.x, s.z - this.p.z) < 3.2);
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
    this.action = { type: 'craft', recipe: r.id, remaining: Math.max(1, times), next: this.time + 0.4, from: this.time };
  }

  private tickCraft(a: Extract<NonNullable<Action>, { type: 'craft' }>) {
    if (this.time < a.next) return;
    const r = RECIPES.find((x) => x.id === a.recipe)!;
    const perfect = a.struck === 'perfect' || a.struck === 'red';
    a.struck = undefined;
    if (!this.nearStation(r.station)) { this.stopAction(); return; }
    const block = this.recipeBlock(r);
    if (block) { this.msg(block + '.', 'warn'); this.stopAction(); return; }
    const lvl = this.level(r.skill);
    // Thrifty perks: sometimes the materials survive the work
    const kp = this.activeKey()?.passive;
    const saved = this.rnd() < perkTotal(r.skill, lvl, 'save') / 100 + (kp?.kind === 'smith' && r.skill === 'smithing' ? 0.08 : 0);
    if (!saved) for (const i of r.inputs) remove(this.p.inv, i.id, i.qty); // validated above: all-or-nothing
    else this.msg('Thrifty: you keep your materials.', 'good');
    this.emit({ type: 'craftFx', station: r.station });
    if (r.burn && !perfect) { // off the heat at the right moment: it can't burn
      const span = Math.max(1, r.burn.stopLevel - (kp?.kind === 'cook' ? 5 : 0) - r.level);
      const burnChance = Math.max(0, 0.45 * (1 - (lvl - r.level) / span)) * (1 - perkTotal(r.skill, lvl, 'burn') / 100);
      if (this.rnd() < burnChance) {
        this.give(r.burn.item, 1);
        this.msg(`You burn the ${item(r.inputs[0].id).name.toLowerCase().replace('raw ', '')}.`, 'warn');
        return this.afterCraft(a);
      }
    }
    if (r.rarityRoll) {
      const fine = 0.08 + lvl * 0.01 + perkTotal(r.skill, lvl, 'fine') / 100 + (kp?.kind === 'smith' && r.skill === 'smithing' ? kp.v / 100 : 0) + (perfect ? ACTIVE.fineBonus : 0), rare = 0.015 + lvl * 0.003;
      const roll = this.rnd();
      const rarity = roll < rare ? 'rare' : roll < rare + fine ? 'fine' : 'common';
      const inst = makeInstance(r.output.id, rarity, this.rnd, this.uid());
      this.give(r.output.id, 1, inst);
      if (rarity !== 'common') this.msg(`Masterwork! ${displayName({ id: r.output.id, qty: 1, inst })}.`, 'loot');
    } else {
      const extra = item(r.output.id).stackable && r.output.qty > 1 ? perkTotal(r.skill, lvl, 'extra') : 0;
      this.give(r.output.id, r.output.qty + extra);
      if (r.burn && this.rnd() < perkTotal(r.skill, lvl, 'double') / 100 && canAdd(this.p.inv, r.output.id)) { this.give(r.output.id, 1); this.msg('Two pans: you cook an extra one.', 'good'); }
    }
    this.addXp(r.skill, r.xp * (perfect ? ACTIVE.craftXp : 1));
    this.rollKeyFind('production', KEY_CONFIG.craftChance);
    this.afterCraft(a);
  }

  private afterCraft(a: Extract<NonNullable<Action>, { type: 'craft' }>) {
    a.remaining--;
    const r = RECIPES.find((x) => x.id === a.recipe);
    a.from = this.time;
    a.next = this.time + DT_CRAFT * (1 - (r ? perkTotal(r.skill, this.level(r.skill), 'quick') / 100 : 0));
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
    if (d.chart) return this.treasure.read(i);
    if (d.turn) return this.turnKey(i);
    if (d.opens) {
      remove(this.p.inv, st.id, 1);
      this.rollLoot(LOOT[d.opens], this.p.x, this.p.z);
      if (this.activeKey()?.passive.kind === 'double_finds') this.rollLoot(LOOT[d.opens], this.p.x, this.p.z); // the Skeleton Key opens it twice
      this.msg(`You crack the ${d.name.toLowerCase()} open.`, 'loot');
      this.rev++;
      return;
    }
    this.msg(d.desc);
  }

  /** Wardwright keycutting: a cut key's one turn (items.ts `turn`). */
  mendLeft = 0;
  gustUntil = 0;
  turnKey(i: number) {
    const st = this.p.inv[i], d = st && item(st.id);
    if (!st || !d?.turn || this.dead) return;
    if (d.turn === 'gust' && !this.p.onShip) { this.msg('A Gust key wants a sail to fill. Turn it on deck.', 'warn'); return; }
    if (d.turn === 'home' && this.p.onShip) { this.msg('Turn a Harbour key with your feet on land.', 'warn'); return; }
    remove(this.p.inv, st.id, 1);
    if (d.turn === 'mend') { this.mendLeft = 10; this.msg('You turn the Mending key in the air. Something closes. Your cuts, mostly.', 'good'); }
    else if (d.turn === 'hush') {
      let n = 0;
      for (const e of this.enemies) if (e.alive && !e.def.boss && Math.hypot(e.x - this.p.x, e.z - this.p.z) < 12) { e.fx.root = Math.max(e.fx.root, 6); n++; }
      this.msg(n ? `You turn the Hush key. ${n === 1 ? 'The foe beside you stops' : `${n} foes stop`} where ${n === 1 ? 'it stands' : 'they stand'}, listening.` : 'You turn the Hush key. Nothing near you to hear it.', 'good');
    } else if (d.turn === 'gust') { this.gustUntil = this.time + 30; this.msg('You turn the Gust key on deck, and the wind comes round behind you.', 'good'); }
    else {
      if (this.region.kind === 'cave') { this.travel({ to: this.region.home, how: 'home', from: this.s.region }); return; }
      this.stopAction(); this.path = []; this.pending = null; this.target = null;
      this.p.x = this.layout.respawn.x; this.p.z = this.layout.respawn.z;
      this.msg('You turn the Harbour key, and you\'re standing on the landing, as if you\'d always been.', 'good');
    }
    this.emit({ type: 'keyTurn', x: this.p.x, z: this.p.z, power: d.turn });
    this.rev++;
  }

  /** The food the quick-eat button would eat: the smallest that tops you up without waste, or the biggest you
   * have when even that won't fill you (so a big heal is saved for when you're low). */
  /** Health a food gives you now (food data is RuneScape-small; health is ×10). */
  healOf(id: string) { return Math.round((item(id).heal ?? 0) * HP_SCALE * (1 + this.stats.healBonus)); }

  bestFood(): number | null {
    const missing = this.stats.maxHp - this.p.hp;
    if (missing <= 0) return null;
    let fit = -1, fitHeal = Infinity, big = -1, bigHeal = 0;
    this.p.inv.forEach((st, i) => {
      if (!st || !item(st.id).heal) return;
      const heal = this.healOf(st.id);
      if (heal >= missing && heal < fitHeal) { fit = i; fitHeal = heal; }
      if (heal > bigHeal) { big = i; bigHeal = heal; }
    });
    return fit >= 0 ? fit : big >= 0 ? big : null;
  }
  /** Any food at all in the pack (for showing the quick-eat button). */
  foodSlot(): number | null {
    const i = this.p.inv.findIndex((st) => !!st && !!item(st.id).heal);
    return i >= 0 ? i : null;
  }
  quickEat() {
    const i = this.bestFood();
    if (i === null) { this.msg(this.foodSlot() === null ? 'You have no food.' : 'You are already at full health.'); return; }
    this.eat(i);
  }

  eat(i: number) {
    const st = this.p.inv[i];
    if (!st || !item(st.id).heal || this.dead) return;
    if (this.eatCd > 0) return;
    const heal = this.healOf(st.id), meal = item(st.id).meal;
    // a galley meal is worth eating at full health, for what it does after
    if (this.p.hp >= this.stats.maxHp && !meal) { this.msg('You are already at full health.'); return; }
    st.qty--;
    if (st.qty <= 0) this.p.inv[i] = null;
    this.p.hp = Math.min(this.stats.maxHp, this.p.hp + heal);
    this.eatCd = 1.2;
    if (this.fight) this.fight.ate++;
    if (meal) {
      const was = this.s.meal && this.s.meal.left > 0 && this.s.meal.id !== st.id ? item(this.s.meal.id).name : null;
      this.s.meal = { id: st.id, left: meal.secs };
      this.recalc();
      this.msg(`You eat the ${item(st.id).name.toLowerCase()}: ${MEAL_TEXT[meal.kind](meal.v)} for ${Math.round(meal.secs / 60)} minutes.${was ? ` (It replaces the ${was.toLowerCase()}.)` : ''}`, 'good');
    } else this.msg(`You eat the ${item(st.id).name.toLowerCase()}. +${heal} health.`, 'good');
    this.rev++;
  }

  equipBlock(st: Stack): string | null {
    const e = item(st.id).equip;
    if (!e) return 'Not wearable';
    return reqBlock(st.id, this.p.xp);
  }

  /** Can this pack item go in the off-hand right now (a one-handed weapon that pairs, a shield, orb or book)? */
  offhandOk(st: Stack): string | null {
    const d = item(st.id);
    if (!d.equip || (d.equip.slot !== 'offhand' && !pairGroup(d))) return 'That doesn\'t fit in the off-hand';
    const main = this.p.equip.weapon ? item(this.p.equip.weapon.id) : undefined;
    // a shield can push a two-handed weapon back into the pack; anything else must fit beside the weapon held
    if (d.equip.off === 'shield' && main && isTwoHanded(main)) return null;
    return offhandBlock(main, d);
  }

  /** Wear a pack item. Rings fill the free ring slot; `offhand` puts a one-handed weapon in the off-hand.
   * Two-handed weapons empty the off-hand, a shield empties two hands, and an off-hand that no longer fits
   * beside a new weapon goes back to the pack. */
  equip(i: number, offhand = false) {
    const st = this.p.inv[i];
    if (!st) return;
    const d = item(st.id), e = d.equip;
    if (!e) return;
    const block = this.equipBlock(st);
    if (block) { this.msg(`${block}.`, 'warn'); return; }
    const eq = this.p.equip;
    let slot: Slot = e.slot;
    if (slot === 'ring') slot = !eq.ring ? 'ring' : !eq.ring2 ? 'ring2' : 'ring';
    if ((offhand || slot === 'offhand') && !(pairGroup(d) && !eq.weapon)) { // a lone weapon always goes in the main hand
      const why = this.offhandOk(st);
      if (why) { this.msg(`${why}.`, 'warn'); return; }
      slot = 'offhand';
    }
    // what has to come off as well, and where it goes
    const bump: Slot[] = [];
    const mainAfter: ItemDef | undefined = slot === 'weapon' ? d : eq.weapon ? item(eq.weapon.id) : undefined;
    if (slot === 'weapon' && eq.offhand && offhandBlock(d, item(eq.offhand.id))) bump.push('offhand');
    if (slot === 'offhand' && mainAfter && isTwoHanded(mainAfter)) bump.push('weapon');
    const old = eq[slot];
    const merge = !!old && old.id === st.id && d.stackable;
    // room check: the swapped-out item takes the slot we free; anything bumped needs a free slot of its own
    const free = this.p.inv.filter((x) => !x).length + (merge || !old ? 1 : 0);
    if (bump.length > free) { this.msg(`Make room in your pack for your ${bump.map((b) => displayName(eq[b]!).toLowerCase()).join(' and ')}.`, 'warn'); return; }
    if (merge) { old!.qty += st.qty; this.p.inv[i] = null; }
    else { this.p.inv[i] = old ?? null; eq[slot] = st; }
    for (const b of bump) { add(this.p.inv, eq[b]!); delete eq[b]; }
    this.recalc();
    this.p.hp = Math.min(this.p.hp, this.stats.maxHp);
    this.msg(`You ${slot === 'offhand' && pairGroup(d) ? 'take the' : 'equip the'} ${displayName(st)}${slot === 'offhand' && pairGroup(d) ? ' in your off-hand' : ''}.${bump.length ? ` (${bump.map((b) => b === 'offhand' ? 'Your off-hand went' : 'Your weapon went').join(', ')} back in your pack.)` : ''}`);
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
  // ------------------------------------------------------------------ wear and repair
  /** Use wears gear down slowly; warnings at 20% and when worn out (it keeps working at reduced effect). */
  private wear(st: Stack | null | undefined, amount: number) {
    if (!st || !wears(st.id)) return;
    const tough = item(st.id).innate?.find((x) => x.id === 'durable');
    if (tough) amount *= 1 - tough.v / 100;
    const before = st.cond ?? 100;
    if (before <= 0) return;
    st.cond = Math.max(0, before - amount);
    if (before > 20 && st.cond <= 20) this.msg(`Your ${displayName(st).toLowerCase()} is wearing thin (20%). Repair it at an anvil.`, 'warn');
    if (st.cond <= 0) { this.msg(`Your ${displayName(st).toLowerCase()} is worn out: it works at ${Math.round(WORN_OUT_EFFECT * 100)}% until repaired.`, 'warn'); this.recalc(); }
    if (Math.floor(before) !== Math.floor(st.cond)) this.rev++;
  }

  /** Everything worn in the pack and on you, with what each repair costs. */
  repairList(): { key: string; st: Stack; coins: number; bar: string | null; xp: number }[] {
    const out: { key: string; st: Stack; coins: number; bar: string | null; xp: number }[] = [];
    const add = (key: string, st: Stack | null | undefined) => {
      if (!st || !wears(st.id) || condOf(st) >= 100) return;
      const lost = 1 - condOf(st) / 100;
      const metal = st.id.match(/_(bronze|iron|steel|storm|abyss|tide)$/)?.[1] ?? (st.id === 'pistol_flintlock' ? 'bronze' : null);
      const tier = ['bronze', 'iron', 'steel', 'storm', 'abyss', 'tide'].indexOf(metal ?? '');
      out.push({ key, st, coins: Math.max(1, Math.round(stackValue({ ...st, qty: 1 }) * lost * 0.3)), bar: metal ? `bar_${metal}` : null, xp: metal ? Math.round(10 * (tier + 1) * lost) : 0 });
    };
    for (const [sl, st] of Object.entries(this.p.equip)) add(`equip:${sl}`, st);
    this.p.inv.forEach((st, i) => add(`inv:${i}`, st));
    return out;
  }

  /** Bram (at the village smithy) repairs for coins. */
  nearSmith() { const b = this.layout.npcs.find((n) => n.id === 'bram'); return !!b && !this.p.onShip && Math.hypot(b.x - this.p.x, b.z - this.p.z) < 6; }

  repair(key: string, self: boolean) {
    const r = this.repairList().find((x) => x.key === key);
    if (!r || !this.nearStation('anvil')) return;
    if (self) {
      if (!r.bar) { this.msg('Only Bram can mend that.', 'warn'); return; }
      if (!remove(this.p.inv, r.bar, 1)) { this.msg(`You need a ${item(r.bar).name.toLowerCase()}.`, 'warn'); return; }
      this.addXp('smithing', r.xp);
    } else {
      if (!this.nearSmith()) { this.msg('Bram works at the village smithy.', 'warn'); return; }
      if (!remove(this.p.inv, 'coins', r.coins)) { this.msg(`Bram wants ${r.coins} coins.`, 'warn'); return; }
    }
    r.st.cond = 100; // rarity, affixes and everything else are kept
    this.recalc();
    this.rev++;
    this.msg(`${displayName(r.st)} is as good as new.`, 'good');
  }

  // ------------------------------------------------------------------ strongbox (bank)
  nearBank() { return !this.p.onShip && this.layout.banks.some((b) => Math.hypot(b.x - this.p.x, b.z - this.p.z) < 3.2); }

  /** Put a pack slot (or everything but tools) into the strongbox. Plain items stack; rolled gear keeps its own entry. */
  deposit(i: number | 'all') {
    if (!this.nearBank()) return;
    const bank = this.s.bank;
    const put = (idx: number) => {
      const st = this.p.inv[idx];
      if (!st) return true;
      const same = !st.inst && st.cond === undefined && bank.find((b) => b.id === st.id && !b.inst && b.cond === undefined); // worn items keep their own entry
      if (same) same.qty += st.qty;
      else { if (bank.length >= BANK_MAX) return false; bank.push({ ...st }); }
      this.p.inv[idx] = null;
      return true;
    };
    if (i === 'all') {
      for (let k = 0; k < this.p.inv.length; k++) { const st = this.p.inv[k]; if (st && !item(st.id).tool && !put(k)) { this.msg('The strongbox is full.', 'warn'); break; } }
      this.msg('You stow your pack in the strongbox (tools stay with you).');
    } else if (!put(i)) this.msg('The strongbox is full.', 'warn');
    this.rev++;
  }

  /** Take up to `qty` of a strongbox entry back into the pack. */
  withdraw(b: number, qty: number) {
    const e = this.s.bank[b];
    if (!e || !this.nearBank()) return;
    let moved = 0;
    if (item(e.id).stackable) {
      const n = Math.min(qty, e.qty);
      if (!canAdd(this.p.inv, e.id, n)) { this.msg('Your pack is full.', 'warn'); return; }
      add(this.p.inv, { id: e.id, qty: n }); moved = n;
    } else {
      for (; moved < Math.min(qty, e.qty); moved++) {
        const slot = this.p.inv.indexOf(null);
        if (slot < 0) { if (!moved) this.msg('Your pack is full.', 'warn'); break; }
        this.p.inv[slot] = { id: e.id, qty: 1, ...(e.inst ? { inst: e.inst } : {}), ...(e.cond !== undefined ? { cond: e.cond } : {}) };
      }
    }
    e.qty -= moved;
    if (e.qty <= 0) this.s.bank.splice(b, 1);
    this.rev++;
  }

  /** The trader you last opened (each shopkeeper has their own stock and prices). */
  shopId = 'general';
  get shop() { return SHOPS[this.shopId] ?? SHOPS.general; }
  /** Open the shop `npcId` keeps, if they keep one. */
  openShopOf(npcId: string) {
    const sh = Object.values(SHOPS).find((x) => x.keeper === npcId);
    if (!sh) return false;
    this.shopId = sh.id;
    this.emit({ type: 'openShop', shop: sh.id });
    return true;
  }
  nearShop() {
    const n = this.layout.npcs.find((x) => x.id === this.shop.keeper);
    return !!n && !this.p.onShip && Math.hypot(n.x - this.p.x, n.z - this.p.z) < 3.5;
  }
  buyPrice(id: string) {
    const e = this.shop.stock.find((x) => x.id === id);
    return Math.max(1, Math.ceil(item(id).value * (e?.qty ?? 1) * this.shop.buyMul * (1 - this.crewV('trade') / 100)));
  }
  sellPrice(st: Stack) {
    const want = this.shop.wants?.find((w) => st.id.startsWith(w.prefix));
    return Math.floor(stackValue(st) * this.shop.sellMul * (want?.mul ?? 1) * (1 + this.crewV('trade') / 100));
  }

  buy(id: string) {
    const entry = this.shop.stock.find((x) => x.id === id);
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
    if (d.quest || st.id === 'coins') { this.msg(`${NPCS[this.shop.keeper]?.name.split(' ')[0] ?? 'They'} won't buy that.`, 'warn'); return; }
    const qty = all ? st.qty : 1;
    const each = this.sellPrice({ ...st, qty: 1 });
    st.qty -= qty;
    if (st.qty <= 0) this.p.inv[i] = null;
    if (each * qty > 0) add(this.p.inv, { id: 'coins', qty: each * qty });
    this.msg(`Sold ${qty} × ${displayName(st)} for ${each * qty} coins.`);
    this.rev++;
  }

  // ------------------------------------------------------------------ npcs + quests
  /** Someone who isn't where they live right now (recruited, fled, taken). */
  npcGone(id: string) {
    const d = NPCS[id];
    return !!(d?.goneWhen && this.s.flags[d.goneWhen] && !(d.backWhen && this.s.flags[d.backWhen]));
  }
  questStage(id: string) { return this.s.quests[id] ?? 0; }
  /** Lines as this world has them: the base, the reactive lines whose flags hold, then the close. */
  reactive(lines: string[], react?: React[], after?: string[]) {
    const f = this.s.flags;
    return [...lines, ...(react ?? []).filter((r) => r.flags.every((x) => f[x]) && !(r.not ?? []).some((x) => f[x])).flatMap((r) => r.lines), ...(after ?? [])];
  }

  private talk(npcId: string) {
    const npc = NPCS[npcId];
    // everything this person has to say for the quests you're on; one you can act on now wins over one that's waiting
    const opts: { q: string; node: DialogueNode }[] = [];
    for (const q of Object.values(QUESTS)) {
      const stage = q.stages[this.questStage(q.id)];
      // every line this person has for the stage (a choice can give one person two things to say, gated by flags)
      for (const o of [stage?.talk, ...(stage?.also ?? [])]) if (o?.npc === npcId) opts.push({ q: q.id, node: o.node });
    }
    const waiting = (node: DialogueNode) => (node.requires && count(this.p.inv, node.requires.id) < node.requires.qty) || (node.needsFlags ?? []).some((f) => !this.s.flags[f]);
    // a quest you're already on comes before starting a new one
    const ready = opts.find((o) => !waiting(o.node) && this.questStage(o.q) > 0) ?? opts.find((o) => !waiting(o.node) && QUESTS[o.q].main) ?? opts.find((o) => !waiting(o.node)), first = opts[0];
    if (ready) {
      this.emit({ type: 'dialog', npc: npcId, lines: this.reactive(ready.node.lines, ready.node.react, ready.node.after) });
      if (ready.node.effect) this.applyEffect(ready.q, ready.node.effect, ready.node);
      return;
    }
    // nothing to act on: a quest you're on says what it still needs (else the first one's teaser)
    const started = opts.find((o) => this.questStage(o.q) > 0) ?? first;
    if (started) { this.emit({ type: 'dialog', npc: npcId, lines: started.node.missing ?? npc.idle }); return; }
    if (npc.shop && this.openShopOf(npcId)) return;
    if (npc.bank) { this.emit({ type: 'openBank' }); return; }
    const board = Object.keys(BOARDS).find((b) => BOARDS[b].npc === npcId);
    if (board) { this.emit({ type: 'openBoard', board }); return; } // harbourmasters keep the bounty board (and the ferry)
    if (npc.ferry) { this.emit({ type: 'ferryOffer', npc: npcId, to: npc.ferry[0].to, price: this.ferryPrice(npc.ferry[0].price) }); return; }
    if (npc.heals && this.p.hp < this.stats.maxHp) {
      this.p.hp = this.stats.maxHp;
      this.emit({ type: 'dialog', npc: npcId, lines: [npc.heals] });
      this.rev++;
      return;
    }
    this.emit({ type: 'dialog', npc: npcId, lines: npc.idle });
  }

  private applyEffect(questId: string, e: Effect, _node?: DialogueNode) {
    for (const t of e.take ?? []) remove(this.p.inv, t.id, t.qty);
    for (const g of e.give ?? []) this.give(g.id, g.qty);
    for (const x of e.xp ?? []) this.addXp(x.skill, x.amount);
    if (e.flag) this.s.flags[e.flag] = true;
    if (e.flag === 'bell_done') this.giveKey('keels_tooth'); // the Broken Ring gives up its key
    if (e.key) this.giveKey(e.key);
    if (e.vision) this.emit({ type: 'read', title: e.vision.title, sub: e.vision.sub, lines: this.reactive(e.vision.lines, e.vision.react, e.vision.after) });
    if (e.crew && CREW_BY[e.crew] && !this.s.crew.includes(e.crew)) {
      this.s.crew.push(e.crew);
      if (!this.s.mate) this.s.mate = e.crew;
      this.recalc();
      this.msg(`${CREW_BY[e.crew].name} joins your crew as ${CREW_BY[e.crew].role.toLowerCase()}. ${CREW_BY[e.crew].passive.text}.`, 'good');
    }
    if (e.stage !== undefined) this.setStage(questId, e.stage);
    this.rev++;
  }

  /** The quest spots open right now in this region (the stage you're on in each quest). */
  questMarks(): { quest: string; mark: QuestMark }[] {
    const out: { quest: string; mark: QuestMark }[] = [];
    for (const q of Object.values(QUESTS)) for (const m of q.stages[this.questStage(q.id)]?.marks ?? []) if (m.region === this.s.region) out.push({ quest: q.id, mark: m });
    return out;
  }

  /** Use a quest spot: in order if the stage wants an order (progress kept as flags, so it survives a reload). */
  private useMark(questId: string, markId: string) {
    const st = this.questStage(questId), stage = QUESTS[questId]?.stages[st], m = stage?.marks?.find((x) => x.id === markId);
    if (!m) return;
    if (m.requiresKey && !this.s.keyring.includes(m.requiresKey)) { for (const line of m.missing ?? [`It needs a key you don't have: ${KEY[m.requiresKey]?.name ?? 'a key'}.`]) this.msg(line, 'warn'); return; }
    if (m.requires && count(this.p.inv, m.requires.id) < m.requires.qty) { for (const line of m.missing ?? [`You need ${m.requires.qty} × ${item(m.requires.id).name}.`]) this.msg(line, 'warn'); return; }
    for (const line of m.say ?? []) this.msg(line, 'quest');
    if (m.seq !== undefined || m.decoy) {
      const key = (n: number) => `${questId}_${st}_s${n}`;
      const real = stage!.marks!.filter((x) => !x.decoy);
      const done = real.filter((x) => this.s.flags[key(x.seq!)]).length;
      if (m.decoy || m.seq !== done + 1) {
        for (const x of real) delete this.s.flags[key(x.seq!)];
        if (done > 0 || m.seq !== 1) this.msg(stage!.wrong ?? 'That wasn\'t the right order. Start again.', 'warn');
        if (m.seq === 1 && !m.decoy) this.s.flags[key(1)] = true; // the first one is always a fresh start
        this.rev++;
        return;
      }
      this.s.flags[key(m.seq)] = true;
      if (done + 1 === real.length) this.setStage(questId, st + 1);
      this.rev++;
      return;
    }
    if (m.effect) this.applyEffect(questId, m.effect);
  }

  /** A foe beaten (on land or at sea): counts toward any stage that wants it. */
  questKill(foe: string) {
    for (const q of Object.values(QUESTS)) {
      const st = this.questStage(q.id), k = q.stages[st]?.kill;
      if (!k || k.foe !== foe) continue;
      let n = 0;
      while (this.s.flags[`${q.id}_${st}_k${n}`]) n++;
      this.s.flags[`${q.id}_${st}_k${n}`] = true;
      if (n + 1 >= k.count) this.setStage(q.id, st + 1);
      else this.msg(`${q.name}: ${n + 1} of ${k.count}.`, 'quest');
    }
  }

  /** A quest foe waits where its stage says, once, while you're in its region. */
  private stepQuestFoes() {
    for (const q of Object.values(QUESTS)) {
      const k = q.stages[this.questStage(q.id)]?.kill;
      if (!k?.spawn || k.sea || k.spawn.region !== this.s.region || this.enemies.some((e) => e.def.id === k.foe && e.alive)) continue;
      const at = this.world.nearestWalkable(k.spawn.x, k.spawn.z, 6);
      if (!at) continue;
      const e = this.spawnEnemy(ENEMIES[k.foe], at[0], at[1], false);
      e.once = true;
      // a quest's foe is the one the story promised: never a random song-touched elite
      e.elite = null; e.maxHp = e.hp = e.def.hp * HP_SCALE;
    }
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
    if (this.p.onShip || !this.shipHere) return;
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
    if (mo && Math.hypot(this.ship.x - mo.x, this.ship.z - mo.z) < 7) Object.assign(this.ship, mo);
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
    const mo = this.layout.mooring;
    if (!mo) return;
    const far = !this.shipHere;
    Object.assign(this.ship, mo, { region: this.s.region });
    this.msg(far ? 'A harbour crew sails your sloop over from the other island. She\'s moored at the pier.' : 'Harbour hands row your sloop back to the quay.');
    this.rev++;
  }

  /** Plot a course round headlands and reefs; straight line if no route is found. */
  private sailTo(x: number, z: number) {
    const route = this.world.findSeaPath(this.ship.x, this.ship.z, x, z) ?? [[x, z]];
    const [first, ...rest] = route;
    this.shipTarget = { x: first[0], z: first[1] };
    this.shipRoute = rest;
  }

  private stepShip(dt: number) {
    const sh = this.ship;
    let want: number | null = null, throttle = 0;
    const m = Math.hypot(this.moveDir.x, this.moveDir.z);
    if (m > 0.1) { want = Math.atan2(this.moveDir.z, this.moveDir.x); throttle = Math.min(1, m); }
    else if (this.shipTarget) {
      const dx = this.shipTarget.x - sh.x, dz = this.shipTarget.z - sh.z, d = Math.hypot(dx, dz);
      const via = this.shipRoute.length > 0;
      const stopAt = via ? 4 : this.pending ? 5 : 2.5;
      if (d < stopAt && via) {
        const [nx, nz] = this.shipRoute.shift()!;
        this.shipTarget = { x: nx, z: nz };
        want = Math.atan2(nz - sh.z, nx - sh.x); throttle = 1;
      } else if (d < stopAt) {
        this.shipTarget = null;
        if (this.pending) { const t = this.targets().find((x) => x.key === this.pending); this.pending = null; if (t && Math.hypot(t.x - sh.x, t.z - sh.z) <= t.range + 0.5) this.perform(t); }
      } else { want = Math.atan2(dz, dx); throttle = Math.min(1, d / 8 + 0.3); }
    }
    if (want !== null) {
      const diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
      const turn = Math.max(-1, Math.min(1, diff * 2.2)) * 1.25 * dt;
      throttle *= Math.max(0.25, Math.cos(diff) * 0.5 + 0.5);
      // sailing to a tapped spot from a tight berth: if the hull can't swing here, make way ahead until it can
      // (turning into the quay used to stall the ship with the target silently dropped)
      if (m > 0.1 || this.hullFits(sh.x, sh.z, sh.heading + turn)) sh.heading += turn;
      else throttle = Math.max(throttle, 0.45);
    }
    const maxSpeed = 7.5 * (this.activeKey()?.passive.kind === 'ship_speed' ? 1 + this.activeKey()!.passive.v / 100 : 1) * (1 + this.crewV('ship_speed') / 100) * (this.s.flags.toll_pennant ? 1.05 : 1) * (1 + this.shipBonus('sails') / 100) * (this.s.flags.gull_pennant ? 1.03 : 1) * (this.time < this.gustUntil ? 1.3 : 1); // a Gust key; the Tollhouse pennant; the shipwright's sails; a Gull Race gold
    const targetSpeed = throttle * maxSpeed;
    this.shipSpeed += (targetSpeed - this.shipSpeed) * Math.min(1, dt * (targetSpeed > this.shipSpeed ? 0.7 : 1.2));
    if (this.shipSpeed > 0.01) {
      const nx = sh.x + Math.cos(sh.heading) * this.shipSpeed * dt, nz = sh.z + Math.sin(sh.heading) * this.shipSpeed * dt;
      if (this.hullFits(nx, nz, sh.heading)) { sh.x = nx; sh.z = nz; }
      else {
        this.shipSpeed = 0;
        this.shipTarget = null;
        this.shipRoute = [];
        if (this.time - this.shoalWarned > 3) { this.shoalWarned = this.time; this.msg('Shallows! The hull scrapes. Steer for deeper water.', 'warn'); }
      }
    }
    this.p.x = sh.x;
    this.p.z = sh.z;
    this.facing = sh.heading;
    // sailed off a charted edge: on to the next island
    let lane = edgeCrossed(this.region, sh.x, sh.z);
    const gate = lane && REGIONS[lane.to].gate;
    if (lane && gate && !this.s.flags[gate.flag]) {
      // uncharted water: the ship comes about, back inside the chart's edge
      const b = this.region.bounds, inset = b.half - 22;
      if (lane.side === 'e') sh.x = Math.min(sh.x, b.cx + inset); else if (lane.side === 'w') sh.x = Math.max(sh.x, b.cx - inset);
      else if (lane.side === 's') sh.z = Math.min(sh.z, b.cz + inset); else sh.z = Math.max(sh.z, b.cz - inset);
      sh.heading += Math.PI; this.shipSpeed = 0; this.shipTarget = null; this.shipRoute = [];
      if (this.time - this.laneHinted > 8) { this.laneHinted = this.time; this.msg(gate.text, 'warn'); }
      lane = null;
    }
    if (lane) {
      const b = this.region.bounds;
      this.travel({ to: lane.to, how: 'sail', from: this.s.region, along: lane.side === 'e' || lane.side === 'w' ? sh.z - b.cz : sh.x - b.cx });
    } else if (this.time - this.laneHinted > 60) {
      const b = this.region.bounds;
      for (const ex of this.region.exits) {
        const near = ex.side === 'e' ? sh.x > b.cx + b.half - 45 : ex.side === 'w' ? sh.x < b.cx - b.half + 45 : ex.side === 's' ? sh.z > b.cz + b.half - 45 : sh.z < b.cz - b.half + 45;
        if (near && !(REGIONS[ex.to].gate && !this.s.flags[REGIONS[ex.to].gate!.flag])) { this.laneHinted = this.time; this.msg(`Open water. Hold your course ${({ e: 'east', w: 'west', n: 'north', s: 'south' })[ex.side]} to cross to ${REGIONS[ex.to].name}.`, 'info'); }
      }
    }
  }
  private laneHinted = -999;

  hullFits(x: number, z: number, h: number) {
    const c = Math.cos(h), s = Math.sin(h);
    for (const [lx, lz] of [[4.6, 0], [-3.8, 0], [0.5, 1.3], [0.5, -1.3], [2.5, 0.8], [2.5, -0.8], [-2, 1.1], [-2, -1.1]]) {
      if (!this.world.sailable(x + lx * c - lz * s, z + lx * s + lz * c)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ combat
  /** Something song-touched that comes to listen (bell-time): a one-off elite with this affix. */
  spawnListener(def: EnemyDef, x: number, z: number, affix: string) {
    const e = this.spawnEnemy(def, x, z, false);
    e.once = true;
    e.elite = affix;
    e.maxHp = e.hp = Math.round(def.hp * HP_SCALE * (affix === 'barnacled' ? 3 : 2));
    e.state = 'chase';
    return e;
  }

  private spawnEnemy(def: EnemyDef, x: number, z: number, summoned: boolean): Enemy {
    const e: Enemy = {
      id: this.nextId++, def, x, z, facing: this.rnd() * Math.PI * 2, spawnX: x, spawnZ: z,
      hp: def.hp * HP_SCALE, maxHp: def.hp * HP_SCALE, alive: true, state: 'idle', t: 0, cd: 0, aim: null, elite: null, respawnAt: 0, summoned, wander: null, hitFlash: 0, moving: false,
      fx: { root: 0, disarm: 0, slow: 0, shatter: 0, lesson: 0, marks: 0, weak: 0, ward: 0, spoil: 0, fuse: 0, turn: 0, bite: 0, picked: false, spoilAcc: 0 },
    };
    this.rollElite(e);
    this.enemies.push(e);
    return e;
  }

  private rollElite(e: Enemy) {
    e.elite = null;
    e.maxHp = e.def.hp * HP_SCALE;
    // elites only among foes of level 9+: a starter's first crabs shouldn't be triple-health armoured ones
    if (!e.def.boss && !e.summoned && e.def.level >= 9 && this.rnd() < 0.1) {
      e.elite = ELITE_AFFIXES[Math.floor(this.rnd() * ELITE_AFFIXES.length)].id;
      e.maxHp = Math.round(e.def.hp * HP_SCALE * (e.elite === 'barnacled' ? 3 : 2));
    }
    e.hp = e.maxHp;
  }

  // ---- bounties and crew (bounties.ts) -----------------------------------------------
  /** A board's offers, refreshed every half hour of play (and topped up after you take one). */
  boardOffers(board: string): Contract[] {
    const b = (this.s.boards[board] ??= { offers: [], refreshAt: 0 });
    if (this.s.playTime >= b.refreshAt || !b.offers.length) { b.offers = this.makeOffers(board); b.refreshAt = this.s.playTime + BOUNTY_CONFIG.refreshS; }
    return b.offers;
  }

  private makeOffers(board: string): Contract[] {
    const B = BOARDS[board], r = this.boardRnd, cl = this.stats.combatLevel;
    const pickOf = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    // what lives on this island and in its caves, near enough your level
    const foes = new Map<string, { region: RegionId; x: number; z: number }[]>();
    for (const reg of B.regions) for (const sp of regionLayout(reg).spawns) {
      const d = ENEMIES[sp.enemy];
      if (!d || d.boss) continue;
      (foes.get(d.id) ?? foes.set(d.id, []).get(d.id)!).push({ region: reg, x: sp.x, z: sp.z });
    }
    let ids = [...foes.keys()].filter((id) => ENEMIES[id].level <= cl + 12);
    if (ids.length < 2) ids = [...foes.keys()].sort((a, b) => ENEMIES[a].level - ENEMIES[b].level).slice(0, 3);
    const out: Contract[] = [];
    const used = new Set<string>();
    for (let k = 0; k < BOUNTY_CONFIG.offers - 1 && ids.length; k++) {
      const left = ids.filter((id) => !used.has(id));
      const id = pickOf(left.length ? left : ids); used.add(id);
      const lv = ENEMIES[id].level, need = BOUNTY_CONFIG.huntN[0] + Math.floor(r() * (BOUNTY_CONFIG.huntN[1] - BOUNTY_CONFIG.huntN[0] + 1));
      out.push({ id: this.uid(), board, kind: 'hunt', enemy: id, need, have: 0, coins: need * lv * BOUNTY_CONFIG.coinsPer, bounty: need * lv * BOUNTY_CONFIG.bountyPer });
    }
    // one wanted target: a named foe from a camp on the island itself
    const hostile = ids.filter((id) => ENEMIES[id].hostile && foes.get(id)!.some((p) => p.region === B.island));
    if (hostile.length) {
      const id = pickOf(hostile), lv = ENEMIES[id].level, at = pickOf(foes.get(id)!.filter((p) => p.region === B.island));
      const m = 10 * lv * BOUNTY_CONFIG.wantedMul;
      out.push({ id: this.uid(), board, kind: 'wanted', enemy: id, need: 1, have: 0, coins: m * BOUNTY_CONFIG.coinsPer, bounty: m * BOUNTY_CONFIG.bountyPer,
        name: `${pickOf(WANTED_FIRST)} ${pickOf(WANTED_LAST)}`, region: at.region, x: at.x, z: at.z });
    }
    return out;
  }

  /** Take a contract off a board. */
  acceptContract(board: string, id: number) {
    const b = this.s.boards[board], c = b?.offers.find((o) => o.id === id);
    if (!c) return;
    if (this.s.contracts.length >= BOUNTY_CONFIG.maxActive) { this.msg(`You can carry ${BOUNTY_CONFIG.maxActive} contracts at once.`, 'warn'); return; }
    b.offers = b.offers.filter((o) => o !== c);
    this.s.contracts.push(c);
    this.msg(c.kind === 'wanted' ? `Contract taken: ${c.name}, wanted. Last seen near ${this.placeNear(c.region!, c.x!, c.z!)}.` : `Contract taken: ${c.need} ${ENEMIES[c.enemy].name.toLowerCase()}s.`, 'quest');
    this.rev++;
  }
  abandonContract(id: number) { this.s.contracts = this.s.contracts.filter((c) => c.id !== id); this.rev++; }

  /** The nearest named place to a spot (for "last seen near ..."). */
  placeNear(region: RegionId, x: number, z: number) {
    let best = REGIONS[region].name, bd = Infinity;
    for (const pl of PLACES) { if (placeRegion(pl) !== region) continue; const d = Math.hypot(pl.x - x, pl.z - z); if (d < bd) { bd = d; best = pl.name; } }
    return best;
  }

  /** Raise your bounty; a new rank is announced, and a big enough bounty sets the hunters on you. */
  addBounty(n: number) {
    if (n <= 0) return;
    const before = rankOf(this.s.bounty);
    this.s.bounty += Math.round(n);
    const after = rankOf(this.s.bounty);
    if (after !== before) { this.emit({ type: 'rank', bounty: this.s.bounty, rank: after }); this.msg(`Your bounty is ${this.s.bounty.toLocaleString('en-GB')}: ${after}.`, 'quest'); }
    if (this.s.bounty >= BOUNTY_CONFIG.hunterFrom && !this.s.hunterAt) this.s.hunterAt = this.s.playTime + this.hunterGap();
    this.rev++;
  }
  private hunterGap() { const [a, b] = BOUNTY_CONFIG.hunterEvery; return a + this.boardRnd() * (b - a); }

  /** A foe down: contracts move on, notable kills raise your bounty. */
  private onBountyKill(e: Enemy) {
    if (e.contract !== undefined) {
      const c = this.s.contracts.find((x) => x.id === e.contract);
      if (c) { this.rollLoot(LOOT[e.def.loot], e.x, e.z); if (this.rnd() < 1 / 25) this.dropSig('sig_locksmith', e.x, e.z); this.completeContract(c); } // a wanted target carries a second share of loot
    }
    for (const c of [...this.s.contracts]) if (c.kind === 'hunt' && c.enemy === e.def.id) { c.have++; if (c.have >= c.need) this.completeContract(c); else this.rev++; }
    if (e.def.boss) this.addBounty(BOUNTY_CONFIG.bossBounty[e.def.id] ?? 1000);
    else if (e.def.id.startsWith('bounty_')) this.addBounty(e.def.level * 5);
    else if (e.def.hostile) this.addBounty(e.def.level * BOUNTY_CONFIG.killBounty);
  }

  private completeContract(c: Contract) {
    this.s.contracts = this.s.contracts.filter((x) => x !== c);
    this.give('coins', c.coins);
    this.msg(`Contract done: ${c.kind === 'wanted' ? `${c.name} brought down` : `${c.need} ${ENEMIES[c.enemy].name.toLowerCase()}s`}. +${c.coins.toLocaleString('en-GB')} coins, +${c.bounty.toLocaleString('en-GB')} bounty.`, 'good');
    this.addBounty(c.bounty);
  }

  /** Wanted targets appear where they lurk when you're in their region; bounty hunters come looking for you. */
  private stepBounties() {
    for (const c of this.s.contracts) {
      if (c.kind !== 'wanted' || c.region !== this.s.region || this.enemies.some((e) => e.contract === c.id && e.alive)) continue;
      const at = this.world.nearestWalkable(c.x!, c.z!, 6);
      if (!at) continue;
      const e = this.spawnEnemy(ENEMIES[c.enemy], at[0], at[1], false);
      e.once = true; e.named = c.name; e.contract = c.id;
      e.elite = ELITE_AFFIXES[Math.floor(this.boardRnd() * ELITE_AFFIXES.length)].id;
      e.maxHp = e.hp = Math.round(e.def.hp * HP_SCALE * BOUNTY_CONFIG.wantedHp);
    }
    if (this.s.bounty < BOUNTY_CONFIG.hunterFrom || !this.s.hunterAt || this.s.playTime < this.s.hunterAt) return;
    if (REGIONS[this.s.region].kind !== 'island' || this.p.onShip || this.dead || Math.hypot(this.p.x - this.layout.respawn.x, this.p.z - this.layout.respawn.z) < SAFE_RADIUS) return;
    this.s.hunterAt = this.s.playTime + this.hunterGap();
    const tier = this.s.bounty < 15000 ? 1 : this.s.bounty < 40000 ? 2 : 3;
    const party = [`bounty_hunter_${tier}`, `bounty_gunman_${tier}`, ...(tier > 1 ? [`bounty_hunter_${tier}`] : [])];
    const a0 = this.boardRnd() * Math.PI * 2;
    party.forEach((id, k) => {
      const a = a0 + k * 0.7, at = this.world.nearestWalkable(this.p.x + Math.cos(a) * 11, this.p.z + Math.sin(a) * 11, 5);
      if (!at) return;
      const e = this.spawnEnemy(ENEMIES[id], at[0], at[1], false);
      e.once = true; e.state = 'chase';
    });
    this.emit({ type: 'hunters', x: this.p.x, z: this.p.z });
    this.msg(`Bounty hunters! They've come to collect the ${this.s.bounty.toLocaleString('en-GB')} on your head.`, 'combat');
  }

  /** Sign a sailor from the board: they want a captain with a big enough bounty, and their fee. */
  recruitBlock(id: string): string | null {
    const c = CREW_BY[id];
    if (!c) return 'Unknown';
    if (this.s.crew.includes(id)) return 'Already in your crew';
    if (this.s.bounty < c.bounty) return `Wants a captain with a bounty of ${c.bounty.toLocaleString('en-GB')}`;
    if (count(this.p.inv, 'coins') < c.coins) return `Needs ${c.coins.toLocaleString('en-GB')} coins`;
    return null;
  }
  recruit(id: string) {
    const block = this.recruitBlock(id);
    if (block) { this.msg(`${block}.`, 'warn'); return; }
    const c = CREW_BY[id];
    remove(this.p.inv, 'coins', c.coins);
    this.s.crew.push(id);
    if (!this.s.mate) this.s.mate = id;
    this.recalc();
    this.msg(`${c.name} signs on as your ${c.role.toLowerCase()}. ${c.passive.text}.`, 'good');
  }
  /** Who comes ashore with you (null: nobody; the rest stay aboard, their passives still count). */
  setMate(id: string | null) {
    if (id !== null && !this.s.crew.includes(id)) return;
    this.s.mate = id;
    this.mate = null;
    this.rev++;
  }

  /** Your first mate: follows you ashore, fights what you fight (their hits give you no XP). */
  private stepMate(dt: number) {
    const def = this.s.mate ? CREW_BY[this.s.mate] : null;
    if (!def || this.p.onShip || this.dead > 0) { this.mate = null; return; }
    let m = this.mate;
    if (!m || m.id !== def.id || Math.hypot(m.x - this.p.x, m.z - this.p.z) > 22) {
      const at = this.world.nearestWalkable(this.p.x - Math.cos(this.facing) * 1.6, this.p.z - Math.sin(this.facing) * 1.6, 4) ?? [this.p.x, this.p.z];
      m = this.mate = { id: def.id, x: at[0], z: at[1], facing: this.facing, cd: 1, moving: false };
    }
    m.cd = Math.max(0, m.cd - dt);
    m.moving = false;
    const tgt = this.enemies.find((e) => e.id === this.target && e.alive && e.state !== 'rise' && Math.hypot(e.x - this.p.x, e.z - this.p.z) < 12)
      ?? this.enemies.filter((e) => e.alive && (e.state === 'chase' || e.state === 'windup') && Math.hypot(e.x - this.p.x, e.z - this.p.z) < 9)
        .sort((a, b) => Math.hypot(a.x - m!.x, a.z - m!.z) - Math.hypot(b.x - m!.x, b.z - m!.z))[0];
    const speed = PLAYER_BASE.speed * 1.05;
    if (tgt) {
      const d = Math.hypot(tgt.x - m.x, tgt.z - m.z), reach = def.mate.range + tgt.def.radius;
      m.facing = Math.atan2(tgt.z - m.z, tgt.x - m.x);
      if (d > reach) this.mateMove(m, tgt.x, tgt.z, speed * dt, reach * 0.9);
      else if (m.cd <= 0) {
        m.cd = 2.4;
        const st = def.mate.style;
        const defRoll = (tgt.def.def + 9) * (tgt.def.defBonus[st] + 64) * (tgt.fx.shatter > 0 ? 0.6 : 1);
        const maxHit = Math.max(HP_SCALE, Math.round(this.stats.maxHit * def.mate.mul));
        const dmg = this.rnd() < hitChance(this.stats.attRoll * 0.8, defRoll) ? HP_SCALE + Math.floor(this.rnd() * (maxHit - HP_SCALE + 1)) : 0;
        this.emit({ type: 'mateAttack', x: m.x, z: m.z, tx: tgt.x, tz: tgt.z, style: st });
        this.damageEnemy(tgt, dmg, false, st, 0.15, 0, false);
      }
      return;
    }
    // follow a step behind
    const bx = this.p.x - Math.cos(this.facing) * 1.6, bz = this.p.z - Math.sin(this.facing) * 1.6;
    if (Math.hypot(bx - m.x, bz - m.z) > 1.2) { m.facing = Math.atan2(bz - m.z, bx - m.x); this.mateMove(m, bx, bz, speed * (Math.hypot(this.p.x - m.x, this.p.z - m.z) > 6 ? 1.4 : 1) * dt, 0.4); }
  }
  private mateMove(m: Mate, tx: number, tz: number, step: number, stopAt: number) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d <= stopAt) return;
    const s = Math.min(step, d - stopAt), nx = dx / d, nz = dz / d;
    for (const [ux, uz] of [[nx, nz], [nx * 0.7 - nz * 0.7, nz * 0.7 + nx * 0.7], [nx * 0.7 + nz * 0.7, nz * 0.7 - nx * 0.7]] as [number, number][]) {
      const x = m.x + ux * s, z = m.z + uz * s;
      if (this.world.walkable(x, z)) { m.x = x; m.z = z; m.moving = true; return; }
    }
  }

  // ---- keys and keyholes (docs/KEYS.md) -------------------------------------------
  /** The key slotted in you, if it's awake. */
  activeKey(): KeyDef | null {
    const k = this.s.key ? KEY[this.s.key] : undefined;
    return k && this.s.keyDormant <= 0 ? k : null;
  }

  /** Walking pace: the Wanderer's Key quickens it out of combat. */
  walkSpeed() {
    const k = this.activeKey()?.passive;
    return PLAYER_BASE.speed * (k?.kind === 'walk_speed' && this.combatTimer > 6 ? 1 + k.v / 100 : 1);
  }

  /** Why you can't swap keys here, or null: only at a strongbox or bank, aboard your ship, or in the chapel, and
   * never mid-fight. */
  keySwapBlock(): string | null {
    if (this.combatTimer < 6) return 'Not while fighting';
    if (this.p.onShip) return null;
    const near = (x: number, z: number, r: number) => Math.hypot(x - this.p.x, z - this.p.z) < r;
    if (this.layout.banks.some((b) => near(b.x, b.z, 4))) return null;
    if (this.layout.npcs.some((n) => n.id === 'maren' && near(n.x, n.z, 6))) return null;
    if (this.layout.mooring && near(this.layout.mooring.x, this.layout.mooring.z, 6)) return null;
    return 'Swap keys at a strongbox or bank, aboard your ship, or in the chapel';
  }

  /** Slot a key from your keyring into yourself (or take it out with null). A new key sleeps a while unless the
   * developer setting for free swaps is on. */
  slotKey(id: string | null) {
    if (id !== null && !this.s.keyring.includes(id)) return;
    if (id === this.s.key) return;
    const block = this.keySwapBlock();
    if (block) { this.msg(`${block}.`, 'warn'); return; }
    this.s.key = id;
    this.s.keyDormant = id && !this.s.settings.devFreeKeys ? KEY_CONFIG.dormantS : 0;
    this.keyCd = 0;
    this.recalc();
    if (id) this.msg(this.s.keyDormant ? `You turn the ${KEY[id].name} in your own keyhole. It sleeps for ${Math.round(KEY_CONFIG.dormantS / 60)} minutes before it wakes.` : `You turn the ${KEY[id].name} in your own keyhole.`, 'good');
    else this.msg('You take your key out.');
  }

  /** Add a key to the keyring (a find, a reward, or a test). */
  giveKey(id: string) {
    if (!KEY[id] || this.s.keyring.includes(id)) return false;
    this.s.keyring.push(id);
    this.emit({ type: 'keyFound', id });
    this.msg(`You found a key: the ${KEY[id].name}! It's on your keyring (Equipment).`, 'loot');
    this.rev++;
    return true;
  }

  /** Keys are found anywhere, extremely rarely: a key you don't have yet, most often one from this line of work. */
  private rollKeyFind(family: KeyFamily, chance: number) {
    if (this.keyRnd() >= chance) return;
    const left = KEYS.filter((k) => !this.s.keyring.includes(k.id) && KEY_CONFIG.rarityWeight[k.rarity] > 0);
    if (!left.length) return;
    const w = left.map((k) => (k.family === family ? KEY_CONFIG.themeWeight : 1) * KEY_CONFIG.rarityWeight[k.rarity]);
    let r = this.keyRnd() * w.reduce((a, b) => a + b, 0);
    const pick = left.find((_, i) => (r -= w[i]) <= 0) ?? left[left.length - 1];
    this.giveKey(pick.id);
  }

  /** The foe a key would turn in right now: the nearest within reach. */
  keyTarget(): Enemy | null { return this.nearestEnemy(KEY_CONFIG.reach); }

  /** Why the key's power can't be used now, or null. */
  keyBlock(): string | null {
    if (!this.s.key) return 'No key slotted';
    if (this.s.keyDormant > 0) return `Your key sleeps for ${Math.ceil(this.s.keyDormant / 60)} more min`;
    if (this.keyCd > 0) return `Ready in ${Math.ceil(this.keyCd)} s`;
    if (this.p.onShip || this.dead) return 'Not now';
    if (!this.keyTarget()) return 'Get within 3 m of a foe';
    return null;
  }

  /** Turn your key in the nearest foe's keyhole. */
  useKey() {
    const block = this.keyBlock();
    const k = this.activeKey();
    if (block || !k) { this.msg(`${block ?? 'No key'}.`, 'warn'); return; }
    const e = this.keyTarget()!, P = k.power, boss = !!e.def.boss, bm = boss ? KEY_CONFIG.bossMul : 1;
    // powers that don't fit this foe are refused before the cooldown starts
    if (P.id === 'pickpocket' && e.fx.picked) { this.msg('Already picked clean.', 'warn'); return; }
    if (P.id === 'steal' && !e.elite) { this.msg('Only elites have a power worth stealing.', 'warn'); return; }
    if (P.id === 'turncoat' && boss) { this.msg('It won\'t turn. Some things only serve themselves.', 'warn'); return; }
    this.keyCd = P.cooldown;
    this.combatTimer = 0;
    this.facing = Math.atan2(e.z - this.p.z, e.x - this.p.x);
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase'; // turning a key in someone is an attack
    switch (P.id) {
      case 'lesson': e.fx.lesson = P.dur!; this.msg(`${e.def.name}: weak to ${e.def.weakness}. Your ${e.def.weakness} hits do +${P.v}% for ${P.dur} s.`, 'combat'); break;
      case 'root': e.fx.root = P.dur! * bm; break;
      case 'shatter': e.fx.shatter = P.dur!; break;
      case 'disarm':
        e.fx.disarm = P.dur! * bm;
        if (e.state === 'windup') { e.state = 'chase'; e.aim = null; }
        this.telegraphs = this.telegraphs.filter((t) => t.source !== e.id || boss); // a boss's slam already falling still falls
        break;
      case 'mark': e.fx.marks = P.v!; break;
      case 'becalm': e.fx.slow = P.dur! * bm; break;
      case 'hook': case 'undertow': {
        // drag foes toward a point (the player, or the keyed foe); bosses are too heavy to move
        const pullTo = (f: Enemy, tx: number, tz: number, stop: number) => {
          if (f.def.boss) return;
          const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
          if (d <= stop) return;
          for (let t = 1; t > 0; t -= 0.1) {
            const nx = f.x + (dx / d) * (d - stop) * t, nz = f.z + (dz / d) * (d - stop) * t;
            if (this.world.walkable(nx, nz)) { f.x = nx; f.z = nz; return; }
          }
        };
        if (P.id === 'hook') { if (boss) this.msg('Too heavy to drag.', 'warn'); pullTo(e, this.p.x, this.p.z, 1.4 + e.def.radius); }
        else for (const f of this.enemies) if (f.alive && Math.hypot(f.x - e.x, f.z - e.z) <= P.v!) { if (f !== e) pullTo(f, e.x, e.z, f.def.radius + e.def.radius + 0.2); f.fx.slow = Math.max(f.fx.slow, P.dur! * (f.def.boss ? bm : 1)); if (f.state === 'idle') f.state = 'chase'; }
        break;
      }
      case 'drain': {
        const amt = Math.max(HP_SCALE, Math.round(e.maxHp * (P.v! / 100) * (boss ? 1 / 3 : 1)));
        this.damageEnemy(e, Math.min(amt, e.hp), false, this.stats.style, 0);
        this.p.hp = Math.min(this.stats.maxHp, this.p.hp + amt);
        break;
      }
      case 'pickpocket': e.fx.picked = true; this.rollLoot(LOOT[e.def.loot], this.p.x, this.p.z); this.msg(`You pick the ${this.enemyName(e).toLowerCase()}'s keyhole clean.`, 'loot'); break;
      case 'rust': e.fx.weak = P.dur!; break;
      case 'spoil': e.fx.spoil = P.dur!; break;
      case 'ward': e.fx.ward = P.dur! * bm; break;
      case 'knockdown': {
        e.fx.root = Math.max(e.fx.root, P.dur! * bm); e.fx.disarm = Math.max(e.fx.disarm, P.dur! * bm);
        if (e.state === 'windup') { e.state = 'chase'; e.aim = null; }
        if (!boss) {
          const dx = e.x - this.p.x, dz = e.z - this.p.z, d = Math.hypot(dx, dz) || 1;
          for (let r = 2.5; r > 0; r -= 0.25) { const nx = e.x + (dx / d) * r, nz = e.z + (dz / d) * r; if (this.world.walkable(nx, nz)) { e.x = nx; e.z = nz; break; } }
        }
        break;
      }
      case 'fuse': e.fx.fuse = P.dur!; break;
      case 'chain': {
        // the foe first, then up to three more within 6 m, each struck at 60% of your max hit
        const hit = [e, ...this.enemies.filter((o) => o !== e && o.alive && o.state !== 'rise' && Math.hypot(o.x - e.x, o.z - e.z) < 6).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z)).slice(0, P.v!)];
        for (const o of hit) { const r = this.rollAgainst(o, Math.max(HP_SCALE, Math.round(this.stats.maxHit * 0.6))); this.damageEnemy(o, r.dmg, r.crit, this.stats.style, 0.3); this.emit({ type: 'keyTurn', x: o.x, z: o.z, power: 'chain' }); }
        break;
      }
      case 'toll':
        for (const o of this.enemies) if (o.alive && Math.hypot(o.x - this.p.x, o.z - this.p.z) <= P.v!) {
          const m = o.def.boss ? KEY_CONFIG.bossMul : 1;
          o.fx.root = Math.max(o.fx.root, P.dur! * m); o.fx.disarm = Math.max(o.fx.disarm, P.dur! * m);
          if (o.state === 'windup' && !o.def.boss) { o.state = 'chase'; o.aim = null; }
        }
        break;
      case 'steal': this.stolen = { affix: e.elite!, t: P.dur! }; this.recalc(); this.msg(`You take the ${e.elite} power for yourself.`, 'good'); break;
      case 'turncoat': e.fx.turn = P.dur!; if (e.state === 'windup') { e.state = 'chase'; e.aim = null; } this.telegraphs = this.telegraphs.filter((t) => t.source !== e.id); break;
      case 'bite': e.fx.bite = P.dur! * bm; if (!boss && e.state === 'windup') { e.state = 'chase'; e.aim = null; } if (!boss) this.telegraphs = this.telegraphs.filter((t) => t.source !== e.id); break;
      case 'blink': {
        // step through the keyhole: out on the far side of the foe
        const dx = e.x - this.p.x, dz = e.z - this.p.z, d = Math.hypot(dx, dz) || 1;
        const to = { x: e.x + (dx / d) * (e.def.radius + 1.2), z: e.z + (dz / d) * (e.def.radius + 1.2) };
        if (this.world.walkable(to.x, to.z)) { this.p.x = to.x; this.p.z = to.z; this.path = []; this.facing = Math.atan2(-dz, -dx); }
        else this.msg('No room on the other side.', 'warn');
        break;
      }
    }
    this.emit({ type: 'keyTurn', x: e.x, z: e.z, power: P.id });
    this.rev++;
  }

  /** Signature melee rules, after the hit lands. */
  private jawN = 0;
  private sigMelee(t: Enemy, dmg: number) {
    const st = this.stats, boss = !!t.def.boss;
    switch (st.sig) {
      case 'lash': {
        // drag the foe a little toward you and slow it
        if (!boss) { const dx = this.p.x - t.x, dz = this.p.z - t.z, d = Math.hypot(dx, dz); if (d > 1.4 + t.def.radius) { const nx = t.x + (dx / d) * 0.6, nz = t.z + (dz / d) * 0.6; if (this.world.walkable(nx, nz)) { t.x = nx; t.z = nz; } } }
        t.fx.slow = Math.max(t.fx.slow, 2);
        break;
      }
      case 'jaw':
        if (++this.jawN % 4 === 0) {
          const r2 = this.rollAgainst(t);
          this.damageEnemy(t, r2.dmg, r2.crit, 'melee', 0.4);
          this.p.hp = Math.min(this.stats.maxHp, this.p.hp + Math.round((dmg + r2.dmg) * 0.05));
          this.emit({ type: 'keyTurn', x: t.x, z: t.z, power: 'drain' });
        }
        break;
      case 'bell':
        if (dmg > 0 && this.rnd() < 0.25) { const m = boss ? 0.5 : 1; t.fx.root = Math.max(t.fx.root, 1.5 * m); t.fx.disarm = Math.max(t.fx.disarm, 1.5 * m); if (!boss && t.state === 'windup') { t.state = 'chase'; t.aim = null; } this.emit({ type: 'keyTurn', x: t.x, z: t.z, power: 'toll' }); }
        break;
      case 'venom': if (dmg > 0) t.fx.spoil = Math.max(t.fx.spoil, 4); break;
    }
  }

  /** Signature ranged and magic rules: the extra targets are struck as the shot leaves. */
  private sigRanged(t: Enemy) {
    const st = this.stats;
    const others = (r: number, from = t) => this.enemies.filter((o) => o !== t && o.alive && o.state !== 'rise' && Math.hypot(o.x - from.x, o.z - from.z) <= r)
      .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    const strike = (o: Enemy, mul: number, power: string) => { const r = this.rollAgainst(o, Math.max(HP_SCALE, Math.round(st.maxHit * mul))); this.damageEnemy(o, r.dmg, r.crit, st.style, 0.2); this.emit({ type: 'keyTurn', x: o.x, z: o.z, power }); };
    switch (st.sig) {
      case 'ricochet': { const o = others(5)[0]; if (o) strike(o, 0.5, 'mark'); break; }
      case 'storm': for (const o of others(5).slice(0, 2)) strike(o, 0.3, 'chain'); break;
      case 'pierce': {
        const ux = (t.x - this.p.x) / (Math.hypot(t.x - this.p.x, t.z - this.p.z) || 1), uz = (t.z - this.p.z) / (Math.hypot(t.x - this.p.x, t.z - this.p.z) || 1);
        for (const o of this.enemies) {
          if (o === t || !o.alive || o.state === 'rise') continue;
          const ax = o.x - this.p.x, az = o.z - this.p.z, along = ax * ux + az * uz;
          if (along > 0.5 && along <= st.range + 4 && Math.abs(ax * uz - az * ux) < 0.8 + o.def.radius) strike(o, 0.7, 'blink');
        }
        break;
      }
      case 'maelstrom':
        for (const o of others(2.5)) {
          if (!o.def.boss) { const dx = t.x - o.x, dz = t.z - o.z, d = Math.hypot(dx, dz) || 1, nx = o.x + (dx / d) * 0.8, nz = o.z + (dz / d) * 0.8; if (this.world.walkable(nx, nz)) { o.x = nx; o.z = nz; } }
          strike(o, 0.5, 'undertow');
        }
        break;
    }
  }

  /** Fuse: the foe bursts, hurting it and everything within 3 m (bosses take a share). */
  private burstFuse(e: Enemy) {
    const big = Math.round(this.stats.maxHit * 2.5);
    this.emit({ type: 'keyTurn', x: e.x, z: e.z, power: 'fuse' });
    this.emit({ type: 'explode', x: e.x, z: e.z, r: 3 });
    for (const o of [...this.enemies]) {
      if (!o.alive || Math.hypot(o.x - e.x, o.z - e.z) > 3) continue;
      this.damageEnemy(o, o === e ? big : Math.round(big * 0.6), false, this.stats.style, 1.2);
    }
  }

  /** Turncoat: for a while the foe fights its own side. */
  private stepTurncoat(e: Enemy, dt: number) {
    e.cd = Math.max(0, e.cd - dt);
    if (e.state === 'windup' || e.state === 'idle' || e.state === 'return') e.state = 'chase';
    const foe = this.enemies.filter((o) => o !== e && o.alive && o.state !== 'rise' && Math.hypot(o.x - e.x, o.z - e.z) < 10)
      .sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
    if (!foe) { this.enemyMove(e, this.p.x, this.p.z, e.def.speed, dt, 2); return; } // keeps close, harmless
    const reach = (e.def.attack.kind === 'shot' ? e.def.attack.range * 0.8 : e.def.attack.range) + foe.def.radius;
    const d = Math.hypot(foe.x - e.x, foe.z - e.z);
    e.facing = Math.atan2(foe.z - e.z, foe.x - e.x);
    if (d > reach) { this.enemyMove(e, foe.x, foe.z, e.def.speed, dt, reach * 0.9); return; }
    if (e.cd > 0) return;
    e.cd = e.def.attack.cooldown;
    this.emit({ type: 'keyTurn', x: foe.x, z: foe.z, power: 'turncoat' });
    this.damageEnemy(foe, Math.round(e.def.maxHit * HP_SCALE * 0.8), false, e.def.style, 0.3, 0, false);
  }

  // ---- stances, ammo, specials -------------------------------------------------
  setStance(st: Stance) { this.s.combat.stance = st; this.recalc(); }
  setSpell(id: string) {
    const sp = SPELLS.find((x) => x.id === id);
    if (sp?.quest && !this.s.flags[sp.quest]) { this.msg(`${sp.name} is taught by a quest.`, 'warn'); return; }
    this.s.combat.spell = id; this.recalc();
  }

  /** Why the equipped weapon can't attack right now, or null. */
  ammoBlock(n = 1): string | null {
    const st = this.stats;
    if (st.style === 'ranged') {
      const a = this.p.equip.ammo, need = st.needsAmmo ?? 'shot';
      const wname = item(this.p.equip.weapon!.id).name.toLowerCase();
      if (!a || a.qty < n) return `Your ${wname} needs ${AMMO_NAME[need]} in your ammo slot.`;
      if (ammoKind(item(a.id)) !== need) return `Your ${wname} can't fire ${item(a.id).name.toLowerCase()}: it needs ${AMMO_NAME[need]}.`;
    }
    if (st.style === 'magic' && (st.spell?.charms ?? 0) > 0 && count(this.p.inv, 'charm_tide') < st.spell!.charms * n) return `${st.spell!.name} needs tide charms. Brine Spray is free.`;
    return null;
  }

  private consumeAmmo(n = 1) {
    if (this.stats.style === 'ranged') {
      const a = this.p.equip.ammo!;
      for (let k = 0; k < n; k++) if (this.rnd() >= this.stats.ammoSave) a.qty--; // Thrifty powder perks
      if (a.qty <= 0) { delete this.p.equip.ammo; this.recalc(); this.msg(`You are out of ${AMMO_NAME[this.stats.needsAmmo ?? 'shot']}.`, 'warn'); }
    } else if (this.stats.style === 'magic') {
      const c = (this.stats.spell?.charms ?? 0) * n;
      if (c > 0 && this.rnd() >= this.stats.charmSave) remove(this.p.inv, 'charm_tide', c);
    }
    this.rev++;
  }

  private ammoWarned = 0;
  private warnAmmo(text: string) {
    if (this.time - this.ammoWarned > 4) { this.ammoWarned = this.time; this.msg(text, 'warn'); }
  }

  /** Accuracy roll against an enemy's defence for the current style; damage 0..max on a hit. */
  private rollAgainst(e: Enemy, maxHit = this.stats.maxHit, attRoll = this.stats.attRoll): { dmg: number; crit: boolean } {
    const st = this.stats;
    const defLvl = e.def.def + (e.elite === 'barnacled' ? 10 : 0);
    const defRoll = (defLvl + 9) * (e.def.defBonus[st.style] + 64) * (e.fx.shatter > 0 ? 1 - (KEY.prospector.power.v ?? 40) / 100 : 1); // Shatter
    // Mark: the next hits land at their maximum, no roll
    const marked = e.fx.marks > 0;
    if (marked) e.fx.marks--;
    if (!marked && this.rnd() >= hitChance(attRoll, defRoll)) return { dmg: 0, crit: false };
    const crit = marked || this.rnd() < st.crit;
    // a successful hit always lands at least 1, so a 0 always means a miss
    // a landed hit does HP_SCALE..max (RuneScape's 1..max, ×10), so average damage is exactly the unscaled game's
    maxHit = Math.max(HP_SCALE, maxHit);
    let dmg = crit ? maxHit : HP_SCALE + Math.floor(this.rnd() * (maxHit - HP_SCALE + 1));
    if ((e.elite || e.def.boss) && dmg > 0) dmg = Math.round(dmg * (1 + st.eliteDmg));
    if (e.elite && this.activeKey()?.passive.kind === 'listening') dmg = Math.round(dmg * (1 + this.activeKey()!.passive.v / 100)); // the Listener's Key
    if (this.activeKey()?.passive.kind === 'desperate' && this.p.hp < this.stats.maxHp / 2) dmg = Math.round(dmg * (1 + this.activeKey()!.passive.v / 100)); // Mutineer's Key
    const f = e.fx, keyed = f.root > 0 || f.disarm > 0 || f.slow > 0 || f.shatter > 0 || f.lesson > 0 || f.weak > 0 || f.ward > 0 || f.spoil > 0 || f.bite > 0 || f.marks > 0;
    if (st.sig === 'locksmith' && keyed) dmg = Math.round(dmg * 1.25); // Locksmith's Blade
    if (e.fx.lesson > 0 && e.def.weakness === st.style) dmg = Math.round(dmg * (1 + ((this.activeKey()?.power.id === 'lesson' ? this.activeKey()!.power.v : KEY.quick_study.power.v) ?? 15) / 100)); // Lesson (Eavesdrop listens harder)
    if (st.seaDmg && (e.def.model === 'crab' || e.def.look === 'drowned' || e.def.look === 'captain')) dmg = Math.round(dmg * (1 + st.seaDmg));
    return { dmg, crit };
  }

  /** RuneScape XP: 4 per damage to the trained skill(s), 1.33 to Hitpoints; spells add base XP. */
  private combatXp(dmg: number, style: CombatStyle, spellBase = 0) {
    dmg /= HP_SCALE; // XP is RuneScape's 4 a point of (unscaled) damage
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
    this.wear(this.p.equip.weapon, WEAR.weapon);
    if (st.style === 'melee') {
      this.emit({ type: 'swing' });
      const r = this.rollAgainst(t);
      const tx = t.x, tz = t.z;
      // a pike runs through whatever stands in line behind the target
      const ux = (tx - this.p.x) / (Math.hypot(tx - this.p.x, tz - this.p.z) || 1), uz = (tz - this.p.z) / (Math.hypot(tx - this.p.x, tz - this.p.z) || 1);
      const pierced = st.kind === 'pike' ? this.enemies.filter((e) => {
        if (e === t || !e.alive) return false;
        const ax = e.x - this.p.x, az = e.z - this.p.z, along = ax * ux + az * uz;
        return along > 0.3 && along <= st.range + e.def.radius + 0.6 && Math.abs(ax * uz - az * ux) < 0.7 + e.def.radius;
      }) : [];
      this.damageEnemy(t, r.dmg, r.crit, 'melee', st.kind === 'greatsword' ? 0.6 : 0.35);
      if (st.sig && t.alive) this.sigMelee(t, r.dmg);
      // a blade in the off-hand follows up on the same target
      if (st.dual && t.alive) { this.wear(this.p.equip.offhand, WEAR.weapon); const r2 = this.rollAgainst(t, st.dual.maxHit, st.dual.attRoll); this.damageEnemy(t, r2.dmg, r2.crit, 'melee', 0.15); }
      for (const e of pierced) { const rr = this.rollAgainst(e); this.damageEnemy(e, Math.round(rr.dmg * 0.6), false, 'melee', 0.3); }
      if (st.cleave > 0 && r.dmg > 0) {
        for (const e of this.enemies) if (e !== t && e.alive && !pierced.includes(e) && Math.hypot(e.x - tx, e.z - tz) < (st.kind === 'greatsword' ? 2.6 : 2.2)) this.damageEnemy(e, Math.max(1, Math.round(r.dmg * st.cleave)), false, 'melee', 0.2);
      }
      return true;
    }
    // two pistols (or two wands) fire together: the off-hand's shot is weaker and costs its own shot or charms
    const shots = st.dual ? 2 : 1;
    const block = this.ammoBlock(shots);
    if (block) { this.warnAmmo(block); return false; }
    this.consumeAmmo(shots);
    this.fireAt(t, this.rollAgainst(t), st.style, st.spell?.baseXp ?? 0, st.dual ? -0.05 : 0);
    if (st.sig) this.sigRanged(t);
    if (st.dual) { this.wear(this.p.equip.offhand, WEAR.weapon); this.fireAt(t, this.rollAgainst(t, st.dual.maxHit, st.dual.attRoll), st.style, 0, 0.05); }
    return true;
  }

  private fireAt(t: Enemy, r: { dmg: number; crit: boolean }, style: CombatStyle, spellBase: number, angleOffset = 0, knock = 0.2) {
    const ang = Math.atan2(t.z - this.p.z, t.x - this.p.x) + angleOffset;
    this.facing = ang;
    const speed = style === 'magic' ? 18 : 30;
    const dist = Math.hypot(t.x - this.p.x, t.z - this.p.z) + 1.5;
    const fletched = this.stats.needsAmmo === 'arrow' || this.stats.needsAmmo === 'bolt';
    this.projectiles.push({ id: this.nextId++, x: this.p.x, z: this.p.z, vx: Math.cos(ang) * speed, vz: Math.sin(ang) * speed, life: dist / speed, damage: r.dmg, from: 'player', kind: style === 'magic' ? 'magic' : fletched ? 'arrow' : 'shot', crit: r.crit, style, spellBase, knock });
    this.emit({ type: 'shoot', x: this.p.x, z: this.p.z, tx: t.x, tz: t.z });
  }

  /** Special attack: depends on the weapon type (Whirl, Scatter shot, Squall). */
  specialInfo(): { name: string; cooldown: number; block: string | null } {
    // aboard, the special is the broadside (or a depth charge over the stern)
    if (this.p.onShip) { const a = AMMO[this.naval.ammo]; return { name: a.kind === 'charge' ? 'Drop a depth charge' : `Broadside (${a.name.toLowerCase()})`, cooldown: NAVAL.reload, block: this.naval.fireBlock() }; }
    const st = this.stats, sp = PLAYER_BASE.special[st.style];
    let block: string | null = null;
    if (this.level(sp.skill) < sp.level) block = `Needs ${sp.skill[0].toUpperCase() + sp.skill.slice(1)} level ${sp.level}`;
    else if (st.style === 'ranged') block = this.ammoBlock(PLAYER_BASE.special.ranged.shots);
    else if (st.style === 'magic' && count(this.p.inv, 'charm_tide') < PLAYER_BASE.special.magic.charms) block = `Needs ${PLAYER_BASE.special.magic.charms} tide charms`;
    return { name: sp.name, cooldown: sp.cooldown, block };
  }

  useSpecial() {
    if (this.p.onShip && !this.dead) { this.naval.fire(); return; }
    if (this.dead || this.p.onShip || this.specialCd > 0) return;
    const info = this.specialInfo();
    if (info.block) { this.msg(`${info.name}: ${info.block.toLowerCase()}.`, 'warn'); return; }
    const st = this.stats;
    this.combatTimer = 0;
    if (st.style === 'melee') {
      const sp = PLAYER_BASE.special.melee;
      this.specialCd = sp.cooldown * (1 - st.specCut);
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
      this.specialCd = sp.cooldown * (1 - st.specCut);
      this.consumeAmmo(sp.shots);
      for (let k = 0; k < sp.shots; k++) this.fireAt(t, this.rollAgainst(t), 'ranged', 0, (k - (sp.shots - 1) / 2) * sp.spread, 0.6);
      this.emit({ type: 'whirl' });
    } else {
      const sp = PLAYER_BASE.special.magic;
      this.specialCd = sp.cooldown * (1 - st.specCut);
      remove(this.p.inv, 'charm_tide', sp.charms);
      this.emit({ type: 'squall' });
      for (const e of [...this.enemies]) {
        if (!e.alive || e.state === 'rise') continue;
        if (Math.hypot(e.x - this.p.x, e.z - this.p.z) > sp.radius + e.def.radius) continue;
        const r = this.rollAgainst(e, sp.maxHit * HP_SCALE);
        this.damageEnemy(e, r.dmg, r.crit, 'magic', sp.knock, 4);
      }
      this.rev++;
    }
  }

  // ---- utility spells (Magic 21 and 25) ---------------------------------------------
  utilityCd = 0;
  /** Why a utility spell can't be cast right now, or null. */
  utilityBlock(kind: keyof typeof UTILITY_SPELLS): string | null {
    const u = UTILITY_SPELLS[kind];
    if (this.level('magic') < u.level) return `Needs Magic level ${u.level}`;
    if (count(this.p.inv, 'charm_tide') < this.utilityCharms(kind)) return `Needs ${u.charms} tide charms`;
    if (this.dead || this.p.onShip) return 'Not now';
    if (this.utilityCd > 0) return `Ready in ${Math.ceil(this.utilityCd)} s`;
    if (kind === 'home' && this.combatTimer < 5) return 'Not while fighting';
    return null;
  }
  /** Charms a utility spell burns (the Bell Key makes teleports free). */
  utilityCharms(kind: keyof typeof UTILITY_SPELLS) { return kind === 'home' && this.activeKey()?.passive.kind === 'free_teleport' ? 0 : UTILITY_SPELLS[kind].charms; }
  private castUtility(kind: keyof typeof UTILITY_SPELLS) {
    const u = UTILITY_SPELLS[kind];
    if (this.rnd() >= this.stats.charmSave) remove(this.p.inv, 'charm_tide', this.utilityCharms(kind));
    this.utilityCd = u.cooldown;
    this.addXp('magic', u.xp);
  }
  /** Brine Alchemy: one item from the pack becomes coins (60% of its value). */
  alchemy(i: number) {
    const st = this.p.inv[i];
    if (!st || st.id === 'coins' || item(st.id).quest) return;
    const block = this.utilityBlock('alchemy');
    if (block) { this.msg(`${UTILITY_SPELLS.alchemy.name}: ${block.toLowerCase()}.`, 'warn'); return; }
    const coins = Math.max(1, Math.floor(stackValue({ ...st, qty: 1 }) * UTILITY_SPELLS.alchemy.rate));
    const name = displayName({ ...st, qty: 1 });
    st.qty--;
    if (st.qty <= 0) this.p.inv[i] = null;
    add(this.p.inv, { id: 'coins', qty: coins });
    this.castUtility('alchemy');
    this.emit({ type: 'alchemy' });
    this.msg(`The brine takes your ${name.toLowerCase()} and leaves ${coins} coins.`, 'good');
    this.rev++;
  }
  /** Tide-walk Home: back to the quay at Bellwether. */
  teleportHome() {
    const block = this.utilityBlock('home');
    if (block) { this.msg(`${UTILITY_SPELLS.home.name}: ${block.toLowerCase()}.`, 'warn'); return; }
    const fromX = this.p.x, fromZ = this.p.z;
    this.castUtility('home');
    this.msg('The tide carries you home to Bellwether.', 'good');
    if (this.s.region !== 'bellwether') { this.travel({ to: 'bellwether', how: 'home', from: this.s.region }); return; }
    this.stopAction();
    this.path = [];
    this.pending = null;
    this.target = null;
    this.p.x = this.layout.respawn.x;
    this.p.z = this.layout.respawn.z;
    this.emit({ type: 'teleport', fromX, fromZ, x: this.p.x, z: this.p.z });
    this.rev++;
  }

  /** Pay a harbourmaster for passage: you and your ship arrive at the other harbour's pier. */
  takeFerry(npcId: string, to?: string) {
    const routes = NPCS[npcId]?.ferry, f = routes?.find((r) => !to || r.to === to), n = this.layout.npcs.find((x) => x.id === npcId);
    if (!f || !n || this.dead || this.p.onShip || Math.hypot(n.x - this.p.x, n.z - this.p.z) > 4.5) return;
    const gate = REGIONS[f.to as RegionId].gate;
    if (gate && !this.s.flags[gate.flag]) { this.msg('The Compact doesn\'t sail where nobody\'s charted. Not yet.', 'warn'); return; }
    const price = this.ferryPrice(f.price);
    if (count(this.p.inv, 'coins') < price) { this.msg(`Passage costs ${price} coins.`, 'warn'); return; }
    remove(this.p.inv, 'coins', price);
    this.msg(`The cutter takes you across. Your sloop sails in her wake.`, 'good');
    this.travel({ to: f.to as RegionId, how: 'ferry', from: this.s.region });
  }

  /** Read a page of Keel's Log or a Varrow fragment (where it lies, or again from the journal once found). */
  readLore(id: string) {
    const l = LORE_BY_ID[id];
    if (!l) return;
    const first = !this.s.flags[`lore_${id}`];
    this.s.flags[`lore_${id}`] = true;
    this.emit({ type: 'read', title: l.title, sub: l.set === 'keel' ? 'Corran Keel, captain of the Undertow' : 'From the Varrow', lines: l.lines });
    if (first) {
      const keel = LORE.filter((x) => x.set === 'keel' && this.s.flags[`lore_${x.id}`]).length;
      this.msg(l.set === 'keel' ? `You found a page of Keel's Log (${keel} of ${KEEL_PAGES} pages). It's in your journal.` : `${l.title} is in your journal.`, 'quest');
      this.rev++;
    }
  }

  /** A Wardwright door: it opens to its own House's key (or the Skeleton Key, which fits every lock). */
  openDoor(id: string) {
    const d = DOOR_BY_ID[id];
    if (!d) return;
    if (this.s.flags[`door_${id}`]) { this.readDoor(id); return; }
    const fits = this.s.keyring.includes(d.key) ? d.key : this.s.keyring.includes('skeleton') ? 'skeleton' : null;
    if (!fits) { this.msg(`The keyhole is cut for one key only: the ${KEY[d.key]?.name ?? 'right key'}. Nothing on your keyring fits.`, 'warn'); return; }
    this.s.flags[`door_${id}`] = true;
    for (const r of d.reward) { if (canAdd(this.p.inv, r.id)) this.give(r.id, r.qty); else this.dropAt(this.p.x, this.p.z, { id: r.id, qty: r.qty }); }
    this.msg(`${fits === 'skeleton' ? 'The Skeleton Key fits, the way it fits everything.' : `The ${KEY[d.key].name} turns.`} The vault of ${d.house} opens for the first time in a thousand years.`, 'good');
    this.readDoor(id);
    this.rev++;
  }
  /** A House's last record (found behind its door; kept in the journal). */
  readDoor(id: string) {
    const d = DOOR_BY_ID[id];
    if (!d || !this.s.flags[`door_${id}`]) return;
    this.emit({ type: 'read', title: d.record.title, sub: 'A Wardwright vault', lines: d.record.lines });
  }

  /** Tell the player when a diary task gets ticked off (checked twice a second; ticks already done on load are quiet). */
  private diaryCheckAt = 0;
  private stepDiaries() {
    if (this.time < this.diaryCheckAt) return;
    this.diaryCheckAt = this.time + 0.5;
    // quest stages that wait on the world (all their flags set) move on by themselves
    for (const q of Object.values(QUESTS)) { const st = this.questStage(q.id), w = q.stages[st]?.waitFlags; if (w && w.every((f) => this.s.flags[f])) this.setStage(q.id, st + 1); }
    const quiet = !this.s.flags.diary_seen;
    for (const d of DIARIES) {
      if (this.s.flags[`diary_${d.island}`]) continue;
      for (const t of d.tasks) {
        const key = `dt_${d.island}_${t.id}`;
        if (this.s.flags[key] || !t.done(this)) continue;
        this.s.flags[key] = true;
        if (quiet) continue;
        const n = d.tasks.filter((x) => this.s.flags[`dt_${d.island}_${x.id}`]).length;
        this.msg(n === d.tasks.length ? `${d.name} finished! Claim your reward in the Quests tab.` : `${d.name}: ${t.text} (${n}/${d.tasks.length})`, n === d.tasks.length ? 'good' : 'quest');
      }
    }
    this.s.flags.diary_seen = true;
  }

  /** A finished island diary: that island's harbourmaster takes you for nothing. */
  ferryPrice(base: number) { return this.s.flags[`diary_${this.s.region}`] ? 0 : base; }

  /** Claim a finished island diary (once): coins, XP and free ferries from that island. */
  claimDiary(island: string) {
    const d = DIARIES.find((x) => x.island === island);
    if (!d || this.s.flags[`diary_${island}`]) return;
    if (!diaryDone(d, this)) { this.msg('There\'s still more to do on that island.', 'warn'); return; }
    this.s.flags[`diary_${island}`] = true;
    this.give('coins', d.coins);
    for (const x of d.xp) this.addXp(x.skill, x.amount);
    this.msg(`${d.name} complete! ${d.coins} coins, and ${REGIONS[d.island].name}'s harbourmaster will ferry you free from now on.`, 'good');
    this.rev++;
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

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, style: CombatStyle, knock = 0.35, spellBase = 0, byPlayer = true) {
    if (!e.alive || e.state === 'rise') return;
    dmg = Math.min(dmg, e.hp);
    e.hp -= dmg;
    if (dmg > 0) e.hitFlash = 0.12;
    this.emit({ type: 'hit', target: 'enemy', id: e.id, amount: dmg, crit, x: e.x, z: e.z });
    if (byPlayer) this.combatXp(dmg, style, spellBase); // your mate's hits are theirs: no XP, no leech
    if (byPlayer && this.stats.leech > 0 && dmg > 0) this.p.hp = Math.min(this.stats.maxHp, this.p.hp + Math.max(HP_SCALE, Math.round(dmg * this.stats.leech)) * (this.rnd() < 0.5 ? 1 : 0));
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
    const before = this.drops.length;
    if (!e.summoned) { this.rollLoot(LOOT[e.def.loot], e.x, e.z); this.rollShared(e); }
    if (e.elite) this.rollLoot(LOOT.elite, e.x, e.z);
    for (let i = before; i < this.drops.length; i++) this.drops[i].home = true; // shot from range, it still reaches you
    if (e.def.boss) this.bossDefeated(e);
    this.onBountyKill(e);
    this.questKill(e.def.id);
    if (this.stats.sig === 'locksmith') this.keyCd = Math.max(0, this.keyCd - 5);
    if (this.stolen?.affix === 'volatile') for (const o of this.enemies) if (o !== e && o.alive && Math.hypot(o.x - e.x, o.z - e.z) < 2.6) this.damageEnemy(o, this.stats.maxHit, false, this.stats.style, 0.6);
    if (e.once) e.summoned = true; // gone for good once looted
    if (!e.summoned || e.once) this.rollKeyFind(this.stats.style, KEY_CONFIG.killChance * (1 + e.def.level / 40) * (e.def.boss ? 20 : e.elite ? 3 : 1));
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
    if (table.sig && this.rnd() < table.sig.chance) this.dropSig(table.sig.item, x, z);
    if (table.gear && this.rnd() < table.gear.chance) {
      const id = table.gear.items[Math.floor(this.rnd() * table.gear.items.length)];
      const rarity = rollRarity(table.gear.weights, this.rnd);
      this.dropAt(x, z, { id, qty: 1, inst: makeInstance(id, rarity, this.rnd, this.uid()) });
    }
  }

  /** The shared tables every creature can reach (drops.ts): the common table, the gem table, and from level 15 up
   * the rare drop table. Elites reach them more often; bosses always hit the gem and rare tables. */
  private rollShared(e: Enemy) {
    const r = this.rnd, lvl = e.def.level, k = e.elite ? DROP_CONFIG.eliteMul : 1, boss = !!e.def.boss;
    const pick = <T extends { w: number }>(list: T[]) => { let x = r() * list.reduce((a, b) => a + b.w, 0); return list.find((o) => (x -= o.w) <= 0) ?? list[list.length - 1]; };
    const drop = (item: string, qty: [number, number]) => this.dropAt(e.x, e.z, { id: item, qty: qty[0] + Math.floor(r() * (qty[1] - qty[0] + 1)) });
    if (r() < DROP_CONFIG.commonChance * k) { const c = pick(commonTable(lvl)).pick; drop(c.item, c.qty); }
    if (boss || r() < DROP_CONFIG.gemChance * k) this.dropGem(e.x, e.z);
    if (boss || (lvl >= DROP_CONFIG.rareFrom && r() < DROP_CONFIG.rareChance * k)) {
      const c = pick(rareTable(lvl)).pick;
      if (c === 'gem') this.dropGem(e.x, e.z); else drop(c.item, c.qty);
      this.msg('Rare drop!', 'loot');
    }
  }
  /** A rough gem from the gem table (pearls common, a leviathan's eye one in 60). */
  private dropGem(x: number, z: number) {
    let w = this.rnd() * GEMS.reduce((a, g) => a + g.w, 0);
    const g = GEMS.find((o) => (w -= o.w) <= 0) ?? GEMS[0];
    this.dropAt(x, z, { id: `gem_${g.key}_rough`, qty: 1 });
  }

  /** A signature weapon: always a relic, and the whole island hears about it. */
  private dropSig(id: string, x: number, z: number) {
    this.dropAt(x, z, { id, qty: 1, inst: makeInstance(id, 'relic', this.rnd, this.uid()) });
    this.emit({ type: 'sigDrop', id });
    this.msg(`Something rare falls: ${item(id).name}!`, 'loot');
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
    const max = (e.def.maxHit + (e.elite ? 1 : 0)) * HP_SCALE;
    const dmg = HP_SCALE + Math.floor(this.rnd() * (max - HP_SCALE + 1));
    if (e.fx.ward > 0) return 0; // Ward
    return e.fx.weak > 0 ? Math.max(HP_SCALE, Math.round(dmg * (1 - (KEY.smith.power.v ?? 50) / 100))) : dmg; // Rust
  }

  /** Unavoidable area damage (telegraphs): only a dodge roll or armour helps. */
  damagePlayer(raw: number) {
    raw *= HP_SCALE;
    const avgDef = (this.stats.def.melee + this.stats.def.ranged + this.stats.def.magic) / 3;
    this.applyPlayerDamage(Math.max(1, Math.round(raw * (1 - Math.min(0.4, Math.max(0, avgDef) / 150)))));
  }

  applyPlayerDamage(dmg: number) {
    if (this.dead || this.p.onShip) return;
    if (this.rollT > 0) { this.emit({ type: 'dodge', x: this.p.x, z: this.p.z }); return; }
    if (dmg > 0 && this.stats.dr) dmg = Math.max(1, Math.round(dmg * (1 - this.stats.dr)));
    this.p.hp -= dmg;
    this.combatTimer = 0;
    if (dmg > 0) for (const sl of ARMOUR_SLOTS) if (sl !== 'offhand' || (this.p.equip.offhand && item(this.p.equip.offhand.id).equip?.off === 'shield')) this.wear(this.p.equip[sl], WEAR.armour);
    this.emit({ type: 'hit', target: 'player', id: 0, amount: dmg, crit: false, x: this.p.x, z: this.p.z });
    if (this.p.hp <= 0) {
      this.p.hp = 0;
      this.dead = 3;
      this.path = [];
      this.stopAction();
      this.target = null;
      this.emit({ type: 'playerDeath' });
      this.msg(`Oh dear, you are dead. You wake at ${({ bellwether: 'the quay', sunreach: 'Port Halyard', amberhold: 'Tollhouse Landing', wrack: 'Gallows Landing', lockhaven: 'the Warden\'s Stair', saltglass: 'Glasswater Steps' } as const)[this.region.home]}.`, 'warn');
      if (this.boss) this.resetBoss();
    }
  }

  private respawnPlayer() {
    this.dead = 0;
    this.p.hp = this.stats.maxHp;
    const lost = Math.floor(count(this.p.inv, 'coins') * 0.1);
    if (lost > 0) { remove(this.p.inv, 'coins', lost); this.msg(`You wake in town, ${lost} coins lighter.`, 'warn'); }
    // fall in a cave and you wake in its island's town
    if (this.region.kind === 'cave') { this.travel({ to: this.region.home, how: 'respawn', from: this.s.region }); return; }
    this.p.x = this.layout.respawn.x;
    this.p.z = this.layout.respawn.z;
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
    const reach = st.range; // melee reach depends on the weapon (dagger 1.4, cutlass 1.6, pike 2.8)
    if (tgt) {
      const d = Math.hypot(tgt.x - this.p.x, tgt.z - this.p.z);
      if (d > reach + tgt.def.radius && !this.path.length && Math.hypot(this.moveDir.x, this.moveDir.z) < 0.05) this.chase(tgt.x, tgt.z, dt);
    }
    // auto-attack: explicit target first; otherwise whatever is already fighting you, or a hostile foe in melee reach.
    // A passive creature you merely walk past is left alone (Tom: only fight what you choose to)
    let best = tgt && Math.hypot(tgt.x - this.p.x, tgt.z - this.p.z) <= reach + tgt.def.radius ? tgt : null;
    if (!best) {
      let bd = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'rise') continue;
        const d = Math.hypot(e.x - this.p.x, e.z - this.p.z) - e.def.radius;
        const engaged = e.state === 'chase' || e.state === 'windup' || (st.style === 'melee' && !!e.def.hostile);
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
    if (this.walkStep(dx / d, dz / d, this.walkSpeed() * dt)) { this.moving = true; return; }
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
      const f = e.fx;
      f.root = Math.max(0, f.root - dt); f.disarm = Math.max(0, f.disarm - dt); f.slow = Math.max(0, f.slow - dt); f.shatter = Math.max(0, f.shatter - dt); f.lesson = Math.max(0, f.lesson - dt);
      f.weak = Math.max(0, f.weak - dt); f.ward = Math.max(0, f.ward - dt); f.bite = Math.max(0, f.bite - dt); f.turn = Math.max(0, f.turn - dt);
      if (e.alive && f.spoil > 0) {
        // Spoil: a slow rot, a whole point at a time
        f.spoil = Math.max(0, f.spoil - dt);
        f.spoilAcc += e.maxHp * ((KEY.cook.power.v ?? 1) / 100) * dt;
        if (f.spoilAcc >= HP_SCALE) { const d = Math.floor(f.spoilAcc / HP_SCALE) * HP_SCALE; f.spoilAcc -= d; this.damageEnemy(e, d, false, this.stats.style, 0); }
      }
      if (e.alive && f.fuse > 0) { f.fuse -= dt; if (f.fuse <= 0) this.burstFuse(e); }
      if (e.alive && f.turn > 0 && !e.def.boss) { this.stepTurncoat(e, dt); continue; }
      if (!e.alive) {
        if (!e.summoned && !e.def.boss && this.time >= e.respawnAt) {
          e.alive = true; e.x = e.spawnX; e.z = e.spawnZ; e.state = 'idle'; e.cd = 0; this.rollElite(e);
        }
        continue;
      }
      if (e.def.boss && e === this.boss) { this.stepBoss(e, dt); continue; } // a quest's boss (Corva, the Doorwarden) fights like a foe, not an arena's guardian
      const fr = (e.elite === 'frenzied' ? 1.4 : 1) * (e.fx.slow > 0 ? 0.6 : 1); // Becalm / Undertow slow everything they do
      e.cd = Math.max(0, e.cd - dt * fr);
      const dP = Math.hypot(px - e.x, pz - e.z);
      const dS = Math.hypot(e.spawnX - e.x, e.spawnZ - e.z);
      const speed = e.def.speed * fr;
      switch (e.state) {
        case 'idle': {
          // only camps, lairs and late-game foes attack on sight; the rest fight back when you hit them
          const calmed = (this.activeKey()?.passive.kind === 'sea_peace' && (e.def.model === 'crab' || e.def.look === 'drowned' || e.def.look === 'captain')) // Keel's Tooth
            || (this.s.flags.poachers_friend && e.def.look === 'poacher'); // The Toll of Tollhouse: Ulla's people know your face
          if (playerHittable && !inSafe && e.def.hostile && !calmed && dP < e.def.aggro * (e.elite && this.activeKey()?.passive.kind === 'listening' ? 1.5 : 1)) { e.state = 'chase'; break; }
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
            if (dP > atk.range * 0.9) this.enemyMove(e, px, pz, speed, dt, atk.range * 0.8);
            e.facing = Math.atan2(pz - e.z, px - e.x);
            if (dP <= atk.range && e.cd <= 0 && e.fx.disarm <= 0 && e.fx.bite <= 0) {
              e.state = 'windup'; e.t = atk.windup / fr; e.aim = { x: px, z: pz };
              this.telegraphs.push({ id: this.nextId++, kind: 'line', x: e.x, z: e.z, r: atk.range + 2, angle: Math.atan2(pz - e.z, px - e.x), width: 0.7, t: 0, dur: atk.windup / fr, damage: 0, source: e.id });
            }
          } else {
            if (dP > atk.range + e.def.radius * 0.5) this.enemyMove(e, px, pz, speed, dt, atk.range * 0.8);
            else if (e.cd <= 0 && e.fx.disarm <= 0 && e.fx.bite <= 0) { e.state = 'windup'; e.t = atk.windup / fr; this.emit({ type: 'enemyAttack', id: e.id }); }
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
          if (e.fx.spoil <= 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt); // Spoil stops the healing
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
    if (e.fx.root > 0) return; // Root: held fast
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

  // ------------------------------------------------------------------ bosses: the Lockbound Guardian, the Sunscale
  /** Strike an arena's altar: its guardian wakes (the Broken Ring's bell needs Iven's tuning bell). */
  private wakeGuardian(a: Arena) {
    if (a.boss === 'guardian' && count(this.p.inv, 'tuning_bell') < 1) {
      this.msg(this.questStage('bell') >= 1 ? 'A bell-shaped hollow. Iven\'s bell would fit here.' : 'A smooth hollow in the stone, shaped like a bell. Odd.');
      return;
    }
    if (this.boss) return;
    const def = ENEMIES[a.boss];
    const e = this.spawnEnemy(def, a.x, a.z - 1.5, false);
    e.state = 'rise';
    e.t = 2.2;
    this.boss = e;
    this.bossArena = a;
    this.fight = { boss: a.boss, start: this.time, ate: 0, caught: 0 };
    this.bossCast = 3.5;
    this.bossSummons = 0;
    this.emit({ type: 'boss', state: 'rise' });
    if (a.boss === 'storm_jotunn') this.msg('The horn\'s note rolls off the crag, and the sky answers. Lightning splits the stones, and the Thunder Jötunn stands up out of them!', 'combat');
    else if (a.boss === 'elder_lockjaw') this.msg('You knock. Something on the other side knocks back. Then the door opens its mouth: the Elder Lockjaw!', 'combat');
    else this.msg(a.boss === 'guardian' ? 'The bell sings. The stone answers. The Lockbound Guardian rises!' : a.boss === 'broodmother' ? 'The bones shift. Webs tremble across the hollow, and the Broodmother climbs out of the dark!' : 'The gong booms through the temple. Something vast uncoils beneath the flagstones: the Sunscale rises!', 'combat');
  }

  private stepBoss(e: Enemy, dt: number) {
    const R = this.bossArena ?? { x: e.spawnX, z: e.spawnZ };
    const px = this.p.x, pz = this.p.z;
    if (e.state === 'rise') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; return; }
    if (this.dead || this.p.onShip || Math.hypot(px - R.x, pz - R.z) > 24) { this.resetBoss(); return; }
    const serpent = e.def.id === 'temple_serpent', brood = e.def.id === 'broodmother', giant = e.def.id === 'storm_jotunn', jaw = e.def.id === 'elder_lockjaw';
    const frac = e.hp / e.maxHp;
    const enrage = (frac < 0.25 ? 1.35 : 1) * (e.fx.slow > 0 ? 0.6 : 1);
    // summons at 66% and 33%: crabs boil up round the Guardian, snakes drop from the temple's vines, the brood hatches
    if (e.fx.bite <= 0 && ((this.bossSummons === 0 && frac < 0.66) || (this.bossSummons === 1 && frac < 0.33))) {
      this.bossSummons++;
      for (let k = 0; k < (serpent ? 1 : 2); k++) { // one snake a wave: they're level 30, the crabs level 2
        const a = (k / 2) * Math.PI * 2 + this.rnd();
        const x = R.x + Math.cos(a) * 4.5, z = R.z + Math.sin(a) * 4.5;
        if (giant && k > 0) break; // one troll a wave: they hit hard
        if (jaw && k > 0) break; // one Lockjaw a wave: its children bite
        const c = this.spawnEnemy(serpent ? ENEMIES.jungle_snake : brood ? ENEMIES.weaver_young : giant ? ENEMIES.crag_troll : jaw ? ENEMIES.lockjaw : ENEMIES.reef_crab, x, z, true);
        c.state = 'chase';
      }
      this.emit({ type: 'boss', state: 'summon' });
      this.msg(jaw ? 'The Elder Lockjaw bangs its frame on the ground, and a smaller door in the ring tears itself loose and comes for you!' : giant ? 'The Jötunn roars, and a crag troll heaves itself up over the stones!' : serpent ? 'The Sunscale hisses. Snakes drop from the temple vines!' : brood ? 'Egg sacs split along the hollow\'s walls. Her brood comes for you!' : 'The Guardian strikes its chest-bell. Crabs boil up from the stones!', 'combat');
    }
    e.cd = Math.max(0, e.cd - dt * enrage);
    this.bossCast -= dt * enrage;
    const dP = Math.hypot(px - e.x, pz - e.z);
    if (e.state === 'windup') { e.t -= dt; if (e.t <= 0) e.state = 'chase'; return; }
    e.facing = Math.atan2(pz - e.z, px - e.x);
    // one telegraph at a time: never stack two attacks to land together
    if (this.telegraphs.some((t) => t.source === e.id) || e.fx.disarm > 0 || e.fx.bite > 0) { if (dP > 3.2) this.enemyMove(e, px, pz, e.def.speed * enrage * 0.6, dt, 3.0); return; }
    if (this.bossCast <= 0) {
      if (serpent) {
        // (telegraph damage is set for the Sunscale's level 32: Sunreach's finale, Tom's 15-30 band)
        // Venom spit: a long line toward where you stand, then a second, quicker cast soon after
        this.bossCast = this.bossSummons % 2 ? 4.5 : 6;
        this.telegraphs.push({ id: this.nextId++, kind: 'line', x: e.x, z: e.z, r: 13, angle: e.facing, width: 1.8, t: 0, dur: 1.1 / enrage, damage: 6, source: e.id });
      } else if (giant) {
        // Lightning: called down where you stand (set for its level 82: Stormwrack hits hard)
        this.bossCast = this.bossSummons > 0 ? 3.6 : 4.6;
        this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: px, z: pz, r: 3.2, angle: 0, width: 0, t: 0, dur: 1.2 / enrage, damage: 36, source: e.id });
      } else if (jaw) {
        // Slam: it hurls itself flat where you stand, the whole door's width (set for level 88)
        this.bossCast = this.bossSummons > 0 ? 4.2 : 5.2;
        this.telegraphs.push({ id: this.nextId++, kind: 'line', x: e.x, z: e.z, r: 9, angle: e.facing, width: 2.6, t: 0, dur: 1.1 / enrage, damage: 30, source: e.id });
      } else if (brood) {
        // Web spray: a wide splash of web where you stand
        this.bossCast = 5.5;
        this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: px, z: pz, r: 3.4, angle: 0, width: 0, t: 0, dur: 1.3 / enrage, damage: 8, source: e.id });
      } else {
        // Slam: telegraphed circle where the player stands
        this.bossCast = 7;
        this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: px, z: pz, r: 3.0, angle: 0, width: 0, t: 0, dur: 1.4 / enrage, damage: 5, source: e.id });
      }
      e.state = 'windup'; e.t = 0.6;
      this.emit({ type: 'enemyAttack', id: e.id });
      return;
    }
    if (dP < 4.2 && e.cd <= 0) {
      e.cd = serpent || brood || giant || jaw ? 3.4 : 4;
      if (giant && this.rnd() < 0.45) {
        // Thunder stomp: the whole ground round it shakes; roll out of the ring
        this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: e.x, z: e.z, r: 5.4, angle: 0, width: 0, t: 0, dur: 1.3 / enrage, damage: 40, source: e.id });
        e.state = 'windup'; e.t = 1.3 / enrage;
      } else if (giant) {
        // Club sweep: a wide cone in front
        this.telegraphs.push({ id: this.nextId++, kind: 'cone', x: e.x, z: e.z, r: 5.8, angle: e.facing, width: 2.1, t: 0, dur: 1.0 / enrage, damage: 30, source: e.id });
        e.state = 'windup'; e.t = 1.0 / enrage;
      } else if (jaw) {
        // Bite: the top half yawns and slams in front of it
        this.telegraphs.push({ id: this.nextId++, kind: 'cone', x: e.x, z: e.z, r: 4.6, angle: e.facing, width: 1.6, t: 0, dur: 0.9 / enrage, damage: 26, source: e.id });
        e.state = 'windup'; e.t = 0.9 / enrage;
      } else if ((serpent || brood) && this.rnd() < 0.45) {
        // Coil crush (serpent) / leg sweep (Broodmother): the whole ground round her, roll out or take it
        this.telegraphs.push({ id: this.nextId++, kind: 'circle', x: e.x, z: e.z, r: brood ? 4.6 : 4.2, angle: 0, width: 0, t: 0, dur: 1.2 / enrage, damage: brood ? 9 : 7, source: e.id });
        e.state = 'windup'; e.t = 1.2 / enrage;
      } else {
        // Sweep (Guardian) / tail lash (serpent): cone in front
        this.telegraphs.push({ id: this.nextId++, kind: 'cone', x: e.x, z: e.z, r: serpent || brood ? 5.2 : 4.8, angle: e.facing, width: serpent ? 2.3 : brood ? 2.0 : 1.9, t: 0, dur: 0.9 / enrage, damage: serpent ? 5 : brood ? 8 : 3, source: e.id });
        e.state = 'windup'; e.t = 0.9 / enrage;
      }
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
    this.bossArena = null;
    this.fight = null;
    this.emit({ type: 'boss', state: 'reset' });
    if (b.def.id === 'storm_jotunn') { this.msg('The Jötunn sinks back into the stones in a crack of thunder. Sound the horn to call it again.', 'combat'); return; }
    if (b.def.id === 'elder_lockjaw') { this.msg('The Elder Lockjaw shuts its mouth and is a door again. Knock to wake it.', 'combat'); return; }
    this.msg(b.def.id === 'temple_serpent' ? 'The Sunscale slides back under the flagstones. Strike the gong to face it again.' : b.def.id === 'broodmother' ? 'The Broodmother draws back into the dark. Disturb the bones to call her out again.' : 'The Guardian sinks back into the stone. Ring the bell to try again.', 'combat');
  }

  /** Feats (data/feats.ts): your points, and the lasting edges they've earned. */
  featPoints() { return (this.s.feats ?? []).reduce((a, id) => a + (FEAT_BY[id]?.pts ?? 0), 0); }
  featTiers() { const p = this.featPoints(); return FEAT_TIERS.filter((t) => p >= t.pts); }
  private scoreFeats(boss: string) {
    const f = this.fight;
    this.fight = null;
    const kills = { ...(this.s.bossKills ?? {}) };
    kills[boss] = (kills[boss] ?? 0) + 1;
    this.s.bossKills = kills;
    const done = new Set(this.s.feats ?? []), tiers0 = this.featTiers().length;
    for (const ft of FEATS) {
      if (ft.boss !== boss || done.has(ft.id)) continue;
      const ok = ft.kind === 'kills' ? kills[boss] >= (ft.n ?? 1)
        : !f || f.boss !== boss ? false
        : ft.kind === 'nofood' ? f.ate === 0 : ft.kind === 'speed' ? this.time - f.start <= (ft.n ?? 0) : f.caught === 0;
      if (!ok) continue;
      done.add(ft.id);
      this.msg(`Feat: ${ft.name}. ${ft.text} (+${ft.pts} point${ft.pts > 1 ? 's' : ''})`, 'good');
    }
    this.s.feats = [...done];
    const tiers = this.featTiers();
    if (tiers.length > tiers0) { const t = tiers[tiers.length - 1]; this.msg(`${t.name}: ${t.text}, from now on.`, 'good'); this.emit({ type: 'banner', title: t.name, sub: t.text }); this.recalc(); }
  }

  private bossDefeated(e: Enemy) {
    this.boss = null;
    this.bossArena = null;
    this.enemies = this.enemies.filter((x) => x !== e);
    for (const c of this.enemies) if (c.summoned && c.alive) { c.alive = false; this.emit({ type: 'enemyDeath', id: c.id, x: c.x, z: c.z, elite: false, boss: false }); }
    this.enemies = this.enemies.filter((x) => !x.summoned);
    this.scoreFeats(e.def.id);
    const LINE: Record<string, string> = { guardian: 'The Broken Ring falls silent', temple_serpent: 'The Sunken Temple is still', storm_jotunn: 'The storm over the crag breaks', broodmother: 'Weaver Hollow goes quiet', elder_lockjaw: 'The Field of Doors falls quiet' };
    this.emit({ type: 'boss', state: 'defeat', name: `${e.def.name} defeated`, sub: LINE[e.def.id] ?? 'It won\'t rise again today' });
    if (e.def.id === 'temple_serpent') {
      if (!this.s.flags.serpent_defeated) this.msg('The Sunscale lies still. Its scales shine like hammered gold.', 'good');
      this.s.flags.serpent_defeated = true;
      return;
    }
    if (e.def.id === 'storm_jotunn') {
      if (!this.s.flags.jotunn_defeated) this.msg('The Thunder Jötunn falls, and the storm over the crag breaks into rain. Stormwrack is quiet for the first time in years.', 'good');
      this.s.flags.jotunn_defeated = true;
      return;
    }
    if (e.def.id === 'broodmother') {
      if (!this.s.flags.broodmother_defeated) this.msg('The Broodmother curls up and is still. Weaver Hollow goes quiet.', 'good');
      this.s.flags.broodmother_defeated = true;
      return;
    }
    if (e.def.id === 'elder_lockjaw') {
      if (!this.s.flags.elderjaw_defeated) this.msg('The Elder Lockjaw shudders, sags on its hinges, and is only a door again. Every door in the Field swings shut at once.', 'good');
      this.s.flags.elderjaw_defeated = true;
      return;
    }
    if (e.def.id !== 'guardian') return; // a quest's boss (Corva, the Doorwarden): its stage has already counted it
    this.s.flags.guardian_defeated = true;
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
      const src = this.enemies.find((e) => e.id === t.source);
      const warded = !!src && src.fx.ward > 0, rusted = !!src && src.fx.weak > 0;
      if (t.damage > 0 && !warded && this.insideTelegraph(t, this.p.x, this.p.z)) { if (this.fight && this.rollT <= 0 && t.source === this.boss?.id) this.fight.caught++; this.damagePlayer(rusted ? t.damage / 2 : t.damage); }
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
    // round obstacles (pillars, trunks): glance off at an angle rather than stopping dead
    const a = Math.atan2(uz, ux);
    for (const off of [0.5, -0.5, 1.0, -1.0]) {
      const sx = p.x + Math.cos(a + off) * dist * 0.8, sz = p.z + Math.sin(a + off) * dist * 0.8;
      if (this.world.walkable(sx, sz)) { p.x = sx; p.z = sz; return true; }
    }
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
      this.moving = this.walkStep(this.moveDir.x / m, this.moveDir.z / m, this.walkSpeed() * Math.min(1, m) * dt);
    } else if (this.path.length) {
      let budget = this.walkSpeed() * dt;
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
      const reach = d.home ? 16 : 3, speed = d.home ? 10 : 6;
      if (dist < reach && dist > 0.01) { d.x += (dx / dist) * Math.min(dist, speed * dt); d.z += (dz / dist) * Math.min(dist, speed * dt); }
      if (dist < 0.8) {
        if (!canAdd(this.p.inv, d.stack.id)) {
          if (this.time - this.fullWarned > 4) { this.fullWarned = this.time; this.msg('Your pack is full.', 'warn'); }
          continue;
        }
        add(this.p.inv, d.stack);
        this.collect(d.stack.id);
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
      if (this.s.discovered.includes(pl.id) || placeRegion(pl) !== this.s.region) continue;
      if (!!pl.sea !== this.p.onShip && pl.sea) continue;
      if (Math.hypot(pl.x - this.p.x, pl.z - this.p.z) < pl.r) {
        this.s.discovered.push(pl.id);
        this.emit({ type: 'discover', id: pl.id, name: pl.name });
        this.msg(`Discovered: ${pl.name}`, 'quest');
        this.rollKeyFind('explore', KEY_CONFIG.placeChance);
        this.rev++;
      }
    }
  }

  // ------------------------------------------------------------------ main step
  step(dt: number) {
    if (this.travelling) return; // the loading screen is up
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.s.playTime += dt;
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.keyCd = Math.max(0, this.keyCd - dt);
    if (this.stolen) { this.stolen.t -= dt; if (this.stolen.t <= 0) { this.stolen = null; this.recalc(); this.msg('The stolen power fades.'); } }
    if (this.s.keyDormant > 0) { this.s.keyDormant = Math.max(0, this.s.keyDormant - dt); if (this.s.keyDormant === 0) { this.recalc(); this.msg(`Your ${KEY[this.s.key ?? '']?.name ?? 'key'} wakes.`, 'good'); } }
    this.utilityCd = Math.max(0, this.utilityCd - dt);
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
        if (amt > 0 && this.p.hp < this.stats.maxHp) this.p.hp = Math.min(this.stats.maxHp, this.p.hp + amt * HP_SCALE);
      }
      if (this.mendLeft > 0) { const d = Math.min(dt, this.mendLeft); this.mendLeft -= d; this.p.hp = Math.min(this.stats.maxHp, this.p.hp + this.stats.maxHp * 0.03 * d); }
      if (this.s.meal && this.s.meal.left > 0) {
        this.s.meal.left -= dt;
        if (this.s.meal.left <= 0) { this.msg(`The ${item(this.s.meal.id).name.toLowerCase()} has worn off.`, 'info'); this.s.meal = undefined; this.recalc(); }
      }
      this.stepDiscovery();
      this.stepBounties();
      this.stepQuestFoes();
      this.storm.step(dt);
      this.belltime.step();
      this.regatta.step();
      this.fire.step(dt);
      this.seep.step(dt);
      this.stepDiaries();
    }
    this.stepMate(dt);
    if (this.region.kind === 'island') this.naval.step(dt);
    this.stepEnemies(dt);
    this.stepProjectiles(dt);
    this.stepDrops(dt);
    for (const n of this.nodes) if (n.depletedUntil && n.depletedUntil <= this.time) { n.depletedUntil = 0; n.left = this.rollYield(n.def); this.rev++; }
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
