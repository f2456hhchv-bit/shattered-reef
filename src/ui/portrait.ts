import * as THREE from 'three';
import { buildHumanoid, type HumanoidLook } from '../art/models/character';

// Head-and-shoulders portraits of the real 3D characters, for dialogue boxes and the equipment tab.
// At play distance a face is ~20 px tall; the portrait is where you actually meet people.

const cache = new Map<string, string>();
let pr: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;

function portraitRenderer() {
  if (pr) return pr;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x4a3a2a, 1.4));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.4); key.position.set(-1.2, 1.6, 2.2);
  const rim = new THREE.DirectionalLight(0x9fe8f0, 1.6); rim.position.set(1.8, 1.2, -1.5);
  scene.add(key, rim);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  pr = { r, scene, cam };
  return pr;
}

export function portrait(id: string, look: HumanoidLook): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const { r, scene, cam } = portraitRenderer();
  const rig = buildHumanoid({ ...look, held: 'none' });
  rig.head.rotation.y = 0.25;
  scene.add(rig.root);
  rig.root.updateMatrixWorld(true);
  const head = new THREE.Vector3();
  rig.head.getWorldPosition(head);
  head.y += 0.22;
  cam.position.set(head.x + 0.3, head.y + 0.1, head.z + 1.35);
  cam.lookAt(head.x, head.y - 0.05, head.z);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.remove(rig.root);
  rig.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  cache.set(id, url);
  return url;
}
