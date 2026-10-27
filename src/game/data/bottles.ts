// Messages in bottles (docs/STORY.md: leave gaps; people have lives you only see the edge of). Out of harbour, now and
// then a bottle bobs past your bow. Sail over it and it comes aboard. Each holds one note from somebody on this sea:
// some funny, some not, a few that make other stories make sense. Once you've read them all the sea keeps sending
// bottles, with treasure maps and charms in them instead.

export interface BottleNote { id: string; title: string; lines: string[] }

export const BOTTLES: BottleNote[] = [
  { id: 'kwesi', title: 'A note in a harbour boy\'s hand', lines: [
    '"To whoever finds this. I am Kwesi, apprentice harbourmaster of Port Halyard, and I am writing this aboard the ship of the Red Ransom, who has taken me hostage."',
    '"The food is very good. Please do not tell Sefa."'] },
  { id: 'tam', title: 'A child\'s note, the paper scorched at one corner', lines: [
    '"Ash. I\'m on the ship. I hid in the sail locker with the biscuits. Don\'t be cross."',
    '"I want to see the flare you\'re lighting. You said it would be the biggest one ever. — Tam"',
    'The bottle is old. The cork has been pushed in from the outside, and pushed back, many times.'] },
  { id: 'violet', title: 'A note in a purple bottle, the glass gone violet with age', lines: [
    '"Corran. If you\'re reading this, you didn\'t turn it. Good. Come home. — V."',
    'There\'s no way to know which of them threw it, or when. The wax on the cork is stamped with a ship\'s keel.'] },
  { id: 'keyhole_fish', title: 'A fisherman\'s complaint', lines: [
    '"Caught a fish today with a keyhole where its eye should be. Threw it back."',
    '"My wife says I should have kept it. My wife has never looked a fish in the keyhole."'] },
  { id: 'customs', title: 'A Tollhouse receipt', lines: [
    '"Received of the sea, one bottle, empty. Toll due on bottles: one bottle. Paid in full."',
    '"Tollhouse Customs. Everything that leaves Amberhold pays."',
    'It\'s been stamped twice.'] },
  { id: 'lighthouse', title: 'A lighthouse keeper\'s log, one page', lines: [
    '"Thirteen nights now the light has gone out at the turn of the tide. Each time I climb up to relight it, there\'s salt water in the lamp oil."',
    '"I live alone. The door at the foot of the tower is locked. I have the only key."',
    '"Tonight I am going to sit up in the lamp room and wait."',
    'There are no more pages.'] },
  { id: 'ingrid', title: 'An apology', lines: [
    '"Ingrid. I am sorry about the fiddle. I did not know it would break if you sat on it. I did not know you would sit on it. I did not know a great many things that night."',
    '"I will buy you a new one when I come back from the Wrack with a saga. — H."'] },
  { id: 'marta', title: 'A price list from Bellwether', lines: [
    '"Marta Gell, Harbour Trader. Prices this week:"',
    '"Hatchets, fair. Fish, fair. Rope, very fair. Questions, double. Questions about where I got the rope, treble."'] },
  { id: 'line', title: 'A note on Wardwright paper, the ink gone brown', lines: [
    '"Master. I\'ve sunk the brass net where you told me, off the strand, at low water."',
    '"The keys are still coming back. I found three on the beach this morning, all the ones we cut for the fishers. One of them was warm."',
    '"I\'m frightened to go down to the water now. — O., apprentice, House of the Line"'] },
  { id: 'barrow', title: 'A note in runes, with a translation pencilled under', lines: [
    '"To my son. The barrow is warm, the mead is good, and your mother\'s here. Do not come and fetch me."',
    '"I am serious, Ottar. If you dig me up again I will follow you home."',
    '"— your father (deceased)"'] },
  { id: 'ring', title: 'A page with a wet ring on it', lines: [
    'It\'s blank, except for a water stain in the middle: a ring the size of a coin, with a notch at the bottom. A keyhole.',
    'On the back, in a child\'s round letters, very small: "we hear you too"'] },
  { id: 'gull', title: 'Soundings in a fine hand', lines: [
    '"Mirewater channel, at the slack. Four fathoms. Four. Five. Three. Nought."',
    '"Nought is not possible in a channel I can see the bottom of. Sounded it again. Nought. Lowered thirty fathoms of line. Nought."',
    '"There is a hole in the sea where the Fen meets it. I\'m going to tell Iven. He won\'t believe me. — B. G."'] },
  { id: 'pepperpot', title: 'A ship\'s cook\'s recipe', lines: [
    '"Pepperpot. Boar, bramble, salt, and patience. If it isn\'t black, it isn\'t done."',
    '"If it\'s black and you\'re not frightened of it, it still isn\'t done."',
    '"— Cook, the Dear Hostage. Tell the captain I want my good knife back."'] },
  { id: 'ashore', title: 'A line from somebody\'s logbook', lines: [
    '"Put him ashore on a sandbar with a pistol and one shot. Captain says he\'ll be back."',
    '"Captain says that about everybody. Captain\'s usually right."'] },
  { id: 'brine', title: 'A list in big, careful letters', lines: [
    '"THINGS TO DO. 1. Wax for Sela again. 2. Tell Pip he is not to climb the mainmast. 3. Tell Pip he is not to climb the foremast. 4. Find Pip."',
    '"5. Nine goats for the Ransom girl. (Ask her what she wants nine goats for. Don\'t ask her.)"'] },
  { id: 'undertow', title: 'An unsigned note on grey paper', lines: [
    '"If you\'re reading this, the Undertow passed close to you tonight and you didn\'t see her."',
    '"Count your crew."'] },
];
export const BOTTLE_BY = Object.fromEntries(BOTTLES.map((b) => [b.id, b]));

export const BOTTLE_CONFIG = {
  /** seconds of open-water sailing between bottles, how long one floats before it sinks, and how near it must be */
  every: [100, 200] as [number, number],
  floats: 90,
  reach: 3.2,
  /** how far ahead of the bow it turns up */
  ahead: [16, 26] as [number, number],
};
