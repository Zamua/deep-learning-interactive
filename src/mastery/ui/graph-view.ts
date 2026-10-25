// The concept graph drawn as layers by depth: prerequisites above, edges as curves between them.
import { domainOf } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import type { ConceptGraph } from '../domain/graph';
import { streak } from '../domain/model';
import type { Learner } from '../learner';

const NODE_H = 66;
const ROW_GAP = 46;

export function graphView(learner: Learner): HTMLElement {
  const graph = learner.graph;
  const st = learner.statuses();
  const wrap = h('div', { class: 'at-graph' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('at-edges');
  wrap.append(svg);

  const nodes = new Map<string, HTMLElement>();
  for (const c of graph.order) {
    const s = st.get(c.id)!;
    const rec = learner.record(c.id);
    const mark =
      s === 'mastered' ? icon('check')
      : s === 'due' ? `${icon('clock')}<span>review</span>`
      : s === 'slipping' ? `${icon('reset')}<span>slipping</span>`
      : s === 'learning' ? `<span class="at-dots">${Array.from({ length: c.mastery.streak }, (_, i) => `<i class="${i < streak(rec) ? 'on' : ''}"></i>`).join('')}</span>`
      : s === 'new' ? '<span>new</span>'
      : icon('lock');
    const el = h('a', { class: `at-node st-${s}`, href: `#/atlas/${c.id}`, style: `--dom:var(--c-${domainOf(c).color})` },
      h('span', { class: 'at-node-t' }, c.title),
      h('span', { class: 'at-node-s', html: mark }));
    nodes.set(c.id, el);
    wrap.append(el);
  }

  const layout = () => {
    const width = wrap.clientWidth;
    if (!width) return;
    const perRow = Math.max(4, Math.min(8, Math.floor(width / 96)));
    const nodeW = Math.min(132, (width - (perRow - 1) * 10) / perRow);
    const rows = layerRows(graph, perRow);
    const pos = new Map<string, { x: number; y: number }>();
    rows.forEach((row, j) => row.forEach((id, i) => pos.set(id, { x: (width * (i + 0.5)) / row.length, y: j * (NODE_H + ROW_GAP) })));
    const height = rows.length * (NODE_H + ROW_GAP) - ROW_GAP + 4;
    wrap.style.height = `${height}px`;
    for (const [id, el] of nodes) {
      const p = pos.get(id)!;
      el.style.width = `${nodeW}px`;
      el.style.transform = `translate(${p.x - nodeW / 2}px, ${p.y}px)`;
    }
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.innerHTML = graph.order
      .flatMap((c) =>
        c.prereqs.map((pid) => {
          const a = pos.get(pid)!;
          const b = pos.get(c.id)!;
          const y1 = a.y + NODE_H;
          const my = (y1 + b.y) / 2;
          const lit = st.get(c.id) !== 'locked';
          return `<path class="${lit ? 'lit' : ''}" d="M${a.x} ${y1} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}"/>`;
        }),
      )
      .join('');
  };
  const ro = new ResizeObserver(layout);
  ro.observe(wrap);
  onDispose(() => ro.disconnect());
  return wrap;
}

/**
 * Concepts by depth, each layer ordered by where its prerequisites sit (two barycenter passes)
 * to keep edges from crossing, and wrapped into rows of at most `perRow`.
 */
export function layerRows(graph: ConceptGraph, perRow: number): string[][] {
  const layers: string[][] = [];
  for (const c of graph.order) (layers[graph.depth.get(c.id)!] ??= []).push(c.id);
  const x = new Map<string, number>();
  const place = () => layers.forEach((l) => l.forEach((id, i) => x.set(id, (i + 0.5) / l.length)));
  place();
  for (let pass = 0; pass < 2; pass++) {
    for (const l of layers.slice(1)) {
      const bary = (id: string) => {
        const ps = graph.get(id)!.prereqs;
        return ps.reduce((a, p) => a + x.get(p)!, 0) / ps.length;
      };
      l.sort((a, b) => bary(a) - bary(b));
      l.forEach((id, i) => x.set(id, (i + 0.5) / l.length));
    }
  }
  return layers.flatMap((l) => Array.from({ length: Math.ceil(l.length / perRow) }, (_, i) => l.slice(i * perRow, (i + 1) * perRow)));
}

