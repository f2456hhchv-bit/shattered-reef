import type { SkillId } from './items';
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
  ferry?: { to: 'bellwether' | 'sunreach'; price: number }; // offers passage to another harbour
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
  wynn: { id: 'wynn', name: 'Wynn Harrow', title: 'Harbourmaster', ferry: { to: 'sunreach', price: 30 },
    idle: ['Sunreach lies east across the channel: jungle, a hill full of ore, and Port Halyard on its south shore. Sail yourself, or I\'ll take you for thirty coins.'] },
  sefa: { id: 'sefa', name: 'Sefa Odun', title: 'Harbourmaster of Port Halyard', ferry: { to: 'bellwether', price: 30 },
    idle: ['Bellwether\'s a day\'s sail west, or an hour on my cutter. Thirty coins.'] },
  tamsin: { id: 'tamsin', name: 'Tamsin Vey', title: 'Trader', shop: true,
    idle: ['Steel, spice, and arrows that fly straight. Everything a Bellwether captain forgets to pack.'] },
  rell: { id: 'rell', name: 'Bosun Rell', title: 'Keeper of the Gilded Anchor', shop: true,
    idle: ['Sit. Eat. The jungle will still be there, and so will the things in it.'] },
  ines: { id: 'ines', name: 'Ines Carro', title: 'Banker', bank: true,
    idle: ['Ada keeps the books in Bellwether, I keep them here. Same ledger: what you leave with one, you take from the other.'] },
  halyard_watch: { id: 'halyard_watch', name: 'Watchman Okoro', title: 'Port watch',
    idle: ['North through the plaza is the Greenheart. Hunters in there shoot first. East, Ember Hill: coal and gold, if you can swing a pick.', 'The old temple in the jungle? Nobody goes in. Something still keeps it.'] },
  watch_n: { id: 'watch_n', name: 'Watchman Pell', title: 'Town watch', idle: ['North road runs to the Copperback Hills and the foot of Ironcrag. Mind the crabs in iron shells.'] },
  watch_e: { id: 'watch_e', name: 'Watchwoman Dory', title: 'Town watch', idle: ['East road\'s brigand country. Past their camp, the smugglers keep the cove. Go armed.'] },
};

export interface QuestStage { text: string; talk?: { npc: string; node: DialogueNode } }

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
};
