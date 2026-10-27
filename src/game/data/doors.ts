import { LAYOUT, SUN_LAYOUT, AMBER_LAYOUT, WRACK_LAYOUT, LOCK_LAYOUT } from '../world/island';
import type { RegionId } from '../world/regions';

// Wardwright doors (docs/STORY.md: the Wardwrights kept their work in Houses, one craft to a House). Each House
// sealed its vault with a door only its own key turns: a door grown into a yew, a hatch below the tide line, a door
// of old gold. The Skeleton Key fits every one. Behind each is what the House left, and its last record.

export interface WardDoor {
  id: string;
  house: string;
  /** what you see, and the key it wants (any door also opens to the Skeleton Key) */
  label: string; key: string;
  region: RegionId; x: number; z: number;
  /** the vault's contents, into your pack */
  reward: { id: string; qty: number }[];
  /** the House's last record, read as you open it and kept in Keel's Log (with the Varrow fragments) */
  record: { title: string; lines: string[] };
}

const L = LAYOUT, S = SUN_LAYOUT, A = AMBER_LAYOUT, W = WRACK_LAYOUT, K = LOCK_LAYOUT;

export const DOORS: WardDoor[] = [
  { id: 'green', house: 'the House of the Green Key', label: 'A door grown shut inside a yew', key: 'woodsman', region: 'bellwether', x: L.heartwood.x + 6, z: L.heartwood.z - 5,
    reward: [{ id: 'logs_yew', qty: 25 }, { id: 'bird_nest', qty: 4 }, { id: 'coins', qty: 600 }],
    record: { title: 'The House of the Green Key: a seed-ledger', lines: [
      'Seeds of every tree the Varrow grew, one jar each, labelled in green ink. The last jar is empty. Its label says "the tree that grew the first keys".',
      'In the margin: "We cut our keys from star-iron, but the first Wardwright cut hers from wood, from a tree that grew where the star\'s song landed. It sang back."',
      '"We burnt the tree. We kept one seed. We will not say where."',
    ] } },
  { id: 'vein', house: 'the House of the Deep Vein', label: 'A door in the rock, its keyhole glittering with ore', key: 'prospector', region: 'bellwether', x: L.peak.x - 8, z: L.peak.z + 4,
    reward: [{ id: 'ore_storm', qty: 12 }, { id: 'crystal_geode', qty: 3 }, { id: 'coins', qty: 800 }],
    record: { title: 'The House of the Deep Vein: a miner\'s tally', lines: [
      'Chalk marks on the wall, hundreds of them, in rows of five. Every row is a day the House spent digging toward the star-iron under Ironcrag.',
      'The last rows stop being tallies. They\'re keyholes. Drawn small, hundreds of them, then one very large, taking up the whole wall.',
      'Under it, in a different chalk: "Stopped digging. It was digging toward us."',
    ] } },
  { id: 'line', house: 'the House of the Line', label: 'A barnacled hatch at the tide line', key: 'angler', region: 'bellwether', x: L.strand.x + 3, z: L.strand.z - 3,
    reward: [{ id: 'fish_shark_raw', qty: 8 }, { id: 'casket', qty: 3 }, { id: 'coins', qty: 500 }],
    record: { title: 'The House of the Line: a fisher-wright\'s note', lines: [
      'A net of brass wire, folded small, and a note pinned to it.',
      '"Every key we cut for the fishers came back to us within the year. They said the fish had started swimming toward the boats. Not away. Toward."',
      '"We stopped cutting keys for the sea. The sea did not stop wanting them."',
    ] } },
  { id: 'hearth', house: 'the House of the Hearth', label: 'A low door with a keyhole shaped like a pot-hook', key: 'cook', region: 'sunreach', x: S.palms.x - 5, z: S.palms.z - 4,
    reward: [{ id: 'captains_feast', qty: 3 }, { id: 'fish_stew', qty: 6 }, { id: 'coins', qty: 600 }],
    record: { title: 'The House of the Hearth: a recipe card', lines: [
      'A recipe for bread, in a careful hand. Flour, salt, water, one turn of the Hearth Key in the dough.',
      '"Bread like this feeds a household for a week. We made it for the poor in the hungry winter of the Varrow\'s three-hundredth year."',
      'Below, sadder: "The children who ate it never had a keyhole close all the way again. They could hear it. They\'re grown now. They\'re the first of the ones who listen."',
    ] } },
  { id: 'anvil', house: 'the Ninth House, of the Anvil', label: 'A soot-black door, still warm', key: 'smith', region: 'sunreach', x: S.ember.x + 7, z: S.ember.z - 2,
    reward: [{ id: 'bar_cinder', qty: 6 }, { id: 'bar_sky', qty: 4 }, { id: 'coins', qty: 1200 }],
    record: { title: 'The Ninth House: the forge-master\'s confession', lines: [
      'An anvil, split clean in two. On it, a sheet of copper scratched with a nail.',
      '"I broke the oath. I cut a key that makes a man do what he would not. I cut it because the song told me how, and it was the most beautiful work I have ever done."',
      '"A captain named Keel bought it from me for a chest of gold. I took the gold. Then I came home, and I heard the singing in my own chest, and I understood who it was really for."',
      '"Forgive the Ninth House. Don\'t forgive me."',
    ] } },
  { id: 'tide', house: 'the House of the Tide', label: 'A door set in the rocks, wet even at low water', key: 'tide', region: 'amberhold', x: A.ironshore.x + 4, z: A.ironshore.z + 3,
    reward: [{ id: 'charm_tide', qty: 400 }, { id: 'gem_pearl', qty: 3 }, { id: 'coins', qty: 800 }],
    record: { title: 'The House of the Tide: a tide-table carved in stone', lines: [
      'Every low water of the Varrow\'s last hundred years, carved in rows. Some are ringed. The ringed ones are the nights a Lock rose.',
      'The last ring isn\'t a night in the past. It\'s a date that hasn\'t come yet, a thousand years and some after the stone was cut.',
      'Counting on your fingers, you think it is this year.',
    ] } },
  { id: 'lantern', house: 'the House of the Lantern', label: 'A door of old gold, half-buried in the hill', key: 'finder', region: 'amberhold', x: A.goldhill.x + 6, z: A.goldhill.z + 6,
    reward: [{ id: 'casket', qty: 5 }, { id: 'ore_gold', qty: 20 }, { id: 'coins', qty: 1500 }],
    record: { title: 'The House of the Lantern: a finder\'s list', lines: [
      'A list of everything the House ever found for the Varrow: wells, veins, lost children, a king\'s ring. Long, proud, crossed off line by line.',
      'At the bottom, not crossed off: "the thirteenth Lockkey, where the Wardwrights hid it from Keel".',
      'The answer has been scraped out with a knife, and recently. The scratches are still bright.',
    ] } },
  { id: 'bells', house: 'the House of Bells', label: 'A door with a bell-shaped keyhole', key: 'bell', region: 'wrack', x: W.oldwood.x - 6, z: W.oldwood.z + 7,
    reward: [{ id: 'bar_levi', qty: 4 }, { id: 'casket', qty: 3 }, { id: 'coins', qty: 2000 }],
    record: { title: 'The House of Bells: the bell-founder\'s rule', lines: [
      'A bell no bigger than a thimble on a nail. It rings when you open the door, though nothing touches it.',
      '"A Lock is a bell that hasn\'t been rung. Every bell we hung in the Varrow was cast to answer one Lock, so that if a Lock ever opened, its bell would ring at low water and warn us."',
      '"If you are reading this and the bells are ringing on their own: they\'re not warning you. They\'re counting."',
    ] } },
  // ---- Lockhaven: the Houses' own front doors, standing in the Field of Doors with nothing left behind them but cellars
  { id: 'door', house: 'the House of the Door', label: 'A plain oak door, unpainted, in a stone frame on its own', key: 'skeleton', region: 'lockhaven', x: K.doorfield.x - 6, z: K.doorfield.z - 3,
    reward: [{ id: 'casket', qty: 4 }, { id: 'bar_ori', qty: 3 }, { id: 'coins', qty: 3000 }],
    record: { title: 'The House of the Door: Ilse\'s rule', lines: [
      'Chalked on the inside of the door, so you read it as you step through: "A door is a promise that there is another side."',
      '"Every key we cut keeps that promise for someone. A door that opens onto nothing is the cruellest thing in the world."',
      'Under it, in a shakier hand, very recent: "The Bottom Door opens onto them. They are not nothing. Forgive me. — I."'] } },
  { id: 'fen', house: 'the House of the Fen', label: 'A door green with moss, its keyhole full of water', key: 'mire_key', region: 'lockhaven', x: K.doorfield.x + 5, z: K.doorfield.z - 5,
    reward: [{ id: 'fish_shark_raw', qty: 10 }, { id: 'gem_pearl', qty: 4 }, { id: 'coins', qty: 2500 }],
    record: { title: 'The House of the Fen: Hask\'s last letter', lines: [
      '"To whoever comes with my key. If you have it, you have taken it out of Jenny, and she was me."',
      '"I am glad. I was so hungry, and so cold, and I could not stop swallowing."',
      '"Don\'t turn it again. Put it back in a fen somewhere warm. Let the next one of me sleep."'] } },
  { id: 'ears', house: 'the House of Ears', label: 'A door with a brass ear where the knocker should be', key: 'listener', region: 'lockhaven', x: K.doorfield.x - 3, z: K.doorfield.z + 7,
    reward: [{ id: 'charm_tide', qty: 600 }, { id: 'crystal_geode', qty: 4 }, { id: 'coins', qty: 2500 }],
    record: { title: 'The House of Ears: Ysolde\'s warning', lines: [
      'The brass ear on the door is warm. Inside, on the cellar wall, one line, over and over in different years\' handwriting:',
      '"We listen so the children don\'t have to."',
      'The last one is different. Small, neat, recent, in a hand you\'ve seen on two letters: "We listen so the children can be told the truth. — C."'] } },
  { id: 'tooth', house: 'the House of the Tooth', label: 'A door studded with old teeth, like a jaw', key: 'keels_tooth', region: 'lockhaven', x: K.doorfield.x + 8, z: K.doorfield.z + 4,
    reward: [{ id: 'shark_tooth', qty: 20 }, { id: 'bar_levi', qty: 5 }, { id: 'coins', qty: 3000 }],
    record: { title: 'The House of the Tooth: Ottilie\'s bargain', lines: [
      '"Corran. You\'ll come for my key, because it\'s the first and you\'re impatient. Take it."',
      '"Wear it in your mouth if you like. It will bite you every time the tide turns, and you will deserve every bite."',
      '"When you are old and the bites have made you sorry, bring it back. I\'ll be in the Spire. I\'ll wait. — O."',
      'He never came back. You did, with his tooth on your ring.'] } },
];

export const DOOR_BY_ID = Object.fromEntries(DOORS.map((d) => [d.id, d]));
