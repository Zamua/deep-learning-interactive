import { CLASS_COLORS } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts } from '../../lecture/scene';

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
  grid(step = 1, a = 1, axes = true): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.view;
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
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.view[0], to = this.view[1]): void {
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
      c.stroke();
    });
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.8, head = 3.2): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, head);
  }
  dot(x: number, y: number, r: number, col: string, ring?: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: ring ?? this.s.c('--card'), lw: 0.35 });
  }
}

/** The stage's drawing area inside a margin, leaving `top` of the height free above it. */
export function area(s: Scene, top = 0.12, pad = 0.05): Rect {
  const m = Math.max(s.u * 4, s.w * pad);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - Math.max(s.u * 4, s.h * pad)];
}

/** The size (in u) at which `str` fits in `maxW` px, never above `o.size`. */
export function fit(s: Scene, str: string, maxW: number, o: TextOpts = {}): number {
  const size = o.size ?? 5;
  const w = s.measure(str, { ...o, size });
  return w > maxW ? (size * maxW) / w : size;
}

/** Text that shrinks to fit `maxW` px. */
export function fitText(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  s.text(str, x, y, { ...o, size: fit(s, str, maxW, o) });
}

export const CLS3 = ['cat', 'dog', 'ship'];
export const CLS3_COL: Color[] = CLASS_COLORS.slice(0, 3);
export const CIFAR10 = ['plane', 'car', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck'];

export function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A 32 x 32 canvas from CIFAR planar bytes (1024 R, 1024 G, 1024 B); `f` maps each value. */
export function tile(px: ArrayLike<number>, f: (v: number, ch: number, p: number) => number = (v) => v): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const img = new ImageData(32, 32);
  for (let p = 0; p < 1024; p++) {
    for (let ch = 0; ch < 3; ch++) img.data[p * 4 + ch] = Math.max(0, Math.min(255, f(px[ch * 1024 + p]!, ch, p)));
    img.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** Draws a 32 x 32 tile scaled to `size`, with a hairline border; a soft placeholder until it exists. */
export function drawTile(s: Scene, c: CanvasImageSource | null | undefined, x: number, y: number, size: number, o: { smooth?: boolean; stroke?: string; lw?: number } = {}): void {
  if (!c) {
    s.rrect(x, y, size, size, 0.6, { fill: s.tint('slate', 0.12) });
    return;
  }
  const ctx = s.ctx;
  ctx.save();
  ctx.imageSmoothingEnabled = !!o.smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, x, y, size, size);
  ctx.restore();
  s.rrect(x, y, size, size, 0.4, { stroke: o.stroke ?? s.c('--rule'), lw: o.lw ?? 0.3 });
}

/** A three-bar chart of class scores in frame `fr` (x domain 0..3), the chapter's bar figure. */
export function bars3(
  s: Scene,
  fr: Frame,
  vals: number[],
  o: { correct?: number; names?: number; values?: number; fmt?: (v: number) => string; nameY?: number; width?: number; dim?: number[] } = {},
): void {
  const bw = o.width ?? 0.42;
  const { u } = s;
  vals.forEach((v, i) => {
    const k = CLS3_COL[i]!;
    const on = i === o.correct;
    const a = o.dim?.[i] ?? 1;
    s.alpha(a, () => {
      const x0 = fr.X(i + 0.5 - bw / 2);
      const x1 = fr.X(i + 0.5 + bw / 2);
      const y0 = fr.Y(0);
      const y1 = fr.Y(v);
      s.ctx.fillStyle = s.tint(k, on ? 0.8 : 0.42);
      s.ctx.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
      s.ctx.strokeStyle = s.c(k);
      s.ctx.lineWidth = (on ? 0.55 : 0.3) * u;
      s.ctx.strokeRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
      if (o.values ?? 1) {
        const str = (o.fmt ?? ((q: number) => q.toFixed(1)))(v);
        s.alpha(o.values ?? 1, () =>
          s.text(str, fr.X(i + 0.5), v > 0 ? y1 - u * 2.6 : y1 + u * 2.6, { size: 3.6, font: 'mono', weight: 600, halo: true }),
        );
      }
    });
    s.alpha(o.names ?? 1, () =>
      s.text(CLS3[i]! + (on ? ' ✓' : ''), fr.X(i + 0.5), o.nameY ?? fr.rect[1] + fr.rect[3] - u * 1.5, {
        size: 3.8,
        weight: on ? 650 : 450,
        color: on ? s.c('gold') : s.c('--ink-2'),
        halo: true,
      }),
    );
  });
}

/** A rounded box with a centered label: the lecture's "machine". */
export function box(s: Scene, cx: number, cy: number, w: number, h: number, label: string, k: Color, o: { on?: number; size?: number; font?: TextOpts['font']; italic?: boolean } = {}): void {
  const on = o.on ?? 0;
  s.rrect(cx - w / 2, cy - h / 2, w, h, 2.2, { fill: s.tint(k, 0.1 + 0.12 * on), stroke: s.c(k), lw: 0.45 + 0.35 * on });
  fitText(s, label, cx, cy + s.u * 0.2, w * 0.86, { size: o.size ?? 4.4, font: o.font ?? 'mono', weight: 600, italic: o.italic, color: s.c(k) });
}
