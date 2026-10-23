// Art-direction "looks". Lighting, fog, grading and ground palettes only:
// the models themselves are identical across looks, so the comparison is fair.

export interface Look {
  id: string;
  label: string;
  fog: { color: number; near: number; far: number }; // near/far as multiples of camera distance
  sun: { color: number; intensity: number; elevationDeg: number; azimuthDeg: number };
  hemi: { sky: number; ground: number; intensity: number };
  exposure: number;
  lanternIntensity: number;
  windowGlow: number;
  grade: {
    saturation: number;
    contrast: number;
    brightness: number;
    vignette: number;
    shadowTint: [number, number, number];
    highlightTint: [number, number, number];
  };
  ground: {
    sand: number;
    wetSand: number;
    grass: number;
    grassDark: number;
    dirt: number;
    rock: number;
    rockDark: number;
    seabed: number;
    seabedDeep: number;
  };
  water: { shallow: number; deep: number; foam: number };
}

export const LOOK_BRIGHT: Look = {
  id: 'bright',
  label: 'A · Bright (RuneScape-leaning)',
  fog: { color: 0x9fc9cf, near: 1.05, far: 2.6 },
  sun: { color: 0xfff1d6, intensity: 2.6, elevationDeg: 56, azimuthDeg: -42 },
  hemi: { sky: 0xbfe3ff, ground: 0x6b7a4a, intensity: 1.05 },
  exposure: 1.0,
  lanternIntensity: 0,
  windowGlow: 0.15,
  grade: {
    saturation: 1.12,
    contrast: 1.04,
    brightness: 1.02,
    vignette: 0.18,
    shadowTint: [-0.01, 0.0, 0.02],
    highlightTint: [0.02, 0.01, -0.01],
  },
  ground: {
    sand: 0xd8c08a,
    wetSand: 0xb59e6c,
    grass: 0x6f9a4a,
    grassDark: 0x55803c,
    dirt: 0x9c7a50,
    rock: 0x8a8f8c,
    rockDark: 0x6c7270,
    seabed: 0xc7b483,
    seabedDeep: 0x2e6f73,
  },
  water: { shallow: 0x4fc2bb, deep: 0x175f78, foam: 0xf2f6ee },
};

export const LOOK_DARK: Look = {
  id: 'dark',
  label: 'B · Moody (Diablo-leaning)',
  fog: { color: 0x34474d, near: 0.9, far: 2.1 },
  sun: { color: 0xffc58a, intensity: 2.3, elevationDeg: 34, azimuthDeg: -66 },
  hemi: { sky: 0x7d93a0, ground: 0x3a362a, intensity: 0.85 },
  exposure: 0.95,
  lanternIntensity: 9,
  windowGlow: 2.2,
  grade: {
    saturation: 0.82,
    contrast: 1.16,
    brightness: 0.96,
    vignette: 0.62,
    shadowTint: [-0.02, 0.01, 0.04],
    highlightTint: [0.05, 0.02, -0.03],
  },
  ground: {
    sand: 0xb59c70,
    wetSand: 0x8a7552,
    grass: 0x56693a,
    grassDark: 0x3e5030,
    dirt: 0x6e5338,
    rock: 0x6f6e68,
    rockDark: 0x4f4f4b,
    seabed: 0x9b8a66,
    seabedDeep: 0x1d3f48,
  },
  water: { shallow: 0x3a8f8c, deep: 0x0f3546, foam: 0xd9ddd2 },
};

export const LOOKS: Look[] = [LOOK_BRIGHT, LOOK_DARK];
