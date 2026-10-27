import type { QuestDef } from './quests';
import { LAYOUT, BELL_TOWN } from '../world/island';
import { chamberAt } from '../world/caves';
import { toWorld } from '../world/buildings';

// Bellwether's quests at the island's new size (Tom, 2026-10-28: "improve the quests... the sealskin quest took 10
// seconds... drive a much better story. Good written English, not trying too hard"). Each one sends you across the
// island and back, through its towns, with something to fight, something to work out, and a choice or a reward that
// matters. The writing rule: say what happens, in short plain sentences.

const L = LAYOUT, F = L.forest, SP = L.saltpine, PH = L.pithead;
const hold = chamberAt('smugglers_caves', 'hold');
const chapel = BELL_TOWN.buildings.find((b) => b.id === 'gh_chapel');
/** a spot inside Gullhaven chapel (local to the building), or on the green if the chapel isn't there */
const inChapel = (lx: number, lz: number) => { const [x, z] = chapel ? toWorld(chapel, lx, lz) : [L.gullhaven.x + lx, L.gullhaven.z + lz]; return { x, z }; };
const den = { x: F.x - 52, z: F.z - 10 };

export const BELL_QUESTS: Record<string, QuestDef> = {
  selkie: {
    id: 'selkie',
    island: 'bellwether',
    name: 'The Selkie\'s Skin',
    giver: 'muirne',
    rec: 20,
    reward: 'A choice: the selkie\'s pearl ring and 1,500 Fishing XP, or a sealskin cloak and 600 coins. 800 Attack and Defence XP either way.',
    stages: [
      { text: 'Speak with the woman on the rocks at Crab Strand, west of the city.',
        talk: { npc: 'muirne', node: { lines: [
          'You can see what I am, can\'t you? Most people can\'t.',
          'I came ashore on the night of the storm to dance on the strand. I took off my sealskin to do it, the way we do. When I came back for it, it was gone.',
          'Without it I can\'t go home. There was a fisherman mending nets further up the beach that night. Dougal. Ask him.'], effect: { stage: 1 } } } },
      { text: 'Ask Dougal Penrose, the fisherman on Crab Strand, about the sealskin.',
        talk: { npc: 'dougal', node: { lines: [
          'Sealskin? What would I want with a sealskin?',
          '...All right. I took it. The old stories say if you keep a selkie\'s skin, she has to stay. I thought she might stay with me.',
          'Then I lost my nerve. And I owe money, a lot of it, to the wrong people. Tobias Wren the furrier gave me twenty coins for the skin and asked no questions.',
          'His shop is on Harbour Row, by the fish market. I\'m not proud of it.'], effect: { stage: 2 } } } },
      { text: 'Ask Tobias Wren, the furrier on Harbour Row in Bellwether, what became of the sealskin.',
        talk: { npc: 'wren', node: { lines: [
          'A sealskin, grey with silver spots? Yes. A beautiful thing. Wet, as if it had just come out of the sea, and it never dried.',
          'I don\'t have it any more. Two men came in the next morning and said Dougal owed their master money, so the skin was theirs. They had the sort of knives that end arguments.',
          'Smugglers. They work out of the cove on the south-east headland, past the Brigand Camp. If you go after it, go armed, and don\'t tell them I sent you.'], effect: { stage: 3 } } } },
      { text: 'Fight your way into Smugglers\' Cove on the south-east headland: beat three smugglers.', kill: { foe: 'smuggler', count: 3 } },
      { text: 'Search the smugglers\' camp in the cove for word of the sealskin.',
        marks: [{ id: 'ledger', label: 'The smugglers\' ledger, under a stone', verb: 'Read', region: 'bellwether', x: L.cove.x - 2, z: L.cove.z - 4,
          say: ['A ledger, in a neat hand. Most of it is brandy and tobacco. Then: "Lot 14. One sealskin, kept wet. Sold to the grey woman, for the Hushed. Collect at the new moon."',
            '"Kept in the hold, in the crate with the salt on it." The hold is in the caves under the headland.'],
          effect: { stage: 5 } }] },
      { text: 'Go down into the Smugglers\' Caves and find the sealskin in the Smugglers\' Hold. The ledger says it\'s in the crate with the salt on it.',
        marks: [
          { id: 'c_fish', label: 'A crate stamped with a fish', verb: 'Search', region: 'smugglers_caves', x: hold.x - 3, z: hold.z - 2, say: ['Salt cod, packed in straw. It smells worse than it sounds.'] },
          { id: 'c_ship', label: 'A crate stamped with a ship', verb: 'Search', region: 'smugglers_caves', x: hold.x + 3, z: hold.z - 3, say: ['Bottles of brandy, each one wrapped in a page of somebody\'s Bible.'] },
          { id: 'c_salt', label: 'A crate crusted with salt', verb: 'Search', region: 'smugglers_caves', x: hold.x, z: hold.z + 3,
            say: ['Under a layer of wet salt: a sealskin, cold and soft, still dripping. It moves a little in your hands, like something breathing.', 'Boots on the rock behind you. Someone has come down to check the goods.'],
            effect: { give: [{ id: 'sealskin', qty: 1 }], stage: 6 } },
        ] },
      { text: 'Quartermaster Slade has followed you into the hold. Beat him.', kill: { foe: 'quartermaster', count: 1, spawn: { region: 'smugglers_caves', x: hold.x + 4, z: hold.z + 4 } } },
      { text: 'You have the sealskin. Give it back to Muirne on the rocks, or to Dougal, who wants it to pay his debts.',
        talk: { npc: 'muirne', node: { requires: { id: 'sealskin', qty: 1 }, missing: ['Please. Find my skin.'], lines: [
          'My skin! The sea is still in it. I can feel it.',
          'Sold to the Hushed? They buy anything that has heard the sea a long time. They say they\'re listening for something. I don\'t want to know what.',
          'Take this: a pearl from my mother\'s mother. Fish will come to whoever wears it.',
          'If you ever hear a seal sing your name out past the reef, it will be me. Thank you.'],
          effect: { take: [{ id: 'sealskin', qty: 1 }], give: [{ id: 'ring_selkie', qty: 1 }], xp: [{ skill: 'fishing', amount: 1500 }, { skill: 'attack', amount: 800 }, { skill: 'defence', amount: 800 }], stage: 8, flag: 'selkie_freed' } } },
        also: [{ npc: 'dougal', node: { requires: { id: 'sealskin', qty: 1 }, missing: ['The smugglers have it now. I\'m not going near them.'], lines: [
          'You got it back from the smugglers? And you brought it to me, not her.',
          'I won\'t keep her against her will. Not now. But this skin would clear my debts twice over.',
          'I\'ll have half of it made into a cloak for you, and the rest pays what I owe. Fair\'s fair. She can stay on her rock.'],
          effect: { take: [{ id: 'sealskin', qty: 1 }], give: [{ id: 'cloak_selkie', qty: 1 }, { id: 'coins', qty: 600 }], xp: [{ skill: 'attack', amount: 800 }, { skill: 'defence', amount: 800 }], stage: 8, flag: 'selkie_kept' } } }] },
      { text: 'Quest complete.' },
    ],
  },

  seam: {
    id: 'seam',
    island: 'bellwether',
    name: 'The Flooded Seam',
    giver: 'agnes',
    rec: 14,
    reward: 'An iron pickaxe, 300 coins, 1,200 Mining XP, 400 Smithing XP, 300 Woodcutting XP',
    stages: [
      { text: 'Speak with Agnes Delve, the mine foreman, in her office on Copperback\'s square.',
        talk: { npc: 'agnes', node: { lines: [
          'You look like you can swing a pick. Good, because I need help, and I need it today.',
          'There was a rockfall in the deep seam three days ago. It broke open a spring, and the water came in behind it. Four of my miners are trapped below the waterline in an air pocket. We can hear them knocking.',
          'The pump at the pithead is wrecked. Wat Bellows can fix it if anyone can. The pithead is up the hill, north of town.'], effect: { stage: 1 } } } },
      { text: 'Speak with Wat Bellows, the pump-wright, at the pithead north of Copperback.',
        talk: { npc: 'wat', node: { lines: [
          'The pump\'s sound. The piston isn\'t. The rockfall cracked it in two.',
          'I can cast a new one, but I need bronze. Two bars. Smelt them at the forge on the square: copper and tin, one of each, from these hills or the Old Quarry by the city.'], effect: { stage: 2 } } } },
      { text: 'Bring Wat Bellows two bronze bars for a new pump piston.',
        talk: { npc: 'wat', node: { requires: { id: 'bar_bronze', qty: 2 }, missing: ['Two bronze bars. Copper and tin, one of each, into the furnace on the square.'], lines: [
          'That\'ll do. Give me a minute at the forge.',
          'Now, props. The shaft timbers are rotten, and I\'m not sending anyone down a shaft that might fold up. Five pine logs. There are pines all over these hills, or try the copse west of the city.'],
          effect: { take: [{ id: 'bar_bronze', qty: 2 }], stage: 3 } } } },
      { text: 'Bring Wat Bellows five pine logs for the shaft props.',
        talk: { npc: 'wat', node: { requires: { id: 'logs_pine', qty: 5 }, missing: ['Five pine logs for the props. Straight ones, if you can.'], lines: [
          'Good straight pine. Right. Now we pump.',
          'Three jobs, in this order. Prime the pump with water from the trough. Open the sluice, so the water has somewhere to go. Then work the handle.',
          'Do them out of order and you\'ll flood the square instead of the shaft.'],
          effect: { take: [{ id: 'logs_pine', qty: 5 }], xp: [{ skill: 'woodcutting', amount: 300 }], stage: 4 } } } },
      { text: 'Get the pump going at the pithead: prime it from the trough, open the sluice, then work the handle.',
        wrong: 'Water spurts everywhere and the pump loses its prime. Start again: trough, sluice, handle.',
        marks: [
          { id: 'handle', label: 'Pump handle', verb: 'Work', region: 'bellwether', x: PH.x + 3, z: PH.z - 1, seq: 3, say: ['The pump catches. The water in the shaft drops a foot, then another.', 'Then the knocking starts again. It isn\'t the miners. Small grey shapes come climbing up the timbers.'] },
          { id: 'trough', label: 'Water trough', verb: 'Prime', region: 'bellwether', x: PH.x - 3, z: PH.z + 1, seq: 1, say: ['You pour a bucket of water down the pump\'s throat. It gurgles.'] },
          { id: 'sluice', label: 'Sluice gate', verb: 'Open', region: 'bellwether', x: PH.x + 5, z: PH.z + 4, seq: 2, say: ['The gate scrapes up. The channel down the hill is clear.'] },
        ] },
      { text: 'Knockers have come up the shaft as the water drops. Beat four knockers round the pithead.', kill: { foe: 'knocker', count: 4 } },
      { text: 'Clear the rockfall at the bottom of the shaft and get the miners out.',
        marks: [{ id: 'rocks', label: 'The rockfall in the shaft', verb: 'Clear', region: 'bellwether', x: PH.x + 2, z: PH.z - 4,
          say: ['You lever the last stones away. Four miners blink at the lamplight, soaked and shivering. One is laughing. One is crying. Mostly they\'re both.',
            '"There were knockers in the dark with us," says the youngest. "They kept knocking, all night. I think they were keeping us awake. I think they kept us alive."'],
          effect: { stage: 7 } }] },
      { text: 'Tell Agnes Delve in Copperback that her miners are safe.',
        talk: { npc: 'agnes', node: { lines: [
          'All four. All four of them, walking down the hill on their own feet. I\'ve not cried since my wedding. Don\'t tell anyone.',
          'Knockers in the deep seam. Old Pellow up at Ironcrag always says they knock before a fall, to warn us. This time they came up after it. Something down there is stirring them.',
          'Take this. It\'s the best pick in Copperback, and you\'ve earned it twice over.'],
          effect: { give: [{ id: 'pickaxe_iron', qty: 1 }, { id: 'coins', qty: 300 }], xp: [{ skill: 'mining', amount: 1200 }, { skill: 'smithing', amount: 400 }], stage: 8, flag: 'seam_done' } } } },
      { text: 'Quest complete.' },
    ],
  },

  wolves: {
    id: 'wolves',
    island: 'bellwether',
    name: 'Old Greymuzzle',
    giver: 'ewan',
    rec: 16,
    reward: 'An iron hatchet, 250 coins, 900 Woodcutting XP, 600 Attack XP, 400 Defence XP',
    stages: [
      { text: 'Speak with Ewan Birch, the forester, at his lodge in Saltpine.',
        talk: { npc: 'ewan', node: { lines: [
          'Eleven sheep in a month. Wolves. We lose a few every winter, but it\'s summer, and they\'re taking them out of the pens by the houses.',
          'A big one leads them. Grey all over, even the muzzle. The children call him Old Greymuzzle.',
          'Find where the pack is coming from. Start at the sheep pen on the west side of the village: there\'s fleece on the fence.'], effect: { stage: 1 } } } },
      { text: 'Follow the wolves\' trail from the sheep pen west of Saltpine into Saltpine Wood.',
        wrong: 'You\'ve lost the trail. Go back to the fleece on the pen fence and start again.',
        marks: [
          { id: 'bones', label: 'Bones under a fallen pine', verb: 'Look', region: 'bellwether', x: F.x - 44, z: F.z - 4, seq: 3, say: ['Sheep bones, picked clean, and the smell of wolf. The den is close. Something growls in the dark under the roots.'] },
          { id: 'fleece', label: 'Torn fleece on the sheep pen fence', verb: 'Look', region: 'bellwether', x: SP.x - 15, z: SP.z + 3, seq: 1, say: ['White fleece and grey hair, caught on the same nail. Big tracks go west, into the wood.'] },
          { id: 'decoy1', label: 'Prints by a woodpile', verb: 'Look', region: 'bellwether', x: SP.x + 12, z: SP.z - 9, decoy: true, say: ['A dog\'s prints. Somebody\'s sheepdog, chasing rabbits.'] },
          { id: 'stream', label: 'Paw prints by the stream', verb: 'Look', region: 'bellwether', x: F.x - 18, z: F.z + 28, seq: 2, say: ['Big prints, bigger than any dog\'s, pressed deep in the mud. They lead north-west.'] },
          { id: 'decoy2', label: 'Scratches on a pine', verb: 'Look', region: 'bellwether', x: F.x + 12, z: F.z + 14, decoy: true, say: ['A deer, rubbing its antlers on the bark. Nothing to do with wolves.'] },
        ] },
      { text: 'The pack is at its den in the west of Saltpine Wood. Beat four grey wolves.', kill: { foe: 'grey_wolf', count: 4 } },
      { text: 'Old Greymuzzle has come out of the den. Beat him.', kill: { foe: 'greymuzzle', count: 1, spawn: { region: 'bellwether', x: den.x, z: den.z } } },
      { text: 'Tell Ewan Birch in Saltpine that Old Greymuzzle is dead.',
        talk: { npc: 'ewan', node: { lines: [
          'Greymuzzle? You\'re sure? Well. He was old. Older than any wolf has a right to be.',
          'Gorse the tanner says the wolves only came this close because something in the deep wood frightened them out. I don\'t know what frightens a wolf. I don\'t think I want to.',
          'Here: your pay, and a hatchet with a proper edge. Saltpine owes you.'],
          effect: { give: [{ id: 'hatchet_iron', qty: 1 }, { id: 'coins', qty: 250 }], xp: [{ skill: 'woodcutting', amount: 900 }, { skill: 'attack', amount: 600 }, { skill: 'defence', amount: 400 }], stage: 5, flag: 'wolves_done' } } } },
      { text: 'Quest complete.' },
    ],
  },

  bucca: {
    id: 'bucca',
    island: 'bellwether',
    name: 'The Bucca\'s Share',
    giver: 'elspeth',
    rec: 10,
    reward: '400 coins, 1,500 Fishing XP, 500 Cooking XP, 400 Strength XP',
    stages: [
      { text: 'Speak with Elspeth Gray, the headwoman of Gullhaven, on the north shore.',
        talk: { npc: 'elspeth', node: { lines: [
          'Three boats lost since spring, and the nets come up torn every morning. The fish are still out there. Something won\'t let us have them.',
          'Old Jowan says it\'s the bucca, a spirit of the sea. He says we stopped paying it. I don\'t believe in sea spirits. I don\'t believe in losing boats either.',
          'Go and talk to him. His house is on the green.'], effect: { stage: 1 } } } },
      { text: 'Speak with Old Jowan at his house on Gullhaven\'s green.',
        talk: { npc: 'jowan', node: { lines: [
          'When I was a boy, every boat that came in left one fish on the Bucca Stone, out on the point. The bucca\'s share. The sea gave us the rest.',
          'Then they built the chapel, and the priest said it was heathen nonsense, and we stopped. The stone\'s still out there.',
          'Catch five sprats and leave them on the stone. Raw. The bucca isn\'t fussy about cooking.'], effect: { stage: 2 } } } },
      { text: 'Leave five raw sprats on the Bucca Stone, on the point by Gullhaven.',
        marks: [{ id: 'stone', label: 'The Bucca Stone', verb: 'Leave the fish', region: 'bellwether', x: L.bucca.x, z: L.bucca.z,
          requires: { id: 'fish_sprat_raw', qty: 5 }, missing: ['The stone is bare and wet. Jowan said five raw sprats.'],
          say: ['You lay the sprats on the stone. For a long moment nothing happens. Then the water round the point goes dark, and a voice like waves on shingle says: "Late. Very late."',
            '"Your chapel was built with my stone. Three pieces of it, from this point, are in the chapel wall. Bring them back, and we can talk about fish."',
            '"Start with the one by the door. They put that one in last."'],
          effect: { take: [{ id: 'fish_sprat_raw', qty: 5 }], stage: 3 } }] },
      { text: 'Take the bucca\'s three stones out of Gullhaven chapel\'s wall: the one by the door first, then under the window, then behind the altar.',
        wrong: 'The stone won\'t come loose. The bucca said to start with the one by the door.',
        marks: [
          { id: 's_altar', label: 'A sea-worn stone behind the altar', verb: 'Prise out', region: 'bellwether', ...inChapel(0.8, -3.9), seq: 3, say: ['The last stone comes out of the wall. All three are cold and wet, as if they had just come out of the sea.'] },
          { id: 's_door', label: 'A sea-worn stone by the door', verb: 'Prise out', region: 'bellwether', ...inChapel(2.4, 3.6), seq: 1, say: ['The stone comes away easily. It\'s wet, though the wall is dry.'] },
          { id: 's_window', label: 'A sea-worn stone under the window', verb: 'Prise out', region: 'bellwether', ...inChapel(-2.4, 0), seq: 2, say: ['Barnacles on the back of it. This stone has been under the sea.'] },
        ] },
      { text: 'Put the three stones back on the Bucca Stone, on the point.',
        marks: [{ id: 'back', label: 'The Bucca Stone', verb: 'Put the stones back', region: 'bellwether', x: L.bucca.x, z: L.bucca.z,
          say: ['You set the three stones round the base of the Bucca Stone. The sea goes very quiet.', '"Good," says the voice. "Now, one more thing. The crabs on this shore have been cutting your nets for me. Tell them I\'ve changed my mind."'],
          effect: { stage: 5 } }] },
      { text: 'Rock crabs are cutting Gullhaven\'s nets. Beat four on the north shore.', kill: { foe: 'rock_crab', count: 4 } },
      { text: 'Tell Elspeth Gray in Gullhaven that the bucca is satisfied.',
        talk: { npc: 'elspeth', node: { lines: [
          'The nets came up whole this morning. Full, too. I don\'t know what you did on that point, and I don\'t want the priest to know either.',
          'Jowan\'s already told the whole village. We\'ll leave the bucca its fish from now on. It\'s cheaper than boats.',
          'Take this, from all of us.'],
          effect: { give: [{ id: 'coins', qty: 400 }], xp: [{ skill: 'fishing', amount: 1500 }, { skill: 'cooking', amount: 500 }, { skill: 'strength', amount: 400 }], stage: 7, flag: 'bucca_done' } } } },
      { text: 'Quest complete. Gullhaven leaves the bucca its share again.' },
    ],
  },
};
