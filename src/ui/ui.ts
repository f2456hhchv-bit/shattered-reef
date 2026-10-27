import { SEEP } from '../game/sim/amberseep';
import { onIconReady } from '../art/overrides';
import { FIRE } from '../game/sim/greenfire';
import { AMMO, CHART_MARKS, type AmmoId } from '../game/data/sea';
import { DIARIES } from '../game/data/diaries';
import { LORE, KEEL_PAGES } from '../game/data/lore';
import { DOORS } from '../game/data/doors';
import { SHIPYARD, SHIP_PARTS, type ShipPart } from '../game/data/shipyard';
import { FEATS, FEAT_TIERS } from '../game/data/feats';
import { BOTTLES, BOTTLE_BY } from '../game/data/bottles';
import { collectionGroups } from '../game/data/collection';
import { TIDES } from '../game/data/tides';
import { MEAL_TEXT, item, RARITY, AFFIXES, METALS, METAL_TRAITS, AMMO_NAME, ammoKind, isTwoHanded, pairGroup, type ItemDef, type Slot, type SkillId, type WeaponKind } from '../game/data/items';
import { morph, forget } from './morph';
import { wears, condOf, WORN_OUT_EFFECT } from '../game/sim/inventory';
import { onTap } from './tap';
import { portrait } from './portrait';
import { NPC_LOOKS, PLAYER_LOOK } from '../art/cast';
import { NODES, SKILLS, UNLOCKS, RECIPES, UTILITY_SPELLS, ELITE_AFFIXES, ENEMIES, PLAYER_BASE, SPELLS, type Station } from '../game/data/content';
import type { Stance } from '../game/sim/gear';
import { NPCS, QUESTS } from '../game/data/quests';
import { coastDist, nearestPathDist, FLATS, SUN, WRACK, AMBER, LOCK, SALT, LONG, coastR, sunCoastR, wrackCoastR, amberCoastR, lockCoastR, saltCoastR, longCoastR, LAYOUT, SUN_LAYOUT } from '../game/world/island';
import { PLACES, placeRegion } from '../game/world/places';
import { REGIONS, type RegionId } from '../game/world/regions';
import { count, displayName, stackValue, INV_SIZE, type Stack } from '../game/sim/inventory';
import { levelForXp, levelProgress, xpForLevel, MAX_LEVEL } from '../game/sim/xp';
import { type Game, type GameEvent, type MsgKind } from '../game/sim/game';
import type { GameRenderer } from '../render/renderer';
import { itemIcon, rarityColour, TAB_ICONS, SKILL_ICONS, SLOT_ICONS } from './icons';
import { LEVEL_GAIN } from '../game/data/perks';
import { KEY, KEYS, KEY_CONFIG } from '../game/data/keys';
import { BOARDS, CREW, BOUNTY_CONFIG, rankOf, type Contract } from '../game/data/bounties';

type Tab = 'pack' | 'gear' | 'skills' | 'quests' | 'map' | 'settings';
const TABS: { id: Tab; name: string; key: string }[] = [
  { id: 'pack', name: 'Pack', key: 'I' },
  { id: 'gear', name: 'Equipment', key: 'G' },
  { id: 'skills', name: 'Skills', key: 'K' },
  { id: 'quests', name: 'Quests', key: 'J' },
  { id: 'map', name: 'Map', key: 'M' },
  { id: 'settings', name: 'Settings', key: 'O' },
];
/** Equipment grid, four across: head and jewellery on top, the hands in the middle, the rest below. */
const SLOT_ORDER: Slot[] = ['head', 'neck', 'ammo', 'ring', 'weapon', 'body', 'offhand', 'ring2', 'hands', 'legs', 'feet', 'wrist'];
const KEY_HINT: Record<string, string> = { any: 'anywhere at all', woodcutting: 'in trees', mining: 'in rock', fishing: 'on the line', melee: 'on foes you cut down', ranged: 'on foes you shoot', magic: 'on foes you spell down', sailing: 'fishing from your ship', explore: 'in places nobody has charted', production: 'at the anvil, the fire or the bench' };
const SLOT_NAME: Record<Slot, string> = { weapon: 'weapon', offhand: 'off-hand', ammo: 'ammo', head: 'head', body: 'body', legs: 'legs', feet: 'feet', hands: 'hands', neck: 'neck', wrist: 'wrist', ring: 'ring', ring2: 'ring' };
/** What an item is worn as, for the details panel. */
const slotLabel = (d: ItemDef) => {
  const e = d.equip!;
  if (e.slot === 'weapon') return `${isTwoHanded(d) ? 'two-handed' : 'one-handed'} weapon`;
  if (e.slot === 'offhand') return `off-hand ${e.off ?? ''}`.trim();
  return SLOT_NAME[e.slot];
};
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
// a ship's gun, for the broadside button aboard
const CANNON = '<svg viewBox="0 0 32 32"><path d="M5 14l16-4 3 8-16 4z" fill="#3a3430" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><circle cx="10" cy="22" r="4" fill="#8a5a34" stroke="#1a120a" stroke-width="2"/><circle cx="26" cy="9" r="2.5" fill="#e9e5d5"/><circle cx="29" cy="5" r="1.5" fill="#e9e5d5"/></svg>';
const WHIRL = '<svg viewBox="0 0 32 32"><path d="M16 4a12 12 0 0 1 11 7l-5-1M28 16a12 12 0 0 1-7 11l1-5M16 28a12 12 0 0 1-11-7l5 1M4 16a12 12 0 0 1 7-11l-1 5" fill="none" stroke="#e9e5d5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="4" fill="#c9a050" stroke="#1a120a" stroke-width="2"/></svg>';
const OPEN_VERB: Record<string, string> = { geode: 'Crack open', bird_nest: 'Search', casket: 'Prise open' };
const KIND_TIPS: Record<WeaponKind, string> = {
  cutlass: 'Balanced blade', dagger: 'Fast, accurate, light', pike: 'Long reach, runs through a line', greatsword: 'Slow and heavy, cleaves the crowd',
  pistol: 'Fires shot', shortbow: 'Fast arrows', longbow: 'Longest reach of all', crossbow: 'Sure, heavy bolts', staff: 'Two-handed: casts your chosen spell', wand: 'One-handed: casts your chosen spell',
};
/** A brass key, for the Key button, the keyring and the find card. */
const KEY_SVG = '<svg viewBox="0 0 32 32"><circle cx="10" cy="11" r="6" fill="none" stroke="#1a120a" stroke-width="5"/><circle cx="10" cy="11" r="6" fill="none" stroke="#d9b25a" stroke-width="2.6"/><path d="M14 15l12 12M21 22l3-3M24 25l3-3" stroke="#1a120a" stroke-width="5" stroke-linecap="round"/><path d="M14 15l12 12M21 22l3-3M24 25l3-3" stroke="#d9b25a" stroke-width="2.6" stroke-linecap="round"/></svg>';
const ROLL = '<svg viewBox="0 0 32 32"><path d="M6 22c0-8 6-14 13-14 4 0 7 2 7 2" fill="none" stroke="#e9e5d5" stroke-width="3.2" stroke-linecap="round"/><path d="M22 4l5 6-7 2" fill="none" stroke="#e9e5d5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 27h12" stroke="#c9a050" stroke-width="3" stroke-linecap="round"/></svg>';
const SQUALL = '<svg viewBox="0 0 32 32"><path d="M4 11c6-4 12 4 18 0M4 17c6-4 12 4 18 0M8 23c6-4 10 3 16 0" fill="none" stroke="#59d0c4" stroke-width="3" stroke-linecap="round"/><circle cx="26" cy="9" r="3" fill="#e9e5d5" stroke="#1a120a" stroke-width="1.5"/></svg>';
const PISTOL = '<svg viewBox="0 0 32 32"><path d="M4 12h18l4-3h3v6h-3l-2 2h-6l-3 9H8l2-8H4z" fill="#9aa0a4" stroke="#1a120a" stroke-width="2" stroke-linejoin="round"/><path d="M12 17l-2 7" stroke="#8a6440" stroke-width="3"/></svg>';

const h = (tag: string, attrs: Record<string, string> = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (n: number) => n.toLocaleString('en-GB');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export class UI {
  tab: Tab = 'pack';
  /** Skills tab: the skill whose level-by-level unlock list is open, if any. */
  skillView: SkillId | null = null;
  private skillScroll = false;
  sideOpen = true;
  private lastRev = -1;
  private el: Record<string, HTMLElement> = {};
  private mmBase!: HTMLCanvasElement;
  private mmCtx!: CanvasRenderingContext2D;
  private mmT = 0;
  private station: Station | null = null;
  private shopOpen = false;
  private shopTab: 'buy' | 'sell' = 'buy';
  private dialog: { npc: string; lines: string[]; i: number; read?: { title: string; sub: string } } | null = null;
  private pop: { slot?: number; equip?: Slot } | null = null;
  private dmgPool: { el: HTMLElement; x: number; y: number; z: number; t: number; live: boolean }[] = [];
  private bars = new Map<number, HTMLElement>();
  private tags = new Map<number, HTMLElement>();
  private playerBar!: HTMLElement;
  private gatherBar!: HTMLElement;
  private cueBar!: HTMLElement;
  private overhead!: HTMLElement;
  private stormHud!: HTMLElement;
  private fireHud!: HTMLElement;
  private seepHud!: HTMLElement;
  private cuePop!: HTMLElement;
  private cuePopT = 0;
  private bannerT = 0;
  private portrait = false;
  private confirmOk: (() => void) | null = null;
  onSave: () => void = () => {};
  onReset: () => void = () => {};
  onQuality: (q: 'auto' | 'max' | 'low') => void = () => {};
  onAudio: () => void = () => {};
  lastSaved = 0;

  constructor(private game: Game, private r: GameRenderer) {
    this.build();
    game.on((e) => this.onEvent(e));
    // painted icons still loading after start-up: redraw the panel as they land (at most four times a second)
    let redraw = 0;
    onIconReady(() => { if (!redraw) redraw = window.setTimeout(() => { redraw = 0; this.lastRev = -1; }, 250); });
    this.layout();
    window.addEventListener('resize', () => this.layout());
    // a tap anywhere outside the item popup closes it (a slot tap opens the next one instead)
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement | null;
      if (this.pop && !t?.closest('#itempop, [data-slot], [data-equip]')) this.closePop();
      if (this.loadoutOpen && !t?.closest('#loadout, #ab-load')) this.closeLoadout();
    }, true);
    // after a rotation some phones report the old size at first: lay out again once it has settled
    const settle = () => { this.layout(); setTimeout(() => this.layout(), 150); setTimeout(() => this.layout(), 500); };
    window.addEventListener('orientationchange', settle);
    window.visualViewport?.addEventListener('resize', () => this.layout());
    window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, { passive: true });
    this.buildMinimapBase();
  }

  // ------------------------------------------------------------------ dom skeleton
  private build() {
    const b = document.body;
    const add = (id: string, el: HTMLElement) => { el.id = id; b.appendChild(el); this.el[id] = el; return el; };
    add('overlay', h('div'));
    add('log', h('div', { 'aria-live': 'polite' }));
    add('banner', h('div'));
    add('bossbar', h('div', {}, '<b></b><div class="bar"><i></i></div>')).hidden = true;
    const mm = add('mm', h('div', { role: 'button', 'aria-label': 'Minimap. Tap to walk there.', tabindex: '0' }, '<canvas></canvas><div id="compass">N</div>'));
    this.mmCtx = (mm.querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
    add('orbs', h('div', {}, `<div class="orb" id="hp" title="Health"><div class="fill"></div><div class="txt"></div><span class="oic">${SKILL_ICONS.hitpoints}</span></div><div class="orb lvl" title="Combat level"><div class="fill"></div><div class="txt" id="cbl"></div><span class="oic">${SKILL_ICONS.attack}</span></div>`));
    this.el.hp = document.getElementById('hp')!;
    // the quest tracker: what the pinned quest wants next; tap it for the journal
    const trackEl = add('track', h('div', { role: 'button', tabindex: '0', 'aria-label': 'Tracked quest. Tap for the journal.' }));
    trackEl.hidden = true; // until the first frame fills it
    onTap(trackEl, '#track', () => this.selectTab('quests', true));
    const side = add('side', h('div', { class: 'panel' }));
    const tabs = h('div', { id: 'tabs', role: 'tablist' });
    const SHORT: Partial<Record<Tab, string>> = { gear: 'Gear', settings: 'Options' };
    for (const t of TABS) {
      const btn = h('button', { 'data-tab': t.id, role: 'tab', 'aria-label': `${t.name} (${t.key})`, title: `${t.name} (${t.key})` }, `${TAB_ICONS[t.id]}<span class="tl">${SHORT[t.id] ?? t.name}</span>`);
      onTap(btn, 'button', () => this.selectTab(t.id, true));
      tabs.appendChild(btn);
    }
    // phones: the open panel's own close button, at the foot of the tab rail
    const shut = h('button', { id: 'tabshut', 'aria-label': 'Close panel', title: 'Close panel' }, '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="tl">Hide</span>');
    onTap(shut, 'button', () => { this.sideOpen = false; this.layout(); });
    tabs.appendChild(shut);
    side.appendChild(tabs);
    const content = h('div', { id: 'content', role: 'tabpanel' });
    side.appendChild(content);
    // phones (RuneScape's vertical layout): a slim scrollbar beside the open tab, arrows at each end, a thumb to drag
    const arrow = (dir: number) => `<button data-dir="${dir}" aria-label="Scroll ${dir < 0 ? 'up' : 'down'}"><svg viewBox="0 0 24 24"><path d="${dir < 0 ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    const scroll = h('div', { id: 'scroll' }, `${arrow(-1)}<div class="track"><i></i></div>${arrow(1)}`);
    onTap(scroll, 'button', (el) => content.scrollBy({ top: Number(el.dataset.dir) * content.clientHeight * 0.75, behavior: 'smooth' }));
    const track = scroll.querySelector('.track') as HTMLElement, thumb = track.firstElementChild as HTMLElement;
    let drag: { y: number; top: number } | null = null;
    track.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.target === thumb) { drag = { y: e.clientY, top: content.scrollTop }; track.setPointerCapture(e.pointerId); return; }
      const r = thumb.getBoundingClientRect();
      content.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * content.clientHeight * 0.9, behavior: 'smooth' });
    });
    track.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const room = track.clientHeight - thumb.offsetHeight;
      if (room > 0) content.scrollTop = drag.top + ((e.clientY - drag.y) / room) * (content.scrollHeight - content.clientHeight);
    });
    const end = () => { drag = null; };
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
    side.appendChild(scroll);
    this.el.scroll = scroll;
    content.addEventListener('scroll', () => this.scrollButtons(), { passive: true });
    this.el.content = content;
    this.bindContent(content);
    this.el.tabs = tabs;
    const col = add('collapse', h('button', { class: 'btn', 'aria-label': 'Toggle side panel' }, '›'));
    onTap(col, 'button', () => { this.sideOpen = !this.sideOpen; this.layout(); });
    const actions = add('actions', h('div'));
    const mk = (id: string, label: string, icon: string, fn: () => void) => {
      const b = h('button', { id, class: 'round ability', 'aria-label': label, title: label }, `${icon}<div class="cd"></div>`);
      onTap(b, 'button', fn);
      this.el[id] = b;
      return b;
    };
    const roll = mk('ab-roll', 'Dodge roll (Space)', ROLL, () => this.game.useRoll());
    const special = mk('ab-special', 'Special attack (R)', WHIRL, () => this.game.useSpecial());
    const keyBtn = mk('ab-key', 'Turn your key (T)', KEY_SVG, () => this.game.useKey());
    const ctx = h('button', { id: 'ctx', class: 'round', 'aria-label': 'Interact (E)' }, '<span></span><small></small>');
    // mid-swing or mid-craft the action button is the timing tap (active skilling); otherwise it acts on what's near
    onTap(ctx, 'button', () => { if (this.game.cueState()?.live) { this.game.strike(); return; } const t = this.game.contextTarget(); if (t) this.game.interact(t.key); });
    // aboard, the loadout button cycles the guns' ammunition instead
    const load = mk('ab-load', 'Weapon, ammo, spell and stance (L)', '<img alt="">', () => { if (this.game.p.onShip) this.cycleShipAmmo(); else this.toggleLoadout(); });
    const eat = mk('ab-eat', 'Eat the best food (H)', '<img alt="">', () => this.game.quickEat());
    eat.insertAdjacentHTML('beforeend', '<b class="n"></b>');
    const abil = h('div', { id: 'abilities' });
    abil.append(load, eat, roll, special, keyBtn);
    actions.append(abil, ctx);
    this.el.abilities = abil;
    this.el.ctx = ctx;
    add('fps', h('div', { 'aria-hidden': 'true' })).hidden = true;
    add('hover', h('div')).hidden = true;
    add('stick', h('div', {}, '<i></i>')).hidden = true;
    add('ko', h('div', {}, 'You were knocked out')).hidden = true;
    this.playerBar = h('div', { class: 'hpbar' }, '<i></i>');
    this.el.overlay.appendChild(this.playerBar);
    this.gatherBar = h('div', { class: 'hpbar gatherbar' }, '<i></i>');
    this.el.overlay.appendChild(this.gatherBar);
    // the timing bar: a needle sweeps each swing or craft; tap while it's in the gold window
    this.cueBar = h('div', { class: 'cuebar' }, '<b></b><s></s><i></i>');
    this.cueBar.style.display = 'none';
    this.el.overlay.appendChild(this.cueBar);
    // the Storm Tide: the serpent's strength and the pier's, while it runs
    this.stormHud = h('div', { id: 'stormhud' }, '<div><b>Tide-serpent</b><span><i></i></span></div><div><b>The pier</b><span><i></i></span></div>');
    this.stormHud.hidden = true;
    this.el.overlay.appendChild(this.stormHud);
    // the Greenheart Fire: same bars, the fire beaten back and the grove still standing
    this.fireHud = h('div', { id: 'firehud', class: 'stormhud' }, '<div><b>Fires out</b><span><i></i></span></div><div><b>Grove left</b><span><i></i></span></div>');
    this.fireHud.hidden = true;
    this.el.overlay.appendChild(this.fireHud);
    // the Amber Seep: the tunnel's strength, and how long the hill stays open
    this.seepHud = h('div', { id: 'seephud' }, '<div><b>The tunnel</b><span><i></i></span></div><div><b>Hill open</b><span><i></i></span></div>');
    this.seepHud.hidden = true;
    this.el.overlay.appendChild(this.seepHud);
    this.overhead = h('div', { class: 'overhead' });
    this.el.overlay.appendChild(this.overhead);
    this.cuePop = h('div', { class: 'cuepop' });
    this.el.overlay.appendChild(this.cuePop);
    mm.addEventListener('pointerdown', (e) => this.minimapTap(e));
    this.selectTab('pack', false);
  }

  layout() {
    // a rotation can leave the page scrolled under the fixed canvas, which shifts every tap: put it back
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    const w = window.innerWidth, hgt = window.innerHeight;
    this.portrait = hgt > w;
    document.body.classList.toggle('portrait', this.portrait);
    document.body.classList.toggle('landscape', !this.portrait);
    document.body.classList.toggle('side-open', this.sideOpen);
    if (!this.sideOpen) this.closePop(); // the popup belongs to the panel
    const mm = this.portrait ? Math.min(118, w * 0.3) : Math.min(150, hgt * 0.24);
    document.documentElement.style.setProperty('--mm', `${mm}px`);
    document.documentElement.style.setProperty('--side-w', `${Math.max(232, Math.min(300, w * 0.3))}px`);
    (this.el.collapse as HTMLButtonElement).textContent = this.sideOpen ? '›' : '‹';
    const cv = this.el.mm.querySelector('canvas') as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(mm * dpr);
    requestAnimationFrame(() => {
      // the quest tracker sits just under the orbs (portrait), wherever their size puts them
      document.documentElement.style.setProperty('--track-top', `${Math.round(document.getElementById('orbs')?.getBoundingClientRect().bottom ?? 66) + 6}px`);
      this.r.resize();
      this.r.coveredBottom = this.portrait && this.sideOpen ? this.el.side.getBoundingClientRect().height : 0;
      this.scrollButtons();
    });
  }

  /** The phone panel's up/down buttons fade at the ends (and when the tab fits without scrolling). */
  private scrollButtons() {
    const c = this.el.content, sc = this.el.scroll, [up, down] = sc.querySelectorAll('button');
    const max = c.scrollHeight - c.clientHeight;
    sc.classList.toggle('none', max <= 1);
    (up as HTMLButtonElement).disabled = c.scrollTop <= 1;
    (down as HTMLButtonElement).disabled = c.scrollTop >= max - 1;
    const track = sc.querySelector('.track') as HTMLElement, thumb = track.firstElementChild as HTMLElement;
    const th = Math.max(28, track.clientHeight * (c.clientHeight / Math.max(1, c.scrollHeight)));
    thumb.style.height = `${th}px`;
    thumb.style.transform = `translateY(${max > 0 ? (c.scrollTop / max) * (track.clientHeight - th) : 0}px)`;
  }

  selectTab(t: Tab, user: boolean) {
    if (user && this.portrait && this.tab === t && this.sideOpen) { this.sideOpen = false; this.layout(); return; }
    if (user && !this.sideOpen) { this.sideOpen = true; this.layout(); }
    if (t !== this.tab) this.skillView = null;
    this.tab = t;
    for (const b of this.el.tabs.querySelectorAll('button')) b.classList.toggle('on', b.getAttribute('data-tab') === t);
    for (const b of this.el.tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t));
    this.closePop();
    this.lastRev = -1;
  }

  /** Phones start with the pack open under the world (RuneScape's vertical layout); narrow landscape starts closed. */
  setInitialPanel() {
    this.sideOpen = window.innerHeight > window.innerWidth || window.innerWidth > 700;
    this.layout();
  }

  // ------------------------------------------------------------------ events
  /** A key found: the same moment as a level-up, in brass. */
  private showKeyCard(id: string) {
    const k = KEY[id];
    const el = document.createElement('div');
    el.className = 'lvup';
    el.style.setProperty('--c', '#d9b25a');
    el.innerHTML = `<div class="lv-card"><i class="medal big" style="--c:#d9b25a">${KEY_SVG}</i>
      <h3>A key!</h3><p>You found the <b>${esc(k.name)}</b>.</p>
      <ul><li><span><b>In you:</b> ${esc(k.passive.text)}</span></li><li><span><b>${esc(k.power.name)}:</b> ${esc(k.power.text)}</span></li></ul>
      <p class="lv-next">${esc(k.lore)}</p>
      <p class="muted">It's on your keyring (Equipment). Slot it at a strongbox or bank, aboard your ship, or in the chapel.</p>
      <div class="lv-tap">Tap to continue</div></div>`;
    document.body.appendChild(el);
    this.lvEl = el;
    this.lvT = 9;
    onTap(el, '.lv-card', () => this.hideLevelCard());
  }

  private onEvent(e: GameEvent) {
    switch (e.type) {
      case 'keyFound': this.lvQueue.push({ key: e.id }); if (!this.lvEl) this.showLevelCard(); break;
      case 'msg': this.log(e.text, e.kind); break;
      case 'packFull': this.packFull(e.node); break;
      case 'cue': this.cuePop.textContent = e.text; this.cuePop.className = `cuepop on${e.perfect ? ' good' : ''}`; this.cuePopT = 0.9; break;
      case 'xp': this.xpDrop(e.skill, e.amount); break;
      case 'gain': this.overheadLine(e.id === 'coins' ? `+${fmt(e.qty)} coins` : `${e.qty} ${esc(e.name.toLowerCase())} gained`, '#efe6cc'); break;
      case 'level': this.levelUp(e.skill, e.level); break;
      case 'discover': { const f = this.game.placeInfo(e.id)?.foes; this.banner(e.name, f ? `Discovered · Foes level ${f[0]}${f[1] > f[0] ? `–${f[1]}` : ''}` : 'Discovered · Peaceful'); break; }
      case 'quest': {
        const q = QUESTS[e.id];
        const done = e.stage === q.stages.length - 1;
        this.banner(done ? 'Quest complete' : e.stage === 1 ? 'New quest' : 'Quest updated', q.name);
        break;
      }
      case 'dialog': this.openDialog(e.npc, e.lines); break;
      case 'read': this.closeWindows(); this.dialog = { npc: '', lines: e.lines, i: 0, read: { title: e.title, sub: e.sub } }; this.renderDialog(); break;
      case 'openStation': this.openStation(e.station); break;
      case 'openShop': this.openShop(); break;
      case 'ferryOffer': { const n = NPCS[e.npc]; this.confirm(`${n.idle[0]}`, e.price ? `Sail (${e.price} coins)` : 'Sail (free: diary)', () => this.game.takeFerry(e.npc)); break; }
      case 'openBank': this.openBank(); break;
      case 'openBoard': this.openBoard(e.board); break;
      case 'sigDrop': this.banner('A signature weapon!', item(e.id).name); break;
      case 'rank': this.banner('Wanted!', `Bounty ${e.bounty.toLocaleString('en-GB')} · ${e.rank}`); break;
      case 'hunters': this.banner('Bounty hunters!', 'They\'ve come to collect'); break;
      case 'hit': this.damageNumber(e.x, e.z, e.amount, e.target === 'player', e.crit); break;
      case 'dodge': this.damageNumber(e.x, e.z, 'Dodged', false, true); break;
      case 'banner': this.banner(e.title, e.sub); break;
      case 'boss': if (e.state === 'defeat') this.banner(e.name ?? 'Victory', e.sub ?? ''); break;
      case 'board': this.closeWindows(); break;
      case 'travel': this.closeWindows(); this.showLoading(e.name, e.tip, REGIONS[e.to].kind === 'cave' ? 'Climbing down into' : this.game.region.kind === 'cave' ? 'Climbing back up to' : 'Setting a course for'); break;
      case 'region': {
        this.buildMinimapBase();
        this.mapView = 'here';
        this.renderTab();
        const r = REGIONS[e.region];
        this.banner(r.name, r.kind === 'cave' ? 'Underground' : ({ bellwether: 'The starter isle', sunreach: 'Port Halyard and the Greenheart', amberhold: 'Tollhouse Landing and the amberwood', wrack: 'Gallows Landing, under Thunder Crag', lockhaven: 'The Wardwrights\' island', saltglass: 'Glasswater Steps', longstrand: 'Weir Landing' } as Record<string, string>)[r.id] ?? '');
        break;
      }
    }
  }

  log(text: string, kind: MsgKind = 'info') {
    const box = this.el.log;
    const d = h('div', { class: kind });
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > (this.portrait ? 3 : 6)) box.firstElementChild!.remove();
    setTimeout(() => { d.style.opacity = '0'; }, 7000);
    setTimeout(() => d.remove(), 7700);
  }

  /** XP and what you just got float up faintly over your head (Tom: "where the player is, alongside 1 tin ore gained"). */
  private overheadLine(html: string, colour: string) {
    const d = h('div');
    d.style.color = colour;
    d.innerHTML = html;
    this.overhead.appendChild(d);
    setTimeout(() => d.remove(), 1900);
    while (this.overhead.children.length > 4) this.overhead.firstElementChild!.remove();
  }
  private xpDrop(skill: SkillId, amt: number) {
    const s = SKILLS.find((x) => x.id === skill)!;
    this.overheadLine(`<span class="xi" style="--c:${s.colour}">${SKILL_ICONS[skill]}</span>+${fmt(amt)} ${s.name} xp`, `color-mix(in srgb, ${s.colour} 45%, #fff)`);
  }

  banner(title: string, sub: string, icon?: SkillId) {
    const s = icon && SKILLS.find((x) => x.id === icon);
    this.el.banner.innerHTML = `${s ? `<i class="medal" style="--c:${s.colour}">${SKILL_ICONS[s.id]}</i>` : ''}<b>${esc(title)}</b><span>${esc(sub)}</span>`;
    this.el.banner.classList.add('show');
    this.bannerT = 2.6;
  }

  // ------------------------------------------------------------------ level up (RuneScape's congratulations)
  private lvQueue: ({ skill: SkillId; level: number } | { key: string })[] = [];
  private lvEl: HTMLElement | null = null;
  private lvT = 0;
  /** A level up: the RuneScape moment. A card with the skill's medal, "Congratulations!" and what you can do now. */
  levelUp(skill: SkillId, level: number) {
    const q = this.lvQueue.find((x): x is { skill: SkillId; level: number } => 'skill' in x && x.skill === skill);
    if (q) q.level = level; else this.lvQueue.push({ skill, level }); // several levels at once: one card, the latest level
    if (!this.lvEl) this.showLevelCard();
  }
  private showLevelCard() {
    const next = this.lvQueue.shift();
    if (!next) return;
    if ('key' in next) { this.showKeyCard(next.key); return; }
    const { skill, level } = next, sk = SKILLS.find((x) => x.id === skill)!;
    const now = UNLOCKS[skill].filter((u) => u.level === level);
    const things = now.filter((u) => !u.perk), perks = now.filter((u) => u.perk);
    const upcoming = UNLOCKS[skill].find((u) => u.level > level && !u.perk);
    const lines = things.slice(0, 4).map((u) => `<li>${u.icon ? `<img src="${itemIcon(u.icon)}" alt="">` : ''}<span>${esc(u.text)}</span></li>`).join('')
      + (things.length > 4 ? `<li class="more">and ${things.length - 4} more: see the skill guide</li>` : '')
      + perks.map((u) => `<li class="perk"><span>${esc(u.text)}</span></li>`).join('');
    const el = document.createElement('div');
    el.className = 'lvup';
    el.style.setProperty('--c', sk.colour);
    el.innerHTML = `<div class="lv-card"><i class="medal big" style="--c:${sk.colour}">${SKILL_ICONS[skill]}</i>
      <h3>Congratulations!</h3><p>You've just advanced ${/^[AEIOU]/.test(sk.name) ? 'an' : 'a'} <b>${sk.name}</b> level.<br>You have reached level <b>${level}</b>.</p>
      ${lines ? `<div class="lv-sub">You can now</div><ul>${lines}</ul>` : `<p class="muted">${esc(LEVEL_GAIN[skill])}.</p>`}
      ${upcoming ? `<p class="lv-next">Next at level ${upcoming.level}: ${esc(upcoming.text)}</p>` : ''}
      <div class="lv-tap">Tap to continue</div></div>`;
    document.body.appendChild(el);
    this.lvEl = el;
    this.lvT = 7;
    onTap(el, '.lv-card', () => this.hideLevelCard());
  }
  private hideLevelCard() {
    const el = this.lvEl;
    if (!el) return;
    this.lvEl = null;
    el.classList.add('out');
    setTimeout(() => { el.remove(); this.showLevelCard(); }, 260);
  }


  // ------------------------------------------------------------------ per-frame
  update(dt: number) {
    if ((window.innerHeight > window.innerWidth) !== this.portrait) this.layout(); // rotated without a resize event
    const g = this.game;
    const p = g.p;
    // orbs
    const hp = this.el.hp;
    (hp.querySelector('.fill') as HTMLElement).style.transform = `scaleY(${Math.max(0, p.hp / g.stats.maxHp)})`;
    (hp.querySelector('.txt') as HTMLElement).textContent = `${Math.ceil(p.hp)}`;
    document.getElementById('cbl')!.textContent = String(g.stats.combatLevel);
    this.updateTracker();
    // context + ability
    const t = g.contextTarget();
    const ctx = this.el.ctx as HTMLButtonElement;
    ctx.hidden = !t || g.dead > 0;
    if (t) {
      (ctx.querySelector('span') as HTMLElement).textContent = t.verb;
      // phones have no hover: the action button says when you can't do it yet
      const needs = g.targetNeeds(t), small = ctx.querySelector('small') as HTMLElement;
      // the button is small: "Lagoon trout & fen salmon shoal" reads as "Lagoon trout shoal"
      small.textContent = needs && !needs.ok ? needs.text.replace(/^Needs /, 'Need ').replace(/ \(you have \d+\)/, '') : t.label.replace(/ & .* (\w+)$/, ' $1');
      small.classList.toggle('no', !!needs && !needs.ok);
      small.classList.toggle('long', small.textContent!.length > 14 || small.textContent!.split(' ').some((w) => w.length > 10));
      ctx.setAttribute('aria-label', `${t.verb} ${t.label} (E)`);
    }
    const sp = g.specialInfo();
    const spBtn = this.el['ab-special'];
    const spStyle = g.p.onShip ? 'ship' : g.stats.style;
    if (spBtn.dataset.style !== spStyle) {
      spBtn.dataset.style = spStyle;
      spBtn.innerHTML = `${spStyle === 'ship' ? CANNON : spStyle === 'melee' ? WHIRL : spStyle === 'ranged' ? PISTOL : SQUALL}<div class="cd"></div>`;
    }
    spBtn.title = `${sp.name} (R)${sp.block ? ' · ' + sp.block : ''}`;
    spBtn.setAttribute('aria-label', spBtn.title);
    // the Key button: the slotted key's power; grey while it sleeps or no foe is in reach
    const kb = this.el['ab-key'], kd = g.s.key ? KEY[g.s.key] : null, kBlock = g.keyBlock();
    kb.hidden = !kd;
    if (kd) { kb.title = `${kd.power.name}: ${kd.power.text} (T)${kBlock ? ' · ' + kBlock : ''}`; kb.setAttribute('aria-label', kb.title); }
    const abs: [HTMLElement, number, number, boolean][] = [[this.el['ab-roll'], g.rollCd, PLAYER_BASE.rollCooldown, false], [spBtn, g.p.onShip ? g.naval.reloadCd : g.specialCd, sp.cooldown, !!sp.block && !(g.p.onShip && sp.block === 'Reloading')],
      [kb, g.s.keyDormant > 0 ? KEY_CONFIG.dormantS : g.keyCd, g.s.keyDormant > 0 ? KEY_CONFIG.dormantS : kd?.power.cooldown ?? 1, !!kBlock]];
    for (const [b, cd, max, blocked] of abs) {
      b.classList.toggle('off', cd > 0 || blocked);
      (b.querySelector('.cd') as HTMLElement).style.setProperty('--cd', `${(cd / max) * 360}deg`);
    }
    if (this.cuePopT > 0 && (this.cuePopT -= dt) <= 0) this.cuePop.className = 'cuepop';
    const fire = g.fire;
    this.fireHud.hidden = !fire.running;
    if (fire.running) {
      const bars = this.fireHud.querySelectorAll('i');
      (bars[0] as HTMLElement).style.width = `${(fire.doused / FIRE.win) * 100}%`;
      (bars[1] as HTMLElement).style.width = `${(1 - fire.ashed / FIRE.lose) * 100}%`;
    }
    const seep = g.seep;
    this.seepHud.hidden = !seep.running;
    if (seep.running) {
      const bars = this.seepHud.querySelectorAll('i');
      (bars[0] as HTMLElement).style.width = `${(seep.stability / SEEP.stability) * 100}%`;
      (bars[1] as HTMLElement).style.width = `${(seep.left / SEEP.duration) * 100}%`;
    }
    const storm = g.storm;
    this.stormHud.hidden = !storm.running;
    if (storm.running) {
      const bars = this.stormHud.querySelectorAll('i');
      (bars[0] as HTMLElement).style.width = `${storm.serpent}%`;
      (bars[1] as HTMLElement).style.width = `${storm.dock}%`;
    }
    // frame-rate readout (settings): what Auto is doing on this phone
    this.fpsT -= dt;
    if (this.fpsT <= 0) {
      this.fpsT = 0.5;
      const fe = this.el.fps;
      fe.hidden = !g.s.settings.showFps;
      if (!fe.hidden) { const pf = this.r.perf; fe.textContent = `${Math.round(pf.fps)} fps · detail ${['full', 'high', 'medium', 'low', 'lowest'][pf.tier] ?? '?'} · ${pf.pr.toFixed(2)}x`; }
    }
    // loadout button: the weapon in hand (the dot shows when there's a choice to make: a spell or ammo)
    const shipAmmo = AMMO[g.naval.ammo].item ?? 'shot_bronze'; // aboard: the guns' load (cannonballs show as round shot)
    const lb = this.el['ab-load'], wid = g.p.equip.weapon?.id ?? 'cutlass_rusty', limg = lb.querySelector('img') as HTMLImageElement, lsrc = itemIcon(g.p.onShip ? shipAmmo : wid);
    if (limg.getAttribute('src') !== lsrc) limg.setAttribute('src', lsrc);
    lb.classList.toggle('warn', g.p.onShip ? false : !!g.ammoBlock());
    // quick eat: shows the food it would pick right now (any food when you're at full health)
    const eatBtn = this.el['ab-eat'], fi = g.bestFood() ?? g.foodSlot();
    eatBtn.hidden = fi === null;
    if (fi !== null) {
      const st = g.p.inv[fi]!, img = eatBtn.querySelector('img') as HTMLImageElement, src = itemIcon(st.id);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      const n = String(g.p.inv.reduce((a, x) => a + (x && x.id === st.id ? x.qty : 0), 0));
      const nb = eatBtn.querySelector('.n') as HTMLElement;
      if (nb.textContent !== n) nb.textContent = n;
      eatBtn.classList.toggle('off', g.bestFood() === null || g.eatCd > 0);
      (eatBtn.querySelector('.cd') as HTMLElement).style.setProperty('--cd', `${(Math.max(0, g.eatCd) / 1.2) * 360}deg`);
    }
    // aboard: the guns (special = Fire, loadout = ammo); roll, eat and key stay ashore
    this.el.abilities.hidden = g.dead > 0;
    this.el['ab-roll'].hidden = g.p.onShip;
    for (const id of ['ab-key', 'ab-eat']) if (g.p.onShip) this.el[id].hidden = true; // ashore their own rules above show them again
    // a galley meal, while it lasts: a small chip beside the orbs
    {
      const m = g.s.meal && g.s.meal.left > 0 ? g.s.meal : null;
      let chip = document.getElementById('mealchip');
      if (m && !chip) { chip = h('div', { id: 'mealchip' }); document.getElementById('orbs')?.appendChild(chip); }
      if (chip) {
        chip.hidden = !m;
        if (m) { const d = item(m.id), s = Math.ceil(m.left), t = `${d.name} · ${MEAL_TEXT[d.meal!.kind](d.meal!.v)} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (chip.textContent !== t) chip.textContent = t; }
      }
    }
    // the Gull Race clock, beside the orbs while you're racing
    {
      const run = g.regatta.run;
      let chip = document.getElementById('racechip');
      if (run && !chip) { chip = h('div', { id: 'racechip', class: 'mealchip-like' }); document.getElementById('orbs')?.appendChild(chip); }
      if (chip) {
        chip.hidden = !run;
        if (run) { const s = g.time - run.start, t = `Race ${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')} · buoy ${Math.min(run.next + 1, run.course.buoys.length)}/${run.course.buoys.length}${run.next >= run.course.buoys.length ? ' · home!' : ''}`; if (chip.textContent !== t) chip.textContent = t; }
      }
    }
    // boss bar
    const bb = this.el.bossbar;
    if (g.boss && g.boss.alive) {
      bb.hidden = false;
      (bb.querySelector('b') as HTMLElement).textContent = g.boss.def.name;
      (bb.querySelector('i') as HTMLElement).style.transform = `scaleX(${g.boss.hp / g.boss.maxHp})`;
    } else bb.hidden = true;
    this.el.ko.hidden = !(g.dead > 0);
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.classList.remove('show'); }
    if (this.lvEl) { this.lvT -= dt; if (this.lvT <= 0) this.hideLevelCard(); }
    // windows that depend on position
    if (this.station && !g.nearStation(this.station)) this.closeWindows();
    if (this.shopOpen && !g.nearShop()) this.closeWindows();
    if (this.bankOpen && !g.nearBank()) this.closeWindows();
    if (this.boardOpen && !this.nearBoard()) this.closeWindows();
    // panel content
    if (g.rev !== this.lastRev) {
      this.lastRev = g.rev;
      // the map draws itself every 0.1 s below; it only needs building once when its tab opens
      if (this.sideOpen && (this.tab !== 'map' || !document.getElementById('mapbig'))) this.renderTab();
      if (this.station) this.renderStation();
      if (this.shopOpen) this.renderShop();
      if (this.loadoutOpen) this.renderLoadout();
      if (this.bankOpen) this.renderBank();
      if (this.boardOpen) this.renderBoard();
      if (this.pop) this.renderPop();
    }
    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.1;
      this.drawMinimap();
      if (this.sideOpen && this.tab === 'map') this.drawBigMap();
    }
    this.updateOverlay(dt);
  }

  // ------------------------------------------------------------------ overlay: damage numbers, bars, tags
  private damageNumber(x: number, z: number, amount: number | string, player: boolean, crit: boolean) {
    if (!this.game.s.settings.showDamage) return;
    let d = this.dmgPool.find((q) => !q.live);
    if (!d) {
      if (this.dmgPool.length > 40) return;
      const el = h('div', { class: 'dmg' });
      this.el.overlay.appendChild(el);
      d = { el, x: 0, y: 0, z: 0, t: 0, live: false };
      this.dmgPool.push(d);
    }
    d.live = true; d.t = 0;
    d.x = x + (Math.random() - 0.5) * 0.6; d.z = z; d.y = this.game.world.standY(x, z) + 2.2;
    const miss = amount === 0; // RuneScape shows misses as a blue zero: make it unmistakably a miss, not a bug
    d.el.className = `dmg${player ? ' player' : ''}${crit ? ' crit' : ''}${miss ? ' miss0' : ''}`;
    d.el.textContent = miss ? 'Miss' : String(amount);
    d.el.style.display = '';
  }

  private updateOverlay(dt: number) {
    const g = this.game, r = this.r;
    for (const d of this.dmgPool) {
      if (!d.live) continue;
      d.t += dt;
      if (d.t > 0.9) { d.live = false; d.el.style.display = 'none'; continue; }
      const s = r.project(d.x, d.y + Math.max(0, d.t - 0.25) * 1.1, d.z);
      // pop: overshoot in, settle, hold, then drift up and fade
      const k = d.t < 0.1 ? 0.45 + (d.t / 0.1) * 0.8 : Math.max(1, 1.25 - (d.t - 0.1) * 2.5);
      d.el.style.left = `${s.x}px`;
      d.el.style.top = `${s.y}px`;
      d.el.style.transform = `translate(-50%, -50%) scale(${k.toFixed(3)})`;
      d.el.style.opacity = String(Math.min(1, 2.6 - d.t * 2.8));
    }
    const seen = new Set<number>();
    const placed: [number, number, number][] = []; // name tags this frame: x, y, half-width
    for (const e of g.enemies) {
      if (!e.alive || e.def.boss || e.state === 'rise') continue;
      const show = e.hp < e.maxHp || g.target === e.id;
      const s = r.project(e.x, g.world.ground(e.x, e.z) + (e.def.model === 'crab' ? 1.3 : 2.6) * (e.elite ? 1.15 : 1), e.z);
      if (!s.visible) continue;
      if (show) {
        seen.add(e.id);
        let b = this.bars.get(e.id);
        if (!b) { b = h('div', { class: 'hpbar' }, '<i></i>'); this.el.overlay.appendChild(b); this.bars.set(e.id, b); }
        b.style.left = `${s.x}px`; b.style.top = `${s.y}px`;
        (b.firstElementChild as HTMLElement).style.width = `${(e.hp / e.maxHp) * 100}%`;
      }
      if (e.elite) {
        seen.add(-e.id);
        let tg = this.tags.get(e.id);
        if (!tg) { tg = h('div', { class: 'nametag elite' }); this.el.overlay.appendChild(tg); this.tags.set(e.id, tg); }
        tg.textContent = g.enemyName(e);
        tg.title = ELITE_AFFIXES.find((a) => a.id === e.elite)?.desc ?? '';
        // two elites side by side: lift the later tag above the earlier one instead of overprinting it
        const hw = tg.textContent.length * 3.4 + 6;
        let y = s.y - 6;
        for (let k = 0; k < 4 && placed.some(([px, py, pw]) => Math.abs(px - s.x) < pw + hw && Math.abs(py - y) < 15); k++) y -= 15;
        placed.push([s.x, y, hw]);
        tg.style.left = `${Math.max(hw, Math.min(innerWidth - hw, s.x))}px`; tg.style.top = `${y}px`; // never cut off at the screen edge
      }
    }
    for (const [id, b] of this.bars) if (!seen.has(id)) { b.remove(); this.bars.delete(id); }
    this.updateNodeBadges();
    for (const [id, tg] of this.tags) if (!seen.has(-id)) { tg.remove(); this.tags.delete(id); }
    // ashore: your health in a fight; aboard: the hull, whenever it's been knocked about
    const hullMax = g.naval.hullMax(), showHull = g.p.onShip && g.naval.hull < hullMax - 0.5;
    const showPlayer = (g.combatTimer < 5 && !g.p.onShip && !g.dead) || showHull;
    this.playerBar.style.display = showPlayer ? '' : 'none';
    this.playerBar.classList.toggle('hull', showHull);
    if (showPlayer) {
      const s = r.project(g.p.x, (g.p.onShip ? 0 : g.world.standY(g.p.x, g.p.z)) + (g.p.onShip ? 4.2 : 2.6), g.p.z);
      this.playerBar.style.left = `${s.x}px`; this.playerBar.style.top = `${s.y}px`;
      (this.playerBar.firstElementChild as HTMLElement).style.width = `${(showHull ? g.naval.hull / hullMax : g.p.hp / g.stats.maxHp) * 100}%`;
    }
    // gathering: a gold bar over your head fills toward the next log, ore or fish
    const ga = g.action?.type === 'gather' ? g.action : null;
    this.gatherBar.style.display = ga && !showPlayer ? '' : 'none';
    if (ga && !showPlayer) {
      const s = r.project(g.p.x, g.world.standY(g.p.x, g.p.z) + 2.6, g.p.z);
      this.gatherBar.style.left = `${s.x}px`; this.gatherBar.style.top = `${s.y}px`;
      (this.gatherBar.firstElementChild as HTMLElement).style.width = `${Math.min(1, ga.progress) * 100}%`;
    }
    // XP and gains float over your head (over the ship when you're aboard)
    { const s = r.project(g.p.x, (g.p.onShip ? 0 : g.world.standY(g.p.x, g.p.z)) + (g.p.onShip ? 5 : 3.1), g.p.z); this.overhead.style.left = `${s.x}px`; this.overhead.style.top = `${s.y}px`; }
    // active skilling: the timing bar under the player, and the call when you tap
    // (gathering: only on the swing that lands an item; gold makes it two, the red heart three)
    const cue0 = g.cueState(), cue = cue0?.live ? cue0 : null;
    this.cueBar.style.display = cue ? '' : 'none';
    if (cue) {
      const s = r.project(g.p.x, g.world.standY(g.p.x, g.p.z) + 2.25, g.p.z);
      this.cueBar.style.left = `${s.x}px`; this.cueBar.style.top = `${s.y}px`;
      const win = this.cueBar.querySelector('b') as HTMLElement, heart = this.cueBar.querySelector('s') as HTMLElement, needle = this.cueBar.querySelector('i') as HTMLElement;
      win.style.left = `${cue.window[0] * 100}%`; win.style.width = `${(cue.window[1] - cue.window[0]) * 100}%`;
      heart.hidden = g.action?.type !== 'gather'; // crafts have no red heart
      heart.style.left = `${cue.red[0] * 100}%`; heart.style.width = `${(cue.red[1] - cue.red[0]) * 100}%`;
      needle.style.left = `${cue.t * 100}%`;
      this.cueBar.dataset.state = cue.struck ?? (cue.t >= cue.window[0] && cue.t <= cue.window[1] ? 'open' : '');
      const s2 = r.project(g.p.x, g.world.standY(g.p.x, g.p.z) + 3.2, g.p.z);
      this.cuePop.style.left = `${s2.x}px`; this.cuePop.style.top = `${s2.y}px`;
    }
    (this.el.ctx as HTMLElement).classList.toggle('cue', !!cue && !cue.struck && cue.t >= cue.window[0] && cue.t <= cue.window[1]);
    if (cue) { // mid-swing the button is the timing tap: say so
      (this.el.ctx.querySelector('span') as HTMLElement).textContent = cue.label ?? 'Tap!';
      const sm = this.el.ctx.querySelector('small') as HTMLElement; sm.textContent = 'on the gold'; sm.classList.remove('no', 'long');
    }
  }

  /** Small badges over nearby skill spots: the skill and level needed, green if you have it, red if not. */
  private badgePool: HTMLElement[] = [];
  private updateNodeBadges() {
    const g = this.game, r = this.r, p = g.p;
    const near: { n: (typeof g.nodes)[number]; d: number }[] = [];
    if (g.s.settings.nodeLevels && !g.dead && g.combatTimer > 3) for (const n of g.nodes) {
      const def = NODES[n.def];
      if (!def.skill || def.level <= 1 || n.depletedUntil > g.time || !!def.fromShip !== p.onShip) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < (p.onShip ? 26 : 13)) near.push({ n, d });
    }
    near.sort((a, b) => a.d - b.d);
    let k = 0;
    for (const { n } of near.slice(0, 10)) {
      const def = NODES[n.def], skill = def.skill as SkillId;
      const s = r.project(n.x, (def.skill === 'fishing' ? 0.4 : g.world.ground(n.x, n.z) + (def.skill === 'woodcutting' ? 3.2 : 1.7)), n.z);
      if (!s.visible) continue;
      let el = this.badgePool[k];
      if (!el) { el = h('div', { class: 'nodebadge' }); this.el.overlay.appendChild(el); this.badgePool.push(el); }
      const ok = g.level(skill) >= def.level, key = `${skill}|${def.level}|${ok}`;
      if (el.dataset.key !== key) { el.dataset.key = key; el.className = `nodebadge ${ok ? 'ok' : 'no'}`; el.innerHTML = `${SKILL_ICONS[skill]}<b>${def.level}</b>`; }
      el.style.display = '';
      el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
      k++;
    }
    for (; k < this.badgePool.length; k++) this.badgePool[k].style.display = 'none';
  }

  showStick(x: number, y: number, kx: number, ky: number) {
    const s = this.el.stick;
    s.hidden = false;
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    (s.firstElementChild as HTMLElement).style.transform = `translate(${kx}px, ${ky}px)`;
  }
  hideStick() { this.el.stick.hidden = true; }

  showHover(x: number, y: number, verb: string | null, label: string, enemy: boolean, needs: { text: string; ok: boolean; detail?: string } | null = null) {
    const hv = this.el.hover;
    if (!verb) { hv.hidden = true; return; }
    hv.hidden = false;
    hv.innerHTML = `<b>${esc(verb)}</b> ${enemy ? `<span style="color:#ffb070">${esc(label)}</span>` : `<em>${esc(label)}</em>`}${needs ? `<div class="needs ${needs.ok ? 'ok' : 'no'}">${esc(needs.text)}</div>${needs.detail ? `<div class="gives">${esc(needs.detail)}</div>` : ''}` : ''}`;
    hv.style.left = `${Math.min(x + 16, window.innerWidth - hv.offsetWidth - 8)}px`;
    hv.style.top = `${y + 18}px`;
  }

  /** Hold-to-inspect on a phone: the same card as hover, but above the finger (which hides what's below it). */
  showInspect(x: number, y: number, verb: string, label: string, enemy: boolean, needs: { text: string; ok: boolean; detail?: string } | null) {
    this.showHover(x, y, verb, label, enemy, needs);
    const hv = this.el.hover;
    hv.style.left = `${Math.max(8, Math.min(x - hv.offsetWidth / 2, window.innerWidth - hv.offsetWidth - 8))}px`;
    hv.style.top = `${Math.max(8, y - hv.offsetHeight - 56)}px`;
  }

  // ------------------------------------------------------------------ tabs
  private renderTab() {
    const c = this.el.content;
    switch (this.tab) {
      case 'pack': morph(c, this.packHtml()); break;
      case 'gear': morph(c, this.gearHtml()); break;
      case 'skills': {
        morph(c, this.skillsHtml());
        if (this.skillView && this.skillScroll) { this.skillScroll = false; c.querySelector('.lvrow.cur')?.scrollIntoView({ block: 'center' }); }
        break;
      }
      case 'quests': morph(c, this.questsHtml()); break;
      case 'map': {
        const chart = this.mapView === 'chart';
        const tabs = (['here', 'chart'] as const).map((id) => `<button data-mapview="${id}" class="${this.mapView === id ? 'on' : ''}">${id === 'here' ? 'Here' : 'Sea chart'}</button>`).join('');
        const title = chart ? 'The Shattered Reef' : this.game.region.name;
        const note = chart ? 'Sail off the dashed lane at a chart\'s edge to cross between islands. Caves are entered on foot.' : 'Gold star: quest objective. Gold !: a new quest. Diamonds: bosses (red) and skilling bosses (orange). Tap the map to walk there.';
        c.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px"><h2 class="title" style="margin:0">${title}</h2><span class="seg maptabs">${tabs}</span></div><canvas id="mapbig" width="600" height="600" aria-label="${chart ? 'Sea chart' : 'Map. Tap to walk there.'}"></canvas><p class="muted" style="font-size:12px;margin:8px 0 0">${note}</p>` + this.utilityRow();
        forget(c); this.bindBigMap(); this.fitBigMap(c); this.drawBigMap(); break;
      }
      case 'settings': morph(c, this.settingsHtml()); break;
    }
    this.scrollButtons();
  }

  /** One set of handlers on the tab panel for its whole life (content is patched, never re-bound). */
  private bindContent(c: HTMLElement) {
    const g = this.game;
    onTap(c, '[data-door], [data-lore], [data-bottle], [data-diary], [data-slot], [data-equip], [data-stance], [data-spell], [data-q], [data-dmg], [data-music], [data-sfx], [data-fps], [data-lv], [data-skill], [data-skillback], [data-gcat], [data-sort], [data-home], [data-mapview], [data-key], [data-devkeys], #saveNow, #resetSave, #calibrate, [data-track]', (t, pointer) => {
      if (t.dataset.home) { g.teleportHome(); return; }
      if (t.dataset.lore) { g.readLore(t.dataset.lore); return; }
      if (t.dataset.bottle) { g.bottles.reread(t.dataset.bottle); return; }
      if (t.dataset.door) { g.readDoor(t.dataset.door); return; }
      if (t.dataset.diary) { g.claimDiary(t.dataset.diary); this.lastRev = -1; return; }
      if (t.dataset.sort) { this.closePop(); g.sortPack(t.dataset.sort as 'type' | 'value' | 'quality'); this.log(`Pack sorted by ${t.dataset.sort}.`); return; }
      if (t.dataset.gcat) { this.guideCat = t.dataset.gcat; this.lastRev = -1; this.renderTab(); return; }
      if (t.dataset.mapview) { this.mapView = t.dataset.mapview as 'here' | 'chart'; this.renderTab(); return; }
      if (t.dataset.slot !== undefined) {
        const i = Number(t.dataset.slot);
        const st = g.p.inv[i];
        if (!st) return;
        const d = item(st.id);
        // mouse: left-click eats/equips directly (RuneScape-style); touch opens the details panel
        if (pointer === 'mouse' && this.bankOpen) { g.deposit(i); return; } // RuneScape: click to deposit
        if (pointer === 'mouse' && !this.shopOpen && (d.heal || d.equip || d.opens || d.chart)) { g.useSlot(i); return; }
        this.openPop({ slot: i }, t);
      } else if (t.dataset.equip !== undefined) { const sl = t.dataset.equip as Slot; if (g.p.equip[sl]) this.openPop({ equip: sl }, t); }
      else if (t.dataset.stance) g.setStance(t.dataset.stance as Stance);
      else if (t.dataset.spell) g.setSpell(t.dataset.spell);
      else if (t.dataset.q) { g.s.settings.quality = t.dataset.q as 'auto' | 'max' | 'low'; this.onQuality(g.s.settings.quality); this.lastRev = -1; }
      else if (t.dataset.fps) { g.s.settings.showFps = t.dataset.fps === '1'; this.lastRev = -1; }
      else if (t.dataset.devkeys) { g.s.settings.devFreeKeys = t.dataset.devkeys === '1'; if (g.s.settings.devFreeKeys && g.s.keyDormant > 0) { g.s.keyDormant = 0; g.recalc(); } this.lastRev = -1; }
      else if (t.dataset.key) { g.slotKey(t.dataset.key); this.lastRev = -1; }
      else if (t.dataset.dmg) { g.s.settings.showDamage = t.dataset.dmg === '1'; this.lastRev = -1; }
      else if (t.dataset.music) { g.s.settings.music = t.dataset.music === '1'; this.onAudio(); this.lastRev = -1; }
      else if (t.dataset.sfx) { g.s.settings.sfx = t.dataset.sfx === '1'; this.onAudio(); this.lastRev = -1; }
      else if (t.dataset.lv !== undefined && t.closest('.toggle')) { g.s.settings.nodeLevels = t.dataset.lv === '1'; this.lastRev = -1; }
      else if (t.dataset.skill) { this.skillView = t.dataset.skill as SkillId; this.guideCat = null; this.skillScroll = true; this.lastRev = -1; }
      else if (t.dataset.skillback !== undefined) { this.skillView = null; this.lastRev = -1; }
      else if (t.id === 'calibrate') this.calibrate();
      else if (t.dataset.track) { g.trackQuest(t.dataset.track); this.lastRev = -1; }
      else if (t.id === 'saveNow') { this.onSave(); this.log('Voyage saved.', 'good'); this.lastRev = -1; }
      else if (t.id === 'resetSave') this.confirm('Erase your progress and start again?', 'Erase and restart', () => this.onReset());
    });
    c.addEventListener('contextmenu', (ev) => {
      const t = ev.target as HTMLElement;
      const slot = t.closest<HTMLElement>('[data-slot]'), eq = t.closest<HTMLElement>('[data-equip]');
      if (slot) { ev.preventDefault(); if (g.p.inv[Number(slot.dataset.slot)]) this.openPop({ slot: Number(slot.dataset.slot) }, slot); }
      else if (eq) { ev.preventDefault(); if (g.p.equip[eq.dataset.equip as Slot]) this.openPop({ equip: eq.dataset.equip as Slot }, eq); }
    });
  }

  private slotHtml(s: Stack | null, attrs: string, label = '', icon = label, closed = false) {
    if (!s) return `<button class="slot empty${closed ? ' closed' : ''}" ${attrs} aria-label="${closed ? `${label}: closed by a two-handed weapon` : `Empty ${label || 'slot'}`}">${label ? `${SLOT_ICONS[icon] ?? ''}<span class="lbl">${label}</span>` : ''}</button>`;
    const rar = s.inst && s.inst.rarity !== 'common';
    const q = item(s.id).stackable && s.qty > 1 ? `<span class="q">${s.qty >= 100000 ? Math.floor(s.qty / 1000) + 'k' : s.qty}</span>` : '';
    const c = condOf(s);
    const condBar = c < 100 ? `<i class="cond${c <= 0 ? ' out' : c <= 20 ? ' low' : ''}" style="--c:${Math.max(4, c)}%"></i>` : '';
    const junk = this.game.isJunk(s.id) && attrs.startsWith('data-slot') ? '<i class="junk" aria-hidden="true"></i>' : '';
    return `<button class="slot${rar ? ' rar' : ''}${junk ? ' isjunk' : ''}" style="--rc:${rarityColour(s)}" ${attrs} aria-label="${esc(displayName(s))}${s.qty > 1 ? ' × ' + s.qty : ''}" title="${esc(displayName(s))}"><img src="${itemIcon(s.id, s.qty)}" alt="">${q}${condBar}${junk}${label ? `<span class="lbl">${label}</span>` : ''}</button>`;
  }

  private packHtml() {
    const g = this.game;
    const coins = count(g.p.inv, 'coins');
    const used = g.p.inv.filter(Boolean).length;
    const sorts = (['type', 'value', 'quality'] as const).map((m) => `<button data-sort="${m}">${cap(m)}</button>`).join('');
    return `<div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="title" style="margin:0">Pack</h2><span class="muted" style="font-size:12px">${used}/${INV_SIZE} · ${fmt(coins)} coins</span></div>
      <div class="row sortrow"><span class="muted">Sort by</span><span class="seg">${sorts}</span></div>
      <div class="grid28 pack">${g.p.inv.map((s, i) => this.slotHtml(s, `data-slot="${i}"`)).join('')}</div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">${matchMedia('(pointer: fine)').matches ? 'Click to use or equip. Right-click for details.' : 'Tap an item for details and actions.'}</p>`;
  }

  private gearHtml() {
    const g = this.game, st = g.stats;
    const twoH = isTwoHanded(g.p.equip.weapon ? item(g.p.equip.weapon.id) : undefined);
    const slots = SLOT_ORDER.map((sl) => this.slotHtml(g.p.equip[sl] ?? null, `data-equip="${sl}"`, SLOT_NAME[sl], sl, sl === 'offhand' && twoH)).join('');
    const stances = this.stanceButtons();
    const spells = st.style === 'magic' ? `<h2 class="title" style="font-size:13px">Spell</h2><div class="stances spells">${this.spellButtons()}</div>` : '';
    const ammo = st.style === 'ranged' ? (g.p.equip.ammo ? `${fmt(g.p.equip.ammo.qty)} × ${esc(item(g.p.equip.ammo.id).name)}` : `<span class="miss">No ${AMMO_NAME[st.needsAmmo ?? 'shot']} equipped</span>`)
      : st.style === 'magic' ? `${fmt(count(g.p.inv, 'charm_tide'))} tide charms (${st.spell?.charms ? `${st.spell.charms} per cast` : 'this spell is free'})` : '';
    const sp = g.specialInfo();
    const rows: [string, string][] = [
      ['Combat level', String(st.combatLevel)], ['Style', cap(st.style)], ['Max hit', st.dual ? `${st.maxHit} + ${st.dual.maxHit} off-hand` : String(st.maxHit)], ['Attack speed', `${st.speed.toFixed(1)}s`],
      ['Accuracy roll', fmt(st.attRoll)], ['Defence vs melee', signed(st.def.melee)], ['Defence vs ranged', signed(st.def.ranged)], ['Defence vs magic', signed(st.def.magic)],
      ['Special', `${sp.name}${sp.block ? ` (${sp.block.toLowerCase()})` : ''}`],
    ];
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    if (st.crit) rows.push(['Max-hit chance', pct(st.crit)]);
    if (st.cleave) rows.push(['Cleave', pct(st.cleave)]);
    if (st.eliteDmg) rows.push(['Vs elites & bosses', `+${pct(st.eliteDmg)}`]);
    if (st.leech) rows.push(['Leech', pct(st.leech)]);
    if (st.gather) rows.push(['Gathering', `+${pct(st.gather)}`]);
    if (st.xpBonus) rows.push(['Skill XP', `+${pct(st.xpBonus)}`]);
    return `<div class="row" style="gap:10px;margin-bottom:6px"><img class="portrait small" alt="" src="${portrait('player', PLAYER_LOOK)}"><div><h2 class="title" style="margin:0">Equipment</h2><span class="muted" style="font-size:12px">Combat level ${st.combatLevel}</span></div></div><div class="equip twelve">${slots}</div>
      ${this.keyringHtml()}
      <h2 class="title" style="font-size:13px">Stance</h2><div class="stances">${stances}</div>${spells}
      ${ammo ? `<p class="muted" style="margin:6px 0;font-size:13px">Ammo: ${ammo}</p>` : ''}
      <div class="brass-rule"></div><div class="stats">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Every enemy is weak to one style: melee beats gunners, ranged beats brigands, magic beats crabs and the Guardian.</p>`;
  }

  /** The keyring: the key in you (and whether it sleeps), every key you've found, and silhouettes of the rest. */
  private keyringHtml() {
    const g = this.game, cur = g.s.key ? KEY[g.s.key] : null, block = g.keySwapBlock();
    const sleep = g.s.keyDormant > 0 ? ` · <span class="miss">sleeps ${Math.ceil(g.s.keyDormant / 60)} more min</span>` : '';
    const rows = KEYS.map((k) => {
      const have = g.s.keyring.includes(k.id), on = g.s.key === k.id;
      if (!have) return `<div class="keyrow unknown"><i class="kicon">${KEY_SVG}</i><div><b>???</b><small class="muted">${k.rarity === 'quest' ? 'Not yet. The end of a story gives this one up.' : `Not found yet. Keys turn up anywhere, most often ${KEY_HINT[k.family]}${k.rarity === 'legendary' ? ', and this one hardly ever' : ''}.`}</small></div></div>`;
      return `<div class="keyrow${on ? ' on' : ''}"><i class="kicon">${KEY_SVG}</i><div><b>${esc(k.name)}</b><small>In you: ${esc(k.passive.text)}</small><small>${esc(k.power.name)} (${k.power.cooldown} s): ${esc(k.power.text)}</small></div>
        ${on ? '<span class="tag">Slotted</span>' : `<button class="btn" data-key="${k.id}" ${block ? `disabled title="${esc(block)}"` : ''}>Slot</button>`}</div>`;
    }).join('');
    return `<h2 class="title" style="font-size:13px">Keyring <span class="muted" style="font-size:12px">${g.s.keyring.length}/${KEYS.length}</span></h2>
      <p class="muted" style="margin:0 0 6px;font-size:12px">${cur ? `In you: <b>${esc(cur.name)}</b>${sleep}` : 'No key in you.'}${block ? ` · ${esc(block)}.` : ''}</p>
      <div class="keyring">${rows}</div>`;
  }

  /** The skill guide (RuneScape's: tap a skill): tabs of what it unlocks, each with its icon and level, locked ones
   * greyed; plus "All levels", every level 1 to 99 with what it brings. */
  private guideCat: string | null = null;
  private skillDetailHtml(id: SkillId) {
    const g = this.game, sk = SKILLS.find((x) => x.id === id)!, cur = g.level(id);
    const list = UNLOCKS[id];
    const ORDER = ['Trees', 'Rocks', 'Fish', 'Hatchets', 'Pickaxes', 'Gear', 'Bars', 'Weapons', 'Bows', 'Crossbows', 'Guns', 'Magic', 'Armour', 'Ammo', 'Tools', 'Dishes', 'Jewellery', 'Spells', 'Foes', 'Other', 'Perks'];
    const cats = [...new Set(list.map((u) => u.cat))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const tab = this.guideCat && (cats.includes(this.guideCat) || this.guideCat === 'All') ? this.guideCat : cats[0] ?? 'All';
    const tabs = [...cats, 'All'].map((c) => `<button data-gcat="${c}" class="${c === tab ? 'on' : ''}">${c === 'All' ? 'All levels' : c}</button>`).join('');
    let body: string;
    if (tab === 'All') {
      const rows: string[] = [];
      for (let L = 1; L <= 99; L++) {
        const at = list.filter((u) => u.level === L);
        const txt = at.length ? at.map((u) => (u.perk ? `<span class="perk">${esc(u.text)}</span>` : esc(u.text))).join('<br>') : `<span class="muted">${L === 1 ? 'Where everyone starts' : esc(LEVEL_GAIN[id])}</span>`;
        rows.push(`<div class="lvrow${L <= cur ? ' got' : ''}${L === cur ? ' cur' : ''}${at.length ? ' has' : ''}" data-lv="${L}"><span class="n">${L}</span><div>${txt}</div></div>`);
      }
      body = `<div class="lvlist">${rows.join('')}</div>`;
    } else {
      const nextLv = list.find((u) => u.cat === tab && u.level > cur)?.level;
      body = `<div class="guide">${list.filter((u) => u.cat === tab).map((u) => {
        const got = u.level <= cur;
        const pic = u.icon ? `<img src="${itemIcon(u.icon)}" alt="">` : `<i class="medal" style="--c:${sk.colour}">${SKILL_ICONS[id]}</i>`;
        return `<div class="gentry${got ? '' : ' lock'}${u.level === nextLv ? ' next' : ''}"><span class="glv">${u.level}</span>${pic}<span class="gtx">${esc(u.text)}</span>${got ? '' : '<b class="glock" aria-label="locked">🔒</b>'}</div>`;
      }).join('')}</div>`;
    }
    return `<div class="row lvhead" style="gap:10px;margin-bottom:8px"><button class="btn small" data-skillback aria-label="Back to all skills">‹ Skills</button>
      <span class="medal" style="--c:${sk.colour}">${SKILL_ICONS[id]}</span><div><h2 class="title" style="margin:0">${sk.name}</h2><span class="muted" style="font-size:12px">Level ${cur} · ${fmt(Math.floor(g.p.xp[id]))} XP${cur < MAX_LEVEL ? ` · ${fmt(Math.ceil(xpForLevel(cur + 1) - g.p.xp[id]))} to ${cur + 1}` : ''}<br>${esc(sk.blurb)}</span></div></div>
      <div class="seg gtabs">${tabs}</div>${body}`;
  }

  private skillsHtml() {
    const g = this.game;
    if (this.skillView) return this.skillDetailHtml(this.skillView);
    // RuneScape's skills panel: a tile per skill, icon and level, a thin XP bar; tap for every level's unlocks
    let total = 0;
    const tiles = SKILLS.map((sk) => {
      const xp = g.p.xp[sk.id], lvl = levelForXp(xp);
      total += lvl;
      const next = lvl >= MAX_LEVEL ? 'maximum level' : `${fmt(Math.ceil(xpForLevel(lvl + 1) - xp))} XP to ${lvl + 1}`;
      return `<button class="sktile" data-skill="${sk.id}" style="--c:${sk.colour}" title="${esc(sk.name)}: ${fmt(Math.floor(xp))} XP, ${next}" aria-label="${esc(sk.name)} level ${lvl}"><span class="ic">${SKILL_ICONS[sk.id]}</span><span class="lv">${lvl}<small>/${Math.max(99, lvl)}</small></span><i style="width:${levelProgress(xp) * 100}%"></i></button>`;
    }).join('');
    return `<h2 class="title" style="margin:0 0 8px">Skills</h2><div class="skgrid">${tiles}<div class="sktile total"><span>Total level</span><b>${total}</b></div><div class="sktile total"><span>Combat</span><b>${g.stats.combatLevel}</b></div></div>
      <p class="muted" style="font-size:12px;margin-top:8px">Tap a skill to see what every level brings.</p>`;
  }

  questObjective(): { x: number; z: number; text: string } | null {
    const g = this.game, L = g.layout;
    if (g.s.region !== 'bellwether') return null; // the bell quest is all on Bellwether
    const stage = g.questStage('bell');
    const iven = L.npcs.find((n) => n.id === 'iven')!;
    if (stage === 0 || stage === 3) return { x: iven.x, z: iven.z, text: 'Iven Marr' };
    if (stage === 1) {
      if (count(g.p.inv, 'bar_bronze') > 0) return { x: iven.x, z: iven.z, text: 'Iven Marr' };
      if (count(g.p.inv, 'ore_copper') > 0 && count(g.p.inv, 'ore_tin') > 0) { const f = L.stations.find((s) => s.id === 'furnace')!; return { x: f.x, z: f.z, text: 'Furnace' }; }
      const rock = L.nodes.find((n) => n.def === (count(g.p.inv, 'ore_copper') ? 'rock_tin' : 'rock_copper'))!;
      return { x: rock.x, z: rock.z, text: 'Copperback Hills' };
    }
    if (stage === 2) { const a = L.arenas.find((x) => x.boss === 'guardian')!; return { x: a.altar.x, z: a.altar.z, text: 'The Broken Ring' }; }
    return null;
  }

  private questsHtml() {
    const g = this.game;
    // the journal: by island, what you're doing first, then what's new, then what's done (one line each)
    const ISLES = [['bellwether', 'Bellwether Isle'], ['sunreach', 'Sunreach Isle'], ['amberhold', 'Amberhold Isle'], ['wrack', 'Stormwrack Isle'], ['lockhaven', 'Lockhaven'], ['saltglass', 'Saltglass'], ['longstrand', 'Longstrand']] as const;
    const qs = ISLES.map(([id, name]) => {
      const list = Object.values(QUESTS).filter((q) => (q.island ?? 'bellwether') === id);
      if (!list.length) return '';
      const rank = (q: (typeof list)[number]) => { const st = g.questStage(q.id); return st >= q.stages.length - 1 ? 2 : st === 0 ? 1 : 0; };
      const done = list.filter((q) => rank(q) === 2).length;
      const rows = [...list].sort((a, b) => rank(a) - rank(b)).map((q) => {
        const st = g.questStage(q.id), r = rank(q);
        if (r === 2) return `<div class="quest done"><b>${esc(q.name)}</b><span class="status done">Complete</span></div>`;
        const status = r === 1 ? '<span class="status todo">New</span>' : '<span class="status active">In progress</span>';
        const pinned = g.trackedQuest() === q.id;
        const track = r === 0 ? `<button class="btn trackbtn${pinned ? ' on' : ''}" data-track="${q.id}">${pinned ? 'Tracking' : 'Track'}</button>` : '';
        return `<div class="quest"><b>${esc(q.name)}</b>${status}<p style="margin:6px 0">${esc(q.stages[st].text)}</p><small class="muted">Reward: ${esc(q.reward)}</small>${track}</div>`;
      }).join('');
      return `<h3 class="title" style="font-size:14px;margin:12px 0 6px">${esc(name)} <small class="muted">${done}/${list.length} done</small></h3>${rows}`;
    }).join('');
    // grouped by region; foes and resources are listed for regions loaded this session (each is built on first visit)
    const disc = Object.values(REGIONS).map((r) => {
      const here = PLACES.filter((p) => placeRegion(p) === r.id);
      const found = here.filter((p) => g.s.discovered.includes(p.id));
      if (!found.length) return '';
      const items = here.map((p) => {
        if (!g.s.discovered.includes(p.id)) return '<li class="muted">Undiscovered</li>';
        const info = g.placeInfo(p.id);
        if (!info) return `<li><b>${esc(p.name)}</b></li>`;
        const foes = info.foes ? `<span class="miss">Foes ${info.foes[0]}${info.foes[1] > info.foes[0] ? `–${info.foes[1]}` : ''}</span>` : '<span class="muted">Peaceful</span>';
        const gather = info.gather.map((n) => `${esc(n.name)} ${n.level}`).join(', ');
        return `<li><b>${esc(p.name)}</b> · ${foes}${gather ? `<br><small class="muted">${gather}</small>` : ''}</li>`;
      }).join('');
      return `<h3 class="title" style="font-size:14px;margin:10px 0 4px">${esc(r.name)} <small class="muted">${found.length}/${here.length}</small></h3><ul style="margin:0;padding-left:18px">${items}</ul>`;
    }).join('');
    const contracts = g.s.contracts.map((c) => `<li>${c.kind === 'wanted' ? `<b>Wanted: ${esc(c.name!)}</b> near ${esc(g.placeNear(c.region!, c.x!, c.z!))}` : `<b>${c.have}/${c.need}</b> ${esc(ENEMIES[c.enemy].name.toLowerCase())}s`}</li>`).join('');
    const crew = g.s.crew.length ? `<small class="muted">Crew: ${g.s.crew.map((id) => esc(CREW.find((c) => c.id === id)!.name)).join(', ')}</small>` : '';
    const poster = `<div class="poster"><span>WANTED</span><b>${g.s.bounty.toLocaleString('en-GB')}</b><small>${esc(rankOf(g.s.bounty))}</small></div>
      ${contracts ? `<ul style="margin:6px 0;padding-left:18px">${contracts}</ul>` : '<p class="muted" style="font-size:12px">The harbourmasters post bounty contracts on their boards.</p>'}${crew}`;
    // island diaries: what's left on each island, and the reward once it's all done
    const diaries = DIARIES.map((d) => {
      const done = d.tasks.filter((t) => t.done(g)).length, all = done === d.tasks.length, claimed = !!g.s.flags[`diary_${d.island}`];
      const head = `<b>${esc(d.name)}</b>${claimed ? '<span class="status done">Complete</span>' : `<span class="status ${all ? 'active' : 'todo'}">${done}/${d.tasks.length}</span>`}`;
      if (claimed) return `<div class="quest done">${head}</div>`;
      const list = d.tasks.map((t) => `<li class="${t.done(g) ? 'diary-done' : ''}">${t.done(g) ? '✓ ' : ''}${esc(t.text)}</li>`).join('');
      const reward = `${d.coins.toLocaleString('en-GB')} coins, ${d.xp.map((x) => `${x.amount.toLocaleString('en-GB')} ${x.skill[0].toUpperCase() + x.skill.slice(1)}`).join(', ')} XP, free ferries from ${esc(REGIONS[d.island].name)}`;
      return `<div class="quest">${head}<ul class="diary">${list}</ul><small class="muted">Reward: ${reward}</small>${all ? `<button class="btn primary" data-diary="${d.island}" style="margin-top:6px;width:100%">Claim reward</button>` : ''}</div>`;
    }).join('');
    // Keel's Log and the Varrow's fragments: what you've found, in Keel's order; tap one to read it again
    const found = LORE.filter((l) => g.s.flags[`lore_${l.id}`]);
    const keelFound = found.filter((l) => l.set === 'keel').length;
    const order = (l: (typeof LORE)[number]) => (l.set === 'keel' ? 0 : 1) * 100 + LORE.indexOf(l);
    const loreRows = [...found].sort((a, b) => order(a) - order(b)).map((l) => `<button class="lore-row" data-lore="${l.id}"><b>${esc(l.title)}</b><small>${esc(REGIONS[l.region].name)}</small></button>`).join('')
      // the Wardwright vaults you've opened: each House's last record
      + DOORS.filter((d) => g.s.flags[`door_${d.id}`]).map((d) => `<button class="lore-row" data-door="${d.id}"><b>${esc(d.record.title)}</b><small>${esc(REGIONS[d.region].name)}</small></button>`).join('');
    const vaults = DOORS.filter((d) => g.s.flags[`door_${d.id}`]).length;
    const bottlesRead = g.s.bottles ?? [];
    const bottleRows = bottlesRead.map((id) => BOTTLE_BY[id]).filter(Boolean).map((b) => `<button class="lore-row" data-bottle="${b.id}"><b>${esc(b.title)}</b><small>A message in a bottle</small></button>`).join('');
    const lore = `<p class="muted" style="font-size:12px;margin:0 0 6px">${keelFound} of ${KEEL_PAGES} pages of Keel's Log found${found.length > keelFound ? `, and ${found.length - keelFound} fragment${found.length - keelFound > 1 ? 's' : ''} of the Varrow` : ''}. Pages turn up on every island, wedged and weighted where the sea left them. ${vaults} of ${DOORS.length} Wardwright vaults opened.</p>${loreRows}<p class="muted" style="font-size:12px;margin:8px 0 6px">Messages in bottles: ${bottlesRead.length} of ${BOTTLES.length}. They bob past your bow out at sea.</p>${bottleRows}`;
    // the Tides: every harbour has their posters; what they want, you learn by meeting them
    const tides = TIDES.map((t) => {
      const st = t.status(g.s.flags, g.s.quests);
      const tag = st === 'enemy' ? '<span class="status todo">Remembers you</span>' : st === 'crew' ? '<span class="status done">In your crew</span>' : st === 'friend' ? '<span class="status done">Owes you</span>' : st === 'beaten' ? '<span class="status done">Beaten</span>' : st === 'met' ? '<span class="status active">Met</span>' : '<span class="status todo">Wanted</span>';
      const known = st !== 'poster';
      return `<div class="quest tide"><b>${esc(t.name)}</b> <small class="muted">${esc(t.epithet)}</small>${tag}<p style="margin:4px 0;font-size:12.5px"><b>${t.bounty ? t.bounty.toLocaleString('en-GB') : '—'}</b> · the ${esc(t.ship)}</p><small class="muted">${esc(known && t.dream ? t.dream : t.rumour)}</small></div>`;
    }).join('');
    // feats: each arena boss's harder ways to win, and what the points have earned
    const done = new Set(g.s.feats ?? []), pts = g.featPoints();
    const featRows = [...new Set(FEATS.map((f) => f.boss))].map((boss) => {
      const list = FEATS.filter((f) => f.boss === boss), kills = g.s.bossKills?.[boss] ?? 0;
      return `<div class="quest"><b>${esc(ENEMIES[boss]?.name ?? boss)}</b> <small class="muted">beaten ${kills}×</small><ul class="diary">${list.map((f) => `<li class="${done.has(f.id) ? 'done' : ''}">${done.has(f.id) ? '✓' : '○'} <b>${esc(f.name)}</b> (${f.pts}) <small class="muted">${esc(f.text)}</small></li>`).join('')}</ul></div>`;
    }).join('');
    const tierRows = FEAT_TIERS.map((t) => `<li class="${pts >= t.pts ? 'done' : ''}">${pts >= t.pts ? '✓' : '○'} <b>${t.pts} points: ${esc(t.name)}</b> <small class="muted">${esc(t.text)}</small></li>`).join('');
    // the collection log: every source's notable drops, ticked off the first time they land in your pack
    const got = new Set(g.s.collected ?? []), groups = collectionGroups();
    const total = groups.reduce((a, gr) => a + gr.items.length, 0), have = groups.reduce((a, gr) => a + gr.items.filter((i) => got.has(i)).length, 0);
    const colRows = groups.map((gr) => {
      const n = gr.items.filter((i) => got.has(i)).length;
      return `<details class="col-group"><summary><b>${esc(gr.name)}</b> <small class="muted">${n}/${gr.items.length}</small></summary><div class="col-items">${gr.items.map((i) => `<span class="col-item ${got.has(i) ? 'got' : ''}" title="${esc(item(i).name)}">${this.slotHtml({ id: i, qty: 1 }, 'disabled tabindex="-1"')}</span>`).join('')}</div></details>`;
    }).join('');
    const collection = `<p class="muted" style="font-size:12px;margin:0 0 6px">${have} of ${total} found. Everything worth keeping that each foe, chest and casket can give you.</p>${colRows}`;
    const feats = `<p class="muted" style="font-size:12px;margin:0 0 6px">${pts} of ${FEATS.reduce((a, f) => a + f.pts, 0)} points. Harder ways to beat the arena bosses; points earn lasting edges.</p><ul class="diary">${tierRows}</ul>${featRows}`;
    // the captain's record: the whole game at a glance
    const allQ = Object.values(QUESTS), doneQ = allQ.filter((q) => g.questStage(q.id) >= q.stages.length - 1).length;
    const totalLv = SKILLS.reduce((a, k) => a + g.level(k.id), 0);
    const locks = ['firstlock_opened', 'fen_opened', 'thirdlock_opened', 'mirror_opened'].filter((f) => g.s.flags[f]).length;
    const tidesKnown = TIDES.filter((t) => t.status(g.s.flags, g.s.quests) !== 'poster').length;
    const colTotal = collectionGroups().reduce((a, gr) => a + gr.items.length, 0);
    const rec: [string, string][] = [
      ['Total level', `${totalLv}`], ['Quests', `${doneQ}/${allQ.length}`], ['Locks opened', `${locks}/13`], ['Tides known', `${tidesKnown}/${TIDES.length}`],
      ['Feat points', `${g.featPoints()}`], ['Collection', `${(g.s.collected ?? []).length}/${colTotal}`], ['Bells answered', `${g.s.bellsRung ?? 0}`],
      ['Bottles', `${(g.s.bottles ?? []).length}/${BOTTLES.length}`], ['Places', `${g.s.discovered.length}/${PLACES.length}`], ['Bounty', g.s.bounty.toLocaleString('en-GB')],
    ];
    const record = `<div class="record-grid">${rec.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
    return `<h2 class="title">Captain's record</h2>${record}<div class="brass-rule"></div><h2 class="title">Quests</h2>${qs}<div class="brass-rule"></div><h2 class="title">The Tides</h2>${tides}<div class="brass-rule"></div><h2 class="title">Feats</h2>${feats}<div class="brass-rule"></div><h2 class="title">Collection log</h2>${collection}<div class="brass-rule"></div><h2 class="title">Keel's Log</h2>${lore}<div class="brass-rule"></div><h2 class="title">Island diaries</h2>${diaries}<div class="brass-rule"></div><h2 class="title">Your bounty</h2>${poster}<div class="brass-rule"></div><h2 class="title">Places (${g.s.discovered.length}/${PLACES.length})</h2>${disc}`;
  }

  private settingsHtml() {
    const s = this.game.s.settings;
    const ago = this.lastSaved ? `${Math.round((Date.now() - this.lastSaved) / 1000)}s ago` : 'not yet';
    const fine = matchMedia('(pointer: fine)').matches;
    return `<h2 class="title">Settings</h2>
      <div class="toggle"><span>Graphics<br><small class="muted">${s.quality === 'auto' ? 'Lowers detail on its own if your phone struggles' : s.quality === 'max' ? 'Full detail always, even if frames drop' : '30 fps, no shadows: longest battery'}</small></span><span class="seg"><button data-q="auto" class="${s.quality === 'auto' ? 'on' : ''}">Auto</button><button data-q="max" class="${s.quality === 'max' ? 'on' : ''}">Max</button><button data-q="low" class="${s.quality === 'low' ? 'on' : ''}">Saver</button></span></div>
      <div class="toggle"><span>Show frame rate</span><span class="seg"><button data-fps="1" class="${s.showFps ? 'on' : ''}">On</button><button data-fps="0" class="${!s.showFps ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Developer: free key swaps<small class="muted" style="display:block;font-size:11px">A new key wakes at once instead of after 30 minutes</small></span><span class="seg"><button data-devkeys="1" class="${s.devFreeKeys ? 'on' : ''}">On</button><button data-devkeys="0" class="${!s.devFreeKeys ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Damage numbers</span><span class="seg"><button data-dmg="1" class="${s.showDamage ? 'on' : ''}">On</button><button data-dmg="0" class="${!s.showDamage ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Level badges on skill spots</span><span class="seg"><button data-lv="1" class="${s.nodeLevels ? 'on' : ''}">On</button><button data-lv="0" class="${!s.nodeLevels ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Music</span><span class="seg"><button data-music="1" class="${s.music ? 'on' : ''}">On</button><button data-music="0" class="${!s.music ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Sound effects</span><span class="seg"><button data-sfx="1" class="${s.sfx ? 'on' : ''}">On</button><button data-sfx="0" class="${!s.sfx ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Recalibrate touch<br><small class="muted">If taps land away from your finger: tap three marks to line them up (${this.portrait ? 'portrait' : 'landscape'}${this.touchOffset().some((v) => v) ? ', adjusted' : ''})</small></span><button class="btn" id="calibrate">Calibrate</button></div>
      <div class="toggle"><span>Progress saves automatically<br><small class="muted">Last saved ${ago}</small></span><button class="btn" id="saveNow">Save now</button></div>
      <div class="toggle"><span>Start a new voyage<br><small class="muted">Erases this browser's save</small></span><button class="btn" id="resetSave">Reset</button></div>
      <div class="brass-rule"></div><h2 class="title">Controls</h2>
      ${fine ? `<p>Click to walk, click things to use them. <kbd>WASD</kbd> also moves.<br><kbd>E</kbd> interact · <kbd>Space</kbd> dodge roll · <kbd>R</kbd> special attack · <kbd>I</kbd> <kbd>G</kbd> <kbd>K</kbd> <kbd>J</kbd> <kbd>M</kbd> tabs · <kbd>Esc</kbd> close · scroll to zoom.</p>`
        : '<p>Drag anywhere on the world to move. Tap things to walk to them and use them. The big round button does the nearest action; the two smaller ones are dodge roll and the special attack for your weapon. Pinch to zoom.</p>'}
      <p class="muted" style="font-size:11px">Music: traditional tunes (Greensleeves, Drowsy Maggie, Drunken Sailor) and an original air, played on the FluidR3 GM soundfont by Frank Wen (CC BY 3.0).</p>
      <p class="muted" style="font-size:12px">Your cutlass swings automatically at anything in reach. Pick a stance in Equipment to choose which skill you train. Roll through red markers to take no damage.</p>`;
  }

  // ------------------------------------------------------------------ item interactions
  private openPop(target: { slot?: number; equip?: Slot }, anchor: HTMLElement) {
    this.pop = target;
    let el = document.getElementById('itempop');
    if (!el) { el = h('div', { id: 'itempop', class: 'panel', role: 'dialog' }); document.body.appendChild(el); this.bindPop(el); }
    this.renderPop();
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, ht = el.offsetHeight;
    let x = r.left - w - 8, y = r.top;
    if (x < 8) x = Math.min(window.innerWidth - w - 8, r.right + 8);
    if (this.portrait) { x = (window.innerWidth - w) / 2; y = r.top - ht - 10; }
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, Math.min(window.innerHeight - ht - 8, y))}px`;
  }

  private renderPop() {
    const el = document.getElementById('itempop');
    if (!el || !this.pop) return;
    const g = this.game;
    const st = this.pop.slot !== undefined ? g.p.inv[this.pop.slot] : g.p.equip[this.pop.equip!];
    if (!st) { this.closePop(); return; }
    const d = item(st.id);
    const rar = st.inst ? RARITY[st.inst.rarity] : null;
    const e = d.equip;
    const lines: string[] = [];
    if (e) {
      const b = e.bonus;
      if (e.style) lines.push(`${cap(e.style)} weapon · ${e.speed}s${e.range ? ` · range ${e.range}m` : ''}`);
      const parts: string[] = [];
      if (b.acc) parts.push(`Accuracy ${signed(b.acc)}`);
      if (b.str) parts.push(`Strength ${signed(b.str)}`);
      if (b.rangedStr) parts.push(`Ranged strength ${signed(b.rangedStr)}`);
      if (b.magicDmg) parts.push(`Magic damage +${b.magicDmg}%`);
      if (b.defMelee || b.defRanged || b.defMagic) parts.push(`Defence ${signed(b.defMelee ?? 0)} / ${signed(b.defRanged ?? 0)} / ${signed(b.defMagic ?? 0)} (melee / ranged / magic)`);
      lines.push(...parts);
      const reqs = Object.entries(e.reqs).filter(([, v]) => (v ?? 0) > 1).map(([k, v]) => `${cap(k)} ${v}`);
      if (reqs.length) lines.push(`Requires ${reqs.join(', ')}`);
    }
    if (d.sig) lines.push(`Signature: ${d.sig.text}`);
        if (wears(st.id)) { const c = condOf(st); lines.push(c <= 0 ? `Condition: worn out (works at ${Math.round(WORN_OUT_EFFECT * 100)}%). Repair at an anvil.` : `Condition ${Math.round(c)}%`); }
    if (d.heal) lines.push(`Heals ${this.game.healOf(d.id)}`);
    if (d.meal) lines.push(`Galley meal: ${MEAL_TEXT[d.meal.kind](d.meal.v)} for ${Math.round(d.meal.secs / 60)} min (one meal at a time)`);
    if (d.tool) lines.push(`${cap(d.tool.skill)} tool, power ${d.tool.power}${d.tool.level > 1 ? `, needs level ${d.tool.level}` : ''}`);
    // the metal's signature trait first (every copy has it), then the rolled affixes
    const metal = METALS.find((mt) => st.id.endsWith(`_${mt.key}`)), trait = metal && METAL_TRAITS[metal.key];
    const innate = (d.innate ?? []).map((a) => `<li class="trait">${esc(AFFIXES[a.id].fmt(a.v))}</li>`).join('');
    const affixes = (trait && innate ? `<li class="trait-name">${esc(trait.blurb)}</li>` : '') + innate + (st.inst?.affixes ?? []).map((a) => `<li>${esc(AFFIXES[a.id].fmt(a.v))}</li>`).join('');
    const acts: string[] = [];
    if (this.pop.equip) acts.push('<button class="btn" data-a="unequip">Unequip</button>');
    else {
      if (d.heal) acts.push('<button class="btn primary" data-a="use">Eat</button>');
      if (d.opens) acts.push(`<button class="btn primary" data-a="use">${OPEN_VERB[st.id] ?? 'Open'}</button>`);
      if (d.chart) acts.push('<button class="btn primary" data-a="use">Read</button>');
      if (d.turn) acts.push('<button class="btn primary" data-a="use">Turn</button>');
      if (!d.quest && st.id !== 'coins' && g.level('magic') >= UTILITY_SPELLS.alchemy.level && !this.shopOpen && !this.bankOpen) {
        const coins = Math.max(1, Math.floor(stackValue({ ...st, qty: 1 }) * UTILITY_SPELLS.alchemy.rate)), blk = g.utilityBlock('alchemy');
        acts.push(`<button class="btn" data-a="alch" ${blk ? `disabled title="${esc(blk)}"` : ''}>Alchemise ${coins}c</button>`);
      }
      if (e) acts.push(`<button class="btn primary" data-a="use" ${g.equipBlock(st) ? 'disabled' : ''}>${e.slot === 'offhand' ? 'Equip off-hand' : 'Equip'}</button>`);
      // a one-handed weapon can also go in the off-hand beside a matching one
      if (e && pairGroup(d) && g.p.equip.weapon && !g.offhandOk(st) && !g.equipBlock(st)) acts.push('<button class="btn" data-a="offhand">Off-hand</button>');
      if (this.shopOpen && !d.quest && st.id !== 'coins') {
        const each = g.sellPrice({ ...st, qty: 1 });
        acts.push(`<button class="btn" data-a="sell1">Sell 1 (${each}c)</button>`);
        if (st.qty > 1) acts.push(`<button class="btn" data-a="sellall">Sell all (${each * st.qty}c)</button>`);
      }
      if (this.bankOpen) acts.unshift('<button class="btn primary" data-a="deposit">Deposit</button>');
      if (!d.quest) acts.push('<button class="btn" data-a="drop">Drop</button>');
      if (!d.quest && st.id !== 'coins') acts.push(`<button class="btn" data-a="junk">${g.isJunk(st.id) ? 'Not junk' : 'Mark junk'}</button>`);
    }
    const req = e && g.equipBlock(st);
    morph(el, `<button class="x" aria-label="Close" style="position:absolute;right:6px;top:6px;width:34px;height:34px;border-radius:8px;background:#2a1e14;border:1px solid #120b06">×</button>
      <div class="nm" style="color:${rar ? rar.color : '#efe3c4'};padding-right:36px">${esc(displayName(st))}${st.qty > 1 ? ` × ${fmt(st.qty)}` : ''}</div>
      ${rar ? `<div class="rl" style="color:${rar.color}">${rar.label}${e ? ` ${slotLabel(d)}` : ''}</div>` : e ? `<div class="rl muted">${slotLabel(d)}</div>` : ''}
      <div class="muted" style="font-size:13px">${esc(d.desc)}</div>
      ${lines.length ? `<div style="font-size:13px;margin-top:6px">${lines.map(esc).join('<br>')}</div>` : ''}
      ${affixes ? `<ul>${affixes}</ul>` : ''}
      ${req ? `<div class="req">${esc(req)}</div>` : ''}
      <div class="acts">${acts.join('')}</div>`);
  }

  private bindPop(el: HTMLElement) {
    const g = this.game;
    onTap(el, '.x, [data-a]', (b) => {
      if (b.classList.contains('x')) { this.closePop(); return; }
      if (!this.pop) return;
      const a = b.dataset.a, i = this.pop.slot;
      if (a === 'unequip') { g.unequip(this.pop.equip!); this.closePop(); return; }
      if (i === undefined) return;
      if (a === 'use') { g.useSlot(i); if (!g.p.inv[i] || item(g.p.inv[i]!.id).equip) this.closePop(); }
      if (a === 'offhand') { g.equip(i, true); this.closePop(); }
      if (a === 'drop') { g.dropSlot(i); this.closePop(); }
      if (a === 'junk') { g.toggleJunk(g.p.inv[i]!.id); this.renderPop(); this.lastRev = -1; }
      if (a === 'alch') { g.alchemy(i); if (!g.p.inv[i]) this.closePop(); else this.renderPop(); }
      if (a === 'deposit') { g.deposit(i); this.closePop(); }
      if (a === 'sell1') g.sell(i, false);
      if (a === 'sellall') { g.sell(i, true); this.closePop(); }
    });
  }

  closePop() {
    this.pop = null;
    document.getElementById('itempop')?.remove();
  }

  // ------------------------------------------------------------------ windows
  private win(id: string, title: string, bodyHtml: string): HTMLElement {
    let el = document.getElementById(id);
    if (!el) {
      el = h('div', { id, class: 'win panel', role: 'dialog', 'aria-label': title });
      document.body.appendChild(el);
      const g = this.game;
      onTap(el, '.x, [data-r], [data-buy], [data-c], [data-wd], [data-dep], [data-rep], [data-sell], [data-shoptab], [data-sskill], [data-btab], [data-take], [data-drop-c], [data-recruit], [data-mate], [data-ferry], [data-refit]', (b) => {
        if (b.classList.contains('x')) { this.closeWindows(); return; }
        if (b.dataset.btab) { this.boardTab = b.dataset.btab as 'bounties' | 'crew' | 'passage' | 'shipyard'; this.renderBoard(); return; }
        if (b.dataset.take && this.boardOpen) { g.acceptContract(this.boardOpen, Number(b.dataset.take)); return; }
        if (b.dataset.dropC) { g.abandonContract(Number(b.dataset.dropC)); return; }
        if (b.dataset.recruit) { g.recruit(b.dataset.recruit); return; }
        if (b.dataset.refit) { g.refit(b.dataset.refit as ShipPart); this.renderBoard(); return; }
        if (b.dataset.mate !== undefined) { g.setMate(b.dataset.mate || null); return; }
        if (b.dataset.ferry) { const [n, to] = b.dataset.ferry.split(':'); this.closeWindows(); g.takeFerry(n, to); return; }
        if (b.dataset.sskill && this.station) { this.stationSkill[this.station] = b.dataset.sskill; this.renderStation(); return; }
        if (b.dataset.shoptab) { this.shopTab = b.dataset.shoptab as 'buy' | 'sell'; this.renderShop(); return; }
        if (b.dataset.sell) { const [i, n] = b.dataset.sell.split(':'); g.sell(Number(i), n === 'all'); this.renderShop(); return; }
        if (b.dataset.rep) { const i = b.dataset.rep.lastIndexOf(':'); g.repair(b.dataset.rep.slice(0, i), b.dataset.rep.slice(i + 1) === 'self'); this.lastRev = -1; return; }
        if (b.dataset.wd) { const [idx, n] = b.dataset.wd.split(':').map(Number); g.withdraw(idx, n); return; }
        if (b.dataset.dep) { g.deposit('all'); return; }
        if (b.dataset.r) { g.craft(b.dataset.r, Number(b.dataset.n)); this.lastRev = -1; }
        else if (b.dataset.buy) g.buy(b.dataset.buy);
        else if (b.dataset.c) { const ok = this.confirmOk; this.confirmOk = null; el!.remove(); if (b.dataset.c === 'yes') ok?.(); }
      });
    }
    morph(el, `<button class="x" aria-label="Close">×</button><h2 class="title" style="padding-right:44px">${esc(title)}</h2><div class="body">${bodyHtml}</div>`);
    return el;
  }

  closeWindows() {
    this.station = null;
    this.boardOpen = null;
    document.getElementById('boardwin')?.remove();
    this.shopOpen = false;
    this.bankOpen = false;
    document.getElementById('bankwin')?.remove();
    document.getElementById('stationwin')?.remove();
    document.getElementById('shopwin')?.remove();
    document.getElementById('confirm')?.remove();
    this.closePop();
    this.lastRev = -1;
  }

  anyWindowOpen() { return !!(this.station || this.shopOpen || this.bankOpen || this.boardOpen || this.dialog || document.getElementById('confirm')); }

  // ------------------------------------------------------------------ the harbour board: bounties, crew, passage
  private boardOpen: string | null = null;
  private boardTab: 'bounties' | 'crew' | 'passage' | 'shipyard' = 'bounties';
  private nearBoard() {
    const b = this.boardOpen && BOARDS[this.boardOpen], n = b && this.game.layout.npcs.find((x) => x.id === b.npc);
    return !!n && !this.game.p.onShip && Math.hypot(n.x - this.game.p.x, n.z - this.game.p.z) < 6;
  }
  private openBoard(board: string) {
    this.closeWindows();
    this.boardOpen = board;
    this.renderBoard();
  }
  /** One contract as a row: what, how far along, what it pays, and its button. */
  private contractHtml(c: Contract, btn: string) {
    const e = ENEMIES[c.enemy];
    const what = c.kind === 'wanted' ? `<b>WANTED: ${esc(c.name!)}</b><small>A ${esc(e.name.toLowerCase())} (level ${e.level}, tougher than most). Last seen near ${esc(this.game.placeNear(c.region!, c.x!, c.z!))}.</small>`
      : `<b>Hunt ${c.need} ${esc(e.name.toLowerCase())}s</b><small>Level ${e.level}${c.have ? ` · ${c.have}/${c.need} done` : ''}</small>`;
    return `<div class="recipe brow"><div>${what}<div class="need">${c.coins.toLocaleString('en-GB')} coins · +${c.bounty.toLocaleString('en-GB')} bounty</div></div><div class="btns">${btn}</div></div>`;
  }
  private renderBoard() {
    const g = this.game, board = this.boardOpen!, B = BOARDS[board], tab = this.boardTab;
    const tabs = `<div class="seg shoptabs" style="margin-bottom:8px">${(['bounties', 'crew', 'shipyard', 'passage'] as const).map((t) => `<button data-btab="${t}" class="${t === tab ? 'on' : ''}">${cap(t)}</button>`).join('')}</div>`;
    const poster = `<div class="poster"><span>WANTED</span><b>${g.s.bounty.toLocaleString('en-GB')}</b><small>${esc(rankOf(g.s.bounty))}${g.s.bounty >= BOUNTY_CONFIG.hunterFrom ? ' · hunters are after you' : ''}</small></div>`;
    let body = '';
    if (tab === 'bounties') {
      const mine = g.s.contracts.map((c) => this.contractHtml(c, `<button class="btn" data-drop-c="${c.id}">Abandon</button>`)).join('');
      const full = g.s.contracts.length >= BOUNTY_CONFIG.maxActive;
      const offers = g.boardOffers(board).map((c) => this.contractHtml(c, `<button class="btn primary" data-take="${c.id}" ${full ? 'disabled title="You carry the most you can"' : ''}>Take</button>`)).join('');
      body = `${poster}<h3 class="title" style="font-size:13px">Your contracts (${g.s.contracts.length}/${BOUNTY_CONFIG.maxActive})</h3>${mine || '<p class="muted">None yet. Take one below.</p>'}
        <h3 class="title" style="font-size:13px">On the board</h3>${offers || '<p class="muted">Nothing posted. Come back later.</p>'}<p class="muted" style="font-size:12px">New contracts are posted every ${BOUNTY_CONFIG.refreshS / 60} minutes. Contracts pay out the moment they're done.</p>`;
    } else if (tab === 'crew') {
      const rows = CREW.filter((c) => !c.quest || g.s.crew.includes(c.id)).map((c) => {
        const signed = g.s.crew.includes(c.id), mate = g.s.mate === c.id, block = g.recruitBlock(c.id);
        const btn = signed ? (mate ? '<span class="tag">First mate</span>' : `<button class="btn" data-mate="${c.id}">Bring ashore</button>`)
          : `<button class="btn primary" data-recruit="${c.id}" ${block ? `disabled title="${esc(block)}"` : ''}>Sign (${c.coins.toLocaleString('en-GB')}c)</button>`;
        return `<div class="recipe brow"><div><b>${esc(c.name)}</b> <small class="muted">${esc(c.role)}</small><small>"${esc(c.line)}"</small><div class="need">${esc(c.passive.text)} · ashore: fights with ${c.mate.style}${signed || block || !c.bounty ? '' : ` · wants a bounty of ${c.bounty.toLocaleString('en-GB')}`}</div>${!signed && block ? `<div class="need miss">${esc(block)}</div>` : ''}</div><div class="btns">${btn}</div></div>`;
      }).join('');
      body = `${poster}<p class="muted" style="font-size:12px;margin:0 0 6px">Everyone you sign gives their bonus from aboard. Your first mate comes ashore and fights beside you.${g.s.mate ? ' <button class="btn" data-mate="">Leave everyone aboard</button>' : ''}</p>${rows}`;
    } else if (tab === 'shipyard') {
      // the shipwright: refit each part of your ship, five times over (data/shipyard.ts)
      const rows = SHIP_PARTS.map((part) => {
        const def = SHIPYARD[part], t = g.shipTier(part), next = def.tiers[t], block = g.refitBlock(part);
        const now = t ? `${esc(def.tiers[t - 1].name)} (+${def.tiers[t - 1].v}%)` : 'as built';
        const need = next ? `${next.coins.toLocaleString('en-GB')} coins, ${next.items.map((i) => `<span class="${count(g.p.inv, i.id) >= i.qty ? '' : 'miss'}">${i.qty} × ${esc(item(i.id).name)}</span>`).join(', ')} · Sailing ${next.sailing}` : '';
        const btn = next ? `<button class="btn primary" data-refit="${part}" ${block ? `disabled title="${esc(block)}"` : ''}>Refit</button>` : '<span class="tag">Finest afloat</span>';
        return `<div class="recipe brow"><div><b>${esc(def.name)}</b> <small class="muted">${now} · ${t}/${def.tiers.length}</small>${next ? `<small>Next: ${esc(next.name)}, +${next.v}% (${esc(def.what)})</small><div class="need">${need}</div>${block ? `<div class="need miss">${esc(block)}</div>` : ''}` : `<small>${esc(def.what)}</small>`}</div><div class="btns">${btn}</div></div>`;
      }).join('');
      body = `<p class="muted" style="font-size:12px;margin:0 0 6px">The shipwrights refit your sloop with what you bring them. A refit is for good.</p>${rows}`;
    } else {
      const npc = NPCS[B.npc], f = npc.ferry;
      body = f ? `<p>${esc(npc.idle[0])}</p>${f.filter((r) => { const gt = REGIONS[r.to].gate; return !gt || g.s.flags[gt.flag]; }).map((r) => `<div class="recipe brow"><div><b>${esc(REGIONS[r.to].name)}</b><div class="need">levels ${REGIONS[r.to].band?.join('–') ?? '?'}</div></div><div class="btns"><button class="btn primary" data-ferry="${B.npc}:${r.to}">Sail (${r.price} coins)</button></div></div>`).join('')}` : '<p class="muted">No passage from here.</p>';
    }
    this.win('boardwin', `${NPCS[B.npc].name}'s board`, tabs + body);
  }

  /** the skill tab last chosen at each station */
  private stationSkill: Partial<Record<Station, string>> = {};
  private openStation(st: Station) {
    this.closeWindows();
    this.station = st;
    this.renderStation();
  }

  private renderStation() {
    const g = this.game, st = this.station!;
    const title = st === 'furnace' ? 'Furnace: smelt and cast' : st === 'anvil' ? 'Anvil: forge' : st === 'bench' ? 'Workbench' : st === 'vent' ? 'Vent forge' : 'Cookfire: cook';
    // a station that serves several skills (the workbench: gunsmithing, fletching, crafting) gets a tab per skill
    const skills = [...new Set(RECIPES.filter((r) => r.station === st).map((r) => r.skill))];
    const pick = skills.includes(this.stationSkill[st] as SkillId) ? this.stationSkill[st]! : skills[0];
    const tabs = skills.length > 1 ? `<div class="seg shoptabs" style="margin-bottom:8px">${skills.map((k) => `<button data-sskill="${k}" class="${k === pick ? 'on' : ''}">${cap(k)}</button>`).join('')}</div>` : '';
    const rows = RECIPES.filter((r) => r.station === st && r.skill === pick).map((r) => {
      const block = g.recipeBlock(r);
      const max = Math.min(...r.inputs.map((i) => Math.floor(count(g.p.inv, i.id) / i.qty)));
      const needs = r.inputs.map((i) => { const have = count(g.p.inv, i.id); return `<span class="${have < i.qty ? 'miss' : ''}">${i.qty}× ${esc(item(i.id).name)} (${have})</span>`; }).join(', ');
      const lvlOk = g.level(r.skill) >= r.level;
      const out = item(r.output.id);
      return `<div class="recipe"><img src="${itemIcon(r.output.id)}" alt=""><div><b>${esc(out.name)}</b><div class="need">${needs}<br><span class="${lvlOk ? '' : 'miss'}">${cap(r.skill)} ${r.level}</span> · ${r.xp} XP${r.rarityRoll ? ' · can roll Fine or Rare' : ''}${r.burn ? ' · may burn' : ''}</div>${block ? `<div class="need miss">${esc(block)}</div>` : ''}</div>
        <div class="btns"><button class="btn primary" data-r="${r.id}" data-n="1" ${block ? 'disabled' : ''}>Make 1</button><button class="btn" data-r="${r.id}" data-n="${Math.max(1, max)}" ${block || max < 2 ? 'disabled' : ''}>All (${Math.max(0, max)})</button></div></div>`;
    }).join('');
    const busy = g.action?.type === 'craft' ? `<p class="muted">Working... (${g.action.remaining} left)</p>` : '';
    const worn = st === 'anvil' ? g.repairList() : [];
    const repairs = worn.length ? `<h2 class="title" style="font-size:14px;margin-top:10px">Repairs</h2>${worn.map((r) => `<div class="recipe"><img src="${itemIcon(r.st.id)}" alt=""><div><b>${esc(displayName(r.st))}</b><div class="need">Condition ${Math.round(condOf(r.st))}%</div></div>
      <div class="btns"><button class="btn primary" data-rep="${r.key}:smith" ${g.nearSmith() ? '' : 'disabled'}>Bram · ${r.coins}c</button>${r.bar ? `<button class="btn" data-rep="${r.key}:self" ${count(g.p.inv, r.bar) ? '' : 'disabled'}>1 ${esc(item(r.bar).name.replace(' bar', ''))} bar · +${r.xp} XP</button>` : ''}</div></div>`).join('')}` : '';
    this.win('stationwin', title, tabs + repairs + rows + busy);
  }

  private bankOpen = false;
  private openBank() {
    this.closeWindows();
    this.bankOpen = true;
    this.renderBank();
    if (!this.sideOpen || this.tab !== 'pack') this.selectTab('pack', true);
  }

  private renderBank() {
    const g = this.game, bank = g.s.bank;
    const rows = bank.length
      ? `<div class="grid28 bank">${bank.map((st, i) => `<div class="bankcell">${this.slotHtml(st, `data-bank="${i}"`)}<div class="wd"><button class="btn" data-wd="${i}:1">1</button><button class="btn" data-wd="${i}:${st.qty}">All</button></div></div>`).join('')}</div>`
      : '<p class="muted">Empty. Deposit your pack and come back for it later; tools stay with you.</p>';
    this.win('bankwin', 'Your bank', `<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="muted">${bank.length} stacks · tap an item in your pack to deposit it</span><button class="btn primary" data-dep="1">Deposit pack</button></div>${rows}`);
  }

  // ------------------------------------------------------------------ loadout (HUD quick menu)
  private loadoutOpen = false;
  private fpsT = 0;
  /** Aboard: load the next ammunition you can use (cannonballs, chain shot, depth charges). */
  cycleShipAmmo() {
    const nv = this.game.naval, order = Object.keys(AMMO) as AmmoId[];
    const i = order.indexOf(nv.ammo);
    for (let k = 1; k <= order.length; k++) {
      const next = order[(i + k) % order.length];
      if (!nv.ammoBlock(next)) { nv.setAmmo(next); return; }
    }
  }
  toggleLoadout() { if (this.loadoutOpen) this.closeLoadout(); else { this.closePop(); this.loadoutOpen = true; this.renderLoadout(); } }
  closeLoadout() { this.loadoutOpen = false; document.getElementById('loadout')?.remove(); }

  private stanceButtons(): string {
    const g = this.game, st = g.stats, stance = g.s.combat.stance;
    const stanceLabel: Record<Stance, [string, string]> = st.style === 'melee'
      ? { accurate: ['Accurate', 'Attack XP'], aggressive: ['Aggressive', 'Strength XP'], defensive: ['Defensive', 'Defence XP'] }
      : st.style === 'ranged'
        ? { accurate: ['Accurate', 'Ranged XP'], aggressive: ['Rapid', 'Ranged XP, faster'], defensive: ['Longrange', 'Ranged + Defence XP'] }
        : { accurate: ['Accurate', 'Magic XP'], aggressive: ['Focused', 'Magic XP'], defensive: ['Defensive', 'Magic + Defence XP'] };
    return (['accurate', 'aggressive', 'defensive'] as Stance[]).map((k) => `<button data-stance="${k}" class="${stance === k ? 'on' : ''}"><b>${stanceLabel[k][0]}</b><small>${stanceLabel[k][1]}</small></button>`).join('');
  }

  /** Tide-walk Home, once Magic allows it (shown in the loadout and the Map tab). */
  private utilityRow(): string {
    const g = this.game, u = UTILITY_SPELLS.home;
    if (g.level('magic') < u.level) return '';
    const blk = g.utilityBlock('home');
    return `<h3>Magic</h3><button class="btn" data-home="1" ${blk ? 'disabled' : ''} style="width:100%">${esc(u.name)} · ${u.charms} charms${blk ? ` <small class="muted">(${esc(blk.toLowerCase())})</small>` : ''}</button>`;
  }

  private spellButtons(): string {
    const g = this.game, st = g.stats;
    return SPELLS.map((sp) => { const learnt = !sp.quest || !!g.s.flags[sp.quest]; return `<button data-spell="${sp.id}" class="${st.spell?.id === sp.id ? 'on' : ''}" ${g.level('magic') < sp.level || !learnt ? 'disabled' : ''}><b>${esc(sp.name)}</b><small>${learnt ? `Lv ${sp.level}` : 'Quest'} · max ${sp.maxHit * 10} · ${sp.charms ? `${sp.charms} charm${sp.charms > 1 ? 's' : ''}` : 'free'}</small></button>`; }).join('');
  }

  private renderLoadout() {
    const g = this.game, st = g.stats;
    let el = document.getElementById('loadout');
    if (!el) {
      el = h('div', { id: 'loadout', class: 'panel', role: 'dialog', 'aria-label': 'Loadout' });
      document.body.appendChild(el);
      onTap(el, '.x, [data-lw], [data-la], [data-spell], [data-stance], [data-home]', (b) => {
        if (b.classList.contains('x')) { this.closeLoadout(); return; }
        if (b.dataset.home) { g.teleportHome(); this.closeLoadout(); return; }
        if (b.dataset.lw || b.dataset.la) g.equip(Number(b.dataset.lw ?? b.dataset.la));
        else if (b.dataset.spell) g.setSpell(b.dataset.spell);
        else if (b.dataset.stance) g.setStance(b.dataset.stance as Stance);
        this.renderLoadout();
      });
    }
    const w = g.p.equip.weapon;
    const weapons = g.p.inv.map((s, i) => (s && item(s.id).equip?.slot === 'weapon' ? this.slotHtml(s, `data-lw="${i}"`) : '')).join('');
    let pick = '';
    const util = this.utilityRow();
    if (st.style === 'magic') pick = `<h3>Spell <small class="muted">${fmt(count(g.p.inv, 'charm_tide'))} tide charms</small></h3><div class="stances spells">${this.spellButtons()}</div>`;
    else if (st.style === 'ranged') {
      const need = st.needsAmmo ?? 'shot', eq = g.p.equip.ammo;
      const ammo = g.p.inv.map((s, i) => (s && ammoKind(item(s.id)) === need ? this.slotHtml(s, `data-la="${i}"`) : '')).join('');
      const cur = eq ? `${fmt(eq.qty)} × ${esc(item(eq.id).name)}${ammoKind(item(eq.id)) !== need ? ' <span class="miss">(wrong ammo)</span>' : ''}` : `<span class="miss">No ${AMMO_NAME[need]} loaded</span>`;
      pick = `<h3>Ammo <small class="muted">${cur}</small></h3>${ammo ? `<div class="lorow">${ammo}</div>` : `<p class="muted" style="margin:0">No ${AMMO_NAME[need]} in your pack. ${need === 'arrow' ? 'Marta sells arrows; Fletching makes them.' : need === 'bolt' ? 'Fletching makes bolts.' : 'Marta sells shot; Gunsmithing makes it.'}</p>`}`;
    }
    morph(el, `<div class="lohead">${w ? this.slotHtml(w, 'data-equip="weapon"') : ''}<div><b>${w ? esc(displayName(w)) : 'Bare hands'}</b><small class="muted">${KIND_TIPS[st.kind]}</small></div><button class="x" aria-label="Close">×</button></div>
      ${weapons ? `<h3>Swap weapon</h3><div class="lorow">${weapons}</div>` : ''}${pick}
      <h3>Stance</h3><div class="stances">${this.stanceButtons()}</div>${util}`);
    // above the buttons, right-aligned (centred in portrait), kept on screen
    const r = this.el['ab-load'].getBoundingClientRect(), wd = el.offsetWidth, ht = el.offsetHeight;
    const x = this.portrait ? (window.innerWidth - wd) / 2 : Math.min(window.innerWidth - wd - 8, r.right - wd);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, r.top - ht - 10)}px`;
  }

  private openShop() {
    this.closeWindows();
    this.shopOpen = true;
    this.renderShop();
    if (!this.sideOpen || this.tab !== 'pack') this.selectTab('pack', true);
  }

  private renderShop() {
    const g = this.game;
    const coins = count(g.p.inv, 'coins');
    const shop = g.shop;
    const rows = shop.stock.map(({ id, qty }) => {
      const price = g.buyPrice(id);
      return `<div class="recipe"><img src="${itemIcon(id)}" alt=""><div><b>${qty > 1 ? `${qty} × ` : ''}${esc(item(id).name)}</b><div class="need">${esc(item(id).desc)}</div></div><div class="btns"><button class="btn primary" data-buy="${id}" ${coins < price ? 'disabled' : ''}>Buy ${price}c</button></div></div>`;
    }).join('');
    const wants = (shop.wants ?? []).map((w) => w.note).join(' ');
    // selling: everything in your pack the trader will take, with what they'd pay
    const sell = g.p.inv.map((st, i) => {
      if (!st || st.id === 'coins' || item(st.id).quest) return '';
      const each = g.sellPrice({ ...st, qty: 1 });
      return `<div class="recipe"><img src="${itemIcon(st.id, st.qty)}" alt=""><div><b>${st.qty > 1 ? `${st.qty} × ` : ''}${esc(displayName(st))}</b><div class="need">${each}c each</div></div><div class="btns"><button class="btn" data-sell="${i}:1">Sell 1</button>${st.qty > 1 ? `<button class="btn" data-sell="${i}:all">All ${each * st.qty}c</button>` : ''}</div></div>`;
    }).join('');
    const tab = this.shopTab;
    this.win('shopwin', shop.name, `<div class="seg shoptabs" style="margin-bottom:8px"><button data-shoptab="buy" class="${tab === 'buy' ? 'on' : ''}">Buy</button><button data-shoptab="sell" class="${tab === 'sell' ? 'on' : ''}">Sell</button></div>
      <p class="muted" style="margin-top:0">You have ${fmt(coins)} coins.${wants ? ` ${esc(wants)}` : ''}</p>${tab === 'buy' ? rows : sell || '<p class="muted">Nothing in your pack to sell.</p>'}`);
  }

  private openDialog(npc: string, lines: string[]) {
    this.closeWindows();
    this.dialog = { npc, lines, i: 0 };
    this.renderDialog();
  }

  private renderDialog() {
    let el = document.getElementById('dialog');
    if (!this.dialog) { el?.remove(); return; }
    if (!el) { el = h('div', { id: 'dialog', class: 'panel', role: 'dialog' }); document.body.appendChild(el); }
    const last = this.dialog.i >= this.dialog.lines.length - 1;
    const rd = this.dialog.read, n = rd ? null : NPCS[this.dialog.npc];
    // a page you're reading (Keel's Log, a Varrow fragment): parchment, no portrait
    el.classList.toggle('reading', !!rd);
    const who = rd ? `<div class="who">${esc(rd.title)}<small>${esc(rd.sub)}</small></div>` : `<div class="who">${esc(n!.name)}<small>${esc(n!.title)}</small></div>`;
    const pic = !rd && NPC_LOOKS[this.dialog.npc] ? `<img class="portrait" alt="" src="${portrait(this.dialog.npc, NPC_LOOKS[this.dialog.npc])}">` : '';
    el.innerHTML = `${pic}${who}<p>${esc(this.dialog.lines[this.dialog.i])}</p><div class="act"><button class="btn primary">${last ? 'Close' : 'Continue'}</button></div>`;
    const btn = el.querySelector('button')!;
    onTap(btn, 'button', () => this.advanceDialog());
    btn.focus({ preventScroll: true });
  }

  advanceDialog() {
    if (!this.dialog) return;
    this.dialog.i++;
    if (this.dialog.i >= this.dialog.lines.length) {
      const npc = this.dialog.npc;
      this.dialog = null;
      this.renderDialog();
      if (NPCS[npc]?.shop && !this.shopOpen) this.game.openShopOf(npc);
      return;
    }
    this.renderDialog();
  }

  get dialogOpen() { return !!this.dialog; }

  // ------------------------------------------------------------------ pack full
  /** Gathering stopped on a full pack: offer the two ways on (it goes when the pack has room or after a while). */
  private packFull(node: string) {
    const g = this.game, n = g.junkSlots();
    let el = document.getElementById('packfull');
    if (!el) { el = h('div', { id: 'packfull', class: 'panel', role: 'alert' }); document.body.appendChild(el); }
    el.innerHTML = `<b>Pack full</b><div class="acts"><button class="btn primary" data-pf="bank">Bank</button><button class="btn" data-pf="junk" ${n ? '' : 'disabled'}>${n ? `Drop junk (${n})` : 'No junk marked'}</button><button class="btn x" data-pf="close" aria-label="Close">×</button></div>${n ? '' : '<small class="muted">Mark junk in an item\'s details</small>'}`;
    const box = el;
    onTap(box, '[data-pf]', (b) => {
      const k = b.dataset.pf;
      if (k === 'bank') g.goToBank();
      if (k === 'junk') g.dropJunk(node);
      box.remove();
    });
    const born = performance.now();
    const check = () => { if (!box.isConnected) return; if (performance.now() - born > 20000 || g.p.inv.includes(null)) { box.remove(); return; } setTimeout(check, 500); };
    setTimeout(check, 500);
  }

  // ------------------------------------------------------------------ quest tracker
  private trackKey = '';
  private updateTracker() {
    const g = this.game, el = this.el.track, id = g.trackedQuest(), goal = id ? g.questGoal(id) : null;
    const away = goal?.region && goal.region !== g.s.region ? REGIONS[goal.region as RegionId]?.name : null;
    const key = `${id}|${goal?.text}|${away}|${!!g.dead}`;
    if (key === this.trackKey) return;
    this.trackKey = key;
    el.hidden = !id || !goal || !!g.dead;
    if (el.hidden) return;
    el.innerHTML = `<b>${esc(QUESTS[id!].name)}</b><span>${esc(goal!.text)}</span>${away ? `<small>In ${esc(away)}</small>` : ''}`;
  }

  /** The tracked quest's goal on a map: a gold ring where it is, or (minimap) a gold arrow at the rim pointing to it. */
  private drawGoal(c: CanvasRenderingContext2D, toPx: (x: number, z: number) => [number, number], W: number, rim: boolean) {
    const g = this.game, id = g.trackedQuest(), goal = id ? g.questGoal(id) : null;
    if (!goal || goal.region !== g.s.region || goal.x === undefined || goal.z === undefined) return;
    let [px, py] = toPx(goal.x, goal.z);
    const cx = W / 2, R = W / 2 - 9, dx = px - cx, dy = py - cx, d = Math.hypot(dx, dy);
    const pulse = 1 + 0.18 * Math.sin(performance.now() / 220);
    if (rim && d > R) {
      px = cx + (dx / d) * R; py = cx + (dy / d) * R;
      c.save(); c.translate(px, py); c.rotate(Math.atan2(dy, dx));
      const s = (W / 140) * 7 * pulse;
      c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.7, s * 0.75); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.7, -s * 0.75); c.closePath();
      c.fillStyle = '#ffd34a'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#1a120a'; c.stroke();
      c.restore();
      return;
    }
    const r = (rim ? W / 140 : 1.6) * 6 * pulse;
    c.beginPath(); c.arc(px, py, r, 0, 7); c.lineWidth = 4; c.strokeStyle = '#1a120a'; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#ffd34a'; c.stroke();
  }

  // ------------------------------------------------------------------ touch calibration
  /** How far this phone's taps land from the finger, per orientation (kept on the device, not in the save). */
  touchOffset(): [number, number] {
    try {
      const v = JSON.parse(localStorage.getItem(`sr.touch.${this.portrait ? 'p' : 'l'}`) ?? 'null');
      if (Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n) && Math.abs(n) <= 150)) return [v[0], v[1]];
    } catch { /* no storage: no offset */ }
    return [0, 0];
  }

  /**
   * Tom: "a button on settings to recalibrate if needed". Re-measures the screen first (as a rotation does), then
   * asks for taps on three marks; the average miss becomes this orientation's offset, taken off every world tap.
   */
  calibrate() {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    this.layout();
    this.r.resize();
    document.getElementById('calib')?.remove();
    const el = h('div', { id: 'calib' });
    el.innerHTML = '<div class="mark"></div><p>Tap the centre of the mark</p><button class="btn" data-c="cancel">Cancel</button><button class="btn" data-c="clear">Clear calibration</button>';
    document.body.appendChild(el);
    const mark = el.querySelector('.mark') as HTMLElement, note = el.querySelector('p')!;
    const spots = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.72]], miss: [number, number][] = [];
    const key = `sr.touch.${this.portrait ? 'p' : 'l'}`;
    const store = (v: [number, number] | null) => { try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key); } catch { /* private mode: lasts this session only */ } };
    const place = () => { const [fx, fy] = spots[miss.length]; mark.style.left = `${fx * 100}%`; mark.style.top = `${fy * 100}%`; note.textContent = `Tap the centre of the mark (${miss.length + 1} of ${spots.length})`; };
    const done = (text: string, kind: 'good' | 'warn') => { el.remove(); this.log(text, kind); this.lastRev = -1; };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.c === 'cancel') { done('Calibration cancelled.', 'warn'); return; }
      if (b?.dataset.c === 'clear') { store(null); done('Touch calibration cleared.', 'good'); return; }
      const r = mark.getBoundingClientRect();
      miss.push([e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)]);
      if (miss.length < spots.length) { place(); return; }
      const ox = miss.reduce((a, m) => a + m[0], 0) / miss.length, oy = miss.reduce((a, m) => a + m[1], 0) / miss.length;
      const spread = Math.max(...miss.map((m) => Math.hypot(m[0] - ox, m[1] - oy)));
      if (spread > 40) { done('Those taps were too far apart to trust. Try again, aiming at the centre each time.', 'warn'); return; }
      if (Math.hypot(ox, oy) < 8) { store(null); done('Touch is lined up: no adjustment needed.', 'good'); return; }
      store([Math.max(-150, Math.min(150, ox)), Math.max(-150, Math.min(150, oy))]);
      done(`Touch recalibrated (${Math.round(ox)}, ${Math.round(oy)} px).`, 'good');
    });
    place();
  }

  confirm(text: string, okLabel: string, ok: () => void) {
    const el = this.win('confirm', 'Are you sure?', `<p>${esc(text)}</p><div class="acts"><button class="btn" data-c="no">Cancel</button><button class="btn primary" data-c="yes">${esc(okLabel)}</button></div>`);
    this.confirmOk = ok;
    void el;
  }

  // ------------------------------------------------------------------ maps
  /** The region's map, drawn once per visit: ~1.7+ px per metre, so the minimap stays crisp. */
  private buildMinimapBase() {
    const w = this.game.world, cave = this.game.region.kind === 'cave';
    const S = Math.min(1024, Math.ceil(w.half * 2 * 3.4)), k = S / (w.half * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(S, S);
    const village = FLATS[0];
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = w.ox + i / k, z = w.oz + j / k;
        const y = w.standY(x, z);
        let col: [number, number, number];
        if (cave) col = w.walkable(x, z) || y < 1.2 ? [112, 96, 78] : y < 2 ? [58, 52, 46] : [14, 13, 12];
        else if (w.deckAt(x, z)) col = [140, 104, 66];
        else if (y < -2.5) col = [26, 86, 108];
        else if (y < -0.4) col = [44, 128, 146];
        else if (y < 0.14) col = [86, 170, 170];
        else if (coastDist(x, z) < 4) col = [214, 192, 138];
        else {
          const pd = nearestPathDist(x, z);
          if (pd.d < pd.width) col = [156, 122, 80];
          else if (Math.hypot(x - village.x, z - village.z) < village.r - 1) col = [168, 154, 128];
          else if (!w.walkable(x, z) && y > 1.5) col = [130, 128, 120];
          else { const t = Math.min(1, y / 8); col = [Math.round(104 - t * 20), Math.round(150 - t * 30), Math.round(74 - t * 10)]; }
        }
        const o = (j * S + i) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    c.fillStyle = '#3a2a1e';
    const L = this.game.layout, px = (x: number) => (x - w.ox) * k, pz = (z: number) => (z - w.oz) * k;
    for (const b of L.buildings) { c.fillRect(px(b.x) - 4, pz(b.z) - 3, 8, 6); }
    for (const b of L.town) {
      // rotated footprint (rot follows the world's rect convention: canvas y is world z)
      c.save(); c.translate(px(b.x), pz(b.z)); c.rotate(b.rot); c.fillRect((-b.w / 2) * k, (-b.d / 2) * k, b.w * k, b.d * k); c.restore();
    }
    c.fillStyle = '#2a2a28';
    for (const r of L.reefs) { c.beginPath(); c.arc(px(r.x), pz(r.z), 2, 0, 7); c.fill(); }
    // cave mouths and ropes: a dark arch with a gold rim
    for (const pt of L.portals) { c.beginPath(); c.arc(px(pt.x), pz(pt.z), 5, 0, 7); c.fillStyle = '#0a0806'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#e8c27a'; c.stroke(); }
    this.mmBase = cv;
    this.mmK = k;
  }
  private mmK = 1;

  private drawMarkers(c: CanvasRenderingContext2D, toPx: (x: number, z: number) => [number, number], scale: number, big: boolean) {
    const g = this.game;
    const dot = (x: number, z: number, r: number, fill: string) => { const [px, py] = toPx(x, z); c.beginPath(); c.arc(px, py, r, 0, 7); c.fillStyle = fill; c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke(); };
    for (const n of g.nodes) if (n.def.startsWith('spot_') && n.depletedUntil <= g.time) dot(n.x, n.z, big ? 4 : 2.5 * scale, '#9fe8ff');
    // quest-givers with a quest you haven't started wear a gold "!" (RuneScape's quest icon); everyone else is a dot
    const givers = new Set(Object.values(QUESTS).filter((q) => g.questStage(q.id) === 0).map((q) => q.giver));
    for (const n of g.layout.npcs) {
      if (!givers.has(n.id)) { dot(n.x, n.z, (big ? 4.5 : 3) * scale, '#ffe066'); continue; }
      const [px, py] = toPx(n.x, n.z), r = (big ? 7 : 4.6) * scale;
      c.beginPath(); c.arc(px, py, r, 0, 7); c.fillStyle = '#2a1a0a'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#ffd34a'; c.stroke();
      c.fillStyle = '#ffd34a'; c.font = `700 ${Math.round(r * 1.6)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', px, py + r * 0.05);
      c.textBaseline = 'alphabetic';
    }
    // where the island's big fights start: the skilling bosses and the boss arenas (named on the big map)
    for (const m of this.eventMarks()) {
      const [px, py] = toPx(m.x, m.z), r = (big ? 6.5 : 4.2) * scale;
      c.save(); c.translate(px, py); c.rotate(Math.PI / 4);
      c.fillStyle = m.kind === 'boss' ? '#d8483a' : '#e8902a'; c.strokeStyle = '#1a120a'; c.lineWidth = 1.5;
      c.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); c.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      c.restore();
      if (big) { c.font = '600 13px Georgia, serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1a120a'; c.strokeText(m.name, px, py + r + 13); c.fillStyle = '#ffd9a8'; c.fillText(m.name, px, py + r + 13); }
    }
    for (const e of g.enemies) if (e.alive) dot(e.x, e.z, (e.def.boss ? 6 : big ? 3 : 2.2) * scale, e.def.boss ? '#ff4a3a' : '#e05a44');
    for (const d of g.drops) dot(d.x, d.z, 2 * scale, '#f2cf5b');
    if (g.shipHere) {
      const [sx, sz] = toPx(g.ship.x, g.ship.z);
      c.save(); c.translate(sx, sz); c.rotate(g.ship.heading);
      c.fillStyle = '#efe3c4'; c.strokeStyle = '#000'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(7 * scale, 0); c.lineTo(-5 * scale, 3.5 * scale); c.lineTo(-5 * scale, -3.5 * scale); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    // the Listener's Key: you hear where Keel's pages lie (unread ones, pale blue)
    if (g.activeKey()?.passive.kind === 'listening') for (const l of LORE) if (l.region === g.s.region && !g.s.flags[`lore_${l.id}`]) dot(l.x, l.z, (big ? 4 : 2.6) * scale, '#bcd8ff');
    // the Wardwright compass (The Lantern Burns Low): it never pointed north; it points at the doors the Houses left shut
    if (g.s.flags.lantern_done) for (const d of DOORS) if (d.region === g.s.region && !g.s.flags[`door_${d.id}`]) dot(d.x, d.z, (big ? 4.5 : 3) * scale, '#e8c060');
    // bell-time: the bell ringing where there's no bell, pulsing bronze
    { const bt = g.belltime.here(); if (bt) dot(bt.x, bt.z, (big ? 6 : 4) * scale * (1 + 0.25 * Math.sin(performance.now() / 180)), '#e8a850'); }
    // the Gull Race: the start buoy, or the next buoy to round
    { const c = g.regatta.course(), nb = g.regatta.nextBuoy(); if (nb) dot(nb[0], nb[1], (big ? 6 : 4) * scale * (1 + 0.2 * Math.sin(performance.now() / 150)), '#e8c040'); else if (c && g.p.onShip) dot(c.start[0], c.start[1], (big ? 4 : 2.8) * scale, '#ece4d2'); }
    // a message in a bottle, bobbing off the bow
    { const bo = g.bottles.bottle; if (bo) dot(bo.x, bo.z, (big ? 4 : 2.8) * scale, '#8ad8a0'); }
    const tx = g.treasure.here();
    if (tx) {
      // the treasure map's X, in red
      const [xx, xy] = toPx(tx.x, tx.z), r = (big ? 6 : 4) * scale;
      c.save(); c.lineCap = 'round';
      for (const [w, col] of [[5 * scale, '#1a120a'], [2.6 * scale, '#e04a3a']] as const) {
        c.lineWidth = w; c.strokeStyle = col; c.beginPath();
        c.moveTo(xx - r, xy - r); c.lineTo(xx + r, xy + r); c.moveTo(xx + r, xy - r); c.lineTo(xx - r, xy + r); c.stroke();
      }
      c.restore();
    }
    const obj = this.questObjective();
    if (obj) {
      const [qx, qy] = toPx(obj.x, obj.z);
      c.save(); c.translate(qx, qy); c.fillStyle = '#ffd34a'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
      c.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = (k % 2 ? 3 : 7) * scale; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    if (!g.p.onShip) {
      const [px, py] = toPx(g.p.x, g.p.z);
      c.save(); c.translate(px, py); c.rotate(g.facing);
      c.fillStyle = '#ffffff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(6 * scale, 0); c.lineTo(-4 * scale, 4 * scale); c.lineTo(-2 * scale, 0); c.lineTo(-4 * scale, -4 * scale); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  }

  /** The skilling bosses' start points and the boss arenas in this region, for the maps. */
  private eventMarks(): { x: number; z: number; name: string; kind: 'skill' | 'boss' }[] {
    const g = this.game, out: { x: number; z: number; name: string; kind: 'skill' | 'boss' }[] = [];
    const st = g.storm.spots(), fi = g.fire.spots(), se = g.seep.spots();
    if (st) out.push({ ...st.bell, name: 'The Storm Tide', kind: 'skill' });
    if (fi) out.push({ ...fi.horn, name: 'The Greenheart Fire', kind: 'skill' });
    if (se) out.push({ ...se.crack, name: 'The Amber Seep', kind: 'skill' });
    for (const a of g.layout.arenas) out.push({ x: a.x, z: a.z, name: ENEMIES[a.boss]?.name ?? 'Boss', kind: 'boss' });
    return out;
  }

  private readonly MM_RANGE = 34; // metres from centre to edge
  /** The Map tab: the region you're in, or the sea chart of every island. */
  private mapView: 'here' | 'chart' = 'here';
  /** The part of the region the Map tab shows: the island and its near waters, or the whole cave. */
  private mapFrame(): { cx: number; cz: number; span: number } {
    const g = this.game, r = g.region;
    if (r.id === 'sunreach') return { cx: SUN.x, cz: SUN.z, span: 170 };
    if (r.id === 'wrack') return { cx: WRACK.x, cz: WRACK.z, span: 150 };
    if (r.id === 'lockhaven') return { cx: LOCK.x, cz: LOCK.z, span: 150 };
    if (r.id === 'saltglass') return { cx: SALT.x, cz: SALT.z, span: 145 };
    if (r.id === 'longstrand') return { cx: LONG.x, cz: LONG.z, span: 170 };
    if (r.id === 'amberhold') return { cx: AMBER.x, cz: AMBER.z, span: 160 };
    if (r.id === 'bellwether') return { cx: 0, cz: 0, span: 290 }; // the island and its fighting waters (charting marks, Old Gnasher's reef)
    return { cx: r.bounds.cx, cz: r.bounds.cz, span: r.bounds.half * 2 };
  }
  private drawMinimap() {
    const cv = this.mmCtx.canvas, c = this.mmCtx, W = cv.width;
    const g = this.game, w = g.world;
    const k = this.mmK;
    const cx = g.p.x, cz = g.p.z, R = this.MM_RANGE;
    c.fillStyle = g.region.kind === 'cave' ? '#0e0d0c' : '#1a566b';
    c.fillRect(0, 0, W, W);
    c.drawImage(this.mmBase, (cx - R - w.ox) * k, (cz - R - w.oz) * k, R * 2 * k, R * 2 * k, 0, 0, W, W);
    const toPx = (x: number, z: number): [number, number] => [((x - cx) / (R * 2) + 0.5) * W, ((z - cz) / (R * 2) + 0.5) * W];
    this.drawMarkers(c, toPx, W / 140, false);
    this.drawGoal(c, toPx, W, true);
  }

  private minimapTap(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const r = this.el.mm.getBoundingClientRect();
    const g = this.game, R = this.MM_RANGE;
    const x = g.p.x + ((e.clientX - r.left) / r.width - 0.5) * R * 2;
    const z = g.p.z + ((e.clientY - r.top) / r.height - 0.5) * R * 2;
    g.moveTo(x, z);
    this.r.markClick(x, z);
  }

  private drawBigMap() {
    const cv = document.getElementById('mapbig') as HTMLCanvasElement | null;
    if (!cv) return;
    const c = cv.getContext('2d')!, W = cv.width;
    if (this.mapView === 'chart') { this.drawChart(c, W); return; }
    // show the island and its near waters, not the whole region
    const w = this.game.world, k = this.mmK;
    const fr = this.mapFrame(), span = fr.span, ox = fr.cx - span / 2, oz = fr.cz - span / 2;
    c.fillStyle = this.game.region.kind === 'cave' ? '#0e0d0c' : '#1a566b';
    c.fillRect(0, 0, W, W);
    c.drawImage(this.mmBase, (ox - w.ox) * k, (oz - w.oz) * k, span * k, span * k, 0, 0, W, W);
    const toPx = (x: number, z: number): [number, number] => [((x - ox) / span) * W, ((z - oz) / span) * W];
    c.font = '600 15px Georgia, serif';
    c.textAlign = 'center';
    for (const p of PLACES) {
      if (!this.game.s.discovered.includes(p.id) || placeRegion(p) !== this.game.s.region) continue;
      const [x, y] = toPx(p.x, p.z);
      c.lineWidth = 4; c.strokeStyle = '#1a120a'; c.strokeText(p.name, x, y - 12);
      c.fillStyle = p.sea ? '#bfefff' : '#ffe9b8'; c.fillText(p.name, x, y - 12);
    }
    // charting marks not yet logged: a gold cross on the water (sail over one to log it)
    for (const m of CHART_MARKS) {
      if (m.region !== this.game.s.region || this.game.s.flags[`chart_${m.id}`]) continue;
      const [x, y] = toPx(m.x, m.z);
      c.lineWidth = 5; c.strokeStyle = '#1a120a'; c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7); c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = '#ffd35a'; c.stroke();
    }
    this.drawMarkers(c, toPx, 1.6, true);
    this.drawGoal(c, toPx, W, false);
  }

  /** The map is square: on a phone's half-height sheet it must shrink to the sheet's height, not run off the bottom. */
  private fitBigMap(panel: HTMLElement) {
    const cv = document.getElementById('mapbig') as HTMLCanvasElement | null;
    if (!cv) return;
    cv.style.width = '';
    const p = panel.getBoundingClientRect(), top = cv.getBoundingClientRect().top;
    const room = p.bottom - top - 12;
    if (room > 120 && room < cv.getBoundingClientRect().width) { cv.style.width = `${Math.floor(room)}px`; cv.classList.add('fit'); }
  }

  private bindBigMap() {
    const cv = document.getElementById('mapbig') as HTMLCanvasElement;
    cv.addEventListener('pointerdown', (e) => {
      if (this.mapView === 'chart') return;
      const r = cv.getBoundingClientRect();
      const fr = this.mapFrame(), span = fr.span;
      const x = fr.cx - span / 2 + ((e.clientX - r.left) / r.width) * span, z = fr.cz - span / 2 + ((e.clientY - r.top) / r.height) * span;
      this.game.moveTo(x, z);
      this.r.markClick(x, z);
      if (this.portrait) { this.sideOpen = false; this.layout(); }
    });
  }

  /** The sea chart: the islands drawn from their coastlines (drawn larger than life so four fit), the lanes
   * between them, the caves beneath. */
  private drawChart(c: CanvasRenderingContext2D, W: number) {
    const g = this.game;
    c.fillStyle = '#d9c9a0'; c.fillRect(0, 0, W, W); // parchment
    c.fillStyle = '#9cc4c4'; c.fillRect(14, 14, W - 28, W - 28);
    const ISLES = [
      { id: 'bellwether', x: 0, z: 0, coast: coastR, name: 'Bellwether Isle', zoom: 1.25 },
      { id: 'sunreach', x: SUN.x, z: SUN.z, coast: sunCoastR, name: 'Sunreach Isle', zoom: 1.8 },
      { id: 'amberhold', x: AMBER.x, z: AMBER.z, coast: amberCoastR, name: 'Amberhold Isle', zoom: 1.8 },
      { id: 'wrack', x: WRACK.x, z: WRACK.z, coast: wrackCoastR, name: 'Stormwrack Isle', zoom: 1.8 },
      { id: 'lockhaven', x: LOCK.x, z: LOCK.z, coast: lockCoastR, name: 'Lockhaven', zoom: 1.8 },
      { id: 'saltglass', x: SALT.x, z: SALT.z, coast: saltCoastR, name: 'Saltglass', zoom: 1.8 },
      { id: 'longstrand', x: LONG.x, z: LONG.z, coast: longCoastR, name: 'Longstrand', zoom: 1.8 },
    ] as const;
    const span = 2800, cx = LONG.x / 2, cz = 10, ox = cx - span / 2, oz = cz - span / 2;
    // a point near an island is pushed out from its centre by that island's zoom, so the chart stays true to where you are
    const toPx = (x: number, z: number): [number, number] => {
      const is = ISLES.reduce((a, b) => (Math.hypot(x - b.x, z - b.z) < Math.hypot(x - a.x, z - a.z) ? b : a));
      const d = Math.hypot(x - is.x, z - is.z), k = d < 150 ? is.zoom : 1;
      return [((is.x + (x - is.x) * k - ox) / span) * W, ((is.z + (z - is.z) * k - oz) / span) * W];
    };
    const here = (id: string) => g.s.region === id || (g.region.home === id && g.region.kind === 'cave');
    for (const is of ISLES) {
      c.beginPath();
      for (let k = 0; k <= 96; k++) { const t = (k / 96) * Math.PI * 2 - Math.PI, rr = is.coast(t); const [px, py] = toPx(is.x + Math.cos(t) * rr, is.z + Math.sin(t) * rr); if (k) c.lineTo(px, py); else c.moveTo(px, py); }
      c.closePath(); c.fillStyle = '#e8d9a8'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#8a6a3a'; c.stroke();
      c.save(); c.clip(); c.fillStyle = here(is.id) ? '#7fa65a' : '#93ab6c'; const [px, py] = toPx(is.x, is.z); c.beginPath(); c.arc(px, py, ((is.coast(0) - 10) * is.zoom) / span * W, 0, 7); c.fill(); c.restore();
    }
    // labels are kept inside the parchment's frame
    const label = (text: string, px: number, py: number, size = 20, colour = '#3a2a1e') => {
      c.font = `600 ${size}px Georgia, serif`; c.textAlign = 'center';
      const half = c.measureText(text).width / 2 + 4; px = Math.max(20 + half, Math.min(W - 20 - half, px));
      c.lineWidth = 4; c.strokeStyle = '#f2e6c8'; c.strokeText(text, px, py); c.fillStyle = colour; c.fillText(text, px, py);
    };
    // the sea lanes between neighbours, dashed and named
    const LANES = ['Halyard Channel', 'The Tollway', 'The Gale Reach'];
    c.setLineDash([10, 8]); c.lineWidth = 2.5; c.strokeStyle = '#2f5a6a';
    for (let i = 0; i < ISLES.length - 1; i++) {
      const a = ISLES[i], b = ISLES[i + 1], [ax, ay] = toPx(a.x + a.coast(0) + 8, a.z), [bx, by] = toPx(b.x - b.coast(Math.PI) - 8, b.z);
      c.lineWidth = 2.5; c.strokeStyle = '#2f5a6a'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.setLineDash([]); label(LANES[i], (ax + bx) / 2, (ay + by) / 2 + (i % 2 ? 26 : -12), 15, '#2f5a6a'); c.setLineDash([10, 8]);
    }
    c.setLineDash([]);
    // names alternate below and above, so neighbours' labels never meet
    ISLES.forEach((is, i) => {
      const [px, py] = toPx(is.x, is.z), r = ((is.coast(Math.PI / 2) + 14) * is.zoom) / span * W, band = REGIONS[is.id].band!;
      const y = i % 2 ? py - r - 30 : py + r + 18;
      label(is.name, px, y, 19);
      label(band[0] >= 50 ? `levels ${band[0]}+ (mixed)` : `levels ${band[0]}–${band[1]}`, px, y + 18, 14, '#5a4a2e');
    });
    // cave mouths, named once found
    for (const [x, z, id, name] of [[LAYOUT.cove.x + 6.5, LAYOUT.cove.z - 7.5, 'smugglers_caves', 'Smugglers\' Caves'], [SUN_LAYOUT.ember.x - 9, SUN_LAYOUT.ember.z + 9, 'ember_deep', 'The Ember Deep']] as const) {
      const [px, py] = toPx(x, z);
      c.beginPath(); c.arc(px, py, 8, 0, 7); c.fillStyle = '#1a120a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#e8c27a'; c.stroke();
      if (PLACES.some((p) => p.region === id && g.s.discovered.includes(p.id))) label(name, px, py - 14, 16);
    }
    // you are here
    const at = g.region.kind === 'cave' ? (g.region.home === 'sunreach' ? SUN_LAYOUT.ember : LAYOUT.cove) : g.p;
    const [px, py] = toPx(at.x, at.z);
    c.beginPath(); c.arc(px, py, 10, 0, 7); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#000'; c.stroke();
    if (g.shipHere && g.region.kind === 'island') { const [sx, sy] = toPx(g.ship.x, g.ship.z); c.fillStyle = '#efe3c4'; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(sx + 7, sy); c.lineTo(sx - 5, sy + 4); c.lineTo(sx - 5, sy - 4); c.closePath(); c.fill(); c.stroke(); }
  }

  // ------------------------------------------------------------------ loading screen (between regions)
  private loadingEl: HTMLElement | null = null;
  showLoading(name: string, tip: string, sub = 'Setting a course for') {
    this.loadingEl?.remove();
    const el = document.createElement('div');
    el.className = 'loading';
    el.innerHTML = `<div class="ld-card"><div class="ld-rose" aria-hidden="true"></div><div class="ld-sub">${sub}</div><h1>${esc(name)}</h1><div class="ld-bar"><i></i></div><p>${esc(tip)}</p></div>`;
    document.body.appendChild(el);
    this.loadingEl = el;
  }
  hideLoading() {
    const el = this.loadingEl;
    this.loadingEl = null;
    if (!el) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
  }
}
