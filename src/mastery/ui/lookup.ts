// What a symbol means, in practice: tap one for its card, or open the sheet listing every symbol
// on screen. Covers the colored `\sym` letters and the notation in src/atlas/notation.ts.
import { GRAPH } from '../../atlas/index';
import { NOTATION } from '../../atlas/notation';
import { ALL_SYMBOLS, SCOPED } from '../../atlas/symbols';
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { tex } from '../../core/math';

interface Term {
  kind: 'sym' | 'nt';
  key: string;
}

interface Card {
  glyph: string;
  name: string;
  about: string;
  /** The concept whose explainer first gave this meaning, when it is not the current one. */
  from?: string;
}

/** Single-character marks, as KaTeX renders them. */
const GLYPHS: Record<string, string> = {
  '∂': 'partial', '∇': 'nabla', '∑': 'sum', '∥': 'norm', '⊤': 'transpose', '⊙': 'hadamard', '≈': 'approx',
  '←': 'assign', '→': 'arrow', '≤': 'ineq', '≥': 'ineq', '∞': 'infinity', '∈': 'member', '∼': 'sim', '′': 'prime', 'Δ': 'delta',
};
const OPERATORS: Record<string, string> = { max: 'max', min: 'max', ln: 'log', log: 'log', exp: 'exp' };
const ACCENTS: Record<string, string> = { '^': 'hat', 'ˉ': 'bar' };
const BLACKBOARD: Record<string, string> = { R: 'reals', E: 'expect' };

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', ell: 'ℓ', omega: 'ω',
};

/** A symbol's TeX as its rendered letter and subscript, when it is that simple (`m`, `\\beta_1`, `W_U`). */
function letter(src: string): [string, string] | null {
  const m = src.match(/^(?:\\([a-z]+)|([A-Za-z]))(?:_\{?([A-Za-z0-9]+)\}?)?$/);
  const base = m && (m[1] ? GREEK[m[1]] : m[2]);
  return base ? [base, m[3] ?? ''] : null;
}

const tag = (el: Element | null | undefined, key: string) => {
  if (el && !el.closest('.nt')) el.classList.add('nt', `nt-${key}`);
};

/**
 * Marks the notation in rendered math under `root` (idempotent), so a tap can name it, and the
 * plain letters that `concept` gives a scoped meaning but its text writes without `\\sym`.
 */
export function markNotation(root: HTMLElement, concept: string): void {
  const scoped = Object.entries(SCOPED[concept] ?? {}).flatMap(([k, d]) => {
    const l = letter(d.tex ?? k);
    return l ? [{ key: k, base: l[0], sub: l[1] }] : [];
  });
  if (scoped.length) {
    for (const el of root.querySelectorAll('.katex-html span')) {
      if (el.children.length || el.closest('.sym, .ltr')) continue;
      const sup = el.nextElementSibling?.classList.contains('msupsub') ? el.nextElementSibling : null;
      const sub = (sup?.textContent ?? '').replace(/\u200b/g, '');
      const hit = scoped.find((s) => s.base === el.textContent && s.sub && s.sub === sub);
      const plain = scoped.find((s) => s.base === el.textContent && !s.sub);
      if (hit) el.parentElement?.classList.add('ltr', `ltr-${hit.key}`);
      else if (plain) el.classList.add('ltr', `ltr-${plain.key}`);
    }
  }
  for (const f of root.querySelectorAll('.katex-html .mfrac')) {
    const parts = [...(f.querySelector('.vlist')?.children ?? [])].map((c) => c.textContent ?? '').filter(Boolean);
    if (parts.length !== 2) continue;
    if (parts.every((p) => p.startsWith('∂'))) {
      tag(f, 'partial');
      for (const leaf of f.querySelectorAll('span')) if (leaf.textContent === '∂' && !leaf.children.length) leaf.classList.add('nt-u');
    } else if (parts.every((p) => /^d[a-zA-Zα-ω]/.test(p))) tag(f, 'leibniz');
  }
  for (const el of root.querySelectorAll('.katex-html .sqrt')) tag(el, 'sqrt');
  for (const el of root.querySelectorAll('.katex-html .accent')) tag(el, ACCENTS[el.querySelector('.accent-body')?.textContent ?? ''] ?? '');
  for (const el of root.querySelectorAll('.katex-html .mathbb')) if (BLACKBOARD[el.textContent ?? '']) tag(el, BLACKBOARD[el.textContent!]!);
  for (const el of root.querySelectorAll('.katex-html .rlap')) tag(el.closest('.mrel')?.parentElement?.closest('.mrel'), 'neq');
  for (const el of root.querySelectorAll('.katex-html .mop:not(.mtight)')) if (OPERATORS[el.textContent ?? '']) tag(el, OPERATORS[el.textContent!]!);
  for (const el of root.querySelectorAll<HTMLElement>('.katex-html span')) {
    if (el.children.length) continue;
    const t = el.textContent ?? '';
    if (GLYPHS[t]) tag(el, GLYPHS[t]);
    else if (t === 'e' && el.classList.contains('mathnormal') && el.nextElementSibling?.classList.contains('msupsub')) tag(el.parentElement, 'exp');
  }
  for (const el of root.querySelectorAll('.nt')) if (![...el.classList].some((c) => c.startsWith('nt-') && c !== 'nt-u' && NOTATION[c.slice(3)])) el.classList.remove('nt');
}

function termOf(el: Element | null): [Term, Element] | null {
  const t = el?.closest('.sym, .nt, .ltr');
  if (!t) return null;
  for (const c of t.classList) {
    if (t.classList.contains('ltr') && c.startsWith('ltr-')) return [{ kind: 'sym', key: c.slice(4) }, t];
    if (t.classList.contains('nt') && c.startsWith('nt-') && c !== 'nt-u') return [{ kind: 'nt', key: c.slice(3) }, t];
    if (t.classList.contains('sym') && c.startsWith('sym-') && c !== 'sym-lit') return [{ kind: 'sym', key: c.slice(4) }, t];
  }
  return null;
}

function chain(id: string, seen = new Set<string>([id])): Set<string> {
  for (const p of GRAPH.get(id)?.prereqs ?? []) if (!seen.has(p)) chain(p, seen.add(p));
  return seen;
}

function card(t: Term, concept: string): Card | null {
  if (t.kind === 'sym') {
    const d = SCOPED[concept]?.[t.key] ?? ALL_SYMBOLS[t.key];
    if (!d) return null;
    return { glyph: tex(`\\sym{${t.key}}{${d.tex ?? t.key}}`), name: d.name.replace(/^[^:]{1,14}:\s*/, ''), about: d.about ?? '' };
  }
  const n = NOTATION[t.key];
  if (!n) return null;
  const known = chain(concept);
  const from = GRAPH.order.filter((c) => n.from.includes(c.id) && known.has(c.id)).pop();
  return { glyph: tex(n.glyph), name: n.name, about: n.about, from: from && from.id !== concept ? from.title : undefined };
}

const keyOf = (t: Term) => `${t.kind}:${t.key}`;

/**
 * Wires symbol lookup into a practice frame: a tap on a symbol in `body` opens its card, and
 * `button` opens a sheet of every symbol on screen. `body.dataset.concept` picks scoped meanings.
 */
export function wireLookup(root: HTMLElement, body: HTMLElement, button: HTMLElement): void {
  let close: (() => void) | null = null;
  let sheetOpen = false;
  const dismiss = () => close?.();
  const concept = () => body.dataset.concept ?? '';
  const terms = () => {
    const seen = new Map<string, Term>();
    for (const el of body.querySelectorAll('.sym, .nt, .ltr')) {
      const t = termOf(el);
      if (t && card(t[0], concept())) seen.set(keyOf(t[0]), t[0]);
    }
    return [...seen.values()];
  };
  const refresh = () => {
    markNotation(body, concept());
    button.hidden = !terms().length;
  };
  const watch = new MutationObserver(refresh);
  watch.observe(body, { childList: true, subtree: true });

  const open = (el: HTMLElement, onClose: () => void) => {
    dismiss();
    root.append(el);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    const outside = (e: Event) => {
      if (!el.contains(e.target as Node) && !button.contains(e.target as Node)) dismiss();
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => document.addEventListener('click', outside), 0);
    body.addEventListener('scroll', dismiss, { passive: true });
    close = () => {
      close = null;
      el.remove();
      onClose();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', outside);
      body.removeEventListener('scroll', dismiss);
    };
  };

  const showCard = (t: Term, at: Element) => {
    const c = card(t, concept());
    if (!c) return;
    const el = h('div', { class: 'at-lk-card', role: 'dialog', 'aria-label': c.name },
      h('div', { class: 'at-lk-row' }, h('span', { class: 'at-lk-glyph', html: c.glyph }), h('span', { class: 'at-lk-name' }, c.name)),
      c.about ? h('p', { class: 'at-lk-about' }, c.about) : '',
      c.from ? h('div', { class: 'at-lk-from' }, 'First explained in ', h('b', {}, c.from)) : '');
    at.classList.add('at-lk-on');
    open(el, () => at.classList.remove('at-lk-on'));
    // Below the whole block the symbol sits in, so the card never hides the rest of the question.
    const r = at.getBoundingClientRect();
    const block = (at.closest('.at-prompt, li, p, .at-right, .at-choice') ?? at).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const below = block.bottom + 10 + box.height < window.innerHeight * 0.8 || block.top - 10 - box.height < 0;
    el.style.top = `${below ? block.bottom + 10 : block.top - 10 - box.height}px`;
    el.classList.toggle('above', !below);
    el.style.setProperty('--tip', `${Math.max(18, Math.min(box.width - 18, r.left + r.width / 2 - box.left))}px`);
  };

  const showSheet = () => {
    const ts = terms();
    const row = (t: Term) => {
      const c = card(t, concept())!;
      return h('div', { class: 'at-lk-item' },
        h('span', { class: 'at-lk-glyph', html: c.glyph }),
        h('span', { class: 'at-lk-name' }, c.name),
        c.about || c.from ? h('span', { class: 'at-lk-about' }, c.about, c.from ? ` First explained in ${c.from}.` : '') : '');
    };
    const group = (label: string, list: Term[]) => (list.length ? [h('div', { class: 'at-lk-sec' }, label), ...list.map(row)] : []);
    const x = h('button', { type: 'button', class: 'at-lk-x', 'aria-label': 'Close', html: icon('close') });
    const sheet = h('div', { class: 'at-lk-sheet', role: 'dialog', 'aria-label': 'Symbols in this problem' },
      h('div', { class: 'at-lk-head' }, h('h3', {}, 'Symbols in this problem'), x),
      h('div', { class: 'at-lk-list' },
        ...group('Notation', ts.filter((t) => t.kind === 'nt')),
        ...group('Letters', ts.filter((t) => t.kind === 'sym'))));
    const wrap = h('div', { class: 'at-lk-wrap' }, h('div', { class: 'at-lk-scrim' }), sheet);
    x.addEventListener('click', dismiss);
    wrap.firstElementChild!.addEventListener('click', dismiss);
    open(wrap, () => {
      sheetOpen = false;
      button.setAttribute('aria-expanded', 'false');
    });
    sheetOpen = true;
    button.setAttribute('aria-expanded', 'true');
  };

  body.addEventListener('click', (e) => {
    // A symbol on an answer button belongs to the answer; the sheet still explains it.
    const t = (e.target as Element).closest('button') ? null : termOf(e.target as Element);
    if (!t) return;
    e.stopPropagation();
    showCard(...t);
  });
  button.addEventListener('click', () => (sheetOpen ? dismiss() : showSheet()));
  onDispose(() => {
    watch.disconnect();
    dismiss();
  });
  refresh();
}
