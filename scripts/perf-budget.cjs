// Frame-cost budget on a phone screen (390x844 @2x, max quality). Usage: node scripts/perf-budget.cjs  (against `npx vite --port 5173`)
// Visits the busiest places and counts draw calls + triangles per frame (shadow pass included). Software rendering
// can't time a real phone GPU, so these counts are the proxy: fails (exit 1) if any place goes over budget.
const path = require('path');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const BUDGET = { calls: Number(process.env.MAX_CALLS ?? 450), tris: Number(process.env.MAX_TRIS ?? 900000) };
const PLACES = [['quay', 0, 60], ['market', 0, 38], ['inn (inside)', -13, 31], ['saltpine', -36, 20], ['heartwood', -46, -50], ['ironcrag', 2, -42], ['wreck', 0, 0, 'wreck']];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.addInitScript(() => { try { localStorage.setItem('shattered-reef-intro-seen', '1'); } catch {} });
  await p.goto(process.env.URL || 'http://localhost:5173/'); await p.waitForFunction(() => window.__reef, null, { timeout: 120000 });
  await p.evaluate(() => { const r = window.__reef; r.start(); document.body.classList.remove('intro'); r.game.s.settings.quality = 'max'; r.renderer.setQuality('max'); });
  let over = 0;
  for (const [name, x, z, zone] of PLACES) {
    await p.evaluate(([x, z, zone]) => { const r = window.__reef, g = r.game; let px = x, pz = z; if (zone && r.zones?.[zone]) { px = r.zones[zone].x; pz = r.zones[zone].z; }
      const q = g.world.nearestWalkable(px, pz, 8); g.p.x = q[0]; g.p.z = q[1]; g.p.onShip = false; r.renderer.zoom = 1; r.renderer.snapCamera(); }, [x, z, zone]);
    const t0 = await p.evaluate(() => window.__reef.game.time); await p.waitForFunction((t0) => window.__reef.game.time > t0 + 0.6, t0, { timeout: 180000 });
    const info = await p.evaluate(() => new Promise((res) => { const i = window.__reef.renderer.renderer.info; i.autoReset = false; requestAnimationFrame(() => { i.reset(); requestAnimationFrame(() => { const o = { calls: i.render.calls, tris: i.render.triangles }; i.autoReset = true; res(o); }); }); }));
    const bad = info.calls > BUDGET.calls || info.tris > BUDGET.tris;
    if (bad) over++;
    console.log(`${bad ? 'OVER' : 'ok  '} ${name.padEnd(14)} calls ${String(info.calls).padStart(4)}  tris ${String(info.tris).padStart(8)}`);
  }
  console.log(`budget: ${BUDGET.calls} calls, ${BUDGET.tris} triangles${over ? ` - ${over} place(s) over` : ' - all within'}`);
  await b.close();
  process.exit(over ? 1 : 0);
})();
