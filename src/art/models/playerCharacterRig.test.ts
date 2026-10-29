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

  it('bends both knees forward during the walk cycle', () => {
    const rig = buildPlayerCharacterRig();
    rig.setMotion('walk');
    for (let i = 0; i < 5; i++) rig.update(0.1);
    expect(rig.bones.LowerLeg_L.rotation.x).toBeGreaterThan(0);
    expect(rig.bones.LowerLeg_R.rotation.x).toBeGreaterThan(0);
  });

  it('weights the continuous arm surface across upper-arm and forearm bones', () => {
    const rig = buildPlayerCharacterRig();
    for (const side of ['L', 'R']) {
      const arm = rig.root.getObjectByName(`Arm_Skin_${side}`) as THREE.SkinnedMesh;
      expect(arm).toBeInstanceOf(THREE.SkinnedMesh);
      expect(arm.skeleton).toBe(rig.skeleton);
      const indices = arm.geometry.getAttribute('skinIndex');
      const weights = arm.geometry.getAttribute('skinWeight');
      const upper = rig.skeleton.bones.indexOf(rig.bones[`UpperArm_${side}`]);
      const forearm = rig.skeleton.bones.indexOf(rig.bones[`Forearm_${side}`]);
      let weightedAcrossElbow = false;
      for (let i = 0; i < weights.count; i++) {
        expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1, 5);
        if ((indices.getX(i) === upper && indices.getY(i) === forearm) || (indices.getX(i) === forearm && indices.getY(i) === upper)) {
          if (weights.getX(i) > 0.1 && weights.getY(i) > 0.1) weightedAcrossElbow = true;
        }
      }
      expect(weightedAcrossElbow).toBe(true);
    }
  });

  it('aligns shoulder and elbow pivots to the authored arm joints', () => {
    const rig = buildPlayerCharacterRig();
    rig.root.updateMatrixWorld(true);
    const upper = new THREE.Vector3();
    const elbow = new THREE.Vector3();
    rig.bones.UpperArm_R.getWorldPosition(upper);
    rig.bones.Forearm_R.getWorldPosition(elbow);
    expect(upper.distanceTo(new THREE.Vector3(0.07, 1.37, 0))).toBeLessThan(0.001);
    expect(elbow.distanceTo(new THREE.Vector3(0.325, 1.15, 0))).toBeLessThan(0.001);
  });

  it('keeps the run cycle continuous as it loops', () => {
    const rig = buildPlayerCharacterRig();
    rig.setMotion('run');
    for (let i = 0; i < 6; i++) rig.update(0.1);
    rig.update(0.04);
    const thighBeforeLoop = rig.bones.UpperLeg_L.rotation.x;
    rig.update(0.02);
    const thighAfterLoop = rig.bones.UpperLeg_L.rotation.x;
    expect(Math.abs(thighAfterLoop - thighBeforeLoop)).toBeLessThan(0.18);
  });

  it('attaches the equipped blade and shield to their respective hand joints', () => {
    const rig = buildPlayerCharacterRig('greatsword');
    expect(rig.held.parent?.name).toBe('Hand_R');
    expect(rig.held.children.length).toBeGreaterThan(0);
    const shield = addOffhand(rig, 'shield');
    expect(shield.parent?.name).toBe('Hand_L');
    expect(shield.children.length).toBeGreaterThan(0);
  });

  it('replaces and unequips main-hand visuals without detaching the hand socket', () => {
    const rig = buildPlayerCharacterRig();
    rig.setMainHand('sword');
    expect(rig.held.parent?.name).toBe('Hand_R');
    expect(rig.held.getObjectByName('StraightSword')).toBeTruthy();
    rig.setMainHand('cutlass');
    expect(rig.held.children.length).toBeGreaterThan(0);
    expect(rig.held.getObjectByName('StraightSword')).toBeUndefined();
    rig.setMainHand('staff');
    expect(rig.held.getObjectByName('BasicStaff')).toBeTruthy();
    rig.setMainHand('none');
    expect(rig.held.children).toHaveLength(0);
  });

  it('keeps shared cached materials alive when replacing hand equipment', () => {
    const rig = buildPlayerCharacterRig();
    rig.setMainHand('sword');
    const blade = rig.held.getObjectByName('Sword_Blade') as THREE.Mesh;
    let disposeEvents = 0;
    const bladeMaterial = Array.isArray(blade.material) ? blade.material[0] : blade.material;
    bladeMaterial.addEventListener('dispose', () => disposeEvents++);
    rig.setMainHand('cutlass');
    expect(disposeEvents).toBe(0);
    rig.setOffhand(true);
    const shield = rig.offhand?.getObjectByName('Shield_Backing') as THREE.Mesh;
    const shieldMaterial = Array.isArray(shield.material) ? shield.material[0] : shield.material;
    shieldMaterial.addEventListener('dispose', () => disposeEvents++);
    rig.setOffhand(false);
    expect(disposeEvents).toBe(0);
  });

  it('toggles the wooden shield at the left-hand socket', () => {
    const rig = buildPlayerCharacterRig();
    rig.setOffhand(true);
    const shield = rig.offhand;
    expect(shield?.parent?.name).toBe('Hand_L');
    expect(shield?.getObjectByName('WoodenShield')).toBeTruthy();
    rig.setOffhand(false);
    expect(rig.offhand).toBeNull();
    expect(shield?.parent).toBeNull();
  });

  it('registers renderer-created offhand shields so they can be replaced or removed', () => {
    const rig = buildPlayerCharacterRig();
    const first = addOffhand(rig, 'shield');
    expect(rig.offhand).toBe(first);
    const replacement = addOffhand(rig, 'shield');
    expect(rig.offhand).toBe(replacement);
    expect(rig.bones.Hand_L.children.filter(child => child.name === 'OffhandAttachment')).toHaveLength(1);
    rig.setOffhand(false);
    expect(replacement.parent).toBeNull();
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
