// The library: every course on the shelf as a cover, with how far along the learner is.
import { COURSES, FIRST } from '../../courses/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { syncReminders } from '../push';
import { plural, progressBar } from './common';

function cover(learner: Learner): HTMLElement {
  const { course, graph } = learner;
  const total = graph.order.length;
  return h('a', { class: 'lib-cover', href: course.routes.home, style: `--cover:${course.cover}` },
    h('h2', {}, course.title),
    h('div', {}, h('p', {}, plural(total, 'concept')), progressBar(learner.masteredCount(), total, 'lib-bar')));
}

export function renderShelf(main: HTMLElement): void {
  void syncReminders(new Learner(FIRST));
  main.append(h('div', { class: 'lib lib-wide' },
    h('div', { class: 'lib-brand' }, 'Atlas'),
    h('h1', {}, 'Library'),
    h('p', { class: 'lib-sub' }, 'Choose a book to open.'),
    h('h2', { class: 'lib-cap' }, 'All courses'),
    h('div', { class: 'lib-grid' }, ...COURSES.map((c) => cover(new Learner(c))))));
}
