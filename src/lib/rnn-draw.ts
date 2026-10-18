import { color, withAlpha } from '../core/plot';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SANS = 'system-ui, sans-serif';
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

/** Rounded rectangle, filled and/or stroked. */
export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string | null, stroke?: string | null, lw = 1): void {
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

/** A straight arrow in CSS px. */
export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string, width = 1.5, dash?: number[], head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const L = Math.hypot(x1 - x0, y1 - y0);
  const hl = Math.min(head, L * 0.45);
  ctx.strokeStyle = ctx.fillStyle = stroke;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * hl * 0.8, y1 - Math.sin(a) * hl * 0.8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * Math.cos(a - 0.42), y1 - hl * Math.sin(a - 0.42));
  ctx.lineTo(x1 - hl * Math.cos(a + 0.42), y1 - hl * Math.sin(a + 0.42));
  ctx.closePath();
  ctx.fill();
}

/** Fill color for a value in [-1, 1]: green tint for positive, slate for negative. */
export function signedFill(v: number, pos: string = color('green'), neg: string = color('slate')): string {
  const a = Math.min(1, Math.abs(v));
  return withAlpha(v >= 0 ? pos : neg, 0.08 + 0.6 * a);
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Readable glyph for a character in a canvas or chip: newline and space become visible marks. */
export function glyph(ch: string): string {
  return ch === '\n' ? '⏎' : ch === ' ' ? '␣' : ch;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
