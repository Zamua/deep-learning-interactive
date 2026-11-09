// Every concept in the course, grouped by what to do with it.
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { streak, type Status } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot, dots, whenDue } from './common';
import { mapSearch } from './map-search';
import { getJson, setJson } from '../../core/storage';

/** Every concept, grouped by what to do with it. */
export function renderList(main: HTMLElement, learner: Learner): void {
  const root = atlasRoot(learner.course, 'at-map');
  main.append(root);
  const graph = learner.graph;
  const st = learner.statuses();
  const ids = (...want: Status[]) => graph.order.filter((c) => want.includes(st.get(c.id)!)).map((c) => c.id);
  const count = (...want: Status[]) => ids(...want).length;

  root.append(
    h('a', { class: 'at-back', href: learner.course.routes.graph, html: `${icon('arrowLeft')} The map` }),
    h('h1', { class: 'home-title' }, 'Every concept'),
    h('p', { class: 'at-small' }, `${count('mastered', 'due', 'slipping')} of ${graph.order.length} mastered`));

  root.append(mapSearch(learner, { light: () => {}, pick: (id) => void (location.hash = learner.course.routes.concept(id)) }));

  const row = (id: string, box: string, boxCls: string, right: HTMLElement | string, showDomain = true) => {
    const c = graph.get(id)!;
    return h('a', { class: 'at-row', href: learner.course.routes.concept(id) },
      h('span', { class: `at-row-box ${boxCls}`, html: box }),
      h('span', { class: 'at-row-t' }, c.title, showDomain ? h('small', {}, learner.course.domainOf(c).title) : null),
      h('span', { class: 'at-row-r' }, right));
  };
  const section = (title: string, rows: HTMLElement[]) => (rows.length ? [h('h2', { class: 'at-h2' }, title), ...rows] : []);
  /** A long section, folded into one row per domain. */
  const folded = (key: string, title: string, list: string[], mk: (id: string) => HTMLElement) => (list.length ? [h('h2', { class: 'at-h2' }, title),
    ...learner.course.domains.flatMap((d) => {
      const mine = list.filter((id) => graph.get(id)!.domain === d.id);
      return mine.length ? [fold(`${key}:${d.id}`, d.title, mine.length, mine.map(mk))] : [];
    })] : []);
  const rec = (id: string) => learner.record(id);
  const bar = (id: string) => graph.get(id)!.mastery.streak;
  const mastered = (id: string, showDomain: boolean) => {
    const r = rec(id);
    return row(id, icon('check'), 'done', r.mastered ? `review ${whenDue(r.review.due)}` : '', showDomain);
  };
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
}

/** A section longer than this is folded by domain. */
const FOLD_OVER = 8;
const OPEN_KEY = 'atlas.listOpen';

function openFolds(): Set<string> {
  const v = getJson(OPEN_KEY);
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
}

/** One domain's rows behind a header that opens and closes them; which are open is kept per browser. */
function fold(key: string, title: string, n: number, rows: HTMLElement[]): HTMLElement {
  const body = h('div', { class: 'at-fold-body' }, ...rows);
  const head = h('button', { type: 'button', class: 'at-fold' },
    h('span', {}, title), h('small', {}, String(n)), h('span', { class: 'at-fold-c', html: icon('caret-right') }));
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
    setJson(OPEN_KEY, [...all]);
  });
  return h('div', {}, head, body);
}

