import type { Game } from './game';
import { AMMO, NAVAL, SEA_FOES, SEA_SPAWNS, CHART_MARKS, type AmmoId, type SeaFoeDef } from '../data/sea';
import { perkTotal } from '../data/perks';
import { count, remove, canAdd } from './inventory';
import { item } from '../data/items';

// Fighting and working at sea (docs/ISLANDS.md, slice 1). Its own world beside the land fight: foes that live on
// the water, cannonballs and depth charges, and the hull standing in for your health. Driven by Game.step while you
// hold the tiller.

export interface SeaFoe {
  id: number; def: SeaFoeDef; x: number; z: number; heading: number; spawnX: number; spawnZ: number;
  hp: number; maxHp: number; alive: boolean; respawnAt: number;
  state: 'idle' | 'chase' | 'aim' | 'circle' | 'surface' | 'charge' | 'surfaced';
  t: number; cd: number;
  /** a shark below the surface: broadsides pass over it, only depth charges reach it */
  under: boolean;
  hitFlash: number;
  aim: { x: number; z: number } | null;
}
export interface SeaBall { id: number; x: number; z: number; vx: number; vz: number; life: number; from: 'ship' | 'foe'; damage: number; ammo: AmmoId }
export interface SeaCharge { id: number; x: number; z: number; t: number; damage: number }

export class Naval {
  foes: SeaFoe[] = [];
  balls: SeaBall[] = [];
  charges: SeaCharge[] = [];
  hull = NAVAL.hull;
  reloadCd = 0;
  ammo: AmmoId = 'cannonball';
  private lastHit = -99;
  private sailed = 0;
  private lastPos: [number, number] | null = null;

  constructor(private g: Game) {}

  /** A new region: its waters' foes, the hull as it was. */
  enterRegion() {
    this.foes = []; this.balls = []; this.charges = [];
    for (const sp of SEA_SPAWNS[this.g.s.region] ?? []) {
      const def = SEA_FOES[sp.foe];
      const at = def.behaviour === 'flock' ? [sp.x, sp.z] as [number, number] : this.g.nearestSea(sp.x, sp.z);
      if (!at) continue;
      this.foes.push({ id: this.g.nextId++, def, x: at[0], z: at[1], heading: 0, spawnX: at[0], spawnZ: at[1], hp: def.hp, maxHp: def.hp, alive: true, respawnAt: 0,
        state: 'idle', t: 0, cd: 0, under: def.behaviour === 'shark', hitFlash: 0, aim: null });
    }
    this.hull = Math.min(this.hull, this.hullMax());
    this.lastPos = null;
  }

  hullMax() {
    const lvl = this.g.level('sailing');
    return Math.round((NAVAL.hull + NAVAL.hullPerLevel * (lvl - 1)) * (1 + perkTotal('sailing', lvl, 'hull') / 100));
  }
  private reloadTime(kind: 'broadside' | 'charge') {
    const base = kind === 'charge' ? NAVAL.charge.reload : NAVAL.reload;
    return base * (1 - perkTotal('sailing', this.g.level('sailing'), 'reload') / 100);
  }

  /** The ammo you can load: your Sailing level, and some in the pack (cannonballs are always aboard). */
  ammoBlock(id: AmmoId): string | null {
    const a = AMMO[id];
    if (this.g.level('sailing') < a.sailing) return `Needs Sailing ${a.sailing}`;
    if (a.item && count(this.g.p.inv, a.item) < 1) return `No ${a.name.toLowerCase()} in your pack`;
    return null;
  }
  setAmmo(id: AmmoId) {
    const b = this.ammoBlock(id);
    if (b) { this.g.msg(`${b}.`, 'warn'); return; }
    this.ammo = id;
    this.g.msg(`Loaded: ${AMMO[id].name.toLowerCase()}.`);
    this.g.rev++;
  }

  /** The foe a broadside would fire on: the nearest one in range off either beam. */
  broadsideTarget(): { foe: SeaFoe; side: 1 | -1 } | null {
    const sh = this.g.ship;
    let best: { foe: SeaFoe; side: 1 | -1 } | null = null, bd = Infinity;
    for (const f of this.foes) {
      if (!f.alive || f.under) continue;
      const d = Math.hypot(f.x - sh.x, f.z - sh.z);
      if (d > NAVAL.range || d >= bd) continue;
      const rel = Math.atan2(Math.sin(Math.atan2(f.z - sh.z, f.x - sh.x) - sh.heading), Math.cos(Math.atan2(f.z - sh.z, f.x - sh.x) - sh.heading));
      // port is +90 degrees off the bow, starboard -90; the guns cover `arc` either side of each beam
      const side: 1 | -1 = rel > 0 ? 1 : -1;
      if (Math.abs(Math.abs(rel) - Math.PI / 2) > NAVAL.arc) continue;
      best = { foe: f, side }; bd = d;
    }
    return best;
  }

  /** Why the guns can't fire right now, or null. */
  fireBlock(): string | null {
    if (!this.g.p.onShip) return 'Only aboard';
    if (this.reloadCd > 0) return 'Reloading';
    const a = AMMO[this.ammo];
    if (a.item && count(this.g.p.inv, a.item) < 1) return `Out of ${a.name.toLowerCase()}`;
    if (a.kind === 'charge') return null; // drops off the stern, no target needed
    if (!this.broadsideTarget()) return this.foes.some((f) => f.alive && !f.under && Math.hypot(f.x - this.g.ship.x, f.z - this.g.ship.z) < NAVAL.range) ? 'Turn a side to it' : 'Nothing in range';
    return null;
  }

  fire() {
    const block = this.fireBlock();
    if (block) { if (block !== 'Reloading') this.g.msg(block === 'Turn a side to it' ? 'Turn to bring a broadside to bear.' : `${block}.`, 'warn'); return; }
    const a = AMMO[this.ammo], sh = this.g.ship;
    if (a.item) remove(this.g.p.inv, a.item, 1);
    this.reloadCd = this.reloadTime(a.kind);
    const dmg = a.damage * (1 + (this.g.level('sailing') - 1) * 0.04) * (this.g.s.flags.swivel_gun ? 1.15 : 1); // gunnery grows with Sailing; the Wreckers' Lantern swivel gun
    if (a.kind === 'charge') {
      // over the stern: it sinks, then bursts
      this.charges.push({ id: this.g.nextId++, x: sh.x - Math.cos(sh.heading) * 4.2, z: sh.z - Math.sin(sh.heading) * 4.2, t: NAVAL.charge.fuse, damage: dmg });
      this.g.emit({ type: 'navalFire', kind: 'charge' });
    } else {
      const t = this.broadsideTarget()!;
      // lead the target a little, three guns along the side
      const lead = Math.hypot(t.foe.x - sh.x, t.foe.z - sh.z) / NAVAL.ballSpeed;
      const ax = t.foe.x + Math.cos(t.foe.heading) * t.foe.def.speed * lead * 0.5, az = t.foe.z + Math.sin(t.foe.heading) * t.foe.def.speed * lead * 0.5;
      for (let k = 0; k < NAVAL.balls; k++) {
        const along = (k - 1) * 1.6, ox = sh.x + Math.cos(sh.heading) * along, oz = sh.z + Math.sin(sh.heading) * along;
        const ang = Math.atan2(az - oz, ax - ox) + (this.g.rnd() - 0.5) * 0.12;
        this.balls.push({ id: this.g.nextId++, x: ox, z: oz, vx: Math.cos(ang) * NAVAL.ballSpeed, vz: Math.sin(ang) * NAVAL.ballSpeed, life: NAVAL.range / NAVAL.ballSpeed + 0.25, from: 'ship', damage: dmg / NAVAL.balls, ammo: this.ammo });
      }
      this.g.emit({ type: 'navalFire', kind: 'broadside', side: t.side });
    }
    this.g.rev++;
  }

  private sea(x: number, z: number) { return this.g.world.inside(x, z, 2) && this.g.world.seaClear(x, z); }
  private moveFoe(f: SeaFoe, tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const want = Math.atan2(dz, dx);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = want + off, nx = f.x + Math.cos(a) * Math.min(d, speed * dt), nz = f.z + Math.sin(a) * Math.min(d, speed * dt);
      if (f.def.behaviour === 'flock' || this.sea(nx, nz)) { f.x = nx; f.z = nz; f.heading = a; return; }
    }
  }

  private hitHull(dmg: number) {
    this.hull -= dmg;
    this.lastHit = this.g.time;
    this.g.emit({ type: 'hit', target: 'player', id: 0, amount: Math.round(dmg), crit: false, x: this.g.ship.x, z: this.g.ship.z });
    if (this.hull <= 0) this.towHome();
  }

  /** The hull gives out: the harbour crew tow you in. No death, no lost gear: a fee and a battered hull. */
  private towHome() {
    const g = this.g, mo = g.layout.mooring;
    const fee = Math.floor(count(g.p.inv, 'coins') * NAVAL.towFee);
    if (fee > 0) remove(g.p.inv, 'coins', fee);
    if (mo) { Object.assign(g.ship, mo); g.p.x = mo.x; g.p.z = mo.z; }
    g.shipSpeed = 0;
    this.hull = Math.round(this.hullMax() * 0.5);
    this.balls = []; this.charges = [];
    for (const f of this.foes) { f.state = 'idle'; f.x = f.spawnX; f.z = f.spawnZ; f.under = f.def.behaviour === 'shark'; }
    g.msg(`Your sloop is holed! The harbour crew tow her home${fee ? ` (${fee} coins)` : ''}.`, 'warn');
    g.emit({ type: 'teleport', fromX: g.p.x, fromZ: g.p.z, x: g.p.x, z: g.p.z });
    g.rev++;
  }

  private damageFoe(f: SeaFoe, raw: number, ammo: AmmoId) {
    const a = AMMO[ammo];
    const dmg = Math.max(1, Math.round(raw * (f.def.counter === ammo ? 1 : a.offCounter)));
    f.hp -= dmg;
    f.hitFlash = 0.15;
    this.g.emit({ type: 'hit', target: 'enemy', id: f.id, amount: dmg, crit: f.def.counter === ammo, x: f.x, z: f.z });
    if (f.state === 'idle') f.state = 'chase';
    if (f.hp <= 0) this.sink(f);
  }

  private sink(f: SeaFoe) {
    const g = this.g;
    f.alive = false;
    f.respawnAt = g.time + f.def.respawn;
    g.addXp('sailing', f.def.xp);
    g.questKill(f.def.id);
    g.emit({ type: 'enemyDeath', id: f.id, x: f.x, z: f.z, elite: false, boss: !!f.def.boss });
    // the haul comes aboard: nothing to fish out of the water
    const got: string[] = [];
    const coins = f.def.coins[0] + Math.floor(g.rnd() * (f.def.coins[1] - f.def.coins[0] + 1));
    if (coins > 0) { g.give('coins', coins); got.push(`${coins} coins`); }
    for (const d of f.def.drops) {
      if (g.rnd() >= d.chance) continue;
      const q = d.qty ? d.qty[0] + Math.floor(g.rnd() * (d.qty[1] - d.qty[0] + 1)) : 1;
      if (!canAdd(g.p.inv, d.item)) { g.msg(`No room for the ${item(d.item).name.toLowerCase()}: it sinks.`, 'warn'); continue; }
      g.give(d.item, q); got.push(`${q > 1 ? `${q} × ` : ''}${item(d.item).name}`);
    }
    g.msg(`${f.def.boss ? `${f.def.name} is beaten!` : `You sink the ${f.def.name.toLowerCase()}.`}${got.length ? ` Hauled aboard: ${got.join(', ')}.` : ''}`, f.def.boss ? 'good' : 'loot');
    g.rev++;
  }

  step(dt: number) {
    const g = this.g, sh = g.ship, aboard = g.p.onShip && g.shipHere;
    this.reloadCd = Math.max(0, this.reloadCd - dt);
    const mo = g.layout.mooring;
    const inHarbour = !mo || Math.hypot(sh.x - mo.x, sh.z - mo.z) < NAVAL.harbour;
    if (aboard) {
      // the hull mends between fights; distance sailed and charted marks give Sailing XP
      // only out of a fight: nothing engaged and nothing has hit you for a while
      const fighting = this.foes.some((f) => f.alive && f.state !== 'idle');
      if (!fighting && g.time - this.lastHit > NAVAL.mendAfter) this.hull = Math.min(this.hullMax(), this.hull + NAVAL.mend * dt);
      if (this.lastPos) this.sailed += Math.hypot(sh.x - this.lastPos[0], sh.z - this.lastPos[1]);
      this.lastPos = [sh.x, sh.z];
      if (this.sailed >= NAVAL.xpPerMetres) { this.sailed -= NAVAL.xpPerMetres; g.addXp('sailing', 1); }
      for (const m of CHART_MARKS) {
        if (m.region !== g.s.region || g.s.flags[`chart_${m.id}`] || Math.hypot(m.x - sh.x, m.z - sh.z) > m.r) continue;
        g.s.flags[`chart_${m.id}`] = true;
        g.addXp('sailing', m.xp);
        g.msg(`Charted: ${m.name}. You log the soundings in your captain's book.`, 'quest');
        g.rev++;
      }
    } else this.lastPos = null;

    for (const f of this.foes) {
      f.hitFlash = Math.max(0, f.hitFlash - dt);
      if (!f.alive) {
        if (g.time >= f.respawnAt && Math.hypot(sh.x - f.spawnX, sh.z - f.spawnZ) > 30) {
          Object.assign(f, { alive: true, hp: f.maxHp, x: f.spawnX, z: f.spawnZ, state: 'idle', cd: 0, under: f.def.behaviour === 'shark', aim: null });
        }
        continue;
      }
      f.cd = Math.max(0, f.cd - dt);
      const d = Math.hypot(sh.x - f.x, sh.z - f.z);
      const engaged = aboard && !inHarbour && d < f.def.aggro * (f.state === 'idle' ? 1 : 1.8);
      if (!engaged) {
        // drift home, sharks back under
        f.state = 'idle'; f.aim = null;
        if (f.def.behaviour === 'shark') f.under = true;
        if (Math.hypot(f.x - f.spawnX, f.z - f.spawnZ) > 1) this.moveFoe(f, f.spawnX, f.spawnZ, f.def.speed * 0.4, dt);
        else f.heading += dt * 0.4;
        continue;
      }
      if (f.state === 'idle') f.state = f.def.behaviour === 'shark' ? 'circle' : 'chase';
      if (f.def.behaviour === 'cutter') this.stepCutter(f, d, dt);
      else if (f.def.behaviour === 'flock') this.stepFlock(f, d, dt);
      else this.stepShark(f, d, dt);
    }

    // shot in flight
    for (const b of this.balls) {
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      if (b.from === 'ship') {
        for (const f of this.foes) {
          if (!f.alive || f.under) continue; // a submerged shark: the ball skips over it
          if (Math.hypot(f.x - b.x, f.z - b.z) < 1.3 * f.def.scale + 0.4) { this.damageFoe(f, b.damage, b.ammo); b.life = 0; break; }
        }
      } else if (aboard && Math.hypot(sh.x - b.x, sh.z - b.z) < 2.4) { this.hitHull(b.damage); b.life = 0; }
    }
    this.balls = this.balls.filter((b) => b.life > 0);
    for (const c of this.charges) {
      c.t -= dt;
      if (c.t > 0) continue;
      g.emit({ type: 'explode', x: c.x, z: c.z, r: NAVAL.charge.radius });
      for (const f of this.foes) if (f.alive && Math.hypot(f.x - c.x, f.z - c.z) < NAVAL.charge.radius + f.def.scale) this.damageFoe(f, c.damage, 'depth_charge');
    }
    this.charges = this.charges.filter((c) => c.t > 0);
  }

  /** A cutter: stand off at gun range, sight its gun (a line you can see), then fire. */
  private stepCutter(f: SeaFoe, d: number, dt: number) {
    const sh = this.g.ship;
    if (f.state === 'aim') {
      f.t -= dt;
      if (f.t <= 0 && f.aim) {
        const ang = Math.atan2(f.aim.z - f.z, f.aim.x - f.x);
        this.balls.push({ id: this.g.nextId++, x: f.x, z: f.z, vx: Math.cos(ang) * 18, vz: Math.sin(ang) * 18, life: 1.1, from: 'foe', damage: f.def.damage, ammo: 'cannonball' });
        f.state = 'chase'; f.cd = f.def.cooldown; f.aim = null;
      }
      return;
    }
    // hold about ten metres off, swinging round you
    const want = 10, ang = Math.atan2(f.z - sh.z, f.x - sh.x) + 0.35;
    this.moveFoe(f, sh.x + Math.cos(ang) * want, sh.z + Math.sin(ang) * want, f.def.speed, dt);
    if (f.cd <= 0 && d < 15) {
      f.state = 'aim'; f.t = 0.9;
      f.aim = { x: sh.x, z: sh.z };
      this.g.telegraphs.push({ id: this.g.nextId++, kind: 'line', x: f.x, z: f.z, r: 18, angle: Math.atan2(sh.z - f.z, sh.x - f.x), width: 1.2, t: 0, dur: 0.9, damage: 0, source: -f.id });
    }
  }

  /** Gulls: wheel in over the deck, dive, peel away. */
  private stepFlock(f: SeaFoe, d: number, dt: number) {
    const sh = this.g.ship;
    if (f.state === 'chase') {
      this.moveFoe(f, sh.x, sh.z, f.def.speed, dt);
      if (d < 2 && f.cd <= 0) { this.hitHull(f.def.damage); f.cd = f.def.cooldown; f.state = 'surfaced'; f.t = 1.4; }
    } else {
      // peel off and come round again
      f.t -= dt;
      const away = Math.atan2(f.z - sh.z, f.x - sh.x);
      this.moveFoe(f, f.x + Math.cos(away) * 5, f.z + Math.sin(away) * 5, f.def.speed, dt);
      if (f.t <= 0) f.state = 'chase';
    }
  }

  /** A shark: circles unseen, surfaces, shows the line it will take, charges along it, then lies on the surface a moment. */
  private stepShark(f: SeaFoe, _d: number, dt: number) {
    const sh = this.g.ship;
    if (f.state === 'circle') {
      f.under = true;
      const ang = Math.atan2(f.z - sh.z, f.x - sh.x) + 0.9 * dt * 2;
      this.moveFoe(f, sh.x + Math.cos(ang) * 9, sh.z + Math.sin(ang) * 9, f.def.speed, dt);
      if (f.cd <= 0) {
        f.state = 'surface'; f.t = 1.0; f.under = false;
        f.heading = Math.atan2(sh.z - f.z, sh.x - f.x);
        f.aim = { x: f.x + Math.cos(f.heading) * 16, z: f.z + Math.sin(f.heading) * 16 };
        this.g.telegraphs.push({ id: this.g.nextId++, kind: 'line', x: f.x, z: f.z, r: 16, angle: f.heading, width: 2.2 * f.def.scale, t: 0, dur: 1.0, damage: 0, source: -f.id });
      }
    } else if (f.state === 'surface') {
      f.t -= dt;
      if (f.t <= 0) { f.state = 'charge'; f.t = 16 / (f.def.speed * 2.2); }
    } else if (f.state === 'charge') {
      f.t -= dt;
      const step = f.def.speed * 2.2 * dt, nx = f.x + Math.cos(f.heading) * step, nz = f.z + Math.sin(f.heading) * step;
      if (this.sea(nx, nz)) { f.x = nx; f.z = nz; } else f.t = 0;
      if (Math.hypot(sh.x - f.x, sh.z - f.z) < 2.4 + 1.3 * f.def.scale && f.cd <= 0) { this.hitHull(f.def.damage); f.cd = f.def.cooldown; } // the hull is long: a ram along the line lands
      if (f.t <= 0) { f.state = 'surfaced'; f.t = 2.6; if (f.cd <= 0) f.cd = f.def.cooldown; }
    } else {
      // lies on the surface after a charge: the window for a broadside
      f.t -= dt;
      if (f.t <= 0) { f.state = 'circle'; f.under = true; }
    }
  }
}
