import { CLASS_COLORS, rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import type { Mat } from '../../lib/case-study-np';
import { type Scene, smooth } from '../../lecture/scene';
import type { Model } from './data';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];
type Dom = [number, number, number, number];

const FULL: Dom = [-1.1, 1.1, -1.1, 1.1];
export const classColor = (k: number): Color => CLASS_COLORS[k]!;

/** The top band the scene chip covers for its first seconds. */
export const top = (s: Scene): number => Math.max(s.h * 0.11, s.u * 9);
export const margin = (s: Scene): number => s.u * 4.5;

/** A square map of the data plane (y up) at pixel position (x, y) with side `size`. */
export class Plane {
  constructor(
    readonly s: Scene,
    readonly x: number,
    readonly y: number,
    readonly size: number,
    readonly dom: Dom = FULL,
  ) {}
  X(a: number): number {
    return this.x + ((a - this.dom[0]) / (this.dom[1] - this.dom[0])) * this.size;
  }
  Y(b: number): number {
    return this.y + ((this.dom[3] - b) / (this.dom[3] - this.dom[2])) * this.size;
  }
  /** Pixels per data unit. */
  get k(): number {
    return this.size / (this.dom[1] - this.dom[0]);
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.roundRect(this.x, this.y, this.size, this.size, this.s.u * 1.6);
    c.clip();
    fn();
    c.restore();
  }
  /** Card, light grid every 0.5 and the two axes. */
  card(a = 1): void {
    const s = this.s;
    s.alpha(a, () => {
      s.rrect(this.x, this.y, this.size, this.size, 1.6, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
      this.clip(() => {
        for (let v = -1; v <= 1; v += 0.5) {
          const col = v === 0 ? s.c('--axis') : s.c('--grid');
          s.line(this.X(v), this.y, this.X(v), this.y + this.size, col, v === 0 ? 0.25 : 0.18);
          s.line(this.x, this.Y(v), this.x + this.size, this.Y(v), col, v === 0 ? 0.25 : 0.18);
        }
      });
    });
  }
  /** Dot radius that reads at both stage sizes. */
  get r(): number {
    return Math.max(1.8, this.size * 0.0105);
  }
}

// ---------------------------------------------------------------- regions

const cache = new Map<string, HTMLCanvasElement>();
let scratch: HTMLCanvasElement | null = null;

function paint(cv: HTMLCanvasElement, res: number, dom: Dom, predict: (a: number, b: number) => number, s: Scene): void {
  const cols = [0, 1, 2].map((k) => rgbOf(s.c(classColor(k))));
  const c = cv.getContext('2d')!;
  const img = c.createImageData(res, res);
  for (let i = 0; i < res; i++) {
    const b = dom[3] - ((i + 0.5) / res) * (dom[3] - dom[2]);
    for (let j = 0; j < res; j++) {
      const a = dom[0] + ((j + 0.5) / res) * (dom[1] - dom[0]);
      const [r, g, bl] = cols[predict(a, b)]!;
      const o = 4 * (i * res + j);
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = bl;
      img.data[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
}

/** Region tint strength: a little stronger on a dark card. */
function tintA(s: Scene): number {
  const [r, g, b] = rgbOf(s.c('--card'));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? 0.3 : 0.2;
}

function blit(s: Scene, pl: Plane, cv: HTMLCanvasElement, a: number): void {
  if (a <= 0.003) return;
  pl.clip(() => {
    const c = s.ctx;
    c.save();
    c.globalAlpha *= a * tintA(s);
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, pl.x, pl.y, pl.size, pl.size);
    c.restore();
  });
}

/** Each spot of the plane tinted by the class the model predicts there; cached under `key`. */
export function regions(s: Scene, pl: Plane, key: string, m: Model, a = 1, res = 120): void {
  const ck = `${key}|${res}|${pl.dom.join(',')}|${s.c('blue')}${s.c('orange')}${s.c('green')}`;
  let cv = cache.get(ck);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = res;
    paint(cv, res, pl.dom, (x, y) => m.predict(x, y), s);
    cache.set(ck, cv);
    if (cache.size > 48) cache.delete(cache.keys().next().value!);
  }
  blit(s, pl, cv, a);
}

/** Like `regions`, but recomputed every frame: for a linear model whose weights are moving. */
export function liveRegions(s: Scene, pl: Plane, m: Model, a = 1, res = 72): void {
  if (a <= 0.003) return;
  scratch ??= document.createElement('canvas');
  if (scratch.width !== res) scratch.width = scratch.height = res;
  paint(scratch, res, pl.dom, (x, y) => m.predict(x, y), s);
  blit(s, pl, scratch, a);
}

/** Ink pixels where the predicted class changes: the decision boundary itself. */
export function boundary(s: Scene, pl: Plane, key: string, m: Model, a = 1, res = 260): void {
  if (a <= 0.003) return;
  const ck = `edge|${key}|${res}|${pl.dom.join(',')}|${s.c('--ink')}`;
  let cv = cache.get(ck);
  if (!cv) {
    const dom = pl.dom;
    const cls = new Uint8Array(res * res);
    for (let i = 0; i < res; i++)
      for (let j = 0; j < res; j++)
        cls[i * res + j] = m.predict(dom[0] + ((j + 0.5) / res) * (dom[1] - dom[0]), dom[3] - ((i + 0.5) / res) * (dom[3] - dom[2]));
    cv = document.createElement('canvas');
    cv.width = cv.height = res;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(res, res);
    const [r, g, b] = rgbOf(s.c('--ink'));
    for (let i = 0; i < res - 1; i++)
      for (let j = 0; j < res - 1; j++) {
        const k = cls[i * res + j]!;
        if (k !== cls[i * res + j + 1] || k !== cls[(i + 1) * res + j]) {
          const o = 4 * (i * res + j);
          img.data[o] = r;
          img.data[o + 1] = g;
          img.data[o + 2] = b;
          img.data[o + 3] = 255;
        }
      }
    c.putImageData(img, 0, 0);
    cache.set(ck, cv);
  }
  pl.clip(() => {
    const c = s.ctx;
    c.save();
    c.globalAlpha *= a;
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, pl.x, pl.y, pl.size, pl.size);
    c.restore();
  });
}

// ---------------------------------------------------------------- points

export interface PointOpts {
  a?: number;
  /** Per-point opacity, e.g. to build the arms one point at a time. */
  each?: (i: number) => number;
  /** Ring the points this array marks (misclassified). */
  wrong?: boolean[] | null;
  ring?: number;
  r?: number;
  /** Draw hollow markers instead of filled dots. */
  hollow?: boolean;
}

export function points(s: Scene, pl: Plane, X: Mat, y: ArrayLike<number>, o: PointOpts = {}): void {
  const r = o.r ?? pl.r;
  const ring = o.ring ?? 0;
  s.alpha(o.a ?? 1, () => {
    pl.clip(() => {
      for (let i = 0; i < X.r; i++) {
        const ea = o.each ? o.each(i) : 1;
        if (ea <= 0.003) continue;
        const px = pl.X(X.d[2 * i]!);
        const py = pl.Y(X.d[2 * i + 1]!);
        const k = classColor(y[i]!);
        const bad = !!o.wrong?.[i] && ring > 0;
        s.alpha(ea, () => {
          if (o.hollow) s.circle(px, py, r * 1.05, { fill: s.c('--card'), stroke: s.c(k), lw: 0.38 });
          else s.circle(px, py, r, { fill: s.c(k), stroke: s.tint('--card', 0.85), lw: 0.18 });
          if (bad) s.alpha(ring, () => s.circle(px, py, r + s.u * 0.7, { stroke: s.tint('--ink', 0.7), lw: 0.22 }));
        });
      }
    });
  });
}

// ---------------------------------------------------------------- small parts

/** A rounded tag of mono text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; weight?: number } = {}): number {
  const size = o.size ?? 3.4;
  const tw = s.measure(text, { font: 'mono', size, weight: o.weight ?? 600 });
  const pw = tw + s.u * size * 0.9;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.28 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: o.weight ?? 600, color: s.c(k) });
  return pw;
}

/** A label above a value, for the readouts beside a training plot. */
export function readout(s: Scene, x: number, y: number, label: string, value: string, k: K, o: { size?: number; align?: CanvasTextAlign } = {}): void {
  const size = o.size ?? 5;
  const align = o.align ?? 'left';
  s.text(label, x, y, { size: size * 0.58, font: 'ui', weight: 600, color: s.c('--ink-3'), align });
  s.text(value, x, y + s.u * size * 1.05, { size, font: 'mono', weight: 650, color: s.c(k), align });
}

/** A loss-versus-iteration chart in `r`, drawn up to iteration `it`. */
export function lossChart(s: Scene, r: Rect, vals: number[], every: number, maxIt: number, it: number, o: { yMax?: number; ticks?: number[]; label?: string; a?: number } = {}): void {
  const [x, y, w, h] = r;
  const yMax = o.yMax ?? 1.2;
  const fs = 2.9;
  s.alpha(o.a ?? 1, () => {
    const X = (i: number) => x + (i / maxIt) * w;
    const Y = (v: number) => y + h - (v / yMax) * h;
    for (const v of o.ticks ?? [0.5, 1]) {
      s.line(x, Y(v), x + w, Y(v), s.c('--grid'), 0.2);
      s.text(v.toFixed(1), x - s.u * 1.2, Y(v), { size: fs, font: 'mono', color: s.c('--ink-3'), align: 'right' });
    }
    s.line(x, y, x, y + h, s.c('--axis'), 0.3);
    s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.3);
    s.text('0', x, y + h + s.u * 2.6, { size: fs, font: 'mono', color: s.c('--ink-3') });
    s.text(maxIt.toLocaleString('en-US'), x + w, y + h + s.u * 2.6, { size: fs, font: 'mono', color: s.c('--ink-3'), align: 'right' });
    s.text(o.label ?? 'loss', x + w, y - s.u * 1.6, { size: fs * 1.1, font: 'ui', weight: 650, color: s.c('red'), align: 'right' });
    const n = Math.min(vals.length - 1, Math.floor(it / every));
    if (n < 0) return;
    const c = s.ctx;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const px = X(i * every);
      const py = Y(Math.min(yMax, vals[i]!));
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.strokeStyle = s.c('red');
    c.lineWidth = s.u * 0.45;
    c.lineJoin = 'round';
    c.stroke();
    s.circle(X(n * every), Y(Math.min(yMax, vals[n]!)), s.u * 0.9, { fill: s.c('red') });
  });
}

const STEPS: [string, K][] = [
  ['scores', 'purple'],
  ['loss', 'red'],
  ['gradient', 'teal'],
  ['update', 'blue'],
];

/** The four-step training loop as a ring of nodes, scores at the top, running clockwise. */
export function cycle(s: Scene, cx: number, cy: number, R: number, lit: (k: number) => number, o: { a?: number; center?: string; size?: number } = {}): void {
  const size = o.size ?? 4;
  s.alpha(o.a ?? 1, () => {
    const ang = (k: number) => -Math.PI / 2 + (k * Math.PI) / 2;
    const ctx = s.ctx;
    for (let k = 0; k < 4; k++) {
      const a0 = ang(k) + 0.42;
      const a1 = ang(k + 1) - 0.42;
      const on = Math.max(lit(k), lit((k + 1) % 4) * 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      ctx.strokeStyle = s.tint('--ink-3', 0.35 + 0.5 * on);
      ctx.lineWidth = s.u * (0.35 + 0.2 * on);
      ctx.stroke();
      const hx = cx + R * Math.cos(a1);
      const hy = cy + R * Math.sin(a1);
      const tx = -Math.sin(a1);
      const ty = Math.cos(a1);
      s.arrow(hx - tx * s.u * 2, hy - ty * s.u * 2, hx + tx * s.u * 0.2, hy + ty * s.u * 0.2, s.tint('--ink-3', 0.35 + 0.5 * on), 0.35 + 0.2 * on, 2.4);
    }
    STEPS.forEach(([name, k], i) => {
      const on = lit(i);
      const x = cx + R * Math.cos(ang(i));
      const y = cy + R * Math.sin(ang(i));
      const tw = s.measure(name, { font: 'ui', size, weight: 650 });
      const pw = tw + s.u * size * 1.4;
      const ph = s.u * size * 2;
      s.rrect(x - pw / 2, y - ph / 2, pw, ph, size * 0.9, { fill: s.tint(k, 0.1 + 0.22 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.3 * on });
      s.text(name, x, y + s.u * 0.2, { size, font: 'ui', weight: 650, color: s.c(k) });
    });
    if (o.center) s.text(o.center, cx, cy, { size: size * 0.9, italic: true, color: s.c('--ink-2') });
  });
}

/** A green check or a red cross in a disc. */
export function mark(s: Scene, cx: number, cy: number, r: number, ok: boolean): void {
  s.circle(cx, cy, r, { fill: s.c(ok ? 'green' : 'red') });
  const k = r / (1.9 * s.u);
  if (ok) {
    s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
    s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
  } else {
    const d = r * 0.42;
    s.line(cx - d, cy - d, cx + d, cy + d, '#fff', 0.45 * k);
    s.line(cx - d, cy + d, cx + d, cy - d, '#fff', 0.45 * k);
  }
}

/** Seconds into the scene at which fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => s.at(id) + (s.end(id) - s.at(id)) * f;

/** Eased 0 -> 1 between fractions f0 and f1 of beat `id`. */
export function within(s: Scene, id: string, f0: number, f1: number): number {
  return smooth((s.t - at(s, id, f0)) / Math.max(0.01, at(s, id, f1) - at(s, id, f0)));
}



/** A cached raster of `fn` over the plane: each pixel's [r, g, b, a] (0..255). */
export function field(s: Scene, pl: Plane, key: string, fn: (a: number, b: number) => [number, number, number, number], a = 1, res = 120): void {
  if (a <= 0.003) return;
  const ck = `field|${key}|${res}|${pl.dom.join(',')}`;
  let cv = cache.get(ck);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = res;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(res, res);
    const d = pl.dom;
    for (let i = 0; i < res; i++)
      for (let j = 0; j < res; j++) {
        const px = fn(d[0] + ((j + 0.5) / res) * (d[1] - d[0]), d[3] - ((i + 0.5) / res) * (d[3] - d[2]));
        img.data.set(px, 4 * (i * res + j));
      }
    c.putImageData(img, 0, 0);
    cache.set(ck, cv);
    if (cache.size > 48) cache.delete(cache.keys().next().value!);
  }
  pl.clip(() => {
    const c = s.ctx;
    c.save();
    c.globalAlpha *= a;
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, pl.x, pl.y, pl.size, pl.size);
    c.restore();
  });
}

/** A height function lit from the upper left, so flat facets show as even patches and creases as edges. */
export function hillshade(s: Scene, pl: Plane, key: string, height: (a: number, b: number) => number, k: K, a = 1, res = 140): void {
  const col = rgbOf(s.c(k));
  const base = rgbOf(s.c('--card'));
  const d = pl.dom;
  const e = ((d[1] - d[0]) / res) * 0.5;
  const L = [-0.55, 0.55, 0.63];
  field(
    s,
    pl,
    `${key}|${col.join(',')}|${base.join(',')}`,
    (x, y) => {
      const gx = (height(x + e, y) - height(x - e, y)) / (2 * e);
      const gy = (height(x, y + e) - height(x, y - e)) / (2 * e);
      const n = Math.hypot(gx, gy, 1);
      const lit = (-gx * L[0]! - gy * L[1]! + L[2]!) / n;
      const v = Math.max(0, Math.min(1, 0.5 + 0.5 * lit));
      const t = 0.15 + 0.75 * (1 - v);
      return [base[0] * (1 - t) + col[0] * t, base[1] * (1 - t) + col[1] * t, base[2] * (1 - t) + col[2] * t, 215];
    },
    a,
    res,
  );
}

/** The straight line where first-layer unit (a, b, c) has input exactly zero, clipped to the plane. */
export function unitLine(s: Scene, pl: Plane, a: number, b: number, c: number, col: string, width: number): void {
  const n2 = a * a + b * b;
  if (n2 < 1e-12) return;
  const fx = (-c * a) / n2;
  const fy = (-c * b) / n2;
  const n = Math.sqrt(n2);
  const dx = -b / n;
  const dy = a / n;
  pl.clip(() => s.line(pl.X(fx - dx * 4), pl.Y(fy - dy * 4), pl.X(fx + dx * 4), pl.Y(fy + dy * 4), col, width));
}
