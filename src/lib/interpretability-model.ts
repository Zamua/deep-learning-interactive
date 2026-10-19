// The chapter's two-layer, attention-only transformer: one head per layer, no MLPs, no layer
// norm, learned positions. Trained offline in PyTorch on periodic random letters; this is its
// forward pass, which reproduces PyTorch's logits to float precision.
import { Rng } from '../core/rand';
import { CKPT_STEPS, EARLY_B64, FINAL_B64 } from './interpretability-induction-data';

export const V = 20;
export const T = 32;
export const D = 32;
export const DH = 16;
export const LETTERS = 'ABCDEFGHIJKLMNOPQRST'.split('');
export const HALF = 12;

/** Row-major matrix. */
export interface Mat {
  r: number;
  c: number;
  a: Float64Array;
}

export const mat = (r: number, c: number): Mat => ({ r, c, a: new Float64Array(r * c) });
export const at = (m: Mat, i: number, j: number): number => m.a[i * m.c + j]!;

export function matmul(A: Mat, B: Mat): Mat {
  const out = mat(A.r, B.c);
  for (let i = 0; i < A.r; i++)
    for (let k = 0; k < A.c; k++) {
      const v = A.a[i * A.c + k]!;
      if (v === 0) continue;
      const bo = k * B.c;
      const oo = i * B.c;
      for (let j = 0; j < B.c; j++) out.a[oo + j]! += v * B.a[bo + j]!;
    }
  return out;
}

export function transpose(A: Mat): Mat {
  const out = mat(A.c, A.r);
  for (let i = 0; i < A.r; i++) for (let j = 0; j < A.c; j++) out.a[j * A.r + i] = A.a[i * A.c + j]!;
  return out;
}

export function add(A: Mat, B: Mat): Mat {
  const out = mat(A.r, A.c);
  for (let i = 0; i < out.a.length; i++) out.a[i] = A.a[i]! + B.a[i]!;
  return out;
}

export const row = (m: Mat, i: number): Float64Array => m.a.subarray(i * m.c, (i + 1) * m.c);

export function softmaxVec(v: ArrayLike<number>): number[] {
  let mx = -Infinity;
  for (let i = 0; i < v.length; i++) mx = Math.max(mx, v[i]!);
  const e = Array.from(v, (x) => Math.exp(x - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

export interface Weights {
  E: Mat;
  P: Mat;
  Wq: Mat[];
  Wk: Mat[];
  Wv: Mat[];
  Wo: Mat[];
  U: Mat;
}

export const PARAMS = V * D + T * D + 2 * D * DH * 3 + 2 * DH * D + D * V;

/** Unpacks one checkpoint (E, P, Wq, Wk, Wv, Wo, U in that order, as exported). */
export function unpack(f: Float32Array, off = 0): Weights {
  let o = off;
  const take = (r: number, c: number): Mat => {
    const m = mat(r, c);
    for (let i = 0; i < r * c; i++) m.a[i] = f[o + i]!;
    o += r * c;
    return m;
  };
  const E = take(V, D);
  const P = take(T, D);
  const Wq = [take(D, DH), take(D, DH)];
  const Wk = [take(D, DH), take(D, DH)];
  const Wv = [take(D, DH), take(D, DH)];
  const Wo = [take(DH, D), take(DH, D)];
  const U = take(D, V);
  return { E, P, Wq, Wk, Wv, Wo, U };
}

function fromB64(s: string): Weights {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return unpack(new Float32Array(bytes.buffer));
}

let finalW: Weights | null = null;
let earlyW: Weights | null = null;
/** The trained weights (step 4000), bundled so a lecture can draw them without a fetch. */
export const finalWeights = (): Weights => (finalW ??= fromB64(FINAL_B64));
/** The weights at step 300, on the plateau before the phase change. */
export const earlyWeights = (): Weights => (earlyW ??= fromB64(EARLY_B64));

let ckpts: Promise<Weights[]> | null = null;
/** Every checkpoint in CKPT_STEPS order (0.56 MB). */
export function loadCheckpoints(): Promise<Weights[]> {
  ckpts ??= fetch('./data/interpretability-induction.bin')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const f = new Float32Array(buf);
      return CKPT_STEPS.map((_, k) => unpack(f, k * PARAMS));
    });
  ckpts.catch(() => (ckpts = null));
  return ckpts;
}

export interface Trace {
  ids: number[];
  /** Residual stream after the embedding, after head 0 and after head 1: (L, D) each. */
  x0: Mat;
  x1: Mat;
  x2: Mat;
  /** Each head's attention (L, L) and what it writes into the stream (L, D). */
  A: Mat[];
  h: Mat[];
  logits: Mat;
}

export function forward(w: Weights, ids: number[]): Trace {
  const L = ids.length;
  const x0 = mat(L, D);
  ids.forEach((t, i) => {
    for (let j = 0; j < D; j++) x0.a[i * D + j] = w.E.a[t * D + j]! + w.P.a[i * D + j]!;
  });
  const xs = [x0];
  const A: Mat[] = [];
  const h: Mat[] = [];
  const sc = 1 / Math.sqrt(DH);
  for (let l = 0; l < 2; l++) {
    const x = xs[l]!;
    const q = matmul(x, w.Wq[l]!);
    const k = matmul(x, w.Wk[l]!);
    const v = matmul(x, w.Wv[l]!);
    const a = mat(L, L);
    for (let i = 0; i < L; i++) {
      const s: number[] = [];
      for (let j = 0; j <= i; j++) {
        let dot = 0;
        for (let m = 0; m < DH; m++) dot += q.a[i * DH + m]! * k.a[j * DH + m]!;
        s.push(dot * sc);
      }
      softmaxVec(s).forEach((p, j) => (a.a[i * L + j] = p));
    }
    const out = matmul(matmul(a, v), w.Wo[l]!);
    A.push(a);
    h.push(out);
    xs.push(add(x, out));
  }
  return { ids, x0, x1: xs[1]!, x2: xs[2]!, A, h, logits: matmul(xs[2]!, w.U) };
}

/** Logits from any vector in the stream: x W_U (this model has no final layer norm). */
export function lens(w: Weights, x: Mat, i: number): number[] {
  const out = new Array<number>(V).fill(0);
  for (let m = 0; m < D; m++) {
    const xv = x.a[i * D + m]!;
    for (let t = 0; t < V; t++) out[t]! += xv * w.U.a[m * V + t]!;
  }
  return out;
}

/** `half` distinct random letters, then either the same letters again or fresh random ones. */
export function makeSequence(seed: number, repeat = true, half = HALF): number[] {
  const r = new Rng(seed);
  const first = r.shuffle(Array.from({ length: V }, (_, i) => i)).slice(0, half);
  const second = repeat ? first : Array.from({ length: half }, () => r.int(V));
  return [...first, ...second];
}

/** Training data: random letters repeating with a random period from 6 to 16. */
export function trainingSequence(r: Rng, L: number): number[] {
  const P = 6 + r.int(11);
  const base = Array.from({ length: P }, () => r.int(V));
  return Array.from({ length: L }, (_, i) => base[i % P]!);
}

// ---------------------------------------------------------------- circuits

/** W_QK = W_Q W_Kᵀ and W_OV = W_V W_O for head l: (D, D) each. */
export function circuits(w: Weights, l: number): { QK: Mat; OV: Mat } {
  return { QK: matmul(w.Wq[l]!, transpose(w.Wk[l]!)), OV: matmul(w.Wv[l]!, w.Wo[l]!) };
}

/** Head 0 from positions alone: softmax over j <= i of P_i W_QK P_jᵀ / sqrt(DH). */
export function qkPositions(w: Weights, L: number): Mat {
  const { QK } = circuits(w, 0);
  const P = mat(L, D);
  P.a.set(w.P.a.subarray(0, L * D));
  const S = matmul(matmul(P, QK), transpose(P));
  const out = mat(L, L);
  for (let i = 0; i < L; i++) {
    const s = Array.from({ length: i + 1 }, (_, j) => S.a[i * L + j]! / Math.sqrt(DH));
    softmaxVec(s).forEach((p, j) => (out.a[i * L + j] = p));
  }
  return out;
}

/** Head 1's score for a query token a against a key whose previous token was b, via head 0's OV. */
export function qkComposed(w: Weights): Mat {
  const QK1 = circuits(w, 1).QK;
  const OV0 = circuits(w, 0).OV;
  const S = matmul(matmul(matmul(w.E, QK1), transpose(OV0)), transpose(w.E));
  for (let i = 0; i < S.a.length; i++) S.a[i]! /= Math.sqrt(DH);
  return S;
}

/** Head l's effect on the logits when it attends to token a: E W_OV W_U, (V, V). */
export function ovTokens(w: Weights, l: number): Mat {
  return matmul(matmul(w.E, circuits(w, l).OV), w.U);
}

// ---------------------------------------------------------------- probes

export type ProbeTarget = 'current' | 'previous' | 'next';

export interface ProbeSet {
  /** Per layer 0..2: rows of D numbers. */
  X: Float64Array[];
  y: Int32Array;
  n: number;
}

/** Residual vectors and labels from `count` repeated sequences, positions chosen per target. */
export function probeData(w: Weights, target: ProbeTarget, seed0: number, count: number): ProbeSet {
  const rows: number[][][] = [[], [], []];
  const ys: number[] = [];
  for (let s = 0; s < count; s++) {
    const ids = makeSequence(seed0 + s);
    const tr = forward(w, ids);
    const L = ids.length;
    const lo = target === 'next' ? HALF : 1;
    const hi = target === 'next' ? L - 1 : L;
    for (let i = lo; i < hi; i++) {
      [tr.x0, tr.x1, tr.x2].forEach((x, l) => rows[l]!.push(Array.from(row(x, i))));
      ys.push(target === 'current' ? ids[i]! : target === 'previous' ? ids[i - 1]! : ids[i + 1]!);
    }
  }
  return { X: rows.map((r) => Float64Array.from(r.flat())), y: Int32Array.from(ys), n: ys.length };
}

/** A softmax-regression probe on frozen D-dimensional vectors, trained with Adam. */
export class Probe {
  W = new Float64Array(D * V);
  b = new Float64Array(V);
  private m = new Float64Array(D * V + V);
  private v = new Float64Array(D * V + V);
  t = 0;
  constructor(readonly lr = 0.05) {}

  private s = new Float64Array(V);
  private g = new Float64Array(D * V + V);

  /** Scores for row i of X into this.s. */
  private score(X: Float64Array, i: number): Float64Array {
    const s = this.s;
    s.set(this.b);
    for (let d = 0; d < D; d++) {
      const xv = X[i * D + d]!;
      const o = d * V;
      for (let c = 0; c < V; c++) s[c]! += xv * this.W[o + c]!;
    }
    return s;
  }

  step(set: ProbeSet, l: number): number {
    const X = set.X[l]!;
    const g = this.g;
    g.fill(0);
    let loss = 0;
    for (let i = 0; i < set.n; i++) {
      const s = this.score(X, i);
      let mx = -Infinity;
      for (let c = 0; c < V; c++) mx = Math.max(mx, s[c]!);
      let tot = 0;
      for (let c = 0; c < V; c++) tot += s[c] = Math.exp(s[c]! - mx);
      for (let c = 0; c < V; c++) s[c]! /= tot;
      const y = set.y[i]!;
      loss -= Math.log(s[y]! + 1e-12);
      s[y]! -= 1;
      for (let d = 0; d < D; d++) {
        const xv = X[i * D + d]!;
        const o = d * V;
        for (let c = 0; c < V; c++) g[o + c]! += xv * s[c]!;
      }
      for (let c = 0; c < V; c++) g[D * V + c]! += s[c]!;
    }
    this.t++;
    const b1 = 0.9;
    const b2 = 0.999;
    const c1 = 1 - b1 ** this.t;
    const c2 = 1 - b2 ** this.t;
    for (let k = 0; k < g.length; k++) {
      const gk = g[k]! / set.n;
      this.m[k] = b1 * this.m[k]! + (1 - b1) * gk;
      this.v[k] = b2 * this.v[k]! + (1 - b2) * gk * gk;
      const upd = (this.lr * (this.m[k]! / c1)) / (Math.sqrt(this.v[k]! / c2) + 1e-8);
      if (k < D * V) this.W[k]! -= upd;
      else this.b[k - D * V]! -= upd;
    }
    return loss / set.n;
  }

  accuracy(set: ProbeSet, l: number): number {
    let ok = 0;
    const X = set.X[l]!;
    for (let i = 0; i < set.n; i++) {
      const s = this.score(X, i);
      let best = 0;
      for (let c = 1; c < V; c++) if (s[c]! > s[best]!) best = c;
      if (best === set.y[i]) ok++;
    }
    return ok / set.n;
  }
}
