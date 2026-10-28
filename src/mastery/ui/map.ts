// The Atlas front page, and the whole map as a graph or a list.
import { domainOf, DOMAINS, hasExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { streak, type Status } from '../domain/model';
import { trackConcepts } from '../domain/tracks';
import type { Learner } from '../learner';
import { syncReminders } from '../push';
import { atlasRoot, dots, pickLink, plural, whenDue } from './common';
import { graphView } from './graph-view';
import { recentSection } from './history';
import { tracksSection } from './tracks';

/**
 * The Atlas front page: today's concept, the short path around it, and a way into the whole map. With tracks, the due
 * reviews, then each track's next concept.
 */
export function renderHome(main: HTMLElement, learner: Learner): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const graph = learner.graph;
  const d = learner.today();
  const title = (id: string) => graph.get(id)!.title;
  root.append(h('div', { class: 'home-kicker at-kicker-teal' }, 'Atlas'), h('h1', { class: 'home-title', html: 'AI by <em>mastery</em>.' }));

  const c = d.concept ? graph.get(d.concept) : undefined;
  const lead = (kicker: string, t: string, sub: string, go: HTMLElement, alt?: HTMLElement) =>
    h('div', { class: 'lead at-lead' }, h('div', { class: 'lead-k' }, kicker), h('div', { class: 'lead-t' }, t), h('div', { class: 'lead-s' }, sub), h('div', { class: 'lead-actions' }, go, alt ?? ''));
  const goBtn = (label: string, href = '#/atlas/learn') => h('a', { class: 'lead-go', href, html: `${icon('playFill')} ${label}` });
  const altBtn = (label: string, href: string, ic: string) => h('a', { class: 'lead-alt', href, html: `${icon(ic)} ${label}` });
  const opens = d.opens?.length ? ` · then ${d.opens.map(title).join(', ')} opens` : '';
  const st = [...learner.statuses().values()];
  const mastered = st.filter((x) => x === 'mastered' || x === 'due' || x === 'slipping').length;
  const mapLink = () => h('a', { class: 'at-maplink', href: '#/atlas/graph', html: `${icon('graph')} <span>The whole map</span><small>${mastered} of ${st.length} mastered</small>${icon('arrowRight')}` });
  void syncReminders(learner);

  const targets = learner.trackTargets;
  if (targets.length) {
    const inTrack = (id: string) => targets.some((t) => trackConcepts(graph, t).includes(id));
    if (d.kind === 'review') root.append(lead('Reviews', `${plural(d.due, 'concept')} due`, reviewTime(learner), goBtn('Start reviews')));
    else if (d.kind === 'learning' && d.slipping) root.append(lead('Win it back', c!.title, `Slipped on a review: ${d.need} right in a row win it back. ${d.streak} so far.`, goBtn('Practice')));
    else if (d.kind === 'learning' && !inTrack(c!.id)) root.append(lead('In progress', c!.title, `${d.streak} of ${d.need} right in a row${opens}`, goBtn('Practice', `#/atlas/learn/${c!.id}`)));
    root.append(...tracksSection(learner), pickLink('Or choose something else to learn'), ...recentSection(learner), mapLink());
    return;
  }

  if (d.kind === 'start') root.append(lead('Start here', c!.title, 'The first concept: a short explainer, then practice.', goBtn('Start'), altBtn('Placement test', '#/atlas/place', 'compass')));
  else if (d.kind === 'learning' && d.slipping) root.append(lead('Win it back', c!.title, `Slipped on a review: ${d.need} right in a row win it back. ${d.streak} so far.`, goBtn('Practice')));
  else if (d.kind === 'learning') root.append(lead('In progress', c!.title, `${d.streak} of ${d.need} right in a row${opens}`, goBtn('Practice')));
  else if (d.kind === 'new') root.append(lead('Up next', c!.title, `${c!.blurb}`, goBtn('Start'), hasExplainerLink(c!.id)), pickLink('Or choose what to learn next'));
  else if (d.kind === 'review') root.append(lead('Review', `${plural(d.due, 'concept')} due`, `${reviewTime(learner)}${d.after ? ` Then ${title(d.after)}.` : ''}`, goBtn('Start reviews')));
  else root.append(lead('All caught up', 'Nothing is due', d.nextReview ? `Next review ${whenDue(d.nextReview)}.` : 'Everything here is mastered.', altBtn('See the map', '#/atlas/graph', 'graph')));
  if (d.due && d.kind !== 'review') root.append(h('p', { class: 'at-small at-due' }, `Then ${plural(d.due, 'review')}, before anything new.`));

  // The path: the last two mastered, where you are, and what opens next.
  const done = graph.order.filter((x) => learner.record(x.id).mastered).map((x) => x.id).sort((p, q) => learner.record(p).last - learner.record(q).last).slice(-2);
  const now = d.kind === 'learning' || d.kind === 'new' || d.kind === 'start' ? d.concept : d.kind === 'review' ? d.after : undefined;
  const next = now ? [...(d.opens ?? []), ...graph.dependents.get(now)!.filter((x) => !(d.opens ?? []).includes(x))].slice(0, 2) : [];
  if (done.length || now) {
    const step = (id: string, cls: string, sub: string) => h('a', { class: `at-step-p ${cls}`, href: `#/atlas/${id}` }, h('span', { class: 'at-step-t' }, title(id)), h('small', {}, sub));
    root.append(h('div', { class: 'home-lbl' }, 'Your path'), h('div', { class: 'at-path' },
      ...done.map((id) => step(id, 'done', learner.record(id).review ? `mastered · review ${whenDue(learner.record(id).review!.due)}` : 'mastered')),
      ...(now ? [step(now, 'now', d.kind === 'learning' ? `in progress · ${d.streak} of ${d.need}` : d.kind === 'review' ? 'after the reviews' : 'next to learn')] : []),
      ...next.map((id, i) => step(id, 'lock', i === 0 ? `opens after ${title(now!)}` : 'then this'))));
  }
  root.append(...recentSection(learner));
  root.append(h('a', { class: 'at-maplink', href: '#/atlas/new-track', html: `${icon('target')} <span>Start a track</span><small>aim at any concept</small>${icon('arrowRight')}` }));
  root.append(mapLink());
}

/** What the due reviews take: one problem each, at about the pace a concept's bar asks for. */
export function reviewTime(learner: Learner): string {
  const due = learner.graph.order.filter((c) => learner.status(c.id) === 'due');
  const min = Math.max(1, Math.round(due.reduce((a, c) => a + c.mastery.seconds * 1.5, 0) / 60));
  return `One problem each, about ${min} min.`;
}

function hasExplainerLink(id: string): HTMLElement | undefined {
  return hasExplainer(id) ? h('a', { class: 'lead-alt', href: `#/atlas/${id}/watch`, html: `${icon('playFill')} Explainer` }) : undefined;
}

/** Every concept, as a graph or as a list grouped by what to do with it. */
export function renderMap(main: HTMLElement, learner: Learner, view: 'list' | 'graph'): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const graph = learner.graph;
  const st = learner.statuses();
  const ids = (...want: Status[]) => graph.order.filter((c) => want.includes(st.get(c.id)!)).map((c) => c.id);
  const count = (...want: Status[]) => ids(...want).length;

  root.append(
    h('a', { class: 'at-back', href: '#/atlas', html: `${icon('arrowLeft')} Atlas` }),
    h('h1', { class: 'home-title' }, 'The map'),
    h('p', { class: 'at-small' }, `${count('mastered', 'due', 'slipping')} of ${graph.order.length} mastered`));
  root.append(h('nav', { class: 'at-tabs', 'aria-label': 'View' },
    h('a', { href: '#/atlas/graph', class: view === 'graph' ? 'on' : '', html: `${icon('graph')} Graph` }),
    h('a', { href: '#/atlas/list', class: view === 'list' ? 'on' : '', html: `${icon('rows')} List` })));

  if (view === 'graph') {
    root.append(h('div', { class: 'at-legend' }, ...DOMAINS.map((d) => h('span', {}, h('i', { style: `background:var(--c-${d.color})` }), d.title))));
    root.append(graphView(learner));
    return;
  }

  const row = (id: string, box: string, boxCls: string, right: HTMLElement | string, showDomain = true) => {
    const c = graph.get(id)!;
    return h('a', { class: 'at-row', href: `#/atlas/${id}` },
      h('span', { class: `at-row-box ${boxCls}`, html: box }),
      h('span', { class: 'at-row-t' }, c.title, showDomain ? h('small', { style: `--dom:var(--c-${domainOf(c).color})` }, domainOf(c).title) : null),
      h('span', { class: 'at-row-r' }, right));
  };
  const section = (title: string, rows: HTMLElement[]) => (rows.length ? [h('h2', { class: 'at-h2' }, title), ...rows] : []);
  /** A long section, folded into one row per domain. */
  const folded = (key: string, title: string, list: string[], mk: (id: string) => HTMLElement) => (list.length ? [h('h2', { class: 'at-h2' }, title),
    ...DOMAINS.flatMap((d) => {
      const mine = list.filter((id) => graph.get(id)!.domain === d.id);
      return mine.length ? [fold(`${key}:${d.id}`, d.title, d.color, mine.length, mine.map(mk))] : [];
    })] : []);
  const rec = (id: string) => learner.record(id);
  const bar = (id: string) => graph.get(id)!.mastery.streak;
  const mastered = (id: string, showDomain: boolean) => row(id, icon('check'), 'done', `review ${whenDue(rec(id).review!.due)}`, showDomain);
  const needs = (id: string) => graph.get(id)!.prereqs.filter((p) => !rec(p).mastered).map((p) => graph.get(p)!.title);

  root.append(
    ...section('Due for review', ids('slipping', 'due').map((id) =>
      st.get(id) === 'slipping' ? row(id, icon('reset'), 'slip', `${streak(rec(id))} of ${Math.ceil(bar(id) / 2)} to recover`) : row(id, icon('clock'), 'due', 'due today'))),
    ...section('Learning', ids('learning').map((id) => row(id, icon('bolt'), 'learn', h('span', {}, dots(streak(rec(id)), bar(id)), h('br'), `${streak(rec(id))} of ${bar(id)} in a row`)))),
    ...section('Ready to learn', ids('new').map((id) => row(id, icon('playFill'), 'new', 'explainer, then practice'))),
    ...folded('locked', `Locked · ${count('locked')}`, ids('locked'), (id) => row(id, icon('lock'), 'lock', `needs ${needs(id).join(', ')}`, false)),
    ...(count('mastered') > FOLD_OVER
      ? folded('mastered', `Mastered · ${count('mastered')}`, ids('mastered'), (id) => mastered(id, false))
      : section(`Mastered · ${count('mastered')}`, ids('mastered').map((id) => mastered(id, true)))),
  );
  root.append(h('a', { class: 'at-maplink', href: '#/account', html: `${icon('devices')} <span>Sync across devices</span><small>your code, and a file copy</small>${icon('arrowRight')}` }));
}

/** A section longer than this is folded by domain. */
const FOLD_OVER = 8;
const OPEN_KEY = 'atlas.listOpen';

function openFolds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** One domain's rows behind a header that opens and closes them; which are open is kept per browser. */
function fold(key: string, title: string, color: string, n: number, rows: HTMLElement[]): HTMLElement {
  const body = h('div', { class: 'at-fold-body' }, ...rows);
  const head = h('button', { type: 'button', class: 'at-fold', style: `--dom:var(--c-${color})` },
    h('i'), h('span', {}, title), h('small', {}, String(n)), h('span', { class: 'at-fold-c', html: icon('caret-right') }));
  const set = (open: boolean) => {
    head.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  };
  set(openFolds().has(key));
  head.addEventListener('click', () => {
    const open = head.getAttribute('aria-expanded') !== 'true';
    set(open);
    const all = openFolds();
    if (open) all.add(key);
    else all.delete(key);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...all]));
    } catch {
      /* private mode: the fold just isn't remembered */
    }
  });
  return h('div', {}, head, body);
}

