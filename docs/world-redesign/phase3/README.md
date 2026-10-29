# Bellwether Phase 3: first integrated environment art pass

This is an **in-progress art pass**, not Phase 3 acceptance. The first section is Bellwether Quay: Harbour Goods, the Chart House, Reed's Tackle, and the verge west of the store. The starting island's geometry, town collision, door points, interiors, resources, quest positions, and save format remain the Phase 2 versions.

## What is in the game

- Three liftable roof assemblies now have separate silhouettes: Harbour Goods has a weathered curved cedar gable with filled ends; the Chart House has a shallow hip and observation lantern; Reed's Tackle has a low swept salt-shed roof. The original enterable interiors and simulation walls remain.
- One harbour oak uses a new branch-led low canopy with darker matte foliage. A few sculpted erosion rocks and salt shrubs are composed along the verge, with collision and road clearance checked before placement. Curved grass fans replace the old cone tufts in the nearby streamed cells, still using one instanced mesh per cell.
- The player model was inspected but has not been replaced. The existing pivot rig, basic animation functions and equipment tint system remain. The requested skeletal character milestone is subsequent work.

## Visual review

All images in [evidence](evidence) were captured from the **running Three.js game** with the same camera script and comparable staged player positions. The before captures use the published Phase 2 preview; the after captures use the Phase 3 local build. Compare `before-quay-desktop.png` with `after-quay-desktop.png`, each `*-close.png` pair, `before-verge.png` with `after-verge.png`, and the two mobile views. The capture script is [bellwether-phase3-browser.cjs](../../../scripts/bellwether-phase3-browser.cjs).

The new roofs and planting are a visible improvement, but the quay is still dominated by the old polygon paving. Several replacement approaches were rendered and rejected because they read as scattered markers, a grid, or noisy paving; none was retained. The new oak's canopy is better coloured and more open, but it still needs a stronger tree silhouette at the gameplay camera. The repeated neighbouring building shells and the current character also limit the scene's cohesion. **The environment-art milestone is not finished.**

## Performance and gameplay evidence

The same headless Chromium/SwiftShader machine produced these samples at the quay camera. Timing varies widely on software rendering and is not an iPhone FPS measurement.

| View | Version | Draw calls | Triangles | Median renderer CPU |
| --- | --- | ---: | ---: | ---: |
| Desktop | Phase 2 | 257 | 342,992 | 32.7 ms |
| Desktop | Local Phase 3 | 274 | 366,220 | 24.9 ms |
| Mobile emulation | Phase 2 | 290 | 326,116 | 73.6 ms |
| Mobile emulation | Local Phase 3 | 294 | 346,804 | 70.1 ms |

The mobile view adds four calls and about 20,700 visible triangles; it has no new texture. The local renderer reported no browser errors after fixing the grass wind uniform. Phase 2 ran at 60 FPS on the owner's iPhone, but **Phase 3's 60 FPS target is unverified on that device**.

Validation: `VITE_BELLWETHER_REDESIGN=1 VITE_BELLWETHER_PREVIEW=1 npm test` passed 355 tests in 48 files; `VITE_BELLWETHER_REDESIGN=1 VITE_BELLWETHER_PREVIEW=1 npm run build` passed TypeScript and Vite. The separate preview's packaged touch, save/reload and public deployment checks must be repeated after this branch is published.
