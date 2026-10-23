import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

/**
 * Merge the direct mesh children of every node under `root` (pivots stay animatable).
 * All merged parts of one rig share `material`, so a hit-flash is one property change.
 */
export function bakeRig(root: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  const visit = (node: THREE.Object3D) => {
    const parts: THREE.BufferGeometry[] = [];
    const remove: THREE.Object3D[] = [];
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
        }
      }
    }
    for (const c of node.children) if (!remove.includes(c)) visit(c);
    if (parts.length > 0) {
      for (const r of remove) node.remove(r);
      const merged = new THREE.Mesh(mergeGeometries(parts), material);
      merged.castShadow = cast;
      merged.receiveShadow = true;
      node.add(merged);
    }
  };
  visit(root);
}

/** Merge everything static in `root` (world space) into chunked meshes for culling. */
export function bakeStatic(root: THREE.Object3D, chunk = 40): THREE.Group {
  root.updateMatrixWorld(true);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0 });
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
