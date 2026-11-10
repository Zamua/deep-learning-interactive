// A book's home, and the first thing the app opens on: the one next thing to do, and the tour of the book's chapters.
import { icon } from '../../core/controls';
import { escapeHtml, h } from '../../core/dom';
import { setItem } from '../../core/storage';
import { COURSES } from '../../courses/index';
import { routes as site } from '../../routes';
import type { Concept } from '../domain/types';
import { Learner } from '../learner';
import { dueCount, plural, progressBar, reviewMinutes, roman, whenDue } from './bits';
import { nextStep, stepHref, type Step } from './next-step';
import { openSheet } from './sheet';

/** Where the last book opened is remembered, so the app opens on it. */
export const LAST_BOOK = 'atlas.book';

const peek = (learner: Learner, id: string) => void import('./concept-sheet').then((m) => m.openConceptSheet(learner, id));

function bookSwitcher(current: Learner): void {
  const row = (learner: Learner) => {
    const { course } = learner;
    const due = dueCount(learner);
    return h('a', { class: 'bk-row', href: course.routes.home },
      h('span', { class: 'sw', style: `background:${course.cover}` }),
      h('span', { class: 'g' }, course.title, h('small', {}, `${learner.masteredCount()} of ${course.graph.order.length} mastered${due ? ` · ${plural(due, 'review')} due` : ''}`)),
      course.id === current.course.id ? h('span', { html: icon('check') }) : '');
  };
  const shelf = h('a', { class: 'bk-row', href: site.shelf }, h('span', { html: icon('books') }), h('span', { class: 'g' }, 'All books'));
  openSheet('Your books', h('div', { class: 'sh-lab' }, 'Your books'), ...COURSES.map((c) => row(new Learner(c))), shelf);
}

/** The card with the one next thing on it. */
function nextCard(learner: Learner, step: Step): HTMLElement {
  const { course, graph } = learner;
  const pages = course.routes;
  const title = (id: string) => graph.get(id)!.title;
  const chapter = (id: string) => course.domainOf(graph.get(id)!).title;
  const go = (label: string, href: string) => h('a', { class: 'lib-btn', href, html: `${icon('playFill')}<span>${label}</span>` });
  const card = (kicker: string, t: string, sub: string, action?: HTMLElement, ...rest: (HTMLElement | string)[]) =>
    h('section', { class: 'lib-card nx' }, h('div', { class: 'lib-kick' }, kicker), h('div', { class: 'lib-card-t' }, t), sub ? h('p', { class: 'lib-card-s' }, sub) : '', action ?? '', ...rest);

  // A book shows only its own reviews. The shelf and the book menu say what waits in the others.
  if (step.kind === 'review') {
    const then = step.then;
    return card('Reviews first', `${plural(step.due, 'concept')} due`, `One problem each, about ${Math.max(1, Math.round(reviewMinutes(learner)))} min.`, go('Start reviews', pages.learn()),
      then ? h('a', { class: 'quiet-row', href: stepHref(learner, then), html: `<span>Or go on: ${escapeHtml(title(then))}</span>${icon('arrowRight')}` }) : '');
  }
  switch (step.kind) {
    case 'start':
      return card('Start here', title(step.concept), 'The first concept: a short explainer, then practice.', go(`Start: ${title(step.concept)}`, stepHref(learner, step.concept)),
        h('a', { class: 'quiet-row', href: pages.place, html: `${icon('exam')}<span>Know some of this already? Placement test</span>` }));
    case 'resume':
      return card(`Continue · ${chapter(step.concept)}`, title(step.concept), `${step.streak} of ${step.need} right in a row.`, go(`Continue: ${title(step.concept)}`, stepHref(learner, step.concept)));
    case 'win-back':
      return card('Win it back', title(step.concept), `Slipped on a review: ${step.need} right in a row win it back. ${step.streak} so far.`, go(`Continue: ${title(step.concept)}`, pages.learn(step.concept)));
    case 'next':
      return card(step.goal ? `Goal · ${title(step.goal)}` : `Up next · ${chapter(step.concept)}`, title(step.concept), graph.get(step.concept)!.blurb, go(`Start: ${title(step.concept)}`, stepHref(learner, step.concept)));
    default:
      return card('All caught up', 'Nothing is due', 'nextReview' in step && step.nextReview ? `Next review ${whenDue(step.nextReview)}.` : 'Everything here is mastered.');
  }
}

/** A chapter's concepts as a line, with the run of mastered ones at its start folded into one row. */
function stops(learner: Learner, concepts: Concept[], now: string | undefined): HTMLElement {
  const st = learner.statuses();
  const held = (id: string) => ['mastered', 'due', 'slipping'].includes(st.get(id)!);
  const lead = concepts.findIndex((c) => !held(c.id));
  const done = lead < 0 ? concepts.length : lead;
  const ul = h('ul', { class: 'st' });
  if (done > 1 && concepts[done]) ul.append(h('li', { class: 'done' }, h('span', { class: 'st-done' }, `${done} done`)));
  for (const c of done > 1 && concepts[done] ? concepts.slice(done) : concepts) {
    const s = st.get(c.id)!;
    const rec = learner.record(c.id);
    const cls = c.id === now ? 'now' : held(c.id) ? 'done' : s === 'locked' ? 'lock' : '';
    const b = h('button', { type: 'button' }, c.title, c.id === now && !rec.mastered && rec.attempts ? h('small', {}, `${rec.recent.slice(-c.mastery.streak).filter((a) => a.ok).length} of ${c.mastery.streak} in a row`) : '', c.id === now ? h('span', { class: 'st-go', html: icon('caret-right') }) : '');
    b.addEventListener('click', () => peek(learner, c.id));
    ul.append(h('li', { class: cls }, b));
  }
  return ul;
}

function tourList(learner: Learner, now: string | undefined): HTMLElement {
  const { course, graph } = learner;
  const parts = course.domains.map((d) => ({ d, concepts: graph.order.filter((c) => c.domain === d.id) })).filter((p) => p.concepts.length);
  const mastered = (c: Concept) => learner.record(c.id).mastered;
  const nowPart = parts.findIndex((p) => (now ? p.concepts.some((c) => c.id === now) : p.concepts.some((c) => !mastered(c))));
  const open = nowPart < 0 ? 0 : nowPart;
  const chapterRow = (i: number) => {
    const { d, concepts } = parts[i]!;
    const held = concepts.filter(mastered).length;
    const here = i === open;
    const row = h('button', { type: 'button', class: `tr-ch${here ? ' now' : held ? '' : i > open ? ' later' : ''}`, 'aria-expanded': String(here), ...(d.color ? { style: `--dom:var(--c-${d.color})` } : {}) },
      h('b', {}, roman(i + 1)), h('span', {}, d.title), h('i'), h('small', {}, `${held} / ${concepts.length}`));
    const line = stops(learner, concepts, now);
    line.hidden = !here;
    row.addEventListener('click', () => {
      line.hidden = !line.hidden;
      row.setAttribute('aria-expanded', String(!line.hidden));
    });
    return [row, line];
  };
  // The chapters behind the learner, all mastered, fold into one line.
  let behind = 0;
  while (behind < open && parts[behind]!.concepts.every(mastered)) behind++;
  const box = h('nav', { class: 'tr', 'aria-label': 'The chapters of this book' });
  if (behind > 1) {
    const inside = h('div', { hidden: true }, ...Array.from({ length: behind }, (_, i) => chapterRow(i)).flat());
    const fold = h('button', { type: 'button', class: 'tr-fold', 'aria-expanded': 'false' },
      h('span', { html: icon('check-circle') }), h('span', {}, `Chapters I to ${roman(behind)}, all mastered`), h('span', { class: 'c', html: icon('caret-down') }));
    fold.addEventListener('click', () => {
      inside.hidden = !inside.hidden;
      fold.setAttribute('aria-expanded', String(!inside.hidden));
    });
    box.append(fold, inside);
  } else if (behind === 1) box.append(...chapterRow(0));
  for (let i = behind; i < parts.length; i++) box.append(...chapterRow(i));
  return box;
}

export function renderHub(main: HTMLElement, learner: Learner): void {
  const { course, graph } = learner;
  setItem(LAST_BOOK, course.id);
  void import('./reminders').then((r) => r.syncBookReminders()).catch(() => {});
  const total = graph.order.length;
  const done = learner.masteredCount();
  const step = nextStep(learner);
  const now = 'concept' in step ? step.concept : step.kind === 'review' ? step.then : undefined;
  const book = h('button', { type: 'button', class: 'hb-book', 'aria-label': `${course.title}, switch book` },
    h('span', { class: 'sw', style: `background:${course.cover}` }), course.title, h('span', { html: icon('caret-down') }));
  book.addEventListener('click', () => bookSwitcher(learner));
  main.append(h('div', { class: 'lib' },
    h('header', { class: 'hb' }, book, h('span', { class: 'hb-sp' }),
      h('a', { class: 'hb-explore', href: course.routes.explore(), html: `${icon('graph')}<span>Explore</span>` }),
      h('a', { class: 'lib-icon', href: site.settings, 'aria-label': 'Settings', html: icon('gear') })),
    h('div', { class: 'prog' }, h('span', {}, `${done} of ${total}`), progressBar(done, total, 'bar')),
    nextCard(learner, step),
    h('h2', { class: 'lib-cap' }, 'The tour'),
    tourList(learner, now)));
}
