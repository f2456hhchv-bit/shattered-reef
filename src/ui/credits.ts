import * as THREE from 'three';
import type { GameRenderer } from '../render/renderer';

// Opening credits: a ~21 s fly-over of Bellwether with title cards, then the camera settles into a slow
// sway over the quay behind the title menu. Everything is data below: shots are functions of u (0..1),
// cards are timed HTML. Tap or any key skips.

type V3 = [number, number, number];
type Shot = { dur: number; at: (u: number) => { pos: V3; look: V3 } };
type Card = { at: number; dur: number; html: string; cls?: string };

const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const ease = (u: number) => u * u * (3 - 2 * u);

const RING: V3 = [38, 4, -32];
const orbit = (c: V3, r: number, y: number, a: number): V3 => [c[0] + Math.cos(a) * r, y, c[2] + Math.sin(a) * r];

/** Behind the title menu: swaying over the sea, looking up the island past the quay. */
export function idlePose(t: number): { pos: V3; look: V3 } {
  const a = 0.35 * Math.sin(t * 0.06);
  return { pos: [Math.sin(a) * 58, 26, 48 + Math.cos(a) * 58], look: [0, 3, 48] };
}

const SHOTS: Shot[] = [
  // in from the open sea towards the quay and the moored ship
  { dur: 5.5, at: (u) => ({ pos: lerp3([-40, 8, 160], [-14, 12, 118], u), look: lerp3([0, 3, 70], [0, 5, 50], u) }) },
  // low over Saltpine Wood, drifting inland towards the fen
  { dur: 5.5, at: (u) => ({ pos: lerp3([-8, 30, 58], [-54, 24, 2], ease(u)), look: lerp3([-36, 3, 22], [-36, 2, -24], ease(u)) }) },
  // circling the Broken Ring while the title lands
  { dur: 6, at: (u) => ({ pos: orbit(RING, 30, 18, 2.4 - 0.9 * u), look: RING }) },
  // rise and pull back out to sea to sit behind the menu
  {
    dur: 4, at: (u) => {
      const k = ease(u), from = orbit(RING, 30, 18, 1.5), to = idlePose(0);
      const pos = lerp3(from, to.pos, k);
      pos[1] += Math.sin(u * Math.PI) * 22;
      return { pos, look: lerp3(RING, to.look, k) };
    },
  },
];

/** The cracked logo; letters animate in when `anim` is set. Also used on the title card. */
export function logoHtml(anim: boolean) {
  const word = (w: string, o: number) => [...w].map((ch, i) => `<span class="l" style="--i:${i + o}">${ch}</span>`).join('');
  const inner = `<span class="w">${word('SHATTERED', 0)}</span><span class="w">${word('REEF', 10)}</span>`;
  return `<div class="logo${anim ? ' anim' : ''}" role="img" aria-label="Shattered Reef"><div class="shard a">${inner}</div><div class="shard b" aria-hidden="true">${inner}</div></div>`;
}

const CARDS: Card[] = [
  { at: 1.0, dur: 4.0, html: '<div class="pre">Tom</div><div class="post">presents</div>' },
  { at: 6.2, dur: 4.0, html: '<div class="post">a tale of</div><div class="pre">Bellwether Isle</div>' },
  { at: 11.2, dur: 7.4, html: logoHtml(true) + '<div class="post">something rang at low water</div>', cls: 'logo-card' },
];
const LOGO_CUE_AT = 9.6; // the cue swells for 1.6 s before it hits, in time with the letters
const DIP = 0.35; // dip to black either side of a hard cut
const CUTS = [SHOTS[0].dur, SHOTS[0].dur + SHOTS[1].dur]; // the last shot flows on from the ring orbit

export class Credits {
  private el: HTMLElement | null = null;
  private cards: HTMLElement[] = [];
  private dip!: HTMLElement;
  private t = 0;
  private cued = false;
  private idleT = 0;
  private playing = false;
  private onDone: () => void = () => {};
  readonly length = SHOTS.reduce((s, x) => s + x.dur, 0);

  constructor(private renderer: GameRenderer, private cue: () => void) {}

  /** Play from the start; `done` runs when it ends or is skipped. */
  play(done: () => void) {
    this.onDone = done;
    this.t = 0; this.cued = false; this.playing = true;
    const el = (this.el = document.createElement('div'));
    el.id = 'intro';
    el.innerHTML = `<div class="dip"></div>${CARDS.map((c) => `<div class="card ${c.cls ?? ''}">${c.html}</div>`).join('')}
      <div class="bar top"></div><div class="bar bot"></div><div class="skip">Tap to skip</div>`;
    document.body.appendChild(el);
    this.cards = [...el.querySelectorAll<HTMLElement>('.card')];
    this.dip = el.querySelector('.dip')!;
    const skip = (e: Event) => { e.preventDefault(); this.finish(); };
    el.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', this.keySkip);
    this.apply(SHOTS[0].at(0));
  }

  private keySkip = (e: KeyboardEvent) => { if (this.playing) { e.preventDefault(); this.finish(); } };

  private finish() {
    if (!this.playing) return;
    this.playing = false;
    window.removeEventListener('keydown', this.keySkip);
    const el = this.el;
    this.el = null;
    if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 700); }
    this.idleT = 0;
    this.onDone();
  }

  /** Per frame until the game starts: runs the shot list, then the idle sway behind the menu. */
  update(dt: number) {
    if (!this.playing) {
      // the title sway is over Bellwether's quay: elsewhere the menu sits over wherever you are
      if (this.renderer.game.s.region !== 'bellwether') { this.renderer.cinematic = null; return; }
      this.idleT += dt;
      this.apply(idlePose(this.idleT));
      return;
    }
    this.t += dt;
    const t = this.t;
    if (!this.cued && t >= LOGO_CUE_AT) { this.cued = true; this.cue(); }
    let start = 0, dip = t < 1.2 ? 1 - t / 1.2 : 0; // fade in from black
    for (const c of CUTS) dip = Math.max(dip, 1 - Math.abs(t - c) / DIP);
    for (let i = 0; i < SHOTS.length; i++) {
      const s = SHOTS[i];
      if (t < start + s.dur || i === SHOTS.length - 1) { this.apply(s.at(Math.min(1, (t - start) / s.dur))); break; }
      start += s.dur;
    }
    this.dip.style.opacity = String(Math.max(0, dip));
    CARDS.forEach((c, i) => this.cards[i].classList.toggle('on', t >= c.at && t < c.at + c.dur));
    if (t >= this.length) this.finish();
  }

  private apply(p: { pos: V3; look: V3 }) {
    const r = this.renderer;
    if (!r.cinematic) r.cinematic = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    r.cinematic.look.set(...p.look);
    // a tall phone screen sees less width: pull back so the framing matches a landscape screen
    const aspect = r.camera.aspect, pull = aspect < 1 ? Math.min(2, Math.pow(1 / aspect, 0.75)) : 1;
    r.cinematic.pos.set(...p.pos).sub(r.cinematic.look).multiplyScalar(pull).add(r.cinematic.look);
  }
}
