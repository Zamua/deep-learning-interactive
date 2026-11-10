// The site's home page: every course, with how far the learner is in it and what is due.
import { COURSES } from '../../courses/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { plural } from './common';

export function renderTopics(main: HTMLElement): void {
  const root = h('div', { class: 'atlas at-map tp' },
    h('div', { class: 'home-kicker at-kicker-teal' }, 'Atlas'),
    h('h1', { class: 'home-title' }, 'Pick a ', h('em', {}, 'topic'), '.'));
  for (const course of COURSES) {
    const st = [...new Learner(course).statuses().values()];
    const mastered = st.filter((s) => s === 'mastered' || s === 'due' || s === 'slipping').length;
    const due = st.filter((s) => s === 'due' || s === 'slipping').length;
    const started = st.some((s) => s !== 'new' && s !== 'locked');
    const fill = h('i');
    fill.style.width = `${(100 * mastered) / Math.max(1, st.length)}%`;
    root.append(h('a', { class: 'tp-card', href: course.routes.home },
      h('span', { class: 'tp-head' }, h('span', { class: 'tp-t' }, course.title), h('span', { class: 'tp-go', html: icon('arrowRight') })),
      h('span', { class: 'tp-b' }, course.blurb),
      h('span', { class: 'tp-bar', role: 'progressbar', 'aria-valuenow': String(mastered), 'aria-valuemax': String(st.length) }, fill),
      h('span', { class: 'tp-foot' },
        h('span', {}, started ? `${mastered} of ${st.length} mastered` : `${plural(st.length, 'concept')} · not started`),
        due ? h('span', { class: 'tp-due' }, `${plural(due, 'review')} due`) : '')));
  }
  main.append(root);
}
