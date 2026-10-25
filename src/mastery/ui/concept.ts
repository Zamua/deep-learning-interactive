// One concept: its explainer, the learner's numbers, what it builds on and unlocks, and Practice.
import { CHAPTERS } from '../../chapters/index';
import { domainOf, hasExplainer, loadExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { lectureState } from '../../core/progress';
import { meanTime, streak } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot, dots, STATUS_LABEL, whenDue } from './common';

export const explainerId = (concept: string) => `atlas-${concept}`;

export function renderConcept(main: HTMLElement, learner: Learner, id: string): void {
  const graph = learner.graph;
  const c = graph.get(id)!;
  const d = domainOf(c);
  const s = learner.status(id);
  const rec = learner.record(id);
  const root = atlasRoot('at-concept');
  root.style.setProperty('--dom', `var(--c-${d.color})`);
  main.append(root);

  root.append(
    h('a', { class: 'at-back', href: '#/atlas', html: `${icon('arrowLeft')} The map` }),
    h('div', { class: 'at-kicker at-kicker-dom' }, `${d.title} · ${STATUS_LABEL[s]}`),
    h('h1', { class: 'at-title at-title-c' }, c.title),
    h('p', { class: 'at-lede' }, c.blurb));

  if (hasExplainer(id)) {
    const ls = lectureState(explainerId(id));
    const sub = h('span', { class: 'at-ex-sub' }, ls && ls.heard >= 0.02 ? `${Math.round(ls.heard * 100)}% heard` : 'Watch it before your first problem');
    const k = h('span', { class: 'at-ex-k' }, 'Explainer');
    root.append(h('a', { class: 'at-ex', href: `#/atlas/${id}/watch` },
      h('span', { class: 'at-ex-play', html: icon('playFill') }),
      h('span', { class: 'at-ex-body' }, k, sub),
      h('span', { class: 'at-ex-go', html: icon('arrowRight') })));
    void loadExplainer(id)?.then((def) => {
      if (def.timing) k.textContent = `Explainer · ${Math.max(1, Math.round(def.timing.duration / 60))} min`;
    });
  }

  const bar = c.mastery;
  const avg = meanTime(rec, bar.streak);
  const cell = (big: HTMLElement | string, small: string, cls = '') => h('div', { class: `at-cell ${cls}` }, h('b', {}, big), h('span', {}, small));
  if (s === 'mastered' || s === 'due') {
    root.append(h('div', { class: 'at-cells' },
      cell(h('span', { html: icon('check') }), 'mastered', 'ok'),
      cell(s === 'due' ? 'today' : whenDue(rec.review!.due), 'next review'),
      cell(String(rec.attempts), 'answered')));
  } else if (s !== 'locked') {
    const need = s === 'slipping' ? Math.ceil(bar.streak / 2) : bar.streak;
    root.append(h('div', { class: 'at-cells' },
      cell(h('span', {}, `${streak(rec)} of ${need}`), s === 'slipping' ? 'in a row to recover' : 'in a row', 'acc'),
      cell(rec.attempts ? `${Math.round(avg)} s` : '–', `avg, target ${bar.seconds} s`),
      cell(String(rec.attempts), 'answered')));
    if (s === 'learning') root.querySelector('.at-cell.acc span')!.after(dots(streak(rec), bar.streak));
  }

  const locked = s === 'locked';
  const missing = c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => graph.get(p)!.title);
  root.append(locked
    ? h('div', { class: 'at-cta at-cta-off', html: `${icon('lock')} Master ${missing.join(' and ')} first` })
    : h('a', { class: 'at-cta', href: `#/atlas/learn/${id}`, html: `${s === 'mastered' ? 'Practice' : s === 'due' ? 'Review' : 'Practice'} ${c.title.toLowerCase()} ${icon('arrowRight')}` }));

  const pill = (pid: string) => {
    const ok = learner.record(pid).mastered;
    return h('a', { class: `at-pill${ok ? ' ok' : ''}`, href: `#/atlas/${pid}`, html: `${icon(ok ? 'check' : 'lock')} ${graph.get(pid)!.title}` });
  };
  if (c.prereqs.length) root.append(h('h2', { class: 'at-h2' }, 'Builds on'), h('div', { class: 'at-pills' }, ...c.prereqs.map(pill)));
  const unlocks = graph.dependents.get(id)!;
  if (unlocks.length) root.append(h('h2', { class: 'at-h2' }, 'Unlocks'), h('div', { class: 'at-pills' }, ...unlocks.map((u) => {
    const open = learner.status(u) !== 'locked';
    return h('a', { class: `at-pill${open ? '' : ' dim'}`, href: `#/atlas/${u}`, html: `${icon(open ? 'arrowRight' : 'lock')} ${graph.get(u)!.title}` });
  })));
  const deeper = (c.deeper ?? []).map((x) => ({ x, meta: CHAPTERS.find((m) => m.id === x.chapter) })).filter((d) => d.meta);
  if (deeper.length) {
    root.append(h('h2', { class: 'at-h2' }, 'Go deeper'), h('div', { class: 'at-pills' }, ...deeper.map(({ x, meta }) =>
      h('a', { class: 'at-pill', href: `#/${meta!.id}${x.section ? `/${x.section}` : ''}`, html: `${icon('book')} ${meta!.num}. ${meta!.title}` }))));
  }
}
