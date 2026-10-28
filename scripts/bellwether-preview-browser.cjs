/* Use REEF_PREVIEW_URL for the public HTTPS deployment, or the local packaged site. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/workspace/.dev-tools/lib/node_modules/playwright');
const base=process.env.REEF_PREVIEW_URL||'http://127.0.0.1:5180/site/';
const output=process.env.REEF_PREVIEW_EVIDENCE||'/workspace/game-review/public-preview';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const result={url:base,engine:'Chromium with touch/mobile emulation; not an actual iPhone or Safari/WebKit test',errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>result.errors.push(String(e)));
  const failures=[];page.on('response',r=>{if(r.url().startsWith(new URL(base).origin)&&r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  await page.addInitScript(()=>{
   const original={'shattered-reef.save':JSON.stringify({version:9,player:{xp:{mining:777}},settings:{quality:'low'}}),'shattered-reef-intro-seen':'production-intro-sentinel','sr.touch.p':'[31,19]','sr.touch.l':'[-12,8]'};
   for(const [k,v]of Object.entries(original))localStorage.setItem(k,v);
   window.__productionSnapshot=original;window.__protectedMutations=[];
   for(const method of ['setItem','removeItem']){const fn=Storage.prototype[method];Storage.prototype[method]=function(k,...rest){if(k in original)window.__protectedMutations.push({method,key:k});return fn.call(this,k,...rest);};}
  });
  // Preview builds must ignore a classic override, protecting the live site's save namespace.
  const hostile=new URL(base);hostile.searchParams.set('bellwether','classic');
  await page.goto(hostile.href,{waitUntil:'domcontentloaded',timeout:180000});
  const ready=()=>page.waitForFunction(()=>window.__reef,undefined,{timeout:180000,polling:250});await ready();
  assert.equal(await page.title(),'Shattered Reef — Bellwether Preview');
  result.artifact=await page.evaluate(()=>fetch('./preview.json').then(r=>{if(!r.ok)throw Error('Missing preview marker');return r.json();}));assert.equal(result.artifact.redesignDefault,true);
  assert.equal(await page.evaluate(()=>window.__reef.game.s.geometry),'bellwether-phase2-v1');
  assert.equal(await page.evaluate(()=>window.__reef.game.p.xp.mining),777);
  assert.equal(await page.evaluate(()=>window.__reef.game.world.ground(305,-285)<-.9),true);
  assert.deepEqual(await page.evaluate(()=>window.__reef.ui.touchOffset()),[0,0]);
  // Exercise the real credits skip callback that persists the intro flag.
  await page.locator('#rollCredits').click({force:true});await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>localStorage.getItem('shattered-reef-intro-seen.bellwether-phase2-v1')),'1');
  await page.locator('#cont').click({force:true});await page.evaluate(()=>{const r=window.__reef.renderer;r.cinematic=null;r.release=null;r.snapCamera();});
  // Exercise actual calibration taps and the Clear action, not direct storage writes.
  await page.evaluate(()=>window.__reef.ui.calibrate());
  for(let k=0;k<3;k++){const r=await page.locator('#calib .mark').boundingBox();await page.touchscreen.tap(r.x+r.width/2+12,r.y+r.height/2+9);}
  const calibrated=await page.evaluate(()=>window.__reef.ui.touchOffset());assert.ok(Math.hypot(calibrated[0]-12,calibrated[1]-9)<2);result.calibration=calibrated;
  await page.evaluate(()=>window.__reef.ui.calibrate());await page.locator('#calib [data-c="clear"]').tap({force:true});assert.deepEqual(await page.evaluate(()=>window.__reef.ui.touchOffset()),[0,0]);
  // Native pointer handling changes the player's movement through the actual Input object.
  const before=await page.evaluate(()=>{const {game:g}=window.__reef,c=document.getElementById('world');const p={x:g.p.x,z:g.p.z};for(const [type,x]of [['pointerdown',60],['pointermove',112]])c.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:'touch',clientX:x,clientY:330,bubbles:true,buttons:1}));return p;});
  await page.waitForFunction(p=>Math.hypot(window.__reef.game.p.x-p.x,window.__reef.game.p.z-p.z)>.25,before,{polling:30,timeout:30000});
  result.touch=await page.evaluate(p=>{const g=window.__reef.game;document.getElementById('world').dispatchEvent(new PointerEvent('pointerup',{pointerId:77,pointerType:'touch',bubbles:true,clientX:112,clientY:330}));return {moved:Math.hypot(g.p.x-p.x,g.p.z-p.z),walkable:g.world.walkable(g.p.x,g.p.z),released:Math.hypot(g.moveDir.x,g.moveDir.z)===0};},before);assert.ok(result.touch.walkable&&result.touch.released);
  await page.evaluate(()=>{const a=window.__reef;a.game.p.xp.mining=1234;a.game.s.flags.preview_reload_check=true;if(!a.save())throw Error('Save failed');});
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});await ready();
  result.persistence=await page.evaluate(()=>({xp:window.__reef.game.p.xp.mining,flag:window.__reef.game.s.flags.preview_reload_check,geometry:window.__reef.game.s.geometry}));assert.equal(result.persistence.xp,1234);assert.equal(result.persistence.flag,true);
  result.productionStorageUnchanged=await page.evaluate(()=>Object.entries(window.__productionSnapshot).every(([k,v])=>localStorage.getItem(k)===v)&&window.__protectedMutations.length===0);assert.equal(result.productionStorageUnchanged,true);
  await page.locator('#cont').click({force:true});await page.evaluate(()=>{const r=window.__reef.renderer;r.cinematic=null;r.release=null;r.snapCamera();});await page.screenshot({path:path.join(output,'mobile-preview.png'),timeout:180000});
  result.sameOriginAssetFailures=failures;assert.deepEqual(failures,[]);assert.deepEqual(result.errors,[]);result.passed=true;console.log(JSON.stringify(result,null,2));
 }catch(e){result.passed=false;result.failure=String(e);throw e;}
 finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
