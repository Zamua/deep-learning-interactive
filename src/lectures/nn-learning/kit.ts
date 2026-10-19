import { rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import type { Surface } from '../../lib/nn-learning-optim';
import { type Scene, clamp01 } from '../../lecture/scene';
import type { Region } from './data';

export type Rect = [number, number, number, number];
export type K = Color | `--${string}`;

/** The stage inside a margin, leaving room for the scene chip at the top. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = Math.min(s.w, s.h) * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Splits a rect into two panes: side by side on a wide stage, stacked on a tall one. */
export function split(s: Scene, r: Rect, frac = 0.5, gap = 4): [Rect, Rect] {
  const [x, y, w, h] = r;
  const g = gap * s.u;
  if (s.tall) {
    const h0 = (h - g) * frac;
    return [
      [x, y, w, h0],
      [x, y + h0 + g, w, h - h0 - g],
    ];
  }
  const w0 = (w - g) * frac;
  return [
    [x, y, w0, h],
    [x + w0 + g, y, w - w0 - g, h],
  ];
}

/** Maps a data window onto a pixel rectangle of the stage (y up). */
export class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
    square = false,
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
  /** The pixel rectangle the data window occupies. */
  get box(): Rect {
    const [x0, x1, y0, y1] = this.dom;
    return [this.X(x0), this.Y(y1), this.kx * (x1 - x0), this.ky * (y1 - y0)];
  }
  clip(fn: () => void, r: Rect = this.box): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...r);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const pts: [number, number][] = [];
    const n = 200;
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n;
      pts.push([x, f(x)]);
    }
    this.clip(() => this.poly(pts, col, width, dash));
  }
  poly(pts: [number, number][], col: string, width = 0.6, dash?: number[]): void {
    if (pts.length < 2) return;
    const c = this.s.ctx;
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const px = this.X(x);
      const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    });
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.stroke();
    c.setLineDash([]);
  }
  /** A trail from parallel coordinate arrays, the first `n` points. */
  trail(xs: number[], ys: number[], n: number, col: string, width = 0.6): void {
    const m = Math.max(0, Math.min(xs.length, Math.floor(n)));
    const pts: [number, number][] = [];
    for (let i = 0; i < m; i++) pts.push([xs[i]!, ys[i]!]);
    // Fractional part: slide toward the next point.
    const f = n - Math.floor(n);
    if (m < xs.length && m > 0 && f > 0) pts.push([xs[m - 1]! + (xs[m]! - xs[m - 1]!) * f, ys[m - 1]! + (ys[m]! - ys[m - 1]!) * f]);
    this.poly(pts, col, width);
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.7, head = 2.8): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  dot(x: number, y: number, r: number, col: string, ring = true): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: ring ? this.s.c('--card') : undefined, lw: 0.35 });
  }
}

/** Position along a trail at fractional step n. */
export function at(xs: number[], ys: number[], n: number): [number, number] {
  const m = Math.max(0, Math.min(xs.length - 1, Math.floor(n)));
  const f = clamp01(n - m);
  if (m >= xs.length - 1) return [xs[xs.length - 1]!, ys[ys.length - 1]!];
  return [xs[m]! + (xs[m + 1]! - xs[m]!) * f, ys[m]! + (ys[m + 1]! - ys[m]!) * f];
}

/** Horizontal grid lines with mono labels at the left edge of a frame. */
export function hgrid(s: Scene, fr: Frame, vals: number[], label: (v: number) => string, a = 1): void {
  const [bx, , bw] = fr.box;
  s.alpha(a, () => {
    for (const v of vals) {
      const y = fr.Y(v);
      s.line(bx, y, bx + bw, y, s.c('--grid'), 0.25);
      s.text(label(v), bx + s.u * 0.6, y - s.u * 1.6, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'left' });
    }
  });
}

/** A small framed legend: colored swatch plus label per row. Returns its height. */
export function legend(s: Scene, x: number, y: number, rows: { label: string; k: K; a?: number; bold?: boolean }[], o: { size?: number; align?: 'left' | 'right'; box?: boolean } = {}): number {
  const size = o.size ?? 3.2;
  const lh = size * 1.55 * s.u;
  const tw = Math.max(...rows.map((r) => s.measure(r.label, { size, font: 'ui', weight: r.bold ? 650 : 500 })));
  const w = tw + size * 3.4 * s.u;
  const h = lh * rows.length + size * 0.8 * s.u;
  const x0 = o.align === 'right' ? x - w : x;
  if (o.box !== false) s.rrect(x0, y, w, h, 1.4, { fill: s.tint('--card', 0.92), stroke: s.c('--rule'), lw: 0.25 });
  rows.forEach((r, i) => {
    s.alpha(r.a ?? 1, () => {
      const cy = y + size * 0.4 * s.u + lh * (i + 0.5);
      s.circle(x0 + size * 1.2 * s.u, cy, size * 0.36 * s.u, { fill: s.c(r.k) });
      s.text(r.label, x0 + size * 2.1 * s.u, cy + s.u * 0.15, { size, font: 'ui', weight: r.bold ? 650 : 500, align: 'left', color: s.c(r.bold ? '--ink' : '--ink-2') });
    });
  });
  return h;
}

/** A rounded tag of mono text. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number } = {}): number {
  const size = o.size ?? 3.4;
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** A red cross in a disc. */
export function cross(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('red') });
  const d = r * 0.42;
  const k = r / s.u / 1.9;
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.45 * k);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.45 * k);
}

// ---------------------------------------------------------------- cached rasters

const rasters = new Map<string, HTMLCanvasElement>();

function raster(key: string, w: number, h: number, paint: (img: ImageData) => void): HTMLCanvasElement {
  let cv = rasters.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = Math.max(1, w);
    cv.height = Math.max(1, h);
    const img = new ImageData(cv.width, cv.height);
    paint(img);
    cv.getContext('2d')!.putImageData(img, 0, 0);
    if (rasters.size > 40) rasters.clear();
    rasters.set(key, cv);
  }
  return cv;
}

/** Contour bands of a loss surface over a frame's window, in the slate ink of the chapter's figure. */
export function contours(s: Scene, fr: Frame, surf: { id: string; f(x: number, y: number): number; fmin: number }, a = 1, bands = 14): void {
  const [bx, by, bw, bh] = fr.box;
  const cell = 2;
  const cols = Math.ceil(bw / cell);
  const rows = Math.ceil(bh / cell);
  const ink = s.c('slate');
  const key = `c|${surf.id}|${cols}|${rows}|${ink}|${bands}`;
  const [x0, x1, y0, y1] = fr.dom;
  const cv = raster(key, cols, rows, (img) => {
    const [r, g, b] = rgbOf(ink);
    const lv = (v: number) => Math.log(v - surf.fmin + 0.02);
    const vals = new Float64Array(cols * rows);
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = x0 + ((i + 0.5) / cols) * (x1 - x0);
        const y = y1 - ((j + 0.5) / rows) * (y1 - y0);
        const v = lv(surf.f(x, y));
        vals[j * cols + i] = v;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    const band = new Int32Array(vals.length);
    for (let q = 0; q < vals.length; q++) band[q] = Math.floor(((vals[q]! - lo) / (hi - lo)) * bands);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const q = j * cols + i;
        const t = (vals[q]! - lo) / (hi - lo);
        const edge = (i + 1 < cols && band[q + 1] !== band[q]) || (j + 1 < rows && band[q + cols] !== band[q]);
        img.data[q * 4] = r;
        img.data[q * 4 + 1] = g;
        img.data[q * 4 + 2] = b;
        img.data[q * 4 + 3] = edge ? 80 : 5 + 30 * t;
      }
  });
  s.alpha(a, () => {
    const c = s.ctx;
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, bx, by, bw, bh);
    c.restore();
  });
}

/** A classifier's decision regions, tinted with the class colors. */
export function regions(s: Scene, fr: Frame, reg: Region, cls: K[], a = 1, tag = ''): void {
  const cols = cls.map((k) => s.c(k));
  const key = `r|${tag}|${reg.n}|${cols.join(',')}`;
  const cv = raster(key, reg.n, reg.n, (img) => {
    const rgb = cols.map((c) => rgbOf(c));
    for (let q = 0; q < reg.n * reg.n; q++) {
      const [r, g, b] = rgb[reg.cls[q]!]!;
      img.data[q * 4] = r;
      img.data[q * 4 + 1] = g;
      img.data[q * 4 + 2] = b;
      img.data[q * 4 + 3] = 255;
    }
  });
  const [bx, by, bw, bh] = fr.box;
  s.alpha(a * 0.2, () => {
    const c = s.ctx;
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(cv, bx, by, bw, bh);
    c.restore();
  });
}

/** A star marking a minimum. */
export function star(s: Scene, x: number, y: number, r: number, col: string): void {
  const c = s.ctx;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + rr * Math.cos(ang);
    const py = y + rr * Math.sin(ang);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
  c.fillStyle = col;
  c.fill();
  c.strokeStyle = s.c('--card');
  c.lineWidth = s.u * 0.3;
  c.stroke();
}

/** A rounded card with a display title and a mono subtitle; `on` brightens it. */
export function card(s: Scene, x: number, y: number, w: number, h: number, title: string, sub: string, k: K, on = 0, size = 4.4): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.3 + 0.35 * on });
  // Shrink both lines until they fit inside the card with a margin.
  const room = w - s.u * 4;
  const tw = s.measure(title, { size: 1, font: 'display', weight: 560 });
  const sw = sub ? s.measure(sub, { size: 1, font: 'mono' }) : 0;
  const fs = Math.min(size, room / tw, (h / s.u) * 0.32);
  const ss = sub ? Math.min(fs * 0.66, room / sw) : 0;
  s.text(title, x + w / 2, y + h * (sub ? 0.4 : 0.5), { size: fs, font: 'display', weight: 560 });
  if (sub) s.text(sub, x + w / 2, y + h * 0.7, { size: ss, font: 'mono', color: s.c(k) });
}
