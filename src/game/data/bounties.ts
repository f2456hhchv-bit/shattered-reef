// Bounties and crew (Tom, 2026-10-25). The harbourmasters post contracts (hunt so many of a foe, or a named
// wanted elite); finishing them, and beating anyone notable, raises your own bounty. A big enough bounty
// draws bounty hunters, and draws sailors who want to sail with a famous captain: your crew.

import type { CombatStyle } from './items';
import type { RegionId } from '../world/regions';

export const BOUNTY_CONFIG = {
  offers: 3, // contracts on a board at once
  maxActive: 3, // contracts you can carry
  refreshS: 1800, // a board's offers change every 30 minutes of play
  huntN: [6, 14] as [number, number], // how many to hunt
  coinsPer: 6, // coins per foe level per kill on a hunt contract
  bountyPer: 3, // bounty per foe level per kill on a hunt contract
  wantedMul: 4, // a wanted target pays this many times a 10-kill hunt of its kind
  wantedHp: 3, // a wanted target's health multiple
  killBounty: 2, // bounty per level for beating a hostile foe (camps, lairs, late zones)
  bossBounty: { guardian: 2000, temple_serpent: 5000 } as Record<string, number>,
  hunterFrom: 5000, // bounty hunters start coming at this bounty
  hunterEvery: [900, 1500] as [number, number], // seconds of play between ambushes
};

/** What the board knows of each island: where its contracts send you. */
export const BOARDS: Record<string, { npc: string; island: RegionId; regions: RegionId[] }> = {
  bellwether: { npc: 'wynn', island: 'bellwether', regions: ['bellwether', 'smugglers_caves'] },
  sunreach: { npc: 'sefa', island: 'sunreach', regions: ['sunreach', 'ember_deep'] },
};

/** Your bounty's standing: the title on your wanted poster. */
export const RANKS: [number, string][] = [
  [0, 'Unknown'], [300, 'Troublemaker'], [1500, 'Outlaw'], [5000, 'Notorious'], [15000, 'Dread captain'], [40000, 'Terror of the Reef'], [100000, 'Legend of the Shattered Sea'],
];
export const rankOf = (b: number) => [...RANKS].reverse().find(([at]) => b >= at)![1];

/** Names for wanted targets. */
export const WANTED_FIRST = ['Red', 'One-Eye', 'Salt', 'Grim', 'Lucky', 'Black', 'Bonny', 'Iron', 'Silver', 'Mad', 'Quiet', 'Long'];
export const WANTED_LAST = ['Tam', 'Jessop', 'Morrow', 'Vane', 'Kell', 'Rook', 'Hale', 'Quill', 'Dace', 'Cobb', 'Fenn', 'Sallow'];

export interface Contract {
  id: number;
  board: string;
  kind: 'hunt' | 'wanted';
  enemy: string; // enemy def id
  need: number;
  have: number;
  coins: number;
  bounty: number;
  /** wanted: who, and where they lurk */
  name?: string;
  region?: RegionId;
  x?: number;
  z?: number;
}

export type CrewPassive = 'heal' | 'ranged_dmg' | 'ship_speed' | 'max_hp' | 'trade' | 'gather';
export interface CrewDef {
  id: string;
  name: string;
  role: string;
  line: string; // what they say on the board
  bounty: number; // the bounty they want their captain to have
  coins: number; // their signing fee
  passive: { kind: CrewPassive; v: number; text: string };
  /** ashore as first mate: how they fight, and how hard (share of your max hit) */
  mate: { style: CombatStyle; held: 'cutlass' | 'pistol' | 'staff' | 'greatsword' | 'dagger' | 'pike'; mul: number; range: number };
  look: { skin: number; coat: number; coatTrim: number; shirt: number; trousers: number; hat: number; hair: number; hatStyle: 'tricorn' | 'bandana' | 'cap' | 'none'; beard?: boolean };
}

export const CREW: CrewDef[] = [
  { id: 'nell', name: 'Nell Barrow', role: 'Cook', line: 'I can cook for forty on a rolling deck, and I swing a cleaver like I mean it.', bounty: 0, coins: 150,
    passive: { kind: 'heal', v: 10, text: 'Food heals 10% more' }, mate: { style: 'melee', held: 'cutlass', mul: 0.3, range: 1.7 },
    look: { skin: 0xd8a07a, coat: 0x7a3a2a, coatTrim: 0xe9e3d0, shirt: 0xe9e3d0, trousers: 0x3a3028, hat: 0xe9e3d0, hair: 0x8a3a1a, hatStyle: 'bandana', beard: false } },
  { id: 'jory', name: 'Jory Flint', role: 'Gunner', line: 'Seen your face on a poster. Means you\'ll see trouble. I like trouble.', bounty: 1500, coins: 400,
    passive: { kind: 'ranged_dmg', v: 3, text: 'Ranged max hit +3%' }, mate: { style: 'ranged', held: 'pistol', mul: 0.35, range: 7 },
    look: { skin: 0xb07850, coat: 0x2f3a2e, coatTrim: 0xc9a050, shirt: 0xb5a58a, trousers: 0x2a2a24, hat: 0x2a2a2a, hair: 0x1a120c, hatStyle: 'tricorn' } },
  { id: 'sable', name: 'Sable Marr', role: 'Navigator', line: 'Iven taught me the stars. I know a quicker way round anything.', bounty: 3000, coins: 800,
    passive: { kind: 'ship_speed', v: 10, text: 'Your ship sails 10% faster' }, mate: { style: 'magic', held: 'staff', mul: 0.35, range: 7 },
    look: { skin: 0x8a5a3a, coat: 0x23364a, coatTrim: 0x59d0c4, shirt: 0xd8ccb0, trousers: 0x2e2a26, hat: 0x23364a, hair: 0x101010, hatStyle: 'none', beard: false } },
  { id: 'oake', name: 'Big Oake', role: 'Bosun', line: 'Nobody gets past me to you, captain. Nobody gets past me at all.', bounty: 6000, coins: 1500,
    passive: { kind: 'max_hp', v: 5, text: '+5% max health' }, mate: { style: 'melee', held: 'greatsword', mul: 0.45, range: 1.9 },
    look: { skin: 0x6a4028, coat: 0x4a3a2a, coatTrim: 0x8a2e22, shirt: 0xb5a58a, trousers: 0x3a3a30, hat: 0x4a3a2a, hair: 0x1a1a1a, hatStyle: 'none' } },
  { id: 'wren', name: 'Wren Tally', role: 'Quartermaster', line: 'You overpay for everything. I can tell from here. Let me do the haggling.', bounty: 12000, coins: 3000,
    passive: { kind: 'trade', v: 10, text: 'Shops sell to you 10% cheaper and pay 10% more' }, mate: { style: 'melee', held: 'dagger', mul: 0.35, range: 1.5 },
    look: { skin: 0xe0b090, coat: 0x5a2a4a, coatTrim: 0xe3c25e, shirt: 0xe9e3d0, trousers: 0x2a2028, hat: 0x5a2a4a, hair: 0xd8b060, hatStyle: 'cap', beard: false } },
  { id: 'kettle', name: 'Old Kettle', role: 'Rigger', line: 'Forty years in the rigging. My hands know rope, rock and timber better than my own name.', bounty: 25000, coins: 6000,
    passive: { kind: 'gather', v: 5, text: '+5% gathering success' }, mate: { style: 'melee', held: 'pike', mul: 0.4, range: 2.8 },
    look: { skin: 0xc8946a, coat: 0x3a4a3a, coatTrim: 0xb8b0a0, shirt: 0xb8b0a0, trousers: 0x2e2a26, hat: 0x6a5a3a, hair: 0xd8d8d0, hatStyle: 'tricorn' } },
];
export const CREW_BY: Record<string, CrewDef> = Object.fromEntries(CREW.map((c) => [c.id, c]));
