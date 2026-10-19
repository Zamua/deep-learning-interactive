import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;

/** Stage size in units: the shorter side is 100u, the longer about 100 to 130u. */
export function dims(s: Scene): { u: number; W: number; H: number } {
  return { u: s.u, W: s.w / s.u, H: s.h / s.u };
}

/** The beat currently playing, from a list in script order (null before the first). */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

export function chipWidth(s: Scene, word: string, size: number): number {
  return s.measure(word, { font: 'mono', size, weight: 600 }) + size * s.u * 1.1;
}

export interface ChipOpts {
  size?: number;
  k?: (i: number) => K;
  on?: (i: number) => number;
  a?: (i: number) => number;
  gap?: number;
  minW?: number;
  label?: (i: number) => string;
}

/** A centered row of word chips; returns each chip's center x and width in px. */
export function chipRow(s: Scene, words: string[], cx: number, y: number, o: ChipOpts = {}): { x: number; w: number }[] {
  const size = o.size ?? 3.8;
  const gap = (o.gap ?? 1.4) * s.u;
  const ws = words.map((w) => Math.max((o.minW ?? 0) * s.u, chipWidth(s, w, size)));
  const tot = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let x = cx - tot / 2;
  const hh = size * s.u * 1.9;
  return words.map((w, i) => {
    const cw = ws[i]!;
    const a = o.a ? o.a(i) : 1;
    const k = o.k ? o.k(i) : 'orange';
    const on = o.on ? o.on(i) : 0;
    if (a > 0.003)
      s.alpha(a, () => {
        s.rrect(x, y - hh / 2, cw, hh, size * 0.5, { fill: s.tint(k, 0.1 + 0.22 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.3 * on });
        s.text(o.label ? o.label(i) : w, x + cw / 2, y + s.u * 0.2, { font: 'mono', size, weight: on > 0.5 ? 650 : 500 });
      });
    const r = { x: x + cw / 2, w: cw };
    x += cw + gap;
    return r;
  });
}

export interface Bar {
  label: string;
  v: number;
  k: K;
  on?: number;
  a?: number;
  /** Text after the bar; default is the value as a percentage. */
  note?: string;
  labelK?: K;
}

/** Horizontal bars in a rectangle (px): label on the left, value after the bar. */
export function hbars(s: Scene, x: number, y: number, w: number, h: number, bars: Bar[], vmax: number, o: { size?: number; labelW?: number } = {}): void {
  const n = bars.length;
  const rh = h / n;
  const size = o.size ?? Math.min(3.8, (rh / s.u) * 0.62);
  const lw = (o.labelW ?? 15) * s.u;
  const noteW = size * s.u * 3.6;
  const bw = w - lw - noteW;
  bars.forEach((b, i) => {
    const a = b.a ?? 1;
    if (a <= 0.003) return;
    const yy = y + i * rh;
    const on = b.on ?? 0;
    s.alpha(a, () => {
      s.text(b.label, x + lw - s.u * 1.5, yy + rh / 2, { font: 'mono', size, align: 'right', weight: on > 0.5 ? 650 : 500, color: b.labelK ? s.c(b.labelK) : s.c('--ink') });
      const len = Math.max(s.u * 0.4, (bw * Math.min(b.v, vmax)) / vmax);
      s.rrect(x + lw, yy + rh * 0.18, len, rh * 0.64, 0.8, { fill: s.tint(b.k, 0.35 + 0.45 * on) });
      s.text(b.note ?? pct(b.v), x + lw + len + s.u * 1.2, yy + rh / 2, { font: 'mono', size: size * 0.9, align: 'left', color: s.c('--ink-2') });
    });
  });
}

export function pct(p: number): string {
  if (p >= 0.1) return `${Math.round(p * 100)}%`;
  if (p >= 0.01) return `${(p * 100).toFixed(1)}%`;
  if (p >= 0.001) return `${(p * 100).toFixed(2)}%`;
  return `${(p * 100).toPrecision(1)}%`;
}

export function sci(v: number, digits = 2): string {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e5) return String(Number(v.toPrecision(digits)));
  return v.toExponential(digits - 1).replace('e+', 'e');
}

/** A rounded card with a title line. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: K, on = 0): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.05 + 0.1 * on), stroke: s.tint(k, 0.35 + 0.55 * on), lw: 0.35 + 0.2 * on });
}

/** A five-pointed star. */
export function star(s: Scene, x: number, y: number, r: number, col: string): void {
  const c = s.ctx;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + rr * Math.cos(ang), y + rr * Math.sin(ang));
  }
  c.closePath();
  c.fillStyle = col;
  c.fill();
}

/** A die-face square row: `n` faces (fractional last face), `sz` px each. */
export function faces(s: Scene, x: number, y: number, sz: number, n: number, k: K, a = 1, max = 40, perRow = 12): void {
  const shown = Math.min(n, max);
  for (let i = 0; i < Math.ceil(shown); i++) {
    const fr = Math.min(1, shown - i);
    const ai = clamp01(a * shown - i);
    if (ai <= 0) continue;
    const xx = x + (i % perRow) * sz * 1.18;
    const yy = y + Math.floor(i / perRow) * sz * 1.18;
    s.alpha(ai, () => {
      s.rrect(xx, yy, sz, sz, sz / s.u / 5, { stroke: s.tint(k, 0.7), lw: 0.3 });
      s.rrect(xx, yy, sz * fr, sz, sz / s.u / 5, { fill: s.tint(k, 0.4) });
    });
  }
}

/** Maps a data window onto a pixel rectangle (y up). */
export class Frame {
  constructor(
    readonly s: Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly dom: [number, number, number, number],
  ) {}
  X(v: number): number {
    return this.x + ((v - this.dom[0]) / (this.dom[1] - this.dom[0])) * this.w;
  }
  Y(v: number): number {
    return this.y + this.h - ((v - this.dom[2]) / (this.dom[3] - this.dom[2])) * this.h;
  }
  path(xs: number[], ys: number[], col: string, width = 0.6, upto = xs.length): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(this.x, this.y, this.w, this.h);
    c.clip();
    c.beginPath();
    const n = Math.min(xs.length, Math.max(0, upto));
    for (let i = 0; i < n; i++) {
      if (i) c.lineTo(this.X(xs[i]!), this.Y(ys[i]!));
      else c.moveTo(this.X(xs[i]!), this.Y(ys[i]!));
    }
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.stroke();
    c.restore();
  }
  hline(v: number, col: string, dash = true, width = 0.35): void {
    this.s.line(this.x, this.Y(v), this.x + this.w, this.Y(v), col, width, dash ? [1.6, 1.2] : undefined);
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.3 });
  }
}

/** The largest size up to `size` at which `txt` fits in `maxW` px. */
export function fit(s: Scene, txt: string, maxW: number, size: number, font: 'mono' | 'serif' | 'display' | 'ui' = 'mono', weight?: number): number {
  const m = s.measure(txt, { font, size, weight });
  return m > maxW ? (size * maxW) / m : size;
}
