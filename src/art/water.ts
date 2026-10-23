import * as THREE from 'three';
import type { Look } from './looks';

// Stylised faceted water. Colour by depth, foam at the shoreline, sun glint.
// Depth is baked per-vertex from the terrain so no depth texture is needed (cheap on phones).

const vert = /* glsl */ `
  attribute float aDepth;
  uniform float uTime;
  varying float vDepth;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vViewDist;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float damp = clamp(aDepth * 1.5, 0.15, 1.0);
    // three gentle swells; analytic slopes give smooth normals
    float a1 = wp.x * 0.55 + uTime * 1.1, a2 = wp.z * 0.8 - uTime * 1.3, a3 = (wp.x + wp.z) * 1.6 + uTime * 2.1;
    float w = sin(a1) * 0.06 + sin(a2) * 0.05 + sin(a3) * 0.02;
    float dx = (cos(a1) * 0.06 * 0.55 + cos(a3) * 0.02 * 1.6) * damp;
    float dz = (cos(a2) * 0.05 * 0.8 + cos(a3) * 0.02 * 1.6) * damp;
    wp.y += w * damp;
    vNormal2 = normalize(vec3(-dx * 3.0, 1.0, -dz * 3.0));
    vDepth = aDepth;
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vViewDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow, uDeep, uFoam, uSunDir, uSunColor, uFogColor;
  uniform float uFogNear, uFogFar;
  varying float vDepth;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vViewDist;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    // fine ripples layered on the swell normal
    vec2 q = vWorld.xz * 0.9;
    float r1 = vn(q + vec2(uTime * 0.35, uTime * 0.2)), r2 = vn(q * 1.7 - vec2(uTime * 0.25, -uTime * 0.3));
    vec3 n = normalize(vNormal2 + vec3(r1 - 0.5, 0.0, r2 - 0.5) * 0.28);
    float dt = smoothstep(0.0, 3.0, vDepth);
    vec3 col = mix(uShallow, uDeep, dt);
    col *= 0.82 + 0.25 * max(dot(n, uSunDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 h = normalize(uSunDir + viewDir);
    col += uSunColor * pow(max(dot(n, h), 0.0), 140.0) * 0.6;
    // shoreline foam with a broken, organic edge
    float brk = vn(vWorld.xz * 1.6 + uTime * 0.3);
    float wob = sin(uTime * 1.4 + vWorld.x * 0.7 + vWorld.z * 0.3) * 0.05;
    float edge = 1.0 - smoothstep(0.05, 0.22 + brk * 0.12, vDepth + wob);
    float ringPhase = fract(vDepth * 1.4 - uTime * 0.2);
    float ring = smoothstep(0.42, 0.5, ringPhase) * (1.0 - smoothstep(0.5, 0.58, ringPhase)) * step(0.45, brk);
    ring *= 1.0 - smoothstep(0.35, 1.0, vDepth);
    float foam = clamp(edge + ring * 0.5, 0.0, 1.0);
    col = mix(col, uFoam, foam * 0.9);
    float alpha = mix(0.6, 0.95, smoothstep(0.0, 1.4, vDepth));
    alpha = max(alpha, foam);
    float f = smoothstep(uFogNear, uFogFar, vViewDist);
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createWater(size: number, segments: number, depthAt: (x: number, z: number) => number, look: Look) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = depthAt(pos.getX(i), pos.getZ(i));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(look.water.shallow) },
    uDeep: { value: new THREE.Color(look.water.deep) },
    uFoam: { value: new THREE.Color(look.water.foam) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(look.sun.color) },
    uFogColor: { value: new THREE.Color(look.fog.color) },
    uFogNear: { value: 30 },
    uFogFar: { value: 80 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}
