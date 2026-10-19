import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const UI = 'system-ui, -apple-system, sans-serif';
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export interface TOpts {
  size?: number;
  weight?: number;
  font?: 'ui' | 'mono' | 'serif';
  italic?: boolean;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  color?: string;
}

const family = (f: TOpts['font']) => (f === 'mono' ? MONO : f === 'serif' ? SERIF : UI);

export function setFont(ctx: CanvasRenderingContext2D, o: TOpts = {}): void {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 12}px ${family(o.font)}`;
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TOpts = {}): void {
  setFont(ctx, o);
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'middle';
  ctx.fillStyle = o.color ?? color('--ink');
  ctx.fillText(s, x, y);
}

export function measure(ctx: CanvasRenderingContext2D, s: string, o: TOpts = {}): number {
  setFont(ctx, o);
  return ctx.measureText(s).width;
}

export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null, lw = 1): void {
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

export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1.6, head = 8): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const hd = Math.min(head, len * 0.45);
  line(ctx, x0, y0, x1 - ux * hd * 0.7, y1 - uy * hd * 0.7, col, lw);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5);
  ctx.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

/** A filled rounded label; returns its width. `on` strengthens fill and outline. */
export function chip(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, k: Color, o: { size?: number; on?: boolean; ring?: boolean; hollow?: boolean; h?: number } = {}): number {
  const size = o.size ?? 12;
  const tw = measure(ctx, s, { size, weight: 600 });
  const w = tw + size * 1.1;
  const h = o.h ?? size * 1.9;
  const c = color(k);
  if (o.hollow) {
    ctx.save();
    ctx.setLineDash([3, 2.5]);
    rbox(ctx, x, y - h / 2, w, h, h / 2, withAlpha(c, o.on ? 0.16 : 0.06), withAlpha(c, 0.9), 1.2);
    ctx.restore();
  } else rbox(ctx, x, y - h / 2, w, h, h / 2, withAlpha(c, o.on ? 0.3 : 0.15), withAlpha(c, o.on ? 1 : 0.6), o.on ? 1.8 : 1);
  if (o.ring) rbox(ctx, x - 3, y - h / 2 - 3, w + 6, h + 6, h / 2 + 3, null, color('--ink'), 1.4);
  text(ctx, s, x + w / 2, y + 0.5, { size, weight: 600, color: color('--ink') });
  return w;
}

export function chipWidth(ctx: CanvasRenderingContext2D, s: string, size = 12): number {
  return measure(ctx, s, { size, weight: 600 }) + size * 1.1;
}

/** Splits text into lines no wider than `maxW` at the given font. */
export function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number, o: TOpts = {}): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && measure(ctx, t, o) > maxW) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/** Resizes a fixed-aspect canvas to the height its content needs; true if it changed (a redraw follows). */
export function fitHeight(canvas: HTMLCanvasElement, w: number, h: number, need: number): boolean {
  if (Math.abs(need - h) <= 2) return false;
  canvas.style.aspectRatio = `${w} / ${Math.round(need)}`;
  return true;
}

/** A row-wise softmax for small arrays. */
export function softmax(s: number[]): number[] {
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}
