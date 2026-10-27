import type { SkillId } from './items';
import { LAYOUT, SUN_LAYOUT, AMBER_LAYOUT, AMBER, WRACK_LAYOUT, coastPoint } from '../world/island';
// NPCs and the first quest, as data. Dialogue is chosen by quest stage; effects are interpreted by the quest system.

export interface Effect {
  give?: { id: string; qty: number }[];
  take?: { id: string; qty: number }[];
  xp?: { skill: SkillId; amount: number }[];
  stage?: number;
  flag?: string;
  /** a quest key, slotted on your keyring */
  key?: string;
  /** something seen, not said: shown like a page you're reading (a Lock's memory, a letter) */
  vision?: { title: string; sub: string; lines: string[] };
  /** someone signs on to your crew */
  crew?: string;
}

export interface DialogueNode {
  lines: string[];
  requires?: { id: string; qty: number }; // only offered when the player carries this
  /** only offered once these flags are set (other quests done); `missing` is said until then */
  needsFlags?: string[];
  missing?: string[]; // said instead when requirement not met
  effect?: Effect;
}

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  idle: string[];
  shop?: boolean; // keeps a shop (see SHOPS: the shop's keeper)
  bank?: boolean; // talking opens your bank
  heals?: string; // restores you to full health, with this line
  /** leaves this spot once the flag is set (a Tide who joined your crew isn't standing on the shore any more) */
  goneWhen?: string;
  ferry?: { to: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack'; price: number }[]; // offers passage to other harbours
}

export const NPCS: Record<string, NpcDef> = {
  iven: { id: 'iven', name: 'Iven Marr', title: 'Cartographer', idle: ['The sea has a second map, captain. I mean to finish it.'] },
  marta: { id: 'marta', name: 'Marta Gell', title: 'Harbour trader', idle: ['Buying, selling, and asking no questions.'], shop: true },
  bram: { id: 'bram', name: 'Bram Tollis', title: 'Smith',
    idle: ['Furnace takes copper and tin, one of each, makes a bronze bar.', 'Bring bars to the anvil. Better smiths turn out better blades. Some come out Fine, now and then Rare.'] },
  silas: { id: 'silas', name: 'Silas Reed', title: 'Tackle seller', shop: true,
    idle: ['Rods, pots, harpoons. And I pay better for fish than Marta does, don\'t tell her.'] },
  hob: { id: 'hob', name: 'Hob Fenner', title: 'Landlord of the Drowned Bell', shop: true,
    idle: ['Ale\'s cold, stew\'s hot. Bring me berries and crab and I\'ll pay you for them.'] },
  ada: { id: 'ada', name: 'Ada Quill', title: 'Banker', bank: true,
    idle: ['What you leave here stays here. Every strongbox on the island answers to these books.'] },
  maren: { id: 'maren', name: 'Sister Maren', title: 'Keeper of the chapel',
    idle: ['The tide gives and the tide takes. Come back hurt and I\'ll see you mended.', 'They say the Bell rang the night the star came down on Ironcrag.'],
    heals: 'Hold still. There: the tide\'s mended worse than you. Go carefully.' },
  corwin: { id: 'corwin', name: 'Corwin Ashe', title: 'Reeve of Bellwether',
    idle: ['Bellwether was a fishing camp when I was a boy. Now look at it: a bank, a chapel, an inn with a roof that doesn\'t leak.', 'The brigands on the east road cost us a cart a week. Thin them out and the town will remember it.'] },
  wynn: { id: 'wynn', name: 'Wynn Harrow', title: 'Harbourmaster', ferry: [{ to: 'sunreach', price: 30 }, { to: 'amberhold', price: 70 }, { to: 'wrack', price: 120 }],
    idle: ['Sunreach lies east across the channel: jungle, a hill full of ore, and Port Halyard on its south shore. Sail yourself, or I\'ll take you for thirty coins.'] },
  sefa: { id: 'sefa', name: 'Sefa Odun', title: 'Harbourmaster of Port Halyard', ferry: [{ to: 'bellwether', price: 30 }, { to: 'amberhold', price: 40 }, { to: 'wrack', price: 90 }],
    idle: ['Bellwether\'s a day\'s sail west, or an hour on my cutter. Thirty coins.'] },
  tamsin: { id: 'tamsin', name: 'Tamsin Vey', title: 'Trader', shop: true,
    idle: ['Steel, spice, and arrows that fly straight. Everything a Bellwether captain forgets to pack.'] },
  rell: { id: 'rell', name: 'Bosun Rell', title: 'Keeper of the Gilded Anchor', shop: true,
    idle: ['Sit. Eat. The jungle will still be there, and so will the things in it.'] },
  ines: { id: 'ines', name: 'Ines Carro', title: 'Banker', bank: true,
    idle: ['Ada keeps the books in Bellwether, I keep them here. Same ledger: what you leave with one, you take from the other.'] },
  mercy: { id: 'mercy', name: 'Mercy Gale', title: 'Harbourmaster of Gallows Landing', ferry: [{ to: 'amberhold', price: 50 }, { to: 'sunreach', price: 90 }, { to: 'bellwether', price: 120 }],
    idle: ['Gallows Landing. Named for what the Wrack does to ships, not for anything we do. Mostly.'] },
  jory: { id: 'jory', name: 'Jory Penhallow', title: 'Harbourmaster of Tollhouse Landing', ferry: [{ to: 'sunreach', price: 40 }, { to: 'wrack', price: 50 }, { to: 'bellwether', price: 70 }],
    idle: ['Tollhouse Landing. Everything that leaves Amberhold pays a toll, gold and amber mostly. You can pay yours in coin.', 'The poachers up on the headland don\'t pay tolls. Nobody\'s been brave enough to ask.'] },
  // Bellwether's quests (docs/ISLANDS.md, slice 1)
  pellow: { id: 'pellow', name: 'Old Pellow', title: 'Retired miner', idle: ['Forty years under Ironcrag. You learn to listen to the rock. And to what knocks in it.'] },
  muirne: { id: 'muirne', name: 'Muirne', title: 'A woman on the rocks', idle: ['The sea is so close. I can hear it calling my name, and I can\'t answer.'] },
  dougal: { id: 'dougal', name: 'Dougal Penrose', title: 'Fisherman', idle: ['Fish are fish and the sea\'s the sea. Mind your own nets.'] },
  halyard_watch: { id: 'halyard_watch', name: 'Watchman Okoro', title: 'Port watch',
    idle: ['North through the plaza is the Greenheart. Hunters in there shoot first. East, Ember Hill: coal and iron, if you can swing a pick.', 'The old temple in the jungle? Nobody goes in. Something still keeps it.'] },
  // Sunreach's quests (docs/ISLANDS.md, slice 2)
  abena: { id: 'abena', name: 'Abena Owusu', title: 'Fruit seller', idle: ['Mangoes, limes, soursop. Mind the jungle edge after dark, captain.'] },
  nana_ayo: { id: 'nana_ayo', name: 'Nana Ayo', title: 'Herb woman', idle: ['Bush tea for the fever, salt for what comes at night. I keep both.'] },
  gull: { id: 'gull', name: 'Bastian Gull', title: 'Captain of the Pale Wing', goneWhen: 'tide_gull_crew', idle: ['The Reef\'s never been charted whole. Not once, not since the Breaking. I mean to be the one.', 'Iven still draws his fives like fishhooks. I\'d know them anywhere.'] },
  marisol: { id: 'marisol', name: 'Marisol Ransom', title: 'Captain of the Dear Hostage', idle: ['I don\'t drink with people I haven\'t robbed yet. Sit down anyway.', 'Every captain on this sea wants Keel\'s Hoard. I just want back what was mine.'] },
  ama: { id: 'ama', name: 'Ama Boateng', title: 'Fire-warden of the Greenheart', idle: ['Dry season, lightning season. The Greenheart burns a little every year. My job is to make it a little.'] },
  // Amberhold's quests (docs/ISLANDS.md, slice 3)
  sigrun: { id: 'sigrun', name: 'Sigrun', title: 'Skald', idle: ['Every hill on Amberhold has a song. Goldvein Hill\'s is the oldest, and nobody sings it after dark.'] },
  ingrid: { id: 'ingrid', name: 'Ingrid Vale', title: 'Fiddler', idle: ['A fiddle tune can calm a horse, a crowd, or a storm. I\'ve managed two of the three.'] },
  brita: { id: 'brita', name: 'Brita Holm', title: 'Trader of the Tollhouse Market', shop: true, idle: ['Stormsilver, honey, and barrels that burn. Every one of them\'s paid its toll, captain.'] },
  osric: { id: 'osric', name: 'Osric Vane', title: 'Storekeeper of Gallows Landing', shop: true, idle: ['Nobody comes to Stormwrack for the view. I sell what keeps you alive here.'] },
  edda: { id: 'edda', name: 'Edda Lorne', title: 'Starwatcher\'s sister', idle: ['Tobin watched the sky every night of his life. Then the sky came down, and he went to meet it.'] },
  eir: { id: 'eir', name: 'Eir Sund', title: 'Healer of Tollhouse', idle: ['Hornet stings, warg bites, and silk burns from the hollow. I\'ve set more bones this month than all last year.'] },
  halvard: { id: 'halvard', name: 'Halvard Rask', title: 'Toll-reeve of Tollhouse', idle: ['Everything that leaves Amberhold pays its toll. That\'s the law, and the law pays for the harbour wall.'] },
  ulla: { id: 'ulla', name: 'Ulla Brenn', title: 'Chief of the poachers', idle: ['Amberwood was ours before Tollhouse had a wall. Mind your feet in my camp.'] },
  watch_n: { id: 'watch_n', name: 'Watchman Pell', title: 'Town watch', idle: ['North road runs to the Copperback Hills and the foot of Ironcrag. Mind the crabs in iron shells.'] },
  watch_e: { id: 'watch_e', name: 'Watchwoman Dory', title: 'Town watch', idle: ['East road\'s brigand country. Past their camp, the smugglers keep the cove. Go armed.'] },
};

/** A spot to use during a stage: a rock to listen at, sand to dig, a lantern to douse. With `seq`, the stage's
 * spots must be used in that order (a wrong one starts the order again). */
export interface QuestMark {
  id: string; label: string; verb: string; region: string; x: number; z: number; seq?: number; say?: string[]; effect?: Effect;
  /** needs this in the pack (said instead when it isn't) */
  requires?: { id: string; qty: number }; missing?: string[];
  /** in an ordered stage: a false lead, always wrong (the order starts again) */
  decoy?: boolean;
  /** used from your ship's deck, not on foot (a Lock at sea) */
  fromShip?: boolean;
  /** needs this key on your keyring */
  requiresKey?: string;
}

export interface QuestStage {
  text: string;
  talk?: { npc: string; node: DialogueNode };
  /** others who can also move this stage on: a choice of who to talk to */
  also?: { npc: string; node: DialogueNode }[];
  marks?: QuestMark[];
  /** said when a spot is used out of order */
  wrong?: string;
  /** beat `count` of this foe (a sea foe with `sea`); with `spawn`, a quest foe that waits there, once */
  kill?: { foe: string; count: number; sea?: boolean; spawn?: { region: string; x: number; z: number } };
  /** moves on by itself once all of these are true in the world (charted marks, a flag set elsewhere) */
  waitFlags?: string[];
}

export interface QuestDef { id: string; name: string; giver: string; stages: QuestStage[]; reward: string; /** the main story (docs/STORY.md): offered ahead of side quests by the same person */ main?: boolean; /** the island it belongs to (the journal groups by it) */ island?: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack' }

/** the pool behind the Ironshell Shore where the nøkk live */
const POOL = { x: AMBER_LAYOUT.ironshore.x + (AMBER.x - AMBER_LAYOUT.ironshore.x) * 0.22, z: AMBER_LAYOUT.ironshore.z + (AMBER.z - AMBER_LAYOUT.ironshore.z) * 0.22 + 6 };

export const QUESTS: Record<string, QuestDef> = {
  bell: {
    id: 'bell',
    main: true,
    island: 'bellwether',
    name: 'The Bell at Low Water',
    giver: 'iven',
    reward: '150 coins, 300 Attack XP, 300 Defence XP, 200 Smithing XP',
    stages: [
      {
        text: 'Speak with Iven Marr, the cartographer at Bellwether Quay.',
        talk: { npc: 'iven', node: {
          lines: [
            'Captain. You heard it too, last night? The bell at the Broken Ring rang at low water. There is no bell at the Broken Ring.',
            'The ring has a lock with no keyhole, only a bell-shaped hollow. I can cast a bell to fit it, but I need bronze.',
            'Bring me one bronze bar. Copper and tin from the hills, smelted at Bram\'s furnace.',
          ],
          effect: { stage: 1 },
        } },
      },
      {
        text: 'Bring Iven Marr one bronze bar. Mine copper and tin in Copperback Hills, then smelt them at the furnace.',
        talk: { npc: 'iven', node: {
          requires: { id: 'bar_bronze', qty: 1 },
          missing: ['No bronze yet? Copper and tin, one of each, into Bram\'s furnace. The hills are north-east.'],
          lines: [
            'Good bronze. Give me a moment at the mould.',
            'There. A tuning bell. Ring it inside the Broken Ring, north of here, and see what answers.',
            'Take your blade. Whatever locked that ring did not want it opened.',
          ],
          effect: { take: [{ id: 'bar_bronze', qty: 1 }], give: [{ id: 'tuning_bell', qty: 1 }], stage: 2 },
        } },
      },
      { text: 'Ring the tuning bell at the Broken Ring, north of the island, and face what answers.' },
      {
        text: 'Return Keel\'s Tooth to Iven Marr at the quay.',
        talk: { npc: 'iven', node: {
          requires: { id: 'keels_tooth', qty: 1 },
          missing: ['You have the look of someone who fought something. Where is the key?'],
          lines: [
            'Keel\'s Tooth. So the old charts were right: the Locks are real, and they are opening.',
            'This tooth fits something far out past the reef. I will chart it. When I can, I will show you.',
            'You have earned this, and more besides.',
          ],
          effect: { take: [{ id: 'keels_tooth', qty: 1 }], give: [{ id: 'coins', qty: 150 }], xp: [{ skill: 'attack', amount: 300 }, { skill: 'defence', amount: 300 }, { skill: 'smithing', amount: 200 }], stage: 4, flag: 'bell_done' },
        } },
      },
      { text: 'Quest complete. The Guardian can be challenged again by ringing the bell at the Broken Ring.' },
    ],
  },

  knock: {
    id: 'knock',
    island: 'bellwether',
    name: 'Knock Three Times',
    giver: 'pellow',
    reward: 'The Knocker\'s lamp, 400 Mining XP, 200 coins',
    stages: [
      { text: 'Speak with Old Pellow at the Ironcrag camp.',
        talk: { npc: 'pellow', node: { lines: [
          'You\'ve heard the knocking under Ironcrag? Knockers. Little folk in the rock. They knock before a fall, and the young lads laugh at them.',
          'There are three faces up there where they knock. Listen at them in order: the one that knocks once, then twice, then three times. That\'s how they say "come".',
          'Go on. And if something answers, don\'t laugh at it.'], effect: { stage: 1 } } } },
      { text: 'Listen at Ironcrag\'s three knocking rock faces: the one that knocks once, then twice, then three times.',
        wrong: 'The knocking stops dead. Start again from the face that knocks once.',
        marks: [
          { id: 'k2', label: 'Rock face (knock knock)', verb: 'Listen', region: 'bellwether', x: LAYOUT.peak.x + 10, z: LAYOUT.peak.z + 6, seq: 2, say: ['Knock, knock. Then a pause, as if waiting.'] },
          { id: 'k3', label: 'Rock face (knock knock knock)', verb: 'Listen', region: 'bellwether', x: LAYOUT.peak.x - 3, z: LAYOUT.peak.z - 3, seq: 3, say: ['Knock, knock, knock. The rock goes very quiet.'] },
          { id: 'k1', label: 'Rock face (knock)', verb: 'Listen', region: 'bellwether', x: LAYOUT.peak.x - 9, z: LAYOUT.peak.z + 9, seq: 1, say: ['A single knock, deep in the stone.'] },
        ] },
      { text: 'The Knocker Elder has come out of the rock. Beat it.', kill: { foe: 'knocker_elder', count: 1, spawn: { region: 'bellwether', x: LAYOUT.peak.x + 2, z: LAYOUT.peak.z + 12 } } },
      { text: 'Tell Old Pellow what came out of the rock.',
        talk: { npc: 'pellow', node: { lines: [
          'The Elder itself? And you\'re standing here. Well.',
          'It wasn\'t angry with you. It was warning you. Something is shifting under all these islands, deeper than any mine.',
          'Take my lamp. The knockers know its light; they\'ll show you the good seams.'],
          effect: { give: [{ id: 'knockers_lamp', qty: 1 }, { id: 'coins', qty: 200 }], xp: [{ skill: 'mining', amount: 400 }], stage: 4, flag: 'knock_done' } } } },
      { text: 'Quest complete.' },
    ],
  },
  selkie: {
    id: 'selkie',
    island: 'bellwether',
    name: 'The Selkie\'s Skin',
    giver: 'muirne',
    reward: 'A choice: the selkie\'s pearl ring and 500 Fishing XP, or a sealskin cloak and 250 coins',
    stages: [
      { text: 'Speak with the woman on the rocks at Crab Strand.',
        talk: { npc: 'muirne', node: { lines: [
          'You can see what I am, can\'t you? Most can\'t.',
          'I came ashore to dance on the strand, and I took off my skin to do it. When I came back for it, it was gone.',
          'Without it I can\'t go home. A fisherman was mending nets here that night. Dougal.'], effect: { stage: 1 } } } },
      { text: 'Ask Dougal Penrose, the fisherman on the strand, about the sealskin.',
        talk: { npc: 'dougal', node: { lines: [
          'Sealskin? What would I want with a sealskin.',
          '...Look. A man gets lonely. A wife from the sea, the old stories say, if you keep her skin.',
          'I buried it. Where the sand stays wet, so it wouldn\'t dry and crack. I\'m not digging it up for you.'], effect: { stage: 2 } } } },
      { text: 'Dig for the sealskin on Crab Strand, where the sand stays wet.',
        marks: [
          { id: 'dry1', label: 'Turned sand', verb: 'Dig', region: 'bellwether', x: coastPoint(128, 7)[0], z: coastPoint(128, 7)[1], say: ['Dry sand and an old crab shell.'] },
          { id: 'wet', label: 'Turned sand', verb: 'Dig', region: 'bellwether', x: coastPoint(140, 2.2)[0], z: coastPoint(140, 2.2)[1], say: ['Wet sand, and under it, folded in oilcloth: a sealskin, soft as the day it was taken.'], effect: { give: [{ id: 'sealskin', qty: 1 }], stage: 3 } },
          { id: 'dry2', label: 'Turned sand', verb: 'Dig', region: 'bellwether', x: coastPoint(150, 8)[0], z: coastPoint(150, 8)[1], say: ['Nothing but sand and a bottle cap.'] },
        ] },
      { text: 'You have the sealskin. Give it back to Muirne, or to Dougal.',
        talk: { npc: 'muirne', node: { requires: { id: 'sealskin', qty: 1 }, missing: ['Please. Find my skin.'], lines: [
          'My skin! Oh, the sea is in it still.',
          'Take this: a pearl from my mother\'s mother. Fish will come to whoever wears it.',
          'If you ever hear a seal sing your name out past the reef, it will be me. Thank you.'],
          effect: { take: [{ id: 'sealskin', qty: 1 }], give: [{ id: 'ring_selkie', qty: 1 }], xp: [{ skill: 'fishing', amount: 500 }], stage: 4, flag: 'selkie_freed' } } },
        also: [{ npc: 'dougal', node: { requires: { id: 'sealskin', qty: 1 }, missing: ['I told you, I\'m not digging.'], lines: [
          'You found it. And you brought it to me, not her.',
          'I\'ll not keep her against her will, now. But a skin like this... I\'ll have it made into a cloak for you. Fair\'s fair.',
          'Here. Warm as a seal in winter.'],
          effect: { take: [{ id: 'sealskin', qty: 1 }], give: [{ id: 'cloak_selkie', qty: 1 }, { id: 'coins', qty: 250 }], stage: 4, flag: 'selkie_kept' } } }] },
      { text: 'Quest complete.' },
    ],
  },
  wreckers: {
    id: 'wreckers',
    island: 'bellwether',
    name: 'Wreckers\' Lantern',
    giver: 'corwin',
    reward: 'A swivel gun for your sloop (+15% broadside damage), 600 Sailing XP, 300 Attack XP, 300 coins',
    stages: [
      { text: 'Speak with Corwin Ashe, the Reeve of Bellwether.',
        talk: { npc: 'corwin', node: { lines: [
          'Three ships on the rocks this month, captain. Three! Every one of them steered for a light on Wreckers\' Point.',
          'There\'s no lighthouse on Wreckers\' Point. Someone hangs a lantern there on dark nights, and when the ships break up, their cutters come for the cargo.',
          'Put out that lantern, sink their cutters, and bring me their chief.'], effect: { stage: 1 } } } },
      { text: 'Put out the false lantern on Wreckers\' Point.',
        marks: [{ id: 'lantern', label: 'False lantern', verb: 'Douse', region: 'bellwether', x: LAYOUT.wreck.x + 3, z: LAYOUT.wreck.z + 3, say: ['You smash the lantern\'s glass and stamp out the wick. Out on the water, a cutter\'s crew starts shouting.'], effect: { stage: 2 } }] },
      { text: 'Sink two of the wreckers\' cutters off the point. Board your sloop and give them a broadside.', kill: { foe: 'wreckers_cutter', count: 2, sea: true } },
      { text: 'The wreckers\' chief has come ashore on Wreckers\' Point. Beat him.', kill: { foe: 'wrecker_chief', count: 1, spawn: { region: 'bellwether', x: LAYOUT.wreck.x - 2, z: LAYOUT.wreck.z + 6 } } },
      { text: 'Report back to Corwin Ashe.',
        talk: { npc: 'corwin', node: { lines: [
          'The chief, beaten, and his cutters at the bottom. The fishermen will drink to you tonight.',
          'Take this swivel gun off the harbour wall. Mount it on your sloop. It hits harder than those little guns.',
          'And captain: the chief had a chart on him. Islands to the east. You\'ll want it.'],
          effect: { give: [{ id: 'coins', qty: 300 }], xp: [{ skill: 'sailing', amount: 600 }, { skill: 'attack', amount: 300 }], stage: 5, flag: 'swivel_gun' } } } },
      { text: 'Quest complete. Your sloop carries the swivel gun: broadsides hit 15% harder.' },
    ],
  },
  tracks: {
    id: 'tracks',
    island: 'sunreach',
    name: 'Backward Tracks',
    giver: 'abena',
    reward: 'The douen\'s straw hat (faster gathering), 600 Woodcutting XP, 300 Attack XP, 250 coins',
    stages: [
      { text: 'Speak with Abena, the fruit seller in Port Halyard\'s plaza.',
        talk: { npc: 'abena', node: { lines: [
          'Captain, please. My boy Kofi. He went to the jungle edge after a little one he thought was another child. A child in a big straw hat.',
          'A douen. They wear those hats so you never see their faces, and their feet are on backwards.',
          'Their tracks lie: the toes point the way they came from, not the way they went. Find him before they lead him too deep.'], effect: { stage: 1 } } } },
      { text: 'Follow the douen\'s tracks into the Greenheart. Its feet are on backwards: it went the opposite way to its toes.',
        wrong: 'These prints go nowhere. Back to the jungle\'s edge and read the trail again.',
        marks: [
          { id: 't1', label: 'Small footprints at the jungle edge', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x + 10, z: SUN_LAYOUT.jungle.z + 8, seq: 1,
            say: ['Two sets of small prints: a boy\'s, and beside them a child\'s with the toes pointing south-east, back toward the port.', 'Backward feet. It walked north-west, into the trees.'] },
          { id: 't2', label: 'Footprints by the strangler fig', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x + 2, z: SUN_LAYOUT.jungle.z - 2, seq: 2,
            say: ['Here the douen\'s toes point north-east.', 'So it went the other way: south-west, toward the sound of water.'] },
          { id: 't3', label: 'Footprints by the stream', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x - 8, z: SUN_LAYOUT.jungle.z + 4, seq: 3,
            say: ['Wet prints on the bank. The douen\'s toes point south-east.', 'North-west, then: deeper in, where the canopy closes.'] },
          { id: 't4', label: 'A ring of little footprints', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x - 14, z: SUN_LAYOUT.jungle.z - 8, seq: 4,
            say: ['A clearing ringed with prints. In the middle, curled up asleep: Kofi.', 'Straw hats move at the clearing\'s edge. The biggest one steps forward.'] },
          { id: 'd1', label: 'Footprints by the ant column', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x + 11, z: SUN_LAYOUT.jungle.z - 6, decoy: true, say: ['Ant tracks and a boar\'s slots. No child came this way.'] },
          { id: 'd2', label: 'Footprints by the fallen palm', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.jungle.x - 4, z: SUN_LAYOUT.jungle.z + 12, decoy: true, say: ['Old prints, half washed out. A dead end.'] },
        ] },
      { text: 'The douen elder stands over Kofi in the clearing. Beat it.', kill: { foe: 'douen_elder', count: 1, spawn: { region: 'sunreach', x: SUN_LAYOUT.jungle.x - 15, z: SUN_LAYOUT.jungle.z - 10 } } },
      { text: 'Bring the news to Abena in the plaza.',
        talk: { npc: 'abena', node: { lines: [
          'Kofi! He ran in an hour ago, muddy to the knees and talking about straw hats. Thank you, captain. Thank you.',
          'He brought this back with him. The douen dropped it when it ran. Better on your head than his.',
          'They say whoever wears a douen\'s hat never gets lost in the trees.'],
          effect: { give: [{ id: 'hat_douen', qty: 1 }, { id: 'coins', qty: 250 }], xp: [{ skill: 'woodcutting', amount: 600 }, { skill: 'attack', amount: 300 }], stage: 4, flag: 'tracks_done' } } } },
      { text: 'Quest complete.' },
    ],
  },
  souc: {
    id: 'souc',
    island: 'sunreach',
    name: 'Salt for the Soucouyant',
    giver: 'nana_ayo',
    reward: 'The spell Soucouyant\'s Fire (Magic 20), 800 Magic XP, 200 coins',
    stages: [
      { text: 'Speak with Nana Ayo, the herb woman in Port Halyard\'s plaza.',
        talk: { npc: 'nana_ayo', node: { lines: [
          'Three sailors this week woke grey as ash, with a bruise on the neck. Something drinks from them while they sleep.',
          'A soucouyant. By day an old woman. At night she sheds her skin, hides it, and flies as a ball of fire.',
          'Find where she hides the skin and rub it with salt. Three handfuls of sea salt; Tamsin sells it. Then she can\'t put it back on, and she has to come for you.'], effect: { stage: 1 } } } },
      { text: 'Find the soucouyant\'s hidden skin at the jungle\'s edge, and salt it (three sea salt).',
        marks: [
          { id: 'tree', label: 'Hollow of the silk-cotton tree', verb: 'Search', region: 'sunreach', x: SUN_LAYOUT.jungle.x + 16, z: SUN_LAYOUT.jungle.z + 2,
            requires: { id: 'sea_salt', qty: 3 }, missing: ['In the hollow, folded like washing: a woman\'s skin, still warm. You have no salt for it. Three handfuls, Nana Ayo said.'],
            say: ['In the hollow, folded like washing: a woman\'s skin, still warm.', 'You rub it with salt. Somewhere above the trees, a scream, and a light coming down fast.'],
            effect: { take: [{ id: 'sea_salt', qty: 3 }], stage: 2 } },
        ] },
      { text: 'The soucouyant has come down as a ball of fire, and she can\'t get back into her skin. Beat her.', kill: { foe: 'soucouyant', count: 1, spawn: { region: 'sunreach', x: SUN_LAYOUT.jungle.x + 18, z: SUN_LAYOUT.jungle.z + 5 } } },
      { text: 'Tell Nana Ayo it\'s done.',
        talk: { npc: 'nana_ayo', node: { lines: [
          'The sailors are sleeping sound tonight. You did that.',
          'You stood in her fire and lived. Come, I\'ll show you how to call it yourself: it answers anyone who isn\'t afraid of it.',
          'Soucouyant\'s Fire. Don\'t burn the port down.'],
          effect: { give: [{ id: 'coins', qty: 200 }], xp: [{ skill: 'magic', amount: 800 }], stage: 4, flag: 'souc_done' } } } },
      { text: 'Quest complete. Soucouyant\'s Fire is in your spell list (Magic 20).' },
    ],
  },
  barrow: {
    id: 'barrow',
    island: 'amberhold',
    name: 'The Barrow King',
    giver: 'sigrun',
    reward: 'The Barrow King\'s helm, the Draugr\'s Key, 1500 Attack XP, 1500 Defence XP, 500 coins',
    stages: [
      { text: 'Speak with Sigrun the skald at Tollhouse Landing.',
        talk: { npc: 'sigrun', node: { lines: [
          'The dead are walking out of Goldvein Hill. Draugr, in their rusted mail. Something under the hill has woken them.',
          'The old song says a king lies in the barrow, and four lamps keep him sleeping. Someone has let them go out.',
          '"North for the cold that keeps him, sunrise for the day he lost, sunset for the last of it, and the sea that brought him." Light them in that order.'], effect: { stage: 1 } } } },
      { text: 'Light the four barrow lamps on Goldvein Hill in the order of the song: north, sunrise, sunset, sea.',
        wrong: 'The flames gutter and go out together. The song has an order: start again.',
        marks: [
          { id: 'lw', label: 'Barrow lamp (west)', verb: 'Light', region: 'amberhold', x: AMBER_LAYOUT.goldhill.x - 12, z: AMBER_LAYOUT.goldhill.z - 4, seq: 3, say: ['The west lamp, where the sun goes down, catches.'] },
          { id: 'ls', label: 'Barrow lamp (south, toward the sea)', verb: 'Light', region: 'amberhold', x: AMBER_LAYOUT.goldhill.x, z: AMBER_LAYOUT.goldhill.z + 8, seq: 4, say: ['The last lamp catches. Under your feet, the hill groans, and the barrow door grinds open.'] },
          { id: 'ln', label: 'Barrow lamp (north)', verb: 'Light', region: 'amberhold', x: AMBER_LAYOUT.goldhill.x, z: AMBER_LAYOUT.goldhill.z - 15, seq: 1, say: ['The north lamp catches with a cold blue flame.'] },
          { id: 'le', label: 'Barrow lamp (east)', verb: 'Light', region: 'amberhold', x: AMBER_LAYOUT.goldhill.x + 12, z: AMBER_LAYOUT.goldhill.z - 4, seq: 2, say: ['The east lamp, toward the sunrise, catches.'] },
        ] },
      { text: 'The lamps have woken the Barrow King himself. Beat him.', kill: { foe: 'barrow_king', count: 1, spawn: { region: 'amberhold', x: AMBER_LAYOUT.goldhill.x, z: AMBER_LAYOUT.goldhill.z - 6 } } },
      { text: 'Tell Sigrun the Barrow King sleeps again.',
        talk: { npc: 'sigrun', node: { lines: [
          'The draugr went back into the hill at sundown, like men going home. I\'ll make a new verse of it.',
          'He wore this in the song: the king\'s helm. It\'s yours now. And this was in his hand. A key, cold as the barrow.',
          'Keep it close. The dead know its weight.'],
          effect: { give: [{ id: 'helm_barrow', qty: 1 }, { id: 'coins', qty: 500 }], xp: [{ skill: 'attack', amount: 1500 }, { skill: 'defence', amount: 1500 }], stage: 4, flag: 'barrow_done', key: 'draugr_key' } } } },
      { text: 'Quest complete.' },
    ],
  },
  fiddle: {
    id: 'fiddle',
    island: 'amberhold',
    name: 'The Nøkk\'s Fiddle',
    giver: 'ingrid',
    reward: 'A nøkk figurehead for your sloop (+10% hull, mends twice as fast), 1200 Sailing XP, 600 Fishing XP, 400 coins',
    stages: [
      { text: 'Speak with Ingrid Vale, the fiddler at Tollhouse Landing.',
        talk: { npc: 'ingrid', node: { lines: [
          'There\'s a nøkk in the pools behind the Ironshell Shore. A water-horse. At night it plays a fiddle under the water.',
          'They say if you play its own tune back to it, it\'ll give you its bridle, and a ship with a nøkk on her bow never founders.',
          'Go and listen. Then play it back on the reed stones by the pool.'], effect: { stage: 1 } } } },
      { text: 'Listen to the nøkk\'s tune at the pool behind the Ironshell Shore.',
        marks: [{ id: 'listen', label: 'Still pool', verb: 'Listen', region: 'amberhold', x: POOL.x, z: POOL.z,
          say: ['From under the water, very faint: three notes on a fiddle.', 'Low. Then high. Then the middle note, held long.'], effect: { stage: 2 } }] },
      { text: 'Play the tune back on the reed stones: low, then high, then middle.',
        wrong: 'A sour note. The water goes still. Start the tune again.',
        marks: [
          { id: 'mid', label: 'Reed stone (middle note)', verb: 'Play', region: 'amberhold', x: POOL.x + 3, z: POOL.z + 3, seq: 3, say: ['The middle note, held long. The pool goes glassy, and something rises.'] },
          { id: 'high', label: 'Reed stone (high note)', verb: 'Play', region: 'amberhold', x: POOL.x - 3, z: POOL.z + 3, seq: 2, say: ['A high note, thin as wind.'] },
          { id: 'low', label: 'Reed stone (low note)', verb: 'Play', region: 'amberhold', x: POOL.x, z: POOL.z + 5, seq: 1, say: ['A low note hums out over the water.'] },
        ] },
      { text: 'The nøkk has come up out of the pool, calm, with its bridle hanging loose. Take it.',
        marks: [{ id: 'bridle', label: 'The nøkk\'s bridle', verb: 'Take', region: 'amberhold', x: POOL.x, z: POOL.z,
          say: ['The water-horse bows its head and lets the bridle slip off into your hands. Then it sinks without a ripple.'], effect: { give: [{ id: 'nokk_bridle', qty: 1 }], stage: 4 } }] },
      { text: 'Bring the bridle to Ingrid.',
        talk: { npc: 'ingrid', node: { requires: { id: 'nokk_bridle', qty: 1 }, missing: ['The tune, then the bridle. Low, high, middle.'], lines: [
          'You played it back. And it gave you the bridle! I\'d never have believed it.',
          'The shipwright and I will carve a nøkk for your bow and bind the bridle into it. She\'ll ride out anything.',
          'And this: for the story I\'m going to tell about you.'],
          effect: { take: [{ id: 'nokk_bridle', qty: 1 }], give: [{ id: 'coins', qty: 400 }], xp: [{ skill: 'sailing', amount: 1200 }, { skill: 'fishing', amount: 600 }], stage: 5, flag: 'nokk_figurehead' } } } },
      { text: 'Quest complete. Your sloop carries a nøkk figurehead: +10% hull, and she mends twice as fast.' },
    ],
  },
  brood: {
    id: 'brood',
    name: 'The Broodmother',
    island: 'amberhold',
    giver: 'eir',
    reward: 'The Weaver\'s ring (heals you slowly), 1500 coins, 2000 Magic XP, 2000 Ranged XP',
    stages: [
      { text: 'Speak with Eir Sund, the healer at Tollhouse Landing.',
        talk: { npc: 'eir', node: { lines: [
          'Three poachers went into Weaver Hollow after silk this week. One came out. He\'s on my table with burns from the web.',
          'He says the weavers have a mother now. Big as a cart. And my apprentice Leif went in after the other two.',
          'Follow the silk to the hollow, captain. Bring Leif back if you can. And if that thing\'s real, end it.'], effect: { stage: 1 } } } },
      { text: 'Follow the silk into Weaver Hollow: the web-strung trail, Leif, and the mother\'s lair.',
        wrong: 'You lose the silk. Start again from the trail.',
        marks: [
          { id: 'trail', label: 'Web-strung trail', verb: 'Follow', region: 'amberhold', x: AMBER_LAYOUT.hollow.x - 14, z: AMBER_LAYOUT.hollow.z + 5, seq: 1, say: ['Silk lines run between the trees, thick as rope, all of them leading down into the hollow.'] },
          { id: 'cocoon', label: 'A cocoon, moving', verb: 'Cut down', region: 'amberhold', x: AMBER_LAYOUT.hollow.x - 10, z: AMBER_LAYOUT.hollow.z - 4, seq: 2, say: ['You slit the silk. Leif tumbles out, pale and shaking but breathing. "The others... she took them deeper. Go, I can walk."'] },
          { id: 'lair', label: 'Silk over the hollow\'s mouth', verb: 'Look in', region: 'amberhold', x: AMBER_LAYOUT.hollow.x - 8, z: AMBER_LAYOUT.hollow.z + 2, seq: 3, say: ['Bones in the web, and the web is breathing. Something huge shifts in the dark. Disturb the bones in the ring and she\'ll come.'] },
        ] },
      { text: 'Disturb the web-wrapped bones in Weaver Hollow and beat the Broodmother.', kill: { foe: 'broodmother', count: 1 } },
      { text: 'Go back to Eir Sund at Tollhouse Landing.',
        talk: { npc: 'eir', node: { lines: [
          'Leif made it back on his own two feet, talking about you the whole way. And the hollow\'s quiet.',
          'I made this from the silk the poachers brought me: the weavers\' silk knits flesh. Wear it, and you\'ll mend as you go.'],
          effect: { give: [{ id: 'ring_weaver', qty: 1 }, { id: 'coins', qty: 1500 }], xp: [{ skill: 'magic', amount: 2000 }, { skill: 'ranged', amount: 2000 }], stage: 4, flag: 'brood_done' } } } },
      { text: 'Quest complete.' },
    ],
  },
  toll: {
    id: 'toll',
    island: 'amberhold',
    name: 'The Toll of Tollhouse',
    giver: 'halvard',
    reward: 'Help the toll: a toll pennant for your sloop (+5% speed), a toll-keeper\'s seal ring, 600 coins. Help the poachers: they stop attacking you, an amber longbow, 400 coins. Either way, Sailing XP.',
    stages: [
      { text: 'Speak with Halvard Rask, the toll-reeve at Tollhouse Landing.',
        talk: { npc: 'halvard', node: { lines: [
          'Captain. Amberhold\'s amber and gold go out through my toll, and the toll keeps the harbour wall standing.',
          'The poachers on the headland won\'t pay. They run amber past us by night, and their bows keep my men off the headland.',
          'Talk to their chief, Ulla Brenn, at the edge of their camp. See if she\'ll see sense.'], effect: { stage: 1 } } } },
      { text: 'Talk to Ulla Brenn, the poachers\' chief, at the south edge of their camp on the headland.',
        talk: { npc: 'ulla', node: { lines: [
          'Halvard sent you. Of course he did. His toll takes half of every lump of amber we cut from our own wood.',
          'Help us instead: carry this season\'s haul to Tamsin at Port Halyard. She pays fair and asks no questions.',
          'Or run back to Halvard. Your choice, captain. Choose it.'], effect: { stage: 2 } } } },
      { text: 'Choose a side: Halvard the toll-reeve, or Ulla the poachers\' chief.',
        talk: { npc: 'halvard', node: { lines: [
          'She won\'t pay. I thought not.',
          'Then take the toll ledger to Sefa Odun, the harbourmaster at Port Halyard. With her seal on it, the whole sound will know the poachers are outlaws.',
          'Sail it there yourself, or take a ferry. Bring me back her receipt.'], effect: { give: [{ id: 'toll_ledger', qty: 1 }], stage: 3, flag: 'toll_side' } } },
        also: [{ npc: 'ulla', node: { lines: [
          'Good. The haul\'s in these sacks. Don\'t let the toll-men search them.',
          'Tamsin at Port Halyard. She\'ll pay you in silver; bring the silver back to me and you\'ll have a share.'], effect: { give: [{ id: 'amber_haul', qty: 1 }], stage: 3, flag: 'poach_side' } } }] },
      { text: 'Make the run to Port Halyard on Sunreach: the toll ledger to Sefa Odun, or the poachers\' haul to Tamsin.',
        talk: { npc: 'sefa', node: { requires: { id: 'toll_ledger', qty: 1 }, missing: ['Port Halyard\'s harbour. Something for me, captain?'], lines: [
          'The Tollhouse ledger. Halvard\'s been asking for my seal on this for a year.',
          'There. Sealed. Every harbour from here to Bellwether will know who pays and who doesn\'t. Here\'s the receipt.'],
          effect: { take: [{ id: 'toll_ledger', qty: 1 }], give: [{ id: 'toll_receipt', qty: 1 }], xp: [{ skill: 'sailing', amount: 500 }], stage: 4 } } },
        also: [{ npc: 'tamsin', node: { requires: { id: 'amber_haul', qty: 1 }, missing: ['Buying or selling?'], lines: [
          'Ulla\'s sacks. I\'d know that knot anywhere.',
          'Good amber, and not a toll-man\'s thumbprint on it. Silver for Ulla. Tell her Tamsin says the next season\'s welcome too.'],
          effect: { take: [{ id: 'amber_haul', qty: 1 }], give: [{ id: 'poachers_silver', qty: 1 }], xp: [{ skill: 'sailing', amount: 500 }], stage: 4 } } }] },
      { text: 'Take the receipt back to Halvard, or the silver back to Ulla.',
        talk: { npc: 'halvard', node: { requires: { id: 'toll_receipt', qty: 1 }, missing: ['Sefa\'s receipt, captain. Port Halyard, on Sunreach.'], lines: [
          'Sealed by Port Halyard. The poachers are outlaws on every chart now. You\'ve done Amberhold a service.',
          'Fly this toll pennant from your mast: no toll-man in the sound will slow you again. And this ring is the toll\'s own seal.'],
          effect: { take: [{ id: 'toll_receipt', qty: 1 }], give: [{ id: 'ring_toll', qty: 1 }, { id: 'coins', qty: 600 }], xp: [{ skill: 'sailing', amount: 600 }], stage: 5, flag: 'toll_pennant' } } },
        also: [{ npc: 'ulla', node: { requires: { id: 'poachers_silver', qty: 1 }, missing: ['Tamsin. Port Halyard. The silver, captain.'], lines: [
          'Silver, and the full weight of it. You\'re honest, for a captain.',
          'Take this bow: amberwood, strung by my own hands. And my people know your face now. They won\'t draw on you again.'],
          effect: { take: [{ id: 'poachers_silver', qty: 1 }], give: [{ id: 'longbow_amber', qty: 1 }, { id: 'coins', qty: 400 }], xp: [{ skill: 'sailing', amount: 600 }], stage: 5, flag: 'poachers_friend' } } }] },
      { text: 'Quest complete.' },
    ],
  },
  greenheart: {
    id: 'greenheart',
    name: 'Fire on the Greenheart',
    island: 'sunreach',
    giver: 'ama',
    reward: 'The fire camp hands you four full buckets each time, not two; 800 coins, 1500 Woodcutting XP, 1000 Fletching XP',
    stages: [
      { text: 'Speak with Ama Boateng, the fire-warden, at the fire camp in the Greenheart.',
        talk: { npc: 'ama', node: { lines: [
          'Lightning season, and the grove\'s dry as kindling. When it goes up, I need hands that know the camp.',
          'Here\'s how it works. Bamboo from the stands, two lengths to a bucket, lashed at the bench. Fill them at the stream.',
          'Walk the camp with me: the bench first, then the stream. Then you\'ll know where to run when the horn goes.'], effect: { stage: 1 } } } },
      { text: 'Learn the fire camp: look over the bench, then the stream.',
        wrong: 'Bench first, captain. You make the bucket before you fill it.',
        marks: [
          { id: 'bench', label: 'Fire camp bench', verb: 'Look over', region: 'sunreach', x: SUN_LAYOUT.jungle.x - 12, z: SUN_LAYOUT.jungle.z + 13, seq: 1, say: ['Twine, a mallet, and bamboo offcuts. Two lengths lashed together make a bucket that holds water.'] },
          { id: 'stream', label: 'The stream', verb: 'Look over', region: 'sunreach', x: SUN_LAYOUT.jungle.x - 30, z: SUN_LAYOUT.jungle.z + 8, seq: 2, say: ['Cold and quick. You can fill a bucket here in a breath.', 'Somewhere over the canopy, thunder. Ama shouts: "That\'s it! Sound the horn when you\'re ready!"'] },
        ] },
      { text: 'Sound the fire horn and save the grove: douse the burning thickets before too much of it burns.', },
      { text: 'Tell Ama Boateng the grove is saved.',
        talk: { npc: 'ama', node: { lines: [
          'Steam over the canopy, and not a tree lost that won\'t grow back. You\'ve the makings of a warden.',
          'From now on the camp keeps four buckets full for you, not two. Come back whenever the horn sounds.'],
          effect: { give: [{ id: 'coins', qty: 800 }], xp: [{ skill: 'woodcutting', amount: 1500 }, { skill: 'fletching', amount: 1000 }], stage: 4, flag: 'greenheart_done' } } } },
      { text: 'Quest complete. The fire camp hands you four full buckets each time.' },
    ],
  },
  palewing: {
    id: 'palewing',
    name: 'Charted Waters',
    island: 'bellwether',
    giver: 'iven',
    reward: 'Bastian Gull joins your crew as chartmaster (+10% Sailing XP); 1200 coins, 2500 Sailing XP; a lead on the Second Lock',
    stages: [
      { text: 'Speak with Iven Marr at Bellwether Quay, once The Bell at Low Water is done.',
        talk: { npc: 'iven', node: { needsFlags: ['bell_done'], missing: ['Not now, captain. I\'m re-checking every chart in the house, and I don\'t know why yet.'], lines: [
          'Someone broke into my chart house last night. Took nothing. Moved nothing. Except this: my chart of Bellwether\'s waters, corrected in white ink.',
          'Every sounding redone. Every one right. Only one man alive draws a depth mark like that. Bastian Gull.',
          'He was my apprentice, before the poster. Before he decided charts were worth more stolen than drawn.',
          'He\'ll be at Wreckers\' Point. He always liked to look at the place ships die. Find out what he wants. And don\'t let him charm you; he\'s good at it.'],
          effect: { stage: 1 } } } },
      { text: 'Find Bastian Gull at Wreckers\' Point, on Bellwether\'s north-east shore.',
        talk: { npc: 'gull', node: { lines: [
          'Iven sent you. Of course he did. He never could come and say a thing himself.',
          'Don\'t mind the cough. Sea air.',
          'Here\'s what I want, and it isn\'t his charts. The seabed\'s moving. Round the Locks the bottom of the sea is rising, a hand\'s width a year, like something underneath is taking a breath.',
          'I need fresh soundings at all four of Bellwether\'s charting marks, and I can\'t bring the Pale Wing in close: half the Compact\'s watching her. You can. Sail them, and bring me the numbers.'],
          effect: { stage: 2 } } } },
      { text: 'Take fresh soundings at all four of Bellwether\'s charting marks: Gull Rock, the East Deep, the North Deep and the Wreckers\' channel.',
        waitFlags: ['chart_bw_gullrock', 'chart_bw_eastdeep', 'chart_bw_northdeep', 'chart_bw_wreckers'] },
      { text: 'Bring the soundings to Bastian Gull at Wreckers\' Point.',
        talk: { npc: 'gull', node: { lines: [
          'Let me see. There. And there. And off the North Deep, most of all.',
          'It isn\'t rising evenly. It\'s rising toward something. Toward the Mirewater Fen, of all places. That lagoon\'s been fresh water for a thousand years, and it\'s going salt.',
          'That\'s where your Second Lock is, captain. I\'d stake the Pale Wing on it.',
          'Why do I care? I\'ve been coughing blood for a year. I want one chart on the wall of Iven\'s house that\'s whole: every island, every Lock, the Reef as it really is. Then they can bury me under it.',
          'So take me on. Not as a captain; as your chartmaster. The Pale Wing can sail herself home, and you need someone who reads water the way I do.'],
          effect: { crew: 'gull', flag: 'tide_gull_crew', stage: 4 } } } },
      { text: 'Tell Iven Marr that Bastian Gull has joined your crew.',
        talk: { npc: 'iven', node: { lines: [
          'He\'s on your crew? Bastian Gull. On a deck with my chart on the table.',
          '...Is he well? He never was, you know. Even as a boy. Don\'t tell him I asked.',
          'The Fen going salt. I\'ll look into it. If he\'s right, the Second Lock is under Bellwether\'s nose, and has been for a thousand years.'],
          effect: { give: [{ id: 'coins', qty: 1200 }], xp: [{ skill: 'sailing', amount: 2500 }], stage: 5, flag: 'palewing_done' } } } },
      { text: 'Quest complete. Bastian Gull sails with you. The Mirewater Fen is going salt.' },
    ],
  },
  ransom: {
    id: 'ransom',
    name: 'The Ransom Note',
    island: 'sunreach',
    giver: 'sefa',
    reward: 'Kwesi home; Marisol Ransom owes you (her ship lets you pass) or her red pennant flies on your mast (+5% cannon damage); 1500 coins, 3000 Sailing XP',
    stages: [
      { text: 'Speak with Sefa Odun, the harbourmaster at Port Halyard.',
        talk: { npc: 'sefa', node: { lines: [
          'My apprentice, Kwesi, rowed out to meet a red-sailed ship last night with the post. He didn\'t row back.',
          'This came in the morning, pinned to my door with a fish knife. "Two thousand silver, or the deed to Coral Key. Ask for me at Palm Cove. M. Ransom."',
          'The Compact doesn\'t pay ransoms. Rule three. And the Coral Key deed isn\'t mine to give; it\'s in the archive at Bellwether, and it\'s been there since the Breaking.',
          'I can\'t do anything, captain. You can. Pay her, or take him back. I won\'t ask which.'],
          effect: { stage: 1 } } } },
      { text: 'Get Kwesi back from Marisol Ransom. Pay her two thousand coins at Palm Cove, or sink her ship, the Dear Hostage, in Sunreach\'s western waters.',
        talk: { npc: 'marisol', node: { requires: { id: 'coins', qty: 2000 }, missing: [
          'You\'re the captain Sefa sent? Good. Two thousand, or the deed. I don\'t take promises, I take silver.',
          'Or come out west and take him off my deck, if you\'ve the stomach. The Dear Hostage doesn\'t run from anyone.'], lines: [
          'You\'re paying it yourself? Out of your own purse, for a harbour boy you\'ve never met.',
          'That\'s either the best thing anyone\'s done on this sea in years, or the stupidest.',
          'He\'s in the boat. He ate better with me than he does with Sefa, tell her that.'],
          effect: { take: [{ id: 'coins', qty: 2000 }], flag: 'tide_marisol_friend', stage: 2 } } },
        kill: { foe: 'red_ransom', count: 1 } },
      { text: 'Hear Marisol Ransom out at Palm Cove.',
        talk: { npc: 'marisol', node: { needsFlags: ['tide_marisol_friend'], lines: [
          'You want to know what the money\'s for. Everybody does, after.',
          'My grandmother\'s grandmother owned Coral Key: an island the size of a breath, with a well and nine goats. After the Breaking, the Compact sold it to pay its debts. Their first sale.',
          'I\'ve been buying it back two thousand at a time for eleven years. The Compact won\'t sell to a pirate. So I\'ll buy it the way pirates buy things.',
          'Here, half back. Call it the price of meeting someone decent. And captain: my ship won\'t fire on yours. Not ever. Tell the others that, if you like. They won\'t believe you.'],
          effect: { give: [{ id: 'coins', qty: 1000 }], stage: 3 } } },
        also: [{ npc: 'marisol', node: { needsFlags: ['ransom_1_k0'], lines: [
          'You sank my ship. My ship. Do you know how long it takes to find red sailcloth?',
          '...Fine. Fine. Kwesi\'s on the beach, wrapped in my good coat, which I will be wanting back.',
          'You want to know what it was for. My grandmother\'s grandmother owned Coral Key, and the Compact sold it after the Breaking to pay their debts. I\'ve been buying it back the only way they\'ll let a pirate buy anything.',
          'Take this. My pennant. Every ship on this sea knows it. Fly it, and they\'ll know you sank the Red Ransom and lived. That buys a captain a lot of fear.',
          'The Dear Hostage will be raised by the next tide, and she\'ll be angry. So will I. See you on the water.'],
          effect: { flag: 'ransom_pennant', stage: 3 } } }] },
      { text: 'Bring Kwesi home to Sefa Odun at Port Halyard.',
        talk: { npc: 'sefa', node: { lines: [
          'Kwesi! You great fool, you rowed out to a red ship. With the post.',
          'Thank you, captain. I won\'t ask what it cost you.',
          'Coral Key. I looked it up. The Compact\'s first sale, the year after the Breaking, to cover what Keel\'s war cost the harbours. Signed by every harbourmaster, including mine.',
          'Rule three says we take no side. Nobody wrote a rule about the sides we took before we had rules.'],
          effect: { give: [{ id: 'coins', qty: 1500 }], xp: [{ skill: 'sailing', amount: 3000 }], stage: 4, flag: 'ransom_done' } } } },
      { text: 'Quest complete. Marisol Ransom, the first of the Tides, knows your name.' },
    ],
  },
  temple: {
    id: 'temple',
    island: 'sunreach',
    name: 'The Sunken Temple',
    giver: 'halyard_watch',
    reward: 'The Sun Key, 1200 Magic XP, 800 Attack XP, 400 coins',
    stages: [
      { text: 'Speak with Watchman Okoro in Port Halyard\'s plaza.',
        talk: { npc: 'halyard_watch', node: { lines: [
          'You\'re asking about the old temple in the jungle? My grandmother told me about it. The sun-priests built it around something they were afraid of.',
          'There are three glyph stones outside it. The priests read them in the order the sun walks the sky before they went in: rising, high, setting.',
          'Read them right and the gong inside will wake what they locked away. They say it guards a key. Go well armed.'], effect: { stage: 1 } } } },
      { text: 'Read the three glyph stones outside the Sunken Temple in the order the sun walks the sky: rising, high, setting.',
        wrong: 'The glyphs go dark. The sun doesn\'t walk that way: start again from where it rises.',
        marks: [
          { id: 'set', label: 'Glyph stone (setting sun)', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.temple.x - 10, z: SUN_LAYOUT.temple.z + 3, seq: 3, say: ['The setting sun, carved half under a wavy line. Deep in the temple, something shifts.'] },
          { id: 'rise', label: 'Glyph stone (rising sun)', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.temple.x + 10, z: SUN_LAYOUT.temple.z + 3, seq: 1, say: ['A sun rising over the sea, its rays picked out in old gold.'] },
          { id: 'high', label: 'Glyph stone (high sun)', verb: 'Read', region: 'sunreach', x: SUN_LAYOUT.temple.x + 3, z: SUN_LAYOUT.temple.z + 10, seq: 2, say: ['The sun at its height, every ray a serpent.'] },
        ] },
      { text: 'Strike the temple gong and beat the Sunscale.', kill: { foe: 'temple_serpent', count: 1 } },
      { text: 'Bring the news to Watchman Okoro.',
        talk: { npc: 'halyard_watch', node: { lines: [
          'The Sunscale? Beaten? Then my grandmother\'s stories were true, every word.',
          'And this was under it? The sun-priests\' key. Gold that\'s never cold. Keep it: it\'s earned.',
          'Port Halyard owes you, captain. I\'ll see the whole watch knows it.'],
          effect: { give: [{ id: 'coins', qty: 400 }], xp: [{ skill: 'magic', amount: 1200 }, { skill: 'attack', amount: 800 }], stage: 4, flag: 'temple_done', key: 'sun_key' } } } },
      { text: 'Quest complete.' },
    ],
  },
  captain: {
    id: 'captain',
    name: 'The Drowned Captain\'s Log',
    island: 'wrack',
    giver: 'mercy',
    reward: 'The Drowned Captain\'s tricorn, his hoard (1500 coins and more), 2000 Attack XP, 2000 Defence XP',
    stages: [
      { text: 'Speak with Mercy Gale, the harbourmaster at Gallows Landing.',
        talk: { npc: 'mercy', node: { lines: [
          'You\'ve seen the Wrack? Ships\' ribs, and the drowned walking among them. Their captain still gives orders.',
          'He sank with a hoard aboard, they say, and buried it before the end. His log washed up in pieces along the wreck-shore.',
          'Find the pages. Read where he hid it. Then you\'ll have to get past him to dig.'], effect: { stage: 1 } } } },
      { text: 'Search the wreck-shore for the three torn pages of the captain\'s log.',
        marks: [
          { id: 'p1', label: 'Sodden page in the ribs', verb: 'Search', region: 'wrack', x: WRACK_LAYOUT.wreck.x - 9, z: WRACK_LAYOUT.wreck.z - 2, seq: 1, say: ['"...put it ashore where the ribs point at the crag..."'] },
          { id: 'p2', label: 'Page under a barnacled spar', verb: 'Search', region: 'wrack', x: WRACK_LAYOUT.wreck.x + 7, z: WRACK_LAYOUT.wreck.z + 1, seq: 2, say: ['"...twelve paces inland of the third rib, no more..."'] },
          { id: 'p3', label: 'Page in a drowned sailor\'s fist', verb: 'Search', region: 'wrack', x: WRACK_LAYOUT.wreck.x - 1, z: WRACK_LAYOUT.wreck.z + 10, seq: 3, say: ['"...and if I come for it dead, God help the man who\'s dug it first."', 'The pages fit together. You know where to dig. Behind you, something in a rotted coat draws its sword.'] },
        ] },
      { text: 'The Drowned Captain stands between you and his hoard. Beat him.', kill: { foe: 'wreck_captain', count: 1 } },
      { text: 'Dig where the log says: twelve paces inland of the third rib, toward the crag.',
        marks: [{ id: 'dig', label: 'Disturbed shingle', verb: 'Dig', region: 'wrack', x: WRACK_LAYOUT.wreck.x + 3, z: WRACK_LAYOUT.wreck.z - 9,
          say: ['Under the shingle, a chest bound in green copper. The lid gives with a shriek.'],
          effect: { give: [{ id: 'hat_captain', qty: 1 }, { id: 'coins', qty: 1500 }, { id: 'casket', qty: 2 }, { id: 'bar_tide', qty: 3 }], stage: 4 } }] },
      { text: 'Tell Mercy Gale you found the hoard.',
        talk: { npc: 'mercy', node: { lines: [
          'You dug it up, and you\'re still breathing. Gallows Landing will be telling that one for years.',
          'Keep his hat on, captain. The drowned know it. They might think twice.'],
          effect: { xp: [{ skill: 'attack', amount: 2000 }, { skill: 'defence', amount: 2000 }], stage: 5, flag: 'captain_done' } } } },
      { text: 'Quest complete.' },
    ],
  },
  starfall: {
    id: 'starfall',
    name: 'Star-Struck',
    island: 'wrack',
    giver: 'edda',
    reward: 'The Starfall pendant, 1200 coins, 2500 Magic XP, 1500 Smithing XP',
    stages: [
      { text: 'Speak with Edda Lorne at Gallows Landing.',
        talk: { npc: 'edda', node: { lines: [
          'My brother Tobin keeps the star-watch. When the star came down east of here, he went out to watch it cool.',
          'He came back once. He didn\'t know my name. He talked to a shard of it in his hand like it was talking back.',
          'He\'s out at the crater again. Find his camp, captain. Find out what it\'s done to him.'], effect: { stage: 1 } } } },
      { text: 'Search Tobin\'s camp at the Starfall crater: his journal, his glass, and where he went.',
        marks: [
          { id: 'journal', label: 'A star-watcher\'s journal', verb: 'Read', region: 'wrack', x: WRACK_LAYOUT.starfall.x - 7, z: WRACK_LAYOUT.starfall.z + 6, seq: 1, say: ['"Night 3. The shard is warm. It hums when I hold it near the crater. I think it wants to go back up."'] },
          { id: 'glass', label: 'A brass spyglass, cracked', verb: 'Look through', region: 'wrack', x: WRACK_LAYOUT.starfall.x + 7, z: WRACK_LAYOUT.starfall.z + 6, seq: 2, say: ['Through the cracked lens, the crater glows a pale blue it doesn\'t show to the naked eye.'] },
          { id: 'tracks', label: 'Footprints that glow', verb: 'Follow', region: 'wrack', x: WRACK_LAYOUT.starfall.x + 2, z: WRACK_LAYOUT.starfall.z - 8, seq: 3, say: ['The footprints glow fainter with every step, as if whoever made them was burning out.', 'At the crater\'s lip, a man turns. His eyes are full of starlight, and the shard in his hand is singing.'] },
        ] },
      { text: 'The star-shard has hold of Tobin. Beat him down and knock it from his hand.', kill: { foe: 'starstruck', count: 1, spawn: { region: 'wrack', x: WRACK_LAYOUT.starfall.x + 2, z: WRACK_LAYOUT.starfall.z - 12 } } },
      { text: 'Tobin is out cold, and the shard lies hissing in the ash. Pick it up.',
        marks: [{ id: 'shard', label: 'A star-shard, hissing', verb: 'Take', region: 'wrack', x: WRACK_LAYOUT.starfall.x + 4, z: WRACK_LAYOUT.starfall.z - 10,
          say: ['It\'s warm through your glove, and it hums. Only the vent forge on Thunder Crag runs hot enough to quiet it.'], effect: { give: [{ id: 'star_shard', qty: 1 }], stage: 4 } }] },
      { text: 'Quench the star-shard in the vent forge on Thunder Crag.',
        marks: [{ id: 'quench', label: 'The vent forge\'s quenching pool', verb: 'Quench', region: 'wrack', x: WRACK_LAYOUT.crag.x + 3, z: WRACK_LAYOUT.crag.z - 3,
          requires: { id: 'star_shard', qty: 1 }, missing: ['You need the star-shard from the crater.'],
          say: ['The shard screams in the vent\'s heat, then goes quiet in the pool. What\'s left is cool, and bright, and yours.'],
          effect: { take: [{ id: 'star_shard', qty: 1 }], give: [{ id: 'amulet_starfall', qty: 1 }], xp: [{ skill: 'smithing', amount: 1500 }], stage: 5 } }] },
      { text: 'Tell Edda Lorne her brother is free of it.',
        talk: { npc: 'edda', node: { lines: [
          'He walked in an hour ago, asking for soup and asking what day it was. He knew my name.',
          'He says he doesn\'t remember any of it. I hope that\'s true.',
          'Take this for your trouble, captain. And wear that pendant: whatever sang in it, it sings for you now.'],
          effect: { give: [{ id: 'coins', qty: 1200 }], xp: [{ skill: 'magic', amount: 2500 }], stage: 6, flag: 'starfall_done' } } } },
      { text: 'Quest complete.' },
    ],
  },
  firstlock: {
    id: 'firstlock',
    main: true,
    name: 'The First Lock',
    island: 'wrack',
    giver: 'iven',
    reward: 'The Listener\'s Key, 3000 coins, 4000 Sailing, Magic and Defence XP. Act II begins.',
    stages: [
      { text: 'Speak with Iven Marr at Bellwether Quay, once The Key Collector is done.',
        talk: { npc: 'iven', node: { needsFlags: ['collector_done'], missing: ['The Locks, captain. I need a little longer with the charts.'], lines: [
          'I\'ve read the collector\'s ledger cover to cover. Every key they took, where, and when. Neat as a tax-man.',
          'The last page is in another hand. "The Tooth opens the Spire. Bring it at bell-time." No name. Just a mark: an ear, drawn over a keyhole.',
          'My grandmother drew that mark in the margins of her charts. She told me it meant "keep away". I think it means "we\'re listening".',
          'The Drowned Spire, off Stormwrack\'s north shore. It isn\'t a rock, captain. It\'s a Lock. And Keel\'s Tooth is its key.',
          'Don\'t go at any old hour. The Locks only rise at low water. Mercy Gale keeps the Compact\'s tide tables at Gallows Landing. Ask her for bell-time.'],
          effect: { stage: 1 } } } },
      { text: 'Ask Mercy Gale at Gallows Landing, Stormwrack, for bell-time at the Drowned Spire.',
        talk: { npc: 'mercy', node: { lines: [
          'Bell-time at the Spire? You\'ve been talking to cartographers.',
          'The Compact takes no side. That\'s rule three, and it\'s older than this landing.',
          'But a tide table isn\'t a side, is it. It\'s a tide table. Anyone could buy one.',
          'Here. Low water\'s after dark this week. Whatever answers you out there, I\'d rather you didn\'t bring it back to my harbour.'],
          effect: { give: [{ id: 'tide_table', qty: 1 }], stage: 2 } } } },
      { text: 'Sail to the Drowned Spire at bell-time, north of Stormwrack, and turn Keel\'s Tooth in it from your deck.',
        marks: [{ id: 'spire', label: 'The Drowned Spire, risen at low water', verb: 'Turn Keel\'s Tooth', region: 'wrack', x: WRACK_LAYOUT.spire.x, z: WRACK_LAYOUT.spire.z + 9, fromShip: true,
          requiresKey: 'keels_tooth', requires: { id: 'tide_table', qty: 1 }, missing: ['The Spire is a shadow under the water. You need the Compact\'s tide table to know when it rises.'],
          effect: { take: [{ id: 'tide_table', qty: 1 }], flag: 'firstlock_opened', stage: 3, vision: { title: 'The First Lock', sub: 'What Keel\'s Tooth remembers', lines: [
            'The Tooth turns in the Spire like it\'s turning in your own jaw. The sea goes quiet. Then it isn\'t the sea any more.',
            'You\'re standing on a deck that isn\'t yours, in a body that isn\'t yours, and the man whose eyes you\'re looking out of is laughing.',
            'Thirteen lights round a land that\'s still whole. Twelve of them dark. A woman at the rail with her ear to the water: black hair, a quartermaster\'s ledger under her arm.',
            '"Turn it, Corran," she says, gentle as anything. "They\'re so tired of the dark."',
            'He turns the twelfth key. The land screams. You feel it crack under the keel like ice in spring.',
            'And under it all, so loud it\'s almost kind, a song with your name in it.',
            'You\'re back on your own deck. Your hands are shaking. The Spire\'s keyhole stands open and empty, and something has gone out through it.'] } } }] },
      { text: 'Someone was waiting for the Lock to open. Hushed listeners are coming down the road to Gallows Landing: stop them before the yard.',
        kill: { foe: 'hushed_listener', count: 3, spawn: { region: 'wrack', x: WRACK_LAYOUT.landing.x + 1, z: WRACK_LAYOUT.landing.z - 21 } } },
      { text: 'Ask Mercy Gale who they were.',
        talk: { npc: 'mercy', node: { lines: [
          'They came off a black brig with no flag. Walked up my quay like they owned it, an ear to every keyhole on the way.',
          'Their captain didn\'t fight. Stood at the end of the pier and watched you do it. Then she left this on my desk and sailed.',
          'It\'s addressed to you. I didn\'t read it. Rule two.',
          'In a small, neat hand: "Captain. Thank you for opening the first door. You\'ve done more for them tonight than we have in forty years."',
          '"Twelve to go. Don\'t be frightened when you start to hear them. Everyone does." Signed: Sister Corva, of the Lantern.',
          'I did read it. Take it to your cartographer, and then never bring that woman to my harbour again.'],
          effect: { stage: 5 } } } },
      { text: 'Take Sister Corva\'s letter to Iven Marr at Bellwether Quay.',
        talk: { npc: 'iven', node: { lines: [
          'She thanked you. That\'s the worst thing she could have written.',
          'So that\'s what the Locks are. Not doors to a treasury. Doors to keep something in, and Keel opened twelve of them.',
          'Now they\'re opening on their own, and the Hushed are helping them along. Twelve to go, she says. She\'s counting.',
          'My grandmother left me this with her charts. I never knew what it opened. I think it opens you: turn it and you\'ll hear what they hear.',
          'Take it. If we\'re going to stop them, we have to listen too. Carefully, captain. They\'ll hear you back.'],
          effect: { give: [{ id: 'coins', qty: 3000 }], xp: [{ skill: 'sailing', amount: 4000 }, { skill: 'magic', amount: 4000 }, { skill: 'defence', amount: 4000 }], stage: 6, flag: 'firstlock_done', key: 'listener' } } } },
      { text: 'Quest complete. The First Lock is open, and Act II has begun: twelve Locks to go, and the Hushed are counting.' },
    ],
  },
  collector: {
    id: 'collector',
    main: true,
    name: 'The Key Collector',
    island: 'wrack',
    giver: 'iven',
    reward: 'The Skeleton Key (legendary), 2500 coins, 3000 Attack, Defence and Magic XP',
    stages: [
      { text: 'Speak with Iven Marr at Bellwether Quay, once The Bell at Low Water is done.',
        talk: { npc: 'iven', node: { needsFlags: ['bell_done'], missing: ['The sea has a second map, captain. I mean to finish it.'], lines: [
          'Captain. Keel\'s Tooth has been keeping me up at night. I\'ve been charting where the Locks lead, and I\'m not the only one looking.',
          'Every island I write to has lost a key. Taken, not found. Someone is collecting them.',
          'The Sunken Temple on Sunreach guards one, and the barrows under Goldvein Hill on Amberhold another. Win them before the collector does.'], effect: { stage: 1 } } } },
      { text: 'Win the Sun Key (The Sunken Temple, Sunreach) and the Draugr\'s Key (The Barrow King, Amberhold), then go back to Iven Marr.',
        talk: { npc: 'iven', node: { needsFlags: ['temple_done', 'barrow_done'], missing: ['The Sun Key and the Draugr\'s Key, captain. Sunreach\'s temple and Amberhold\'s barrows. Before the collector gets there.'], lines: [
          'Both keys, and on your ring, not in some stranger\'s pack. Good.',
          'I\'ve followed the collector\'s trail on my charts: every theft, a ship out of Gallows Landing a week later. Stormwrack.',
          'There\'s an old camp in the Old Wood there. Find it. Be careful: anyone who can take a key from a guardian is no tavern thief.'], effect: { stage: 2 } } } },
      { text: 'Search the Old Wood on Stormwrack for the collector\'s camp.',
        marks: [{ id: 'camp', label: 'A cold camp under the yews', verb: 'Search', region: 'wrack', x: WRACK_LAYOUT.oldwood.x + 4, z: WRACK_LAYOUT.oldwood.z + 8,
          say: ['A bedroll, a lantern, and a ledger of keys: every island, every guardian, crossed off one by one.', 'A voice behind you: "You\'re carrying two of mine, captain."'], effect: { stage: 3 } }] },
      { text: 'The Key Collector has come for your keys. Beat them.', kill: { foe: 'key_collector', count: 1, spawn: { region: 'wrack', x: WRACK_LAYOUT.oldwood.x + 1, z: WRACK_LAYOUT.oldwood.z + 11 } } },
      { text: 'Take the collector\'s ledger back to Iven Marr at Bellwether Quay.',
        talk: { npc: 'iven', node: { lines: [
          'The collector, beaten. And their ledger: every key they took, and where it is now. This changes the whole chart.',
          'They had this on them. It opens any lock I\'ve ever drawn. I think it\'s been opening them for a long time.',
          'It\'s yours, captain. Nobody else should hold it.'],
          effect: { give: [{ id: 'coins', qty: 2500 }], xp: [{ skill: 'attack', amount: 3000 }, { skill: 'defence', amount: 3000 }, { skill: 'magic', amount: 3000 }], stage: 5, flag: 'collector_done', key: 'skeleton' } } } },
      { text: 'Quest complete. The Skeleton Key is on your keyring.' },
    ],
  },
};
