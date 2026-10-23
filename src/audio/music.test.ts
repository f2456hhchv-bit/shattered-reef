import { describe, it, expect } from 'vitest';
import { abc, TUNES, TUNE_SRC } from './music';

// The tunes are typed in by hand: check every bar adds up and every note is playable.
describe('music', () => {
  for (const [name, t] of Object.entries(TUNE_SRC)) {
    it(`${name}: every bar has ${t.bar} eighths`, () => {
      const bars = t.abc.split('|').map((b) => b.trim()).filter(Boolean);
      expect(bars.length).toBe(16);
      for (const b of bars) expect([b, abc(b, t.key).len]).toEqual([b, t.bar]);
      const tune = TUNES[name as keyof typeof TUNES];
      expect(tune.len).toBe(16 * t.bar);
      expect(tune.chords[0].t).toBe(0);
      for (const n of tune.notes) { expect(n.m).toBeGreaterThanOrEqual(60); expect(n.m).toBeLessThanOrEqual(81); }
    });
  }
  it('parses pitch, accidentals, key and dotted pairs', () => {
    const t = abc('"Am"C c ^G A,2 e>f', 'Edor');
    expect(t.notes.map((n) => n.m)).toEqual([61, 73, 68, 57, 76, 78]); // C# from the key, A3, F# from the key
    expect(t.notes.slice(-2).map((n) => n.d)).toEqual([1.5, 0.5]);
    expect(t.chords[0]).toEqual({ t: 0, pc: 9, minor: true });
  });
});
