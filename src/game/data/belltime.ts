import { LAYOUT, SUN_LAYOUT, AMBER_LAYOUT, WRACK_LAYOUT, LOCK_LAYOUT, SALT_LAYOUT } from '../world/island';
import type { RegionId } from '../world/regions';

// Bell-time (docs/STORY.md glossary: low water, when the Locks are nearest the surface and the bells ring with no
// bells). Every so often on an island the tide runs out further than it should, and somewhere on it a bell starts
// ringing where there is no bell. Find it (it's on your map) and ring it back before the water returns: the sea pays a
// tithe for being answered, and something song-touched always comes up the beach to listen. Ring enough of them and
// you begin to hear what the bells are counting.

export const BELLTIME = {
  /** seconds on an island before the first low water, and between them after */
  first: [240, 420] as [number, number],
  every: [600, 1020] as [number, number],
  /** how long the bell rings before the water comes back */
  lasts: 180,
  /** the tithe, by island: coins and tide charms */
  tithe: { bellwether: [80, 160], sunreach: [200, 380], amberhold: [450, 800], wrack: [900, 1500], lockhaven: [1200, 1900], saltglass: [1500, 2400] } as Partial<Record<RegionId, [number, number]>>,
};

const L = LAYOUT, S = SUN_LAYOUT, A = AMBER_LAYOUT, W = WRACK_LAYOUT, K = LOCK_LAYOUT, G = SALT_LAYOUT;
/** where a bell can ring on each island (open ground near a shore, a barrow, a grove) */
export const BELL_SPOTS: Partial<Record<RegionId, { x: number; z: number; where: string }[]>> = {
  bellwether: [{ x: L.strand.x + 3, z: L.strand.z + 2, where: 'on Crab Strand' }, { x: L.howes.x + 4, z: L.howes.z - 3, where: 'among the Howes' }, { x: L.wreck.x - 5, z: L.wreck.z + 5, where: 'below Wreckers\' Point' }],
  sunreach: [{ x: S.palms.x + 7, z: S.palms.z + 5, where: 'in Palm Cove' }, { x: S.temple.x + 9, z: S.temple.z - 3, where: 'by the Sunken Temple' }, { x: S.ember.x - 9, z: S.ember.z + 3, where: 'under Ember Hill' }],
  amberhold: [{ x: A.ironshore.x + 6, z: A.ironshore.z - 3, where: 'on the Ironshell Shore' }, { x: A.amberwood.x - 6, z: A.amberwood.z - 6, where: 'in the Amberwood' }, { x: A.goldhill.x - 9, z: A.goldhill.z, where: 'on Goldvein Hill' }],
  wrack: [{ x: W.starfall.x + 6, z: W.starfall.z + 6, where: 'at the Starfall' }, { x: W.oldwood.x - 8, z: W.oldwood.z - 6, where: 'in the Old Wood' }, { x: W.crag.x + 8, z: W.crag.z + 4, where: 'below Thunder Crag' }],
  lockhaven: [{ x: K.keywood.x + 8, z: K.keywood.z - 8, where: 'at the edge of the Keywood' }, { x: K.forges.x - 8, z: K.forges.z + 8, where: 'below the Thirteen Forges' }, { x: K.shore.x - 8, z: K.shore.z - 4, where: 'above the Keyhole Shore' }],
  saltglass: [{ x: G.dunes.x - 10, z: G.dunes.z + 10, where: 'below the Glass Dunes' }, { x: G.grove.x + 9, z: G.grove.z + 8, where: 'at the edge of the Shattered Grove' }, { x: G.lens.x - 8, z: G.lens.z + 8, where: 'under the Lens Point' }],
};
/** what comes up the beach to listen (always song-touched) */
export const BELL_LISTENERS: Partial<Record<RegionId, string>> = { bellwether: 'haugbui', sunreach: 'douen', amberhold: 'barrow_draugr', wrack: 'drowned', lockhaven: 'undertow_deckhand', saltglass: 'reflection' };

/** what you start to hear, the more bells you answer */
export const CHOIR: { at: number; title: string; lines: string[] }[] = [
  { at: 1, title: 'The first bell', lines: [
    'You ring it back, and it stops. For a moment the whole island is listening to the space where the sound was.',
    'Then, very far down, under the sand, under the rock, something rings back. Once. Like a door knocked on by someone polite.'] },
  { at: 5, title: 'The fifth bell', lines: [
    'This time you hear the second ring clearly, and a third under it, and a fourth. They aren\'t echoes. They\'re answers, from further and further down.',
    'You count them without meaning to. Thirteen. The thirteenth is very faint, and it sounds like it\'s coming from your own pocket.'] },
  { at: 12, title: 'The twelfth bell', lines: [
    'The bell rings in a voice. Not words. A child humming a tune it half knows, the way you hum when you\'re alone.',
    'You know the tune. Everyone in the Reef knows it. It\'s the skipping rhyme: lock and lock and lock and twelve.',
    'The humming stops at "twelve" and waits, the way a child waits for you to say the next line.'] },
  { at: 25, title: 'The twenty-fifth bell', lines: [
    'The bell doesn\'t ring. It speaks, in a voice made of a great many voices, all very tired and very kind.',
    '"You keep answering. No one has answered in a thousand years. Will you open the door? We\'re so cold."',
    'You don\'t say anything. After a while the tide comes back, and the sand is only sand.'] },
];
