import { CodePanel } from '../core/code';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import { tex } from '../core/math';
import { mmss } from '../core/format';
import { plainName, type SymbolMap } from '../core/symbols';
import { LIBRARY } from './library';
import { callKey, type GlossEntry, type Glossary, MODULES } from './glossary';
import type { Beat, Paper } from './types';

/** Something a viewer can look up: a symbol by its key, or a call by its glossary key. */
export interface Term {
  kind: 'sym' | 'fn';
  key: string;
}

/** A mark of notation, explained by the course hosting the lecture. */
export interface Note {
  /** Rendered TeX. */
  glyph: string;
  name: string;
  about: string;
  /** Where it was first explained, when that was earlier. */
  from?: string;
}

export interface LookupHost {
  root: HTMLElement;
  /** Taps on symbols and calls in here open their card. */
  codeBox: HTMLElement;
  /** The return pill floats above this. */
  bar: HTMLElement;
  panels: CodePanel[];
  /** Per scene, the elements drawn over the picture that may hold symbols. */
  marks: HTMLElement[][];
  scenes: { title: string; start: number; beats: { start: number; code?: Beat['code'] }[] }[];
  symbols: SymbolMap;
  glossary: Glossary;
  /** The notation scene `i` uses. */
  notes?(i: number): Note[];
  /** The papers scene `i` names. */
  papers?(i: number): Paper[];
  scene(): number;
  time(): number;
  playing(): boolean;
  play(): void;
  pause(): void;
  seek(t: number): void;
}

const id = (t: Term) => `${t.kind}:${t.key}`;
const sentence = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}${/[.?!]$/.test(s) ? '' : '.'}`;

/** The term a code or mark element stands for, if any. */
export function termOf(el: Element | null): Term | null {
  const s = el?.closest('.sym');
  if (s) {
    for (const c of s.classList) if (c.startsWith('sym-') && c !== 'sym-lit') return { kind: 'sym', key: c.slice(4) };
  }
  const f = el?.closest('.tk-fn');
  const src = f?.closest('.ln-src');
  if (!f || !src) return null;
  const r = document.createRange();
  r.setStart(src, 0);
  r.setEndBefore(f);
  return { kind: 'fn', key: callKey(r.toString(), f.textContent ?? '') };
}

/** Distinct terms under `els`, in document order. */
export function termsIn(els: Element[]): Term[] {
  const seen = new Map<string, Term>();
  for (const el of els) {
    for (const e of el.querySelectorAll('.sym, .tk-fn')) {
      const t = termOf(e);
      if (t && !seen.has(id(t))) seen.set(id(t), t);
    }
  }
  return [...seen.values()];
}

/**
 * Lookup cards for a lecture: tapping a symbol or call in the code opens its card, and
 * `showScene` lists everything in the current scene. Both pause playback while open.
 */
export function mountLookup(host: LookupHost): { showScene(): void; tick(t: number): void; entry(t: Term): GlossEntry | undefined; terms(i: number, all?: boolean): Term[] } {
  const entry = (t: Term): GlossEntry | undefined => (t.kind === 'fn' ? (host.glossary[t.key] ?? LIBRARY[t.key]) : undefined);
  const known = (t: Term) => (t.kind === 'sym' ? !!host.symbols[t.key] : !!entry(t));

  // Lines holding each term, per scene, for finding where a term first came in.
  const where = host.panels.map((p) => {
    const m = new Map<string, Set<number>>();
    p.lines.forEach((src, i) => {
      for (const t of termsIn([src])) m.set(id(t), (m.get(id(t)) ?? new Set()).add(i + 1));
    });
    return m;
  });
  const terms = (i: number, all = false): Term[] => termsIn([host.panels[i]!.el, ...host.marks[i]!]).filter((t) => all || known(t));

  /** When the narration first lit a line holding `t`, else the start of the first scene showing it. */
  function cameIn(t: Term): number | null {
    for (const [i, s] of host.scenes.entries()) {
      const lines = where[i]!.get(id(t));
      if (!lines && !host.marks[i]!.some((m) => termsIn([m]).some((x) => id(x) === id(t)))) continue;
      const b = lines && s.beats.find((b) => b.code !== undefined && host.panels[i]!.resolve(b.code).some((n) => lines.has(n)));
      return b ? b.start : s.start + 0.01;
    }
    return null;
  }

  const scrim = h('div', { class: 'lk-scrim' });
  const sheet = h('div', { class: 'lk-sheet', role: 'dialog', 'aria-modal': 'true' });
  const back = h('button', { class: 'lec-return', type: 'button' });
  host.root.append(scrim, sheet);
  host.bar.append(back);

  let open = false;
  let resume = false;
  let returnTo: number | null = null;

  function show(content: HTMLElement[], label: string): void {
    if (!open) {
      open = true;
      resume = host.playing();
      host.pause();
      host.root.classList.add('lk-open');
    }
    sheet.setAttribute('aria-label', label);
    sheet.replaceChildren(...content);
    sheet.scrollTop = 0;
    sheet.querySelector<HTMLElement>('.lk-x')?.focus({ preventScroll: true });
  }

  function close(andResume = true): void {
    if (!open) return;
    open = false;
    host.root.classList.remove('lk-open');
    if (andResume && resume) host.play();
  }

  const closeBtn = () => h('button', { class: 'lk-x', type: 'button', 'aria-label': 'Close', html: icon('x'), onclick: () => close() });

  function token(t: Term): HTMLElement {
    if (t.kind === 'fn') return h('span', { class: 'lk-tok lk-mono' }, t.key);
    return h('span', { class: 'lk-tok', html: tex(`\\sym${t.key}`) });
  }

  function card(t: Term, from?: number): void {
    const head = h('div', { class: 'lk-head' });
    if (from !== undefined) head.append(h('button', { class: 'lk-back', type: 'button', 'aria-label': 'Back to the list', html: icon('arrowLeft'), onclick: () => list(from) }));
    head.append(token(t));
    const body: HTMLElement[] = [];
    if (t.kind === 'sym') {
      const d = host.symbols[t.key]!;
      body.push(h('p', { class: 'lk-lead' }, sentence(plainName(d.name))));
      if (d.about) body.push(h('p', {}, d.about));
    } else {
      const lib = MODULES[t.key.split('.')[0]!];
      if (lib) head.append(h('span', { class: 'lk-tag' }, lib));
      const e = entry(t);
      body.push(h('p', { class: 'lk-lead' }, e ? sentence(e.is) : 'No note for this one yet.'));
      if (e?.more) body.push(h('p', {}, e.more));
      if (e?.eg) body.push(new CodePanel(e.eg, { bare: true }).el);
    }
    head.append(closeBtn());
    const at = cameIn(t);
    if (at !== null && at < host.time() - 2) {
      body.push(h('div', { class: 'lk-btns' }, h('button', {
        class: 'lk-btn',
        type: 'button',
        html: `${icon('reset')}<span>Replay where it came in</span><small>${mmss(at)}</small>`,
        onclick: () => replay(at),
      })));
    }
    show([head, ...body], t.kind === 'sym' ? plainName(host.symbols[t.key]!.name) : t.key);
  }

  function noteCard(n: Note, from: number): void {
    const head = h('div', { class: 'lk-head' },
      h('button', { class: 'lk-back', type: 'button', 'aria-label': 'Back to the list', html: icon('arrowLeft'), onclick: () => list(from) }),
      h('span', { class: 'lk-tok', html: n.glyph }),
      closeBtn());
    const body = [h('p', { class: 'lk-lead' }, sentence(n.name)), h('p', {}, n.about)];
    if (n.from) body.push(h('p', { class: 'lk-from' }, `First explained in ${n.from}.`));
    show([head, ...body], n.name);
  }

  function list(i: number): void {
    const ts = terms(i);
    const rows = (kind: Term['kind']) => ts.filter((t) => t.kind === kind).map((t) => h('button', { class: 'lk-row', type: 'button', onclick: () => card(t, i) },
      token(t),
      h('span', { class: 'lk-what' }, t.kind === 'sym' ? plainName(host.symbols[t.key]!.name) : entry(t)!.is)));
    const syms = rows('sym');
    const fns = rows('fn');
    const notes = (host.notes?.(i) ?? []).map((n) => h('button', { class: 'lk-row', type: 'button', onclick: () => noteCard(n, i) },
      h('span', { class: 'lk-tok', html: n.glyph }),
      h('span', { class: 'lk-what' }, n.name)));
    const content: HTMLElement[] = [h('div', { class: 'lk-head' }, h('span', { class: 'lk-title' }, 'In this scene'), h('span', { class: 'lk-tag' }, host.scenes[i]!.title), closeBtn())];
    if (notes.length) content.push(h('div', { class: 'lk-sec' }, 'Notation'), h('div', { class: 'lk-list' }, ...notes));
    if (syms.length) content.push(h('div', { class: 'lk-sec' }, 'Symbols'), h('div', { class: 'lk-list' }, ...syms));
    if (fns.length) content.push(h('div', { class: 'lk-sec' }, 'Functions'), h('div', { class: 'lk-list' }, ...fns));
    const papers = (host.papers?.(i) ?? []).map((p) => h('a', { class: 'lk-row', href: p.url, target: '_blank', rel: 'noopener' },
      h('span', { class: 'lk-tok' }, String(p.year)),
      h('span', { class: 'lk-what' }, `${p.who}: ${p.title}`)));
    if (papers.length) content.push(h('div', { class: 'lk-sec' }, 'Papers'), h('div', { class: 'lk-list' }, ...papers));
    if (!notes.length && !syms.length && !fns.length && !papers.length) content.push(h('p', { class: 'lk-lead' }, 'Nothing to look up in this scene.'));
    show(content, `In this scene: ${host.scenes[i]!.title}`);
  }

  function replay(at: number): void {
    const from = host.time();
    close(false);
    host.seek(at);
    host.play();
    returnTo = from;
    back.innerHTML = `${icon('arrowRight')}<span>Back to ${mmss(from)}</span>`;
    host.root.classList.add('lk-return');
  }

  back.addEventListener('click', () => {
    if (returnTo !== null) host.seek(returnTo);
    returnTo = null;
    host.root.classList.remove('lk-return');
  });

  scrim.addEventListener('click', () => close());
  host.codeBox.addEventListener('click', (e) => {
    const t = termOf(e.target as Element);
    if (!t || !known(t)) return;
    // The symbol linker's own tap tip would sit on top of the card.
    e.stopPropagation();
    card(t);
  });
  const onKey = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  onDispose(() => window.removeEventListener('keydown', onKey, true));

  return {
    showScene: () => list(host.scene()),
    tick(t) {
      if (returnTo !== null && t >= returnTo) {
        returnTo = null;
        host.root.classList.remove('lk-return');
      }
    },
    entry,
    terms,
  };
}
