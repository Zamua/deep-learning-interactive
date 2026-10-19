import { Rng } from '../core/rand';
import { Net, infoNCE, linearProbe, normalizeBack, normalizeRows, simMatrix } from './contrastive-net';

/**
 * The chapter's toy "images": 2 numbers of content (what the image shows, from one of K hidden
 * classes) and 4 numbers of style (lighting, color, framing). Augmentation keeps the content,
 * jitters it slightly, and draws fresh style, so two views agree only on what matters.
 */
export const TOY_K = 4;
export const TOY_DIN = 6;
export const TOY_CONTENT_JITTER = 0.2;
const CENTERS: [number, number][] = [
  [-0.6, 0.45],
  [0.55, 0.55],
  [0.6, -0.5],
  [-0.5, -0.55],
];

export interface ToyData {
  n: number;
  X: Float64Array;
  y: Int32Array;
  train: number[];
  test: number[];
}

export function makeToy(perClass = 45, seed = 11): ToyData {
  const r = new Rng(seed);
  const n = perClass * TOY_K;
  const X = new Float64Array(n * TOY_DIN);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % TOY_K;
    y[i] = c;
    X[i * TOY_DIN] = CENTERS[c]![0] + 0.2 * r.randn();
    X[i * TOY_DIN + 1] = CENTERS[c]![1] + 0.2 * r.randn();
    for (let q = 2; q < TOY_DIN; q++) X[i * TOY_DIN + q] = r.randn();
  }
  const order = r.shuffle(Array.from({ length: n }, (_, i) => i));
  const cut = Math.round(n * 0.7);
  return { n, X, y, train: order.slice(0, cut), test: order.slice(cut) };
}

/** One augmented view of each item in idx: content jittered, style redrawn. */
export function augment(d: ToyData, idx: ArrayLike<number>, r: Rng, jitter = TOY_CONTENT_JITTER): Float64Array {
  const B = idx.length;
  const V = new Float64Array(B * TOY_DIN);
  for (let b = 0; b < B; b++) {
    const i = idx[b]!;
    V[b * TOY_DIN] = d.X[i * TOY_DIN]! + jitter * r.randn();
    V[b * TOY_DIN + 1] = d.X[i * TOY_DIN + 1]! + jitter * r.randn();
    for (let q = 2; q < TOY_DIN; q++) V[b * TOY_DIN + q] = r.randn();
  }
  return V;
}

export type ToyMode = 'infonce' | 'positives';

/** A 2-D (circle) contrastive embedding of the toy data, trained a step at a time. */
export class ToyContrastive {
  readonly f: Net;
  private r: Rng;
  step = 0;
  lastLoss = NaN;

  readonly data: ToyData;

  constructor(data: ToyData, seed = 3, hidden = 32) {
    this.data = data;
    this.f = new Net(TOY_DIN, hidden, 2, seed);
    this.r = new Rng(seed + 100);
  }

  reset(seed: number): void {
    this.f.reset(seed);
    this.r = new Rng(seed + 100);
    this.step = 0;
    this.lastLoss = NaN;
  }

  /** Unit-length embeddings of B views (B x 2). */
  embed(V: Float64Array, B: number): Float64Array {
    return normalizeRows(this.f.forward(V, B).out, B, 2).z;
  }

  /** The un-augmented items, embedded (n x 2). */
  embedAll(): Float64Array {
    return this.embed(this.data.X, this.data.n);
  }

  train(mode: ToyMode, tau: number, B = 32, lr = 0.01): number {
    const idx = Array.from({ length: B }, () => this.r.int(this.data.n));
    const v1 = augment(this.data, idx, this.r);
    const v2 = augment(this.data, idx, this.r);
    const f1 = this.f.forward(v1, B);
    const f2 = this.f.forward(v2, B);
    const n1 = normalizeRows(f1.out, B, 2);
    const n2 = normalizeRows(f2.out, B, 2);
    let loss: number;
    let dz1: Float64Array;
    let dz2: Float64Array;
    if (mode === 'infonce') {
      const res = infoNCE(n1.z, n2.z, B, 2, tau);
      loss = res.loss;
      dz1 = res.dz1;
      dz2 = res.dz2;
    } else {
      // Pull each pair together and nothing else: loss = -mean cosine.
      loss = 0;
      dz1 = new Float64Array(B * 2);
      dz2 = new Float64Array(B * 2);
      for (let b = 0; b < B; b++) {
        for (let k = 0; k < 2; k++) {
          loss -= (n1.z[b * 2 + k]! * n2.z[b * 2 + k]!) / B;
          dz1[b * 2 + k] = -n2.z[b * 2 + k]! / B;
          dz2[b * 2 + k] = -n1.z[b * 2 + k]! / B;
        }
      }
    }
    this.f.zeroGrad();
    this.f.backward(v1, B, f1.hid, normalizeBack(n1.z, n1.len, dz1, B, 2));
    this.f.backward(v2, B, f2.hid, normalizeBack(n2.z, n2.len, dz2, B, 2));
    this.f.adam(lr);
    this.step++;
    this.lastLoss = loss;
    return loss;
  }

  probe(): number {
    const F = this.embedAll();
    return linearProbe(F, this.data.y, 2, TOY_K, this.data.train, this.data.test);
  }

  /** The similarity matrix (cosines) of a fixed displayed batch. */
  batchSim(v1: Float64Array, v2: Float64Array, B: number): Float64Array {
    return simMatrix(this.embed(v1, B), B, this.embed(v2, B), B, 2);
  }
}
