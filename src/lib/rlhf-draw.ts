import type { Plot } from '../core/plot';

export const UI = 'system-ui, -apple-system, sans-serif';
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export interface LabelOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  font?: 'ui' | 'mono' | 'serif';
  weight?: number;
  italic?: boolean;
}

const family = (f: LabelOpts['font']): string => (f === 'mono' ? MONO : f === 'serif' ? SERIF : UI);

export function setFont(ctx: CanvasRenderingContext2D, o: LabelOpts = {}): void {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${family(o.font)}`;
}

/** Text in CSS px; returns its width. */
export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: LabelOpts = {}): number {
  setFont(ctx, o);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'middle';
  ctx.fillStyle = o.color ?? '#000';
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

export function measure(ctx: CanvasRenderingContext2D, s: string, o: LabelOpts = {}): number {
  setFont(ctx, o);
  return ctx.measureText(s).width;
}

export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
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

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1, dash?: number[]): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1.5, head = 7): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const hd = Math.min(head, len * 0.5);
  line(ctx, x0, y0, x1 - ux * hd * 0.7, y1 - uy * hd * 0.7, col, lw);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5);
  ctx.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

/** Greedy word wrap to `maxW` px in the given font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, o: LabelOpts = {}): string[] {
  setFont(ctx, o);
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Gives a plot the CSS height its layout needs at the current width. Returns false when it had
 * to resize, in which case the plot redraws itself at the new size.
 */
export function sizeTo(pl: Plot, hpx: number): boolean {
  const want = Math.round(hpx);
  if (Math.abs(pl.h - want) <= 1) return true;
  pl.canvas.style.aspectRatio = 'auto';
  pl.canvas.style.height = `${want}px`;
  return false;
}
