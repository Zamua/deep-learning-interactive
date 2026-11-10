// One concept, over the page it was tapped on: where it sits, where the learner stands, and the one thing to do about
// it. What it builds on is the map's to show. It never changes the address, so closing it leaves everything as it was.
import '../../styles/explore.css';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { recoveryStreak, streak } from '../domain/model';
import type { Learner } from '../learner';
import { dots, roman, whenDue } from './common';
import { stepHref } from './next-step';
import { openSheet } from './sheet';

export interface ConceptSheetOptions {
  /** Lists the papers behind the concept. Explore only: the main path has no links that lead away. */
  reading?: boolean;
  /** After it closes, however it was closed. */
  onClose?: () => void;
}

let current: { close: () => void; quiet: () => void } | null = null;

/** Where the learner stands, as one line. */
function standing(learner: Learner, id: string): HTMLElement | string {
  const { graph } = learner;
  const c = graph.get(id)!;
  const rec = learner.record(id);
  switch (learner.status(id)) {
    case 'mastered':
      return `Mastered. Next review ${whenDue(rec.review!.due)}.`;
    case 'due':
      return 'Mastered. A review is due.';
    case 'slipping':
      return `Slipped on a review. ${streak(rec)} of ${recoveryStreak(c.mastery)} in a row win it back.`;
    case 'learning':
      return h('span', { class: 'cs-stand' }, dots(streak(rec), c.mastery.streak), `${streak(rec)} of ${c.mastery.streak} in a row`);
    case 'new':
      return 'Open to start.';
    case 'locked':
      return `Master ${c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => graph.get(p)!.title).join(' and ')} first.`;
  }
}

/** The label and link for what to do next with a concept, or nothing while it is locked. */
function primary(learner: Learner, id: string): HTMLElement | null {
  const status = learner.status(id);
  if (status === 'locked') return null;
  const pages = learner.course.routes;
  const href = stepHref(learner, id);
  const minutes = Math.round(learner.course.explainerSeconds(id) / 60);
  const label = href === pages.watch(id)
    ? `Watch the explainer${minutes ? `, ${minutes} min` : ''}`
    : status === 'due' ? 'Review' : status === 'mastered' ? 'Practice again' : 'Practice';
  return h('a', { class: 'lib-btn', href, html: `${icon('play')}<span>${label}</span>` });
}

/** The deliberate way to aim at a concept; nothing to aim at once it is mastered. */
function goalToggle(learner: Learner, id: string): HTMLElement | null {
  const followed = () => learner.trackTargets.includes(id);
  if (learner.record(id).mastered && !followed()) return null;
  const words = h('span', {});
  const btn = h('button', { type: 'button', class: 'cs-goal', html: icon('target') }, words);
  const draw = () => {
    words.textContent = followed() ? 'Remove this goal' : 'Make it a goal';
  };
  btn.addEventListener('click', () => {
    learner.follow(id, !followed());
    draw();
  });
  draw();
  return btn;
}

export function openConceptSheet(learner: Learner, id: string, opts: ConceptSheetOptions = {}): void {
  const { course, graph } = learner;
  const c = graph.get(id);
  if (!c) return;
  if (current) {
    current.quiet();
    current.close();
    current = null;
  }
  const chapter = course.domains.filter((d) => graph.order.some((x) => x.domain === d.id)).findIndex((d) => d.id === c.domain);
  const body = h('div', { class: 'cs', 'data-concept': id },
    h('div', { class: 'lib-kick' }, `${roman(chapter + 1)} · ${course.domainOf(c).title}`),
    h('h3', {}, c.title),
    h('p', {}, c.blurb),
    h('div', { class: 'cs-meta' }, standing(learner, id)),
    primary(learner, id),
    goalToggle(learner, id));
  if (opts.reading) {
    void course.loadExplainer(id)?.then((def) => {
      const papers = def.script.papers ?? [];
      if (papers.length) body.append(h('div', { class: 'sh-lab' }, 'Reading'), ...papers.map((p) =>
        h('a', { class: 'lib-paper', href: p.url, target: '_blank', rel: 'noopener' }, h('b', {}, p.title), h('small', {}, `${p.who}, ${p.year}`))));
    }).catch(() => {});
  }
  const close = openSheet(c.title, body);
  const sheet = body.closest<HTMLElement>('.sh')!;
  const watch = new MutationObserver(() => {
    if (sheet.isConnected) return;
    watch.disconnect();
    if (current === mine) current = null;
    opts.onClose?.();
  });
  watch.observe(document.body, { childList: true });
  const mine = { close, quiet: () => watch.disconnect() };
  current = mine;
}
