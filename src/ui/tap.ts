// Reliable taps for game UI. iOS Safari only synthesises `click` after a "hover" phase and drops it if
// anything on the page changes visibility meanwhile (damage numbers, nametags and bars change every frame),
// so a touch would often do nothing. Pointer events are always delivered: act on pointerup for touch/pen,
// keep `click` for mouse and keyboard, and swallow the click that follows a handled touch.

export type TapHandler = (target: HTMLElement, pointerType: string) => void;

export function onTap(container: HTMLElement, selector: string, handler: TapHandler) {
  let down: { id: number; x: number; y: number; el: HTMLElement; key: string } | null = null;
  let swallowUntil = 0, lastType = 'mouse';
  const keyOf = (el: HTMLElement) => [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'id').map((a) => `${a.name}=${a.value}`).join('&');
  const hit = (ev: Event, x?: number, y?: number) => {
    const at = x !== undefined && y !== undefined ? document.elementFromPoint(x, y) : null;
    const el = ((at && container.contains(at) ? at : ev.target) as HTMLElement | null)?.closest<HTMLElement>(selector);
    return el && container.contains(el) && !(el as HTMLButtonElement).disabled ? el : null;
  };
  container.addEventListener('pointerdown', (ev) => {
    lastType = ev.pointerType || 'mouse';
    if (ev.pointerType === 'mouse') { down = null; return; }
    const el = hit(ev);
    down = el ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY, el, key: keyOf(el) } : null;
  });
  container.addEventListener('pointerup', (ev) => {
    const d = down;
    down = null;
    if (!d || ev.pointerId !== d.id || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 12) return;
    const el = hit(ev, ev.clientX, ev.clientY);
    // same control under the finger: the element itself, or its re-rendered twin with the same data attributes
    if (!el || (el !== d.el && keyOf(el) !== d.key)) return;
    swallowUntil = performance.now() + 700;
    handler(el, ev.pointerType);
  });
  container.addEventListener('pointercancel', () => { down = null; });
  container.addEventListener('click', (ev) => {
    if (performance.now() < swallowUntil) { swallowUntil = 0; return; }
    const el = hit(ev);
    if (el) handler(el, lastType);
  });
}
