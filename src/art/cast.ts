import type { HumanoidLook } from './models/character';

// Who wears what: the outfits of the player, the villagers and every human foe. Shared by the 3D view
// and the UI (dialogue portraits).

export const NPC_LOOKS: Record<string, HumanoidLook> = {
  iven: { skin: 'skin', coat: 0x55603f, coatTrim: 'brass', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 0x3a3a34, hair: 0x9a9a92, hatStyle: 'cap', spectacles: true },
  marta: { skin: 0xc98f66, coat: 0x7a3b3b, coatTrim: 0xd8c7a8, shirt: 'shirt', trousers: 0x4a3a30, boots: 'leather', hat: 0x2c2420, hair: 0x2c2420, hatStyle: 'none', beard: false, apron: 0xe6dcc0 },
  bram: { skin: 0xd09a70, coat: 0x4a4038, coatTrim: 'iron', shirt: 0xb5a58a, trousers: 0x3a3028, boots: 'leather', hat: 0x2c2420, hair: 0x5a3a22, hatStyle: 'none', apron: 0x5a3a26, held: 'hammer' },
  silas: { skin: 0xb98058, coat: 0x2f6a8a, coatTrim: 0xd8c7a8, shirt: 0xd8ccb0, trousers: 0x3a3428, boots: 0x2a2420, hat: 0xc9a050, hair: 0x8a8a82, hatStyle: 'cap', beard: true },
  hob: { skin: 0xd8a07a, coat: 0x8a5a2a, coatTrim: 0x3a2a1a, shirt: 0xeee4cc, trousers: 0x3a3028, boots: 'leather', hat: 0x2c2420, hair: 0x6a3a1a, hatStyle: 'none', beard: true, apron: 0xe6dcc0 },
  ada: { skin: 0xc48c62, coat: 0x2f3a5a, coatTrim: 'brass', shirt: 0xf0e8d8, trousers: 0x22222a, boots: 0x1a1a1e, hat: 0x2a1a12, hair: 0x2a1a12, hatStyle: 'none', hairStyle: 'bun', spectacles: true, beard: false },
  maren: { skin: 0xe0b08a, coat: 0xe8e0d0, coatTrim: 0x2f5a6a, shirt: 0xe8e0d0, trousers: 0xd8d0c0, boots: 0x6a5a4a, hat: 0x2f5a6a, hair: 0xb8b0a0, hatStyle: 'bandana', hairStyle: 'bun', beard: false },
  corwin: { skin: 0xd09a70, coat: 0x4a2a3a, coatTrim: 'brass', shirt: 0xeee4cc, trousers: 0x2a2228, boots: 'leather', hat: 0x1a1414, hair: 0xb8b0a0, hatStyle: 'tricorn', beard: true },
  wynn: { skin: 0xa8704a, coat: 0x23364a, coatTrim: 'brass', shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x23364a, hair: 0x1a1210, hatStyle: 'cap', hairStyle: 'queue' },
  watch_n: { skin: 0xc8946a, coat: 0x6a2a24, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 0x1e1a18, hat: 0x1a1414, hair: 0x4a2a18, hatStyle: 'tricorn', held: 'musket' },
  watch_e: { skin: 0x9a6a48, coat: 0x6a2a24, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 0x1e1a18, hat: 0x1a1414, hair: 0x1a1210, hatStyle: 'tricorn', hairStyle: 'queue', held: 'musket' },
  sefa: { skin: 0x7a4a2c, coat: 0x2f5a6a, coatTrim: 'brass', shirt: 0xeee4cc, trousers: 0x2e2a26, boots: 'leather', hat: 0xe8dcc0, hair: 0x1a1210, hatStyle: 'cap', beard: true },
  tamsin: { skin: 0xb98058, coat: 0xb8862a, coatTrim: 0x5a3a20, shirt: 0xf0e8d8, trousers: 0x4a3a30, boots: 'leather', hat: 0x2a1a12, hair: 0x2a1a12, hatStyle: 'bandana', hairStyle: 'bun', beard: false },
  rell: { skin: 0x8a5a3a, coat: 0x6a3a2a, coatTrim: 0xc9a050, shirt: 0xeee4cc, trousers: 0x2e2a26, boots: 'leather', hat: 0x1a1414, hair: 0x2a2420, hatStyle: 'none', beard: true, apron: 0xe6dcc0 },
  ines: { skin: 0x9a6a48, coat: 0x2f3a5a, coatTrim: 'brass', shirt: 0xf0e8d8, trousers: 0x22222a, boots: 0x1a1a1e, hat: 0x1a1210, hair: 0x1a1210, hatStyle: 'none', hairStyle: 'bun', beard: false, spectacles: true },
  mercy: { skin: 0xc8946a, coat: 0x3a3e44, coatTrim: 0x8a8a82, shirt: 0xd8d4c8, trousers: 0x26282c, boots: 'leather', hat: 0x1e2226, hair: 0x9a9a92, hatStyle: 'tricorn', hairStyle: 'queue', beard: false },
  jory: { skin: 0xb07a52, coat: 0x6a4a22, coatTrim: 'brass', shirt: 0xeee4cc, trousers: 0x3a3028, boots: 'leather', hat: 0x3a2a1a, hair: 0x5a3a1a, hatStyle: 'cap', beard: true },
  pellow: { skin: 0xc8946a, coat: 0x5a4a36, coatTrim: 0x3a2e22, shirt: 0x8a7a60, trousers: 0x3a3028, boots: 'leather', hat: 0xc9a050, hair: 0xd8d0c0, hatStyle: 'cap', beard: true, held: 'hammer' },
  muirne: { skin: 0xe8d8c8, coat: 0x5a6068, coatTrim: 0x8a9298, shirt: 0xc8ccd0, trousers: 0x4a5058, boots: 0x3a3e42, hat: 0x1a1a1e, hair: 0x1a1a1e, hatStyle: 'none', hairStyle: 'bun', beard: false, eyes: 0x2a2a2e },
  // Amberhold's quest folk (slice 3)
  sigrun: { skin: 0xe8c8a8, coat: 0x4a5a7a, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x3a3a4a, boots: 0x3a2a20, hat: 0xd8b880, hair: 0xd8b880, hatStyle: 'none', hairStyle: 'queue', beard: false },
  ingrid: { skin: 0xf0d0b0, coat: 0x8a2a2a, coatTrim: 0xe8dcc0, shirt: 0xe8dcc0, trousers: 0x3a2a2a, boots: 0x3a2a20, hat: 0xa86a3a, hair: 0xa86a3a, hatStyle: 'none', hairStyle: 'bun', beard: false },
  halvard: { skin: 0xd8a888, coat: 0x2a3a5a, coatTrim: 0xc9a050, shirt: 0xe8dcc0, trousers: 0x2a2a30, boots: 'leather', hat: 0x1a1a1a, hair: 0x8a6a4a, hatStyle: 'tricorn', beard: true },
  ulla: { skin: 0xc8946a, coat: 0x445228, coatTrim: 0x7a5a30, shirt: 0x9a8a62, trousers: 0x3a3424, boots: 'leather', hat: 0x5a4024, hair: 0xb8402a, hatStyle: 'none', hairStyle: 'queue', beard: false, held: 'longbow' },
  brita: { skin: 0xf0d0b0, coat: 0x6a3a2a, coatTrim: 0xe8c86a, shirt: 0xe8dcc0, trousers: 0x3a2a24, boots: 'leather', hat: 0xe8c86a, hair: 0xe8c86a, hatStyle: 'none', hairStyle: 'queue', beard: false, apron: 0xd8cfb8 },
  edda: { skin: 0xe0b896, coat: 0x2a3a5a, coatTrim: 0xc8d0d8, shirt: 0xd8ccb0, trousers: 0x2a2a34, boots: 0x2a2420, hat: 0x2a3a5a, hair: 0x8a5a2a, hatStyle: 'none', hairStyle: 'bun', beard: false },
  eir: { skin: 0xf0d0b0, coat: 0x6a7a5a, coatTrim: 0xe8dcc0, shirt: 0xe8dcc0, trousers: 0x3a3a30, boots: 0x3a2a20, hat: 0xe8dcc0, hair: 0xd8c07a, hatStyle: 'bandana', hairStyle: 'queue', beard: false, apron: 0xe8dcc0 },
  gull: { skin: 0xe8d0b8, coat: 0xe8e4d8, coatTrim: 0x8a9aa8, shirt: 0xd8d4c8, trousers: 0x3a4048, boots: 0x2a2a2e, hat: 0xe8e4d8, hair: 0xb8b8b0, hatStyle: 'tricorn', beard: false, held: 'pistol' },
  brine: { skin: 0xb88a62, coat: 0x3a5a5a, coatTrim: 0xc8d0c0, shirt: 0xd8ccb0, trousers: 0x2a3030, boots: 0x2a2a28, hat: 0x5a3a2a, hair: 0xb8b0a8, hatStyle: 'bandana', hairStyle: 'bun', beard: false, apron: 0x8a7a5a },
  ninefold: { skin: 0xd8b090, coat: 0x6a6a6a, coatTrim: 0x8a2a1a, shirt: 0x4a3a2a, trousers: 0x3a3028, boots: 0x3a2a1a, hat: 0x6a6a6a, hair: 0xc89a5a, hatStyle: 'cap', beard: true, held: 'greatsword' },
  // Ash Tolliver: burn-scarred hands, a gunner's coat too big for him, red hair he keeps cutting short
  ash: { skin: 0xc8a080, coat: 0x3a2e28, coatTrim: 0x8a5a2a, shirt: 0xb8a890, trousers: 0x2a2420, boots: 0x2a1a14, hat: 0x2a2420, hair: 0x8a3a1a, hatStyle: 'none', hairStyle: 'short', beard: false, held: 'pistol' },
  marisol: { skin: 0x7a4a30, coat: 0xa82a22, coatTrim: 0xd8b84a, shirt: 0xe8dcc0, trousers: 0x2a2220, boots: 0x2a1a14, hat: 0x2a1a14, hair: 0x1a1210, hatStyle: 'tricorn', hairStyle: 'queue', beard: false, held: 'cutlass' },
  osric: { skin: 0xb88a62, coat: 0x2a3a3a, coatTrim: 0x8a9a9a, shirt: 0x9a9a8a, trousers: 0x22201e, boots: 'leather', hat: 0x2a2a2a, hair: 0x6a6a62, hatStyle: 'cap', beard: true },
  // Sunreach's quest folk (slice 2)
  abena: { skin: 0x6a4630, coat: 0xd8a03a, coatTrim: 0x2a7a5a, shirt: 0xe8dcc0, trousers: 0x2a7a5a, boots: 0x4a3424, hat: 0xd84a2a, hair: 0x1a1210, hatStyle: 'bandana', hairStyle: 'bun', beard: false, apron: 0xe8dcc0 },
  nana_ayo: { skin: 0x5a3a28, coat: 0x6a3a5a, coatTrim: 0xd8b84a, shirt: 0xe8dcc0, trousers: 0x3a2a3a, boots: 0x3a2a20, hat: 0xe8dcc0, hair: 0xd8d0c0, hatStyle: 'bandana', hairStyle: 'bun', beard: false, spectacles: true },
  ama: { skin: 0x5a3a28, coat: 0x8a4a22, coatTrim: 0xd8b84a, shirt: 0xe8dcc0, trousers: 0x3a3a2a, boots: 0x3a2a20, hat: 0x2a7a5a, hair: 0x1a1210, hatStyle: 'bandana', hairStyle: 'bun', beard: false, held: 'hammer' },
  dougal: { skin: 0xc8946a, coat: 0x3a4a5a, coatTrim: 0xd8ccb0, shirt: 0xd8ccb0, trousers: 0x3a3428, boots: 'leather', hat: 0x8a6a3a, hair: 0x8a5a2a, hatStyle: 'cap', beard: true, apron: 0xb8a888 },
  halyard_watch: { skin: 0x6a4028, coat: 0x2f6a4a, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 0x1e1a18, hat: 0x2f6a4a, hair: 0x1a1210, hatStyle: 'tricorn', held: 'musket' },
};
/** Townsfolk who walk Bellwether's streets (no dialogue: they're busy). */
export const TOWNS_LOOKS: Record<string, HumanoidLook> = {
  towns_a: { skin: 0xd8a07a, coat: 0x5a6a3a, coatTrim: 0xd8c7a8, shirt: 0xeee4cc, trousers: 0x4a3a30, boots: 'leather', hat: 0x8a5a2a, hair: 0x8a5a2a, hatStyle: 'none', hairStyle: 'bun', apron: 0xd8cfb8, beard: false },
  towns_b: { skin: 0xb98058, coat: 0x3a4a6a, coatTrim: 0xb8b0a0, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x5a4024, hair: 0x2a1a12, hatStyle: 'cap' },
  towns_c: { skin: 0xe0b08a, coat: 0x8a3a5a, coatTrim: 0xe6dcc0, shirt: 0xf0e8d8, trousers: 0x3a3028, boots: 0x3a2a20, hat: 0xc9a050, hair: 0xc9a050, hatStyle: 'none', hairStyle: 'queue', beard: false },
  towns_d: { skin: 0xa8704a, coat: 0x6a5a40, coatTrim: 0x3a2a1a, shirt: 0xb5a58a, trousers: 0x3a3a30, boots: 'leather', hat: 0x9a2a1e, hair: 0x1a1210, hatStyle: 'bandana', beard: true },
  towns_e: { skin: 0xc98f66, coat: 0x4a4038, coatTrim: 0xc9a050, shirt: 0xe8dcc0, trousers: 0x2a2228, boots: 0x2a2420, hat: 0x3a3a34, hair: 0x9a9a92, hatStyle: 'none', spectacles: true },
};
export const PLAYER_LOOK: HumanoidLook = { skin: 'skin', coat: 'coat', coatTrim: 'coatTrim', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 'hat', hair: 'hair', held: 'cutlass' };
export const BRIGAND_LOOK: HumanoidLook = { skin: 0xc48c62, coat: 0x4a2f24, coatTrim: 0x8a2e22, shirt: 0xb5a58a, trousers: 0x3a3a30, boots: 'leather', hat: 0x9a2a1e, hair: 0x2a1a12, hatStyle: 'bandana', held: 'cutlass' };
export const GUNNER_LOOK: HumanoidLook = { ...BRIGAND_LOOK, coat: 0x2f3a2e, hat: 0x2a2a2a, held: 'musket' };
const DROWNED_SKIN = 0x86a49a;
/** Outfits per enemy look; gunner-type enemies get a musket automatically. */
export const HUMAN_LOOKS: Record<string, HumanoidLook> = {
  brigand: BRIGAND_LOOK,
  gunner: GUNNER_LOOK,
  hunter: { skin: 0xb88a62, coat: 0x2a2420, coatTrim: 0xc9a050, shirt: 0x8a2e22, trousers: 0x1e1c1a, boots: 'leather', hat: 0x2a2420, hair: 0x2a1a12, hatStyle: 'tricorn', held: 'cutlass' },
  smuggler: { skin: 0xc8946a, coat: 0x23364a, coatTrim: 0xb8b0a0, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x161616, hair: 0x2a1a12, hatStyle: 'tricorn', held: 'cutlass' },
  poacher: { skin: 0xb98058, coat: 0x445228, coatTrim: 0x7a5a30, shirt: 0x9a8a62, trousers: 0x3a3424, boots: 'leather', hat: 0x5a4024, hair: 0x6a4a2a, hatStyle: 'cap', held: 'cutlass' },
  drowned: { skin: DROWNED_SKIN, coat: 0x2c3b3a, coatTrim: 0x5a6a5a, shirt: 0x7a8a7a, trousers: 0x2a3030, boots: 0x1e2424, hat: 0x2a3a34, hair: 0x3a4a44, hatStyle: 'bandana', held: 'cutlass', eyes: 0xbfeee4 },
  // Bellwether's folk under the hill and in the Howes; Stormwrack's drowned dead (docs/ISLANDS.md)
  knocker: { skin: 0x8a9a7a, coat: 0x5a4a36, coatTrim: 0x3a2e22, shirt: 0x7a6a50, trousers: 0x3a3028, boots: 0x2a2018, hat: 0xc9a050, hair: 0xd8d0c0, hatStyle: 'cap', beard: true, held: 'hammer', eyes: 0xf2d04a },
  howe: { skin: 0xc8c2a4, coat: 0x5a4a3a, coatTrim: 0x8a5a2a, shirt: 0x6a6050, trousers: 0x3a342a, boots: 0x2a241c, hat: 0x6a6a6a, hair: 0x8a8478, hatStyle: 'none', held: 'greatsword', eyes: 0x9ad8ff },
  // Sunreach's douen: child-sized, a huge straw hat over a face you never see, feet on backwards
  douen: { skin: 0x9a6a4a, coat: 0x8a7a4a, coatTrim: 0x5a4a2a, shirt: 0xa8986a, trousers: 0x6a5a3a, boots: 0x9a6a4a, hat: 0xd8c07a, hair: 0x2a1a12, hatStyle: 'straw', hairStyle: 'short', beard: false, feetBack: true, held: 'none', eyes: 0xf2d04a },
  // Amberhold's barrow dead: blue-grey and rimed, rusted mail, an old broad sword
  draugr: { skin: 0x8a9aa0, coat: 0x4a5258, coatTrim: 0x8a6a3a, shirt: 0x5a6268, trousers: 0x3a4248, boots: 0x2a3034, hat: 0x5a5e62, hair: 0xb8c0c4, hatStyle: 'cap', beard: true, held: 'greatsword', eyes: 0x8ae8ff },
  wrecker: { skin: 0xb88a62, coat: 0x2a2a2e, coatTrim: 0xb8402a, shirt: 0x6a5a48, trousers: 0x22201e, boots: 'leather', hat: 0x1a1a1a, hair: 0x3a2a1a, hatStyle: 'bandana', beard: true, held: 'cutlass' },
  seadraugr: { skin: DROWNED_SKIN, coat: 0x2a4a3a, coatTrim: 0x6ac8a8, shirt: 0x4a5a4a, trousers: 0x22302a, boots: 0x1a2420, hat: 0x2a3a34, hair: 0x2a4a3a, hatStyle: 'none', held: 'pike', eyes: 0x8affe8 },
  // Tobin the star-watcher, with the crater's light in his eyes
  starstruck: { skin: 0xd8d4e0, coat: 0x2a3a5a, coatTrim: 0x9ad8ff, shirt: 0xc8d0d8, trousers: 0x22263a, boots: 0x1e1e28, hat: 0x2a3a5a, hair: 0xe8e8f0, hatStyle: 'none', beard: true, held: 'staff', eyes: 0x9ad8ff },
  // Halvdan Ninefold: mail and furs, a red-gold beard braided nine times
  ninefold: { skin: 0xd8b090, coat: 0x6a6a6a, coatTrim: 0x8a2a1a, shirt: 0x4a3a2a, trousers: 0x3a3028, boots: 0x3a2a1a, hat: 0x6a6a6a, hair: 0xc89a5a, hatStyle: 'cap', beard: true, held: 'greatsword' },
  // Jenny Greenteeth: skin the green of pond-scum, hair like weed, a sack-cloth dress dragging water
  greenteeth: { skin: 0x7a9a5a, coat: 0x3a4a2a, coatTrim: 0x5a6a3a, shirt: 0x4a5a32, trousers: 0x2a3420, boots: 0x7a9a5a, hat: 0x2a3a1a, hair: 0x2a3a1a, hatStyle: 'none', hairStyle: 'bun', beard: false, held: 'none', eyes: 0xe8f070 },
  // the Hushed: undyed grey, hoods down, nothing on them that rattles; their eyes have gone the pale of the song
  hushed: { skin: 0xd8c8b8, coat: 0x6a6a68, coatTrim: 0x8a8a86, shirt: 0x8a8a86, trousers: 0x4a4a48, boots: 0x3a3a38, hat: 0x6a6a68, hair: 0x2a2a2a, hatStyle: 'none', hairStyle: 'short', beard: false, held: 'dagger', eyes: 0xd8e8ff },
  // Sister Corva: the Hushed's grey under a captain's black coat, brass at the cuffs, hair cropped like a novice's; the song in her eyes
  corva: { skin: 0xe0cfc0, coat: 0x18181c, coatTrim: 'brass', shirt: 0x8a8a86, trousers: 0x2a2a2c, boots: 0x1a1a1c, hat: 0x18181c, hair: 0x1a1a1a, hatStyle: 'none', hairStyle: 'short', beard: false, held: 'staff', eyes: 0xd8e8ff },
  captain: { skin: DROWNED_SKIN, coat: 0x3a1828, coatTrim: 'brass', shirt: 0x8a9a8a, trousers: 0x22201e, boots: 0x1e2424, hat: 0x141414, hair: 0x3a4a44, hatStyle: 'tricorn', held: 'cutlass', eyes: 0xbfeee4 },
};
