import { item, RARITY, AFFIXES, type Slot, type SkillId } from '../game/data/items';
import { morph, forget } from './morph';
import { onTap } from './tap';
import { SKILLS, UNLOCKS, RECIPES, SHOP, ELITE_AFFIXES, PLAYER_BASE, SPELLS, type Station } from '../game/data/content';
import type { Stance } from '../game/sim/gear';
import { NPCS, QUESTS } from '../game/data/quests';
import { PLACES, WORLD_HALF, coastDist, nearestPathDist, FLATS } from '../game/world/island';
import { count, displayName, type Stack } from '../game/sim/inventory';
import { levelForXp, levelProgress, xpForLevel, MAX_LEVEL } from '../game/sim/xp';
import type { Game, GameEvent, MsgKind } from '../game/sim/game';
import type { GameRenderer } from '../render/renderer';
import { itemIcon, rarityColour, TAB_ICONS } from './icons';

type Tab = 'pack' | 'gear' | 'skills' | 'quests' | 'map' | 'settings';
const TABS: { id: Tab; name: string; key: string }[] = [
  { id: 'pack', name: 'Pack', key: 'I' },
  { id: 'gear', name: 'Equipment', key: 'G' },
  { id: 'skills', name: 'Skills', key: 'K' },
  { id: 'quests', name: 'Quests', key: 'J' },
  { id: 'map', name: 'Map', key: 'M' },
  { id: 'settings', name: 'Settings', key: 'O' },
];
const SLOT_ORDER: Slot[] = ['weapon', 'ammo', 'head', 'body', 'ring'];
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const WHIRL = '<svg viewBox="0 0 32 32"><path d="M16 4a12 12 0 0 1 11 7l-5-1M28 16a12 12 0 0 1-7 11l1-5M16 28a12 12 0 0 1-11-7l5 1M4 16a12 12 0 0 1 7-11l-1 5" fill="none" stroke="#e9e5d5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="4" fill="#c9a050" stroke="#1a120a" stroke-width="2"/></svg>';
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
  sideOpen = true;
  private lastRev = -1;
  private el: Record<string, HTMLElement> = {};
  private mmBase!: HTMLCanvasElement;
  private mmCtx!: CanvasRenderingContext2D;
  private mmT = 0;
  private station: Station | null = null;
  private shopOpen = false;
  private dialog: { npc: string; lines: string[]; i: number } | null = null;
  private pop: { slot?: number; equip?: Slot } | null = null;
  private dmgPool: { el: HTMLElement; x: number; y: number; z: number; t: number; live: boolean }[] = [];
  private bars = new Map<number, HTMLElement>();
  private tags = new Map<number, HTMLElement>();
  private playerBar!: HTMLElement;
  private bannerT = 0;
  private portrait = false;
  private confirmOk: (() => void) | null = null;
  onSave: () => void = () => {};
  onReset: () => void = () => {};
  onQuality: (q: 'high' | 'low') => void = () => {};
  lastSaved = 0;

  constructor(private game: Game, private r: GameRenderer) {
    this.build();
    game.on((e) => this.onEvent(e));
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.buildMinimapBase();
  }

  // ------------------------------------------------------------------ dom skeleton
  private build() {
    const b = document.body;
    const add = (id: string, el: HTMLElement) => { el.id = id; b.appendChild(el); this.el[id] = el; return el; };
    add('overlay', h('div'));
    add('log', h('div', { 'aria-live': 'polite' }));
    add('xpdrops', h('div'));
    add('banner', h('div'));
    add('bossbar', h('div', {}, '<b></b><div class="bar"><i></i></div>')).hidden = true;
    const mm = add('mm', h('div', { role: 'button', 'aria-label': 'Minimap. Tap to walk there.', tabindex: '0' }, '<canvas></canvas><div id="compass">N</div>'));
    this.mmCtx = (mm.querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
    add('orbs', h('div', {}, '<div class="orb" id="hp" title="Health"><div class="fill"></div><div class="txt"></div></div><div class="orb lvl" title="Combat level"><div class="fill"></div><div class="txt" id="cbl"></div></div>'));
    this.el.hp = document.getElementById('hp')!;
    const side = add('side', h('div', { class: 'panel' }));
    const tabs = h('div', { id: 'tabs', role: 'tablist' });
    for (const t of TABS) {
      const btn = h('button', { 'data-tab': t.id, role: 'tab', 'aria-label': `${t.name} (${t.key})`, title: `${t.name} (${t.key})` }, TAB_ICONS[t.id]);
      onTap(btn, 'button', () => this.selectTab(t.id, true));
      tabs.appendChild(btn);
    }
    side.appendChild(tabs);
    const content = h('div', { id: 'content', role: 'tabpanel' });
    side.appendChild(content);
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
    const ctx = h('button', { id: 'ctx', class: 'round', 'aria-label': 'Interact (E)' }, '<span></span><small></small>');
    onTap(ctx, 'button', () => { const t = this.game.contextTarget(); if (t) this.game.interact(t.key); });
    const abil = h('div', { id: 'abilities' });
    abil.append(roll, special);
    actions.append(abil, ctx);
    this.el.abilities = abil;
    this.el.ctx = ctx;
    add('hover', h('div')).hidden = true;
    add('stick', h('div', {}, '<i></i>')).hidden = true;
    add('ko', h('div', {}, 'You were knocked out')).hidden = true;
    this.playerBar = h('div', { class: 'hpbar' }, '<i></i>');
    this.el.overlay.appendChild(this.playerBar);
    mm.addEventListener('pointerdown', (e) => this.minimapTap(e));
    this.selectTab('pack', false);
  }

  layout() {
    const w = window.innerWidth, hgt = window.innerHeight;
    this.portrait = hgt > w;
    document.body.classList.toggle('portrait', this.portrait);
    document.body.classList.toggle('landscape', !this.portrait);
    document.body.classList.toggle('side-open', this.sideOpen);
    const mm = this.portrait ? Math.min(118, w * 0.3) : Math.min(150, hgt * 0.24);
    document.documentElement.style.setProperty('--mm', `${mm}px`);
    document.documentElement.style.setProperty('--side-w', `${Math.max(232, Math.min(300, w * 0.3))}px`);
    (this.el.collapse as HTMLButtonElement).textContent = this.sideOpen ? '›' : '‹';
    const cv = this.el.mm.querySelector('canvas') as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(mm * dpr);
    requestAnimationFrame(() => {
      this.r.resize();
      const content = this.el.content;
      this.r.coveredBottom = this.portrait && this.sideOpen ? content.getBoundingClientRect().height + 20 : 0;
    });
  }

  selectTab(t: Tab, user: boolean) {
    if (user && this.portrait && this.tab === t && this.sideOpen) { this.sideOpen = false; this.layout(); return; }
    if (user && !this.sideOpen) { this.sideOpen = true; this.layout(); }
    this.tab = t;
    for (const b of this.el.tabs.querySelectorAll('button')) b.classList.toggle('on', b.getAttribute('data-tab') === t);
    for (const b of this.el.tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t));
    this.closePop();
    this.lastRev = -1;
  }

  /** Portrait starts with the sheet closed so the world is visible. */
  setInitialPanel() {
    this.sideOpen = !(window.innerHeight > window.innerWidth) && window.innerWidth > 700;
    this.layout();
  }

  // ------------------------------------------------------------------ events
  private onEvent(e: GameEvent) {
    switch (e.type) {
      case 'msg': this.log(e.text, e.kind); break;
      case 'xp': this.xpDrop(e.skill, e.amount); break;
      case 'level': this.banner(`${cap(e.skill)} level ${e.level}`, this.nextUnlockText(e.skill) ?? 'Keep going.'); break;
      case 'discover': { const f = this.game.placeInfo(e.id).foes; this.banner(e.name, f ? `Discovered · Foes level ${f[0]}${f[1] > f[0] ? `–${f[1]}` : ''}` : 'Discovered · Peaceful'); break; }
      case 'quest': {
        const q = QUESTS[e.id];
        const done = e.stage === q.stages.length - 1;
        this.banner(done ? 'Quest complete' : e.stage === 1 ? 'New quest' : 'Quest updated', q.name);
        break;
      }
      case 'dialog': this.openDialog(e.npc, e.lines); break;
      case 'openStation': this.openStation(e.station); break;
      case 'openShop': this.openShop(); break;
      case 'openBank': this.openBank(); break;
      case 'hit': this.damageNumber(e.x, e.z, e.amount, e.target === 'player', e.crit); break;
      case 'dodge': this.damageNumber(e.x, e.z, 'Dodged', false, true); break;
      case 'boss': if (e.state === 'defeat') this.banner('Guardian defeated', 'The Broken Ring falls silent'); break;
      case 'board': this.closeWindows(); break;
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

  private xpDrop(skill: SkillId, amt: number) {
    const s = SKILLS.find((x) => x.id === skill)!;
    const d = h('div');
    d.style.color = s.colour;
    d.textContent = `+${fmt(amt)} ${s.name}`;
    this.el.xpdrops.appendChild(d);
    setTimeout(() => d.remove(), 1900);
    while (this.el.xpdrops.children.length > 5) this.el.xpdrops.firstElementChild!.remove();
  }

  banner(title: string, sub: string) {
    this.el.banner.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
    this.el.banner.classList.add('show');
    this.bannerT = 2.6;
  }

  private nextUnlockText(skill: SkillId): string | null {
    const lvl = this.game.level(skill);
    const u = UNLOCKS[skill].find((x) => x.level === lvl);
    if (u) return `Unlocked: ${u.text}`;
    const next = UNLOCKS[skill].find((x) => x.level > lvl);
    return next ? `Next: ${next.text} at level ${next.level}` : null;
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number) {
    const g = this.game;
    const p = g.p;
    // orbs
    const hp = this.el.hp;
    (hp.querySelector('.fill') as HTMLElement).style.transform = `scaleY(${Math.max(0, p.hp / g.stats.maxHp)})`;
    (hp.querySelector('.txt') as HTMLElement).textContent = `${Math.ceil(p.hp)}`;
    document.getElementById('cbl')!.textContent = String(g.stats.combatLevel);
    // context + ability
    const t = g.contextTarget();
    const ctx = this.el.ctx as HTMLButtonElement;
    ctx.hidden = !t || g.dead > 0;
    if (t) {
      (ctx.querySelector('span') as HTMLElement).textContent = t.verb;
      (ctx.querySelector('small') as HTMLElement).textContent = t.label;
      ctx.setAttribute('aria-label', `${t.verb} ${t.label} (E)`);
    }
    const sp = g.specialInfo();
    const spBtn = this.el['ab-special'];
    if (spBtn.dataset.style !== g.stats.style) {
      spBtn.dataset.style = g.stats.style;
      spBtn.innerHTML = `${g.stats.style === 'melee' ? WHIRL : g.stats.style === 'ranged' ? PISTOL : SQUALL}<div class="cd"></div>`;
    }
    spBtn.title = `${sp.name} (R)${sp.block ? ' · ' + sp.block : ''}`;
    spBtn.setAttribute('aria-label', spBtn.title);
    const abs: [HTMLElement, number, number, boolean][] = [[this.el['ab-roll'], g.rollCd, PLAYER_BASE.rollCooldown, false], [spBtn, g.specialCd, sp.cooldown, !!sp.block]];
    for (const [b, cd, max, blocked] of abs) {
      b.classList.toggle('off', cd > 0 || blocked);
      (b.querySelector('.cd') as HTMLElement).style.setProperty('--cd', `${(cd / max) * 360}deg`);
    }
    this.el.abilities.hidden = g.p.onShip || g.dead > 0;
    // boss bar
    const bb = this.el.bossbar;
    if (g.boss && g.boss.alive) {
      bb.hidden = false;
      (bb.querySelector('b') as HTMLElement).textContent = g.boss.def.name;
      (bb.querySelector('i') as HTMLElement).style.transform = `scaleX(${g.boss.hp / g.boss.maxHp})`;
    } else bb.hidden = true;
    this.el.ko.hidden = !(g.dead > 0);
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.el.banner.classList.remove('show'); }
    // windows that depend on position
    if (this.station && !g.nearStation(this.station)) this.closeWindows();
    if (this.shopOpen && !g.nearShop()) this.closeWindows();
    if (this.bankOpen && !g.nearBank()) this.closeWindows();
    // panel content
    if (g.rev !== this.lastRev) {
      this.lastRev = g.rev;
      if (this.sideOpen && this.tab !== 'map') this.renderTab();
      if (this.station) this.renderStation();
      if (this.shopOpen) this.renderShop();
      if (this.bankOpen) this.renderBank();
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
    d.el.className = `dmg${player ? ' player' : ''}${crit ? ' crit' : ''}`;
    d.el.textContent = String(amount);
    d.el.style.display = '';
  }

  private updateOverlay(dt: number) {
    const g = this.game, r = this.r;
    for (const d of this.dmgPool) {
      if (!d.live) continue;
      d.t += dt;
      if (d.t > 0.9) { d.live = false; d.el.style.display = 'none'; continue; }
      const s = r.project(d.x, d.y + d.t * 1.4, d.z);
      d.el.style.left = `${s.x}px`;
      d.el.style.top = `${s.y}px`;
      d.el.style.opacity = String(Math.min(1, 2.2 - d.t * 2.4));
    }
    const seen = new Set<number>();
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
        tg.style.left = `${s.x}px`; tg.style.top = `${s.y - 6}px`;
      }
    }
    for (const [id, b] of this.bars) if (!seen.has(id)) { b.remove(); this.bars.delete(id); }
    for (const [id, tg] of this.tags) if (!seen.has(-id)) { tg.remove(); this.tags.delete(id); }
    const showPlayer = g.combatTimer < 5 && !g.p.onShip && !g.dead;
    this.playerBar.style.display = showPlayer ? '' : 'none';
    if (showPlayer) {
      const s = r.project(g.p.x, g.world.standY(g.p.x, g.p.z) + 2.6, g.p.z);
      this.playerBar.style.left = `${s.x}px`; this.playerBar.style.top = `${s.y}px`;
      (this.playerBar.firstElementChild as HTMLElement).style.width = `${(g.p.hp / g.stats.maxHp) * 100}%`;
    }
  }

  showStick(x: number, y: number, kx: number, ky: number) {
    const s = this.el.stick;
    s.hidden = false;
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    (s.firstElementChild as HTMLElement).style.transform = `translate(${kx}px, ${ky}px)`;
  }
  hideStick() { this.el.stick.hidden = true; }

  showHover(x: number, y: number, verb: string | null, label: string, enemy: boolean) {
    const hv = this.el.hover;
    if (!verb) { hv.hidden = true; return; }
    hv.hidden = false;
    hv.innerHTML = `<b>${esc(verb)}</b> ${enemy ? `<span style="color:#ffb070">${esc(label)}</span>` : `<em>${esc(label)}</em>`}`;
    hv.style.left = `${Math.min(x + 16, window.innerWidth - hv.offsetWidth - 8)}px`;
    hv.style.top = `${y + 18}px`;
  }

  // ------------------------------------------------------------------ tabs
  private renderTab() {
    const c = this.el.content;
    switch (this.tab) {
      case 'pack': morph(c, this.packHtml()); break;
      case 'gear': morph(c, this.gearHtml()); break;
      case 'skills': morph(c, this.skillsHtml()); break;
      case 'quests': morph(c, this.questsHtml()); break;
      case 'map': c.innerHTML = '<h2 class="title">Bellwether Isle</h2><canvas id="mapbig" width="600" height="600" aria-label="Island map. Tap to walk there."></canvas><p class="muted" style="font-size:12px;margin:8px 0 0">Gold star: quest objective. Tap the map to walk there.</p>'; forget(c); this.bindBigMap(); this.drawBigMap(); break;
      case 'settings': morph(c, this.settingsHtml()); break;
    }
  }

  /** One set of handlers on the tab panel for its whole life (content is patched, never re-bound). */
  private bindContent(c: HTMLElement) {
    const g = this.game;
    onTap(c, '[data-slot], [data-equip], [data-stance], [data-spell], [data-q], [data-dmg], #saveNow, #resetSave', (t, pointer) => {
      if (t.dataset.slot !== undefined) {
        const i = Number(t.dataset.slot);
        const st = g.p.inv[i];
        if (!st) return;
        const d = item(st.id);
        // mouse: left-click eats/equips directly (RuneScape-style); touch opens the details panel
        if (pointer === 'mouse' && this.bankOpen) { g.deposit(i); return; } // RuneScape: click to deposit
        if (pointer === 'mouse' && !this.shopOpen && (d.heal || d.equip)) { g.useSlot(i); return; }
        this.openPop({ slot: i }, t);
      } else if (t.dataset.equip !== undefined) { const sl = t.dataset.equip as Slot; if (g.p.equip[sl]) this.openPop({ equip: sl }, t); }
      else if (t.dataset.stance) g.setStance(t.dataset.stance as Stance);
      else if (t.dataset.spell) g.setSpell(t.dataset.spell);
      else if (t.dataset.q) { g.s.settings.quality = t.dataset.q as 'high' | 'low'; this.onQuality(g.s.settings.quality); this.lastRev = -1; }
      else if (t.dataset.dmg) { g.s.settings.showDamage = t.dataset.dmg === '1'; this.lastRev = -1; }
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

  private slotHtml(s: Stack | null, attrs: string, label = '') {
    if (!s) return `<button class="slot empty" ${attrs} aria-label="Empty ${label || 'slot'}">${label ? `<span class="lbl">${label}</span>` : ''}</button>`;
    const rar = s.inst && s.inst.rarity !== 'common';
    const q = item(s.id).stackable && s.qty > 1 ? `<span class="q">${s.qty >= 100000 ? Math.floor(s.qty / 1000) + 'k' : s.qty}</span>` : '';
    return `<button class="slot${rar ? ' rar' : ''}" style="--rc:${rarityColour(s)}" ${attrs} aria-label="${esc(displayName(s))}${s.qty > 1 ? ' × ' + s.qty : ''}" title="${esc(displayName(s))}"><img src="${itemIcon(s.id, s.qty)}" alt="">${q}${label ? `<span class="lbl">${label}</span>` : ''}</button>`;
  }

  private packHtml() {
    const g = this.game;
    const coins = count(g.p.inv, 'coins');
    const used = g.p.inv.filter(Boolean).length;
    return `<div class="row" style="justify-content:space-between;margin-bottom:8px"><h2 class="title" style="margin:0">Pack</h2><span class="muted" style="font-size:12px">${used}/28 · ${fmt(coins)} coins</span></div>
      <div class="grid28">${g.p.inv.map((s, i) => this.slotHtml(s, `data-slot="${i}"`)).join('')}</div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">${matchMedia('(pointer: fine)').matches ? 'Click to use or equip. Right-click for details.' : 'Tap an item for details and actions.'}</p>`;
  }

  private gearHtml() {
    const g = this.game, st = g.stats;
    const slots = SLOT_ORDER.map((sl) => this.slotHtml(g.p.equip[sl] ?? null, `data-equip="${sl}"`, sl)).join('');
    const stance = g.s.combat.stance;
    const stanceLabel: Record<Stance, [string, string]> = st.style === 'melee'
      ? { accurate: ['Accurate', 'Attack XP'], aggressive: ['Aggressive', 'Strength XP'], defensive: ['Defensive', 'Defence XP'] }
      : st.style === 'ranged'
        ? { accurate: ['Accurate', 'Ranged XP'], aggressive: ['Rapid', 'Ranged XP, faster'], defensive: ['Longrange', 'Ranged + Defence XP'] }
        : { accurate: ['Accurate', 'Magic XP'], aggressive: ['Focused', 'Magic XP'], defensive: ['Defensive', 'Magic + Defence XP'] };
    const stances = (['accurate', 'aggressive', 'defensive'] as Stance[]).map((k) => `<button data-stance="${k}" class="${stance === k ? 'on' : ''}"><b>${stanceLabel[k][0]}</b><small>${stanceLabel[k][1]}</small></button>`).join('');
    const spells = st.style === 'magic' ? `<h2 class="title" style="font-size:13px">Spell</h2><div class="stances spells">${SPELLS.map((sp) => `<button data-spell="${sp.id}" class="${st.spell?.id === sp.id ? 'on' : ''}" ${g.level('magic') < sp.level ? 'disabled' : ''}><b>${esc(sp.name)}</b><small>Lv ${sp.level} · max ${sp.maxHit} · ${sp.charms} charm${sp.charms > 1 ? 's' : ''}</small></button>`).join('')}</div>` : '';
    const ammo = st.style === 'ranged' ? (g.p.equip.ammo ? `${fmt(g.p.equip.ammo.qty)} × ${esc(item(g.p.equip.ammo.id).name)}` : '<span class="miss">No shot equipped</span>')
      : st.style === 'magic' ? `${fmt(count(g.p.inv, 'charm_tide'))} tide charms (${st.spell?.charms ?? 1} per cast)` : '';
    const sp = g.specialInfo();
    const rows: [string, string][] = [
      ['Combat level', String(st.combatLevel)], ['Style', cap(st.style)], ['Max hit', String(st.maxHit)], ['Attack speed', `${st.speed.toFixed(1)}s`],
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
    return `<h2 class="title">Equipment</h2><div class="equip five">${slots}</div>
      <h2 class="title" style="font-size:13px">Stance</h2><div class="stances">${stances}</div>${spells}
      ${ammo ? `<p class="muted" style="margin:6px 0;font-size:13px">Ammo: ${ammo}</p>` : ''}
      <div class="brass-rule"></div><div class="stats">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Every enemy is weak to one style: melee beats gunners, ranged beats brigands, magic beats crabs and the Guardian.</p>`;
  }

  private skillsHtml() {
    const g = this.game;
    let total = 0;
    const row = (sk: (typeof SKILLS)[number]) => {
      const xp = g.p.xp[sk.id], lvl = levelForXp(xp);
      total += lvl;
      const next = lvl >= MAX_LEVEL ? 'Maximum level' : `${fmt(Math.ceil(xpForLevel(lvl + 1) - xp))} XP to ${lvl + 1}`;
      const unlock = UNLOCKS[sk.id].find((u) => u.level > lvl);
      return `<div class="skill" title="${esc(sk.blurb)}"><b style="color:${sk.colour}">${sk.name}</b><span class="lv">${lvl}</span>
        <div class="xpbar" style="--c:${sk.colour}"><i style="width:${levelProgress(xp) * 100}%"></i></div>
        <small>${fmt(Math.floor(xp))} XP · ${next}${unlock ? `<br>Next: ${esc(unlock.text)} (${unlock.level})` : ''}</small></div>`;
    };
    const groups = (['Combat', 'Gathering', 'Production'] as const).map((grp) => `<h2 class="title" style="font-size:13px;margin:12px 0 0">${grp}</h2>${SKILLS.filter((s) => s.group === grp).map(row).join('')}`).join('');
    return `<div class="row" style="justify-content:space-between"><h2 class="title" style="margin:0">Skills</h2><span class="muted">Total ${total} · Combat ${g.stats.combatLevel}</span></div>${groups}
      <p class="muted" style="font-size:12px">RuneScape's XP curve: level 99 needs 13,034,431 XP, and levels continue to ${MAX_LEVEL} (200M XP).</p>`;
  }

  questObjective(): { x: number; z: number; text: string } | null {
    const g = this.game, L = g.layout;
    const stage = g.questStage('bell');
    const iven = L.npcs.find((n) => n.id === 'iven')!;
    if (stage === 0 || stage === 3) return { x: iven.x, z: iven.z, text: 'Iven Marr' };
    if (stage === 1) {
      if (count(g.p.inv, 'bar_bronze') > 0) return { x: iven.x, z: iven.z, text: 'Iven Marr' };
      if (count(g.p.inv, 'ore_copper') > 0 && count(g.p.inv, 'ore_tin') > 0) { const f = L.stations.find((s) => s.id === 'furnace')!; return { x: f.x, z: f.z, text: 'Furnace' }; }
      const rock = L.nodes.find((n) => n.def === (count(g.p.inv, 'ore_copper') ? 'rock_tin' : 'rock_copper'))!;
      return { x: rock.x, z: rock.z, text: 'Copperback Hills' };
    }
    if (stage === 2) return { x: L.plinth.x, z: L.plinth.z, text: 'The Broken Ring' };
    return null;
  }

  private questsHtml() {
    const g = this.game;
    const qs = Object.values(QUESTS).map((q) => {
      const st = g.questStage(q.id), last = q.stages.length - 1;
      const status = st === 0 ? '<span class="status todo">Not started</span>' : st >= last ? '<span class="status done">Complete</span>' : '<span class="status active">In progress</span>';
      return `<div class="quest"><b>${esc(q.name)}</b>${status}<p style="margin:6px 0">${esc(q.stages[st].text)}</p><small class="muted">Reward: ${esc(q.reward)}</small></div>`;
    }).join('');
    const disc = PLACES.map((p) => {
      if (!g.s.discovered.includes(p.id)) return '<li class="muted">Undiscovered</li>';
      const info = g.placeInfo(p.id);
      const foes = info.foes ? `<span class="miss">Foes ${info.foes[0]}${info.foes[1] > info.foes[0] ? `–${info.foes[1]}` : ''}</span>` : '<span class="muted">Peaceful</span>';
      const gather = info.gather.map((n) => `${esc(n.name)} ${n.level}`).join(', ');
      return `<li><b>${esc(p.name)}</b> · ${foes}${gather ? `<br><small class="muted">${gather}</small>` : ''}</li>`;
    }).join('');
    return `<h2 class="title">Quests</h2>${qs}<div class="brass-rule"></div><h2 class="title">Places (${g.s.discovered.length}/${PLACES.length})</h2><ul style="margin:0;padding-left:18px">${disc}</ul>`;
  }

  private settingsHtml() {
    const s = this.game.s.settings;
    const ago = this.lastSaved ? `${Math.round((Date.now() - this.lastSaved) / 1000)}s ago` : 'not yet';
    const fine = matchMedia('(pointer: fine)').matches;
    return `<h2 class="title">Settings</h2>
      <div class="toggle"><span>Graphics</span><span class="seg"><button data-q="high" class="${s.quality === 'high' ? 'on' : ''}">High</button><button data-q="low" class="${s.quality === 'low' ? 'on' : ''}">Battery saver</button></span></div>
      <div class="toggle"><span>Damage numbers</span><span class="seg"><button data-dmg="1" class="${s.showDamage ? 'on' : ''}">On</button><button data-dmg="0" class="${!s.showDamage ? 'on' : ''}">Off</button></span></div>
      <div class="toggle"><span>Progress saves automatically<br><small class="muted">Last saved ${ago}</small></span><button class="btn" id="saveNow">Save now</button></div>
      <div class="toggle"><span>Start a new voyage<br><small class="muted">Erases this browser's save</small></span><button class="btn" id="resetSave">Reset</button></div>
      <div class="brass-rule"></div><h2 class="title">Controls</h2>
      ${fine ? `<p>Click to walk, click things to use them. <kbd>WASD</kbd> also moves.<br><kbd>E</kbd> interact · <kbd>Space</kbd> dodge roll · <kbd>R</kbd> special attack · <kbd>I</kbd> <kbd>G</kbd> <kbd>K</kbd> <kbd>J</kbd> <kbd>M</kbd> tabs · <kbd>Esc</kbd> close · scroll to zoom.</p>`
        : '<p>Drag anywhere on the world to move. Tap things to walk to them and use them. The big round button does the nearest action; the two smaller ones are dodge roll and the special attack for your weapon. Pinch to zoom.</p>'}
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
    if (d.heal) lines.push(`Heals ${d.heal}`);
    if (d.tool) lines.push(`${cap(d.tool.skill)} tool, power ${d.tool.power}${d.tool.level > 1 ? `, needs level ${d.tool.level}` : ''}`);
    const affixes = (st.inst?.affixes ?? []).map((a) => `<li>${esc(AFFIXES[a.id].fmt(a.v))}</li>`).join('');
    const acts: string[] = [];
    if (this.pop.equip) acts.push('<button class="btn" data-a="unequip">Unequip</button>');
    else {
      if (d.heal) acts.push('<button class="btn primary" data-a="use">Eat</button>');
      if (e) acts.push(`<button class="btn primary" data-a="use" ${g.equipBlock(st) ? 'disabled' : ''}>Equip</button>`);
      if (this.shopOpen && !d.quest && st.id !== 'coins') {
        const each = g.sellPrice({ ...st, qty: 1 });
        acts.push(`<button class="btn" data-a="sell1">Sell 1 (${each}c)</button>`);
        if (st.qty > 1) acts.push(`<button class="btn" data-a="sellall">Sell all (${each * st.qty}c)</button>`);
      }
      if (this.bankOpen) acts.unshift('<button class="btn primary" data-a="deposit">Deposit</button>');
      if (!d.quest) acts.push('<button class="btn" data-a="drop">Drop</button>');
    }
    const req = e && g.equipBlock(st);
    morph(el, `<button class="x" aria-label="Close" style="position:absolute;right:6px;top:6px;width:34px;height:34px;border-radius:8px;background:#2a1e14;border:1px solid #120b06">×</button>
      <div class="nm" style="color:${rar ? rar.color : '#efe3c4'};padding-right:36px">${esc(displayName(st))}${st.qty > 1 ? ` × ${fmt(st.qty)}` : ''}</div>
      ${rar ? `<div class="rl" style="color:${rar.color}">${rar.label}${e ? ` ${e.slot}` : ''}</div>` : e ? `<div class="rl muted">${e.slot}</div>` : ''}
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
      if (a === 'drop') { g.dropSlot(i); this.closePop(); }
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
      onTap(el, '.x, [data-r], [data-buy], [data-c], [data-wd], [data-dep]', (b) => {
        if (b.classList.contains('x')) { this.closeWindows(); return; }
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
    this.shopOpen = false;
    this.bankOpen = false;
    document.getElementById('bankwin')?.remove();
    document.getElementById('stationwin')?.remove();
    document.getElementById('shopwin')?.remove();
    document.getElementById('confirm')?.remove();
    this.closePop();
    this.lastRev = -1;
  }

  anyWindowOpen() { return !!(this.station || this.shopOpen || this.bankOpen || this.dialog || document.getElementById('confirm')); }

  private openStation(st: Station) {
    this.closeWindows();
    this.station = st;
    this.renderStation();
  }

  private renderStation() {
    const g = this.game, st = this.station!;
    const title = st === 'furnace' ? 'Furnace: smelt bars' : st === 'anvil' ? 'Anvil: forge' : st === 'bench' ? 'Gunsmith\'s bench' : 'Cookfire: cook';
    const rows = RECIPES.filter((r) => r.station === st).map((r) => {
      const block = g.recipeBlock(r);
      const max = Math.min(...r.inputs.map((i) => Math.floor(count(g.p.inv, i.id) / i.qty)));
      const needs = r.inputs.map((i) => { const have = count(g.p.inv, i.id); return `<span class="${have < i.qty ? 'miss' : ''}">${i.qty}× ${esc(item(i.id).name)} (${have})</span>`; }).join(', ');
      const lvlOk = g.level(r.skill) >= r.level;
      const out = item(r.output.id);
      return `<div class="recipe"><img src="${itemIcon(r.output.id)}" alt=""><div><b>${esc(out.name)}</b><div class="need">${needs}<br><span class="${lvlOk ? '' : 'miss'}">${cap(r.skill)} ${r.level}</span> · ${r.xp} XP${r.rarityRoll ? ' · can roll Fine or Rare' : ''}${r.burn ? ' · may burn' : ''}</div>${block ? `<div class="need miss">${esc(block)}</div>` : ''}</div>
        <div class="btns"><button class="btn primary" data-r="${r.id}" data-n="1" ${block ? 'disabled' : ''}>Make 1</button><button class="btn" data-r="${r.id}" data-n="${Math.max(1, max)}" ${block || max < 2 ? 'disabled' : ''}>All (${Math.max(0, max)})</button></div></div>`;
    }).join('');
    const busy = g.action?.type === 'craft' ? `<p class="muted">Working... (${g.action.remaining} left)</p>` : '';
    this.win('stationwin', title, rows + busy);
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
    this.win('bankwin', 'Harbour strongbox', `<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="muted">${bank.length} stacks · tap an item in your pack to deposit it</span><button class="btn primary" data-dep="1">Deposit pack</button></div>${rows}`);
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
    const rows = SHOP.stock.map(({ id, qty }) => {
      const price = g.buyPrice(id);
      return `<div class="recipe"><img src="${itemIcon(id)}" alt=""><div><b>${qty > 1 ? `${qty} × ` : ''}${esc(item(id).name)}</b><div class="need">${esc(item(id).desc)}</div></div><div class="btns"><button class="btn primary" data-buy="${id}" ${coins < price ? 'disabled' : ''}>Buy ${price}c</button></div></div>`;
    }).join('');
    this.win('shopwin', SHOP.name, `<p class="muted" style="margin-top:0">You have ${fmt(coins)} coins. To sell, tap an item in your pack.</p>${rows}`);
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
    const n = NPCS[this.dialog.npc];
    const last = this.dialog.i >= this.dialog.lines.length - 1;
    el.innerHTML = `<div class="who">${esc(n.name)}<small>${esc(n.title)}</small></div><p>${esc(this.dialog.lines[this.dialog.i])}</p><div class="act"><button class="btn primary">${last ? 'Close' : 'Continue'}</button></div>`;
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
      if (NPCS[npc].shop && !this.shopOpen) this.openShop();
      return;
    }
    this.renderDialog();
  }

  get dialogOpen() { return !!this.dialog; }

  confirm(text: string, okLabel: string, ok: () => void) {
    const el = this.win('confirm', 'Are you sure?', `<p>${esc(text)}</p><div class="acts"><button class="btn" data-c="no">Cancel</button><button class="btn primary" data-c="yes">${esc(okLabel)}</button></div>`);
    this.confirmOk = ok;
    void el;
  }

  // ------------------------------------------------------------------ maps
  private buildMinimapBase() {
    const S = 640, k = S / (WORLD_HALF * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(S, S);
    const w = this.game.world;
    const village = FLATS[0];
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = i / k - WORLD_HALF, z = j / k - WORLD_HALF;
        const y = w.standY(x, z);
        let col: [number, number, number];
        if (w.deckAt(x, z)) col = [140, 104, 66];
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
    for (const b of this.game.layout.buildings) { c.fillRect((b.x + WORLD_HALF) * k - 4, (b.z + WORLD_HALF) * k - 3, 8, 6); }
    c.fillStyle = '#2a2a28';
    for (const r of this.game.layout.reefs) { c.beginPath(); c.arc((r.x + WORLD_HALF) * k, (r.z + WORLD_HALF) * k, 2, 0, 7); c.fill(); }
    this.mmBase = cv;
  }

  private drawMarkers(c: CanvasRenderingContext2D, toPx: (x: number, z: number) => [number, number], scale: number, big: boolean) {
    const g = this.game;
    const dot = (x: number, z: number, r: number, fill: string) => { const [px, py] = toPx(x, z); c.beginPath(); c.arc(px, py, r, 0, 7); c.fillStyle = fill; c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke(); };
    for (const n of g.nodes) if (n.def.startsWith('spot_') && n.depletedUntil <= g.time) dot(n.x, n.z, big ? 4 : 2.5 * scale, '#9fe8ff');
    for (const n of g.layout.npcs) dot(n.x, n.z, (big ? 4.5 : 3) * scale, '#ffe066');
    for (const e of g.enemies) if (e.alive) dot(e.x, e.z, (e.def.boss ? 6 : big ? 3 : 2.2) * scale, e.def.boss ? '#ff4a3a' : '#e05a44');
    for (const d of g.drops) dot(d.x, d.z, 2 * scale, '#f2cf5b');
    const [sx, sz] = toPx(g.ship.x, g.ship.z);
    c.save(); c.translate(sx, sz); c.rotate(g.ship.heading);
    c.fillStyle = '#efe3c4'; c.strokeStyle = '#000'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(7 * scale, 0); c.lineTo(-5 * scale, 3.5 * scale); c.lineTo(-5 * scale, -3.5 * scale); c.closePath(); c.fill(); c.stroke();
    c.restore();
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

  private readonly MM_RANGE = 34; // metres from centre to edge
  private readonly MAP_SPAN = 216; // metres shown edge to edge on the big map (the island plus a margin of sea)
  private drawMinimap() {
    const cv = this.mmCtx.canvas, c = this.mmCtx, W = cv.width;
    const g = this.game;
    const k = this.mmBase.width / (WORLD_HALF * 2);
    const cx = g.p.x, cz = g.p.z, R = this.MM_RANGE;
    c.fillStyle = '#1a566b';
    c.fillRect(0, 0, W, W);
    c.drawImage(this.mmBase, (cx - R + WORLD_HALF) * k, (cz - R + WORLD_HALF) * k, R * 2 * k, R * 2 * k, 0, 0, W, W);
    const toPx = (x: number, z: number): [number, number] => [((x - cx) / (R * 2) + 0.5) * W, ((z - cz) / (R * 2) + 0.5) * W];
    this.drawMarkers(c, toPx, W / 140, false);
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
    // show the island region, not the whole sea
    const span = this.MAP_SPAN, ox = -span / 2, oz = -span / 2;
    const k = this.mmBase.width / (WORLD_HALF * 2);
    c.drawImage(this.mmBase, (ox + WORLD_HALF) * k, (oz + WORLD_HALF) * k, span * k, span * k, 0, 0, W, W);
    const toPx = (x: number, z: number): [number, number] => [((x - ox) / span) * W, ((z - oz) / span) * W];
    c.font = '600 15px Georgia, serif';
    c.textAlign = 'center';
    for (const p of PLACES) {
      if (!this.game.s.discovered.includes(p.id)) continue;
      const [x, y] = toPx(p.x, p.z);
      c.lineWidth = 4; c.strokeStyle = '#1a120a'; c.strokeText(p.name, x, y - 12);
      c.fillStyle = p.sea ? '#bfefff' : '#ffe9b8'; c.fillText(p.name, x, y - 12);
    }
    this.drawMarkers(c, toPx, 1.6, true);
  }

  private bindBigMap() {
    const cv = document.getElementById('mapbig') as HTMLCanvasElement;
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const span = this.MAP_SPAN;
      const x = -span / 2 + ((e.clientX - r.left) / r.width) * span, z = -span / 2 + ((e.clientY - r.top) / r.height) * span;
      this.game.moveTo(x, z);
      this.r.markClick(x, z);
      if (this.portrait) { this.sideOpen = false; this.layout(); }
    });
  }
}
