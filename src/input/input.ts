import type { Game, Target } from '../game/sim/game';
import type { GameRenderer } from '../render/renderer';
import type { UI } from '../ui/ui';

// One input layer for both devices. Touch: invisible joystick (drag) + tap to walk/use.
// Mouse: click to walk/use (RuneScape-style), hover labels, wheel zoom. Keyboard: WASD + hotkeys.

const PICK_Y: Record<Target['kind'], number> = { node: 0.9, npc: 1.3, station: 0.8, bank: 0.6, ship: 1.6, arena: 1.0, portal: 1.2, enemy: 0.9, drop: 0.25, mooring: 1.2, quest: 0.8, event: 1.0, lore: 0.5, door: 1.2 };

export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; type: string }>();
  private stickId: number | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  /** hold-to-inspect (touch): the timer for the finger now down, and whether it has shown a card (then no tap) */
  private holdTimer = 0;
  private inspected = false;
  enabled = true;

  constructor(private canvas: HTMLCanvasElement, private game: Game, private r: GameRenderer, private ui: UI) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.cancel(e));
    canvas.addEventListener('pointerleave', () => this.ui.showHover(0, 0, null, '', false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.r.zoom = clamp(this.r.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.42, 1.5); }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.applyKeys(); });
    // stop iOS double-tap zoom / pull-to-refresh fighting the game
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private down(e: PointerEvent) {
    if (!this.enabled) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    // t = when the finger went down per the browser, so a slow frame can't turn a tap into a long-press
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp, type: e.pointerType });
    // hold a finger still on something to inspect it (phones have no hover): its level, what it needs and gives
    clearTimeout(this.holdTimer); this.inspected = false;
    if (e.pointerType !== 'mouse' && this.pointers.size === 1) {
      const id = e.pointerId;
      this.holdTimer = window.setTimeout(() => {
        const p = this.pointers.get(id);
        if (!p || this.stickId !== null || this.pinch || Math.hypot(p.x - p.sx, p.y - p.sy) >= 14) return;
        const t = this.pick(p.x, p.y, 46);
        if (!t) return;
        this.inspected = true;
        this.ui.showInspect(p.x, p.y, t.verb, t.label, t.kind === 'enemy', this.game.targetNeeds(t));
        navigator.vibrate?.(12);
      }, 450);
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.r.zoom };
      this.releaseStick();
    }
  }

  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.r.zoom = clamp(this.pinch.zoom * (this.pinch.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))), 0.42, 1.5);
      return;
    }
    if (p.type === 'mouse') { this.hover(e.clientX, e.clientY); return; }
    const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy);
    if (this.stickId === null && d > 14 && this.pointers.size === 1) {
      this.stickId = e.pointerId;
      this.ui.closePop();
    }
    if (this.stickId === e.pointerId) {
      const R = 52;
      const k = Math.min(1, d / R);
      const mag = k < 0.18 ? 0 : (k - 0.18) / 0.82;
      // camera yaw is fixed: screen right = +x, screen down = +z
      this.game.setMoveDir((dx / (d || 1)) * mag, (dy / (d || 1)) * mag);
      this.ui.showStick(p.sx, p.sy, (dx / (d || 1)) * Math.min(d, R) * 0.8, (dy / (d || 1)) * Math.min(d, R) * 0.8);
    }
  }

  private up(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    clearTimeout(this.holdTimer);
    if (this.inspected) {
      this.inspected = false; this.ui.showHover(0, 0, null, '', false);
      // the hold was a look, not a tap; but judge by the browser's own times: on a slow frame the timer can run
      // before a quick tap's lift is handled, and that tap must still count
      if (!p || e.timeStamp - p.t >= 450) return;
    }
    if (!p) return;
    if (this.stickId === e.pointerId) { this.releaseStick(); return; }
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
    if (moved < 14 && e.timeStamp - p.t < 700 && !this.pinch && (e.pointerType !== 'mouse' || e.button === 0)) this.tap(e.clientX, e.clientY, p.type);
  }

  private cancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    clearTimeout(this.holdTimer);
    if (this.inspected) { this.inspected = false; this.ui.showHover(0, 0, null, '', false); }
    if (this.stickId === e.pointerId) this.releaseStick();
    this.pinch = null;
  }

  private releaseStick() {
    if (this.stickId === null) return;
    this.stickId = null;
    this.game.setMoveDir(0, 0);
    this.ui.hideStick();
  }

  /**
   * Nearest interactable under a screen point. Each target is a vertical span (a tree from trunk to canopy,
   * a person from feet to head), so clicking anywhere on it counts, not just one spot at its base.
   */
  pick(sx: number, sy: number, radius: number): Target | null {
    const g = this.game;
    [sx, sy] = this.local(sx, sy);
    let best: Target | null = null, bd = radius;
    for (const t of g.targets()) {
      const shoal = t.kind === 'node' && t.label.includes('shoal');
      const base = shoal ? 0.05 : g.world.standY(t.x, t.z);
      const [lo, hi] = t.kind === 'node' && t.verb === 'Chop' ? [0.2, 4.2] : t.kind === 'node' && t.verb === 'Mine' ? [0.05, 1.1] : [0.1, PICK_Y[t.kind] * 1.5];
      const a = this.r.project(t.x, base + lo, t.z), b = this.r.project(t.x, base + hi, t.z);
      if (!a.visible && !b.visible) continue;
      const d = distToSegment(sx, sy, a.x, a.y, b.x, b.y) - (t.verb === 'Chop' ? 12 : 0); // canopies are wide
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /**
   * A pointer's page position -> the canvas's own pixels. After a rotation phones can leave the page scrolled or the
   * canvas a different size from the last frame (Tom: taps landing ~2 cm below the finger in landscape), so this
   * re-measures the canvas on every tap instead of assuming it sits at the page's top-left at its last size.
   */
  private local(x: number, y: number): [number, number] {
    this.r.keepSized();
    const [ox, oy] = this.ui.touchOffset(); // set by Settings > Recalibrate touch
    x -= ox; y -= oy;
    const b = this.canvas.getBoundingClientRect();
    if (!b.width || !b.height) return [x, y];
    return [(x - b.left) * (this.canvas.clientWidth / b.width), (y - b.top) * (this.canvas.clientHeight / b.height)];
  }

  private tap(x: number, y: number, type: string) {
    const g = this.game;
    this.ui.closePop();
    if (this.ui.dialogOpen) { this.ui.advanceDialog(); return; } // a tap reads on, it doesn't also walk off
    if (this.ui.anyWindowOpen()) this.ui.closeWindows(); // RuneScape: clicking the world closes the open window
    const t = this.pick(x, y, type === 'mouse' ? 34 : 46);
    if (t) {
      g.interact(t.key);
      this.r.markClick(t.x, t.z);
      return;
    }
    const gp = this.r.screenToGround(...this.local(x, y));
    if (!gp) return;
    g.moveTo(gp.x, gp.z);
    this.r.markClick(gp.x, gp.z);
  }

  private hover(x: number, y: number) {
    const t = this.pick(x, y, 34);
    this.canvas.style.cursor = t ? 'pointer' : 'default';
    this.ui.showHover(x, y, t ? t.verb : null, t ? t.label : '', t?.kind === 'enemy', t ? this.game.targetNeeds(t) : null);
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.enabled) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const moveKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (moveKeys.includes(k)) {
      e.preventDefault();
      if (down) this.keys.add(k); else this.keys.delete(k);
      this.applyKeys();
      return;
    }
    if (!down || e.repeat) return;
    const g = this.game;
    switch (k) {
      case 'e': case 'Enter': {
        if (this.ui.dialogOpen) { this.ui.advanceDialog(); break; }
        if (g.cueState()) { g.strike(); break; } // mid-swing or mid-craft: E is the timing tap
        const t = g.contextTarget();
        if (t) g.interact(t.key);
        break;
      }
      case ' ': e.preventDefault(); g.useRoll(); break;
      case 'h': g.quickEat(); break;
      case 'l': if (g.p.onShip) this.ui.cycleShipAmmo(); else this.ui.toggleLoadout(); break;
      case 'r': case 'f': g.useSpecial(); break;
      case 't': g.useKey(); break; // turn your key
      case 'i': case 'b': this.ui.selectTab('pack', true); break;
      case 'g': this.ui.selectTab('gear', true); break;
      case 'k': this.ui.selectTab('skills', true); break;
      case 'j': case 'q': this.ui.selectTab('quests', true); break;
      case 'm': this.ui.selectTab('map', true); break;
      case 'o': this.ui.selectTab('settings', true); break;
      case 'Escape': this.ui.closeWindows(); if (this.ui.dialogOpen) this.ui.advanceDialog(); break;
    }
  }

  private applyKeys() {
    const k = this.keys;
    const x = (k.has('d') || k.has('ArrowRight') ? 1 : 0) - (k.has('a') || k.has('ArrowLeft') ? 1 : 0);
    const z = (k.has('s') || k.has('ArrowDown') ? 1 : 0) - (k.has('w') || k.has('ArrowUp') ? 1 : 0);
    if (this.stickId === null) this.game.setMoveDir(x, z);
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
