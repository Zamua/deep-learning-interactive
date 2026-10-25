// Drawing helpers for the optimization explainers: functions plotted in a stage box, balls on them.
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { smooth } from '../../lecture/scene';

type Ink = Color | `--${string}`;

/** Data coordinates mapped into a stage rectangle (left, top, right, bottom in px). */
export interface Frame {
  l: number;
  t: number;
  r: number;
  b: number;
  X(x: number): number;
  Y(y: number): number;
}

export function frame(l: number, t: number, r: number, b: number, xr: [number, number], yr: [number, number]): Frame {
  return {
    l,
    t,
    r,
    b,
    X: (x) => l + ((x - xr[0]) / (xr[1] - xr[0])) * (r - l),
    Y: (y) => b - ((y - yr[0]) / (yr[1] - yr[0])) * (b - t),
  };
}

/** Runs `fn` with drawing clipped to the frame. */
export function clipped(s: Scene, F: Frame, fn: () => void): void {
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.rect(F.l, F.t, F.r - F.l, F.b - F.t);
  c.clip();
  fn();
  c.restore();
}

/** `f` from x0 to x1, clipped to the frame; `upto` < 1 draws only the first part, for an entrance. */
export function curve(s: Scene, F: Frame, f: (x: number) => number, x0: number, x1: number, k: Ink, o: { width?: number; upto?: number; dash?: number[] } = {}): void {
  const end = x0 + (x1 - x0) * (o.upto ?? 1);
  if (end === x0) return;
  const c = s.ctx;
  clipped(s, F, () => {
    c.beginPath();
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((end - x0) * i) / n;
      if (i) c.lineTo(F.X(x), F.Y(f(x)));
      else c.moveTo(F.X(x), F.Y(f(x)));
    }
    c.strokeStyle = s.c(k);
    c.lineWidth = (o.width ?? 0.6) * s.u;
    c.lineJoin = 'round';
    c.setLineDash(o.dash ? o.dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
  });
}

/** A ball marking a point on a curve. */
export function ball(s: Scene, x: number, y: number, k: Ink, r = 1.9): void {
  s.circle(x, y, r * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.5 });
}

/** The frame's floor as an axis, with its variable named at the right end and the plotted function at the top left. */
export function axes(s: Scene, F: Frame, xName: string, yName: string, k: { x: Ink; y: Ink }): void {
  s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
  s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
  s.text(xName, F.r, F.b + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(k.x) });
  s.text(yName, F.l + 2 * s.u, F.t + 2 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c(k.y) });
}

/**
 * Where a ball hopping through `pts` is `t` seconds after it starts, `every` seconds per hop
 * (each hop eased): the point, and how many hops have landed.
 */
export function hop(pts: [number, number][], t: number, every: number): { x: number; y: number; done: number } {
  if (t <= 0) return { x: pts[0]![0], y: pts[0]![1], done: 0 };
  const k = Math.min(pts.length - 1, Math.floor(t / every));
  if (k >= pts.length - 1) return { x: pts[k]![0], y: pts[k]![1], done: k };
  const f = smooth(((t - k * every) / every) * 1.6);
  const a = pts[k]!;
  const b = pts[k + 1]!;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, done: k + (f >= 1 ? 1 : 0) };
}
