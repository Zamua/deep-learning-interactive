import type { Fig } from '../core/page';
import { type CifarSet, cifarImage } from '../core/data';
import { h } from '../core/dom';
import { color, rgbOf } from '../core/plot';
import type { Color } from '../core/symbols';

export type K = Color | `--${string}`;

const CSS = `
.vit-thumbs{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.vit-thumbs button{padding:0;border:2px solid transparent;border-radius:7px;background:none;cursor:pointer;line-height:0}
.vit-thumbs button[aria-pressed=true]{border-color:var(--accent)}
.vit-thumbs canvas{width:34px;height:34px;image-rendering:pixelated;border-radius:4px;display:block}
`;

export function installCss(root: HTMLElement): void {
  if (root.querySelector('style[data-vit]')) return;
  const st = document.createElement('style');
  st.dataset.vit = '1';
  st.textContent = CSS;
  root.prepend(st);
}

const canvases = new Map<string, HTMLCanvasElement>();
/** Image i of a CIFAR set as a cached 32 x 32 canvas. */
export function imgCanvas(set: CifarSet, i: number): HTMLCanvasElement {
  const key = `${set.n}-${i}`;
  let c = canvases.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 32;
    c.getContext('2d')!.putImageData(cifarImage(set, i), 0, 0);
    canvases.set(key, c);
  }
  return c;
}

/** Draws a source rectangle of a 32 x 32 canvas with crisp pixels. */
export function blit(ctx: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, hh: number, sx = 0, sy = 0, sw = 32, sh = 32): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, sx, sy, sw, sh, x, y, w, hh);
  ctx.restore();
}

/** A row of tappable thumbnails; returns a setter for the selection. */
export function thumbs(f: Fig, set: CifarSet, ids: number[], cur: number, onPick: (id: number) => void): (id: number) => void {
  const btns = ids.map((id) => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    c.getContext('2d')!.putImageData(cifarImage(set, id), 0, 0);
    const b = h('button', { type: 'button', 'aria-label': `image ${id}`, 'aria-pressed': String(id === cur) }, c);
    b.addEventListener('click', () => {
      mark(id);
      onPick(id);
    });
    return b;
  });
  const mark = (id: number) => btns.forEach((b, k) => b.setAttribute('aria-pressed', String(ids[k] === id)));
  f.controls.prepend(h('div', { class: 'vit-thumbs' }, ...btns));
  return mark;
}

/** Diverging color for v in [-1, 1]: negative toward `neg`, positive toward `pos`, 0 = paper. */
export function diverging(neg: K, pos: K): (v: number) => [number, number, number] {
  const p0 = rgbOf(color('--paper'));
  const n = rgbOf(color(neg));
  const q = rgbOf(color(pos));
  return (v) => {
    const a = Math.min(1, Math.abs(v));
    const c = v < 0 ? n : q;
    return [p0[0] + (c[0] - p0[0]) * a, p0[1] + (c[1] - p0[1]) * a, p0[2] + (c[2] - p0[2]) * a];
  };
}

/** Draws a rows x cols matrix as a heatmap filling (x, y, w, h); values scaled by `scale`. */
export function heatmap(ctx: CanvasRenderingContext2D, data: ArrayLike<number>, rows: number, cols: number, x: number, y: number, w: number, hh: number, col: (v: number) => [number, number, number], scale: number): void {
  const img = new ImageData(cols, rows);
  for (let i = 0; i < rows * cols; i++) {
    const [r, g, b] = col(data[i]! / scale);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = cols;
  tmp.height = rows;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  blit(ctx, tmp, x, y, w, hh, 0, 0, cols, rows);
}

export function maxAbs(a: ArrayLike<number>): number {
  let m = 1e-9;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]!));
  return m;
}

export const FONT = {
  ui: (px: number, wt = 500) => `${wt} ${px}px system-ui, -apple-system, sans-serif`,
  mono: (px: number, wt = 500) => `${wt} ${px}px 'JetBrains Mono Variable', ui-monospace, monospace`,
  serif: (px: number, wt = 600) => `italic ${wt} ${px}px 'Source Serif 4 Variable', Georgia, serif`,
};

export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { font?: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {}): void {
  ctx.font = o.font ?? FONT.ui(12);
  ctx.fillStyle = o.color ?? color('--ink-2');
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
}

/** Below 560 px of canvas width, figures stack their panels vertically. */
export const isTall = (w: number): boolean => w < 560;

/**
 * Sizes a canvas to its content: sets the aspect ratio so its height becomes `need` px at width
 * `w`. The resize that follows redraws it, and the next pass finds the height already right.
 */
export function fit(c: HTMLCanvasElement, w: number, hh: number, need: number): void {
  if (Math.abs(hh - need) < 2) return;
  c.style.aspectRatio = `${Math.round(w)} / ${Math.round(need)}`;
}
