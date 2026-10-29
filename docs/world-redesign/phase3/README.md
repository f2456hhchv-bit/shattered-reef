# Bellwether Phase 3: environment art prototype

This is an integrated, playable art pass on `design/bellwether-phase2`. It covers the quay and the verge west of Harbour Goods. The environment-art milestone remains in progress; it has not been merged into `main`.

## Implemented in the game

- Three liftable roof assemblies give Harbour Goods, the Chart House and Reed's Tackle distinct coastal silhouettes. Walls, entrances, interiors and their simulation collision remain the existing versions.
- The old quay shader pattern is replaced locally by a single vertex-coloured mesh of shallow bevelled setts. The layout uses deterministic irregular sites, clipped stone cells and a curved edge into compacted earth. It adds no texture or per-stone draw calls. The settlement's walk grid, collision, doors, NPC routes, resource nodes, quests and saves are untouched.
- A raised salt-oak crown is carried by visible forked boughs. Erosion rocks, salt shrubs and curved grass fans remain composed along the west verge. Their placements retain the existing navigation clearance.
- The current player model and its basic pivot animations are unchanged. A reusable skeletal GLB character and equipment pipeline is the following character milestone, after this environment section is reviewed.

## Visual evidence

The screenshots in [evidence](evidence) show the running game, not concept art. Compare the Phase 2 `before-*` files with `after-quay-desktop.png`, the three building close-ups, `after-verge.png` and `after-quay-mobile.png`. The capture tool is [bellwether-phase3-browser.cjs](../../../scripts/bellwether-phase3-browser.cjs).

The roofs and paving now have distinct in-game geometry, and the tree silhouette is taller and less disk-like. The current camera still shows a cellular stone rhythm; review the paving and overall art cohesion on the iPhone before treating this as the new standard. The surrounding settlement, player character, other buildings and wider terrain are outside this prototype.

## Performance and validation

Headless Chromium with SwiftShader is a software-rendering check, not a physical-device FPS measurement. The published preview baseline and the local updated build were captured at the same mobile-emulation viewport after 12 seconds of scene settling:

| Mobile-emulated capture | Draw calls | Triangles | Median renderer CPU |
| --- | ---: | ---: | ---: |
| Published preview before this change | 392 | 386,569 | 70.7 ms |
| Local updated preview | 390 | 421,654 | 149.7 ms |

The renderer timing is variable under SwiftShader, but this sample is slower and carries about 35,000 more visible triangles. The prototype has not been measured on the owner's iPhone; its 60 FPS target remains unverified. Check the updated preview on-device before approving the art pass.

Validation completed locally: `VITE_BELLWETHER_REDESIGN=1 VITE_BELLWETHER_PREVIEW=1 npm test` passed 358 tests in 49 files; the TypeScript and production build passed; the desktop and mobile-emulated captures reported no browser errors. Existing navigation tests cover Bellwether reachability, NPCs, stations, doors, sailing, landing and cave access. The new paving test checks deterministic placement, building clearance, geometry validity and its single-mesh batch.

The separate public preview is [available here](https://f2456hhchv-bit.github.io/shattered-reef-bellwether-preview/), built from commit `ff6fa77`. Its mobile-emulated browser check verified touch calibration, 0.46 m of player movement, walkable ground, pointer release, save/reload persistence and isolation from the production save keys, with no same-origin asset failures or JavaScript errors. The captured screen and full result are in [public-preview-final](evidence/public-preview-final/). This check uses Chromium touch emulation, not physical iPhone Safari.
