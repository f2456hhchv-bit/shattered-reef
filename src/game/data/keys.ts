// Keys and keyholes (Tom, 2026-10-25; design in docs/KEYS.md). Every human and creature has a keyhole. The one key
// slotted into you gives a passive; turned in a foe's keyhole it gives a power on a cooldown. Keys are found
// anywhere, extremely rarely: any gather, any kill, any new place, most often in the key's own line of work.

export type KeyFamily = 'any' | 'woodcutting' | 'mining' | 'fishing' | 'melee' | 'ranged' | 'magic' | 'sailing' | 'explore' | 'production';
export type KeyPassive = 'skill_xp' | 'extra_log' | 'extra_ore' | 'fish_success' | 'melee_acc' | 'ranged_acc' | 'charm_save' | 'leech' | 'ship_speed' | 'walk_speed'
  | 'find_bonus' | 'smith' | 'cook' | 'melee_dmg' | 'dr' | 'ammo_save' | 'magic_dmg' | 'free_teleport' | 'double_finds' | 'desperate' | 'sea_peace' | 'listening';
export type KeyPower = 'lesson' | 'root' | 'shatter' | 'hook' | 'disarm' | 'mark' | 'undertow' | 'drain' | 'becalm' | 'blink'
  | 'pickpocket' | 'rust' | 'spoil' | 'knockdown' | 'ward' | 'fuse' | 'chain' | 'toll' | 'steal' | 'turncoat' | 'bite';

export interface KeyDef {
  id: string;
  name: string;
  family: KeyFamily;
  /** how often it turns up compared with others (legendary keys are rarer still); quest keys never drop */
  rarity: 'starter' | 'common' | 'rare' | 'legendary' | 'quest';
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
  rarityWeight: { starter: 0, common: 1, rare: 0.6, legendary: 0.25, quest: 0 } as Record<KeyDef['rarity'], number>,
  craftChance: 1 / 8000, // per item made at a station
};

export const KEYS: KeyDef[] = [
  { id: 'quick_study', name: 'Quick Study', family: 'any', rarity: 'starter',
    passive: { kind: 'skill_xp', v: 3, text: '+3% experience in every gathering and production skill' },
    power: { id: 'lesson', name: 'Lesson', cooldown: 30, dur: 10, v: 15, text: 'Shows the foe\'s weakness; your hits in that style do +15% for 10 s' },
    lore: 'Every captain starts with one. It opens nothing but the mind.' },
  { id: 'woodsman', name: 'Woodsman\'s Key', family: 'woodcutting', rarity: 'common',
    passive: { kind: 'extra_log', v: 10, text: '10% chance of an extra log' },
    power: { id: 'root', name: 'Root', cooldown: 25, dur: 4, text: 'The foe can\'t move for 4 s' },
    lore: 'Cut from the heart of a felled saltpine. Hold it up and you can hear sap.' },
  { id: 'prospector', name: 'Prospector\'s Key', family: 'mining', rarity: 'common',
    passive: { kind: 'extra_ore', v: 10, text: '10% chance of an extra ore' },
    power: { id: 'shatter', name: 'Shatter', cooldown: 30, dur: 8, v: 40, text: 'The foe\'s defence is cut 40% for 8 s' },
    lore: 'Found in a vein where no vein should be. The teeth are still warm.' },
  { id: 'angler', name: 'Angler\'s Key', family: 'fishing', rarity: 'common',
    passive: { kind: 'fish_success', v: 6, text: '+6% fishing success' },
    power: { id: 'hook', name: 'Hook', cooldown: 20, text: 'Drags the foe to you' },
    lore: 'Bent like a hook. Fish follow it about the bottom of the bucket.' },
  { id: 'duellist', name: 'Duellist\'s Key', family: 'melee', rarity: 'common',
    passive: { kind: 'melee_acc', v: 6, text: '+6 melee accuracy' },
    power: { id: 'disarm', name: 'Disarm', cooldown: 35, dur: 4, text: 'The foe can\'t attack for 4 s' },
    lore: 'A guard-shaped bow. Blades turn aside from whoever carries it.' },
  { id: 'marksman', name: 'Marksman\'s Key', family: 'ranged', rarity: 'common',
    passive: { kind: 'ranged_acc', v: 6, text: '+6 ranged accuracy and +1 m range' },
    power: { id: 'mark', name: 'Mark', cooldown: 30, v: 2, text: 'Your next 2 hits on the foe land at their maximum' },
    lore: 'Long and straight as a barrel. Its tip always points at something.' },
  { id: 'tide', name: 'Tide Key', family: 'magic', rarity: 'common',
    passive: { kind: 'charm_save', v: 10, text: '10% chance a spell burns no charms' },
    power: { id: 'undertow', name: 'Undertow', cooldown: 35, dur: 4, v: 6, text: 'Pulls every foe within 6 m onto this one and slows them' },
    lore: 'Sea-glass, worn smooth. Turn it and the ground pulls like an ebb tide.' },
  { id: 'leech', name: 'Leech Key', family: 'melee', rarity: 'rare',
    passive: { kind: 'leech', v: 3, text: 'Heal 3% of the damage you deal' },
    power: { id: 'drain', name: 'Drain', cooldown: 35, v: 15, text: 'Takes 15% of the foe\'s health as your own' },
    lore: 'Black iron, always a little wet. It drinks.' },
  { id: 'helmsman', name: 'Helmsman\'s Key', family: 'sailing', rarity: 'common',
    passive: { kind: 'ship_speed', v: 15, text: 'Your ship sails 15% faster' },
    power: { id: 'becalm', name: 'Becalm', cooldown: 30, dur: 8, v: 40, text: 'The foe moves and attacks 40% slower for 8 s' },
    lore: 'A spoke from a wheel that steered nothing. The wind leans toward it.' },
  { id: 'wanderer', name: 'Wanderer\'s Key', family: 'explore', rarity: 'common',
    passive: { kind: 'walk_speed', v: 8, text: 'Walk 8% faster out of combat' },
    power: { id: 'blink', name: 'Blink', cooldown: 20, text: 'Step through the foe\'s keyhole to its far side' },
    lore: 'Worn thin by a thousand pockets. It has been everywhere.' },
  // ---- the second ring (2026-10-25)
  { id: 'finder', name: 'Finder\'s Key', family: 'explore', rarity: 'rare',
    passive: { kind: 'find_bonus', v: 50, text: 'Rare finds (nests, geodes, caskets) 50% more often' },
    power: { id: 'pickpocket', name: 'Pickpocket', cooldown: 25, text: 'Pulls one roll of the foe\'s loot out of it (once per foe)' },
    lore: 'It opens pockets that aren\'t yours. It has opened a great many.' },
  { id: 'smith', name: 'Smith\'s Key', family: 'production', rarity: 'common',
    passive: { kind: 'smith', v: 5, text: '+5% masterwork chance at the anvil and an 8% chance a smithing job uses no bars' },
    power: { id: 'rust', name: 'Rust', cooldown: 35, dur: 6, v: 50, text: 'The foe\'s blows are halved for 6 s' },
    lore: 'Forged, quenched and never once struck. It wants to be.' },
  { id: 'cook', name: 'Cook\'s Key', family: 'production', rarity: 'common',
    passive: { kind: 'cook', v: 10, text: 'Food heals 10% more; you stop burning food 5 levels sooner' },
    power: { id: 'spoil', name: 'Spoil', cooldown: 30, dur: 8, v: 1, text: 'The foe can\'t heal and loses 1% of its health a second for 8 s' },
    lore: 'Smells faintly of every meal you ever burnt.' },
  { id: 'brute', name: 'Brute\'s Key', family: 'melee', rarity: 'rare',
    passive: { kind: 'melee_dmg', v: 4, text: '+4% melee max hit' },
    power: { id: 'knockdown', name: 'Knockdown', cooldown: 30, dur: 2, text: 'Hurls the foe back and stuns it for 2 s' },
    lore: 'Heavy as a fist. Turning it feels like a punch going the other way.' },
  { id: 'bulwark', name: 'Bulwark Key', family: 'melee', rarity: 'rare',
    passive: { kind: 'dr', v: 5, text: 'Take 5% less damage from everything' },
    power: { id: 'ward', name: 'Ward', cooldown: 40, dur: 5, text: 'This foe can\'t hurt you for 5 s' },
    lore: 'Square, dull and dented. It has taken worse than you will.' },
  { id: 'powder', name: 'Powder Key', family: 'ranged', rarity: 'rare',
    passive: { kind: 'ammo_save', v: 10, text: '10% chance shot, arrows and bolts aren\'t used' },
    power: { id: 'fuse', name: 'Fuse', cooldown: 40, dur: 2, text: 'The foe bursts after 2 s, hurting everything near it' },
    lore: 'Black, gritty, and it fizzes when you blow on it. Don\'t.' },
  { id: 'storm', name: 'Storm Key', family: 'magic', rarity: 'rare',
    passive: { kind: 'magic_dmg', v: 4, text: '+4% spell damage' },
    power: { id: 'chain', name: 'Chain', cooldown: 30, v: 3, text: 'Lightning leaps from the foe to 3 more nearby' },
    lore: 'Stormsilver. Your hair stands up when you hold it.' },
  { id: 'bell', name: 'Bell Key', family: 'explore', rarity: 'rare',
    passive: { kind: 'free_teleport', v: 1, text: 'Teleport spells cost no charms' },
    power: { id: 'toll', name: 'Toll', cooldown: 40, dur: 1.5, v: 5, text: 'Every foe within 5 m is stunned for 1.5 s' },
    lore: 'It rings when nothing touches it, always at low water.' },
  { id: 'skeleton', name: 'Skeleton Key', family: 'any', rarity: 'legendary',
    passive: { kind: 'double_finds', v: 1, text: 'Nests, geodes and caskets you open give their loot twice' },
    power: { id: 'steal', name: 'Steal', cooldown: 60, dur: 30, text: 'Takes an elite foe\'s power for yourself for 30 s (Barnacled: take a third less damage; Frenzied: attack 40% faster; Volatile: your kills explode)' },
    lore: 'Bone, and it fits every lock. Every one.' },
  { id: 'mutineer', name: 'Mutineer\'s Key', family: 'any', rarity: 'legendary',
    passive: { kind: 'desperate', v: 10, text: '+10% damage while you\'re below half health' },
    power: { id: 'turncoat', name: 'Turncoat', cooldown: 90, dur: 8, text: 'The foe fights for you for 8 s (not bosses)' },
    lore: 'Turned once, by a crew against its captain. It remembers how.' },
  { id: 'keels_tooth', name: 'Keel\'s Tooth', family: 'any', rarity: 'quest',
    passive: { kind: 'sea_peace', v: 1, text: 'Crabs and the Drowned never attack first' },
    power: { id: 'bite', name: 'Bite', cooldown: 45, dur: 10, text: 'The foe\'s keyhole snaps shut: no attacks, slams or summons for 10 s' },
    lore: 'A key shaped like a tooth, warm as a living thing. The Broken Ring gave it up.' },
  { id: 'sun_key', name: 'Sun Key', family: 'any', rarity: 'quest',
    passive: { kind: 'magic_dmg', v: 6, text: 'Your spells hit 6% harder' },
    power: { id: 'shatter', name: 'Sunburst', cooldown: 35, dur: 6, v: 30, text: 'The foe\'s defence is cut 30% for 6 s' },
    lore: 'A key of hammered gold that is never cold. The Sunscale kept it under the temple floor.' },
  { id: 'draugr_key', name: 'Draugr\'s Key', family: 'any', rarity: 'quest',
    passive: { kind: 'dr', v: 6, text: 'You take 6% less damage' },
    power: { id: 'ward', name: 'Ward', cooldown: 45, dur: 4, text: 'This foe can\'t hurt you for 4 s' },
    lore: 'Cold iron from the Barrow King\'s hand. The dead under Goldvein Hill knew its weight.' },
  { id: 'mire_key', name: 'Mire Key', family: 'any', rarity: 'quest',
    passive: { kind: 'leech', v: 4, text: 'The fen gives back: heal 4% of the damage you deal' },
    power: { id: 'undertow', name: 'Drag Under', cooldown: 30, dur: 3, v: 6, text: 'Pulls every foe within 6 m onto this one and slows them, the way the weed takes a swimmer' },
    lore: 'The Second Lockkey, green bronze, cut out of Jenny Greenteeth. It\'s always damp. It always will be.' },
  { id: 'listener', name: 'Listener\'s Key', family: 'any', rarity: 'quest',
    passive: { kind: 'listening', v: 8, text: 'You hear what the song-touched hear: +8% damage to elite foes, and every page of Keel\'s Log shows on your map. They hear you too: elites notice you from half as far again' },
    power: { id: 'lesson', name: 'Eavesdrop', cooldown: 30, dur: 10, v: 25, text: 'You listen at the foe\'s keyhole: its weakness, and your hits in that style do +25% for 10 s' },
    lore: 'Iven Marr\'s grandmother left it with her charts. Turn it in yourself and the keyholes all round you start to whisper.' },
  { id: 'ilse_key', name: 'Ilse\'s Door Key', family: 'any', rarity: 'quest',
    passive: { kind: 'dr', v: 6, text: 'Every door holds: 6% less damage from everything' },
    power: { id: 'ward', name: 'Shut the Door', cooldown: 35, dur: 5, text: 'You shut a door between you and this foe: it can\'t hurt you for 5 s' },
    lore: 'The Third Lockkey: a plain iron door key, the two-hundred-and-twelfth on Orla Fane\'s ring. Ilse of the Door loved doors more than anyone ever has. It shows.' },
];

export const KEY: Record<string, KeyDef> = Object.fromEntries(KEYS.map((k) => [k.id, k]));
export const STARTER_KEY = 'quick_study';
