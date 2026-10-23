import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { Look } from './looks';

// Display-space colour grade: saturation, contrast, split-tone, vignette.
export function createGradePass(look: Look): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uSat: { value: 1 },
      uContrast: { value: 1 },
      uBright: { value: 1 },
      uVignette: { value: 0 },
      uShadowTint: { value: new THREE.Vector3() },
      uHighTint: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uSat, uContrast, uBright, uVignette;
      uniform vec3 uShadowTint, uHighTint;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, uSat);
        c = (c - 0.5) * uContrast + 0.5;
        c *= uBright;
        l = dot(c, vec3(0.299, 0.587, 0.114));
        c += mix(uShadowTint, uHighTint, smoothstep(0.15, 0.8, l));
        vec2 d = vUv - 0.5;
        float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 1.15)));
        c *= mix(1.0, v, uVignette);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }
    `,
  });
  applyGrade(pass, look);
  return pass;
}

export function applyGrade(pass: ShaderPass, look: Look) {
  const u = pass.uniforms;
  u.uSat.value = look.grade.saturation;
  u.uContrast.value = look.grade.contrast;
  u.uBright.value = look.grade.brightness;
  u.uVignette.value = look.grade.vignette;
  (u.uShadowTint.value as THREE.Vector3).set(...look.grade.shadowTint);
  (u.uHighTint.value as THREE.Vector3).set(...look.grade.highlightTint);
}
