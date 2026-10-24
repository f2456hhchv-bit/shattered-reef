import * as THREE from 'three';

// Your edited art (Tom, 2026-10-24): every asset is a PNG in art/ (scripts/art-export.cjs). A PNG you've changed is
// synced to public/art-overrides/ (scripts/art-sync.mjs) and replaces the game's own art: item icons directly; 3D
// things (creatures, people, resources, props) become a camera-facing cut-out the size of the model it replaces.

export type ArtKind = 'items' | 'creatures' | 'characters' | 'resources' | 'props';
export interface ArtOverride { file: string; h: number; w: number }

let index: Partial<Record<ArtKind, Record<string, ArtOverride>>> = {};
const BASE = './'; // vite.config base: the game is served from its own folder

/** Read the list of edited assets. Missing or unreadable: the game simply uses its own art. */
export async function loadArtOverrides() {
  try {
    const r = await fetch(`${BASE}art-overrides/index.json`, { cache: 'no-cache' });
    if (r.ok) index = await r.json();
  } catch { /* no edits */ }
}

export function artOverride(kind: ArtKind, id: string): ArtOverride | undefined { return index[kind]?.[id]; }
export const overrideUrl = (o: ArtOverride) => `${BASE}${o.file}`;

const textures = new Map<string, THREE.Texture>();
/** The edited PNG as a texture (shared by every sprite of the same asset). */
export function overrideTexture(o: ArtOverride): THREE.Texture {
  let t = textures.get(o.file);
  if (!t) {
    t = new THREE.TextureLoader().load(overrideUrl(o));
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(o.file, t);
  }
  return t;
}
/** Width over height of the PNG (known once it has loaded; the model's own proportions until then). */
export function overrideAspect(o: ArtOverride, t: THREE.Texture): number {
  const img = t.image as { width?: number; height?: number } | undefined;
  return img?.width && img.height ? img.width / img.height : o.w / Math.max(0.01, o.h);
}

/** Swap a built model's look for the edited PNG: its meshes are hidden (animation code keeps working on them) and a
 * cut-out stands at its feet, as tall as the model. */
export function spriteSwap(root: THREE.Object3D, o: ArtOverride): THREE.Sprite {
  root.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.visible = false; });
  const tex = overrideTexture(o);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.35 }));
  sprite.center.set(0.5, 0);
  const size = () => sprite.scale.set(o.h * overrideAspect(o, tex), o.h, 1);
  size();
  if (!(tex.image as { width?: number } | undefined)?.width) {
    const img = tex.image as HTMLImageElement | undefined;
    img?.addEventListener?.('load', size, { once: true });
  }
  sprite.userData.artOverride = true;
  root.add(sprite);
  return sprite;
}
