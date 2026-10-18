import type { CifarSet } from '../core/data';

/** A 32 x 32 RGB image as interleaved floats in 0..255. */
export type RGB = Float32Array;

export function cifarRGB(set: CifarSet, i: number): RGB {
  const out = new Float32Array(32 * 32 * 3);
  const o = i * 3072;
  for (let p = 0; p < 1024; p++) {
    out[p * 3] = set.pixels[o + p]!;
    out[p * 3 + 1] = set.pixels[o + 1024 + p]!;
    out[p * 3 + 2] = set.pixels[o + 2048 + p]!;
  }
  return out;
}

let tmp: HTMLCanvasElement | null = null;

/** Draws an RGB array of size w x h scaled into a square of `size` CSS px, pixels crisp. */
export function drawRGB(ctx: CanvasRenderingContext2D, img: RGB, w: number, h: number, x: number, y: number, sw: number, sh = sw): void {
  tmp ??= document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const id = new ImageData(w, h);
  for (let p = 0; p < w * h; p++) {
    id.data[p * 4] = img[p * 3]!;
    id.data[p * 4 + 1] = img[p * 3 + 1]!;
    id.data[p * 4 + 2] = img[p * 3 + 2]!;
    id.data[p * 4 + 3] = 255;
  }
  tmp.getContext('2d')!.putImageData(id, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, sw, sh);
  ctx.restore();
}

export const FEAT_NAMES = ['bright', 'blue', 'green', 'warm', 'texture'];

/**
 * Hand-made stand-ins for conv features: for each cell of a G x G grid over the image, five
 * numbers (brightness, blueness, greenness, warmth, texture), each standardized across cells.
 */
export function cellFeatures(img: RGB, G: number): { feats: number[][]; colors: [number, number, number][] } {
  const c = 32 / G;
  const gray = (x: number, y: number) => (img[(y * 32 + x) * 3]! + img[(y * 32 + x) * 3 + 1]! + img[(y * 32 + x) * 3 + 2]!) / 3;
  const raw: number[][] = [];
  const colors: [number, number, number][] = [];
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      let r = 0, g = 0, b = 0, tex = 0, n = 0;
      for (let y = gy * c; y < (gy + 1) * c; y++) {
        for (let x = gx * c; x < (gx + 1) * c; x++) {
          const o = (y * 32 + x) * 3;
          r += img[o]!;
          g += img[o + 1]!;
          b += img[o + 2]!;
          if (x + 1 < 32) tex += Math.abs(gray(x + 1, y) - gray(x, y));
          if (y + 1 < 32) tex += Math.abs(gray(x, y + 1) - gray(x, y));
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      colors.push([r, g, b]);
      raw.push([(r + g + b) / 3, b - (r + g) / 2, g - (r + b) / 2, r - b, tex / n]);
    }
  }
  const D = raw[0]!.length;
  for (let d = 0; d < D; d++) {
    const col = raw.map((v) => v[d]!);
    const mu = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - mu) ** 2, 0) / col.length) + 1e-6;
    raw.forEach((v) => (v[d] = (v[d]! - mu) / sd));
  }
  return { feats: raw, colors };
}

export function softmax(s: number[]): number[] {
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

/** Bilinear read of an RGB image at fractional pixel coordinates; zeros outside. */
export function bilinear(img: RGB, w: number, h: number, x: number, y: number, out: number[]): void {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const dx = x - x0, dy = y - y0;
  out[0] = out[1] = out[2] = 0;
  const add = (xx: number, yy: number, wt: number) => {
    if (wt === 0 || xx < 0 || yy < 0 || xx >= w || yy >= h) return;
    const o = (yy * w + xx) * 3;
    out[0]! += wt * img[o]!;
    out[1]! += wt * img[o + 1]!;
    out[2]! += wt * img[o + 2]!;
  };
  add(x0, y0, (1 - dx) * (1 - dy));
  add(x0 + 1, y0, dx * (1 - dy));
  add(x0, y0 + 1, (1 - dx) * dy);
  add(x0 + 1, y0 + 1, dx * dy);
}
