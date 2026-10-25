// Generator helpers for the linear-algebra concepts: matrices in TeX and written-out arithmetic.
import type { Rng } from '../../core/rand';
import { int, num } from '../kit';

/** Position words for 0-based indices: `ORD[0]` is "first". */
export const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** A number for TeX, in parentheses when negative, so `2 \times (-3)` reads right. */
export const par = (x: number): string => (x < 0 ? `(${num(x)})` : num(x));

/** A sum in TeX with its signs folded: `6 - 4 + 2`. */
export const sumTex = (xs: readonly number[]): string => xs.map((x, i) => (i === 0 ? num(x) : x < 0 ? `- ${num(-x)}` : `+ ${num(x)}`)).join(' ');

/** `a_0 \times b_0 + a_1 \times b_1 + ...` in TeX. */
export const prodTex = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\times ${par(b[i]!)}`).join(' + ');

export const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);

/** A matrix in TeX as a bracketed grid. */
export const mat = (rows: readonly (readonly number[])[]): string => `\\begin{bmatrix} ${rows.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** An `m` by `n` matrix of integers in [lo, hi], with no two rows equal. */
export function matrix(rng: Rng, m: number, n: number, lo: number, hi: number): number[][] {
  for (;;) {
    const rows = Array.from({ length: m }, () => Array.from({ length: n }, () => int(rng, lo, hi)));
    if (new Set(rows.map(String)).size === m) return rows;
  }
}

/** `k` distinct integers in [lo, hi], in random order. */
export function distinct(rng: Rng, k: number, lo: number, hi: number): number[] {
  return rng.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, k);
}

/** A shape in TeX: `(2, 3)`, or `(4,)` for a vector. */
export const shapeTex = (dims: readonly (number | string)[]): string => `(${dims.join(', ')}${dims.length === 1 ? ',' : ''})`;
