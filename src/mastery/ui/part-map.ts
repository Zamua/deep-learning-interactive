// The map, one part of a course at a time: its concepts and what they directly build on.
import { backRow, icon } from '../../core/controls';
import { h } from '../../core/dom';
import { layoutPart, wrapTitle } from '../domain/part-layout';
import type { Learner } from '../learner';
import { plural, roman, spell } from './common';
import { partInProgress } from './course';
import { mapSearch } from './map-search';

const WIDTH = 390;
/** More concepts from earlier parts than fit one row are listed above the map, not drawn into it. */
const DRAWN = 3;
const LINE = 15;
/** From a row's labels to the next row's dots. */
const GAP = 34;
/** From the dot to its first line of label. */
const LABEL = 20;

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPart(main: HTMLElement, learner: Learner, part?: string): void {
  const { course, graph } = learner;
  const parts = course.domains.filter((d) => graph.order.some((c) => c.domain === d.id));
  const i = Math.max(0, parts.findIndex((d) => d.id === (part ?? partInProgress(learner))));
  const here = parts[i]!;
  const concepts = graph.order.filter((c) => c.domain === here.id);
  const inside = new Set(concepts.map((c) => c.id));
  const outside = [...new Set(concepts.flatMap((c) => c.prereqs).filter((p) => !inside.has(p)))];
  const earlier = new Set(outside.map((p) => graph.get(p)!.domain)).size;
  const st = learner.statuses();
  const next = learner.current();
  const held = concepts.filter((c) => learner.record(c.id).mastered).length;

  const drawn = outside.length <= DRAWN ? outside : [];
  const nodes = [...drawn.map((id) => ({ id, prereqs: [] })), ...concepts.map((c) => ({ id: c.id, prereqs: c.prereqs }))];
  const placed = layoutPart(nodes);
  const perRow = new Map<number, number>();
  for (const p of placed) perRow.set(p.row, (perRow.get(p.row) ?? 0) + 1);
  const lines = new Map(placed.map((p) => {
    const n = perRow.get(p.row)!;
    return [p.id, wrapTitle(graph.get(p.id)!.title, n === 1 ? 34 : n === 2 ? 24 : 16)] as const;
  }));
  const tallest = (row: number) => Math.max(...placed.filter((p) => p.row === row).map((p) => lines.get(p.id)!.length));
  const rowY: number[] = [24];
  for (let r = 1; r <= Math.max(...placed.map((p) => p.row)); r++) rowY[r] = rowY[r - 1]! + LABEL + tallest(r - 1) * LINE + GAP;
  const at = new Map(placed.map((p) => [p.id, { x: Math.round(p.x * WIDTH), y: rowY[p.row]! }]));
  const height = Math.max(...placed.map((p) => at.get(p.id)!.y + LABEL + lines.get(p.id)!.length * LINE)) + 8;

  const edges = nodes.flatMap((n) => n.prereqs.filter((p) => at.has(p)).map((p) => {
    const a = at.get(p)!;
    const b = at.get(n.id)!;
    const from = a.y + LABEL + (lines.get(p)!.length - 1) * LINE + 6;
    const to = b.y - (n.id === next ? 13 : 8);
    const mid = (from + to) / 2;
    return `<path class="pm-edge${n.id === next ? ' on' : ''}" d="M${a.x} ${from} C${a.x} ${mid},${b.x} ${mid},${b.x} ${to}"/>`;
  })).join('');

  const marks = nodes.map((n) => {
    const { x, y } = at.get(n.id)!;
    const s = st.get(n.id);
    const cls = s === 'mastered' || s === 'due' || s === 'slipping' ? 'done' : n.id === next ? 'now' : 'later';
    const dot = cls === 'now' ? `<circle class="pm-ring" cx="${x}" cy="${y}" r="10"/><circle class="pm-dot" cx="${x}" cy="${y}" r="5.5"/>` : `<circle class="pm-dot" cx="${x}" cy="${y}" r="5.5"/>`;
    const label = lines.get(n.id)!;
    const text = label.map((t, k) => `<text x="${x}" y="${y + LABEL + (cls === 'now' ? 4 : 0) + k * LINE}">${esc(t)}</text>`).join('');
    const half = WIDTH / (2 * perRow.get(placed.find((p) => p.id === n.id)!.row)!);
    const box = `<rect class="pm-hit" x="${x - half + 2}" y="${y - 16}" width="${2 * half - 4}" height="${LABEL + 16 + label.length * LINE}"/>`;
    return `<a href="${esc(course.routes.concept(n.id))}" class="pm-n ${cls}" data-id="${esc(n.id)}">${box}${dot}${text}</a>`;
  }).join('');

  const map = h('div', { class: 'pm-map', html: `<svg viewBox="0 0 ${WIDTH} ${height}" role="group" aria-label="Concepts in ${esc(here.title)}">${edges}${marks}</svg>` });
  const search = mapSearch(learner, {
    light: (found) => {
      const lit = new Set(found ?? []);
      for (const n of map.querySelectorAll<SVGElement>('.pm-n')) n.classList.toggle('lit', lit.has(n.dataset.id!));
    },
    pick: (id) => void (location.hash = course.routes.concept(id)),
  });
  const panel = h('div', { class: 'pm-search', hidden: true }, search);
  const find = h('button', { type: 'button', class: 'lib-icon', 'aria-label': 'Find a concept', 'aria-expanded': 'false', html: icon('magnifying-glass') });
  find.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    find.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.querySelector('input')?.focus();
  });

  const step = (to: typeof here | undefined, glyph: string, label: string) => to
    ? h('a', { class: 'lib-icon', href: course.routes.part(to.id), 'aria-label': `${label}: ${to.title}`, html: icon(glyph) })
    : h('span', { class: 'lib-icon off', 'aria-hidden': 'true', html: icon(glyph) });
  const from = earlier ? ` Opens from ${spell(earlier)} earlier ${earlier === 1 ? 'part' : 'parts'}.` : '';

  main.append(h('div', { class: 'lib' },
    backRow(course.routes.home, course.title, find),
    panel,
    h('div', { class: 'pm-head' },
      step(parts[i - 1], 'caret-left', 'Previous part'),
      h('div', {}, h('div', { class: 'lib-kick' }, `Part ${roman(i + 1)} of ${roman(parts.length)}`), h('h1', { class: 'pm-title' }, here.title)),
      step(parts[i + 1], 'caret-right', 'Next part')),
    h('p', { class: 'lib-sub pm-sub' }, `${held} of ${plural(concepts.length, 'concept')}.${from}`),
    ...(drawn.length ? [] : outside.length ? [h('p', { class: 'pm-from' }, 'Builds on ', ...outside.flatMap((id, k) => [k ? ', ' : '', h('a', { href: course.routes.concept(id) }, graph.get(id)!.title)]))] : []),
    map,
    h('a', { class: 'lib-li', href: course.routes.list }, h('span', { html: icon('rows') }), h('span', { class: 'g' }, 'Every concept, as a list'), h('span', { html: icon('caret-right') }))));
}
