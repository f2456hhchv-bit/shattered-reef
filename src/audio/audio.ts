import type { Game, GameEvent } from '../game/sim/game';
import { coastDist } from '../game/world/island';

// All sound is synthesised with Web Audio: no files to download. Three buses (effects, ambience, music)
// under one master. The context starts on the first tap (browsers require a gesture) and suspends
// when the page is hidden. Effects with a position fade with distance from the player.

const DORIAN = [0, 2, 3, 5, 7, 9, 10]; // D dorian: the sea-folk mode
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10]; // darker, for bosses
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Mood = 'calm' | 'combat' | 'boss';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  private waves!: GainNode;
  private wind!: GainNode;
  private nextBar = 0;
  private bar = 0;
  private mood: Mood = 'calm';
  private gullT = 6;
  private timer: number | null = null;
  musicOn = true;
  sfxOn = true;

  constructor(private game: Game) {
    game.on((e) => this.onEvent(e));
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
    });
  }

  /** Call from a user gesture (the title screen's button). Safe to call more than once. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return; // no audio: the game still runs
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); // keeps stacked hits from clipping on phone speakers
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = this.bus(0.9); this.amb = this.bus(0.55); this.music = this.bus(0.42);
    this.apply();
    // noise buffers: white for clicks and splashes, brown (integrated) for surf and wind
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.noise.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
    this.startAmbience();
    this.nextBar = ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  setMusic(on: boolean) { this.musicOn = on; this.apply(); }
  setSfx(on: boolean) { this.sfxOn = on; this.apply(); }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicOn ? 0.42 : 0, t, 0.3);
    this.sfx.gain.setTargetAtTime(this.sfxOn ? 0.9 : 0, t, 0.05);
    this.amb.gain.setTargetAtTime(this.sfxOn ? 0.55 : 0, t, 0.3);
  }

  private bus(v: number) { const g = this.ctx!.createGain(); g.gain.value = v; g.connect(this.master); return g; }

  // ------------------------------------------------------------------ building blocks
  private env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private tone(freq: number, dur: number, o: { type?: OscillatorType; gain?: number; attack?: number; to?: number; at?: number; out?: AudioNode; lp?: number; vib?: number } = {}) {
    const c = this.ctx!, t = o.at ?? c.currentTime;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = o.vib; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur); }
    this.env(g, t, o.gain ?? 0.2, o.attack ?? 0.005, dur);
    let node: AudioNode = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g).connect(o.out ?? this.sfx);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  private hiss(dur: number, o: { type?: BiquadFilterType; freq?: number; to?: number; q?: number; gain?: number; attack?: number; at?: number; out?: AudioNode; brown?: boolean } = {}) {
    const c = this.ctx!, t = o.at ?? c.currentTime;
    const src = c.createBufferSource(); src.buffer = o.brown ? this.brown : this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.freq ?? 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = c.createGain(); this.env(g, t, o.gain ?? 0.2, o.attack ?? 0.005, dur);
    src.connect(f).connect(g).connect(o.out ?? this.sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  /** Bell / metal: inharmonic partials decaying at different rates. */
  private bell(freq: number, dur: number, gain = 0.15, at?: number, out?: AudioNode) {
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]].forEach(([m, k]) => this.tone(freq * m, dur / Math.sqrt(m), { gain: gain * k, at, out }));
  }

  /** Plucked string: bright attack through a closing filter. */
  private pluck(freq: number, dur: number, gain: number, at: number, out: AudioNode) {
    const c = this.ctx!;
    const osc = c.createOscillator(), osc2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    osc.type = 'triangle'; osc2.type = 'sawtooth';
    osc.frequency.value = freq; osc2.frequency.value = freq * 1.003;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 8, at); f.frequency.exponentialRampToValueAtTime(freq * 1.5, at + dur * 0.6);
    this.env(g, at, gain, 0.004, dur);
    osc.connect(f); osc2.connect(g2).connect(f); f.connect(g).connect(out);
    osc.start(at); osc2.start(at); osc.stop(at + dur + 0.05); osc2.stop(at + dur + 0.05);
  }

  /** Distance falloff for things that happen somewhere in the world. */
  private near(x: number, z: number) {
    const p = this.game.p;
    return clamp(1 - Math.hypot(x - p.x, z - p.z) / 35, 0.12, 1);
  }

  // ------------------------------------------------------------------ effects
  private onEvent(e: GameEvent) {
    if (!this.ctx || !this.sfxOn) return;
    switch (e.type) {
      case 'swing': this.hiss(0.18, { freq: 900, to: 2600, q: 1.5, gain: 0.22, attack: 0.03 }); break;
      case 'whirl': this.hiss(0.4, { freq: 400, to: 2200, q: 1.2, gain: 0.3, attack: 0.05 }); break;
      case 'hit': {
        const k = this.near(e.x, e.z);
        if (e.amount === 0) { this.hiss(0.12, { freq: 1600, q: 2, gain: 0.08 * k, attack: 0.02 }); break; } // a miss: just air
        if (e.target === 'player') { this.tone(110, 0.2, { to: 55, type: 'triangle', gain: 0.35 * k }); this.hiss(0.15, { type: 'lowpass', freq: 700, gain: 0.25 * k }); break; }
        this.tone(140, 0.14, { to: 60, gain: 0.32 * k });
        this.hiss(0.05, { type: 'highpass', freq: 2500, gain: 0.18 * k });
        if (e.crit) this.bell(1320, 0.4, 0.08 * k);
        break;
      }
      case 'shoot': {
        const magic = this.game.stats.style === 'magic';
        if (magic) [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.45, { gain: 0.05, vib: 12, attack: 0.02, at: this.ctx!.currentTime + i * 0.03 }));
        else { this.hiss(0.3, { type: 'lowpass', freq: 3200, to: 300, gain: 0.45 }); this.tone(80, 0.22, { to: 40, gain: 0.4 }); }
        break;
      }
      case 'squall': this.hiss(0.9, { freq: 500, to: 3000, q: 0.7, gain: 0.25, attack: 0.15 }); [660, 990, 1320].forEach((f) => this.tone(f, 0.7, { gain: 0.04, vib: 20 })); break;
      case 'roll': this.hiss(0.25, { type: 'lowpass', freq: 900, gain: 0.14, attack: 0.03 }); break;
      case 'dodge': this.bell(1760, 0.25, 0.06); break;
      case 'enemyAttack': this.hiss(0.12, { freq: 700, to: 1400, gain: 0.08 }); break;
      case 'enemyDeath': {
        const k = this.near(e.x, e.z);
        if (e.boss) { this.bell(98, 4, 0.35); this.chord([62, 66, 69, 74], 1.6, 0.06); break; }
        this.tone(320, 0.4, { to: 80, type: 'triangle', gain: 0.16 * k });
        this.hiss(0.3, { type: 'lowpass', freq: 1200, to: 200, gain: 0.12 * k });
        break;
      }
      case 'playerDeath': [62, 58, 55, 50].forEach((n, i) => this.tone(midi(n), 0.9, { type: 'triangle', gain: 0.12, at: this.ctx!.currentTime + i * 0.28, lp: 1500 })); break;
      case 'gatherFx': {
        const k = this.near(e.x, e.z), s = e.success ? 1 : 0.6;
        if (e.kind === 'wood') { this.tone(190, 0.09, { to: 140, gain: 0.3 * k * s }); this.hiss(0.07, { freq: 1300, q: 3, gain: 0.16 * k * s }); }
        else if (e.kind === 'stone') { this.bell(1900 + Math.random() * 400, 0.25, 0.09 * k * s); this.hiss(0.05, { type: 'highpass', freq: 3000, gain: 0.1 * k }); }
        else this.hiss(0.45, { type: 'lowpass', freq: 1800, to: 300, gain: 0.18 * k * s, attack: 0.03 });
        break;
      }
      case 'craftFx':
        if (e.station === 'anvil' || e.station === 'bench') { this.bell(880, 0.6, 0.14); this.tone(220, 0.1, { gain: 0.2 }); }
        else if (e.station === 'furnace') this.hiss(0.9, { type: 'lowpass', freq: 600, gain: 0.3, attack: 0.2, brown: true });
        else this.hiss(0.8, { type: 'highpass', freq: 3500, gain: 0.12, attack: 0.05 }); // sizzle
        break;
      case 'pickup': {
        // sea-glass shattering: a cascade of tiny high chimes over a crisp crack
        const t = this.ctx.currentTime, k = this.near(e.x, e.z);
        this.hiss(0.08, { type: 'highpass', freq: 5000, gain: 0.15 * k });
        for (let i = 0; i < 6; i++) this.tone(2200 + Math.random() * 2600, 0.3, { gain: 0.04 * k, at: t + i * 0.025 });
        if (e.tint === 'rare' || e.tint === 'relic') this.chord([74, 78, 81, 86], 0.9, 0.05);
        break;
      }
      case 'gain': if (e.id === 'coins') [1568, 2093, 1760].forEach((f, i) => this.bell(f, 0.3, 0.05, this.ctx!.currentTime + i * 0.05)); break;
      case 'level': this.arp([62, 66, 69, 74, 78], 0.09, 0.12); break;
      case 'quest': this.arp([69, 74, 78, 81], 0.12, 0.1); break;
      case 'discover': this.arp([62, 64, 67, 69, 71, 74], 0.07, 0.08); break;
      case 'boss':
        if (e.state === 'rise') { this.bell(73, 5, 0.4); this.hiss(2.5, { type: 'lowpass', freq: 200, gain: 0.3, attack: 0.6, brown: true }); }
        if (e.state === 'summon') this.bell(146, 2, 0.25);
        break;
      case 'board': case 'disembark': this.hiss(0.5, { freq: 280, to: 420, q: 4, gain: 0.15, attack: 0.08 }); break;
      case 'explode': this.hiss(0.7, { type: 'lowpass', freq: 500, to: 80, gain: 0.5 * this.near(e.x, e.z), brown: true }); this.tone(60, 0.5, { to: 30, gain: 0.4 }); break;
    }
  }

  private arp(notes: number[], step: number, gain: number) {
    const t = this.ctx!.currentTime;
    notes.forEach((n, i) => this.pluck(midi(n), 0.9, gain, t + i * step, this.sfx));
  }
  private chord(notes: number[], dur: number, gain: number) {
    notes.forEach((n) => this.tone(midi(n), dur, { type: 'triangle', gain, attack: 0.05, lp: 2400 }));
  }

  // ------------------------------------------------------------------ ambience
  private startAmbience() {
    const c = this.ctx!;
    const loop = (buf: AudioBuffer, type: BiquadFilterType, freq: number, gain: number, lfoHz: number, depth: number) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = c.createGain(); g.gain.value = 0;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = lfoHz; lg.gain.value = depth;
      const swell = c.createGain(); swell.gain.value = gain;
      lfo.connect(lg).connect(swell.gain);
      src.connect(f).connect(swell).connect(g).connect(this.amb);
      src.start(); lfo.start();
      return g;
    };
    this.waves = loop(this.brown, 'lowpass', 520, 0.5, 0.11, 0.35); // surf rolling in and out
    this.wind = loop(this.noise, 'bandpass', 420, 0.05, 0.05, 0.03);
  }

  /** Per frame: the surf follows the coast, music follows the danger. */
  update(dt: number) {
    if (!this.ctx) return;
    const g = this.game, t = this.ctx.currentTime;
    const coast = g.p.onShip ? 1 : clamp(1 - coastDist(g.p.x, g.p.z) / 28, 0.05, 1);
    this.waves.gain.setTargetAtTime(coast, t, 1.2);
    this.wind.gain.setTargetAtTime(g.p.onShip ? 1.4 : 0.7, t, 2);
    this.gullT -= dt;
    if (this.gullT <= 0) {
      this.gullT = 7 + Math.random() * 14;
      if (coast > 0.4 && this.sfxOn) for (let i = 0; i < 2; i++) this.tone(1500, 0.35, { to: 1100, gain: 0.025 * coast, vib: 60, attack: 0.04, at: t + i * 0.42, out: this.amb });
    }
    this.mood = g.boss ? 'boss' : g.combatTimer < 5 ? 'combat' : 'calm';
  }

  // ------------------------------------------------------------------ music
  // A generative sea-folk piece: a drone, a plucked arpeggio over a modal progression, and a whistle
  // melody built from short motifs. Combat adds drums and drive; bosses shift to a darker mode.
  private static PROG = [[0, 'm'], [-2, 'M'], [0, 'm'], [-5, 'm'], [0, 'm'], [3, 'M'], [-2, 'M'], [0, 'm']] as const;
  private static MOTIFS = [[0, 2, 4, 2], [4, 3, 2, 0], [0, 4, 5, 4], [2, 4, 6, 4, 2], [5, 4, 2, 1, 0], [4, 4, 2, 0]];

  private schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    while (this.nextBar < c.currentTime + 0.6) { this.playBar(this.nextBar); this.bar++; this.nextBar += this.barLen(); }
  }
  private barLen() { return (60 / (this.mood === 'combat' ? 112 : this.mood === 'boss' ? 92 : 84)) * 4; }

  private playBar(t0: number) {
    const mood = this.mood, beat = this.barLen() / 4, out = this.music;
    const scale = mood === 'boss' ? AEOLIAN : DORIAN;
    const [root, kind] = GameAudio.PROG[this.bar % GameAudio.PROG.length];
    const base = (mood === 'boss' ? 38 : 50) + root; // D2 / D3
    const third = kind === 'm' ? 3 : 4;
    // drone + pad: root and fifth, slow swell across the bar
    for (const n of [base - 12, base + 7 - 12]) this.tone(midi(n), this.barLen() + 0.4, { type: 'sawtooth', gain: 0.025, attack: beat * 1.2, at: t0, out, lp: mood === 'calm' ? 500 : 800 });
    // plucked arpeggio in eighths
    const arp = [0, 7, 12, third + 12, 12, 7, third, 7];
    arp.forEach((iv, i) => { if (mood !== 'calm' || i % 2 === 0 || Math.random() < 0.6) this.pluck(midi(base + iv), beat * 1.4, 0.05, t0 + i * beat / 2, out); });
    // melody: a motif every other bar, with rests to breathe
    if (this.bar % 2 === 0 && Math.random() < (mood === 'combat' ? 0.9 : 0.75)) {
      const m = GameAudio.MOTIFS[Math.floor(Math.random() * GameAudio.MOTIFS.length)];
      const step = (beat * 4) / m.length;
      m.forEach((deg, i) => {
        const n = base + 24 + scale[deg % 7] + 12 * Math.floor(deg / 7);
        this.tone(midi(n), step * 0.95, { type: 'sine', gain: 0.045, attack: 0.04, vib: 3, at: t0 + i * step, out });
        this.tone(midi(n + 12), step * 0.9, { type: 'triangle', gain: 0.008, attack: 0.04, at: t0 + i * step, out });
      });
    }
    // drums when it matters
    if (mood !== 'calm') {
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0 || mood === 'boss') this.tone(mood === 'boss' ? 70 : 95, 0.3, { to: 45, gain: mood === 'boss' ? 0.22 : 0.16, at: t0 + i * beat, out });
        this.hiss(0.05, { type: 'highpass', freq: 6000, gain: 0.04, at: t0 + i * beat + beat / 2, out });
      }
    }
  }

  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close(); }
}
