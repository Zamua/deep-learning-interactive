import type { Color } from '../../core/symbols';
import { type Scene, lerp } from '../../lecture/scene';

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
    this.oy = ry + this.ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
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
  /** A polyline through data points. */
  path(xs: number[], ys: number[], col: string, width = 0.6, dash?: number[]): void {
    const c = this.s.ctx;
    if (xs.length < 2) return;
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(this.X(x), this.Y(ys[i]!)) : c.moveTo(this.X(x), this.Y(ys[i]!))));
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.stroke();
    c.setLineDash([]);
  }
  fn(f: (x: number) => number, col: string, width = 0.6, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 160; i++) {
      const x = from + ((to - from) * i) / 160;
      xs.push(x);
      ys.push(f(x));
    }
    this.clip(() => this.path(xs, ys, col, width, dash));
  }
  dot(x: number, y: number, r: number, fill: string, stroke?: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill, stroke: stroke ?? this.s.c('--card'), lw: 0.25 });
  }
  border(a = 1): void {
    const s = this.s;
    s.alpha(a, () => s.rrect(this.rect[0], this.rect[1], this.rect[2], this.rect[3], 1, { stroke: s.c('--axis'), lw: 0.25 }));
  }
}

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** A rounded tag of mono text. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** Greedy word wrap in stage text units. */
export function wrapText(s: Scene, text: string, maxW: number, size: number, font: 'serif' | 'ui' | 'mono' = 'ui', weight = 450): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && s.measure(next, { size, font, weight }) > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** A card with a bold title and wrapped body text; `on` lights it. Returns its height. */
export function card(
  s: Scene,
  x: number,
  y: number,
  w: number,
  k: K,
  title: string,
  body: string,
  o: { on?: number; size?: number; h?: number; italic?: boolean; inset?: number } = {},
): number {
  const size = o.size ?? 3.3;
  const pad = s.u * 2;
  const lines = body ? wrapText(s, body, w - 2 * pad - (o.inset ?? 0) * s.u, size * 0.92, 'ui') : [];
  const lh = size * 1.32 * s.u;
  const h = o.h ?? pad * 2 + size * 1.3 * s.u + lines.length * lh;
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.07 + 0.15 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.3 * on });
  s.text(title, x + pad, y + pad + size * 0.55 * s.u, { size, font: 'ui', weight: 650, align: 'left', color: s.c('--ink') });
  lines.forEach((l, i) => s.text(l, x + pad, y + pad + size * 1.3 * s.u + lh * (i + 0.5), { size: size * 0.92, font: 'ui', italic: o.italic, align: 'left', color: s.c('--ink-2') }));
  return h;
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

/** The usable stage inside a margin, below the scene-title chip. */
export function area(s: Scene, top = 0.13, pad = 5): Rect {
  const m = s.u * pad;
  const y0 = Math.max(s.h * top, m);
  return [m, y0, s.w - 2 * m, s.h - y0 - m];
}
