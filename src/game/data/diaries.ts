import type { SkillId } from './items';
import { QUESTS } from './quests';
import { CHART_MARKS } from './sea';
import { PLACES, placeRegion } from '../world/places';
import { LORE } from './lore';
import type { RegionId } from '../world/regions';

// Island diaries (RuneScape's achievement diaries): a list of things worth doing on each island, built from what the
// game already records (quests, flags, charts, places, levels). Finish an island's list and claim it from the
// journal: coins, XP, and that island's harbourmaster ferries you for free from then on.

/** What a diary task can look at: the save and your levels. */
export interface DiaryView {
  s: { flags: Record<string, boolean>; quests: Record<string, number>; discovered: string[] };
  level(skill: SkillId): number;
}
export interface DiaryTask { id: string; text: string; done: (g: DiaryView) => boolean }
export interface Diary { island: RegionId; name: string; tasks: DiaryTask[]; coins: number; xp: { skill: SkillId; amount: number }[] }

const quest = (id: string) => (g: DiaryView) => (g.s.quests[id] ?? 0) >= QUESTS[id].stages.length - 1;
const flag = (f: string) => (g: DiaryView) => !!g.s.flags[f];
const charts = (r: RegionId) => (g: DiaryView) => CHART_MARKS.filter((m) => m.region === r).every((m) => g.s.flags[`chart_${m.id}`]);
const places = (r: RegionId) => (g: DiaryView) => PLACES.filter((p) => placeRegion(p) === r).every((p) => g.s.discovered.includes(p.id));
const lore = (r: RegionId) => (g: DiaryView) => LORE.filter((l) => l.region === r).every((l) => g.s.flags[`lore_${l.id}`]);
const levels = (lv: number, ...skills: SkillId[]) => (g: DiaryView) => skills.every((k) => g.level(k) >= lv);
const q = (id: string): DiaryTask => ({ id: `q_${id}`, text: `Finish ${QUESTS[id].name}`, done: quest(id) });

export const DIARIES: Diary[] = [
  { island: 'bellwether', name: 'Bellwether Diary', coins: 600, xp: [{ skill: 'woodcutting', amount: 1500 }, { skill: 'mining', amount: 1500 }, { skill: 'fishing', amount: 1500 }],
    tasks: [q('bell'), q('knock'), q('selkie'), q('wreckers'), q('palewing'), q('fen'), q('lantern'),
      { id: 'storm', text: 'Calm the Storm Tide at Bellwether\'s pier', done: flag('storm_tide_won') },
      { id: 'guardian', text: 'Beat the Guardian of the Broken Ring', done: flag('guardian_defeated') },
      { id: 'charts', text: 'Chart all of Bellwether\'s waters', done: charts('bellwether') },
      { id: 'places', text: 'Discover every place on Bellwether', done: places('bellwether') },
      { id: 'lore', text: 'Find every page of Keel\'s Log and every Varrow fragment on Bellwether', done: lore('bellwether') },
      { id: 'gather', text: 'Reach level 20 in Woodcutting, Mining and Fishing', done: levels(20, 'woodcutting', 'mining', 'fishing') }] },
  { island: 'sunreach', name: 'Sunreach Diary', coins: 1200, xp: [{ skill: 'woodcutting', amount: 3000 }, { skill: 'fletching', amount: 3000 }, { skill: 'sailing', amount: 3000 }],
    tasks: [q('tracks'), q('souc'), q('greenheart'), q('temple'), q('ransom'), q('coralkey'),
      { id: 'fire', text: 'Save the Greenheart from fire', done: flag('greenfire_won') },
      { id: 'charts', text: 'Chart all of Sunreach\'s waters', done: charts('sunreach') },
      { id: 'places', text: 'Discover every place on Sunreach', done: places('sunreach') },
      { id: 'lore', text: 'Find every page of Keel\'s Log and every Varrow fragment on Sunreach', done: lore('sunreach') },
      { id: 'sail', text: 'Reach level 25 in Sailing', done: levels(25, 'sailing') }] },
  { island: 'amberhold', name: 'Amberhold Diary', coins: 2000, xp: [{ skill: 'mining', amount: 5000 }, { skill: 'smithing', amount: 5000 }, { skill: 'crafting', amount: 5000 }],
    tasks: [q('toll'), q('barrow'), q('fiddle'), q('brood'), q('brinewife'), q('eightyfirst'), q('secondchance'),
      { id: 'seep', text: 'Hold the Amber Seep until the hill closes', done: flag('seep_held') },
      { id: 'kraken', text: 'Live through a Kraken sighting', done: flag('kraken_escaped') },
      { id: 'charts', text: 'Chart all of Amberhold\'s waters', done: charts('amberhold') },
      { id: 'places', text: 'Discover every place on Amberhold', done: places('amberhold') },
      { id: 'lore', text: 'Find every page of Keel\'s Log and every Varrow fragment on Amberhold', done: lore('amberhold') },
      { id: 'smith', text: 'Reach level 40 in Smithing and Crafting', done: levels(40, 'smithing', 'crafting') }] },
  { island: 'wrack', name: 'Stormwrack Diary', coins: 3500, xp: [{ skill: 'attack', amount: 8000 }, { skill: 'defence', amount: 8000 }, { skill: 'magic', amount: 8000 }],
    tasks: [q('captain'), q('starfall'), q('collector'), q('firstlock'), q('saga'), q('belly'), q('parley'),
      { id: 'jotunn', text: 'Beat the Thunder Jötunn on Thunder Crag', done: flag('jotunn_defeated') },
      { id: 'treasure', text: 'Haul up a chest from a treasure map', done: flag('treasure_hauled') },
      { id: 'places', text: 'Discover every place on Stormwrack', done: places('wrack') },
      { id: 'lore', text: 'Find every page of Keel\'s Log and every Varrow fragment on Stormwrack', done: lore('wrack') },
      { id: 'combat', text: 'Reach level 60 in Attack, Strength and Defence', done: levels(60, 'attack', 'strength', 'defence') }] },
  { island: 'lockhaven', name: 'Lockhaven Diary', coins: 6000, xp: [{ skill: 'crafting', amount: 12000 }, { skill: 'smithing', amount: 12000 }, { skill: 'magic', amount: 12000 }],
    tasks: [q('thirdlock'), q('maud'), q('lanternrelit'),
      { id: 'elder', text: 'Beat the Elder Lockjaw in the Ring of Thirteen', done: flag('elderjaw_defeated') },
      { id: 'doors', text: 'Open all four doors in the Field of Doors', done: (g) => ['door', 'fen', 'ears', 'tooth'].every((d) => g.s.flags[`door_${d}`]) },
      { id: 'places', text: 'Discover every place on Lockhaven', done: places('lockhaven') },
      { id: 'lore', text: 'Find every page of Keel\'s Log and every Varrow fragment on Lockhaven', done: lore('lockhaven') },
      { id: 'forge', text: 'Reach level 75 in Mining and Smithing', done: levels(75, 'mining', 'smithing') }] },
  { island: 'saltglass', name: 'Saltglass Diary', coins: 8000, xp: [{ skill: 'fishing', amount: 15000 }, { skill: 'ranged', amount: 15000 }, { skill: 'crafting', amount: 15000 }],
    tasks: [q('mirror'),
      { id: 'places', text: 'Discover every place on Saltglass', done: places('saltglass') },
      { id: 'skills', text: 'Reach level 80 in Fishing and Mining', done: levels(80, 'fishing', 'mining') }] },
];

export const diaryOf = (island: RegionId) => DIARIES.find((d) => d.island === island);
export const diaryDone = (d: Diary, g: DiaryView) => d.tasks.every((t) => t.done(g));
