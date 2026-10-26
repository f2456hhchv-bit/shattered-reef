import type { Game, Target } from './game';
import { count, remove, canAdd } from './inventory';
import { item } from '../data/items';
import { AMBER_LAYOUT } from '../world/island';

// The Amber Seep (docs/ISLANDS.md: Amberhold's skilling boss, a Mining and Crafting fight). Strike the crack on
// Goldvein Hill's west flank and the hill splits open on a seam of amber. Mine it before the hill closes again, tip
// it into the cart, and set amber into braces at the bench to shore up the tunnel's three supports as they groan.
// Let the tunnel give way and it's over; hold it until the hill closes and the hill pays out. About three minutes.

export const SEEP = {
  /** how long the hill stays open, and the tunnel's strength: it sags this much a second */
  duration: 180,
  stability: 100,
  sag: 0.95,
  /** a brace set into a support shores the tunnel up this much */
  brace: 22,
  /** rockfalls: marked patches where you stand, every so often */
  rockEvery: [7, 10] as [number, number],
  rockDamage: 3,
  /** reward: one roll per this many points (amber in the cart 2, a brace set 3), as the other skilling bosses */
  pointsPerRoll: 9,
  maxRolls: 8,
  /** a run counts as held only if you did something: a few points at least */
  minPoints: 6,
};

const OUTFIT = ['prospector_hat', 'prospector_coat', 'prospector_legs', 'prospector_boots'];

export class AmberSeep {
  running = false;
  stability = SEEP.stability;
  left = 0;
  points = 0;
  private endsAt = 0;
  private nextRock = 0;

  constructor(private g: Game) {}

  /** Where things are: the crack on Goldvein Hill's west flank, the seams inside it, the bench, the cart. */
  spots() {
    const g = this.g;
    if (g.s.region !== 'amberhold') return null;
    const G = AMBER_LAYOUT.goldhill, sx = G.x - 22, sz = G.z - 4;
    const at = (x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 4); return q ? { x: q[0], z: q[1] } : { x, z }; };
    return {
      crack: at(sx, sz), bench: at(sx - 4, sz + 6), cart: at(sx + 4, sz + 6),
      supports: [at(sx - 6, sz + 1), at(sx + 6, sz + 1), at(sx, sz - 2)],
    };
  }

  targets(): Target[] {
    const s = this.spots();
    if (!s || this.g.p.onShip) return [];
    if (!this.running) return [{ key: 'event:seep:crack', kind: 'event', x: s.crack.x, z: s.crack.z, range: 2.2, label: 'Crack in the hill', verb: 'Strike' }];
    return [
      { key: 'event:seep:bench', kind: 'event', x: s.bench.x, z: s.bench.z, range: 2.2, label: 'Brace bench', verb: 'Make braces' },
      { key: 'event:seep:cart', kind: 'event', x: s.cart.x, z: s.cart.z, range: 2.2, label: 'Ore cart', verb: 'Tip amber' },
      ...s.supports.map((p, k) => ({ key: `event:seep:prop:${k}`, kind: 'event' as const, x: p.x, z: p.z, range: 2.2, label: 'Groaning support', verb: 'Shore up' })),
    ];
  }

  use(key: string) {
    const g = this.g;
    if (key === 'event:seep:crack') return this.start();
    if (!this.running) return;
    if (key === 'event:seep:bench') {
      const n = Math.min(Math.floor(count(g.p.inv, 'raw_amber') / 2), count(g.p.inv, 'logs_pine') + count(g.p.inv, 'logs_oak') + count(g.p.inv, 'logs_willow') + count(g.p.inv, 'logs_amber'));
      if (n === 0) { g.msg('A brace takes two lumps of amber and a log. Mine the seams; the bench has no timber of its own.', 'warn'); return; }
      remove(g.p.inv, 'raw_amber', n * 2);
      let logs = n;
      for (const l of ['logs_pine', 'logs_oak', 'logs_willow', 'logs_amber']) { const t = Math.min(logs, count(g.p.inv, l)); remove(g.p.inv, l, t); logs -= t; }
      g.give('amber_brace', n);
      g.addXp('crafting', n * 30);
      g.msg(`You set amber into ${n} brace${n > 1 ? 's' : ''}.`, 'good');
      g.rev++;
      return;
    }
    if (key === 'event:seep:cart') {
      const n = count(g.p.inv, 'raw_amber');
      if (n === 0) { g.msg('Nothing to tip in. Mine the amber seams.', 'warn'); return; }
      remove(g.p.inv, 'raw_amber', n);
      this.points += n * 2;
      g.addXp('mining', n * 8);
      g.msg(`You tip ${n} lump${n > 1 ? 's' : ''} of amber into the cart.`, 'good');
      g.rev++;
      return;
    }
    if (/^event:seep:prop:\d+$/.test(key)) {
      if (count(g.p.inv, 'amber_brace') === 0) { g.msg('You need an amber brace: two amber and a log at the brace bench.', 'warn'); return; }
      remove(g.p.inv, 'amber_brace', 1);
      this.stability = Math.min(SEEP.stability, this.stability + SEEP.brace);
      this.points += 3;
      g.addXp('crafting', 20); g.addXp('mining', 10);
      g.msg('You hammer the brace in. The timbers stop groaning.', 'good');
      g.rev++;
    }
  }

  start() {
    const g = this.g;
    if (this.running) return;
    if (!g.bestTool('mining')) { g.msg('You need a pickaxe to break the crack open.', 'warn'); return; }
    this.running = true;
    this.stability = SEEP.stability; this.points = 0;
    this.endsAt = g.time + SEEP.duration; this.left = SEEP.duration;
    this.nextRock = g.time + 6;
    for (const n of g.nodes) if (n.def === 'amber_seep') n.depletedUntil = 0;
    g.msg('Your pick bites, and the hill splits along a seam of amber! Mine it, cart it, and brace the tunnel before it closes on you.', 'combat');
    g.emit({ type: 'boss', state: 'rise' });
    g.rev++;
  }

  private end(held: boolean) {
    const g = this.g;
    this.running = false;
    for (const n of g.nodes) if (n.def === 'amber_seep') n.depletedUntil = Infinity;
    for (let k = g.telegraphs.length - 1; k >= 0; k--) if (g.telegraphs[k].source === -997) g.telegraphs.splice(k, 1);
    for (const b of ['raw_amber', 'amber_brace']) remove(g.p.inv, b, count(g.p.inv, b)); // the hill keeps what's still inside
    if (!held || this.points < SEEP.minPoints) {
      g.msg(held ? 'The hill closes with a sigh, and you\'ve little to show for it. Strike the crack again when you\'re ready.' : 'The tunnel gives way! You scramble out ahead of the dust. Strike the crack to try again.', 'warn');
      g.rev++;
      return;
    }
    const rolls = Math.min(SEEP.maxRolls, 1 + Math.floor(this.points / SEEP.pointsPerRoll));
    const got: string[] = [];
    const take = (id: string, qty: number) => { if (canAdd(g.p.inv, id)) { g.give(id, qty); got.push(`${qty > 1 ? `${qty} × ` : ''}${item(id).name}`); } };
    for (let r = 0; r < rolls; r++) {
      const x = g.rnd();
      const missing = OUTFIT.filter((o) => count(g.p.inv, o) === 0 && !Object.values(g.p.equip).some((st) => st?.id === o));
      if (x < 0.14 && missing.length) take(missing[Math.floor(g.rnd() * missing.length)], 1);
      else if (x < 0.38) take('coins', 80 + Math.floor(g.rnd() * 120));
      else if (x < 0.56) take('ore_gold', 2 + Math.floor(g.rnd() * 3));
      else if (x < 0.7) take('ore_coal', 4 + Math.floor(g.rnd() * 6));
      else if (x < 0.8) take('ore_storm', 1 + Math.floor(g.rnd() * 2));
      else if (x < 0.9) take('crystal_geode', 1);
      else if (x < 0.97) take('logs_amber', 3 + Math.floor(g.rnd() * 3));
      else take('casket', 1);
    }
    g.addXp('mining', 250); g.addXp('crafting', 200);
    g.s.flags.seep_held = true;
    g.msg(`The hill closes with a long groan, and the tunnel holds. The cart's yours to share out: ${got.join(', ') || 'nothing you can carry'}.`, 'good');
    g.emit({ type: 'boss', state: 'defeat' });
    g.rev++;
  }

  step(dt: number) {
    if (!this.running) return;
    const g = this.g, s = this.spots();
    if (!s) { this.running = false; return; } // left Amberhold: the hill closes behind you
    this.left = Math.max(0, this.endsAt - g.time);
    this.stability = Math.max(0, this.stability - SEEP.sag * dt);
    if (this.stability <= 0) { this.end(false); return; }
    if (this.left <= 0) { this.end(true); return; }
    if (g.time >= this.nextRock) {
      // the roof drops stones: a marked patch where you stand, near the seep
      this.nextRock = g.time + SEEP.rockEvery[0] + g.rnd() * (SEEP.rockEvery[1] - SEEP.rockEvery[0]);
      if (!g.p.onShip && Math.hypot(g.p.x - s.crack.x, g.p.z - s.crack.z) < 14)
        g.telegraphs.push({ id: g.nextId++, kind: 'circle', x: g.p.x, z: g.p.z, r: 2, angle: 0, width: 0, t: 0, dur: 1.3, damage: SEEP.rockDamage, source: -997 });
    }
  }
}
