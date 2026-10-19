import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';
import { KEYS } from '../../lib/dpo-toy';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The drawing area under the scene chip, inside a margin. */
export function area(s: Scene, top = 0.14, pad = 0.05): Rect {
  const m = Math.max(s.w * pad, s.u * 4);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Splits a rect into two: side by side on a wide stage, stacked on a tall one. */
export function split(s: Scene, r: Rect, frac = 0.5, gap = 4): [Rect, Rect] {
  const [x, y, w, h] = r;
  const g = gap * s.u;
  if (s.tall) {
    const h1 = (h - g) * frac;
    return [[x, y, w, h1], [x, y + h1 + g, w, h - h1 - g]];
  }
  const w1 = (w - g) * frac;
  return [[x, y, w1, h], [x + w1 + g, y, w - w1 - g, h]];
}

/** Maps a data window onto a pixel rect (y up). */
export class Frame {
  kx: number;
  ky: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
  ) {
    this.kx = rect[2] / (dom[1] - dom[0]);
    this.ky = rect[3] / (dom[3] - dom[2]);
  }
  X(x: number): number {
    return this.rect[0] + (x - this.dom[0]) * this.kx;
  }
  Y(y: number): number {
    return this.rect[1] + this.rect[3] - (y - this.dom[2]) * this.ky;
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
  hline(y: number, col: string, width = 0.3, dash?: number[]): void {
    this.s.line(this.rect[0], this.Y(y), this.rect[0] + this.rect[2], this.Y(y), col, width, dash);
  }
  vline(x: number, col: string, width = 0.3, dash?: number[]): void {
    this.s.line(this.X(x), this.rect[1], this.X(x), this.rect[1] + this.rect[3], col, width, dash);
  }
  /** y = f(x) from x0 to x1. */
  fn(f: (x: number) => number, col: string, width = 0.7, x0 = this.dom[0], x1 = this.dom[1]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 200;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    });
  }
  path(xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, width = 0.7, n = xs.length): void {
    if (n < 2) return;
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      for (let i = 0; i < n; i++) {
        if (i) c.lineTo(this.X(xs[i]!), this.Y(ys[i]!));
        else c.moveTo(this.X(xs[i]!), this.Y(ys[i]!));
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.stroke();
    });
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.4 });
  }
}

export interface BarSet {
  vals: readonly number[];
  k: K;
  kind: 'fill' | 'line' | 'dash';
  a?: number;
}

/**
 * Grouped bars over the four answers in `r`, letters underneath. Domain [lo, hi] in data units;
 * returns the frame and each bar's center so callers can annotate.
 */
export function bars(
  s: Scene,
  r: Rect,
  sets: BarSet[],
  o: { lo?: number; hi?: number; labels?: boolean; short?: readonly string[]; values?: number; valueFmt?: (v: number) => string; lit?: (i: number) => number } = {},
): { f: Frame; x: (i: number, k: number) => number; bw: number } {
  const lab = o.labels === false ? 0 : (o.short ? 9.5 : 6) * s.u;
  const f = new Frame(s, [r[0], r[1], r[2], r[3] - lab], [0, 4, o.lo ?? 0, o.hi ?? 1]);
  const n = sets.length;
  const group = 0.76;
  const bw = group / n;
  const x = (i: number, k: number) => i + 0.5 - group / 2 + bw * (k + 0.5);
  f.hline(0, s.c('--axis'), 0.35);
  for (let i = 0; i < 4; i++) {
    const lit = o.lit ? o.lit(i) : 0;
    if (lit > 0.01) s.rrect(f.X(i + 0.04), r[1], f.X(i + 0.96) - f.X(i + 0.04), r[3], 1.5, { fill: s.tint('--accent', 0.1 * lit) });
    sets.forEach((st, k) => {
      const v = st.vals[i]!;
      const x0 = f.X(x(i, k) - bw * 0.42);
      const x1 = f.X(x(i, k) + bw * 0.42);
      const y0 = f.Y(0);
      const y1 = f.Y(Math.max(f.dom[2], Math.min(f.dom[3], v)));
      const top = Math.min(y0, y1);
      const hh = Math.abs(y1 - y0);
      s.alpha(st.a ?? 1, () => {
        const c = s.ctx;
        if (st.kind === 'dash') {
          c.save();
          c.setLineDash([s.u * 1, s.u * 0.8]);
          s.rrect(x0, top, x1 - x0, Math.max(hh, 0.5), 0.5, { fill: s.tint(st.k, 0.05), stroke: s.c(st.k), lw: 0.4 });
          c.restore();
        } else {
          s.rrect(x0, top, x1 - x0, Math.max(hh, 0.5), 0.5, { fill: s.tint(st.k, st.kind === 'fill' ? 0.7 : 0.14), stroke: s.c(st.k), lw: 0.35 });
        }
      });
    });
    if (o.values !== undefined) {
      const st = sets[o.values]!;
      const v = st.vals[i]!;
      const y = v >= 0 ? f.Y(Math.min(v, f.dom[3])) - s.u * 2.2 : f.Y(Math.max(v, f.dom[2])) + s.u * 2.4;
      s.alpha(st.a ?? 1, () => s.text((o.valueFmt ?? fmt2)(v), f.X(x(i, o.values!)), y, { font: 'mono', size: 3.3, weight: 600, halo: true }));
    }
    if (lab) {
      s.text(KEYS[i]!, f.X(i + 0.5), r[1] + r[3] - lab + s.u * 3, { font: 'ui', size: 3.8, weight: 700 });
      if (o.short) s.text(o.short[i]!, f.X(i + 0.5), r[1] + r[3] - lab + s.u * 7, { font: 'ui', size: 3.3, color: s.c('--ink-3') });
    }
  }
  return { f, x, bw };
}

export const fmt2 = (v: number): string => {
  const a = Math.abs(v);
  if (a < 1e-9) return '0';
  if (a < 0.0095) return v > 0 ? '<.01' : '>-.01';
  return String(Math.round(v * 100) / 100);
};

/** The largest size (up to `size`) at which `text` fits in `maxW` px. */
export function fit(s: Scene, text: string, maxW: number, size: number, o: { font?: 'display' | 'serif' | 'mono' | 'ui'; weight?: number; italic?: boolean } = {}): number {
  const w = s.measure(text, { size, ...o });
  return w > maxW ? (size * maxW) / w : size;
}

/** A rounded tag of text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' | 'serif'; strike?: number; ink?: string } = {}): number {
  const size = o.size ?? 3.6;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 1.0;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.6, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: o.ink ?? s.c(k) });
  if (o.strike && o.strike > 0) {
    const e = clamp01(o.strike);
    s.line(x0 - s.u, y + ph * 0.45, x0 - s.u + (pw + 2 * s.u) * e, y - ph * 0.45, s.c('red'), 0.6);
  }
  return pw;
}

/** Width a pill would take. */
export function pillW(s: Scene, text: string, size = 3.6, font: 'mono' | 'ui' | 'serif' = 'mono'): number {
  return s.measure(text, { font, size, weight: 600 }) + s.u * size * 1.0;
}

/** A labeled box with a title and an optional second line. */
export function box(s: Scene, x: number, y: number, w: number, h: number, title: string, k: K, o: { sub?: string; size?: number; fill?: number; lw?: number } = {}): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, o.fill ?? 0.1), stroke: s.c(k), lw: o.lw ?? 0.45 });
  const size = o.size ?? 4;
  s.text(title, x + w / 2, y + h / 2 - (o.sub ? size * s.u * 0.45 : 0), { size, font: 'display', weight: 600, color: s.c(k) });
  if (o.sub) s.text(o.sub, x + w / 2, y + h / 2 + size * s.u * 0.65, { size: size * 0.68, font: 'ui', color: s.c('--ink-2') });
}

/** A green check or a red cross in a disc. */
export function mark(s: Scene, cx: number, cy: number, r: number, ok: boolean): void {
  s.circle(cx, cy, r, { fill: s.c(ok ? 'green' : 'red') });
  const k = r / (1.9 * s.u);
  if (ok) {
    s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
    s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
  } else {
    const d = r * 0.42;
    s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.45 * k);
    s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.45 * k);
  }
}

/** Seconds-based easing between keyframes: value at time t for [time, value] pairs, smoothstepped. */
export function keys(t: number, kf: [number, number][]): number {
  if (t <= kf[0]![0]) return kf[0]![1];
  for (let i = 1; i < kf.length; i++) {
    const [t1, v1] = kf[i]!;
    const [t0, v0] = kf[i - 1]!;
    if (t <= t1) {
      const p = (t - t0) / Math.max(1e-6, t1 - t0);
      const e = p * p * (3 - 2 * p);
      return v0 + (v1 - v0) * e;
    }
  }
  return kf[kf.length - 1]![1];
}
