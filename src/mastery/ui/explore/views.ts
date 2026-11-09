// Explore's three lists: every concept, the goals followed, and what was done lately. Each draws what its page has always
// drawn, inside Explore, with a tap opening a sheet instead of leaving.
import { icon } from '../../../core/controls';
import { h } from '../../../core/dom';
import { parseRoute } from '../../../routes';
import { comingUp, type ReviewDay } from '../../domain/coming-up';
import type { Learner } from '../../learner';
import { plural } from '../common';
import { openConceptSheet } from '../concept-sheet';
import { renderHistory } from '../history';
import { renderList } from '../list';
import { mapSearch } from '../map-search';
import { leadGoal } from '../next-step';
import { duration, trackOf } from '../tracks';

/** Rows that link to a concept or its explainer open its sheet instead. */
function rowsOpenSheets(host: HTMLElement, learner: Learner): void {
  host.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a.at-row');
    if (!a) return;
    const r = parseRoute(a.getAttribute('href') ?? '');
    if (r && (r.page === 'concept' || r.page === 'watch')) {
      e.preventDefault();
      openConceptSheet(learner, r.concept, { reading: true });
    }
  });
}

export function listView(host: HTMLElement, learner: Learner): void {
  renderList(host, learner);
  // Explore names the page and owns the way out; the search below opens a sheet rather than a page.
  host.querySelector('.at-back')?.remove();
  host.querySelector('.home-title')?.remove();
  const inside = host.querySelector('.at-search');
  inside?.replaceWith(mapSearch(learner, { light: () => {}, pick: (id) => openConceptSheet(learner, id, { reading: true }) }));
  rowsOpenSheets(host, learner);
}

function dayName({ t, days }: ReviewDay): string {
  if (days === 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  return new Date(t).toLocaleDateString([], days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' });
}

export function historyView(host: HTMLElement, learner: Learner): void {
  renderHistory(host, learner);
  host.querySelector('.at-back')?.remove();
  host.querySelector('.home-title')?.remove();
  const page = host.querySelector('.at-map')!;
  if (page.querySelector('.at-row')) page.querySelector('.at-small')?.remove();
  const ahead = comingUp(Object.values(learner.records).flatMap((r) => (r.mastered ? [r.review.due] : [])), Date.now());
  if (ahead.length) page.prepend(h('h2', { class: 'at-h2' }, 'Reviews coming up'), ...ahead.map((d) => h('div', { class: 'lib-li' }, h('span', { class: 'g' }, dayName(d)), h('small', {}, plural(d.n, 'review')))));
  rowsOpenSheets(host, learner);
}

export function goalsView(host: HTMLElement, learner: Learner): void {
  const { graph, course } = learner;
  const title = (id: string) => graph.get(id)!.title;
  const draw = () => {
    const open = (id: string) => openConceptSheet(learner, id, { reading: true, onClose: draw });
    const goals = learner.trackTargets.map((id) => trackOf(learner, id));
    const going = goals.filter((t) => t.next);
    const reached = goals.filter((t) => !t.next);
    const lead = leadGoal(learner)?.target;
    const page = h('div', { class: 'ex-page' });
    if (!goals.length) page.append(h('p', { class: 'lib-sub ex-empty' }, 'Aim at any concept and Atlas lays out the way there. Open one in Chapters or Map, and choose Make it a goal.'));
    if (going.length) {
      page.append(h('h2', { class: 'lib-cap' }, 'On the way'), ...going.map((t) => {
        const fill = h('i');
        fill.style.width = `${(t.mastered / t.ids.length) * 100}%`;
        const row = h('button', { type: 'button', class: 'ex-goal' },
          h('span', { class: 'ex-goal-t' }, title(t.target), t.target === lead ? h('small', {}, 'The home follows this one') : null),
          h('span', { class: 'ex-goal-s' }, `${t.mastered} of ${plural(t.ids.length, 'concept')}, about ${duration(t.seconds)} to go. Next: ${title(t.next!)}.`),
          h('span', { class: 'ex-goal-bar' }, fill));
        row.addEventListener('click', () => open(t.target));
        return row;
      }));
    }
    if (reached.length) {
      page.append(h('h2', { class: 'lib-cap' }, 'Reached'), ...reached.map((t) => {
        const row = h('button', { type: 'button', class: 'ex-goal' }, h('span', { class: 'ex-goal-t' }, title(t.target)), h('span', { class: 'ex-goal-s', html: `${icon('check')} All ${t.ids.length} mastered` }));
        row.addEventListener('click', () => open(t.target));
        return row;
      }));
    }
    if (Object.values(learner.records).some((r) => r.attempts)) {
      page.append(h('div', { class: 'lib-rows' }, h('a', { class: 'lib-li', href: course.routes.place }, h('span', { html: icon('exam') }), h('span', { class: 'g' }, 'Placement test'), h('span', { html: icon('caret-right') }))));
    }
    host.replaceChildren(page);
  };
  draw();
}
