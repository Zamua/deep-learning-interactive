import { type Dataset2D, blobs } from '../core/data';
import { type Plot, color, rgbOf } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';

/** 3 classes, 2 inputs: W is 3 x 2, row-major. */
export const K = 3;

/**
 * Mean multiclass SVM loss (margin 1) over `idx` (null: every example) plus reg * sum(W^2).
 * Writes the gradient into `dW` when given.
 */
export function svm(W: ArrayLike<number>, data: Dataset2D, idx: ArrayLike<number> | null, reg: number, dW?: Float64Array): number {
  const n = idx ? idx.length : data.n;
  if (dW) dW.fill(0);
  let L = 0;
  const s = [0, 0, 0];
  for (let t = 0; t < n; t++) {
    const i = idx ? idx[t]! : t;
    const x0 = data.X[2 * i]!;
    const x1 = data.X[2 * i + 1]!;
    const yi = data.y[i]!;
    for (let c = 0; c < K; c++) s[c] = W[2 * c]! * x0 + W[2 * c + 1]! * x1;
    let cnt = 0;
    for (let c = 0; c < K; c++) {
      if (c === yi) continue;
      const m = s[c]! - s[yi]! + 1;
      if (m > 0) {
        L += m;
        cnt++;
        if (dW) {
          dW[2 * c] += x0;
          dW[2 * c + 1] += x1;
        }
      }
    }
    if (dW && cnt) {
      dW[2 * yi] -= cnt * x0;
      dW[2 * yi + 1] -= cnt * x1;
    }
  }
  L /= n;
  if (dW) for (let k = 0; k < 2 * K; k++) dW[k] /= n;
  let R = 0;
  for (let k = 0; k < 2 * K; k++) {
    R += W[k]! * W[k]!;
    if (dW) dW[k] += 2 * reg * W[k]!;
  }
  return L + reg * R;
}

/** Full-batch gradient descent to (near) the minimum. */
export function train(data: Dataset2D, reg: number, steps = 3000, lr = 0.2): Float64Array {
  const W = new Float64Array(2 * K);
  const g = new Float64Array(2 * K);
  for (let i = 0; i < steps; i++) {
    svm(W, data, null, reg, g);
    for (let k = 0; k < 2 * K; k++) W[k] -= lr * g[k]!;
  }
  return W;
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k]! * b[k]!;
  return s;
};

/** A 2-D slice of weight space: W(a, b) = W0 + a W1 + b W2, with W1, W2 unit length and perpendicular. */
export class Slice {
  W1 = new Float64Array(2 * K);
  W2 = new Float64Array(2 * K);
  private tmp = new Float64Array(2 * K);
  private g = new Float64Array(2 * K);

  constructor(readonly data: Dataset2D, readonly W0: Float64Array, seed: number, readonly reg: number) {
    this.reroll(seed);
  }

  reroll(seed: number): void {
    const r = new Rng(seed);
    for (let k = 0; k < 2 * K; k++) {
      this.W1[k] = r.randn();
      this.W2[k] = r.randn();
    }
    const n1 = Math.sqrt(dot(this.W1, this.W1));
    for (let k = 0; k < 2 * K; k++) this.W1[k] /= n1;
    const p = dot(this.W2, this.W1);
    for (let k = 0; k < 2 * K; k++) this.W2[k] -= p * this.W1[k]!;
    const n2 = Math.sqrt(dot(this.W2, this.W2));
    for (let k = 0; k < 2 * K; k++) this.W2[k] /= n2;
  }

  at(a: number, b: number, out = this.tmp): Float64Array {
    for (let k = 0; k < 2 * K; k++) out[k] = this.W0[k]! + a * this.W1[k]! + b * this.W2[k]!;
    return out;
  }

  loss(a: number, b: number, idx: ArrayLike<number> | null = null, reg = this.reg): number {
    return svm(this.at(a, b), this.data, idx, reg);
  }

  /** Loss and its slope along each slice direction: the chain rule gives sum(dW * W1), sum(dW * W2). */
  grad(a: number, b: number, idx: ArrayLike<number> | null = null): { loss: number; ga: number; gb: number } {
    const loss = svm(this.at(a, b), this.data, idx, this.reg, this.g);
    return { loss, ga: dot(this.g, this.W1), gb: dot(this.g, this.W2) };
  }
}

let shared: { data: Dataset2D; W0: Float64Array } | null = null;
/** The chapter's toy problem: 300 points in 3 overlapping blobs, and the regularized SVM optimum. */
export function toyProblem(): { data: Dataset2D; W0: Float64Array; reg: number } {
  shared ??= (() => {
    const data = blobs(100, 3, 0.3, 11);
    return { data, W0: train(data, 0.05) };
  })();
  return { ...shared, reg: 0.05 };
}

/** Line segments of the level set f = level, from values on a (nx+1) x (ny+1) grid, in grid units. */
export function isoSegments(v: Float64Array, nx: number, ny: number, level: number): number[] {
  const out: number[] = [];
  const at = (i: number, j: number) => v[j * (nx + 1) + i]!;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v0 = at(i, j);
      const v1 = at(i + 1, j);
      const v2 = at(i + 1, j + 1);
      const v3 = at(i, j + 1);
      const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const t = (a: number, b: number) => (level - a) / (b - a || 1e-12);
      const e = [
        [i + t(v0, v1), j],
        [i + 1, j + t(v1, v2)],
        [i + 1 - t(v2, v3), j + 1],
        [i, j + 1 - t(v3, v0)],
      ] as const;
      const seg = (p: number, q: number) => out.push(e[p]![0], e[p]![1], e[q]![0], e[q]![1]);
      switch (c) {
        case 1: case 14: seg(3, 0); break;
        case 2: case 13: seg(0, 1); break;
        case 3: case 12: seg(3, 1); break;
        case 4: case 11: seg(1, 2); break;
        case 6: case 9: seg(0, 2); break;
        case 7: case 8: seg(3, 2); break;
        case 5: seg(3, 2); seg(0, 1); break;
        case 10: seg(3, 0); seg(1, 2); break;
      }
    }
  return out;
}

/**
 * A heat map plus contour lines of f over a plot's view, rendered once per size, theme and
 * version and then blitted, so animations can redraw paths on top every frame cheaply.
 */
export class Surface {
  private cache: HTMLCanvasElement | null = null;
  private key = '';
  private version = 0;

  constructor(
    public f: (a: number, b: number) => number,
    public opts: { hue: Color; lo: number; hi: number; levels: number[]; cell?: number; gamma?: number },
  ) {}

  invalidate(): void {
    this.version++;
  }

  draw(pl: Plot): void {
    const key = `${pl.w}x${pl.h}x${pl.dpr}|${color('--paper')}|${pl.domain.join(',')}|${this.version}`;
    if (this.cache && key === this.key) {
      pl.ctx.drawImage(this.cache, 0, 0, pl.w, pl.h);
      return;
    }
    const { hue, lo, hi, levels, cell = 5, gamma = 0.8 } = this.opts;
    const [r, g, b] = rgbOf(color(hue));
    pl.field((x, y) => {
      const t = Math.max(0, Math.min(1, (this.f(x, y) - lo) / (hi - lo)));
      return [r, g, b, Math.round(12 + 200 * t ** gamma)];
    }, cell);
    const [x0, x1, y0, y1] = pl.view();
    const nx = Math.max(24, Math.round(pl.w / 7));
    const ny = Math.max(24, Math.round(pl.h / 7));
    const vals = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) vals[j * (nx + 1) + i] = this.f(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny);
    const c = pl.ctx;
    c.lineWidth = 1;
    c.strokeStyle = color('--ink');
    c.globalAlpha = 0.22;
    c.beginPath();
    for (const lv of levels) {
      const s = isoSegments(vals, nx, ny, lv);
      for (let k = 0; k < s.length; k += 4) {
        c.moveTo(pl.sx(x0 + ((x1 - x0) * s[k]!) / nx), pl.sy(y0 + ((y1 - y0) * s[k + 1]!) / ny));
        c.lineTo(pl.sx(x0 + ((x1 - x0) * s[k + 2]!) / nx), pl.sy(y0 + ((y1 - y0) * s[k + 3]!) / ny));
      }
    }
    c.stroke();
    c.globalAlpha = 1;
    this.cache ??= document.createElement('canvas');
    this.cache.width = pl.canvas.width;
    this.cache.height = pl.canvas.height;
    const cc = this.cache.getContext('2d')!;
    cc.clearRect(0, 0, this.cache.width, this.cache.height);
    cc.drawImage(pl.canvas, 0, 0);
    this.key = key;
  }
}

/** A small line chart with its own margins, ticks and direct labels; data coordinates are plain numbers. */
export function lineChart(
  pl: Plot,
  o: {
    x: [number, number];
    y: [number, number];
    series: { xs: ArrayLike<number>; ys: ArrayLike<number>; color: string; label: string; dash?: number[] }[];
    xTicks: { v: number; s: string }[];
    yTicks: { v: number; s: string }[];
    xLabel: string;
    yLabel: string;
    marks?: { x: number; color: string }[];
  },
): void {
  const c = pl.ctx;
  const m = { l: 40, r: 12, t: 26, b: 33 };
  const W = pl.w - m.l - m.r;
  const H = pl.h - m.t - m.b;
  const X = (v: number) => m.l + ((v - o.x[0]) / (o.x[1] - o.x[0])) * W;
  const Y = (v: number) => m.t + ((o.y[1] - v) / (o.y[1] - o.y[0])) * H;
  const label = (s: string, x: number, y: number, align: CanvasTextAlign, col: string, base: CanvasTextBaseline = 'alphabetic', mono = false) => {
    c.fillStyle = col;
    c.font = `11px ${mono ? "'JetBrains Mono Variable', ui-monospace, monospace" : 'system-ui, sans-serif'}`;
    c.textAlign = align;
    c.textBaseline = base;
    c.fillText(s, x, y);
  };
  c.lineWidth = 1;
  for (const t of o.yTicks) {
    c.strokeStyle = color('--grid');
    c.beginPath();
    c.moveTo(m.l, Math.round(Y(t.v)) + 0.5);
    c.lineTo(m.l + W, Math.round(Y(t.v)) + 0.5);
    c.stroke();
    label(t.s, m.l - 5, Y(t.v), 'right', color('--ink-3'), 'middle', true);
  }
  c.strokeStyle = color('--axis');
  c.beginPath();
  c.moveTo(m.l, m.t + H + 0.5);
  c.lineTo(m.l + W, m.t + H + 0.5);
  c.stroke();
  for (const t of o.xTicks) label(t.s, X(t.v), m.t + H + 15, 'center', color('--ink-3'), 'alphabetic', true);
  label(o.xLabel, m.l + W, pl.h - 2, 'right', color('--ink-3'));
  label(o.yLabel, m.l, 13, 'left', color('--ink-3'));
  for (const mk of o.marks ?? []) {
    c.strokeStyle = mk.color;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(X(mk.x), m.t);
    c.lineTo(X(mk.x), m.t + H);
    c.stroke();
    c.setLineDash([]);
  }
  c.save();
  c.beginPath();
  c.rect(m.l, m.t - 2, W + 2, H + 4);
  c.clip();
  for (const s of o.series) {
    if (s.xs.length < 1) continue;
    c.strokeStyle = s.color;
    c.lineWidth = 2;
    c.setLineDash(s.dash ?? []);
    c.beginPath();
    for (let i = 0; i < s.xs.length; i++) {
      const px = X(s.xs[i]!);
      const py = Y(Math.max(o.y[0] - 1, Math.min(o.y[1] + 1, s.ys[i]!)));
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
    c.setLineDash([]);
  }
  c.restore();
  // direct labels at each series' last point, nudged apart
  const ends = o.series
    .filter((s) => s.xs.length && s.label)
    .map((s) => ({ s, y: Y(Math.max(o.y[0], Math.min(o.y[1], s.ys[s.ys.length - 1]!))), x: X(s.xs[s.xs.length - 1]!) }))
    .sort((a, b) => a.y - b.y);
  const dotY = ends.map((e) => e.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 13) ends[i]!.y = ends[i - 1]!.y + 13;
  const over = ends.length ? ends[ends.length - 1]!.y - (m.t + H - 5) : 0;
  if (over > 0) for (const e of ends) e.y -= over;
  ends.forEach((e, i) => {
    c.beginPath();
    c.arc(e.x, dotY[i]!, 3, 0, Math.PI * 2);
    c.fillStyle = e.s.color;
    c.fill();
    const left = e.x > m.l + W - 44;
    label(e.s.label, e.x + (left ? -7 : 7), Math.max(m.t + 6, e.y), left ? 'right' : 'left', color('--ink-2'), 'middle');
  });
}
