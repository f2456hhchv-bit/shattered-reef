// The sea as a place to fight and work (Tom, 2026-10-25, docs/ISLANDS.md: "we haven't even touched the boat side").
// Rules ported from Tom's the-shattered-reef: read the foe, swap the ammo. Cannonballs do everything a little; each
// foe has one ammo that hits it properly; sharks under the water can only be reached with depth charges.
import type { RegionId } from '../world/regions';
import { coastPoint } from '../world/island';

export type AmmoId = 'cannonball' | 'chain_shot' | 'depth_charge';

export interface AmmoDef {
  id: AmmoId;
  name: string;
  /** the pack item it uses up, or null: cannonballs are the ship's own, endless */
  item: string | null;
  damage: number;
  /** against a foe this ammo isn't the counter for */
  offCounter: number;
  /** a broadside fires sideways at a foe; a depth charge drops off the stern and bursts */
  kind: 'broadside' | 'charge';
  sailing: number; // Sailing level to load it
}

export const AMMO: Record<AmmoId, AmmoDef> = {
  cannonball: { id: 'cannonball', name: 'Cannonballs', item: null, damage: 30, offCounter: 0.6, kind: 'broadside', sailing: 1 },
  chain_shot: { id: 'chain_shot', name: 'Chain shot', item: 'chain_shot', damage: 34, offCounter: 0.25, kind: 'broadside', sailing: 5 },
  depth_charge: { id: 'depth_charge', name: 'Depth charges', item: 'depth_charge', damage: 70, offCounter: 0.5, kind: 'charge', sailing: 10 },
};

export const NAVAL = {
  /** broadside reach (m) and how far off the beam a foe can be and still be fired on (each side, radians) */
  range: 15,
  arc: 1.05,
  /** seconds between broadsides at Sailing 1 (perks shorten it) */
  reload: 3.2,
  balls: 3,
  ballSpeed: 24,
  charge: { fuse: 1.1, radius: 4, reload: 2.4 },
  /** hull at Sailing 1, and what each level adds */
  hull: 120,
  hullPerLevel: 6,
  /** hull mends this much a second out of a fight (nothing engaged, nothing hit it for `mendAfter` seconds) */
  mend: 2,
  mendAfter: 8,
  /** foes keep this far from a harbour's mooring: the harbour is safe water */
  harbour: 32,
  /** towed home when the hull breaks: the harbour crew's fee */
  towFee: 0.1,
  /** a little Sailing XP for every this many metres sailed */
  xpPerMetres: 60,
};

export type SeaBehaviour = 'cutter' | 'flock' | 'shark';

export interface SeaFoeDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  /** the ammo that hits it properly */
  counter: AmmoId;
  behaviour: SeaBehaviour;
  speed: number;
  damage: number; // per shot, dive or ram, in hull points
  aggro: number;
  /** seconds between attacks */
  cooldown: number;
  xp: number; // Sailing XP for sinking it
  coins: [number, number];
  drops: { item: string; chance: number; qty?: [number, number] }[];
  scale: number;
  boss?: boolean;
  respawn: number;
}

export const SEA_FOES: Record<string, SeaFoeDef> = {
  gull_flock: { id: 'gull_flock', name: 'Gull flock', level: 4, hp: 40, counter: 'chain_shot', behaviour: 'flock', speed: 6, damage: 4, aggro: 16, cooldown: 2.6, xp: 18,
    coins: [2, 8], drops: [{ item: 'fish_sprat_raw', chance: 0.6, qty: [1, 3] }], scale: 1, respawn: 40 },
  wreckers_cutter: { id: 'wreckers_cutter', name: 'Wreckers\' cutter', level: 9, hp: 170, counter: 'cannonball', behaviour: 'cutter', speed: 5, damage: 20, aggro: 20, cooldown: 3.2, xp: 45,
    coins: [15, 40], drops: [{ item: 'chain_shot', chance: 0.5, qty: [4, 10] }, { item: 'bar_bronze', chance: 0.3, qty: [1, 2] }, { item: 'charm_tide', chance: 0.4, qty: [4, 10] }], scale: 0.75, respawn: 60 },
  reef_shark: { id: 'reef_shark', name: 'Reef shark', level: 14, hp: 190, counter: 'depth_charge', behaviour: 'shark', speed: 7, damage: 26, aggro: 18, cooldown: 4.5, xp: 60,
    coins: [5, 15], drops: [{ item: 'shark_tooth', chance: 0.6 }, { item: 'fish_salmon_raw', chance: 0.3 }], scale: 1, respawn: 60 },
  old_gnasher: { id: 'old_gnasher', name: 'Old Gnasher', level: 20, hp: 650, counter: 'depth_charge', behaviour: 'shark', speed: 8.5, damage: 36, aggro: 22, cooldown: 3.8, xp: 300,
    coins: [120, 260], drops: [{ item: 'shark_tooth', chance: 1, qty: [3, 6] }, { item: 'casket', chance: 0.5 }, { item: 'depth_charge', chance: 1, qty: [4, 8] }], scale: 1.8, boss: true, respawn: 300 },
};

/** Where each region's sea foes lie in wait, by place (world x, z). */
const off = (foe: string, deg: number, out: number) => { const [x, z] = coastPoint(deg, -out); return { foe, x, z }; };
export const SEA_SPAWNS: Partial<Record<RegionId, { foe: string; x: number; z: number }[]>> = {
  // Bellwether's waters (1-20): gulls round the cliffs, the wreckers' cutters off their point, sharks in the deeps,
  // and Old Gnasher on his reef to the south-east (clear of the harbour at 90 degrees)
  bellwether: [
    off('gull_flock', 125, 18), off('gull_flock', 205, 18), off('gull_flock', 250, 20),
    off('wreckers_cutter', 312, 22), off('wreckers_cutter', 296, 26),
    off('reef_shark', 15, 24), off('reef_shark', 165, 26), off('reef_shark', 228, 26),
    off('old_gnasher', 50, 26),
  ],
};

/** Charting marks: sail within `r` of one to log it, once, for Sailing XP. */
export interface ChartMark { id: string; name: string; region: RegionId; x: number; z: number; r: number; xp: number }
const mark = (id: string, name: string, deg: number, out: number, xp: number): ChartMark => { const [x, z] = coastPoint(deg, -out); return { id, name, region: 'bellwether', x, z, r: 9, xp }; };
export const CHART_MARKS: ChartMark[] = [
  mark('bw_gullrock', 'Gull Rock soundings', 200, 24, 60), mark('bw_eastdeep', 'the East Deep', 0, 28, 80),
  mark('bw_northdeep', 'the North Deep', 270, 28, 100), mark('bw_wreckers', 'the Wreckers\' channel', 305, 30, 120),
];
