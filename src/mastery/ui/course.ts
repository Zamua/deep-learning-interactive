// A course's front page: its cover, what to do now, and its contents by part.
import { backRow, icon } from '../../core/controls';
import { h } from '../../core/dom';
import { routes as site } from '../../routes';
import { trackConcepts } from '../domain/tracks';
import type { Learner } from '../learner';
import { syncReminders } from '../push';
import { pickLink, plural, progressBar, reviewMinutes, roman, whenDue } from './common';
import { continueHref, duration, trackOf } from './tracks';

/** The part the learner is in: the one holding what they are on, else the first with something left to master. */
export function partInProgress(learner: Learner): string {
  const { course, graph } = learner;
  const now = learner.current();
  if (now) return graph.get(now)!.domain;
  return course.domains.find((d) => graph.order.some((c) => c.domain === d.id && !learner.record(c.id).mastered))?.id ?? course.domains[0]!.id;
}

/** What to do now: the reviews due, a concept that slipped, the followed track, then whatever comes next. */
function nextUp(learner: Learner): HTMLElement {
  const { course, graph } = learner;
  const pages = course.routes;
  const d = learner.today();
  const title = (id: string) => graph.get(id)!.title;
  const go = (label: string, href: string = pages.learn()) => h('a', { class: 'lib-btn', href, html: `${icon('playFill')}<span>${label}</span>` });
  const alt = (label: string, href: string) => h('a', { class: 'lib-btn lib-btn-g', href }, label);
  const card = (kicker: string, t: string, sub: string, ...actions: HTMLElement[]) =>
    h('section', { class: 'lib-card' }, h('div', { class: 'lib-kick' }, kicker), h('div', { class: 'lib-card-t' }, t), sub ? h('p', { class: 'lib-card-s' }, sub) : '', ...actions);
  const then = d.due && d.kind !== 'review' ? ` Then ${plural(d.due, 'review')}.` : '';

  if (d.kind === 'review') return card('Review', `${plural(d.due, 'concept')} due`, `One problem each, about ${Math.max(1, Math.round(reviewMinutes(learner)))} min.${d.after ? ` After that: ${title(d.after)}.` : ''}`, go('Start reviews'));
  if (d.kind === 'learning' && d.slipping) return card('Win it back', title(d.concept), `Slipped on a review: ${d.need} right in a row win it back. ${d.streak} so far.`, go('Practice'));

  const track = learner.trackTargets.map((id) => trackOf(learner, id)).find((t) => t.next);
  const outside = d.kind === 'learning' && learner.trackTargets.every((t) => !trackConcepts(graph, t).includes(d.concept));
  if (track && !outside) return card(`Continue · ${title(track.target)}`, title(track.next!), `${track.mastered} of ${track.ids.length} on this track, about ${duration(track.seconds)} to go.${then}`, go('Resume', continueHref(learner, track)));

  switch (d.kind) {
    case 'start':
      return card('Start here', title(d.concept), 'The first concept: a short explainer, then practice.', go('Start'), alt('Placement test', pages.place));
    case 'learning':
      return card('Continue', title(d.concept), `${d.streak} of ${d.need} right in a row.${then}`, go('Resume'));
    case 'new':
      return card('Up next', title(d.concept), `${graph.get(d.concept)!.blurb}${then}`, go('Start'), ...(course.hasExplainer(d.concept) ? [alt('Watch the explainer', pages.watch(d.concept))] : []));
    case 'done':
      return card('All caught up', 'Nothing is due', d.nextReview ? `Next review ${whenDue(d.nextReview)}.` : 'Everything here is mastered.');
  }
}

export function renderCourse(main: HTMLElement, learner: Learner): void {
  const { course, graph } = learner;
  void syncReminders(learner);
  const total = graph.order.length;
  const done = learner.masteredCount();
  const parts = course.domains.filter((d) => graph.order.some((c) => c.domain === d.id));
  const now = partInProgress(learner);

  main.append(h('div', { class: 'lib' },
    backRow(site.shelf, 'Library'),
    h('header', { class: 'lib-cover lib-cover-big', style: `--cover:${course.cover}` },
      h('h1', {}, course.title),
      h('p', {}, course.blurb),
      progressBar(done, total, 'lib-bar'),
      h('p', { class: 'lib-cover-n' }, `${done} of ${plural(total, 'concept')}`)),
    nextUp(learner),
    h('h2', { class: 'lib-cap' }, 'Contents', h('a', { href: course.routes.graph, html: `${icon('graph')} Map` })),
    h('nav', { class: 'lib-toc', 'aria-label': 'Parts of the course' }, ...parts.map((d, i) => {
      const inPart = graph.order.filter((c) => c.domain === d.id);
      const held = inPart.filter((c) => learner.record(c.id).mastered).length;
      return h('a', { class: `lib-toc-row${d.id === now ? ' cur' : ''}`, href: course.routes.part(d.id), ...(d.id === now ? { 'aria-current': 'true' } : {}) },
        h('b', {}, roman(i + 1)), h('span', {}, d.title), h('i'), h('small', {}, `${held} / ${inPart.length}`));
    })),
    pickLink(course, 'Choose what to learn next')));
}
