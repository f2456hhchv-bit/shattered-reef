// Browser smoke test. Usage: node scripts/e2e.cjs [outDir] [--shots]
// Boots the game at laptop + phone sizes, fails on console errors, checks input moves the player.
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const out = process.argv[2] || '.';
const shots = process.argv.includes('--shots');
const URL = process.env.URL || 'http://localhost:5173/';
const sizes = [
  { name: 'laptop', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = 0;
  for (const s of sizes) {
    const p = await b.newPage({ viewport: s.viewport, isMobile: s.mobile, hasTouch: s.mobile, deviceScaleFactor: s.mobile ? 2 : 1 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL);
    await p.waitForFunction(() => window.__reef, null, { timeout: 120000 });
    await p.evaluate(() => { try { localStorage.clear(); } catch {} });
    // first visit: gate -> credits (skipped by a tap) -> title menu
    await p.click('#begin');
    await p.waitForTimeout(1500);
    const creditsRan = await p.evaluate(() => !!document.querySelector('#intro') && !!window.__reef.renderer.cinematic);
    await p.click('#intro');
    await p.waitForSelector('#cont', { timeout: 5000 });
    await p.click('#cont');
    await p.waitForTimeout(1500);
    const before = await p.evaluate(() => ({ x: window.__reef.game.p.x, z: window.__reef.game.p.z }));
    // hold input for 1s of *game* time (software rendering in CI can be very slow)
    const holdSim = async () => { const t0 = await p.evaluate(() => window.__reef.game.time); await p.waitForFunction((t0) => window.__reef.game.time > t0 + 1, t0, { timeout: 90000 }); };
    if (!s.mobile) { await p.keyboard.down('w'); await holdSim(); await p.keyboard.up('w'); }
    else {
      const cx = 195, cy = 420;
      await p.evaluate(([cx, cy]) => {
        const c = document.getElementById('world');
        const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
        ev('pointerdown', cx, cy); ev('pointermove', cx, cy - 30); ev('pointermove', cx, cy - 60);
        window.__stickUp = () => ev('pointerup', cx, cy - 60);
      }, [cx, cy]);
      await holdSim();
      await p.evaluate(() => window.__stickUp());
    }
    const after = await p.evaluate(() => ({ x: window.__reef.game.p.x, z: window.__reef.game.p.z }));
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    const result = { size: s.name, moved: +moved.toFixed(2), errors: errs.slice(0, 5) };
    if (moved < 0.5 || errs.length) failed++;
    // inventory must respond to taps (phone) and clicks (laptop): non-usable item opens the details panel
    await p.evaluate(() => { window.__reef.ui.closeWindows(); window.__reef.ui.selectTab('pack', true); window.__reef.ui.sideOpen = true; window.__reef.ui.layout(); window.__reef.ui.update(0.016); });
    await p.waitForTimeout(300);
    const slot = p.locator('[data-slot="0"]');
    if (s.mobile) await slot.tap(); else await slot.click();
    result.inventoryOpens = await p.evaluate(() => !!document.getElementById('itempop'));
    if (!result.inventoryOpens) failed++;
    await p.evaluate(() => window.__reef.ui.closePop());
    if (shots) {
      await p.screenshot({ path: path.join(out, `game-${s.name}.png`) });
      await p.evaluate(() => window.__reef.ui.selectTab('pack', true));
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(out, `game-${s.name}-panel.png`) });
    }
    if (!s.mobile) {
      // UI flows: talk (dialog), furnace (station window), shop, every tab renders, click-to-pick an NPC
      const flow = await p.evaluate(async () => {
        const r = window.__reef, g = r.game, L = g.layout;
        const out = {};
        const near = (x, z) => { const q = g.world.nearestWalkable(x, z, 4); g.p.x = q[0]; g.p.z = q[1]; };
        const iven = L.npcs.find((n) => n.id === 'iven');
        near(iven.x, iven.z + 1.6);
        g.interact('npc:iven');
        out.dialog = !!document.getElementById('dialog');
        while (r.ui.dialogOpen) r.ui.advanceDialog();
        out.questStage = g.questStage('bell');
        const f = L.stations.find((s) => s.id === 'furnace');
        near(f.x - 1.5, f.z + 1.4);
        g.interact('station:' + L.stations.indexOf(f));
        out.station = !!document.getElementById('stationwin');
        // the close button must be on top and must close the window (a title once covered it)
        { const xb = document.querySelector('#stationwin .x'); const rc = xb && xb.getBoundingClientRect(); out.xOnTop = !!xb && document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2) === xb; }
        r.ui.closeWindows();
        const m = L.npcs.find((n) => n.id === 'marta');
        near(m.x, m.z + 1.6);
        g.interact('npc:marta');
        while (r.ui.dialogOpen) r.ui.advanceDialog();
        out.shop = !!document.getElementById('shopwin');
        r.ui.closeWindows();
        // each tab must show its own content (the map tab once rendered nothing and this didn't notice)
        const expect = { pack: '[data-slot]', gear: '[data-equip]', skills: '.sktile[data-skill]', quests: '.title', map: '#mapbig', settings: '#saveNow' };
        out.tabs = Object.entries(expect).filter(([t, sel]) => { r.ui.selectTab(t, true); r.ui.update(0.016); return !document.querySelector('#content ' + sel); }).map(([t]) => t);
        out.tabs = out.tabs.length ? 'blank: ' + out.tabs.join(',') : true;
        near(iven.x, iven.z + 4);
        return out;
      });
      // let the camera settle on the new spot first (software rendering runs a frame or two a second)
      { const t0 = await p.evaluate(() => window.__reef.game.time); await p.waitForFunction((t0) => window.__reef.game.time > t0 + 2, t0, { timeout: 90000 }); }
      const pos = await p.evaluate(() => { const r = window.__reef, n = r.game.layout.npcs.find((x) => x.id === 'iven'); return r.renderer.project(n.x, r.game.world.standY(n.x, n.z) + 1.3, n.z); });
      await p.mouse.click(pos.x, pos.y);
      await p.waitForFunction(() => !!document.getElementById('dialog'), null, { timeout: 90000 }).catch(() => {});
      flow.clickPickedNpc = await p.evaluate(() => !!document.getElementById('dialog'));
      result.flow = flow;
      if (!flow.dialog || !flow.station || !flow.xOnTop || !flow.shop || flow.tabs !== true || flow.questStage !== 1 || !flow.clickPickedNpc) failed++;
      if (errs.length) failed++;
      result.errors = errs.slice(0, 5);
    }
    result.credits = creditsRan;
    if (!creditsRan) failed++;
    console.log(JSON.stringify(result));
    await p.close();
  }
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
