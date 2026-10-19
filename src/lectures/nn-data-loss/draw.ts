import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, clamp01, lerp, smooth } from '../../lecture/scene';
import { eig2 } from '../../lib/nn-data-loss-linalg';

export type Rect = [number, number, number, number];
export type K = Color | `--${string}`;

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
  /** The data window's pixel rectangle. */
  get box(): Rect {
    const [x0, x1, y0, y1] = this.dom;
    return [this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1)];
  }
  grid(step = 1, a = 1, axes = true): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step - 1e-9) * step; x <= x1 + 1e-9; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      for (let y = Math.ceil(y0 / step - 1e-9) * step; y <= y1 + 1e-9; y += step) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
      if (!axes) return;
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.35);
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.35);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.box);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.7, from = this.dom[0], to = this.dom[1], n = 200): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.setLineDash([]);
      c.stroke();
    });
  }
  path(xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, width = 0.5, dash?: number[]): void {
    const c = this.s.ctx;
    c.beginPath();
    for (let i = 0; i < xs.length; i++) {
      if (i) c.lineTo(this.X(xs[i]!), this.Y(ys[i]!));
      else c.moveTo(this.X(xs[i]!), this.Y(ys[i]!));
    }
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.stroke();
    c.setLineDash([]);
  }
  dot(x: number, y: number, r: number, col: string, ring = false): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, ring ? { fill: col, stroke: this.s.c('--card'), lw: 0.3 } : { fill: col });
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.6, head = 2.6): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  text(str: string, x: number, y: number, o: TextOpts = {}): void {
    this.s.text(str, this.X(x), this.Y(y), o);
  }
}

/** The stage inside a margin, leaving `top` (a fraction of the height) for the scene chip. */
export function area(s: Scene, top = 0.12, pad = 0.05): Rect {
  const m = Math.min(s.w, s.h) * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Splits a rect into a main part and a side panel: stacked on a tall stage, side by side otherwise. */
export function split(s: Scene, r: Rect, frac: number, gap = 3): [Rect, Rect] {
  const [x, y, w, h] = r;
  const g = gap * s.u;
  if (s.tall) {
    const h1 = (h - g) * frac;
    return [[x, y, w, h1], [x, y + h1 + g, w, h - h1 - g]];
  }
  const w1 = (w - g) * frac;
  return [[x, y, w1, h], [x + w1 + g, y, w - w1 - g, h]];
}

/** A rounded tag of text. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; font?: TextOpts['font']; fill?: number } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.7), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A filled disc with a check (ok) or a cross (not ok). */
export function badge(s: Scene, cx: number, cy: number, r: number, ok: boolean): void {
  s.circle(cx, cy, r, { fill: s.c(ok ? 'green' : 'red') });
  const k = r / s.u;
  if (ok) {
    s.line(cx - r * 0.45, cy + r * 0.02, cx - r * 0.1, cy + r * 0.36, '#fff', 0.24 * k);
    s.line(cx - r * 0.1, cy + r * 0.36, cx + r * 0.5, cy - r * 0.34, '#fff', 0.24 * k);
  } else {
    const d = r * 0.38;
    s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.24 * k);
    s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.24 * k);
  }
}

/** Mean and covariance of an interleaved [x0, y0, x1, y1, ...] point list. */
export function stats(P: ArrayLike<number>): { mx: number; my: number; cxx: number; cxy: number; cyy: number } {
  const n = P.length / 2;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += P[2 * i]!;
    my += P[2 * i + 1]!;
  }
  mx /= n;
  my /= n;
  let cxx = 0;
  let cxy = 0;
  let cyy = 0;
  for (let i = 0; i < n; i++) {
    const a = P[2 * i]! - mx;
    const b = P[2 * i + 1]! - my;
    cxx += a * a;
    cxy += a * b;
    cyy += b * b;
  }
  return { mx, my, cxx: cxx / n, cxy: cxy / n, cyy: cyy / n };
}

/** Dashed ellipse covering about 95% of a point cloud, with its principal axes and mean. */
export function covEllipse(fr: Frame, P: ArrayLike<number>, o: { axes?: number; mean?: number; ring?: number } = {}): void {
  const s = fr.s;
  const st = stats(P);
  const { l1, l2, u1, u2 } = eig2(st.cxx, st.cxy, st.cyy);
  const a = Math.sqrt(Math.max(0, l1)) * 2;
  const b = Math.sqrt(Math.max(0, l2)) * 2;
  s.alpha(o.ring ?? 1, () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      xs.push(st.mx + u1[0] * a * Math.cos(t) + u2[0] * b * Math.sin(t));
      ys.push(st.my + u1[1] * a * Math.cos(t) + u2[1] * b * Math.sin(t));
    }
    fr.path(xs, ys, s.tint('--ink-2', 0.7), 0.3, [1.2, 1]);
  });
  s.alpha(o.axes ?? 0, () => {
    fr.arrow(st.mx, st.my, st.mx + u1[0] * a * 0.5, st.my + u1[1] * a * 0.5, s.c('purple'), 0.6);
    if (b > 0.08) fr.arrow(st.mx, st.my, st.mx + u2[0] * b * 0.5, st.my + u2[1] * b * 0.5, s.c('purple'), 0.6);
  });
  s.alpha(o.mean ?? 0, () => meanCross(fr, st.mx, st.my));
}

/** The teal cross that marks a mean. */
export function meanCross(fr: Frame, x: number, y: number, size = 1.6): void {
  const s = fr.s;
  const X = fr.X(x);
  const Y = fr.Y(y);
  const d = size * s.u;
  s.line(X - d, Y - d, X + d, Y + d, s.c('--card'), 1.3);
  s.line(X + d, Y - d, X - d, Y + d, s.c('--card'), 1.3);
  s.line(X - d, Y - d, X + d, Y + d, s.c('teal'), 0.65);
  s.line(X + d, Y - d, X - d, Y + d, s.c('teal'), 0.65);
}

/** Interpolates two interleaved point lists. */
export function mix(A: ArrayLike<number>, B: ArrayLike<number>, t: number): Float64Array {
  const out = new Float64Array(A.length);
  for (let i = 0; i < A.length; i++) out[i] = A[i]! + (B[i]! - A[i]!) * t;
  return out;
}

/** A network drawn as columns of nodes. `node(l, i)` styles each node; edges join live nodes. */
export function network(
  s: Scene,
  r: Rect,
  sizes: number[],
  o: {
    node: (l: number, i: number) => { fill: string; on: boolean; label?: string; ring?: string };
    edge?: (l: number, i: number, j: number) => { col: string; w: number } | null;
    rad?: number;
  },
): [number, number][][] {
  const [x, y, w, h] = r;
  const L = sizes.length;
  const maxN = Math.max(...sizes);
  const gapY = h / maxN;
  const pos = sizes.map((n, l) => Array.from({ length: n }, (_, i) => [x + (w * (l + 0.5)) / L, y + h / 2 + (i - (n - 1) / 2) * gapY] as [number, number]));
  const rad = o.rad ?? Math.min(gapY * 0.34, (w / L) * 0.18);
  for (let l = 0; l < L - 1; l++)
    for (let i = 0; i < sizes[l]!; i++)
      for (let j = 0; j < sizes[l + 1]!; j++) {
        if (!o.node(l, i).on || !o.node(l + 1, j).on) continue;
        const e = o.edge ? o.edge(l, i, j) : { col: s.tint('--ink-3', 0.35), w: 0.25 };
        if (!e) continue;
        const [x0, y0] = pos[l]![i]!;
        const [x1, y1] = pos[l + 1]![j]!;
        s.line(x0, y0, x1, y1, e.col, e.w);
      }
  sizes.forEach((n, l) => {
    for (let i = 0; i < n; i++) {
      const [cx, cy] = pos[l]![i]!;
      const st = o.node(l, i);
      if (st.on) s.circle(cx, cy, rad, { fill: st.fill, stroke: s.c('--ink-2'), lw: 0.3 });
      else {
        s.ctx.save();
        s.ctx.setLineDash([s.u * 0.8, s.u * 0.6]);
        s.circle(cx, cy, rad, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.3 });
        s.ctx.restore();
        const d = rad * 0.5;
        s.line(cx - d, cy - d, cx + d, cy + d, s.c('--ink-3'), 0.3);
        s.line(cx + d, cy - d, cx - d, cy + d, s.c('--ink-3'), 0.3);
      }
      if (st.ring) s.circle(cx, cy, rad + s.u * 1.1, { stroke: st.ring, lw: 0.6 });
      if (st.label) s.text(st.label, cx, cy + s.u * 0.2, { font: 'mono', size: Math.min(3.2, (rad / s.u) * 0.75), weight: 600, color: s.c('--ink') });
    }
  });
  return pos;
}

/** Histogram bars of `vals` over [lo, hi] into `nb` bins, scaled to the tallest bin (or `peak`). */
export function histo(s: Scene, r: Rect, vals: ArrayLike<number>, lo: number, hi: number, nb: number, col: string, peak?: number): number {
  const [x, y, w, h] = r;
  const bins = new Float64Array(nb);
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]!;
    if (v < lo || v > hi) continue;
    bins[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb))]!++;
  }
  const mx = peak ?? Math.max(1, ...bins);
  const bw = w / nb;
  s.ctx.fillStyle = col;
  for (let b = 0; b < nb; b++) {
    const bh = Math.min(h, (h * bins[b]!) / mx);
    if (bh > 0.2) s.ctx.fillRect(x + b * bw + 0.5, y + h - bh, Math.max(1, bw - 1), bh);
  }
  return mx;
}

export { clamp01, lerp, smooth };

/** A value keyed by beats: each listed beat eases from the previous value to its own. */
export function stage<T>(s: Scene, keys: [string, T][], blend: (a: T, b: T, t: number) => T, dur = 0.9): T {
  let cur = keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [beat, v] = keys[i]!;
    const e = s.ease(beat, dur);
    if (e <= 0) break;
    cur = e >= 1 ? v : blend(cur, v, e);
  }
  return cur;
}
