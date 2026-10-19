import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;

const CYCLE: Color[] = ['blue', 'orange', 'green', 'purple', 'teal', 'gold', 'red'];

/** Same rule as the chapter: raw bytes neutral, learned tokens a color fixed by their id. */
export const tokK = (id: number): K => (id < 256 ? '--ink-3' : CYCLE[id % CYCLE.length]!);

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

export interface ChipOpts {
  size?: number;
  sub?: string;
  subK?: K;
  on?: number;
  bad?: boolean;
  ink?: K;
}

export function chipW(s: Scene, label: string, size = 3.4, sub?: string): number {
  const w = s.measure(label, { font: 'mono', size, weight: 560 }) + size * 0.84 * s.u;
  return sub ? Math.max(w, s.measure(sub, { font: 'mono', size: size * 0.8, weight: 500 }) + size * 0.5 * s.u) : w;
}
export const chipH = (s: Scene, size = 3.4, sub = false): number => size * s.u * (sub ? 2.85 : 1.75);

/** A token chip with its top-left corner at (x, y); returns its width. */
export function chip(s: Scene, x: number, y: number, label: string, k: K, o: ChipOpts = {}): number {
  const size = o.size ?? 3.4;
  const w = chipW(s, label, size, o.sub);
  const hh = size * 1.75 * s.u;
  const on = o.on ?? 0;
  const kk: K = o.bad ? 'red' : k;
  s.rrect(x, y, w, hh, size * 0.32, { fill: s.tint(kk, 0.13 + 0.22 * on), stroke: s.tint(kk, 0.5 + 0.5 * on), lw: 0.22 + 0.4 * on });
  s.text(label, x + w / 2, y + hh / 2 + s.u * 0.15, { font: 'mono', size, weight: 560, color: o.bad ? s.c('red') : s.c(o.ink ?? '--ink') });
  if (o.sub !== undefined) s.text(o.sub, x + w / 2, y + hh + size * 0.64 * s.u, { font: 'mono', size: size * 0.8, weight: 500, color: s.c(o.subK ?? '--ink-3') });
  return w;
}

export interface Placed {
  x: number;
  y: number;
  w: number;
}

/** Lays chips out in centered, wrapped lines inside a box `maxW` wide. */
export function flowLayout(s: Scene, labels: string[], cx: number, y0: number, maxW: number, size: number, sub: boolean | string[] = false, gapU = 0.9): { pos: Placed[]; height: number } {
  const gap = gapU * s.u;
  const lineH = chipH(s, size, !!sub) + gap * 1.3;
  const ws = labels.map((l, i) => chipW(s, l, size, Array.isArray(sub) ? sub[i] : undefined));
  const lines: number[][] = [[]];
  let lw = 0;
  ws.forEach((w, i) => {
    const line = lines[lines.length - 1]!;
    if (line.length && lw + gap + w > maxW) {
      lines.push([i]);
      lw = w;
    } else {
      line.push(i);
      lw += (line.length > 1 ? gap : 0) + w;
    }
  });
  const pos: Placed[] = new Array(labels.length);
  lines.forEach((line, li) => {
    const tot = line.reduce((a, i) => a + ws[i]!, 0) + gap * (line.length - 1);
    let x = cx - tot / 2;
    for (const i of line) {
      pos[i] = { x, y: y0 + li * lineH, w: ws[i]! };
      x += ws[i]! + gap;
    }
  });
  return { pos, height: lines.length * lineH - gap * 1.3 };
}

/** A row of `n` cells for a vector; `val` in [-1, 1] sets each cell's strength. */
export function strip(s: Scene, x: number, y: number, cw: number, ch: number, vals: number[], k: K, a = 1): void {
  s.alpha(a, () => {
    vals.forEach((v, i) => {
      s.rrect(x + i * cw + cw * 0.06, y, cw * 0.88, ch, 0.6, { fill: s.tint(k, 0.12 + 0.7 * Math.min(1, Math.abs(v))), stroke: s.tint(k, 0.55), lw: 0.18 });
    });
  });
}

/** A small rounded tag with mono text, centered at (x, y); returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, size = 3.2, align: 'left' | 'center' | 'right' = 'center'): number {
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = align === 'left' ? x : align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.7), lw: 0.28 });
  s.text(text, x0 + pw / 2, y + s.u * 0.12, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** Horizontal bar with a label on the left and a value on the right. */
export function hbar(s: Scene, x: number, y: number, labelW: number, maxW: number, frac: number, label: string, value: string, k: K, o: { size?: number; on?: number; a?: number } = {}): void {
  const size = o.size ?? 3.2;
  const bh = size * 1.25 * s.u;
  s.alpha(o.a ?? 1, () => {
    s.text(label, x + labelW - s.u, y + bh / 2, { font: 'mono', size, align: 'right', color: s.c('--ink') });
    const bw = Math.max(s.u * 0.4, maxW * clamp01(frac));
    s.rrect(x + labelW, y, bw, bh, 0.6, { fill: s.tint(k, 0.35 + 0.4 * (o.on ?? 0)) });
    if (value) s.text(value, x + labelW + bw + s.u * 1.2, y + bh / 2, { font: 'mono', size: size * 0.92, align: 'left', color: s.c('--ink-2') });
  });
}

/** A labelled box, e.g. "transformer". */
export function block(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, size = 3.8, sub?: string): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.35 });
  s.text(label, x + w / 2, y + h / 2 - (sub ? size * 0.45 * s.u : 0), { size, font: 'display', weight: 600, color: s.c(k) });
  if (sub) s.text(sub, x + w / 2, y + h / 2 + size * 0.75 * s.u, { size: size * 0.72, italic: true, color: s.c('--ink-2') });
}

/** Maps a square data window [-R, R]^2 onto a stage rectangle. */
export function squareFrame(rect: [number, number, number, number], R: number): { X(x: number): number; Y(y: number): number; k: number } {
  const [rx, ry, rw, rh] = rect;
  const k = Math.min(rw, rh) / (2 * R);
  const cx = rx + rw / 2, cy = ry + rh / 2;
  return { X: (x) => cx + k * x, Y: (y) => cy - k * y, k };
}

export const human = (n: number): string => (n >= 1e9 ? `${+(n / 1e9).toPrecision(3)}B` : n >= 1e6 ? `${+(n / 1e6).toPrecision(3)}M` : n >= 1e3 ? `${+(n / 1e3).toPrecision(3)}K` : String(n));
