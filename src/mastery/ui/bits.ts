// The smallest pieces of the pages, apart so the shelf can draw without loading the rest of them.
import { h } from '../../core/dom';
import { DAY } from '../domain/model';
import type { Learner } from '../learner';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A thin bar of how much of `total` is done. */
export function progressBar(done: number, total: number, cls: string): HTMLElement {
  const fill = h('i');
  fill.style.width = `${total ? (done / total) * 100 : 0}%`;
  return h('div', { class: cls, role: 'progressbar', 'aria-valuenow': String(done), 'aria-valuemax': String(total) }, fill);
}

/** How many of a learner's concepts wait on a review. */
export const dueCount = (learner: Learner): number => [...learner.statuses().values()].filter((s) => s === 'due' || s === 'slipping').length;

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

/** The minutes the due reviews take: one problem each, at about the pace a concept's bar asks for. */
export function reviewMinutes(learner: Learner): number {
  const st = learner.statuses();
  return learner.graph.order.filter((c) => st.get(c.id) === 'due').reduce((a, c) => a + c.mastery.seconds * 1.5, 0) / 60;
}
