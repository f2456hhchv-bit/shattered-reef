import { SUN } from './island';
import type { Bounds } from './world';

// The world is split into regions, loaded one at a time (Tom, 2026-10-24: "one island at a time... a threshold
// crossed and a loading screen"). An island region is the island and its waters; sailing off a charted edge of
// its square carries you to the next island. Caves are their own regions under the islands, entered on foot.

export type RegionId = 'bellwether' | 'sunreach' | 'smugglers_caves' | 'ember_deep';
export type Side = 'n' | 's' | 'e' | 'w';

export interface RegionDef {
  id: RegionId;
  name: string;
  kind: 'island' | 'cave';
  bounds: Bounds;
  /** the island whose town you wake in if you fall here */
  home: 'bellwether' | 'sunreach';
  /** charted sea lanes: sail off this side of the region to reach that one */
  exits: { side: Side; to: RegionId }[];
  /** one line for the loading screen */
  tip: string;
}

export const REGIONS: Record<RegionId, RegionDef> = {
  bellwether: {
    id: 'bellwether', name: 'Bellwether Isle', kind: 'island', bounds: { cx: 0, cz: 0, half: 150 }, home: 'bellwether',
    exits: [{ side: 'e', to: 'sunreach' }],
    tip: 'Sail east off the edge of the chart to cross to Sunreach, or pay Wynn at the dock for passage.',
  },
  sunreach: {
    id: 'sunreach', name: 'Sunreach Isle', kind: 'island', bounds: { cx: SUN.x, cz: SUN.z, half: 100 }, home: 'sunreach',
    exits: [{ side: 'w', to: 'bellwether' }],
    tip: 'The Greenheart\'s boars give good meat. The Ember Deep under the hill is no place for a beginner.',
  },
  smugglers_caves: {
    id: 'smugglers_caves', name: 'Smugglers\' Caves', kind: 'cave', bounds: { cx: 0, cz: 1000, half: 46 }, home: 'bellwether', exits: [],
    tip: 'The smugglers keep their hold deep in the caves. Mind the spiders by the drip pool.',
  },
  ember_deep: {
    id: 'ember_deep', name: 'The Ember Deep', kind: 'cave', bounds: { cx: SUN.x, cz: 1000, half: 50 }, home: 'sunreach', exits: [],
    tip: 'Giant spiders nest in the west hall. The magma pool\'s vents melt nothing but Cinderite.',
  },
};

/** How close to a charted edge the ship must sail to cross over. */
export const SEA_EDGE = 16;
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** The sea lane a ship at (x, z) has sailed into, if any. */
export function edgeCrossed(r: RegionDef, x: number, z: number): { side: Side; to: RegionId } | null {
  const b = r.bounds, lim = b.half - SEA_EDGE;
  for (const ex of r.exits) {
    if ((ex.side === 'e' && x > b.cx + lim) || (ex.side === 'w' && x < b.cx - lim) || (ex.side === 's' && z > b.cz + lim) || (ex.side === 'n' && z < b.cz - lim)) return ex;
  }
  return null;
}

/** Where a ship coming from `from` appears in region `to`: just inside the matching edge, heading inland.
 * `along` keeps the ship's offset along the edge it left (clamped toward the middle). */
export function arrival(to: RegionDef, from: RegionId, along: number): { x: number; z: number; heading: number } {
  const ex = REGIONS[from].exits.find((e) => e.to === to.id);
  const side = ex ? OPPOSITE[ex.side] : 'w';
  const b = to.bounds, inset = b.half - SEA_EDGE - 14, a = Math.max(-b.half * 0.45, Math.min(b.half * 0.45, along));
  switch (side) {
    case 'w': return { x: b.cx - inset, z: b.cz + a, heading: 0 };
    case 'e': return { x: b.cx + inset, z: b.cz + a, heading: Math.PI };
    case 'n': return { x: b.cx + a, z: b.cz - inset, heading: Math.PI / 2 };
    default: return { x: b.cx + a, z: b.cz + inset, heading: -Math.PI / 2 };
  }
}

/** The side of `r` with a lane to `to`, for the edge-of-chart hint. */
export function laneTo(r: RegionDef, to: RegionId): Side | null { return r.exits.find((e) => e.to === to)?.side ?? null; }

/** Which region a world point belongs to (saves store the region, but old saves only have coordinates). */
export function regionAt(x: number, z: number): RegionId {
  for (const r of Object.values(REGIONS)) if (Math.abs(x - r.bounds.cx) <= r.bounds.half && Math.abs(z - r.bounds.cz) <= r.bounds.half) return r.id;
  return 'bellwether';
}
