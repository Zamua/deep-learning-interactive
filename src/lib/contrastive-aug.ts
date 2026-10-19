import type { CifarSet } from '../core/data';
import type { Rng } from '../core/rand';

/** A 32 x 32 RGB image, row-major, channels interleaved, values 0..1. */
export type Img = Float32Array;
export const SIDE = 32;

export function fromCifar(set: CifarSet, i: number): Img {
  const out = new Float32Array(SIDE * SIDE * 3);
  const o = i * 3072;
  for (let p = 0; p < 1024; p++) for (let c = 0; c < 3; c++) out[p * 3 + c] = set.pixels[o + c * 1024 + p]! / 255;
  return out;
}

function sample(img: Img, x: number, y: number, c: number): number {
  const x0 = Math.max(0, Math.min(SIDE - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(SIDE - 1, Math.floor(y)));
  const x1 = Math.min(SIDE - 1, x0 + 1);
  const y1 = Math.min(SIDE - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = img[(y0 * SIDE + x0) * 3 + c]!;
  const b = img[(y0 * SIDE + x1) * 3 + c]!;
  const d = img[(y1 * SIDE + x0) * 3 + c]!;
  const e = img[(y1 * SIDE + x1) * 3 + c]!;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
}

/** Crop a random region covering `scale` of the area with aspect ratio in [3/4, 4/3], resized back to 32 x 32. */
export function randomResizedCrop(img: Img, r: Rng, lo = 0.25, hi = 1): { img: Img; box: [number, number, number, number] } {
  const area = SIDE * SIDE * r.uniform(lo, hi);
  const ratio = Math.exp(r.uniform(Math.log(3 / 4), Math.log(4 / 3)));
  const w = Math.min(SIDE, Math.sqrt(area * ratio));
  const h = Math.min(SIDE, Math.sqrt(area / ratio));
  const x0 = r.uniform(0, SIDE - w);
  const y0 = r.uniform(0, SIDE - h);
  const out = new Float32Array(SIDE * SIDE * 3);
  for (let i = 0; i < SIDE; i++)
    for (let j = 0; j < SIDE; j++)
      for (let c = 0; c < 3; c++) out[(i * SIDE + j) * 3 + c] = sample(img, x0 + ((j + 0.5) * w) / SIDE - 0.5, y0 + ((i + 0.5) * h) / SIDE - 0.5, c);
  return { img: out, box: [x0, y0, w, h] };
}

export function hflip(img: Img): Img {
  const out = new Float32Array(img.length);
  for (let i = 0; i < SIDE; i++)
    for (let j = 0; j < SIDE; j++)
      for (let c = 0; c < 3; c++) out[(i * SIDE + j) * 3 + c] = img[(i * SIDE + (SIDE - 1 - j)) * 3 + c]!;
  return out;
}

const LUMA = [0.299, 0.587, 0.114];
const lum = (img: Img, p: number) => LUMA[0]! * img[p * 3]! + LUMA[1]! * img[p * 3 + 1]! + LUMA[2]! * img[p * 3 + 2]!;

/** Brightness, contrast, saturation, then a hue rotation about the gray axis. */
export function colorJitter(img: Img, r: Rng, b = 0.4, c = 0.4, s = 0.4, h = 0.1): Img {
  const out = Float32Array.from(img);
  const fb = r.uniform(1 - b, 1 + b);
  const fc = r.uniform(1 - c, 1 + c);
  const fs = r.uniform(1 - s, 1 + s);
  const th = r.uniform(-h, h) * 2 * Math.PI;
  const n = SIDE * SIDE;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * fb;
  let mean = 0;
  for (let p = 0; p < n; p++) mean += lum(out, p) / n;
  for (let i = 0; i < out.length; i++) out[i] = mean + (out[i]! - mean) * fc;
  for (let p = 0; p < n; p++) {
    const g = lum(out, p);
    for (let k = 0; k < 3; k++) out[p * 3 + k] = g + (out[p * 3 + k]! - g) * fs;
  }
  // Rodrigues rotation of the RGB vector about (1, 1, 1) / sqrt(3).
  const cs = Math.cos(th), sn = Math.sin(th), k = (1 - cs) / 3, q = sn / Math.sqrt(3);
  const M = [cs + k, k - q, k + q, k + q, cs + k, k - q, k - q, k + q, cs + k];
  for (let p = 0; p < n; p++) {
    const R = out[p * 3]!, G = out[p * 3 + 1]!, B = out[p * 3 + 2]!;
    out[p * 3] = M[0]! * R + M[1]! * G + M[2]! * B;
    out[p * 3 + 1] = M[3]! * R + M[4]! * G + M[5]! * B;
    out[p * 3 + 2] = M[6]! * R + M[7]! * G + M[8]! * B;
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, out[i]!));
  return out;
}

export function grayscale(img: Img): Img {
  const out = new Float32Array(img.length);
  for (let p = 0; p < SIDE * SIDE; p++) {
    const g = lum(img, p);
    out[p * 3] = out[p * 3 + 1] = out[p * 3 + 2] = g;
  }
  return out;
}

export interface AugOpts {
  crop: boolean;
  flip: boolean;
  color: boolean;
  gray: boolean;
}

/** SimCLR's CIFAR-10 recipe: crop, flip, color jitter (p = 0.8), grayscale (p = 0.2). */
export function augmentImage(img: Img, r: Rng, o: AugOpts): { img: Img; box: [number, number, number, number]; flipped: boolean } {
  let out = img;
  let box: [number, number, number, number] = [0, 0, SIDE, SIDE];
  let flipped = false;
  if (o.crop) ({ img: out, box } = randomResizedCrop(out, r));
  if (o.flip && r.next() < 0.5) {
    out = hflip(out);
    flipped = true;
  }
  if (o.color && r.next() < 0.8) out = colorJitter(out, r);
  if (o.gray && r.next() < 0.2) out = grayscale(out);
  return { img: out, box, flipped };
}

const cache = new WeakMap<Img, HTMLCanvasElement>();

/** The image as a 32 x 32 canvas, cached per array. */
export function imgCanvas(img: Img): HTMLCanvasElement {
  let c = cache.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = SIDE;
  const d = new ImageData(SIDE, SIDE);
  for (let p = 0; p < SIDE * SIDE; p++) {
    for (let k = 0; k < 3; k++) d.data[p * 4 + k] = Math.round(img[p * 3 + k]! * 255);
    d.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(d, 0, 0);
  cache.set(img, c);
  return c;
}

export function drawImg(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, size: number): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imgCanvas(img), x, y, size, size);
  ctx.restore();
}

// ---------------------------------------------------------------- MAE

export const PATCH = 4;
export const GRID = SIDE / PATCH;
export const NPATCH = GRID * GRID;

/** MAE's random masking: shuffle the patch ids, keep the first (1 - ratio) of them. */
export function randomMask(r: Rng, ratio: number): { keep: number[]; masked: number[] } {
  const noise = Array.from({ length: NPATCH }, () => r.next());
  const ids = Array.from({ length: NPATCH }, (_, i) => i).sort((a, b) => noise[a]! - noise[b]!);
  const nKeep = Math.round(NPATCH * (1 - ratio));
  return { keep: ids.slice(0, nKeep), masked: ids.slice(nKeep) };
}

/** Same masking, but the ordering is fixed and only the count changes, so a slider reveals patches smoothly. */
export function maskFromOrder(order: number[], ratio: number): { keep: number[]; masked: number[] } {
  const nKeep = Math.round(NPATCH * (1 - ratio));
  return { keep: order.slice(0, nKeep), masked: order.slice(nKeep) };
}

/**
 * A no-learning stand-in for MAE's decoder: every hidden pixel becomes an inverse-distance
 * weighted average of the visible pixels (weights 1 / d^4), so near neighbors dominate.
 */
export function naiveFill(img: Img, keep: number[]): Img {
  const vis = new Uint8Array(NPATCH);
  for (const k of keep) vis[k] = 1;
  const isVis = (p: number) => vis[Math.floor(Math.floor(p / SIDE) / PATCH) * GRID + Math.floor((p % SIDE) / PATCH)] === 1;
  const vp: number[] = [];
  for (let p = 0; p < SIDE * SIDE; p++) if (isVis(p)) vp.push(p);
  const out = Float32Array.from(img);
  if (!vp.length) {
    out.fill(0.5);
    return out;
  }
  for (let p = 0; p < SIDE * SIDE; p++) {
    if (isVis(p)) continue;
    const py = Math.floor(p / SIDE), px = p % SIDE;
    let ws = 0, r = 0, g = 0, b = 0;
    for (const q of vp) {
      const dy = Math.floor(q / SIDE) - py, dx = (q % SIDE) - px;
      const d2 = dx * dx + dy * dy;
      const w = 1 / (d2 * d2);
      ws += w;
      r += w * img[q * 3]!;
      g += w * img[q * 3 + 1]!;
      b += w * img[q * 3 + 2]!;
    }
    out[p * 3] = r / ws;
    out[p * 3 + 1] = g / ws;
    out[p * 3 + 2] = b / ws;
  }
  return out;
}

/** Mean squared error over the masked patches only, as MAE's loss is computed. */
export function maskedMSE(pred: Img, img: Img, masked: number[]): number {
  if (!masked.length) return 0;
  let s = 0;
  for (const k of masked) {
    const gy = Math.floor(k / GRID), gx = k % GRID;
    for (let i = 0; i < PATCH; i++)
      for (let j = 0; j < PATCH; j++) {
        const p = (gy * PATCH + i) * SIDE + gx * PATCH + j;
        for (let c = 0; c < 3; c++) s += (pred[p * 3 + c]! - img[p * 3 + c]!) ** 2;
      }
  }
  return s / (masked.length * PATCH * PATCH * 3);
}
