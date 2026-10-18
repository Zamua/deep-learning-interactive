/**
 * Small dense linear algebra for the chapter 8 figures: a symmetric eigensolver (Householder
 * tridiagonalization + implicit QL, after JAMA's tred2/tql2) and a linear solve.
 */

/**
 * Eigendecomposition of a symmetric n x n matrix (row-major). Returns eigenvalues in
 * DESCENDING order and V with eigenvector j in column j (row-major), like `np.linalg.svd` of
 * a covariance matrix.
 */
export function eigSym(A: Float64Array, n: number): { d: Float64Array; V: Float64Array } {
  const V = Float64Array.from(A);
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  tred2(n, V, d, e);
  tql2(n, V, d, e);
  // tql2 sorts ascending; flip to descending.
  const dd = new Float64Array(n);
  const VV = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    dd[j] = d[n - 1 - j]!;
    for (let i = 0; i < n; i++) VV[i * n + j] = V[i * n + (n - 1 - j)]!;
  }
  return { d: dd, V: VV };
}

function tred2(n: number, V: Float64Array, d: Float64Array, e: Float64Array): void {
  const at = (i: number, j: number) => i * n + j;
  for (let j = 0; j < n; j++) d[j] = V[at(n - 1, j)]!;
  for (let i = n - 1; i > 0; i--) {
    let scale = 0;
    let h = 0;
    for (let k = 0; k < i; k++) scale += Math.abs(d[k]!);
    if (scale === 0) {
      e[i] = d[i - 1]!;
      for (let j = 0; j < i; j++) {
        d[j] = V[at(i - 1, j)]!;
        V[at(i, j)] = 0;
        V[at(j, i)] = 0;
      }
    } else {
      for (let k = 0; k < i; k++) {
        d[k]! /= scale;
        h += d[k]! * d[k]!;
      }
      let f = d[i - 1]!;
      let g = Math.sqrt(h);
      if (f > 0) g = -g;
      e[i] = scale * g;
      h -= f * g;
      d[i - 1] = f - g;
      for (let j = 0; j < i; j++) e[j] = 0;
      for (let j = 0; j < i; j++) {
        f = d[j]!;
        V[at(j, i)] = f;
        g = e[j]! + V[at(j, j)]! * f;
        for (let k = j + 1; k <= i - 1; k++) {
          g += V[at(k, j)]! * d[k]!;
          e[k]! += V[at(k, j)]! * f;
        }
        e[j] = g;
      }
      f = 0;
      for (let j = 0; j < i; j++) {
        e[j]! /= h;
        f += e[j]! * d[j]!;
      }
      const hh = f / (h + h);
      for (let j = 0; j < i; j++) e[j]! -= hh * d[j]!;
      for (let j = 0; j < i; j++) {
        f = d[j]!;
        g = e[j]!;
        for (let k = j; k <= i - 1; k++) V[at(k, j)]! -= f * e[k]! + g * d[k]!;
        d[j] = V[at(i - 1, j)]!;
        V[at(i, j)] = 0;
      }
    }
    d[i] = h;
  }
  for (let i = 0; i < n - 1; i++) {
    V[at(n - 1, i)] = V[at(i, i)]!;
    V[at(i, i)] = 1;
    const h = d[i + 1]!;
    if (h !== 0) {
      for (let k = 0; k <= i; k++) d[k] = V[at(k, i + 1)]! / h;
      for (let j = 0; j <= i; j++) {
        let g = 0;
        for (let k = 0; k <= i; k++) g += V[at(k, i + 1)]! * V[at(k, j)]!;
        for (let k = 0; k <= i; k++) V[at(k, j)]! -= g * d[k]!;
      }
    }
    for (let k = 0; k <= i; k++) V[at(k, i + 1)] = 0;
  }
  for (let j = 0; j < n; j++) {
    d[j] = V[at(n - 1, j)]!;
    V[at(n - 1, j)] = 0;
  }
  V[at(n - 1, n - 1)] = 1;
  e[0] = 0;
}

function tql2(n: number, V: Float64Array, d: Float64Array, e: Float64Array): void {
  for (let i = 1; i < n; i++) e[i - 1] = e[i]!;
  e[n - 1] = 0;
  let f = 0;
  let tst1 = 0;
  const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    tst1 = Math.max(tst1, Math.abs(d[l]!) + Math.abs(e[l]!));
    let m = l;
    while (m < n) {
      if (Math.abs(e[m]!) <= eps * tst1) break;
      m++;
    }
    if (m > l) {
      let iter = 0;
      do {
        iter++;
        let g = d[l]!;
        let p = (d[l + 1]! - g) / (2 * e[l]!);
        let r = Math.hypot(p, 1);
        if (p < 0) r = -r;
        d[l] = e[l]! / (p + r);
        d[l + 1] = e[l]! * (p + r);
        const dl1 = d[l + 1]!;
        let h = g - d[l]!;
        for (let i = l + 2; i < n; i++) d[i]! -= h;
        f += h;
        p = d[m]!;
        let c = 1;
        let c2 = c;
        let c3 = c;
        const el1 = e[l + 1]!;
        let s = 0;
        let s2 = 0;
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i]!;
          h = c * p;
          r = Math.hypot(p, e[i]!);
          e[i + 1] = s * r;
          s = e[i]! / r;
          c = p / r;
          p = c * d[i]! - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]!);
          for (let k = 0; k < n; k++) {
            const a = k * n;
            h = V[a + i + 1]!;
            V[a + i + 1] = s * V[a + i]! + c * h;
            V[a + i] = c * V[a + i]! - s * h;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]!) / dl1;
        e[l] = s * p;
        d[l] = c * p;
      } while (Math.abs(e[l]!) > eps * tst1 && iter < 60);
    }
    d[l] = d[l]! + f;
    e[l] = 0;
  }
  for (let i = 0; i < n - 1; i++) {
    let k = i;
    let p = d[i]!;
    for (let j = i + 1; j < n; j++) {
      if (d[j]! < p) {
        k = j;
        p = d[j]!;
      }
    }
    if (k !== i) {
      d[k] = d[i]!;
      d[i] = p;
      for (let j = 0; j < n; j++) {
        const a = j * n;
        p = V[a + i]!;
        V[a + i] = V[a + k]!;
        V[a + k] = p;
      }
    }
  }
}

/** Solves A x = b for a small dense n x n system (Gaussian elimination, partial pivoting). */
export function solve(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const M = Float64Array.from(A);
  const x = Float64Array.from(b);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]!) > Math.abs(M[piv * n + c]!)) piv = r;
    if (piv !== c) {
      for (let k = 0; k < n; k++) [M[c * n + k], M[piv * n + k]] = [M[piv * n + k]!, M[c * n + k]!];
      [x[c], x[piv]] = [x[piv]!, x[c]!];
    }
    const d = M[c * n + c]!;
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c]! / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) M[r * n + k]! -= f * M[c * n + k]!;
      x[r]! -= f * x[c]!;
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]!;
    for (let k = r + 1; k < n; k++) s -= M[r * n + k]! * x[k]!;
    x[r] = s / M[r * n + r]!;
  }
  return x;
}

/** Mean and covariance of an N x 2 point set (row-major). */
export function stats2(P: Float64Array): { mx: number; my: number; cxx: number; cxy: number; cyy: number } {
  const n = P.length / 2;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    mx += P[2 * i]!;
    my += P[2 * i + 1]!;
  }
  mx /= n;
  my /= n;
  let cxx = 0, cxy = 0, cyy = 0;
  for (let i = 0; i < n; i++) {
    const a = P[2 * i]! - mx, b = P[2 * i + 1]! - my;
    cxx += a * a;
    cxy += a * b;
    cyy += b * b;
  }
  return { mx, my, cxx: cxx / n, cxy: cxy / n, cyy: cyy / n };
}

/** Eigen-decomposition of a symmetric 2 x 2 matrix [[a, b], [b, c]], largest eigenvalue first. */
export function eig2(a: number, b: number, c: number): { l1: number; l2: number; u1: [number, number]; u2: [number, number] } {
  const tr = a + c;
  const det = a * c - b * b;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  let u1: [number, number];
  if (Math.abs(b) > 1e-12) u1 = [l1 - c, b];
  else u1 = a >= c ? [1, 0] : [0, 1];
  const nn = Math.hypot(u1[0], u1[1]);
  u1 = [u1[0] / nn, u1[1] / nn];
  // keep a stable orientation (first component non-negative)
  if (u1[0] < 0 || (u1[0] === 0 && u1[1] < 0)) u1 = [-u1[0], -u1[1]];
  const u2: [number, number] = [-u1[1], u1[0]];
  return { l1, l2, u1, u2 };
}
