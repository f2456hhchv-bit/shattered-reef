# Keys and keyholes

Design for Shattered Reef's signature system: One Piece's fruits and Locke & Key's keys in one. **All 21 keys
are built** (2026-10-25: `src/game/data/keys.ts`, every number in `KEY_CONFIG`). Started from Tom's idea and a 100-key brainstorm; see
"What was cut" at the end for what was kept from that list.

## The rules

- **Every human and creature has a keyhole.** Keys are turned in yourself or in a foe.
- **One key slot** (the keyring, in the Equipment tab). The key in it does two things:
  1. **Slotted in you (passive):** one steady bonus.
  2. **Turned in a foe's keyhole (power):** an active ability on a cooldown, used from a new Key button beside the
     special attack. You have to be within 3 m to turn it, so ranged and magic users must step in close to use it.
- **The keyring:** a key you find is yours permanently. It goes in the Keyring (a tab in Equipment), not the pack.
  It can't be lost, dropped or sold.
- **Swapping happens only at a safe spot** (the strongbox, your ship, the chapel), and never in a fight.
  - **Normal rule (Tom):** a newly slotted key is **dormant for 30 minutes of play**. That means no passive and no
    power. The countdown pauses while the game is closed, and the slot shows it.
  - **Developer setting:** "Free key swaps" (Settings > Developer) makes swaps instant, for testing and balancing.
    Off by default in the release build.
- **Bosses** take half effect from powers that control them (Root, Disarm, Becalm, Turncoat doesn't work).
- **Starter key:** Quick Study, given on day one.
- **Keys are found anywhere (Tom, 2026-10-25):** extremely rare from any gathered item (1 in 12,000), any kill
  (1 in 1,500 × (1 + level/40); elites ×3, bosses ×20) and any newly discovered place (1 in 40). It's always a key
  you don't have yet, and 6× likelier to be one from that line of work. The "Where it's found" column below is
  where each key turns up most often. Finds roll on their own random stream, so they never change a fight.
- **Key button** on the HUD (keyboard T); turning a key in someone is an attack, so passive creatures fight back.

## The catalogue (21 keys)

Rarity sets where a key comes from, not how strong it is: every key is a sideways choice. All numbers live in one
data table (`KEYS` in `content.ts`, planned) so balance is tuned in one place.

| Key | Rarity | Slotted in you | Turned in a foe (cooldown) | Where it's found |
|---|---|---|---|---|
| **Quick Study** | Starter | +3% XP in all gathering and production skills | **Lesson** (30 s): shows the foe's weakness and its next attack; your hits in its weak style do +15% for 10 s | Given at the start |
| **Woodsman's Key** | Common | 10% chance of an extra log | **Root** (25 s): the foe can't move for 4 s | Rare find in trees from Woodcutting 30 (like bird nests) |
| **Prospector's Key** | Common | 10% chance of an extra ore | **Shatter** (30 s): the foe's defence is cut 40% for 8 s | Rare find in rocks from Mining 30 (like geodes) |
| **Angler's Key** | Common | +6% fishing success | **Hook** (20 s): drags the foe to you | Rare catch at any spot from Fishing 30 |
| **Finder's Key** | Rare | Rare finds (nests, caskets, geodes) 50% more often | **Pickpocket** (once per foe): pulls one roll of its loot right now | Sunken casket (rare) |
| **Smith's Key** | Common | +5% masterwork chance; 8% chance a bar isn't used | **Rust** (35 s): the foe's damage is halved for 6 s | Bram's reward for Smithing 40 |
| **Cook's Key** | Common | Food heals 10% more; burn-stop 5 levels earlier | **Spoil** (30 s): the foe can't heal and loses 1% of its health a second for 8 s | Hob's reward for Cooking 40 |
| **Duellist's Key** | Common | +6 melee accuracy | **Disarm** (35 s): the foe can't attack for 4 s | Brigand camp chief (elite brigand) |
| **Brute's Key** | Rare | +4% melee max hit | **Knockdown** (30 s): hurls the foe back and stuns it 2 s | Ironshell crabs (rare) |
| **Bulwark Key** | Rare | 5% less damage from everything | **Ward** (40 s): this foe can't hurt you for 5 s | Stone sentinels |
| **Marksman's Key** | Common | +6 ranged accuracy, +1 m range | **Mark** (30 s): your next 2 hits on the foe land at max | The Poachers' Camp, Amberhold (elite gunner) |
| **Powder Key** | Rare | 10% chance shot, arrows and bolts aren't used | **Fuse** (40 s): the foe bursts after 2 s, hurting everything near it | Smugglers' Caves hold |
| **Tide Key** | Common | 10% chance a spell burns no charms | **Undertow** (35 s): pulls every foe within 6 m onto this one and slows them | Drip Pool (cave spiders) |
| **Storm Key** | Rare | +4% spell damage | **Chain** (30 s): lightning arcs from the foe to 3 more | Giant weavers, Weaver Hollow (Amberhold) |
| **Leech Key** | Rare | Heal 3% of damage you deal | **Drain** (35 s): takes 15% of the foe's health as your own | Wreck captain |
| **Helmsman's Key** | Common | Your ship sails 15% faster | **Becalm** (30 s): the foe moves and attacks 40% slower for 8 s | Wynn Harrow, harbourmaster, after your first voyage to Sunreach |
| **Wanderer's Key** | Common | Walk 8% faster out of combat | **Blink** (20 s): step through the keyhole to the far side of the foe | Discover 20 of the 34 places |
| **Bell Key** | Rare | Teleport spells cost no charms | **Toll** (40 s): every foe within 5 m is stunned 1.5 s | The Broken Ring, after the bell quest |
| **Skeleton Key** | Legendary | Locked caskets and chests always open | **Steal** (60 s): takes an elite's affix (Barnacled, Frenzied, Volatile) for yourself for 30 s | Guardian (rare) |
| **Mutineer's Key** | Legendary | +10% damage while below half health | **Turncoat** (90 s): the foe fights for you for 8 s (not bosses) | Temple serpent (rare) |
| **Keel's Tooth** | Legendary | Crabs and the Drowned never attack first | **Bite** (45 s): the foe's keyhole snaps shut. It can't use powers, telegraphs or summons for 10 s | Quest key already in the game; becomes slottable at the end of the bell quest |

**Built first (10):** Quick Study, Woodsman's, Prospector's, Angler's, Duellist's, Marksman's, Tide,
Leech, Helmsman's and Wanderer's. Together they cover gathering, the three combat styles, sailing and exploring.
Every effect uses systems the game already has, except Root, Becalm and Blink. Those need enemy status timers,
one small mechanic that later keys reuse.

## Data (planned)

```ts
interface KeyDef {
  id: string; name: string; rarity: 'starter' | 'common' | 'rare' | 'legendary';
  passive: { stat: string; v: number };           // read by computeStats / gathering / crafting
  power: { id: string; cooldown: number; dur?: number; v?: number; bossMul?: number };
  source: string;                                  // shown in the Keyring for keys not yet found ("???" until found)
  lore: string;
}
// save v7: keyring: string[]; key: string | null; keyDormant: number (seconds of play left)
```

Settings: `devFreeKeySwap: boolean`. Constants: `KEY_DORMANT_S = 1800`, `KEY_REACH_M = 3`.

## Feel

- Turning a key: the player reaches out, and a brass keyhole glows on the foe for a moment. Then a click and a
  power-coloured burst.
- Each key has a one-line lore note in the Keyring. The cursed-sea tone: "Cut from the heart of a felled
  saltpine. Hold it up and you can hear sap."
- Undiscovered keys show as silhouettes with their source, so players know what to hunt.

## Open questions (for Tom, before building)

1. Should a key show on the character (a glowing keyhole on the chest)? Cheap to add.
2. Crew members carrying their own key comes with the crew system, later.
3. Island arcs where an island has its own key rules (one island where every foe has an open keyhole). Later.

## What was cut from the 100-key brainstorm, and why

- **Duplicates.** Four durability keys, five speed keys, four extra-yield keys and five rare-find keys each became
  one key per skill family above.
- **Already gear bonuses or perks** (XP bonus, gathering speed, accuracy, crit, leech, cleave, ammo and charm
  saving, durability): kept only where a key does it in a new way, or folded into a key's passive.
- **Needs systems the game doesn't have:** stamina, mana, bait, reloading, block/parry, stagger, fire/frost
  spells, mastery XP, quality tiers, traps, diving, dismantling, fuel, fish size, deadwood. These come back if those
  systems are ever built.
- **Kept from it:** one slot, permanent unlocks, swapping only at safe spots and never in a fight, names that say
  what the key does, Quick Study as the +3% XP starter.

## Built as designed, with these changes (second ring)

- Keys also turn up from anything you make at a station (1 in 8,000 per item). Rare keys are 0.6× as likely as
  common ones, legendary 0.25×. Keel's Tooth never drops: it's given at the end of the bell quest (and to anyone
  who had already finished it).
- **Skeleton Key**'s passive became "nests, geodes and caskets you open give their loot twice" (caskets always
  opened already). **Steal** on Barnacled: take a third less damage; Frenzied: attack 40% faster; Volatile: your
  kills explode for your max hit around them.
- **Fuse** deals 2.5× your max hit to the foe and 60% of that to everything within 3 m. **Chain** strikes the foe
  and three more at 60% of your max hit. **Turncoat**: the foe attacks its nearest ally at 80% of its own max hit.
- **Keel's Tooth**: Bite stops a foe's attacks for 10 s (5 s and no summons for bosses); crabs and the Drowned
  never start a fight with you while it's slotted.
- Pickpocket, Steal and Turncoat refuse a foe they can't work on without spending the cooldown.
