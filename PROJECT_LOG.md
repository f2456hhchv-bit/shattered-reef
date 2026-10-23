# Shattered Reef: project log

Reflects the actual repository, not the roadmap.

## Status (2026-10-23)

**Milestone:** starter island enlarged (Phase 2 of "standardise the starter island") on branch `art-standard`; not merged yet.

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm test` (vitest, 28 tests, ~17 s) | passes: full quest play-through, save fuzzing, every zone reachable on foot, sea routes never cross land, Guardian balance bot |
| `node scripts/e2e.cjs` (browser, laptop + phone) | passes, no console errors |
| `node scripts/tour.cjs` (12 places) | renders, no errors |
| Real phone | combat build tested by Tom (smooth, no heat); art pass 1 + big island **not yet tested** on a phone |

## Build loop (how every change is made)

1. Implement one feature in one batch of edits.
2. `npx tsc --noEmit && npx vitest run`: rules are pure TS, so whole play-throughs run headless in seconds.
3. `node scripts/e2e.cjs <dir>` against `npx vite`: boots in Chromium at 1280×800 and 390×844, fails on any console error.
4. Screenshots only when visuals changed: `--shots` on e2e, or `node scripts/tour.cjs out.jpg` for a one-image contact sheet of every area (`SCENES=peak,fen` for a subset). Layout changes: `npx vite-node scripts/mapshot.ts out.ppm` draws the island top-down (walk grid, paths, nodes, spawns) in under a second, no browser.
5. Commit when green. A stage is done only when its tests pass.

## Decisions
- **Art:** low-poly real-time 3D, fixed 3/4 camera (54°), look A "Bright" (see `docs/ART_DIRECTION.md`). All art built in code; no AI images.
- **Stack:** TypeScript + Vite + Three.js. Static hosting on GitHub Pages (`.github/workflows/deploy.yml` runs typecheck, tests, build, deploy on `main`).
- **Simulation is separate from rendering.** `src/game/**` has no Three.js import; the renderer reads state and listens to events. This is what makes headless tests (and later multiplayer) possible.
- **XP:** RuneScape curve continued to level 126; XP stored, level derived; 200M cap. Rates are RuneScape's: 4 XP per damage to the stance's skill, 1.33 to Hitpoints, early gathering values (copper 17.5, logs 25). Gathering on a 2.4 s rhythm.
- **Combat skills (RuneScape model):** Attack, Strength, Defence, Hitpoints, Ranged, Magic. Hit chance and max hit use the OSRS formulas; successful hits always do at least 1 (a 0 means a miss). Stances choose the trained skill. Combat triangle via per-style defence: crabs and the Guardian are weak to magic, brigands to ranged, gunners to melee. Combat level uses the OSRS formula (new character = 3).
- **Skills roadmap:** `docs/SKILLS.md` (12 in game, 22 planned). A skill ships only with real content.
- **Combat:** auto-attack anything in reach (Survivor.io feel), tap/click an enemy to chase it. Three active skills: dodge roll (3 s, no damage while rolling), whirl (6 s, hits everything within 3.2 m, knockback), flintlock (7 s, ranged). Enemy attacks are telegraphed; rolling through them is the skill play.
- **Starter island holds every skill's level range** (Tom, 2026-10-23). Easy content near the quay, harder toward the far coasts and Ironcrag. Skill-specific islands come later. A zone joins the Places list only when it has content.
- **Art standard (art pass 1, approved by Tom 2026-10-23):** smooth shading, blended vertex-colour terrain with speckle, cobbles and cloud shadows; item models rendered to slate-tile icons; loot as rarity-tinted sea-glass shards. Characters and buildings get the same treatment next.
- **Encounter upgrades (Survivor.io level-up choices):** not built yet; deliberately deferred so permanent skills stay the focus of the first island.

## Systems in the build
| System | Where | Notes |
|---|---|---|
| World + collision + A* pathing | `src/game/world/` | 300 m world: 0.5 m walk grid, 1 m sail grid, hull-clearance sea grid; one A* (reused buffers) for walking and for ship routes round headlands |
| Island layout (data) | `src/game/world/island.ts`, `layout.ts` | radius ~80 m. Zones: Bellwether Quay, Crab Strand, Saltpine Wood, oak grove, Mirewater Fen + lagoon, Heartwood, Copperback Hills, Ironcrag peak, Broken Ring (walled arena), Brigand Camp, Smugglers' Cove headland, Wreckers' Point; 3 offshore shoals, ~20 sea stacks. Fen, Heartwood, peak, cove, point are landscape only until Phase 3 content |
| Skills (12) | `src/game/data/content.ts` | Attack, Strength, Defence, Hitpoints, Ranged, Magic, Woodcutting, Mining, Fishing, Smithing, Gunsmithing, Cooking; unlock tables in UI |
| Combat maths | `sim/gear.ts` | OSRS hit chance, max hit, combat level; stances; specials per style (Whirl, Scatter shot, Squall) |
| Items, rarity, affixes | `src/game/data/items.ts`, `sim/gear.ts` | Common/Fine/Rare/Relic; 11 affixes, all applied in `computeStats` |
| Gathering | `sim/game.ts` | tool power, level, depletion + respawn; shoals need the ship |
| Crafting | `content.ts` RECIPES | furnace, anvil, cookfire; burn chance; forged gear can roll Fine/Rare |
| Shop | `content.ts` SHOP | buy stock, sell anything non-quest at 50% |
| Enemies | `content.ts` ENEMIES | reef crab, brigand (melee), gunner (telegraphed shot); 10% elites: Barnacled / Frenzied / Volatile |
| Boss | `sim/game.ts` stepBoss | Lockbound Guardian: slam circle, sweep cone, crab summons at 66% / 33%, enrage < 25%, resets if you leave or die |
| Quest | `data/quests.ts` | *The Bell at Low Water*: talk → bronze bar → bell → boss → Keel's Tooth → return |
| Ship | `sim/game.ts` | board at dock, seamless sailing, shallows collision, go ashore on any reachable beach, mooring bell recalls ship |
| Saves | `sim/save.ts` | versioned, validated, migration table; autosave every 10 s + on hide |
| UI | `src/ui/` | landscape side panel / portrait bottom sheet; pack 4×7 (7×4 portrait), equipment + stats, skills, quests + places, map, settings |
| Input | `src/input/input.ts` | invisible joystick, tap/click to walk or use, hover labels, WASD, hotkeys, pinch/wheel zoom |

## Controls
- **Phone:** drag anywhere to move or steer; tap things to walk to them and use them; big round button = nearest action; small buttons = roll, whirl, flintlock; pinch = zoom; tap minimap or map to walk there.
- **Laptop:** click to walk/use (RuneScape-style); right-click items for details; WASD/arrows move; E action; Space dodge roll; R whirl; F flintlock; I G K J M O tabs; Esc closes; scroll zooms.

## Playtest log
- **2026-10-23, Tom, iPhone (live Pages build):** smooth, no heat; joystick + tap-to-move liked; camera distance and zoom liked.
  - Bug: inventory taps did nothing. Cause [likely]: tap reported as a mouse click, so it tried to use the item and the message went to a hidden log. Fixed: pointer type taken from pointerdown, touch always opens the details panel, log stays visible above the open sheet.
  - Combat felt passive (one button). Added dodge roll, whirl, swing arc, knockback, hit squash.
  - Found while fixing: with the portrait sheet open the player was hidden behind it. Camera now shifts up.

- **2026-10-23, Tom:** approved art pass 1; asked for a bigger starter island holding every skill's level range. Built the landmass (radius 50 → 80 m, 2.5× area) with zones and a road network. Found while testing:
  - Click-to-sail went in a straight line and beached on the new headland. Added sea routing (A* on a hull-clearance grid).
  - The Guardian balance test swung from 8/8 to 0/8 wins when the arena moved 0.3 m: the test bot was snagging on grid corners, not measuring balance. Rewrote the bot to dodge to a real escape point and kite; added glancing movement off round obstacles for real players too; walled the arena with fallen masonry. Honest result: ranged is neutral vs the Guardian (pistol needs ~13, like melee ~12); magic remains the shortcut (level 10). The earlier "ranged 10 wins" was the bot exploiting pillar snags.
- **2026-10-23, Tom:** "plays really well; combat needs a lot of work; one Combat skill is wrong; levels far too fast". Rebuilt combat on RuneScape's model (see Decisions). Measured with simulated play: crabs from level 1 give Attack 5 after 10 min, 12 after 30 min (was one level per crab). Guardian balance test: melee 8 loses, melee 12 wins with ~7 food in ~2.5 min, magic 10 wins in ~1 min, ranged 10 wins in ~2 min. Found and fixed: the Guardian could stack two warnings to land together (unfair instant death).

## Known issues / limitations
- No sound yet.
- No naval combat; sea is for travel, fishing and discovery only.
- Character models are basic up close.
- One island. Terrain (64 chunks of 40 m) and grass (40 m buckets) are frustum-culled; camera far plane follows the fog. Not streamed: the whole 300 m world is built at load (~0.4 s for the simulation in Node).
- Performance measured only in software rendering; big-island frame rate on a real phone unmeasured.
- New outer zones have scenery only; their skills content is Phase 3.

## Next
1. Phase 3: level 1–99 content for the 12 current skills across the zones (tiers of trees, ores, fish, recipes, enemies), one skill at a time, each with tests.
2. Characters and buildings brought up to the art pass 1 standard.
3. Tom plays the big island on a real phone; measure frame rate.
4. Sound (code-generated effects + ambient sea).
5. Survivor.io-style encounter upgrades for the camp and boss fights.
6. Naval combat (raider skiffs) and the Kraken.
7. Second island + streaming.
