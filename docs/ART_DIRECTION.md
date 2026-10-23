# Art direction (replaces section 14 of the master brief)

Approved 2026-10-23 by Tom after a side-by-side style test (`docs/style-test/`).

## The look
- **Between RuneScape and Diablo:** RuneScape's chunky low-poly shapes and readability, with real lighting, shadows and atmosphere.
- **Look A "Bright"** is the default: midday sun from the front-left, saturated but not neon, light sea haze. Values live in `src/art/looks.ts` (`LOOK_BRIGHT`).
- **Camera:** fixed 3/4 overhead, 54° pitch, 30° field of view, north up. Zooms, never rotates (keeps joystick directions stable).
- **Rejected:** flat "toy" 2D style, photorealism, painterly textures, AI-generated images.

## How assets are made
- Every model is built in code from primitives (`src/art/models/`), nudged with `jitter()` so nothing looks machine-perfect.
- Flat shading, matte materials, no textures. Detail comes from geometry (planks, shingles, barnacles), not bitmaps.
- One palette: `PAL` in `src/art/materials.ts`. Nothing else picks colours.
- Characters are drawn 1.2× real scale so they read on a phone.
- Teal glow (`#59d0c4`) is reserved for the Locks / mystery (ruin glyphs, Guardian core, Keel's Tooth).
- Item icons are painted in code (`src/ui/icons.ts`) with the same silhouette-first rules and top-left shadow.

## Readability rules
- Enemy attacks always telegraph in red on the ground before they land.
- Elites wear a coloured ring and a name tag; bosses get a top-of-screen health bar.
- Rare drops get a coloured light beam in their rarity colour; rarity is also written as text, never colour alone.
