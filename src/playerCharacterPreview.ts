import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPlayerCharacterRig, type PlayerMainHand, type PlayerMotion } from './art/models/playerCharacterRig';
import { gameCameraDistance } from './playerCharacterPreviewCamera';

const stage = document.querySelector<HTMLElement>('#stage');
const canvas = document.querySelector<HTMLCanvasElement>('#viewer');
const fpsLabel = document.querySelector<HTMLOutputElement>('#fps');
if (!stage || !canvas || !fpsLabel) throw new Error('Character preview elements are missing');
const stageElement: HTMLElement = stage;
const fpsOutput: HTMLOutputElement = fpsLabel;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x293235);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

scene.add(new THREE.HemisphereLight(0xe4e7e4, 0x48413b, 2.1));
const key = new THREE.DirectionalLight(0xffe3bf, 2.6);
key.position.set(-3, 6, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xb6cbd1, 0.8);
fill.position.set(4, 3, -4);
scene.add(fill);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x303536, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const rig = buildPlayerCharacterRig();
rig.root.scale.setScalar(1.2);
rig.setMainHand('sword');
rig.setOffhand(true);
scene.add(rig.root);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.8;
controls.maxDistance = 35;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 2.45;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.85;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

const inspectionPose = { position: new THREE.Vector3(2.0, 2.25, 4.7), target: new THREE.Vector3(0, 0.95, 0) };
let cameraMode: 'inspection' | 'game' = 'inspection';
function setCamera(mode: 'inspection' | 'game') {
  cameraMode = mode;
  document.body.classList.toggle('game-camera', mode === 'game');
  if (mode === 'game') {
    controls.target.set(0, 0.8, 0);
    const gameDistance = gameCameraDistance(window.innerWidth, window.innerHeight, camera.fov);
    controls.maxDistance = Math.max(35, gameDistance);
    stageElement.dataset.gameCameraDistance = String(gameDistance);
    camera.position.set(0, 0.8 + Math.sin(THREE.MathUtils.degToRad(54)) * gameDistance, Math.cos(THREE.MathUtils.degToRad(54)) * gameDistance);
    controls.minDistance = 1.8;
  } else {
    controls.target.copy(inspectionPose.target);
    camera.position.copy(inspectionPose.position);
    controls.minDistance = 1.8;
    controls.maxDistance = 35;
    delete stageElement.dataset.gameCameraDistance;
  }
  controls.update();
  updatePressed('[data-camera]', 'data-camera', mode);
}
setCamera('inspection');

function updatePressed(selector: string, attribute: string, value: string) {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach(button => {
    button.setAttribute('aria-pressed', button.getAttribute(attribute) === value ? 'true' : 'false');
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach(button => {
  button.addEventListener('click', () => {
    const outfit = button.dataset.outfit as 'starter' | 'leather' | 'iron' | undefined;
    if (!outfit) return;
    rig.setArmour(outfit);
    updatePressed('[data-outfit]', 'data-outfit', outfit);
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button => {
  button.addEventListener('click', () => {
    const weapon = button.dataset.weapon as PlayerMainHand | undefined;
    if (!weapon) return;
    rig.setMainHand(weapon);
    updatePressed('[data-weapon]', 'data-weapon', weapon);
  });
});

let shieldEnabled = true;
const shieldButton = document.querySelector<HTMLButtonElement>('#shield');
shieldButton?.addEventListener('click', () => {
  shieldEnabled = !shieldEnabled;
  rig.setOffhand(shieldEnabled);
  shieldButton.setAttribute('aria-pressed', String(shieldEnabled));
  shieldButton.textContent = shieldEnabled ? 'Shield on' : 'Shield off';
});

document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(button => {
  button.addEventListener('click', () => {
    const motion = button.dataset.motion as PlayerMotion | undefined;
    if (!motion) return;
    rig.setMotion(motion);
    updatePressed('[data-motion]', 'data-motion', motion);
  });
});

let attackTimer = 0;
document.querySelector<HTMLButtonElement>('#attack')?.addEventListener('click', () => {
  window.clearTimeout(attackTimer);
  rig.setMotion('attack');
  updatePressed('[data-motion]', 'data-motion', '');
  attackTimer = window.setTimeout(() => {
    rig.setMotion('idle');
    updatePressed('[data-motion]', 'data-motion', 'idle');
  }, 700);
});

document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => {
  button.addEventListener('click', () => {
    const mode = button.dataset.camera as 'inspection' | 'game' | undefined;
    if (mode) setCamera(mode);
  });
});
document.querySelector<HTMLButtonElement>('#game-camera-exit')?.addEventListener('click', () => setCamera('inspection'));
document.querySelector<HTMLButtonElement>('#zoom-in')?.addEventListener('click', () => {
  camera.position.addScaledVector(camera.position.clone().sub(controls.target).normalize(), -0.4);
  controls.update();
});
document.querySelector<HTMLButtonElement>('#zoom-out')?.addEventListener('click', () => {
  camera.position.addScaledVector(camera.position.clone().sub(controls.target).normalize(), 0.4);
  controls.update();
});
document.querySelector<HTMLButtonElement>('#reset')?.addEventListener('click', () => setCamera(cameraMode));

let lastTime = performance.now();
let frameCount = 0;
let fpsStart = lastTime;
let frameId = 0;
function frame(now: number) {
  frameId = requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  rig.update(dt);
  controls.update();
  renderer.render(scene, camera);
  frameCount++;
  if (now - fpsStart >= 1000) {
    const fps = Math.round(frameCount * 1000 / (now - fpsStart));
    fpsOutput.value = `${fps} FPS · ${renderer.info.render.calls} draw calls`;
    fpsOutput.textContent = fpsOutput.value;
    frameCount = 0;
    fpsStart = now;
  }
}

const resize = () => {
  const width = stageElement.clientWidth;
  const height = stageElement.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
};
const observer = new ResizeObserver(resize);
observer.observe(stageElement);
window.addEventListener('resize', () => { if (cameraMode === 'game') setCamera('game'); });
resize();
frameId = requestAnimationFrame(frame);
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frameId);
  observer.disconnect();
  controls.dispose();
  renderer.dispose();
}, { once: true });
