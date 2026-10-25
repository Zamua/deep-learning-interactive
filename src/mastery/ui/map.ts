// The course front page: today's session, overall mastery, and the concepts as a list or a graph.
import { domainOf, DOMAINS } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { MAX_LEARNING } from '../domain/scheduler';
import { streak, type Status } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot, dots, plural, whenDue } from './common';
import { graphView } from './graph-view';

export function renderMap(main: HTMLElement, learner: Learner, view: 'list' | 'graph'): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const graph = learner.graph;
  const st = learner.statuses();
  const ids = (...want: Status[]) => graph.order.filter((c) => want.includes(st.get(c.id)!)).map((c) => c.id);
  const count = (...want: Status[]) => ids(...want).length;

  root.append(h('header', { class: 'at-hero' },
    h('div', { class: 'at-kicker' }, 'Atlas · AI by mastery'),
    h('h1', { class: 'at-title', html: 'Learn AI one <em>concept</em> at a time.' }),
    h('p', { class: 'at-lede' }, 'Short voiced explainers, then generated problems until each idea is yours. Mastering a concept unlocks the ones that build on it, and it comes back for review before you forget it.')));

  root.append(sessionCard(learner, count));

  const mastered = count('mastered', 'due', 'slipping');
  const total = graph.order.length;
  const learning = count('learning');
  const fresh = count('new');
  const seg = (n: number, cls: string) => h('i', { class: cls, style: `width:${(n / total) * 100}%` });
  root.append(h('div', { class: 'at-stat' },
    h('div', { class: 'at-stat-row' }, h('span', { html: `<b>${mastered}</b> of ${total} mastered` }), h('span', {}, [learning ? `${learning} learning` : '', fresh ? `${fresh} new` : ''].filter(Boolean).join(' · '))),
    h('div', { class: 'at-bar' }, seg(mastered, 'm'), seg(learning, 'l'), seg(fresh, 'n'))));

  root.append(h('nav', { class: 'at-tabs', 'aria-label': 'View' },
    h('a', { href: '#/atlas', class: view === 'list' ? 'on' : '', html: `${icon('rows')} Next up` }),
    h('a', { href: '#/atlas/graph', class: view === 'graph' ? 'on' : '', html: `${icon('graph')} The map` })));

  if (view === 'graph') {
    root.append(h('div', { class: 'at-legend' }, ...DOMAINS.map((d) => h('span', {}, h('i', { style: `background:var(--c-${d.color})` }), d.title))));
    root.append(graphView(learner));
    return;
  }

  const row = (id: string, box: string, boxCls: string, right: HTMLElement | string) => {
    const c = graph.get(id)!;
    return h('a', { class: 'at-row', href: `#/atlas/${id}` },
      h('span', { class: `at-row-box ${boxCls}`, html: box }),
      h('span', { class: 'at-row-t' }, c.title, h('small', { style: `--dom:var(--c-${domainOf(c).color})` }, domainOf(c).title)),
      h('span', { class: 'at-row-r' }, right));
  };
  const section = (title: string, rows: HTMLElement[]) => (rows.length ? [h('h2', { class: 'at-h2' }, title), ...rows] : []);
  const rec = (id: string) => learner.record(id);
  const bar = (id: string) => graph.get(id)!.mastery.streak;
  const needs = (id: string) => graph.get(id)!.prereqs.filter((p) => !rec(p).mastered).map((p) => graph.get(p)!.title);

  root.append(
    ...section('Due for review', ids('slipping', 'due').map((id) =>
      st.get(id) === 'slipping' ? row(id, icon('reset'), 'slip', `${streak(rec(id))} of ${Math.ceil(bar(id) / 2)} to recover`) : row(id, icon('clock'), 'due', 'due today'))),
    ...section('Learning', ids('learning').map((id) => row(id, icon('bolt'), 'learn', h('span', {}, dots(streak(rec(id)), bar(id)), h('br'), `${streak(rec(id))} of ${bar(id)} in a row`)))),
    ...section('Ready to learn', ids('new').map((id) => row(id, icon('playFill'), 'new', 'explainer, then practice'))),
    ...section('Locked', ids('locked').map((id) => row(id, icon('lock'), 'lock', `needs ${needs(id).join(', ')}`))),
    ...section(`Mastered · ${count('mastered')}`, ids('mastered').map((id) => row(id, icon('check'), 'done', `review ${whenDue(rec(id).review!.due)}`))),
  );
}

function sessionCard(learner: Learner, count: (...s: Status[]) => number): HTMLElement {
  const anyProgress = Object.keys(learner.records).length > 0;
  if (!anyProgress) {
    return h('div', { class: 'at-session at-session-first' },
      h('div', { class: 'at-session-k' }, 'Start here'),
      h('p', {}, 'Begin with the first concepts, or take a short placement test that skips what you already know.'),
      h('div', { class: 'at-actions' },
        h('a', { class: 'btn btn-primary', href: '#/atlas/learn', html: `${icon('playFill')} Start from the beginning` }),
        h('a', { class: 'btn', href: '#/atlas/place', html: `${icon('compass')} Placement test` })));
  }
  const reviews = count('due', 'slipping');
  const learning = count('learning');
  const fresh = Math.min(count('new'), Math.max(0, MAX_LEARNING - learning));
  if (!reviews && !learning && !fresh) {
    const next = Object.values(learner.records).map((r) => r.review?.due ?? Infinity).reduce((a, b) => Math.min(a, b), Infinity);
    return h('div', { class: 'at-session' },
      h('span', { class: 'at-session-go done', html: icon('check') }),
      h('div', {}, h('div', { class: 'at-session-k' }, 'All caught up'), h('span', {}, Number.isFinite(next) ? `Next review ${whenDue(next)}.` : 'Everything here is mastered.')));
  }
  const chip = (n: number, label: string, cls: string) => (n ? h('span', { class: `at-chip ${cls}` }, plural(n, label, label)) : '');
  return h('a', { class: 'at-session', href: '#/atlas/learn' },
    h('span', { class: 'at-session-go', html: icon('playFill') }),
    h('div', {},
      h('div', { class: 'at-session-k' }, 'Today\'s session · 15 min'),
      h('span', {}, 'Picks up where you left off'),
      h('div', { class: 'at-chips' }, chip(reviews, reviews === 1 ? 'review' : 'reviews', 'due'), chip(learning, 'learning', 'learn'), chip(fresh, 'new', 'new'))));
}
