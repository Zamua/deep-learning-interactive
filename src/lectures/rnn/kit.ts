import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { glyph } from '../../lib/rnn-draw';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The stage inside a margin, leaving `top` (a fraction of the height) free. */
export function area(s: Scene, top = 0.12, pad = 5): Rect {
  const m = s.u * pad;
  return [m, Math.max(m, s.h * top), s.w - 2 * m, s.h - Math.max(m, s.h * top) - m];
}

/** One time step's x, h or y: a rounded box with its italic letter. */
export function node(s: Scene, cx: number, cy: number, size: number, letter: string, k: K, o: { on?: number; a?: number; dim?: boolean } = {}): void {
  const on = o.on ?? 0;
  s.alpha(o.a ?? 1, () => {
    s.rrect(cx - size / 2, cy - size / 2, size, size, Math.min(2.2, (size / s.u) * 0.22), {
      fill: s.tint(k, o.dim ? 0.05 : 0.13 + 0.25 * on),
      stroke: s.tint(k, o.dim ? 0.35 : 0.6 + 0.4 * on),
      lw: 0.3 + 0.35 * on,
    });
    if (letter) s.text(letter, cx, cy + size * 0.02, { size: (size / s.u) * 0.48, font: 'serif', italic: true, weight: 600, color: s.tint(k, o.dim ? 0.45 : 1) });
  });
}

/** A rounded tag of text; returns its width. */
export function pill(
  s: Scene,
  text: string,
  x: number,
  y: number,
  k: K,
  o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' | 'serif'; on?: number; ink?: string } = {},
): number {
  const size = o.size ?? 3.6;
  const font = o.font ?? 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.65;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  const on = o.on ?? 0;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, (o.fill ?? 0.12) + 0.25 * on), stroke: on > 0.05 ? s.c('--accent') : s.tint(k, 0.6), lw: 0.3 + 0.3 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: o.ink ?? s.c('--ink') });
  return pw;
}

export function pillWidth(s: Scene, text: string, size = 3.6, font: 'mono' | 'ui' | 'serif' = 'ui'): number {
  return s.measure(text, { font, size, weight: 600 }) + s.u * size * 0.95;
}

export interface BarRow {
  label: string;
  p: number;
  on?: number;
}

/** Horizontal bars, one row per label, with the value as a percent after each bar. */
export function bars(s: Scene, x: number, y: number, w: number, rowH: number, rows: BarRow[], k: K, o: { size?: number; labelW?: number; max?: number; pct?: boolean } = {}): void {
  const size = o.size ?? 3.4;
  const lw = o.labelW ?? s.u * size * 1.6;
  const pctW = s.u * size * 3;
  const bw = w - lw - pctW;
  const max = o.max ?? 1;
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    const on = r.on ?? 0;
    s.text(r.label, x + lw - s.u, yy + rowH / 2, { font: 'mono', size, weight: 600, align: 'right' });
    const len = Math.max(s.u * 0.4, (bw * Math.min(r.p, max)) / max);
    s.rrect(x + lw, yy + rowH * 0.16, len, rowH * 0.68, 0.8, { fill: s.tint(k, 0.3 + 0.5 * Math.sqrt(Math.min(1, r.p))), stroke: on > 0.05 ? s.c('--accent') : undefined, lw: 0.5 * on });
    if (o.pct !== false) {
      const v = r.p * 100;
      s.text(v < 0.5 ? '<1%' : `${v.toFixed(v < 9.95 ? 1 : 0)}%`, x + lw + len + s.u, yy + rowH / 2, { font: 'mono', size: size * 0.85, color: s.c('--ink-2'), align: 'left' });
    }
  });
}

/** Splits text into lines of at most `cols` characters, breaking at newlines (shown as ⏎) unless `inline`. */
function wrap(str: string, cols: number, inline = false): string[] {
  const out: string[] = [];
  let line = '';
  for (const ch of str) {
    if (ch === '\n' && !inline) {
      out.push(`${line}⏎`);
      line = '';
      continue;
    }
    if (line.length >= cols) {
      out.push(line);
      line = '';
    }
    line += ch === '\n' ? '⏎' : ch;
  }
  if (line) out.push(line);
  return out;
}

/**
 * A monospace text block: the first `n` characters of `str`, wrapped, at most `lines` lines.
 * Overflow keeps the newest lines (as a terminal scrolls), or the first ones with `head`.
 */
export function monoBlock(
  s: Scene,
  str: string,
  x: number,
  y: number,
  o: { size: number; cols: number; lines: number; n?: number; color?: string; lh?: number; cursor?: boolean; inline?: boolean; head?: boolean },
): void {
  const shown = str.slice(0, Math.round(o.n ?? str.length));
  let ls = wrap(shown, o.cols, o.inline);
  if (ls.length > o.lines) ls = o.head ? ls.slice(0, o.lines) : ls.slice(ls.length - o.lines);
  const lh = (o.lh ?? 1.45) * o.size * s.u;
  ls.forEach((l, i) => {
    s.text(l, x, y + i * lh, { font: 'mono', size: o.size, align: 'left', base: 'top', color: o.color ?? s.c('--ink'), weight: 450 });
  });
  if (o.cursor && ls.length) {
    const last = ls[ls.length - 1]!;
    const cx = x + s.measure(last, { font: 'mono', size: o.size, weight: 450 }) + s.u * 0.3;
    s.rrect(cx, y + (ls.length - 1) * lh, s.u * o.size * 0.55, o.size * s.u * 1.1, 0.2, { fill: s.c('--accent') });
  }
}

/** Width in characters of a mono block that fits `w` px at `size`. */
export function monoCols(s: Scene, w: number, size: number): number {
  return Math.max(8, Math.floor(w / s.measure('m', { font: 'mono', size, weight: 450 })));
}

/** The largest text size at most `size` that fits `text` within `maxW`. */
export function fitSize(s: Scene, text: string, maxW: number, size: number, font: 'display' | 'serif' | 'mono' | 'ui' = 'display', weight = 560): number {
  const tw = s.measure(text, { font, size, weight });
  return tw > maxW ? (size * maxW) / tw : size;
}

/** Maps a data window onto a stage rectangle (y up). */
export class Frame {
  readonly kx: number;
  readonly ky: number;
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
  axes(a = 1, xStep = 0, yStep = 0): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      if (xStep) for (let x = Math.ceil(x0 / xStep) * xStep; x <= x1 + 1e-9; x += xStep) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      if (yStep) for (let y = Math.ceil(y0 / yStep) * yStep; y <= y1 + 1e-9; y += yStep) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.35);
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.35);
    });
  }
  path(xs: number[], ys: number[], col: string, width = 0.7, dash?: number[]): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(this.rect[0], this.rect[1] - 2, this.rect[2], this.rect[3] + 4);
    c.clip();
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(this.X(x), this.Y(ys[i]!)) : c.moveTo(this.X(x), this.Y(ys[i]!))));
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.stroke();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.7, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = from + ((to - from) * i) / 200;
      xs.push(x);
      ys.push(f(x));
    }
    this.path(xs, ys, col, width, dash);
  }
}

/** A quadratic curve from (x0, y0) to (x1, y1) bending through (cx, cy), with an arrowhead. */
export function bend(s: Scene, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, width = 0.5, dash?: number[], head = 2.4): void {
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.lineCap = 'round';
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
  if (head > 0) {
    const dx = x1 - cx;
    const dy = y1 - cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const hd = head * s.u;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5);
    c.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
}

/** A small weight matrix tile: a blue square with a faint grid and its name. */
export function matTile(s: Scene, cx: number, cy: number, size: number, name: string, o: { on?: number; a?: number; k?: K } = {}): void {
  const on = o.on ?? 0;
  const k = o.k ?? 'blue';
  s.alpha(o.a ?? 1, () => {
    const x = cx - size / 2;
    const y = cy - size / 2;
    s.rrect(x, y, size, size, 0.8, { fill: s.tint(k, 0.1 + 0.2 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.35 * on });
    for (let i = 1; i < 4; i++) {
      s.line(x + (size * i) / 4, y + size * 0.12, x + (size * i) / 4, y + size * 0.88, s.tint(k, 0.18), 0.15);
      s.line(x + size * 0.12, y + (size * i) / 4, x + size * 0.88, y + (size * i) / 4, s.tint(k, 0.18), 0.15);
    }
    if (name) s.text(name, cx, cy + s.u * 0.2, { font: 'mono', size: Math.min(3.6, (size / s.u) * 0.34), weight: 650, color: s.c(k), halo: true });
  });
}

export { glyph };
