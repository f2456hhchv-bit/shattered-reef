import * as THREE from 'three';

// Pooled particles: one InstancedMesh, no per-frame allocation.

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grav: number; r: number; g: number; b: number }

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private free: P[] = [];
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(private cap = 500) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  }

  burst(x: number, y: number, z: number, n: number, colour: number, opts: { speed?: number; up?: number; size?: number; life?: number; grav?: number; spread?: number } = {}) {
    this.c.set(colour);
    for (let i = 0; i < n; i++) {
      if (this.ps.length >= this.cap) break;
      const p = this.free.pop() ?? ({} as P);
      const a = Math.random() * Math.PI * 2, sp = (opts.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const spread = opts.spread ?? 0.2;
      p.x = x + (Math.random() - 0.5) * spread; p.y = y; p.z = z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = (opts.up ?? 3) * (0.5 + Math.random() * 0.8);
      p.max = p.life = (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (opts.size ?? 0.12) * (0.6 + Math.random() * 0.8);
      p.grav = opts.grav ?? 12;
      const jitter = 0.85 + Math.random() * 0.3;
      p.r = this.c.r * jitter; p.g = this.c.g * jitter; p.b = this.c.b * jitter;
      this.ps.push(p);
    }
  }

  update(dt: number) {
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.free.push(p); this.ps[i] = this.ps[this.ps.length - 1]; this.ps.pop(); continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    for (const p of this.ps) {
      const k = Math.min(1, p.life / p.max * 2);
      this.s.setScalar(p.size * k);
      this.v.set(p.x, p.y, p.z);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.c.setRGB(p.r, p.g, p.b);
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
