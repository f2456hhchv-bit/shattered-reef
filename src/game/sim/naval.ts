import type { Game } from './game';
import { QUESTS } from '../data/quests';
import { AMMO, NAVAL, SEA_FOES, SEA_SPAWNS, CHART_MARKS, KRAKEN, WEATHER, type AmmoId, type SeaFoeDef, type WeatherKind } from '../data/sea';
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
  /** a quest's foe: put in the water once for its stage, never comes back once sunk */
  once?: boolean;
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
  /** the Kraken's sighting while it lasts: its arms coming down on marked water (t counts up to KRAKEN.warn) */
  kraken: { strikes: { id: number; x: number; z: number; t: number }[]; next: number } | null = null;
  /** the weather at sea: a spell of it while `kind` is set; `wind` is the gale's direction; thunder strikes mark first */
  weather: { kind: WeatherKind | null; until: number; next: number; wind: number; strikes: { id: number; x: number; z: number; t: number }[]; nextStrike: number } = { kind: null, until: 0, next: 0, wind: 0, strikes: [], nextStrike: 0 };
  private sailed = 0;
  private lastPos: [number, number] | null = null;

  constructor(private g: Game) {}

  /** A new region: its waters' foes, the hull as it was. */
  enterRegion() {
    this.foes = []; this.balls = []; this.charges = []; this.kraken = null;
    this.weather = { kind: null, until: 0, next: this.g.time + WEATHER.every[0], wind: 0, strikes: [], nextStrike: 0 };
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

  /** A quest stage that wants a ship sunk puts her in the water, once, while you're in her region. */
  private stepQuestFoes() {
    const g = this.g;
    // a quest's ship stays only while some stage wants it (to sink, or to hunt you)
    const wanted = new Set<string>();
    for (const q of Object.values(QUESTS)) { const st = q.stages[g.questStage(q.id)]; if (st?.kill?.sea) wanted.add(st.kill.foe); if (st?.chase) wanted.add(st.chase.foe); }
    this.foes = this.foes.filter((f) => !(f.once && (!f.alive || !wanted.has(f.def.id))));
    for (const q of Object.values(QUESTS)) {
      const st = q.stages[g.questStage(q.id)], k = st?.kill?.sea ? st.kill : st?.chase ? { foe: st.chase.foe, spawn: st.chase.spawn } : null;
      if (!k?.spawn || k.spawn.region !== g.s.region || this.foes.some((f) => f.def.id === k.foe)) continue;
      const def = SEA_FOES[k.foe], at = def && g.nearestSea(k.spawn.x, k.spawn.z);
      if (!at) continue;
      this.foes.push({ id: g.nextId++, def, x: at[0], z: at[1], heading: 0, spawnX: at[0], spawnZ: at[1], hp: def.hp, maxHp: def.hp, alive: true, respawnAt: 0,
        state: 'idle', t: 0, cd: 0, under: def.behaviour === 'shark', hitFlash: 0, aim: null, once: true });
    }
  }

  hullMax() {
    const lvl = this.g.level('sailing');
    const figurehead = this.g.s.flags.nokk_figurehead ? 1.1 : 1; // The Nøkk's Fiddle
    return Math.round((NAVAL.hull + NAVAL.hullPerLevel * (lvl - 1)) * (1 + perkTotal('sailing', lvl, 'hull') / 100) * figurehead * (1 + this.g.shipBonus('hull') / 100));
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
    const dmg = a.damage * (1 + (this.g.level('sailing') - 1) * 0.04) * (this.g.s.flags.swivel_gun ? 1.15 : 1) * (this.g.s.flags.ransom_pennant ? 1.05 : 1) * (1 + this.g.crewV('cannon') / 100) * (1 + this.g.shipBonus('guns') / 100); // gunnery grows with Sailing; the Wreckers' Lantern swivel gun; Marisol's red pennant; Ash Tolliver at the guns
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
    dmg *= 1 - this.g.shipBonus('plating') / 100; // the shipwright's plating
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
    this.balls = []; this.charges = []; this.kraken = null;
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
      if (!fighting && g.time - this.lastHit > NAVAL.mendAfter) this.hull = Math.min(this.hullMax(), this.hull + NAVAL.mend * (this.g.s.flags.nokk_figurehead ? 2 : 1) * dt);
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
      this.stepKraken(dt);
      this.g.bottles.step(true, inHarbour);
      this.stepWeather(dt, inHarbour);
    } else this.lastPos = null;

    this.stepQuestFoes();
    for (const f of this.foes) {
      f.hitFlash = Math.max(0, f.hitFlash - dt);
      if (!f.alive) {
        if (f.once) continue;
        if (g.time >= f.respawnAt && Math.hypot(sh.x - f.spawnX, sh.z - f.spawnZ) > 30) {
          Object.assign(f, { alive: true, hp: f.maxHp, x: f.spawnX, z: f.spawnZ, state: 'idle', cd: 0, under: f.def.behaviour === 'shark', aim: null });
        }
        continue;
      }
      f.cd = Math.max(0, f.cd - dt);
      const d = Math.hypot(sh.x - f.x, sh.z - f.z);
      const sight = this.weather.kind === 'fog' ? WEATHER.fogSight : 1; // fog: they have to come close to see you
      const friend = f.def.id === 'red_ransom' && g.s.flags.tide_marisol_friend; // you paid her ransom: Marisol lets you pass
      const engaged = aboard && !inHarbour && !friend && d < f.def.aggro * sight * (f.state === 'idle' ? 1 : 1.8);
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
      else if (f.def.behaviour === 'brig') this.stepBrig(f, d, dt);
      else if (f.def.behaviour === 'fireship') this.stepFireship(f, d, dt);
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

  /** Weather: a spell blows in every few minutes on open water, and blows itself out. */
  private stepWeather(dt: number, inHarbour: boolean) {
    const g = this.g, w = this.weather, kinds = WEATHER.kinds[g.s.region] ?? [];
    const span = ([a, b]: [number, number]) => a + g.rnd() * (b - a);
    if (!w.kind) {
      if (inHarbour || !kinds.length) { w.next = Math.max(w.next, g.time + 30); return; } // it doesn't start in harbour
      if (g.time < w.next) return;
      w.kind = kinds[Math.floor(g.rnd() * kinds.length)];
      w.until = g.time + span(WEATHER.lasts);
      w.wind = g.rnd() * Math.PI * 2;
      w.nextStrike = g.time + 2;
      g.msg(w.kind === 'gale' ? 'A gale comes howling over the water! Steer into it, or let it carry you.' : w.kind === 'fog' ? 'Fog rolls in thick. Whatever\'s out there can barely see you, and you can barely see it.' : 'Thunderheads close overhead. Lightning! Watch the water for where it\'s going to strike.', 'warn');
      g.emit({ type: 'weather', kind: w.kind });
      g.rev++;
      return;
    }
    if (g.time >= w.until) {
      g.msg('The weather blows itself out.', 'info');
      g.addXp('sailing', WEATHER.xp);
      w.kind = null; w.strikes = []; w.next = g.time + span(WEATHER.every);
      g.emit({ type: 'weather', kind: null });
      g.rev++;
      return;
    }
    const sh = g.ship;
    if (w.kind === 'gale') {
      // the wind pushes the ship and everything else on the water
      const vx = Math.cos(w.wind) * WEATHER.gale * dt, vz = Math.sin(w.wind) * WEATHER.gale * dt;
      if (this.sea(sh.x + vx, sh.z + vz)) { sh.x += vx; sh.z += vz; g.p.x = sh.x; g.p.z = sh.z; }
      for (const f of this.foes) if (f.alive && f.def.behaviour !== 'flock' && this.sea(f.x + vx, f.z + vz)) { f.x += vx; f.z += vz; }
    } else if (w.kind === 'thunder') {
      for (const st of w.strikes) {
        st.t += dt;
        if (st.t >= WEATHER.strikeWarn && st.t - dt < WEATHER.strikeWarn) {
          g.emit({ type: 'explode', x: st.x, z: st.z, r: WEATHER.strikeRadius });
          if (Math.hypot(sh.x - st.x, sh.z - st.z) < WEATHER.strikeRadius + 1.2) this.hitHull(WEATHER.strikeHull);
          for (const f of this.foes) if (f.alive && !f.under && Math.hypot(f.x - st.x, f.z - st.z) < WEATHER.strikeRadius + f.def.scale) this.damageFoe(f, WEATHER.strikeFoe, f.def.counter); // lightning hits like the right ammo
        }
      }
      w.strikes = w.strikes.filter((st) => st.t < WEATHER.strikeWarn + 0.3);
      if (g.time >= w.nextStrike) {
        // near the ship, a little ahead of it, or on a foe close by
        w.nextStrike = g.time + WEATHER.strikeEvery;
        const near = this.foes.filter((f) => f.alive && !f.under && Math.hypot(f.x - sh.x, f.z - sh.z) < 16);
        const onFoe = near.length && g.rnd() < 0.4 ? near[Math.floor(g.rnd() * near.length)] : null;
        const a = g.rnd() * Math.PI * 2, r = 2 + g.rnd() * 6;
        const x = onFoe ? onFoe.x : sh.x + Math.cos(sh.heading) * g.shipSpeed * 0.8 + Math.cos(a) * r, z = onFoe ? onFoe.z : sh.z + Math.sin(sh.heading) * g.shipSpeed * 0.8 + Math.sin(a) * r;
        w.strikes.push({ id: g.nextId++, x, z, t: 0 });
        g.telegraphs.push({ id: g.nextId++, kind: 'circle', x, z, r: WEATHER.strikeRadius, angle: 0, width: 0, t: 0, dur: WEATHER.strikeWarn, damage: 0, source: -995 });
      }
    }
  }

  /** The Kraken's sighting: wakes when you sail into the North Deep, strikes round the ship until you're clear. */
  private stepKraken(dt: number) {
    const g = this.g, sh = g.ship;
    if (g.s.region !== KRAKEN.region || g.s.flags.kraken_escaped) { this.kraken = null; return; }
    const d = Math.hypot(sh.x - KRAKEN.x, sh.z - KRAKEN.z);
    if (!this.kraken) {
      if (d > KRAKEN.wake) return;
      this.kraken = { strikes: [], next: g.time + 0.8 };
      g.msg('The sea goes black under your keel. Something vast is rising out of the North Deep. Sail! Get clear of the deep!', 'combat');
      g.emit({ type: 'boss', state: 'rise' });
      g.rev++;
      return;
    }
    const k = this.kraken;
    for (const st of k.strikes) {
      st.t += dt;
      if (st.t >= KRAKEN.warn && st.t - dt < KRAKEN.warn) {
        g.emit({ type: 'explode', x: st.x, z: st.z, r: KRAKEN.radius });
        if (Math.hypot(sh.x - st.x, sh.z - st.z) < KRAKEN.radius + 1.2) this.hitHull(KRAKEN.damage);
        if (!this.kraken) return; // the hull gave out: towed home, the deep goes quiet
      }
    }
    k.strikes = k.strikes.filter((st) => st.t < KRAKEN.warn + 1.2);
    if (d > KRAKEN.escape) {
      // clear of the deep
      this.kraken = null;
      g.s.flags.kraken_escaped = true;
      g.addXp('sailing', KRAKEN.xp);
      g.msg('The arms slide back under, and the black water settles. You got away. Whatever that was, it was bigger than any island.', 'quest');
      g.emit({ type: 'boss', state: 'defeat', name: 'Clear of the deep', sub: 'Whatever that was, it let you go' });
      g.rev++;
      return;
    }
    if (g.time >= k.next) {
      // an arm comes down where you're heading (or right on you, if you've stopped)
      k.next = g.time + KRAKEN.strikeEvery;
      const lead = Math.max(0, g.shipSpeed) * 1.1, j = (g.rnd() - 0.5) * 3;
      const x = sh.x + Math.cos(sh.heading) * lead + Math.sin(sh.heading) * j, z = sh.z + Math.sin(sh.heading) * lead - Math.cos(sh.heading) * j;
      k.strikes.push({ id: g.nextId++, x, z, t: 0 });
      g.telegraphs.push({ id: g.nextId++, kind: 'circle', x, z, r: KRAKEN.radius, angle: 0, width: 0, t: 0, dur: KRAKEN.warn, damage: 0, source: -996 });
    }
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

  /**
   * A brig: circles wide, and when the guns are ready it shows three lines across your bow and beam, then fires a
   * broadside down them. Steer off the lines.
   */
  private stepBrig(f: SeaFoe, d: number, dt: number) {
    const sh = this.g.ship;
    if (f.state === 'aim') {
      f.t -= dt;
      if (f.t <= 0 && f.aim) {
        const base = Math.atan2(f.aim.z - f.z, f.aim.x - f.x);
        for (const off of [-0.16, 0, 0.16]) this.balls.push({ id: this.g.nextId++, x: f.x, z: f.z, vx: Math.cos(base + off) * 18, vz: Math.sin(base + off) * 18, life: 1.15, from: 'foe', damage: f.def.damage, ammo: 'cannonball' });
        f.state = 'chase'; f.cd = f.def.cooldown; f.aim = null;
      }
      return;
    }
    const want = 12, ang = Math.atan2(f.z - sh.z, f.x - sh.x) + 0.28;
    this.moveFoe(f, sh.x + Math.cos(ang) * want, sh.z + Math.sin(ang) * want, f.def.speed, dt);
    if (f.cd <= 0 && d < 16) {
      f.state = 'aim'; f.t = 1.1;
      f.aim = { x: sh.x, z: sh.z };
      const base = Math.atan2(sh.z - f.z, sh.x - f.x);
      for (const off of [-0.16, 0, 0.16]) this.g.telegraphs.push({ id: this.g.nextId++, kind: 'line', x: f.x, z: f.z, r: 20, angle: base + off, width: 1.0, t: 0, dur: 1.1, damage: 0, source: -f.id });
    }
  }

  /**
   * A fire ship: sails straight at you. Close in, its crew light the fuse and dive overboard (a marked ring round
   * it), and it keeps coming; when the fuse burns down it goes up. Sink it first, or turn away and outrun the ring.
   */
  private stepFireship(f: SeaFoe, d: number, dt: number) {
    const sh = this.g.ship, R = 4.5;
    if (f.state === 'aim') {
      f.t -= dt;
      this.moveFoe(f, sh.x, sh.z, f.def.speed * 0.55, dt); // drifting on, slower with no crew
      if (f.t <= 0) {
        this.g.emit({ type: 'explode', x: f.x, z: f.z, r: R });
        if (Math.hypot(sh.x - f.x, sh.z - f.z) < R + 1.2) this.hitHull(f.def.damage);
        // it burns to the waterline: no prize, no Sailing XP for the one that got away
        f.alive = false; f.respawnAt = this.g.time + f.def.respawn;
        this.g.emit({ type: 'enemyDeath', id: f.id, x: f.x, z: f.z, elite: false, boss: false });
        this.g.rev++;
      }
      return;
    }
    this.moveFoe(f, sh.x, sh.z, f.def.speed, dt);
    if (d < 6) {
      f.state = 'aim'; f.t = 1.6;
      this.g.telegraphs.push({ id: this.g.nextId++, kind: 'circle', x: f.x, z: f.z, r: R, angle: 0, width: 0, t: 0, dur: 1.6, damage: 0, source: -f.id });
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
