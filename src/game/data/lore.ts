import { LAYOUT, SUN_LAYOUT, AMBER_LAYOUT, WRACK_LAYOUT } from '../world/island';
import type { RegionId } from '../world/regions';

// Keel's Log and the Varrow's fragments (docs/STORY.md). Pages of Corran Keel's log, torn out and scattered by the
// Shattering, and the few written things that survived the Varrow. Found where they lie, read in the journal, never
// explained by anyone. Pages are numbered as Keel numbered them; the missing ones wait on islands not yet charted.

export interface LoreEntry {
  id: string;
  /** 'keel' pages are Keel's Log; 'varrow' are everything else that survived */
  set: 'keel' | 'varrow';
  title: string;
  /** what you see in the world, and what you do with it */
  label: string; verb: string;
  region: RegionId; x: number; z: number;
  /** read one line at a time, like dialogue */
  lines: string[];
}

const L = LAYOUT, S = SUN_LAYOUT, A = AMBER_LAYOUT, W = WRACK_LAYOUT;

export const LORE: LoreEntry[] = [
  // ---- Bellwether
  { id: 'keel_1', set: 'keel', title: 'Keel\'s Log, page I', label: 'Oilcloth wedged in the rocks', verb: 'Read', region: 'bellwether', x: L.cove.x - 4, z: L.cove.z - 5,
    lines: [
      'First night of the voyage that makes me a legend or a ghost. The Wardwrights call me a thief. I call me early.',
      'Twelve hands aboard the Undertow, and Vesper Hale for quartermaster. Hale can count a purse in the dark by the sound it makes falling.',
      'The first Lockkey came easy. It\'s a tooth, of all things. I had the smith set it in my jaw where my own was knocked out at Callow. Let a man try and steal from my mouth.',
      'It aches when the tide turns. The smith said it would. He said it bites back.',
    ] },
  { id: 'keel_2', set: 'keel', title: 'Keel\'s Log, page II', label: 'A page under a fallen stone', verb: 'Read', region: 'bellwether', x: L.ruin.x - 9, z: L.ruin.z + 8,
    lines: [
      'The Wardwrights hang no bells on their Locks. They leave the hollow where a bell would go, and only a bell cast from this island\'s own copper will sound in it.',
      'Clever. Clever, clever folk. I had Hale steal the chapel bell at Bellwether and melt it down. The priest cursed us from the quay. Hale blew him a kiss.',
      'When it rang, the stones answered. There was a thing inside the ring made of rock and old oaths. It took Dunny\'s arm before we put it down.',
      'If anyone rings this hollow again after me: the Guardian doesn\'t stay down.',
    ] },
  { id: 'keel_5', set: 'keel', title: 'Keel\'s Log, page V', label: 'A page folded into a grave-gift', verb: 'Read', region: 'bellwether', x: L.howes.x - 7, z: L.howes.z + 5,
    lines: [
      'We buried Tam Orrin on the hill above the Howes. The barrow folk came out at dusk and stood round his grave like they were waiting for him to join them.',
      'He was the first of us to hear it. Three nights he swore there was singing coming out of the keyhole in his chest. Then he stopped swearing it, and started singing along.',
      'Hale says it\'s the drink. Hale has never in her life believed something was the drink.',
    ] },
  { id: 'keel_6', set: 'keel', title: 'Keel\'s Log, page VI', label: 'A page pinned under a cairn', verb: 'Read', region: 'bellwether', x: L.peak.x + 6, z: L.peak.z + 10,
    lines: [
      'From the top of Ironcrag you can see the whole Varrow at night, and every Lock lit like a lighthouse round the edge of it. Thirteen lights.',
      'Two of them are dark now. Ours.',
      'I stood up here an hour with the cold in my teeth and I thought: no one has ever held two of these. No king, no Wardwright. Me.',
      'Then I thought: what are the lights for, if not to keep something from finding its way?',
    ] },
  { id: 'varrow_charter', set: 'varrow', title: 'The Compact\'s Charter (a copy)', label: 'A charter nailed in a strongbox lid', verb: 'Read', region: 'bellwether', x: L.dockBase.x + 6, z: L.dockBase.z - 9,
    lines: [
      'Set down at Bellwether, the first year after the Breaking, by the harbourmasters of what was left.',
      'One. Every harbour stays open to every keel, honest or not. A shut harbour is how the islands die.',
      'Two. We carry every letter and read none of them.',
      'Three. We take no side in what is coming. Whatever it is. However it asks.',
      'Below, in another hand: "Whatever it is. However it asks. We meant it, didn\'t we?"',
    ] },

  // ---- Sunreach
  { id: 'keel_3', set: 'keel', title: 'Keel\'s Log, page III', label: 'A page in a drowned offering bowl', verb: 'Read', region: 'sunreach', x: S.temple.x + 8, z: S.temple.z + 12,
    lines: [
      'The sun-priests wouldn\'t sell. So we didn\'t buy.',
      'Their high priestess gave Hale a golden key off the altar, smiling like a mother. We were halfway down the temple steps before I knew it for a fake. The real Lockkey was never on the altar. It was in the serpent.',
      'We left the serpent alone. I\'m brave, not stupid. Half the Lockkeys aren\'t kept by people at all. They\'re kept by the things people were afraid of.',
      'I almost admired the priestess. I sent her a barrel of rum. Hale says she poured it in the sea.',
    ] },
  { id: 'keel_8', set: 'keel', title: 'Keel\'s Log, page VIII', label: 'A page stuffed in a coconut shell', verb: 'Read', region: 'sunreach', x: S.palms.x + 3, z: S.palms.z - 6,
    lines: [
      'A boy came out of the trees at Palm Cove wearing a straw hat as big as a cartwheel. Little Jem went after him to give him a coin.',
      'His tracks went into the jungle. Jem\'s tracks went into the jungle. Only one set came back, and the toes pointed the wrong way.',
      'I\'ve never turned a ship round for one sailor. I turned the Undertow round for Jem. We didn\'t find him.',
      'The song was loud that night. Cook says it sounded like a boy humming.',
    ] },
  { id: 'varrow_oath', set: 'varrow', title: 'A Wardwright\'s oath (a forge-plate)', label: 'A brass plate in the cinders', verb: 'Read', region: 'sunreach', x: S.ember.x - 6, z: S.ember.z + 8,
    lines: [
      'Stamped into brass, the letters filled with soot:',
      '"I will cut no key to open what was shut for good reason. I will cut no key to make a man do what he would not. I will cut no key for gold."',
      '"I will cut keys to mend, to build and to guard. I will put my ear to no keyhole. If I hear singing, I will put down my tools and walk into the sea."',
      'Scratched underneath, small and fast: "Ninth House. I hear it. I hear it. I\'m sorry."',
    ] },

  // ---- Amberhold
  { id: 'keel_9', set: 'keel', title: 'Keel\'s Log, page IX', label: 'A page wrapped round a gold nugget', verb: 'Read', region: 'amberhold', x: A.goldhill.x - 6, z: A.goldhill.z + 9,
    lines: [
      'Hale asked me tonight what I\'ll do with Keel\'s Hoard. I told her: buy the sea, and charge the fish rent.',
      'She didn\'t laugh. She asked what I thought was behind the Bottom Door. I said every key ever cut, and the one that opens the sky. Same as I always say.',
      'She said: "Put your ear to your own chest, Corran. Then tell me it\'s treasure."',
      'I haven\'t. I won\'t. But I\'ve started sleeping with my hand over the keyhole.',
    ] },
  { id: 'varrow_rhyme', set: 'varrow', title: 'A skipping rhyme (carved in a tree)', label: 'Words carved into an amber tree', verb: 'Read', region: 'amberhold', x: A.amberwood.x + 7, z: A.amberwood.z + 6,
    lines: [
      'Cut deep and old into the bark, the way children carve things they\'ll be told off for:',
      '"Lock and lock and lock and twelve, a bell, a tooth, a sun, a well. Turn them all and turn them back, and never listen at the crack."',
      '"Thirteen\'s in the belly, thirteen\'s in the deep, thirteen\'s where the Wardwrights put the song to sleep."',
      'The rhyme stops. Someone has carved the start of another line and stopped halfway: "And if the song should wake—"',
    ] },
  { id: 'varrow_toll', set: 'varrow', title: 'A toll-ledger page', label: 'A ledger page in a lobster pot', verb: 'Read', region: 'amberhold', x: A.ironshore.x - 3, z: A.ironshore.z - 6,
    lines: [
      'Tollhouse, the forty-first year after the Breaking. Received:',
      'From the Pale Wing, Capt. B. Gull, eleven silver, for charts. From the Brinewife, Mother Brine, nothing; she brought the toll-reeve\'s lost nephew home, and we let her through.',
      'From a woman with no ship and no name, one key, iron, very old, offered as toll. Refused. She smiled and left it on the counter anyway.',
      'Margin, another hand: "The key was gone by morning. So was the counter."',
    ] },

  // ---- Stormwrack
  { id: 'keel_11', set: 'keel', title: 'Keel\'s Log, page XI', label: 'A page nailed to a yew', verb: 'Read', region: 'wrack', x: W.oldwood.x + 8, z: W.oldwood.z - 6,
    lines: [
      'Six of the twelve wanted to turn back. I gave them the jolly boat and their share, and I shook every hand.',
      'I\'ve regretted it every day since. Not because they left. Because of what we heard them shouting when the fog took them. They weren\'t shouting for help.',
      'They were shouting the words of the song. Every one of them, in tune.',
    ] },
  { id: 'keel_12', set: 'keel', title: 'Keel\'s Log, page XII', label: 'A page weighted with a storm-stone', verb: 'Read', region: 'wrack', x: W.crag.x - 7, z: W.crag.z + 9,
    lines: [
      'The twelfth Lock. I can feel the Bottom Door through the deck like a heartbeat, slow and too big.',
      'Hale is standing at the rail with her ear to the water. She hasn\'t moved in an hour. When I said her name she said, without turning: "They\'re so tired of the dark, Corran."',
      'If anyone finds this: I was wrong about one thing. It isn\'t treasure.',
      'I\'m going to turn the key anyway. A man doesn\'t sail this far to be told no by a door.',
    ] },
  { id: 'varrow_star', set: 'varrow', title: 'A Wardwright warning (a slate)', label: 'A slate tablet in the scorched earth', verb: 'Read', region: 'wrack', x: W.starfall.x - 9, z: W.starfall.z + 3,
    lines: [
      'Scratched on slate, the old Varrow letters worn almost smooth:',
      '"The star fell once and split. One half sank, and sings. If ever a star falls twice, know it was thrown."',
      '"The song has hands now. It is reaching for us."',
    ] },
  { id: 'varrow_leviathan', set: 'varrow', title: 'The Wardwrights\' last note', label: 'A brass tube between the great ribs', verb: 'Read', region: 'wrack', x: W.islet.x + 4, z: W.islet.z + 3,
    lines: [
      'A brass tube, sealed with wax and a Wardwright\'s mark. Inside, one sheet:',
      '"We have fed the thirteenth Lockkey to the leviathan, and sent it down to sleep at the bottom of the Reef."',
      '"Let any thief who wants it cut it from the belly of the sea."',
      'Below, in a fresher hand: "Tried. Couldn\'t. — C.K."',
    ] },
];

export const LORE_BY_ID = Object.fromEntries(LORE.map((l) => [l.id, l]));
/** How Keel numbered his log (pages not yet found in the world are still on islands to come). */
export const KEEL_PAGES = 13;
