// The Tides (docs/STORY.md): the seven captains racing for the Lockkeys and Keel's Hoard. Their posters hang in
// every harbour, so their names, ships and bounties are known from the start; what they want, you learn by meeting them.

export type TideStatus = 'poster' | 'met' | 'friend' | 'beaten' | 'crew' | 'enemy';
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


export const TIDES: Tide[] = [
  { id: 'marisol', name: 'Marisol Ransom', epithet: 'the Red Ransom', ship: 'Dear Hostage', bounty: 180000,
    dream: 'To buy back Coral Key, the island the Compact sold out from under her family the year after the Breaking.',
    rumour: 'Red sails off Sunreach\'s western shore. She takes people, not ships.',
    status: (f, q) => (f.tide_marisol_friend ? 'friend' : f.ransom_pennant ? 'beaten' : (q.ransom ?? 0) >= 1 ? 'met' : 'poster') },
  { id: 'gull', name: 'Bastian Gull', epithet: 'the Pale Wing', ship: 'Pale Wing', bounty: 140000,
    dream: 'To chart the whole Reef, every island and every Lock, before the cough he hides kills him. He sails with you now.',
    rumour: 'A white cutter that buys charts and never haggles. Iven Marr won\'t say his name.',
    status: (f, q) => (f.tide_gull_crew ? 'crew' : (q.palewing ?? 0) >= 2 ? 'met' : 'poster') },
  { id: 'brine', name: 'Mother Brine', epithet: 'of the Brinewife', ship: 'Brinewife', bounty: 210000,
    dream: 'To keep every child who hears the song out of the Hushed\'s hands. She has eighty-one so far.',
    rumour: 'A barnacled hulk that pays no tolls at Tollhouse, crewed by children.',
    status: (f, q) => (f.tide_brine_friend ? 'friend' : f.tide_brine_enemy ? 'enemy' : (q.brinewife ?? 0) >= 2 ? 'met' : 'poster') },
  { id: 'ninefold', name: 'Halvdan Ninefold', epithet: 'the Saga-Seeker', ship: 'Ninefold', bounty: 160000,
    dream: 'To fight one fight that could have gone the other way, and be sung about for it.',
    rumour: 'A longship seen off the Wrack, its captain asking for the strongest fighter in the Reef.',
    status: (f, q) => (f.tide_ninefold_crew ? 'crew' : f.tide_ninefold_dead ? 'beaten' : (q.saga ?? 0) >= 1 ? 'met' : 'poster') },
  { id: 'corva', name: 'Sister Corva', epithet: 'of the Lantern', ship: 'Lantern', bounty: 250000,
    dream: 'To open the Bottom Door. She believes it is mercy.',
    rumour: 'A black brig with no flag. Her crew listen at every keyhole they pass.',
    status: (f) => (f.tide_corva_turned ? 'friend' : f.lanternrelit_3_k0 ? 'beaten' : f.lantern_done ? 'enemy' : f.firstlock_opened ? 'met' : 'poster') },
  { id: 'tolliver', name: 'Ash Tolliver', epithet: 'the Second Chance', ship: 'Second Chance', bounty: 120000,
    dream: 'To be forgiven by someone, anyone. He settled for being let stand at the stones at low water. He sails with you now.',
    rumour: 'Sister-ship to a fire ship that burnt a harbour. He hasn\'t stopped apologising since.',
    status: (f, q) => (f.tide_ash_crew ? 'crew' : (q.secondchance ?? 0) >= 1 ? 'met' : 'poster') },
  { id: 'undertow', name: '???', epithet: 'the Captain of the Undertow', ship: 'Undertow', bounty: 0,
    dream: '', rumour: 'There is no poster. Nobody will print one.', status: (f) => (f.hale_letter ? 'enemy' : f.thirteenth_held ? 'met' : 'poster') },
];
