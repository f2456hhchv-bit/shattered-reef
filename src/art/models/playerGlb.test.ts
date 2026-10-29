import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyPlayerEquipment, playerAnimationFor, supportsGlbLoadout, syncPlayerRoot } from './playerGlb';

function fixture() {
  const root = new THREE.Group();
  for (const name of [
    'Deckhand_Body', 'Deckhand_Legs_L', 'Deckhand_Legs_R', 'Harbourguard_Armour',
    'Harbourguard_Legs_-1', 'Harbourguard_Legs_1', 'Snakeskin_Body', 'Snakeskin_Legwrap_-1',
    'Snakeskin_Legwrap_1', 'Gear_Head_Cap', 'Gear_Head_Helm', 'Gear_Glove_-1', 'Gear_Glove_1',
    'Gear_Boot_Cuff_-1', 'Gear_Boot_Cuff_1', 'Gear_Cape', 'Mainhand_Cutlass', 'Offhand_Shield',
  ]) { const mesh = new THREE.Mesh(); mesh.name = name; root.add(mesh); }
  return root;
}

describe('player glTF presentation', () => {
  it('uses the built-in weapon rig for unsupported weapon families instead of hiding the equipped weapon', () => {
    expect(supportsGlbLoadout({ weapon: 'cutlass_bronze', offhand: 'shield_bronze' })).toBe(true);
    expect(supportsGlbLoadout({ weapon: 'longbow_iron' })).toBe(false);
    expect(supportsGlbLoadout({ weapon: 'cutlass_bronze', offhand: 'book_gale' })).toBe(false);
  });

  it('keeps the loaded character visible while hiding its built-in fallback', () => {
    const fallback = new THREE.Group(), model = new THREE.Group(), spareRig = new THREE.Group();
    fallback.visible = true;
    fallback.position.set(4, 1.2, 9);
    fallback.rotation.y = 1.1;
    const result = syncPlayerRoot(model, fallback, [fallback, spareRig]);
    expect(result).toBe(true);
    expect(model.visible).toBe(true);
    expect(model.position.toArray()).toEqual([4, 1.2, 9]);
    expect(model.rotation.y).toBeCloseTo(1.1);
    expect(fallback.visible).toBe(false);
    expect(spareRig.visible).toBe(false);
  });

  it('changes the visible body, head and hand equipment immediately from equipped item IDs', () => {
    const root = fixture();
    applyPlayerEquipment(root, { body: 'body_chitin', legs: 'legs_chitin', head: 'helm_chitin', hands: 'gloves_leather', feet: 'boots_leather', cape: 'cape_sailcloth', weapon: 'cutlass_bronze', offhand: 'shield_bronze' });
    expect(root.getObjectByName('Harbourguard_Armour')!.visible).toBe(true);
    expect(root.getObjectByName('Deckhand_Body')!.visible).toBe(false);
    expect(root.getObjectByName('Gear_Head_Helm')!.visible).toBe(true);
    expect(root.getObjectByName('Gear_Glove_1')!.visible).toBe(true);
    expect(root.getObjectByName('Gear_Boot_Cuff_-1')!.visible).toBe(true);
    expect(root.getObjectByName('Mainhand_Cutlass')!.visible).toBe(true);
    expect(root.getObjectByName('Offhand_Shield')!.visible).toBe(true);
    expect(root.getObjectByName('Gear_Cape')!.visible).toBe(true);

    applyPlayerEquipment(root, { body: 'body_snake', legs: 'chaps_snake', head: 'cowl_snake', cape: 'amulet_tide', weapon: 'cutlass_iron' });
    expect(root.getObjectByName('Snakeskin_Body')!.visible).toBe(true);
    expect(root.getObjectByName('Harbourguard_Armour')!.visible).toBe(false);
    expect(root.getObjectByName('Gear_Head_Cap')!.visible).toBe(true);
    expect(root.getObjectByName('Offhand_Shield')!.visible).toBe(false);
    expect(root.getObjectByName('Gear_Cape')!.visible).toBe(false);
  });

  it('selects blended movement and activity clips from real player state', () => {
    expect(playerAnimationFor({ dead: false, hit: false, attacking: false, moving: false, speed: 0, fishing: false, working: false })).toBe('Idle');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: false, moving: true, speed: 2, fishing: false, working: false })).toBe('Walk');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: false, moving: true, speed: 4, fishing: false, working: false })).toBe('Run');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: true, moving: false, speed: 0, fishing: false, working: false })).toBe('MeleeSlash');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: true, attackStyle: 'ranged', moving: false, speed: 0, fishing: false, working: false })).toBe('RangedShot');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: true, attackStyle: 'magic', moving: false, speed: 0, fishing: false, working: false })).toBe('Spellcast');
    expect(playerAnimationFor({ dead: false, hit: false, attacking: false, moving: false, speed: 0, fishing: true, working: false })).toBe('Fishing');
    expect(playerAnimationFor({ dead: false, hit: true, attacking: false, moving: false, speed: 0, fishing: false, working: false })).toBe('HitReact');
    expect(playerAnimationFor({ dead: true, hit: true, attacking: true, moving: false, speed: 0, fishing: false, working: false })).toBe('Idle');
  });
});
