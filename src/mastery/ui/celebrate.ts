// The moment a concept is mastered: the whole map, a zoom onto it, what it just unlocked and what
// comes next. Continue (or a tap anywhere) skips it at any point.
import { hasExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { trackConcepts } from '../domain/tracks';
import type { Learner } from '../learner';
import { graphView } from './graph-view';
import { routes } from '../../routes';

/** Laid out wide, so the zoomed-out map is a page of rows rather than a thin column. */
const MAP_W = 900;
const STEPS = { zoom: 450, zoomFor: 1100, master: 1600, unlock: 2000, stagger: 160, next: 2500, panFor: 900 };
/** Close up, a node is drawn near its real size; never smaller than this, so the zoom always reads. */
const NEAR = 0.8;

/** One light tap where the device can: Android vibrates; iOS 18+ ticks when a switch is toggled. */
export function haptic(): void {
  if (navigator.vibrate?.(12)) return;
  const input = h('input', { type: 'checkbox', switch: '' });
  const label = h('label', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;pointer-events:none' }, input);
  document.body.append(label);
  label.click();
  label.remove();
}

/** Plays the moment over `host` and resolves when the learner moves on; `track` is the target of the track followed. */
export function celebrate(host: HTMLElement, learner: Learner, id: string, unlocked: string[], next: string | undefined, track?: string): Promise<void> {
  const graph = learner.graph;
  const c = graph.get(id)!;
  const map = graphView(learner);
  map.style.width = `${MAP_W}px`;
  const stage = h('div', { class: 'at-cm-map' }, map);
  const view = h('div', { class: 'at-cm-view' }, stage);
  const here = h('div', { class: 'at-cm-here' });
  const done = [...learner.statuses().values()].filter((s) => s === 'mastered' || s === 'due').length;
  const finished = !!track && trackConcepts(graph, track).every((x) => learner.record(x).mastered);
  const along = track && !finished ? track : undefined;
  // A new concept opens on its explainer, never straight into its practice.
  const watch = !!next && hasExplainer(next);
  const go = h('button', { type: 'button', class: 'at-cm-go' },
    watch ? h('span', { class: 'at-cm-play', html: icon('playFill') }) : '',
    next ? `Next: ${graph.get(next)!.title}` : 'Continue');
  const stay = next ? h('button', { type: 'button', class: 'at-cm-stay' }, 'Back to this session') : '';
  // Where the next new concept is Atlas's pick, the learner may prefer another.
  const other = next && learner.status(next) === 'new' && learner.choices().open.length > 1 ? h('a', { class: 'at-cm-stay', href: routes.next }, 'Choose something else') : '';
  const el = h('div', { class: 'at-cm', role: 'dialog', 'aria-label': `${c.title} mastered` },
    h('div', { class: 'at-cm-title', html: `${icon('sparkle')} ${c.title} mastered` }),
    view,
    here,
    h('div', { class: 'at-cm-cap' },
      finished ? `Track complete: ${graph.get(track!)!.title} · ` : '',
      `${done} of ${graph.order.length} concepts mastered`,
      unlocked.length ? ` · ${unlocked.length} unlocked` : ''),
    go,
    other,
    stay);
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
  go.addEventListener('click', () => {
    close();
    if (next) location.hash = watch ? routes.watch(next, along) : routes.concept(next);
  });
  if (stay) stay.addEventListener('click', close);
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
    // Frame the concept and what it unlocks; a far-off "up next" gets its own pan afterwards.
    const parts = [id, ...unlocked].map(box);
    const x0 = Math.min(...parts.map((b) => b.x)) - 24;
    const x1 = Math.max(...parts.map((b) => b.x + b.w)) + 24;
    const y0 = Math.min(...parts.map((b) => b.y)) - 40;
    const y1 = Math.max(...parts.map((b) => b.y + b.h)) + 40;
    const z = Math.max(NEAR, Math.min(1.1, vw / (x1 - x0), vh / (y1 - y0)));
    const me0 = box(id);
    const cx = z * (x1 - x0) <= vw ? (x0 + x1) / 2 : me0.x + me0.w / 2;
    const cy = z * (y1 - y0) <= vh ? (y0 + y1) / 2 : me0.y + me0.h / 2;
    const at_ = (x: number, y: number) => `translate(${vw / 2 - x * z}px, ${vh / 2 - y * z}px) scale(${z})`;
    const close_ = at_(cx, cy);
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
    if (next) {
      const b = box(next);
      const seen = Math.abs((b.x + b.w / 2 - cx) * z) < vw / 2 - 16 && Math.abs((b.y + b.h / 2 - cy) * z) < vh / 2 - 24;
      const show = () => {
        node(next)?.classList.add('cm-next');
        stage.append(h('div', { class: 'at-cm-next', style: `left:${b.x + b.w / 2}px;top:${b.y + b.h + 8}px` }, 'Up next'));
      };
      if (seen) at(reduced ? 0 : STEPS.next, show);
      else at(reduced ? 0 : STEPS.next, () => {
        stage.animate([{ transform: close_ }, { transform: at_(b.x + b.w / 2, b.y + b.h / 2) }], { duration: reduced ? 1 : STEPS.panFor, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
        at(reduced ? 0 : STEPS.panFor - 150, show);
      });
    }
  }));
  return out;
}
