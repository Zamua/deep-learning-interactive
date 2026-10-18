/** Drawing helpers and an image picker for the visualizing chapter. */
import { CIFAR_CLASSES, type CifarSet } from '../core/data';
import type { Fig } from '../core/page';
import { color, withAlpha } from '../core/plot';

const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];
const INFERNO: [number, number, number][] = [
  [0, 0, 4],
  [87, 16, 110],
  [188, 55, 84],
  [249, 142, 9],
  [252, 255, 164],
];

function ramp(stops: [number, number, number][], t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  const f = u - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const viridis = (t: number) => ramp(VIRIDIS, t);
export const inferno = (t: number) => ramp(INFERNO, t);

const scratch = new Map<string, HTMLCanvasElement>();
function offscreen(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  let c = scratch.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    scratch.set(key, c);
  }
  return c;
}

/** Blits an RGBA ImageData scaled to (x, y, w, h) with crisp or smooth pixels. */
export function blit(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number, w: number, h: number, smooth = false): void {
  const c = offscreen(img.width, img.height);
  c.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(c, x, y, w, h);
  ctx.restore();
}

/** A network input (3 x 32 x 32, mean-subtracted) as an image: add the mean back and clip. */
export function inputImage(x: Float32Array, mean: number[]): ImageData {
  const img = new ImageData(32, 32);
  for (let q = 0; q < 1024; q++) {
    for (let c = 0; c < 3; c++) img.data[q * 4 + c] = Math.max(0, Math.min(255, (x[c * 1024 + q]! + mean[c]!) * 255));
    img.data[q * 4 + 3] = 255;
  }
  return img;
}

/** A 3 x n x n tensor with each value stretched so its own min and max fill 0..255 (or symmetric around 0). */
export function stretchedImage(x: ArrayLike<number>, n: number, offset = 0, symmetric = false): ImageData {
  let mn = Infinity;
  let mx = -Infinity;
  const N = n * n;
  for (let i = 0; i < 3 * N; i++) {
    mn = Math.min(mn, x[offset + i]!);
    mx = Math.max(mx, x[offset + i]!);
  }
  if (symmetric) {
    const m = Math.max(Math.abs(mn), Math.abs(mx));
    mn = -m;
    mx = m;
  }
  const img = new ImageData(n, n);
  const s = 255 / (mx - mn || 1);
  for (let q = 0; q < N; q++) {
    for (let c = 0; c < 3; c++) img.data[q * 4 + c] = (x[offset + c * N + q]! - mn) * s;
    img.data[q * 4 + 3] = 255;
  }
  return img;
}

/** One channel of an activation volume as a colormapped image, scaled by `max` (default: its own max). */
export function mapImage(data: ArrayLike<number>, offset: number, n: number, max?: number, cmap = inferno, min = 0): ImageData {
  let hi = max ?? -Infinity;
  if (max === undefined) for (let i = 0; i < n * n; i++) hi = Math.max(hi, data[offset + i]!);
  const img = new ImageData(n, n);
  const span = hi - min || 1;
  for (let i = 0; i < n * n; i++) {
    const [r, g, b] = cmap((data[offset + i]! - min) / span);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

/** CIFAR image i of a set as ImageData. */
export function cifarImg(set: CifarSet, i: number): ImageData {
  const img = new ImageData(32, 32);
  const o = i * 3072;
  for (let q = 0; q < 1024; q++) {
    img.data[q * 4] = set.pixels[o + q]!;
    img.data[q * 4 + 1] = set.pixels[o + 1024 + q]!;
    img.data[q * 4 + 2] = set.pixels[o + 2048 + q]!;
    img.data[q * 4 + 3] = 255;
  }
  return img;
}

/** Small caption text in canvas px. */
export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, opts: { align?: CanvasTextAlign; size?: number; color?: string; bold?: boolean; mono?: boolean; base?: CanvasTextBaseline } = {}): void {
  ctx.fillStyle = opts.color ?? color('--ink-2');
  ctx.font = `${opts.bold ? '600 ' : ''}${opts.size ?? 12}px ${opts.mono ? "'JetBrains Mono Variable', ui-monospace, monospace" : 'system-ui, sans-serif'}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
}

/** Horizontal bars of class probabilities; `mark` gets an outline (the true or target class). */
export function probBars(ctx: CanvasRenderingContext2D, probs: ArrayLike<number>, x: number, y: number, w: number, h: number, opts: { mark?: number; mark2?: number } = {}): void {
  const rowH = h / 10;
  const lw = Math.min(46, w * 0.32);
  for (let k = 0; k < 10; k++) {
    const yy = y + k * rowH;
    const p = probs[k]!;
    const on = k === opts.mark;
    const on2 = k === opts.mark2;
    label(ctx, CIFAR_CLASSES[k]!, x + lw - 4, yy + rowH / 2, { align: 'right', base: 'middle', size: Math.min(12, Math.max(11, rowH * 0.62)), bold: on || on2, color: on2 ? color('red') : on ? color('--ink') : color('--ink-3') });
    const bw = (w - lw - 36) * p;
    ctx.fillStyle = withAlpha(on2 ? color('red') : color('purple'), on || on2 ? 0.9 : 0.45);
    ctx.fillRect(x + lw, yy + rowH * 0.18, Math.max(1, bw), rowH * 0.64);
    label(ctx, `${(p * 100).toFixed(p < 0.095 ? 1 : 0)}%`, x + lw + bw + 4, yy + rowH / 2, { align: 'left', base: 'middle', size: 11, mono: true, color: color('--ink-3') });
  }
}

export interface Picker {
  get index(): number;
  set(i: number): void;
  redraw(): void;
}

/**
 * A tappable strip of CIFAR thumbnails. `items` are indices into `set` (or null until loaded);
 * the chosen one gets a ring.
 */
export function imagePicker(f: Fig, onPick: (i: number) => void, rows = 2): Picker & { setItems(set: CifarSet, items: number[]): void } {
  let set: CifarSet | null = null;
  let items: number[] = [];
  let cur = 0;
  const perRow = 10;
  const cv = f.canvas(640, 64 * rows + 4, (ctx, w) => {
    if (!set) return;
    const gap = 4;
    const size = (w - gap * (perRow - 1)) / perRow;
    items.forEach((idx, k) => {
      const x = (k % perRow) * (size + gap);
      const y = Math.floor(k / perRow) * (size + gap) + 2;
      blit(ctx, cifarImg(set!, idx), x, y, size, size);
      if (k === cur) {
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
      }
    });
  });
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.style.background = 'transparent';
  cv.canvas.style.border = '0';
  cv.canvas.style.aspectRatio = `${640} / ${(640 - 36) / 10 * rows + 4 * (rows - 1) + 4}`;
  cv.canvas.addEventListener('click', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const gap = 4;
    const size = (r.width - gap * (perRow - 1)) / perRow;
    const col = Math.floor((e.clientX - r.left) / (size + gap));
    const row = Math.floor((e.clientY - r.top) / (size + gap));
    const k = row * perRow + col;
    if (k >= 0 && k < items.length) {
      cur = k;
      cv.redraw();
      onPick(items[k]!);
    }
  });
  return {
    get index() {
      return items[cur] ?? 0;
    },
    set(i: number) {
      const k = items.indexOf(i);
      if (k >= 0) cur = k;
      cv.redraw();
    },
    redraw: cv.redraw,
    setItems(s: CifarSet, it: number[]) {
      set = s;
      items = it;
      cv.redraw();
    },
  };
}
