import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { LETTERS, type Mat } from './interpretability-model';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SANS = 'system-ui, -apple-system, sans-serif';
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export type K = Color | `--${string}`;

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  font?: 'mono' | 'sans' | 'serif';
  weight?: number;
  italic?: boolean;
  halo?: boolean;
}

const fontOf = (o: TextOpts): string => `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 12}px ${o.font === 'mono' ? MONO : o.font === 'serif' ? SERIF : SANS}`;

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): void {
  ctx.font = fontOf(o);
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'middle';
  if (o.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = color('--card');
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color ?? color('--ink-2');
  ctx.fillText(s, x, y);
}

export function measure(ctx: CanvasRenderingContext2D, s: string, o: TextOpts = {}): number {
  ctx.font = fontOf(o);
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

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string, width = 1, dash?: number[]): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string, width = 1.5, head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 1) return;
  const hl = Math.min(head, L * 0.45);
  ctx.strokeStyle = ctx.fillStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * hl * 0.8, y1 - Math.sin(a) * hl * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * Math.cos(a - 0.42), y1 - hl * Math.sin(a - 0.42));
  ctx.lineTo(x1 - hl * Math.cos(a + 0.42), y1 - hl * Math.sin(a + 0.42));
  ctx.closePath();
  ctx.fill();
}

/** A curved arrow from (x0, y0) to (x1, y1) bulging by `bend` px to its left. */
export function curve(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, bend: number, stroke: string, width = 1.5, head = 0): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cx = mx + (-(y1 - y0) / L) * bend;
  const cy = my + ((x1 - x0) / L) * bend;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  if (head > 0) {
    const a = Math.atan2(y1 - cy, x1 - cx);
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42));
    ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42));
    ctx.closePath();
    ctx.fill();
  }
}

/** Sets a fixed-aspect canvas to `need` px tall; true when it changed (a redraw follows on resize). */
export function fitHeight(canvas: HTMLCanvasElement, w: number, h: number, need: number): boolean {
  if (Math.abs(need - h) <= 2) return false;
  canvas.style.aspectRatio = `${w} / ${Math.round(need)}`;
  return true;
}

/** A signed value as a fill: `pos` for positive, slate for negative, stronger with size. */
export function signed(v: number, range: number, pos: K = 'orange'): string {
  const a = Math.min(1, Math.abs(v) / range);
  return withAlpha(color(v >= 0 ? pos : 'slate'), 0.05 + 0.85 * a);
}

/** Compact number: 2 decimals, no "-0". */
export function num(v: number, digits = 2): string {
  const s = v.toFixed(digits);
  return s === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : s;
}

/**
 * A heat grid of M (only the lower triangle when `causal`), cells `cs` px, top-left at (x, y).
 * `val` maps an entry to a fill.
 */
export function heat(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, M: Mat, fill: (v: number, i: number, j: number) => string, causal = false): void {
  const gap = cs >= 9 ? 1 : cs >= 5 ? 0.5 : 0;
  for (let i = 0; i < M.r; i++)
    for (let j = 0; j < M.c; j++) {
      if (causal && j > i) continue;
      ctx.fillStyle = fill(M.a[i * M.c + j]!, i, j);
      ctx.fillRect(x + j * cs + gap / 2, y + i * cs + gap / 2, cs - gap, cs - gap);
    }
}

export interface StripLayout {
  x0: number;
  y0: number;
  cw: number;
  ch: number;
  gap: number;
  half: number;
}

/** Two rows of letter cells, the second half under the first, so repeats line up in columns. */
export function stripLayout(w: number, top: number, half: number, left = 4): StripLayout {
  const cw = Math.min(40, (w - left - 4) / half);
  const ch = Math.min(30, Math.max(22, cw * 0.9));
  return { x0: left + (w - left - 4 - cw * half) / 2, y0: top, cw, ch, gap: Math.max(16, ch * 0.75), half };
}

export function cellPos(L: StripLayout, i: number): { x: number; y: number; cx: number; cy: number } {
  const r = i < L.half ? 0 : 1;
  const c = i % L.half;
  const x = L.x0 + c * L.cw;
  const y = L.y0 + r * (L.ch + L.gap);
  return { x, y, cx: x + L.cw / 2, cy: y + L.ch / 2 };
}

/** Draws the letter cells; `tint(i)` gives a fill 0..1 and an optional ring color. */
export function drawStrip(ctx: CanvasRenderingContext2D, L: StripLayout, ids: number[], tint: (i: number) => { a: number; ring?: string; k?: K }): void {
  ids.forEach((t, i) => {
    const { x, y, cx, cy } = cellPos(L, i);
    const o = tint(i);
    const k = color(o.k ?? 'orange');
    rbox(ctx, x + 1.5, y, L.cw - 3, L.ch, 5, withAlpha(k, 0.07 + 0.5 * o.a), o.ring ?? withAlpha(k, 0.45), o.ring ? 2.2 : 1);
    text(ctx, LETTERS[t]!, cx, cy + 0.5, { font: 'mono', size: Math.min(15, L.cw * 0.5), weight: o.ring ? 700 : 500, color: color('--ink') });
  });
}

/** Index of the strip cell under (px, py), or -1. */
export function stripHit(L: StripLayout, n: number, px: number, py: number): number {
  for (let i = 0; i < n; i++) {
    const { x, y } = cellPos(L, i);
    if (px >= x && px <= x + L.cw && py >= y - 4 && py <= y + L.ch + 4) return i;
  }
  return -1;
}
