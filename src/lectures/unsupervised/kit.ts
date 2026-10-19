import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, clamp01, lerp } from '../../lecture/scene';

export type K = Color | `--${string}`;
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
  /** Visible data bounds (wider than `dom` on the padded axis of a square frame). */
  get view(): [number, number, number, number] {
    const [rx, ry, rw, rh] = this.rect;
    return [(rx - this.ox) / this.kx, (rx + rw - this.ox) / this.kx, (this.oy - ry - rh) / this.ky, (this.oy - ry) / this.ky];
  }
  grid(step = 1, a = 1): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.view;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.view[0], to = this.view[1], dash?: number[]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 240;
      let pen = false;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const y = f(x);
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
        if (pen) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
        pen = true;
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  /** A polyline through data points. */
  path(xs: ArrayLike<number>, ys: ArrayLike<number>, col: string, width = 0.6): void {
    const c = this.s.ctx;
    c.beginPath();
    for (let i = 0; i < xs.length; i++) {
      if (i) c.lineTo(this.X(xs[i]!), this.Y(ys[i]!));
      else c.moveTo(this.X(xs[i]!), this.Y(ys[i]!));
    }
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
  dot(x: number, y: number, r: number, col: string, ring = false): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, ring ? { fill: col, stroke: this.s.c('--card'), lw: 0.25 } : { fill: col });
  }
}

/** The stage's drawing area inside a margin, leaving room for the scene chip at the top. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = Math.max(s.w * pad, s.u * 4);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Text shrunk (never grown) so it fits `maxW` px. */
export function fit(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  const size = o.size ?? 5;
  const w = s.measure(str, o);
  s.text(str, x, y, { ...o, size: w > maxW ? (size * maxW) / w : size });
}

/** A rounded tag of mono text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A rounded box with a centered label. */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { size?: number; fill?: number; sub?: string; italic?: boolean } = {}): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.c(k), lw: 0.45 });
  const size = o.size ?? Math.min(4.4, (h / s.u) * 0.34);
  const yy = o.sub ? y + h * 0.4 : y + h / 2;
  fit(s, label, x + w / 2, yy, w * 0.9, { size, font: 'mono', weight: 650, color: s.c(k), italic: o.italic });
  if (o.sub) fit(s, o.sub, x + w / 2, y + h * 0.72, w * 0.9, { size: size * 0.72, font: 'ui', color: s.c('--ink-3') });
}

/** A trapezoid from a tall edge to a short one (or back): an encoder or a decoder. */
export function trap(s: Scene, x0: number, h0: number, x1: number, h1: number, cy: number, k: K, label = '', a = 1): void {
  s.alpha(a, () => {
    const c = s.ctx;
    c.beginPath();
    c.moveTo(x0, cy - h0 / 2);
    c.lineTo(x1, cy - h1 / 2);
    c.lineTo(x1, cy + h1 / 2);
    c.lineTo(x0, cy + h0 / 2);
    c.closePath();
    c.fillStyle = s.tint(k, 0.12);
    c.fill();
    c.strokeStyle = s.c(k);
    c.lineWidth = 0.45 * s.u;
    c.lineJoin = 'round';
    c.stroke();
    if (label) fit(s, label, (x0 + x1) / 2, cy, Math.abs(x1 - x0) * 0.92, { size: 3.4, font: 'ui', weight: 600, color: s.c(k) });
  });
}

/** A column of `n` cells, centered at (cx, cy). */
export function column(s: Scene, cx: number, cy: number, cw: number, ch: number, n: number, k: K, label?: (i: number) => string, on = 0): void {
  for (let i = 0; i < n; i++) s.cell(cx - cw / 2, cy - (n * ch) / 2 + i * ch, cw, ch * 0.92, label ? label(i) : '', k, { on });
}

/** The standard normal density. */
export const gauss = (x: number, m = 0, sd = 1): number => Math.exp(-0.5 * ((x - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
export const sigm = (v: number): number => 1 / (1 + Math.exp(-v));

/** A filled bell over a frame's x axis. */
export function bell(fr: Frame, m: number, sd: number, k: K, o: { fill?: number; width?: number; dash?: number[]; scale?: number } = {}): void {
  const s = fr.s;
  const [x0, x1] = fr.view;
  const sc = o.scale ?? 1;
  if ((o.fill ?? 0.2) > 0) {
    const c = s.ctx;
    fr.clip(() => {
      c.beginPath();
      c.moveTo(fr.X(x0), fr.Y(0));
      for (let i = 0; i <= 200; i++) {
        const x = x0 + ((x1 - x0) * i) / 200;
        c.lineTo(fr.X(x), fr.Y(sc * gauss(x, m, sd)));
      }
      c.lineTo(fr.X(x1), fr.Y(0));
      c.closePath();
      c.fillStyle = s.tint(k, o.fill ?? 0.2);
      c.fill();
    });
  }
  fr.fn((x) => sc * gauss(x, m, sd), s.c(k), o.width ?? 0.6, x0, x1, o.dash);
}

/** Runs a stored MLP (each layer: W as out x in row-major, then b) on n inputs. */
export function mlp(sizes: number[], acts: ('tanh' | 'linear')[], w: number[], X: ArrayLike<number>, n: number): Float64Array {
  let a = Float64Array.from(X);
  let p = 0;
  for (let l = 0; l + 1 < sizes.length; l++) {
    const nin = sizes[l]!;
    const nout = sizes[l + 1]!;
    const W = p;
    const b = p + nin * nout;
    p = b + nout;
    const y = new Float64Array(n * nout);
    for (let r = 0; r < n; r++)
      for (let o = 0; o < nout; o++) {
        let v = w[b + o]!;
        for (let i = 0; i < nin; i++) v += w[W + o * nin + i]! * a[r * nin + i]!;
        y[r * nout + o] = acts[l] === 'tanh' ? Math.tanh(v) : v;
      }
    a = y;
  }
  return a;
}

/** Index and blend for a time-like value over sorted snapshot keys. */
export function blend(keys: number[], v: number): [number, number, number] {
  if (v <= keys[0]!) return [0, 0, 0];
  for (let i = 1; i < keys.length; i++) if (v <= keys[i]!) return [i - 1, i, (v - keys[i - 1]!) / (keys[i]! - keys[i - 1]!)];
  const n = keys.length - 1;
  return [n, n, 0];
}

export const lerpArr = (a: number[], b: number[], t: number): number[] => a.map((v, i) => lerp(v, b[i]!, t));

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
  const lw = 0.45 * (r / s.u / 1.9);
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', lw);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', lw);
}

/** A small grayscale picture from values in 0..1 (row-major, n x n), drawn in ink. */
export function pix(s: Scene, x: number, y: number, size: number, n: number, v: (i: number, j: number) => number, k: K = '--ink', o: { frame?: K; lw?: number; lum?: boolean } = {}): void {
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = clamp01(v(i, j));
      if (o.lum) {
        const g = Math.round(lerp(28, 238, a));
        s.ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
      } else {
        if (a < 0.01) continue;
        s.ctx.fillStyle = s.tint(k, 0.06 + 0.9 * a);
      }
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.4, cs + 0.4);
    }
  s.rrect(x, y, size, size, 0.5, { stroke: o.frame ? s.c(o.frame) : s.c('--rule'), lw: o.lw ?? 0.3 });
}

/** An RGB picture from a color function, drawn as an n x n mosaic. */
export function mosaic(s: Scene, x: number, y: number, size: number, n: number, rgb: (i: number, j: number) => [number, number, number], o: { frame?: K; lw?: number } = {}): void {
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const [r, g, b] = rgb(i, j);
      s.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.4, cs + 0.4);
    }
  s.rrect(x, y, size, size, 0.5, { stroke: o.frame ? s.c(o.frame) : s.c('--rule'), lw: o.lw ?? 0.3 });
}

/** A cartoon face: smile in -1..1, hair 0 short to 1 long, glasses 0..1, skin tone 0..1. */
export function face(s: Scene, cx: number, cy: number, r: number, o: { smile?: number; hair?: number; glasses?: number; tone?: number; blur?: number } = {}): void {
  const c = s.ctx;
  const smile = o.smile ?? 0;
  const hair = o.hair ?? 0;
  const tone = o.tone ?? 0.5;
  const g = o.glasses ?? 0;
  const hairCol = 'rgb(80,55,40)';
  c.save();
  if (o.blur) c.filter = `blur(${o.blur}px)`;
  if (hair > 0.02) {
    s.alpha(clamp01(hair * 1.4), () => {
      c.save();
      c.beginPath();
      c.rect(cx - r * 1.2, cy - r * 1.3, r * 2.4, r * (1.3 + 0.55 + 0.35 * hair));
      c.clip();
      c.fillStyle = hairCol;
      c.beginPath();
      c.ellipse(cx, cy - r * 0.05, r * 1.0, r * 1.02, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });
  }
  c.fillStyle = `rgb(${lerp(240, 200, tone) | 0},${lerp(200, 150, tone) | 0},${lerp(170, 115, tone) | 0})`;
  c.beginPath();
  c.ellipse(cx, cy, r * 0.78, r * 0.92, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hairCol;
  c.beginPath();
  c.ellipse(cx, cy - r * 0.62, r * 0.8, r * 0.38, 0, Math.PI, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgb(40,35,35)';
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.arc(cx + sx * r * 0.3, cy - r * 0.08, r * 0.075, 0, Math.PI * 2);
    c.fill();
  }
  if (g > 0.02) {
    s.alpha(g, () => {
      c.strokeStyle = 'rgb(30,30,35)';
      c.lineWidth = Math.max(1, r * 0.07);
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.arc(cx + sx * r * 0.3, cy - r * 0.08, r * 0.2, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(cx - r * 0.1, cy - r * 0.1);
      c.lineTo(cx + r * 0.1, cy - r * 0.1);
      c.stroke();
    });
  }
  c.strokeStyle = 'rgb(120,50,50)';
  c.lineWidth = Math.max(1, r * 0.08);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - r * 0.3, cy + r * 0.38);
  c.quadraticCurveTo(cx, cy + r * 0.38 + smile * r * 0.32, cx + r * 0.3, cy + r * 0.38);
  c.stroke();
  c.restore();
}

/** A pseudo-3-D slab: a w x h front face with `d` of depth going up and right. */
export function slab(s: Scene, x: number, y: number, w: number, h: number, d: number, k: K, a = 1): void {
  const c = s.ctx;
  const dx = d * 0.7;
  const dy = -d * 0.5;
  s.alpha(a, () => {
    c.lineWidth = 0.35 * s.u;
    c.strokeStyle = s.c(k);
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dx, y + dy);
    c.lineTo(x + w + dx, y + dy);
    c.lineTo(x + w, y);
    c.closePath();
    c.fillStyle = s.tint(k, 0.3);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(x + w, y);
    c.lineTo(x + w + dx, y + dy);
    c.lineTo(x + w + dx, y + h + dy);
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fillStyle = s.tint(k, 0.42);
    c.fill();
    c.stroke();
    s.rrect(x, y, w, h, 0.3, { fill: s.tint(k, 0.16), stroke: s.c(k), lw: 0.35 });
  });
}

/** A small made-up photo: sky, ground and an object, varied by seed. */
function photo(seed: number): (i: number, j: number) => [number, number, number] {
  const r = new Rng(seed * 7 + 3);
  const sky: [number, number, number] = [r.uniform(110, 170), r.uniform(150, 200), r.uniform(200, 240)];
  const gnd: [number, number, number] = [r.uniform(60, 130), r.uniform(110, 160), r.uniform(50, 90)];
  const obj: [number, number, number] = [r.uniform(120, 230), r.uniform(40, 140), r.uniform(30, 120)];
  const ci = r.uniform(2.2, 3.4);
  const cj = r.uniform(1.8, 4.2);
  const rad = r.uniform(1.1, 1.8);
  const hz = r.int(2) + 3;
  return (i, j) => ((i - ci) ** 2 + (j - cj) ** 2 < rad * rad ? obj : i >= hz ? gnd : sky);
}
export const PHOTOS = Array.from({ length: 12 }, (_, k) => photo(k));

/** A video frame with a juggler: three balls on a loop whose phase advances with frame k. */
export function juggler(s: Scene, x: number, y: number, fw: number, fh: number, k: number, n: number, a = 1): void {
  s.alpha(a, () => {
    s.rrect(x, y, fw, fh, 0.8, { fill: s.c('--card'), stroke: s.tint('orange', 0.85), lw: 0.35 });
    const cx = x + fw / 2;
    const ink = s.tint('--ink', 0.75);
    const lw = Math.max(0.25, (fh / s.u) * 0.035);
    s.circle(cx, y + fh * 0.5, fh * 0.07, { fill: ink });
    s.line(cx, y + fh * 0.57, cx, y + fh * 0.78, ink, lw);
    s.line(cx, y + fh * 0.78, cx - fw * 0.06, y + fh * 0.93, ink, lw);
    s.line(cx, y + fh * 0.78, cx + fw * 0.06, y + fh * 0.93, ink, lw);
    s.line(cx - fw * 0.13, y + fh * 0.6, cx + fw * 0.13, y + fh * 0.6, ink, lw);
    const cols: Color[] = ['orange', 'red', 'gold'];
    for (let b = 0; b < 3; b++) {
      const ph = (k / n + b / 3) % 1;
      const bx = cx + Math.cos(ph * Math.PI * 2) * fw * 0.15;
      const by = y + fh * 0.42 - Math.max(0, Math.sin(ph * Math.PI * 2)) * fh * 0.3;
      s.circle(bx, by, fh * 0.055, { fill: s.c(cols[b]!) });
    }
  });
}

/** The autoencoder in miniature: wide input, narrow code, wide output. `vae` draws the code as a bell. */
export function aeMini(s: Scene, r: Rect, vae = false): void {
  const [x, y, w, h] = r;
  const cy = y + h / 2;
  const cw = Math.min(w * 0.08, h * 0.2);
  const tall = h * 0.82;
  const nIn = 5;
  const ch = tall / nIn;
  const xs = [x + cw / 2, x + w * 0.42, x + w * 0.58, x + w - cw / 2];
  for (let i = 0; i < nIn; i++) s.cell(xs[0]! - cw / 2, cy - tall / 2 + i * ch, cw, ch * 0.9, '', 'orange');
  trap(s, xs[0]! + cw * 0.7, tall, xs[1]! - cw * 0.2, tall * 0.3, cy, 'slate');
  trap(s, xs[2]! + cw * 0.2, tall * 0.3, xs[3]! - cw * 0.7, tall, cy, 'slate');
  if (vae) {
    const bw = (xs[2]! - xs[1]!) * 1.1;
    const c = s.ctx;
    c.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = -2.6 + (5.2 * i) / 30;
      const px = (xs[1]! + xs[2]!) / 2 + (t / 2.6) * (bw / 2);
      const py = cy + tall * 0.12 - Math.exp(-0.5 * t * t) * tall * 0.3;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.strokeStyle = s.c('teal');
    c.lineWidth = 0.45 * s.u;
    c.stroke();
    s.circle((xs[1]! + xs[2]!) / 2 + bw * 0.12, cy + tall * 0.12, cw * 0.28, { fill: s.c('purple') });
  } else {
    for (let i = 0; i < 2; i++) s.cell((xs[1]! + xs[2]!) / 2 - cw / 2, cy - ch + i * ch, cw, ch * 0.9, '', 'purple', { on: 0.6 });
  }
  for (let i = 0; i < nIn; i++) s.cell(xs[3]! - cw / 2, cy - tall / 2 + i * ch, cw, ch * 0.9, '', 'purple');
}

/** The GAN in miniature: noise into G, a sample, and D's verdict. */
export function ganMini(s: Scene, r: Rect): void {
  const [x, y, w, h] = r;
  const cy = y + h / 2;
  const bh = h * 0.5;
  const zw = Math.min(w * 0.08, h * 0.2);
  for (let i = 0; i < 3; i++) s.cell(x, cy - bh / 2 + (i * bh) / 3, zw, (bh / 3) * 0.9, '', 'purple');
  const g0 = x + w * 0.16;
  box(s, g0, cy - bh / 2, w * 0.18, bh, 'G', 'blue', { size: Math.min(5, (bh / s.u) * 0.5) });
  s.arrow(g0 + w * 0.19, cy, g0 + w * 0.3, cy, s.c('--ink-3'), 0.4, 2);
  const tile = Math.min(bh, w * 0.14);
  mosaic(s, g0 + w * 0.31, cy - tile / 2, tile, 6, PHOTOS[3]!, { frame: 'blue' });
  s.arrow(g0 + w * 0.32 + tile, cy, g0 + w * 0.42 + tile, cy, s.c('--ink-3'), 0.4, 2);
  const d0 = g0 + w * 0.43 + tile;
  const dw = Math.min(w * 0.18, x + w - d0);
  box(s, d0, cy - bh / 2, dw, bh, 'D', 'gold', { size: Math.min(5, (bh / s.u) * 0.5) });
}

