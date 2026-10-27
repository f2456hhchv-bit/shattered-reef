import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave, parseSave } from './save';
import { SHIPYARD } from '../data/shipyard';

// Every record added after the first save format must survive a reload (Tom lost these on every load until 2026-10-27).
describe('save round trip', () => {
  const g = new Game({ seed: 1 });
  const fresh = () => defaultSave(g.layout.respawn, g.layout.mooring!);
  it('keeps the collection log, bottles, feats, boss kills, races, refits, bells, meal and tracked quest', () => {
    const s = Object.assign(fresh(), {
      collected: ['logs_oak'], bottles: ['b1'], feats: ['f1'], bossKills: { kraken: 3 }, races: { bell: 61.5 }, raceMedals: { bell: 1 },
      shipyard: { hull: 2, sails: 1 }, bellsRung: 4, meal: { id: 'grog', left: 120 }, track: 'bell',
    });
    const back = parseSave(JSON.stringify(s), fresh())!;
    expect(back.collected).toEqual(['logs_oak']);
    expect(back.bottles).toEqual(['b1']);
    expect(back.feats).toEqual(['f1']);
    expect(back.bossKills).toEqual({ kraken: 3 });
    expect(back.races).toEqual({ bell: 61.5 });
    expect(back.raceMedals).toEqual({ bell: 1 });
    expect(back.shipyard).toEqual({ hull: 2, sails: 1 });
    expect(back.bellsRung).toBe(4);
    expect(back.meal).toEqual({ id: 'grog', left: 120 });
    expect(back.track).toBe('bell');
  });
  it('drops junk in those records instead of loading it', () => {
    const s = Object.assign(fresh(), { collected: [1, 'a', 'a'], shipyard: { hull: 99, cannon: 3 }, meal: { id: 'not_an_item', left: 5 }, track: 'nope', bossKills: 'x', raceMedals: { r: -4 } });
    const back = parseSave(JSON.stringify(s), fresh())!;
    expect(back.collected).toEqual(['a']);
    expect(back.shipyard).toEqual({ hull: SHIPYARD.hull.tiers.length });
    expect(back.meal).toBeUndefined();
    expect(back.track).toBeUndefined();
    expect(back.bossKills).toBeUndefined();
    expect(back.raceMedals).toEqual({ r: 0 });
  });
});
