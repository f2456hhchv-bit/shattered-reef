import * as THREE from 'three';
import type { Look } from './looks';

// Stylised faceted water. Colour by depth, foam at the shoreline, sun glint.
// Depth comes from a half-float copy of the terrain height grid, sampled per pixel with linear filtering,
// so the shoreline follows the land smoothly instead of the coarser water mesh (no depth pre-pass needed).

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
  uniform sampler2D uHeight;
  uniform vec3 uGrid; // (world half-size, cell size, samples per side)
  varying float vDepth;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vViewDist;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float depthAt(vec2 p) {
    vec2 g = (p + uGrid.x) / uGrid.y;
    if (any(lessThan(g, vec2(0.0))) || any(greaterThan(g, vec2(uGrid.z - 1.0)))) return 6.0;
    return -texture2D(uHeight, (g + 0.5) / uGrid.z).r;
  }
  void main() {
    float depth = depthAt(vWorld.xz);
    // the beach sits only a hand's width above the swell: never let a wave crest poke up through dry sand
    if (depth < -0.04) discard;
    // fine ripples layered on the swell normal
    vec2 q = vWorld.xz * 0.9;
    float r1 = vn(q + vec2(uTime * 0.35, uTime * 0.2)), r2 = vn(q * 1.7 - vec2(uTime * 0.25, -uTime * 0.3));
    vec3 n = normalize(vNormal2 + vec3(r1 - 0.5, 0.0, r2 - 0.5) * 0.28);
    float dt = smoothstep(0.0, 3.0, depth);
    vec3 col = mix(uShallow, uDeep, dt);
    col *= 0.82 + 0.25 * max(dot(n, uSunDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 h = normalize(uSunDir + viewDir);
    col += uSunColor * pow(max(dot(n, h), 0.0), 140.0) * 0.6;
    // shoreline foam with a broken, organic edge
    float brk = vn(vWorld.xz * 1.6 + uTime * 0.3);
    float wob = sin(uTime * 1.4 + vWorld.x * 0.7 + vWorld.z * 0.3) * 0.05;
    float edge = 1.0 - smoothstep(0.05, 0.22 + brk * 0.12, depth + wob);
    float ringPhase = fract(depth * 1.4 - uTime * 0.2);
    float ring = smoothstep(0.42, 0.5, ringPhase) * (1.0 - smoothstep(0.5, 0.58, ringPhase)) * step(0.45, brk);
    ring *= 1.0 - smoothstep(0.35, 1.0, depth);
    float foam = clamp(edge + ring * 0.5, 0.0, 1.0);
    col = mix(col, uFoam, foam * 0.9);
    float alpha = mix(0.6, 0.95, smoothstep(0.0, 1.4, depth));
    alpha = max(alpha, foam) * smoothstep(-0.04, 0.03, depth + brk * 0.04); // soft, broken waterline
    float f = smoothstep(uFogNear, uFogFar, vViewDist);
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface HeightGrid { data: Float32Array; side: number; cell: number; half: number }

export function createWater(size: number, segments: number, depthAt: (x: number, z: number) => number, look: Look, grid?: HeightGrid) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = depthAt(pos.getX(i), pos.getZ(i));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  // no terrain grid given: sample the depth function on the water mesh's own grid
  if (!grid) {
    const side = segments + 1, cell = size / segments, data = new Float32Array(side * side);
    for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) data[j * side + i] = -depthAt(i * cell - size / 2, j * cell - size / 2);
    grid = { data, side, cell, half: size / 2 };
  }
  const half = new Uint16Array(grid.data.length);
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(grid.data[i]);
  const heightTex = new THREE.DataTexture(half, grid.side, grid.side, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; // half-float filtering is core in WebGL2, unlike float32
  heightTex.needsUpdate = true;
  const uniforms = {
    uHeight: { value: heightTex },
    uGrid: { value: new THREE.Vector3(grid.half, grid.cell, grid.side) },
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
