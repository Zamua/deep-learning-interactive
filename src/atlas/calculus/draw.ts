// Plotting helpers for the calculus explainers, on top of the lecture Scene and src/atlas/draw.ts.
import { type Ink, type Scene } from '../../lecture/scene';
export type Rect = [x: number, y: number, w: number, h: number];

/** The stage inside margins given as fractions of its sides. */
export function inset(s: Scene, top = 0.08, side = 0.07, bottom = 0.08): Rect {
  return [s.w * side, s.h * top, s.w * (1 - 2 * side), s.h * (1 - top - bottom)];
}

/** Maps a data window [x0, x1, y0, y1] onto a stage rectangle, y up. */
export class Frame {
  readonly kx: number;
  readonly ky: number;
  readonly ox: number;
  readonly oy: number;

  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
    square = false,
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    let kx = rw / (x1 - x0);
    let ky = rh / (y1 - y0);
    if (square) kx = ky = Math.min(kx, ky);
    this.kx = kx;
    this.ky = ky;
    this.ox = rx + (rw - kx * (x1 - x0)) / 2 - kx * x0;
    this.oy = ry + (rh - ky * (y1 - y0)) / 2 + ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  /** Stage position as fractions, for placing a KaTeX mark at a data point. */
  frac(x: number, y: number, dx = 0, dy = 0): { x: number; y: number } {
    return { x: (this.X(x) + dx * this.s.u) / this.s.w, y: (this.Y(y) + dy * this.s.u) / this.s.h };
  }
  /** The x and y axes where they fall inside the window. */
  axes(a = 1): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.3);
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.3);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    const [x0, x1, y0, y1] = this.dom;
    c.save();
    c.beginPath();
    c.rect(this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1));
    c.clip();
    fn();
    c.restore();
  }
  /** The graph of `f` from `from` to `to`, clipped to the window. */
  fn(f: (x: number) => number, k: Ink, width = 0.7, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const s = this.s;
    const c = s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 200;
      let pen = false;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const y = f(x);
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
        if (pen) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
        pen = true;
      }
      c.strokeStyle = s.c(k);
      c.lineWidth = width * s.u;
      c.lineJoin = 'round';
      c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  /** A straight line through (x, y) with slope m, between x = from and x = to. */
  tangent(x: number, y: number, m: number, k: Ink, from: number, to: number, width = 0.55): void {
    this.fn((t) => y + m * (t - x), k, width, from, to);
  }
  seg(x0: number, y0: number, x1: number, y1: number, k: Ink, width = 0.4, dash?: number[]): void {
    this.s.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.s.c(k), width, dash);
  }
  arrow(x0: number, y0: number, x1: number, y1: number, k: Ink, width = 0.6, head = 2.8): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.s.c(k), width, head);
  }
  dot(x: number, y: number, k: Ink, r = 1.4): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: this.s.c(k), stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** A labeled node of a chain, drawn as a rounded box; `on` lights it. */
export function node(s: Scene, x: number, y: number, label: string, k: Ink, on = 0, w = 12, h = 9): void {
  s.rrect(x - (w / 2) * s.u, y - (h / 2) * s.u, w * s.u, h * s.u, 2, { fill: s.tint(k, 0.12 + 0.2 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.35 + 0.25 * on });
  s.text(label, x, y - 0.2 * s.u, { size: 5.6, italic: true, weight: 500, color: s.c(k) });
}

/** A note line at the frame's top-left corner, `row` lines down. */
export function note(s: Scene, F: Frame, text: string, row: number, k: Ink = '--ink', size = 4): void {
  s.text(text, F.X(F.dom[0]) + 3 * s.u, F.Y(F.dom[3]) + (4 + row * 7) * s.u, { size, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
}
