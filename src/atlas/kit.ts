// Helpers for problem generators: random integers, rounding, and TeX for numbers and vectors.
import type { Rng } from '../core/rand';

/** An integer in [lo, hi]. */
export const int = (rng: Rng, lo: number, hi: number): number => lo + rng.int(hi - lo + 1);

/** One of the items. */
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(xs.length)]!;

/** `n` integers in [lo, hi], never all equal. */
export function ints(rng: Rng, n: number, lo: number, hi: number, distinct = false): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    if (distinct ? new Set(xs).size === n : new Set(xs).size > 1) return xs;
  }
}

export const round = (x: number, places: number): number => Math.round(x * 10 ** places) / 10 ** places;

/** A number for TeX: minus signs as `-`, fixed places when given. */
export const num = (x: number, places?: number): string => (places === undefined ? String(x) : x.toFixed(places)).replace(/^-0(\.0+)?$/, '0$1');

/** `[2,\ 1,\ -1]` in TeX. */
export const vec = (xs: readonly number[], places?: number): string => `[${xs.map((x) => num(x, places)).join(',\\ ')}]`;

/** Grows from `easy` to `hard` with difficulty, in whole steps. */
export const scale = (d: number, easy: number, hard: number): number => Math.round(easy + (hard - easy) * Math.min(1, Math.max(0, d)));
