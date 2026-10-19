import { type CifarSet, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import { l1, l2 } from '../../lib/image-classification-knn';
import type { Scene } from '../../lecture/scene';

export type Which = 'train' | 'test';

let sets: { train: CifarSet; test: CifarSet } | null = null;
let waiting: Plot | null = null;

loadCifar()
  .then((c) => {
    sets = c;
    waiting?.redraw();
  })
  .catch(() => {});

/** The CIFAR sample, or null while it loads (the stage redraws once it lands). */
export function cifar(s: Scene): { train: CifarSet; test: CifarSet } | null {
  if (!sets) waiting = s.p;
  return sets;
}

const canvases = new Map<string, HTMLCanvasElement>();

/** A 32 x 32 canvas from 3072 channel-major values (clamped to 0..255), cached by key. */
export function chwCanvas(key: string, px: ArrayLike<number>, off = 0): HTMLCanvasElement {
  let c = canvases.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const img = new ImageData(32, 32);
  for (let q = 0; q < 1024; q++) {
    for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = Math.max(0, Math.min(255, Math.round(px[off + ch * 1024 + q]!)));
    img.data[q * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  canvases.set(key, c);
  return c;
}

/** One row of 1024 pixels: the image's 32 rows laid end to end, as a flattened vector looks. */
export function stripCanvas(set: CifarSet, which: Which, i: number): HTMLCanvasElement {
  const key = `strip-${which}-${i}`;
  let c = canvases.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1;
  const img = new ImageData(1024, 1);
  const o = i * 3072;
  for (let q = 0; q < 1024; q++) {
    for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = set.pixels[o + ch * 1024 + q]!;
    img.data[q * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  canvases.set(key, c);
  return c;
}

/** Draws a 32 x 32 canvas crisp at (x, y), `size` px square, with a hairline frame. */
export function blit(s: Scene, c: HTMLCanvasElement | null, x: number, y: number, size: number, frame: string | null = s.c('--rule')): void {
  const ctx = s.ctx;
  if (c) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x, y, size, size);
    ctx.restore();
  } else s.rrect(x, y, size, size, 0.6, { fill: s.c('--paper-2') });
  if (frame) {
    ctx.strokeStyle = frame;
    ctx.lineWidth = Math.max(1, s.u * 0.25);
    ctx.strokeRect(x, y, size, size);
  }
}

/** Draws CIFAR image i of a set (or a placeholder while the sample loads). */
export function photo(s: Scene, which: Which, i: number, x: number, y: number, size: number, frame?: string | null): void {
  const d = cifar(s);
  blit(s, d ? chwCanvas(`${which}-${i}`, d[which].pixels, i * 3072) : null, x, y, size, frame);
}

/** Byte at channel ch, row r, column c of image i. */
export function px(set: CifarSet, i: number, ch: number, r: number, c: number): number {
  return set.pixels[i * 3072 + ch * 1024 + r * 32 + c]!;
}

const memo = new Map<string, unknown>();
function once<T>(key: string, f: () => T): T {
  if (!memo.has(key)) memo.set(key, f());
  return memo.get(key) as T;
}

/** Indices sorted by distance, ties by index, first k. */
export function nearestK(row: ArrayLike<number>, k: number, skip?: (j: number) => boolean): number[] {
  const idx: number[] = [];
  for (let j = 0; j < row.length; j++) if (!skip?.(j)) idx.push(j);
  idx.sort((a, b) => row[a]! - row[b]! || a - b);
  return idx.slice(0, k);
}

/** Distances from test image q to every training image. */
export function distRow(d: { train: CifarSet; test: CifarSet }, q: number, metric: 'L1' | 'L2'): Float64Array {
  return once(`row-${q}-${metric}`, () => {
    const f = metric === 'L1' ? l1 : l2;
    const out = new Float64Array(d.train.n);
    for (let j = 0; j < d.train.n; j++) out[j] = f(d.test.pixels, q, d.train.pixels, j);
    return out;
  });
}

/** 1-NN (L1) predictions for the first n test images. */
export function firstPreds(d: { train: CifarSet; test: CifarSet }, n: number): number[] {
  return once(`preds-${n}`, () => Array.from({ length: n }, (_, q) => d.train.labels[nearestK(distRow(d, q, 'L1'), 1)[0]!]!));
}

/** I1 - I2 for a test and a training image, channel-major. */
export function signedDiff(d: { train: CifarSet; test: CifarSet }, q: number, j: number): Float64Array {
  return once(`diff-${q}-${j}`, () => {
    const out = new Float64Array(3072);
    for (let p = 0; p < 3072; p++) out[p] = d.test.pixels[q * 3072 + p]! - d.train.pixels[j * 3072 + p]!;
    return out;
  });
}

export interface Edits {
  shifted: Float64Array;
  darker: Float64Array;
  boxed: Float64Array;
  other: number;
  /** L2 distances from the original to shifted, darker, boxed, other. */
  ds: number[];
}

/** The chapter's "fooled" experiment for training image i: shift 4 px, 60% light, a 12 px black box. */
export function edits(d: { train: CifarSet; test: CifarSet }, i: number): Edits {
  return once(`edits-${i}`, () => {
    const tr = d.train;
    const shifted = new Float64Array(3072);
    const darker = new Float64Array(3072);
    const boxed = new Float64Array(3072);
    for (let ch = 0; ch < 3; ch++)
      for (let r = 0; r < 32; r++)
        for (let c = 0; c < 32; c++) {
          const q = ch * 1024 + r * 32 + c;
          const v = tr.pixels[i * 3072 + q]!;
          shifted[q] = tr.pixels[i * 3072 + ch * 1024 + r * 32 + ((c - 4 + 32) % 32)]!;
          darker[q] = v * 0.6;
          boxed[q] = r >= 10 && r < 22 && c >= 10 && c < 22 ? 0 : v;
        }
    const to = (v: Float64Array) => {
      let s = 0;
      for (let q = 0; q < 3072; q++) s += (tr.pixels[i * 3072 + q]! - v[q]!) ** 2;
      return Math.sqrt(s);
    };
    let other = -1;
    let best = Infinity;
    for (let j = 0; j < tr.n; j++) {
      if (tr.labels[j] === tr.labels[i]) continue;
      const v = l2(tr.pixels, i, tr.pixels, j);
      if (v < best) {
        best = v;
        other = j;
      }
    }
    return { shifted, darker, boxed, other, ds: [to(shifted), to(darker), to(boxed), best] };
  });
}

/** Gradient magnitude of image i's brightness: a crude edge map, scaled to 0..255. */
export function edgeMap(d: { train: CifarSet; test: CifarSet }, i: number): Float64Array {
  return once(`edges-${i}`, () => {
    const g = new Float64Array(1024);
    for (let q = 0; q < 1024; q++) g[q] = (px(d.train, i, 0, q >> 5, q & 31) + px(d.train, i, 1, q >> 5, q & 31) + px(d.train, i, 2, q >> 5, q & 31)) / 3;
    const at = (r: number, c: number) => g[Math.max(0, Math.min(31, r)) * 32 + Math.max(0, Math.min(31, c))]!;
    const e = new Float64Array(3072);
    let mx = 1;
    for (let r = 0; r < 32; r++)
      for (let c = 0; c < 32; c++) {
        const gx = at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1) - at(r - 1, c - 1) - 2 * at(r, c - 1) - at(r + 1, c - 1);
        const gy = at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1) - at(r - 1, c - 1) - 2 * at(r - 1, c) - at(r - 1, c + 1);
        const m = Math.hypot(gx, gy);
        e[r * 32 + c] = m;
        mx = Math.max(mx, m);
      }
    for (let q = 0; q < 1024; q++) e[q] = e[1024 + q] = e[2048 + q] = Math.min(255, (e[q]! / mx) * 400);
    return e;
  });
}

/** The average training image of each class. */
export function classMeans(d: { train: CifarSet; test: CifarSet }): Float64Array[] {
  return once('means', () => {
    const sums = Array.from({ length: 10 }, () => new Float64Array(3072));
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < d.train.n; i++) {
      const c = d.train.labels[i]!;
      counts[c]!++;
      for (let q = 0; q < 3072; q++) sums[c]![q]! += d.train.pixels[i * 3072 + q]!;
    }
    sums.forEach((m, c) => m.forEach((v, q) => (m[q] = v / counts[c]!)));
    return sums;
  });
}

/** The chapter's concentration experiment: distances from one random point to 500 others, in D dims. */
export function concentration(D: number): { hist: number[]; ratio: number } {
  return once(`conc-${D}`, () => {
    const rng = new Rng(7);
    const q = new Float64Array(D);
    for (let t = 0; t < D; t++) q[t] = rng.next();
    const ds = new Float64Array(500);
    for (let i = 0; i < 500; i++) {
      let s = 0;
      for (let t = 0; t < D; t++) {
        const v = rng.next() - q[t]!;
        s += v * v;
      }
      ds[i] = Math.sqrt(s);
    }
    let mx = 0;
    let mn = Infinity;
    for (const v of ds) {
      mx = Math.max(mx, v);
      mn = Math.min(mn, v);
    }
    const hist = new Array<number>(30).fill(0);
    for (const v of ds) hist[Math.min(29, Math.floor((v / mx) * 30))]!++;
    return { hist, ratio: mn / mx };
  });
}
