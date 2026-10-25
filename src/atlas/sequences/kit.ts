// Generator helpers shared by the sequence-model concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

export { clean, nonzero, onehot, paren, probs, tenth, traps, vtraps } from '../optimization/kit';
export { dot, mat, ORD, prodTex, shapeTex, sumTex } from '../linear-algebra/kit';

/** Values rounded to two places, as prompts quote them: `tanh(1) ≈ 0.76`. */
export const T2 = (x: number): number => round(Math.tanh(x), 2) + 0;
export const E2 = (x: number): number => round(Math.exp(x), 2);
export const LN2 = (x: number): number => round(Math.log(x), 2) + 0;

/** "Use $\tanh(1) \approx 0.76$, ..." for each distinct value, sorted. */
export const useTanh = (xs: readonly number[]): string =>
  [...new Set(xs)].sort((a, b) => a - b).map((x) => `$\\tanh(${num(x)}) \\approx ${num(T2(x), 2)}$`).join(', ');
export const useExp = (xs: readonly number[]): string =>
  [...new Set(xs)].sort((a, b) => b - a).map((x) => `$e^{${num(x)}} \\approx ${num(E2(x), 2)}$`).join(', ');
export const useLn = (xs: readonly number[]): string =>
  [...new Set(xs)].sort((a, b) => b - a).map((x) => `$\\ln ${num(x)} \\approx ${num(LN2(x), 2)}$`).join(', ');

/** Index of the largest entry, or -1 when it is shared. */
export function argmax(xs: readonly number[]): number {
  const m = Math.max(...xs);
  return xs.filter((x) => x === m).length === 1 ? xs.indexOf(m) : -1;
}

/** `n` integers in [lo, hi] whose largest entry is unique. */
export function uniqueTop(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    if (argmax(xs) >= 0 && new Set(xs).size > 1) return xs;
  }
}

/** A matrix-vector product. */
export const mv = (M: readonly (readonly number[])[], x: readonly number[]): number[] => M.map((r) => r.reduce((a, v, j) => a + v * x[j]!, 0));

/** Tokens as inline code: `h`, `e`, `l`. */
export const toks = (xs: readonly string[]): string => xs.map((t) => `\`${t}\``).join(', ');

/** A token as a quoted string literal, `'h'`: a bare `h` would link to the symbol h. */
export const lit = (t: string): string => `\`'${t}'\``;
export const lits = (xs: readonly string[]): string => xs.map(lit).join(', ');
