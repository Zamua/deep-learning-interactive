import type { Scene } from '../../lecture/scene';
import type { Color } from '../../core/symbols';
import { type Axis, Frame, type Rect, drawAxes, rich } from '../../lib/scaling-laws-chart';

export type K = Color | `--${string}`;
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

/** The stage inside a margin, below the scene chip. */
export function area(s: Scene, top = 0.13, pad = 4.5): Rect {
  const m = pad * s.u;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Splits a rect in two: side by side on a wide stage, stacked on a tall one. */
export function split(s: Scene, r: Rect, frac = 0.5, gap = 4): [Rect, Rect] {
  const [x, y, w, h] = r;
  const g = gap * s.u;
  if (s.tall) {
    const h1 = (h - g) * frac;
    return [[x, y, w, h1], [x, y + h1 + g, w, h - h1 - g]];
  }
  const w1 = (w - g) * frac;
  return [[x, y, w1, h], [x + w1 + g, y, w - w1 - g, h]];
}

/** Tick label size in px. */
export const tickPx = (s: Scene): number => Math.max(10.5, 2.7 * s.u);

/** A chart frame inside `r`, leaving room (in stage units) for tick labels. */
export function chart(s: Scene, r: Rect, xa: Axis, ya: Axis, m: { l?: number; r?: number; t?: number; b?: number } = {}): Frame {
  const u = s.u;
  const F = tickPx(s);
  const l = (m.l ?? 0) * u + F * 3.4;
  const t = (m.t ?? 0) * u + F * 1.6;
  const b = (m.b ?? 0) * u + F * 2.9;
  const rr = (m.r ?? 1.5) * u;
  return new Frame([r[0] + l, r[1] + t, Math.max(10, r[2] - l - rr), Math.max(10, r[3] - t - b)], xa, ya);
}

export function axes(
  s: Scene,
  fr: Frame,
  o: { xTicks: number[]; yTicks: number[]; xFmt: (v: number) => string; yFmt: (v: number) => string; xLabel?: string; yLabel?: string; xCol?: K; yCol?: K },
  a = 1,
): void {
  s.alpha(a, () =>
    drawAxes(s.ctx, fr, {
      font: tickPx(s),
      xTicks: o.xTicks,
      yTicks: o.yTicks,
      xFmt: o.xFmt,
      yFmt: o.yFmt,
      xLabel: o.xLabel,
      yLabel: o.yLabel,
      xLabelColor: o.xCol ? s.c(o.xCol) : undefined,
      yLabelColor: o.yCol ? s.c(o.yCol) : undefined,
    }),
  );
}

/** A polyline in data coordinates with its width in stage units. */
export function poly(s: Scene, fr: Frame, xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, w = 0.6, dash?: number[]): void {
  fr.path(s.ctx, xs, ys, col, w * s.u, dash?.map((d) => d * s.u));
}

/** y = f(x) in data coordinates, sampled in (log) x over [from, to], width in stage units. */
export function curve(s: Scene, fr: Frame, f: (x: number) => number, col: string, w = 0.6, o: { from?: number; to?: number; dash?: number[]; n?: number } = {}): void {
  fr.fn(s.ctx, f, col, w * s.u, { from: o.from, to: o.to, n: o.n ?? 200, dash: o.dash?.map((d) => d * s.u) });
}

/** A dot with a card-colored rim, radius in stage units. */
export function dot(s: Scene, x: number, y: number, r: number, col: string, ring = false): void {
  if (ring) s.circle(x, y, r * s.u, { stroke: col, lw: 0.55 });
  else s.circle(x, y, r * s.u, { fill: col, stroke: s.c('--card'), lw: 0.3 });
}

/** Text with superscripts written as `10^23`, sized in stage units, with a halo. */
export function sup(s: Scene, text: string, x: number, y: number, col: string, size = 3.4, align: CanvasTextAlign = 'center', weight = 500, mono = true): number {
  return rich(s.ctx, text, x, y, { px: size * s.u, family: mono ? MONO : undefined, weight, fill: col, align, halo: '--card' });
}

/** A rounded card with a tinted fill. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: K, on = 0): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.45 + 0.5 * on), lw: 0.3 + 0.25 * on });
}

/** Horizontal bar from x0 of length len (px), vertically centered on y. */
export function bar(s: Scene, x0: number, y: number, len: number, hgt: number, k: K, a = 0.6): void {
  if (len <= 0) return;
  s.rrect(x0, y - hgt / 2, len, hgt, 1, { fill: s.tint(k, a) });
}

/** Fits text size so `text` is at most `maxW` px wide. */
export function fitSize(s: Scene, text: string, size: number, maxW: number, font: 'display' | 'serif' | 'mono' | 'ui' = 'serif', weight?: number): number {
  const w = s.measure(text, { size, font, weight });
  return w > maxW ? (size * maxW) / w : size;
}

/** Log-linear interpolation between a and b. */
export const loglerp = (a: number, b: number, t: number): number => 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * t);

/** The latest beat in `ids` that has started. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}
