/* Production-browser evidence. Run after npm run build and preview on port5175.
 * PLAYWRIGHT_MODULE and CHROMIUM_PATH can override the locally installed tools.
 * Staged camera/save fixtures are confined to a fresh browser context; no user save is touched.
 */
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/workspace/.dev-tools/lib/node_modules/playwright');
const root=path.resolve(__dirname,'../docs/world-redesign/phase2'),shots=path.join(root,'screenshots');fs.mkdirSync(shots,{recursive:true});
const base=process.env.REEF_BROWSER_URL||'http://127.0.0.1:5175/';
const metrics={environment:'Headless Chromium, Linux, SwiftShader software GPU. Browser measurements only, not real phone hardware.',pages:[],errors:[]};
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
async function boot(mode,mobile=false){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
 const p=await ctx.newPage();p.setDefaultTimeout(180000);p.on('pageerror',e=>metrics.errors.push(String(e)));
 await p.addInitScript(()=>{localStorage.setItem('shattered-reef-intro-seen','1');localStorage.setItem('shattered-reef.save',JSON.stringify({version:9,settings:{quality:'low'}}));const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(function tick(t){if(window.__capturePause)window.requestAnimationFrame(cb);else cb(t);});});
 const t=Date.now();await p.goto(base+'?bellwether='+mode,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.__reef,undefined,{polling:250,timeout:180000});await p.evaluate(()=>{window.__reef.start();window.__reef.renderer.cinematic=null;window.__reef.renderer.snapCamera();});
 const bootMs=Date.now()-t;console.log('boot',mode,mobile,bootMs);
 await p.evaluate(()=>{const r=window.__reef.renderer,fn=r.frame.bind(r);window.__frames=[];let previous=performance.now();r.renderer.info.autoReset=false;r.frame=(dt,t)=>{r.renderer.info.reset();const before=performance.now();fn(dt,t);window.__frames.push({cpuMs:performance.now()-before,wallIntervalMs:before-previous,dtMs:dt*1000,calls:r.renderer.info.render.calls,triangles:r.renderer.info.render.triangles});previous=before;if(window.__frames.length>120)window.__frames.shift();};});
 await p.evaluate(()=>new Promise(resolve=>{let n=0;function f(){if(++n>=24)resolve();else requestAnimationFrame(f);}requestAnimationFrame(f);}));
 const measurement=await p.evaluate(()=>{const r=window.__reef.renderer,frames=window.__frames.slice(-20),cpu=frames.map(f=>f.cpuMs).sort((a,b)=>a-b);return {wallFps:1000/(frames.reduce((n,f)=>n+f.wallIntervalMs,0)/frames.length),frames:frames.length,cpuMedianMs:cpu[Math.floor(cpu.length/2)],cpuP95Ms:cpu[Math.floor(cpu.length*.95)],lastFrame:frames.at(-1),perf:r.perf,gpuRenderer:r.renderer.getContext().getParameter(r.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,renderMemory:r.renderer.info.memory,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),prototypeChunks:performance.getEntriesByType('resource').filter(e=>/bellwether-(shore|classic-nodes|outline)/.test(e.name)).map(e=>({name:e.name.split('/').at(-1),duration:e.duration,transfer:e.transferSize}))};});
 metrics.pages.push({mode,mobile,bootMs,...measurement});return {p,ctx};
}
async function stage(p,name,x,z,zoom=1.5){await p.evaluate(({x,z,zoom})=>{const {game:g,renderer:r,ui}=window.__reef;g.stopAction();g.path=[];g.p.onShip=false;const q=g.world.nearestWalkable(x,z,25);if(!q)throw Error('No photo approach '+x+','+z);[g.p.x,g.p.z]=q;r.cinematic=null;r.release=null;r.zoom=zoom;r.camDist=29*zoom;r.snapCamera();g.step(0);ui.update(3);},{x,z,zoom});await p.waitForTimeout(1000);await p.screenshot({path:path.join(shots,name+'.png'),timeout:180000,animations:'disabled'});console.log('shot',name);}
const {p,ctx}=await boot('phase2');
await stage(p,'harbour',0,351,2.5);
await stage(p,'settlement',0,284,1.5);
await stage(p,'forest',-150,105,1.4);
await p.route('**/phase2-pine-trial.png',route=>route.fulfill({path:path.join(root,'experiments/pine-sprite-trial.png'),contentType:'image/png'}));
await p.evaluate(()=>{const {renderer:r,game:g}=window.__reef;const x=g.p.x+4,z=g.p.z-3;r.boards.add({file:'phase2-pine-trial.png',h:4.5,w:3.2},x,g.world.ground(x,z),z);r.boards.build();});
await p.waitForTimeout(1500);await p.screenshot({path:path.join(root,'experiments/pine-sprite-in-game.png'),timeout:180000});
await p.evaluate(()=>{window.__reef.renderer.boards.group.children.at(-1).visible=false;});
await stage(p,'rocks',58,214,1.1);
await stage(p,'beach',-260,280,1.5);
await stage(p,'cliffs',412,-240,2.2);
// Save import and persistence check using the actual app's save function and namespace.
metrics.save=await p.evaluate(()=>{const api=window.__reef,classic=localStorage.getItem('shattered-reef.save');api.game.s.flags.phase2_browser_check=true;const result=api.save();const key='shattered-reef.save.bellwether-phase2-v1';const saved=JSON.parse(localStorage.getItem(key));return {success:result,originalUnchanged:classic===localStorage.getItem('shattered-reef.save'),geometry:saved.geometry,flag:saved.flags.phase2_browser_check};});
// Running game's map UI: both screenshots are actual terrain maps, not the Phase1 diagrams.
await p.evaluate(()=>window.__reef.ui.selectTab('map',true));await p.waitForTimeout(300);await p.locator('#mapbig').screenshot({path:path.join(shots,'silhouette-new.png')});
// Whole-island view uses the actual Three.js scene and approved north-up54-degree camera.
// Stream all terrain for this review shot only; overview timing is excluded from gameplay measurements.
await p.evaluate(()=>{window.__capturePause=true;const r=window.__reef.renderer;r.terrain.buildAll();if(r.grass)r.grass.visible=false;r.scene.fog=null;r.camera.clearViewOffset();r.camera.far=5000;r.camera.position.set(0,Math.sin(54*Math.PI/180)*2100,Math.cos(54*Math.PI/180)*2100);r.camera.lookAt(0,0,0);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);});
await p.locator('#world').screenshot({path:path.join(shots,'island-overview.png'),timeout:180000});console.log('shot overview');await ctx.close();
const classic=await boot('classic');await stage(classic.p,'forest-classic',-150,105,1.4);await classic.p.evaluate(()=>window.__reef.ui.selectTab('map',true));await classic.p.waitForTimeout(300);await classic.p.locator('#mapbig').screenshot({path:path.join(shots,'silhouette-old.png')});await classic.ctx.close();
const mobile=await boot('phase2',true);await stage(mobile.p,'mobile',0,331,1);
// Dispatch native DOM PointerEvents through the real Input handlers.
const touch=await mobile.p.evaluate(()=>{const {game:g}=window.__reef,canvas=document.getElementById('world');const before={x:g.p.x,z:g.p.z};const start=performance.now();for(const [type,x]of[['pointerdown',60],['pointermove',112]])canvas.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'touch',bubbles:true,clientX:x,clientY:360,buttons:1}));return {before,start};});
await mobile.p.waitForFunction(before=>Math.hypot(window.__reef.game.p.x-before.x,window.__reef.game.p.z-before.z)>.25,touch.before,{polling:30,timeout:30000});
metrics.touch=await mobile.p.evaluate(({before,start})=>{const g=window.__reef.game,elapsed=performance.now()-start;document.getElementById('world').dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'touch',bubbles:true,clientX:112,clientY:360}));return {responseWallMs:elapsed,movedMetres:Math.hypot(g.p.x-before.x,g.p.z-before.z),onWalkableGround:g.world.walkable(g.p.x,g.p.z),moveDirectionReleased:Math.hypot(g.moveDir.x,g.moveDir.z)===0};},touch);await mobile.ctx.close();
if(metrics.errors.length || !metrics.save.success || !metrics.save.originalUnchanged || !metrics.touch.onWalkableGround || !metrics.touch.moveDirectionReleased) throw Error('Browser validation failed; inspect metrics');
fs.writeFileSync(path.join(root,'browser-metrics.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
}finally{await browser.close();}})().catch(e=>{metrics.failure=String(e);fs.writeFileSync(path.join(root,'browser-metrics.json'),JSON.stringify(metrics,null,2));console.error(e);process.exitCode=1;});
