// The Tides (docs/STORY.md): the seven captains racing for the Lockkeys and Keel's Hoard. Their posters hang in
// every harbour, so their names, ships and bounties are known from the start; what they want, you learn by meeting them.

export type TideStatus = 'poster' | 'met' | 'friend' | 'beaten';
export interface Tide {
  id: string;
  name: string;
  epithet: string;
  ship: string;
  bounty: number;
  /** what they want, once you know */
  dream: string;
  /** where the trail starts, while you've only seen the poster */
  rumour: string;
  status: (flags: Record<string, boolean>, quests: Record<string, number>) => TideStatus;
}

const never = (): TideStatus => 'poster';

export const TIDES: Tide[] = [
  { id: 'marisol', name: 'Marisol Ransom', epithet: 'the Red Ransom', ship: 'Dear Hostage', bounty: 180000,
    dream: 'To buy back Coral Key, the island the Compact sold out from under her family the year after the Breaking.',
    rumour: 'Red sails off Sunreach\'s western shore. She takes people, not ships.',
    status: (f, q) => (f.tide_marisol_friend ? 'friend' : f.ransom_pennant ? 'beaten' : (q.ransom ?? 0) >= 1 ? 'met' : 'poster') },
  { id: 'gull', name: 'Bastian Gull', epithet: 'the Pale Wing', ship: 'Pale Wing', bounty: 140000,
    dream: '', rumour: 'A white cutter that buys charts and never haggles. Iven Marr won\'t say his name.', status: never },
  { id: 'brine', name: 'Mother Brine', epithet: 'of the Brinewife', ship: 'Brinewife', bounty: 210000,
    dream: '', rumour: 'A barnacled hulk that pays no tolls at Tollhouse, crewed by children.', status: never },
  { id: 'ninefold', name: 'Halvdan Ninefold', epithet: 'the Saga-Seeker', ship: 'Ninefold', bounty: 160000,
    dream: '', rumour: 'A longship seen off the Wrack, its captain asking for the strongest fighter in the Reef.', status: never },
  { id: 'corva', name: 'Sister Corva', epithet: 'of the Lantern', ship: 'Lantern', bounty: 250000,
    dream: 'To open the Bottom Door. She believes it is mercy.',
    rumour: 'A black brig with no flag. Her crew listen at every keyhole they pass.',
    status: (f) => (f.firstlock_opened ? 'met' : 'poster') },
  { id: 'tolliver', name: 'Ash Tolliver', epithet: 'the Second Chance', ship: 'Second Chance', bounty: 120000,
    dream: '', rumour: 'Sister-ship to a fire ship that burnt a harbour. He hasn\'t stopped apologising since.', status: never },
  { id: 'undertow', name: '???', epithet: 'the Captain of the Undertow', ship: 'Undertow', bounty: 0,
    dream: '', rumour: 'There is no poster. Nobody will print one.', status: never },
];
