// Drawing helpers for the generative explainers, on top of the lecture Scene and src/atlas/draw.ts.
import { Rng } from '../../core/rand';
import type { Ink, Scene, TextOpts } from '../../lecture/scene';

/** Typographic minus for canvas text. */
export const fmt = (v: number, places?: number): string => (places === undefined ? String(v) : v.toFixed(places)).replace(/^-/, '−');

/** Maps a data window [x0, x1] by [y0, y1] onto a stage rectangle (px), y up. */
export class Frame {
  constructor(
    readonly s: Scene,
    readonly l: number,
    readonly t: number,
    readonly r: number,
    readonly b: number,
    readonly xr: [number, number],
    readonly yr: [number, number],
  ) {}
  X(x: number): number {
    return this.l + ((x - this.xr[0]) / (this.xr[1] - this.xr[0])) * (this.r - this.l);
  }
  Y(y: number): number {
    return this.b - ((y - this.yr[0]) / (this.yr[1] - this.yr[0])) * (this.b - this.t);
  }
  /** The axes through 0 where they fall inside the window. */
  axes(a = 1): void {
    const s = this.s;
    s.alpha(a, () => {
      if (this.yr[0] <= 0 && this.yr[1] >= 0) s.line(this.l, this.Y(0), this.r, this.Y(0), s.c('--axis'), 0.3);
      if (this.xr[0] <= 0 && this.xr[1] >= 0) s.line(this.X(0), this.t, this.X(0), this.b, s.c('--axis'), 0.3);
    });
  }
  /** The graph of `f` from `from` to `to`; `fill` shades the area under it. */
  fn(f: (x: number) => number, k: Ink, o: { width?: number; from?: number; to?: number; fill?: number; dash?: number[] } = {}): void {
    const s = this.s;
    const c = s.ctx;
    const from = o.from ?? this.xr[0];
    const to = o.to ?? this.xr[1];
    if (to <= from) return;
    const n = 120;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n;
      pts.push([this.X(x), Math.max(this.t - 50, Math.min(this.b + 50, this.Y(f(x))))]);
    }
    if (o.fill) {
      c.beginPath();
      c.moveTo(pts[0]![0], this.Y(0));
      for (const [x, y] of pts) c.lineTo(x, y);
      c.lineTo(pts[n]![0], this.Y(0));
      c.closePath();
      c.fillStyle = s.tint(k, o.fill);
      c.fill();
    }
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = s.c(k);
    c.lineWidth = (o.width ?? 0.6) * s.u;
    c.lineJoin = 'round';
    c.setLineDash(o.dash ? o.dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
  }
  dot(x: number, y: number, k: Ink, r = 1.4): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: this.s.c(k), stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** Centered mono text with a halo, for captions under a figure. */
export function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.6, o: TextOpts = {}): void {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true, ...o });
}

/** Text in several colored runs, centered (or aligned) on x as one line. */
export function rich(s: Scene, runs: [string, Ink][], x: number, y: number, o: TextOpts = {}): void {
  const opts: TextOpts = { size: 3.6, font: 'mono', ...o };
  const widths = runs.map(([t]) => s.measure(t, opts));
  const total = widths.reduce((p, q) => p + q, 0);
  let cur = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  runs.forEach(([t, k], i) => {
    s.text(t, cur, y, { ...opts, align: 'left', color: s.c(k) });
    cur += widths[i]!;
  });
}

/** A column of number cells at `x`, one per y; `on` lights cells 0..1. */
export function vcells(s: Scene, x: number, ys: number[], labels: string[], k: Ink, o: { w?: number; h?: number; on?: number[]; size?: number } = {}): void {
  const w = (o.w ?? 12) * s.u;
  const h = (o.h ?? 8.5) * s.u;
  ys.forEach((y, i) => s.cell(x - w / 2, y - h / 2, w, h, labels[i] ?? '', k, { on: o.on?.[i] ?? 0, size: o.size }));
}

/** A rounded box with a label, for a network or a stage of a pipeline, widened to fit its text; `on` lights it. */
export function block(s: Scene, cx: number, cy: number, w: number, h: number, label: string, k: Ink, o: { on?: number; size?: number; sub?: string } = {}): void {
  const on = o.on ?? 0;
  const size = o.size ?? 3.6;
  const fit = Math.max(s.measure(label, { size, font: 'mono', weight: 650 }), o.sub ? s.measure(o.sub, { size: size * 0.78, font: 'mono' }) : 0) / s.u + 5;
  w = Math.max(w, fit);
  s.rrect(cx - (w * s.u) / 2, cy - (h * s.u) / 2, w * s.u, h * s.u, 1.6, { fill: s.tint(k, 0.1 + 0.18 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 + 0.2 * on });
  const dy = o.sub ? -size * 0.45 * s.u : 0;
  s.text(label, cx, cy + dy, { size, font: 'mono', weight: 650, color: s.c(k) });
  if (o.sub) s.text(o.sub, cx, cy + size * 0.75 * s.u, { size: size * 0.78, font: 'mono', color: s.c('--ink-3') });
}

/** A trapezoid from height h0 at x0 to h1 at x1, centered on y: an encoder narrows, a decoder widens. */
export function funnel(s: Scene, x0: number, x1: number, y: number, h0: number, h1: number, k: Ink, label: string, on = 0): void {
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x0, y - (h0 * s.u) / 2);
  c.lineTo(x1, y - (h1 * s.u) / 2);
  c.lineTo(x1, y + (h1 * s.u) / 2);
  c.lineTo(x0, y + (h0 * s.u) / 2);
  c.closePath();
  c.fillStyle = s.tint(k, 0.1 + 0.16 * on);
  c.fill();
  c.strokeStyle = s.tint(k, 0.55 + 0.45 * on);
  c.lineWidth = (0.35 + 0.2 * on) * s.u;
  c.stroke();
  s.text(label, (x0 + x1) / 2, y, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** A grid of colored squares centered on (cx, cy), `px` stage units each: a small picture. */
export function picture(s: Scene, cx: number, cy: number, px: number, img: readonly (readonly string[])[], o: { gap?: number } = {}): { l: number; t: number; p: number } {
  const p = px * s.u;
  const m = img.length;
  const n = img[0]!.length;
  const l = cx - (n * p) / 2;
  const t = cy - (m * p) / 2;
  const g = (o.gap ?? 0) * s.u;
  const c = s.ctx;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      c.fillStyle = img[i]![j]!;
      c.fillRect(l + j * p + g / 2, t + i * p + g / 2, p - g + 0.5, p - g + 0.5);
    }
  }
  return { l, t, p };
}

/** Grayscale values (about -2..2) as a grid of squares tinted with `k`, centered on (cx, cy). */
export function shades(s: Scene, cx: number, cy: number, px: number, vals: readonly (readonly number[])[], k: Ink, o: { lo?: number; hi?: number; border?: boolean } = {}): { l: number; t: number; r: number; b: number } {
  const p = px * s.u;
  const m = vals.length;
  const n = vals[0]!.length;
  const l = cx - (n * p) / 2;
  const t = cy - (m * p) / 2;
  const lo = o.lo ?? -1.5;
  const hi = o.hi ?? 1.5;
  const c = s.ctx;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const a = Math.min(1, Math.max(0, (vals[i]![j]! - lo) / (hi - lo)));
      c.fillStyle = s.tint(k, 0.04 + 0.9 * a);
      c.fillRect(l + j * p, t + i * p, p + 0.5, p + 0.5);
    }
  }
  if (o.border ?? true) s.rrect(l, t, n * p, m * p, 0.6, { stroke: s.tint(k, 0.6), lw: 0.3 });
  return { l, t, r: l + n * p, b: t + m * p };
}

/** An `n` by `n` grid of ink values in [0, 1]: a pen stroke through `pts` (grid units), `width` thick. */
export function stroke(n: number, pts: [number, number][], width = 1.1): number[][] {
  const seg = (x: number, y: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  };
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let d = Infinity;
      for (let k = 1; k < pts.length; k++) d = Math.min(d, seg(j, i, pts[k - 1]!, pts[k]!));
      return Math.max(0, Math.min(1, 1.6 - d / width));
    }),
  );
}

type RGB = [number, number, number];
const rgb = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
const sky = (i: number): RGB => [Math.round(110 + 4 * i), Math.round(170 + 3 * i), 235];
const sea = (i: number): RGB => [40, Math.round(90 + 3 * i), Math.round(160 + 2 * i)];

/** Three 16 by 16 pictures, as CSS colors: a sun over the sea, a tree, a sailboat. */
export const PICS: Record<'sun' | 'tree' | 'boat', string[][]> = {
  sun: Array.from({ length: 16 }, (_, i) =>
    Array.from({ length: 16 }, (_, j) => rgb(i >= 10 ? sea(i) : Math.hypot(i - 6, j - 8) < 3.2 ? [250, 200, 60] : [Math.round(230 - 6 * i), Math.round(150 - 4 * i), Math.round(120 + 6 * i)])),
  ),
  tree: Array.from({ length: 16 }, (_, i) =>
    Array.from({ length: 16 }, (_, j) => rgb(i >= 13 ? [80, 150, 70] : Math.hypot(i - 5.5, j - 8) < 4.6 ? [50, 130, 60] : j >= 7 && j <= 8 && i >= 9 ? [110, 75, 45] : sky(i))),
  ),
  boat: Array.from({ length: 16 }, (_, i) =>
    Array.from({ length: 16 }, (_, j) => {
      if (i >= 11) return rgb(sea(i));
      if (i >= 9 && j >= 3 + (i - 9) && j <= 12 - (i - 9)) return rgb([150, 90, 50]);
      if (i >= 2 && i <= 8 && j >= 8 && j <= 8 + (i - 2) * 0.8) return rgb([245, 245, 240]);
      if (j === 7 && i >= 1 && i <= 9) return rgb([90, 60, 40]);
      return rgb(sky(i));
    }),
  ),
};

/** A `size` by `size` window of `pic` with its top-left at (r, c). */
export const crop = (pic: string[][], r: number, c: number, size: number): string[][] => pic.slice(r, r + size).map((row) => row.slice(c, c + size));

/** A 14 by 14 smiley in pixel values about -1 to 1; pixel (7, 7) is exactly 1. */
export const SMILEY: number[][] = Array.from({ length: 14 }, (_, i) =>
  Array.from({ length: 14 }, (_, j) => {
    const r = Math.hypot(i - 6.5, j - 6.5);
    if (r > 6) return -1.2;
    if (Math.hypot(i - 4.5, j - 4.5) < 1 || Math.hypot(i - 4.5, j - 8.5) < 1) return -1.2;
    if (i > 7.5 && Math.abs(r - 3.6) < 0.7) return -1.2;
    return 1;
  }),
);

/** Fixed standard normal noise for the smiley; pixel (7, 7) is -0.5. */
export const NOISE: number[][] = (() => {
  const rng = new Rng(4);
  const g = SMILEY.map((r) => r.map(() => rng.randn()));
  g[7]![7] = -0.5;
  return g;
})();

/** The smiley noised to signal level `ab`. */
export const noised = (ab: number, eps: number[][] = NOISE): number[][] => SMILEY.map((r, i) => r.map((v, j) => Math.sqrt(ab) * v + Math.sqrt(1 - ab) * eps[i]![j]!));

/** `base` with `sub` set as a smaller subscript, as one label centered (or aligned) on x. */
export function subText(s: Scene, base: string, sub: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 3.4;
  const bo: TextOpts = { font: 'mono', weight: 650, ...o, size };
  const so: TextOpts = { ...bo, size: size * 0.7 };
  const wb = s.measure(base, bo);
  const ws = s.measure(sub, so);
  const l = o.align === 'left' ? x : o.align === 'right' ? x - wb - ws : x - (wb + ws) / 2;
  s.text(base, l, y, { ...bo, align: 'left' });
  s.text(sub, l + wb, y + size * 0.3 * s.u, { ...so, align: 'left' });
}
