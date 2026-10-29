import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const assetPath = new URL('../../../public/assets/characters/bellwether-player.glb', import.meta.url);

function glbJson(): Record<string, any> {
  const bytes = readFileSync(assetPath);
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
}

describe('Bellwether player GLB', () => {
  it('contains a skinned humanoid with equipped gear, two armour silhouettes and gameplay clips', () => {
    const gltf = glbJson();
    const names = new Set<string>(gltf.nodes.map((node: { name?: string }) => node.name ?? ''));
    const clipNames = new Set(gltf.animations.map((animation: { name: string }) => animation.name));
    expect(gltf.skins.length).toBeGreaterThan(0);
    expect(gltf.meshes.length).toBeLessThanOrEqual(35);
    for (const prefix of ['Deckhand_Body', 'Deckhand_Legs', 'Harbourguard_Armour', 'Harbourguard_Legs', 'Mainhand_Cutlass', 'Offhand_Shield']) {
      expect([...names].some((name: string) => name.startsWith(prefix)), `missing exported node ${prefix}`).toBe(true);
    }
    for (const clip of ['Idle', 'Walk', 'Run', 'MeleeSlash', 'RangedShot', 'Spellcast', 'HitReact', 'Work', 'Fishing']) expect(clipNames.has(clip), `missing ${clip} animation`).toBe(true);
    const jointNames = new Set(gltf.skins.flatMap((skin: { joints: number[] }) => skin.joints.map((index: number) => gltf.nodes[index].name)));
    for (const joint of ['Root', 'Spine', 'Head', 'UpperArm.R', 'Forearm.R', 'Hand.R', 'UpperLeg.L', 'LowerLeg.L']) {
      expect(jointNames.has(joint), `missing skeletal joint ${joint}`).toBe(true);
    }
  });

  it('places the sword and shield at their respective hand attachment points', () => {
    const gltf = glbJson();
    const bounds = (name: string) => {
      const node = gltf.nodes.find((entry: { name?: string }) => entry.name?.startsWith(name))!;
      const accessorIndex = gltf.meshes[node.mesh].primitives[0].attributes.POSITION;
      return gltf.accessors[accessorIndex] as { min: number[]; max: number[] };
    };
    expect(bounds('Mainhand_Cutlass').min[0]).toBeGreaterThan(.25);
    expect(bounds('Mainhand_Cutlass').max[0]).toBeLessThan(.45);
    expect(bounds('Offhand_Shield').max[0]).toBeLessThan(-.08);
  });

  it('keeps the rig upright in Three.js Y-up space so changing player yaw cannot lay it sideways', () => {
    const gltf = glbJson();
    const root = gltf.nodes.find((node: { name?: string }) => node.name === 'Root');
    expect(root).toBeDefined();
    expect(root.rotation).toBeUndefined();
    expect(root.translation[1]).toBeCloseTo(.94, 2);
    expect(root.translation[0]).toBeCloseTo(0, 3);
    expect(root.translation[2]).toBeCloseTo(0, 3);
  });
});
