import * as THREE from 'three';
import { mat } from '../materials';
import { buildHeld, type HeldKind, type HumanoidRig } from './character';
import { buildPlayerCharacterGeometry } from './playerCharacter';
import { buildPlayerArmourPieces, buildPlayerCape, buildPlayerStaff, buildPlayerSword, buildWoodenShield, type PlayerArmourSet } from './playerEquipment';

export type PlayerMotion = 'idle' | 'walk' | 'run' | 'attack';
export type PlayerMainHand = 'none' | 'sword' | 'cutlass' | 'staff';

export interface PlayerEquipmentVisuals {
  head?: string;
  body?: string;
  legs?: string;
  feet?: string;
  hands?: string;
  feetColor?: number;
  headColor?: number;
  bodyColor?: number;
}

export function playerEquipmentIdsFromKey(key: string): PlayerEquipmentVisuals {
  const [head, body, legs, feet, hands] = key.split(',');
  const result: PlayerEquipmentVisuals = {};
  if (head && head !== '-') result.head = head;
  if (body && body !== '-') result.body = body;
  if (legs && legs !== '-') result.legs = legs;
  if (feet && feet !== '-') result.feet = feet;
  if (hands && hands !== '-') result.hands = hands;
  return result;
}

export interface PlayerCharacterRig extends HumanoidRig {
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  mixer: THREE.AnimationMixer;
  current: PlayerMotion;
  armour: PlayerArmourSet;
  mainHand: PlayerMainHand;
  offhand: THREE.Group | null;
  setMotion(motion: PlayerMotion): void;
  setArmour(armour: PlayerArmourSet): void;
  setEquipment(equipment: PlayerEquipmentVisuals): void;
  setMainHand(kind: PlayerMainHand): void;
  setOffhand(enabled: boolean): void;
  setCape(colour?: number): void;
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

function skinnedLimbGeometry(
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  firstBoneIndex: number,
  secondBoneIndex: number,
  radii: [number, number, number],
  depths: [number, number, number],
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const rings = 24, segments = 12;
  const positions: number[] = [], indices: number[] = [], skinIndices: number[] = [], skinWeights: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const across = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
    const depth = new THREE.Vector3(0, 0, 1);
    const radius = t <= 0.5 ? THREE.MathUtils.lerp(radii[0], radii[1], t * 2) : THREE.MathUtils.lerp(radii[1], radii[2], (t - 0.5) * 2);
    const depthRadius = t <= 0.5 ? THREE.MathUtils.lerp(depths[0], depths[1], t * 2) : THREE.MathUtils.lerp(depths[1], depths[2], (t - 0.5) * 2);
    const firstWeight = THREE.MathUtils.clamp((0.55 - t) / 0.1, 0, 1);
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const position = center.clone()
        .addScaledVector(across, Math.cos(angle) * radius)
        .addScaledVector(depth, Math.sin(angle) * depthRadius);
      positions.push(position.x, position.y, position.z);
      skinIndices.push(firstBoneIndex, secondBoneIndex, 0, 0);
      skinWeights.push(firstWeight, 1 - firstWeight, 0, 0);
    }
  }
  for (let ring = 0; ring < rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const a = ring * segments + segment;
    const b = ring * segments + (segment + 1) % segments;
    indices.push(a, a + segments, b + segments, a, b + segments, b);
  }
  const startCap = positions.length / 3;
  positions.push(points[0].x, points[0].y, points[0].z);
  skinIndices.push(firstBoneIndex, secondBoneIndex, 0, 0); skinWeights.push(1, 0, 0, 0);
  const endCap = positions.length / 3;
  positions.push(points[2].x, points[2].y, points[2].z);
  skinIndices.push(firstBoneIndex, secondBoneIndex, 0, 0); skinWeights.push(0, 1, 0, 0);
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    const last = rings * segments + segment;
    const lastNext = rings * segments + next;
    indices.push(startCap, next, segment, endCap, last, lastNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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
      scalar('LowerLeg_L.rotation[x]', cycle, kneeWalk), scalar('LowerLeg_R.rotation[x]', cycle, kneeWalk),
      scalar('Shoulder_L.rotation[x]', cycle, opposite(walk.map(v => v * 0.75))),
      scalar('Shoulder_R.rotation[x]', cycle, walk.map(v => v * 0.75)),
      scalar('Forearm_L.rotation[x]', cycle, [-0.16, -0.28, -0.16, -0.04, -0.16]),
      scalar('Forearm_R.rotation[x]', cycle, [-0.16, -0.04, -0.16, -0.28, -0.16]),
    ]),
    run: clip('PlayerRun', 1, [
      scalar('Pelvis.position[y]', cycle, [0.9, 0.935, 0.9, 0.935, 0.9]),
      scalar('Spine.rotation[x]', cycle, [0.08, 0.12, 0.08, 0.04, 0.08]),
      scalar('UpperLeg_L.rotation[x]', cycle, run), scalar('UpperLeg_R.rotation[x]', cycle, opposite(run)),
      scalar('LowerLeg_L.rotation[x]', cycle, kneeRun), scalar('LowerLeg_R.rotation[x]', cycle, kneeRun),
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
    const shoulder = bones[`Shoulder_${suffix}`] = bone(`Shoulder_${suffix}`, chest, [side * 0.03, 0.07, 0]);
    const upperArm = bones[`UpperArm_${suffix}`] = bone(`UpperArm_${suffix}`, shoulder, [side * 0.04, 0.04, 0]);
    const forearm = bones[`Forearm_${suffix}`] = bone(`Forearm_${suffix}`, upperArm, [side * 0.255, -0.22, 0]);
    const hand = bones[`Hand_${suffix}`] = bone(`Hand_${suffix}`, forearm, [side * 0.022, -0.275, 0]);
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
    if (/^(UpperArm|Forearm)_[LR]$|^Starter_Trousers_[LR]$/.test(name)) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      model.remove(child);
      continue;
    }
    if (/^(Head_Skin|Hair_|Ear_|Eye_|Brow_|Nose)/.test(name)) attach(child, head);
    else if (name === 'Neck') attach(child, neck);
    else if (/^(Torso_Shirt|Shoulder_Strap_|Strap_Buckle)/.test(name)) attach(child, chest);
    else if (/^(Sash_)/.test(name)) attach(child, pelvis);
    else if (name === 'Sleeve_L') attach(child, upperArms[0]);
    else if (name === 'Sleeve_R') attach(child, upperArms[1]);
    else if (/^(Forearm_L|Forearm_Guard_L)/.test(name)) attach(child, forearms[0]);
    else if (/^(Forearm_R|Forearm_Guard_R)/.test(name)) attach(child, forearms[1]);
    else if (name === 'Hand_L') attach(child, hands[0]);
    else if (name === 'Hand_R') attach(child, hands[1]);
    else if (/^(Boot_L|Boot_Cuff_L)/.test(name)) attach(child, lowerLegs[0]);
    else if (/^(Boot_R|Boot_Cuff_R)/.test(name)) attach(child, lowerLegs[1]);
  }

  const leather = buildPlayerArmourPieces('leather');
  const iron = buildPlayerArmourPieces('iron');
  const attachPieces = (pieces: ReturnType<typeof buildPlayerArmourPieces>) => {
    chest.attach(pieces.chest); head.attach(pieces.head);
    upperLegs[0].attach(pieces.legs[0]); upperLegs[1].attach(pieces.legs[1]);
    forearms[0].attach(pieces.arms[0]); forearms[1].attach(pieces.arms[1]);
  };
  attachPieces(leather); attachPieces(iron);
  for (const group of [leather.chest, leather.head, ...leather.legs, ...leather.arms, iron.chest, iron.head, ...iron.legs, ...iron.arms]) group.visible = false;

  const skeleton = new THREE.Skeleton(Object.values(bones));
  skeleton.calculateInverses();
  const bindSkin = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const skin = new THREE.SkinnedMesh(geometry, material);
    skin.name = name;
    skin.castShadow = true;
    skin.receiveShadow = true;
    body.add(skin);
    root.updateMatrixWorld(true);
    skin.bind(skeleton);
  };
  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? 'L' : 'R';
    bindSkin(`Arm_Skin_${suffix}`, skinnedLimbGeometry(
      [new THREE.Vector3(side * 0.07, 1.37, 0), new THREE.Vector3(side * 0.325, 1.15, 0), new THREE.Vector3(side * 0.347, 0.875, 0)],
      skeleton.bones.indexOf(bones[`UpperArm_${suffix}`]), skeleton.bones.indexOf(bones[`Forearm_${suffix}`]),
      [0.061, 0.052, 0.042], [0.057, 0.048, 0.042],
    ), mat(0xc98250, { side: THREE.DoubleSide }));
    bindSkin(`Starter_Trousers_${suffix}`, skinnedLimbGeometry(
      [new THREE.Vector3(side * 0.105, 0.975, 0), new THREE.Vector3(side * 0.12, 0.44, 0), new THREE.Vector3(side * 0.12, 0.28, 0)],
      skeleton.bones.indexOf(bones[`UpperLeg_${suffix}`]), skeleton.bones.indexOf(bones[`LowerLeg_${suffix}`]),
      [0.086, 0.074, 0.066], [0.082, 0.077, 0.07],
    ), mat(0x3b3b3d, { side: THREE.DoubleSide }));
  }
  const mixer = new THREE.AnimationMixer(root);
  const clips = animationClips();
  const actions = Object.fromEntries(Object.entries(clips).map(([key, value]) => [key, mixer.clipAction(value)])) as Record<PlayerMotion, THREE.AnimationAction>;
  let current: PlayerMotion = 'idle';
  let currentArmour: PlayerArmourSet = 'starter';
  let active = actions.idle;
  active.play();
  const held = new THREE.Group();
  held.name = 'MainHandAttachment';
  held.position.set(0, 0, 0.045);
  hands[1].add(held);
  if (heldKind === 'greatsword') held.add(buildPlayerSword());
  else if (heldKind === 'staff') held.add(buildPlayerStaff());
  else if (heldKind !== 'none') buildHeld(held, body, heldKind);
  let mainHand: PlayerMainHand = heldKind === 'greatsword' ? 'sword' : heldKind === 'staff' ? 'staff' : heldKind === 'cutlass' ? 'cutlass' : 'none';
  let offhand: THREE.Group | null = null;
  let cape: THREE.Mesh | null = null;
  const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  root.traverse(object => {
    const item = object as THREE.Mesh;
    if (item.isMesh) originalMaterials.set(item.name, item.material);
  });
  const visualSet = (id?: string): PlayerArmourSet | null => {
    if (!id) return null;
    if (/leather|chitin|snake|silk|hide/.test(id)) return 'leather';
    if (/helm_|plate_|legs_|body_|gloves_|boots_/.test(id)) return 'iron';
    return null;
  };
  const setCape = (colour?: number) => {
    if (cape) { cape.parent?.remove(cape); cape.geometry.dispose(); cape = null; }
    if (colour !== undefined) {
      cape = buildPlayerCape(colour);
      chest.attach(cape);
    }
  };
  const applyEquipment = (equipment: PlayerEquipmentVisuals) => {
    const bodySet = visualSet(equipment.body);
    const headSet = visualSet(equipment.head);
    const legsSet = visualSet(equipment.legs);
    const handsSet = visualSet(equipment.hands);
    currentArmour = bodySet ?? legsSet ?? headSet ?? handsSet ?? 'starter';
    for (const [set, pieces] of [['leather', leather], ['iron', iron]] as const) {
      pieces.chest.visible = bodySet === set;
      pieces.head.visible = headSet === set || (!!equipment.head && !headSet && set === 'leather');
      for (const group of pieces.legs) group.visible = legsSet === set;
      for (const group of pieces.arms) group.visible = handsSet === set;
    }
    const torso = root.getObjectByName('Torso_Shirt');
    if (torso) torso.visible = !bodySet;
    for (const suffix of ['L', 'R']) {
      const trousers = root.getObjectByName(`Starter_Trousers_${suffix}`);
      if (trousers) trousers.visible = !legsSet;
      const guard = root.getObjectByName(`Forearm_Guard_${suffix}`) as THREE.Mesh | undefined;
      if (guard) guard.visible = handsSet !== 'iron';
      const sleeve = root.getObjectByName(`Sleeve_${suffix}`) as THREE.Mesh | undefined;
      if (sleeve) sleeve.material = bodySet === 'iron' ? mat(0xaab2b6, { side: THREE.DoubleSide }) : originalMaterials.get(sleeve.name)!;
      if (guard) {
        guard.material = equipment.hands && handsSet === 'leather'
          ? mat(0x805a3c, { side: THREE.DoubleSide })
          : originalMaterials.get(guard.name)!;
      }
      for (const name of [`Boot_${suffix}`, `Boot_Cuff_${suffix}`]) {
        const boot = root.getObjectByName(name) as THREE.Mesh | undefined;
        if (boot) boot.material = equipment.feetColor ? mat(equipment.feetColor, { side: THREE.DoubleSide }) : originalMaterials.get(name)!;
      }
    }
    const headCovered = !!equipment.head;
    for (const name of ['Hair_Cap', 'Hair_Fringe']) {
      const object = root.getObjectByName(name);
      if (object) object.visible = !headCovered;
    }
    const strap = root.getObjectByName('Shoulder_Strap_Front');
    const buckle = root.getObjectByName('Strap_Buckle');
    const armouredBody = !!bodySet;
    if (strap) strap.position.z = armouredBody ? 0.025 : 0;
    if (buckle) buckle.position.z = armouredBody ? 0.025 : 0;
    setCape(equipment.body?.startsWith('cloak_') ? equipment.bodyColor ?? 0x6a6e72 : undefined);
  };

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
    get armour() { return currentArmour; },
    get mainHand() { return mainHand; },
    get offhand() { return offhand; },
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
    setArmour(armour) {
      const suffix = armour === 'starter' ? '' : armour;
      applyEquipment(suffix ? {
        head: armour === 'iron' ? 'helm_iron' : 'hood_leather',
        body: `body_${armour}`,
        legs: `legs_${armour}`,
        hands: `gloves_${armour}`,
        feetColor: armour === 'iron' ? 0x9da5aa : 0x60432f,
      } : {});
    },
    setEquipment: applyEquipment,
    setMainHand(kind) {
      for (const child of [...held.children]) {
        child.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        held.remove(child);
      }
      if (kind === 'sword') held.add(buildPlayerSword());
      else if (kind === 'cutlass') buildHeld(held, body, 'cutlass');
      else if (kind === 'staff') held.add(buildPlayerStaff());
      mainHand = kind;
    },
    setOffhand(enabled) {
      if (offhand) {
        offhand.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        offhand.parent?.remove(offhand);
        offhand = null;
      }
      if (enabled) {
        offhand = new THREE.Group();
        offhand.name = 'OffhandAttachment';
        offhand.position.copy(held.position);
        hands[0].add(offhand);
        offhand.add(buildWoodenShield());
      }
    },
    setCape,
    face(angle, dt) {
      const difference = Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y));
      root.rotation.y += difference * (1 - Math.exp(-Math.max(0, dt) * 10));
    },
    update(dt) { mixer.update(Math.max(0, Math.min(dt, 0.1))); },
  };
  return rig;
}
