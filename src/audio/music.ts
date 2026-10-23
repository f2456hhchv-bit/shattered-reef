// Folk soundtrack played on recorded instrument samples (FluidR3 GM soundfont by Frank Wen, CC BY 3.0,
// via gleitz/midi-js-soundfonts). Tunes are written in a small ABC subset: traditional (public domain)
// melodies plus an original air. Each mood has its own arrangement; calm music leaves long silences
// between pieces (RuneScape-style) so it never wears thin.

export type MusicMood = 'calm' | 'ship' | 'combat' | 'boss';

type Inst = 'accordion' | 'violin' | 'acoustic_guitar_nylon' | 'cello' | 'flute' | 'string_ensemble_1' | 'orchestral_harp' | 'taiko_drum' | 'timpani';
const SAMPLES: Record<Inst, number[]> = {
  accordion: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81],
  violin: [54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87],
  acoustic_guitar_nylon: [39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81],
  cello: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69],
  flute: [60, 63, 66, 69, 72, 75, 78, 81, 84, 87],
  string_ensemble_1: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81],
  orchestral_harp: [42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
  taiko_drum: [36, 39, 42, 45, 48],
  timpani: [36, 39, 42, 45, 48, 51],
};
/** Loudness trim per instrument (the samples are peak-normalised, not loudness-matched). */
const TRIM: Record<Inst, number> = { accordion: 1.2, violin: 0.8, acoustic_guitar_nylon: 1.8, cello: 0.9, flute: 0.85, string_ensemble_1: 1.0, orchestral_harp: 1.5, taiko_drum: 1.6, timpani: 2.2 };
/** The soundfont renders sit ~12 dB below typical game audio. */
const LEVEL = 4;
const RINGS: Inst[] = ['acoustic_guitar_nylon', 'orchestral_harp', 'taiko_drum', 'timpani']; // plucked/struck: let them ring out

// ------------------------------------------------------------------ tunes (ABC subset)

interface Note { t: number; d: number; m: number } // time and length in eighth notes, MIDI pitch
interface Chord { t: number; pc: number; minor: boolean }
interface Tune { notes: Note[]; chords: Chord[]; len: number }

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEYS: Record<string, Record<string, number>> = { Ddor: {}, Am: {}, C: {}, Edor: { F: 1, C: 1 }, D: { F: 1, C: 1 }, G: { F: 1 } };

/** Parses notes (C = middle C, c an octave up, `,` / `'` shift octaves), ^ _ = accidentals, lengths
 *  (2, 3, /2, 3/2), `>` dotted pairs, z rests and "Am" chord symbols. Bars are just for reading. */
export function abc(src: string, key: string): Tune {
  const sig = KEYS[key];
  const notes: Note[] = [], chords: Chord[] = [];
  let t = 0, i = 0, acc: number | null = null, shorten = false;
  const num = () => { let s = ''; while (i < src.length && /\d/.test(src[i])) s += src[i++]; return s ? +s : NaN; };
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      const end = src.indexOf('"', i + 1), name = src.slice(i + 1, end);
      let pc = PC[name[0]], k = 1;
      if (name[k] === '#') { pc++; k++; } else if (name[k] === 'b') { pc--; k++; }
      chords.push({ t, pc: (pc + 12) % 12, minor: name[k] === 'm' });
      i = end + 1;
    } else if (c === '^' || c === '_' || c === '=') { acc = (acc ?? 0) + (c === '^' ? 1 : c === '_' ? -1 : 0); i++; }
    else if (c === '>') {
      const p = notes[notes.length - 1];
      if (p) { t += p.d * 0.5; p.d *= 1.5; }
      shorten = true; i++;
    } else if (/[A-Ga-gz]/.test(c)) {
      i++;
      let m = -1;
      if (c !== 'z') {
        const up = c.toUpperCase();
        m = 60 + PC[up] + (c === up ? 0 : 12) + (acc ?? sig[up] ?? 0);
        while (src[i] === ',' || src[i] === "'") m += src[i++] === ',' ? -12 : 12;
      }
      let d = 1;
      const n = num();
      if (!isNaN(n)) d = n;
      if (src[i] === '/') { i++; const q = num(); d /= isNaN(q) ? 2 : q; }
      if (shorten) { d *= 0.5; shorten = false; }
      if (m >= 0) notes.push({ t, d, m });
      t += d;
      acc = null;
    } else i++;
  }
  return { notes, chords, len: t };
}

/** The tunes as typed: key, eighths per bar and ABC text (tests check every bar). */
export const TUNE_SRC = {
  // original: a slow modal air for the island
  bellwether: { key: 'Ddor', bar: 6, abc: `"Dm"A4 F2|"C"G4 E2|"Dm"F2 E2 D2|"Am"E6|"F"F4 A2|"C"G4 c2|"Dm"A2 G2 F2|"Am"E6|
    "Dm"d4 c2|"C"c2 B2 G2|"F"A4 F2|"C"G6|"Dm"F2 A2 d2|"C"c2 G2 E2|"Am"E2 F2 E2|"Dm"D6|` },
  // traditional (16th c.)
  greensleeves: { key: 'Am', bar: 6, abc: `"Am"c2 d e>fe|"G"d2 B G>AB|"Am"c2 A A>^GA|"E"B2 ^G E2 A|"Am"c2 d e>fe|"G"d2 B G>AB|"Am"c>BA "E"^G>^F^G|"Am"A3 A2 z|
    "C"g3 g>fe|"G"d2 B G>AB|"Am"c2 A A>^GA|"E"B2 ^G E3|"C"g3 g>fe|"G"d2 B G>AB|"Am"c>BA "E"^G>^F^G|"Am"A3 A3|` },
  // traditional reel
  drowsyMaggie: { key: 'Edor', bar: 8, abc: `"Em"E2BE dEBE|"D"E2BE AFDF|"Em"E2BE dEBE|"D"BABc dAFD|"Em"E2BE dEBE|"D"E2BE AFDF|"Em"E2BE dEBE|"D"BABc dAFA|
    "D"d2fd c2ec|"D"defg afge|"D"d2fd c2ec|"Em"BABc "D"dAFA|"D"d2fd c2ec|"D"defg afge|"D"d2fd c2ec|"Em"BABc "D"dAFD|` },
  // traditional shanty
  drunkenSailor: { key: 'Ddor', bar: 8, abc: `"Dm"A2AA A2AA|A2D2F2A2|"C"G2GG G2GG|G2C2E2G2|"Dm"A2AA A2AA|A2B2c2d2|"C"c2A2 "Am"G2E2|"Dm"D4 D4|
    "Dm"A4 A4|A2D2F2A2|"C"G4 G4|G2C2E2G2|"Dm"A4 A4|A2B2c2d2|"C"c2A2 "Am"G2E2|"Dm"D4 D4|` },
} as const;

export const TUNES = Object.fromEntries(Object.entries(TUNE_SRC).map(([k, v]) => [k, abc(v.abc, v.key)])) as Record<keyof typeof TUNE_SRC, Tune>;

// ------------------------------------------------------------------ arrangements

interface Ev { t: number; inst: Inst | 'clap'; m: number; d: number; v: number } // t, d in eighths
interface Piece { evs: Ev[]; len: number; unit: number } // unit: seconds per eighth

const chordAt = (tune: Tune, t: number) => { let c = tune.chords[0]; for (const k of tune.chords) if (k.t <= t + 1e-6) c = k; return c; };
/** Chord tones [root, third, fifth] with the root at or above `base`. */
const triad = (c: Chord, base: number) => { const r = base + ((c.pc - base) % 12 + 12) % 12; return [r, r + (c.minor ? 3 : 4), r + 7]; };

/** Calm: melody on flute then violin, broken harp chords, cello roots, a soft string bed on the repeat. */
function air(tune: Tune, beat: number, unit: number): Piece {
  const evs: Ev[] = [], intro = tune.len > 0 ? beat * 2 : 0, L = tune.len;
  const harp = (o: number) => {
    for (let b = 0; b < L; b += beat) {
      const [r, th, f] = triad(chordAt(tune, b), 45);
      const pat = beat === 3 ? [r, f, th + 12] : [r, th + 12];
      pat.forEach((m, k) => evs.push({ t: o + b + k * (beat / pat.length), inst: 'orchestral_harp', m, d: beat * 1.5, v: k === 0 ? 0.32 : 0.22 }));
    }
  };
  const bass = (o: number, pad: boolean) => tune.chords.forEach((c, k) => {
    const end = tune.chords[k + 1]?.t ?? L, [r, th, f] = triad(c, 38);
    evs.push({ t: o + c.t, inst: 'cello', m: r, d: end - c.t, v: 0.24 });
    if (pad) for (const m of [r + 12, th + 12, f + 12]) evs.push({ t: o + c.t, inst: 'string_ensemble_1', m, d: end - c.t, v: 0.07 });
  });
  for (let b = 0; b < intro; b += beat) { const [r, , f] = triad(tune.chords[0], 45); evs.push({ t: b, inst: 'orchestral_harp', m: b % (beat * 2) ? f : r, d: beat * 2, v: 0.28 }); }
  for (let pass = 0; pass < 2; pass++) {
    const o = intro + pass * L;
    harp(o); bass(o, pass === 1);
    for (const n of tune.notes) evs.push({ t: o + n.t, inst: pass ? 'violin' : 'flute', m: n.m, d: n.d, v: pass ? 0.3 : 0.42 });
  }
  const end = intro + 2 * L, [r, th, f] = triad(tune.chords[0], 45);
  for (const m of [r, f, th + 12, r + 12]) evs.push({ t: end + (m - r) * 0.02, inst: 'orchestral_harp', m, d: beat * 4, v: 0.25 });
  evs.push({ t: end, inst: 'cello', m: r - 12 < 36 ? r : r - 12, d: beat * 3, v: 0.2 });
  return { evs, len: end + beat * 4, unit };
}

/** Guitar boom-chick: bass on beats 1 and 3, a strummed chord on 2 and 4. */
function rhythm(evs: Ev[], tune: Tune, o: number, beat: number, v: number) {
  for (let b = 0; b < tune.len; b += beat) {
    const k = Math.round(b / beat) % 4, c = chordAt(tune, b);
    if (k % 2 === 0) evs.push({ t: o + b, inst: 'acoustic_guitar_nylon', m: triad(c, 40)[k === 0 ? 0 : 2], d: beat, v: v * 1.2 });
    else triad(c, 52).forEach((m, s) => evs.push({ t: o + b + s * 0.06, inst: 'acoustic_guitar_nylon', m, d: beat, v }));
  }
}

/** Combat: the reel on fiddle (accordion joins on the repeat), driving guitar, taiko on the downbeats. */
function reel(tune: Tune, unit: number): Piece {
  const evs: Ev[] = [], beat = 2, L = tune.len;
  for (let pass = 0; pass < 2; pass++) {
    const o = pass * L;
    for (const n of tune.notes) {
      evs.push({ t: o + n.t, inst: 'violin', m: n.m, d: n.d * 0.95, v: 0.42 });
      if (pass) evs.push({ t: o + n.t, inst: 'accordion', m: n.m, d: n.d * 0.9, v: 0.18 });
    }
    rhythm(evs, tune, o, beat, 0.3);
    for (let b = 0; b < L; b += beat * 4) {
      evs.push({ t: o + b, inst: 'taiko_drum', m: 38, d: 4, v: 0.55 }, { t: o + b + beat * 2, inst: 'taiko_drum', m: 41, d: 4, v: 0.35 });
      evs.push({ t: o + b, inst: 'cello', m: triad(chordAt(tune, b), 38)[0], d: beat * 4, v: 0.2 });
    }
  }
  return { evs, len: 2 * L, unit };
}

/** Sailing: a shanty on accordion, then fiddle, with stomps and claps. */
function shanty(tune: Tune, unit: number): Piece {
  const evs: Ev[] = [], beat = 2, L = tune.len;
  for (let pass = 0; pass < 2; pass++) {
    const o = pass * L;
    for (const n of tune.notes) evs.push({ t: o + n.t, inst: pass ? 'violin' : 'accordion', m: n.m, d: n.d * 0.92, v: pass ? 0.36 : 0.4 });
    if (pass) for (const c of tune.chords) for (const m of triad(c, 57)) evs.push({ t: o + c.t, inst: 'accordion', m, d: 3, v: 0.08 });
    rhythm(evs, tune, o, beat, 0.26);
    for (let b = 0; b < L; b += beat) {
      const k = Math.round(b / beat) % 4;
      if (k % 2 === 0) evs.push({ t: o + b, inst: 'taiko_drum', m: 36, d: 3, v: 0.5 });
      else evs.push({ t: o + b, inst: 'clap', m: 0, d: 0, v: 0.12 });
    }
  }
  return { evs, len: 2 * L, unit };
}

/** Boss: the shanty turned dark (minor mode, low strings), a pulsing cello ostinato, timpani and taiko. */
function boss(tune: Tune, unit: number): Piece {
  const evs: Ev[] = [], beat = 2, L = tune.len;
  for (let pass = 0; pass < 2; pass++) {
    const o = pass * L;
    for (const n of tune.notes) {
      const m = (n.m % 12 === 11 ? n.m - 1 : n.m) - 12; // B to B flat: dorian to aeolian
      evs.push({ t: o + n.t, inst: 'cello', m, d: n.d * 0.95, v: 0.4 }, { t: o + n.t, inst: 'string_ensemble_1', m: m + (pass ? 12 : 0), d: n.d, v: 0.18 });
    }
    for (let b = 0; b < L; b += 1) evs.push({ t: o + b, inst: 'cello', m: triad(chordAt(tune, b), 38)[0], d: 0.8, v: b % 2 ? 0.12 : 0.2 });
    for (let b = 0; b < L; b += beat * 4) {
      const r = triad(chordAt(tune, b), 36)[0];
      evs.push({ t: o + b, inst: 'timpani', m: r, d: 4, v: 0.7 }, { t: o + b + beat * 2, inst: 'timpani', m: r, d: 4, v: 0.5 });
      evs.push({ t: o + b + beat * 3.5, inst: 'taiko_drum', m: 38, d: 3, v: 0.45 }, { t: o + b + beat * 3, inst: 'taiko_drum', m: 36, d: 3, v: 0.5 });
      for (const m of triad(chordAt(tune, b), 50)) evs.push({ t: o + b, inst: 'string_ensemble_1', m, d: beat * 1.5, v: 0.12 });
    }
  }
  return { evs, len: 2 * L, unit };
}

const eighth = (bpmEighths: number) => 60 / bpmEighths;
const PLAYLISTS: Record<MusicMood, () => Piece[]> = {
  calm: () => [air(TUNES.bellwether, 2, eighth(150)), air(TUNES.greensleeves, 3, eighth(165))],
  ship: () => [shanty(TUNES.drunkenSailor, eighth(220))],
  combat: () => [reel(TUNES.drowsyMaggie, eighth(230))],
  boss: () => [boss(TUNES.drunkenSailor, eighth(200))],
};
/** Silence between pieces, seconds: calm music breathes, fights don't. */
const GAP: Record<MusicMood, [number, number]> = { calm: [25, 50], ship: [6, 14], combat: [0, 0], boss: [0, 0] };

// ------------------------------------------------------------------ player

interface Playing { gain: GainNode; evs: Ev[]; next: number; t0: number; unit: number; end: number }

export class Music {
  private buffers = new Map<Inst, Map<number, AudioBuffer>>();
  private loaded = false;
  private mood: MusicMood = 'calm';
  private playing: Playing | null = null;
  private waitUntil = 0;
  private order: Record<MusicMood, number> = { calm: 0, ship: 0, combat: 0, boss: 0 };
  private pieces: Record<MusicMood, Piece[]>;
  private clapBuf: AudioBuffer;

  constructor(private ctx: AudioContext, private out: AudioNode) {
    this.pieces = { calm: PLAYLISTS.calm(), ship: PLAYLISTS.ship(), combat: PLAYLISTS.combat(), boss: PLAYLISTS.boss() };
    for (const k of Object.keys(this.pieces) as MusicMood[]) for (const p of this.pieces[k]) p.evs.sort((a, b) => a.t - b.t);
    const n = Math.floor(ctx.sampleRate * 0.12);
    this.clapBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.clapBuf.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * (Math.exp(-t * 60) + 0.6 * Math.exp(-Math.max(0, t - 0.012) * 70) * (t > 0.012 ? 1 : 0)); }
    this.waitUntil = ctx.currentTime + 2;
    void this.load();
  }

  private async load() {
    const jobs: Promise<void>[] = [];
    for (const inst of Object.keys(SAMPLES) as Inst[]) {
      const map = new Map<number, AudioBuffer>();
      this.buffers.set(inst, map);
      for (const m of SAMPLES[inst]) jobs.push(
        fetch(`audio/inst/${inst}/${m}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
          .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { map.set(m, buf); }).catch(() => { /* a missing note falls back to its neighbours */ }),
      );
    }
    await Promise.all(jobs);
    this.loaded = true;
  }

  /** Called every frame-ish with what is happening; changes of mood cross-fade at once (calm waits its turn). */
  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    const was = this.mood;
    this.mood = mood;
    this.fadeOut(mood === 'combat' || mood === 'boss' ? 0.8 : 2.5);
    const now = this.ctx.currentTime;
    this.waitUntil = now + (mood === 'combat' || mood === 'boss' ? 0.4 : was === 'combat' || was === 'boss' ? 6 : 3);
  }

  private fadeOut(sec: number) {
    const p = this.playing;
    if (!p) return;
    const now = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + sec);
    p.next = p.evs.length; // nothing more from this piece
    const g = p.gain;
    setTimeout(() => g.disconnect(), (sec + 4) * 1000);
    this.playing = null;
  }

  /** Lookahead scheduler; call every ~100 ms. */
  tick() {
    if (!this.loaded || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, ahead = now + 0.25;
    let p = this.playing;
    if (p && now > p.end) { this.playing = p = null; const [a, b] = GAP[this.mood]; this.waitUntil = now + a + Math.random() * (b - a); }
    if (!p) {
      if (now < this.waitUntil) return;
      const list = this.pieces[this.mood], piece = list[this.order[this.mood]++ % list.length];
      const gain = this.ctx.createGain();
      gain.connect(this.out);
      const t0 = now + 0.1;
      p = this.playing = { gain, evs: piece.evs, next: 0, t0, unit: piece.unit, end: t0 + piece.len * piece.unit + 2 };
    }
    while (p.next < p.evs.length) {
      const e = p.evs[p.next], t = p.t0 + e.t * p.unit;
      if (t > ahead) break;
      p.next++;
      if (t < now - 0.05) continue; // fell behind (tab was busy): skip rather than pile up
      if (e.inst === 'clap') this.clap(t, e.v, p.gain);
      else this.note(e.inst, e.m, t, e.d * p.unit, e.v, p.gain);
    }
  }

  private note(inst: Inst, m: number, t: number, dur: number, v: number, out: AudioNode) {
    const map = this.buffers.get(inst);
    if (!map || !map.size) return;
    let best = -1, bd = 99;
    for (const s of map.keys()) { const d = Math.abs(s - m); if (d < bd) { bd = d; best = s; } }
    const buf = map.get(best)!;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (m - best) / 12);
    const vol = v * TRIM[inst] * LEVEL, ring = RINGS.includes(inst);
    const rel = ring ? 0.6 : 0.12;
    const stop = Math.min(t + buf.duration / src.playbackRate.value, t + dur + rel);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, Math.max(t, stop - rel));
    g.gain.linearRampToValueAtTime(0, stop);
    src.connect(g).connect(out);
    src.start(t);
    src.stop(stop + 0.02);
  }

  private clap(t: number, v: number, out: AudioNode) {
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.clapBuf;
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9;
    g.gain.value = v * LEVEL;
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }
}
