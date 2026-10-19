import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { HEADS, type Mat, SENTENCE, blockTrace, fig1, headAttention, sinusoids, softmax, transpose } from '../../lib/transformer-model';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/* ------------------------------------------------------------------ data, computed once */

export const WORDS = SENTENCE as readonly string[];
export const TR = fig1();
export const KT = transpose(TR.K);
export const HEAD_A: Mat[] = HEADS.map((h) => headAttention(SENTENCE, h).A);
export const NEXT_MASKED = headAttention(SENTENCE, 'next word', true).A;
export const BLOCK = blockTrace();
export const P64 = sinusoids(64, 64);

/** Dot products of random unit-variance queries and keys, kept at every power-of-two width up to 512. */
export const DOTS: { all: Float64Array[]; row: number[][] } = (() => {
  const N = 1200;
  const POW = 10;
  const rng = new Rng(18);
  const all = Array.from({ length: POW }, () => new Float64Array(N));
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (let i = 0, pw = 0; i < 1 << (POW - 1); i++) {
      s += rng.randn() * rng.randn();
      if (i + 1 === 1 << pw) all[pw++]![n] = s;
    }
  }
  const q = Array.from({ length: 1 << (POW - 1) }, () => rng.randn());
  const row = Array.from({ length: POW }, () => new Array<number>(8).fill(0));
  for (let j = 0; j < 8; j++) {
    let s = 0;
    for (let i = 0, pw = 0; i < 1 << (POW - 1); i++) {
      s += q[i]! * rng.randn();
      if (i + 1 === 1 << pw) row[pw++]![j] = s;
    }
  }
  return { all, row };
})();

/** Dot products at a fractional log2 width, interpolated between stored powers of two. */
export function dotsAt(p: number): { all: number[]; row: number[] } {
  const p0 = Math.max(0, Math.min(8, Math.floor(p)));
  const f = Math.max(0, Math.min(1, p - p0));
  const a = DOTS.all[p0]!;
  const b = DOTS.all[p0 + 1]!;
  return {
    all: Array.from(a, (v, i) => v + (b[i]! - v) * f),
    row: DOTS.row[p0]!.map((v, j) => v + (DOTS.row[p0 + 1]![j]! - v) * f),
  };
}

export { softmax };

/* ------------------------------------------------------------------ layout */

/** The stage inside a margin, below the scene chip. */
export function area(s: Scene, top = 0.13, pad = 5): Rect {
  const m = s.u * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Compact numbers: ".05", "-.93", "1.5", "-1.6". */
export function short(v: number): string {
  if (Math.abs(v) < 0.995) {
    const t = v.toFixed(2);
    return (t === '-0.00' ? '0.00' : t).replace(/^0\./, '.').replace(/^-0\./, '-.');
  }
  return v.toFixed(1);
}

/* ------------------------------------------------------------------ drawing */

/** A token chip; returns its width. */
export function chip(s: Scene, word: string, x: number, y: number, k: K, o: { on?: number; size?: number; maxW?: number } = {}): number {
  const size = o.size ?? 3.6;
  const on = o.on ?? 0;
  const tw = s.measure(word, { font: 'ui', size, weight: 600 });
  const w = Math.min(o.maxW ?? Infinity, tw + s.u * size * 0.9);
  const h = s.u * size * 1.75;
  s.rrect(x - w / 2, y - h / 2, w, h, size * 0.45, { fill: s.tint(k, 0.08 + 0.3 * on), stroke: s.tint(k, 0.45 + 0.5 * on), lw: 0.3 + 0.25 * on });
  s.text(word, x, y + s.u * 0.15, { font: 'ui', size, weight: on > 0.5 ? 700 : 600, color: s.c('--ink') });
  return w;
}

/** Evenly spaced x centers for `n` items across [x0, x1]. */
export function spread(n: number, x0: number, x1: number): number[] {
  const step = (x1 - x0) / n;
  return Array.from({ length: n }, (_, i) => x0 + step * (i + 0.5));
}

export interface GridOpts {
  on?: (i: number, j: number) => number;
  a?: (i: number, j: number) => number;
  label?: (v: number, i: number, j: number) => string;
  size?: number;
}

/** A matrix of numbers in cells, top-left at (x, y). */
export function grid(s: Scene, x: number, y: number, cw: number, ch: number, M: Mat, k: K | ((i: number, j: number) => K), o: GridOpts = {}): void {
  M.forEach((row, i) =>
    row.forEach((v, j) => {
      const a = o.a ? o.a(i, j) : 1;
      if (a <= 0.003) return;
      const kk = typeof k === 'function' ? k(i, j) : k;
      s.alpha(a, () => s.cell(x + j * cw, y + i * ch, cw, ch, o.label ? o.label(v, i, j) : short(v), kk, { on: o.on ? o.on(i, j) : 0, size: o.size }));
    }),
  );
}

export interface HeatOpts {
  /** Masked cells (j > i) drawn empty. */
  mask?: boolean | number;
  numbers?: boolean;
  /** Row highlight 0..1 for row `sel`. */
  sel?: number;
  selA?: number;
  a?: (i: number, j: number) => number;
  k?: K;
  /** Cells to flag in red, 0..1. */
  flag?: (i: number, j: number) => number;
}

/** Attention weights as purple cells. */
export function heat(s: Scene, x: number, y: number, cs: number, A: Mat, o: HeatOpts = {}): void {
  const k = o.k ?? 'purple';
  const mk = typeof o.mask === 'number' ? o.mask : o.mask ? 1 : 0;
  A.forEach((row, i) =>
    row.forEach((v, j) => {
      const a = o.a ? o.a(i, j) : 1;
      if (a <= 0.003) return;
      s.alpha(a, () => {
        const masked = j > i ? mk : 0;
        const cx = x + j * cs;
        const cy = y + i * cs;
        const pad = Math.max(1, cs * 0.05);
        s.rrect(cx + pad, cy + pad, cs - 2 * pad, cs - 2 * pad, Math.min(1.2, cs / s.u / 5), { fill: s.tint(k, (0.05 + 0.85 * v) * (1 - masked)), stroke: s.tint(k, 0.3 * (1 - masked)), lw: 0.2 });
        if (masked > 0) s.rrect(cx + pad, cy + pad, cs - 2 * pad, cs - 2 * pad, Math.min(1.2, cs / s.u / 5), { fill: s.tint('--ink-3', 0.08 * masked) });
        const f = o.flag ? o.flag(i, j) : 0;
        if (f > 0) s.rrect(cx + pad, cy + pad, cs - 2 * pad, cs - 2 * pad, Math.min(1.2, cs / s.u / 5), { stroke: s.tint('red', f), lw: 0.55 });
        if (o.numbers && v >= 0.005 && masked < 0.5) s.text(short(v), cx + cs / 2, cy + cs / 2 + s.u * 0.2, { font: 'mono', size: Math.min(3.2, (cs / s.u) * 0.3), color: v > 0.55 ? '#ffffff' : s.c('--ink') });
      });
    }),
  );
  if (o.sel !== undefined && (o.selA ?? 1) > 0) s.alpha(o.selA ?? 1, () => s.rrect(x, y + o.sel! * cs, A[0]!.length * cs, cs, 1.2, { stroke: s.c('teal'), lw: 0.5 }));
}

/** Word labels left of a grid's rows. */
export function rowLabels(s: Scene, words: readonly string[], x: number, y: number, ch: number, o: { size?: number; lit?: number; k?: K; a?: number } = {}): void {
  s.alpha(o.a ?? 1, () =>
    words.forEach((wd, i) => s.text(wd, x, y + i * ch + ch / 2 + s.u * 0.2, { font: 'ui', size: o.size ?? 3.2, align: 'right', weight: i === o.lit ? 700 : 500, color: i === o.lit ? s.c(o.k ?? 'teal') : s.c('--ink-3') })),
  );
}

/** Word labels above a grid's columns. */
export function colLabels(s: Scene, words: readonly string[], x: number, y: number, cw: number, o: { size?: number; k?: K; a?: number } = {}): void {
  s.alpha(o.a ?? 1, () => words.forEach((wd, j) => s.text(wd, x + j * cw + cw / 2, y, { font: 'ui', size: o.size ?? 3, color: o.k ? s.c(o.k) : s.c('--ink-3') })));
}

/** A matrix name in italic serif with an optional subscript and a mono shape tag, centered at x. */
export function matName(s: Scene, name: string, sub: string, shape: string, x: number, y: number, k: K, size = 4.6): void {
  const nw = s.measure(name, { font: 'serif', italic: true, weight: 650, size });
  const sw = sub ? s.measure(sub, { font: 'serif', italic: true, weight: 650, size: size * 0.7 }) : 0;
  const shw = shape ? s.measure(shape, { font: 'mono', size: size * 0.62 }) : 0;
  const tw = nw + sw + (shape ? s.u + shw : 0);
  let cx = x - tw / 2;
  s.text(name, cx, y, { font: 'serif', italic: true, weight: 650, size, color: s.c(k), align: 'left' });
  cx += nw;
  if (sub) s.text(sub, cx, y + s.u * size * 0.22, { font: 'serif', italic: true, weight: 650, size: size * 0.7, color: s.c(k), align: 'left' });
  cx += sw + s.u;
  if (shape) s.text(shape, cx, y + s.u * 0.2, { font: 'mono', size: size * 0.62, color: s.c('--ink-3'), align: 'left' });
}

/** A rounded tag of mono text; returns its width. */
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

/** The largest text size, at most `max`, that fits `text` into `room` px. */
export function fitSize(s: Scene, text: string, room: number, max: number, font: 'ui' | 'mono' = 'ui'): number {
  const w1 = s.measure(text, { font, size: 1, weight: 600 });
  return Math.min(max, room / Math.max(1e-6, w1));
}

/** A rounded box with a centered label. */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; weight?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.08 + 0.25 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.3 * on });
  if (label) s.text(label, x + w / 2, y + h / 2 + s.u * 0.2, { font: 'ui', size: Math.min(o.size ?? 3.4, fitSize(s, label, w - s.u * 2, 9)), weight: o.weight ?? (on > 0.5 ? 700 : 600), color: s.c('--ink') });
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** Lines from query chips (top) to key chips (bottom), weighted by A; row `sel` drawn strong. */
export function arcs(s: Scene, xs: number[], y0: number, y1: number, A: Mat, sel: number, a = 1, others = 0.25): void {
  s.alpha(a, () => {
    A.forEach((row, i) =>
      row.forEach((v, j) => {
        if (v < 0.02) return;
        const on = i === sel;
        if (!on && others <= 0) return;
        s.line(xs[i]!, y0, xs[j]!, y1, on ? s.tint('purple', 0.2 + 0.8 * v) : s.tint('--ink-3', others * v), on ? 0.3 + 1.6 * v : 0.25 + 0.4 * v);
      }),
    );
  });
}

/** Signed value as a fill: orange positive, slate negative. */
export function signedFill(s: Scene, v: number, range: number): string {
  const a = Math.min(1, Math.abs(v) / range);
  return s.tint(v >= 0 ? 'orange' : 'slate', 0.06 + 0.72 * a);
}
