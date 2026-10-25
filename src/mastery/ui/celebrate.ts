// The moment a concept is mastered: the whole map, a zoom onto it, what it just unlocked and what
// comes next. Continue (or a tap anywhere) skips it at any point.
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import type { Learner } from '../learner';
import { graphView } from './graph-view';

/** Laid out wide, so the zoomed-out map is a page of rows rather than a thin column. */
const MAP_W = 900;
const STEPS = { zoom: 450, zoomFor: 1100, master: 1600, unlock: 2000, stagger: 160, next: 2500 };

/** One light tap where the device can: Android vibrates; iOS 18+ ticks when a switch is toggled. */
export function haptic(): void {
  if (navigator.vibrate?.(12)) return;
  const input = h('input', { type: 'checkbox', switch: '' });
  const label = h('label', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;pointer-events:none' }, input);
  document.body.append(label);
  label.click();
  label.remove();
}

/** Plays the moment over `host` and resolves when the learner moves on. */
export function celebrate(host: HTMLElement, learner: Learner, id: string, unlocked: string[], next: string | undefined): Promise<void> {
  const graph = learner.graph;
  const c = graph.get(id)!;
  const map = graphView(learner);
  map.style.width = `${MAP_W}px`;
  const stage = h('div', { class: 'at-cm-map' }, map);
  const view = h('div', { class: 'at-cm-view' }, stage);
  const here = h('div', { class: 'at-cm-here' });
  const done = [...learner.statuses().values()].filter((s) => s === 'mastered' || s === 'due').length;
  const go = h('button', { type: 'button', class: 'at-cm-go' }, 'Continue');
  const el = h('div', { class: 'at-cm', role: 'dialog', 'aria-label': `${c.title} mastered` },
    h('div', { class: 'at-cm-title', html: `${icon('sparkle')} ${c.title} mastered` }),
    view,
    here,
    h('div', { class: 'at-cm-cap' },
      `${done} of ${graph.order.length} concepts mastered`,
      unlocked.length ? ` · ${unlocked.length} unlocked` : ''),
    go);
  host.append(el);
  haptic();

  const node = (x: string) => map.querySelector<HTMLElement>(`.at-node[data-id="${x}"]`);
  const edges = unlocked.flatMap((u) => [...map.querySelectorAll<SVGPathElement>(`path[data-e="${id}>${u}"]`)]);
  node(id)?.classList.add('cm-pre');
  for (const u of unlocked) node(u)?.classList.add('cm-locked');
  for (const e of edges) e.classList.add('cm-edge');

  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  let finish!: () => void;
  const out = new Promise<void>((resolve) => (finish = resolve));
  const close = () => {
    timers.forEach(clearTimeout);
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 200);
    finish();
  };
  go.addEventListener('click', close);
  onDispose(close);

  // Positions only exist once the map has laid itself out, a frame after it is in the page.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const box = (x: string) => {
      const n = node(x)!;
      const [tx = 0, ty = 0] = n.style.translate.split(' ').map(parseFloat);
      return { x: tx, y: ty, w: n.offsetWidth, h: n.offsetHeight };
    };
    const mw = map.offsetWidth;
    const mh = map.offsetHeight;
    const fit = Math.min(vw / mw, vh / mh);
    const whole = `translate(${(vw - mw * fit) / 2}px, ${(vh - mh * fit) / 2}px) scale(${fit})`;
    const parts = [id, ...unlocked, ...(next && !unlocked.includes(next) ? [next] : [])].map(box);
    const x0 = Math.min(...parts.map((b) => b.x)) - 24;
    const x1 = Math.max(...parts.map((b) => b.x + b.w)) + 24;
    const y0 = Math.min(...parts.map((b) => b.y)) - 40;
    const y1 = Math.max(...parts.map((b) => b.y + b.h)) + 40;
    const z = Math.min(1.25, vw / (x1 - x0), vh / (y1 - y0));
    const close_ = `translate(${vw / 2 - ((x0 + x1) / 2) * z}px, ${vh / 2 - ((y0 + y1) / 2) * z}px) scale(${z})`;
    const me = box(id);
    const place = (m: DOMMatrix) => {
      const vr = view.getBoundingClientRect();
      here.style.left = `${vr.left + m.m41 + (me.x + me.w / 2) * m.a}px`;
      here.style.top = `${vr.top + m.m42 + (me.y + me.h / 2) * m.a}px`;
    };
    stage.style.transform = whole;
    place(new DOMMatrix(whole));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zoom = stage.animate([{ transform: whole }, { transform: close_ }], { delay: reduced ? 0 : STEPS.zoom, duration: reduced ? 1 : STEPS.zoomFor, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    const track = () => {
      place(new DOMMatrix(getComputedStyle(stage).transform));
      if (zoom.playState === 'running' || zoom.pending) requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
    at(reduced ? 0 : STEPS.master, () => {
      here.classList.add('gone');
      const n = node(id);
      n?.classList.remove('cm-pre');
      n?.classList.add('cm-pop');
    });
    at(reduced ? 0 : STEPS.unlock, () => {
      for (const e of edges) e.classList.add('lit', 'cm-draw');
      unlocked.forEach((u, i) => at(i * STEPS.stagger, () => {
        node(u)?.classList.remove('cm-locked');
        node(u)?.classList.add('cm-pop');
      }));
    });
    if (next) at(reduced ? 0 : STEPS.next, () => {
      const b = box(next);
      node(next)?.classList.add('cm-next');
      stage.append(h('div', { class: 'at-cm-next', style: `left:${b.x + b.w / 2}px;top:${b.y + b.h + 8}px` }, 'Up next'));
    });
  }));
  return out;
}
