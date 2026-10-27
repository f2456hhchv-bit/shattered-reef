import type { Game } from './game';
import type { Target } from './game';
import { count, remove, canAdd } from './inventory';
import { item } from '../data/items';

// The Storm Tide (docs/ISLANDS.md: Bellwether's skilling boss, in the spirit of RuneScape's Tempoross). Ring the
// storm bell on the quay: a tide-serpent rises off the pier. Fish the storm shoals beside it, cook the catch at the
// quay fire if you like (cooked hits twice as hard), and fire it from the harbour cannon at the serpent. Waves smash
// planks out of the pier: patch them with logs before the quay gives way. The serpent's surges are telegraphed;
// step out of them. Solo, about ten minutes; your work decides the reward.

export const STORM = {
  serpent: 100, // the serpent's strength
  rawHit: 2, // what a raw herring knocks off it
  cookedHit: 4,
  dock: 100,
  /** a smashed plank lets the sea in: the quay loses this much a second for each one open */
  leak: 0.9,
  planks: 4,
  /** seconds between waves that smash a plank, and between the serpent's surges */
  waveEvery: [11, 16] as [number, number],
  surgeEvery: [7, 10] as [number, number],
  surgeDamage: 4,
  /** reward: one roll per this many points (a herring fired is a point, cooked two, a plank mended three) */
  pointsPerRoll: 12,
  maxRolls: 8,
};

const OUTFIT = ['oilskin_hat', 'oilskin_coat', 'oilskin_legs', 'sea_boots'];

export class StormTide {
  running = false;
  serpent = STORM.serpent;
  dock = STORM.dock;
  /** which pier planks are smashed */
  broken: boolean[] = new Array(STORM.planks).fill(false);
  points = 0;
  private nextWave = 0;
  private nextSurge = 0;

  constructor(private g: Game) {}

  /** Where things are: on Bellwether's pier, worked out from the dock. */
  spots() {
    const d = this.g.layout.dock;
    if (this.g.s.region !== 'bellwether' || !d) return null;
    const plank = (k: number) => ({ x: d.x + (k % 2 ? 0.5 : -0.5), z: d.zStart + 1.5 + (k * (d.len - 3)) / (STORM.planks - 1) });
    return {
      bell: { x: d.x - 3.2, z: d.zStart - 1.2 },
      cannon: { x: d.x + 1.6, z: d.headZ + 0.2 }, // the harbour gun, rolled out onto the pier head
      planks: Array.from({ length: STORM.planks }, (_, k) => plank(k)),
      serpent: { x: d.x - 10, z: d.headZ + 9 }, // off the pier head, clear of a moored sloop
    };
  }

  targets(): Target[] {
    const s = this.spots();
    if (!s || this.g.p.onShip) return [];
    const out: Target[] = [];
    if (!this.running) out.push({ key: 'event:bell', kind: 'event', x: s.bell.x, z: s.bell.z, range: 2.2, label: 'Storm bell', verb: 'Ring' });
    else {
      out.push({ key: 'event:cannon', kind: 'event', x: s.cannon.x, z: s.cannon.z, range: 2.2, label: 'Harbour cannon', verb: 'Fire' });
      s.planks.forEach((p, k) => { if (this.broken[k]) out.push({ key: `event:plank:${k}`, kind: 'event', x: p.x, z: p.z, range: 1.8, label: 'Smashed plank', verb: 'Patch' }); });
    }
    return out;
  }

  use(key: string) {
    const g = this.g;
    if (key === 'event:bell') return this.start();
    if (!this.running) return;
    if (key === 'event:cannon') {
      const raw = count(g.p.inv, 'storm_herring_raw'), cooked = count(g.p.inv, 'storm_herring');
      if (raw + cooked === 0) { g.msg('The cannon needs fish to fire: catch storm herring at the shoals by the pier.', 'warn'); return; }
      remove(g.p.inv, 'storm_herring_raw', raw); remove(g.p.inv, 'storm_herring', cooked);
      const hit = raw * STORM.rawHit + cooked * STORM.cookedHit;
      this.serpent = Math.max(0, this.serpent - hit);
      this.points += raw + cooked * 2;
      g.addXp('fishing', raw * 4 + cooked * 6);
      const sp = this.spots()!.serpent;
      g.emit({ type: 'explode', x: sp.x, z: sp.z, r: 3 });
      g.msg(`Boom! ${raw + cooked} herring into the serpent's jaws. It reels. (${Math.ceil(this.serpent)}% left)`, 'combat');
      if (this.serpent <= 0) this.end(true);
      g.rev++;
      return;
    }
    const m = /^event:plank:(\d+)$/.exec(key);
    if (m) {
      const k = Number(m[1]);
      if (!this.broken[k]) return;
      const log = ['logs_pine', 'logs_oak', 'logs_willow'].find((l) => count(g.p.inv, l) > 0);
      if (!log) { g.msg('You need a log to patch the plank.', 'warn'); return; }
      remove(g.p.inv, log, 1);
      this.broken[k] = false;
      this.points += 3;
      g.addXp('smithing', 20); g.addXp('woodcutting', 10);
      g.msg('You hammer a new plank across the gap.', 'good');
      g.rev++;
    }
  }

  start() {
    const g = this.g;
    if (this.running) return;
    this.running = true;
    this.serpent = STORM.serpent; this.dock = STORM.dock; this.points = 0;
    this.broken.fill(false);
    this.nextWave = g.time + 8; this.nextSurge = g.time + 6;
    for (const n of g.nodes) if (n.def === 'spot_storm') n.depletedUntil = 0;
    g.msg('The storm bell clangs. Black water heaves off the pier, and a tide-serpent rises out of it! Fish the shoals, feed the cannon, keep the pier standing.', 'combat');
    g.emit({ type: 'boss', state: 'rise' });
    g.rev++;
  }

  private end(won: boolean) {
    const g = this.g;
    this.running = false;
    for (const n of g.nodes) if (n.def === 'spot_storm') n.depletedUntil = Infinity;
    for (let k = g.telegraphs.length - 1; k >= 0; k--) if (g.telegraphs[k].source === -999) g.telegraphs.splice(k, 1);
    if (!won) { g.msg('The pier gives way and the serpent sinks back into the storm. The quay will hold for another try.', 'warn'); g.rev++; return; }
    // the reward: a roll per share of the work
    const rolls = Math.min(STORM.maxRolls, 1 + Math.floor(this.points / STORM.pointsPerRoll));
    const got: string[] = [];
    const take = (id: string, qty: number) => { if (canAdd(g.p.inv, id)) { g.give(id, qty); got.push(`${qty > 1 ? `${qty} × ` : ''}${item(id).name}`); } };
    for (let r = 0; r < rolls; r++) {
      const x = g.rnd();
      const missing = OUTFIT.filter((o) => count(g.p.inv, o) === 0 && !Object.values(g.p.equip).some((st) => st?.id === o));
      if (x < 0.12 && missing.length) take(missing[Math.floor(g.rnd() * missing.length)], 1);
      else if (x < 0.4) take('coins', 40 + Math.floor(g.rnd() * 80));
      else if (x < 0.6) take('fish_trout_raw', 2 + Math.floor(g.rnd() * 3));
      else if (x < 0.75) take('chain_shot', 6 + Math.floor(g.rnd() * 8));
      else if (x < 0.85) take('depth_charge', 1 + Math.floor(g.rnd() * 2));
      else if (x < 0.95) take('charm_tide', 15 + Math.floor(g.rnd() * 20));
      else take('casket', 1);
    }
    g.addXp('fishing', 150);
    g.s.flags.storm_tide_won = true;
    g.msg(`The serpent breaks and sinks! The harbour crew share out the salvage: ${got.join(', ') || 'nothing you can carry'}.`, 'good');
    g.emit({ type: 'boss', state: 'defeat', name: 'The Storm Tide breaks', sub: 'Bellwether\'s pier stands' });
    g.rev++;
  }

  step(dt: number) {
    if (!this.running) return;
    const g = this.g, s = this.spots();
    if (!s) { this.running = false; return; } // left Bellwether: the storm blows itself out
    // open planks let the sea in
    const open = this.broken.filter(Boolean).length;
    this.dock = Math.max(0, this.dock - open * STORM.leak * dt);
    if (this.dock <= 0) { this.end(false); return; }
    const span = ([a, b]: [number, number]) => a + g.rnd() * (b - a);
    if (g.time >= this.nextWave) {
      this.nextWave = g.time + span(STORM.waveEvery);
      const whole = this.broken.map((b, k) => (b ? -1 : k)).filter((k) => k >= 0);
      if (whole.length) {
        const k = whole[Math.floor(g.rnd() * whole.length)];
        this.broken[k] = true;
        g.emit({ type: 'explode', x: s.planks[k].x, z: s.planks[k].z, r: 1.5 });
        g.msg('A wave smashes through the pier! Patch the plank before the sea gets in.', 'warn');
        g.rev++;
      }
    }
    if (g.time >= this.nextSurge) {
      // the serpent surges: a marked ring of water where you stand, a moment to step clear
      this.nextSurge = g.time + span(STORM.surgeEvery);
      if (!g.p.onShip && Math.hypot(g.p.x - s.cannon.x, g.p.z - s.cannon.z) < 40)
        g.telegraphs.push({ id: g.nextId++, kind: 'circle', x: g.p.x, z: g.p.z, r: 2.4, angle: 0, width: 0, t: 0, dur: 1.4, damage: STORM.surgeDamage, source: -999 });
    }
  }
}
