# Shattered Reef: project log

Reflects the actual repository, not the roadmap.

## Status (2026-10-23)

**Stage:** art direction (style test). Waiting for Tom's choice of look.

### Decisions
- **Art direction:** the toy-style 2D brief section is rejected. New direction: low-poly real-time 3D, fixed 3/4 overhead camera (~54°), between RuneScape (shapes, readability) and Diablo (lighting, mood). All art is built in code from primitives; no AI-generated images.
- **Stack:** TypeScript + Vite + Three.js (WebGL). Static hosting (GitHub Pages).
- **Legacy prototype:** `index.html` (single-file Canvas 2D mock-up) is kept as a reference only. It has no collision, separate island/sea/dungeon screens, an unversioned save and broken ship images. It will move to `/legacy` when the rebuild starts.

### What exists
| Path | What it is |
|---|---|
| `style-test.html`, `src/styletest/main.ts` | Style-test scene: Bellwether quay, dock, sloop, player, reef crabs, shack, trees, ore rock. Two looks (A bright, B moody), drag to orbit, pinch/scroll to zoom. URL params: `look`, `zoom`, `ui=0`, `t` (freeze time). |
| `src/art/looks.ts` | Lighting, fog, grade and ground/water palettes per look. |
| `src/art/materials.ts` | Central colour palette (`PAL`), cached flat-shaded materials, `jitter()` for hand-made-looking forms. |
| `src/art/terrain.ts` | Heightfield coastline with per-face colours, exact `heightAt()` for placement. |
| `src/art/water.ts` | Faceted water shader: depth colour, shoreline foam, sun glint. Depth baked per vertex. |
| `src/art/grade.ts` | Colour grade + vignette post pass. |
| `src/art/models/*` | Sloop, humanoid (jointed, code-animated), reef crab, props (pine, broadleaf, rocks, ore rock, crates, barrels, lantern, shack, dock, rope, grass, buoy). |
| `docs/style-test/*.png` | Reference screenshots of both looks, laptop + phone + close-up. |

### Test results
- `npm run typecheck`: passes.
- `npm run build`: passes (single 600 KB chunk, includes Three.js).
- Headless Chromium (software WebGL): both looks render at 1280×800 and 390×844 with no console errors.
- **Not yet tested on a real phone** (frame rate, heat, battery).

### Known issues / limitations
- Character model is basic; face is hidden by the hat at this camera angle.
- Terrain colour boundaries are jagged (per-triangle colouring). Intentional low-poly look, but may need softening.
- Portrait phone view is narrow (~15 m of world across). Landscape may suit combat better; undecided.
- No shadows on water; water is transparent and sorted after opaque geometry.
- Performance budget not measured. MeshStandardMaterial + PCF shadows + MSAA post may be heavy on low-end phones; plan a quality setting.

### Next
1. Tom picks look A, B, or a blend.
2. Rewrite the art section of the design brief to match.
3. Stage 2: playable world foundation (movement, collision, touch + click input) in the new stack.
