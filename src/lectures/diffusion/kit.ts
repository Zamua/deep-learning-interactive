import type { Color } from '../../core/symbols';
import type { Scene, TextOpts } from '../../lecture/scene';

export type Rect = [number, number, number, number];
export type K = Color | `--${string}`;

/** Maps a data window onto a pixel rectangle of the stage (y up). */
export class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    dom: [number, number, number, number],
    square = true,
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    let kx = rw / (x1 - x0);
    let ky = rh / (y1 - y0);
    if (square) kx = ky = Math.min(kx, ky);
    this.kx = kx;
    this.ky = ky;
    this.ox = rx + (rw - kx * (x1 - x0)) / 2 - kx * x0;
    this.oy = ry + (rh - ky * (y1 - y0)) / 2 + ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  /** A light card behind the plot, with the two axes. */
  card(a = 1): void {
    const s = this.s;
    const [rx, ry, rw, rh] = this.rect;
    s.alpha(a, () => {
      s.rrect(rx, ry, rw, rh, 1.6, { fill: s.tint('--paper', 0.55), stroke: s.c('--rule'), lw: 0.25 });
      this.clip(() => {
        s.line(this.X(0), ry, this.X(0), ry + rh, s.c('--grid'), 0.25);
        s.line(rx, this.Y(0), rx + rw, this.Y(0), s.c('--grid'), 0.25);
      });
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  /** n points of a flat (x, y) array as dots of radius r (stage units). */
  dots(pts: ArrayLike<number>, col: string, r = 0.8, n = pts.length / 2): void {
    const c = this.s.ctx;
    const rp = r * this.s.u;
    this.clip(() => {
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = this.X(pts[2 * i]!), y = this.Y(pts[2 * i + 1]!);
        if (!(Math.abs(x) < 1e5 && Math.abs(y) < 1e5)) continue;
        c.moveTo(x + rp, y);
        c.arc(x, y, rp, 0, Math.PI * 2);
      }
      c.fillStyle = col;
      c.fill();
    });
  }
  path(xs: number[], ys: number[], col: string, width = 0.4, dash?: number[]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      xs.forEach((x, i) => (i ? c.lineTo(this.X(x), this.Y(ys[i]!)) : c.moveTo(this.X(x), this.Y(ys[i]!))));
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.6, head = 2.6): void {
    this.clip(() => this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head));
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** The drawing area under the scene chip, inside a margin. */
export function area(s: Scene, top = 0.13, pad = 0.04): Rect {
  const m = Math.max(s.w * pad, s.u * 4);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** True unless the stage is clearly wider than tall (a phone or a desktop window both stack). */
export function stacked(s: Scene): boolean {
  return s.w / s.h < 1.45;
}

/** A main plot and a side panel: stacked on most stages, side by side on a wide one. */
export function split(s: Scene, frac = 0.58, top = 0.13): { main: Rect; side: Rect } {
  const [x, y, w, h] = area(s, top);
  const g = s.u * 3;
  if (stacked(s)) {
    const mh = h * frac;
    return { main: [x, y, w, mh], side: [x, y + mh + g, w, h - mh - g] };
  }
  const mw = w * frac;
  return { main: [x, y, mw, h], side: [x + mw + g, y, w - mw - g, h] };
}

/** Comet tails: the last `tail` positions of the chosen points, fading with age. */
export function tails(fr: Frame, frames: Float32Array[], head: number, ids: number[], col: (a: number) => string, tail: number, width = 0.35): void {
  const i = Math.min(Math.floor(head), frames.length - 1);
  const f = i < frames.length - 1 ? head - i : 0;
  for (const j of ids) {
    const nx = frames[Math.min(i + 1, frames.length - 1)]!;
    let px = frames[i]![2 * j]! + (nx[2 * j]! - frames[i]![2 * j]!) * f;
    let py = frames[i]![2 * j + 1]! + (nx[2 * j + 1]! - frames[i]![2 * j + 1]!) * f;
    for (let q = i, age = 0; q >= Math.max(0, i - tail); q--, age++) {
      const qx = frames[q]![2 * j]!, qy = frames[q]![2 * j + 1]!;
      fr.path([px, qx], [py, qy], col(1 - age / (tail + 1)), width);
      px = qx;
      py = qy;
    }
  }
}

/** Positions at a fractional frame index, linearly blended between neighboring frames. */
export function at(frames: Float32Array[], head: number, out: Float32Array): Float32Array {
  const i = Math.max(0, Math.min(Math.floor(head), frames.length - 1));
  const A = frames[i]!;
  const B = frames[Math.min(i + 1, frames.length - 1)]!;
  const f = i < frames.length - 1 ? Math.max(0, head - i) : 0;
  for (let k = 0; k < out.length; k++) out[k] = A[k]! + (B[k]! - A[k]!) * f;
  return out;
}

/** Two equal panels for a comparison: side by side unless the stage is nearly square. */
export function pair(s: Scene, top = 0.13): [Rect, Rect] {
  const [x, y, w, h] = area(s, top);
  const g = s.u * 3;
  if (s.w / s.h < 1.2) return [[x, y, w, (h - g) / 2], [x, y + (h + g) / 2, w, (h - g) / 2]];
  return [[x, y, (w - g) / 2, h], [x + (w + g) / 2, y, (w - g) / 2, h]];
}

/** Text shrunk, if needed, to fit `maxW` pixels. */
export function fit(s: Scene, text: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  const size = o.size ?? 5;
  const w = s.measure(text, o);
  s.text(text, x, y, { ...o, size: w > maxW ? (size * maxW) / w : size });
}

/** A rounded label on an opaque card, centered at (x, y) but kept inside the stage. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, size = 3.4, fill = 0.12): number {
  let sz = size;
  let tw = s.measure(text, { font: 'ui', size: sz, weight: 600 });
  const room = s.w - s.u * 8;
  if (tw + s.u * sz * 1.1 > room) {
    sz *= room / (tw + s.u * sz * 1.1);
    tw = s.measure(text, { font: 'ui', size: sz, weight: 600 });
  }
  const pw = tw + s.u * sz * 1.1;
  const ph = s.u * sz * 1.8;
  const cx = Math.max(s.u * 4 + pw / 2, Math.min(s.w - s.u * 4 - pw / 2, x));
  s.rrect(cx - pw / 2, y - ph / 2, pw, ph, sz * 0.9, { fill: s.c('--card') });
  s.rrect(cx - pw / 2, y - ph / 2, pw, ph, sz * 0.9, { fill: s.tint(k, fill), stroke: s.tint(k, 0.7), lw: 0.3 });
  s.text(text, cx, y + s.u * 0.15, { font: 'ui', size: sz, weight: 600, color: s.c(k) });
  return pw;
}

/** "x0" with a hat, drawn as strokes so it renders the same everywhere. */
export function hatX0(s: Scene, x: number, y: number, size: number, col: string, align: 'left' | 'center' = 'left'): void {
  const w = s.measure('x₀', { size, font: 'ui', weight: 650 });
  const x0 = align === 'center' ? x - w / 2 : x;
  s.text('x₀', x0, y, { size, font: 'ui', weight: 650, color: col, align: 'left', halo: true });
  const wx = s.measure('x', { size, font: 'ui', weight: 650 });
  const cx = x0 + wx * 0.55;
  const top = y - size * s.u * 0.55;
  s.line(cx - size * s.u * 0.2, top, cx, top - size * s.u * 0.2, col, size * 0.07);
  s.line(cx, top - size * s.u * 0.2, cx + size * s.u * 0.2, top, col, size * 0.07);
}
