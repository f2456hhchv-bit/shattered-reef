/* Capture the same playable quay scene before/after Phase 3. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/workspace/.dev-tools/lib/node_modules/playwright');
const base = process.env.REEF_ART_URL || 'http://127.0.0.1:5175/';
const out = process.env.REEF_ART_EVIDENCE || '/workspace/game-review/phase3-after';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const result = { url: base, engine: 'Headless Chromium SwiftShader (software GPU), not physical iPhone Safari', views: [], errors: [] };
  try {
    for (const mobile of process.env.REEF_ART_DESKTOP_ONLY ? [false] : [false, true]) {
      const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('pageerror', e => result.errors.push(String(e)));
      await page.addInitScript(() => { localStorage.setItem('shattered-reef-intro-seen.bellwether-phase2-v1', '1'); localStorage.setItem('shattered-reef-intro-seen', '1'); });
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => window.__reef, null, { polling: 250, timeout: 180000 });
      await page.evaluate((mobile) => {
        const a = window.__reef; a.start();
        const g = a.game, r = a.renderer;
        g.stopAction(); g.path = []; g.p.onShip = false;
        const quay = ['store', 'chart', 'tackle'].map(id => g.layout.town.find(b => b.id === id));
        if(quay.some(b => !b)) throw Error('Missing one of the three quay buildings');
        const targetZ = quay.reduce((n,b)=>n+b.z,0)/quay.length;
        const p = g.world.nearestWalkable(0, targetZ, 25);
        if (!p) throw Error('Quay inaccessible');
        [g.p.x, g.p.z] = p;
        r.cinematic = null; r.release = null; r.zoom = mobile ? 1.45 : 1.55; r.camDist = 29 * r.zoom; r.snapCamera();
        g.step(0); a.ui.update(3);
        r.renderer.info.autoReset = false;
        const original = r.frame.bind(r); window.__artFrames = [];
        r.frame = (dt, t) => {
          r.renderer.info.reset(); const start = performance.now(); original(dt, t);
          window.__artFrames.push({ cpuMs: performance.now() - start, calls: r.renderer.info.render.calls, triangles: r.renderer.info.render.triangles });
          if (window.__artFrames.length > 40) window.__artFrames.shift();
        };
      }, mobile);
      await page.waitForTimeout(2200);
      await page.screenshot({ path: path.join(out, mobile ? 'quay-mobile.png' : 'quay-desktop.png'), timeout: 180000 });
      const view = await page.evaluate(() => {
        const frames = window.__artFrames.slice(-12), cpu = frames.map(f => f.cpuMs).sort((a, b) => a - b), r = window.__reef.renderer;
        return { mobile: matchMedia('(max-width: 600px)').matches, geometry: window.__reef.game.s.geometry,
          quayBuildings: window.__reef.game.layout.town.filter(b=>['store','chart','tackle'].includes(b.id)).map(b=>({id:b.id,x:b.x,z:b.z})),
          fpsReported: r.perf.fps, cpuMedianMs: cpu[Math.floor(cpu.length / 2)] ?? null,
          calls: frames.at(-1)?.calls, triangles: frames.at(-1)?.triangles,
          renderMemory: { ...r.renderer.info.memory }, gpu: r.renderer.getContext().getParameter(r.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
      });
      result.views.push(view);
      if (!mobile) {
        const stage = async (name, id, dx, dz, zoom) => {
          await page.evaluate(({id,dx,dz,zoom}) => {
            const a=window.__reef,g=a.game,r=a.renderer,b=g.layout.town.find(v=>v.id===id);
            const p=g.world.nearestWalkable(b.x+dx,b.z+dz,12);
            if(!p) throw Error(`No walkable photo point near ${id}`);
            [g.p.x,g.p.z]=p;g.path=[];r.zoom=zoom;r.camDist=29*zoom;r.snapCamera();g.step(0);a.ui.update(3);
          },{id,dx,dz,zoom});
          await page.waitForTimeout(600);
          await page.screenshot({path:path.join(out,`${name}.png`),timeout:180000});
        };
        await stage('store-close','store',3,2,1.05);
        await stage('chart-close','chart',-3,2,1.05);
        await stage('tackle-close','tackle',3,2,1.05);
        await stage('verge','store',-3,5,1.1);
      }
      await ctx.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); }
  if(result.errors.length) throw Error(`Browser runtime errors: ${result.errors.join('; ')}`);
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
