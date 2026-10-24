import type { SkillId } from './items';

// Skill perks: every skill earns a real, lasting effect at 10, 20 ... 90 and 99, on top of the content it
// unlocks. Effects stack within a skill. Every other level also improves something (see LEVEL_GAIN), so
// no level-up is empty.

export type PerkKind =
  | 'speed' // gathering: +v% success (relative)
  | 'double' // gathering / cooking: v% chance of a second item
  | 'find' // gathering: v% chance of a rare find (bird nest, geode, casket)
  | 'tool_care' // gathering: tools wear v% slower
  | 'xp' // +v% xp in this skill
  | 'save' // production: v% chance to keep the materials
  | 'fine' // production: +v% masterwork chance
  | 'quick' // production: work v% faster
  | 'extra' // gunsmithing / fletching: +v ammunition per batch
  | 'burn' // cooking: v% less likely to burn
  | 'heal' // food heals +v%
  | 'acc' | 'dmg' | 'crit' | 'cleave' // combat, applied to the style the skill trains
  | 'dr' // defence: take v% less damage
  | 'regen' // +v health per 10 s
  | 'hp' // +v max health
  | 'ammo' // ranged: v% chance a shot isn't used
  | 'charms' // magic: v% chance a spell's charms aren't used
  | 'last' // gathering: v% chance a tree, rock or spot doesn't run out when it would
  | 'spec'; // combat: special attack recharges v% faster

export interface Perk { level: number; name: string; kind: PerkKind; v: number }

const P = (level: number, name: string, kind: PerkKind, v: number): Perk => ({ level, name, kind, v });

const gathering = (findName: string): Perk[] => [
  P(10, 'Steady hands', 'speed', 3), P(20, 'Lucky haul', 'double', 4), P(30, findName, 'find', 1), P(40, 'Tool care', 'tool_care', 30),
  P(50, 'Practised eye', 'speed', 4), P(60, 'Bountiful', 'double', 5), P(70, 'Know-how', 'xp', 5), P(80, `Keen ${findName.toLowerCase()}`, 'find', 1.5),
  P(90, 'Plenty', 'double', 6), P(99, 'Mastery', 'xp', 5),
];

export const PERKS: Record<SkillId, Perk[]> = {
  woodcutting: gathering('Bird nests'),
  mining: gathering('Geode sense'),
  fishing: gathering('Sunken caskets'),
  smithing: [P(10, 'Thrifty', 'save', 3), P(20, 'Fine touch', 'fine', 2), P(30, 'Quick hammer', 'quick', 10), P(40, 'Waste not', 'save', 4), P(50, 'Master\'s eye', 'fine', 3),
    P(60, 'Rhythm', 'quick', 10), P(70, 'Frugal', 'save', 5), P(80, 'Artisan', 'fine', 4), P(90, 'Forge-born', 'xp', 5), P(99, 'Mastery', 'fine', 5)],
  gunsmithing: [P(10, 'Spare ball', 'extra', 2), P(20, 'Fine bore', 'fine', 2), P(30, 'Quick hands', 'quick', 10), P(40, 'Thrifty', 'save', 4), P(50, 'Spare balls', 'extra', 3),
    P(60, 'Rifling', 'fine', 3), P(70, 'Rhythm', 'quick', 10), P(80, 'Frugal', 'save', 5), P(90, 'Armourer', 'xp', 5), P(99, 'Mastery', 'extra', 5)],
  fletching: [P(10, 'Spare shafts', 'extra', 2), P(20, 'True grain', 'fine', 2), P(30, 'Quick knife', 'quick', 10), P(40, 'Thrifty', 'save', 4), P(50, 'Spare heads', 'extra', 3),
    P(60, 'Bowyer', 'fine', 3), P(70, 'Rhythm', 'quick', 10), P(80, 'Frugal', 'save', 5), P(90, 'Master bowyer', 'xp', 5), P(99, 'Mastery', 'extra', 5)],
  cooking: [P(10, 'Watchful', 'burn', 10), P(20, 'Hearty', 'heal', 5), P(30, 'Two pans', 'double', 3), P(40, 'Patience', 'burn', 10), P(50, 'Rich stock', 'heal', 5),
    P(60, 'Three pans', 'double', 4), P(70, 'Never burnt', 'burn', 15), P(80, 'Feast', 'heal', 5), P(90, 'Chef', 'xp', 5), P(99, 'Mastery', 'heal', 10)],
  attack: [P(10, 'Sure strike', 'acc', 2), P(20, 'Footwork', 'acc', 2), P(30, 'Feint', 'acc', 2), P(40, 'Read the blade', 'acc', 2), P(50, 'Clean cut', 'crit', 2),
    P(60, 'Riposte', 'acc', 2), P(70, 'Duellist', 'acc', 3), P(80, 'Precision', 'crit', 2), P(90, 'Swordmaster', 'acc', 3), P(99, 'Mastery', 'crit', 3)],
  strength: [P(10, 'Heavy hand', 'dmg', 2), P(20, 'Brawler', 'dmg', 2), P(30, 'Cleaver', 'cleave', 15), P(40, 'Power', 'dmg', 2), P(50, 'Momentum', 'dmg', 2),
    P(60, 'Sweep', 'cleave', 20), P(70, 'Crusher', 'dmg', 3), P(80, 'Titan', 'dmg', 3), P(90, 'Juggernaut', 'dmg', 3), P(99, 'Mastery', 'dmg', 4)],
  defence: [P(10, 'Guard', 'dr', 1.5), P(20, 'Brace', 'dr', 1.5), P(30, 'Deflect', 'dr', 1.5), P(40, 'Bulwark', 'dr', 1.5), P(50, 'Ironhide', 'dr', 1.5),
    P(60, 'Stalwart', 'dr', 1.5), P(70, 'Unbroken', 'dr', 2), P(80, 'Fortress', 'dr', 2), P(90, 'Immovable', 'dr', 2), P(99, 'Mastery', 'dr', 3)],
  // early Hitpoints perks stay modest: at 10 max health, +1 health every 10 s would be a different game
  hitpoints: [P(10, 'Iron stomach', 'heal', 5), P(20, 'Sturdy', 'hp', 1), P(30, 'Second wind', 'regen', 1), P(40, 'Tough', 'hp', 2), P(50, 'Good appetite', 'heal', 5),
    P(60, 'Mending', 'regen', 1), P(70, 'Hardy', 'hp', 2), P(80, 'Quick healer', 'regen', 1), P(90, 'Unkillable', 'hp', 3), P(99, 'Mastery', 'regen', 2)],
  ranged: [P(10, 'Steady aim', 'acc', 2), P(20, 'Thrifty powder', 'ammo', 8), P(30, 'Marksman', 'dmg', 2), P(40, 'Careful load', 'ammo', 8), P(50, 'Deadeye', 'crit', 2),
    P(60, 'Sharpshooter', 'acc', 3), P(70, 'Patient', 'ammo', 9), P(80, 'Long gun', 'dmg', 3), P(90, 'Sniper', 'crit', 3), P(99, 'Mastery', 'ammo', 10)],
  magic: [P(10, 'Focus', 'acc', 2), P(20, 'Thrift', 'charms', 8), P(30, 'Tide-touched', 'dmg', 2), P(40, 'Frugal casting', 'charms', 8), P(50, 'Surge', 'crit', 2),
    P(60, 'Attuned', 'acc', 3), P(70, 'Well of power', 'charms', 9), P(80, 'Stormcaller', 'dmg', 3), P(90, 'Archmage', 'crit', 3), P(99, 'Mastery', 'charms', 10)],
};

// Half-step perks (Tom, 2026-10-24: "need more depth and unlocks for every skill"): a smaller real effect at 5, 15,
// 25 ... 95, so every skill earns something every five levels on top of its content.
const H = (name: string, kind: PerkKind, v: number) => ({ name, kind, v });
const halfGathering = (what: string) => [H('Light swing', 'speed', 2), H(`Lasting ${what}`, 'last', 10), H('Second helping', 'double', 2), H('Knows the grain', 'speed', 2), H(`Deep ${what}`, 'last', 10),
  H('Old hand', 'xp', 3), H('Rich pickings', 'double', 3), H('Effortless', 'speed', 3), H(`Endless ${what}`, 'last', 15), H('Treasure sense', 'find', 1)];
const halfProduction = [H('Practised', 'quick', 5), H('Careful', 'save', 2), H('Steady hand', 'fine', 1), H('Brisk', 'quick', 5), H('Sparing', 'save', 3),
  H('Craftsman', 'fine', 2), H('Journeyman', 'xp', 3), H('Swift', 'quick', 5), H('Economical', 'save', 3), H('Masterwork', 'fine', 3)];
const HALF: Record<SkillId, { name: string; kind: PerkKind; v: number }[]> = {
  woodcutting: halfGathering('timber'), mining: halfGathering('veins'), fishing: halfGathering('shoals'),
  smithing: halfProduction, gunsmithing: halfProduction, fletching: halfProduction,
  cooking: [H('Low flame', 'burn', 5), H('Good stock', 'heal', 3), H('Busy galley', 'quick', 10), H('Practised cook', 'burn', 5), H('Seconds', 'double', 2),
    H('Seasoned', 'heal', 3), H('Galley master', 'quick', 10), H('Sure hand', 'burn', 10), H('Feast cook', 'double', 3), H('Signature dish', 'heal', 5)],
  attack: [H('Guarded stance', 'acc', 1), H('Quick recovery', 'spec', 5), H('Measured', 'acc', 1), H('Find the gap', 'crit', 1), H('Tempo', 'spec', 5),
    H('Swordsman', 'acc', 2), H('Exploit', 'crit', 1), H('Relentless', 'spec', 10), H('Blademaster', 'acc', 2), H('Perfect form', 'crit', 2)],
  strength: [H('Muscle', 'dmg', 1), H('Wide swing', 'cleave', 5), H('Bruiser', 'dmg', 1), H('Second wind', 'spec', 5), H('Brawn', 'dmg', 1),
    H('Reaping', 'cleave', 5), H('Hammer blow', 'dmg', 2), H('Fury', 'spec', 5), H('Colossus', 'dmg', 2), H('Unstoppable', 'dmg', 2)],
  defence: [H('Wary', 'dr', 0.5), H('Thick skin', 'hp', 1), H('Parry', 'dr', 0.5), H('Hardened', 'hp', 1), H('Shield wall', 'dr', 1),
    H('Iron will', 'hp', 2), H('Bastion', 'dr', 1), H('Stonewall', 'hp', 2), H('Rampart', 'dr', 1), H('Aegis', 'dr', 1)],
  hitpoints: [H('Healthy', 'heal', 3), H('Hale', 'hp', 1), H('Good digestion', 'heal', 3), H('Robust', 'hp', 1), H('Hearty eater', 'heal', 3),
    H('Vigour', 'hp', 2), H('Regrowth', 'regen', 1), H('Feaster', 'heal', 5), H('Indomitable', 'hp', 2), H('Undying', 'hp', 3)],
  ranged: [H('Keen eye', 'acc', 1), H('Light pouch', 'ammo', 4), H('Heavy draw', 'dmg', 1), H('Quick reload', 'spec', 5), H('Recover shots', 'ammo', 4),
    H('Weak spot', 'crit', 1), H('Power shot', 'dmg', 2), H('Volley', 'spec', 5), H('Fletcher\'s luck', 'ammo', 5), H('Hawkeye', 'dmg', 2)],
  magic: [H('Clear mind', 'acc', 1), H('Charm keeper', 'charms', 4), H('Tide-sworn', 'dmg', 1), H('Quick tides', 'spec', 5), H('Charm saver', 'charms', 4),
    H('Riptide focus', 'crit', 1), H('Deep current', 'dmg', 2), H('Storm tides', 'spec', 5), H('Sea-blessed', 'charms', 5), H('Leviathan\'s voice', 'dmg', 2)],
};
for (const k of Object.keys(HALF) as SkillId[]) {
  PERKS[k] = [...PERKS[k], ...HALF[k].map((h, i) => P(5 + i * 10, h.name, h.kind, h.v))].sort((a, b) => a.level - b.level);
}

/** Sum of a perk kind a skill has earned at this level. */
export function perkTotal(skill: SkillId, level: number, kind: PerkKind): number {
  let t = 0;
  for (const p of PERKS[skill]) if (p.level <= level && p.kind === kind) t += p.v;
  return t;
}

export function perkText(p: Perk): string {
  const v = p.v;
  switch (p.kind) {
    case 'speed': return `+${v}% gathering success`;
    case 'double': return `+${v}% chance of a double`;
    case 'find': return `+${v}% chance of a rare find`;
    case 'tool_care': return `Tools wear ${v}% slower`;
    case 'xp': return `+${v}% experience`;
    case 'save': return `${v}% chance to keep your materials`;
    case 'fine': return `+${v}% masterwork chance`;
    case 'quick': return `Work ${v}% faster`;
    case 'extra': return `+${v} ammunition per batch`;
    case 'burn': return `${v}% less likely to burn food`;
    case 'heal': return `Food heals ${v}% more`;
    case 'acc': return `+${v}% accuracy`;
    case 'dmg': return `+${v}% max hit`;
    case 'crit': return `+${v}% chance to hit your maximum`;
    case 'cleave': return `Swings also hit nearby foes for ${v}%`;
    case 'dr': return `Take ${v}% less damage`;
    case 'regen': return `+${v} health every 10 s`;
    case 'hp': return `+${v} max health`;
    case 'ammo': return `${v}% chance a shot isn't used`;
    case 'charms': return `${v}% chance a spell's charms aren't used`;
    case 'last': return `${v}% chance a spot doesn't run out`;
    case 'spec': return `Special attack recharges ${v}% faster`;
  }
}

/** What every single level-up improves, for the levels without a perk or an unlock. */
export const LEVEL_GAIN: Record<SkillId, string> = {
  woodcutting: '+1% success on every tree', mining: '+1% success on every rock', fishing: '+1% success at every spot',
  smithing: '+1% masterwork chance', gunsmithing: '+1% masterwork chance on pistols', fletching: '+1% masterwork chance on bows and crossbows', cooking: 'You burn food less often',
  attack: 'Better accuracy', strength: 'Harder hits', defence: 'Harder to hit', hitpoints: '+1 max health',
  ranged: 'Better aim and stopping power', magic: 'Better accuracy and stronger spells',
};
