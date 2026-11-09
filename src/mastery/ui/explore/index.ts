// Explore: the one place for looking around a book. Chapters and the whole graph, every concept, the goals and what was
// done lately, entered on purpose and left the way it was entered.
import '../../../styles/explore.css';
import { icon } from '../../../core/controls';
import { h } from '../../../core/dom';
import { EXPLORE_VIEWS, type ExploreView } from '../../../routes';
import type { Learner } from '../../learner';
import { mapSearch } from '../map-search';
import { locateGlyph } from './glyphs';
import { LEGEND, mountChapters } from './map';
import { goalsView, historyView, listView } from './views';
import { mountWholeMap } from './whole-map';

const LABEL: Record<ExploreView, string> = { map: 'Map', chapters: 'Chapters', list: 'List', goals: 'Goals', history: 'History' };

export function renderExplore(main: HTMLElement, learner: Learner, view: ExploreView): void {
  const pages = learner.course.routes;
  const drawing = view === 'chapters' || view === 'map';
  const close = h('a', { class: 'lib-icon', href: pages.home, 'data-back': '', 'aria-label': 'Close Explore', html: icon('close') });
  const locate = h('button', { type: 'button', class: 'lib-icon', 'aria-label': 'Go to where you are', html: locateGlyph });
  const find = h('button', { type: 'button', class: 'lib-icon', 'aria-label': 'Find a concept', 'aria-expanded': 'false', html: icon('magnifying-glass') });
  const seg = h('nav', { class: 'ex-seg', 'aria-label': 'Explore views' }, ...EXPLORE_VIEWS.map((v) => h('a', {
    class: `ex-tab${v === view ? ' on' : ''}`,
    href: pages.explore(v),
    // Switching views replaces the page, so X goes straight back to where Explore was entered from.
    'data-replace': '',
    'aria-current': v === view ? 'page' : undefined,
  }, LABEL[v])));
  const right = h('span', { class: 'ex-right' }, ...(drawing ? [locate, find] : []));
  const root = h('div', { class: `ex ex-${view}`, 'data-page': 'explore', ...(drawing ? { 'data-drawing': '' } : {}) },
    h('div', { class: 'ex-head' }, h('span', {}, close), h('span', { class: 'ex-title' }, learner.course.title), right), seg);
  main.append(root);

  if (!drawing) {
    const page = h('div', { class: 'ex-scroll' });
    root.append(page);
    ({ list: listView, goals: goalsView, history: historyView })[view](page, learner);
    return;
  }

  // Map is one page that scrolls down, as it always was; Chapters is a drawing to pan and zoom.
  const box = h('div', { class: view === 'map' ? 'ex-scroll' : 'ex-box' });
  const panel = h('div', { class: 'ex-find', hidden: true });
  root.append(box, panel, h('div', { class: 'ex-legend' }, ...LEGEND.map(([k, t]) => h('span', {}, h('i', { class: k }), t))));
  const graph = view === 'map' ? mountWholeMap(box, learner) : mountChapters(box, learner);
  panel.append(mapSearch(learner, {
    light: (ids) => graph.light(ids),
    pick: (id) => {
      toggleFind(false);
      graph.show(id);
    },
  }));
  const toggleFind = (on: boolean) => {
    panel.hidden = !on;
    find.setAttribute('aria-expanded', String(on));
    if (on) panel.querySelector('input')?.focus();
    else graph.light(null);
  };
  find.addEventListener('click', () => toggleFind(panel.hidden));
  locate.addEventListener('click', () => graph.locate());
}
