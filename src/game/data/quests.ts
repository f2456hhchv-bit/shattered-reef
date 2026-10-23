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
  look: 'cartographer' | 'shopkeeper' | 'smith';
  idle: string[];
  shop?: boolean;
}

export const NPCS: Record<string, NpcDef> = {
  iven: { id: 'iven', name: 'Iven Marr', title: 'Cartographer', look: 'cartographer', idle: ['The sea has a second map, captain. I mean to finish it.'] },
  marta: { id: 'marta', name: 'Marta Gell', title: 'Harbour trader', look: 'shopkeeper', idle: ['Buying, selling, and asking no questions.'], shop: true },
  bram: { id: 'bram', name: 'Bram Tollis', title: 'Smith', look: 'smith',
    idle: ['Furnace takes copper and tin, one of each, makes a bronze bar.', 'Bring bars to the anvil. Better smiths turn out better blades. Some come out Fine, now and then Rare.'] },
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
