import { Rng } from '../core/rand';
import { Net } from './contrastive-net';
import { type ToyData, TOY_DIN, augment } from './contrastive-toy';

/** Outputs of the DINO head: K dimensions the softmax spreads probability over. */
export const DINO_K = 6;
export const DINO_TS = 0.1;
/** Content jitter of the student's views: stronger than the teacher's, like DINO's small local crops. */
export const DINO_LOCAL = 0.6;

function softmaxRows(L: Float64Array, B: number, K: number, temp: number, center?: Float64Array): Float64Array {
  const P = new Float64Array(B * K);
  for (let b = 0; b < B; b++) {
    let mx = -Infinity;
    for (let k = 0; k < K; k++) mx = Math.max(mx, (L[b * K + k]! - (center ? center[k]! : 0)) / temp);
    let s = 0;
    for (let k = 0; k < K; k++) s += P[b * K + k] = Math.exp((L[b * K + k]! - (center ? center[k]! : 0)) / temp - mx);
    for (let k = 0; k < K; k++) P[b * K + k]! /= s;
  }
  return P;
}

export interface DinoStats {
  /** Batch-average teacher distribution over the K dimensions. */
  mean: Float64Array;
  /** Average entropy of one sample's teacher distribution (0 = certain, log K = uniform). */
  sampleEntropy: number;
  /** Teacher's most likely dimension for every item. */
  argmax: Int32Array;
  /** Teacher's probability of that dimension, per item. */
  conf: Float64Array;
}

/** Self-distillation on the toy data: a student, an EMA teacher, centering and sharpening. */
export class ToyDino {
  readonly student: Net;
  readonly teacher: Net;
  readonly center: Float64Array;
  readonly data: ToyData;
  readonly K: number;
  step = 0;
  lastLoss = NaN;
  private r: Rng;

  constructor(data: ToyData, seed = 4, K = DINO_K) {
    this.data = data;
    this.K = K;
    this.center = new Float64Array(K);
    this.student = new Net(TOY_DIN, 32, K, seed);
    this.teacher = new Net(TOY_DIN, 32, K, seed);
    this.r = new Rng(seed + 50);
    this.reset(seed);
  }

  reset(seed: number): void {
    this.student.reset(seed);
    this.teacher.copyFrom(this.student);
    this.center.fill(0);
    this.r = new Rng(seed + 50);
    this.step = 0;
    this.lastLoss = NaN;
  }

  train(o: { centering: boolean; tt: number; m?: number; lr?: number; B?: number; local?: number }): number {
    const B = o.B ?? 32;
    const { K } = this;
    const idx = Array.from({ length: B }, () => this.r.int(this.data.n));
    const g1 = augment(this.data, idx, this.r);
    const g2 = augment(this.data, idx, this.r);
    const loc = o.local ?? DINO_LOCAL;
    const v1 = loc ? augment(this.data, idx, this.r, loc) : g1;
    const v2 = loc ? augment(this.data, idx, this.r, loc) : g2;
    const s1 = this.student.forward(v1, B);
    const s2 = this.student.forward(v2, B);
    const t1 = this.teacher.forward(g1, B).out;
    const t2 = this.teacher.forward(g2, B).out;
    const c = o.centering ? this.center : undefined;
    const pt1 = softmaxRows(t1, B, K, o.tt, c);
    const pt2 = softmaxRows(t2, B, K, o.tt, c);
    const ps1 = softmaxRows(s1.out, B, K, DINO_TS);
    const ps2 = softmaxRows(s2.out, B, K, DINO_TS);
    // H(pt1, ps2) / 2 + H(pt2, ps1) / 2; d/dlogits of H(p, softmax(s / T)) = (softmax - p) / T.
    let loss = 0;
    const d1 = new Float64Array(B * K);
    const d2 = new Float64Array(B * K);
    for (let i = 0; i < B * K; i++) {
      loss -= (pt1[i]! * Math.log(ps2[i]! + 1e-12) + pt2[i]! * Math.log(ps1[i]! + 1e-12)) / (2 * B);
      d2[i] = (ps2[i]! - pt1[i]!) / (2 * B * DINO_TS);
      d1[i] = (ps1[i]! - pt2[i]!) / (2 * B * DINO_TS);
    }
    this.student.zeroGrad();
    this.student.backward(v1, B, s1.hid, d1);
    this.student.backward(v2, B, s2.hid, d2);
    this.student.adam(o.lr ?? 0.003);
    this.teacher.ema(this.student, o.m ?? 0.99);
    for (let k = 0; k < K; k++) {
      let mu = 0;
      for (let b = 0; b < B; b++) mu += (t1[b * K + k]! + t2[b * K + k]!) / (2 * B);
      this.center[k] = 0.9 * this.center[k]! + 0.1 * mu;
    }
    this.step++;
    this.lastLoss = loss;
    return loss;
  }

  /** Teacher outputs on the un-augmented items, as the figure shows them. */
  stats(centering: boolean, tt: number): DinoStats {
    const { n, X } = this.data;
    const { K } = this;
    const L = this.teacher.forward(X, n).out;
    const P = softmaxRows(L, n, K, tt, centering ? this.center : undefined);
    const mean = new Float64Array(K);
    const argmax = new Int32Array(n);
    const conf = new Float64Array(n);
    let H = 0;
    for (let b = 0; b < n; b++) {
      let best = 0;
      for (let k = 0; k < K; k++) {
        const p = P[b * K + k]!;
        mean[k]! += p / n;
        if (p > 1e-12) H -= (p * Math.log(p)) / n;
        if (p > P[b * K + best]!) best = k;
      }
      argmax[b] = best;
      conf[b] = P[b * K + best]!;
    }
    return { mean, sampleEntropy: H, argmax, conf };
  }
}
