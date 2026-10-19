import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;
type Rect = [number, number, number, number];

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** Draws (part of) a small source canvas with crisp pixels. */
export function pix(s: Scene, src: CanvasImageSource, x: number, y: number, w: number, h: number, sx = 0, sy = 0, sw = 32, sh = 32): void {
  const c = s.ctx;
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  c.restore();
}

/** Grid lines over a square at (x, y) of side S, cut into G x G cells. */
export function grid(s: Scene, x: number, y: number, S: number, G: number, col = 'rgba(255,255,255,0.85)', lw = 0.3): void {
  for (let k = 1; k < G; k++) {
    s.line(x + (k * S) / G, y, x + (k * S) / G, y + S, col, lw);
    s.line(x, y + (k * S) / G, x + S, y + (k * S) / G, col, lw);
  }
}

/** An image darkened where `map` (G x G) is small, stretched from its minimum to its maximum. */
export function veil(s: Scene, src: CanvasImageSource, map: ArrayLike<number>, G: number, x: number, y: number, S: number, a = 1): void {
  pix(s, src, x, y, S, S);
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < G * G; i++) {
    mx = Math.max(mx, map[i]!);
    mn = Math.min(mn, map[i]!);
  }
  const cs = S / G;
  for (let i = 0; i < G * G; i++) {
    s.ctx.fillStyle = `rgba(0,0,0,${(0.85 * a * (1 - (map[i]! - mn) / (mx - mn + 1e-12))).toFixed(3)})`;
    s.ctx.fillRect(x + (i % G) * cs, y + Math.floor(i / G) * cs, cs + 0.5, cs + 0.5);
  }
}

/**
 * A G x G heat tile in one color (paper -> color). Values are divided by `scale`; without one, the
 * tile is stretched from its own minimum to its maximum.
 */
export function heat(s: Scene, map: ArrayLike<number>, G: number, x: number, y: number, S: number, k: K, scale?: number, neg?: K): void {
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < G * G; i++) {
    mx = Math.max(mx, map[i]!);
    mn = Math.min(mn, map[i]!);
  }
  const cs = S / G;
  for (let i = 0; i < G * G; i++) {
    const v = scale === undefined ? (map[i]! - mn) / (mx - mn + 1e-12) : map[i]! / scale;
    s.ctx.fillStyle = v >= 0 || !neg ? s.tint(k, clamp01(v)) : s.tint(neg, clamp01(-v));
    s.ctx.fillRect(x + (i % G) * cs, y + Math.floor(i / G) * cs, cs + 0.4, cs + 0.4);
  }
  s.rrect(x, y, S, S, 0.4, { stroke: s.tint('--ink-3', 0.5), lw: 0.15 });
}

/** A vector drawn as a strip of cells, values in [-1, 1] setting each cell's strength. */
export function strip(s: Scene, x: number, y: number, w: number, h: number, vals: ArrayLike<number>, k: K, vertical = false): void {
  const n = vals.length;
  for (let i = 0; i < n; i++) {
    const a = 0.12 + 0.75 * Math.min(1, Math.abs(vals[i]!));
    s.ctx.fillStyle = s.tint(k, a);
    if (vertical) s.ctx.fillRect(x, y + (i * h) / n, w, h / n + 0.4);
    else s.ctx.fillRect(x + (i * w) / n, y, w / n + 0.4, h);
  }
  s.rrect(x, y, w, h, 0.3, { stroke: s.tint(k, 0.7), lw: 0.15 });
}

/** A rounded tag with text, centered at (x, y); returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, size = 3.4, align: 'left' | 'center' | 'right' = 'center', font: 'mono' | 'ui' = 'mono'): number {
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = align === 'left' ? x : align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.7), lw: 0.28 });
  s.text(text, x0 + pw / 2, y + s.u * 0.12, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A labelled box (a model, a layer). */
export function block(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, size = 3.8, sub?: string): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.35 });
  s.text(label, x + w / 2, y + h / 2 - (sub ? size * 0.45 * s.u : 0), { size, font: 'display', weight: 600, color: s.c(k) });
  if (sub) s.text(sub, x + w / 2, y + h / 2 + size * 0.75 * s.u, { size: size * 0.72, italic: true, color: s.c('--ink-2') });
}

/** The stage minus a margin of `m` stage units, with `top` units reserved for a heading. */
export function area(s: Scene, m = 5, top = 0): Rect {
  return [m * s.u, (m + top) * s.u, s.w - 2 * m * s.u, s.h - (2 * m + top) * s.u];
}

/** A title and subtitle centered on the stage. */
export function title(s: Scene, t: string, sub: string, a: number): void {
  s.alpha(a, () => {
    s.text(t, s.w / 2, s.h * 0.42, { size: s.tall ? 8.5 : 9, font: 'display', weight: 600 });
    s.text(sub, s.w / 2, s.h * 0.42 + 10 * s.u, { size: 4.4, italic: true, color: s.c('--ink-2') });
  });
}

/** Horizontal probability bars for a few classes. */
export function bars(s: Scene, x: number, y: number, w: number, rows: [string, number][], k: K, size = 3.2, hi = -1, gold = -1): number {
  const lw = s.measure('plane  ', { font: 'ui', size }) + s.u;
  const rh = size * 1.75 * s.u;
  rows.forEach(([lab, v], i) => {
    const yy = y + i * rh;
    s.text(lab, x + lw - s.u, yy + rh / 2, { font: 'ui', size, align: 'right', color: i === gold ? s.c('gold') : s.c('--ink-2'), weight: i === gold ? 700 : 450 });
    const bw = Math.max(0.3 * s.u, (w - lw - 9 * s.u) * clamp01(v));
    s.rrect(x + lw, yy + rh * 0.18, bw, rh * 0.64, 0.5, { fill: s.tint(k, i === hi ? 0.8 : 0.35) });
    s.text(`${Math.round(v * 100)}%`, x + lw + bw + s.u, yy + rh / 2, { font: 'mono', size: size * 0.85, align: 'left', color: s.c('--ink-3') });
  });
  return rows.length * rh;
}
