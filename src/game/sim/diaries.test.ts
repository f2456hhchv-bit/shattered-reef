import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { xpForLevel } from './xp';
import { regionLayout } from '../world/layout';
import { DIARIES, diaryDone } from '../data/diaries';
import { QUESTS } from '../data/quests';
import { PLACES, placeRegion } from '../world/places';
import { CHART_MARKS } from '../data/sea';

// Island diaries (data/diaries.ts): a list per island, claimed once for coins, XP and free ferries.
const at = (region: 'bellwether' | 'sunreach' | 'amberhold' | 'wrack') => { const L = regionLayout(region); return new Game({ seed: 3, save: { ...defaultSave(L.respawn, L.mooring!), region } }); };
/** Tick every task off the island's list straight in the save (each kind of task, the way the game records it). */
const finish = (g: Game, island: string) => {
  for (const q of Object.values(QUESTS).filter((x) => (x.island ?? 'bellwether') === island)) g.s.quests[q.id] = q.stages.length - 1;
  for (const f of ['storm_tide_won', 'guardian_defeated', 'greenfire_won', 'seep_held', 'kraken_escaped', 'jotunn_defeated', 'treasure_hauled']) g.s.flags[f] = true;
  for (const m of CHART_MARKS) g.s.flags[`chart_${m.id}`] = true;
  g.s.discovered = PLACES.map((p) => p.id);
  for (const k of Object.keys(g.p.xp) as (keyof typeof g.p.xp)[]) g.p.xp[k] = xpForLevel(60);
};

describe('island diaries', () => {
  it('every island with quests has a diary, and every quest on it is on the list', () => {
    for (const isl of ['bellwether', 'sunreach', 'amberhold', 'wrack']) {
      const d = DIARIES.find((x) => x.island === isl)!;
      expect(d).toBeTruthy();
      for (const q of Object.values(QUESTS).filter((x) => (x.island ?? 'bellwether') === isl && x.id !== 'collector' || x.id === 'collector' && isl === 'wrack')) expect(d.tasks.some((t) => t.id === `q_${q.id}`)).toBe(true);
      // every place check refers to places that exist on that island
      expect(PLACES.some((p) => placeRegion(p) === isl)).toBe(true);
    }
  });

  it('a fresh captain has nothing done and can\'t claim', () => {
    const g = at('bellwether');
    for (const d of DIARIES) expect(diaryDone(d, g)).toBe(false);
    const coins = count(g.p.inv, 'coins');
    g.claimDiary('bellwether');
    expect(count(g.p.inv, 'coins')).toBe(coins);
    expect(g.s.flags.diary_bellwether).toBeFalsy();
  });

  it('finished, it pays once, and that island\'s ferry is free from then on', () => {
    const g = at('sunreach');
    finish(g, 'sunreach');
    const d = DIARIES.find((x) => x.island === 'sunreach')!;
    expect(diaryDone(d, g)).toBe(true);
    expect(g.ferryPrice(90)).toBe(90);
    const coins = count(g.p.inv, 'coins');
    g.claimDiary('sunreach');
    expect(count(g.p.inv, 'coins')).toBe(coins + d.coins);
    g.claimDiary('sunreach');
    expect(count(g.p.inv, 'coins')).toBe(coins + d.coins); // once only
    expect(g.ferryPrice(90)).toBe(0);
    // ride it: no coins taken
    g.p.inv = g.p.inv.map((st) => (st?.id === 'coins' ? null : st));
    const n = g.layout.npcs.find((x) => x.id === 'sefa')!; const q = g.world.nearestWalkable(n.x + 1, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    g.takeFerry('sefa');
    expect(g.s.region).toBe('bellwether'); // across, and nothing paid
  });

  it('ticking a task off tells you, once; what was already done when you load stays quiet', () => {
    const g = at('bellwether');
    const said: string[] = [];
    g.on((e) => { if (e.type === 'msg') said.push(e.text); });
    g.s.flags.storm_tide_won = true; // done before the first check: quiet
    g.step(1 / 30);
    expect(said.filter((t) => t.includes('Diary')).length).toBe(0);
    g.s.flags.guardian_defeated = true;
    for (let k = 0; k < 40; k++) g.step(1 / 30);
    expect(said.filter((t) => t.includes('Bellwether Diary: Beat the Guardian')).length).toBe(1);
  });

  it('hauling a treasure chest is recorded for the Stormwrack diary', () => {
    const g = at('wrack');
    g.give('treasure_map', 1);
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'treasure_map'));
    const t = g.s.treasure!;
    Object.assign(g.ship, { x: t.x, z: t.z }); g.p.onShip = true; g.p.x = t.x; g.p.z = t.z;
    g.interact('event:tm:haul');
    expect(g.s.flags.treasure_hauled).toBe(true);
  });
});
