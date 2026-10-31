import { cssVar, h, onDispose } from './dom';
import type { Color } from './symbols';

/** Reads a palette or theme token, e.g. color('blue') -> var(--c-blue). Re-read on every draw so theme flips apply. */
export function color(c: Color | `--${string}`): string {
  return cssVar(c.startsWith('--') ? c : `--c-${c}`);
}

export function withAlpha(css: string, a: number): string {
  const m = css.match(/^#([0-9a-f]{6})$/i);
  if (!m) return css;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export interface PlotOptions {
  /** CSS height in px; default derives from `aspect`. */
  height?: number;
  /** width / height, default 1.4. */
  aspect?: number;
  /** Called on every resize and theme change; draw everything here. The first call happens on the next frame, never inside the constructor. */
  draw?: (p: Plot) => void;
}

/** A HiDPI canvas in CSS px that redraws on resize and on a theme change. */
export class Plot {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  draw: (p: Plot) => void;

  constructor(parent: HTMLElement, opts: PlotOptions = {}) {
    this.draw = opts.draw ?? (() => {});
    this.canvas = h('canvas', { class: 'plot' });
    if (opts.height) this.canvas.style.height = `${opts.height}px`;
    else this.canvas.style.aspectRatio = String(opts.aspect ?? 1.4);
    parent.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    const mo = new MutationObserver(() => this.redraw());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => this.redraw();
    mq.addEventListener('change', onMq);
    onDispose(() => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', onMq);
    });
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.redraw();
  }

  redraw(): void {
    if (!this.w) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.draw(this);
  }
}
