import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';

export type Rect = [number, number, number, number];

/** Maps a data window onto a pixel rectangle of the stage (y up). */
export class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
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
  grid(step = 1, a = 1, axes = true): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
      if (axes && x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.35);
      if (axes && y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.35);
    });
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** The stage's drawing area inside a margin, with room for the scene chip at the top. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = Math.max(s.u * 4, s.w * pad);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Text in a rounded, tinted pill. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: Color | `--${string}`, o: { size?: number; align?: 'left' | 'center' | 'right'; on?: number; font?: 'mono' | 'serif' | 'ui'; solid?: boolean } = {}): number {
  const size = o.size ?? 3.6;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { size, font });
  const pw = tw + s.u * size * 0.9;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  const on = o.on ?? 0;
  if (o.solid) s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.c('--card') });
  s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.tint(k, 0.1 + 0.18 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.2 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { size, font, color: s.c(k === '--ink' ? '--ink' : k) });
  return pw;
}

/** A cross in a filled circle. */
export function cross(s: Scene, x: number, y: number, r: number, k: Color = 'red'): void {
  s.circle(x, y, r, { fill: s.c(k) });
  const u = r * 0.42;
  const lw = 0.45 * (r / s.u / 1.9);
  s.line(x - u, y - u, x + u, y + u, '#ffffff', lw);
  s.line(x - u, y + u, x + u, y - u, '#ffffff', lw);
}

/** A padlock, closed or opening (`open` 0 -> 1). */
export function lock(s: Scene, x: number, y: number, size: number, col: string, open = 0): void {
  const bw = size;
  const bh = size * 0.75;
  s.rrect(x - bw / 2, y - bh / 2 + size * 0.15, bw, bh, 0.8, { fill: col });
  const c = s.ctx;
  c.beginPath();
  const r = size * 0.3;
  const lift = open * size * 0.35;
  c.arc(x, y - bh / 2 + size * 0.15 - lift, r, Math.PI, 0);
  c.lineTo(x + r, y - bh / 2 + size * 0.2 - lift * (1 - open));
  c.moveTo(x - r, y - bh / 2 + size * 0.15 - lift);
  c.lineTo(x - r, y - bh / 2 + size * 0.25);
  c.strokeStyle = col;
  c.lineWidth = size * 0.13;
  c.lineCap = 'round';
  c.stroke();
}
