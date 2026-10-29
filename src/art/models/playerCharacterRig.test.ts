import { describe, expect, it } from 'vitest';
import { buildPlayerCharacterRig } from './playerCharacterRig';

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
});
