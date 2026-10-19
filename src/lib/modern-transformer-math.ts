import { Rng } from '../core/rand';

// Pure computations shared by the chapter's figures and the lecture's scenes.

export const silu = (z: number): number => z / (1 + Math.exp(-z));
export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
export const gelu = (z: number): number => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z ** 3)));
export const relu = (z: number): number => Math.max(0, z);

export function mean(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]!;
  return s / x.length;
}

export function layerNorm(x: number[], eps = 1e-5): number[] {
  const mu = mean(x);
  const v = mean(x.map((a) => (a - mu) ** 2));
  return x.map((a) => (a - mu) / Math.sqrt(v + eps));
}

export function rmsNorm(x: number[], eps = 1e-6): number[] {
  const r = Math.sqrt(mean(x.map((a) => a * a)) + eps);
  return x.map((a) => a / r);
}

export function softmax(s: number[]): number[] {
  const m = Math.max(...s);
  const e = s.map((a) => Math.exp(a - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((a) => a / z);
}

/** Entropy in bits of a probability vector. */
export function entropyBits(p: number[]): number {
  let h = 0;
  for (const a of p) if (a > 1e-300) h -= a * Math.log2(a);
  return h;
}

// ---------------------------------------------------------------- residual highway

/**
 * A random residual stack of L ReLU-MLP sub-blocks (width d, hidden h), run once forward.
 * `reach[0]` is the weight with which the embedding arrives in the top stream along the
 * identity path, `reach[l + 1]` the weight of sub-block l's output. Post-norm divides
 * everything written so far by each LayerNorm's sigma; pre-norm never touches the stream.
 * `rms[l]` is the stream's RMS after layer l.
 */
export function highway(L: number, mode: 'post' | 'pre', beta: number, seed = 3, d = 32, h = 64): { reach: number[]; rms: number[] } {
  const r = new Rng(seed);
  let x = Array.from({ length: d }, () => r.randn());
  const reach = new Array<number>(L + 1).fill(1);
  const rms: number[] = [];
  const s1 = Math.sqrt(2 / d);
  const s2 = Math.sqrt(1 / h) * beta;
  for (let l = 0; l < L; l++) {
    const W1 = Float64Array.from({ length: h * d }, () => r.randn() * s1);
    const W2 = Float64Array.from({ length: d * h }, () => r.randn() * s2);
    const inp = mode === 'pre' ? layerNorm(x) : x;
    const a = new Float64Array(h);
    for (let i = 0; i < h; i++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += W1[i * d + j]! * inp[j]!;
      a[i] = s > 0 ? s : 0;
    }
    const y = x.slice();
    for (let i = 0; i < d; i++) {
      let s = 0;
      for (let j = 0; j < h; j++) s += W2[i * h + j]! * a[j]!;
      y[i]! += s;
    }
    if (mode === 'post') {
      const mu = mean(y);
      const sigma = Math.sqrt(mean(y.map((t) => (t - mu) ** 2)) + 1e-5);
      x = y.map((t) => (t - mu) / sigma);
      for (let j = 0; j <= l + 1; j++) reach[j]! /= sigma;
    } else x = y;
    rms.push(Math.sqrt(mean(x.map((t) => t * t))));
  }
  return { reach, rms };
}

// ---------------------------------------------------------------- RoPE

/** RoPE speeds theta_i = base^(-2i/d), one per pair of dimensions. */
export function ropeTheta(d: number, base = 10000): number[] {
  return Array.from({ length: d / 2 }, (_, i) => base ** ((-2 * i) / d));
}

/** Rotates each adjacent pair (x[2i], x[2i+1]) by pos * theta[i]. */
export function rope(x: number[], pos: number, theta: number[]): number[] {
  const out = x.slice();
  for (let i = 0; i < theta.length; i++) {
    const a = pos * theta[i]!;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x0 = x[2 * i]!;
    const x1 = x[2 * i + 1]!;
    out[2 * i] = x0 * c - x1 * s;
    out[2 * i + 1] = x0 * s + x1 * c;
  }
  return out;
}

export const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i]!, 0);

// ---------------------------------------------------------------- online softmax

export interface OnlineStep {
  from: number;
  to: number;
  tileMax: number;
  mOld: number;
  mNew: number;
  /** exp(mOld - mNew): how much the old sum and accumulator shrink. */
  corr: number;
  lOld: number;
  lNew: number;
  oOld: number;
  oNew: number;
}

/** One query row: scores S against values v (one channel), processed B keys at a time. */
export function onlineSoftmax(S: number[], v: number[], B: number): { steps: OnlineStep[]; online: number; direct: number } {
  let m = -Infinity;
  let l = 0;
  let o = 0;
  const steps: OnlineStep[] = [];
  for (let a = 0; a < S.length; a += B) {
    const b = Math.min(S.length, a + B);
    const tile = S.slice(a, b);
    const tileMax = Math.max(...tile);
    const mNew = Math.max(m, tileMax);
    const corr = Number.isFinite(m) ? Math.exp(m - mNew) : 0;
    let ls = 0;
    let os = 0;
    for (let j = a; j < b; j++) {
      const e = Math.exp(S[j]! - mNew);
      ls += e;
      os += e * v[j]!;
    }
    const lNew = l * corr + ls;
    const oNew = o * corr + os;
    steps.push({ from: a, to: b, tileMax, mOld: m, mNew, corr, lOld: l, lNew, oOld: o, oNew });
    m = mNew;
    l = lNew;
    o = oNew;
  }
  const p = softmax(S);
  const direct = p.reduce((s, pj, j) => s + pj * v[j]!, 0);
  return { steps, online: o / l, direct };
}

// ---------------------------------------------------------------- long context

export type Scaling = 'none' | 'pi' | 'ntk' | 'yarn';

/**
 * RoPE speeds after stretching a model trained at `Ltrain` tokens to `s` times that length.
 * pi: every speed divided by s. ntk: base raised to base * s^(d / (d - 2)). yarn: speeds of
 * pairs that turned fewer than `alpha` times in training are divided by s, more than `beta`
 * times are kept, with a linear ramp between (YaRN's "NTK-by-parts").
 */
export function scaledTheta(method: Scaling, s: number, d: number, base: number, Ltrain: number, alpha = 1, beta = 32): number[] {
  const th = ropeTheta(d, base);
  if (method === 'none' || s <= 1) return th;
  if (method === 'pi') return th.map((t) => t / s);
  if (method === 'ntk') return ropeTheta(d, base * s ** (d / (d - 2)));
  return th.map((t) => {
    const turns = (Ltrain * t) / (2 * Math.PI);
    const g = turns < alpha ? 0 : turns > beta ? 1 : (turns - alpha) / (beta - alpha);
    return (1 - g) * (t / s) + g * t;
  });
}

/**
 * How far past the trained angle range pair i is pushed at the new length: 1 means every
 * angle it now needs was seen in training. Pairs that completed a full turn in training saw
 * every angle already.
 */
export function overshoot(thetaOld: number[], thetaNew: number[], Ltrain: number, Lnew: number): number[] {
  return thetaOld.map((t, i) => {
    const trained = Ltrain * t;
    if (trained >= 2 * Math.PI) return 1;
    return Math.max(1, (Lnew * thetaNew[i]!) / trained);
  });
}

// ---------------------------------------------------------------- KV cache

export interface ModelPreset {
  id: string;
  name: string;
  layers: number;
  heads: number;
  kvHeads: number;
  dHead: number;
  /** Parameter count, for the weights bar. */
  params: number;
  ctx: number;
}

/** Published configurations (GPT-2 paper; Llama 2 and Llama 3 model cards and configs). */
export const PRESETS: ModelPreset[] = [
  { id: 'gpt2', name: 'GPT-2 small', layers: 12, heads: 12, kvHeads: 12, dHead: 64, params: 124e6, ctx: 1024 },
  { id: 'l2-7', name: 'Llama 2 7B', layers: 32, heads: 32, kvHeads: 32, dHead: 128, params: 6.74e9, ctx: 4096 },
  { id: 'l3-8', name: 'Llama 3 8B', layers: 32, heads: 32, kvHeads: 8, dHead: 128, params: 8.03e9, ctx: 8192 },
  { id: 'l3-70', name: 'Llama 3 70B', layers: 80, heads: 64, kvHeads: 8, dHead: 128, params: 70.6e9, ctx: 8192 },
];

export const kvBytesPerToken = (layers: number, kvHeads: number, dHead: number, bytes: number): number => 2 * layers * kvHeads * dHead * bytes;

/** 1536 -> "1.5 KiB", binary units. */
export function bytesStr(b: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b >= 100 || i === 0 ? Math.round(b) : b >= 10 ? b.toFixed(1) : b.toFixed(2)} ${units[i]}`;
}

/** 4096 -> "4K", 131072 -> "128K". */
export const tokStr = (n: number): string => (n >= 1024 ? `${Math.round(n / 1024)}K` : String(n));

// ---------------------------------------------------------------- toy data

/** Seeded scores and values for the online-softmax figures. */
export function toyRow(seed: number, n = 12): { S: number[]; v: number[] } {
  const r = new Rng(seed);
  const S = Array.from({ length: n }, () => Math.round(r.randn() * 2 * 10) / 10);
  const v = Array.from({ length: n }, () => Math.round(r.randn() * 10) / 10);
  return { S, v };
}
