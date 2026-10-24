import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HumanoidRig } from '../art/models/character';

// Mobile shadow budget: a character is ~20 small meshes, and every one of them used to cast its own shadow (a draw
// call each in the shadow pass, ~280 calls in the market square). Instead each character casts one shadow from a
// simple stand-in (body and head) that is drawn only in the shadow pass. At game zoom the shadow reads the same.

const proxyMat = new THREE.MeshBasicMaterial();

function stopCasting(root: THREE.Object3D) { root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; }); }

function proxyMesh(parts: THREE.BufferGeometry[]): THREE.Mesh {
  const m = new THREE.Mesh(mergeGeometries(parts), proxyMat);
  m.castShadow = true;
  m.receiveShadow = false;
  m.frustumCulled = false;
  // drawn only in the shadow pass: three.js renders shadows first, so the stand-in opens its draw range just for
  // that pass and closes it again before the main pass (which then skips it without a draw call)
  const g = m.geometry;
  g.setDrawRange(0, -1); // a negative range makes the main pass return before binding anything
  m.onBeforeShadow = () => g.setDrawRange(0, Infinity);
  m.onAfterShadow = () => g.setDrawRange(0, -1);
  return m;
}

/** Box of `objs` in `space`'s local coordinates. */
function boxIn(space: THREE.Object3D, objs: THREE.Object3D[]): THREE.Box3 {
  const inv = space.matrixWorld.clone().invert(), out = new THREE.Box3(), b = new THREE.Box3();
  for (const o of objs) { b.setFromObject(o); if (!b.isEmpty()) out.union(b.clone().applyMatrix4(inv)); }
  return out;
}

/** One shadow for a humanoid: a capsule from feet to neck and an ellipsoid head, riding the body pivot. */
export function humanoidShadow(rig: HumanoidRig) {
  rig.root.updateMatrixWorld(true);
  const bodyBits = rig.body.children.filter((c) => (c as THREE.Mesh).isMesh);
  const head = boxIn(rig.body, [rig.head]), torso = boxIn(rig.body, [rig.legL, rig.legR, ...bodyBits]);
  const hs = head.getSize(new THREE.Vector3()), hc = head.getCenter(new THREE.Vector3());
  const ts = torso.getSize(new THREE.Vector3()), tc = torso.getCenter(new THREE.Vector3());
  const top = Math.min(torso.max.y, head.min.y + hs.y * 0.2), r = Math.max(0.05, Math.min(ts.x, ts.z) * 0.42), len = Math.max(0.05, top - torso.min.y - 2 * r);
  const headGeo = new THREE.SphereGeometry(0.5, 10, 8).scale(hs.x * 0.92, hs.y * 0.92, hs.z * 0.92).translate(hc.x, hc.y, hc.z);
  const bodyGeo = new THREE.CapsuleGeometry(r, len, 3, 8).scale(1, 1, Math.min(1, ts.z / Math.max(0.01, ts.x)) + 0.2).translate(tc.x, torso.min.y + r + len / 2, tc.z);
  stopCasting(rig.root);
  rig.body.add(proxyMesh([headGeo, bodyGeo]));
}

/** One shadow for anything else that moves (crabs, the Guardian): an ellipsoid fitted to it, riding `pivot`. */
export function blobShadow(root: THREE.Object3D, pivot: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = boxIn(pivot, [root]), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  stopCasting(root);
  pivot.add(proxyMesh([new THREE.SphereGeometry(0.5, 12, 8).scale(s.x * 0.85, s.y * 0.85, s.z * 0.85).translate(c.x, c.y, c.z)]));
}
