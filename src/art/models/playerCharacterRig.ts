import * as THREE from 'three';
import { buildHeld, type HeldKind, type HumanoidRig } from './character';
import { buildPlayerCharacterGeometry } from './playerCharacter';
import { buildPlayerStaff, buildPlayerSword } from './playerEquipment';

export type PlayerMotion = 'idle' | 'walk' | 'run' | 'attack';

export interface PlayerCharacterRig extends HumanoidRig {
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  mixer: THREE.AnimationMixer;
  current: PlayerMotion;
  setMotion(motion: PlayerMotion): void;
  face(angle: number, dt: number): void;
  update(dt: number): void;
}

function bone(name: string, parent: THREE.Bone, position: THREE.Vector3Tuple): THREE.Bone {
  const joint = new THREE.Bone();
  joint.name = name;
  joint.position.set(...position);
  parent.add(joint);
  return joint;
}

function clip(name: string, duration: number, tracks: THREE.KeyframeTrack[]): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, tracks);
}

function scalar(path: string, times: number[], values: number[]): THREE.NumberKeyframeTrack {
  return new THREE.NumberKeyframeTrack(path, times, values);
}

function animationClips(): Record<PlayerMotion, THREE.AnimationClip> {
  const idleTimes = [0, 0.5, 1];
  const cycle = [0, 0.25, 0.5, 0.75, 1];
  const opposite = (values: number[]) => values.map(value => -value);
  const walk = [0, 0.36, 0, -0.36, 0];
  const kneeWalk = [0, 0.05, 0.3, 0.05, 0];
  const run = [0, 0.56, 0, -0.56, 0];
  const kneeRun = [0, 0.12, 0.5, 0.12, 0];
  return {
    idle: clip('PlayerIdle', 1, [
      scalar('Pelvis.position[y]', idleTimes, [0.9, 0.906, 0.9]),
      scalar('Spine.rotation[z]', idleTimes, [0, 0.012, 0]),
      scalar('Head.rotation[y]', idleTimes, [0, 0.025, 0]),
    ]),
    walk: clip('PlayerWalk', 1, [
      scalar('Pelvis.position[y]', cycle, [0.9, 0.92, 0.9, 0.92, 0.9]),
      scalar('UpperLeg_L.rotation[x]', cycle, walk), scalar('UpperLeg_R.rotation[x]', cycle, opposite(walk)),
      scalar('LowerLeg_L.rotation[x]', cycle, kneeWalk), scalar('LowerLeg_R.rotation[x]', cycle, opposite(kneeWalk)),
      scalar('Shoulder_L.rotation[x]', cycle, opposite(walk.map(v => v * 0.75))),
      scalar('Shoulder_R.rotation[x]', cycle, walk.map(v => v * 0.75)),
      scalar('Forearm_L.rotation[x]', cycle, [-0.16, -0.28, -0.16, -0.04, -0.16]),
      scalar('Forearm_R.rotation[x]', cycle, [-0.16, -0.04, -0.16, -0.28, -0.16]),
    ]),
    run: clip('PlayerRun', 0.72, [
      scalar('Pelvis.position[y]', cycle, [0.9, 0.935, 0.9, 0.935, 0.9]),
      scalar('Spine.rotation[x]', cycle, [0.08, 0.12, 0.08, 0.04, 0.08]),
      scalar('UpperLeg_L.rotation[x]', cycle, run), scalar('UpperLeg_R.rotation[x]', cycle, opposite(run)),
      scalar('LowerLeg_L.rotation[x]', cycle, kneeRun), scalar('LowerLeg_R.rotation[x]', cycle, opposite(kneeRun)),
      scalar('Shoulder_L.rotation[x]', cycle, opposite(run)), scalar('Shoulder_R.rotation[x]', cycle, run),
      scalar('Forearm_L.rotation[x]', cycle, [-0.22, -0.42, -0.22, -0.04, -0.22]),
      scalar('Forearm_R.rotation[x]', cycle, [-0.22, -0.04, -0.22, -0.42, -0.22]),
    ]),
    attack: clip('PlayerMeleeSlash', 0.7, [
      scalar('Pelvis.rotation[y]', [0, 0.18, 0.38, 0.7], [0, -0.12, 0.12, 0]),
      scalar('Spine.rotation[y]', [0, 0.18, 0.38, 0.7], [0, -0.12, 0.12, 0]),
      scalar('Chest.rotation[y]', [0, 0.18, 0.38, 0.7], [0, -0.04, 0.04, 0]),
      scalar('Shoulder_R.rotation[x]', [0, 0.18, 0.38, 0.7], [0, -1.25, -0.45, 0]),
      scalar('Shoulder_R.rotation[z]', [0, 0.18, 0.38, 0.7], [0, 0.12, -0.52, 0]),
      scalar('Forearm_R.rotation[x]', [0, 0.18, 0.38, 0.7], [0, -0.82, -0.28, 0]),
      scalar('LowerLeg_L.rotation[x]', [0, 0.18, 0.38, 0.7], [0, 0.12, 0.12, 0]),
      scalar('LowerLeg_R.rotation[x]', [0, 0.18, 0.38, 0.7], [0, 0.12, 0.12, 0]),
    ]),
  };
}

/**
 * Reusable named skeleton for the simple stylized player. Rigid clothing/limb volumes are
 * attached to their matching joints; no mesh needs to deform across a joint seam.
 */
export function buildPlayerCharacterRig(heldKind: HeldKind = 'none'): PlayerCharacterRig {
  const root = new THREE.Group();
  root.name = 'PlayerCharacter';
  const body = new THREE.Group();
  body.name = 'BodyMotion';
  root.add(body);
  const rootBone = new THREE.Bone();
  rootBone.name = 'Root';
  body.add(rootBone);
  const bones: Record<string, THREE.Bone> = { Root: rootBone };

  const pelvis = bones.Pelvis = bone('Pelvis', rootBone, [0, 0.9, 0]);
  const spine = bones.Spine = bone('Spine', pelvis, [0, 0.14, 0]);
  const chest = bones.Chest = bone('Chest', spine, [0, 0.22, 0]);
  const neck = bones.Neck = bone('Neck', chest, [0, 0.15, 0]);
  const head = bones.Head = bone('Head', neck, [0, 0.14, 0]);

  const shoulders: THREE.Bone[] = [];
  const upperArms: THREE.Bone[] = [];
  const forearms: THREE.Bone[] = [];
  const hands: THREE.Bone[] = [];
  const upperLegs: THREE.Bone[] = [];
  const lowerLegs: THREE.Bone[] = [];
  const feet: THREE.Bone[] = [];
  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? 'L' : 'R';
    const shoulder = bones[`Shoulder_${suffix}`] = bone(`Shoulder_${suffix}`, chest, [side * 0.18, 0.01, 0]);
    const upperArm = bones[`UpperArm_${suffix}`] = bone(`UpperArm_${suffix}`, shoulder, [side * 0.08, -0.02, 0]);
    const forearm = bones[`Forearm_${suffix}`] = bone(`Forearm_${suffix}`, upperArm, [side * 0.14, -0.21, 0]);
    const hand = bones[`Hand_${suffix}`] = bone(`Hand_${suffix}`, forearm, [side * 0.02, -0.27, 0]);
    const upperLeg = bones[`UpperLeg_${suffix}`] = bone(`UpperLeg_${suffix}`, pelvis, [side * 0.12, -0.01, 0]);
    const lowerLeg = bones[`LowerLeg_${suffix}`] = bone(`LowerLeg_${suffix}`, upperLeg, [0, -0.45, 0]);
    const foot = bones[`Foot_${suffix}`] = bone(`Foot_${suffix}`, lowerLeg, [0, -0.39, 0]);
    shoulders.push(shoulder); upperArms.push(upperArm); forearms.push(forearm); hands.push(hand);
    upperLegs.push(upperLeg); lowerLegs.push(lowerLeg); feet.push(foot);
  }

  const model = buildPlayerCharacterGeometry();
  body.add(model);
  root.updateMatrixWorld(true);
  const attach = (object: THREE.Object3D, target: THREE.Bone) => target.attach(object);
  for (const child of [...model.children]) {
    const name = child.name;
    if (/^(Head_Skin|Hair_|Ear_|Eye_|Brow_|Nose)/.test(name)) attach(child, head);
    else if (name === 'Neck') attach(child, neck);
    else if (/^(Torso_Shirt|Shoulder_Strap_|Strap_Buckle)/.test(name)) attach(child, chest);
    else if (/^(Sash_)/.test(name)) attach(child, pelvis);
    else if (/^Starter_Trousers_L/.test(name)) attach(child, upperLegs[0]);
    else if (/^Starter_Trousers_R/.test(name)) attach(child, upperLegs[1]);
    else if (/^(Sleeve_L|UpperArm_L)/.test(name)) attach(child, upperArms[0]);
    else if (/^(Sleeve_R|UpperArm_R)/.test(name)) attach(child, upperArms[1]);
    else if (/^(Forearm_L|Forearm_Guard_L)/.test(name)) attach(child, forearms[0]);
    else if (/^(Forearm_R|Forearm_Guard_R)/.test(name)) attach(child, forearms[1]);
    else if (name === 'Hand_L') attach(child, hands[0]);
    else if (name === 'Hand_R') attach(child, hands[1]);
    else if (/^(Boot_L|Boot_Cuff_L)/.test(name)) attach(child, lowerLegs[0]);
    else if (/^(Boot_R|Boot_Cuff_R)/.test(name)) attach(child, lowerLegs[1]);
  }

  const skeleton = new THREE.Skeleton(Object.values(bones));
  skeleton.calculateInverses();
  const mixer = new THREE.AnimationMixer(root);
  const clips = animationClips();
  const actions = Object.fromEntries(Object.entries(clips).map(([key, value]) => [key, mixer.clipAction(value)])) as Record<PlayerMotion, THREE.AnimationAction>;
  let current: PlayerMotion = 'idle';
  let active = actions.idle;
  active.play();
  const held = new THREE.Group();
  held.name = 'MainHandAttachment';
  held.position.set(0, 0, 0.045);
  hands[1].add(held);
  if (heldKind === 'greatsword') held.add(buildPlayerSword());
  else if (heldKind === 'staff') held.add(buildPlayerStaff());
  else if (heldKind !== 'none') buildHeld(held, body, heldKind);

  const rig: PlayerCharacterRig = {
    root,
    body,
    head,
    armL: shoulders[0], armR: shoulders[1],
    legL: upperLegs[0], legR: upperLegs[1],
    kneeL: lowerLegs[0], kneeR: lowerLegs[1],
    elbowL: forearms[0], elbowR: forearms[1],
    leftHand: hands[0],
    held,
    skeleton,
    bones,
    mixer,
    get current() { return current; },
    setMotion(motion) {
      if (motion === current) return;
      const next = actions[motion];
      next.reset();
      next.enabled = true;
      const oneShot = motion === 'attack';
      next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      next.clampWhenFinished = oneShot;
      next.timeScale = motion === 'run' ? 1.12 : oneShot ? 2 : 1;
      next.fadeIn(0.16).play();
      active.fadeOut(0.16);
      active = next;
      current = motion;
    },
    face(angle, dt) {
      const difference = Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y));
      root.rotation.y += difference * (1 - Math.exp(-Math.max(0, dt) * 10));
    },
    update(dt) { mixer.update(Math.max(0, Math.min(dt, 0.1))); },
  };
  return rig;
}
