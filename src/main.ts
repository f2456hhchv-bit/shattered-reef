import './ui/style.css';
import { Game } from './game/sim/game';
import { parseSave, defaultSave, SAVE_KEY } from './game/sim/save';
import { buildIsland } from './game/world/layout';
import { GameRenderer } from './render/renderer';
import { UI } from './ui/ui';
import { Input } from './input/input';

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

// ---- title screen
let started = false;
const title = document.getElementById('title')!;
const hasSave = !!existing;
const fine = matchMedia('(pointer: fine)').matches;
title.innerHTML = `<div class="card panel">
  <h1>Shattered Reef</h1>
  <div class="sub">Bellwether Isle</div>
  <p>Something rang at the Broken Ring at low water. Gather, forge and fight your way across Bellwether, and find out what the island has kept locked away.</p>
  <div class="ctl">${fine
    ? '<kbd>Click</kbd><span>walk, gather, talk, attack</span><kbd>WASD</kbd><span>move or steer your ship</span><kbd>Space</kbd><span>flintlock shot</span><kbd>E</kbd><span>nearest action</span>'
    : '<b>Drag</b><span>move or steer your ship</span><b>Tap</b><span>walk to things and use them</span><b>Round button</b><span>nearest action</span><b>Pinch</b><span>zoom</span>'}</div>
  <div class="acts">
    ${hasSave ? '<button class="btn primary" id="cont">Continue voyage</button><button class="btn" id="fresh">New voyage</button>' : '<button class="btn primary" id="cont">Begin voyage</button>'}
  </div></div>`;
const start = () => {
  title.remove();
  started = true;
  ui.setInitialPanel();
  if (!hasSave) {
    ui.banner('Bellwether Isle', 'Speak with Iven Marr by the chart house');
    ui.log('Welcome to Bellwether. Iven Marr, the cartographer, wants a word.', 'quest');
  } else ui.log('Welcome back, captain.', 'info');
  save();
};
document.getElementById('cont')!.addEventListener('click', start);
document.getElementById('fresh')?.addEventListener('click', () => ui.confirm('Erase your saved voyage and start again?', 'Start new voyage', () => ui.onReset()));
(document.getElementById('cont') as HTMLButtonElement).focus();

// ---- loop
const STEP = 1 / 60;
let acc = 0, last = performance.now(), saveT = 0;
renderer.snapCamera();
function frame(now: number) {
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
  renderer.frame(dt, now / 1000);
  if (started) ui.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });
window.addEventListener('pagehide', () => { if (started) save(); });

// test / debug handle (read-only use in E2E tests)
(window as unknown as { __reef: unknown }).__reef = { game, ui, renderer, input, save, get started() { return started; }, start };
