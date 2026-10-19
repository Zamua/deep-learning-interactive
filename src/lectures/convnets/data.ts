import { type CifarSet, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Scene } from '../../lecture/scene';

/** Training-set indices of the images the lecture draws. */
const CAR = 149;
const TRUCK = 37;
const HORSE = 13;

export interface Pics {
  car: HTMLCanvasElement;
  /** The car's red, green and blue channels, each tinted its own color. */
  carCh: HTMLCanvasElement[];
  /** The car's 1024 pixels in one row, as a flattened image reads. */
  strip: HTMLCanvasElement;
  /** Twelve activation maps of the car (signed, gray), after ReLU, and after 2 x 2 max pooling. */
  maps: HTMLCanvasElement[];
  relus: HTMLCanvasElement[];
  pools: HTMLCanvasElement[];
  truck: Float64Array;
  truckC: HTMLCanvasElement;
  /** The truck convolved with the vertical-edge filter (zero padded), and its ReLU. */
  vedge: Float64Array;
  vedgeC: HTMLCanvasElement;
  vedgeR: HTMLCanvasElement;
  hedgeC: HTMLCanvasElement;
  blurC: HTMLCanvasElement;
  sharpC: HTMLCanvasElement;
  /** Where the vertical-edge filter responds most: [row, col]. */
  hit: [number, number];
  horse: HTMLCanvasElement;
}

export const VEDGE = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
export const HEDGE = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
export const BLUR = [1, 2, 1, 2, 4, 2, 1, 2, 1];
export const SHARP = [0, -1, 0, -1, 5, -1, 0, -1, 0];

function canvasOf(n: number, m: number, px: (p: number) => [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = m;
  const img = new ImageData(n, m);
  for (let p = 0; p < n * m; p++) {
    const [r, g, b] = px(p);
    img.data[p * 4] = Math.max(0, Math.min(255, Math.round(r)));
    img.data[p * 4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
    img.data[p * 4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
    img.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** A gray canvas of an n x n map: signed maps center on mid-gray, others run black to white. */
export function grayCanvas(v: ArrayLike<number>, n: number, signed: boolean): HTMLCanvasElement {
  let mx = 1e-9;
  for (let p = 0; p < n * n; p++) mx = Math.max(mx, Math.abs(v[p]!));
  return canvasOf(n, n, (p) => {
    const g = signed ? 127.5 + (127.5 * v[p]!) / mx : (255 * v[p]!) / mx;
    return [g, g, g];
  });
}

/** 3 x 3 convolution of an n x n map with one ring of zero padding, so the output is n x n. */
export function conv3(img: ArrayLike<number>, n: number, k: number[], div = 1): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let u = 0; u < 3; u++)
        for (let v = 0; v < 3; v++) {
          const r = i + u - 1;
          const c = j + v - 1;
          if (r >= 0 && c >= 0 && r < n && c < n) s += img[r * n + c]! * k[u * 3 + v]!;
        }
      out[i * n + j] = s / div;
    }
  return out;
}

function build(set: CifarSet): Pics {
  const chan = (i: number, ch: number) => {
    const o = i * 3072 + ch * 1024;
    return Float64Array.from({ length: 1024 }, (_, p) => set.pixels[o + p]! / 255);
  };
  const rgbAt = (i: number, p: number): [number, number, number] => [set.pixels[i * 3072 + p]!, set.pixels[i * 3072 + 1024 + p]!, set.pixels[i * 3072 + 2048 + p]!];
  const gray = (i: number) => {
    const [r, g, b] = [chan(i, 0), chan(i, 1), chan(i, 2)];
    return Float64Array.from({ length: 1024 }, (_, p) => 0.299 * r[p]! + 0.587 * g[p]! + 0.114 * b[p]!);
  };

  const car = canvasOf(32, 32, (p) => rgbAt(CAR, p));
  const carCh = [0, 1, 2].map((ch) =>
    canvasOf(32, 32, (p) => {
      const v = rgbAt(CAR, p)[ch]!;
      return ch === 0 ? [v, v * 0.18, v * 0.18] : ch === 1 ? [v * 0.18, v, v * 0.3] : [v * 0.2, v * 0.35, v];
    }),
  );
  const strip = canvasOf(1024, 1, (p) => rgbAt(CAR, p));

  // Twelve hand-made 3 x 3 x 3 filters: oriented edges on brightness and on red, color contrasts, a blur.
  const R = chan(CAR, 0);
  const G = chan(CAR, 1);
  const B = chan(CAR, 2);
  const L = gray(CAR);
  const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const orient = (a: number) => sx.map((v, q) => Math.cos(a) * v + Math.sin(a) * sy[q]!);
  const raw: Float64Array[] = [];
  for (let a = 0; a < 6; a++) raw.push(conv3(L, 32, orient((a * Math.PI) / 6)));
  raw.push(conv3(R, 32, orient(0)), conv3(R, 32, orient(Math.PI / 2)));
  const mix = (f: (p: number) => number) => Float64Array.from({ length: 1024 }, (_, p) => f(p));
  raw.push(conv3(mix((p) => R[p]! - G[p]!), 32, BLUR, 16));
  raw.push(conv3(mix((p) => B[p]! - (R[p]! + G[p]!) / 2), 32, BLUR, 16));
  raw.push(conv3(mix((p) => G[p]! - R[p]!), 32, BLUR, 16));
  raw.push(conv3(L, 32, BLUR, 16).map((v) => v - 0.45));
  const maps = raw.map((m) => grayCanvas(m, 32, true));
  const relu = raw.map((m) => m.map((v) => Math.max(0, v)));
  const relus = relu.map((m) => grayCanvas(m, 32, false));
  const pools = relu.map((m) => {
    const o = new Float64Array(256);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) o[i * 16 + j] = Math.max(m[64 * i + 2 * j]!, m[64 * i + 2 * j + 1]!, m[64 * i + 32 + 2 * j]!, m[64 * i + 33 + 2 * j]!);
    return grayCanvas(o, 16, false);
  });

  const truck = gray(TRUCK);
  const vedge = conv3(truck, 32, VEDGE);
  let hit: [number, number] = [16, 16];
  let best = -Infinity;
  for (let i = 4; i < 28; i++)
    for (let j = 4; j < 28; j++)
      if (vedge[i * 32 + j]! > best) {
        best = vedge[i * 32 + j]!;
        hit = [i, j];
      }
  return {
    car,
    carCh,
    strip,
    maps,
    relus,
    pools,
    truck,
    truckC: grayCanvas(truck, 32, false),
    vedge,
    vedgeC: grayCanvas(vedge, 32, true),
    vedgeR: grayCanvas(vedge.map((v) => Math.max(0, v)), 32, false),
    hedgeC: grayCanvas(conv3(truck, 32, HEDGE), 32, true),
    blurC: grayCanvas(conv3(truck, 32, BLUR, 16), 32, false),
    sharpC: grayCanvas(conv3(truck, 32, SHARP), 32, false),
    hit,
    horse: canvasOf(32, 32, (p) => rgbAt(HORSE, p)),
  };
}

let pics: Pics | null = null;
let waiting: Plot | null = null;
let started = false;

/** The lecture's CIFAR pictures, or null while they load (the stage redraws once they land). */
export function cifar(s: Scene): Pics | null {
  if (!started) {
    started = true;
    loadCifar()
      .then(({ train }) => {
        pics = build(train);
        waiting?.redraw();
      })
      .catch(() => {});
  }
  if (!pics) waiting = s.p;
  return pics;
}

let gabors: HTMLCanvasElement[] | null = null;

/** Small oriented stripes and color blobs, the look of trained first-layer filters. */
export function filterTiles(): HTMLCanvasElement[] {
  if (gabors) return gabors;
  const rng = new Rng(11);
  const n = 9;
  gabors = Array.from({ length: 24 }, (_, t) => {
    const blob = t % 4 === 3;
    const a = rng.uniform(0, Math.PI);
    const f = rng.uniform(0.55, 1.0);
    const ph = rng.uniform(0, Math.PI * 2);
    const hue: [number, number, number] = blob ? [rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)] : t % 5 === 1 ? [1, 0.55, -0.6] : [1, 1, 1];
    return canvasOf(n, n, (p) => {
      const x = (p % n) - (n - 1) / 2;
      const y = Math.floor(p / n) - (n - 1) / 2;
      const env = Math.exp(-(x * x + y * y) / (blob ? 6 : 9));
      const v = blob ? env : env * Math.cos(f * (x * Math.cos(a) + y * Math.sin(a)) + ph);
      return [127 + 120 * v * hue[0], 127 + 120 * v * hue[1], 127 + 120 * v * hue[2]];
    });
  });
  return gabors;
}
