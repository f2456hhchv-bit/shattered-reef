import './ui/style.css';
import { Game } from './game/sim/game';
import { parseSave, defaultSave, SAVE_KEY } from './game/sim/save';
import { buildIsland } from './game/world/layout';
import { LAYOUT } from './game/world/island';
import { GameRenderer } from './render/renderer';
import { UI } from './ui/ui';
import { Input } from './input/input';
import { GameAudio } from './audio/audio';
import { Credits, logoHtml } from './ui/credits';

// Boot: load (validated) save, build the world, run a fixed-step simulation under a variable-rate renderer.

function readSave(): string | null {
  try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
}

const layoutForDefaults = buildIsland(1);
const fallback = defaultSave(layoutForDefaults.respawn, layoutForDefaults.mooring);
const existing = parseSave(readSave(), fallback);
const game = new Game({ save: existing });
const canvas = document.getElementById('world') as HTMLCanvasElement;
const renderer = new GameRenderer(canvas, game);
renderer.setQuality(game.s.settings.quality);
const ui = new UI(game, renderer);
const input = new Input(canvas, game, renderer, ui);
const audio = new GameAudio(game);
const applyAudio = () => { audio.setMusic(game.s.settings.music); audio.setSfx(game.s.settings.sfx); };
applyAudio();
ui.onAudio = applyAudio;
// browsers only allow sound after a user gesture: the title button, or failing that the first touch/click
const unlockAudio = () => { audio.start(); applyAudio(); };
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
    ui.lastSaved = Date.now();
    return true;
  } catch {
    ui.log('Could not save: browser storage is unavailable or full.', 'warn');
    return false;
  }
}
ui.onSave = save;
ui.onQuality = (q) => renderer.setQuality(q);
ui.onReset = () => {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked: reload still starts fresh */ }
  started = false;
  location.reload();
};

// ---- opening: first visit gets a "tap to begin" gate (so the credits have sound), then the credits;
// returning players go straight to the title menu. Both sit over a slow camera sway across the quay.
const INTRO_KEY = 'shattered-reef-intro-seen';
let started = false;
const title = document.getElementById('title')!;
const hasSave = !!existing;
const fine = matchMedia('(pointer: fine)').matches;
const credits = new Credits(renderer, () => audio.logoCue());
document.body.classList.add('intro');
renderer.resize(); // the world fills the screen behind the intro (no side panel yet)
const seenIntro = (() => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } })();
const markSeen = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage blocked: credits replay next time */ } };

function playCredits() {
  title.classList.add('hidden');
  unlockAudio();
  credits.play(() => { markSeen(); showTitle(); });
}

function showTitle() {
  title.classList.remove('hidden', 'gate');
  title.innerHTML = `<div class="card panel">
  ${logoHtml(false)}
  <div class="sub">Bellwether Isle</div>
  <p>Something rang at the Broken Ring at low water. Gather, forge and fight your way across Bellwether, and find out what the island has kept locked away.</p>
  <div class="ctl">${fine
    ? '<kbd>Click</kbd><span>walk, gather, talk, attack</span><kbd>WASD</kbd><span>move or steer your ship</span><kbd>Space</kbd><span>dodge roll</span><kbd>R</kbd><span>special attack</span><kbd>E</kbd><span>nearest action</span>'
    : '<b>Drag</b><span>move or steer your ship</span><b>Tap</b><span>walk to things and use them</span><b>Big button</b><span>nearest action</span><b>Small buttons</b><span>dodge roll, special attack</span><b>Pinch</b><span>zoom</span>'}</div>
  <div class="acts">
    ${hasSave ? '<button class="btn primary" id="cont">Continue voyage</button><button class="btn" id="fresh">New voyage</button>' : '<button class="btn primary" id="cont">Begin voyage</button>'}
  </div>
  <button class="linkbtn" id="rollCredits">Watch the opening again</button></div>`;
  document.getElementById('cont')!.addEventListener('click', start);
  document.getElementById('fresh')?.addEventListener('click', () => ui.confirm('Erase your saved voyage and start again?', 'Start new voyage', () => ui.onReset()));
  document.getElementById('rollCredits')!.addEventListener('click', playCredits);
  (document.getElementById('cont') as HTMLButtonElement).focus();
}

const start = () => {
  unlockAudio();
  title.remove();
  document.body.classList.remove('intro');
  ui.layout();
  renderer.releaseCinematic(2.2);
  started = true;
  ui.setInitialPanel();
  if (!hasSave) {
    ui.banner('Bellwether Isle', 'Speak with Iven Marr by the chart house');
    ui.log('Welcome to Bellwether. Iven Marr, the cartographer, wants a word.', 'quest');
  } else ui.log('Welcome back, captain.', 'info');
  save();
};

if (seenIntro || matchMedia('(prefers-reduced-motion: reduce)').matches) showTitle();
else {
  title.classList.add('gate');
  title.innerHTML = '<button class="btn primary" id="begin">Tap to begin</button><div class="hint">Best with sound on</div>';
  document.getElementById('begin')!.addEventListener('click', playCredits);
  (document.getElementById('begin') as HTMLButtonElement).focus();
}

// ---- loop
const STEP = 1 / 60;
let acc = 0, last = performance.now(), saveT = 0;
credits.update(0);
renderer.snapCamera();
function frame(now: number) {
  // battery saver: cap at ~30 fps
  if (game.s.settings.quality === 'low' && now - last < 31) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (started) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { game.step(STEP); acc -= STEP; n++; }
    if (n === 6) acc = 0;
    saveT += dt;
    if (saveT > 10) { saveT = 0; save(); }
  }
  if (!started) credits.update(dt);
  renderer.frame(dt, now / 1000);
  if (started) { ui.update(dt); audio.update(dt); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });
window.addEventListener('pagehide', () => { if (started) save(); });

// test / debug handle (read-only use in E2E tests)
(window as unknown as { __reef: unknown }).__reef = { game, ui, renderer, input, audio, save, zones: LAYOUT, get started() { return started; }, start, credits };
