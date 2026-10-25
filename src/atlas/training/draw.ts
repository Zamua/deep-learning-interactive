// Drawing helpers for the training explainers: data series in a plot frame, ticks and a legend.
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { clipped, type Frame } from '../optimization/draw';

export { axes, ball, clipped, curve, frame, hop, type Frame } from '../optimization/draw';

type Ink = Color | `--${string}`;

/**
 * A polyline through data points. `upto` in [0, 1] reveals it left to right, ending on a
 * partial segment, for an entrance; `dots` marks every revealed point.
 */
export function series(s: Scene, F: Frame, pts: [number, number][], k: Ink, o: { upto?: number; width?: number; dash?: number[]; dots?: number } = {}): void {
  const n = pts.length - 1;
  const reach = Math.max(0, Math.min(1, o.upto ?? 1)) * n;
  if (reach <= 0) return;
  const c = s.ctx;
  clipped(s, F, () => {
    c.beginPath();
    c.moveTo(F.X(pts[0]![0]), F.Y(pts[0]![1]));
    for (let i = 1; i <= Math.ceil(reach); i++) {
      const f = Math.min(1, reach - (i - 1));
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      c.lineTo(F.X(x0 + (x1 - x0) * f), F.Y(y0 + (y1 - y0) * f));
    }
    c.strokeStyle = s.c(k);
    c.lineWidth = (o.width ?? 0.6) * s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.setLineDash(o.dash ? o.dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
  });
  if (o.dots) for (let i = 0; i <= Math.floor(reach); i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), o.dots * s.u, { fill: s.c(k) });
}

/** Labels under the frame's floor at data x values. */
export function xTicks(s: Scene, F: Frame, xs: number[], fmt: (x: number) => string = String, size = 3): void {
  for (const x of xs) s.text(fmt(x), F.X(x), F.b + 3.4 * s.u, { size, font: 'mono', color: s.c('--ink-3') });
}

/** Labels left of the frame's wall at data y values. */
export function yTicks(s: Scene, F: Frame, ys: number[], fmt: (y: number) => string = String, size = 3): void {
  for (const y of ys) s.text(fmt(y), F.l - 1.6 * s.u, F.Y(y), { size, font: 'mono', align: 'right', color: s.c('--ink-3') });
}

/** A short line swatch and its name, for a plot's legend; returns the x after the entry. */
export function key(s: Scene, x: number, y: number, k: Ink, text: string, size = 3.2): number {
  s.line(x, y, x + 4 * s.u, y, s.c(k), 0.7);
  s.text(text, x + 5.2 * s.u, y, { size, font: 'mono', align: 'left', color: s.c(k) });
  return x + 5.2 * s.u + s.measure(text, { size, font: 'mono' }) + 3.5 * s.u;
}

/** Fixed places with a true minus sign, for numbers drawn on the stage. */
export const fmt = (v: number, places = 2): string => v.toFixed(places).replace('-', '−');
