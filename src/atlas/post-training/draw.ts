// Drawing helpers for the post-training explainers: token chips sized to their text, and plain
// rectangles standing for matrices.
import type { Ink, Scene } from '../../lecture/scene';

/** Where a row of token chips goes: each chip's center and width (px), laid out from `x0`. */
export interface Row {
  xs: number[];
  ws: number[];
  /** The row's total width in px. */
  width: number;
}

/** Lays out `toks` as chips sized to their text at `size` stage units, `gap` units apart, from `x0`. */
export function row(s: Scene, toks: readonly string[], x0: number, size = 3.2, gap = 1.6): Row {
  const ws = toks.map((t) => Math.max(7 * s.u, s.measure(t, { size, font: 'mono' }) + 3.2 * s.u));
  const xs: number[] = [];
  let x = x0;
  for (const w of ws) {
    xs.push(x + w / 2);
    x += w + gap * s.u;
  }
  return { xs, ws, width: x - gap * s.u - x0 };
}

/** Width in px of the row `row` would lay out, to center it before laying it out. */
export const rowWidth = (s: Scene, toks: readonly string[], size = 3.2, gap = 1.6): number => row(s, toks, 0, size, gap).width;

/** Token chips at a layout from `row`, centered on `y`; `k`, `on` and `a` pick each chip's color, light and opacity. */
export function chips(s: Scene, toks: readonly string[], r: Row, y: number, k: (i: number) => Ink, o: { h?: number; size?: number; on?: (i: number) => number; a?: (i: number) => number } = {}): void {
  const h = (o.h ?? 7) * s.u;
  toks.forEach((t, i) => {
    s.alpha(o.a?.(i) ?? 1, () => s.cell(r.xs[i]! - r.ws[i]! / 2, y - h / 2, r.ws[i]!, h, t, k(i), { on: o.on?.(i) ?? 0, size: o.size ?? 3.2 }));
  });
}

/** A rectangle standing for a matrix, centered on (x, y), `w` by `h` px, with its name inside. */
export function block(s: Scene, x: number, y: number, w: number, h: number, label: string, k: Ink, o: { on?: number; dash?: boolean; size?: number } = {}): void {
  const on = o.on ?? 0;
  const c = s.ctx;
  if (o.dash) {
    c.save();
    c.setLineDash([1.2 * s.u, 1 * s.u]);
    s.rrect(x - w / 2, y - h / 2, w, h, 1, { stroke: s.tint(k, 0.8), lw: 0.35 });
    c.restore();
  } else {
    s.rrect(x - w / 2, y - h / 2, w, h, 1, { fill: s.tint(k, 0.14 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 + 0.2 * on });
  }
  if (label) s.text(label, x, y + 0.2 * s.u, { size: o.size ?? 4.2, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** A vertical arrow standing for a push on a probability: up for a positive weight, down for negative. */
export function push(s: Scene, x: number, y: number, v: number, scale: number, a = 1): void {
  if (Math.abs(v) < 1e-9 || a <= 0.003) return;
  const len = v * scale * s.u * a;
  s.arrow(x, y, x, y - len, s.c(v > 0 ? 'green' : 'red'), 0.6, 2.2);
}
