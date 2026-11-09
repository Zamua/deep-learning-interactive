// The complete graph, as the app has always drawn it: one page as wide as the screen that scrolls down. A tap opens the
// concept's sheet.
import { h } from '../../../core/dom';
import type { Learner } from '../../learner';
import { openConceptSheet } from '../concept-sheet';
import { graphView, lightTrack } from '../graph-view';
import { placeOf } from './map';

export interface WholeMap {
  /** Scrolls to where the learner is. */
  locate(): void;
  /** Scrolls to a concept and opens its sheet. */
  show(id: string): void;
  /** Lights these concepts and dims the rest; null clears it. */
  light(ids: readonly string[] | null): void;
}

export function mountWholeMap(page: HTMLElement, learner: Learner): WholeMap {
  const open = (id: string) => openConceptSheet(learner, id, { reading: true, onChip: show, onClose: () => lightTrack(map, null) });
  const map = graphView(learner, { onTap: open });
  const node = (id: string) => map.querySelector<HTMLElement>(`.at-node[data-id="${CSS.escape(id)}"]`);
  const here = placeOf(learner);
  if (here) node(here)?.classList.add('at-here');
  const chapters = learner.course.domains.filter((d) => d.color && learner.graph.order.some((c) => c.domain === d.id));
  page.append(h('div', { class: 'atlas ex-whole' },
    h('div', { class: 'at-legend' }, ...chapters.map((d) => h('span', {}, h('i', { style: `background:var(--c-${d.color})` }), d.title))),
    map));

  function show(id: string): void {
    node(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lightTrack(map, { ids: new Set([id]), target: id });
    open(id);
  }

  return {
    locate: () => {
      if (here) node(here)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    show,
    light: (ids) => lightTrack(map, ids?.length ? { ids: new Set(ids), target: ids[0]! } : null),
  };
}
