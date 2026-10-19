/** Small dense linear algebra and the toy simulations behind the optimizers chapter and lecture. */
import { Rng } from '../core/rand';

export type Mat = number[][];

/** Muon's tuned quintic coefficients (a, b, c), and the classic cubic Newton-Schulz for contrast. */
export const NS5: [number, number, number] = [3.4445, -4.775, 2.0315];
export const NS3: [number, number, number] = [1.5, -0.5, 0];

/** Singular values of the demo momentum matrix: a few strong directions, many weak ones. */
export const NS_SPECTRUM = [10, 3, 1, 0.4, 0.15, 0.06, 0.02, 0.01];

export function zeros(m: number, n: number): Mat {
  return Array.from({ length: m }, () => new Array<number>(n).fill(0));
}
export function transpose(A: Mat): Mat {
  return A[0]!.map((_, j) => A.map((r) => r[j]!));
}
export function matmul(A: Mat, B: Mat): Mat {
  const m = A.length, k = B.length, n = B[0]!.length;
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let p = 0; p < k; p++) {
      const a = A[i]![p]!;
      if (a === 0) continue;
      const br = B[p]!, cr = C[i]!;
      for (let j = 0; j < n; j++) cr[j]! += a * br[j]!;
    }
  return C;
}
export function frob(A: Mat): number {
  let s = 0;
  for (const r of A) for (const v of r) s += v * v;
  return Math.sqrt(s);
}
export function scaled(A: Mat, k: number): Mat {
  return A.map((r) => r.map((v) => v * k));
}

/** The polynomial one Newton-Schulz step applies to each singular value. */
export function nsPoly(s: number, coef = NS5): number {
  return coef[0] * s + coef[1] * s ** 3 + coef[2] * s ** 5;
}

/** One step X <- aX + (bA + cA²)X with A = X Xᵀ. X must be wide (rows <= cols). */
export function nsStep(X: Mat, coef = NS5): Mat {
  const A = matmul(X, transpose(X));
  const A2 = matmul(A, A);
  const B = A.map((r, i) => r.map((v, j) => coef[1] * v + coef[2] * A2[i]![j]!));
  const BX = matmul(B, X);
  return X.map((r, i) => r.map((v, j) => coef[0] * v + BX[i]![j]!));
}

/** Muon's orthogonalization: normalize, then `steps` Newton-Schulz iterations on the wide orientation. */
export function newtonSchulz(G: Mat, steps = 5, coef = NS5): Mat {
  const tall = G.length > G[0]!.length;
  let X = tall ? transpose(G) : G.map((r) => [...r]);
  X = scaled(X, 1 / (frob(X) + 1e-7));
  for (let k = 0; k < steps; k++) X = nsStep(X, coef);
  return tall ? transpose(X) : X;
}

/** Eigenvalues of a symmetric matrix by cyclic Jacobi rotations, largest first. */
export function symEig(S0: Mat): number[] {
  const n = S0.length;
  const S = S0.map((r) => [...r]);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += S[p]![q]! ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const apq = S[p]![q]!;
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (S[q]![q]! - S[p]![p]!) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const skp = S[k]![p]!, skq = S[k]![q]!;
          S[k]![p] = c * skp - s * skq;
          S[k]![q] = s * skp + c * skq;
        }
        for (let k = 0; k < n; k++) {
          const spk = S[p]![k]!, sqk = S[q]![k]!;
          S[p]![k] = c * spk - s * sqk;
          S[q]![k] = s * spk + c * sqk;
        }
      }
  }
  return S.map((r, i) => r[i]!).sort((a, b) => b - a);
}

/** Singular values, largest first, from the eigenvalues of the smaller Gram matrix. */
export function singularValues(X: Mat): number[] {
  const wide = X.length <= X[0]!.length;
  const gram = wide ? matmul(X, transpose(X)) : matmul(transpose(X), X);
  return symEig(gram).map((e) => Math.sqrt(Math.max(0, e)));
}

/** A random n x n orthogonal matrix: Gram-Schmidt on a Gaussian matrix. */
export function randomOrthogonal(n: number, rng: Rng): Mat {
  const Q: number[][] = [];
  while (Q.length < n) {
    const v = Array.from({ length: n }, () => rng.randn());
    for (const q of Q) {
      const d = q.reduce((a, x, i) => a + x * v[i]!, 0);
      for (let i = 0; i < n; i++) v[i]! -= d * q[i]!;
    }
    const nv = Math.hypot(...v);
    if (nv > 1e-6) Q.push(v.map((x) => x / nv));
  }
  return Q;
}

/** An m x n matrix U diag(s) Vᵀ with random orthogonal U and V and the given singular values. */
export function withSpectrum(m: number, n: number, s: number[], rng: Rng): Mat {
  const U = randomOrthogonal(m, rng);
  const V = randomOrthogonal(n, rng);
  const out = zeros(m, n);
  for (let k = 0; k < Math.min(m, n, s.length); k++)
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out[i]![j]! += U[k]![i]! * s[k]! * V[k]![j]!;
  return out;
}

// ---------------------------------------------------------------- floating point

export interface FloatFormat {
  name: string;
  exp: number;
  man: number;
}
export const FP32: FloatFormat = { name: 'float32', exp: 8, man: 23 };
export const FP16: FloatFormat = { name: 'float16', exp: 5, man: 10 };
export const BF16: FloatFormat = { name: 'bfloat16', exp: 8, man: 7 };

export function formatRange(f: FloatFormat): { emin: number; emax: number; max: number; minNormal: number; minSub: number } {
  const bias = 2 ** (f.exp - 1) - 1;
  const emin = 1 - bias;
  const emax = bias;
  return { emin, emax, max: (2 - 2 ** -f.man) * 2 ** emax, minNormal: 2 ** emin, minSub: 2 ** (emin - f.man) };
}

/** Rounds x to the nearest value of format f (ties to even), with subnormals and overflow to infinity. */
export function roundTo(x: number, f: FloatFormat): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const { emin, max } = formatRange(f);
  const ax = Math.abs(x);
  let e = Math.floor(Math.log2(ax));
  if (2 ** e > ax) e--;
  if (2 ** (e + 1) <= ax) e++;
  const q = 2 ** (Math.max(e, emin) - f.man);
  const r = ax / q;
  let n = Math.floor(r);
  const d = r - n;
  if (d > 0.5 || (d === 0.5 && n % 2 === 1)) n++;
  const y = n * q;
  if (y > max) return x > 0 ? Infinity : -Infinity;
  return x > 0 ? y : -y;
}

/** Gap between x and the next representable value of format f. */
export function ulp(x: number, f: FloatFormat): number {
  const { emin } = formatRange(f);
  const e = Math.max(Math.floor(Math.log2(Math.abs(x) || 2 ** emin)), emin);
  return 2 ** (e - f.man);
}

// ---------------------------------------------------------------- AdamW versus L2 inside Adam

/** Gradient sizes of the weights in the weight-decay toy, smallest to largest. */
export const DECAY_SIGMAS = [0.003, 0.03, 0.3, 3, 30];

/**
 * Weights start at 1 and receive pure-noise gradients of size sigma that flip sign every step,
 * so only weight decay has a direction. Returns one trajectory per weight.
 */
export function decayRun(mode: 'l2' | 'adamw', wd: number, lr = 0.01, T = 300, sigmas = DECAY_SIGMAS): number[][] {
  const n = sigmas.length;
  const w = new Array<number>(n).fill(1);
  const m = new Array<number>(n).fill(0);
  const v = new Array<number>(n).fill(0);
  const tr = sigmas.map(() => [1]);
  for (let t = 1; t <= T; t++) {
    const sgn = t % 2 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      let g = sigmas[i]! * sgn;
      if (mode === 'l2') g += wd * w[i]!;
      m[i] = 0.9 * m[i]! + 0.1 * g;
      v[i] = 0.999 * v[i]! + 0.001 * g * g;
      const step = m[i]! / (1 - 0.9 ** t) / (Math.sqrt(v[i]! / (1 - 0.999 ** t)) + 1e-8);
      w[i] = w[i]! - lr * step;
      if (mode === 'adamw') w[i] = w[i]! - lr * wd * w[i]!;
      tr[i]!.push(w[i]!);
    }
  }
  return tr;
}

// ---------------------------------------------------------------- schedules

export type SchedKind = 'constant' | 'cosine' | 'wsd';
export interface SchedOpts {
  T: number;
  warm: number;
  /** WSD only: fraction of training spent decaying. */
  decay: number;
  /** Final learning rate as a fraction of the peak. */
  minRatio: number;
}

/** Learning rate as a fraction of the peak at step t. */
export function lrAt(kind: SchedKind, t: number, o: SchedOpts): number {
  if (t < o.warm) return (t + 1) / o.warm;
  if (kind === 'constant') return 1;
  if (kind === 'cosine') {
    const p = (t - o.warm) / Math.max(1, o.T - o.warm);
    return o.minRatio + (1 - o.minRatio) * 0.5 * (1 + Math.cos(Math.PI * p));
  }
  const ds = Math.round(o.T * (1 - o.decay));
  if (t < ds) return 1;
  const p = (t - ds) / Math.max(1, o.T - ds);
  return o.minRatio + (1 - o.minRatio) * (1 - p);
}

/** Curvatures of the noisy quadratic used to show what a schedule does to the loss. */
const NQ_H = Array.from({ length: 40 }, (_, i) => 10 ** (-3.5 + (3.5 * i) / 39));

/**
 * Expected loss of SGD on a noisy quadratic: each direction i has curvature h_i and gradient noise
 * proportional to h_i, so E[x_i²] follows (1 - lr h_i)² E[x_i²] + lr² noise h_i exactly.
 */
export function noisyQuadLoss(lrs: number[], peak = 0.9, noise = 0.005): number[] {
  const x2 = NQ_H.map(() => 1);
  const out: number[] = [];
  const loss = () => 0.5 * NQ_H.reduce((a, h, i) => a + h * x2[i]!, 0);
  for (const f of lrs) {
    out.push(loss());
    const e = f * peak;
    for (let i = 0; i < NQ_H.length; i++) x2[i] = (1 - e * NQ_H[i]!) ** 2 * x2[i]! + e * e * noise * NQ_H[i]!;
  }
  out.push(loss());
  return out;
}

// ---------------------------------------------------------------- the matrix race

export type RaceOpt = 'sgd' | 'adam' | 'muon';
export const RACE_OPTS: RaceOpt[] = ['sgd', 'adam', 'muon'];
export const RACE_LABEL: Record<RaceOpt, string> = { sgd: 'SGD + momentum', adam: 'Adam', muon: 'Muon' };
export const RACE_COLOR: Record<RaceOpt, 'red' | 'orange' | 'purple'> = { sgd: 'red', adam: 'orange', muon: 'purple' };
export const RACE_T = 150;

/** Target map, in the frame where input direction 0 is common and direction 1 is rare. */
const W_TARGET: Mat = [
  [1.0, 0.8],
  [-0.6, 0.9],
];

export function rot(th: number): Mat {
  const c = Math.cos(th), s = Math.sin(th);
  return [
    [c, -s],
    [s, c],
  ];
}

export interface RaceSetup {
  theta: number;
  kappa: number;
  R: Mat;
  /** W* = W_TARGET Rᵀ, so every rotation is the same problem seen from a turned frame. */
  Wstar: Mat;
  /** Input covariance C = R diag(1, 1/kappa) Rᵀ. */
  C: Mat;
}

export function raceSetup(theta: number, kappa: number): RaceSetup {
  const R = rot(theta);
  const D = [
    [1, 0],
    [0, 1 / kappa],
  ];
  return { theta, kappa, R, Wstar: matmul(W_TARGET, transpose(R)), C: matmul(matmul(R, D), transpose(R)) };
}

export function raceLoss(W: Mat, su: RaceSetup): number {
  const E = W.map((r, i) => r.map((v, j) => v - su.Wstar[i]![j]!));
  const EC = matmul(E, su.C);
  let s = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s += EC[i]![j]! * E[i]![j]!;
  return 0.5 * s;
}

export interface RaceRun {
  lr: number;
  losses: number[];
  Ws: Mat[];
  diverged: boolean;
}

/** One run with mini-batches of 4 inputs and a learning rate decaying linearly to 0. */
export function raceRun(opt: RaceOpt, lr: number, su: RaceSetup, T = RACE_T, seed = 3): RaceRun {
  const rng = new Rng(seed);
  const sd = [1, 1 / Math.sqrt(su.kappa)];
  let W = zeros(2, 2);
  let M = zeros(2, 2);
  let V = zeros(2, 2);
  const losses = [raceLoss(W, su)];
  const Ws = [W];
  const B = 4;
  for (let t = 1; t <= T; t++) {
    const XXt = zeros(2, 2);
    for (let b = 0; b < B; b++) {
      const z0 = rng.randn() * sd[0]!, z1 = rng.randn() * sd[1]!;
      const x0 = su.R[0]![0]! * z0 + su.R[0]![1]! * z1;
      const x1 = su.R[1]![0]! * z0 + su.R[1]![1]! * z1;
      XXt[0]![0]! += (x0 * x0) / B;
      XXt[0]![1]! += (x0 * x1) / B;
      XXt[1]![0]! += (x1 * x0) / B;
      XXt[1]![1]! += (x1 * x1) / B;
    }
    const E = W.map((r, i) => r.map((v, j) => v - su.Wstar[i]![j]!));
    const G = matmul(E, XXt);
    const eta = lr * (1 - (t - 1) / T);
    if (opt === 'sgd') {
      M = M.map((r, i) => r.map((v, j) => 0.9 * v + G[i]![j]!));
      W = W.map((r, i) => r.map((v, j) => v - eta * M[i]![j]!));
    } else if (opt === 'adam') {
      M = M.map((r, i) => r.map((v, j) => 0.9 * v + 0.1 * G[i]![j]!));
      V = V.map((r, i) => r.map((v, j) => 0.999 * v + 0.001 * G[i]![j]! ** 2));
      const c1 = 1 - 0.9 ** t, c2 = 1 - 0.999 ** t;
      W = W.map((r, i) => r.map((v, j) => v - (eta * (M[i]![j]! / c1)) / (Math.sqrt(V[i]![j]! / c2) + 1e-8)));
    } else {
      M = M.map((r, i) => r.map((v, j) => 0.9 * v + G[i]![j]!));
      const O = newtonSchulz(M, 5);
      W = W.map((r, i) => r.map((v, j) => v - eta * O[i]![j]!));
    }
    const L = raceLoss(W, su);
    if (!Number.isFinite(L) || L > 1e6) return { lr, losses, Ws, diverged: true };
    losses.push(L);
    Ws.push(W);
  }
  return { lr, losses, Ws, diverged: false };
}

/** The best run over a log grid of learning rates, judged by the loss over the last five steps. */
export function raceBest(opt: RaceOpt, su: RaceSetup): RaceRun {
  let best: RaceRun | null = null;
  let bestScore = Infinity;
  for (let k = 0; k <= 43; k++) {
    const lr = 10 ** (-3 + (4.3 * k) / 43);
    const r = raceRun(opt, lr, su);
    if (r.diverged) continue;
    const tail = r.losses.slice(-5);
    const score = tail.reduce((a, b) => a + b, 0) / tail.length;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best!;
}

/** Error of W along an input direction d: |(W - W*) d|. */
export function dirError(W: Mat, su: RaceSetup, d: [number, number]): number {
  const e0 = (W[0]![0]! - su.Wstar[0]![0]!) * d[0] + (W[0]![1]! - su.Wstar[0]![1]!) * d[1];
  const e1 = (W[1]![0]! - su.Wstar[1]![0]!) * d[0] + (W[1]![1]! - su.Wstar[1]![1]!) * d[1];
  return Math.hypot(e0, e1);
}

// ---------------------------------------------------------------- gradient streams

/** A heavy-tailed stream of 2-D gradients: mostly modest, larger early on, with occasional spikes. */
export function gradStream(n: number, seed = 7): [number, number][] {
  const rng = new Rng(seed);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let r = Math.exp(rng.randn() * 0.3) * (0.55 + 0.45 * Math.exp(-i / 30));
    if (rng.next() < 0.05) r *= 2.5 + 2 * rng.next();
    const phi = 0.5 + 0.5 * rng.randn();
    out.push([r * Math.cos(phi), r * Math.sin(phi)]);
  }
  return out;
}

/** Synthetic gradient magnitudes as log2 values, for the mixed-precision histogram. */
export function gradLog2Samples(n: number, mu = -27, sd = 4, seed = 5): number[] {
  const rng = new Rng(seed);
  return Array.from({ length: n }, () => mu + sd * rng.randn());
}
