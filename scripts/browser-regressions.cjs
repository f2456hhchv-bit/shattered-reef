// Save feedback and favicon regressions against the real app. Requires a running dev/preview server.
// Uses the same global Playwright installation as scripts/e2e.cjs. URL may include a Pages subdirectory.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(require('node:child_process').execSync('npm root -g').toString().trim(), 'playwright'));
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let failed = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(process.env.URL || 'http://localhost:5173/');
    await page.waitForFunction(() => window.__reef, null, { timeout: 120000 });
    // Read the static head before starting the costly software-rendered game loop.
    const iconHref = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute('href'));
    const feedback = await page.evaluate(() => {
      const r = window.__reef; r.start();
      r.game.s.settings.quality = 'low'; r.renderer.setQuality('low');
      r.ui.selectTab('settings', true); r.ui.sideOpen = true; r.ui.layout(); r.ui.update(.016);
      const messages = [], log = r.ui.log.bind(r.ui);
      r.ui.log = (text, kind) => { messages.push({ text, kind }); log(text, kind); };
      const before = localStorage.getItem('shattered-reef.save'), savedAt = r.ui.lastSaved;
      const setItem = Storage.prototype.setItem;
      try {
        Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
        document.getElementById('saveNow').click();
      } finally { Storage.prototype.setItem = setItem; }
      const failure = { messages: [...messages], unchanged: before === localStorage.getItem('shattered-reef.save'), timestampUnchanged: r.ui.lastSaved === savedAt };
      messages.length = 0;
      // Change legitimate state to prove the successful click actually writes progress.
      r.game.s.settings.showFps = !r.game.s.settings.showFps;
      document.getElementById('saveNow').click();
      const success = { messages: [...messages], persisted: JSON.parse(localStorage.getItem('shattered-reef.save')).settings.showFps === r.game.s.settings.showFps };
      r.ui.log = log;
      return { failure, success };
    });
    for (const [name, check] of [
      ['failed save never confirms success', () => {
        assert(feedback.failure.messages.some(m => m.kind === 'warn'));
        assert(!feedback.failure.messages.some(m => m.kind === 'good'));
        assert(feedback.failure.unchanged); assert(feedback.failure.timestampUnchanged);
      }],
      ['successful save persists and confirms', () => {
        assert(feedback.success.persisted);
        assert.equal(feedback.success.messages.filter(m => m.kind === 'good').length, 1);
        assert(!feedback.success.messages.some(m => m.kind === 'warn'));
      }],
      ['favicon resolves from the page base', async () => {
        assert(iconHref, 'the page must declare a favicon'); const url = new URL(iconHref, page.url());
        assert.equal(url.origin, new URL(page.url()).origin);
        assert(url.pathname.startsWith(new URL('.', page.url()).pathname));
        const response = await page.request.get(url.href);
        assert.equal(response.status(), 200); assert.match(response.headers()['content-type'], /image\/svg\+xml/);
        assert.match(await response.text(), /<svg[\s>]/);
      }],
    ]) {
      try { await check(); console.log('PASS', name); }
      catch (e) { failed++; console.error('FAIL', name, e.message); }
    }
    console.log(JSON.stringify(feedback));
  } finally { await browser.close(); }
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
