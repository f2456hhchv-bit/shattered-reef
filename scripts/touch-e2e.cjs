// Real-finger regression test (phone viewport). Usage: node scripts/touch-e2e.cjs  (against `npx vite --port 5173`)
// Synthetic clicks are instantaneous; a real tap holds the finger down ~100-200 ms. This sends CDP touch events with
// explicit OS timestamps for that hold, and forces a game-state change every frame, the worst case for panels that
// re-render. Checks: tapping a tree starts chopping it (log yield is unit-tested); tapping a pack slot opens its details; tapping Eat eats.
const path = require('path');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p);
  const tap = async (x, y, hold = 150) => {
    const ts = Date.now() / 1000; // the emulator renders slowly; the finger is down for `hold` ms regardless
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }], timestamp: ts });
    await p.waitForTimeout(hold);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts + hold / 1000 });
  };
  const center = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const waitGame = async (secs) => { const t0 = await p.evaluate(() => window.__reef.game.time); await p.waitForFunction(([t0, s]) => window.__reef.game.time > t0 + s, [t0, secs], { timeout: 180000 }); };
  await p.goto(process.env.URL || 'http://localhost:5173/');
  await p.waitForFunction(() => window.__reef);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.click('#begin'); await p.waitForTimeout(800); await p.click('#intro');
  await p.waitForSelector('#cont'); await p.click('#cont'); await waitGame(0.5);
  const res = {};

  // 1) tap a tree
  const tree = await p.evaluate(() => { const r = window.__reef, g = r.game, n = g.nodes.find((n) => n.def === 'tree_pine' && !g.enemies.some((e) => Math.hypot(e.x - n.x, e.z - n.z) < 25)); const q = g.world.nearestWalkable(n.x + 3, n.z + 2, 6); g.p.x = q[0]; g.p.z = q[1]; r.renderer.snapCamera(); return { x: n.x, z: n.z }; });
  await waitGame(0.3);
  const ts = await p.evaluate((n) => { const r = window.__reef; return r.renderer.project(n.x, r.game.world.ground(n.x, n.z) + 0.9, n.z); }, tree);
  await tap(ts.x, ts.y);
  await waitGame(3);
  res.chopping = await p.evaluate(() => window.__reef.game.action?.type === 'gather'); // the tap registered

  // 2) pack slot + Eat while the game changes every frame
  await tap(...Object.values(await center('#tabs button')), 120);
  await p.evaluate(() => { const g = window.__reef.game; const f = () => { g.rev++; requestAnimationFrame(f); }; f(); });
  await p.waitForFunction(() => document.querySelector('[data-slot="3"]'), null, { timeout: 60000 });
  let opened = 0;
  for (let k = 0; k < 3; k++) {
    const at = await center('[data-slot="3"]');
    // what is actually under the finger (the intermittent 0/3 failure: record it, so the next one names its cause)
    const under = await p.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}.${el.className}`.slice(0, 60) : null; }, at);
    await tap(...Object.values(at), 160);
    await p.waitForTimeout(1500);
    if (await p.evaluate(() => !!window.__reef.ui.pop)) opened++; else (res.missed ??= []).push({ under, card: await p.evaluate(() => document.querySelectorAll('.lvup').length), hp: await p.evaluate(() => window.__reef.game.p.hp) });
    await p.evaluate(() => window.__reef.ui.closePop());
  }
  res.slotTaps = `${opened}/3`;
  await p.evaluate(() => { window.__reef.game.p.hp = 4; });
  await tap(...Object.values(await center('[data-slot="3"]')), 160);
  const popped = await p.waitForSelector('#itempop [data-a="use"]', { timeout: 8000 }).then(() => true, () => false);
  if (!popped) {
    res.diag = await p.evaluate(() => { const u = window.__reef.ui, pop = document.getElementById('itempop'); return { pop: u.pop, popHtml: pop ? pop.outerHTML.slice(0, 400) : null, slot: !!document.querySelector('[data-slot="3"]'), inv3: window.__reef.game.p.inv[3], hp: window.__reef.game.p.hp, dead: window.__reef.game.dead }; });
    console.log(JSON.stringify(res)); await b.close(); process.exit(1);
  }
  const before = await p.evaluate(() => window.__reef.game.p.inv[3]?.qty);
  await tap(...Object.values(await center('#itempop [data-a="use"]')), 180);
  await p.waitForTimeout(1500);
  res.ate = (await p.evaluate(() => window.__reef.game.p.inv[3]?.qty ?? 0)) === before - 1;
  res.errors = errs;
  console.log(JSON.stringify(res));
  await b.close();
  if (!res.chopping || opened < 3 || !res.ate || errs.length) process.exit(1);
})();
