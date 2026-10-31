import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import { DONE, type LectureLog } from './progress';
import type { TScene } from './timeline';

export interface Sections {
  button: HTMLElement;
  list: HTMLElement;
  /** Marks scene `i` as the one playing. */
  mark(i: number): void;
  /** Opens or closes the list; flips it without `on`. */
  toggle(on?: boolean): void;
}

/** The list of sections, each a jump to its start, with the ones already heard checked. */
export function mountSections(o: {
  root: HTMLElement;
  scenes: TScene[];
  log: Pick<LectureLog, 'heardIn'>;
  seek(t: number): void;
  mmss(t: number): string;
}): Sections {
  const { root, scenes } = o;
  const button = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Sections', html: icon('list') });
  const list = h('div', { class: 'lec-list', role: 'dialog', 'aria-label': 'Sections' });
  const items = scenes.map((s, i) => {
    const b = h('button', { type: 'button', class: 'lec-li' }, h('span', { class: 'lec-li-n' }, String(i + 1)), h('span', { class: 'lec-li-t' }, s.title), h('span', { class: 'lec-li-done', 'aria-label': 'heard', html: icon('check') }), h('span', { class: 'lec-li-time' }, o.mmss(s.start)));
    b.addEventListener('click', () => {
      o.seek(s.start + 0.01);
      toggle(false);
    });
    list.append(b);
    return b;
  });
  function toggle(on?: boolean): void {
    if (root.classList.toggle('list-open', on)) items.forEach((b, i) => b.classList.toggle('done', o.log.heardIn(scenes[i]!.start, scenes[i]!.end) >= DONE));
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  const closeList = (e: Event) => {
    if (!list.contains(e.target as Node)) toggle(false);
  };
  document.addEventListener('click', closeList);
  onDispose(() => document.removeEventListener('click', closeList));

  return { button, list, mark: (i) => items.forEach((b, k) => b.classList.toggle('on', k === i)), toggle };
}
