import { color, rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { isoSegments } from '../../lib/optimization-svm';
import type { Scene } from '../../lecture/scene';

export type Rect = [number, number, number, number];
type Tok = Color | `--${string}`;

/** The stage inside a comfortable margin, leaving room for the scene chip at the top. */
export function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = Math.min(s.w, s.h) * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

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
  /** The pixel rectangle the data window occupies. */
  get box(): Rect {
    const [x0, x1, y0, y1] = this.dom;
    return [this.X(x0), this.Y(y1), this.kx * (x1 - x0), this.ky * (y1 - y0)];
  }
  clip(fn: () => void, r: Rect = this.box): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...r);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 240;
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
  poly(pts: [number, number][], col: string, width = 0.6): void {
    if (pts.length < 2) return;
    const c = this.s.ctx;
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const px = Math.max(-1e4, Math.min(1e4, this.X(x)));
      const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    });
    c.strokeStyle = col;
    c.lineWidth = width * this.s.u;
    c.lineJoin = 'round';
    c.stroke();
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.8, head = 3.2): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  dot(x: number, y: number, r: number, col: string, ring = true): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: ring ? this.s.c('--card') : undefined, lw: 0.35 });
  }
  axes(a = 1): void {
    const s = this.s;
    const [bx, by, bw, bh] = this.box;
    s.alpha(a, () => {
      s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.35);
      s.line(bx, by, bx, by + bh, s.c('--axis'), 0.35);
    });
  }
}

const mix = (a: [number, number, number], b: [number, number, number], t: number, k = 1): string =>
  `rgb(${Math.round((a[0] + (b[0] - a[0]) * t) * k)},${Math.round((a[1] + (b[1] - a[1]) * t) * k)},${Math.round((a[2] + (b[2] - a[2]) * t) * k)})`;

/** A function of two variables sampled once on a grid over `dom`, with its range. */
export class Field {
  readonly vals: Float64Array;
  lo = Infinity;
  hi = -Infinity;
  private segCache = new Map<number, number[]>();
  constructor(
    f: (a: number, b: number) => number,
    readonly dom: [number, number, number, number],
    readonly nx: number,
    readonly ny: number,
  ) {
    this.vals = new Float64Array((nx + 1) * (ny + 1));
    const [x0, x1, y0, y1] = dom;
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const v = f(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny);
        this.vals[j * (nx + 1) + i] = v;
        if (v < this.lo) this.lo = v;
        if (v > this.hi) this.hi = v;
      }
  }
  at(i: number, j: number): number {
    return this.vals[j * (this.nx + 1) + i]!;
  }
  /** Level-set segments in data coordinates, cached per level. */
  segs(level: number): number[] {
    let s = this.segCache.get(level);
    if (!s) {
      const [x0, x1, y0, y1] = this.dom;
      const g = isoSegments(this.vals, this.nx, this.ny, level);
      s = g.map((v, k) => (k % 2 === 0 ? x0 + ((x1 - x0) * v) / this.nx : y0 + ((y1 - y0) * v) / this.ny));
      this.segCache.set(level, s);
    }
    return s;
  }
}

/** A heat map with contour lines, like the chapter's `Surface`, drawn into a Frame's box. */
export class Heat {
  private img: HTMLCanvasElement | null = null;
  private key = '';
  constructor(
    readonly field: () => Field,
    readonly o: { hue: Color; lo?: number; hi?: number; levels?: number[]; gamma?: number },
  ) {}
  range(): [number, number] {
    const F = this.field();
    return [this.o.lo ?? F.lo, this.o.hi ?? F.hi];
  }
  levels(): number[] {
    if (this.o.levels) return this.o.levels;
    const [lo, hi] = this.range();
    return Array.from({ length: 9 }, (_, k) => lo + ((k + 0.5) * (hi - lo)) / 9);
  }
  private image(): HTMLCanvasElement {
    const hue = color(this.o.hue);
    if (this.img && this.key === hue) return this.img;
    const F = this.field();
    const [lo, hi] = this.range();
    const g = this.o.gamma ?? 0.8;
    const [r, gg, b] = rgbOf(hue);
    const cv = this.img ?? document.createElement('canvas');
    cv.width = F.nx + 1;
    cv.height = F.ny + 1;
    const c = cv.getContext('2d')!;
    const im = c.createImageData(cv.width, cv.height);
    for (let j = 0; j <= F.ny; j++)
      for (let i = 0; i <= F.nx; i++) {
        const t = Math.max(0, Math.min(1, (F.at(i, j) - lo) / (hi - lo)));
        const p = 4 * ((F.ny - j) * cv.width + i);
        im.data[p] = r;
        im.data[p + 1] = gg;
        im.data[p + 2] = b;
        im.data[p + 3] = Math.round(12 + 200 * t ** g);
      }
    c.putImageData(im, 0, 0);
    this.img = cv;
    this.key = hue;
    return cv;
  }
  draw(fr: Frame, a = 1, contours = 1): void {
    const s = fr.s;
    const F = this.field();
    const [x0, x1, y0, y1] = F.dom;
    const dx = (x1 - x0) / F.nx / 2;
    const dy = (y1 - y0) / F.ny / 2;
    s.alpha(a, () =>
      fr.clip(() => {
        const c = s.ctx;
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(this.image(), fr.X(x0 - dx), fr.Y(y1 + dy), fr.kx * (x1 - x0 + 2 * dx), fr.ky * (y1 - y0 + 2 * dy));
        if (contours > 0) {
          c.beginPath();
          for (const lv of this.levels()) {
            const g = F.segs(lv);
            for (let k = 0; k < g.length; k += 4) {
              c.moveTo(fr.X(g[k]!), fr.Y(g[k + 1]!));
              c.lineTo(fr.X(g[k + 2]!), fr.Y(g[k + 3]!));
            }
          }
          c.strokeStyle = s.tint('--ink', 0.22 * contours);
          c.lineWidth = Math.max(1, s.u * 0.22);
          c.stroke();
        }
      }),
    );
    s.alpha(a, () => s.rrect(...fr.box, 0.8, { stroke: s.c('--rule'), lw: 0.3 }));
  }
}

/** Camera for a heightfield: `az` turns it about the vertical, `el` tilts it (pi/2 looks straight down). */
export interface Cam {
  az: number;
  el: number;
  /** Height of a normalized 1 in data units. */
  zk: number;
}

/**
 * A shaded 3-D heightfield over `dom`, fitted into `rect`. Heights come in normalized 0..1.
 * Returns a projector so callers can place marks on the surface.
 */
export function mesh(
  s: Scene,
  rect: Rect,
  dom: [number, number, number, number],
  n: number,
  z: (i: number, j: number) => number,
  cam: Cam,
  hue: Tok,
  a = 1,
): (x: number, y: number, h: number) => [number, number] {
  const [x0, x1, y0, y1] = dom;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const ca = Math.cos(cam.az);
  const sa = Math.sin(cam.az);
  const se = Math.sin(cam.el);
  const ce = Math.cos(cam.el);
  const raw = (x: number, y: number, h: number): [number, number, number] => {
    const u = (x - cx) * ca - (y - cy) * sa;
    const v = (x - cx) * sa + (y - cy) * ca;
    return [u, -(v * se + h * cam.zk * ce), v];
  };
  const P: [number, number, number][] = [];
  let mnx = Infinity;
  let mxx = -Infinity;
  let mny = Infinity;
  let mxy = -Infinity;
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const p = raw(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n, z(i, j));
      P.push(p);
      mnx = Math.min(mnx, p[0]);
      mxx = Math.max(mxx, p[0]);
      mny = Math.min(mny, p[1]);
      mxy = Math.max(mxy, p[1]);
    }
  const [rx, ry, rw, rh] = rect;
  const k = Math.min(rw / (mxx - mnx), rh / (mxy - mny));
  const ox = rx + rw / 2 - (k * (mnx + mxx)) / 2;
  const oy = ry + rh / 2 - (k * (mny + mxy)) / 2;
  const proj = (x: number, y: number, h: number): [number, number] => {
    const p = raw(x, y, h);
    return [ox + k * p[0], oy + k * p[1]];
  };
  if (a <= 0.003) return proj;
  const quads: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) quads.push([j * (n + 1) + i, (P[j * (n + 1) + i]![2] + P[(j + 1) * (n + 1) + i + 1]![2]) / 2]);
  quads.sort((p, q) => q[1] - p[1]);
  const card = rgbOf(s.c('--card'));
  const tone = rgbOf(s.c(hue));
  const ink = s.tint('--ink', 0.16);
  const c = s.ctx;
  const cellX = (x1 - x0) / n;
  const cellY = (y1 - y0) / n;
  const L = [-0.45, 0.55, 0.7];
  const ln = Math.hypot(...L);
  s.alpha(a, () => {
    c.lineWidth = Math.max(0.6, s.u * 0.12);
    c.lineJoin = 'round';
    for (const [q] of quads) {
      const i = q % (n + 1);
      const j = Math.floor(q / (n + 1));
      const h00 = z(i, j);
      const h10 = z(i + 1, j);
      const h01 = z(i, j + 1);
      const h11 = z(i + 1, j + 1);
      const gx = ((h10 - h00 + h11 - h01) / 2) * (cam.zk / cellX);
      const gy = ((h01 - h00 + h11 - h10) / 2) * (cam.zk / cellY);
      const nl = Math.hypot(gx, gy, 1);
      const lam = (-gx * L[0]! - gy * L[1]! + L[2]!) / (nl * ln);
      const shade = 0.64 + 0.46 * lam;
      const hh = (h00 + h10 + h01 + h11) / 4;
      c.beginPath();
      const pts = [q, q + 1, q + n + 2, q + n + 1];
      pts.forEach((m, t) => {
        const p = P[m]!;
        const X = ox + k * p[0];
        const Y = oy + k * p[1];
        if (t) c.lineTo(X, Y);
        else c.moveTo(X, Y);
      });
      c.closePath();
      c.fillStyle = mix(card, tone, 0.12 + 0.62 * Math.max(0, Math.min(1, hh)) ** 0.85, Math.min(1.08, shade));
      c.fill();
      c.strokeStyle = ink;
      c.stroke();
    }
  });
  return proj;
}

/** A rounded label card: text lines with optional colored dots. */
export function card(s: Scene, x: number, y: number, rows: { text: string; col?: string; mono?: boolean; dot?: string }[], o: { size?: number; align?: 'left' | 'right'; a?: number } = {}): [number, number] {
  const size = o.size ?? 3.4;
  const u = s.u;
  const lh = size * u * 1.45;
  const pad = u * 1.8;
  const wTxt = Math.max(...rows.map((r) => s.measure(r.text, { size, font: r.mono ? 'mono' : 'ui' }) + (r.dot ? size * u * 1.1 : 0)));
  const bw = wTxt + pad * 2;
  const bh = rows.length * lh + pad * 1.2;
  const bx = o.align === 'right' ? x - bw : x;
  s.alpha(o.a ?? 1, () => {
    s.rrect(bx, y, bw, bh, 1.4, { fill: s.tint('--card', 0.9), stroke: s.c('--rule'), lw: 0.3 });
    rows.forEach((r, i) => {
      const ty = y + pad * 0.6 + lh * (i + 0.5);
      let tx = bx + pad;
      if (r.dot) {
        s.circle(tx + size * u * 0.3, ty, size * u * 0.28, { fill: r.dot });
        tx += size * u * 1.1;
      }
      s.text(r.text, tx, ty, { size, font: r.mono ? 'mono' : 'ui', align: 'left', color: r.col ?? s.c('--ink-2') });
    });
  });
  return [bw, bh];
}

/** A small padlock, for things that stay fixed. */
export function lock(s: Scene, x: number, y: number, size: number, col: string): void {
  const u = s.u;
  const w = size * u;
  const c = s.ctx;
  c.beginPath();
  c.arc(x, y - w * 0.15, w * 0.3, Math.PI, 0);
  c.strokeStyle = col;
  c.lineWidth = w * 0.13;
  c.stroke();
  s.rrect(x - w * 0.45, y - w * 0.15, w * 0.9, w * 0.7, 0.4, { fill: col });
}

/** A dial with its needle at `ang` (radians, 0 = up). */
export function dial(s: Scene, x: number, y: number, r: number, ang: number, col: string): void {
  s.circle(x, y, r, { fill: s.tint('--card', 1), stroke: col, lw: 0.28 });
  s.line(x, y, x + Math.sin(ang) * r * 0.78, y - Math.cos(ang) * r * 0.78, col, 0.32);
}
