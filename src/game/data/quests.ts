import type { SkillId } from './items';
import { LAYOUT, SUN_LAYOUT, coastPoint } from '../world/island';
// NPCs and the first quest, as data. Dialogue is chosen by quest stage; effects are interpreted by the quest system.

export interface Effect {
  give?: { id: string; qty: number }[];
  take?: { id: string; qty: number }[];
  xp?: { skill: SkillId; amount: number }[];
  stage?: number;
  flag?: string;
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

export interface QuestDef { id: string; name: string; giver: string; stages: QuestStage[]; reward: string }

export const QUESTS: Record<string, QuestDef> = {
  bell: {
    id: 'bell',
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
};
