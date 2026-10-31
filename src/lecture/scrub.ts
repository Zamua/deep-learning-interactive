import { h } from '../core/dom';
import { clamp01 } from './scene';
import type { TScene } from './timeline';

export interface Scrub {
  el: HTMLElement;
  /** Shows the lecture's progress at time `T`. */
  show(T: number): void;
}

/** The seek bar: drag anywhere on it; the tip says `tip(t)` for the moment under the pointer. */
export function mountScrub(o: {
  root: HTMLElement;
  scenes: TScene[];
  duration: number;
  tip(t: number): string;
  seek(t: number): void;
  seekBy(dt: number): void;
}): Scrub {
  const { root, duration } = o;
  const fill = h('div', { class: 'lec-fill' });
  const thumb = h('div', { class: 'lec-thumb' });
  const ticks = h('div', { class: 'lec-ticks' });
  const tip = h('div', { class: 'lec-tip' });
  const el = h('div', { class: 'lec-scrub', role: 'slider', tabindex: '0', 'aria-label': 'Seek', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(duration)) },
    h('div', { class: 'lec-track' }, fill, ticks), thumb, tip);
  for (const s of o.scenes) {
    const t = h('div', { class: 'lec-tick' });
    t.style.left = `${(s.start / duration) * 100}%`;
    ticks.append(t);
  }
  fill.style.transform = 'scaleX(0)';
  thumb.style.left = '0%';

  const tAt = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / r.width) * duration;
  };
  let dragging = false;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    root.classList.add('scrubbing');
    o.seek(tAt(e));
  });
  el.addEventListener('pointermove', (e) => {
    const t = tAt(e);
    tip.textContent = o.tip(t);
    tip.style.left = `${(t / duration) * 100}%`;
    if (dragging) o.seek(t);
  });
  const endDrag = () => {
    dragging = false;
    root.classList.remove('scrubbing');
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      // The page's own arrow keys would seek again.
      e.stopPropagation();
      o.seekBy(e.key === 'ArrowRight' ? 5 : -5);
    }
  });

  return {
    el,
    show(T) {
      const f = duration ? T / duration : 0;
      fill.style.transform = `scaleX(${f})`;
      thumb.style.left = `${f * 100}%`;
      el.setAttribute('aria-valuenow', String(Math.round(T)));
    },
  };
}
