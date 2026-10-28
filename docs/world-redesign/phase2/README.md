# Bellwether Phase 2 — playable prototype

28 October 2026. Branch `design/bellwether-phase2`, based on `45fdc3e` (`design/bellwether-phase1`).

**The authored island is integrated and playable. Full environmental-art acceptance is incomplete.** This is an opt-in variant of the actual game, with normal gameplay and persistent progress. It is not a concept-image substitute. The approved pine remains active after replacement trials failed visual review. New oak branchwork, matte rocks/ore, building construction details and a physical northeastern cliff are implemented, but this is not yet the professionally finished environment standard requested in the brief.

To play locally:

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Open the server with **`?bellwether=phase2`**. Use `?bellwether=classic` for the original game. Without an explicit selection the default is classic. `VITE_BELLWETHER_REDESIGN=1` also enables the variant for simulation/testing; the explicit classic URL overrides it. No other islands or settlement names are redesigned. Nothing is merged into main.

## What is implemented

- **Exact Phase 1 coast:** the original 621×621 float32 field and 768-point outline drive Bellwether terrain, shoreline-dependent appearance, collision, navigation and sea chart. SHA256 of decoded field is `fedbf5ece5ca145bf329aa88ebd91856b225d19b7f14fd4288fbbf221e1134b2`, identical to Phase 1. No mainland-area increase beyond the approved prototype's 531,040 m². Existing hills, roads, freshwater lagoon and separate western islet remain; a small authored 12 m northeastern cliff adds a real collision surface, not a painted cliff.
- **Coordinated coastal content:** Wreckers' Point, Gull, quest lantern, shore resources and harbour anchors are usable. All 111 town-building footprints remain at their classic positions. The re-authored dock has head Z351 and mooring `(0.6,355.65)`.
- **Stable gathering identities:** all 4,284 resource UIDs, types and seeds are retained. 363 positions move more than 0.1 m, including shoreline-aligned fishing/salvage and affected land nodes. The largest movement is about 152 m. No XP, yield, equipment requirement, price or reward adjustment. The classic node manifest is a compatibility contract; future intentional content changes must update it deliberately.
- **Encounter preservation:** Gnasher's lair moves to clear southeastern water, retaining the original five-reef cover arrangement. Initially removing that cover made the existing Sailing-18 test lose all six fights; restoring its encounter geometry returns the classic result of 6/6 wins at 18 and 0/6 at 10. Enemy stats, damage, XP and progression rates are unchanged.
- **Scoped art:** custom swept/branching oak geometry, smooth erosion-profile rocks and ore, settled roof courses, bargeboards, shutters, eave brackets and chimney coping, plus stone bedding on the exposed northeastern terrain. Building interiors and roof lifting remain operational. Only the opted-in Bellwether renderer selects these assets. Original approved asset files remain untouched.

The previous 22% mainland-area increase has not been filled by extra resources or extra rewards. Keeping existing progression anchors and all resource identities avoids encouraging a longer compulsory circuit. The added perimeter remains exploratory space. No claim is made that every additional metre is already interesting: authored landmarks and a longer human exploration assessment remain necessary before generalising this island to the rest of the world.

## Save protections

Prototype storage uses `shattered-reef.save.bellwether-phase2-v1`. On first entry it can read the original `shattered-reef.save`, then saves only into its own slot. Classic progress is not overwritten. A real browser save/reload also retained Mining XP 1234, Bell stage 2, 125 coins and a sentinel flag; see [browser-reload.json](browser-reload.json). A new prototype voyage writes a fresh prototype save rather than deleting it and accidentally re-importing the classic voyage.

An idempotent geometry marker migrates coordinates without resetting XP, inventory, equipment, coins, quests, flags, discoveries, bank, crew, collections or ship upgrades. A player on unsafe/disconnected mainland moves to reachable ground; a valid separate-islet position is retained. Ship, aboard player, active wanted-contract targets, board offers and treasure coordinates are checked against their required land/water access. Other-region positions remain unchanged. The historical 4.5× coordinate migration is not repeated.

Independent review found that the initial migration's 3 m water-clearance check could leave a ship's bow on land. The final implementation shares the exact eight-point hull footprint with normal sailing, respects the saved heading, and has a regression that loads the reported legacy position and actually sails away. A dock-aligned fallback heading is used when necessary. Normal gameplay collision is unchanged.

## Actual game screenshots

These are captures of the production build in Chromium. Review locations are staged through the existing debug handle in a fresh test context; movement/gathering/sailing assertions are separately exercised through actual Game APIs. Close views retain the game's north-up camera. The whole-island shot uses the same 54° pitch with a distant review camera, fog removed and all terrain temporarily streamed; it is not the normal mobile draw workload. No generated image is presented as a game screenshot.

| View | Capture |
|---|---|
| Whole island | [island overview](screenshots/island-overview.png) |
| Harbour and landing | [harbour](screenshots/harbour.png) |
| Settlement | [settlement](screenshots/settlement.png) |
| Forest | [forest](screenshots/forest.png), [oak grove](screenshots/oak-grove.png), [classic comparison](screenshots/forest-classic.png) |
| Rocks and ore | [quarry](screenshots/rocks.png) |
| Physical cliff | [cliffs](screenshots/cliffs.png) |
| Beach and water transition | [beach](screenshots/beach.png) |
| Phone-sized layout | [390×844 gameplay](screenshots/mobile.png) |
| Actual in-game map silhouettes | [old](screenshots/silhouette-old.png), [new](screenshots/silhouette-new.png) |

Reproduce with `npm run build`, `npm run preview -- --host 0.0.0.0 --port 5175`, then `node scripts/bellwether-browser.cjs`. The script uses the environment's installed Playwright/Chromium; `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `REEF_BROWSER_URL` are configurable. These are review tools, not runtime dependencies.

## Art decisions and limitations

Rendered review rejected the first custom pine's repeated pointed ornaments. A second swept-branch design removed the conelets but its flat fans read as oversized leaves rather than convincing conifer foliage. Its experimental mesh remains available for iteration; the renderer retains the approved pine. Geometry tests alone did not establish visual quality.

An image-generation tool was also used for one isolated transparent pine trial with approved pine/harbour references. It was evaluated as a staged sprite inside the actual renderer, not promoted through art overrides. It remains too faceted, differently shaded and inconsistent in apparent perspective. [Trial render](experiments/pine-sprite-in-game.png) and [source](experiments/pine-sprite-trial.png) are explicitly rejected experiments. They do not ship as production tree replacements.

The oak's visible branch forks and spreading canopy are a modest improvement over the original merged masses, although crowns still look cushion-like. Rock forms are smoother and matte rather than crystalline, but their repetition and sparse ore seams do not yet achieve convincing outcrop geology. Settlement changes improve construction detail while preserving footprint/interior behavior; roofs are still broad plain planes. The cliff is physically real, but its smooth cap, relatively uniform face and sandy rim still need authored erosion and material-transition work. No bulk asset replacement occurred.

Active new model budgets: oak 2,112 triangles, rock 280, ore 600; the rejected experimental pine is 2,576. Scenery keeps two shape variants and vertex-colour instancing in the existing spatial buckets. Source mesh/material counts do not become per-tree draw calls. No giant texture atlas, transparent forest sprites or unreviewed asset pack was installed.

## Testing and review

Fresh final checks ([command output](verification.txt)):

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` (classic default) | 334 passed, 10 variant-only skipped; 45 files |
| `VITE_BELLWETHER_REDESIGN=1 npm test` | 344 passed; 45 files |
| `npm run build` | Pass; existing large-chunk warning remains |
| Independent whole-branch review | One important hull-migration failure found, reproduced RED, fixed GREEN with actual sail-away regression |

The 10 game interaction tests exercise real walking endpoints, woodcutting/mining/fishing item and XP rewards, mining ores through bronze smelting, banking, shop purchases, relocated lantern quest progression, Gull/Muirne/Dougal conversations, a combat kill, boarding, harbour departure/return/landing, cave round trip and sailing to Sunreach and back. Fixtures disable roaming combat for isolated navigation checks and give the combat fixture levels; they are regression tests, not claims of an unassisted player playthrough or progression-balance evaluation.

Geometry/save tests cover the exact shoreline, lagoon, islet resources, full town footprint, stable node identities, coastal endpoints, Gnasher encounter space, physical cliff height, storage isolation, unsafe legacy player/ship positions, full hull sailing after migration, progression round trips, contract/treasure access, valid-islet preservation and other-region positions. New behavioral tests were observed failing before implementation/corrections.

Independent probes also flood-filled the real walk grid: all 4,278 non-ship resource nodes had connected interaction candidates using the production interaction sampling; all six ship resources had exact reachable sailing endpoints. This goes beyond merely checking for a non-null, potentially partial path.

An initial attempt to run build and both suites concurrently exposed a pre-existing art-sync output-directory race. Verification was rerun sequentially; the final results above are from clean, completed commands. This phase does not change the unrelated art-sync workflow.

## Performance and acceptance

See [browser-metrics.json](browser-metrics.json) for raw measurements. Measurements use Linux headless Chromium and **SwiftShader software rendering**, fresh browser contexts, local production serving, DPR1 and Battery Saver. They are not real phone hardware measurements, not a remote-network load test, and not a statistical benchmark. Main-loop dt is capped, so actual wall-frame intervals are measured separately rather than inferring FPS from the simulation dt or a stopped quality governor.

Core height/navigation grids remain 13,169,796 bytes, and the added field is 1,542,564 bytes. A standalone variant layout build measured about 3.3 s on this cloud CPU. The initial monolithic bundle grew to 3.72 MB; conditional data chunks bring classic main JavaScript back to about 992 KB/321 KB gzip. Opted-in sessions additionally fetch the exact field (~995KB gzip), node manifest (~203KB) and outline (~15KB). Classic does not request those chunks. Prototype loading/memory still warrants further work before a mobile release.

Browser timing, draw-call/triangle, heap and touch-response figures are reported separately in the raw file and the generated measurement table below. CPU submission time excludes asynchronous GPU work. `performance.memory` is a browser estimate, not a peak resident-memory measurement. Overview capture is excluded from gameplay performance samples. Software-GPU touch response is too slow to certify mobile responsiveness; only real PointerEvent movement/release and layout function are established here.

**Remaining acceptance gates:** professionally authored conifer/tree crowns and outcrop/cliff finish; stronger coastal material transitions; purposeful use of the extra perimeter; real iOS/Android frame-time, loading, memory and touch tests. The playable geography and compatibility work is delivered. Full professional-art and mobile-performance acceptance is explicitly not claimed.


Measured samples from the final production build (20 initial-quay frames per fresh context; all Battery Saver/DPR1):

| Mode / viewport | Boot to started | Wall FPS | CPU submission median / p95 | Last-frame calls / triangles | Estimated JS heap |
|---|---:|---:|---:|---:|---:|
| phase2 /1280×800 | 12.41s | 1.45 | 8.8/16.6ms | 53/172,758 | 205MB |
| classic /1280×800 | 10.31s | 1.40 | 9.6/18.3ms | 90/173,174 | 183MB |
| phase2 /390×844 | 10.64s | 3.40 | 30.9/85.6ms | 81/173,158 | 216MB |

Phone-sized native PointerEvent movement/release passed, with 0.92m movement and 930ms measured wall response in this software-rendered session. That latency is poor; it is evidence against signing off responsiveness here, not a mobile-performance success. No page JavaScript errors were recorded. Prototype sessions fetched three optional data chunks; classic fetched none. Single-context cold starts/cache order and software GPU variation prevent attributing the timing differences solely to the redesign.

Navigation CPU samples (one layout build, eight walk and three sailing endpoint queries; all reached within 2 m):

| Mode | Layout build | Walk-query range | Sea-query range |
|---|---:|---:|---:|
| classic | 2117ms | 5.85–71.69ms | 0.18–7.36ms |
| phase2 | 3214ms | 5.91–33.92ms | 0.16–6.34ms |

These are different geographic routes, not an algorithm-speed comparison. The prototype layout build is slower. Reproduce with `node_modules/.bin/vite-node scripts/bellwether-nav-bench.ts` in classic and with `VITE_BELLWETHER_REDESIGN=1`; raw outputs are `navigation-classic.json` and `navigation-phase2.json`.
