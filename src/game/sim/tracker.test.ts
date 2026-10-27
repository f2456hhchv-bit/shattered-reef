import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { defaultSave } from './save';
import { QUESTS } from '../data/quests';

describe('quest tracker', () => {
  const base = new Game({ seed: 1 });
  const fresh = () => new Game({ seed: 3, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
  it('a new voyage tracks the main story and points at whoever starts it', () => {
    const g = fresh();
    expect(g.trackedQuest()).toBe('bell');
    const goal = g.questGoal('bell')!, giver = g.layout.npcs.find((n) => n.id === QUESTS.bell.giver)!;
    expect(goal.region).toBe('bellwether');
    expect(Math.hypot(goal.x! - giver.x, goal.z! - giver.z)).toBeLessThan(0.01);
  });
  it('a pinned quest wins while it is under way, and pinning again unpins', () => {
    const g = fresh();
    const side = Object.values(QUESTS).find((q) => !q.main && q.stages.length > 2)!;
    g.setStage('bell', 1); g.setStage(side.id, 1);
    expect(g.trackedQuest()).toBe('bell'); // the main story first
    g.trackQuest(side.id);
    expect(g.trackedQuest()).toBe(side.id);
    g.trackQuest(side.id);
    expect(g.trackedQuest()).toBe('bell');
    g.trackQuest(side.id); g.setStage(side.id, side.stages.length - 1); // finished: the tracker moves on
    expect(g.trackedQuest()).toBe('bell');
  });
  it("every stage of every quest gives a goal, and any spot it points at is one of that stage's own", () => {
    const g = fresh();
    for (const q of Object.values(QUESTS)) q.stages.slice(0, -1).forEach((st, i) => {
      g.s.quests[q.id] = i;
      const goal = g.questGoal(q.id)!;
      expect(goal.text).toBe(st.text);
      if (st.marks?.length && !st.talk && !st.also) expect(st.marks.some((m) => m.x === goal.x && m.z === goal.z)).toBe(true);
    });
  });
});
