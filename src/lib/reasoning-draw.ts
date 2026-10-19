import type { Fig } from '../core/page';
import { onDispose } from '../core/dom';
import { color, withAlpha } from '../core/plot';
import { MONO, UI } from './math-kit-draw';

export const mono = (px: number, wt = 500): string => `${wt} ${px}px ${MONO}`;
export const ui = (px: number, wt = 400): string => `${wt} ${px}px ${UI}`;

/**
 * A HiDPI canvas whose height follows its width through `heightFor`, so rows of text keep a
 * readable size on a phone instead of shrinking with a fixed aspect ratio.
 */
export function fitCanvas(f: Fig, heightFor: (w: number) => number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, host?: HTMLElement): { canvas: HTMLCanvasElement; redraw(): void; refit(): void } {
  const cv = f.canvas(640, 400, draw);
  const box = host ?? f.viz;
  if (host) host.append(cv.canvas);
  let last = '';
  const refit = () => {
    const w = box.clientWidth || 640;
    const want = `${Math.round(w)} / ${Math.round(heightFor(w))}`;
    if (want !== last) {
      last = want;
      cv.canvas.style.aspectRatio = want;
    }
  };
  const ro = new ResizeObserver(refit);
  ro.observe(box);
  onDispose(() => ro.disconnect());
  refit();
  return { ...cv, refit };
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'middle'): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

/** Text on a card-colored pill, so it stays readable over curves and gridlines. */
export function tag(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, align: 'left' | 'right' | 'center' = 'left'): void {
  ctx.font = font;
  const w = ctx.measureText(s).width;
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  rrect(ctx, x0 - 4, y - 9, w + 8, 18, 4, withAlpha(color('--card'), 0.92));
  txt(ctx, s, x, y, font, fill, align);
}

/** Text shrunk (down to 9px) to fit `maxW`. */
export function fitTxt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, px: number, wt: number, fill: string, align: CanvasTextAlign = 'left', monoFont = false): void {
  const f = monoFont ? mono : ui;
  ctx.font = f(px, wt);
  const w = ctx.measureText(s).width;
  const size = w > maxW ? Math.max(9, (px * maxW) / w) : px;
  txt(ctx, s, x, y, f(size, wt), fill, align);
}

/** A filled disc with a check mark or a cross. */
export function badge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ok: boolean): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(color(ok ? 'green' : 'red'), 0.9);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.4, r * 0.28);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (ok) {
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
  } else {
    ctx.moveTo(cx - r * 0.38, cy - r * 0.38);
    ctx.lineTo(cx + r * 0.38, cy + r * 0.38);
    ctx.moveTo(cx + r * 0.38, cy - r * 0.38);
    ctx.lineTo(cx - r * 0.38, cy + r * 0.38);
  }
  ctx.stroke();
}

/** Maps a data window onto a pixel rectangle (y up), for charts drawn on a fitCanvas. */
export class Box {
  constructor(
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
  /** Data x from a CSS-px x. */
  inv(px: number): number {
    const [a, b] = this.dom;
    return a + ((px - this.x) / this.w) * (b - a);
  }
  path(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>, stroke: string, width = 2, dash?: number[]): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x - 2, this.y - 4, this.w + 4, this.h + 8);
    ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const X = this.X(xs[i]!);
      const Y = this.Y(ys[i]!);
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ?? []);
    ctx.stroke();
    ctx.restore();
  }
  /** Light gridlines at the given y values with labels on the left. */
  yGrid(ctx: CanvasRenderingContext2D, ys: number[], label: (v: number) => string): void {
    for (const v of ys) {
      ctx.strokeStyle = withAlpha(color('--ink-3'), 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, Math.round(this.Y(v)) + 0.5);
      ctx.lineTo(this.x + this.w, Math.round(this.Y(v)) + 0.5);
      ctx.stroke();
      txt(ctx, label(v), this.x - 5, this.Y(v), mono(10.5), color('--ink-3'), 'right');
    }
  }
  xTicks(ctx: CanvasRenderingContext2D, xs: number[], label: (v: number) => string): void {
    for (const v of xs) {
      ctx.strokeStyle = withAlpha(color('--ink-3'), 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(this.X(v)) + 0.5, this.y);
      ctx.lineTo(Math.round(this.X(v)) + 0.5, this.y + this.h);
      ctx.stroke();
      txt(ctx, label(v), this.X(v), this.y + this.h + 12, mono(10.5), color('--ink-3'), 'center');
    }
  }
  frame(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = color('--axis');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 0.5, this.y);
    ctx.lineTo(this.x + 0.5, this.y + this.h + 0.5);
    ctx.lineTo(this.x + this.w, this.y + this.h + 0.5);
    ctx.stroke();
  }
}

/** Legend rows: a short line swatch and a label, laid out left to right and wrapping. */
export function legend(ctx: CanvasRenderingContext2D, items: { label: string; col: string; dash?: number[]; width?: number }[], x: number, y: number, maxW: number, px = 11): number {
  let cx = x;
  let cy = y;
  ctx.font = ui(px, 600);
  for (const it of items) {
    const w = 20 + ctx.measureText(it.label).width + 14;
    if (cx + w > x + maxW && cx > x) {
      cx = x;
      cy += px + 7;
    }
    ctx.strokeStyle = it.col;
    ctx.lineWidth = it.width ?? 2.4;
    ctx.setLineDash(it.dash ?? []);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    txt(ctx, it.label, cx + 20, cy, ui(px, 600), it.col);
    cx += w;
  }
  return cy - y + px + 4;
}

/** Log-scaled slider helper: maps 0..1 to 1..max as a whole number. */
export const logN = (t: number, max: number): number => Math.max(1, Math.round(max ** t));
