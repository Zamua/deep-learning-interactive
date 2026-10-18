import { Rng } from './rand';

export type Activation = 'relu' | 'tanh' | 'sigmoid' | 'leaky' | 'linear';
export type LossKind = 'softmax' | 'svm';
export type Optimizer = 'sgd' | 'momentum' | 'nesterov' | 'adagrad' | 'rmsprop' | 'adam';

export function act(a: Activation, z: number): number {
  switch (a) {
    case 'relu':
      return z > 0 ? z : 0;
    case 'leaky':
      return z > 0 ? z : 0.01 * z;
    case 'tanh':
      return Math.tanh(z);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-z));
    default:
      return z;
  }
}

/** d act / dz, written in terms of the pre-activation z. */
export function dact(a: Activation, z: number): number {
  switch (a) {
    case 'relu':
      return z > 0 ? 1 : 0;
    case 'leaky':
      return z > 0 ? 1 : 0.01;
    case 'tanh': {
      const t = Math.tanh(z);
      return 1 - t * t;
    }
    case 'sigmoid': {
      const s = 1 / (1 + Math.exp(-z));
      return s * (1 - s);
    }
    default:
      return 1;
  }
}

interface Layer {
  W: Float64Array; // out x in, row-major
  b: Float64Array;
  dW: Float64Array;
  db: Float64Array;
  m: [Float64Array, Float64Array]; // optimizer state 1
  v: [Float64Array, Float64Array]; // optimizer state 2
  nin: number;
  nout: number;
}

export interface MLPOptions {
  /** Layer widths including input and output, e.g. [2, 100, 3]. */
  sizes: number[];
  activation?: Activation;
  /** Std of the initial weights; 'he' / 'xavier' scale by fan-in. Default 'he'. */
  init?: number | 'he' | 'xavier';
  seed?: number;
}

/** A fully-connected classifier small enough to train live in the page. */
export class MLP {
  layers: Layer[] = [];
  activation: Activation;
  sizes: number[];
  t = 0;

  constructor(opts: MLPOptions) {
    this.sizes = opts.sizes;
    this.activation = opts.activation ?? 'relu';
    this.reset(opts.init ?? 'he', opts.seed ?? 1);
  }

  reset(init: number | 'he' | 'xavier' = 'he', seed = 1): void {
    const r = new Rng(seed);
    this.t = 0;
    this.layers = [];
    for (let l = 0; l + 1 < this.sizes.length; l++) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const std = typeof init === 'number' ? init : init === 'he' ? Math.sqrt(2 / nin) : Math.sqrt(1 / nin);
      const W = new Float64Array(nin * nout).map(() => r.randn() * std);
      const z = () => new Float64Array(nin * nout);
      const zb = () => new Float64Array(nout);
      this.layers.push({ W, b: zb(), dW: z(), db: zb(), m: [z(), zb()], v: [z(), zb()], nin, nout });
    }
  }

  /** Class scores for one input vector; `hidden` collects each layer's activations if given. */
  forward(x: ArrayLike<number>, hidden?: Float64Array[]): Float64Array {
    let a = Float64Array.from(x as ArrayLike<number>);
    this.layers.forEach((L, li) => {
      const out = new Float64Array(L.nout);
      for (let o = 0; o < L.nout; o++) {
        let s = L.b[o]!;
        const row = o * L.nin;
        for (let i = 0; i < L.nin; i++) s += L.W[row + i]! * a[i]!;
        out[o] = li < this.layers.length - 1 ? act(this.activation, s) : s;
      }
      a = out;
      hidden?.push(out);
    });
    return a;
  }

  predict(x: ArrayLike<number>): number {
    const s = this.forward(x);
    let best = 0;
    for (let i = 1; i < s.length; i++) if (s[i]! > s[best]!) best = i;
    return best;
  }

  /**
   * One forward + backward pass over a batch. X is batch x d row-major. Accumulates averaged
   * gradients (plus L2 `reg`) into dW/db and returns the mean data loss + reg loss.
   */
  lossAndGrad(X: Float64Array, y: ArrayLike<number>, idx: ArrayLike<number>, opts: { loss?: LossKind; reg?: number } = {}): number {
    const loss = opts.loss ?? 'softmax';
    const reg = opts.reg ?? 0;
    const d = this.sizes[0]!;
    const nL = this.layers.length;
    for (const L of this.layers) {
      L.dW.fill(0);
      L.db.fill(0);
    }
    let total = 0;
    const B = idx.length;
    const zs: Float64Array[] = new Array(nL);
    const as: Float64Array[] = new Array(nL + 1);
    for (let bi = 0; bi < B; bi++) {
      const n = idx[bi]!;
      as[0] = X.subarray(n * d, n * d + d) as Float64Array;
      for (let l = 0; l < nL; l++) {
        const L = this.layers[l]!;
        const z = new Float64Array(L.nout);
        const a = new Float64Array(L.nout);
        const inp = as[l]!;
        for (let o = 0; o < L.nout; o++) {
          let s = L.b[o]!;
          const row = o * L.nin;
          for (let i = 0; i < L.nin; i++) s += L.W[row + i]! * inp[i]!;
          z[o] = s;
          a[o] = l < nL - 1 ? act(this.activation, s) : s;
        }
        zs[l] = z;
        as[l + 1] = a;
      }
      const scores = as[nL]!;
      const yi = y[n]!;
      const g = new Float64Array(scores.length);
      if (loss === 'softmax') {
        let mx = -Infinity;
        for (const s of scores) mx = Math.max(mx, s);
        let sum = 0;
        for (let k = 0; k < scores.length; k++) sum += (g[k] = Math.exp(scores[k]! - mx));
        for (let k = 0; k < scores.length; k++) g[k]! /= sum;
        total += -Math.log(Math.max(g[yi]!, 1e-12));
        g[yi]! -= 1;
      } else {
        let count = 0;
        for (let k = 0; k < scores.length; k++) {
          if (k === yi) continue;
          const m = scores[k]! - scores[yi]! + 1;
          if (m > 0) {
            total += m;
            g[k] = 1;
            count++;
          }
        }
        g[yi] = -count;
      }
      let delta = g;
      for (let l = nL - 1; l >= 0; l--) {
        const L = this.layers[l]!;
        const inp = as[l]!;
        const next = l > 0 ? new Float64Array(L.nin) : null;
        for (let o = 0; o < L.nout; o++) {
          const dz = delta[o]!;
          if (dz === 0) continue;
          L.db[o]! += dz;
          const row = o * L.nin;
          for (let i = 0; i < L.nin; i++) {
            L.dW[row + i]! += dz * inp[i]!;
            if (next) next[i]! += dz * L.W[row + i]!;
          }
        }
        if (next) {
          const zp = zs[l - 1]!;
          for (let i = 0; i < next.length; i++) next[i]! *= dact(this.activation, zp[i]!);
          delta = next;
        }
      }
    }
    let regLoss = 0;
    for (const L of this.layers) {
      for (let i = 0; i < L.W.length; i++) {
        L.dW[i] = L.dW[i]! / B + reg * L.W[i]!;
        regLoss += 0.5 * reg * L.W[i]! * L.W[i]!;
      }
      for (let i = 0; i < L.db.length; i++) L.db[i]! /= B;
    }
    return total / B + regLoss;
  }

  /** Apply the gradients currently in dW/db. */
  step(lr: number, opt: Optimizer = 'sgd', mu = 0.9): void {
    this.t++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8, decay = 0.99;
    for (const L of this.layers) {
      const params: [Float64Array, Float64Array, Float64Array, Float64Array][] = [
        [L.W, L.dW, L.m[0], L.v[0]],
        [L.b, L.db, L.m[1], L.v[1]],
      ];
      for (const [p, g, m, v] of params) {
        for (let i = 0; i < p.length; i++) {
          const gi = g[i]!;
          switch (opt) {
            case 'sgd':
              p[i]! -= lr * gi;
              break;
            case 'momentum':
              m[i] = mu * m[i]! - lr * gi;
              p[i]! += m[i]!;
              break;
            case 'nesterov': {
              const prev = m[i]!;
              m[i] = mu * m[i]! - lr * gi;
              p[i]! += -mu * prev + (1 + mu) * m[i]!;
              break;
            }
            case 'adagrad':
              v[i]! += gi * gi;
              p[i]! -= (lr * gi) / (Math.sqrt(v[i]!) + eps);
              break;
            case 'rmsprop':
              v[i] = decay * v[i]! + (1 - decay) * gi * gi;
              p[i]! -= (lr * gi) / (Math.sqrt(v[i]!) + eps);
              break;
            case 'adam': {
              m[i] = b1 * m[i]! + (1 - b1) * gi;
              v[i] = b2 * v[i]! + (1 - b2) * gi * gi;
              const mh = m[i]! / (1 - Math.pow(b1, this.t));
              const vh = v[i]! / (1 - Math.pow(b2, this.t));
              p[i]! -= (lr * mh) / (Math.sqrt(vh) + eps);
              break;
            }
          }
        }
      }
    }
  }

  accuracy(X: Float64Array, y: ArrayLike<number>, n: number): number {
    const d = this.sizes[0]!;
    let ok = 0;
    for (let i = 0; i < n; i++) if (this.predict(X.subarray(i * d, i * d + d)) === y[i]) ok++;
    return ok / n;
  }
}

/** Softmax probabilities of a score vector (numerically stable). */
export function softmax(s: ArrayLike<number>): number[] {
  let mx = -Infinity;
  for (let i = 0; i < s.length; i++) mx = Math.max(mx, s[i]!);
  const e = Array.from(s, (v) => Math.exp(v - mx));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}
