import type { Game } from './game';
import { canAdd } from './inventory';
import { BOTTLES, BOTTLE_BY, BOTTLE_CONFIG } from '../data/bottles';
import { REGIONS } from '../world/regions';

/** Messages in bottles (data/bottles.ts): bob past your bow at sea; sail over one and it comes aboard. */
export class Bottles {
  bottle: { x: number; z: number; until: number } | null = null;
  private next = 0;
  /** its own dice, so a bottle never shifts the rest of the game's rolls */
  private seed = 0xb0771e;
  private rnd() { let t = (this.seed = (this.seed + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private roll(r: [number, number]) { return r[0] + this.rnd() * (r[1] - r[0]); }
  constructor(private g: Game) { this.next = g.time + this.roll(BOTTLE_CONFIG.every); }

  enterRegion() { this.bottle = null; }

  /** while aboard, out of harbour */
  step(aboard: boolean, inHarbour: boolean) {
    const g = this.g, sh = g.ship;
    if (this.bottle) {
      if (g.time >= this.bottle.until) { this.bottle = null; this.next = g.time + this.roll(BOTTLE_CONFIG.every); return; }
      if (aboard && Math.hypot(sh.x - this.bottle.x, sh.z - this.bottle.z) < BOTTLE_CONFIG.reach) { this.bottle = null; this.next = g.time + this.roll(BOTTLE_CONFIG.every); this.haul(); }
      return;
    }
    if (!aboard || inHarbour || REGIONS[g.s.region].kind !== 'island' || g.time < this.next) return;
    const d = this.roll(BOTTLE_CONFIG.ahead), off = (this.rnd() - 0.5) * 1.2;
    const x = sh.x + Math.cos(sh.heading + off) * d, z = sh.z + Math.sin(sh.heading + off) * d;
    if (!g.world.seaClear(x, z)) { this.next = g.time + 10; return; }
    this.bottle = { x, z, until: g.time + BOTTLE_CONFIG.floats };
    g.msg('A bottle bobs in the swell off your bow, corked and waxed. Sail over it to bring it aboard.', 'quest');
  }

  private haul() {
    const g = this.g, read = new Set(g.s.bottles ?? []);
    const unread = BOTTLES.filter((b) => !read.has(b.id));
    if (unread.length) {
      const b = unread[Math.floor(this.rnd() * unread.length)];
      g.s.bottles = [...read, b.id];
      g.msg(`You fish the bottle aboard and pull the cork: ${b.title.toLowerCase()}. (${read.size + 1} of ${BOTTLES.length}; kept in your journal.)`, 'loot');
      g.emit({ type: 'read', title: b.title, sub: 'A message in a bottle', lines: b.lines });
    } else if (this.rnd() < 0.5 && canAdd(g.p.inv, 'treasure_map')) {
      g.give('treasure_map', 1);
      g.msg('You fish the bottle aboard. Rolled up inside: a treasure map.', 'loot');
    } else {
      g.give('charm_tide', 15 + Math.floor(this.rnd() * 25));
      g.msg('You fish the bottle aboard. Someone filled it with tide charms and threw it away. People do.', 'loot');
    }
    g.addXp('sailing', 40 + g.level('sailing') * 2);
    g.rev++;
  }

  /** read one again from the journal */
  reread(id: string) {
    const b = BOTTLE_BY[id];
    if (b && (this.g.s.bottles ?? []).includes(id)) this.g.emit({ type: 'read', title: b.title, sub: 'A message in a bottle', lines: b.lines });
  }
}
