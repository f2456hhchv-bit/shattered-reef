import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addOffhand } from './character';
import { buildPlayerCharacterRig, playerEquipmentIdsFromKey } from './playerCharacterRig';

describe('player character animation rig', () => {
  it('builds the required reusable humanoid bone hierarchy', () => {
    const rig = buildPlayerCharacterRig();
    const names = new Set(rig.skeleton.bones.map(bone => bone.name));
    for (const name of [
      'Root', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head',
      'Shoulder_L', 'Shoulder_R', 'UpperArm_L', 'UpperArm_R', 'Forearm_L', 'Forearm_R', 'Hand_L', 'Hand_R',
      'UpperLeg_L', 'UpperLeg_R', 'LowerLeg_L', 'LowerLeg_R', 'Foot_L', 'Foot_R',
    ]) expect(names).toContain(name);
    expect(rig.skeleton.bones.find(b => b.name === 'Head')?.parent?.name).toBe('Neck');
    expect(rig.skeleton.bones.find(b => b.name === 'Hand_R')?.parent?.name).toBe('Forearm_R');
    expect(rig.skeleton.bones.find(b => b.name === 'Foot_L')?.parent?.name).toBe('LowerLeg_L');
  });

  it('blends idle, walking and running states without discontinuous root motion', () => {
    const rig = buildPlayerCharacterRig();
    rig.setMotion('idle');
    rig.update(0.2);
    const idleRootY = rig.root.position.y;
    rig.setMotion('walk');
    rig.update(0.2);
    const walkLeg = rig.bones.UpperLeg_L.rotation.x;
    rig.setMotion('run');
    rig.update(0.2);
    const runLeg = rig.bones.UpperLeg_L.rotation.x;
    expect(rig.root.position.y).toBe(idleRootY);
    expect(Math.abs(walkLeg)).toBeGreaterThan(0);
    expect(Number.isFinite(runLeg)).toBe(true);
    expect(rig.current).toBe('run');
  });

  it('attaches the equipped blade and shield to their respective hand joints', () => {
    const rig = buildPlayerCharacterRig('greatsword');
    expect(rig.held.parent?.name).toBe('Hand_R');
    expect(rig.held.children.length).toBeGreaterThan(0);
    const shield = addOffhand(rig, 'shield');
    expect(shield.parent?.name).toBe('Hand_L');
    expect(shield.children.length).toBeGreaterThan(0);
  });

  it('plays the melee wind-up and follow-through on the equipped hand', () => {
    const rig = buildPlayerCharacterRig('greatsword');
    rig.setMotion('attack');
    rig.update(0.1);
    expect(rig.current).toBe('attack');
    expect(Math.abs(rig.bones.Shoulder_R.rotation.x)).toBeGreaterThan(0.1);
    rig.update(0.1);
    expect(Math.abs(rig.bones.Forearm_R.rotation.x)).toBeGreaterThan(0.1);
  });

  it('switches shared-skeleton starter, leather and iron appearance immediately', () => {
    const rig = buildPlayerCharacterRig();
    expect(rig.armour).toBe('starter');
    rig.setArmour('leather');
    expect(rig.armour).toBe('leather');
    expect(rig.root.getObjectByName('Chest_leather')?.visible).toBe(true);
    expect(rig.root.getObjectByName('Chest_iron')?.visible).toBe(false);
    rig.setArmour('iron');
    expect(rig.root.getObjectByName('Chest_leather')?.visible).toBe(false);
    expect(rig.root.getObjectByName('Chest_iron')?.visible).toBe(true);
    expect(rig.root.getObjectByName('Iron_Helm_Dome')?.visible).toBe(true);
  });

  it('shows and removes a cloak without changing the shared skeleton', () => {
    const rig = buildPlayerCharacterRig();
    const bones = rig.skeleton.bones;
    rig.setCape(0x6a6e72);
    const cape = rig.root.getObjectByName('PlayerCape');
    expect(cape?.parent?.name).toBe('Chest');
    expect((cape as THREE.Mesh).material).toBeInstanceOf(THREE.MeshStandardMaterial);
    rig.setCape();
    expect(rig.root.getObjectByName('PlayerCape')).toBeUndefined();
    expect(rig.skeleton.bones).toBe(bones);
  });

  it('changes individual equipment slots without silently replacing unequipped gear', () => {
    const rig = buildPlayerCharacterRig();
    rig.setEquipment({ head: 'helm_iron' });
    expect(rig.root.getObjectByName('Head_iron')?.visible).toBe(true);
    expect(rig.root.getObjectByName('Chest_iron')?.visible).toBe(false);
    expect(rig.root.getObjectByName('Torso_Shirt')?.visible).toBe(true);
    rig.setEquipment({ body: 'cloak_selkie', bodyColor: 0x6a6e72 });
    expect(rig.root.getObjectByName('PlayerCape')?.visible).toBe(true);
    expect(rig.root.getObjectByName('Chest_iron')?.visible).toBe(false);
    expect(rig.root.getObjectByName('Torso_Shirt')?.visible).toBe(true);
  });

  it('parses an empty appearance key without inventing missing item IDs', () => {
    expect(playerEquipmentIdsFromKey('')).toEqual({});
    expect(playerEquipmentIdsFromKey('-,-,-,-,-')).toEqual({});
    expect(playerEquipmentIdsFromKey('helm_iron,cloak_selkie,legs_leather,-,gloves_iron')).toEqual({
      head: 'helm_iron', body: 'cloak_selkie', legs: 'legs_leather', hands: 'gloves_iron',
    });
  });
});
