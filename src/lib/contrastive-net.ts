import { Rng } from '../core/rand';

/**
 * A two-layer MLP (tanh hidden layer) over batches, with its parameters in one flat array so
 * that copying and exponential moving averages (MoCo's key encoder, DINO's teacher) are one loop.
 */
export class Net {
  readonly p: Float64Array;
  readonly g: Float64Array;
  private m: Float64Array;
  private v: Float64Array;
  private t = 0;
  private readonly o1: number;
  private readonly o2: number;
  private readonly o3: number;

  readonly nin: number;
  readonly nh: number;
  readonly nout: number;

  constructor(nin: number, nh: number, nout: number, seed = 1, outScale = 1) {
    this.nin = nin;
    this.nh = nh;
    this.nout = nout;
    this.o1 = nin * nh;
    this.o2 = this.o1 + nh;
    this.o3 = this.o2 + nh * nout;
    const n = this.o3 + nout;
    this.p = new Float64Array(n);
    this.g = new Float64Array(n);
    this.m = new Float64Array(n);
    this.v = new Float64Array(n);
    this.reset(seed, outScale);
  }

  reset(seed: number, outScale = 1): void {
    const r = new Rng(seed);
    const { nin, nh, nout, o1, o2, o3 } = this;
    for (let i = 0; i < o1; i++) this.p[i] = r.randn() * Math.sqrt(1 / nin);
    for (let i = o1; i < o2; i++) this.p[i] = 0;
    for (let i = o2; i < o3; i++) this.p[i] = r.randn() * Math.sqrt(1 / nh) * outScale;
    for (let i = o3; i < o3 + nout; i++) this.p[i] = 0;
    this.m.fill(0);
    this.v.fill(0);
    this.g.fill(0);
    this.t = 0;
  }

  /** Forward pass on B rows of X (B x nin). Returns outputs (B x nout) and the hidden activations. */
  forward(X: ArrayLike<number>, B: number): { out: Float64Array; hid: Float64Array } {
    const { nin, nh, nout, o1, o2, o3, p } = this;
    const hid = new Float64Array(B * nh);
    const out = new Float64Array(B * nout);
    for (let b = 0; b < B; b++) {
      for (let j = 0; j < nh; j++) {
        let s = p[o1 + j]!;
        for (let i = 0; i < nin; i++) s += X[b * nin + i]! * p[i * nh + j]!;
        hid[b * nh + j] = Math.tanh(s);
      }
      for (let k = 0; k < nout; k++) {
        let s = p[o3 + k]!;
        for (let j = 0; j < nh; j++) s += hid[b * nh + j]! * p[o2 + j * nout + k]!;
        out[b * nout + k] = s;
      }
    }
    return { out, hid };
  }

  /** Accumulates into `g` the gradient for upstream gradient dOut (B x nout). */
  backward(X: ArrayLike<number>, B: number, hid: Float64Array, dOut: Float64Array): void {
    const { nin, nh, nout, o1, o2, o3, p, g } = this;
    const dh = new Float64Array(nh);
    for (let b = 0; b < B; b++) {
      dh.fill(0);
      for (let k = 0; k < nout; k++) {
        const d = dOut[b * nout + k]!;
        if (d === 0) continue;
        g[o3 + k]! += d;
        for (let j = 0; j < nh; j++) {
          g[o2 + j * nout + k]! += hid[b * nh + j]! * d;
          dh[j]! += p[o2 + j * nout + k]! * d;
        }
      }
      for (let j = 0; j < nh; j++) {
        const hj = hid[b * nh + j]!;
        const d = dh[j]! * (1 - hj * hj);
        if (d === 0) continue;
        g[o1 + j]! += d;
        for (let i = 0; i < nin; i++) g[i * nh + j]! += X[b * nin + i]! * d;
      }
    }
  }

  zeroGrad(): void {
    this.g.fill(0);
  }

  adam(lr: number, b1 = 0.9, b2 = 0.999): void {
    this.t++;
    const c1 = 1 - b1 ** this.t;
    const c2 = 1 - b2 ** this.t;
    for (let i = 0; i < this.p.length; i++) {
      const gi = this.g[i]!;
      this.m[i] = b1 * this.m[i]! + (1 - b1) * gi;
      this.v[i] = b2 * this.v[i]! + (1 - b2) * gi * gi;
      this.p[i]! -= (lr * (this.m[i]! / c1)) / (Math.sqrt(this.v[i]! / c2) + 1e-8);
    }
  }

  copyFrom(o: Net): void {
    this.p.set(o.p);
  }

  /** p <- m p + (1 - m) o.p */
  ema(o: Net, m: number): void {
    for (let i = 0; i < this.p.length; i++) this.p[i] = m * this.p[i]! + (1 - m) * o.p[i]!;
  }
}

/** Divides every row of Y (B x d) by its length. Returns the unit rows and the lengths. */
export function normalizeRows(Y: Float64Array, B: number, d: number): { z: Float64Array; len: Float64Array } {
  const z = new Float64Array(B * d);
  const len = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let k = 0; k < d; k++) s += Y[b * d + k]! ** 2;
    const n = Math.sqrt(s) + 1e-9;
    len[b] = n;
    for (let k = 0; k < d; k++) z[b * d + k] = Y[b * d + k]! / n;
  }
  return { z, len };
}

/** Backward through normalizeRows: dY = (dz - z (z . dz)) / |y|. */
export function normalizeBack(z: Float64Array, len: Float64Array, dz: Float64Array, B: number, d: number): Float64Array {
  const dY = new Float64Array(B * d);
  for (let b = 0; b < B; b++) {
    let dot = 0;
    for (let k = 0; k < d; k++) dot += z[b * d + k]! * dz[b * d + k]!;
    for (let k = 0; k < d; k++) dY[b * d + k] = (dz[b * d + k]! - z[b * d + k]! * dot) / len[b]!;
  }
  return dY;
}

/** S = A Bᵀ * scale, for A (n x d) and B (m x d). */
export function simMatrix(A: Float64Array, n: number, Bm: Float64Array, m: number, d: number, scale = 1): Float64Array {
  const S = new Float64Array(n * m);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += A[i * d + k]! * Bm[j * d + k]!;
      S[i * m + j] = s * scale;
    }
  return S;
}

/** Row softmax of S (n x m), in place into a new array. */
export function rowSoftmax(S: Float64Array, n: number, m: number): Float64Array {
  const P = new Float64Array(n * m);
  for (let i = 0; i < n; i++) {
    let mx = -Infinity;
    for (let j = 0; j < m; j++) mx = Math.max(mx, S[i * m + j]!);
    let sum = 0;
    for (let j = 0; j < m; j++) sum += P[i * m + j] = Math.exp(S[i * m + j]! - mx);
    for (let j = 0; j < m; j++) P[i * m + j]! /= sum;
  }
  return P;
}

/**
 * InfoNCE with row i's positive in column i: mean of -log softmax(S)[i, i] for S = z1 z2ᵀ / tau.
 * Returns the loss, the matrix and the gradients on z1 and z2.
 */
export function infoNCE(z1: Float64Array, z2: Float64Array, B: number, d: number, tau: number): { loss: number; S: Float64Array; dz1: Float64Array; dz2: Float64Array } {
  const S = simMatrix(z1, B, z2, B, d, 1 / tau);
  const P = rowSoftmax(S, B, B);
  let loss = 0;
  for (let i = 0; i < B; i++) loss -= Math.log(Math.max(P[i * B + i]!, 1e-300));
  loss /= B;
  const dS = P;
  for (let i = 0; i < B; i++) dS[i * B + i]! -= 1;
  const dz1 = new Float64Array(B * d);
  const dz2 = new Float64Array(B * d);
  for (let i = 0; i < B; i++)
    for (let j = 0; j < B; j++) {
      const w = dS[i * B + j]! / (B * tau);
      if (w === 0) continue;
      for (let k = 0; k < d; k++) {
        dz1[i * d + k]! += w * z2[j * d + k]!;
        dz2[j * d + k]! += w * z1[i * d + k]!;
      }
    }
  return { loss, S, dz1, dz2 };
}

/** Softmax regression on fixed features, trained from zero: the linear probe. Returns test accuracy. */
export function linearProbe(F: Float64Array, y: ArrayLike<number>, d: number, K: number, train: number[], test: number[], iters = 300, lr = 0.5): number {
  const W = new Float64Array(d * K);
  const b = new Float64Array(K);
  const gW = new Float64Array(d * K);
  const gb = new Float64Array(K);
  const s = new Float64Array(K);
  // Adam keeps the probe's step size sensible whatever the feature scale.
  const mW = new Float64Array(d * K), vW = new Float64Array(d * K), mb = new Float64Array(K), vb = new Float64Array(K);
  for (let it = 1; it <= iters; it++) {
    gW.fill(0);
    gb.fill(0);
    for (const n of train) {
      let mx = -Infinity;
      for (let k = 0; k < K; k++) {
        let v = b[k]!;
        for (let q = 0; q < d; q++) v += F[n * d + q]! * W[q * K + k]!;
        s[k] = v;
        mx = Math.max(mx, v);
      }
      let sum = 0;
      for (let k = 0; k < K; k++) sum += s[k] = Math.exp(s[k]! - mx);
      for (let k = 0; k < K; k++) {
        const gk = (s[k]! / sum - (k === y[n] ? 1 : 0)) / train.length;
        gb[k]! += gk;
        for (let q = 0; q < d; q++) gW[q * K + k]! += F[n * d + q]! * gk;
      }
    }
    const c1 = 1 - 0.9 ** it, c2 = 1 - 0.999 ** it;
    const upd = (p: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array) => {
      for (let i = 0; i < p.length; i++) {
        m[i] = 0.9 * m[i]! + 0.1 * g[i]!;
        v[i] = 0.999 * v[i]! + 0.001 * g[i]! ** 2;
        p[i]! -= (lr * m[i]! / c1) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    };
    upd(W, gW, mW, vW);
    upd(b, gb, mb, vb);
  }
  let ok = 0;
  for (const n of test) {
    let best = 0, bv = -Infinity;
    for (let k = 0; k < K; k++) {
      let v = b[k]!;
      for (let q = 0; q < d; q++) v += F[n * d + q]! * W[q * K + k]!;
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    if (best === y[n]) ok++;
  }
  return ok / test.length;
}
