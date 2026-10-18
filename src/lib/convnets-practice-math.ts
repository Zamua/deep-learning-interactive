/** Small numeric helpers for chapter 13 (ConvNets in practice). */

/**
 * Eigen-decomposition of a symmetric 3x3 matrix by cyclic Jacobi rotations.
 * Returns eigenvalues in descending order and the matching eigenvectors as columns of `vecs`.
 */
export function eig3(m: number[][]): { vals: number[]; vecs: number[][] } {
  const A = m.map((r) => [...r]);
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 60; sweep++) {
    const off = A[0][1] ** 2 + A[0][2] ** 2 + A[1][2] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < 2; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(A[p][q]) < 1e-30) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  const vals = order.map((i) => A[i][i]);
  const vecs = [0, 1, 2].map((r) => order.map((i) => V[r][i]));
  // make each eigenvector's largest component positive, for a stable picture
  for (let j = 0; j < 3; j++) {
    let big = 0;
    for (let r = 0; r < 3; r++) if (Math.abs(vecs[r][j]) > Math.abs(vecs[big][j])) big = r;
    if (vecs[big][j] < 0) for (let r = 0; r < 3; r++) vecs[r][j] = -vecs[r][j];
  }
  return { vals, vecs };
}

/** Gap between adjacent float16 values near v (normal range): 10 fraction bits. */
export function ulp16(v: number): number {
  return 2 ** (Math.floor(Math.log2(Math.abs(v))) - 10);
}

/** Round to the nearest float16 value. */
export function round16(v: number): number {
  const u = ulp16(v);
  return Math.round(v / u) * u;
}

/** Round to a neighboring float16 value, up with probability equal to the remainder. */
export function roundStoch16(v: number, rand: number): number {
  const u = ulp16(v);
  const lo = Math.floor(v / u) * u;
  return rand < (v - lo) / u ? lo + u : lo;
}
