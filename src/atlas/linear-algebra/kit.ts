// Generator helpers for the linear-algebra concepts: matrices in TeX and written-out arithmetic.
import type { Rng } from '../../core/rand';
import { int, num, par } from '../kit';

/** `a_0 \times b_0 + a_1 \times b_1 + ...` in TeX. */
export const prodTex = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\times ${par(b[i]!)}`).join(' + ');

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
