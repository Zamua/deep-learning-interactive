// The smallest pieces of the pages, apart so the shelf can draw without loading the rest of them.
import { h } from '../../core/dom';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A thin bar of how much of `total` is done. */
export function progressBar(done: number, total: number, cls: string): HTMLElement {
  const fill = h('i');
  fill.style.width = `${total ? (done / total) * 100 : 0}%`;
  return h('div', { class: cls, role: 'progressbar', 'aria-valuenow': String(done), 'aria-valuemax': String(total) }, fill);
}
