import { coastPoint, wrackPoint, sunPoint, amberPoint, lockPoint, saltPoint } from '../world/island';
import type { RegionId } from '../world/regions';

// The Gull Race (the Reef's sailors race for bragging rights, the way every harbour on every sea always has): a
// buoyed course round an island, against the clock. Pass each buoy in order; your best time is kept; medals for
// beating the harbour's own marks. Gold flies a gull pennant on your mast for good.

export interface RaceCourse {
  id: string; name: string; region: RegionId; sailing: number;
  /** the start/finish buoy, then the course buoys in order (the finish is the start buoy again) */
  start: [number, number]; buoys: [number, number][];
  /** seconds for gold, silver, bronze (a bot sailing the course perfectly, tap-to-sail, with a refit-free sloop: 91 s round Bellwether, 62 Sunreach, 69 Amberhold, 70 the Wrack, 69 Lockhaven; gold is 8% over that) */
  medals: [number, number, number];
  xp: number;
}

const bw = (deg: number, out: number) => coastPoint(deg, -out);
const wr = (deg: number, out: number) => wrackPoint(deg, -out);
const su = (deg: number, out: number) => sunPoint(deg, -out);
const am = (deg: number, out: number) => amberPoint(deg, -out);
const lk = (deg: number, out: number) => lockPoint(deg, -out);
const sg = (deg: number, out: number) => saltPoint(deg, -out);

export const RACES: RaceCourse[] = [
  { id: 'bellwether', name: 'the Bellwether Round', region: 'bellwether', sailing: 10,
    start: bw(100, 20), buoys: [bw(140, 22), bw(180, 24), bw(250, 26), bw(290, 24), bw(330, 24), bw(10, 22), bw(50, 22)],
    medals: [98, 120, 155], xp: 900 },
  { id: 'sunreach', name: 'the Halyard Reach', region: 'sunreach', sailing: 25,
    start: su(110, 18), buoys: [su(160, 20), su(210, 22), su(260, 22), su(310, 22), su(0, 20), su(50, 20)],
    medals: [67, 82, 106], xp: 1800 },
  { id: 'amberhold', name: 'the Toll Run', region: 'amberhold', sailing: 40,
    start: am(110, 18), buoys: [am(160, 20), am(210, 22), am(262, 26), am(315, 22), am(10, 22), am(55, 20)],
    medals: [74, 90, 117], xp: 2800 },
  { id: 'wrack', name: 'the Wrack Run', region: 'wrack', sailing: 55,
    start: wr(100, 18), buoys: [wr(150, 20), wr(200, 22), wr(250, 22), wr(300, 26), wr(345, 22), wr(30, 20), wr(65, 20)],
    medals: [76, 92, 120], xp: 4000 },
  { id: 'lockhaven', name: 'the Keepers\' Circuit', region: 'lockhaven', sailing: 70,
    start: lk(110, 18), buoys: [lk(160, 20), lk(210, 22), lk(270, 26), lk(320, 22), lk(4, 24), lk(50, 20)],
    medals: [74, 90, 117], xp: 6000 },
  { id: 'saltglass', name: 'the Glass Circuit', region: 'saltglass', sailing: 80,
    start: sg(120, 22), buoys: [sg(160, 20), sg(210, 22), sg(255, 22), sg(300, 24), sg(350, 22), sg(45, 20)],
    medals: [70, 85, 110], xp: 7500 },
];
export const RACE_BY_REGION = Object.fromEntries(RACES.map((r) => [r.region, r])) as Partial<Record<RegionId, RaceCourse>>;
/** how close the ship must pass a buoy */
export const BUOY_REACH = 7;
export const MEDAL_NAMES = ['gold', 'silver', 'bronze'] as const;
