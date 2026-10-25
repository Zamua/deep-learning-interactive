// Drawing helpers for the networks explainers, on top of the lecture Scene and src/atlas/draw.ts.
import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, smooth } from '../../lecture/scene';

export type Ink = Color | `--${string}`;

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
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(this.l, this.t, this.r - this.l, this.b - this.t);
    c.clip();
    fn();
    c.restore();
  }
  /** The axes through 0 where they fall inside the window. */
  axes(a = 1): void {
    const s = this.s;
    s.alpha(a, () => {
      if (this.yr[0] <= 0 && this.yr[1] >= 0) s.line(this.l, this.Y(0), this.r, this.Y(0), s.c('--axis'), 0.3);
      if (this.xr[0] <= 0 && this.xr[1] >= 0) s.line(this.X(0), this.t, this.X(0), this.b, s.c('--axis'), 0.3);
    });
  }
  /** The graph of `f` from `from` to `to`, clipped to the window. */
  fn(f: (x: number) => number, k: Ink, width = 0.7, from = this.xr[0], to = this.xr[1], dash?: number[]): void {
    const s = this.s;
    const c = s.ctx;
    if (to <= from) return;
    this.clip(() => {
      c.beginPath();
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = s.c(k);
      c.lineWidth = width * s.u;
      c.lineJoin = 'round';
      c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  dot(x: number, y: number, k: Ink, r = 1.4): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: this.s.c(k), stroke: this.s.c('--card'), lw: 0.35 });
  }
  seg(x0: number, y0: number, x1: number, y1: number, k: Ink, width = 0.4, dash?: number[]): void {
    this.s.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.s.c(k), width, dash);
  }
}

/** A column of number cells at `x`, one per y; `on` lights cells 0..1. */
export function vcells(s: Scene, x: number, ys: number[], labels: string[], k: Ink, o: { w?: number; h?: number; on?: number[]; size?: number } = {}): void {
  const w = (o.w ?? 12) * s.u;
  const h = (o.h ?? 8.5) * s.u;
  ys.forEach((y, i) => s.cell(x - w / 2, y - h / 2, w, h, labels[i] ?? '', k, { on: o.on?.[i] ?? 0, size: o.size }));
}

/** A matrix of number cells centered on (cx, cy), `pw` by `ph` stage units apart; returns the cell centers. */
export function matrix(s: Scene, cx: number, cy: number, rows: string[][], k: Ink, o: { pw?: number; ph?: number; w?: number; h?: number; size?: number; on?: (i: number, j: number) => number } = {}): { x(j: number): number; y(i: number): number } {
  const m = rows.length;
  const n = rows[0]!.length;
  const pw = (o.pw ?? 13) * s.u;
  const ph = (o.ph ?? 10) * s.u;
  const w = (o.w ?? 11) * s.u;
  const h = (o.h ?? 8) * s.u;
  const x = (j: number) => cx + (j - (n - 1) / 2) * pw;
  const y = (i: number) => cy + (i - (m - 1) / 2) * ph;
  rows.forEach((r, i) => r.forEach((lab, j) => s.cell(x(j) - w / 2, y(i) - h / 2, w, h, lab, k, { on: o.on?.(i, j) ?? 0, size: o.size })));
  return { x, y };
}

/** A unit of a network: a circle with a label inside; `on` lights it. */
export function unit(s: Scene, x: number, y: number, r: number, label: string, k: Ink, on = 0, size = 3.6): void {
  s.circle(x, y, r * s.u, { fill: s.tint(k, 0.1 + 0.22 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.35 + 0.25 * on });
  if (label) s.text(label, x, y + 0.2 * s.u, { size, font: 'mono', weight: 600, color: s.c(k === '--ink-3' ? '--ink-2' : k) });
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

/** Eased 0 -> 1 starting a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
export const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** The ReLU's bend drawn as a small glyph in a box centered on (x, y), with a dot at input `z` when given. */
export function reluGlyph(s: Scene, x: number, y: number, w: number, h: number, k: Ink, o: { z?: number; dot?: Ink; on?: number } = {}): void {
  const W = w * s.u;
  const H = h * s.u;
  const on = o.on ?? 0;
  s.rrect(x - W / 2, y - H / 2, W, H, 1.6, { fill: s.tint(k, 0.08 + 0.16 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.2 * on });
  // Inputs from -4 to 4 across the box, outputs from 0 to 4 up it.
  const px = (z: number) => x - W * 0.38 + ((z + 4) / 8) * W * 0.76;
  const py = (a: number) => y + H * 0.32 - (a / 4) * H * 0.64;
  s.line(px(-4), py(0), px(0), py(0), s.c(k), 0.5);
  s.line(px(0), py(0), px(4), py(4), s.c(k), 0.5);
  if (o.z !== undefined) {
    const z = Math.max(-4, Math.min(4, o.z));
    s.circle(px(z), py(Math.max(0, z)), 1.1 * s.u, { fill: s.c(o.dot ?? k), stroke: s.c('--card'), lw: 0.3 });
  }
}
