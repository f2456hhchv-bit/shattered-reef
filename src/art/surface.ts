import * as THREE from 'three';

// Surface detail for code-built models, with no textures to download:
// world-space 3D noise gives every surface fine tonal variation (grain, weathering) and a micro-bump
// in its lighting, and a soft rim light separates characters from the ground (the Diablo trick).
// One global switch turns it off for battery saver.

export const surfaceUniforms = { uDetail: { value: 1 } };

const NOISE = /* glsl */ `
uniform float uDetail;
varying vec3 vSdPos;
float sdH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sdN(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sdH(i), sdH(i + vec3(1, 0, 0)), f.x), mix(sdH(i + vec3(0, 1, 0)), sdH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sdH(i + vec3(0, 0, 1)), sdH(i + vec3(1, 0, 1)), f.x), mix(sdH(i + vec3(0, 1, 1)), sdH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sdF(vec3 p) { return sdN(p) * 0.6 + sdN(p * 2.7 + 11.0) * 0.4; }
`;

export interface SurfaceOpts { scale?: number; tone?: number; bump?: number; rim?: number; rimColor?: number }

export function addSurfaceDetail<M extends THREE.MeshStandardMaterial>(m: M, opts: SurfaceOpts = {}): M {
  const scale = opts.scale ?? 3.5, tone = opts.tone ?? 0.22, bump = opts.bump ?? 0.35, rim = opts.rim ?? 0;
  const rimColor = new THREE.Color(opts.rimColor ?? 0xfff0d0);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uDetail = surfaceUniforms.uDetail;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSdPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 sdW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  sdW = instanceMatrix * sdW;
  #endif
  vSdPos = (modelMatrix * sdW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (uDetail > 0.5) diffuseColor.rgb *= ${(1 - tone / 2).toFixed(3)} + ${tone.toFixed(3)} * sdF(vSdPos * ${scale.toFixed(2)});`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uDetail > 0.5) {
    // micro-bump: gradient of the same noise, turned into a view-space normal tilt
    vec3 q = vSdPos * ${(scale * 1.6).toFixed(2)};
    float n0 = sdF(q), e = 0.35;
    vec3 g = vec3(sdF(q + vec3(e, 0, 0)) - n0, sdF(q + vec3(0, e, 0)) - n0, sdF(q + vec3(0, 0, e)) - n0) / e;
    vec3 gv = (viewMatrix * vec4(g, 0.0)).xyz;
    normal = normalize(normal - ${bump.toFixed(3)} * (gv - dot(gv, normal) * normal));
  }`)
      .replace('#include <opaque_fragment>', rim > 0 ? `
  float sdRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += vec3(${rimColor.r.toFixed(3)}, ${rimColor.g.toFixed(3)}, ${rimColor.b.toFixed(3)}) * sdRim * ${rim.toFixed(3)};
#include <opaque_fragment>` : '#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => `sd${scale}|${tone}|${bump}|${rim}`;
  return m;
}
