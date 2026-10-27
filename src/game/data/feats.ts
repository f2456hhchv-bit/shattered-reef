// Feats (RuneScape's combat achievements, as the standard to beat): every arena boss has a handful of ways to beat it
// that ask more of you than winning. Each is worth points; points add up to lasting edges in every fight after.

export type FeatKind = 'kills' | 'nofood' | 'speed' | 'dancer';
export interface FeatDef { id: string; boss: string; kind: FeatKind; n?: number; name: string; text: string; pts: number }

const BOSSES: { id: string; name: string; speed: number }[] = [
  { id: 'guardian', name: 'the Lockbound Guardian', speed: 60 },
  { id: 'temple_serpent', name: 'the Sunscale', speed: 90 },
  { id: 'broodmother', name: 'the Broodmother', speed: 120 },
  { id: 'storm_jotunn', name: 'the Thunder Jötunn', speed: 180 },
];

export const FEATS: FeatDef[] = BOSSES.flatMap((b) => [
  { id: `${b.id}_kill`, boss: b.id, kind: 'kills' as const, n: 1, name: 'First blood', text: `Beat ${b.name}.`, pts: 1 },
  { id: `${b.id}_nofood`, boss: b.id, kind: 'nofood' as const, name: 'Empty stomach', text: `Beat ${b.name} without eating.`, pts: 2 },
  { id: `${b.id}_speed`, boss: b.id, kind: 'speed' as const, n: b.speed, name: 'Quick about it', text: `Beat ${b.name} within ${b.speed} seconds of it rising.`, pts: 3 },
  { id: `${b.id}_dancer`, boss: b.id, kind: 'dancer' as const, name: 'Light on your feet', text: `Beat ${b.name} without being caught by one of its marked attacks.`, pts: 3 },
  { id: `${b.id}_ten`, boss: b.id, kind: 'kills' as const, n: 10, name: 'Old acquaintance', text: `Beat ${b.name} ten times.`, pts: 3 },
]);
export const FEAT_BY = Object.fromEntries(FEATS.map((f) => [f.id, f]));

/** what your points earn, for good */
export const FEAT_TIERS: { pts: number; name: string; text: string; eliteDmg: number; healBonus: number }[] = [
  { pts: 10, name: 'Blooded', text: '+2% damage to bosses and elites', eliteDmg: 0.02, healBonus: 0 },
  { pts: 25, name: 'Seasoned', text: 'Food heals 5% more', eliteDmg: 0, healBonus: 0.05 },
  { pts: 45, name: 'Bane of the Locks', text: '+3% more damage to bosses and elites', eliteDmg: 0.03, healBonus: 0 },
];
