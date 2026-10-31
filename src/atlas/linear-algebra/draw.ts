// Drawing helpers for the linear-algebra explainers: matrices as grids of cells, braces, and
// text runs in several colors.
import type { Ink, Scene, TextOpts } from '../../lecture/scene';

/** Cell centers of an `m` by `n` grid centered on (cx, cy), `pw` by `ph` stage units apart. */
export interface Grid {
  m: number;
  n: number;
  x(j: number): number;
  y(i: number): number;
  /** Outer edges, half a pitch beyond the outermost centers. */
  l: number;
  r: number;
  t: number;
  b: number;
}

export function grid(s: Scene, cx: number, cy: number, m: number, n: number, pw = 15, ph = 11): Grid {
  const x = (j: number) => cx + (j - (n - 1) / 2) * pw * s.u;
  const y = (i: number) => cy + (i - (m - 1) / 2) * ph * s.u;
  return { m, n, x, y, l: x(0) - (pw / 2) * s.u, r: x(n - 1) + (pw / 2) * s.u, t: y(0) - (ph / 2) * s.u, b: y(m - 1) + (ph / 2) * s.u };
}

/** A matrix of number cells on grid `g`; `on(i, j)` lights a cell 0..1. */
export function matrix(s: Scene, g: Grid, labels: (string | number)[][], k: Ink, o: { w?: number; h?: number; size?: number; on?: (i: number, j: number) => number } = {}): void {
  const w = (o.w ?? 12) * s.u;
  const h = (o.h ?? 8.5) * s.u;
  for (let i = 0; i < g.m; i++) {
    for (let j = 0; j < g.n; j++) {
      s.cell(g.x(j) - w / 2, g.y(i) - h / 2, w, h, String(labels[i]?.[j] ?? ''), k, { on: o.on?.(i, j) ?? 0, size: o.size });
    }
  }
}

/** A soft band behind a row (`row`) or a column (`col`) of grid `g`. */
export function band(s: Scene, g: Grid, kind: 'row' | 'col', idx: number, k: Ink, a: number, pad = 1.2): void {
  if (a <= 0.003) return;
  const p = pad * s.u;
  // Inset across the band so neighbouring bands stay apart.
  const q = 0.7 * s.u;
  const [x, y, w, h] = kind === 'row' ? [g.l - p, g.y(idx) - (g.b - g.t) / g.m / 2 + q, g.r - g.l + 2 * p, (g.b - g.t) / g.m - 2 * q] : [g.x(idx) - (g.r - g.l) / g.n / 2 + q, g.t - p, (g.r - g.l) / g.n - 2 * q, g.b - g.t + 2 * p];
  s.alpha(a, () => s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.55), lw: 0.3 }));
}

/** A square bracket brace along one side of a span, with a label beyond it. */
export function brace(s: Scene, side: 'top' | 'bottom' | 'left' | 'right', a: number, b: number, at: number, label: string, k: Ink, size = 3.4): void {
  const tick = 1.4 * s.u;
  const col = s.c(k);
  const gap = 3.2 * s.u;
  const o: TextOpts = { size, font: 'mono', weight: 600, color: col, halo: true };
  if (side === 'top' || side === 'bottom') {
    const d = side === 'top' ? tick : -tick;
    s.line(a, at + d, a, at, col, 0.3);
    s.line(a, at, b, at, col, 0.3);
    s.line(b, at, b, at + d, col, 0.3);
    s.text(label, (a + b) / 2, side === 'top' ? at - gap : at + gap, o);
  } else {
    const d = side === 'left' ? tick : -tick;
    s.line(at + d, a, at, a, col, 0.3);
    s.line(at, a, at, b, col, 0.3);
    s.line(at, b, at + d, b, col, 0.3);
    s.text(label, side === 'left' ? at - 1.6 * s.u : at + 1.6 * s.u, (a + b) / 2, { ...o, align: side === 'left' ? 'right' : 'left' });
  }
}

/** Text in several colored runs, centered (or aligned) on x as one line. */
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

/** A dashed empty cell: a slot with nothing in it. */
export function ghost(s: Scene, x: number, y: number, label: string, k: Ink, w = 12, h = 8.5): void {
  const W = w * s.u;
  const H = h * s.u;
  const c = s.ctx;
  c.save();
  c.setLineDash([1.2 * s.u, 1 * s.u]);
  s.rrect(x - W / 2, y - H / 2, W, H, 1.2, { stroke: s.tint(k, 0.8), lw: 0.3 });
  c.restore();
  if (label) s.text(label, x, y + 0.2 * s.u, { size: Math.min(w, h) * 0.42, font: 'mono', weight: 600, color: s.c(k) });
}
