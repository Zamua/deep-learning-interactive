import { color, withAlpha } from '../core/plot';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SANS = 'system-ui, -apple-system, sans-serif';
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  font?: 'mono' | 'sans' | 'serif';
  weight?: number;
  italic?: boolean;
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): void {
  const fam = o.font === 'mono' ? MONO : o.font === 'serif' ? SERIF : SANS;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 12}px ${fam}`;
  ctx.fillStyle = o.color ?? color('--ink-2');
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'middle';
  ctx.fillText(s, x, y);
}

export function measure(ctx: CanvasRenderingContext2D, s: string, o: TextOpts = {}): number {
  const fam = o.font === 'mono' ? MONO : o.font === 'serif' ? SERIF : SANS;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 12}px ${fam}`;
  return ctx.measureText(s).width;
}

export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string | null, stroke?: string | null, lw = 1): void {
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

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string, lw = 1, dash?: number[]): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Probabilities as compact text: 0.42 -> "42%", 0.004 -> "0.4%", 3e-5 -> "0.003%". */
export function pct(p: number): string {
  if (p >= 0.1) return `${Math.round(p * 100)}%`;
  if (p >= 0.01) return `${(p * 100).toFixed(1)}%`;
  if (p >= 0.0001) return `${(p * 100).toFixed(2)}%`;
  return `${(p * 100).toPrecision(1)}%`;
}

/** A very small or very large number as "3.2e-9" (the code listings' style). */
export function sci(v: number, digits = 2): string {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e5) return String(Number(v.toPrecision(digits)));
  return v.toExponential(digits - 1).replace('e+', 'e');
}

/** A word chip: rounded box with the word centered. Returns its width. */
export function chip(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, h: number, o: { fill?: string; stroke?: string; ink?: string; size?: number; minW?: number; bold?: boolean } = {}): number {
  const size = o.size ?? 12;
  const w = Math.max(o.minW ?? 0, measure(ctx, word, { font: 'mono', size, weight: o.bold ? 650 : 500 }) + size * 1.1);
  rbox(ctx, x, y, w, h, 6, o.fill ?? withAlpha(color('orange'), 0.1), o.stroke ?? withAlpha(color('orange'), 0.5), 1.2);
  text(ctx, word, x + w / 2, y + h / 2 + 0.5, { font: 'mono', size, weight: o.bold ? 650 : 500, color: o.ink ?? color('--ink') });
  return w;
}
