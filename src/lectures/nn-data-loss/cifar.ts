import { loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import type { Scene } from '../../lecture/scene';
import { eigSym } from '../../lib/nn-data-loss-linalg';

const D = 256;
/** Eight sample classes: car, horse, ship, cat, plane, truck, deer, bird. */
const WANT = [1, 7, 8, 3, 0, 9, 4, 2];

interface Pca {
  mu: Float64Array;
  d: Float64Array;
  V: Float64Array;
  samples: Float64Array[];
  /** Color originals, and the mean image, as 32 x 32 RGB channel-major values. */
  color: Float64Array[];
  meanImg: Float64Array;
}

let pca: Pca | null = null;
let waiting: Plot | null = null;

loadCifar()
  .then(({ train }) => {
    // Let the first frames paint before the eigensolve.
    setTimeout(() => {
      const n = train.n;
      const X = new Float64Array(n * D);
      for (let i = 0; i < n; i++) {
        const o = i * 3072;
        for (let r = 0; r < 16; r++)
          for (let c = 0; c < 16; c++) {
            let g = 0;
            for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
              const q = (2 * r + dr) * 32 + 2 * c + dc;
              g += 0.299 * train.pixels[o + q]! + 0.587 * train.pixels[o + 1024 + q]! + 0.114 * train.pixels[o + 2048 + q]!;
            }
            X[i * D + r * 16 + c] = g / (4 * 255);
          }
      }
      const mu = new Float64Array(D);
      for (let i = 0; i < n; i++) for (let q = 0; q < D; q++) mu[q]! += X[i * D + q]! / n;
      const cov = new Float64Array(D * D);
      const row = new Float64Array(D);
      for (let i = 0; i < n; i++) {
        for (let q = 0; q < D; q++) row[q] = X[i * D + q]! - mu[q]!;
        for (let a = 0; a < D; a++) {
          const ra = row[a]!;
          const base = a * D;
          for (let b = a; b < D; b++) cov[base + b]! += ra * row[b]!;
        }
      }
      for (let a = 0; a < D; a++)
        for (let b = a; b < D; b++) {
          cov[a * D + b]! /= n;
          cov[b * D + a] = cov[a * D + b]!;
        }
      const E = eigSym(cov, D);
      // a stable sign per eigenvector, so the pictures never flip
      for (let j = 0; j < D; j++) {
        let s = 0;
        for (let q = 0; q < D; q++) s += E.V[q * D + j]!;
        if (s < 0) for (let q = 0; q < D; q++) E.V[q * D + j] = -E.V[q * D + j]!;
      }
      const picks: number[] = [];
      for (const c of WANT) for (let i = 0; i < n; i++) if (train.labels[i] === c && !picks.includes(i)) {
        picks.push(i);
        break;
      }
      const meanImg = new Float64Array(3072);
      for (let i = 0; i < n; i++) for (let q = 0; q < 3072; q++) meanImg[q]! += train.pixels[i * 3072 + q]! / n;
      pca = {
        mu,
        d: E.d,
        V: E.V,
        samples: picks.map((i) => X.slice(i * D, i * D + D)),
        color: picks.map((i) => Float64Array.from(train.pixels.subarray(i * 3072, i * 3072 + 3072))),
        meanImg,
      };
      waiting?.redraw();
    }, 30);
  })
  .catch(() => {});

/** The PCA of the gray CIFAR sample, or null while it loads (the stage redraws once it lands). */
export function cifarPca(s: Scene): Pca | null {
  if (!pca) waiting = s.p;
  return pca;
}

const cache = new Map<string, HTMLCanvasElement>();

function grayCanvas(key: string, v: ArrayLike<number>, lo: number, hi: number): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 16;
  const img = new ImageData(16, 16);
  const span = hi - lo || 1;
  for (let p = 0; p < 256; p++) {
    const g = Math.max(0, Math.min(255, (255 * (v[p]! - lo)) / span));
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = g;
    img.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

const minmax = (v: ArrayLike<number>): [number, number] => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < v.length; i++) {
    lo = Math.min(lo, v[i]!);
    hi = Math.max(hi, v[i]!);
  }
  return [lo, hi];
};

export function original(p: Pca, i: number): HTMLCanvasElement {
  return grayCanvas(`o${i}`, p.samples[i]!, 0, 1);
}

/** Eigenvector j as a picture, contrast-stretched. */
export function eigenImage(p: Pca, j: number): HTMLCanvasElement {
  const v = Float64Array.from({ length: D }, (_, q) => p.V[q * D + j]!);
  const [lo, hi] = minmax(v);
  return grayCanvas(`e${j}`, v, lo, hi);
}

/** Sample i rotated into the top k eigenvectors and back to pixels. */
export function rebuilt(p: Pca, i: number, k: number): HTMLCanvasElement {
  const key = `r${i}-${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = p.samples[i]!;
  const out = Float64Array.from(p.mu);
  for (let j = 0; j < k; j++) {
    let c = 0;
    for (let q = 0; q < D; q++) c += (s[q]! - p.mu[q]!) * p.V[q * D + j]!;
    for (let q = 0; q < D; q++) out[q]! += c * p.V[q * D + j]!;
  }
  return grayCanvas(key, out, 0, 1);
}

/** Fraction of the total variance carried by the top k directions. */
export function kept(p: Pca, k: number): number {
  let a = 0;
  let t = 0;
  for (let j = 0; j < D; j++) {
    t += p.d[j]!;
    if (j < k) a += p.d[j]!;
  }
  return a / t;
}

/** A 32 x 32 color canvas from channel-major values, offset by `add`, cached by key. */
export function colorImage(key: string, px: ArrayLike<number>, add = 0): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const img = new ImageData(32, 32);
  for (let q = 0; q < 1024; q++) {
    for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = Math.max(0, Math.min(255, Math.round(px[ch * 1024 + q]! + add)));
    img.data[q * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** Draws a small canvas crisply at (x, y), `size` px square, with a hairline frame. */
export function blit(s: Scene, c: HTMLCanvasElement, x: number, y: number, size: number): void {
  const ctx = s.ctx;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, x, y, size, size);
  ctx.restore();
  s.rrect(x, y, size, size, 0.3, { stroke: s.c('--rule'), lw: 0.2 });
}
