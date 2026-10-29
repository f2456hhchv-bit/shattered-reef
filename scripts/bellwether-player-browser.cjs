/* Actual-game evidence for the Bellwether skeletal character preview. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/workspace/.dev-tools/lib/node_modules/playwright');

const url = process.env.REEF_PLAYER_URL || 'http://127.0.0.1:5176/';
const out = process.env.REEF_PLAYER_EVIDENCE || 'docs/world-redesign/phase3/evidence/character';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const result = { url, engine: 'Mobile Chromium touch emulation + SwiftShader; not physical iPhone Safari', screenshots: [], animations: [], equipmentVisibility: {}, errors: [], requests: [] };
  page.on('pageerror', error => result.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); });
  page.on('requestfailed', request => result.requests.push({ url: request.url(), error: request.failure()?.errorText }));
  try {
    await page.addInitScript(() => { localStorage.setItem('shattered-reef-intro-seen.bellwether-phase2-v1', '1'); localStorage.setItem('shattered-reef-intro-seen', '1'); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__reef, null, { polling: 250, timeout: 180000 });
    await page.evaluate(() => {
      const a = window.__reef, g = a.game;
      window.__evidenceStep = g.step.bind(g);
      g.step = () => {};
      a.start();
    });
    await page.waitForFunction(() => window.__reef.renderer.playerGlb, null, { polling: 250, timeout: 180000 });
    await page.waitForTimeout(4000);
    const cdp = await context.newCDPSession(page);
    const framesDir = path.join(out, '.frames'); fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir, { recursive: true });
    let frameNo = 0;
    cdp.on('Page.screencastFrame', event => {
      fs.writeFileSync(path.join(framesDir, `frame-${String(frameNo++).padStart(4, '0')}.jpg`), Buffer.from(event.data, 'base64'));
      cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 72, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
    const setup = await page.evaluate(() => {
      const { game: g, renderer: r } = window.__reef;
      g.stopAction(); g.path = []; g.p.onShip = false;
      const buildings = ['store', 'chart', 'tackle'].map(id => g.layout.town.find(b => b.id === id));
      const townZ = buildings.reduce((sum, b) => sum + b.z, 0) / buildings.length;
      const pos = g.world.nearestWalkable(0, townZ, 18);
      if (pos) [g.p.x, g.p.z] = pos;
      const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const movementDirection = directions.map(([x, z]) => {
        let clear = 0;
        for (let step = 1; step <= 16; step++) {
          if (!g.world.walkable(g.p.x + x * step * .5, g.p.z + z * step * .5)) break;
          clear = step * .5;
        }
        return { x, z, clear };
      }).sort((a, b) => b.clear - a.clear)[0];
      g.dead = 0; g.rollT = 0; g.p.hp = g.stats.maxHp;
      g.moving = false;
      // Keep the wardrobe and movement checks in a safe showcase area. Combat below
      // still calls the game's real attack method against a live enemy object.
      for (const enemy of g.enemies) enemy.alive = false;
      document.getElementById('banner')?.classList.remove('show');
      r.release = null; r.zoom = .23; r.camDist = 29 * r.zoom; r.snapCamera();
      r.frame(1 / 60, performance.now() / 1000);
      const model = r.playerGlb;
      let skinnedMeshes = 0, meshes = 0;
      model.root.traverse(o => { if (o.isMesh) { meshes++; if (o.isSkinnedMesh) skinnedMeshes++; } });
      const originalRotation = model.root.rotation.clone();
      let skeleton;
      model.root.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skeleton = o.skeleton; });
      const head = skeleton?.bones.find(b => b.name === 'Head'), foot = skeleton?.bones.find(b => b.name === 'LowerLegL');
      if (!head || !foot) throw new Error(`Missing orientation joints: ${skeleton?.bones.map(b => b.name).join(', ')}`);
      const upAtYaw = yaw => {
        model.root.rotation.y = yaw; model.root.updateMatrixWorld(true);
        const h = head.getWorldPosition(model.root.position.clone().set(0, 0, 0));
        const f = foot.getWorldPosition(model.root.position.clone().set(0, 0, 0));
        return h.y - f.y;
      };
      const upright = [upAtYaw(0), upAtYaw(Math.PI / 2)];
      model.root.rotation.copy(originalRotation); model.root.updateMatrixWorld(true);
      return { meshes, skinnedMeshes, clips: [...model.actions.keys()], visible: model.root.visible, position: model.root.position.toArray(), player: [g.p.x, g.p.z], walkable: g.world.walkable(g.p.x, g.p.z), movementDirection, uprightHeadAboveFootAtYaw0And90: upright };
    });
    result.model = setup;
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'deckhand-idle.png'), timeout: 120000 }); result.screenshots.push('deckhand-idle.png');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const { game: g, renderer: r } = window.__reef;
      g.p.equip.body = { id: 'body_chitin', qty: 1 };
      g.p.equip.legs = { id: 'legs_chitin', qty: 1 };
      g.p.equip.head = { id: 'helm_chitin', qty: 1 };
      g.p.equip.hands = { id: 'gloves_leather', qty: 1 };
      g.p.equip.feet = { id: 'boots_leather', qty: 1 };
      g.p.equip.weapon = { id: 'cutlass_bronze', qty: 1 };
      g.p.equip.offhand = { id: 'shield_bronze', qty: 1 };
      r.frame(1 / 60, performance.now() / 1000);
    });
    await page.waitForTimeout(300);
    result.equipmentVisibility.guard = await page.evaluate(() => {
      const root = window.__reef.renderer.playerGlb.root, visible = prefix => { let found = false; root.traverse(o => { if (o.name === prefix || o.name.startsWith(`${prefix}_`)) found ||= o.visible; }); return found; };
      return Object.fromEntries(['Harbourguard_Armour', 'Harbourguard_Legs', 'Gear_Head_Helm', 'Gear_Glove', 'Gear_Boot_Cuff', 'Mainhand_Cutlass', 'Offhand_Shield'].map(n => [n, visible(n)]));
    });
    await page.screenshot({ path: path.join(out, 'harbourguard-sword-shield.png'), timeout: 120000 }); result.screenshots.push('harbourguard-sword-shield.png');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const { game: g, renderer: r } = window.__reef;
      g.p.equip.body = { id: 'body_snake', qty: 1 }; g.p.equip.legs = { id: 'chaps_snake', qty: 1 }; g.p.equip.head = { id: 'cowl_snake', qty: 1 };
      r.frame(1 / 60, performance.now() / 1000);
    });
    await page.waitForTimeout(250);
    result.equipmentVisibility.ranger = await page.evaluate(() => {
      const root = window.__reef.renderer.playerGlb.root, visible = prefix => { let found = false; root.traverse(o => { if (o.name === prefix || o.name.startsWith(`${prefix}_`)) found ||= o.visible; }); return found; };
      return Object.fromEntries(['Snakeskin_Body', 'Snakeskin_Legwrap', 'Gear_Head_Cap', 'Harbourguard_Armour'].map(n => [n, visible(n)]));
    });
    await page.screenshot({ path: path.join(out, 'snakeskin-set.png'), timeout: 120000 }); result.screenshots.push('snakeskin-set.png');
    await page.waitForTimeout(500);

    result.combat = await page.evaluate(() => {
      const { game: g, renderer: r } = window.__reef;
      const enemy = g.enemies.find(e => e.state !== 'rise');
      if (!enemy) throw new Error('No live target available for melee animation check');
      enemy.alive = true;
      g.facing = Math.atan2(enemy.z - g.p.z, enemy.x - g.p.x);
      const events = [];
      const unsubscribe = g.on(e => events.push(e.type));
      const accepted = g.performAttack(enemy);
      const emittedStyle = g.stats.style;
      unsubscribe();
      r.snapCamera();
      return { accepted, emittedStyle, events, target: enemy.def.name, dead: g.dead, hp: g.p.hp, swingTimer: r.playerSwing, animation: r.playerGlb.current };
    });
    await page.evaluate(() => window.__reef.renderer.frame(1 / 60, performance.now() / 1000));
    await page.waitForTimeout(60);
    result.combat.afterRender = await page.evaluate(() => ({ animation: window.__reef.renderer.playerGlb.current, dead: window.__reef.game.dead, hp: window.__reef.game.p.hp, swingTimer: window.__reef.renderer.playerSwing, visible: window.__reef.renderer.playerGlb.root.visible }));
    result.animations.push(result.combat.afterRender.animation);
    await page.screenshot({ path: path.join(out, 'melee-slash.png'), timeout: 120000 }); result.screenshots.push('melee-slash.png');
    await page.waitForTimeout(400);

    await page.evaluate((direction) => {
      const { game: g, renderer: r } = window.__reef;
      for (const enemy of g.enemies) enemy.alive = false;
      g.moveDir.x = direction.x * .3; g.moveDir.z = direction.z * .3;
      for (let i = 0; i < 12; i++) { window.__evidenceStep(1 / 60); r.frame(1 / 60, performance.now() / 1000); }
    }, setup.movementDirection);
    result.movement = await page.evaluate(() => ({ dead: window.__reef.game.dead, roll: window.__reef.game.rollT, hp: window.__reef.game.p.hp, moving: window.__reef.game.moving, animation: window.__reef.renderer.playerGlb.current, walkSpeed: window.__reef.game.walkSpeed(), position: [window.__reef.game.p.x, window.__reef.game.p.z], rootRotation: window.__reef.renderer.playerGlb.root.rotation.toArray() }));
    result.animations.push(await page.evaluate(() => window.__reef.renderer.playerGlb.current));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'walking.png'), timeout: 120000 }); result.screenshots.push('walking.png');
    await page.waitForTimeout(500);
    await page.evaluate((direction) => {
      const { game: g, renderer: r } = window.__reef;
      g.moveDir.x = direction.x; g.moveDir.z = direction.z;
      for (let i = 0; i < 12; i++) { window.__evidenceStep(1 / 60); r.frame(1 / 60, performance.now() / 1000); }
    }, setup.movementDirection);
    result.animations.push(await page.evaluate(() => window.__reef.renderer.playerGlb.current));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, 'running.png'), timeout: 120000 }); result.screenshots.push('running.png');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const { game: g, renderer: r } = window.__reef;
      g.moveDir.x = 0; g.moveDir.z = 0;
      r.frame(1 / 30, performance.now() / 1000);
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, 'stopped.png'), timeout: 120000 }); result.screenshots.push('stopped.png');
    await page.waitForTimeout(1200);
    await cdp.send('Page.stopScreencast');
    if (frameNo > 1) {
      const recording = path.resolve(out, 'character-gameplay.mp4');
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '24', '-i', path.join(framesDir, 'frame-%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', recording]);
      result.video = 'character-gameplay.mp4';
      result.recordedFrames = frameNo;
    }
  } finally {
    await context.close();
    await browser.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  }
  if (result.errors.length || result.requests.length) throw Error(`Browser errors: ${JSON.stringify({ errors: result.errors, requests: result.requests })}`);
  if (!result.model?.visible || !result.model.skinnedMeshes) throw Error(`GLB not visible or unskinned: ${JSON.stringify(result.model)}`);
  if (result.model.uprightHeadAboveFootAtYaw0And90?.some(height => height < 0.5)) throw Error(`Character vertical axis changes with yaw: ${JSON.stringify(result.model.uprightHeadAboveFootAtYaw0And90)}`);
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
