// Generator helpers for the matrix-state concepts (linear attention, the delta rule, Gated DeltaNet):
// keys and values of two numbers, a 2 by 2 state, and its reads and writes in TeX.
import type { Rng } from '../../../core/rand';
import { clean, int, mat, par, vec } from '../kit';

export type Vec = number[];
export type Mat = number[][];

/** S k. */
export const read = (S: Mat, k: readonly number[]): Vec => S.map((row) => clean(row.reduce((a, x, j) => a + x * k[j]!, 0)));

/** v kᵀ: row i, column j holds v[i] times k[j]. */
export const outer = (v: readonly number[], k: readonly number[]): Mat => v.map((a) => k.map((b) => clean(a * b)));

export const add = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((x, j) => clean(x + B[i]![j]!)));

export const scaled = (c: number, A: Mat): Mat => A.map((r) => r.map((x) => clean(c * x)));

export const minus = (a: readonly number[], b: readonly number[]): Vec => a.map((x, i) => clean(x - b[i]!));

export const mix = (c: number, a: readonly number[], e: number, b: readonly number[]): Vec => a.map((x, i) => clean(c * x + e * b[i]!));

/** One step of the gated delta rule, S ← αS + β(v − αSk)kᵀ; α = 1 is the plain delta rule. */
export function step(S: Mat, k: Vec, v: Vec, beta: number, alpha = 1): Mat {
  const F = scaled(alpha, S);
  return add(F, scaled(beta, outer(minus(v, read(F, k)), k)));
}

/** Keys of length one: the two axes, and four at an angle to both. */
export const AXES: Vec[] = [[1, 0], [0, 1]];
export const SLANTS: Vec[] = [[0.6, 0.8], [0.8, 0.6], [0.6, -0.8], [-0.8, 0.6]];

/** A 2 by 2 state of whole numbers in [lo, hi], not all zero. */
export function state(rng: Rng, lo: number, hi: number): Mat {
  for (;;) {
    const S = [[int(rng, lo, hi), int(rng, lo, hi)], [int(rng, lo, hi), int(rng, lo, hi)]];
    if (S.flat().some((x) => x !== 0)) return S;
  }
}

/** A vector of two whole numbers in [lo, hi], not both zero. */
export function pair(rng: Rng, lo: number, hi: number): Vec {
  for (;;) {
    const v = [int(rng, lo, hi), int(rng, lo, hi)];
    if (v.some((x) => x !== 0)) return v;
  }
}

export const same = (a: readonly number[], b: readonly number[]): boolean => a.every((x, i) => Math.abs(x - b[i]!) < 1e-9);

/** The four entries of a 2 by 2 matrix, by where they sit, as prompts name them. */
export const CORNER = [['top left', 'top right'], ['bottom left', 'bottom right']] as const;

/** `S k` worked out in TeX, row by row: `[2 \cdot 1 + 1 \cdot 0,\ 3 \cdot 1 + 4 \cdot 0] = [2,\ 3]`. */
export const readTex = (S: Mat, k: readonly number[]): string =>
  `[${S.map((row) => row.map((x, j) => `${par(x)} \\cdot ${par(k[j]!)}`).join(' + ')).join(',\\ ')}] = ${vec(read(S, k))}`;

/** `[4,\ 1] - [2,\ 3] = [2,\ -2]`. */
export const diffTex = (a: readonly number[], b: readonly number[]): string => `${vec(a)} - ${vec(b)} = ${vec(minus(a, b))}`;

/** S as a prompt shows it. */
export const stateTex = (S: Mat): string => `$\\sym{S}{S} = ${mat(S)}$`;
