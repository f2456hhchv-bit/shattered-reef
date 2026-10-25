// Keys and keyholes (Tom, 2026-10-25; design in docs/KEYS.md). Every human and creature has a keyhole. The one key
// slotted into you gives a passive; turned in a foe's keyhole it gives a power on a cooldown. Keys are found
// anywhere, extremely rarely: any gather, any kill, any new place, most often in the key's own line of work.

export type KeyFamily = 'any' | 'woodcutting' | 'mining' | 'fishing' | 'melee' | 'ranged' | 'magic' | 'sailing' | 'explore';
export type KeyPassive = 'skill_xp' | 'extra_log' | 'extra_ore' | 'fish_success' | 'melee_acc' | 'ranged_acc' | 'charm_save' | 'leech' | 'ship_speed' | 'walk_speed';
export type KeyPower = 'lesson' | 'root' | 'shatter' | 'hook' | 'disarm' | 'mark' | 'undertow' | 'drain' | 'becalm' | 'blink';

export interface KeyDef {
  id: string;
  name: string;
  family: KeyFamily;
  passive: { kind: KeyPassive; v: number; text: string };
  power: { id: KeyPower; name: string; cooldown: number; dur?: number; v?: number; text: string };
  lore: string;
}

/** Every tunable number for keys lives here. */
export const KEY_CONFIG = {
  dormantS: 1800, // a newly slotted key sleeps this long (seconds of play) unless free swaps are on
  reach: 3, // metres: you turn the key in the foe's keyhole, so you have to be close
  bossMul: 0.5, // control powers last half as long on bosses (and Drain takes a third as much)
  gatherChance: 1 / 12000, // per item gathered (~1 key per 10-12 hours of gathering)
  killChance: 1 / 1500, // per kill, ×(1 + level / 40) (~1 key per 8-10 hours of fighting)
  placeChance: 1 / 40, // per newly discovered place
  themeWeight: 6, // a key is this much likelier from its own line of work
};

export const KEYS: KeyDef[] = [
  { id: 'quick_study', name: 'Quick Study', family: 'any',
    passive: { kind: 'skill_xp', v: 3, text: '+3% experience in every gathering and production skill' },
    power: { id: 'lesson', name: 'Lesson', cooldown: 30, dur: 10, v: 15, text: 'Shows the foe\'s weakness; your hits in that style do +15% for 10 s' },
    lore: 'Every captain starts with one. It opens nothing but the mind.' },
  { id: 'woodsman', name: 'Woodsman\'s Key', family: 'woodcutting',
    passive: { kind: 'extra_log', v: 10, text: '10% chance of an extra log' },
    power: { id: 'root', name: 'Root', cooldown: 25, dur: 4, text: 'The foe can\'t move for 4 s' },
    lore: 'Cut from the heart of a felled saltpine. Hold it up and you can hear sap.' },
  { id: 'prospector', name: 'Prospector\'s Key', family: 'mining',
    passive: { kind: 'extra_ore', v: 10, text: '10% chance of an extra ore' },
    power: { id: 'shatter', name: 'Shatter', cooldown: 30, dur: 8, v: 40, text: 'The foe\'s defence is cut 40% for 8 s' },
    lore: 'Found in a vein where no vein should be. The teeth are still warm.' },
  { id: 'angler', name: 'Angler\'s Key', family: 'fishing',
    passive: { kind: 'fish_success', v: 6, text: '+6% fishing success' },
    power: { id: 'hook', name: 'Hook', cooldown: 20, text: 'Drags the foe to you' },
    lore: 'Bent like a hook. Fish follow it about the bottom of the bucket.' },
  { id: 'duellist', name: 'Duellist\'s Key', family: 'melee',
    passive: { kind: 'melee_acc', v: 6, text: '+6 melee accuracy' },
    power: { id: 'disarm', name: 'Disarm', cooldown: 35, dur: 4, text: 'The foe can\'t attack for 4 s' },
    lore: 'A guard-shaped bow. Blades turn aside from whoever carries it.' },
  { id: 'marksman', name: 'Marksman\'s Key', family: 'ranged',
    passive: { kind: 'ranged_acc', v: 6, text: '+6 ranged accuracy and +1 m range' },
    power: { id: 'mark', name: 'Mark', cooldown: 30, v: 2, text: 'Your next 2 hits on the foe land at their maximum' },
    lore: 'Long and straight as a barrel. Its tip always points at something.' },
  { id: 'tide', name: 'Tide Key', family: 'magic',
    passive: { kind: 'charm_save', v: 10, text: '10% chance a spell burns no charms' },
    power: { id: 'undertow', name: 'Undertow', cooldown: 35, dur: 4, v: 6, text: 'Pulls every foe within 6 m onto this one and slows them' },
    lore: 'Sea-glass, worn smooth. Turn it and the ground pulls like an ebb tide.' },
  { id: 'leech', name: 'Leech Key', family: 'melee',
    passive: { kind: 'leech', v: 3, text: 'Heal 3% of the damage you deal' },
    power: { id: 'drain', name: 'Drain', cooldown: 35, v: 15, text: 'Takes 15% of the foe\'s health as your own' },
    lore: 'Black iron, always a little wet. It drinks.' },
  { id: 'helmsman', name: 'Helmsman\'s Key', family: 'sailing',
    passive: { kind: 'ship_speed', v: 15, text: 'Your ship sails 15% faster' },
    power: { id: 'becalm', name: 'Becalm', cooldown: 30, dur: 8, v: 40, text: 'The foe moves and attacks 40% slower for 8 s' },
    lore: 'A spoke from a wheel that steered nothing. The wind leans toward it.' },
  { id: 'wanderer', name: 'Wanderer\'s Key', family: 'explore',
    passive: { kind: 'walk_speed', v: 8, text: 'Walk 8% faster out of combat' },
    power: { id: 'blink', name: 'Blink', cooldown: 20, text: 'Step through the foe\'s keyhole to its far side' },
    lore: 'Worn thin by a thousand pockets. It has been everywhere.' },
];

export const KEY: Record<string, KeyDef> = Object.fromEntries(KEYS.map((k) => [k.id, k]));
export const STARTER_KEY = 'quick_study';
