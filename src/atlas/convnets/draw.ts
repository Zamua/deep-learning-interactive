// Drawing helpers for the convnets explainers: grids of cells, sliding windows, volumes, and
// text in colored runs.
import type { Color } from '../../core/symbols';
import type { Scene, TextOpts } from '../../lecture/scene';

export type Ink = Color | `--${string}`;

/** Cell centers of an `m` by `n` grid centered on (cx, cy), `pitch` stage units apart. */
export interface Grid {
  m: number;
  n: number;
  pitch: number;
  x(j: number): number;
  y(i: number): number;
  l: number;
  r: number;
  t: number;
  b: number;
}

export function grid(s: Scene, cx: number, cy: number, m: number, n: number, pitch: number): Grid {
  const p = pitch * s.u;
  const x = (j: number) => cx + (j - (n - 1) / 2) * p;
  const y = (i: number) => cy + (i - (m - 1) / 2) * p;
  return { m, n, pitch, x, y, l: x(0) - p / 2, r: x(n - 1) + p / 2, t: y(0) - p / 2, b: y(m - 1) + p / 2 };
}

/** Number cells on grid `g`, each a little smaller than the pitch; `on(i, j)` lights a cell. */
export function gridCells(s: Scene, g: Grid, labels: (string | number)[][], k: Ink | ((i: number, j: number) => Ink), o: { on?: (i: number, j: number) => number; size?: number; fill?: number } = {}): void {
  const w = (g.pitch - 1) * s.u;
  for (let i = 0; i < g.m; i++) {
    for (let j = 0; j < g.n; j++) {
      const ink = typeof k === 'function' ? k(i, j) : k;
      s.cell(g.x(j) - w / 2, g.y(i) - w / 2, w, w, String(labels[i]?.[j] ?? ''), ink, { on: o.on?.(i, j) ?? 0, size: o.size ?? g.pitch * 0.4 });
    }
  }
}

/** A rounded outline around rows i0..i0+h-1 and columns j0..j0+w-1 of `g` (fractional ok, for sliding). */
export function windowBox(s: Scene, g: Grid, i0: number, j0: number, h: number, w: number, k: Ink, a = 1, lw = 0.6): void {
  if (a <= 0.003) return;
  const p = g.pitch * s.u;
  const pad = 0.3 * s.u;
  s.alpha(a, () => s.rrect(g.x(j0) - p / 2 - pad, g.y(i0) - p / 2 - pad, w * p + 2 * pad, h * p + 2 * pad, 1.6, { fill: s.tint(k, 0.08), stroke: s.c(k), lw }));
}

/** Text in colored runs, centered (or aligned) on x as one line. */
export function rich(s: Scene, runs: [string, Ink][], x: number, y: number, o: TextOpts = {}): void {
  const opts: TextOpts = { size: 3.8, font: 'mono', ...o };
  const widths = runs.map(([t]) => s.measure(t, opts));
  const total = widths.reduce((p, q) => p + q, 0);
  let cur = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  runs.forEach(([t, k], i) => {
    s.text(t, cur, y, { ...opts, align: 'left', color: s.c(k) });
    cur += widths[i]!;
  });
}

/**
 * A volume drawn as `layers` offset sheets, front sheet at (x, y) with size w by h (px), each
 * further sheet shifted up and right by `step` stage units.
 */
export function slab(s: Scene, x: number, y: number, w: number, h: number, layers: number, k: Ink, o: { step?: number; a?: number; on?: number } = {}): void {
  const st = (o.step ?? 1.2) * s.u;
  const on = o.on ?? 0;
  s.alpha(o.a ?? 1, () => {
    for (let l = layers - 1; l >= 0; l--) {
      s.rrect(x + l * st, y - l * st, w, h, 0.8, { fill: s.tint(k, 0.14 + 0.16 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.3 });
    }
  });
}

/** `−` for minus signs in canvas text. */
export const fmt = (v: number): string => String(v).replace(/^-/, '−');

/**
 * A volume of square sheets, sheet 0 in front with its top-left at (x, y), each further sheet
 * shifted up and right by `step` stage units; `ink(l)` colors sheet l, `a(l)` fades it.
 */
export function volume(s: Scene, x: number, y: number, size: number, n: number, ink: (l: number) => Ink, o: { step?: number; a?: (l: number) => number; on?: (l: number) => number } = {}): void {
  const st = (o.step ?? 1.6) * s.u;
  for (let l = n - 1; l >= 0; l--) {
    const on = o.on?.(l) ?? 0;
    s.alpha(o.a?.(l) ?? 1, () => s.rrect(x + l * st, y - l * st, size, size, 0.8, { fill: s.tint(ink(l), 0.16 + 0.2 * on), stroke: s.tint(ink(l), 0.65 + 0.35 * on), lw: 0.3 + 0.2 * on }));
  }
}
