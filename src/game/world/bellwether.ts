import { mulberry32 } from '../../art/noise';
import type { BuildingDef, BuildingStyle, Furniture } from './buildings';
import type { TownNpc, TownPlan } from './town';

// Bellwether at 4.5 times the size (Tom, 2026-10-28: "towns, not just camps; ports; masses of NPCs; think major
// cities and towns"). The old harbour town is now the heart of Bellwether city: streets run out from it along the
// waterfront and up the hill, lined with houses, shops and workshops you can walk into. Past the city, four towns:
// Copperback under the hills, Saltpine at the wood's edge, Mirewater on the fen, Gullhaven on the north shore.
//
// Pure data and maths, like island.ts (which calls this with its coast and road functions).

const F = (kind: Furniture['kind'], x: number, z: number, rot = 0, w?: number): Furniture => ({ kind, x, z, rot, w });

/** A kind of building: its size, look and furniture (local coordinates; the door is in the +z wall). */
interface Kind { w: number; d: number; style?: BuildingStyle; storeys?: number; chimney?: boolean; sign?: number; door?: number; furniture: Furniture[] }
const HOUSE = (furniture: Furniture[], style?: BuildingStyle, door = 0.6): Kind => ({ w: 5.5, d: 4.6, style, door, furniture });

/** Ordinary homes: who lives there, and the room that goes with it. */
const HOMES: [string, Kind][] = [
  ['A fisher\'s house', HOUSE([F('bed', -1.7, -0.6), F('nets', 1.2, -1.95), F('table', 1.0, 0.4), F('stool', 1.0, 1.1)], 'timber')],
  ['A carter\'s house', HOUSE([F('bed', 1.7, -0.6), F('table', -0.8, -1.2), F('stool', -0.8, -0.3), F('fireplace', -1.2, -1.95), F('chest', 1.7, 1.4)], 'plaster', -0.6)],
  ['A widow\'s house', HOUSE([F('bed', -1.7, -0.6), F('rug', 0.3, 0.4), F('plant', 1.9, 1.5), F('fireplace', 1.2, -1.95), F('stool', 1.0, -0.6)], 'timber')],
  ['A docker\'s house', HOUSE([F('bed', -1.7, -0.6), F('bed', 1.7, -0.6), F('table', 0, 0.8), F('chest', 0, -1.6)], 'stone')],
  ['A boatwright\'s house', HOUSE([F('bed', 1.7, -0.6), F('crate', -1.8, -1.6), F('table', -0.6, 0.5), F('stool', 0.1, 0.5)], 'timber', -0.6)],
  ['A pilot\'s house', HOUSE([F('bed', -1.7, -0.6), F('globe', 1.8, -1.5), F('table', 0.8, 0.6), F('stool', 0.8, 1.3)], 'plaster')],
  ['A clerk\'s house', HOUSE([F('bed', -1.7, -0.6), F('bookshelf', 1.2, -1.95), F('table', 1.0, 0.4), F('stool', 1.0, 1.1)], 'stone')],
  ['A laundress\'s house', HOUSE([F('bed', 1.7, -0.6), F('cauldron', -1.3, -1.4), F('sacks', -1.8, 1.2, Math.PI / 2), F('rug', 0.2, 0.6)], 'plaster', -0.6)],
  ['A sailor\'s house', HOUSE([F('bed', -1.7, -0.6), F('chest', 1.7, -1.5), F('table', 1.0, 0.6), F('stool', 1.0, 1.3), F('rug', -0.4, 1.0)], 'timber')],
  ['A family\'s house', HOUSE([F('bed', -1.7, -0.6), F('bed', 1.7, -0.6), F('table', 0, 0.7), F('stool', -0.7, 0.7), F('stool', 0.7, 0.7), F('fireplace', 0, -1.95)], 'plaster')],
];

/** Workshops and shops that need no keeper to talk to: you can walk in and look round. */
const TRADES: [string, Kind][] = [
  ['The rope-maker\'s', { w: 7, d: 5, style: 'timber', sign: 0x8a6a3a, chimney: false, furniture: [F('nets', -2.2, -2.0), F('nets', 0, -2.0), F('barrel', 2.6, -1.6), F('barrel', 2.6, -0.8), F('sacks', -2.6, 1.4, Math.PI / 2), F('bench', 0.6, 0.6)] }],
  ['A chandler\'s shop', { w: 6, d: 5, style: 'plaster', sign: 0x6a5a2a, furniture: [F('counter', 0, -0.6, 0, 2.6), F('shelf', -1.6, -2.1), F('shelf', 1.6, -2.1), F('crate', 2.2, 1.4), F('barrel', -2.3, 1.3)] }],
  ['The cooper\'s workshop', { w: 7, d: 5, style: 'timber', sign: 0x7a4a22, furniture: [F('barrel', -2.6, -1.6), F('barrel', -1.8, -1.7), F('barrel', -2.6, -0.8), F('kegs', 1.6, -1.9), F('bench', 1.0, 0.6), F('fireplace', 2.8, 0.6, -Math.PI / 2)] }],
  ['A sailmaker\'s loft', { w: 7, d: 5, style: 'plaster', sign: 0xd8ccb0, chimney: false, furniture: [F('loom', -1.8, -1.6), F('loom', 0.6, -1.6), F('sacks', 2.5, -1.7), F('table', 1.6, 0.9), F('rug', -1.2, 0.9)] }],
  ['The cobbler\'s', { w: 6, d: 5, style: 'timber', sign: 0x5a3a2a, furniture: [F('counter', 0, -0.4, 0, 2.2), F('shelf', -1.6, -2.1), F('stool', 1.8, -1.4), F('crate', -2.1, 1.4)] }],
  ['A candle-maker\'s', { w: 6, d: 5, style: 'plaster', sign: 0xe8d8a0, furniture: [F('cauldron', -1.6, -1.4), F('shelf', 1.4, -2.1), F('table', 1.2, 0.6), F('stool', 0.4, 0.6)] }],
  ['A tailor\'s shop', { w: 6, d: 5, style: 'plaster', sign: 0x6a3a6a, furniture: [F('loom', -1.4, -1.6), F('counter', 0.6, 0.2, 0, 2.0), F('shelf', 1.6, -2.1), F('rug', -1.2, 1.2)] }],
  ['A net-mender\'s loft', { w: 7, d: 5, style: 'timber', chimney: false, furniture: [F('nets', -2.2, -2.0), F('nets', 0.4, -2.0), F('nets', 2.6, -0.2, Math.PI / 2), F('stool', -1.2, 0.6), F('crate', -2.6, 1.5)] }],
  ['A smokehouse', { w: 6, d: 5, style: 'stone', chimney: true, furniture: [F('fireplace', 0, -1.95), F('barrel', -2.2, 0.8), F('barrel', 2.2, 0.8), F('nets', -1.6, -1.95)] }],
  ['A spice merchant\'s', { w: 6, d: 5, style: 'plaster', sign: 0xb8862a, furniture: [F('counter', 0, -0.5, 0, 2.6), F('sacks', -1.9, -2.0), F('sacks', -0.7, -2.1), F('sacks', 1.4, -2.0), F('plant', 2.3, 1.6)] }],
  ['The scrivener\'s', { w: 6, d: 5, style: 'stone', sign: 0x2f4a6a, furniture: [F('bookshelf', -1.4, -2.1), F('bookshelf', 1.4, -2.1), F('table', 0, 0.2), F('stool', 0, 0.9), F('rug', 0, 0.4)] }],
  ['A boatyard shed', { w: 8, d: 6, style: 'timber', chimney: false, furniture: [F('crate', -3.0, -2.4), F('crate', -2.2, -2.4), F('bench', 1.0, -2.3), F('barrel', 3.0, 1.9), F('nets', 0.6, 2.4, Math.PI)] }],
  ['A warehouse', { w: 8, d: 6, style: 'timber', chimney: false, furniture: [F('crate', -3.0, -2.4), F('crate', -2.2, -2.4), F('crate', -3.0, -1.6), F('kegs', 1.6, -2.4), F('sacks', 2.6, 1.8), F('barrel', -2.9, 2.0)] }],
];

/** A building with a keeper: someone stands behind the counter (an NpcDef with this id must exist). */
interface Named { id: string; name: string; kind: Kind; npc?: { id: string; x: number; z: number }; style?: BuildingStyle }

const SHOP_KIND = (sign: number, style: BuildingStyle = 'plaster'): Kind => ({ w: 6.5, d: 5.5, style, sign, furniture: [F('counter', 0, -0.7, 0, 2.8), F('shelf', -1.8, -2.4), F('shelf', 1.8, -2.4), F('crate', 2.4, 1.6), F('barrel', -2.5, 1.6)] });
const INN_KIND = (sign: number): Kind => ({ w: 11, d: 8, style: 'plaster', storeys: 2, sign, furniture: [F('bar', 0, -2.4, 0, 4), F('kegs', -3.6, -3.4), F('kegs', 3.6, -3.4), F('table', -3.2, 0.6), F('stool', -3.9, 0.6), F('stool', -2.5, 0.6), F('table', 3.2, 0.6), F('stool', 3.9, 0.6), F('stool', 2.5, 0.6), F('table', 0, 1.6), F('stool', -0.7, 1.6), F('stool', 0.7, 1.6), F('fireplace', -4.6, -1, Math.PI / 2), F('rug', 0, -0.3)] });
/** a bank's counter: the grille sits where the strongbox booth expects it (local z -0.9) */
const BANK_KIND = (sign: number): Kind => ({ w: 8, d: 6, style: 'stone', sign, furniture: [F('grille', 0, -0.9, 0, 5), F('chest', -2.2, -2.3), F('chest', -0.7, -2.4), F('chest', 0.9, -2.4), F('plant', -3.3, 2.2), F('plant', 3.3, 2.2)] });
const HALL_KIND = (sign: number): Kind => ({ w: 9, d: 6.5, style: 'stone', sign, storeys: 2, furniture: [F('table', 0, -1.4), F('bench', 0, -0.6), F('bookshelf', -3.3, -2.6), F('bookshelf', 3.3, -2.6), F('fireplace', 3.9, 0.5, -Math.PI / 2), F('rug', -1.5, 1.4)] });

export interface Street { pts: [number, number][]; width: number; paved?: boolean }
export interface PlanCtx {
  coastDist: (x: number, z: number) => number;
  coastPoint: (deg: number, inset: number) => [number, number];
  beach: number;
}
export interface BellPlan extends TownPlan {
  /** the city's and towns' streets (drawn cobbled in the city) */
  streets: Street[];
  /** townsfolk walking their rounds: stops in order (the layout finds the paths between them) */
  rounds: { look: string; stops: [number, number][] }[];
  /** people who stand outside (a stall-holder): world position */
  outdoor: { id: string; x: number; z: number; facing: number }[];
}

// ---- placement -----------------------------------------------------------------------------------------------
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
function lineDist(pts: [number, number][], x: number, z: number) {
  let d = Infinity;
  for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(x, z, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
  return d;
}

class Planner {
  readonly buildings: BuildingDef[] = [];
  readonly npcs: TownNpc[] = [];
  readonly stalls: TownPlan['stalls'] = [];
  readonly squares: TownPlan['squares'] = [];
  readonly streets: Street[] = [];
  readonly rounds: BellPlan['rounds'] = [];
  readonly outdoor: BellPlan['outdoor'] = [];
  /** circles nothing may be built in (squares, stations, old buildings) */
  readonly keep: { x: number; z: number; r: number }[] = [];
  private seed = 100;
  private rnd = mulberry32(2810);
  constructor(readonly ctx: PlanCtx) {}

  /** room for a w x d building centred at (x, z) turned `rot`? */
  fits(x: number, z: number, w: number, d: number, rot: number, own?: Street) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    // dry land, off the sand, front step included
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd + 1.5], [hw, hd + 1.5], [0, 0]]) {
      const px = x + lx * c - lz * s, pz = z + lx * s + lz * c;
      if (this.ctx.coastDist(px, pz) < this.ctx.beach + 1.5) return false;
    }
    const r = Math.hypot(w, d) / 2;
    for (const b of this.buildings) if (Math.hypot(b.x - x, b.z - z) < r + Math.hypot(b.w, b.d) / 2 * 0.92 + 1.2) return false;
    for (const k of this.keep) if (Math.hypot(k.x - x, k.z - z) < r + k.r) return false;
    for (const st of this.streets) if (st !== own && lineDist(st.pts, x, z) < r + st.width / 2 + 0.8) return false;
    return true;
  }

  add(id: string, name: string, k: Kind, x: number, z: number, rot: number, npc?: Named['npc']) {
    const b: BuildingDef = { id, name, style: k.style ?? (['timber', 'plaster', 'stone'] as const)[this.seed % 3], x, z, rot, w: k.w, d: k.d, door: k.door ?? 0, furniture: k.furniture, seed: this.seed++, storeys: k.storeys, chimney: k.chimney, sign: k.sign };
    this.buildings.push(b);
    if (npc) this.npcs.push({ id: npc.id, building: id, x: npc.x, z: npc.z, facing: 0 });
    return b;
  }

  /** the building's centre and turn for a lot `setback` metres off the street at `t` metres along it, on `side` */
  private lot(st: Street, t: number, side: 1 | -1, setback: number, d: number) {
    const pts = st.pts;
    let k = 0, acc = 0;
    while (k < pts.length - 2 && acc + Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) < t) { acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); k++; }
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az) || 1;
    const f = Math.min(1, Math.max(0, (t - acc) / len)), tx = (bx - ax) / len, tz = (bz - az) / len;
    const nx = -tz * side, nz = tx * side; // the side the building stands on
    const off = st.width / 2 + setback + d / 2;
    const x = ax + (bx - ax) * f + nx * off, z = az + (bz - az) * f + nz * off;
    return { x, z, rot: Math.atan2(nx, -nz) }; // door toward the street
  }

  /** line both sides of a street: the `named` buildings first, then each of `fill` once, from `from` to `to` metres along */
  line(st: Street, prefix: string, named: Named[], fill: [string, Kind][], opts: { from?: number; to?: number; gap?: number; setback?: number; sides?: (1 | -1)[] } = {}) {
    const total = st.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - st.pts[i][0], p[1] - st.pts[i][1]), 0);
    const from = opts.from ?? 4, to = Math.min(total - 3, opts.to ?? total - 3), gap = opts.gap ?? 2.2;
    const queue = [...named];
    let fi = 0;
    const doors: [number, number][] = [];
    for (const side of opts.sides ?? [1, -1] as (1 | -1)[]) {
      for (let t = from + (side === -1 ? 3 : 0); t < to;) {
        const named1 = queue[0], plain = named1 ? null : fill[fi];
        if (!named1 && !plain) break;
        const k = named1 ? named1.kind : plain![1];
        const at = this.lot(st, t + k.w / 2, side, opts.setback ?? 1.4, k.d);
        if (t + k.w > to || !this.fits(at.x, at.z, k.w, k.d, at.rot, st)) { t += 2.5; continue; }
        const b = named1
          ? this.add(named1.id, named1.name, { ...k, style: named1.style ?? k.style }, at.x, at.z, at.rot, named1.npc)
          : this.add(`${prefix}_${this.buildings.length}`, plain![0], k, at.x, at.z, at.rot);
        if (named1) queue.shift(); else fi++;
        doors.push([b.x - Math.sin(b.rot) * (b.d / 2 + 1.4), b.z + Math.cos(b.rot) * (b.d / 2 + 1.4)]);
        t += k.w + gap + this.rnd() * 2;
      }
    }
    return doors;
  }

  /** buildings round a square, doors facing in: `slots` are [angle in degrees, lot] */
  ring(cx: number, cz: number, r: number, slots: [number, Named | [string, Kind]][], prefix: string) {
    const doors: [number, number][] = [];
    for (const [a, lotDef] of slots) {
      const k = Array.isArray(lotDef) ? lotDef[1] : lotDef.kind;
      for (let push = 0; push < 4; push++) {
        const rr = r + k.d / 2 + push * 2, t = (a * Math.PI) / 180;
        const x = cx + Math.cos(t) * rr, z = cz + Math.sin(t) * rr;
        const nx = -Math.cos(t), nz = -Math.sin(t), rot = Math.atan2(-nx, nz); // door faces the square's middle
        if (!this.fits(x, z, k.w, k.d, rot)) continue;
        const id = Array.isArray(lotDef) ? `${prefix}_${this.buildings.length}` : lotDef.id;
        const b = this.add(id, Array.isArray(lotDef) ? lotDef[0] : lotDef.name, Array.isArray(lotDef) ? k : { ...k, style: lotDef.style ?? k.style }, x, z, rot, Array.isArray(lotDef) ? undefined : lotDef.npc);
        doors.push([b.x + -Math.sin(b.rot) * (b.d / 2 + 1.4), b.z + Math.cos(b.rot) * (b.d / 2 + 1.4)]);
        break;
      }
    }
    return doors;
  }

  /** a walker for every few doors along a street (the layout paths them on the walk grid) */
  walkers(doors: [number, number][], street: [number, number][], n: number) {
    const looks = ['towns_a', 'towns_b', 'towns_c', 'towns_d', 'towns_e', 'towns_f', 'towns_g', 'towns_h', 'towns_i', 'towns_j'];
    for (let k = 0; k < n; k++) {
      const stops: [number, number][] = [];
      const pick = () => doors[Math.floor(this.rnd() * doors.length)];
      stops.push(street[k % street.length]);
      if (doors.length) stops.push(pick());
      stops.push(street[(k + 2) % street.length]);
      if (doors.length) stops.push(pick());
      stops.push(street[street.length - 1 - (k % street.length)]);
      this.rounds.push({ look: looks[(this.rounds.length * 3 + k) % looks.length], stops });
    }
  }

  street(pts: [number, number][], width: number, paved = true) { const st: Street = { pts, width, paved }; this.streets.push(st); return st; }
  pick<T>(list: T[]) { return list[Math.floor(this.rnd() * list.length)]; }
  mix(n: number, homes = HOMES, trades = TRADES, tradeShare = 0.35): [string, Kind][] {
    const out: [string, Kind][] = [];
    for (let k = 0; k < n; k++) out.push(this.rnd() < tradeShare ? this.pick(trades) : this.pick(homes));
    return out;
  }
}

/** The people who keep the new buildings (their NpcDefs and looks are in data/bellfolk.ts). */
export const CITY_KEEPERS = ['brannock', 'wren', 'nell', 'harlan', 'bracken', 'sabine', 'thrift', 'rook', 'linnet', 'tam', 'bess'] as const;

/**
 * Bellwether city and the island's towns. `old` is the harbour town (town.ts townPlan), kept as the city's heart:
 * `V` its quay square, `X` its market square. `towns` are the four towns' squares.
 */
export function bellwetherPlan(ctx: PlanCtx, old: TownPlan, V: { x: number; z: number }, X: { x: number; z: number },
  towns: { copperback: { x: number; z: number }; saltpine: { x: number; z: number }; mirewater: { x: number; z: number }; gullhaven: { x: number; z: number } }): BellPlan {
  const P = new Planner(ctx);
  // the old town stays as it was
  P.buildings.push(...old.buildings);
  P.npcs.push(...old.npcs);
  P.stalls.push(...old.stalls);
  P.squares.push(...old.squares, { x: V.x, z: V.z, r: 14 });
  P.keep.push({ x: V.x, z: V.z, r: 15 }, { x: X.x, z: X.z, r: 11 }, { x: V.x + 15, z: V.z + 4, r: 6 }); // the squares and the smithy
  const cp = ctx.coastPoint;

  // ---- Harbour Row: the east waterfront, warehouses and the fish market
  const harbour = P.street([[V.x + 18, V.z - 4], ...[86, 82, 78, 74, 70, 66].map((a) => cp(a, 24))], 2.6);
  const fishSq = cp(78, 30);
  P.keep.push({ x: fishSq[0], z: fishSq[1], r: 7 });
  P.squares.push({ x: fishSq[0], z: fishSq[1], r: 7 });
  const hd = P.line(harbour, 'hr', [
    { id: 'customs', name: 'The Customs House', kind: HALL_KIND(0x2f4a6a), npc: { id: 'brannock', x: 0, z: -1.6 } },
    { id: 'furrier', name: 'Wren\'s Furs and Hides', kind: SHOP_KIND(0x6a4a2a, 'timber'), npc: { id: 'wren', x: 0, z: -1.7 } },
    { id: 'shipwright', name: 'Crewe\'s Shipyard', kind: { w: 8, d: 6, style: 'timber', sign: 0x5a3a20, chimney: false, furniture: [F('crate', -3.0, -2.4), F('bench', 0, -2.3), F('barrel', 3.0, -2.0), F('nets', 0.6, 2.4, Math.PI)] }, npc: { id: 'harlan', x: 0, z: -0.8 } },
  ], P.mix(9, HOMES, TRADES, 0.5), { gap: 1.6 });
  P.stalls.push({ x: fishSq[0] - 4, z: fishSq[1] + 2, rot: 0.3, colour: 0x2f6a8a }, { x: fishSq[0] + 4, z: fishSq[1] + 2, rot: -0.3, colour: 0xd8d0c0 });
  P.outdoor.push({ id: 'nell', x: fishSq[0], z: fishSq[1] - 1.2, facing: Math.PI / 2 });
  P.walkers(hd, harbour.pts, 5);

  // ---- the West End: the west waterfront, homes and net lofts
  const west = P.street([[V.x - 20, V.z - 2], ...[96, 100, 104, 108].map((a) => cp(a, 26))], 2.4);
  const wd = P.line(west, 'we', [], P.mix(12, HOMES, TRADES, 0.3), { gap: 1.8 });
  P.walkers(wd, west.pts, 4);

  // ---- High Street: north from the market square, the busiest street in the Reef
  const high = P.street([[X.x, X.z - 12], [X.x + 1, X.z - 40], [X.x - 1, X.z - 70], [X.x + 2, X.z - 100], [X.x, X.z - 124]], 3.2);
  const hs = P.line(high, 'hs', [
    { id: 'blades', name: 'Bracken\'s Blades', kind: SHOP_KIND(0x8a2a22, 'stone'), npc: { id: 'bracken', x: 0, z: -1.8 } },
    { id: 'armour', name: 'Holt\'s Armoury', kind: SHOP_KIND(0x5a5a62, 'stone'), npc: { id: 'sabine', x: 0, z: -1.8 } },
    { id: 'apothecary', name: 'Mother Thrift\'s Remedies', kind: SHOP_KIND(0x4a7a4a), npc: { id: 'thrift', x: 0, z: -1.8 } },
    { id: 'barracks', name: 'The Watch House', kind: HALL_KIND(0x6a2a24), npc: { id: 'rook', x: 0, z: -1.4 } },
    { id: 'library', name: 'The Reading Room', kind: { ...HALL_KIND(0x2f5a6a), furniture: [F('bookshelf', -3.3, -2.6), F('bookshelf', -1.3, -2.6), F('bookshelf', 1.3, -2.6), F('bookshelf', 3.3, -2.6), F('table', -1.6, 0.3), F('table', 1.6, 0.3), F('stool', -1.6, 1.0), F('stool', 1.6, 1.0), F('globe', 3.6, 1.6)] }, npc: { id: 'linnet', x: 0, z: -1.2 } },
    { id: 'bakery', name: 'Rowan\'s Bakery', kind: { ...SHOP_KIND(0xc9a050, 'timber'), furniture: [F('counter', 0, -0.7, 0, 2.8), F('fireplace', -1.6, -2.45), F('sacks', 1.8, -2.2), F('table', 2.2, 1.4)] }, npc: { id: 'bess', x: 0, z: -1.8 } },
  ], P.mix(14, HOMES, TRADES, 0.4), { gap: 1.4, from: 6 });
  P.walkers(hs, high.pts, 7);

  // ---- East Street: toward the east road, the Gull and Anchor halfway along
  const east = P.street([[X.x + 12, X.z + 1], [X.x + 40, X.z - 2], [X.x + 70, X.z - 6], [X.x + 96, X.z - 14]], 2.8);
  const ed = P.line(east, 'es', [
    { id: 'gull_inn', name: 'The Gull and Anchor', kind: INN_KIND(0x2f6a8a), npc: { id: 'tam', x: 0, z: -3.3 } },
  ], P.mix(10, HOMES, TRADES, 0.35), { gap: 1.6, from: 22 });
  P.walkers(ed, east.pts, 4);

  // ---- West Street: toward Saltpine
  const weststreet = P.street([[X.x - 12, X.z + 1], [X.x - 42, X.z - 1], [X.x - 72, X.z - 4], [X.x - 98, X.z - 2]], 2.6);
  const wsd = P.line(weststreet, 'ws', [], P.mix(12, HOMES, TRADES, 0.3), { gap: 1.8, from: 22 });
  P.walkers(wsd, weststreet.pts, 4);

  // ---- the towns -----------------------------------------------------------------------------------------
  // Copperback: the miners' town under the hills. A square with the forge at one side; the inn, the store, the assay
  // office (a bank) and the foreman's office round it; miners' rows up the road north
  {
    const C = towns.copperback;
    P.squares.push({ x: C.x, z: C.z, r: 10 });
    P.keep.push({ x: C.x, z: C.z, r: 10 });
    const d = P.ring(C.x, C.z, 10.5, [
      [200, { id: 'cb_inn', name: 'The Pick and Lantern', kind: INN_KIND(0x8a5a2a), npc: { id: 'molly', x: 0, z: -3.3 } }],
      [250, { id: 'cb_store', name: 'Coyle\'s Mining Supplies', kind: SHOP_KIND(0x7a6a3a, 'timber'), npc: { id: 'rudd', x: 0, z: -1.8 } }],
      [300, { id: 'cb_bank', name: 'Copperback Assay Office', kind: BANK_KIND(0xc9a050), npc: { id: 'penn', x: 0, z: -1.9 } }],
      [345, { id: 'cb_office', name: 'The Foreman\'s Office', kind: { w: 6, d: 5, style: 'stone', sign: 0x4a4a52, furniture: [F('maptable', 0, -0.6), F('chest', -2.2, -1.6), F('bookshelf', 1.6, -2.1), F('stool', 1.0, 0.6)] }, npc: { id: 'agnes', x: 0.6, z: 0.4 } }],
      [150, ['A miner\'s house', HOUSE([F('bed', -1.7, -0.6), F('table', 1.0, -1.2), F('stool', 1.0, -0.3), F('fireplace', 1.2, -1.95)], 'stone')]],
      [110, ['A miner\'s house', HOUSE([F('bed', 1.7, -0.6), F('chest', -1.7, -1.5), F('table', -0.6, 0.5)], 'timber')]],
    ], 'cb');
    const row = P.street([[C.x + 4, C.z - 12], [C.x + 10, C.z - 40], [C.x + 16, C.z - 62]], 2.2, false);
    const rd = P.line(row, 'cbr', [], Array.from({ length: 6 }, () => ['A miner\'s house', P.pick(HOMES)[1]] as [string, Kind]), { gap: 1.6 });
    P.walkers([...d, ...rd], [[C.x - 6, C.z + 4], [C.x + 6, C.z - 3], ...row.pts], 5);
  }
  // Saltpine: the woodcutters' village at the wood's edge: a sawmill, a lodge and cottages round a green
  {
    const S = towns.saltpine;
    P.squares.push({ x: S.x, z: S.z, r: 8 });
    P.keep.push({ x: S.x, z: S.z, r: 8 });
    const d = P.ring(S.x, S.z, 8.5, [
      [0, { id: 'sp_mill', name: 'Saltpine Sawmill', kind: { w: 8, d: 6, style: 'timber', sign: 0x8a6a3a, chimney: false, furniture: [F('bench', -1.4, -2.3, 0), F('crate', 3.0, -2.4), F('sacks', 3.0, 1.8), F('counter', 0, 0.2, 0, 2.6)] }, npc: { id: 'tilda', x: 0, z: -0.6 } }],
      [60, { id: 'sp_lodge', name: 'The Forester\'s Lodge', kind: { w: 7, d: 5.5, style: 'timber', sign: 0x3a5a2a, furniture: [F('table', 0, -1.0), F('bench', 0, -0.3), F('fireplace', 0, -2.45), F('chest', -2.6, 1.6), F('rug', 1.2, 1.2)] }, npc: { id: 'ewan', x: 0.8, z: 0.6 } }],
      [120, { id: 'sp_tannery', name: 'Gorse\'s Tannery', kind: { w: 6, d: 5, style: 'timber', chimney: false, furniture: [F('cauldron', -1.6, -1.4), F('cauldron', 1.6, -1.4), F('sacks', 2.1, 1.4), F('bench', -0.6, 1.0)] }, npc: { id: 'gorse', x: 0, z: 0.2 } }],
      [180, ['A woodcutter\'s cottage', HOUSE([F('bed', -1.7, -0.6), F('fireplace', 1.2, -1.95), F('table', 1.0, 0.4), F('stool', 1.0, 1.1)], 'timber')]],
      [230, ['A woodcutter\'s cottage', HOUSE([F('bed', 1.7, -0.6), F('chest', -1.7, -1.5), F('table', -0.6, 0.5), F('stool', 0.1, 0.5)], 'timber')]],
      [290, ['A charcoal-burner\'s hut', HOUSE([F('bed', -1.7, -0.6), F('sacks', 1.6, -1.9), F('fireplace', 1.2, -1.95)], 'timber')]],
      [320, ['A woodcutter\'s cottage', HOUSE([F('bed', 1.7, -0.6), F('table', -0.8, -1.2), F('stool', -0.8, -0.3), F('fireplace', -1.2, -1.95)], 'plaster')]],
    ], 'sp');
    P.walkers(d, [[S.x - 5, S.z + 3], [S.x + 5, S.z - 3], [S.x, S.z + 5]], 3);
  }
  // Mirewater: eel-fishers' huts on the fen's east shore
  {
    const M = towns.mirewater;
    P.squares.push({ x: M.x, z: M.z, r: 6 });
    P.keep.push({ x: M.x, z: M.z, r: 6 });
    const hut = (f: Furniture[]): Kind => ({ w: 5, d: 4.4, style: 'timber', furniture: f });
    const d = P.ring(M.x, M.z, 6.5, [
      [20, { id: 'mw_nan', name: 'Nan Reedy\'s hut', kind: hut([F('cauldron', -1.3, -1.2), F('bed', 1.5, -0.4), F('plant', -1.6, 1.3)]), npc: { id: 'reedy', x: 0, z: 0 } }],
      [90, { id: 'mw_eel', name: 'The eel-smokers\' hut', kind: hut([F('fireplace', 0, -1.85), F('barrel', -1.6, 1.2), F('nets', 1.4, 1.6, Math.PI)]), npc: { id: 'tad', x: 0, z: 0.2 } }],
      [160, ['An eel-fisher\'s hut', hut([F('bed', -1.5, -0.4), F('nets', 1.2, -1.85), F('stool', 1.0, 0.6)])]],
      [-40, ['An eel-fisher\'s hut', hut([F('bed', 1.5, -0.4), F('barrel', -1.5, -1.3), F('stool', -0.6, 0.6)])]],
    ], 'mw');
    P.walkers(d, [[M.x - 3, M.z + 2], [M.x + 3, M.z - 2]], 2);
  }
  // Gullhaven: a fishing village on the north shore; net lofts, a smokehouse, the headwoman's house, a little chapel
  {
    const G = towns.gullhaven;
    P.squares.push({ x: G.x, z: G.z, r: 8 });
    P.keep.push({ x: G.x, z: G.z, r: 8 });
    const d = P.ring(G.x, G.z, 8.5, [
      [250, { id: 'gh_head', name: 'The headwoman\'s house', kind: { w: 6.5, d: 5, style: 'stone', furniture: [F('table', 0, -1.0), F('stool', -0.7, -0.3), F('stool', 0.7, -0.3), F('fireplace', 0, -2.2), F('bed', 2.4, 1.0, Math.PI / 2), F('chest', -2.6, 1.6)] }, npc: { id: 'elspeth', x: 0, z: 0.4 } }],
      [300, { id: 'gh_store', name: 'Morrow\'s Fish and Tackle', kind: SHOP_KIND(0x2f6a8a, 'timber'), npc: { id: 'kit', x: 0, z: -1.8 } }],
      [200, { id: 'gh_chapel', name: 'Gullhaven Chapel', kind: { w: 6, d: 9, style: 'stone', chimney: false, furniture: [F('altar', 0, -3.4), F('pew', -1.5, -1.2), F('pew', 1.5, -1.2), F('pew', -1.5, 0.6), F('pew', 1.5, 0.6)] } }],
      [340, ['A smokehouse', TRADES.find(([n]) => n === 'A smokehouse')![1]]],
      [150, { id: 'gh_jowan', name: 'Old Jowan\'s house', kind: HOUSE([F('bed', -1.7, -0.6), F('nets', 1.2, -1.95), F('stool', 1.0, 0.6), F('chest', -1.7, 1.4)], 'timber'), npc: { id: 'jowan', x: 0.8, z: 0.2 } }],
      [20, ['A net loft', TRADES.find(([n]) => n === 'A net-mender\'s loft')![1]]],
      [100, ['A fisher\'s house', HOMES[0][1]]],
      [60, ['A fisher\'s house', HOMES[8][1]]],
    ], 'gh');
    P.walkers(d, [[G.x - 5, G.z + 3], [G.x + 5, G.z - 2], [G.x, G.z - 5]], 3);
  }

  return { buildings: P.buildings, npcs: P.npcs, stalls: P.stalls, squares: P.squares, streets: P.streets, rounds: P.rounds, outdoor: P.outdoor };
}
