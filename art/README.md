# Shattered Reef art

Every asset in the game as a PNG you can edit. Change a file, save it, and the game uses your version.

| Folder | What | In the game, your PNG becomes |
|---|---|---|
| `items/` | weapons, armour, tools, food, materials (364) | the icon in the pack, shop, bank and equipment |
| `creatures/` | every enemy and boss (25) | a cut-out standing where the creature is |
| `characters/` | you (`player.png`), named people, townsfolk (22) | a cut-out in place of the 3D person |
| `resources/` | trees, rocks, fishing spots, bushes (35) | a cut-out on every one of them in the world |
| `props/` | stations, decor, cave pieces, the ship, buildings (62) | a cut-out in place of the prop |

## How to work

1. Open a PNG, paint, save it under the same name. Keep the background transparent.
2. The game notices: with `npm run dev` open it reloads by itself; a build (`npm run build`, the deploy) picks it up.
3. To undo, put the original back (`git checkout art/items/bread.png`).

Only files you've changed are used: `manifest.json` holds each original's fingerprint (`sha1`), and anything that
still matches it keeps the game's built-in 3D art.

## Tips

- **Size.** Icons are 256 × 256. World assets are cropped to their outline: the bottom edge of the picture is where
  it touches the ground, and its height in the world stays the same as the original (`h` in `manifest.json`, metres).
  You can paint at a bigger size (for example 2× or 4×) as long as the proportions stay the same.
- **Cut-outs are flat.** A redrawn creature or person faces the camera and doesn't animate its limbs, so it reads
  like a sprite in a 3D world (think Paper Mario).
- **Not yet replaceable:** the town buildings (their roofs lift off when you walk in) and fishing spots' ripples.
  Their PNGs are here as reference.
- **Fresh exports.** `node scripts/art-export.cjs` (with `npx vite --port 5173` running) adds PNGs for new assets
  and never overwrites yours; `--force` re-renders everything and does overwrite.
