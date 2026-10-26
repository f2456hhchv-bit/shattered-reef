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
}

export interface DialogueNode {
  lines: string[];
  requires?: { id: string; qty: number }; // only offered when the player carries this
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
  // Amberhold's quests (docs/ISLANDS.md, slice 3)
  sigrun: { id: 'sigrun', name: 'Sigrun', title: 'Skald', idle: ['Every hill on Amberhold has a song. Goldvein Hill\'s is the oldest, and nobody sings it after dark.'] },
  ingrid: { id: 'ingrid', name: 'Ingrid Vale', title: 'Fiddler', idle: ['A fiddle tune can calm a horse, a crowd, or a storm. I\'ve managed two of the three.'] },
  brita: { id: 'brita', name: 'Brita Holm', title: 'Trader of the Tollhouse Market', shop: true, idle: ['Stormsilver, honey, and barrels that burn. Every one of them\'s paid its toll, captain.'] },
  osric: { id: 'osric', name: 'Osric Vane', title: 'Storekeeper of Gallows Landing', shop: true, idle: ['Nobody comes to Stormwrack for the view. I sell what keeps you alive here.'] },
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
}

export interface QuestDef { id: string; name: string; giver: string; stages: QuestStage[]; reward: string; /** the island it belongs to (the journal groups by it) */ island?: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack' }

/** the pool behind the Ironshell Shore where the nøkk live */
const POOL = { x: AMBER_LAYOUT.ironshore.x + (AMBER.x - AMBER_LAYOUT.ironshore.x) * 0.22, z: AMBER_LAYOUT.ironshore.z + (AMBER.z - AMBER_LAYOUT.ironshore.z) * 0.22 + 6 };

export const QUESTS: Record<string, QuestDef> = {
  bell: {
    id: 'bell',
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
};
