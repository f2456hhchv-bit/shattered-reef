import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LOOKS, LOOK_BRIGHT, type Look } from '../art/looks';
import { Terrain, coastZ, TERRAIN_SIZE } from '../art/terrain';
import { createWater } from '../art/water';
import { createGradePass, applyGrade } from '../art/grade';
import { buildSloop, buildBarrel } from '../art/models/ship';
import { buildHumanoid, animateIdle, type HumanoidRig } from '../art/models/character';
import { buildCrab, animateCrab, type CrabRig } from '../art/models/crab';
import { buildPine, buildBroadleaf, buildRock, buildOreRock, buildCrate, buildLanternPost, buildShack, buildDock, rope, buildGrass, buildBuoy, type Lantern } from '../art/models/props';
import { mulberry32 } from '../art/noise';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
if (params.get('ui') === '0') {
  document.getElementById('ui')!.classList.add('hide');
  document.getElementById('tag')!.classList.add('hide');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);

// Characters are drawn ~20% larger than real scale so they read on a phone (classic ARPG trick).
const HERO_SCALE = 1.2;

// ---------------------------------------------------------------- world layout
const terrain = new Terrain();
const dockX = -3;
const zc = coastZ(dockX);
const dockStart = zc - 2.2;
const dockLen = 9.5;
const deckY = 1.0;
const headZ = dockStart + dockLen;
const shackPos = new THREE.Vector3(-10, 0, coastZ(-10) - 8);
const orePos = new THREE.Vector3(5.5, 0, coastZ(5.5) - 6.5);

terrain.flats.push({ x: dockX, z: dockStart - 1.2, r: 1.8, h: deckY - 0.05 });
terrain.flats.push({ x: shackPos.x, z: shackPos.z, r: 3.2, h: terrain.rawHeight(shackPos.x, shackPos.z) });
terrain.path = {
  width: 1.15,
  pts: [
    [dockX, dockStart - 1],
    [dockX - 1.2, dockStart - 4.5],
    [shackPos.x + 1.8, shackPos.z + 2.6],
    [dockX - 1.2, dockStart - 4.5],
    [dockX + 0.5, dockStart - 9],
    [orePos.x - 1.2, orePos.z - 1],
    [dockX + 0.5, dockStart - 9],
    [dockX - 1, dockStart - 18],
  ],
};
terrain.build();
shackPos.y = terrain.heightAt(shackPos.x, shackPos.z);
orePos.y = terrain.heightAt(orePos.x, orePos.z);

const world = new THREE.Group();
scene.add(world);

const ground = (x: number, z: number) => terrain.heightAt(x, z);
const place = (o: THREE.Object3D, x: number, z: number, yOffset = 0) => {
  o.position.set(x, ground(x, z) + yOffset, z);
  world.add(o);
  return o;
};

// dock + ship
const dock = buildDock(dockX, dockStart, dockLen, 8, deckY, 21);
world.add(dock.group);
const ship = buildSloop();
const shipZ = headZ + 2.1 + 1.45 + 0.45;
ship.root.position.set(dockX + 0.6, 0, shipZ);
world.add(ship.root);
for (const b of [dock.bollards[0], dock.bollards[3]]) {
  const onShip = new THREE.Vector3(b.x > dockX ? dockX + 3.2 : dockX - 2.4, 1.3, shipZ - 1.1);
  world.add(rope(b.clone().setY(b.y + 0.05), onShip, 0.45));
}

// player on the dock
const player: HumanoidRig = buildHumanoid({
  skin: 'skin', coat: 'coat', coatTrim: 'coatTrim', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 'hat', hair: 'hair',
});
player.root.position.set(dockX - 0.3, deckY + 0.06, headZ - 1.2);
player.root.rotation.y = 0.5;
player.root.scale.setScalar(HERO_SCALE);
world.add(player.root);

// crabs on the beach
const crabs: { rig: CrabRig; x: number; z: number; phase: number }[] = [];
for (const [x, s, ph] of [[-13, 1.0, 0], [-16.5, 0.75, 2.1]] as const) {
  const rig = buildCrab(7 + Math.round(x));
  const z = coastZ(x) - 1.6;
  rig.root.scale.setScalar(s * HERO_SCALE);
  rig.root.rotation.y = 0.35;
  place(rig.root, x, z);
  crabs.push({ rig, x, z, phase: ph });
}

// shack + lanterns
const shack = buildShack(5);
shack.group.position.copy(shackPos);
shack.group.rotation.y = 0.35;
world.add(shack.group);

const lanterns: Lantern[] = [];
const l1 = buildLanternPost();
l1.group.position.set(dockX + 3.6, deckY, headZ + 0.2);
l1.group.rotation.y = Math.PI;
world.add(l1.group);
lanterns.push(l1);
const l2 = buildLanternPost();
place(l2.group, dockX + 1.9, dockStart - 1.6);
lanterns.push(l2);
const l3 = buildLanternPost();
place(l3.group, shackPos.x + 2.9, shackPos.z + 2.4);
l3.group.rotation.y = -0.6;
lanterns.push(l3);

// cargo
place(buildCrate(1, 0.75), dockX - 2.4, dockStart - 2.0);
place(buildCrate(2, 0.6), dockX - 2.2, dockStart - 2.9).rotation.y = 0.5;
const stacked = buildCrate(3, 0.55);
place(stacked, dockX - 2.4, dockStart - 2.0, 0.75).rotation.y = 0.3;
place(buildBarrel(0.32, 0.75), dockX + 2.2, dockStart - 2.8);
place(buildBarrel(0.32, 0.75), dockX + 2.8, dockStart - 2.4);
const deckBarrel = buildBarrel(0.3, 0.7);
deckBarrel.position.set(dockX - 3.2, deckY + 0.06, headZ + 0.6);
world.add(deckBarrel);
const deckCrate = buildCrate(4, 0.65);
deckCrate.position.set(dockX - 2.4, deckY + 0.06, headZ + 1.1);
deckCrate.rotation.y = 0.2;
world.add(deckCrate);

// gathering node
const ore = buildOreRock(31);
ore.position.copy(orePos);
world.add(ore);

// vegetation + rocks, deterministic scatter
const rnd = mulberry32(1234);
const clear = (x: number, z: number, minD: number) => {
  const d = coastZ(x) - z;
  if (d < minD) return false;
  if (terrain.pathDist(x, z) < 2.2) return false;
  if (Math.hypot(x - shackPos.x, z - shackPos.z) < 5) return false;
  if (Math.hypot(x - orePos.x, z - orePos.z) < 2.5) return false;
  if (Math.abs(x - dockX) < 3.5 && z > dockStart - 4) return false;
  return true;
};
let trees = 0;
for (let tries = 0; tries < 900 && trees < 70; tries++) {
  const x = -38 + rnd() * 76;
  const z = coastZ(x) - 5 - rnd() * 34;
  if (!clear(x, z, 6.5)) continue;
  const t = rnd() < 0.68 ? buildPine(tries + 50) : buildBroadleaf(tries + 50);
  place(t, x, z, -0.05);
  trees++;
}
for (let i = 0; i < 26; i++) {
  const x = -30 + rnd() * 60;
  const z = coastZ(x) - 1 - rnd() * 18;
  if (!clear(x, z, 0.6)) continue;
  const r = buildRock(i + 300, 0.3 + rnd() * 0.6, rnd() > 0.5 ? 'stone' : 'stoneDark');
  place(r, x, z, 0.05);
}
for (let i = 0; i < 9; i++) {
  // rocks breaking the surface offshore
  const x = 4 + rnd() * 20;
  const z = coastZ(x) + 1 + rnd() * 5;
  const r = buildRock(i + 400, 0.6 + rnd() * 0.9, 'stoneDark');
  r.position.set(x, 0.05, z); // sea stacks break the surface
  world.add(r);
}
for (let i = 0; i < 7; i++) {
  const x = -32 + rnd() * 18;
  const z = coastZ(x) + 5 + rnd() * 9;
  const r = buildRock(i + 500, 0.5 + rnd() * 1.0, 'stoneDark');
  r.position.set(x, 0.05, z);
  world.add(r);
}
const buoy = buildBuoy();
buoy.position.set(dockX - 8, 0, shipZ + 3);
world.add(buoy);

const grassPts: THREE.Vector3[] = [];
for (let i = 0; i < 4000 && grassPts.length < 700; i++) {
  const x = -32 + rnd() * 64;
  const z = coastZ(x) - 3 - rnd() * 26;
  if (!clear(x, z, 4.2)) continue;
  grassPts.push(new THREE.Vector3(x, ground(x, z) - 0.02, z));
}
world.add(buildGrass(grassPts, 77));

// ---------------------------------------------------------------- lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const sc = sun.shadow.camera;
sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 140;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- water
const water = createWater(TERRAIN_SIZE + 60, 130, (x, z) => {
  const half = TERRAIN_SIZE / 2;
  if (Math.abs(x) > half || Math.abs(z) > half) return 5;
  return -terrain.heightAt(x, z);
}, LOOK_BRIGHT);
scene.add(water.mesh);

// ---------------------------------------------------------------- camera rig
const target = new THREE.Vector3(dockX - 0.5, 0.8, dockStart + 6);
let yaw = 0;
let zoom = Number(params.get('zoom') ?? 1) || 1;
const PITCH = THREE.MathUtils.degToRad(54);
let camDist = 30;

function updateCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // guarantee a minimum visible width on narrow portrait phones
  const minWidth = 15;
  camDist = Math.max(37, minWidth / (2 * tanHalf * aspect)) * zoom;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(PITCH) * camDist,
    target.y + Math.sin(PITCH) * camDist,
    target.z + Math.cos(yaw) * Math.cos(PITCH) * camDist,
  );
  camera.lookAt(target);
  scene.fog = scene.fog ?? new THREE.Fog(0x000000, 1, 2);
}

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const grade = createGradePass(LOOK_BRIGHT);
composer.addPass(grade);

// ---------------------------------------------------------------- look switching
let terrainMesh: THREE.Mesh | null = null;
let current: Look = LOOK_BRIGHT;

function applyLook(look: Look) {
  current = look;
  if (terrainMesh) {
    world.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    (terrainMesh.material as THREE.Material).dispose();
  }
  terrainMesh = terrain.createMesh(look);
  world.add(terrainMesh);

  scene.background = new THREE.Color(look.fog.color);
  hemi.color.set(look.hemi.sky);
  hemi.groundColor.set(look.hemi.ground);
  hemi.intensity = look.hemi.intensity;
  sun.color.set(look.sun.color);
  sun.intensity = look.sun.intensity;
  renderer.toneMappingExposure = look.exposure;

  const u = water.uniforms;
  u.uShallow.value.set(look.water.shallow);
  u.uDeep.value.set(look.water.deep);
  u.uFoam.value.set(look.water.foam);
  u.uSunColor.value.set(look.sun.color);
  u.uFogColor.value.set(look.fog.color);

  for (const l of lanterns) l.light.intensity = look.lanternIntensity;
  shack.windowMat.emissiveIntensity = look.windowGlow;
  applyGrade(grade, look);
  document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) => b.classList.toggle('on', b.dataset.look === look.id));
  updateLightAndFog();
}

function updateLightAndFog() {
  const el = THREE.MathUtils.degToRad(current.sun.elevationDeg);
  const az = THREE.MathUtils.degToRad(current.sun.azimuthDeg) + yaw;
  // azimuth 0 = light from behind the camera; negative = from the left
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  sun.position.copy(target).addScaledVector(dir, 60);
  sun.target.position.copy(target);
  water.uniforms.uSunDir.value.copy(dir);
  const fog = scene.fog as THREE.Fog;
  fog.color.set(current.fog.color);
  fog.near = camDist * current.fog.near;
  fog.far = camDist * current.fog.far;
  water.uniforms.uFogNear.value = fog.near;
  water.uniforms.uFogFar.value = fog.far;
}

document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) => {
  b.addEventListener('click', () => applyLook(LOOKS.find((l) => l.id === b.dataset.look) ?? LOOK_BRIGHT));
});

// ---------------------------------------------------------------- input: drag to orbit a little, wheel/pinch to zoom
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart = 0, zoomStart = 1;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    zoomStart = zoom;
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 1) {
    yaw = THREE.MathUtils.clamp(yaw - (e.clientX - p.x) * 0.005, -0.9, 0.9);
  } else if (pointers.size === 2) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...pointers.values()];
    zoom = THREE.MathUtils.clamp(zoomStart * (pinchStart / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))), 0.5, 1.6);
  }
  p.x = e.clientX; p.y = e.clientY;
});
const release = (e: PointerEvent) => pointers.delete(e.pointerId);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom = THREE.MathUtils.clamp(zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.5, 1.6);
}, { passive: false });

// ---------------------------------------------------------------- loop
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
updateCamera();
applyLook(LOOKS.find((l) => l.id === params.get('look')) ?? LOOK_BRIGHT);

const timer = new THREE.Timer();
if (params.has('debug')) (window as unknown as { __scene: THREE.Scene }).__scene = scene;
const fixedTime = params.has('t') ? Number(params.get('t')) : null;
let frames = 0;
function frame() {
  timer.update();
  const t = fixedTime ?? timer.getElapsed();
  water.uniforms.uTime.value = t;
  ship.hull.position.y = Math.sin(t * 0.9) * 0.06;
  buoy.position.y = Math.sin(t * 1.3 + 1) * 0.08;
  buoy.rotation.z = Math.sin(t * 1.1) * 0.12;
  ship.hull.rotation.x = Math.sin(t * 0.7) * 0.025;
  ship.hull.rotation.z = Math.sin(t * 0.55 + 1) * 0.012;
  animateIdle(player, t);
  for (const c of crabs) {
    const s = Math.sin(t * 0.6 + c.phase);
    const moving = Math.abs(Math.cos(t * 0.6 + c.phase)) > 0.25;
    const x = c.x + s * 1.6;
    c.rig.root.position.set(x, ground(x, c.z), c.z);
    animateCrab(c.rig, t + c.phase, moving);
  }
  updateCamera();
  updateLightAndFog();
  composer.render();
  frames++;
  (window as unknown as { __frames: number }).__frames = frames;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
