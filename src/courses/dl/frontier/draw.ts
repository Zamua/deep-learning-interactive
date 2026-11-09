// Drawing helpers for the matrix-state explainers (linear attention, the delta rule, Gated DeltaNet,
// hybrids): a small matrix of numbers, and percent curves for the needle-in-a-haystack results.
import type { Ink, Scene } from '../../../lecture/scene';
import { fmt } from '../transformers/draw';

export interface Grid {
  x: (j: number) => number;
  y: (i: number) => number;
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface MatrixOpts {
  /** Distance between cell centers, in stage units. */
  pitch?: number;
  /** Cell width, in stage units; the height is 0.8 of it. */
  cell?: number;
  size?: number;
  on?: (i: number, j: number) => number;
  alpha?: (i: number, j: number) => number;
  ink?: (i: number, j: number) => Ink;
}

/** A matrix of number cells centered on (x, y). Returns where its cells sit. */
export function matrix(s: Scene, x: number, y: number, M: readonly (readonly (number | string)[])[], k: Ink, o: MatrixOpts = {}): Grid {
  const p = (o.pitch ?? 9.5) * s.u;
  const w = (o.cell ?? 8.6) * s.u;
  const h = w * 0.8;
  const rows = M.length;
  const cols = M[0]!.length;
  const gx = (j: number) => x + (j - (cols - 1) / 2) * p;
  const gy = (i: number) => y + (i - (rows - 1) / 2) * (h + p - w);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = M[i]![j]!;
      s.alpha(o.alpha?.(i, j) ?? 1, () => s.cell(gx(j) - w / 2, gy(i) - h / 2, w, h, typeof v === 'number' ? fmt(v) : v, o.ink?.(i, j) ?? k, { on: o.on?.(i, j) ?? 0, size: o.size ?? 3.1 }));
    }
  }
  return { x: gx, y: gy, l: gx(0) - w / 2, r: gx(cols - 1) + w / 2, t: gy(0) - h / 2, b: gy(rows - 1) + h / 2 };
}

export interface Curve {
  vals: readonly number[];
  k: Ink;
  on?: number;
}

/**
 * Percent curves over evenly spaced labels `xs`, in a box at (x, y) of w by h px: 0 at the bottom, 100
 * at the top. `reveal` draws each curve up to that many points (fractions draw part of a segment).
 */
export function curves(s: Scene, x: number, y: number, w: number, h: number, xs: readonly string[], cs: readonly Curve[], o: { title?: string; reveal?: number } = {}): void {
  const n = xs.length;
  const px = (i: number) => x + w * (0.06 + (0.88 * i) / (n - 1));
  const py = (v: number) => y + h * (1 - v / 100);
  const mono = { size: 2.6, font: 'mono', weight: 500, color: s.c('--ink-3') } as const;
  s.line(x, y, x, y + h, s.c('--axis'), 0.3);
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.3);
  for (const v of [50, 100]) s.line(x, py(v), x + w, py(v), s.tint('--axis', 0.5), 0.2, [0.8, 0.8]);
  for (const v of [0, 50, 100]) s.text(`${v}%`, x - 1.2 * s.u, py(v), { ...mono, align: 'right' });
  xs.forEach((t, i) => s.text(t, px(i), y + h + 3 * s.u, mono));
  if (o.title) s.text(o.title, x + w / 2, y - 3.6 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true });
  const shown = o.reveal ?? n;
  for (const c of cs) {
    s.alpha(c.on ?? 1, () => {
      const col = s.c(c.k);
      for (let i = 0; i + 1 < n && i + 1 <= shown + 1; i++) {
        const f = Math.min(1, Math.max(0, shown - 1 - i));
        if (f <= 0) break;
        const x1 = px(i) + (px(i + 1) - px(i)) * f;
        const y1 = py(c.vals[i]!) + (py(c.vals[i + 1]!) - py(c.vals[i]!)) * f;
        s.line(px(i), py(c.vals[i]!), x1, y1, col, 0.5);
      }
      for (let i = 0; i < Math.min(n, Math.ceil(shown)); i++) s.circle(px(i), py(c.vals[i]!), 0.9 * s.u, { fill: col });
    });
  }
}
