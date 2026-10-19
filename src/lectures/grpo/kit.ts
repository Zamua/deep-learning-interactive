import type { Color } from '../../core/symbols';
import type { Scene, TextOpts } from '../../lecture/scene';
import { ANSWER, CHECK, type Rollout } from '../../lib/grpo-toy';

export type K = Color | `--${string}`;
export const TOKEN_K: K[] = ['blue', 'orange', 'purple'];

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** Largest text size (in u, at most `size`) at which `str` fits in `maxW` px. */
export function fit(s: Scene, str: string, maxW: number, size: number, o: TextOpts = {}): number {
  const w = s.measure(str, { ...o, size });
  return w > maxW ? (size * maxW) / w : size;
}

/** Text shrunk to fit `maxW`. */
export function fitText(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  s.text(str, x, y, { ...o, size: fit(s, str, maxW, o.size ?? 5, o) });
}

/** A disc with a check (reward 1) or a cross (reward 0). */
export function badge(s: Scene, cx: number, cy: number, r: number, ok: boolean): void {
  s.circle(cx, cy, r, { fill: s.c(ok ? 'green' : 'red') });
  const c = s.ctx;
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(1.4, r * 0.28);
  c.lineCap = 'round';
  c.beginPath();
  if (ok) {
    c.moveTo(cx - r * 0.45, cy + r * 0.02);
    c.lineTo(cx - r * 0.1, cy + r * 0.38);
    c.lineTo(cx + r * 0.5, cy - r * 0.35);
  } else {
    c.moveTo(cx - r * 0.38, cy - r * 0.38);
    c.lineTo(cx + r * 0.38, cy + r * 0.38);
    c.moveTo(cx + r * 0.38, cy - r * 0.38);
    c.lineTo(cx - r * 0.38, cy + r * 0.38);
  }
  c.stroke();
}

export function advK(A: number): K {
  return Math.abs(A) < 1e-6 ? '--ink-3' : A > 0 ? 'teal' : 'red';
}

/**
 * One output as token chips, `ch` tall and `cw` wide per token (the answer chip is wider).
 * `tint` washes every chip in the advantage color; `n` limits how many chips are drawn.
 */
export function chips(s: Scene, ro: Rollout, x: number, y: number, cw: number, ch: number, o: { tint?: number; tintA?: number; n?: number; size?: number } = {}): number {
  let cx = x;
  const size = o.size ?? Math.min(3.6, (ch / s.u) * 0.52);
  const n = o.n ?? ro.acts.length;
  ro.acts.forEach((a, t) => {
    if (t >= n) return;
    const label = a === CHECK ? '✓' : ro.shown[t]!;
    const w = a === ANSWER ? Math.max(cw * 1.9, s.measure(label, { font: 'mono', size, weight: 650 }) + s.u * 2) : cw;
    const k = TOKEN_K[a]!;
    const ta = o.tint !== undefined ? (o.tintA ?? 1) : 0;
    const fill = ta > 0 ? s.tint(advK(o.tint!), (0.14 + Math.min(0.32, Math.abs(o.tint!) * 0.2)) * ta + 0.12 * (1 - ta)) : s.tint(k, 0.12);
    s.rrect(cx + s.u * 0.25, y, w - s.u * 0.5, ch, 1, { fill, stroke: s.tint(k, 0.85), lw: a === ANSWER ? 0.4 : 0.25 });
    s.text(label, cx + w / 2, y + ch / 2 + s.u * 0.15, { font: 'mono', size, weight: a === ANSWER ? 650 : 500, color: a === CHECK ? s.c('orange') : s.c('--ink') });
    cx += w;
  });
  return cx - x;
}

/** A rounded box with a title and an optional second line. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: K, title: string, sub = '', o: { on?: number; size?: number; dash?: boolean } = {}): void {
  const on = o.on ?? 0;
  const c = s.ctx;
  if (o.dash) c.setLineDash([s.u * 1.2, s.u * 0.8]);
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.15 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.2 * on });
  c.setLineDash([]);
  const size = o.size ?? 4.2;
  if (sub) {
    fitText(s, title, x + w / 2, y + h * 0.36, w - s.u * 3, { size, font: 'ui', weight: 650 });
    fitText(s, sub, x + w / 2, y + h * 0.7, w - s.u * 3, { size: size * 0.78, font: 'ui', color: s.c('--ink-2') });
  } else fitText(s, title, x + w / 2, y + h / 2, w - s.u * 3, { size, font: 'ui', weight: 650 });
}

/** A rounded tag of text. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: TextOpts['font'] } = {}): number {
  const size = o.size ?? 3.6;
  const font = o.font ?? 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A red diagonal cross over a box: "removed". */
export function strike(s: Scene, x: number, y: number, w: number, h: number, a: number): void {
  if (a <= 0) return;
  s.alpha(a, () => {
    s.line(x + s.u, y + s.u, x + w - s.u, y + h - s.u, s.c('red'), 0.7);
    s.line(x + w - s.u, y + s.u, x + s.u, y + h - s.u, s.c('red'), 0.7);
  });
}

/** Maps a data window onto a pixel rectangle of the stage (y up). */
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
    const [a, b] = this.dom;
    return this.x + ((v - a) / (b - a)) * this.w;
  }
  Y(v: number): number {
    const [, , a, b] = this.dom;
    return this.y + this.h - ((v - a) / (b - a)) * this.h;
  }
  path(xs: number[], ys: number[], col: string, width = 0.6, dash?: number[]): void {
    const c = this.s.ctx;
    if (xs.length < 2) return;
    c.save();
    c.beginPath();
    c.rect(this.x, this.y - this.s.u, this.w, this.h + 2 * this.s.u);
    c.clip();
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(this.X(x), this.Y(ys[i]!)) : c.moveTo(this.X(x), this.Y(ys[i]!))));
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.stroke();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.6, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = from + ((to - from) * i) / 200;
      xs.push(x);
      ys.push(f(x));
    }
    this.path(xs, ys, col, width, dash);
  }
  box(a = 1): void {
    this.s.alpha(a, () => this.s.rrect(this.x, this.y, this.w, this.h, 1, { fill: this.s.tint('--paper', 0.6), stroke: this.s.c('--rule'), lw: 0.25 }));
  }
  hline(v: number, col: string, width = 0.25, dash?: number[]): void {
    this.s.line(this.x, this.Y(v), this.x + this.w, this.Y(v), col, width, dash);
  }
  vline(v: number, col: string, width = 0.25, dash?: number[]): void {
    this.s.line(this.X(v), this.y, this.X(v), this.y + this.h, col, width, dash);
  }
}
