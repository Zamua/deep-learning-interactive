// Generator helpers shared by the networks concepts.
import type { Rng } from '../../core/rand';
import { clean, dot, int, nonzero, num, round } from '../kit';

/**
 * TeX for the layer symbols. KaTeX macro names cannot hold digits, so `\symW1` would read as
 * `\symW` then `1`; the generic `\sym{key}{tex}` keeps their colors.
 */
export const W1 = '\\sym{W1}{W_1}';
export const W2 = '\\sym{W2}{W_2}';
export const B1 = '\\sym{b1}{b_1}';
export const B2 = '\\sym{b2}{b_2}';
export const matvec = (W: readonly (readonly number[])[], x: readonly number[]): number[] => W.map((r) => dot(r, x));
export const transpose = (W: readonly (readonly number[])[]): number[][] => W[0]!.map((_, j) => W.map((r) => r[j]!));
export const add = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => clean(x + b[i]!));
export const relu = (z: number): number => (z > 0 ? z : 0);

/** `n` integers in [lo, hi], none of them 0. */
export const nonzeros = (rng: Rng, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => nonzero(rng, lo, hi));

/** Two-decimal grading only when the answer needs rounding, so exact answers show as `7`, not `7.00`. */
export const placesFor = (...vals: number[]): 2 | undefined => (vals.every((v) => Math.abs(round(v, 2) - v) < 1e-9) ? undefined : 2);

