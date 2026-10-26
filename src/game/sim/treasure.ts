import type { Game, Target } from './game';
import { remove, canAdd } from './inventory';
import { item } from '../data/items';
import { LOOT } from '../data/content';
import { REGIONS, type RegionId } from '../world/regions';
import { coastPoint, sunPoint, amberPoint, wrackPoint, SUN, AMBER, WRACK } from '../world/island';

// Treasure maps (docs/ISLANDS.md, "things to do at sea": treasure maps from digging leading to wrecks). Dig one up
// (or find one in a casket), read it on an island, and an X appears in the water off that island's coast. Sail to it
// and haul up the chest from the deck. One map is followed at a time; the rest wait in your pack.

export const TREASURE = {
  /** how far off the coast the X lies (metres out from the shoreline) */
  out: [10, 20] as [number, number],
  /** how close the ship must be to haul */
  range: 5,
  /** Sailing XP per haul: a base plus a little per Sailing level */
  xp: 120,
  xpPerLevel: 4,
};

const ISLAND: Partial<Record<RegionId, { at: (deg: number, inset: number) => [number, number]; cx: number; cz: number }>> = {
  bellwether: { at: coastPoint, cx: 0, cz: 0 },
  sunreach: { at: sunPoint, cx: SUN.x, cz: SUN.z },
  amberhold: { at: amberPoint, cx: AMBER.x, cz: AMBER.z },
  wrack: { at: wrackPoint, cx: WRACK.x, cz: WRACK.z },
};

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

export class TreasureHunt {
  constructor(private g: Game) {}

  /** The X you're following, if it's in the waters you're in. */
  here(): { x: number; z: number } | null {
    const t = this.g.s.treasure;
    return t && t.region === this.g.s.region ? t : null;
  }

  /** Read a map: roll an X in open water off this island's coast. */
  read(slot: number) {
    const g = this.g, isl = ISLAND[g.s.region];
    if (g.s.treasure) { g.msg(`You're already following a map: an X off ${REGIONS[g.s.treasure.region].name}. Haul that one up first.`, 'warn'); return; }
    if (!isl) { g.msg('The map shows a coastline. Read it out in the open, on an island with sea round it.', 'warn'); return; }
    let spot: [number, number] | null = null, deg = 0;
    for (let k = 0; k < 40 && !spot; k++) {
      deg = g.rnd() * 360;
      const [x, z] = isl.at(deg, -(TREASURE.out[0] + g.rnd() * (TREASURE.out[1] - TREASURE.out[0])));
      if (g.world.seaClear(x, z)) spot = [x, z];
    }
    if (!spot) { g.msg('The map\'s too smudged to make out. Try reading it again.', 'warn'); return; }
    const st = g.p.inv[slot];
    if (st?.id === 'treasure_map') remove(g.p.inv, 'treasure_map', 1);
    g.s.treasure = { region: g.s.region, x: spot[0], z: spot[1] };
    // the compass point of the X from the island's middle (+x east, +z south)
    const a = Math.atan2(spot[1] - isl.cz, spot[0] - isl.cx), dir = COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
    g.msg(`The map shows ${REGIONS[g.s.region].name}'s coast, and an X in the water off its ${dir} shore. It's on your chart: sail out and haul it up.`, 'quest');
    g.rev++;
  }

  targets(): Target[] {
    const t = this.here();
    if (!t || !this.g.p.onShip) return [];
    return [{ key: 'event:tm:haul', kind: 'event', x: t.x, z: t.z, range: TREASURE.range, label: 'The X on your map', verb: 'Haul up' }];
  }

  use(key: string) {
    const g = this.g, t = this.here();
    if (key !== 'event:tm:haul' || !t) return;
    if (!g.p.onShip) { g.msg('It\'s out in the water. You\'ll need your ship.', 'warn'); return; }
    g.s.treasure = null;
    g.s.flags.treasure_hauled = true;
    // the chest comes aboard: straight into the pack, like a sunk ship's haul
    const table = LOOT.sea_chest, got: string[] = [];
    const take = (id: string, qty: number) => {
      if (!canAdd(g.p.inv, id)) { g.msg(`No room for the ${item(id).name.toLowerCase()}: it goes over the side.`, 'warn'); return; }
      g.give(id, qty); got.push(`${qty > 1 ? `${qty} × ` : ''}${item(id).name}`);
    };
    if (table.coins) take('coins', table.coins[0] + Math.floor(g.rnd() * (table.coins[1] - table.coins[0] + 1)));
    for (const d of table.drops) if (g.rnd() < d.chance) take(d.item, d.qty ? d.qty[0] + Math.floor(g.rnd() * (d.qty[1] - d.qty[0] + 1)) : 1);
    g.addXp('sailing', TREASURE.xp + TREASURE.xpPerLevel * g.level('sailing'));
    g.msg(`The grapple bites. Up comes a chest, black with weed and heavy as sin: ${got.join(', ') || 'empty, bar the weed'}.`, 'loot');
    g.rev++;
  }
}
