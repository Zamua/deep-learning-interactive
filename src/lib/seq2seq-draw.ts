import { color, rgbOf, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { MONO, SANS, rbox, text } from './rnn-draw';

export { MONO, SANS, arrow, rbox, text } from './rnn-draw';

/** Resizes a fixed-aspect canvas to `need` px tall; true when it did (a redraw follows). */
export function fitHeight(canvas: HTMLCanvasElement, w: number, h: number, need: number): boolean {
  if (Math.abs(need - h) <= 2) return false;
  canvas.style.aspectRatio = `${w} / ${Math.round(need)}`;
  return true;
}

/** A vector drawn as a small grid of cells: tinted `col` for positive, slate for negative. */
export function heat(ctx: CanvasRenderingContext2D, vals: ArrayLike<number>, x: number, y: number, cols: number, cs: number, col: string, scale = 1): void {
  const rows = Math.ceil(vals.length / cols);
  const neg = color('slate');
  for (let i = 0; i < vals.length; i++) {
    const v = Math.max(-1, Math.min(1, vals[i]! / scale));
    ctx.fillStyle = withAlpha(v >= 0 ? col : neg, 0.06 + 0.84 * Math.abs(v));
    ctx.fillRect(x + (i % cols) * cs, y + Math.floor(i / cols) * cs, cs - 0.6, cs - 0.6);
  }
  ctx.strokeStyle = withAlpha(col, 0.55);
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, cols * cs + 1.4, rows * cs + 1.4);
}

/** A rounded word chip centered at (cx, cy); returns its width. */
export function chip(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, k: Color, o: { size?: number; on?: boolean; dim?: boolean; maxW?: number } = {}): number {
  const size = o.size ?? 12;
  ctx.font = `600 ${size}px ${MONO}`;
  let tw = ctx.measureText(label).width;
  let fs = size;
  if (o.maxW && tw + 10 > o.maxW) {
    fs = Math.max(9, size * ((o.maxW - 8) / tw));
    ctx.font = `600 ${fs}px ${MONO}`;
    tw = ctx.measureText(label).width;
  }
  const w = tw + 10;
  const h = fs + 9;
  const c = color(k);
  ctx.globalAlpha = o.dim ? 0.3 : 1;
  rbox(ctx, cx - w / 2, cy - h / 2, w, h, 6, withAlpha(c, o.on ? 0.3 : 0.12), withAlpha(c, o.on ? 1 : 0.6), o.on ? 2 : 1);
  text(ctx, label, cx, cy + 0.5, { font: 'mono', size: fs, weight: 600, color: color('--ink') });
  ctx.globalAlpha = 1;
  return w;
}

/** Fills a square region with a per-cell color function over data coords [x0, x1] x [y0, y1] (y up). */
export function field(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, dom: [number, number, number, number], f: (x: number, y: number) => [number, number, number, number], cell = 4): void {
  const cols = Math.max(1, Math.ceil(pw / cell));
  const rows = Math.max(1, Math.ceil(ph / cell));
  const img = new ImageData(cols, rows);
  const [x0, x1, y0, y1] = dom;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const [r, g, b, a] = f(x0 + ((i + 0.5) / cols) * (x1 - x0), y1 - ((j + 0.5) / rows) * (y1 - y0));
      const o = (j * cols + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
  const tmp = document.createElement('canvas');
  tmp.width = cols;
  tmp.height = rows;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, px, py, pw, ph);
  ctx.restore();
}

/** The palette color `k` as an RGB triple in 0..255, read from the live theme. */
export const rgbK = (k: Color): [number, number, number] => rgbOf(color(k));

/** A label in the UI font, left-aligned, for legends and small captions inside canvases. */
export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, col = color('--ink-2'), size = 11.5, align: CanvasTextAlign = 'left'): void {
  ctx.font = `${size}px ${SANS}`;
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Longest-common-subsequence marks: which output words are in the reference, in order. */
export function lcsMarks(out: string[], ref: string[]): boolean[] {
  const n = out.length, m = ref.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i]![j] = out[i] === ref[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const ok = new Array<boolean>(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (out[i] === ref[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++;
    else j++;
  }
  return ok;
}
