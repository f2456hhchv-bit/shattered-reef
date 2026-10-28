# Confirmed fixes: before and after

28 October 2026. Baseline code: `fdc07e0ea6f40bdbc6961c60a1dc6406c7e40a03`. Work remains on branch `work`, with no merge or publication. These are fresh, 60-minute simulated sessions on seeds 11, 23 and 47, not continuations of existing saves.

## Changes

1. **Puzzle choices:** the scripted player selects the next uncompleted sequence marker, excludes decoys, and resumes saved partial progress. Unordered quest spots retain their normal behavior. The game's tracker still conceals puzzle answers; the script reads the quest's declared sequence. This verifies execution, not a human player's ability to interpret the clues.
2. **Retreats:** a persistent retreat decision suppresses new attacks until the player reaches the harbour and nearby pursuers disengage. Chase and windup are recognized using the game's actual enemy states. Death clears the controller's fight/retreat state and records a lost fight.
3. **Save feedback:** the UI's save callback returns the persistence result. A rejected write displays the existing warning, preserves the old save and saved timestamp, and never displays success. Successful writes still persist and confirm normally.
4. **Favicon:** the page explicitly links a local SVG using a relative path, including deployment under `/shattered-reef/`.

Investigation after the first fixes exposed additional **bot** defects. The controller now respects existing quest combat recommendations, trains its weakest melee skill, searches beyond an arbitrary 80-metre radius for suitable training opponents, and retains its three-minute reconsideration timer when a depleted node automatically leads to another. It counts actual food consumption separately from attempted eating and uses a seeded decision stream. These changes have regression coverage.

No XP rates, level requirements, enemy stats, loot, prices, quest rewards, player controls, save schema, or monetization mechanics were changed. Combat recommendations constrain this script's preparation decisions only; players retain the freedom to attempt content early. No teleports, free levels, equipment grants, weakened opponents or paid progression were introduced.

## Results

Each cell is **baseline → updated**. Complete outputs are retained next to this report as `baseline-seed-N.txt` and `seed-N.txt`.

| Metric | Seed 11 | Seed 23 | Seed 47 |
| --- | --- | --- | --- |
| Bell stage | 2/4 → 2/4 | 2/4 → 2/4 | 2/4 → 2/4 |
| Knock stage | 1/4 → 1/4 | 1/4 → 1/4 | 1/4 → 1/4 |
| Combat level | 5 → 3 | 5 → 4 | 5 → 4 |
| Attack | 6 → 2 | 6 → 2 | 6 → 2 |
| Strength / Defence | 1/1 → 1/1 | 1/1 → 2/2 | 1/1 → 2/2 |
| Deaths | 0 → 0 | 1 → 1 | 0 → 0 |
| Retreat decisions | 18 → 0 | 29 → 1 | 10 → 0 |
| Kills | 9 → 7 | 5 → 12 | 5 → 13 |
| Reported food eaten* | 78 → 3 | 96 → 42 | 104 → 4 |
| Wrong-order attempts | 91 → 0 | 0 → 0 | 0 → 0 |
| Coins | 165 → 78 | 58 → 83 | 124 → 166 |

*The baseline's `ate` counter was not an accurate consumption measurement: it included unsuccessful low-health eating attempts during cooldown and omitted preparation meals. The new values are actual items consumed across both paths. Updated total eating attempts were 3, 53 and 4. Do not interpret the apparent food reduction as a precise percentage improvement. A regression separately verifies rejected cooldown attempts do not count as consumption.*

Lower Attack is not a regression in XP rewards: the bot spends less time repeatedly engaging over-levelled enemies and now distributes melee training across Attack, Strength and Defence. The final runs spend substantial time on travel, gathering, cooking and noncombat quest preparation. They do not demonstrate faster main-story completion.

### Additional progress and skills

| Updated result | Seed 11 | Seed 23 | Seed 47 |
| --- | --- | --- | --- |
| The Flooded Seam | 4/8 | 4/8 | 4/8 |
| The Selkie's Skin | 3/8 | 3/8 | 3/8 |
| Other started quests | — | Wolves 1/5, Bucca 2/7, Wreckers 1/5 | Wolves 1/5, Bucca 1/7 |
| Woodcutting | 5 | 18 | 9 |
| Mining | 16 | 2 | 12 |
| Fishing / Cooking | 8/14 | 10/15 | 8/11 |
| Final equipment | Rusty cutlass | Rusty cutlass, bronze arrows | Rusty cutlass, brass ring |

The original runs ended mostly with a rusty cutlass (seed 47 also had a bronze helm). The new runs still lack a deliberate equipment-upgrade plan. Bronze ammunition found as loot does not improve a melee weapon.

## Remaining progression blockers

**Main-story readiness:** final combat levels 3–4 remain below the existing recommendations for Bell (12), Knock (16), the Flooded Seam (14), and the Selkie combat stage (20). The script now defers these stages rather than repeatedly feeding a low-level character into them. Consequently, no full one-hour run reached Knock's ordered marker sequence in the final version. Its completion, partial-resume and decoy handling are proven by dedicated real-game simulation regressions at prepared levels. Zero wrong-order attempts in a run that never attempts the puzzle is not itself proof of the fix.

**Equipment planning:** `equipUpgrades` only equips items already in the inventory. The bot does not proactively buy or craft combat upgrades; `obtain` is driven by quest item requirements. All three finish with enough coins to buy a bronze cutlass at Bracken's existing 44-coin price, but keep their rusty one. This remains a test-agent limitation, not evidence that the equipment economy is inaccessible to a player. A future preparation planner should use real shop/crafting requirements and competing resource needs, rather than grant equipment or lower requirements.

**Training allocation:** the bot mixes activities in eight-minute periods and prioritizes available quests. It is not a focused combat-training benchmark. Balanced melee training now works, but the hour does not deliver combat 12–16. The results support investigating how the game communicates a useful preparation plan; they do not justify raising combat XP or reducing boss requirements to force a one-hour win.

**Real risk remains:** seed 23 still died once at 40m39s during travel/preparation. Lower-level training selection does not guarantee safe routes through the persistent world. The retreat fix prevents the bot cancelling its own escape; it does not confer immunity or remove environmental danger.

**Coverage beyond Bellwether:** the controller still lacks some advanced behavior, including a complete naval-quest planner and general reasoning for unordered search puzzles. These sessions do not validate a complete campaign. Existing unit tests exercise regional content and boss balance, but that is distinct from end-to-end player progression.

## Validation

- **Complete suite:** `npm test -- --maxWorkers=2` passed **307 tests across 39 files**, including 14 new controller regressions. These cover puzzle order, partial flags, decoys, unordered spots, retreat persistence, actual travel to safety under pursuit, recovery, death accounting, existing combat recommendations, stance selection, distant training targets, gathering activity reconsideration, actual food consumption, and seeded decisions.
- **Production build:** `npm run build` passed, including the application's TypeScript check. Vite retains its pre-existing warning about chunks larger than 500 kB. A separate strict TypeScript check of the extracted controller also passed.
- **Browser save/favicon regressions:** passed against development and the actual production build served under `/shattered-reef/`. Storage rejection never confirms success; a normal write persists and confirms; the declared favicon returns HTTP 200 with SVG content from the correct deployment prefix.
- **Laptop/phone browser smoke:** both passed with no page/console errors. Movement was 4.6 m / 4.83 m. Inventory and credits worked at both sizes; desktop dialog, quest advancement, crafting station, close-button hit area, shop, tabs and NPC picking assertions all passed.
- **Three one-hour simulations:** all completed successfully with results above. Repeating seed 23 produced byte-identical output, including quest timeline and metrics. Historical baselines used unseeded `Math.random` for some bot choices, so a fixed world seed alone could not reproduce their exact decisions.
- **Regression evidence:** puzzle/retreat, save/favicon, preparation, death accounting, food/seeded decisions, distant targets and chained-node gathering tests were observed failing against the corresponding buggy behavior before their fixes. One initial production favicon check hit its overly short two-second DOM-query deadline under software-rendering load; the test now captures the static icon declaration before starting the game loop, then checks the real served asset. Production checks passed after this test-harness correction.
- **Independent read-only code review:** no blocking defect identified. Its request for a simulation-driven retreat coverage improvement was addressed with the additional pursuit-to-safety test. No merge was performed.

Real-device Safari behavior, audible sound quality and hardware frame-rate benchmarking were not evaluated. Software-rendered browser timings should not be treated as player-device performance measurements.
