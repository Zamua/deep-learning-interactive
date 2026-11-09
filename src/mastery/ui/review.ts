// What is due across every course, what comes due next, and the way into past sessions.
import { COURSES } from '../../courses/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { comingUp, type ReviewDay } from '../domain/coming-up';
import { Learner } from '../learner';
import { dueCount, plural, reviewMinutes, sentence, spell } from './common';

function dayName({ t, days }: ReviewDay): string {
  if (days === 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  return new Date(t).toLocaleDateString([], days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' });
}

export function renderReview(main: HTMLElement): void {
  const now = Date.now();
  const books = COURSES.map((c) => {
    const learner = new Learner(c);
    return { learner, due: dueCount(learner) };
  });
  const dueBooks = books.filter((b) => b.due);
  const total = dueBooks.reduce((a, b) => a + b.due, 0);
  const minutes = Math.max(1, Math.round(dueBooks.reduce((a, b) => a + reviewMinutes(b.learner), 0)));
  const ahead = comingUp(books.flatMap(({ learner }) => Object.values(learner.records).flatMap((r) => (r.mastered ? [r.review.due] : []))), now);
  const recent = books.find((b) => Object.values(b.learner.records).some((r) => r.attempts)) ?? books[0]!;

  const root = h('div', { class: 'lib' },
    h('div', { class: 'lib-brand' }, 'Atlas'),
    h('h1', {}, 'Review'),
    h('p', { class: 'lib-sub' }, total ? `${sentence(spell(total))} ${total === 1 ? 'review is' : 'reviews are'} due. About ${spell(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}.` : 'Nothing is due.'));
  if (total) root.append(h('a', { class: 'lib-btn', href: dueBooks[0]!.learner.course.routes.learn(), html: `${icon('playFill')}<span>Begin</span>` }));
  if (total) root.append(h('h2', { class: 'lib-cap' }, 'By book'), h('div', {}, ...dueBooks.map(({ learner, due }) =>
    h('a', { class: 'lib-li', href: learner.course.routes.learn() }, h('span', { class: 'lib-swatch', style: `background:${learner.course.cover}` }), h('span', { class: 'g' }, learner.course.title), h('small', {}, String(due))))));
  if (ahead.length) root.append(h('h2', { class: 'lib-cap' }, 'Coming up'), h('div', {}, ...ahead.map((d) =>
    h('div', { class: 'lib-li' }, h('span', { class: 'g' }, dayName(d)), h('small', {}, plural(d.n, 'review'))))));
  root.append(h('a', { class: 'lib-quiet', href: recent.learner.course.routes.history, html: `${icon('clock-counter-clockwise')}<span>Past sessions</span>` }));
  main.append(root);
}
