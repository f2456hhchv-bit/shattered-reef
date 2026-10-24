// Exports every asset as a PNG you can edit: art/<kind>/<id>.png plus art/manifest.json (each file's original hash and
// world size). Edited files replace the game's art (see scripts/art-sync.mjs). Run against `npx vite --port 5173`:
//   node scripts/art-export.cjs            write any asset that has no file yet (never overwrites your edits)
//   node scripts/art-export.cjs --force    re-render everything (overwrites edits: careful)
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.join(__dirname, '..', 'art');
const force = process.argv.includes('--force');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto((process.env.URL || 'http://localhost:5173/') + 'scripts/artsheet.html');
  const data = await p.evaluate(async () => (await import('/scripts/artsheet.ts')).renderAll('files'));
  await b.close();
  const old = fs.existsSync(path.join(ROOT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')) : { assets: [] };
  const prev = new Map(old.assets.map((a) => [a.file, a]));
  const assets = [];
  let wrote = 0, kept = 0;
  for (const [kind, list] of Object.entries(data)) {
    fs.mkdirSync(path.join(ROOT, kind), { recursive: true });
    for (const c of list) {
      const file = `${kind}/${c.id}.png`, abs = path.join(ROOT, file);
      const png = Buffer.from(c.img.split(',')[1], 'base64');
      const fresh = crypto.createHash('sha1').update(png).digest('hex');
      const exists = fs.existsSync(abs), before = prev.get(file);
      let sha1 = fresh;
      if (exists && !force) { sha1 = before?.sha1 ?? fresh; kept++; } // your file stays; the original's hash is what marks it edited
      else { fs.writeFileSync(abs, png); wrote++; }
      assets.push({ kind, id: c.id, name: c.name, group: c.group, file, sha1, h: c.size?.h ?? 1, w: c.size?.w ?? 1 });
    }
  }
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({ note: 'sha1 = the hash of the file as exported. A file whose hash differs is your edit and replaces the game art.', assets }, null, 1));
  console.log(`art/: ${assets.length} assets, ${wrote} written, ${kept} kept as they were`);
})();
