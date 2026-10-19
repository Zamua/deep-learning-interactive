import type { Dataset2D } from '../../core/data';
import type { MLP } from '../../core/nn';
import { CLASS_COLORS, color, rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import type { Scene, TextOpts } from '../../lecture/scene';

export type Rect = [number, number, number, number];

/** Maps a data window onto a pixel rectangle of the stage (y up). */
export class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
    square = false,
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    let kx = rw / (x1 - x0);
    let ky = rh / (y1 - y0);
    if (square) kx = ky = Math.min(kx, ky);
    this.kx = kx;
    this.ky = ky;
    this.ox = rx + (rw - kx * (x1 - x0)) / 2 - kx * x0;
    this.oy = ry + (rh - ky * (y1 - y0)) / 2 + ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  /** The data window's pixel rectangle. */
  get box(): Rect {
    const [x0, x1, y0, y1] = this.dom;
    return [this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1)];
  }
  grid(step = 1, a = 1, axes = true): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
      if (!axes) return;
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.35);
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.35);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.box);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 300;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  /** Fills between y = f(x) and y = 0. */
  area(f: (x: number) => number, fill: string, from = this.dom[0], to = this.dom[1]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      c.moveTo(this.X(from), this.Y(0));
      const n = 240;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        c.lineTo(this.X(x), this.Y(f(x)));
      }
      c.lineTo(this.X(to), this.Y(0));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    });
  }
  seg(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.5, dash?: number[]): void {
    this.s.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, dash);
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.8, head = 3): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  dot(x: number, y: number, r: number, col: string, ring?: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: ring ?? this.s.c('--card'), lw: ring ? 0.45 : 0.3 });
  }
  /** Stretches an offscreen image over the whole data window. */
  image(img: CanvasImageSource): void {
    const c = this.s.ctx;
    const [x, y, w, h] = this.box;
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(img, x, y, w, h);
    c.restore();
  }
}

/** The stage inside a margin of `m` stage units, leaving the top `top` fraction for the scene chip. */
export function area(s: Scene, top = 0.13, m = 5): Rect {
  return [s.u * m, s.h * top, s.w - 2 * s.u * m, s.h * (1 - top) - s.u * m];
}

/** A square panel on the left, with whatever width is left over as a side column. */
export function split(s: Scene, top = 0.13, m = 5, frac = 1): { panel: Rect; side: Rect } {
  const [x, y, w, h] = area(s, top, m);
  const side = Math.min(h, w * 0.62) * frac;
  const sw = Math.min(w - side - s.u * 4, s.u * 56);
  const x0 = x + (w - (side + s.u * 4 + sw)) / 2;
  return { panel: [x0, y + (h - side) / 2, side, side], side: [x0 + side + s.u * 4, y, sw, h] };
}

// ---------------------------------------------------------------- decision regions

const RES = 110;
const grids = new WeakMap<MLP, Uint8Array>();
const images = new WeakMap<MLP, { key: string; cv: HTMLCanvasElement }>();

/** The net's predicted class on a RES x RES grid over `dom`, computed once per net. */
function classGrid(net: MLP, dom: [number, number, number, number]): Uint8Array {
  let g = grids.get(net);
  if (g) return g;
  g = new Uint8Array(RES * RES);
  const [x0, x1, y0, y1] = dom;
  const p = [0, 0];
  for (let j = 0; j < RES; j++)
    for (let i = 0; i < RES; i++) {
      p[0] = x0 + ((i + 0.5) * (x1 - x0)) / RES;
      p[1] = y1 - ((j + 0.5) * (y1 - y0)) / RES;
      g[j * RES + i] = net.predict(p);
    }
  grids.set(net, g);
  return g;
}

/** Decision regions as an image, rebuilt only when the theme's class colors change. */
export function regionImage(net: MLP, dom: [number, number, number, number], classes: number, alpha = 0.2): HTMLCanvasElement {
  const cols = CLASS_COLORS.slice(0, classes).map((c) => color(c));
  const key = `${cols.join()}|${alpha}`;
  const hit = images.get(net);
  if (hit && hit.key === key) return hit.cv;
  const g = classGrid(net, dom);
  const cv = document.createElement('canvas');
  cv.width = cv.height = RES;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(RES, RES);
  const rgb = cols.map((c) => rgbOf(c));
  for (let k = 0; k < RES * RES; k++) {
    const [r, gg, b] = rgb[g[k]!]!;
    img.data[4 * k] = r;
    img.data[4 * k + 1] = gg;
    img.data[4 * k + 2] = b;
    img.data[4 * k + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(img, 0, 0);
  images.set(net, { key, cv });
  return cv;
}

/** A dataset's points in class colors; `ring` marks some with a dark outline. */
export function points(fr: Frame, d: Dataset2D, o: { r?: number; ring?: (i: number) => boolean; alpha?: number } = {}): void {
  const s = fr.s;
  s.alpha(o.alpha ?? 1, () => {
    for (let i = 0; i < d.n; i++) {
      const ring = o.ring?.(i);
      fr.dot(d.X[2 * i]!, d.X[2 * i + 1]!, (o.r ?? 1) * (ring ? 1.15 : 1), s.c(CLASS_COLORS[d.y[i]!]!), ring ? s.c('--ink') : undefined);
    }
  });
}

/** A small rounded card with a translucent paper fill, for labels that sit over a picture. */
export function card(s: Scene, x: number, y: number, w: number, h: number, a = 0.9): void {
  s.rrect(x, y, w, h, 1.6, { fill: s.tint('--card', a), stroke: s.c('--rule'), lw: 0.25 });
}

// ---------------------------------------------------------------- network diagrams

export interface NetGeom {
  colX: (l: number) => number;
  ny: (l: number, i: number) => number;
  r: number;
}

export function netGeom(rect: Rect, sizes: number[], u: number, rMax = 4.2): NetGeom {
  const [x, y, w, h] = rect;
  const L = sizes.length;
  const maxN = Math.max(...sizes);
  const gap = Math.min(h / maxN, u * 16);
  const r = Math.min(rMax * u, gap * 0.3, (w / L) * 0.18);
  const colX = (l: number) => (L === 1 ? x + w / 2 : x + r + (l * (w - 2 * r)) / (L - 1));
  const ny = (l: number, i: number) => y + h / 2 + (i - (sizes[l]! - 1) / 2) * gap;
  return { colX, ny, r };
}

export const ROLE: (l: number, L: number) => Color = (l, L) => (l === 0 ? 'orange' : l === L - 1 ? 'purple' : 'gold');

export interface NetOpts {
  /** Weights per layer ([out][in]) for blue/red wires whose width follows |w|. */
  W?: number[][][];
  /** Opacity of the wire from neuron j of layer l - 1 to neuron i of layer l. */
  wire?: (l: number, i: number, j: number) => number;
  /** Fill strength 0..1 of neuron i in layer l (an activation, or a highlight). */
  fill?: (l: number, i: number) => number;
  /** Opacity of a whole column (layer l), wires into it included. */
  col?: (l: number) => number;
  rMax?: number;
}

/** A fully connected net: columns of neurons, adjacent columns wired, inputs orange, hidden gold, outputs purple. */
export function drawNet(s: Scene, rect: Rect, sizes: number[], o: NetOpts = {}): NetGeom {
  const g = netGeom(rect, sizes, s.u, o.rMax);
  const L = sizes.length;
  let wmax = 1e-9;
  if (o.W) for (const M of o.W) for (const row of M) for (const v of row) wmax = Math.max(wmax, Math.abs(v));
  for (let l = 1; l < L; l++) {
    const ca = Math.min(o.col?.(l) ?? 1, o.col?.(l - 1) ?? 1);
    for (let i = 0; i < sizes[l]!; i++)
      for (let j = 0; j < sizes[l - 1]!; j++) {
        const a = ca * (o.wire?.(l, i, j) ?? 1);
        if (a <= 0.01) continue;
        const x0 = g.colX(l - 1) + g.r;
        const x1 = g.colX(l) - g.r;
        if (o.W) {
          const v = o.W[l - 1]![i]![j]!;
          s.line(x0, g.ny(l - 1, j), x1, g.ny(l, i), s.tint(v >= 0 ? 'blue' : 'red', 0.8 * a), 0.12 + 0.75 * (Math.abs(v) / wmax));
        } else s.line(x0, g.ny(l - 1, j), x1, g.ny(l, i), s.tint('--ink-3', 0.6 * a), 0.25);
      }
  }
  for (let l = 0; l < L; l++) {
    const ca = o.col?.(l) ?? 1;
    if (ca <= 0.01) continue;
    const k = ROLE(l, L);
    for (let i = 0; i < sizes[l]!; i++) {
      const f = o.fill?.(l, i) ?? 0;
      s.alpha(ca, () => s.circle(g.colX(l), g.ny(l, i), g.r, { fill: f > 0 ? s.tint(k, 0.12 + 0.7 * Math.min(1, f)) : s.c('--card'), stroke: s.c(k), lw: 0.4 + 0.25 * Math.min(1, f) }));
    }
  }
  return g;
}

// ---------------------------------------------------------------- small glyphs

/** A horse in profile, facing right when `dir` is 1 and left when -1, filling a w x 0.8w box at (x, y). */
export function horse(s: Scene, x: number, y: number, w: number, dir: 1 | -1, fill: string): void {
  const P: [number, number][] = [
    [12, 30], [30, 26], [50, 27], [62, 23], [70, 13], [77, 5], [79, 0], [82, 5], [95, 17], [96, 23], [87, 24], [79, 22],
    [73, 32], [71, 43], [72, 51], [74, 76], [69, 77], [66, 53], [62, 53], [61, 76], [56, 77], [54, 53], [36, 54],
    [33, 76], [28, 77], [26, 57], [23, 76], [18, 77], [17, 53], [13, 45],
  ];
  const k = w / 100;
  const X = (px: number) => (dir === 1 ? x + px * k : x + w - px * k);
  const c = s.ctx;
  c.beginPath();
  P.forEach(([px, py], i) => (i ? c.lineTo(X(px), y + py * k) : c.moveTo(X(px), y + py * k)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.beginPath();
  c.moveTo(X(13), y + 31 * k);
  c.quadraticCurveTo(X(3), y + 40 * k, X(5), y + 62 * k);
  c.strokeStyle = fill;
  c.lineWidth = 3.2 * k;
  c.lineCap = 'round';
  c.stroke();
}

/** An 8 x 8 stand-in photo (sky, a hill, a brown animal), deterministic. */
export function pixelImage(s: Scene, x: number, y: number, size: number): void {
  const n = 8;
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let c: [number, number, number];
      if (i >= 3 && i <= 5 && j >= 2 && j <= 5) c = [140 - 6 * j, 90 - 4 * i, 55];
      else if (i === 6 && (j === 2 || j === 5)) c = [90, 60, 40];
      else if (i >= 6 - (j % 4 === 0 ? 1 : 0)) c = [80 + 7 * j, 145 - 5 * i, 70];
      else c = [120 + 6 * i, 170 + 5 * i, 230 - 3 * j];
      s.ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.5, cs + 0.5);
    }
  s.rrect(x, y, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
}

export function check(s: Scene, cx: number, cy: number, r: number, k: Color): void {
  s.circle(cx, cy, r, { fill: s.c(k) });
  const q = r / s.u;
  s.line(cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.38, '#fff', q * 0.24);
  s.line(cx - r * 0.1, cy + r * 0.38, cx + r * 0.5, cy - r * 0.36, '#fff', q * 0.24);
}

export function cross(s: Scene, cx: number, cy: number, r: number, k: Color): void {
  s.circle(cx, cy, r, { fill: s.c(k) });
  const q = r / s.u;
  const d = r * 0.38;
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', q * 0.24);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', q * 0.24);
}

/** A bar for a signed value: rightward from x0 when positive, leftward when negative. */
export function hbar(s: Scene, x0: number, y: number, len: number, hgt: number, k: Color | `--${string}`, a = 0.75): void {
  if (Math.abs(len) < 0.3) return;
  s.rrect(len >= 0 ? x0 : x0 + len, y - hgt / 2, Math.abs(len), hgt, 0.5, { fill: s.tint(k, a) });
}

/** Draws `str` at size `o.size`, shrunk if needed so it is at most `maxW` px wide. */
export function fit(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  const size = o.size ?? 5;
  const wd = s.measure(str, { ...o, size });
  s.text(str, x, y, { ...o, size: wd > maxW ? (size * maxW) / wd : size });
}

/** Text runs with their own colors, `sub` ones drawn smaller and lower, e.g. w₀x₀ with real subscripts. */
export function runs(s: Scene, parts: { t: string; color?: string; sub?: boolean }[], x: number, y: number, o: TextOpts & { align?: 'left' | 'right' | 'center' } = {}): void {
  const size = o.size ?? 5;
  const opt = (p: { sub?: boolean }) => ({ ...o, size: p.sub ? size * 0.66 : size, align: 'left' as CanvasTextAlign, halo: false });
  const widths = parts.map((p) => s.measure(p.t, opt(p)) + (p.sub ? size * s.u * 0.08 : 0));
  const total = widths.reduce((a, b) => a + b, 0);
  const x0 = o.align === 'right' ? x - total : o.align === 'center' ? x - total / 2 : x;
  // Halos first, so a glyph's outline never covers its neighbor.
  for (const pass of o.halo ? [0, 1] : [1]) {
    let cx = x0;
    parts.forEach((p, i) => {
      const py = y + (p.sub ? size * s.u * 0.3 : 0);
      if (pass === 0) s.text(p.t, cx, py, { ...opt(p), halo: true, color: s.c('--card') });
      else s.text(p.t, cx, py, { ...opt(p), color: p.color ?? o.color });
      cx += widths[i]!;
    });
  }
}
