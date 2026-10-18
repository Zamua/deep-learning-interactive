import type { CifarSet } from '../core/data';
import { color, withAlpha } from '../core/plot';

/** Canvas helpers shared by the two ConvNet chapters (11 and 13). */

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SANS = 'system-ui, sans-serif';
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export const mono = (px: number, wt = 500): string => `${wt} ${px}px ${MONO}`;
export const sans = (px: number, wt = 400): string => `${wt} ${px}px ${SANS}`;

export interface CellOpts {
  fill?: string;
  stroke?: string;
  lw?: number;
  text?: string;
  ink?: string;
  size?: number;
  bold?: boolean;
  radius?: number;
  dash?: number[];
}

/** A rounded box with optional centered monospace text. */
export function cell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: CellOpts = {}): void {
  if (w <= 2 || h <= 2) return;
  const r = Math.max(0, Math.min(o.radius ?? 4, w / 3, h / 3));
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), r);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw ?? 1;
    ctx.setLineDash(o.dash ?? []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (o.text !== undefined && o.text !== '') {
    ctx.fillStyle = o.ink ?? color('--ink');
    ctx.font = mono(o.size ?? Math.max(11, Math.min(14, h * 0.42)), o.bold ? 650 : 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.text, x + w / 2, y + h / 2 + 0.5);
  }
}

/** Plain text in CSS px. */
export function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: { size?: number; ink?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; bold?: boolean; font?: 'mono' | 'sans' | 'serif'; italic?: boolean } = {},
): void {
  const size = o.size ?? 12;
  const fam = o.font === 'mono' ? MONO : o.font === 'serif' ? SERIF : SANS;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 600 : 400} ${size}px ${fam}`;
  ctx.fillStyle = o.ink ?? color('--ink-2');
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
}

/** A rectangle outline (for receptive fields and windows). */
export function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke: string, lw = 2, fillAlpha = 0): void {
  if (fillAlpha > 0) {
    ctx.fillStyle = withAlpha(stroke, fillAlpha);
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

/** Image i of a CIFAR set as 32x32 luminance values in 0..1. */
export function grayOf(set: CifarSet, i: number): Float64Array {
  const o = i * 3072;
  const g = new Float64Array(1024);
  for (let p = 0; p < 1024; p++) g[p] = (0.299 * set.pixels[o + p] + 0.587 * set.pixels[o + 1024 + p] + 0.114 * set.pixels[o + 2048 + p]) / 255;
  return g;
}

/** Paints an n x n grid of values (any range) as gray pixels into a scratch canvas, then draws it scaled. */
export function drawGray(ctx: CanvasRenderingContext2D, vals: ArrayLike<number>, n: number, x: number, y: number, size: number, map: (v: number) => number): void {
  const img = new ImageData(n, n);
  for (let p = 0; p < n * n; p++) {
    const g = Math.max(0, Math.min(255, Math.round(map(vals[p]) * 255)));
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = g;
    img.data[p * 4 + 3] = 255;
  }
  blit(ctx, img, x, y, size, size);
}

/** Draws an ImageData scaled to (w, h) with crisp pixels. */
export function blit(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number, w: number, h: number, smooth = false): void {
  const tmp = document.createElement('canvas');
  tmp.width = img.width;
  tmp.height = img.height;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(tmp, x, y, w, h);
  ctx.restore();
}

/** Compact counts: 34,944 -> "34,944"; 138344128 -> "138M". */
export function count(v: number, digits = 3): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${Number((v / 1e9).toPrecision(digits))}B`;
  if (a >= 1e6) return `${Number((v / 1e6).toPrecision(digits))}M`;
  if (a >= 1e4) return `${Number((v / 1e3).toPrecision(digits))}K`;
  return v.toLocaleString('en-US');
}

/** Human-readable bytes using 1024-based units (as the notes do). */
export function bytes(b: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let k = 0;
  while (b >= 1024 && k < u.length - 1) {
    b /= 1024;
    k++;
  }
  return `${Number(b.toPrecision(3))} ${u[k]}`;
}
