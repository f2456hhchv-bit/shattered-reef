import * as THREE from 'three';

// Hundreds of ordinary, usable things (trees, boulders, bushes, kelp) drawn as instances.
// Grouped into large map buckets so off-screen buckets are culled, with a few shape variants per kind.
// Each placement can switch between its live look and an alternative (stump, rubble, picked bush) or vanish.

export interface FieldItem { uid: string; x: number; y: number; z: number; rot: number; s: number; variant: number }
const BUCKET = 70;

interface Slot { mesh: THREE.InstancedMesh; index: number; base: THREE.Matrix4 }
// meshes with nothing shown (all stumps hidden, say) are skipped entirely instead of drawing degenerate instances

export class InstancedField {
  readonly group = new THREE.Group();
  private slots = new Map<string, { live?: Slot; alt?: Slot }>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();

  constructor(private material: THREE.Material) {}

  /**
   * Add a kind: `live` geometries (one per variant) and an optional `alt` geometry shown when depleted.
   * `altScale` reshapes the alt (e.g. rubble = flattened boulder).
   */
  add(items: FieldItem[], live: THREE.BufferGeometry[], opts: { alt?: THREE.BufferGeometry; altScale?: [number, number, number]; castShadow?: boolean } = {}) {
    const buckets = new Map<string, FieldItem[]>();
    for (const it of items) {
      const k = `${Math.floor(it.x / BUCKET)},${Math.floor(it.z / BUCKET)}`;
      let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(it);
    }
    for (const list of buckets.values()) {
      for (let vi = 0; vi < live.length; vi++) {
        const mine = list.filter((it) => it.variant % live.length === vi);
        if (mine.length) this.fill(mine, live[vi], 'live', opts.castShadow ?? true);
      }
      if (opts.alt) this.fill(list, opts.alt, 'alt', false, opts.altScale);
    }
  }

  private fill(items: FieldItem[], geo: THREE.BufferGeometry, role: 'live' | 'alt', cast: boolean, scale: [number, number, number] = [1, 1, 1]) {
    const mesh = new THREE.InstancedMesh(geo, this.material, items.length);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    items.forEach((it, i) => {
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), it.rot);
      const base = new THREE.Matrix4().compose(this.v.set(it.x, it.y, it.z), this.q, this.sc.set(it.s * scale[0], it.s * scale[1], it.s * scale[2]));
      mesh.setMatrixAt(i, base);
      const e = this.slots.get(it.uid) ?? {};
      e[role] = { mesh, index: i, base };
      this.slots.set(it.uid, e);
    });
    mesh.computeBoundingSphere(); // from the real placements, so hidden alternatives still cull correctly
    mesh.userData.shown = role === 'live' ? items.length : 0;
    if (role === 'alt') { for (let i = 0; i < items.length; i++) mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); mesh.visible = false; }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  has(uid: string) { return this.slots.has(uid); }

  /** Live look, or the alternative (if any) when depleted. */
  set(uid: string, depleted: boolean) {
    const e = this.slots.get(uid);
    if (!e) return;
    const show = (s: Slot | undefined, on: boolean) => {
      if (!s) return;
      s.mesh.setMatrixAt(s.index, on ? s.base : this.m.makeScale(0, 0, 0));
      s.mesh.instanceMatrix.needsUpdate = true;
      s.mesh.userData.shown += on ? 1 : -1;
      s.mesh.visible = s.mesh.userData.shown > 0;
    };
    show(e.live, !depleted);
    show(e.alt, depleted);
  }
}
