import { cssVar, h, onDispose } from './dom';
import type { Color } from './symbols';

/** Reads a palette or theme token, e.g. color('blue') -> var(--c-blue). Re-read on every draw so theme flips apply. */
export function color(c: Color | `--${string}`): string {
  return cssVar(c.startsWith('--') ? c : `--c-${c}`);
}

/** Class colors for 2-D datasets, in palette order. */
export const CLASS_COLORS: Color[] = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'gold', 'slate'];

export function withAlpha(css: string, a: number): string {
  const m = css.match(/^#([0-9a-f]{6})$/i);
  if (!m) return css;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function rgbOf(css: string): [number, number, number] {
  const m = css.match(/^#([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface PlotOptions {
  /** CSS height in px; default derives from `aspect`. */
  height?: number;
  /** width / height, default 1.4. */
  aspect?: number;
  /** Data domain [xmin, xmax, ymin, ymax], default [-1, 1, -1, 1]. */
  domain?: [number, number, number, number];
  /** Keep x and y scales equal (circles stay round). Default true. */
  square?: boolean;
  /** Called on every resize and theme change; draw everything here. The first call happens on the next frame, never inside the constructor. */
  draw?: (p: Plot) => void;
}

/**
 * A HiDPI 2-D canvas with a data coordinate system. Plot coordinates are y-up.
 * Use `sx/sy` to map data -> CSS px and `invert` for pointer events.
 */
export class Plot {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  domain: [number, number, number, number];
  square: boolean;
  private ox = 0;
  private oy = 0;
  private kx = 1;
  private ky = 1;
  draw: (p: Plot) => void;

  constructor(parent: HTMLElement, opts: PlotOptions = {}) {
    this.domain = opts.domain ?? [-1, 1, -1, 1];
    this.square = opts.square ?? true;
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
    this.setDomain(...this.domain);
    this.redraw();
  }

  setDomain(x0: number, x1: number, y0: number, y1: number): void {
    this.domain = [x0, x1, y0, y1];
    let kx = this.w / (x1 - x0);
    let ky = this.h / (y1 - y0);
    if (this.square) kx = ky = Math.min(kx, ky);
    this.kx = kx;
    this.ky = ky;
    this.ox = (this.w - kx * (x1 - x0)) / 2 - kx * x0;
    this.oy = (this.h - ky * (y1 - y0)) / 2 + ky * y1;
  }

  /** Visible data bounds (wider than `domain` on the padded axis when `square`). */
  view(): [number, number, number, number] {
    const [x0, y1] = this.invert(0, 0);
    const [x1, y0] = this.invert(this.w, this.h);
    return [x0, x1, y0, y1];
  }

  sx(x: number): number {
    return this.ox + this.kx * x;
  }
  sy(y: number): number {
    return this.oy - this.ky * y;
  }
  /** CSS px -> data. */
  invert(px: number, py: number): [number, number] {
    return [(px - this.ox) / this.kx, (this.oy - py) / this.ky];
  }
  /** Pointer event -> data coordinates. */
  pointer(e: PointerEvent | MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return this.invert(e.clientX - r.left, e.clientY - r.top);
  }
  /** Data length -> CSS px (x scale). */
  len(d: number): number {
    return d * this.kx;
  }

  redraw(): void {
    if (!this.w) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.draw(this);
  }

  /** Background grid + axes through the origin. */
  axes(opts: { grid?: number; labels?: boolean } = {}): void {
    const c = this.ctx;
    const [x0, x1, y0, y1] = this.view();
    const g = opts.grid ?? niceStep((x1 - x0) / 8);
    c.lineWidth = 1;
    c.strokeStyle = color('--grid');
    c.beginPath();
    for (let x = Math.ceil(x0 / g) * g; x <= x1; x += g) {
      c.moveTo(Math.round(this.sx(x)) + 0.5, 0);
      c.lineTo(Math.round(this.sx(x)) + 0.5, this.h);
    }
    for (let y = Math.ceil(y0 / g) * g; y <= y1; y += g) {
      c.moveTo(0, Math.round(this.sy(y)) + 0.5);
      c.lineTo(this.w, Math.round(this.sy(y)) + 0.5);
    }
    c.stroke();
    c.strokeStyle = color('--axis');
    c.beginPath();
    c.moveTo(Math.round(this.sx(0)) + 0.5, 0);
    c.lineTo(Math.round(this.sx(0)) + 0.5, this.h);
    c.moveTo(0, Math.round(this.sy(0)) + 0.5);
    c.lineTo(this.w, Math.round(this.sy(0)) + 0.5);
    c.stroke();
    if (opts.labels) {
      c.fillStyle = color('--ink-3');
      c.font = "11px 'JetBrains Mono Variable', ui-monospace, monospace";
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (let x = Math.ceil(x0 / g) * g; x <= x1; x += g) {
        if (Math.abs(x) < g / 2) continue;
        c.fillText(trimNum(x), this.sx(x), this.sy(0) + 4);
      }
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      for (let y = Math.ceil(y0 / g) * g; y <= y1; y += g) {
        if (Math.abs(y) < g / 2) continue;
        c.fillText(trimNum(y), this.sx(0) - 4, this.sy(y));
      }
    }
  }

  dot(x: number, y: number, r: number, fill: string, stroke?: string): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(this.sx(x), this.sy(y), r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.lineWidth = 1.5;
      c.strokeStyle = stroke;
      c.stroke();
    }
  }

  /** Polyline through data points. */
  path(xs: ArrayLike<number>, ys: ArrayLike<number>, stroke: string, width = 2, dash?: number[]): void {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const X = this.sx(xs[i]!);
      const Y = this.sy(ys[i]!);
      if (i) c.lineTo(X, Y);
      else c.moveTo(X, Y);
    }
    c.lineWidth = width;
    c.strokeStyle = stroke;
    c.setLineDash(dash ?? []);
    c.stroke();
    c.setLineDash([]);
  }

  /** y = f(x) across the visible range. */
  fn(f: (x: number) => number, stroke: string, width = 2.5, dash?: number[]): void {
    const [x0, x1] = this.view();
    const n = Math.max(64, Math.round(this.w / 2));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      xs.push(x);
      ys.push(f(x));
    }
    this.path(xs, ys, stroke, width, dash);
  }

  arrow(x0: number, y0: number, x1: number, y1: number, stroke: string, width = 2): void {
    const c = this.ctx;
    const X0 = this.sx(x0), Y0 = this.sy(y0), X1 = this.sx(x1), Y1 = this.sy(y1);
    const a = Math.atan2(Y1 - Y0, X1 - X0);
    const L = Math.hypot(X1 - X0, Y1 - Y0);
    const hl = Math.min(10, L * 0.4);
    c.strokeStyle = c.fillStyle = stroke;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(X0, Y0);
    c.lineTo(X1 - Math.cos(a) * hl * 0.8, Y1 - Math.sin(a) * hl * 0.8);
    c.stroke();
    c.beginPath();
    c.moveTo(X1, Y1);
    c.lineTo(X1 - hl * Math.cos(a - 0.4), Y1 - hl * Math.sin(a - 0.4));
    c.lineTo(X1 - hl * Math.cos(a + 0.4), Y1 - hl * Math.sin(a + 0.4));
    c.closePath();
    c.fill();
  }

  text(s: string, x: number, y: number, opts: { color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; size?: number; mono?: boolean; bold?: boolean } = {}): void {
    const c = this.ctx;
    c.fillStyle = opts.color ?? color('--ink-2');
    c.font = `${opts.bold ? '600 ' : ''}${opts.size ?? 12}px ${opts.mono ? "'JetBrains Mono Variable', ui-monospace, monospace" : 'system-ui, sans-serif'}`;
    c.textAlign = opts.align ?? 'left';
    c.textBaseline = opts.base ?? 'alphabetic';
    c.fillText(s, this.sx(x), this.sy(y));
  }

  /**
   * Fills the view with a per-cell RGB function at `cell` CSS px resolution (decision regions,
   * loss landscapes). `f` returns [r, g, b, a] with components 0..255.
   */
  field(f: (x: number, y: number) => [number, number, number, number], cell = 6): void {
    const cols = Math.ceil(this.w / cell);
    const rows = Math.ceil(this.h / cell);
    const img = new ImageData(cols, rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [x, y] = this.invert((i + 0.5) * cell, (j + 0.5) * cell);
        const [r, g, b, a] = f(x, y);
        const o = (j * cols + i) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = a;
      }
    }
    const tmp = document.createElement('canvas');
    tmp.width = cols;
    tmp.height = rows;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    const c = this.ctx;
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(tmp, 0, 0, cols * cell, rows * cell);
    c.restore();
  }
}

export function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function trimNum(v: number): string {
  return String(Number(v.toPrecision(4)));
}

/** A plain HiDPI canvas without a coordinate system, for pixel grids and diagrams. */
export function hidpiCanvas(parent: HTMLElement, cssW: number, cssH: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): { canvas: HTMLCanvasElement; redraw(): void } {
  const canvas = h('canvas', { class: 'plot' });
  canvas.style.aspectRatio = `${cssW} / ${cssH}`;
  parent.append(canvas);
  const ctx = canvas.getContext('2d')!;
  let w = 0;
  let hh = 0;
  const redraw = () => {
    if (!w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    draw(ctx, w, hh);
  };
  const ro = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    hh = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    redraw();
  });
  ro.observe(canvas);
  const mo = new MutationObserver(redraw);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  onDispose(() => {
    ro.disconnect();
    mo.disconnect();
  });
  return { canvas, redraw };
}
