import type { Course } from '../../courses/course';
import { symbolsOf } from '../../courses/symbols';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { md, setMacros } from '../../core/math';
import { codeIndex, linkSymbols, symbolMacros } from '../../core/symbols';
import { DAY, type Status } from '../domain/model';
import type { Learner } from '../learner';

export { plural, progressBar } from './bits';

/** How many of a learner's concepts wait on a review. */
export const dueCount = (learner: Learner): number => [...learner.statuses().values()].filter((s) => s === 'due' || s === 'slipping').length;

const seen = new Map<string, ReturnType<typeof dressing>>();

function dressing(course: Course) {
  const { all, scoped } = symbolsOf(course.id);
  return {
    all,
    scoped,
    index: codeIndex(all),
    macros: symbolMacros(all),
    /** Colors for symbols a concept redefines, inside an element marked with its `data-concept`. */
    css: Object.entries(scoped)
      .flatMap(([id, syms]) => Object.entries(syms).map(([k, d]) => `[data-concept="${id}"] .sym.sym-${k}{--sym:var(--c-${d.color});color:var(--sym)}`))
      .join('\n'),
  };
}

function dressed(course: Course) {
  let d = seen.get(course.id);
  if (!d) seen.set(course.id, (d = dressing(course)));
  return d;
}

/** A page root with the course's symbols wired up: colors, `\sym` macros and, unless `link` is off, tap-to-name. */
export function atlasRoot(course: Course, cls: string, page = 'atlas', link = true): HTMLElement {
  const d = dressed(course);
  setMacros(d.macros);
  const root = h('div', { class: `atlas ${cls}`, 'data-page': page }, h('style', {}, d.css));
  // linkSymbols needs the root in the page for its tip; the caller appends it right away.
  if (link) queueMicrotask(() =>
    linkSymbols(root, d.all, (k, el) => d.scoped[(el.closest('[data-concept]') as HTMLElement | null)?.dataset.concept ?? '']?.[k]));
  return root;
}

/** The course's markdown dialect with its symbols. */
export const render = (course: Course, src: string): string => md(src, dressed(course).index);

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


const NUMERALS: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** A part's number as a book would print it. */
export function roman(n: number): string {
  let out = '';
  for (const [value, mark] of NUMERALS) for (; n >= value; n -= value) out += mark;
  return out;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A small count in words, as a sentence reads; larger ones stay digits. */
export const spell = (n: number): string => WORDS[n] ?? String(n);

export const sentence = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

/** The minutes the due reviews take: one problem each, at about the pace a concept's bar asks for. */
export function reviewMinutes(learner: Learner): number {
  const st = learner.statuses();
  return learner.graph.order.filter((c) => st.get(c.id) === 'due').reduce((a, c) => a + c.mastery.seconds * 1.5, 0) / 60;
}

/** A way to the page that lists every concept open to start. */
export function pickLink(course: Course, text: string): HTMLElement {
  const a = h('a', { class: 'at-pick-link', href: course.routes.next, html: icon('compass') });
  a.append(h('span', {}, text));
  return a;
}
