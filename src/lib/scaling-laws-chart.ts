import { color } from '../core/plot';

export interface Axis {
  lo: number;
  hi: number;
  log?: boolean;
}

export type Rect = [number, number, number, number];

const tr = (a: Axis, v: number): number => (a.log ? Math.log10(v) : v);
const untr = (a: Axis, t: number): number => (a.log ? 10 ** t : t);

/** Maps data onto a pixel rectangle with optional log axes (y up). Shared by the chapter's plots and the lecture's stage. */
export class Frame {
  constructor(
    readonly rect: Rect,
    readonly xa: Axis,
    readonly ya: Axis,
  ) {}
  X(v: number): number {
    const [x, , w] = this.rect;
    const a = this.xa;
    return x + ((tr(a, v) - tr(a, a.lo)) / (tr(a, a.hi) - tr(a, a.lo))) * w;
  }
  Y(v: number): number {
    const [, y, , h] = this.rect;
    const a = this.ya;
    return y + h - ((tr(a, v) - tr(a, a.lo)) / (tr(a, a.hi) - tr(a, a.lo))) * h;
  }
  ix(px: number): number {
    const [x, , w] = this.rect;
    const a = this.xa;
    return untr(a, tr(a, a.lo) + ((px - x) / w) * (tr(a, a.hi) - tr(a, a.lo)));
  }
  iy(py: number): number {
    const [, y, , h] = this.rect;
    const a = this.ya;
    return untr(a, tr(a, a.lo) + ((y + h - py) / h) * (tr(a, a.hi) - tr(a, a.lo)));
  }
  get left(): number {
    return this.rect[0];
  }
  get right(): number {
    return this.rect[0] + this.rect[2];
  }
  get top(): number {
    return this.rect[1];
  }
  get bottom(): number {
    return this.rect[1] + this.rect[3];
  }
  /** Runs `fn` clipped to the frame. */
  clip(ctx: CanvasRenderingContext2D, fn: () => void): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(...this.rect);
    ctx.clip();
    fn();
    ctx.restore();
  }
  /** Polyline through data points, clipped; non-finite points break the line. */
  path(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>, stroke: string, width: number, dash?: number[]): void {
    this.clip(ctx, () => {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < xs.length; i++) {
        const X = this.X(xs[i]!);
        const Y = this.Y(ys[i]!);
        if (!Number.isFinite(X) || !Number.isFinite(Y)) {
          pen = false;
          continue;
        }
        const Yc = Math.max(-1e5, Math.min(1e5, Y));
        if (pen) ctx.lineTo(X, Yc);
        else ctx.moveTo(X, Yc);
        pen = true;
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash ?? []);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  /** y = f(x) sampled evenly in (log) x across [from, to]. */
  fn(ctx: CanvasRenderingContext2D, f: (x: number) => number, stroke: string, width: number, o: { from?: number; to?: number; n?: number; dash?: number[] } = {}): void {
    const a = this.xa;
    const t0 = tr(a, o.from ?? a.lo);
    const t1 = tr(a, o.to ?? a.hi);
    const n = o.n ?? 160;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = untr(a, t0 + ((t1 - t0) * i) / n);
      xs.push(x);
      ys.push(f(x));
    }
    this.path(ctx, xs, ys, stroke, width, o.dash);
  }
}

/** Powers of ten inside [lo, hi]. */
export function decades(lo: number, hi: number, every = 1): number[] {
  const out: number[] = [];
  for (let e = Math.ceil(Math.log10(lo) - 1e-9); e <= Math.floor(Math.log10(hi) + 1e-9); e++) if (e % every === 0) out.push(10 ** e);
  return out;
}

export interface AxesOpts {
  /** Tick label size in px. */
  font: number;
  xTicks: number[];
  yTicks: number[];
  xFmt: (v: number) => string;
  yFmt: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
  xLabelColor?: string;
  yLabelColor?: string;
  /** Grid line width in px. */
  lw?: number;
  mono?: string;
  ui?: string;
}

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, -apple-system, sans-serif';

/** Grid, frame, tick labels and axis labels. The y label sits above the frame's top-left corner. */
export function drawAxes(ctx: CanvasRenderingContext2D, f: Frame, o: AxesOpts): void {
  const lw = o.lw ?? 1;
  const mono = o.mono ?? MONO;
  const ui = o.ui ?? UI;
  ctx.lineWidth = lw;
  ctx.strokeStyle = color('--grid');
  ctx.beginPath();
  for (const t of o.xTicks) {
    const X = Math.round(f.X(t)) + 0.5;
    ctx.moveTo(X, f.top);
    ctx.lineTo(X, f.bottom);
  }
  for (const t of o.yTicks) {
    const Y = Math.round(f.Y(t)) + 0.5;
    ctx.moveTo(f.left, Y);
    ctx.lineTo(f.right, Y);
  }
  ctx.stroke();
  ctx.strokeStyle = color('--axis');
  ctx.beginPath();
  ctx.moveTo(f.left, f.top);
  ctx.lineTo(f.left, f.bottom);
  ctx.lineTo(f.right, f.bottom);
  ctx.stroke();
  const ink3 = color('--ink-3');
  for (const t of o.xTicks) rich(ctx, o.xFmt(t), f.X(t), f.bottom + o.font * 1.05, { px: o.font, family: mono, fill: ink3, align: 'center' });
  for (const t of o.yTicks) rich(ctx, o.yFmt(t), f.left - o.font * 0.45, f.Y(t), { px: o.font, family: mono, fill: ink3, align: 'right' });
  if (o.xLabel) {
    ctx.font = `${o.font}px ${ui}`;
    ctx.fillStyle = o.xLabelColor ?? color('--ink-2');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(o.xLabel, f.right, f.bottom + o.font * 1.75);
  }
  if (o.yLabel) {
    ctx.font = `${o.font}px ${ui}`;
    ctx.fillStyle = o.yLabelColor ?? color('--ink-2');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(o.yLabel, f.left - o.font * 0.2, f.top - o.font * 0.55);
  }
}

/** Text with a background-colored outline so it stays legible over lines. */
export function halo(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string, font: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'middle', bg = '--paper'): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = color(bg as `--${string}`);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

export interface RichOpts {
  px: number;
  family?: string;
  weight?: number;
  fill: string;
  align?: CanvasTextAlign;
  /** Paint a background-colored outline first (a CSS variable name). */
  halo?: `--${string}`;
  italic?: boolean;
}

/**
 * Draws one line of text, vertically centered on y, where `^` starts a superscript that runs to the
 * next space: "5.9 × 10^23". Canvas fonts render Unicode superscripts too small to read.
 */
export function rich(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: RichOpts): number {
  const fam = o.family ?? UI;
  const w0 = o.weight ?? 500;
  const base = `${o.italic ? 'italic ' : ''}${w0} ${o.px}px ${fam}`;
  const small = `${o.italic ? 'italic ' : ''}${w0} ${o.px * 0.74}px ${fam}`;
  const segs: { t: string; up: boolean }[] = [];
  s.split(/(\^[^\s]+)/).forEach((p) => {
    if (!p) return;
    if (p.startsWith('^')) segs.push({ t: p.slice(1), up: true });
    else segs.push({ t: p, up: false });
  });
  const widths = segs.map((g) => {
    ctx.font = g.up ? small : base;
    return ctx.measureText(g.t).width;
  });
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  segs.forEach((g, i) => {
    ctx.font = g.up ? small : base;
    const gy = g.up ? y - o.px * 0.36 : y;
    if (o.halo) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = color(o.halo);
      ctx.strokeText(g.t, cx, gy);
    }
    ctx.fillStyle = o.fill;
    ctx.fillText(g.t, cx, gy);
    cx += widths[i]!;
  });
  return total;
}
