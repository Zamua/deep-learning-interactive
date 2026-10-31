import { ALL_SYMBOLS, SCOPED } from '../../atlas/symbols';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { md, setMacros } from '../../core/math';
import { codeIndex, linkSymbols, symbolMacros } from '../../core/symbols';
import { DAY, type Status } from '../domain/model';
import { routes } from '../../routes';

const symIdx = codeIndex(ALL_SYMBOLS);

/** Colors for symbols a concept redefines, inside an element marked with its `data-concept`. */
const scopedCss = Object.entries(SCOPED)
  .flatMap(([id, syms]) => Object.entries(syms).map(([k, d]) => `[data-concept="${id}"] .sym.sym-${k}{--sym:var(--c-${d.color});color:var(--sym)}`))
  .join('\n');

/** A page root with the course's symbols wired up: colors, `\sym` macros and, unless `link` is off, tap-to-name. */
export function atlasRoot(cls: string, page = 'atlas', link = true): HTMLElement {
  setMacros(symbolMacros(ALL_SYMBOLS));
  const root = h('div', { class: `atlas ${cls}`, 'data-page': page }, h('style', {}, scopedCss));
  // linkSymbols needs the root in the page for its tip; the caller appends it right away.
  if (link) queueMicrotask(() =>
    linkSymbols(root, ALL_SYMBOLS, (k, el) => SCOPED[(el.closest('[data-concept]') as HTMLElement | null)?.dataset.concept ?? '']?.[k]));
  return root;
}

/** The course's markdown dialect with its symbols. */
export const render = (src: string): string => md(src, symIdx);

export const STATUS_LABEL: Record<Status, string> = {
  locked: 'Locked',
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
  due: 'Review due',
  slipping: 'Slipping',
};

/** `n` dots with the first `k` lit: a streak toward the bar. */
export function dots(k: number, n: number): HTMLElement {
  const el = h('span', { class: 'at-dots', 'aria-label': `${k} of ${n}` });
  for (let i = 0; i < n; i++) el.append(h('i', { class: i < k ? 'on' : '' }));
  return el;
}

/** "today", "tomorrow", "in 3 days", for a future time. */
export function whenDue(due: number, now = Date.now()): string {
  const days = Math.ceil((due - now) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A way to the page that lists every concept open to start. */
export function pickLink(text: string): HTMLElement {
  const a = h('a', { class: 'at-pick-link', href: routes.next, html: icon('compass') });
  a.append(h('span', {}, text));
  return a;
}
