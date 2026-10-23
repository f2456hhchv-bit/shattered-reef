// Visual tour: teleports to key places and composes one contact sheet. Usage: node scripts/tour.cjs out.png [w h]
const path = require('path');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const out = process.argv[2] || 'tour.png';
const W = +(process.argv[3] || 960), H = +(process.argv[4] || 600);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForFunction(() => window.__reef);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} window.__reef.start(); window.__reef.ui.sideOpen = false; window.__reef.ui.layout(); });
  const scenes = ['quay', 'forest', 'hills', 'camp', 'ruin', 'sea', 'strand'];
  const shots = [];
  for (const sc of scenes) {
    await p.evaluate((sc) => {
      const r = window.__reef, g = r.game, L = g.layout;
      const go = (x, z) => { const q = g.world.nearestWalkable(x, z, 6); g.p.x = q[0]; g.p.z = q[1]; };
      if (g.p.onShip) { g.p.onShip = false; }
      if (sc === 'quay') go(L.respawn.x, L.respawn.z + 6);
      if (sc === 'forest') { const n = L.nodes.find((n) => n.def === 'tree_pine'); go(n.x + 2, n.z + 2); }
      if (sc === 'hills') { const n = L.nodes.find((n) => n.def === 'rock_copper'); go(n.x + 1.5, n.z + 1); }
      if (sc === 'camp') { go(L.buildings.find((b) => b.kind === 'tent').x - 6, L.buildings.find((b) => b.kind === 'tent').z + 6); }
      if (sc === 'ruin') { g.give('tuning_bell', 1); go(L.plinth.x, L.plinth.z + 1.6); g.interact('ruin'); }
      if (sc === 'sea') { const s = L.nodes.find((n) => n.def === 'spot_bell'); g.ship.x = s.x + 5; g.ship.z = s.z; g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z; g.shipSpeed = 4; }
      if (sc === 'strand') { const c = g.enemies.find((e) => e.def.id === 'reef_crab'); go(c.x + 2, c.z - 1); }
      r.renderer.snapCamera();
    }, sc);
    const t0 = await p.evaluate(() => window.__reef.game.time);
    await p.waitForFunction((t0) => window.__reef.game.time > t0 + (1.2), t0, { timeout: 120000 });
    shots.push({ sc, img: (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64') });
  }
  const sheet = await b.newPage({ viewport: { width: W * 2, height: Math.ceil(shots.length / 2) * H / 1 } });
  await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:1fr 1fr;background:#000">${shots.map((s) => `<div style="position:relative"><img style="width:100%;display:block" src="data:image/jpeg;base64,${s.img}"><b style="position:absolute;left:8px;top:6px;color:#fff;font:700 20px sans-serif;text-shadow:0 0 4px #000">${s.sc}</b></div>`).join('')}</body>`);
  await sheet.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 70 });
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
