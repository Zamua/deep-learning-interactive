import { color, withAlpha } from '../core/plot';
import type { Mat } from './transformer-model';

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

export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string, width = 1.5, head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const L = Math.hypot(x1 - x0, y1 - y0);
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

/** Sets a fixed-aspect canvas to `need` px tall; true when it changed (a redraw follows on resize). */
export function fitHeight(canvas: HTMLCanvasElement, w: number, h: number, need: number): boolean {
  if (Math.abs(need - h) <= 2) return false;
  canvas.style.aspectRatio = `${w} / ${Math.round(need)}`;
  return true;
}

/** A signed value as a fill: `pos` for positive, slate for negative, stronger with size. */
export function signed(v: number, range: number, pos = 'orange'): string {
  const a = Math.min(1, Math.abs(v) / range);
  return withAlpha(color(v >= 0 ? (pos as 'orange') : 'slate'), 0.06 + 0.7 * a);
}

/** Compact numbers for small cells: 2 decimals, "-0" folded to "0", ".33" for weights. */
export function cellNum(v: number, digits = 2, dropZero = false): string {
  const s = v.toFixed(digits);
  const t = s === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : s;
  return dropZero ? t.replace(/^0\./, '.').replace(/^-0\./, '-.') : t;
}

/** At most four characters: ".05", "-.93", "1.5", "-1.6". */
export function shortNum(v: number): string {
  return Math.abs(v) < 0.995 ? cellNum(v, 2, true) : cellNum(v, 1);
}

export interface MatOpts {
  /** Palette key or css color for the cells. */
  col: string;
  digits?: number;
  /** Fill each cell by value (attention weights). */
  heat?: boolean;
  dropZero?: boolean;
  hiRow?: number;
  dimRows?: boolean;
  font?: number;
  /** Hide numbers (heat only). */
  bare?: boolean;
  /** Four-character numbers for narrow cells. */
  short?: boolean;
}

/** A matrix as a grid of rounded cells with its numbers. */
export function matrix(ctx: CanvasRenderingContext2D, x: number, y: number, cw: number, ch: number, M: Mat, o: MatOpts): void {
  const base = o.col.startsWith('#') ? o.col : color(o.col as 'blue');
  const fs = o.font ?? Math.max(10, Math.min(13, cw * 0.3));
  M.forEach((row, i) => {
    const lit = o.hiRow === i;
    const dim = o.dimRows && o.hiRow !== undefined && !lit;
    row.forEach((v, j) => {
      const cx = x + j * cw;
      const cy = y + i * ch;
      const fill = o.heat ? withAlpha(base, 0.04 + 0.86 * Math.max(0, Math.min(1, v))) : withAlpha(base, lit ? 0.26 : dim ? 0.05 : 0.12);
      rbox(ctx, cx + 1, cy + 1, cw - 2, ch - 2, 4, fill, withAlpha(base, lit ? 0.95 : dim ? 0.25 : 0.45), lit ? 1.6 : 1);
      if (!o.bare) {
        const strong = o.heat && v > 0.55;
        text(ctx, o.short ? shortNum(v) : cellNum(v, o.digits ?? 2, o.dropZero), cx + cw / 2, cy + ch / 2 + 0.5, {
          font: 'mono',
          size: fs,
          weight: lit ? 600 : 500,
          color: strong ? '#ffffff' : dim ? color('--ink-3') : color('--ink'),
        });
      }
    });
  });
}
