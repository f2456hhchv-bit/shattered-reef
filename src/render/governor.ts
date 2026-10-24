// Auto graphics: keeps the frame rate up on phones by stepping quality down one notch at a time when frames run
// slow, and back up when there's headroom. Pure logic (no Three.js) so its decisions are unit-tested.
//
// Two traps it avoids:
// - A phone the OS caps at 30 fps (iPhone Low Power Mode) is "slow" whatever we draw. If two drops in a row
//   don't make frames faster, it undoes them and stops adapting rather than stripping the visuals for nothing.
// - Flip-flopping: if stepping up makes frames slow again soon after, it doesn't try that again for 10 minutes.

export const SLOW = 1 / 48; // slower than ~48 fps: step down
export const FAST = 1 / 57; // faster than ~57 fps: room to step up

export class QualityGovernor {
  tier = 0;
  frozen = false;
  private ema = 0;
  private now = 0;
  private slowFor = 0;
  private fastFor = 0;
  private changedAt = -99;
  private upAt = -99;
  private upBlockedUntil = 0;
  private check: { emaBefore: number; at: number } | null = null; // a drop waiting to show whether it helped
  private noGain = 0;
  private tierBeforeNoGain = 0;

  constructor(readonly maxTier: number) {}

  /** Feed one frame interval in seconds; returns the tier to draw at. */
  sample(dt: number): number {
    if (!(dt > 0) || dt > 2) return this.tier; // a background tab says nothing about the GPU
    dt = Math.min(dt, 0.25); // one hitch shouldn't swing it; a phone that's always this slow still adds up
    this.now += dt;
    this.ema = this.ema ? this.ema * 0.92 + dt * 0.08 : dt;
    this.slowFor = this.ema > SLOW ? this.slowFor + dt : 0;
    this.fastFor = this.ema < FAST ? this.fastFor + dt : 0;
    if (this.frozen) return this.tier;

    // did the last drop help?
    if (this.check && this.now - this.check.at >= 3) {
      if (this.ema < this.check.emaBefore * 0.92) this.noGain = 0;
      else if (++this.noGain >= 2) {
        this.tier = this.tierBeforeNoGain; // capped by the device, not by us: give the visuals back
        this.frozen = true;
      }
      this.check = null;
      if (this.frozen) return this.tier;
    }
    const since = this.now - this.changedAt;
    if (this.slowFor >= 2 && since >= 3 && this.tier < this.maxTier && !this.check) {
      if (this.noGain === 0) this.tierBeforeNoGain = this.tier;
      if (this.now - this.upAt < 12) this.upBlockedUntil = this.now + 600; // the last step up was too much: don't retry it for 10 minutes
      this.check = { emaBefore: this.ema, at: this.now };
      this.tier++;
      this.changedAt = this.now;
      this.slowFor = 0;
    } else if (this.fastFor >= 10 && since >= 3 && this.tier > 0 && this.now >= this.upBlockedUntil) {
      this.tier--;
      this.changedAt = this.upAt = this.now;
      this.fastFor = 0;
      this.noGain = 0;
    }
    return this.tier;
  }

  get fps() { return this.ema ? 1 / this.ema : 0; }
}
