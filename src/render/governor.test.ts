import { describe, it, expect } from 'vitest';
import { QualityGovernor } from './governor';

/** A simulated device: frame time at each tier (seconds). Runs `secs` of play and returns the governor. */
function play(gov: QualityGovernor, frameAt: (tier: number, t: number) => number, secs: number) {
  for (let t = 0; t < secs;) { const dt = frameAt(gov.tier, t); gov.sample(dt); t += dt; }
  return gov;
}

describe('auto graphics governor', () => {
  it('leaves a fast phone at full quality', () => {
    expect(play(new QualityGovernor(4), () => 1 / 60, 120).tier).toBe(0);
  });
  it('steps a struggling phone down until it runs smoothly, then stays there', () => {
    // GPU-bound: each tier is ~20% cheaper; full quality runs at 36 fps
    const g = play(new QualityGovernor(4), (tier) => (1 / 36) * 0.8 ** tier, 120);
    expect(g.tier).toBeGreaterThanOrEqual(2);
    expect((1 / 36) * 0.8 ** g.tier).toBeLessThan(1 / 48);
    expect(g.frozen).toBe(false);
  });
  it('does not strip the visuals on a phone the OS caps at 30 fps', () => {
    const g = play(new QualityGovernor(4), () => 1 / 30, 120);
    expect(g.frozen).toBe(true);
    expect(g.tier).toBe(0);
  });
  it('steps back up when the scene gets lighter (leaving town)', () => {
    let heavy = true;
    const g = new QualityGovernor(4);
    play(g, (tier) => (heavy ? 1 / 40 : 1 / 90) * 0.85 ** tier, 60);
    const low = g.tier;
    expect(low).toBeGreaterThan(0);
    heavy = false;
    play(g, (tier) => (1 / 90) * 0.85 ** tier, 120);
    expect(g.tier).toBeLessThan(low);
  });
  it('does not flip-flop between two tiers', () => {
    // tier 1 is smooth (50 fps), tier 0 is not (42 fps): it must settle on 1, not bounce
    const g = new QualityGovernor(4);
    let changes = 0, last = g.tier;
    play(g, (tier) => { if (g.tier !== last) { changes++; last = g.tier; } return tier === 0 ? 1 / 42 : 1 / 58; }, 300);
    expect(g.tier).toBe(1);
    expect(changes).toBeLessThanOrEqual(3);
  });
  it('ignores hitches and background tabs', () => {
    const g = new QualityGovernor(4);
    play(g, (_t, t) => (Math.floor(t) % 5 === 0 && t % 1 < 0.02 ? 0.4 : 1 / 60), 60);
    expect(g.tier).toBe(0);
  });
});
