# Bellwether Phase 3: environment art prototype

This is an integrated, playable art pass on `design/bellwether-phase2`. It covers the quay and the verge west of Harbour Goods. The environment-art milestone remains in progress; it has not been merged into `main`.

## Implemented in the game

- Three liftable roof assemblies give Harbour Goods, the Chart House and Reed's Tackle distinct coastal silhouettes. Walls, entrances, interiors and their simulation collision remain the existing versions.
- The old quay shader pattern is replaced locally by a single vertex-coloured mesh of shallow bevelled setts. The layout uses deterministic irregular sites, clipped stone cells and a curved edge into compacted earth. It adds no texture or per-stone draw calls. The settlement's walk grid, collision, doors, NPC routes, resource nodes, quests and saves are untouched.
- A raised salt-oak crown is carried by visible forked boughs. Erosion rocks, salt shrubs and curved grass fans remain composed along the west verge. Their placements retain the existing navigation clearance.
- A first Bellwether player-character prototype now uses a Blender-authored, skinned GLB with a reusable rig, hand attachment points and detachable equipment layers. It is gated to the separate preview build and Bellwether; the classic production build keeps its existing player renderer.

## Character prototype

The 464 KB GLB has 29 skinned meshes (31 total, including its shadow proxy) and nine clips: idle, walk, run, melee slash, ranged shot, spellcast, hit reaction, work and fishing. The renderer blends those clips from movement speed, gathering/crafting state and real combat events. Melee, ranged and spell animations are one-shots; a player-hit event selects the hit reaction. A GLB load failure falls back to the existing character.

Equipment visibility follows the equipped item IDs without changing inventory records, stats, combat rules or save data. The prototype includes deckhand clothing, a shell guard set, a differently cut snakeskin set, headwear, gloves, boot cuffs, a cape layer, cutlass and round shield. The cutlass and shield are bound to the right and left hand joints. Other weapon/off-hand families keep the current renderer until additional authored attachments are ready. NPCs remain unchanged for this first player-only review.

| In-game capture | Evidence |
| --- | --- |
| Idle / deckhand | [idle screenshot](evidence/character/deckhand-idle.png) |
| Guard armour with cutlass and shield | [equipped screenshot](evidence/character/harbourguard-sword-shield.png) |
| Alternate snakeskin set | [set-change screenshot](evidence/character/snakeskin-set.png) |
| Actual game attack event | [melee screenshot](evidence/character/melee-slash.png) |
| Walking / running / stopped | [walking](evidence/character/walking.png), [running](evidence/character/running.png), [stopped](evidence/character/stopped.png) |
| Short capture | [1.33 second gameplay recording](evidence/character/character-gameplay.mp4) |

The capture uses a 390×844 mobile Chromium context with SwiftShader, not physical iPhone Safari. It reports 31 meshes, 29 skinned meshes, all nine clips, upright head-to-foot separation at 0° and 90° yaw, visible guard/ranger gear layers, an accepted live-game melee method call that emitted `swing`, Walk from partial movement, Run from full-speed movement on clear ground, and no browser errors or failed requests. The screen captures are review evidence, not proof of 60 FPS, foot-placement quality or iOS compatibility. The model is an early stylised prototype: review face readability, armour silhouette, weapon grip and animation weight on an actual phone before approving it as the standard. The hit reaction and ranged/magic clips have code and asset coverage but have not yet been captured in a human play session.

## Visual evidence

The screenshots in [evidence](evidence) show the running game, not concept art. Compare the Phase 2 `before-*` files with `after-quay-desktop.png`, the three building close-ups, `after-verge.png` and `after-quay-mobile.png`. The capture tool is [bellwether-phase3-browser.cjs](../../../scripts/bellwether-phase3-browser.cjs).

The roofs and paving now have distinct in-game geometry, and the tree silhouette is taller and less disk-like. The current camera still shows a cellular stone rhythm; review the paving and overall art cohesion on the iPhone before treating this as the new standard. The surrounding settlement, other buildings, NPCs and wider terrain are outside this prototype.

## Performance and validation

Headless Chromium with SwiftShader is a software-rendering check, not a physical-device FPS measurement. The published preview baseline and the local updated build were captured at the same mobile-emulation viewport after 12 seconds of scene settling:

| Mobile-emulated capture | Draw calls | Triangles | Median renderer CPU |
| --- | ---: | ---: | ---: |
| Published preview before this change | 392 | 386,569 | 70.7 ms |
| Local updated preview | 390 | 421,654 | 149.7 ms |

The renderer timing is variable under SwiftShader, but this sample is slower and carries about 35,000 more visible triangles. The prototype has not been measured on the owner's iPhone; its 60 FPS target remains unverified. Check the updated preview on-device before approving the art pass.

Validation completed locally: the full preview test suite passed 366 tests in 51 files; TypeScript and the production build passed. New tests cover the function-specific facades, equipment visibility and loadout fallback, skeletal asset/clip presence, hand-side equipment bounds and the GLB's Y-up root basis. Existing navigation tests cover Bellwether reachability, NPCs, stations, doors, sailing, landing and cave access. The paving test checks deterministic placement, building clearance, geometry validity and its single-mesh batch.

The separate public preview is [available here](https://f2456hhchv-bit.github.io/shattered-reef-bellwether-preview/), built from commit `ff6fa77`. Its mobile-emulated browser check verified touch calibration, 0.46 m of player movement, walkable ground, pointer release, save/reload persistence and isolation from the production save keys, with no same-origin asset failures or JavaScript errors. The captured screen and full result are in [public-preview-final](evidence/public-preview-final/). This check uses Chromium touch emulation, not physical iPhone Safari.
