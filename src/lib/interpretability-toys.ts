// Two small models trained live in the chapter: the toy model of superposition (Elhage et al.,
// 2022) and a sparse autoencoder on synthetic activations built from known features.
import { Rng } from '../core/rand';

/** Adam on a list of flat parameter arrays. */
class Adam {
  private m: Float64Array[];
  private v: Float64Array[];
  t = 0;
  constructor(
    private ps: Float64Array[],
    public lr: number,
  ) {
    this.m = ps.map((p) => new Float64Array(p.length));
    this.v = ps.map((p) => new Float64Array(p.length));
  }
  step(gs: Float64Array[]): void {
    this.t++;
    const c1 = 1 - 0.9 ** this.t;
    const c2 = 1 - 0.999 ** this.t;
    this.ps.forEach((p, k) => {
      const g = gs[k]!;
      const m = this.m[k]!;
      const v = this.v[k]!;
      for (let i = 0; i < p.length; i++) {
        m[i] = 0.9 * m[i]! + 0.1 * g[i]!;
        v[i] = 0.999 * v[i]! + 0.001 * g[i]! * g[i]!;
        p[i]! -= (this.lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    });
  }
}

// ---------------------------------------------------------------- superposition

export const TOY_N = 5;
export const TOY_M = 2;
export const TOY_STEPS = 6000;
export const TOY_IMPORTANCE = Array.from({ length: TOY_N }, (_, i) => 0.8 ** i);

/**
 * n sparse features squeezed into m dimensions: x = W f, then f' = ReLU(Wᵀ x + b), trained to
 * reconstruct f with an importance-weighted squared error.
 */
export class ToyModel {
  /** (m, n), column i is feature i's direction. */
  W = new Float64Array(TOY_M * TOY_N);
  b = new Float64Array(TOY_N);
  steps = 0;
  loss = 0;
  private opt: Adam;
  private rng: Rng;
  constructor(
    public S: number,
    seed = 3,
  ) {
    const r = new Rng(seed);
    for (let i = 0; i < this.W.length; i++) this.W[i] = 0.3 * r.randn();
    this.rng = new Rng(seed + 100);
    this.opt = new Adam([this.W, this.b], 0.01);
  }

  col(i: number): [number, number] {
    return [this.W[i]!, this.W[TOY_N + i]!];
  }

  /** Reconstruction of one input: f' = ReLU(Wᵀ W f + b). */
  reconstruct(f: number[]): number[] {
    const x = [0, 0];
    for (let i = 0; i < TOY_N; i++) for (let a = 0; a < TOY_M; a++) x[a]! += this.W[a * TOY_N + i]! * f[i]!;
    return Array.from({ length: TOY_N }, (_, k) => Math.max(0, this.W[k]! * x[0]! + this.W[TOY_N + k]! * x[1]! + this.b[k]!));
  }

  /** Wᵀ W: (n, n) dot products between feature directions. */
  gram(): number[][] {
    return Array.from({ length: TOY_N }, (_, i) => Array.from({ length: TOY_N }, (_, j) => this.W[i]! * this.W[j]! + this.W[TOY_N + i]! * this.W[TOY_N + j]!));
  }

  train(k: number, B = 256): void {
    const n = TOY_N;
    const gW = new Float64Array(this.W.length);
    const gb = new Float64Array(n);
    const f = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let s = 0; s < k; s++) {
      gW.fill(0);
      gb.fill(0);
      let loss = 0;
      for (let e = 0; e < B; e++) {
        for (let i = 0; i < n; i++) f[i] = this.rng.next() < this.S ? 0 : this.rng.next();
        let h0 = 0;
        let h1 = 0;
        for (let i = 0; i < n; i++) {
          h0 += this.W[i]! * f[i]!;
          h1 += this.W[n + i]! * f[i]!;
        }
        let dh0 = 0;
        let dh1 = 0;
        for (let i = 0; i < n; i++) {
          const y = this.W[i]! * h0 + this.W[n + i]! * h1 + this.b[i]!;
          const r = y > 0 ? y : 0;
          const err = r - f[i]!;
          loss += TOY_IMPORTANCE[i]! * err * err;
          dy[i] = y > 0 ? (2 * TOY_IMPORTANCE[i]! * err) / B : 0;
          gb[i]! += dy[i]!;
          gW[i]! += h0 * dy[i]!;
          gW[n + i]! += h1 * dy[i]!;
          dh0 += this.W[i]! * dy[i]!;
          dh1 += this.W[n + i]! * dy[i]!;
        }
        for (let i = 0; i < n; i++) {
          gW[i]! += dh0 * f[i]!;
          gW[n + i]! += dh1 * f[i]!;
        }
      }
      this.opt.step([gW, gb]);
      this.loss = loss / B;
      this.steps++;
    }
  }
}

// ---------------------------------------------------------------- sparse autoencoder

export const SAE_D = 8;
export const SAE_N = 16;
export const SAE_P = 0.05;
export const SAE_STEPS = 3000;
export const SAE_NAMES = ['DNA', 'French', 'base64', 'legal', 'bridge', 'recipe', 'Python', 'rhyme', 'sports', 'Korean', 'math', 'citation', 'HTML', 'weather', 'music', 'error'];

/** The hidden truth behind the synthetic activations: 16 unit directions in 8 dimensions. */
export const TRUE_DIRS: number[][] = (() => {
  const r = new Rng(21);
  return Array.from({ length: SAE_N }, () => {
    const v = Array.from({ length: SAE_D }, () => r.randn());
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  });
})();

/** One synthetic activation: each feature fires with chance 5%, at a strength from 0.2 to 1. */
export function sampleActivation(r: Rng, f: Float64Array, x: Float64Array): void {
  x.fill(0);
  for (let k = 0; k < SAE_N; k++) {
    f[k] = r.next() < SAE_P ? 0.2 + 0.8 * r.next() : 0;
    if (f[k]) for (let d = 0; d < SAE_D; d++) x[d]! += f[k]! * TRUE_DIRS[k]![d]!;
  }
}

export interface Sample {
  f: Float64Array;
  x: Float64Array;
}

/** A fixed set of activations for figures and evaluation. */
export function sampleSet(n: number, seed: number): Sample[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => {
    const s = { f: new Float64Array(SAE_N), x: new Float64Array(SAE_D) };
    sampleActivation(r, s.f, s.x);
    return s;
  });
}

/**
 * f = ReLU(W_enc (x - b_dec) + b_enc), x̂ = W_dec f + b_dec, loss = |x - x̂|² + λ Σ f,
 * with every decoder column kept at unit length.
 */
export class SAE {
  We: Float64Array;
  be: Float64Array;
  Wd: Float64Array;
  bd = new Float64Array(SAE_D);
  steps = 0;
  mse = 0;
  l1 = 0;
  private opt: Adam;
  private rng: Rng;
  constructor(
    readonly m: number,
    public lam: number,
    seed = 10,
  ) {
    const r = new Rng(seed);
    this.Wd = new Float64Array(SAE_D * m);
    for (let i = 0; i < this.Wd.length; i++) this.Wd[i] = r.randn();
    this.normalize();
    this.We = new Float64Array(m * SAE_D);
    for (let j = 0; j < m; j++) for (let d = 0; d < SAE_D; d++) this.We[j * SAE_D + d] = this.Wd[d * m + j]!;
    this.be = new Float64Array(m);
    this.rng = new Rng(seed + 1);
    this.opt = new Adam([this.We, this.be, this.Wd, this.bd], 0.01);
  }

  private normalize(): void {
    for (let j = 0; j < this.m; j++) {
      let s = 0;
      for (let d = 0; d < SAE_D; d++) s += this.Wd[d * this.m + j]! ** 2;
      const n = Math.sqrt(s) || 1;
      for (let d = 0; d < SAE_D; d++) this.Wd[d * this.m + j]! /= n;
    }
  }

  /** Decoder column j: the direction feature j writes. */
  dir(j: number): number[] {
    return Array.from({ length: SAE_D }, (_, d) => this.Wd[d * this.m + j]!);
  }

  encode(x: ArrayLike<number>, out = new Float64Array(this.m)): Float64Array {
    for (let j = 0; j < this.m; j++) {
      let s = this.be[j]!;
      for (let d = 0; d < SAE_D; d++) s += this.We[j * SAE_D + d]! * (x[d]! - this.bd[d]!);
      out[j] = s > 0 ? s : 0;
    }
    return out;
  }

  decode(f: ArrayLike<number>, out = new Float64Array(SAE_D)): Float64Array {
    for (let d = 0; d < SAE_D; d++) {
      let s = this.bd[d]!;
      for (let j = 0; j < this.m; j++) s += this.Wd[d * this.m + j]! * f[j]!;
      out[d] = s;
    }
    return out;
  }

  train(k: number, B = 256): void {
    const m = this.m;
    const gWe = new Float64Array(this.We.length);
    const gbe = new Float64Array(m);
    const gWd = new Float64Array(this.Wd.length);
    const gbd = new Float64Array(SAE_D);
    const x = new Float64Array(SAE_D);
    const ft = new Float64Array(SAE_N);
    const xc = new Float64Array(SAE_D);
    const pre = new Float64Array(m);
    const f = new Float64Array(m);
    const e = new Float64Array(SAE_D);
    const dpre = new Float64Array(m);
    for (let s = 0; s < k; s++) {
      gWe.fill(0);
      gbe.fill(0);
      gWd.fill(0);
      gbd.fill(0);
      let mse = 0;
      let l1 = 0;
      for (let b = 0; b < B; b++) {
        sampleActivation(this.rng, ft, x);
        for (let d = 0; d < SAE_D; d++) xc[d] = x[d]! - this.bd[d]!;
        for (let j = 0; j < m; j++) {
          let v = this.be[j]!;
          for (let d = 0; d < SAE_D; d++) v += this.We[j * SAE_D + d]! * xc[d]!;
          pre[j] = v;
          f[j] = v > 0 ? v : 0;
          l1 += f[j]!;
        }
        for (let d = 0; d < SAE_D; d++) {
          let v = this.bd[d]!;
          for (let j = 0; j < m; j++) v += this.Wd[d * m + j]! * f[j]!;
          e[d] = v - x[d]!;
          mse += e[d]! * e[d]!;
        }
        for (let d = 0; d < SAE_D; d++) {
          const g = (2 * e[d]!) / B;
          gbd[d]! += g;
          for (let j = 0; j < m; j++) gWd[d * m + j]! += g * f[j]!;
        }
        for (let j = 0; j < m; j++) {
          if (pre[j]! <= 0) {
            dpre[j] = 0;
            continue;
          }
          let g = this.lam / B;
          for (let d = 0; d < SAE_D; d++) g += ((2 * e[d]!) / B) * this.Wd[d * m + j]!;
          dpre[j] = g;
          gbe[j]! += g;
          for (let d = 0; d < SAE_D; d++) gWe[j * SAE_D + d]! += g * xc[d]!;
        }
        for (let d = 0; d < SAE_D; d++) {
          let g = 0;
          for (let j = 0; j < m; j++) g += dpre[j]! * this.We[j * SAE_D + d]!;
          gbd[d]! -= g;
        }
      }
      // Only the part of each decoder gradient that keeps the column's length.
      for (let j = 0; j < m; j++) {
        let dot = 0;
        for (let d = 0; d < SAE_D; d++) dot += this.Wd[d * m + j]! * gWd[d * m + j]!;
        for (let d = 0; d < SAE_D; d++) gWd[d * m + j]! -= dot * this.Wd[d * m + j]!;
      }
      this.opt.step([gWe, gbe, gWd, gbd]);
      this.normalize();
      this.mse = mse / B;
      this.l1 = l1 / B;
      this.steps++;
    }
  }

  /** Reconstruction quality and sparsity on a fixed set. */
  evaluate(set: Sample[]): { fvu: number; l0: number; dead: number } {
    const mean = new Float64Array(SAE_D);
    set.forEach((s) => s.x.forEach((v, d) => (mean[d]! += v / set.length)));
    let err = 0;
    let tot = 0;
    let act = 0;
    const alive = new Uint8Array(this.m);
    const f = new Float64Array(this.m);
    const xh = new Float64Array(SAE_D);
    for (const s of set) {
      this.encode(s.x, f);
      this.decode(f, xh);
      for (let d = 0; d < SAE_D; d++) {
        err += (xh[d]! - s.x[d]!) ** 2;
        tot += (s.x[d]! - mean[d]!) ** 2;
      }
      f.forEach((v, j) => {
        if (v > 1e-6) {
          act++;
          alive[j] = 1;
        }
      });
    }
    return { fvu: err / tot, l0: act / set.length, dead: this.m - alive.reduce((a, b) => a + b, 0) };
  }

  /** |cos| between every learned decoder column and every true direction: (m, 16). */
  match(): number[][] {
    return Array.from({ length: this.m }, (_, j) => {
      const dj = this.dir(j);
      return TRUE_DIRS.map((t) => Math.abs(t.reduce((a, v, d) => a + v * dj[d]!, 0)));
    });
  }
}
