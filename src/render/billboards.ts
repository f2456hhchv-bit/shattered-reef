import * as THREE from 'three';
import { overrideTexture, overrideAspect, type ArtOverride } from '../art/overrides';

// Edited art for things there are many of (trees, boulders, props): one instanced draw per asset, every quad turned to
// face the camera in the vertex shader, standing on its spot. Instances can be hidden (a felled tree) by uid.

interface Entry { o: ArtOverride; pts: { x: number; y: number; z: number; s: number; uid?: string }[] }

export class BillboardBatch {
  readonly group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private where = new Map<string, { mesh: THREE.InstancedMesh; i: number; m: THREE.Matrix4 }>();
  private uids = new Set<string>();

  add(o: ArtOverride, x: number, y: number, z: number, s = 1, uid?: string) {
    let e = this.entries.get(o.file);
    if (!e) this.entries.set(o.file, (e = { o, pts: [] }));
    e.pts.push({ x, y, z, s, uid });
    if (uid) this.uids.add(uid);
  }

  has(uid: string) { return this.uids.has(uid); }

  /** Show or hide one instance (depleted nodes). */
  setVisible(uid: string, on: boolean) {
    const w = this.where.get(uid);
    if (!w) return;
    w.mesh.setMatrixAt(w.i, on ? w.m : new THREE.Matrix4().makeScale(0, 0, 0));
    w.mesh.instanceMatrix.needsUpdate = true;
  }

  build() {
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    for (const e of this.entries.values()) {
      const tex = overrideTexture(e.o);
      const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide });
      mat.onBeforeCompile = (sh) => {
        // stand the quad on its instance's origin, facing the camera, sized by the instance's x/y scale
        sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 bbScale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          mvPosition.xy += position.xy * bbScale;
          gl_Position = projectionMatrix * mvPosition;`);
      };
      mat.customProgramCacheKey = () => 'billboard';
      const mesh = new THREE.InstancedMesh(geo, mat, e.pts.length);
      mesh.frustumCulled = false; // instances spread over the whole region
      const place = () => {
        const aspect = overrideAspect(e.o, tex);
        e.pts.forEach((p, i) => {
          const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(e.o.h * aspect * p.s, e.o.h * p.s, 1));
          mesh.setMatrixAt(i, m);
          if (p.uid) this.where.set(p.uid, { mesh, i, m });
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      place();
      const img = tex.image as HTMLImageElement | undefined;
      if (img && !img.width) img.addEventListener?.('load', place, { once: true });
      this.group.add(mesh);
    }
  }
}
