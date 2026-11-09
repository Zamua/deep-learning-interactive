// The library: every course on the shelf as a cover, with how far along the learner is.
import { COURSES } from '../../courses/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { plural, progressBar } from './bits';

function cover(learner: Learner): HTMLElement {
  const { course, graph } = learner;
  const total = graph.order.length;
  return h('a', { class: 'lib-cover', href: course.routes.home, style: `--cover:${course.cover}` },
    h('h2', {}, course.title),
    h('div', {}, h('p', {}, plural(total, 'concept')), progressBar(learner.masteredCount(), total, 'lib-bar')));
}

export function renderShelf(main: HTMLElement): void {
  // Nothing the shelf draws may wait on the network, and this module loads with the first paint.
  void import('./reminders').then((r) => r.syncBookReminders()).catch(() => {});
  main.append(h('div', { class: 'lib lib-wide' },
    h('div', { class: 'lib-brand' }, 'Atlas'),
    h('h1', {}, 'Library'),
    h('div', { class: 'lib-grid' }, ...COURSES.map((c) => cover(new Learner(c))))));
}
