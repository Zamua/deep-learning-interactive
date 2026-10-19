import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/**
 * Draws text in pieces split between "<" and "|" and between "|" and ">", so the mono font's
 * ligatures cannot turn special tokens like <|im_end|> into arrows.
 */
export function textNL(s: Scene, t: string, x: number, y: number, o: TextOpts = {}): void {
  const segs = t.split(/(?<=<)(?=\|)|(?<=\|)(?=>)/);
  if (segs.length === 1) return s.text(t, x, y, o);
  const ws = segs.map((g) => s.measure(g, o));
  const tot = ws.reduce((a, b) => a + b, 0);
  let x0 = o.align === 'left' ? x : o.align === 'right' ? x - tot : x - tot / 2;
  segs.forEach((g, i) => {
    s.text(g, x0, y, { ...o, align: 'left' });
    x0 += ws[i]!;
  });
}

/** W with a subscript 0, drawn by hand because the serif faces lack a subscript zero. */
export function wsub(s: Scene, x: number, y: number, size: number, col: string, align: 'center' | 'left' = 'center'): void {
  const wW = s.measure('W', { size, italic: true, weight: 600 });
  const w0 = s.measure('0', { size: size * 0.62, weight: 600 });
  const x0 = align === 'center' ? x - (wW + w0) / 2 : x;
  s.text('W', x0, y, { size, italic: true, weight: 600, color: col, align: 'left' });
  s.text('0', x0 + wW + s.u * 0.1, y + size * s.u * 0.26, { size: size * 0.62, weight: 600, color: col, align: 'left' });
}

export interface ChipOpts {
  size?: number;
  /** Small text under the chip (a mask value, an id). */
  sub?: string;
  subK?: K;
  /** 0..1 emphasis. */
  on?: number;
  /** Special token: dashed border, purple text. */
  sp?: boolean;
  ink?: K;
  fill?: number;
  /** Draw `sub` as a small badge on the chip's corner instead of a line under it. */
  badge?: boolean;
}

export function chipW(s: Scene, label: string, size = 3.4): number {
  return s.measure(label, { font: 'mono', size, weight: 560 }) + size * 0.8 * s.u;
}
export const chipH = (s: Scene, size = 3.4, sub = false): number => size * s.u * (sub ? 2.8 : 1.7);

/** A token chip with its top-left corner at (x, y); returns its width. */
export function chip(s: Scene, x: number, y: number, label: string, k: K, o: ChipOpts = {}): number {
  const size = o.size ?? 3.4;
  const w = chipW(s, label, size);
  const under = o.sub !== undefined && !o.badge;
  const hh = chipH(s, size, under);
  const on = o.on ?? 0;
  const c = s.ctx;
  c.save();
  if (o.sp) c.setLineDash([s.u * 0.6, s.u * 0.45]);
  s.rrect(x, y, w, hh, size * 0.3, { fill: s.tint(k, (o.fill ?? 0.1) + 0.24 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.22 + 0.3 * on });
  c.restore();
  const ty = under ? y + size * s.u * 0.88 : y + hh / 2 + s.u * 0.15;
  textNL(s, label, x + w / 2, ty, { font: 'mono', size, weight: 560, color: s.c(o.ink ?? (o.sp ? 'purple' : '--ink')) });
  if (under) s.text(o.sub!, x + w / 2, y + hh - size * s.u * 0.62, { font: 'mono', size: size * 0.78, weight: 650, color: s.c(o.subK ?? '--ink-3') });
  else if (o.sub) {
    const bs = size * 0.74;
    const bw = s.measure(o.sub, { font: 'mono', size: bs, weight: 700 }) + bs * 0.5 * s.u;
    const bh = bs * s.u * 1.15;
    s.rrect(x + w - bw * 0.7, y + hh - bh * 0.55, bw, bh, bs * 0.3, { fill: s.c('--card'), stroke: s.c(o.subK ?? '--ink-3'), lw: 0.18 });
    s.text(o.sub, x + w - bw * 0.7 + bw / 2, y + hh - bh * 0.55 + bh / 2 + s.u * 0.1, { font: 'mono', size: bs, weight: 700, color: s.c(o.subK ?? '--ink-3') });
  }
  return w;
}

export interface Placed {
  x: number;
  y: number;
  w: number;
  line: number;
}

/**
 * Lays chips out left to right inside `maxW`, wrapping lines; `breaks` forces a new line before
 * an index. Returns positions relative to (x0, y0) and the total height.
 */
export function flowLayout(s: Scene, labels: string[], x0: number, y0: number, maxW: number, size: number, o: { sub?: boolean; gapU?: number; breaks?: Set<number>; center?: boolean } = {}): { pos: Placed[]; height: number; lines: number } {
  const gap = (o.gapU ?? 0.8) * s.u;
  const lineH = chipH(s, size, !!o.sub) + gap * 1.2;
  const ws = labels.map((l) => chipW(s, l, size));
  const lines: number[][] = [[]];
  let lw = 0;
  ws.forEach((w, i) => {
    const line = lines[lines.length - 1]!;
    if (line.length && (lw + gap + w > maxW || o.breaks?.has(i))) {
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
    let x = o.center ? x0 + (maxW - tot) / 2 : x0;
    for (const i of line) {
      pos[i] = { x, y: y0 + li * lineH, w: ws[i]!, line: li };
      x += ws[i]! + gap;
    }
  });
  return { pos, height: lines.length * lineH - gap * 1.2, lines: lines.length };
}

/** Largest chip size (stage units) at which the labels fit in a w x h box. */
export function fitSize(s: Scene, labels: string[], w: number, h: number, max: number, min: number, o: { sub?: boolean; breaks?: Set<number>; gapU?: number } = {}): number {
  for (let size = max; size > min; size -= 0.2) {
    if (flowLayout(s, labels, 0, 0, w, size, o).height <= h) return size;
  }
  return min;
}

/** A signed matrix as a grid of cells: teal for positive, purple for negative. */
export function heat(s: Scene, a: ArrayLike<number>, n: number, m: number, x: number, y: number, size: number, scale: number, o: { gray?: boolean; alpha?: number; height?: number } = {}): void {
  const c = s.ctx;
  const cs = size / m;
  const chh = o.height !== undefined ? o.height / n : cs;
  const pos = s.c('teal'), neg = s.c('purple');
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  c.fillStyle = s.c('--card');
  c.fillRect(x, y, size, chh * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const v = a[i * m + j]!;
      if (o.gray) {
        const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
        c.fillStyle = `rgb(${g},${g},${g})`;
        c.globalAlpha = o.alpha ?? 1;
      } else {
        const t = Math.max(-1, Math.min(1, v / scale));
        c.fillStyle = t >= 0 ? pos : neg;
        c.globalAlpha = (o.alpha ?? 1) * Math.abs(t) ** 0.8;
      }
      c.fillRect(x + j * cs, y + i * chh, cs + 0.4, chh + 0.4);
    }
  c.restore();
  s.rrect(x, y, size, chh * n, 0.3, { stroke: s.c('--rule'), lw: 0.25 });
}

/** A rounded box with a title on top, for a labelled stage region. */
export function box(s: Scene, x: number, y: number, w: number, h: number, k: K, o: { fill?: number; lw?: number; dash?: boolean } = {}): void {
  const c = s.ctx;
  c.save();
  if (o.dash) c.setLineDash([s.u, s.u * 0.8]);
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, o.fill ?? 0.08), stroke: s.tint(k, 0.6), lw: o.lw ?? 0.35 });
  c.restore();
}

/** A simple line chart frame: returns data-to-pixel mappers. */
export function frame(s: Scene, x: number, y: number, w: number, h: number, x1: number, y0: number, y1: number, o: { log?: boolean; grid?: number[]; labels?: string[]; xs?: number[] } = {}) {
  const X = (v: number) => x + (w * v) / x1;
  const Y = (v: number) => y + h - (h * (Math.max(y0, Math.min(y1, v)) - y0)) / (y1 - y0);
  s.rrect(x, y, w, h, 1, { fill: s.tint('--paper', 0.5), stroke: s.c('--rule'), lw: 0.25 });
  (o.grid ?? []).forEach((g, i) => {
    s.line(x, Y(g), x + w, Y(g), s.c('--grid'), 0.2);
    const lab = o.labels?.[i];
    if (lab) s.text(lab, x + s.u * 1, Y(g) - s.u * 1.6, { font: 'mono', size: 2.8, align: 'left', color: s.c('--ink-3') });
  });
  (o.xs ?? []).forEach((v) => {
    s.line(X(v), y, X(v), y + h, s.c('--grid'), 0.2);
    s.text(String(v), X(v) - s.u * 0.8, y + h - s.u * 1.8, { font: 'mono', size: 2.8, align: 'right', color: s.c('--ink-3') });
  });
  return { X, Y };
}

/** A polyline through points, clipped to the first `upto` x-units. */
export function path(s: Scene, pts: [number, number][], X: (v: number) => number, Y: (v: number) => number, col: string, width = 0.6, upto = Infinity, dash?: number[]): void {
  const c = s.ctx;
  c.beginPath();
  let started = false;
  for (const [a, b] of pts) {
    if (a > upto) break;
    if (started) c.lineTo(X(a), Y(b));
    else {
      c.moveTo(X(a), Y(b));
      started = true;
    }
  }
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.lineJoin = 'round';
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

/** Text that types itself out as `p` goes 0 -> 1. */
export function typed(str: string, p: number): string {
  return str.slice(0, Math.round(str.length * clamp01(p)));
}

/** A labelled legend swatch; returns the x after it. */
export function swatch(s: Scene, x: number, y: number, label: string, k: K, size = 3): number {
  s.rrect(x, y - size * s.u * 0.35, size * s.u * 0.7, size * s.u * 0.7, 0.4, { fill: s.c(k) });
  s.text(label, x + size * s.u, y, { font: 'ui', size, align: 'left', color: s.c('--ink-2') });
  return x + size * s.u * 1.6 + s.measure(label, { font: 'ui', size });
}
