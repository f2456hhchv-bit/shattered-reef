import * as THREE from 'three';

export type PlayerAnimation = 'Idle' | 'Walk' | 'Run' | 'MeleeSlash' | 'RangedShot' | 'Spellcast' | 'HitReact' | 'Work' | 'Fishing';
export interface PlayerEquipmentIds {
  head?: string; body?: string; legs?: string; feet?: string; hands?: string;
  cape?: string; weapon?: string; offhand?: string;
}

export function supportsGlbLoadout(equipment: PlayerEquipmentIds): boolean {
  return (!equipment.weapon || /cutlass/i.test(equipment.weapon))
    && (!equipment.offhand || /shield/i.test(equipment.offhand));
}

/** Mirror movement to the GLB before hiding cached pivot rigs, including the currently selected fallback. */
export function syncPlayerRoot(model: THREE.Object3D, fallback: THREE.Object3D, rigs: Iterable<THREE.Object3D>): boolean {
  const visible = fallback.visible;
  model.position.copy(fallback.position);
  model.rotation.copy(fallback.rotation);
  for (const rig of rigs) rig.visible = false;
  model.visible = visible;
  return visible;
}

/** Apply equipped item IDs to the authored glTF meshes. Unknown armour keeps the deckhand silhouette. */
export function applyPlayerEquipment(root: THREE.Object3D, equipment: PlayerEquipmentIds): string {
  const objects = new Map<string, THREE.Object3D>();
  root.traverse(object => objects.set(object.name, object));
  const showPrefix = (prefix: string, visible: boolean) => {
    for (const [name, object] of objects) if (name === prefix || name.startsWith(`${prefix}_`)) object.visible = visible;
  };
  const guard = equipment.body === 'body_chitin' || equipment.legs === 'legs_chitin';
  const ranger = equipment.body === 'body_snake' || equipment.legs === 'chaps_snake';
  const set = guard ? 'guard' : ranger ? 'ranger' : 'deckhand';
  showPrefix('Deckhand_Body', set === 'deckhand');
  showPrefix('Deckhand_Legs', set === 'deckhand');
  showPrefix('Harbourguard_Armour', set === 'guard');
  showPrefix('Harbourguard_Legs', set === 'guard');
  showPrefix('Snakeskin_Body', set === 'ranger');
  showPrefix('Snakeskin_Legwrap', set === 'ranger');
  showPrefix('Gear_Glove', !!equipment.hands);
  showPrefix('Gear_Boot_Cuff', !!equipment.feet);
  showPrefix('Gear_Head_Cap', !!equipment.head && /cowl|cap|hood|bandana/i.test(equipment.head));
  showPrefix('Gear_Head_Helm', !!equipment.head && /helm/i.test(equipment.head));
  showPrefix('Gear_Cape', !!equipment.cape && /cape|cloak/i.test(equipment.cape));
  showPrefix('Mainhand_Cutlass', !equipment.weapon || /cutlass/i.test(equipment.weapon));
  showPrefix('Offhand_Shield', !!equipment.offhand && /shield/i.test(equipment.offhand));
  return `${equipment.head ?? ''}|${equipment.body ?? ''}|${equipment.legs ?? ''}|${equipment.feet ?? ''}|${equipment.hands ?? ''}|${equipment.cape ?? ''}|${equipment.weapon ?? ''}|${equipment.offhand ?? ''}`;
}

export function playerAnimationFor(state: {
  dead: boolean; attacking: boolean; attackStyle?: 'melee' | 'ranged' | 'magic'; hit: boolean; moving: boolean; speed: number; fishing: boolean; working: boolean;
}): PlayerAnimation {
  if (state.dead) return 'Idle';
  if (state.hit) return 'HitReact';
  if (state.attacking) return state.attackStyle === 'ranged' ? 'RangedShot' : state.attackStyle === 'magic' ? 'Spellcast' : 'MeleeSlash';
  if (state.fishing) return 'Fishing';
  if (state.working) return 'Work';
  if (!state.moving) return 'Idle';
  return state.speed > 3.25 ? 'Run' : 'Walk';
}
