import { type Dataset2D, blobs } from '../../core/data';
import { Rng } from '../../core/rand';
import { K, Slice, svm, toyProblem } from '../../lib/optimization-svm';

/** Where every walk on the slice starts, as in the chapter's race. */
export const START: [number, number] = [-3.2, 2.8];

const prob = toyProblem();
export const DATA: Dataset2D = prob.data;
export const REG = prob.reg;
/** The chapter's 2-D slice through the trained weights (seed 4). */
export const SL = new Slice(prob.data, prob.W0, 4, prob.reg);

/** Runs `fn` once, on first use. */
export function lazy<T>(fn: () => T): () => T {
  let v: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      v = fn();
      done = true;
    }
    return v as T;
  };
}

// ---------------------------------------------------------------- one example with creases

/**
 * The example whose 1-D slice (b = 0, a in [-4, 4]) bends the most while keeping a flat floor:
 * the clearest picture of floors, ramps and creases.
 */
export const ONE = (() => {
  let best = 0;
  let bs = -1;
  const n = 160;
  for (let i = 0; i < DATA.n; i++) {
    const ys: number[] = [];
    for (let k = 0; k <= n; k++) ys.push(SL.loss(-4 + (8 * k) / n, 0, [i], 0));
    const sl = ys.slice(1).map((v, k) => (v - ys[k]!) / (8 / n));
    let turn = 0;
    for (let k = 0; k < n - 1; k++) turn += Math.abs(sl[k + 1]! - sl[k]!);
    const flat = (sl.filter((v) => Math.abs(v) < 1e-9).length * 8) / n;
    if (flat > 0.8 && flat < 5 && turn > bs) {
      bs = turn;
      best = i;
    }
  }
  return best;
})();

export const lossOne = (a: number, b: number): number => SL.loss(a, b, [ONE], 0);
export const lossAll = (a: number, b: number): number => SL.loss(a, b, null, 0);
export const lossReg = (a: number, b: number): number => SL.loss(a, b, null, REG);

// ---------------------------------------------------------------- the race (chapter Fig 5.2)

export interface Race {
  /** Per round r (1-based), the try made in that round, and where each walker stands after it. */
  rsTry: [number, number][];
  rsAt: [number, number][];
  rsLoss: number[];
  lsTry: [number, number][];
  lsAt: [number, number][];
  lsLoss: number[];
  gdAt: [number, number][];
  gdLoss: number[];
}

export const RACE: Race = (() => {
  const rng = new Rng(9);
  const lr = 1.5;
  const delta = 0.5;
  const l0 = SL.loss(...START);
  const r: Race = { rsTry: [START], rsAt: [START], rsLoss: [l0], lsTry: [START], lsAt: [START], lsLoss: [l0], gdAt: [START], gdLoss: [l0] };
  let rs = START;
  let rsL = l0;
  let ls = START;
  let lsL = l0;
  let gd = START;
  for (let it = 0; it < 60; it++) {
    const t: [number, number] = [rng.uniform(-4, 4), rng.uniform(-4, 4)];
    const lt = SL.loss(...t);
    if (lt < rsL) {
      rs = t;
      rsL = lt;
    }
    const u: [number, number] = [ls[0] + delta * rng.randn(), ls[1] + delta * rng.randn()];
    const lu = SL.loss(...u);
    if (lu < lsL) {
      ls = u;
      lsL = lu;
    }
    const g = SL.grad(gd[0], gd[1]);
    gd = [gd[0] - lr * g.ga, gd[1] - lr * g.gb];
    r.rsTry.push(t);
    r.rsAt.push(rs);
    r.rsLoss.push(rsL);
    r.lsTry.push(u);
    r.lsAt.push(ls);
    r.lsLoss.push(lsL);
    r.gdAt.push(gd);
    r.gdLoss.push(SL.loss(...gd));
  }
  return r;
})();

// ---------------------------------------------------------------- full batch versus mini-batch (Fig 5.5)

export const BATCH = 4;
export const MINI = (() => {
  const rng = new Rng(3);
  const lr = 0.3;
  const pool = Array.from({ length: DATA.n }, (_, i) => i);
  const full: [number, number][] = [START];
  const mini: [number, number][] = [START];
  const l0 = SL.loss(...START);
  const lf = [l0];
  const lm = [l0];
  for (let it = 0; it < 100; it++) {
    const f = full[full.length - 1]!;
    const g = SL.grad(f[0], f[1]);
    full.push([f[0] - lr * g.ga, f[1] - lr * g.gb]);
    for (let k = 0; k < BATCH; k++) {
      const j = k + rng.int(pool.length - k);
      [pool[k], pool[j]] = [pool[j]!, pool[k]!];
    }
    const m = mini[mini.length - 1]!;
    const gm = SL.grad(m[0], m[1], pool.slice(0, BATCH));
    mini.push([m[0] - lr * gm.ga, m[1] - lr * gm.gb]);
    lf.push(SL.loss(...full[full.length - 1]!));
    lm.push(SL.loss(...mini[mini.length - 1]!));
  }
  return { full, mini, lf, lm };
})();

/** The exact slice gradient at START, and mini-batch estimates of it (B = 16). */
export const POLL = (() => {
  const rng = new Rng(21);
  const g = SL.grad(...START);
  const est: [number, number][] = [];
  const pool = Array.from({ length: DATA.n }, (_, i) => i);
  for (let t = 0; t < 14; t++) {
    for (let k = 0; k < 16; k++) {
      const j = k + rng.int(pool.length - k);
      [pool[k], pool[j]] = [pool[j]!, pool[k]!];
    }
    const e = SL.grad(START[0], START[1], pool.slice(0, 16));
    est.push([e.ga, e.gb]);
  }
  return { full: [g.ga, g.gb] as [number, number], est };
})();

// ---------------------------------------------------------------- gradients at START

/** The six weights at START, their analytic gradient, and the numerical check of it. */
export const GRAD = (() => {
  const W = Float64Array.from(SL.at(...START));
  const ana = new Float64Array(2 * K);
  const loss = svm(W, DATA, null, REG, ana);
  const h = 1e-5;
  const up: number[] = [];
  const dn: number[] = [];
  const num: number[] = [];
  const rel: number[] = [];
  for (let k = 0; k < 2 * K; k++) {
    const old = W[k]!;
    W[k] = old + h;
    const fp = svm(W, DATA, null, REG);
    W[k] = old - h;
    const fm = svm(W, DATA, null, REG);
    W[k] = old;
    up.push(fp);
    dn.push(fm);
    const n = (fp - fm) / (2 * h);
    num.push(n);
    rel.push(Math.abs(n - ana[k]!) / Math.max(Math.abs(n), Math.abs(ana[k]!)));
  }
  const sl = SL.grad(...START);
  return { W: Array.from(W), loss, ana: Array.from(ana), up, dn, num, rel, maxRel: Math.max(...rel), slice: [sl.ga, sl.gb] as [number, number] };
})();

// ---------------------------------------------------------------- how small should h be (Fig 5.3)

const SX = [1.2, -0.7];
const SY: number = 1;
const SW = [
  [0.7, 0.4],
  [0.3, -0.8],
  [-0.5, 0.2],
];
export const W00 = 0.7;

/** Softmax loss of one example as a function of W[0, 0], in float64 or (rounded at every op) float32. */
export function softLoss(w: number, single = false): number {
  const F = Math.fround;
  const r = single ? F : (v: number) => v;
  const s = SW.map((row, c) => {
    const a = c === 0 ? r(w) : r(row[0]!);
    return r(r(a * r(SX[0]!)) + r(r(row[1]!) * r(SX[1]!)));
  });
  const m = Math.max(...s);
  let Z = 0;
  for (const v of s) Z = r(Z + r(Math.exp(r(v - m))));
  return r(r(-r(s[SY]! - m)) + r(Math.log(Z)));
}

export const SOFT_ANA = (() => {
  const s = SW.map((row, c) => (c === 0 ? W00 : row[0]!) * SX[0]! + row[1]! * SX[1]!);
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const Z = e.reduce((a, b) => a + b, 0);
  return (e[0]! / Z - (SY === 0 ? 1 : 0)) * SX[0]!;
})();

export function estimates(h: number, f32: boolean): { num: number; fwd: number } {
  const F = Math.fround;
  const w0 = W00;
  if (!f32) return { num: (softLoss(w0 + h) - softLoss(w0 - h)) / (2 * h), fwd: (softLoss(w0 + h) - softLoss(w0)) / h };
  const wp = F(F(w0) + F(h));
  const wm = F(F(w0) - F(h));
  return {
    num: F(F(softLoss(wp, true) - softLoss(wm, true)) / F(2 * h)),
    fwd: F(F(softLoss(wp, true) - softLoss(F(w0), true)) / F(h)),
  };
}

const relErr = (v: number) => Math.abs(v - SOFT_ANA) / Math.max(Math.abs(v), Math.abs(SOFT_ANA));

/** log10 of the relative error of each recipe, for log10 h from -12 to 0. */
export const HCURVE = (() => {
  const out = { lh: [] as number[], c64: [] as number[], f64: [] as number[], c32: [] as number[], f32: [] as number[] };
  const lg = (v: number) => Math.log10(Math.max(1e-16, relErr(v)));
  for (let k = 0; k <= 120; k++) {
    const lh = -12 + k * 0.1;
    const e64 = estimates(10 ** lh, false);
    const e32 = estimates(10 ** lh, true);
    out.lh.push(lh);
    out.c64.push(lg(e64.num));
    out.f64.push(lg(e64.fwd));
    out.c32.push(lg(e32.num));
    out.f32.push(lg(e32.fwd));
  }
  return out;
})();
export const hRel = (h: number, f32 = false): number => relErr(estimates(h, f32).num);

// ---------------------------------------------------------------- one example's analytic gradient (Fig 5.4)

export const TOY = blobs(15, 3, 0.3, 5);
export const TOY_W0 = (() => {
  const W = new Float64Array(2 * K);
  for (let c = 0; c < K; c++) {
    const a = (c / 3) * Math.PI * 2 + 0.6 + 1.25;
    W[2 * c] = 1.25 * Math.cos(a);
    W[2 * c + 1] = 1.25 * Math.sin(a);
  }
  return W;
})();
export const TOY_SEL = (() => {
  let best = 0;
  let bv = -1;
  for (let i = 0; i < TOY.n; i++) {
    const v = svm(TOY_W0, TOY, [i], 0);
    if (v > bv) {
      bv = v;
      best = i;
    }
  }
  return best;
})();
export const TOY_LR = 0.3;
/** W before and after each of three single-example gradient steps. */
export const TOY_STEPS: Float64Array[] = (() => {
  const out = [Float64Array.from(TOY_W0)];
  const g = new Float64Array(2 * K);
  for (let k = 0; k < 3; k++) {
    const W = Float64Array.from(out[out.length - 1]!);
    svm(W, TOY, [TOY_SEL], 0, g);
    for (let j = 0; j < 2 * K; j++) W[j] -= TOY_LR * g[j]!;
    out.push(W);
  }
  return out;
})();

export function toyParts(W: ArrayLike<number>): { x0: number; x1: number; yi: number; s: number[]; m: number[]; viol: number[] } {
  const x0 = TOY.X[2 * TOY_SEL]!;
  const x1 = TOY.X[2 * TOY_SEL + 1]!;
  const yi = TOY.y[TOY_SEL]!;
  const s = [0, 1, 2].map((c) => W[2 * c]! * x0 + W[2 * c + 1]! * x1);
  const m = s.map((v) => v - s[yi]! + 1);
  const viol = [0, 1, 2].filter((c) => c !== yi && m[c]! > 0);
  return { x0, x1, yi, s, m, viol };
}

/** Where each of ONE's hinges switches on, as polylines in slice coordinates (a, b) within [-4.2, 4.2]. */
export const CREASES: [number, number][][] = (() => {
  const x0 = DATA.X[2 * ONE]!;
  const x1 = DATA.X[2 * ONE + 1]!;
  const yi = DATA.y[ONE]!;
  const dotRow = (W: ArrayLike<number>, c: number) => W[2 * c]! * x0 + W[2 * c + 1]! * x1;
  const out: [number, number][][] = [];
  for (let j = 0; j < K; j++) {
    if (j === yi) continue;
    const m0 = dotRow(SL.W0, j) - dotRow(SL.W0, yi) + 1;
    const mA = dotRow(SL.W1, j) - dotRow(SL.W1, yi);
    const mB = dotRow(SL.W2, j) - dotRow(SL.W2, yi);
    const line: [number, number][] = [];
    for (let k = 0; k <= 84; k++) {
      const t = -4.2 + k * 0.1;
      const p: [number, number] = Math.abs(mB) > Math.abs(mA) ? [t, -(m0 + mA * t) / mB] : [-(m0 + mB * t) / mA, t];
      if (Math.abs(p[0]) <= 4.2 && Math.abs(p[1]) <= 4.2) line.push(p);
    }
    if (line.length > 1) out.push(line);
  }
  return out;
})();
