// Everything the scenes plot, computed once and deterministically.
import { Rng } from '../../core/rand';
import { eig2, solve } from '../../lib/nn-data-loss-linalg';
import { stats } from './draw';

// ---------------------------------------------------------------- the 2-D cloud (chapter figure 1)

export const CLOUD_N = 220;
export const CLOUD = (() => {
  const rng = new Rng(21);
  const ang = (28 * Math.PI) / 180;
  const X = new Float64Array(CLOUD_N * 2);
  for (let i = 0; i < CLOUD_N; i++) {
    const a = rng.randn() * 1.35;
    const b = rng.randn() * 0.3;
    X[2 * i] = 2.2 + a * Math.cos(ang) - b * Math.sin(ang);
    X[2 * i + 1] = 1.4 + a * Math.sin(ang) + b * Math.cos(ang);
  }
  const st = stats(X);
  const X0 = X.map((v, i) => v - (i % 2 ? st.my : st.mx));
  const sx = Math.sqrt(st.cxx);
  const sy = Math.sqrt(st.cyy);
  const Xn = X0.map((v, i) => v / (i % 2 ? sy : sx));
  const E = eig2(st.cxx, st.cxy, st.cyy);
  const theta = Math.atan2(E.u1[1], E.u1[0]);
  return { X, X0, Xn, st, sx, sy, E, theta };
})();

/** The centered cloud rotated by -theta * t: t = 1 lines it up with its eigenvectors. */
export function rotated(t: number): Float64Array {
  const th = -CLOUD.theta * t;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const P = CLOUD.X0;
  const out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 2) {
    out[i] = c * P[i]! - sn * P[i + 1]!;
    out[i + 1] = sn * P[i]! + c * P[i + 1]!;
  }
  return out;
}

/** The rotated cloud with each axis scaled toward 1 / sqrt(S + eps) by `t`. */
export function whitened(t: number, eps: number): Float64Array {
  const R = rotated(1);
  const f1 = 1 + (1 / Math.sqrt(CLOUD.E.l1 + eps) - 1) * t;
  const f2 = 1 + (1 / Math.sqrt(CLOUD.E.l2 + eps) - 1) * t;
  return R.map((v, i) => v * (i % 2 ? f2 : f1));
}

// ---------------------------------------------------------------- one neuron's variance

export const VAR_N = 100;
export const VAR = (() => {
  const rng = new Rng(13);
  const rows = 3000;
  const z = Float64Array.from({ length: VAR_N }, () => rng.randn());
  const x = new Float64Array(rows);
  const sFix = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    let acc = 0;
    for (let j = 0; j < VAR_N; j++) {
      const v = rng.randn();
      if (j === 0) x[r] = v;
      acc += (v * z[j]!) / Math.sqrt(VAR_N);
    }
    sFix[r] = acc;
  }
  const v = (a: Float64Array) => {
    const m = a.reduce((p, q) => p + q, 0) / a.length;
    return a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length;
  };
  // 0.01 * z equals (z / sqrt(n)) / 10, so the small-weight sums are the fixed ones over 10.
  const sSmall = sFix.map((q) => q / 10);
  return { x, sFix, sSmall, varFix: v(sFix), varSmall: v(sSmall), varX: v(x) };
})();

// ---------------------------------------------------------------- activations through 10 layers

export type DeepKey = 'small' | 'big' | 'xavier' | 'relu-xavier' | 'relu-he';
export const DEEP_B = 200;
export const DEEP_U = 100;
export const DEEP_L = 10;
const deepCache = new Map<DeepKey, { H: Float64Array[]; sd: number[] }>();
const deepBase = (() => {
  const r = new Rng(3);
  const D = Float64Array.from({ length: DEEP_B * DEEP_U }, () => r.randn());
  const Z = Array.from({ length: DEEP_L }, () => Float64Array.from({ length: DEEP_U * DEEP_U }, () => r.randn()));
  return { D, Z };
})();

export function deep(key: DeepKey): { H: Float64Array[]; sd: number[] } {
  const hit = deepCache.get(key);
  if (hit) return hit;
  const relu = key.startsWith('relu');
  const scale = key === 'small' ? 0.01 : key === 'big' ? 1 : key === 'relu-he' ? Math.sqrt(2 / DEEP_U) : 1 / Math.sqrt(DEEP_U);
  const H: Float64Array[] = [];
  const sd: number[] = [];
  let X = deepBase.D;
  for (let l = 0; l < DEEP_L; l++) {
    const W = deepBase.Z[l]!;
    const out = new Float64Array(DEEP_B * DEEP_U);
    for (let i = 0; i < DEEP_B; i++) {
      const xo = i * DEEP_U;
      for (let k = 0; k < DEEP_U; k++) {
        const xk = X[xo + k]! * scale;
        if (xk === 0) continue;
        const wo = k * DEEP_U;
        for (let j = 0; j < DEEP_U; j++) out[xo + j]! += xk * W[wo + j]!;
      }
    }
    let m = 0;
    for (let i = 0; i < out.length; i++) {
      const v = relu ? Math.max(0, out[i]!) : Math.tanh(out[i]!);
      out[i] = v;
      m += v;
    }
    m /= out.length;
    let s2 = 0;
    for (let i = 0; i < out.length; i++) s2 += (out[i]! - m) ** 2;
    sd.push(Math.sqrt(s2 / out.length));
    H.push(out);
    X = out;
  }
  const res = { H, sd };
  deepCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------- batch normalization

export const BN_N = 64;
export const BN_POP = { m: [2.6, -0.9], s: [1.6, 0.6], rho: 0.55 };
export const BN = (() => {
  const rng = new Rng(8);
  const sample = () => {
    const P = new Float64Array(BN_N * 2);
    for (let i = 0; i < BN_N; i++) {
      const a = rng.randn();
      const b = rng.randn();
      P[2 * i] = BN_POP.m[0]! + BN_POP.s[0]! * a;
      P[2 * i + 1] = BN_POP.m[1]! + BN_POP.s[1]! * (BN_POP.rho * a + Math.sqrt(1 - BN_POP.rho ** 2) * b);
    }
    return P;
  };
  const batches = Array.from({ length: 31 }, sample);
  const st = batches.map((b) => stats(b));
  // running[k] = the averages after k batches, starting from mean 0, variance 1
  const running: { m: [number, number]; v: [number, number] }[] = [{ m: [0, 0], v: [1, 1] }];
  for (let k = 1; k < batches.length; k++) {
    const p = running[k - 1]!;
    const b = st[k]!;
    running.push({
      m: [0.9 * p.m[0] + 0.1 * b.mx, 0.9 * p.m[1] + 0.1 * b.my],
      v: [0.9 * p.v[0] + 0.1 * b.cxx, 0.9 * p.v[1] + 0.1 * b.cyy],
    });
  }
  return { batches, st, running };
})();

// ---------------------------------------------------------------- overfitting a curve

export const POLY_D = 12;
const phi = (x: number): Float64Array => Float64Array.from({ length: POLY_D }, (_, k) => x ** k);
export const truth = (x: number): number => 0.75 * Math.sin(2.2 * x) + 0.15 * x;
/** log10 of the ridge strength at a fraction t of the sweep. */
export const polyLam = (t: number): number => -8 + 7 * t;
export const POLY = (() => {
  const rng = new Rng(29);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < POLY_D; i++) {
    const x = -0.95 + (1.9 * i) / (POLY_D - 1) + rng.uniform(-0.06, 0.06);
    xs.push(x);
    ys.push(truth(x) + rng.randn() * 0.2);
  }
  const test: [number, number][] = [-0.86, -0.56, -0.16, 0.3, 0.52, 0.84].map((x) => [x, truth(x) + rng.randn() * 0.08]);
  const G = new Float64Array(POLY_D * POLY_D);
  const b = new Float64Array(POLY_D);
  xs.forEach((x, i) => {
    const T = phi(x);
    for (let a = 0; a < POLY_D; a++) {
      b[a]! += T[a]! * ys[i]!;
      for (let c = 0; c < POLY_D; c++) G[a * POLY_D + c]! += T[a]! * T[c]!;
    }
  });
  const coefs: Float64Array[] = [];
  for (let i = 0; i <= 56; i++) {
    const M = Float64Array.from(G);
    for (let a = 0; a < POLY_D; a++) M[a * POLY_D + a]! += 10 ** polyLam(i / 56);
    coefs.push(solve(M, b, POLY_D));
  }
  return { xs, ys, test, coefs };
})();

/** The degree-11 weights at a fraction t of the ridge sweep (log-spaced strengths). */
export function polyCoef(t: number): Float64Array {
  const n = POLY.coefs.length - 1;
  const f = Math.max(0, Math.min(n, t * n));
  const i = Math.min(n - 1, Math.floor(f));
  const w = f - i;
  return POLY.coefs[i]!.map((v, k) => v + (POLY.coefs[i + 1]![k]! - v) * w);
}

export function polyAt(t: number): (x: number) => number {
  const c = polyCoef(t);
  return (x: number) => {
    let y = 0;
    let p = 1;
    for (let k = 0; k < POLY_D; k++) {
      y += c[k]! * p;
      p *= x;
    }
    return y;
  };
}

// ---------------------------------------------------------------- penalties in two dimensions

export type Pen = 'l2' | 'l1' | 'mn';
export const PEN_A = [1.0, 0.35, 0.35, 0.7];
export const PEN_WS = [1.45, 0.62];
const grad2 = (w: number[]) => [
  PEN_A[0]! * (w[0]! - PEN_WS[0]!) + PEN_A[1]! * (w[1]! - PEN_WS[1]!),
  PEN_A[2]! * (w[0]! - PEN_WS[0]!) + PEN_A[3]! * (w[1]! - PEN_WS[1]!),
];
const soft = (v: number, t: number) => Math.sign(v) * Math.max(0, Math.abs(v) - t);
function solve2(k: Pen, l: number, c: number, start: number[]): number[] {
  if (k === 'l2') {
    const M = new Float64Array([PEN_A[0]! + l, PEN_A[1]!, PEN_A[2]!, PEN_A[3]! + l]);
    const rhs = new Float64Array([PEN_A[0]! * PEN_WS[0]! + PEN_A[1]! * PEN_WS[1]!, PEN_A[2]! * PEN_WS[0]! + PEN_A[3]! * PEN_WS[1]!]);
    return Array.from(solve(M, rhs, 2));
  }
  let w = [...start];
  const t = 0.8;
  for (let it = 0; it < 3000; it++) {
    const g = grad2(w);
    w = [w[0]! - t * g[0]!, w[1]! - t * g[1]!];
    if (k === 'mn') {
      const nr = Math.hypot(w[0]!, w[1]!);
      if (nr > c) w = [(w[0]! * c) / nr, (w[1]! * c) / nr];
    } else w = [soft(w[0]!, t * l), soft(w[1]!, t * l)];
  }
  return w;
}
/** Solutions as the strength grows: lambda from 10^-3 to 10^0.5, or max length c from 1.7 down to 0.1. */
export const PEN_PATH: Record<Pen, number[][]> = (() => {
  const out = {} as Record<Pen, number[][]>;
  for (const k of ['l2', 'l1', 'mn'] as Pen[]) {
    const pts: number[][] = [];
    let prev = PEN_WS;
    for (let i = 0; i <= 60; i++) {
      prev = k === 'mn' ? solve2(k, 0, 1.7 - 1.6 * (i / 60), prev) : solve2(k, 10 ** (-3 + 3.5 * (i / 60)), 0, prev);
      pts.push(prev);
    }
    out[k] = pts;
  }
  return out;
})();
export const penAt = (k: Pen, t: number): number[] => {
  const p = PEN_PATH[k];
  const f = Math.max(0, Math.min(p.length - 1, t * (p.length - 1)));
  const i = Math.min(p.length - 2, Math.floor(f));
  const w = f - i;
  return [p[i]![0]! + (p[i + 1]![0]! - p[i]![0]!) * w, p[i]![1]! + (p[i + 1]![1]! - p[i]![1]!) * w];
};

/** A 16-weight linear model where only inputs 0, 3 and 9 matter, fit with L1 and with L2. */
export const BARS_N = 16;
export const BARS = (() => {
  const NS = 60;
  const r = new Rng(31);
  const Xb = Float64Array.from({ length: NS * BARS_N }, () => r.randn());
  const wtrue = new Float64Array(BARS_N);
  wtrue[0] = 1.6;
  wtrue[3] = -1.1;
  wtrue[9] = 0.7;
  const yb = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    let s = 0;
    for (let j = 0; j < BARS_N; j++) s += Xb[i * BARS_N + j]! * wtrue[j]!;
    yb[i] = s + 0.6 * r.randn();
  }
  const XtX = new Float64Array(BARS_N * BARS_N);
  const Xty = new Float64Array(BARS_N);
  for (let i = 0; i < NS; i++)
    for (let a = 0; a < BARS_N; a++) {
      Xty[a]! += (Xb[i * BARS_N + a]! * yb[i]!) / NS;
      for (let b = 0; b < BARS_N; b++) XtX[a * BARS_N + b]! += (Xb[i * BARS_N + a]! * Xb[i * BARS_N + b]!) / NS;
    }
  const fit = (k: 'l1' | 'l2', l: number): Float64Array => {
    if (k === 'l2') {
      const M = Float64Array.from(XtX);
      for (let a = 0; a < BARS_N; a++) M[a * BARS_N + a]! += l;
      return solve(M, Xty, BARS_N);
    }
    const w = new Float64Array(BARS_N);
    for (let sweep = 0; sweep < 200; sweep++)
      for (let j = 0; j < BARS_N; j++) {
        let rho = Xty[j]!;
        for (let b = 0; b < BARS_N; b++) if (b !== j) rho -= XtX[j * BARS_N + b]! * w[b]!;
        w[j] = soft(rho, l) / XtX[j * BARS_N + j]!;
      }
    return w;
  };
  return { wtrue, l1: fit('l1', 0.25), l2: fit('l2', 0.25), none: fit('l2', 1e-6) };
})();

// ---------------------------------------------------------------- dropout

export const DROP_SIZES = [4, 6, 6, 2];
export const DROP = (() => {
  const r = new Rng(17);
  const Ws = [0, 1, 2].map((l) => Array.from({ length: DROP_SIZES[l + 1]! }, () => Array.from({ length: DROP_SIZES[l]! }, () => r.randn() * 0.75)));
  const bs = [0, 1, 2].map((l) => Array.from({ length: DROP_SIZES[l + 1]! }, () => 0.15 + 0.1 * r.randn()));
  const x = [1.0, 0.6, -0.4, 0.9];
  const relu = (v: number) => (v > 0 ? v : 0);
  const h1 = Ws[0]!.map((row, j) => relu(row.reduce((a, w, i) => a + w * x[i]!, bs[0]![j]!)));
  const zAt = (h: number[], u: number) => Ws[1]![u]!.reduce((a, w, i) => a + w * h[i]!, bs[1]![u]!);
  let track = 0;
  for (let u = 1; u < 6; u++) if (zAt(h1, u) > zAt(h1, track)) track = u;
  const zTest = zAt(h1, track);
  const mr = new Rng(5);
  const PASSES = 240;
  const m1: number[][] = [];
  const m2: number[][] = [];
  const zInv: number[] = [];
  for (let k = 0; k < PASSES; k++) {
    const a = Array.from({ length: 6 }, () => (mr.next() < 0.5 ? 1 : 0));
    const b = Array.from({ length: 6 }, () => (mr.next() < 0.5 ? 1 : 0));
    m1.push(a);
    m2.push(b);
    zInv.push(zAt(h1.map((v, i) => v * a[i]! * 2), track));
  }
  // passes worth showing: two to four units kept in each hidden layer
  const shown: number[] = [];
  for (let k = 0; k < PASSES; k++) {
    const c1 = m1[k]!.reduce((x, y) => x + y, 0);
    const c2 = m2[k]!.reduce((x, y) => x + y, 0);
    if (c1 >= 2 && c1 <= 4 && c2 >= 2 && c2 <= 4) shown.push(k);
  }
  return { Ws, h1, track, zTest, m1, m2, zInv, PASSES, shown };
})();

// ---------------------------------------------------------------- regression with an outlier

export const REG = (() => {
  const n = 13;
  const r = new Rng(41);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = -1 + (2 * i) / (n - 1) + r.uniform(-0.04, 0.04);
    xs.push(x);
    ys.push(0.55 * x + 0.1 + r.randn() * 0.08);
  }
  return { xs, ys };
})();

export function fitL2(X: number[], Y: number[]): [number, number] {
  const m = X.length;
  const mx = X.reduce((a, b) => a + b, 0) / m;
  const my = Y.reduce((a, b) => a + b, 0) / m;
  let sxy = 0;
  let sxx = 0;
  X.forEach((x, i) => {
    sxy += (x - mx) * (Y[i]! - my);
    sxx += (x - mx) ** 2;
  });
  const w = sxy / sxx;
  return [w, my - w * mx];
}

/** The L1 line passes through two of the points; try every pair. */
export function fitL1(X: number[], Y: number[]): [number, number] {
  let best: [number, number] = [0, 0];
  let bl = Infinity;
  for (let i = 0; i < X.length; i++)
    for (let j = i + 1; j < X.length; j++) {
      if (Math.abs(X[i]! - X[j]!) < 1e-9) continue;
      const w = (Y[j]! - Y[i]!) / (X[j]! - X[i]!);
      const b = Y[i]! - w * X[i]!;
      const l = X.reduce((a, x, k) => a + Math.abs(w * x + b - Y[k]!), 0);
      if (l < bl) {
        bl = l;
        best = [w, b];
      }
    }
  return best;
}
