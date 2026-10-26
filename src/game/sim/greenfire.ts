import type { Game, Target } from './game';
import { count, remove, canAdd } from './inventory';
import { item } from '../data/items';
import { SUN_LAYOUT } from '../world/island';

// The Greenheart Fire (docs/ISLANDS.md: Sunreach's skilling boss, a Woodcutting and Fletching fight). Sound the horn
// at the fire camp: a grove of twelve thickets catches fire, and the fire spreads from thicket to thicket while
// embers start new ones. Cut bamboo, lash it into buckets at the camp bench, fill them at the stream and douse the
// fires; fell a firebreak to stop it spreading. Douse fifteen fires and the Greenheart is saved; let five thickets burn
// to ash and it's lost. About as long as the Storm Tide; your work decides the reward.

export const FIRE = {
  cols: 4,
  rows: 3,
  spacing: 5,
  /** fires doused to save the Greenheart, thickets burnt to lose it */
  win: 15,
  lose: 5,
  /** a burning thicket burns to ash after this long */
  burn: 40,
  /** seconds between the fire spreading to a neighbour, and between embers starting a new fire */
  spreadEvery: [6, 9] as [number, number],
  emberEvery: [14, 20] as [number, number],
  /** felling a firebreak takes your breath: one every this many seconds */
  breakCd: 5,
  /** the heat: a marked patch where you stand when you're near the fire */
  heatEvery: [8, 11] as [number, number],
  heatDamage: 3,
  /** reward: one roll per this many points (a fire doused 3, a firebreak 1, a bucket made 1), as the Storm Tide */
  pointsPerRoll: 6,
  maxRolls: 8,
};

export type Thicket = 'green' | 'fire' | 'ash' | 'break';
const OUTFIT = ['warden_hat', 'warden_coat', 'warden_legs', 'warden_boots'];

export class GreenheartFire {
  running = false;
  cells: Thicket[] = new Array(FIRE.cols * FIRE.rows).fill('green');
  /** when each burning thicket caught */
  lit: number[] = new Array(FIRE.cols * FIRE.rows).fill(0);
  doused = 0;
  points = 0;
  private nextSpread = 0;
  private nextEmber = 0;
  private nextHeat = 0;
  private breakReady = 0;

  constructor(private g: Game) {}

  /** Where things are: the grove west of the Greenheart's heart, the camp beside it, the stream below. */
  spots() {
    const g = this.g;
    if (g.s.region !== 'sunreach') return null;
    const J = SUN_LAYOUT.jungle, cx = J.x - 24, cz = J.z;
    const at = (x: number, z: number) => { const q = g.world.nearestWalkable(x, z, 4); return q ? { x: q[0], z: q[1] } : { x, z }; };
    const cells = Array.from({ length: FIRE.cols * FIRE.rows }, (_, k) => at(cx + ((k % FIRE.cols) - (FIRE.cols - 1) / 2) * FIRE.spacing, cz + (Math.floor(k / FIRE.cols) - (FIRE.rows - 1) / 2) * FIRE.spacing));
    return { cells, horn: at(J.x - 14, J.z + 10), bench: at(J.x - 11, J.z + 12), stream: at(cx - 8, cz + 9) };
  }

  neighbours(k: number) {
    const c = k % FIRE.cols, r = Math.floor(k / FIRE.cols), out: number[] = [];
    if (c > 0) out.push(k - 1);
    if (c < FIRE.cols - 1) out.push(k + 1);
    if (r > 0) out.push(k - FIRE.cols);
    if (r < FIRE.rows - 1) out.push(k + FIRE.cols);
    return out;
  }

  get ashed() { return this.cells.filter((c) => c === 'ash').length; }

  targets(): Target[] {
    const s = this.spots();
    if (!s || this.g.p.onShip) return [];
    if (!this.running) return [{ key: 'event:gf:horn', kind: 'event', x: s.horn.x, z: s.horn.z, range: 2.2, label: 'Fire horn', verb: 'Sound' }];
    const out: Target[] = [
      { key: 'event:gf:bench', kind: 'event', x: s.bench.x, z: s.bench.z, range: 2.2, label: 'Fire camp bench', verb: 'Lash' },
      { key: 'event:gf:stream', kind: 'event', x: s.stream.x, z: s.stream.z, range: 2.6, label: 'Stream', verb: 'Fill' },
    ];
    s.cells.forEach((p, k) => {
      const c = this.cells[k];
      if (c === 'fire') out.push({ key: `event:gf:cell:${k}`, kind: 'event', x: p.x, z: p.z, range: 2.4, label: 'Burning thicket', verb: 'Douse' });
      else if (c === 'green' && this.neighbours(k).some((n) => this.cells[n] === 'fire')) out.push({ key: `event:gf:cell:${k}`, kind: 'event', x: p.x, z: p.z, range: 2.2, label: 'Thicket in the fire\'s path', verb: 'Fell' });
    });
    return out;
  }

  use(key: string) {
    const g = this.g;
    if (key === 'event:gf:horn') return this.start();
    if (!this.running) return;
    if (key === 'event:gf:bench') {
      const n = Math.floor(count(g.p.inv, 'bamboo') / 2);
      if (n === 0) { g.msg('Two lengths of bamboo make a bucket. Cut some from the bamboo stands by the camp.', 'warn'); return; }
      remove(g.p.inv, 'bamboo', n * 2);
      g.give('bucket_bamboo', n);
      g.addXp('fletching', n * 18);
      this.points += n;
      g.msg(`You lash ${n} bamboo bucket${n > 1 ? 's' : ''} together.`, 'good');
      g.rev++;
      return;
    }
    if (key === 'event:gf:stream') {
      const n = count(g.p.inv, 'bucket_bamboo');
      if (n === 0) { g.msg('You need a bucket to fill: lash two lengths of bamboo together at the camp bench.', 'warn'); return; }
      remove(g.p.inv, 'bucket_bamboo', n);
      g.give('bucket_water', n);
      g.msg(`You fill ${n} bucket${n > 1 ? 's' : ''} at the stream.`, 'info');
      g.rev++;
      return;
    }
    const m = /^event:gf:cell:(\d+)$/.exec(key);
    if (!m) return;
    const k = Number(m[1]);
    if (this.cells[k] === 'fire') {
      if (count(g.p.inv, 'bucket_water') === 0) { g.msg('You need a bucket of water. Fill one at the stream.', 'warn'); return; }
      remove(g.p.inv, 'bucket_water', 1); // the bucket goes with the water: bamboo doesn't survive a fire
      this.cells[k] = 'green';
      this.doused++;
      this.points += 3;
      g.addXp('woodcutting', 25); g.addXp('fletching', 10);
      const p = this.spots()!.cells[k];
      g.emit({ type: 'gatherFx', kind: 'water', x: p.x, z: p.z, success: true });
      g.msg(`Hiss and steam: the thicket's out. (${this.doused} of ${FIRE.win})`, 'good');
      if (this.doused >= FIRE.win) this.end(true);
      g.rev++;
    } else if (this.cells[k] === 'green' && this.neighbours(k).some((n) => this.cells[n] === 'fire')) {
      if (!g.bestTool('woodcutting')) { g.msg('You need a hatchet to fell a firebreak.', 'warn'); return; }
      if (g.time < this.breakReady) { g.msg('You\'re still catching your breath from the last one.', 'warn'); return; }
      this.breakReady = g.time + FIRE.breakCd;
      this.cells[k] = 'break';
      this.points += 1;
      g.addXp('woodcutting', 40);
      g.msg('You hack the thicket down to stumps. The fire won\'t cross here.', 'good');
      g.rev++;
    }
  }

  start() {
    const g = this.g;
    if (this.running) return;
    this.running = true;
    this.cells.fill('green'); this.doused = 0; this.points = 0;
    const a = Math.floor(g.rnd() * this.cells.length);
    this.ignite(a);
    this.ignite(this.neighbours(a)[0]);
    this.nextSpread = g.time + 6; this.nextEmber = g.time + 14; this.nextHeat = g.time + 6;
    for (const n of g.nodes) if (n.def === 'bamboo_fire') n.depletedUntil = 0;
    g.give('bucket_water', 2); // the camp's two full buckets: enough for the first fires while you make more
    g.msg('The horn\'s note rolls over the jungle, and smoke answers it: the Greenheart is burning! The camp hands you two full buckets. Cut bamboo, lash more, fill them at the stream, and douse the fire.', 'combat');
    g.emit({ type: 'boss', state: 'rise' });
    g.rev++;
  }

  private ignite(k: number) {
    if (this.cells[k] !== 'green') return false;
    this.cells[k] = 'fire';
    this.lit[k] = this.g.time;
    return true;
  }

  private end(won: boolean) {
    const g = this.g;
    this.running = false;
    for (const n of g.nodes) if (n.def === 'bamboo_fire') n.depletedUntil = Infinity;
    for (let k = g.telegraphs.length - 1; k >= 0; k--) if (g.telegraphs[k].source === -998) g.telegraphs.splice(k, 1);
    // the buckets stay at the camp
    for (const b of ['bucket_bamboo', 'bucket_water', 'bamboo']) remove(g.p.inv, b, count(g.p.inv, b));
    if (!won) {
      this.cells.fill('green');
      g.msg('Too much of the grove has burnt. The fire burns itself out at the stream, and the jungle will grow back. Sound the horn to try again.', 'warn');
      g.rev++;
      return;
    }
    this.cells.fill('green');
    const rolls = Math.min(FIRE.maxRolls, 1 + Math.floor(this.points / FIRE.pointsPerRoll));
    const got: string[] = [];
    const take = (id: string, qty: number) => { if (canAdd(g.p.inv, id)) { g.give(id, qty); got.push(`${qty > 1 ? `${qty} × ` : ''}${item(id).name}`); } };
    for (let r = 0; r < rolls; r++) {
      const x = g.rnd();
      const missing = OUTFIT.filter((o) => count(g.p.inv, o) === 0 && !Object.values(g.p.equip).some((st) => st?.id === o));
      if (x < 0.14 && missing.length) take(missing[Math.floor(g.rnd() * missing.length)], 1);
      else if (x < 0.4) take('coins', 50 + Math.floor(g.rnd() * 90));
      else if (x < 0.58) take('logs_willow', 3 + Math.floor(g.rnd() * 4));
      else if (x < 0.72) take('resin', 3 + Math.floor(g.rnd() * 5));
      else if (x < 0.84) take('bird_nest', 1);
      else if (x < 0.95) take('charm_tide', 15 + Math.floor(g.rnd() * 20));
      else take('casket', 1);
    }
    g.addXp('woodcutting', 180); g.addXp('fletching', 120);
    g.s.flags.greenfire_won = true;
    g.msg(`The last flames die in a hiss of steam. The fire camp shares out what it has: ${got.join(', ') || 'nothing you can carry'}.`, 'good');
    g.emit({ type: 'boss', state: 'defeat' });
    g.rev++;
  }

  step(dt: number) {
    if (!this.running) return;
    const g = this.g, s = this.spots();
    if (!s) { this.running = false; this.cells.fill('green'); return; } // left Sunreach: the camp puts it out
    void dt;
    const span = ([a, b]: [number, number]) => a + g.rnd() * (b - a);
    // thickets left burning too long burn to ash
    for (let k = 0; k < this.cells.length; k++) {
      if (this.cells[k] === 'fire' && g.time - this.lit[k] >= FIRE.burn) {
        this.cells[k] = 'ash';
        g.msg('A thicket collapses into ash.', 'warn');
        g.rev++;
      }
    }
    if (this.ashed >= FIRE.lose) { this.end(false); return; }
    if (g.time >= this.nextSpread) {
      this.nextSpread = g.time + span(FIRE.spreadEvery);
      const burning = this.cells.map((c, k) => (c === 'fire' ? k : -1)).filter((k) => k >= 0);
      const from = burning[Math.floor(g.rnd() * burning.length)];
      const to = from === undefined ? [] : this.neighbours(from).filter((n) => this.cells[n] === 'green');
      if (to.length && this.ignite(to[Math.floor(g.rnd() * to.length)])) { g.msg('The fire jumps to the next thicket!', 'warn'); g.rev++; }
    }
    if (g.time >= this.nextEmber) {
      this.nextEmber = g.time + span(FIRE.emberEvery);
      const green = this.cells.map((c, k) => (c === 'green' ? k : -1)).filter((k) => k >= 0);
      if (green.length && this.ignite(green[Math.floor(g.rnd() * green.length)])) { g.msg('Embers on the wind: a new fire starts in the grove.', 'warn'); g.rev++; }
    }
    if (g.time >= this.nextHeat) {
      // the heat comes off the fire in waves: step out of the marked patch
      this.nextHeat = g.time + span(FIRE.heatEvery);
      const near = s.cells.some((p, k) => this.cells[k] === 'fire' && Math.hypot(g.p.x - p.x, g.p.z - p.z) < 7);
      if (near && !g.p.onShip) g.telegraphs.push({ id: g.nextId++, kind: 'circle', x: g.p.x, z: g.p.z, r: 2.2, angle: 0, width: 0, t: 0, dur: 1.4, damage: FIRE.heatDamage, source: -998 });
    }
  }
}
