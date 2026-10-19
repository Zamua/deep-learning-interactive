import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';

export type K = Color | `--${string}`;
type Cell = (i: number, j: number) => number;

/** A matrix of cells with its top-left corner at (x, y). */
export function grid(
  s: Scene,
  x: number,
  y: number,
  cw: number,
  ch: number,
  vals: (string | number)[][],
  k: K | ((i: number, j: number) => K),
  o: { on?: Cell; a?: Cell; size?: number; label?: (i: number, j: number) => string } = {},
): void {
  vals.forEach((row, i) =>
    row.forEach((v, j) => {
      const a = o.a ? o.a(i, j) : 1;
      if (a <= 0.003) return;
      const kk = typeof k === 'function' ? k(i, j) : k;
      s.alpha(a, () => s.cell(x + j * cw, y + i * ch, cw, ch, o.label ? o.label(i, j) : String(v), kk, { on: o.on ? o.on(i, j) : 0, size: o.size }));
    }),
  );
}

/** A cell drawn with a dashed border: a copy that broadcasting only pretends exists. */
export function ghost(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, size?: number): void {
  const c = s.ctx;
  c.save();
  c.setLineDash([s.u * 0.9, s.u * 0.7]);
  s.rrect(x + s.u * 0.3, y + s.u * 0.3, w - s.u * 0.6, h - s.u * 0.6, 1.2, { fill: s.tint(k, 0.05), stroke: s.tint(k, 0.7), lw: 0.3 });
  c.restore();
  if (label) s.text(label, x + w / 2, y + h / 2 + s.u * 0.2, { font: 'mono', size: size ?? Math.min(h, w) / s.u * 0.42, color: s.c('--ink-3') });
}

/** A rounded tag of mono text, e.g. a shape like (3, 4). */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number } = {}): number {
  const size = o.size ?? 3.6;
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** Index labels along the top and left of a grid. */
export function axisLabels(s: Scene, x: number, y: number, cw: number, ch: number, rows: number, cols: number, a = 1, size = 3): void {
  s.alpha(a, () => {
    for (let j = 0; j < cols; j++) s.text(String(j), x + j * cw + cw / 2, y - s.u * 2.6, { font: 'mono', size, color: s.c('--ink-3') });
    for (let i = 0; i < rows; i++) s.text(String(i), x - s.u * 2.4, y + i * ch + ch / 2, { font: 'mono', size, color: s.c('--ink-3') });
  });
}

/** A thick outline around a block of cells. */
export function frame(s: Scene, x: number, y: number, w: number, h: number, k: K, lw = 0.7): void {
  s.rrect(x - s.u * 0.5, y - s.u * 0.5, w + s.u, h + s.u, 1.6, { stroke: s.c(k), lw });
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

/** Text with a flash of accent behind it, for a value that just changed. */
export function flash(s: Scene, x: number, y: number, w: number, h: number, p: number, k: K = '--accent'): void {
  const a = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  if (a > 0.01) s.rrect(x - s.u, y - s.u, w + 2 * s.u, h + 2 * s.u, 2, { fill: s.tint(k, 0.28 * a) });
}

/** A 4 x 4 stand-in photo, sky over grass with a sun and a red car, as 0..255 channel values. */
export const PHOTO: [number, number, number][][] = [
  [[120, 170, 230], [125, 175, 232], [130, 180, 235], [250, 205, 70]],
  [[135, 185, 236], [220, 230, 240], [140, 188, 238], [145, 192, 240]],
  [[90, 160, 70], [210, 60, 50], [205, 65, 55], [95, 165, 75]],
  [[70, 130, 55], [45, 45, 50], [50, 50, 55], [75, 135, 60]],
];
export const rgb = (c: [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Draws a small picture from a grid of colors, `size` px square. */
export function photo(s: Scene, x: number, y: number, size: number, px: [number, number, number][][] = PHOTO): void {
  const n = px.length;
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      s.ctx.fillStyle = rgb(px[i]![j]!);
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.5, cs + 0.5);
    }
  s.rrect(x, y, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
}
