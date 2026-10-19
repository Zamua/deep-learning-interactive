import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';

export type K = Color | `--${string}`;
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
  get view(): [number, number, number, number] {
    const [rx, ry, rw, rh] = this.rect;
    return [(rx - this.ox) / this.kx, (rx + rw - this.ox) / this.kx, (this.oy - ry - rh) / this.ky, (this.oy - ry) / this.ky];
  }
  /** Panel background and border. */
  panel(a = 1): void {
    const [rx, ry, rw, rh] = this.rect;
    this.s.alpha(a, () => this.s.rrect(rx, ry, rw, rh, 1.6, { fill: this.s.c('--paper'), stroke: this.s.c('--rule'), lw: 0.25 }));
  }
  hline(y: number, col: string, width = 0.22, dash?: number[]): void {
    const [x0, x1] = this.view;
    this.s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), col, width, dash);
  }
  vline(x: number, col: string, width = 0.22, dash?: number[]): void {
    const [, , y0, y1] = this.view;
    this.s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), col, width, dash);
  }
  axes(a = 1): void {
    const [x0, x1, y0, y1] = this.view;
    this.s.alpha(a, () => {
      if (x0 <= 0 && x1 >= 0) this.vline(0, this.s.c('--axis'), 0.3);
      if (y0 <= 0 && y1 >= 0) this.hline(0, this.s.c('--axis'), 0.3);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  poly(xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, width = 0.6, dash?: number[]): void {
    const c = this.s.ctx;
    if (xs.length < 2) return;
    this.clip(() => {
      c.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const px = this.X(xs[i]!);
        const py = Math.max(-1e4, Math.min(1e4, this.Y(ys[i]!)));
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.7, head = 2.6): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
  /** The image of the unit circle under a 2 x 2 matrix. */
  ellipse(W: number[][], col: string, width = 0.6, dash?: number[]): void {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      xs.push(W[0]![0]! * c + W[0]![1]! * sn);
      ys.push(W[1]![0]! * c + W[1]![1]! * sn);
    }
    this.poly(xs, ys, col, width, dash);
  }
}

/** The stage's drawing area inside a margin, leaving room for the scene chip at the top. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = s.w * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** Largest text size (in u) not above `size` that fits `text` within `maxW` px. */
export function fit(s: Scene, text: string, maxW: number, size: number, o: Parameters<Scene['measure']>[1] = {}): number {
  const wpx = s.measure(text, { ...o, size });
  return wpx <= maxW ? size : (size * maxW) / wpx;
}

/** A rounded card with a heading and a note, both left-aligned and fitted to the width. */
export function card(s: Scene, x: number, y: number, w: number, h: number, head: string, note: string, k: K, on = 0, a = 1): void {
  if (a <= 0.003) return;
  s.alpha(a, () => {
    s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
    const pad = s.u * 2.6;
    if (note && h < s.u * 12.5) {
      // too short for two lines: heading left, note right
      let hs = Math.min(4.4, (h / s.u) * 0.42);
      let ns = Math.min(3.5, hs * 0.85);
      const need = s.measure(head, { size: hs, font: 'display', weight: 620 }) + s.measure(note, { size: ns, italic: true }) + pad * 3;
      if (need > w) {
        hs *= w / need;
        ns *= w / need;
      }
      s.text(head, x + pad, y + h / 2, { size: hs, font: 'display', weight: 620, align: 'left', color: s.c(k) });
      s.text(note, x + w - pad, y + h / 2, { size: ns, italic: true, align: 'right', color: s.c('--ink-2') });
      return;
    }
    const hs = fit(s, head, w - 2 * pad, Math.min(4.8, (h / s.u) * (note ? 0.36 : 0.45)), { font: 'display', weight: 620 });
    if (note) {
      const ns = fit(s, note, w - 2 * pad, Math.min(3.6, hs * 0.8), { italic: true });
      s.text(head, x + pad, y + h * 0.37, { size: hs, font: 'display', weight: 620, align: 'left', color: s.c(k) });
      s.text(note, x + pad, y + h * 0.72, { size: ns, italic: true, align: 'left', color: s.c('--ink-2') });
    } else s.text(head, x + w / 2, y + h / 2, { size: hs, font: 'display', weight: 620, color: s.c(k) });
  });
}

/** A rounded tag of mono text centered at (x, y); returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, size = 3.4): number {
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  s.rrect(x - pw / 2, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}
