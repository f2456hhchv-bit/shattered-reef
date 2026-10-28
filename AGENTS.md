# Working on Shattered Reef (for AI agents)

Shattered Reef is a mobile-first, RuneScape-style pirate RPG: TypeScript, Vite, Three.js, deployed to GitHub Pages
(free hosting, no backend, no paid services). The owner is Tom. More than one AI works on this repo, so follow these
rules exactly.

## Layout

- `src/game/data/` content: items, skills, recipes, enemies, loot, shops (`content.ts`), quests and NPCs
  (`quests.ts`, `bellquests.ts`, `bellfolk.ts`), keys, spells, diaries.
- `src/game/sim/` the game itself, no graphics: `game.ts` (the `Game` class) plus helper systems that hold a
  reference to it (`naval.ts`, `stormtide.ts`, `bottles.ts` ...). Saves and migrations: `save.ts`.
- `src/game/world/` islands, layout, pathfinding. `src/render/`, `src/ui/`, `src/art/`, `src/audio/`, `src/input/`.
- `scripts/` playtest bot, text-mode player (`agent-play.ts`), browser tests, frame budget, map renders.
- `PROJECT_LOG.md` the running log of what's built, decisions, known issues. `docs/` design docs.

## Workflow (every change)

1. Check open pull requests first. If one touches the same files, stop and tell Tom; don't work on top of it.
2. Branch from the latest `main`. Never push to `main` directly. Tom merges.
3. One change per PR, kept small. Don't touch unrelated code or reformat files.
4. Before opening the PR, all of these must pass:
   - `npm ci` (first time)
   - `npm run typecheck`
   - `npm test` (about 300 tests, a few minutes; some build whole islands)
   - `npm run build`
   - If you changed rendering, UI or the world: start `npx vite --port 5173` and run `node scripts/e2e.cjs`,
     `node scripts/touch-e2e.cjs` and `node scripts/perf-budget.cjs` (budget: 450 draw calls, 900k triangles).
5. Add an entry to `PROJECT_LOG.md` (under the Playtest log, newest last): what changed, why, how it was checked.
6. In the PR, say what you changed, what you checked, and anything you weren't sure about.

Never: skip, delete or weaken a test to make it pass (if a test's threshold is genuinely noisy, say so in the PR and
explain); commit secrets; add paid services or a backend; put AI model names in code, commits or docs.

## Rules for game content

- All player-facing text in plain, natural British English. Short sentences. No purple prose, no "AI slop".
- Keep every content id (items, quests, NPCs, enemies, flags) unchanged. Saves store them.
- Changing what's saved needs a new `SAVE_VERSION` and a migration in `save.ts`, with a test that an old save loads.
- No fake features: every button, menu and mechanic must work.
- Mobile first: touch targets, one-handed play, stable frame rate.

## Traps (each has broken things before)

- **Random numbers.** `Game` has one main random stream (`g.rnd`) shared by gathering, loot, fights and the helper
  systems, plus separate streams for keys, bounty boards, lucky swings and wandering. Adding, removing or reordering
  calls to `g.rnd()`, or reordering the calls in `Game.step()`, changes later rolls and can break balance tests.
  The island layouts (`world/layout.ts`) have their own stream: add new placements at the end, on their own stream
  (see how the shrines and town trees do it), or every tree and enemy moves.
- **Quest order.** `QUESTS` key order decides which quest an NPC talks about first. Keep it when editing or
  splitting quest files.
- **Tests reach private methods** through casts (`rollAgainst`, `performAttack`, `wear`, `pickCatch`,
  `rollShared`, `enemyRoll`, `naval.sink` ...). Renaming or moving them fails at runtime, not at compile time. Search
  the tests before moving anything.
- **Module order in `content.ts`.** Constants are built at load time; using one before it's declared crashes on
  start. `UNLOCKS` must be built last.
- **Island scale.** Bellwether is 4.5 times its old size (`BS` in `world/island.ts`); other islands sit 400 m east
  (`EAST`). Use the `LAYOUT` points, not hard-coded coordinates.
- **Balance tests** sample a fixed number of fights. If one moves by one after an unrelated change, it's noise; if it
  moves a lot, you changed the game.

## Testing the game as a player

- `npx vite-node scripts/agent-play.ts -- --save run.json`: the real game in text (`help` for commands).
- `npx vite-node scripts/playtest.ts 60 11`: a scripted new player for 60 game minutes.
- `reports/playtest/`: the same bot's reports, written automatically on GitHub after changes to `main`.
- `docs/AI_TESTING.md`: a test brief and how to read the reports.

When asked to test, report problems; don't fix them in the same task unless told to. Tell bot problems (the
scripted player being dumb) apart from game problems.
