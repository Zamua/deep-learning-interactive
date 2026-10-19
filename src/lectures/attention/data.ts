import { loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import { bilinear, cellFeatures, cifarRGB, softmax, type RGB } from '../../lib/attention-img';
import type { Scene } from '../../lecture/scene';

export { softmax };
export type { RGB };

/** The chapter's grid size and its hand-set queries over [bright, blue, green, warm, texture]. */
export const G = 8;
export const WORDS = {
  sky: [1, 0.8, -0.3, -0.5, -1],
  water: [-0.6, 1, 0, -0.4, 0],
  grass: [0, -0.3, 1, 0, 0.3],
  object: [0, -0.5, -0.3, 0.3, 1],
};
export type Word = keyof typeof WORDS;

export interface Pic {
  rgb: RGB;
  feats: number[][];
  colors: [number, number, number][];
}
type Name = 'ship' | 'horse' | 'plane';
const IDX: Record<Name, number> = { ship: 15, horse: 60, plane: 126 };

let pics: Record<Name, Pic> | null = null;
const waiting = new Set<Plot>();

loadCifar()
  .then(({ test }) => {
    const out = {} as Record<Name, Pic>;
    for (const k of Object.keys(IDX) as Name[]) {
      const rgb = cifarRGB(test, IDX[k]);
      out[k] = { rgb, ...cellFeatures(rgb, G) };
    }
    pics = out;
    waiting.forEach((p) => p.redraw());
    waiting.clear();
  })
  .catch(() => {});

/** The chapter's three CIFAR-10 test images, or null while they load (the stage redraws once they land). */
export function pictures(s: Scene): Record<Name, Pic> | null {
  if (!pics) waiting.add(s.p);
  return pics;
}

export interface Attn {
  scores: number[];
  alpha: number[];
  z: number[];
  color: [number, number, number];
  best: number;
}

/** Scores, softmax, weighted sum: the chapter's three steps for query q at sharpness beta. */
export function attend(pic: Pic, q: number[], beta = 2): Attn {
  const scores = pic.feats.map((v) => v.reduce((a, x, d) => a + x * q[d]!, 0) * beta);
  const alpha = softmax(scores);
  const z = [0, 1, 2, 3, 4].map((d) => pic.feats.reduce((a, v, i) => a + alpha[i]! * v[d]!, 0));
  const color = [0, 1, 2].map((c) => pic.colors.reduce((a, col, i) => a + alpha[i]! * col[c]!, 0)) as [number, number, number];
  let best = 0;
  alpha.forEach((a, i) => a > alpha[best]! && (best = i));
  return { scores, alpha, z, color, best };
}

const attnCache = new Map<string, Attn>();
/** `attend` for a named word, cached (beta rounded to 0.01). */
export function attendWord(pic: Pic, name: Name, word: Word, beta = 2): Attn {
  const key = `${name}/${word}/${beta.toFixed(2)}`;
  let a = attnCache.get(key);
  if (!a) {
    a = attend(pic, WORDS[word], Math.round(beta * 100) / 100);
    if (attnCache.size > 400) attnCache.clear();
    attnCache.set(key, a);
  }
  return a;
}

/** Hard-attention picks for the horse and "grass", drawn once with the chapter's seed. */
let picks: { i: number; jx: number; jy: number }[] | null = null;
export function hardPicks(pic: Pic): { i: number; jx: number; jy: number }[] {
  if (picks) return picks;
  const { alpha } = attend(pic, WORDS.grass, 2);
  const rng = new Rng(4);
  picks = [];
  for (let t = 0; t < 240; t++) {
    let u = rng.next();
    let i = alpha.length - 1;
    for (let j = 0; j < alpha.length; j++) {
      u -= alpha[j]!;
      if (u <= 0) {
        i = j;
        break;
      }
    }
    picks.push({ i, jx: (rng.next() - 0.5) * 0.6, jy: (rng.next() - 0.5) * 0.6 });
  }
  return picks;
}

/** DRAW's N filter rows over 32 pixels, centered on g with stride delta and blur sigma; rows sum to 1. */
export function filterBank(g: number, delta: number, sigma: number, N = 6): number[][] {
  const F: number[][] = [];
  for (let i = 1; i <= N; i++) {
    const mu = g + (i - N / 2 - 0.5) * delta;
    const row = Array.from({ length: 32 }, (_, a) => Math.exp(-((a - mu) ** 2) / (2 * sigma * sigma)));
    const sum = row.reduce((x, y) => x + y, 0) + 1e-9;
    F.push(row.map((v) => v / sum));
  }
  return F;
}

/** The N x N glimpse Fy U Fx^T, per channel. */
export function glimpse(U: RGB, gx: number, gy: number, delta: number, sigma: number, N = 6): RGB {
  const Fx = filterBank(gx, delta, sigma, N);
  const Fy = filterBank(gy, delta, sigma, N);
  const out = new Float32Array(N * N * 3);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      for (let ch = 0; ch < 3; ch++) {
        let acc = 0;
        for (let y = 0; y < 32; y++) {
          const wy = Fy[r]![y]!;
          if (wy < 1e-5) continue;
          for (let x = 0; x < 32; x++) acc += wy * Fx[c]![x]! * U[(y * 32 + x) * 3 + ch]!;
        }
        out[(r * N + c) * 3 + ch] = acc;
      }
  return out;
}

/** theta as [a, b, tx, c, d, ty] from a scale, rotation (degrees), shift and shear. */
export function affine(scale: number, rot: number, tx: number, ty: number, shear: number): number[] {
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c * scale, c * shear - s * scale, tx, s * scale, s * shear + c * scale, ty];
}

const lin = (k: number, n: number) => -1 + (2 * k) / (n - 1);

/** Where output grid point (i, j) of an n x n grid reads from, in [-1, 1] coordinates. */
export function sourceOf(theta: number[], i: number, j: number, n: number): [number, number] {
  const xt = lin(j, n);
  const yt = lin(i, n);
  return [theta[0]! * xt + theta[1]! * yt + theta[2]!, theta[3]! * xt + theta[4]! * yt + theta[5]!];
}

/** The spatial transformer's 32 x 32 output V for input U and theta (zeros outside). */
export function warp(U: RGB, theta: number[]): RGB {
  const out = new Float32Array(32 * 32 * 3);
  const px = [0, 0, 0];
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 32; j++) {
      const [xs, ys] = sourceOf(theta, i, j, 32);
      bilinear(U, 32, 32, (xs + 1) * 16 - 0.5, (ys + 1) * 16 - 0.5, px);
      out.set(px, (i * 32 + j) * 3);
    }
  return out;
}

/** The chapter's 3 x 3 gray patch and its bilinear read at (x, y), with weights and slopes. */
export const PATCH = [
  [40, 200, 120],
  [90, 30, 250],
  [180, 140, 60],
];
export function bilinearAt(x: number, y: number) {
  const x0 = Math.min(1, Math.floor(x));
  const y0 = Math.min(1, Math.floor(y));
  const dx = x - x0;
  const dy = y - y0;
  const w = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
  const c = [PATCH[y0]![x0]!, PATCH[y0]![x0 + 1]!, PATCH[y0 + 1]![x0]!, PATCH[y0 + 1]![x0 + 1]!];
  const v = w.reduce((a, wi, k) => a + wi * c[k]!, 0);
  const gx = (1 - dy) * (c[1]! - c[0]!) + dy * (c[3]! - c[2]!);
  const gy = (1 - dx) * (c[2]! - c[0]!) + dx * (c[3]! - c[1]!);
  return { x0, y0, dx, dy, w, c, v, gx, gy };
}
