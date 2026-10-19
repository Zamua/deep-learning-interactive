import type { Color } from '../../core/symbols';
import { type Scene, clamp01, lerp } from '../../lecture/scene';

export type K = Color | `--${string}`;

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** True once beat `id` has started. */
export const after = (s: Scene, id: string): boolean => s.since(id) >= 0;

/** The beat playing now, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** A rounded label in stage units; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; on?: number; mono?: boolean; dashed?: boolean } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.mono ? 'mono' : 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 1.1;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  const on = o.on ?? 0;
  if (o.dashed) {
    s.ctx.save();
    s.ctx.setLineDash([s.u * 0.8, s.u * 0.6]);
    s.rrect(x0, y - ph / 2, pw, ph, size * 0.87, { fill: s.tint(k, 0.06 + 0.2 * on), stroke: s.tint(k, 0.8), lw: 0.3 });
    s.ctx.restore();
  } else s.rrect(x0, y - ph / 2, pw, ph, size * 0.87, { fill: s.tint(k, 0.13 + 0.25 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.25 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c('--ink') });
  return pw;
}

export function pillWidth(s: Scene, text: string, size = 3.4, mono = false): number {
  return s.measure(text, { font: mono ? 'mono' : 'ui', size, weight: 600 }) + s.u * size * 1.1;
}

/** A labeled box; `on` 0..1 strengthens it. */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; font?: 'ui' | 'mono' | 'serif' | 'display'; sub?: string } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.1 + 0.25 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.3 * on });
  const size = o.size ?? Math.min(3.6, (h / s.u) * 0.42);
  const fits = s.measure(label, { font: o.font ?? 'ui', size, weight: 600 }) < w - s.u * 2;
  const sz = fits ? size : size * 0.86;
  if (o.sub) {
    s.text(label, x + w / 2, y + h * 0.36, { font: o.font ?? 'ui', size: sz, weight: 600 });
    s.text(o.sub, x + w / 2, y + h * 0.7, { size: sz * 0.82, italic: true, color: s.c('--ink-2') });
  } else s.text(label, x + w / 2, y + h / 2 + s.u * 0.2, { font: o.font ?? 'ui', size: sz, weight: 600 });
}

/** A row of word cells, centered at cx; returns the left edge and cell width. */
export function tokens(s: Scene, words: string[], cx: number, y: number, cw: number, ch: number, k: K, on: (i: number) => number = () => 0, size?: number): { x0: number; cw: number } {
  const gap = s.u * 0.8;
  const tw = words.length * cw + (words.length - 1) * gap;
  const x0 = cx - tw / 2;
  words.forEach((wd, i) => s.cell(x0 + i * (cw + gap), y, cw, ch, '', k, { on: on(i) }));
  words.forEach((wd, i) => s.text(wd, x0 + i * (cw + gap) + cw / 2, y + ch / 2 + s.u * 0.2, { font: 'mono', size: size ?? Math.min(3.6, (cw / s.u) * 0.26), weight: 600 }));
  return { x0, cw: cw + gap };
}

/** A small "photo": a grid of colors drawn at (x, y), `size` px square. */
export function photo(s: Scene, x: number, y: number, size: number, px: string[][], o: { gap?: number; split?: number } = {}): void {
  const n = px.length;
  const g = (o.split ?? 0) * s.u * 1.2;
  const cs = (size - g * (n / 2 - 1)) / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const gx = Math.floor(j / 2) * g;
      const gy = Math.floor(i / 2) * g;
      s.ctx.fillStyle = px[i]![j]!;
      s.ctx.fillRect(x + j * cs + gx, y + i * cs + gy, cs + 0.5, cs + 0.5);
    }
}

/** 8 x 8 stand-in photo: sky, sun, hill, a little house. */
export const PIC: string[][] = (() => {
  const sky = '#8fc3ea';
  const sun = '#f4c84a';
  const hill = '#6fb26a';
  const dark = '#4d8f4c';
  const wall = '#e9dcc0';
  const roof = '#c9553d';
  const door = '#6b4a35';
  const g: string[][] = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i >= 5 ? (i === 7 ? dark : hill) : sky)));
  g[0]![6] = sun;
  g[1]![6] = sun;
  g[0]![7] = sun;
  g[1]![7] = sun;
  g[2]![2] = roof;
  g[2]![3] = roof;
  g[3]![1] = roof;
  g[3]![2] = roof;
  g[3]![3] = roof;
  g[3]![4] = roof;
  g[4]![1] = wall;
  g[4]![2] = wall;
  g[4]![3] = door;
  g[4]![4] = wall;
  g[5]![1] = wall;
  g[5]![2] = wall;
  g[5]![3] = door;
  g[5]![4] = wall;
  return g;
})();

/** Eased fraction of the way through a list of beats, for things that fill one per beat. */
export function stepsDone(s: Scene, ids: string[], dur = 0.6): number {
  return ids.reduce((a, id) => a + clamp01(s.ease(id, dur)), 0);
}

/** A green check in a disc. */
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
  const k = r / (1.9 * s.u);
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.45 * k);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.45 * k);
}

/** Log-axis chart frame: returns mappers from (year, value) to px. */
export function logFrame(s: Scene, x: number, y: number, w: number, h: number, t0: number, t1: number, e0: number, e1: number, ticks: [number, string][], years: number[], a = 1): { X: (t: number) => number; Y: (v: number) => number } {
  const L = s.u * 9;
  const B = s.u * 6;
  const X = (t: number) => x + L + ((t - t0) / (t1 - t0)) * (w - L - s.u * 2);
  const Y = (v: number) => y + (1 - (Math.log10(v) - e0) / (e1 - e0)) * (h - B);
  s.alpha(a, () => {
    for (const [e, lab] of ticks) {
      const yy = y + (1 - (e - e0) / (e1 - e0)) * (h - B);
      s.line(x + L, yy, x + w - s.u * 2, yy, s.c('--grid'), 0.22);
      s.text(lab, x + L - s.u * 1.2, yy, { font: 'mono', size: 2.9, align: 'right', color: s.c('--ink-3') });
    }
    s.line(x + L, y + h - B, x + w - s.u * 2, y + h - B, s.c('--axis'), 0.25);
    for (const yr of years) s.text(String(yr), X(yr + 0.5), y + h - B + s.u * 3.4, { font: 'mono', size: 2.9, color: s.c('--ink-3') });
  });
  return { X, Y };
}
