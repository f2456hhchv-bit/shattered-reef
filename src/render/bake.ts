import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addSurfaceDetail } from '../art/surface';

// Draw-call reduction: merge flat-coloured meshes into one vertex-coloured mesh.
// Emissive, transparent or double-sided parts are left alone so glows and sails still work.

const bakeable = (m: THREE.Mesh) => {
  const mat = m.material as THREE.MeshStandardMaterial;
  return !Array.isArray(m.material) && mat.isMeshStandardMaterial && !mat.transparent && mat.side === THREE.FrontSide && (mat.emissiveIntensity ?? 0) === 0 && !mat.vertexColors && !mat.map;
};

function prep(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, colour: THREE.Color): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(matrix);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = colour.r; c[i * 3 + 1] = colour.g; c[i * 3 + 2] = colour.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.morphAttributes = {};
  return g;
}

function vertexColoured(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(matrix);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

// Vinyl (clear-coat) and unlit parts merge too: same-finish parts share one vertex-coloured copy of the finish.
const finishCache = new Map<string, THREE.Material>();
function finishOf(m: THREE.Mesh): { key: string; make: () => THREE.Material } | null {
  const mt = m.material as THREE.Material;
  if (Array.isArray(m.material) || mt.transparent || mt.side !== THREE.FrontSide || (mt as THREE.MeshBasicMaterial).map || (mt as THREE.MeshBasicMaterial).vertexColors) return null;
  const ph = mt as THREE.MeshPhysicalMaterial;
  if (ph.isMeshPhysicalMaterial && ph.emissive.getHex() === 0) {
    const key = `ph|${ph.roughness}|${ph.metalness}|${ph.clearcoat}|${ph.clearcoatRoughness}`;
    return { key, make: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: ph.roughness, metalness: ph.metalness, clearcoat: ph.clearcoat, clearcoatRoughness: ph.clearcoatRoughness }) };
  }
  if ((mt as THREE.MeshBasicMaterial).isMeshBasicMaterial) return { key: 'basic', make: () => new THREE.MeshBasicMaterial({ vertexColors: true }) };
  return null;
}

/**
 * Merge the direct mesh children of every node under `root` (pivots stay animatable).
 * All merged parts of one rig share `material`, so a hit-flash is one property change.
 */
export function bakeRig(root: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  const visit = (node: THREE.Object3D) => {
    const parts: THREE.BufferGeometry[] = [];
    const remove: THREE.Object3D[] = [];
    const finishes = new Map<string, { parts: THREE.BufferGeometry[]; cast: boolean; make: () => THREE.Material }>();
    let cast = false;
    for (const c of node.children) {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.children.length === 0) {
        const vc = (m.material as THREE.MeshStandardMaterial).vertexColors;
        if (bakeable(m)) {
          m.updateMatrix();
          parts.push(prep(m.geometry, m.matrix, (m.material as THREE.MeshStandardMaterial).color));
          remove.push(m);
          cast ||= m.castShadow;
        } else if (vc && !Array.isArray(m.material)) {
          m.updateMatrix();
          parts.push(vertexColoured(m.geometry, m.matrix));
          remove.push(m);
          cast ||= m.castShadow;
        } else {
          const f = finishOf(m);
          if (f) {
            m.updateMatrix();
            let fb = finishes.get(f.key);
            if (!fb) finishes.set(f.key, (fb = { parts: [], cast: false, make: f.make }));
            fb.parts.push(prep(m.geometry, m.matrix, (m.material as THREE.MeshStandardMaterial).color));
            fb.cast ||= m.castShadow;
            remove.push(m);
          }
        }
      }
    }
    for (const c of node.children) if (!remove.includes(c)) visit(c);
    for (const r of remove) node.remove(r);
    for (const [key, fb] of finishes) {
      let fm = finishCache.get(key);
      if (!fm) finishCache.set(key, (fm = fb.make()));
      const merged = new THREE.Mesh(mergeGeometries(fb.parts), fm);
      merged.castShadow = fb.cast;
      merged.receiveShadow = true;
      node.add(merged);
    }
    if (parts.length > 0) {
      const merged = new THREE.Mesh(mergeGeometries(parts), material);
      merged.castShadow = cast;
      merged.receiveShadow = true;
      node.add(merged);
    }
  };
  visit(root);
}

/**
 * Flatten every mesh under `root` into one or a few meshes in root's own space: flat-coloured parts into one mesh
 * with `material`, everything else (glass, glows) into one mesh per shared material. For things that move or hide
 * as a whole (a building's roof, its walls) but have no moving parts of their own.
 */
export function bakeFlat(root: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !Array.isArray((o as THREE.Mesh).material)) meshes.push(o as THREE.Mesh); });
  const baked: THREE.BufferGeometry[] = [], other = new Map<THREE.Material, THREE.BufferGeometry[]>();
  let cast = false;
  for (const m of meshes) {
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const mm = m.material as THREE.MeshStandardMaterial;
    if (bakeable(m)) { baked.push(prep(m.geometry, mtx, mm.color)); cast ||= m.castShadow; }
    else if (mm.vertexColors) { baked.push(vertexColoured(m.geometry, mtx)); cast ||= m.castShadow; }
    else {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(mtx);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.morphAttributes = {};
      let list = other.get(mm);
      if (!list) other.set(mm, (list = []));
      list.push(g);
    }
    m.removeFromParent();
  }
  // drop the emptied groups
  for (const c of [...root.children]) { let any = false; c.traverse((o) => { any ||= (o as THREE.Mesh).isMesh || (o as THREE.Light).isLight; }); if (!any) root.remove(c); }
  if (baked.length) { const mesh = new THREE.Mesh(mergeGeometries(baked), material); mesh.castShadow = cast; mesh.receiveShadow = true; root.add(mesh); }
  for (const [mm, list] of other) { const mesh = new THREE.Mesh(mergeGeometries(list), mm); mesh.receiveShadow = true; root.add(mesh); }
}

/** Merge everything static in `root` (world space) into chunked meshes for culling. */
export function bakeStatic(root: THREE.Object3D, chunk = 40): THREE.Group {
  root.updateMatrixWorld(true);
  const material = addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0 }), { scale: 3, tone: 0.24, bump: 0.4 });
  const buckets = new Map<string, { cast: THREE.BufferGeometry[]; nocast: THREE.BufferGeometry[] }>();
  const keep: THREE.Object3D[] = [];
  const pos = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) {
      if ((o as THREE.Light).isLight && (o as THREE.Light).intensity > 0) keep.push(o);
      return;
    }
    m.getWorldPosition(pos);
    const key = `${Math.floor(pos.x / chunk)},${Math.floor(pos.z / chunk)}`;
    let b = buckets.get(key);
    if (!b) { b = { cast: [], nocast: [] }; buckets.set(key, b); }
    const mt = m.material as THREE.MeshStandardMaterial;
    if (bakeable(m)) (m.castShadow ? b.cast : b.nocast).push(prep(m.geometry, m.matrixWorld, mt.color));
    else if (mt.vertexColors && !Array.isArray(m.material)) (m.castShadow ? b.cast : b.nocast).push(vertexColoured(m.geometry, m.matrixWorld));
    else keep.push(m);
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    for (const [list, cast] of [[b.cast, true], [b.nocast, false]] as const) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list), material);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      out.add(mesh);
    }
  }
  // keep special meshes/lights with their world transform
  for (const k of keep) {
    k.updateMatrixWorld(true);
    const clone = k.clone(false) as THREE.Object3D;
    k.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}

/** One vertex-coloured geometry from a whole model (its own root transform ignored): for instancing. */
export function mergeColoured(root: THREE.Object3D): THREE.BufferGeometry {
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const mt = m.material as THREE.MeshStandardMaterial;
    parts.push(mt.vertexColors ? vertexColoured(m.geometry, m.matrixWorld) : prep(m.geometry, m.matrixWorld, mt.emissiveIntensity ? mt.color.clone().lerp(mt.emissive, 0.35) : mt.color));
  });
  return mergeGeometries(parts);
}
