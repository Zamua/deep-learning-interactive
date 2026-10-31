// A small drawing kit shared by the Atlas explainers, on top of the lecture Scene.
import type { Color } from '../core/symbols';
import { smooth, type Ink, type Scene } from '../lecture/scene';

/** A source credit in the stage's top right corner, at opacity `a`. */
export function cite(s: Scene, text: string, a: number): void {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A centered line of mono text at height `y`. */
export function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4): void {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** Eases from 0 to 1 over `dur` seconds, starting a fraction `f` of the way through beat `id`. */
export const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Whether the stage is too narrow for side-by-side panels, which then stack. */
export const stacked = (s: Scene): boolean => s.tall || s.w / s.h < 1.45;

/** A number with a typographic minus sign. */
export const fmt = (v: number): string => String(v).replace('-', '−');

/** x centers for `n` columns around the stage's middle, `gap` stage units apart. */
export function columns(s: Scene, n: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => s.w / 2 + (i - (n - 1) / 2) * gap * s.u);
}

/** A row of number cells centered on `xs`, each `w` by `h` stage units; `on` lights cells 0..1. */
export function cells(s: Scene, xs: number[], y: number, labels: string[], k: Ink, o: { w?: number; h?: number; on?: number[]; size?: number } = {}): void {
  const w = (o.w ?? 14) * s.u;
  const h = (o.h ?? 9) * s.u;
  xs.forEach((x, i) => s.cell(x - w / 2, y - h / 2, w, h, labels[i] ?? '', k, { on: o.on?.[i] ?? 0, size: o.size }));
}

/** A label to the left of a row, in its color: `s`, `e`, `p`. */
export function rowLabel(s: Scene, text: string, x: number, y: number, k: Ink, size = 4.2): void {
  s.text(text, x, y, { size, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
}

/**
 * Bars standing on `base`, one per x, scaled so `max` is `height` stage units tall, with each
 * value printed above its bar. `grow` scales the heights for an entrance.
 */
export function bars(s: Scene, xs: number[], base: number, vals: number[], k: Ink, o: { max: number; height: number; w?: number; grow?: number; fmt?: (v: number) => string; hi?: number[] }): void {
  const w = (o.w ?? 10) * s.u;
  const g = o.grow ?? 1;
  s.line(xs[0]! - w, base, xs[xs.length - 1]! + w, base, s.c('--axis'), 0.35);
  xs.forEach((x, i) => {
    const v = vals[i]!;
    const hh = Math.max(0, (v / o.max) * o.height * s.u * g);
    const a = 0.55 + 0.45 * (o.hi?.[i] ?? 0);
    s.rrect(x - w / 2, base - hh, w, Math.max(hh, 0.6 * s.u), 1, { fill: s.tint(k, 0.35 * a + 0.2), stroke: s.tint(k, a), lw: 0.3 });
    if (o.fmt && g > 0.6) s.alpha((g - 0.6) / 0.4, () => s.text(o.fmt!(v), x, base - hh - 3.2 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c(k), halo: true }));
  });
}

/** A down arrow between rows, from y0 to y1, at each x. */
export function downArrows(s: Scene, xs: number[], y0: number, y1: number, k: Ink = '--ink-3'): void {
  for (const x of xs) s.arrow(x, y0, x, y1, s.c(k), 0.35, 2);
}

/** A check or a cross with a caption, for "does it pass?" moments. */
export function verdict(s: Scene, ok: boolean, text: string, x: number, y: number, size = 3.8): void {
  const k: Color = ok ? 'green' : 'red';
  s.text(ok ? '✓' : '✗', x, y, { size: size * 1.2, font: 'ui', weight: 700, color: s.c(k) });
  s.text(text, x + size * 1.4 * s.u, y, { size, align: 'left', color: s.c('--ink-2') });
}
