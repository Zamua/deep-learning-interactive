import { CLASS_COLORS } from '../../core/plot';
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
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    this.kx = rw / (x1 - x0);
    this.ky = rh / (y1 - y0);
    this.ox = rx - this.kx * x0;
    this.oy = ry + rh + this.ky * y0;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  hline(y: number, col: string, width = 0.22, dash?: number[]): void {
    this.s.line(this.X(this.dom[0]), this.Y(y), this.X(this.dom[1]), this.Y(y), col, width, dash);
  }
  vline(x: number, col: string, width = 0.22, dash?: number[]): void {
    this.s.line(this.X(x), this.Y(this.dom[2]), this.X(x), this.Y(this.dom[3]), col, width, dash);
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
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
  /** Grid lines with labels at the left edge (y) or under the bottom edge (x). */
  grid(axis: 'x' | 'y', vals: number[], label: (v: number) => string, size = 3): void {
    const s = this.s;
    const [rx, ry, rw, rh] = this.rect;
    for (const v of vals) {
      if (axis === 'y') {
        this.hline(v, s.c('--grid'), 0.18);
        s.text(label(v), rx - s.u * 1.2, this.Y(v), { font: 'mono', size, align: 'right', color: s.c('--ink-3') });
      } else {
        this.vline(v, s.c('--grid'), 0.18);
        s.text(label(v), this.X(v), ry + rh + s.u * 3, { font: 'mono', size, color: s.c('--ink-3') });
      }
    }
    s.rrect(rx, ry, rw, rh, 0.6, { stroke: s.c('--rule'), lw: 0.22 });
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

/** A rounded card with a heading and an optional note, fitted to its width. */
export function card(s: Scene, x: number, y: number, w: number, h: number, head: string, note: string, k: K, on = 0, a = 1): void {
  if (a <= 0.003) return;
  s.alpha(a, () => {
    s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
    const pad = s.u * 2.4;
    const hs = fit(s, head, w - 2 * pad, Math.min(4.6, (h / s.u) * (note ? 0.34 : 0.45)), { font: 'display', weight: 620 });
    if (note) {
      const ns = fit(s, note, w - 2 * pad, Math.min(3.5, hs * 0.85), { italic: true });
      s.text(head, x + pad, y + h * 0.36, { size: hs, font: 'display', weight: 620, align: 'left', color: s.c(k) });
      s.text(note, x + pad, y + h * 0.71, { size: ns, italic: true, align: 'left', color: s.c('--ink-2') });
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

/** Diagonal hatching inside a rectangle: capacity that is reserved, idle or wasted. */
export function hatch(s: Scene, x: number, y: number, w: number, h: number, col: string, gap = 1.2): void {
  if (w <= 0 || h <= 0) return;
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = col;
  c.lineWidth = Math.max(1, s.u * 0.18);
  c.beginPath();
  const g = gap * s.u;
  for (let d = -h; d < w; d += g) {
    c.moveTo(x + d, y + h);
    c.lineTo(x + d + h, y);
  }
  c.stroke();
  c.restore();
}

/** A filled rectangle without rounding, for bars and Gantt cells. */
export function rect(s: Scene, x: number, y: number, w: number, h: number, fill: string): void {
  if (w <= 0 || h <= 0) return;
  s.ctx.fillStyle = fill;
  s.ctx.fillRect(x, y, w, h);
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** A red cross in a disc. */
export function cross(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('red') });
  const d = r * 0.42;
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.45 * (r / s.u / 1.9));
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.45 * (r / s.u / 1.9));
}

/** A distinct palette color per request id. */
export const reqK = (id: number): Color => CLASS_COLORS[id % CLASS_COLORS.length]!;

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => s.at(id) + (s.end(id) - s.at(id)) * f;
