// The complete graph, as the app has always drawn it: one page as wide as the screen that scrolls down. A tap lights
// everything the concept builds on and opens its sheet.
import { h } from '../../../core/dom';
import type { Learner } from '../../learner';
import { openConceptSheet } from '../concept-sheet';
import { graphView, lightTrack } from '../graph-view';
import { tour } from '../next-step';
import { middleScroll } from './layout';
import { placeOf } from './map';

export interface WholeMap {
  /** Goes to where the learner is. */
  locate(): void;
  /** Goes to a concept and lights what it builds on. */
  show(id: string): void;
  /** Lights these concepts and dims the rest; null clears it. */
  light(ids: readonly string[] | null): void;
}

/** How long the mark on a concept just gone to stays, as long as its animation in explore.css. */
const PULSE_MS = 1400;

export function mountWholeMap(page: HTMLElement, learner: Learner): WholeMap {
  const { graph } = learner;
  const chain = (id: string) => lightTrack(map, { ids: new Set([...graph.ancestors(id), id]), target: id });
  const open = (id: string) => {
    chain(id);
    openConceptSheet(learner, id, { reading: true, onClose: () => lightTrack(map, null) });
  };
  const map = graphView(learner, { onTap: open });
  const node = (id: string) => map.querySelector<HTMLElement>(`.at-node[data-id="${CSS.escape(id)}"]`);
  const chapters = learner.course.domains.filter((d) => d.color && graph.order.some((c) => c.domain === d.id));
  page.append(h('div', { class: 'atlas ex-whole' },
    h('div', { class: 'at-legend' }, ...chapters.map((d) => h('span', {}, h('i', { style: `background:var(--c-${d.color})` }), d.title))),
    map));

  // A tap on the paper between concepts puts the lighting out.
  page.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.at-node')) lightTrack(map, null);
  });

  let pulsed: HTMLElement | null = null;
  let timer = 0;
  /** Brings a concept to the middle of the page and marks it for a moment, so the move shows even when it was in view. */
  function goTo(id: string): void {
    const el = node(id);
    if (!el) return;
    const at = el.getBoundingClientRect();
    const top = at.top - page.getBoundingClientRect().top + page.scrollTop;
    page.scrollTo({ top: middleScroll(top, at.height, page.clientHeight, page.scrollHeight), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    pulsed?.classList.remove('at-pulse');
    // Read the layout between the two, so the animation starts over on the same concept.
    void el.offsetWidth;
    el.classList.add('at-pulse');
    pulsed = el;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => el.classList.remove('at-pulse'), PULSE_MS);
  }

  return {
    // A book that is finished has no next concept: its first one stands in.
    locate: () => goTo(placeOf(learner) ?? tour(learner)[0]!.id),
    show: (id) => {
      chain(id);
      goTo(id);
    },
    light: (ids) => lightTrack(map, ids?.length ? { ids: new Set(ids), target: ids[0]! } : null),
  };
}
