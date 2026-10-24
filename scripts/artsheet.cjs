// Renders the art inventory (scripts/artsheet.ts) in Chromium against `npx vite --port 5173` and saves it as JSON.
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto((process.env.URL || 'http://localhost:5173/') + 'scripts/artsheet.html');
  const data = await p.evaluate(async () => (await import('/scripts/artsheet.ts')).renderAll());
  fs.writeFileSync(process.argv[2] || 'artsheet.json', JSON.stringify(data));
  for (const [k, v] of Object.entries(data)) console.log(k, v.length);
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
  await b.close();
})();
