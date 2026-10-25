# The first three islands, and the sea between them

Design for Tom's ask (2026-10-25): "Fill out these first 3 islands. Make them truly brilliant for active gameplay:
skilling and combat, along with questing. We haven't even touched the boat side yet; reuse gameplay from
the-shattered-reef?" Nothing here is built yet. Decisions marked **(Tom)** are open.

## Where we are (the honest version)

- **One quest in the whole game** (The Bell at Low Water). Three islands can't feel alive on one quest.
- **Skilling is tap-and-wait.** Every gathering and production skill is the same loop: tap a node, wait, repeat.
  Nothing rewards attention.
- **Combat is tap-and-wait too**, apart from the three bosses and the dodge roll.
- **The ship is a taxi.** It sails between islands, fishes and mines the spire. No combat, no upgrades, no skill.
- **The bestiary was picked, not researched.** Wisps, golems and wraiths are generic fantasy filler. They're
  replaced below by creatures drawn from real folklore that fits each island.

## Research this draws on

- **OSRS Sailing** (launched 19 Nov 2025): boats you upgrade (cannons, nets), crew, and training by sea charting,
  shipwreck salvaging, courier and bounty tasks at sea, deep-sea trawling and obstacle courses. Some islands are
  only reachable by boat. ([OSRS wiki: Sailing level](https://oldschool.runescape.wiki/w/Sailing_level),
  [Sailing quests](https://oldschool.runescape.wiki/w/Sailing_quests), [PCGamesN](https://www.pcgamesn.com/old-school-runescape/sailing))
- **Skilling bosses** (Wintertodt, Tempoross, Guardians of the Rift): a boss you beat with a skill, not a sword.
  Jagex's own rule for the genre: the skill must be the main way you interact, and it's designed solo first,
  then scaled. ([RS wiki: Skilling Boss](https://runescape.wiki/w/Update:Right_Click_Examine:_Skilling_Boss),
  [OSRS bossing ladder](https://oldschool.runescape.wiki/w/Guide:Bossing_Ladder))
- **Sea of Thieves**: the best-loved content is emergent and telegraphed (forts you see from afar; the Kraken built
  up by sightings; the megalodon you can outrun). Critics found plain sailing and simple gun combat dull, so the
  sea needs reasons to steer, not just distance.
  ([designer diary](https://uk.steamforged.com/blogs/brands/enemies-and-combat-sea-of-thieves-designer-diaries-4-with-sherwin-matthews),
  [CGM review](https://www.cgmagonline.com/reviews/sea-of-thieves-xbox-one-pc-review))
- **Folklore**: Norse draugr and haugbui (barrow-dead that guard grave goods; sea-draugr are the drowned)
  ([vikingr.org](https://vikingr.org/other-beings/undead-viking-age)); Caribbean soucouyant (sheds her skin and
  flies as a fireball; salt her hidden skin to stop her), lagahoo (a shapeshifter, headless, carrying a coffin)
  ([Soucouyant](https://godsandmonsters.info/soucouyant/), [Lagahoo](https://en.wikipedia.org/wiki/Lagahoo));
  Scottish and Shetland selkies, kelpies, and the Blue Men of the Minch who sink ships unless the captain answers
  their rhyme ([Countryfile](https://www.countryfile.com/culture/britains-mythical-sea-creatures),
  [Shetland folklore](https://shetlandwithlaurie.com/the-blog/shetland-folklore-series-creatures-from-the-sea-selkies-mermaids-beasts-serpents)).
- **Tom's own the-shattered-reef** (Overboard!-style naval game): boat momentum physics; "read the enemy, swap the
  ammo" counters (cannonballs, chain shot for flyers, grapeshot close up, depth charges for things underwater,
  fire barrels); sea enemies by behaviour (cutters, broadside brigs, sharks that circle then charge, serpents that
  dive and resurface, gull harpies that dive-bomb, fire ships that ram, mortar boats, ghost ships, sirens that
  pull you in); weather (gale, squall, thunderstorm, fog, whirlpool), every hazard telegraphed and hurting enemies
  too. Its code is Canvas 2D JavaScript, so we port the **rules and numbers**, not the files.

## Each island has an identity

| | Bellwether (1-20) | Sunreach (15-30) | Amberhold (25-50) |
|---|---|---|---|
| Feel | Cold Celtic fishing isle: barrows, wreckers, seals | Caribbean jungle: heat, ruins, night spirits | Norse autumn: barrows, trolls, amber, hives |
| Folklore | Selkies, knockers (mine spirits), haugbui, the Blue Men | Douen, soucouyant, lagahoo, giant insects | Draugr, trolls, nøkk, hives |
| Skilling boss | The Storm Tide (Fishing, Cooking, Smithing) | The Greenheart Fire (Woodcutting, Fletching) | The Amber Seep (Mining, Crafting) |
| Combat boss | Lockbound Guardian (22) | The Sunscale (32) | The Broodmother (52), plus the Barrow King (quest) |
| Sea boss | Old Gnasher, a reef shark | The Flagship *Red Ransom* | The Kraken's first sighting (escape, don't fight) |

## Bestiary (replaces the wisps, golems, wraiths and moonhounds)

Every regular foe stays a plain fighter, as Tom asked: it walks up and attacks, melee or ranged, no tricks. What
makes them different is how they look, where they live, what they're weak to and what they drop. Humans stay as
one strand of three (this is a pirate game), not the default.

**Bellwether (1-20)**
- Shore beetle (2), sand-coloured, on the beaches. *Bug.* Drops chitin (new crafting material: beetle-shell armour).
- Reef crab (2), mire crab (14): kept.
- Herring gull (5), flies in, pecks, steals a fish from your pack if it lands a hit. *Plain flyer.*
- Bramble spriggan (9), a little thorn-and-root man in Saltpine Wood. Drops seeds and logs.
- Knocker (12), the tappers in the mines (Cornish lore: they knock to warn of cave-ins). In Ironcrag and the
  Smugglers' Caves. Drops ore and the odd gem.
- Bog leech (14), the fen. *Bug.* Drops leech oil (a fishing bait).
- Barrow-dead (haugbui, 18), only at the barrows behind the Broken Ring, guarding grave goods. *Undead.*
- Brigands (9, 11), smugglers (18, 20): kept.

**Sunreach (15-30)**
- Leafcutter ants (16) in columns along jungle paths. *Bug.* Drops resin.
- Jungle mantis (20). *Bug.* Drops mantis blades (a dagger material).
- Douen (22), a jungle child-spirit with its feet on backwards; its tracks lead the wrong way. Drops charms.
- Boar (26), gold-banded snake (30): kept.
- Giant centipede (24), the Ember Deep. *Bug.*
- Ember asp (28), young weaver (27), the Ember Deep: kept.
- Soucouyant (quest boss, see quests), and her fireballs at night as a rare roaming foe (30).

**Amberhold (25-50)**
- Amber hornets (30), from hives in the amberwood. *Bug.* Hives can be smoked for honeycomb (Cooking).
- Bark beetle (34), huge, chewing the amber trees. *Bug.* Drops chitin plates (higher-tier armour).
- Warg (36), the pale hounds (replaces moonhounds).
- Nøkk (38), a water-horse in the marsh pools; plain melee, weak to ranged. Drops kelp silk.
- Moss troll (42), slow, huge, hits hard. *Troll.*
- Barrow draugr (44) and draugr troll (48), the undead trolls, in the barrows under Goldvein Hill. *Undead troll.*
- Ironshell crabs (33), poachers (38, 42), giant weavers (46): kept.

**At sea** (see Sailing): pirate cutters and brigs, reef sharks, sea serpents, gull swarms, fire ships, and later
the Blue Men, ghost ships and sirens.

New bodies needed: beetle/ant, mantis, hornet (flying), centipede (the snake chain with legs), troll (big,
hunched; the golem rig retuned), knocker and spriggan (small humanoids), gull, nøkk (the hound rig as a horse),
draugr (the humanoid rig, rotted). Wisps and the wraith are removed; the golem rig survives only inside the troll.

## Active skilling: rewards for attention, never a tax on AFK

Every skill still works by tap-and-wait at the same pace as now. On top of that, each one gets **one optional
active input** that pays roughly a third more (XP and yield) for doing it well. One thumb, no menus.

- **Woodcutting: the clean cut.** A ring closes on the tree each swing; tap when it lines up for a double log.
  Rare: a bird's nest falls, so tap it before it hits the ground.
- **Mining: the seam.** A glinting crack shows on the rock; tap it for a bonus ore. Rare: a knocker's warning
  knock, then a rockfall telegraph you step out of. Ignore it and you take damage, never death.
- **Fishing: the strike.** The float dips; tap within the window for a bonus catch. Big fish start a short
  tug-of-war (hold, let go when the line flashes red).
- **Cooking: off the heat.** A colour bar; take it off in the gold band for a "perfect" dish that heals more.
- **Smithing: the hammer.** A metronome; tap on the beat to forge faster and raise the masterwork chance.
- **Fletching, Gunsmithing, Crafting:** one tap-on-time step each, same pattern.

**(Tom)** Optional bonus (recommended) or required minigames?

## Skilling bosses (one per island)

Solo-first, repeatable, about 10 minutes. You win with skills; the reward is a skilling outfit piece, tools,
materials and a chance at a key.

- **Bellwether: The Storm Tide.** A storm rolls into the quay with a sea serpent behind it. Fish the surging
  shoals, cook the catch into barrels, carry them to the quay cannon and fire them at the serpent. Mend the dock
  (Smithing) when waves smash it. Lose the dock and the tide wins.
- **Sunreach: The Greenheart Fire.** The jungle catches fire. Fell trees to cut firebreaks (Woodcutting), fletch
  water-buckets from bamboo, douse the flames, and drive back the fire-spirits (soucouyant embers) with what
  you've built. The fire spreads where you aren't.
- **Amberhold: The Amber Seep.** Goldvein Hill cracks open on a chamber of amber. Mine the seep before the hill
  quakes shut, set the amber into supports (Crafting) to hold the tunnel, and get out when the knocks start.

## Quests: three or four an island, one story through all of them

Each quest mixes at least two of combat, skilling, puzzle and sailing, and ends with something you can **use**:
an area, a spell, a ship part, a key. The thread through them is the keys: someone is collecting them, and every
island has had one taken.

**Bellwether**
1. *The Bell at Low Water* (exists): the Guardian; Keel's Tooth.
2. *Knock Three Times*: the knockers are warning of a collapse nobody listens to. Mining and a cave puzzle
   (follow the knocks). Reward: the deep level of the Smugglers' Caves, and the Knocker's lamp (cave light).
3. *The Selkie's Skin*: a fisherman has hidden a selkie's skin to keep her ashore. Find it (Fishing and digging
   clues round the strand); return it or keep it. Return it: she teaches you to dive for pearls. Keep it: a selkie
   cloak. A real choice.
4. *Wreckers' Lantern*: false lights on the headland are luring ships onto Wreckers' Point. The sailing tutorial:
   fit your first cannon, sink the wreckers' cutter, fight their captain ashore. Reward: cannons and the Sailing
   skill. Ends with a chart pointing to Sunreach.

**Sunreach**
1. *Backward Tracks*: a child has followed a douen into the jungle. A tracking puzzle (douen tracks point the
   wrong way). Reward: the Greenheart's hidden glade.
2. *Salt for the Soucouyant*: someone on the quay is draining sailors at night. Investigate, find her shed skin,
   salt it before dawn, and fight her as a fireball. The folklore is the mechanic. Reward: a fire spell.
3. *Fire on the Greenheart*: the skilling boss's first run, as a story.
4. *The Sunken Temple*: the Sunscale, and the key it guards.

**Amberhold**
1. *The Toll of Tollhouse*: the toll-keepers and the poachers both want your help. Sailing courier runs and a
   choice of side. Reward: the side's shop and a ship part.
2. *The Barrow King*: the barrows under Goldvein Hill hold a draugr troll king. Light the barrow lamps in order
   (puzzle), then fight him. Reward: barrow gear and the Draugr's Key.
3. *The Nøkk's Fiddle*: a water-horse that plays a fiddle under the marsh. Match its tune (a short rhythm
   puzzle) to get its bridle. Reward: a ship figurehead that calms storms.
4. *The Broodmother*: the finale (boss exists).

## Sailing: the ship becomes a second game

Ported in spirit from the-shattered-reef and checked against OSRS Sailing and Sea of Thieves.

- **A Sailing skill** (15th skill), 1-50 across these three islands' waters. **(Tom)** New skill, or just ship
  upgrades?
- **Steering**: the floating joystick, with the old game's momentum physics (heavy, turns wide, drifts).
- **Cannons, two ammo slots, swap to counter.** Cannonballs do everything a little. Chain shot is for gulls and
  sails. Grapeshot is for close crews. Depth charges are for anything underwater (sharks and serpents dive, so
  only charges reach them). Fire barrels are for wooden ships. The old game's "read the enemy, swap the ammo" hook.
  Broadsides fire from whichever side faces the target, with a visible aim line; you steer to line up.
  **(Tom)** Auto-aim broadsides (recommended for phone), or manual aim?
- **Sea foes** (plain, like on land): cutters (shoot ahead), brigs (circle to bring a broadside), reef sharks
  (circle, then charge in a straight line you can dodge), sea serpents (dive, come up beside you), gull swarms
  (flyers), fire ships (ram and burn). Each band's waters has its own mix and one sea boss.
- **Weather** from the old game: gale (pushes the ship), squall (they can't see you), thunderstorm (marked
  strikes), fog, whirlpool. Every hazard is telegraphed and hurts enemies too, so weather is something to use.
- **Things to do at sea**: shipwreck salvage (a hook; loot and Sailing XP), sea charting (find and log marks for
  big one-off XP), bounty contracts at sea (the boards already exist), trawling nets for fish, and treasure maps
  from digging leading to wrecks.
- **The ship levels with you**: hull (Woodcutting, Smithing), sails (Crafting), cannons (Smithing, Gunsmithing),
  nets and hooks. Signed crew take posts: gunner (reload speed), navigator (speed), bosun (repairs).
- **Sinking isn't death**: you limp back to port with the hull smashed, losing the cargo hold, not your gear.

## Build order (vertical slices, one island at a time)

1. **Bellwether, fully**: the new bestiary, the active-skilling layer for all skills, the Storm Tide, quests 2-4,
   and the sailing foundation (steering, cannons and ammo, Sailing 1-20, cutters, sharks and gulls, Old Gnasher)
   that *Wreckers' Lantern* teaches. Bot-tested combat, a play-through test of every quest.
2. **Sunreach**: its bestiary, quests, the Greenheart Fire, brigs, serpents, fire ships, weather.
3. **Amberhold**: the same, plus the Kraken's sighting.

Each slice ships in several PRs (bestiary, skilling, quests, sailing), each playable on its own.

## Open decisions for Tom

1. Active skilling: an optional bonus (recommended), or required?
2. Sailing as a 15th skill (recommended), or upgrades only?
3. Broadsides: auto-aim (recommended for phone), or manual?
4. Start with slice 1 (Bellwether + sailing foundation)?
