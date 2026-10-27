import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';
import { regionLayout } from '../world/layout';

const L = regionLayout('bellwether');
const fresh = () => new Game({ seed: 3, save: defaultSave(L.respawn, L.mooring!) });

describe('Wardwright keycutting: one-turn keys', () => {
  it('Mending heals 30% over 10 s; Hush roots nearby foes (not bosses); Harbour puts you on the landing', () => {
    const g = fresh();
    g.give('key_mend', 1); g.give('key_hush', 1); g.give('key_home', 1);
    g.p.hp = 10;
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'key_mend'));
    expect(count(g.p.inv, 'key_mend')).toBe(0);
    for (let t = 0; t < 10.2; t += 1 / 30) g.step(1 / 30);
    expect(g.p.hp).toBeGreaterThanOrEqual(10 + g.stats.maxHp * 0.29);
    const e = g.enemies.find((x) => x.alive && !x.def.boss)!;
    g.p.x = e.x + 3; g.p.z = e.z;
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'key_hush'));
    expect(e.fx.root).toBeGreaterThan(5);
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'key_home'));
    expect(Math.hypot(g.p.x - g.layout.respawn.x, g.p.z - g.layout.respawn.z)).toBeLessThan(0.01);
  });

  it('a Gust key only turns on deck, and fills the sails for 30 s', () => {
    const g = fresh();
    g.give('key_gust', 1);
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'key_gust'));
    expect(count(g.p.inv, 'key_gust')).toBe(1); // ashore: no
    g.p.onShip = true; g.p.x = g.ship.x; g.p.z = g.ship.z;
    g.useSlot(g.p.inv.findIndex((s) => s?.id === 'key_gust'));
    expect(count(g.p.inv, 'key_gust')).toBe(0);
    expect(g.gustUntil).toBeGreaterThan(g.time + 29);
  });
});
