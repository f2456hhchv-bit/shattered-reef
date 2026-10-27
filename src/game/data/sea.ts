// The sea as a place to fight and work (Tom, 2026-10-25, docs/ISLANDS.md: "we haven't even touched the boat side").
// Rules ported from Tom's the-shattered-reef: read the foe, swap the ammo. Cannonballs do everything a little; each
// foe has one ammo that hits it properly; sharks under the water can only be reached with depth charges.
import type { RegionId } from '../world/regions';
import { coastPoint, sunPoint, amberPoint } from '../world/island';

export type AmmoId = 'cannonball' | 'chain_shot' | 'depth_charge' | 'fire_barrel';

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
  // Sunreach's waters (slice 2): pitch and resin in a cask, for anything built of wood
  fire_barrel: { id: 'fire_barrel', name: 'Fire barrels', item: 'fire_barrel', damage: 44, offCounter: 0.4, kind: 'broadside', sailing: 20 },
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

export type SeaBehaviour = 'cutter' | 'flock' | 'shark' | 'brig' | 'fireship';

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
  /** how it's drawn when its behaviour doesn't say: a serpent swims like a shark; ships fly their colours */
  look?: 'serpent' | 'pirate' | 'fireship' | 'ransom' | 'longship' | 'lantern';
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
  // Sunreach's waters (15-30, slice 2): brigs that trade broadsides, fire ships that ram and burn, serpents that dive
  pirate_brig: { id: 'pirate_brig', name: 'Pirate brig', level: 24, hp: 260, counter: 'fire_barrel', behaviour: 'brig', speed: 4.6, damage: 12, aggro: 22, cooldown: 4.6, xp: 90,
    coins: [30, 70], drops: [{ item: 'fire_barrel', chance: 0.5, qty: [3, 6] }, { item: 'bar_steel', chance: 0.3 }, { item: 'charm_tide', chance: 0.5, qty: [6, 14] }], scale: 0.95, respawn: 70, look: 'pirate' },
  fire_ship: { id: 'fire_ship', name: 'Fire ship', level: 22, hp: 90, counter: 'chain_shot', behaviour: 'fireship', speed: 4.4, damage: 42, aggro: 20, cooldown: 0, xp: 60,
    coins: [5, 20], drops: [{ item: 'resin', chance: 0.6, qty: [2, 4] }], scale: 0.8, respawn: 60, look: 'fireship' },
  sea_serpent: { id: 'sea_serpent', name: 'Sea serpent', level: 27, hp: 300, counter: 'depth_charge', behaviour: 'shark', speed: 7.5, damage: 30, aggro: 20, cooldown: 4.2, xp: 100,
    coins: [10, 30], drops: [{ item: 'shark_tooth', chance: 0.5, qty: [1, 2] }, { item: 'fish_salmon_raw', chance: 0.4, qty: [1, 3] }], scale: 1.1, respawn: 80, look: 'serpent' },
  red_ransom: { id: 'red_ransom', name: 'The Red Ransom', level: 32, hp: 950, counter: 'fire_barrel', behaviour: 'brig', speed: 4.2, damage: 15, aggro: 24, cooldown: 3.8, xp: 450,
    coins: [200, 400], drops: [{ item: 'casket', chance: 1, qty: [1, 2] }, { item: 'fire_barrel', chance: 1, qty: [6, 12] }, { item: 'bar_storm', chance: 0.6, qty: [1, 3] }], scale: 1.5, boss: true, respawn: 360, look: 'ransom' },
  // Amberhold's waters (25-50, slice 3): raiders out of the north, and lindworms in the cold deeps
  raider_longship: { id: 'raider_longship', name: 'Raider longship', level: 36, hp: 480, counter: 'fire_barrel', behaviour: 'brig', speed: 5.2, damage: 18, aggro: 22, cooldown: 4.4, xp: 160,
    coins: [50, 110], drops: [{ item: 'fire_barrel', chance: 0.5, qty: [4, 8] }, { item: 'bar_storm', chance: 0.3 }, { item: 'logs_amber', chance: 0.4, qty: [2, 4] }], scale: 1.05, respawn: 80, look: 'longship' },
  lindworm: { id: 'lindworm', name: 'Lindworm', level: 42, hp: 560, counter: 'depth_charge', behaviour: 'shark', speed: 8, damage: 38, aggro: 22, cooldown: 4.0, xp: 200,
    coins: [20, 50], drops: [{ item: 'shark_tooth', chance: 0.7, qty: [1, 3] }, { item: 'casket', chance: 0.1 }, { item: 'fish_shark_raw', chance: 0.3 }], scale: 1.4, respawn: 90, look: 'serpent' },
  // Sister Corva's black brig (The Lantern Burns Low): no flag, no drum, no shouting; a pale lamp at the bow that never gutters
  lantern: { id: 'lantern', name: 'The Lantern', level: 70, hp: 1400, counter: 'fire_barrel', behaviour: 'brig', speed: 4.4, damage: 20, aggro: 26, cooldown: 3.4, xp: 900,
    coins: [400, 700], drops: [{ item: 'casket', chance: 1, qty: [2, 3] }, { item: 'fire_barrel', chance: 1, qty: [8, 14] }, { item: 'charm_tide', chance: 1, qty: [30, 60] }], scale: 1.6, boss: true, respawn: 0, look: 'lantern' },
};

/** Weather at sea (docs/ISLANDS.md: from the-shattered-reef). Out of harbour, every few minutes a spell of weather
 * blows in, telegraphed and fair: it hurts your foes as much as you, so it's something to use. Bellwether's waters are
 * sheltered; the further out, the wilder. */
export type WeatherKind = 'gale' | 'fog' | 'thunder';
export const WEATHER = {
  /** seconds of open water between spells, and how long a spell lasts */
  every: [150, 240] as [number, number],
  lasts: [40, 60] as [number, number],
  /** which weather each region's waters get */
  kinds: { bellwether: [], sunreach: ['gale', 'fog'], amberhold: ['gale', 'fog', 'thunder'], wrack: ['gale', 'fog', 'thunder'] } as Partial<Record<RegionId, WeatherKind[]>>,
  /** a gale pushes ship and foes downwind at this speed (m/s) */
  gale: 2.2,
  /** in fog, foes see you at this fraction of their usual range */
  fogSight: 0.5,
  /** thunder: a strike every so often near the ship, marked first; it holes hulls and sinks foes alike */
  strikeEvery: 2.6, strikeWarn: 1.3, strikeRadius: 3, strikeHull: 18, strikeFoe: 90,
  /** riding a spell out gives a little Sailing XP */
  xp: 60,
};

/** The Kraken's first sighting (docs/ISLANDS.md: Amberhold's sea boss is an escape, not a fight). Sail into the North
 * Deep and it rises under you: its arms come down on marked water round the ship. Get clear of the deep to live. */
export const KRAKEN = (() => {
  const [x, z] = amberPoint(270, -32);
  return { region: 'amberhold' as RegionId, x, z, wake: 14, escape: 34, strikeEvery: 1.1, warn: 1.2, radius: 3.2, damage: 22, xp: 900 };
})();

/** Where each region's sea foes lie in wait, by place (world x, z). */
const off = (foe: string, deg: number, out: number) => { const [x, z] = coastPoint(deg, -out); return { foe, x, z }; };
const sun = (foe: string, deg: number, out: number) => { const [x, z] = sunPoint(deg, -out); return { foe, x, z }; };
const amb = (foe: string, deg: number, out: number) => { const [x, z] = amberPoint(deg, -out); return { foe, x, z }; };
export const SEA_SPAWNS: Partial<Record<RegionId, { foe: string; x: number; z: number }[]>> = {
  // Bellwether's waters (1-20): gulls round the cliffs, the wreckers' cutters off their point, sharks in the deeps,
  // and Old Gnasher on his reef to the south-east (clear of the harbour at 90 degrees)
  bellwether: [
    off('gull_flock', 125, 18), off('gull_flock', 205, 18), off('gull_flock', 250, 20),
    off('wreckers_cutter', 312, 22), off('wreckers_cutter', 296, 26),
    off('reef_shark', 15, 24), off('reef_shark', 165, 26), off('reef_shark', 228, 26),
    off('old_gnasher', 50, 26),
  ],
  // Sunreach's waters (15-30): brigs and fire ships round the north, serpents in the deeps, and the Red Ransom
  // anchored off the north point. Clear of Port Halyard (the south shore, 90 degrees) and of the east and west
  // lanes, where you'd sail off the chart mid-fight.
  sunreach: [
    sun('pirate_brig', 300, 24), sun('pirate_brig', 240, 24), sun('pirate_brig', 45, 22),
    sun('fire_ship', 330, 20), sun('fire_ship', 280, 26), sun('fire_ship', 150, 20),
    sun('sea_serpent', 260, 30), sun('sea_serpent', 125, 26),
    sun('red_ransom', 270, 34),
  ],
  // Amberhold's waters (25-50): longships off the north-west, east and south-west; lindworms in the deeps. The North
  // Deep itself is the Kraken's, so nothing else hunts there.
  amberhold: [
    amb('raider_longship', 300, 24), amb('raider_longship', 30, 22), amb('raider_longship', 210, 24),
    amb('lindworm', 240, 30), amb('lindworm', 330, 28),
  ],
};

/** Charting marks: sail within `r` of one to log it, once, for Sailing XP. */
export interface ChartMark { id: string; name: string; region: RegionId; x: number; z: number; r: number; xp: number }
const mark = (id: string, name: string, deg: number, out: number, xp: number): ChartMark => { const [x, z] = coastPoint(deg, -out); return { id, name, region: 'bellwether', x, z, r: 9, xp }; };
const sunMark = (id: string, name: string, deg: number, out: number, xp: number): ChartMark => { const [x, z] = sunPoint(deg, -out); return { id, name, region: 'sunreach', x, z, r: 9, xp }; };
const ambMark = (id: string, name: string, deg: number, out: number, xp: number): ChartMark => { const [x, z] = amberPoint(deg, -out); return { id, name, region: 'amberhold', x, z, r: 9, xp }; };
export const CHART_MARKS: ChartMark[] = [
  ambMark('am_raiders', 'the Raiders\' Sound', 300, 32, 240), ambMark('am_worm', 'the Lindworm Trench', 240, 36, 260), ambMark('am_toll', 'Tollhouse approaches', 150, 24, 200),
  sunMark('sr_pirates', 'the Pirates\' Roads', 300, 30, 160), sunMark('sr_serpent', 'the Serpent Deep', 160, 32, 180), sunMark('sr_ransom', 'Ransom Point soundings', 240, 36, 220),
  mark('bw_gullrock', 'Gull Rock soundings', 200, 24, 60), mark('bw_eastdeep', 'the East Deep', 0, 28, 80),
  mark('bw_northdeep', 'the North Deep', 270, 28, 100), mark('bw_wreckers', 'the Wreckers\' channel', 305, 30, 120),
];
