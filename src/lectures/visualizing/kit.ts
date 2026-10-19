import { CIFAR_CLASSES } from '../../core/data';
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { inferno, viridis } from '../../lib/visualizing-ui';
import { loadError } from './data';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The chapter's ten class colors (the course palette has eight). */
export const TAB10 = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#9c755f', '#76b7b2', '#edc948', '#2f6fd6', '#ff9da7'];

/** The stage inside a margin, below the scene chip. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = Math.max(s.u * 4, s.w * pad);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** A 32 x 32 (or any small) canvas drawn crisp, or a placeholder tile while it is missing. */
export function pic(s: Scene, c: HTMLCanvasElement | null | undefined, x: number, y: number, w: number, h = w, frame: string | null = s.c('--rule')): void {
  const ctx = s.ctx;
  if (c) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x, y, w, h);
    ctx.restore();
  } else s.rrect(x, y, w, h, 0.6, { fill: s.c('--paper-2') });
  if (frame) {
    ctx.strokeStyle = frame;
    ctx.lineWidth = Math.max(1, s.u * 0.22);
    ctx.strokeRect(x, y, w, h);
  }
}

/** A thick colored outline around a picture. */
export function ring(s: Scene, x: number, y: number, w: number, h: number, col: string, lw = 0.6): void {
  const ctx = s.ctx;
  ctx.strokeStyle = col;
  ctx.lineWidth = lw * s.u;
  const d = (lw * s.u) / 2 + 1;
  ctx.strokeRect(x - d, y - d, w + 2 * d, h + 2 * d);
}

/** A caption centered under (or over) a picture. */
export function cap(s: Scene, text: string, x: number, y: number, o: { size?: number; color?: string; weight?: number; font?: 'ui' | 'mono' | 'serif' | 'display'; align?: CanvasTextAlign; italic?: boolean } = {}): void {
  s.text(text, x, y, { size: o.size ?? 3.3, font: o.font ?? 'ui', weight: o.weight ?? 500, color: o.color ?? s.c('--ink-2'), align: o.align ?? 'center', italic: o.italic, halo: true });
}

/** Largest font size (in u) at most `max` for which `text` fits in `width` px. */
export function fit(s: Scene, text: string, width: number, max: number, font: 'ui' | 'mono' | 'serif' | 'display' = 'ui', weight = 500): number {
  const w = s.measure(text, { size: max, font, weight });
  return w <= width ? max : (max * width) / w;
}

/** Text in a rounded, tinted pill. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; on?: number; font?: 'mono' | 'ui' } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { size, font, weight: 600 });
  const pw = tw + s.u * size * 0.9;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  const on = o.on ?? 0;
  s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.c('--card') });
  s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.tint(k, 0.1 + 0.18 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.2 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { size, font, weight: 600, color: s.c(k) });
  return pw;
}

/**
 * Ten horizontal probability bars. `mark` outlines one class (the true one), `mark2` paints one red
 * (a target). Label column and percentages are sized to the box.
 */
export function bars(s: Scene, probs: ArrayLike<number> | null, x: number, y: number, w: number, h: number, o: { mark?: number; mark2?: number; size?: number } = {}): void {
  const rowH = h / 10;
  const size = o.size ?? Math.min(3.3, (rowH / s.u) * 0.74);
  const lw = s.measure('plane', { size, font: 'ui', weight: 600 }) + s.u * 1.5;
  const pw = s.measure('100%', { size: size * 0.92, font: 'mono' }) + s.u * 1.2;
  const bw0 = Math.max(s.u * 4, w - lw - pw);
  for (let k = 0; k < 10; k++) {
    const yy = y + k * rowH;
    const p = probs ? probs[k]! : 0;
    const on = k === o.mark;
    const on2 = k === o.mark2;
    s.text(CIFAR_CLASSES[k]!, x + lw - s.u * 1.2, yy + rowH / 2, { size, font: 'ui', weight: on || on2 ? 650 : 450, color: on2 ? s.c('red') : on ? s.c('--ink') : s.c('--ink-3'), align: 'right' });
    s.rrect(x + lw, yy + rowH * 0.2, bw0, rowH * 0.6, 0.4, { fill: s.tint('--ink-3', 0.08) });
    const bw = bw0 * p;
    if (bw > 0.5) s.rrect(x + lw, yy + rowH * 0.2, Math.max(1, bw), rowH * 0.6, 0.4, { fill: s.tint(on2 ? 'red' : 'purple', on || on2 ? 0.85 : 0.45) });
    if (on) s.rrect(x + lw - 1, yy + rowH * 0.2 - 1, bw0 + 2, rowH * 0.6 + 2, 0.5, { stroke: s.c('--ink-2'), lw: 0.25 });
    if (probs) s.text(`${(p * 100).toFixed(p < 0.095 ? 1 : 0)}%`, x + lw + bw0 + s.u * 0.8, yy + rowH / 2, { size: size * 0.92, font: 'mono', color: s.c('--ink-3'), align: 'left' });
  }
}

/** A yellow receptive-field box over a picture, in the picture's 32-pixel coordinates. */
export function rfBox(s: Scene, x: number, y: number, size: number, box: [number, number, number, number], a = 1): void {
  const [y0, x0, y1, x1] = box;
  const k = size / 32;
  const ctx = s.ctx;
  s.alpha(a, () => {
    ctx.lineWidth = Math.max(2, s.u * 0.7);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeRect(x + x0 * k + 1.5, y + y0 * k + 1.5, (x1 - x0 + 1) * k - 3, (y1 - y0 + 1) * k - 3);
    ctx.lineWidth = Math.max(1.2, s.u * 0.4);
    ctx.strokeStyle = '#ffd400';
    ctx.strokeRect(x + x0 * k + 1.5, y + y0 * k + 1.5, (x1 - x0 + 1) * k - 3, (y1 - y0 + 1) * k - 3);
  });
}

/** A vertical colormap bar with its end values. */
export function colorbar(s: Scene, x: number, y: number, w: number, h: number, lo: string, hi: string, map: 'viridis' | 'inferno' = 'viridis'): void {
  const ctx = s.ctx;
  const f = map === 'viridis' ? viridis : inferno;
  const n = 48;
  for (let i = 0; i < n; i++) {
    const [r, g, b] = f(1 - i / (n - 1));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y + (h * i) / n, w, h / n + 0.6);
  }
  s.text(hi, x + w + s.u, y + s.u * 1.2, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'left' });
  s.text(lo, x + w + s.u, y + h - s.u * 1.2, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'left' });
}

/** What a scene shows while the network is still loading (or failed to). */
export function loading(s: Scene, x = s.w / 2, y = s.h / 2): void {
  const err = loadError();
  s.text(err ? `could not load the network: ${err}` : 'loading the trained network…', x, y, { size: 3.6, italic: true, color: s.c('--ink-3') });
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** Splits the stage into `n` equal pictures in one row (wide) with room for captions; returns x positions and size. */
export function row(s: Scene, n: number, rect: Rect, gapU = 4, capU = 9): { xs: number[]; y: number; size: number } {
  const [rx, ry, rw, rh] = rect;
  const gap = s.u * gapU;
  const size = Math.min((rw - gap * (n - 1)) / n, rh - s.u * capU);
  const x0 = rx + (rw - (size * n + gap * (n - 1))) / 2;
  return { xs: Array.from({ length: n }, (_, i) => x0 + i * (size + gap)), y: ry + (rh - size) / 2 + s.u * capU * 0.35, size };
}
