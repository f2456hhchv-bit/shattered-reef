import type { Game, Target } from './game';
import { canAdd } from './inventory';
import { item } from '../data/items';
import { ENEMIES } from '../data/content';
import { BELLTIME, BELL_SPOTS, BELL_LISTENERS, CHOIR } from '../data/belltime';
import { ELITE_AFFIXES } from '../data/content';

/** Bell-time (data/belltime.ts): low water comes round on an island, and a bell rings where there's no bell. */
export class BellTime {
  /** the bell ringing now, if any (on this island) */
  bell: { x: number; z: number; where: string; until: number } | null = null;
  next = 0;
  /** its own dice, so the tide's comings and goings don't shift every other roll in the game */
  private seed = 0x5eed_be11;
  private rnd() { let t = (this.seed = (this.seed + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  constructor(private g: Game) { this.next = g.time + this.roll(BELLTIME.first); }
  private roll(r: [number, number]) { return r[0] + this.rnd() * (r[1] - r[0]); }

  /** a new island: whatever was ringing on the last one is out of earshot */
  enterRegion() { this.bell = null; }

  here() { return this.bell; }

  step() {
    const g = this.g, spots = BELL_SPOTS[g.s.region];
    if (this.bell && g.time >= this.bell.until) {
      this.bell = null;
      this.next = g.time + this.roll(BELLTIME.every);
      g.msg('The water comes back in. Somewhere the bell stops, unanswered.', 'info');
      g.rev++;
    }
    if (this.bell || !spots || g.time < this.next || g.travelling) return;
    const s = spots[Math.floor(this.rnd() * spots.length)];
    const at = g.world.nearestWalkable(s.x, s.z, 4);
    if (!at) { this.next = g.time + 30; return; }
    this.bell = { x: at[0], z: at[1], where: s.where, until: g.time + BELLTIME.lasts };
    g.msg(`Bell-time. The tide's running out further than it should, and ${s.where} a bell is ringing where there is no bell. It's on your map.`, 'quest');
    g.emit({ type: 'banner', title: 'Bell-time', sub: `A bell rings ${s.where}` });
    g.rev++;
  }

  targets(): Target[] {
    const b = this.bell;
    if (!b || this.g.p.onShip) return [];
    return [{ key: 'event:bt:ring', kind: 'event', x: b.x, z: b.z, range: 2.4, label: 'A bell ringing where there is no bell', verb: 'Ring it back' }];
  }

  use(key: string) {
    const g = this.g, b = this.bell, tithe = BELLTIME.tithe[g.s.region];
    if (key !== 'event:bt:ring' || !b || !tithe) return;
    this.bell = null;
    this.next = g.time + this.roll(BELLTIME.every);
    const n = (g.s.bellsRung ?? 0) + 1;
    g.s.bellsRung = n;
    // the sea's tithe for being answered
    const got: string[] = [];
    const add = (id: string, q: number) => { if (q > 0 && canAdd(g.p.inv, id)) { g.give(id, q); got.push(`${q > 1 ? `${q} × ` : ''}${item(id).name}`); } };
    add('coins', Math.round(this.roll(tithe)));
    add('charm_tide', Math.round(this.roll(tithe) / 12));
    if (this.rnd() < 0.3) add('casket', 1);
    g.msg(`You ring it back. The sea pays its tithe: ${got.join(', ')}. Something is coming up the beach to listen.`, 'loot');
    // the listener: one of the island's own, song-touched
    const id = BELL_LISTENERS[g.s.region], def = id && ENEMIES[id];
    if (def) {
      const a = this.rnd() * Math.PI * 2, at = g.world.nearestWalkable(b.x + Math.cos(a) * 4, b.z + Math.sin(a) * 4, 4);
      if (at) g.spawnListener(def, at[0], at[1], ELITE_AFFIXES[Math.floor(this.rnd() * ELITE_AFFIXES.length)].id);
    }
    const heard = CHOIR.find((c) => c.at === n);
    if (heard) g.emit({ type: 'read', title: heard.title, sub: `Bells answered: ${n}`, lines: heard.lines });
    g.rev++;
  }
}
