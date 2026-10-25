import { ATLAS_SYMBOLS } from '../../atlas/symbols';
import { h } from '../../core/dom';
import { md, setMacros } from '../../core/math';
import { codeIndex, linkSymbols, symbolMacros } from '../../core/symbols';
import { DAY, type Status } from '../domain/model';

const symIdx = codeIndex(ATLAS_SYMBOLS);

/** A page root with the course's symbols wired up: colors, `\sym` macros and tap-to-name. */
export function atlasRoot(cls: string, page = 'atlas'): HTMLElement {
  setMacros(symbolMacros(ATLAS_SYMBOLS));
  const root = h('div', { class: `atlas ${cls}`, 'data-page': page });
  // linkSymbols needs the root in the page for its tip; the caller appends it right away.
  queueMicrotask(() => linkSymbols(root, ATLAS_SYMBOLS));
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
