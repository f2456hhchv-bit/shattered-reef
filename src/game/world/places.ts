import { ISLAND_PLACES, type Place } from './island';
import { CAVES, chamberAt } from './caves';
import type { RegionId } from './regions';

/** Every named place in every region (discovery, the Places list, map labels). */
export const PLACES: Place[] = [
  ...ISLAND_PLACES,
  ...Object.entries(CAVES).flatMap(([id, c]) => c!.chambers.filter((ch) => ch.name).map((ch) => {
    const at = chamberAt(id as RegionId, ch.id);
    return { id: `${id}_${ch.id}`, name: ch.name!, x: at.x, z: at.z, r: ch.r + 2, region: id as RegionId };
  })),
];

export const placeRegion = (p: Place): RegionId => p.region ?? 'bellwether';
