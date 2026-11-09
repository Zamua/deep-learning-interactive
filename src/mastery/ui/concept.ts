// One concept: its explainer and Practice, where the learner stands, what it builds on and unlocks, and what to read.
import { backRow, icon } from '../../core/controls';
import { h } from '../../core/dom';
import { streak } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot, dots, whenDue } from './common';

export const explainerId = (concept: string) => `atlas-${concept}`;

/** Where the learner stands on a concept, as one line; nothing before they have started it. */
function standing(learner: Learner, id: string): HTMLElement | null {
  const rec = learner.record(id);
  const need = learner.graph.get(id)!.mastery.streak;
  const line = (...children: (HTMLElement | string)[]) => h('p', { class: 'lib-standing' }, ...children);
  switch (learner.status(id)) {
    case 'mastered':
      return line(`Mastered. Next review ${whenDue(rec.review!.due)}.`);
    case 'due':
      return line('Mastered. A review is due.');
    case 'slipping':
      return line(`Slipped on a review. ${streak(rec)} of ${Math.ceil(need / 2)} in a row win it back.`);
    case 'learning':
      return line(dots(streak(rec), need), `${streak(rec)} of ${need} in a row`);
    default:
      return null;
  }
}

export function renderConcept(main: HTMLElement, learner: Learner, id: string): void {
  const { course, graph } = learner;
  const pages = course.routes;
  const c = graph.get(id)!;
  const part = course.domainOf(c);
  const s = learner.status(id);
  const rec = learner.record(id);
  const hasExplainer = course.hasExplainer(id);
  const root = atlasRoot(course, 'lib at-concept');
  root.dataset.concept = id;
  main.append(root);

  root.append(backRow(pages.part(part.id), part.title), h('h1', { class: 'lib-concept-t' }, c.title), h('p', { class: 'lib-lede' }, c.blurb));

  if (hasExplainer) {
    const minutes = Math.round(course.explainerSeconds(id) / 60);
    root.append(h('a', { class: 'lib-btn', href: pages.watch(id), html: `${icon('play')}<span>Watch the explainer${minutes ? `, ${minutes} min` : ''}</span>` }));
  }
  const missing = c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => graph.get(p)!.title);
  root.append(s === 'locked'
    ? h('div', { class: 'lib-lock', html: icon('lock') }, h('span', {}, `Master ${missing.join(' and ')} first`))
    : h('a', { class: `lib-btn${hasExplainer ? ' lib-btn-g' : ''}`, href: pages.learn(id) }, s === 'due' ? 'Review' : 'Practice'));

  const line = standing(learner, id);
  if (line) root.append(line);
  if (!rec.mastered) {
    const followed = learner.trackTargets.includes(id);
    root.append(h('a', { class: 'lib-quiet', href: followed ? pages.track(id) : pages.newTrack(id), html: icon('target') }, h('span', {}, followed ? 'Open its track' : 'Make it a goal')));
  }

  const row = (other: string, full: boolean) => h('a', { class: 'lib-li', href: pages.concept(other) },
    h('span', { class: `lib-dot${full ? ' f' : ''}` }), h('span', { class: 'g' }, graph.get(other)!.title), h('span', { html: icon('caret-right') }));
  if (c.prereqs.length) root.append(h('h2', { class: 'lib-cap' }, 'Builds on'), h('div', {}, ...c.prereqs.map((p) => row(p, learner.record(p).mastered))));
  const unlocks = graph.dependents.get(id)!;
  if (unlocks.length) root.append(h('h2', { class: 'lib-cap' }, 'Unlocks'), h('div', {}, ...unlocks.map((u) => row(u, learner.record(u).mastered))));

  void course.loadExplainer(id)?.then((def) => {
    const papers = def.script.papers ?? [];
    if (papers.length) root.append(h('h2', { class: 'lib-cap' }, 'Reading'), h('div', {}, ...papers.map((p) =>
      h('a', { class: 'lib-paper', href: p.url, target: '_blank', rel: 'noopener' }, h('b', {}, p.title), h('small', {}, `${p.who}, ${p.year}`)))));
  });
}
