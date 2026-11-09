// Where the learner is headed: the way to the goal they follow, and how to change it.
import { COURSES } from '../../courses/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { plural } from './common';
import { duration, trackOf } from './tracks';

/** How many of a goal's next concepts the page spells out. */
const SHOWN = 6;

const row = (glyph: string, label: string, href: string) =>
  h('a', { class: 'lib-li', href }, h('span', { html: icon(glyph) }), h('span', { class: 'g' }, label), h('span', { html: icon('arrowRight') }));

export function renderPath(main: HTMLElement): void {
  const books = COURSES.map((c) => new Learner(c));
  const goals = books.flatMap((learner) => learner.trackTargets.map((id) => ({ learner, track: trackOf(learner, id) })));
  const going = goals.filter((g) => g.track.next);
  const lead = going[0];
  const book = lead?.learner ?? books.find((l) => Object.keys(l.records).length) ?? books[0]!;
  const pages = book.course.routes;
  const root = h('div', { class: 'lib' }, h('div', { class: 'lib-brand' }, 'Atlas'), h('h1', {}, 'Your path'));
  main.append(root);

  if (!lead) {
    root.append(h('p', { class: 'lib-sub' }, 'Aim at any concept and Atlas lays out the way there.'));
    root.append(h('a', { class: 'lib-btn', href: pages.newTrack(), html: `${icon('target')}<span>Set a goal</span>` }));
  } else {
    const { learner, track } = lead;
    const title = (id: string) => learner.graph.get(id)!.title;
    root.append(h('p', { class: 'lib-sub' }, `${learner.course.title}, toward ${title(track.target)}.`));
    const left = track.ids.filter((id) => !learner.record(id).mastered);
    const steps = [track.next!, ...left.filter((id) => id !== track.next)].slice(0, SHOWN);
    const note = (id: string, i: number) => (i === 0 ? 'next to learn' : learner.graph.get(id)!.prereqs.includes(steps[i - 1]!) ? 'opens after this' : 'then this');
    root.append(h('ol', { class: 'lib-steps' }, ...steps.map((id, i) =>
      h('li', { class: i === 0 ? 'now' : '' }, h('a', { href: learner.course.routes.concept(id) }, h('span', {}, title(id)), h('small', {}, note(id, i)))))));
    root.append(h('a', { class: 'lib-quiet', href: learner.course.routes.track(track.target), html: `${icon('rows')}<span>${left.length > SHOWN ? `All ${left.length} to go, about ${duration(track.seconds)}` : `About ${duration(track.seconds)} to go`}</span>` }));
    if (going.length > 1) root.append(h('h2', { class: 'lib-cap' }, 'Other goals'), h('div', {}, ...going.slice(1).map(({ learner: l, track: t }) =>
      h('a', { class: 'lib-li', href: l.course.routes.track(t.target) }, h('span', { class: 'g' }, l.graph.get(t.target)!.title), h('small', {}, `${t.mastered} of ${plural(t.ids.length, 'concept')}`)))));
  }
  const finished = goals.filter((g) => !g.track.next);
  if (finished.length) root.append(h('h2', { class: 'lib-cap' }, 'Reached'), h('div', {}, ...finished.map(({ learner: l, track: t }) =>
    h('a', { class: 'lib-li', href: l.course.routes.track(t.target) }, h('span', { class: 'g' }, l.graph.get(t.target)!.title), h('span', { html: icon('check') })))));
  root.append(h('div', { class: 'lib-rows' }, ...(lead ? [row('target', 'Set a different goal', pages.newTrack())] : []), row('exam', 'Placement test', pages.place)));
}
