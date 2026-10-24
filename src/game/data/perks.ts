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
  | 'charms'; // magic: v% chance a spell's charms aren't used

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
  }
}

/** What every single level-up improves, for the levels without a perk or an unlock. */
export const LEVEL_GAIN: Record<SkillId, string> = {
  woodcutting: '+1% success on every tree', mining: '+1% success on every rock', fishing: '+1% success at every spot',
  smithing: '+1% masterwork chance', gunsmithing: '+1% masterwork chance on pistols', fletching: '+1% masterwork chance on bows and crossbows', cooking: 'You burn food less often',
  attack: 'Better accuracy', strength: 'Harder hits', defence: 'Harder to hit', hitpoints: '+1 max health',
  ranged: 'Better aim and stopping power', magic: 'Better accuracy and stronger spells',
};
