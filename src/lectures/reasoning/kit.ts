import type { Color } from '../../core/symbols';
import type { Scene, TextOpts } from '../../lecture/scene';

export type K = Color | `--${string}`;

/** Largest text size (in u, at most `size`) at which `str` fits in `maxW` px. */
export function fit(s: Scene, str: string, maxW: number, size: number, o: TextOpts = {}): number {
  const w = s.measure(str, { ...o, size });
  return w > maxW ? (size * maxW) / w : size;
}

/** Text shrunk to fit `maxW`. */
export function fitText(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  s.text(str, x, y, { ...o, size: fit(s, str, maxW, o.size ?? 5, o) });
}

/** A disc with a check (true) or a cross (false). */
export function badge(s: Scene, cx: number, cy: number, r: number, ok: boolean): void {
  s.circle(cx, cy, r, { fill: s.c(ok ? 'green' : 'red') });
  const c = s.ctx;
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(1.4, r * 0.28);
  c.lineCap = 'round';
  c.beginPath();
  if (ok) {
    c.moveTo(cx - r * 0.45, cy + r * 0.02);
    c.lineTo(cx - r * 0.1, cy + r * 0.38);
    c.lineTo(cx + r * 0.5, cy - r * 0.35);
  } else {
    c.moveTo(cx - r * 0.38, cy - r * 0.38);
    c.lineTo(cx + r * 0.38, cy + r * 0.38);
    c.moveTo(cx + r * 0.38, cy - r * 0.38);
    c.lineTo(cx - r * 0.38, cy + r * 0.38);
  }
  c.stroke();
}

/** A rounded tag of text. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: TextOpts['font']; maxW?: number } = {}): number {
  const font = o.font ?? 'ui';
  let size = o.size ?? 3.8;
  if (o.maxW) size = fit(s, text, o.maxW - s.u * size * 0.95, size, { font, weight: 600 });
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A token chip: rounded box with a label. */
export function chip(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; font?: TextOpts['font']; ink?: string } = {}): void {
  const on = o.on ?? 0.5;
  s.rrect(x, y, w, h, 1.2, { fill: s.tint(k, 0.08 + 0.18 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.25 + 0.2 * on });
  if (label) fitText(s, label, x + w / 2, y + h / 2 + s.u * 0.2, w - s.u * 1.2, { font: o.font ?? 'mono', size: o.size ?? Math.min(4, (h / s.u) * 0.5), weight: 600, color: o.ink ?? s.c('--ink') });
}

/** A rounded box with a title and an optional second line. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: K, title: string, sub = '', o: { on?: number; size?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.15 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.2 * on });
  const size = o.size ?? 4.2;
  if (sub) {
    fitText(s, title, x + w / 2, y + h * 0.36, w - s.u * 3, { size, font: 'ui', weight: 650 });
    fitText(s, sub, x + w / 2, y + h * 0.7, w - s.u * 3, { size: size * 0.86, font: 'ui', color: s.c('--ink-2') });
  } else fitText(s, title, x + w / 2, y + h / 2, w - s.u * 3, { size, font: 'ui', weight: 650 });
}

/** A chart frame: data window onto a stage rectangle (y up), with gridlines and tick labels. */
export class Frame {
  constructor(
    readonly s: Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly dom: [number, number, number, number],
  ) {}
  X(v: number): number {
    const [a, b] = this.dom;
    return this.x + ((v - a) / (b - a)) * this.w;
  }
  Y(v: number): number {
    const [, , a, b] = this.dom;
    return this.y + this.h - ((v - a) / (b - a)) * this.h;
  }
  axes(xt: [number, string][], yt: [number, string][], xLabel = ''): void {
    const s = this.s;
    for (const [v, l] of yt) {
      s.line(this.x, this.Y(v), this.x + this.w, this.Y(v), s.c('--grid'), 0.22);
      s.text(l, this.x - s.u * 1.2, this.Y(v), { font: 'mono', size: 3.4, align: 'right', color: s.c('--ink-3') });
    }
    for (const [v, l] of xt) s.text(l, this.X(v), this.y + this.h + s.u * 3.6, { font: 'mono', size: 3.4, color: s.c('--ink-3') });
    s.line(this.x, this.y + this.h, this.x + this.w, this.y + this.h, s.c('--axis'), 0.3);
    s.line(this.x, this.y, this.x, this.y + this.h, s.c('--axis'), 0.3);
    if (xLabel) s.text(xLabel, this.x + this.w, this.y + this.h + s.u * 8, { font: 'ui', size: 3.4, align: 'right', color: s.c('--ink-3') });
  }
  /** A polyline through the first `upTo` share of the points (for drawing a curve in). */
  path(xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, width = 0.7, upTo = 1, dash?: number[]): void {
    const s = this.s;
    const c = s.ctx;
    const n = Math.max(0, Math.min(xs.length, Math.round(xs.length * upTo)));
    if (n < 2) return;
    c.save();
    c.beginPath();
    c.rect(this.x - s.u, this.y - s.u, this.w + 2 * s.u, this.h + 2 * s.u);
    c.clip();
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const X = this.X(xs[i]!);
      const Y = this.Y(ys[i]!);
      if (i) c.lineTo(X, Y);
      else c.moveTo(X, Y);
    }
    c.strokeStyle = col;
    c.lineWidth = width * s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
    c.stroke();
    c.restore();
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** Width of the stage in u. */
export const wu = (s: Scene): number => s.w / s.u;
