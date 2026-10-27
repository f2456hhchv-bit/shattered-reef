import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { count } from './inventory';

describe('pack full', () => {
  const base = new Game({ seed: 1 });
  const setup = () => {
    const g = new Game({ seed: 9, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    g.give('hatchet_bronze', 1);
    const n = g.nodes.find((x) => x.def === 'tree_pine')!;
    const q = g.world.nearestWalkable(n.x + 1.2, n.z, 3)!; g.p.x = q[0]; g.p.z = q[1];
    return { g, n };
  };
  it('a full pack stops chopping and says so; Drop junk clears marked stacks and the chopping carries on', () => {
    const { g, n } = setup();
    for (let i = 0; i < g.p.inv.length; i++) if (!g.p.inv[i]) g.p.inv[i] = { id: 'fish_sprat_raw', qty: 1 };
    const events: string[] = []; g.on((e) => { if (e.type === 'packFull') events.push(e.node); });
    g.interact(`node:${n.uid}`);
    for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
    expect(events).toEqual([n.uid]);
    expect(g.dropJunk(n.uid)).toBe(0); // nothing marked yet
    g.toggleJunk('fish_sprat_raw');
    expect(g.junkSlots()).toBeGreaterThan(0);
    g.dropJunk(n.uid);
    expect(count(g.p.inv, 'fish_sprat_raw')).toBe(0);
    expect(count(g.p.inv, 'hatchet_bronze')).toBe(1); // only junk goes
    for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
    expect(g.action?.type).toBe('gather');
  });
  it('what you drop stays dropped while you stand there, and comes back only if you walk away and return to it', () => {
    const { g } = setup();
    g.give('fish_sprat_raw', 1);
    const i = g.p.inv.findIndex((x) => x?.id === 'fish_sprat_raw');
    g.dropSlot(i);
    for (let t = 0; t < 10; t += 1 / 30) g.step(1 / 30);
    expect(count(g.p.inv, 'fish_sprat_raw')).toBe(0);
    const d = g.drops.find((x) => x.stack.id === 'fish_sprat_raw')!;
    g.p.x = d.x + 5; g.p.z = d.z; g.step(1 / 30);
    g.p.x = d.x; g.p.z = d.z; g.step(1 / 30);
    expect(count(g.p.inv, 'fish_sprat_raw')).toBe(1);
  });
  it('quest items and coins can never be junk; marking again unmarks', () => {
    const { g } = setup();
    g.toggleJunk('coins');
    expect(g.isJunk('coins')).toBe(false);
    g.toggleJunk('fish_sprat_raw'); g.toggleJunk('fish_sprat_raw');
    expect(g.isJunk('fish_sprat_raw')).toBe(false);
  });
  it('Bank walks you to the nearest bank', () => {
    const { g } = setup();
    expect(g.goToBank()).toBe(true);
    expect(g.path.length + (g.action ? 1 : 0)).toBeGreaterThan(0);
  });
});
