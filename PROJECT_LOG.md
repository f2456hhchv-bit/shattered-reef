# Shattered Reef: project log

Reflects the actual repository, not the roadmap.

## Status (2026-10-23)

**Milestone:** first full island (Bellwether Isle) playable end to end on the `style-test` branch.

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm test` (vitest, 16 tests, ~2 s) | passes, including a scripted full quest play-through and save fuzzing |
| `node scripts/e2e.cjs` (browser, laptop + phone) | passes: no console errors, keyboard + touch-joystick movement, dialog, furnace window, shop, all tabs, click-to-talk |
| `npm run build` | passes |
| Real phone | **not yet tested** (frame rate, heat, touch feel) |

## Build loop (how every change is made)

1. Implement one feature in one batch of edits.
2. `npx tsc --noEmit && npx vitest run`: rules are pure TS, so whole play-throughs run headless in seconds.
3. `node scripts/e2e.cjs <dir>` against `npx vite`: boots in Chromium at 1280×800 and 390×844, fails on any console error.
4. Screenshots only when visuals changed: `--shots` on e2e, or `node scripts/tour.cjs out.jpg` for a one-image contact sheet of every area.
5. Commit when green. A stage is done only when its tests pass.

## Decisions
- **Art:** low-poly real-time 3D, fixed 3/4 camera (54°), look A "Bright" (see `docs/ART_DIRECTION.md`). All art built in code; no AI images.
- **Stack:** TypeScript + Vite + Three.js. Static hosting on GitHub Pages (`.github/workflows/deploy.yml` runs typecheck, tests, build, deploy on `main`).
- **Simulation is separate from rendering.** `src/game/**` has no Three.js import; the renderer reads state and listens to events. This is what makes headless tests (and later multiplayer) possible.
- **XP:** RuneScape curve continued to level 126; XP stored, level derived; 200M cap. Rates are RuneScape's: 4 XP per damage to the stance's skill, 1.33 to Hitpoints, early gathering values (copper 17.5, logs 25). Gathering on a 2.4 s rhythm.
- **Combat skills (RuneScape model):** Attack, Strength, Defence, Hitpoints, Ranged, Magic. Hit chance and max hit use the OSRS formulas; successful hits always do at least 1 (a 0 means a miss). Stances choose the trained skill. Combat triangle via per-style defence: crabs and the Guardian are weak to magic, brigands to ranged, gunners to melee. Combat level uses the OSRS formula (new character = 3).
- **Skills roadmap:** `docs/SKILLS.md` (12 in game, 22 planned). A skill ships only with real content.
- **Combat:** auto-attack anything in reach (Survivor.io feel), tap/click an enemy to chase it. Three active skills: dodge roll (3 s, no damage while rolling), whirl (6 s, hits everything within 3.2 m, knockback), flintlock (7 s, ranged). Enemy attacks are telegraphed; rolling through them is the skill play.
- **Encounter upgrades (Survivor.io level-up choices):** not built yet; deliberately deferred so permanent skills stay the focus of the first island.

## Systems in the build
| System | Where | Notes |
|---|---|---|
| World + collision + A* pathing | `src/game/world/` | 0.5 m walk grid, 1 m sail grid, string-pulled paths |
| Island layout (data) | `src/game/world/island.ts`, `layout.ts` | village, dock, forest, hills, camp, ruin, strand, 3 offshore shoals, 12 sea stacks |
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

- **2026-10-23, Tom:** "plays really well; combat needs a lot of work; one Combat skill is wrong; levels far too fast". Rebuilt combat on RuneScape's model (see Decisions). Measured with simulated play: crabs from level 1 give Attack 5 after 10 min, 12 after 30 min (was one level per crab). Guardian balance test: melee 8 loses, melee 12 wins with ~7 food in ~2.5 min, magic 10 wins in ~1 min, ranged 10 wins in ~2 min. Found and fixed: the Guardian could stack two warnings to land together (unfair instant death).

## Known issues / limitations
- No sound yet.
- No naval combat; sea is for travel, fishing and discovery only.
- Character models are basic up close.
- One island only; no chunk streaming yet (whole island is one 200 m world).
- Performance measured only in software rendering: ~150 draw calls, ~200k triangles per frame including shadows. Battery saver drops shadows, grass and resolution and caps at 30 fps.
- Grass/sand boundaries are jagged by design (per-triangle colour).

## Next
1. Tom plays on a real phone and laptop; fix what feels wrong.
2. Sound (code-generated effects + ambient sea).
3. Survivor.io-style encounter upgrades for the camp and boss fights.
4. Naval combat (raider skiffs) and the Kraken.
5. Second island + chunk streaming.
