import * as THREE from 'three';
import type { Look } from './looks';

// Stylised faceted water. Colour by depth, foam at the shoreline, sun glint.
// Depth is baked per-vertex from the terrain so no depth texture is needed (cheap on phones).

const vert = /* glsl */ `
  attribute float aDepth;
  uniform float uTime;
  varying float vDepth;
  varying vec3 vWorld;
  varying float vViewDist;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float damp = clamp(aDepth * 1.5, 0.15, 1.0);
    float w = sin(wp.x * 0.55 + uTime * 1.1) * 0.06
            + sin(wp.z * 0.8 - uTime * 1.3) * 0.05
            + sin((wp.x + wp.z) * 1.6 + uTime * 2.1) * 0.02;
    wp.y += w * damp;
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
  varying float vViewDist;
  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;
    float dt = smoothstep(0.0, 2.6, vDepth);
    vec3 col = mix(uShallow, uDeep, dt);
    col *= 0.78 + 0.32 * max(dot(n, uSunDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 h = normalize(uSunDir + viewDir);
    col += uSunColor * smoothstep(0.985, 0.995, max(dot(n, h), 0.0)) * 0.5;

    float wob = sin(uTime * 1.4 + vWorld.x * 0.7 + vWorld.z * 0.3) * 0.05;
    float edge = 1.0 - smoothstep(0.06, 0.2, vDepth + wob);
    float ring = 1.0 - smoothstep(0.0, 0.05, abs(fract(vDepth * 1.6 - uTime * 0.22) - 0.5) - 0.0);
    ring *= 1.0 - smoothstep(0.35, 0.9, vDepth);
    float foam = clamp(edge + ring * 0.45, 0.0, 1.0);
    col = mix(col, uFoam, foam);

    float alpha = mix(0.62, 0.96, smoothstep(0.0, 1.4, vDepth));
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
