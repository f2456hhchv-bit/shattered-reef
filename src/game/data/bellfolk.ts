import type { NpcDef } from './quests';

// The people of Bellwether city and its four towns (the island at 4.5x, 2026-10-28). Plain words: who they are, what
// they do, what they'd say to a stranger. Quest lines live with the quests.

export const BELL_FOLK: Record<string, NpcDef> = {
  // ---- Bellwether city
  brannock: { id: 'brannock', name: 'Inspector Brannock', title: 'Customs officer', idle: [
    'Every cask that lands on this quay pays duty. Every cask that lands somewhere else is the smugglers\' business, and mine.',
    'Half the brandy in the Drowned Bell never paid a penny. Hob knows I know. We get on fine.'] },
  wren: { id: 'wren', name: 'Tobias Wren', title: 'Furrier', idle: [
    'Hides, pelts, furs. Boar, wolf, seal. Bring me good leather and I\'ll make you something warm.',
    'I don\'t ask where a skin comes from. That\'s the trade.'] },
  nell: { id: 'nell', name: 'Nell Marlow', title: 'Fishmonger', shop: true, idle: [
    'Fresh this morning. Well, this week. Smell it, go on.',
    'I pay fair for a good catch. Better than Silas, if you catch me before lunch.'] },
  harlan: { id: 'harlan', name: 'Harlan Crewe', title: 'Shipwright', idle: [
    'Every hull in this harbour came off my slip or my father\'s. The sloop you came in on? Mine. Look after her.',
    'Oak for the keel, pine for the planks, and never trust a mast that\'s been struck by lightning.'] },
  bracken: { id: 'bracken', name: 'Hal Bracken', title: 'Weaponsmith', shop: true, idle: [
    'Bronze for a beginner, iron when you can afford it. Steel you\'ll have to sail for.',
    'Hold it like you mean it. A sword held loosely gets taken off you.'] },
  sabine: { id: 'sabine', name: 'Sabine Holt', title: 'Armourer', shop: true, idle: [
    'A helmet costs less than a funeral. Most people only learn that once.',
    'Leather if you need to move, iron if you need to stand. Pick one.'] },
  thrift: { id: 'thrift', name: 'Mother Thrift', title: 'Apothecary', heals: 'Sit down. Drink this. Don\'t make that face. There: better than new.', idle: [
    'Willow bark for pain, salt for wounds, and a hot meal for nearly everything else.',
    'If you come in bleeding, I\'ll patch you up. If you come in bleeding twice in a day, I\'ll want to know why.'] },
  rook: { id: 'rook', name: 'Captain Rook', title: 'Captain of the city watch', idle: [
    'Bellwether\'s grown faster than the watch has. Twelve of us for a whole city, and the roads besides.',
    'Footpads on the north road, wolves in Saltpine Wood, and the brigands east. If you\'re going out, go armed.',
    'Smugglers\' Cove? We don\'t go there. That\'s not a rule. It\'s advice.'] },
  linnet: { id: 'linnet', name: 'Linnet Shaw', title: 'Keeper of the Reading Room', idle: [
    'Every book on these shelves was salvaged from somewhere. The sea is a terrible librarian.',
    'The oldest chart we have shows Bellwether as part of something much bigger. The land just stops at the edge of the page, as if it broke off.',
    'Iven Marr comes in to argue with my maps. He\'s usually right, which is worse.'] },
  tam: { id: 'tam', name: 'Tam Fairweather', title: 'Landlord of the Gull and Anchor', shop: true, idle: [
    'The Drowned Bell is for captains. The Gull and Anchor is for the crews. You\'re welcome in either.',
    'Pies on the left, ale on the right, fights outside.'] },
  bess: { id: 'bess', name: 'Bess Rowan', title: 'Baker', shop: true, idle: [
    'Up at four every morning. The ovens don\'t light themselves.',
    'Bread keeps you going, pie keeps you happy. I sell both.'] },
  // ---- Copperback
  agnes: { id: 'agnes', name: 'Agnes Delve', title: 'Mine foreman of Copperback', idle: [
    'Copperback\'s been digging these hills for a hundred years. The copper\'s nearly out. The tin never ends.',
    'If you\'ve a pick and a strong back, there\'s always work here.'] },
  wat: { id: 'wat', name: 'Wat Bellows', title: 'Pump-wright', idle: [
    'A mine is a hole that wants to be a well. My job is to disagree with it.',
    'Pumps, pipes and sluices. If it holds water or moves it, I\'ve fixed it.'] },
  rudd: { id: 'rudd', name: 'Rudd Coyle', title: 'Mining supplier', shop: true, idle: [
    'Picks, from a chipped one up to iron. And I buy ore, if you\'re too tired to carry it to the city.'] },
  penn: { id: 'penn', name: 'Assayer Penn', title: 'Copperback Assay Office', bank: true, idle: [
    'I weigh the ore and keep the books. Ada Quill in the city keeps the same ledger, so your strongbox is here too.'] },
  molly: { id: 'molly', name: 'Molly Brewer', title: 'Landlady of the Pick and Lantern', shop: true, idle: [
    'Miners eat like horses and drink like fish. I keep the kitchen busy.'] },
  // ---- Saltpine
  ewan: { id: 'ewan', name: 'Ewan Birch', title: 'Forester of Saltpine', idle: [
    'Saltpine Wood grows faster than we can cut it. That used to be the only problem.',
    'Mind the wolves in the west of the wood. They\'ve got bolder this year.'] },
  tilda: { id: 'tilda', name: 'Tilda Sawyer', title: 'Owner of Saltpine Sawmill', shop: true, idle: [
    'Hatchets to sell, logs to buy. Pine pays the wages, oak pays for the roof.'] },
  gorse: { id: 'gorse', name: 'Gorse', title: 'Tanner', idle: [
    'Yes, it smells. That\'s how you know it\'s working.',
    'Bring me hides and I\'ll turn them into leather. Wolf pelts, boar hides, it\'s all the same to the vat.'] },
  // ---- Mirewater
  reedy: { id: 'reedy', name: 'Nan Reedy', title: 'Wise woman of Mirewater', heals: 'Hold still. Moss and honey, and a word I won\'t tell you. You\'ll do.', idle: [
    'The Fen\'s been here longer than any of us, and it\'ll be here after. Treat it with respect.',
    'Don\'t swim in the lagoon. I don\'t care how hot it is.'] },
  tad: { id: 'tad', name: 'Tad Eeling', title: 'Eel-fisher', idle: [
    'Eels in the morning, eels at night. Smoked, jellied, in a pie. You get used to it.',
    'The water\'s gone a bit salty lately. The eels don\'t like it. Neither do I.'] },
  // ---- Gullhaven
  elspeth: { id: 'elspeth', name: 'Elspeth Gray', title: 'Headwoman of Gullhaven', idle: [
    'Thirty boats in Gullhaven when I was a girl. Eleven now. The young ones go to the city.',
    'The north shore is hard living. The fish are good, though. Best on the island.'] },
  jowan: { id: 'jowan', name: 'Old Jowan', title: 'Retired fisherman', idle: [
    'Sixty years on the water. I\'ve seen things out there I wouldn\'t tell the chapel about.',
    'In my day we looked after the sea, and the sea looked after us.'] },
  kit: { id: 'kit', name: 'Kit Morrow', title: 'Fish and tackle', shop: true, idle: [
    'Rods, pots and bait. And I\'ll buy your catch, if Nell in the city hasn\'t already.'] },
};
