import type { HumanoidLook } from './models/character';

// Who wears what: the outfits of the player, the villagers and every human foe. Shared by the 3D view
// and the UI (dialogue portraits).

export const NPC_LOOKS: Record<string, HumanoidLook> = {
  iven: { style: 'toy', skin: 'skin', coat: 0x55603f, coatTrim: 'brass', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 0x3a3a34, hair: 0x9a9a92, hatStyle: 'cap', spectacles: true },
  marta: { style: 'toy', skin: 0xc98f66, coat: 0x7a3b3b, coatTrim: 0xd8c7a8, shirt: 'shirt', trousers: 0x4a3a30, boots: 'leather', hat: 0x2c2420, hair: 0x2c2420, hatStyle: 'none', beard: false, apron: 0xe6dcc0 },
  bram: { style: 'toy', skin: 0xd09a70, coat: 0x4a4038, coatTrim: 'iron', shirt: 0xb5a58a, trousers: 0x3a3028, boots: 'leather', hat: 0x2c2420, hair: 0x5a3a22, hatStyle: 'none', apron: 0x5a3a26, held: 'hammer' },
  silas: { style: 'toy', skin: 0xb98058, coat: 0x2f6a8a, coatTrim: 0xd8c7a8, shirt: 0xd8ccb0, trousers: 0x3a3428, boots: 0x2a2420, hat: 0xc9a050, hair: 0x8a8a82, hatStyle: 'cap', beard: true },
  hob: { style: 'toy', skin: 0xd8a07a, coat: 0x8a5a2a, coatTrim: 0x3a2a1a, shirt: 0xeee4cc, trousers: 0x3a3028, boots: 'leather', hat: 0x2c2420, hair: 0x6a3a1a, hatStyle: 'none', beard: true, apron: 0xe6dcc0 },
  ada: { style: 'toy', skin: 0xc48c62, coat: 0x2f3a5a, coatTrim: 'brass', shirt: 0xf0e8d8, trousers: 0x22222a, boots: 0x1a1a1e, hat: 0x2a1a12, hair: 0x2a1a12, hatStyle: 'none', hairStyle: 'bun', spectacles: true },
  maren: { style: 'toy', skin: 0xe0b08a, coat: 0xe8e0d0, coatTrim: 0x2f5a6a, shirt: 0xe8e0d0, trousers: 0xd8d0c0, boots: 0x6a5a4a, hat: 0x2f5a6a, hair: 0xb8b0a0, hatStyle: 'bandana', hairStyle: 'bun' },
  corwin: { style: 'toy', skin: 0xd09a70, coat: 0x4a2a3a, coatTrim: 'brass', shirt: 0xeee4cc, trousers: 0x2a2228, boots: 'leather', hat: 0x1a1414, hair: 0xb8b0a0, hatStyle: 'tricorn', beard: true },
  wynn: { style: 'toy', skin: 0xa8704a, coat: 0x23364a, coatTrim: 'brass', shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x23364a, hair: 0x1a1210, hatStyle: 'cap', hairStyle: 'queue' },
  watch_n: { style: 'toy', skin: 0xc8946a, coat: 0x6a2a24, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 0x1e1a18, hat: 0x1a1414, hair: 0x4a2a18, hatStyle: 'tricorn', held: 'musket' },
  watch_e: { style: 'toy', skin: 0x9a6a48, coat: 0x6a2a24, coatTrim: 0xc9a050, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 0x1e1a18, hat: 0x1a1414, hair: 0x1a1210, hatStyle: 'tricorn', hairStyle: 'queue', held: 'musket' },
};
/** Townsfolk who walk Bellwether's streets (no dialogue: they're busy). */
export const TOWNS_LOOKS: Record<string, HumanoidLook> = {
  towns_a: { style: 'toy', skin: 0xd8a07a, coat: 0x5a6a3a, coatTrim: 0xd8c7a8, shirt: 0xeee4cc, trousers: 0x4a3a30, boots: 'leather', hat: 0x8a5a2a, hair: 0x8a5a2a, hatStyle: 'none', hairStyle: 'bun', apron: 0xd8cfb8 },
  towns_b: { style: 'toy', skin: 0xb98058, coat: 0x3a4a6a, coatTrim: 0xb8b0a0, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x5a4024, hair: 0x2a1a12, hatStyle: 'cap' },
  towns_c: { style: 'toy', skin: 0xe0b08a, coat: 0x8a3a5a, coatTrim: 0xe6dcc0, shirt: 0xf0e8d8, trousers: 0x3a3028, boots: 0x3a2a20, hat: 0xc9a050, hair: 0xc9a050, hatStyle: 'none', hairStyle: 'queue' },
  towns_d: { style: 'toy', skin: 0xa8704a, coat: 0x6a5a40, coatTrim: 0x3a2a1a, shirt: 0xb5a58a, trousers: 0x3a3a30, boots: 'leather', hat: 0x9a2a1e, hair: 0x1a1210, hatStyle: 'bandana', beard: true },
  towns_e: { style: 'toy', skin: 0xc98f66, coat: 0x4a4038, coatTrim: 0xc9a050, shirt: 0xe8dcc0, trousers: 0x2a2228, boots: 0x2a2420, hat: 0x3a3a34, hair: 0x9a9a92, hatStyle: 'none', spectacles: true },
};
export const PLAYER_LOOK: HumanoidLook = { style: 'toy', skin: 'skin', coat: 'coat', coatTrim: 'coatTrim', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 'hat', hair: 'hair', held: 'cutlass' };
export const BRIGAND_LOOK: HumanoidLook = { skin: 0xc48c62, coat: 0x4a2f24, coatTrim: 0x8a2e22, shirt: 0xb5a58a, trousers: 0x3a3a30, boots: 'leather', hat: 0x9a2a1e, hair: 0x2a1a12, hatStyle: 'bandana', held: 'cutlass' };
export const GUNNER_LOOK: HumanoidLook = { ...BRIGAND_LOOK, coat: 0x2f3a2e, hat: 0x2a2a2a, held: 'musket' };
const DROWNED_SKIN = 0x86a49a;
/** Outfits per enemy look; gunner-type enemies get a musket automatically. */
export const HUMAN_LOOKS: Record<string, HumanoidLook> = {
  brigand: BRIGAND_LOOK,
  gunner: GUNNER_LOOK,
  smuggler: { skin: 0xc8946a, coat: 0x23364a, coatTrim: 0xb8b0a0, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x161616, hair: 0x2a1a12, hatStyle: 'tricorn', held: 'cutlass' },
  poacher: { skin: 0xb98058, coat: 0x445228, coatTrim: 0x7a5a30, shirt: 0x9a8a62, trousers: 0x3a3424, boots: 'leather', hat: 0x5a4024, hair: 0x6a4a2a, hatStyle: 'cap', held: 'cutlass' },
  drowned: { skin: DROWNED_SKIN, coat: 0x2c3b3a, coatTrim: 0x5a6a5a, shirt: 0x7a8a7a, trousers: 0x2a3030, boots: 0x1e2424, hat: 0x2a3a34, hair: 0x3a4a44, hatStyle: 'bandana', held: 'cutlass', eyes: 0xbfeee4 },
  captain: { skin: DROWNED_SKIN, coat: 0x3a1828, coatTrim: 'brass', shirt: 0x8a9a8a, trousers: 0x22201e, boots: 0x1e2424, hat: 0x141414, hair: 0x3a4a44, hatStyle: 'tricorn', held: 'cutlass', eyes: 0xbfeee4 },
};
