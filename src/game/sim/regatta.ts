import type { Game, Target } from './game';
import { RACE_BY_REGION, BUOY_REACH, MEDAL_NAMES, type RaceCourse } from '../data/regatta';

/** The Gull Race (data/regatta.ts): start at the start buoy, round every buoy in order, back to the start. */
export class Regatta {
  run: { course: RaceCourse; next: number; start: number } | null = null;
  constructor(private g: Game) {}

  course() { return RACE_BY_REGION[this.g.s.region] ?? null; }
  enterRegion() { if (this.run) { this.run = null; this.g.msg('You\'ve left the course. The race is off.', 'warn'); } }

  targets(): Target[] {
    const c = this.course(), g = this.g;
    if (!c || this.run || !g.p.onShip) return [];
    return [{ key: 'event:rg:start', kind: 'event', x: c.start[0], z: c.start[1], range: BUOY_REACH, label: `The start buoy of ${c.name}`, verb: 'Start the race' }];
  }

  use(key: string) {
    const g = this.g, c = this.course();
    if (key !== 'event:rg:start' || !c || this.run) return;
    if (!g.p.onShip) { g.msg('Races are sailed, captain. Get aboard.', 'warn'); return; }
    if (g.level('sailing') < c.sailing) { g.msg(`${c.name[0].toUpperCase()}${c.name.slice(1)} is for Sailing ${c.sailing} and up.`, 'warn'); return; }
    this.run = { course: c, next: 0, start: g.time };
    const best = g.s.races?.[c.id];
    g.emit({ type: 'banner', title: 'The Gull Race', sub: `${c.name}: ${c.buoys.length} buoys and home. Gold under ${c.medals[0]} s${best ? ` · your best ${best.toFixed(1)} s` : ''}` });
    g.msg('A gun from the harbour wall: you\'re off. The buoys are on your map, in order.', 'quest');
  }

  /** the buoy to make for next (the start buoy again for the finish) */
  nextBuoy(): [number, number] | null {
    const r = this.run;
    return r ? (r.next < r.course.buoys.length ? r.course.buoys[r.next] : r.course.start) : null;
  }

  step() {
    const g = this.g, r = this.run;
    if (!r) return;
    if (!g.p.onShip || g.time - r.start > 600) { this.run = null; g.msg('The race is abandoned.', 'warn'); return; }
    const b = this.nextBuoy()!;
    if (Math.hypot(g.ship.x - b[0], g.ship.z - b[1]) > BUOY_REACH) return;
    if (r.next < r.course.buoys.length) {
      r.next++;
      g.emit({ type: 'cue', perfect: true, text: r.next < r.course.buoys.length ? `Buoy ${r.next}/${r.course.buoys.length}` : 'Home!' });
      return;
    }
    this.finish(g.time - r.start);
  }

  private finish(secs: number) {
    const g = this.g, c = this.run!.course;
    this.run = null;
    const races = { ...(g.s.races ?? {}) }, best = races[c.id];
    const pb = best === undefined || secs < best;
    if (pb) races[c.id] = secs;
    g.s.races = races;
    const medal = c.medals.findIndex((m) => secs <= m);
    const medals = { ...(g.s.raceMedals ?? {}) }, had = medals[c.id] ?? 3;
    if (medal >= 0 && medal < had) medals[c.id] = medal;
    g.s.raceMedals = medals;
    g.addXp('sailing', Math.round(c.xp * (medal === 0 ? 2 : medal === 1 ? 1.5 : medal === 2 ? 1.2 : 1)));
    const name = medal >= 0 ? MEDAL_NAMES[medal] : null;
    if (name && medal < had) {
      const coins = [3000, 1500, 600][medal] * (c.sailing >= 50 ? 4 : 1);
      g.give('coins', coins);
      if (medal === 0) g.s.flags.gull_pennant = true;
      g.msg(`First ${name} on ${c.name}! The harbour pays ${coins} coins${medal === 0 ? ', and runs a gull pennant up your mast: your ship sails 3% faster for good' : ''}.`, 'good');
    }
    g.emit({ type: 'banner', title: `${secs.toFixed(1)} s${name ? ` · ${name}` : ''}`, sub: pb ? `A new best on ${c.name}` : `Your best: ${best!.toFixed(1)} s` });
    g.rev++;
  }
}
