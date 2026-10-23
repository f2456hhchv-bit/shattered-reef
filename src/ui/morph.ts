// In-place DOM patching. Panels re-render whenever the game changes; replacing innerHTML would
// swap out the very button a finger is resting on, and the browser then never fires its click
// (a real tap lasts 100-200 ms). Patching keeps existing elements alive and only edits what changed.
// Handlers must be delegated on the container, since patched elements are never re-bound.

const last = new WeakMap<Element, string>();

export function morph(target: Element, html: string) {
  if (last.get(target) === html) return;
  last.set(target, html);
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  patchChildren(target, tpl.content);
}

/** Call after writing a container's innerHTML directly, so the next morph doesn't trust a stale cache. */
export function forget(target: Element) {
  last.delete(target);
}

function patchChildren(a: Node, b: Node) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < bn.length; i++) {
    const x = an[i], y = bn[i];
    if (!x) { a.appendChild(y); continue; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); continue; }
    if (x.nodeType !== Node.ELEMENT_NODE) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    patchAttrs(x as Element, y as Element);
    patchChildren(x, y);
  }
  for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
}

function patchAttrs(x: Element, y: Element) {
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
  for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
}
