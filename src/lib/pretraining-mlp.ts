import { Rng } from '../core/rand';
import { V } from './pretraining-lang';

/**
 * A fixed-window neural language model in the style of Bengio et al. (2003): embed the last
 * `ctx` words, concatenate, one tanh layer, softmax over the vocabulary. Trained with Adam.
 */
export class WindowLM {
  readonly D = 10;
  readonly H = 64;
  E!: Float64Array;
  W1!: Float64Array;
  b1!: Float64Array;
  W2!: Float64Array;
  b2!: Float64Array;
  private params: Float64Array[] = [];
  private grads: Float64Array[] = [];
  private m: Float64Array[] = [];
  private v: Float64Array[] = [];
  private t = 0;
  steps = 0;

  constructor(readonly ctx: number, seed = 1) {
    this.reset(seed);
  }

  reset(seed: number): void {
    const r = new Rng(seed);
    const { D, H, ctx } = this;
    const IN = ctx * D;
    const rnd = (n: number, s: number) => Float64Array.from({ length: n }, () => r.randn() * s);
    this.E = rnd(V * D, 0.5);
    this.W1 = rnd(H * IN, 1 / Math.sqrt(IN));
    this.b1 = new Float64Array(H);
    this.W2 = rnd(V * H, 0.05);
    this.b2 = new Float64Array(V);
    this.params = [this.E, this.W1, this.b1, this.W2, this.b2];
    this.grads = this.params.map((p) => new Float64Array(p.length));
    this.m = this.params.map((p) => new Float64Array(p.length));
    this.v = this.params.map((p) => new Float64Array(p.length));
    this.t = 0;
    this.steps = 0;
  }

  private fwd(data: ArrayLike<number>, i: number, x: Float64Array, h: Float64Array, p: Float64Array): void {
    const { D, H, ctx } = this;
    const IN = ctx * D;
    for (let j = 0; j < ctx; j++) {
      const w = data[i - ctx + j]!;
      for (let d = 0; d < D; d++) x[j * D + d] = this.E[w * D + d]!;
    }
    for (let k = 0; k < H; k++) {
      let z = this.b1[k]!;
      const row = k * IN;
      for (let a = 0; a < IN; a++) z += this.W1[row + a]! * x[a]!;
      h[k] = Math.tanh(z);
    }
    let mx = -Infinity;
    for (let o = 0; o < V; o++) {
      let z = this.b2[o]!;
      const row = o * H;
      for (let k = 0; k < H; k++) z += this.W2[row + k]! * h[k]!;
      p[o] = z;
      if (z > mx) mx = z;
    }
    let s = 0;
    for (let o = 0; o < V; o++) s += p[o] = Math.exp(p[o]! - mx);
    for (let o = 0; o < V; o++) p[o]! /= s;
  }

  /** p(next | the last `ctx` tokens of `context`), padding a short context with ".". */
  probs(context: ArrayLike<number>, out = new Float64Array(V)): Float64Array {
    const pad = Array.from({ length: this.ctx }, (_, j) => {
      const k = context.length - this.ctx + j;
      return k >= 0 ? context[k]! : 0;
    });
    this.fwd([...pad, 0], this.ctx, new Float64Array(this.ctx * this.D), new Float64Array(this.H), out);
    return out;
  }

  /** Mean cross-entropy over target positions `idx` (each >= ctx); fills the gradients. */
  lossAndGrad(data: ArrayLike<number>, idx: ArrayLike<number>): number {
    const { D, H, ctx } = this;
    const IN = ctx * D;
    const [gE, gW1, gb1, gW2, gb2] = this.grads as [Float64Array, Float64Array, Float64Array, Float64Array, Float64Array];
    for (const g of this.grads) g.fill(0);
    const x = new Float64Array(IN);
    const h = new Float64Array(H);
    const p = new Float64Array(V);
    const dh = new Float64Array(H);
    const dx = new Float64Array(IN);
    const n = idx.length;
    let loss = 0;
    for (let b = 0; b < n; b++) {
      const i = idx[b]!;
      this.fwd(data, i, x, h, p);
      const y = data[i]!;
      loss -= Math.log(p[y]!);
      p[y]! -= 1;
      dh.fill(0);
      for (let o = 0; o < V; o++) {
        const g = p[o]! / n;
        gb2[o]! += g;
        const row = o * H;
        for (let k = 0; k < H; k++) {
          gW2[row + k]! += g * h[k]!;
          dh[k]! += g * this.W2[row + k]!;
        }
      }
      dx.fill(0);
      for (let k = 0; k < H; k++) {
        const dz = dh[k]! * (1 - h[k]! * h[k]!);
        gb1[k]! += dz;
        const row = k * IN;
        for (let a = 0; a < IN; a++) {
          gW1[row + a]! += dz * x[a]!;
          dx[a]! += dz * this.W1[row + a]!;
        }
      }
      for (let j = 0; j < ctx; j++) {
        const w = data[i - ctx + j]!;
        for (let d = 0; d < D; d++) gE[w * D + d]! += dx[j * D + d]!;
      }
    }
    return loss / n;
  }

  adam(lr: number, b1 = 0.9, b2 = 0.999): void {
    this.t++;
    this.steps++;
    const c1 = 1 - b1 ** this.t;
    const c2 = 1 - b2 ** this.t;
    this.params.forEach((pa, q) => {
      const g = this.grads[q]!;
      const m = this.m[q]!;
      const v = this.v[q]!;
      for (let i = 0; i < pa.length; i++) {
        m[i] = b1 * m[i]! + (1 - b1) * g[i]!;
        v[i] = b2 * v[i]! + (1 - b2) * g[i]! * g[i]!;
        pa[i]! -= (lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    });
  }

  /** Mean cross-entropy over positions [from, to) of `data`, without touching the gradients. */
  nll(data: ArrayLike<number>, from = this.ctx, to = data.length): number {
    const x = new Float64Array(this.ctx * this.D);
    const h = new Float64Array(this.H);
    const p = new Float64Array(V);
    let s = 0;
    for (let i = Math.max(from, this.ctx); i < to; i++) {
      this.fwd(data, i, x, h, p);
      s -= Math.log(p[data[i]!]!);
    }
    return s / (to - Math.max(from, this.ctx));
  }
}
