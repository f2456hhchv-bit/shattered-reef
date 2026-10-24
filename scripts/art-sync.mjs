// Finds the PNGs in art/ that you've edited (their hash no longer matches art/manifest.json) and copies them to
// public/art-overrides/ with an index the game reads at start-up. Runs from vite.config (dev and build).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function syncArt(root) {
  const art = path.join(root, 'art'), out = path.join(root, 'public', 'art-overrides');
  const manifest = path.join(art, 'manifest.json');
  fs.rmSync(out, { recursive: true, force: true });
  if (!fs.existsSync(manifest)) return 0;
  const { assets } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const index = {};
  for (const a of assets) {
    const src = path.join(art, a.file);
    if (!fs.existsSync(src)) continue;
    const bytes = fs.readFileSync(src);
    if (crypto.createHash('sha1').update(bytes).digest('hex') === a.sha1) continue; // untouched: the game keeps its own art
    fs.mkdirSync(path.join(out, a.kind), { recursive: true });
    fs.writeFileSync(path.join(out, a.file), bytes);
    (index[a.kind] ??= {})[a.id] = { file: `art-overrides/${a.file}`, h: a.h, w: a.w };
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
  return Object.values(index).reduce((n, k) => n + Object.keys(k).length, 0);
}
