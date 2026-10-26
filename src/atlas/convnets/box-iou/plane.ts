// A coordinate grid for drawing boxes, shared by the box-iou and iou explainers.
import type { Scene } from '../../../lecture/scene';
import type { Ink } from '../draw';
import type { Box } from './box';

/** A grid of whole-number coordinates, y down, and where the text goes: under it, or beside it on a wide stage. */
export interface Plane {
  X(x: number): number;
  Y(y: number): number;
  c: number;
  l: number;
  t: number;
  r: number;
  b: number;
  side: boolean;
  /** Text column: center x, first line y, line gap. */
  tx: number;
  ty: number;
  gap: number;
}

/** `cell` caps the cell size and `tall` the grid's height, both in stage units. */
export function plane(s: Scene, nx: number, ny: number, cell: number, tall: number): Plane {
  const side = s.w / s.u >= 150;
  if (!side) {
    const c = Math.min(cell * s.u, (s.w - 14 * s.u) / nx, (tall * s.u) / ny);
    const l = (s.w - nx * c) / 2 + 1.5 * s.u;
    const t = 11 * s.u;
    return { X: (x) => l + x * c, Y: (y) => t + y * c, c, l, t, r: l + nx * c, b: t + ny * c, side, tx: s.w / 2, ty: t + ny * c + 8 * s.u, gap: 7 * s.u };
  }
  const c = Math.min(cell * s.u, (70 * s.u) / nx, (60 * s.u) / ny);
  const l = 10 * s.u;
  const t = (s.h - ny * c) / 2 + 2 * s.u;
  const r = l + nx * c;
  return { X: (x) => l + x * c, Y: (y) => t + y * c, c, l, t, r, b: t + ny * c, side, tx: (r + s.w) / 2, ty: s.h * 0.26, gap: 8 * s.u };
}

/** Faint unit grid with its coordinates along the top and the left; `hi` lights some of them. */
export function gridLines(s: Scene, P: Plane, nx: number, ny: number, hi: { x?: number[]; y?: number[]; a?: number } = {}): void {
  for (let i = 0; i <= nx; i++) s.line(P.X(i), P.t, P.X(i), P.b, s.tint('--ink-3', 0.22), 0.2);
  for (let j = 0; j <= ny; j++) s.line(P.l, P.Y(j), P.r, P.Y(j), s.tint('--ink-3', 0.22), 0.2);
  const lit = (v: number, xs?: number[]) => (xs?.includes(v) ? (hi.a ?? 1) : 0);
  const num = (v: number, x: number, y: number, a: number) =>
    s.text(String(v), x, y, { size: 2.8 + 0.6 * a, font: 'mono', weight: 500 + 150 * a, color: a > 0.5 ? s.c('gold') : s.c('--ink-3') });
  for (let i = 0; i <= nx; i++) num(i, P.X(i), P.t - 3 * s.u, lit(i, hi.x));
  for (let j = 0; j <= ny; j++) num(j, P.l - 3 * s.u, P.Y(j), lit(j, hi.y));
}

export function rect(s: Scene, P: Plane, b: Box, k: Ink, o: { fill?: number; lw?: number; dash?: boolean } = {}): void {
  const [x1, y1, x2, y2] = b;
  const c = s.ctx;
  if (o.dash) c.setLineDash([1.2 * s.u, 0.9 * s.u]);
  s.rrect(P.X(x1), P.Y(y1), P.X(x2) - P.X(x1), P.Y(y2) - P.Y(y1), 0.4, { fill: s.tint(k, o.fill ?? 0.1), stroke: s.c(k), lw: o.lw ?? 0.55 });
  c.setLineDash([]);
}
