import { Rng } from './rand';

/** A labelled 2-D point set: X is N x 2 row-major, y holds class indices. */
export interface Dataset2D {
  X: Float64Array;
  y: Int32Array;
  n: number;
  classes: number;
}

function make(points: [number, number, number][], classes: number): Dataset2D {
  const n = points.length;
  const X = new Float64Array(n * 2);
  const y = new Int32Array(n);
  points.forEach(([a, b, c], i) => {
    X[2 * i] = a;
    X[2 * i + 1] = b;
    y[i] = c;
  });
  return { X, y, n, classes };
}

/** The spiral from the CS231n case study: K arms of N points, radius 0..1. */
export function spiral(N = 80, K = 3, noise = 0.2, seed = 3): Dataset2D {
  const r = new Rng(seed);
  const pts: [number, number, number][] = [];
  for (let j = 0; j < K; j++) {
    for (let i = 0; i < N; i++) {
      const rad = i / (N - 1);
      const t = j * 4 + (4 * i) / (N - 1) + r.randn() * noise;
      pts.push([rad * Math.sin(t), rad * Math.cos(t), j]);
    }
  }
  return make(pts, K);
}

/** Gaussian blobs around evenly spaced centres. */
export function blobs(N = 40, K = 3, spread = 0.18, seed = 7): Dataset2D {
  const r = new Rng(seed);
  const pts: [number, number, number][] = [];
  for (let j = 0; j < K; j++) {
    const a = (j / K) * Math.PI * 2 + 0.6;
    const cx = 0.55 * Math.cos(a);
    const cy = 0.55 * Math.sin(a);
    for (let i = 0; i < N; i++) pts.push([cx + r.randn() * spread, cy + r.randn() * spread, j]);
  }
  return make(pts, K);
}

/** Two concentric rings: not linearly separable. */
export function circles(N = 80, seed = 5): Dataset2D {
  const r = new Rng(seed);
  const pts: [number, number, number][] = [];
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < N; i++) {
      const t = r.uniform(0, Math.PI * 2);
      const rad = (j ? 0.75 : 0.3) + r.randn() * 0.06;
      pts.push([rad * Math.cos(t), rad * Math.sin(t), j]);
    }
  }
  return make(pts, 2);
}

/** XOR quadrants. */
export function xor(N = 120, seed = 9): Dataset2D {
  const r = new Rng(seed);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = r.uniform(-0.9, 0.9);
    const b = r.uniform(-0.9, 0.9);
    pts.push([a, b, a * b > 0 ? 0 : 1]);
  }
  return make(pts, 2);
}

export const CIFAR_CLASSES = ['plane', 'car', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck'] as const;

/**
 * A CIFAR-10 subset. Each image is 3072 bytes in CIFAR's own layout: 1024 red values, then
 * 1024 green, then 1024 blue, each 32 x 32 row-major. `pixels` concatenates the images.
 */
export interface CifarSet {
  n: number;
  pixels: Uint8Array;
  labels: Uint8Array;
}

let cifarPromise: Promise<{ train: CifarSet; test: CifarSet }> | null = null;

/** Train: 1000 images (100 per class). Test: 200 images (20 per class). Fetched once per session. */
export function loadCifar(): Promise<{ train: CifarSet; test: CifarSet }> {
  cifarPromise ??= Promise.all(['train', 'test'].map(async (k) => {
    const res = await fetch(`./data/cifar-${k}.bin`);
    if (!res.ok) throw new Error(`cifar-${k}.bin: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const n = buf.length / 3073;
    const labels = new Uint8Array(n);
    const pixels = new Uint8Array(n * 3072);
    for (let i = 0; i < n; i++) {
      labels[i] = buf[i * 3073]!;
      pixels.set(buf.subarray(i * 3073 + 1, (i + 1) * 3073), i * 3072);
    }
    return { n, pixels, labels } as CifarSet;
  })).then(([train, test]) => ({ train: train!, test: test! }));
  return cifarPromise;
}

/** Image i as an ImageData (32 x 32 RGBA). */
export function cifarImage(set: CifarSet, i: number): ImageData {
  const img = new ImageData(32, 32);
  const o = i * 3072;
  for (let p = 0; p < 1024; p++) {
    img.data[p * 4] = set.pixels[o + p]!;
    img.data[p * 4 + 1] = set.pixels[o + 1024 + p]!;
    img.data[p * 4 + 2] = set.pixels[o + 2048 + p]!;
    img.data[p * 4 + 3] = 255;
  }
  return img;
}

/** Draws image i at (x, y) scaled to `size` CSS px with crisp pixels. */
export function drawCifar(ctx: CanvasRenderingContext2D, set: CifarSet, i: number, x: number, y: number, size: number): void {
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 32;
  tmp.getContext('2d')!.putImageData(cifarImage(set, i), 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, size, size);
  ctx.restore();
}
