// Generator helpers shared by the post-training concepts.
import type { Answer } from '../../mastery/domain/types';
import { num, round } from '../kit';

export { clean, nonzero, paren, tenth } from '../optimization/kit';
export { straps, traps, vtraps } from '../backprop/kit';

/** Values rounded to two places, as prompts quote them. */
export const LN = (x: number): number => round(Math.log(x), 2) + 0;
export const E2 = (x: number): number => round(Math.exp(x), 2);
export const SIG = (z: number): number => round(1 / (1 + Math.exp(-z)), 2);

/** `$\ln 0.5 \approx -0.69$, ...` for each distinct value, largest first. */
export const useLn = (xs: readonly number[]): string =>
  [...new Set(xs)].sort((a, b) => b - a).map((x) => `$\\ln ${num(x)} \\approx ${num(LN(x), 2)}$`).join(', ');

/** `$\sigma(1) \approx 0.73$, ...` for each distinct argument, largest first. */
export const useSig = (zs: readonly number[]): string =>
  [...new Set(zs)].sort((a, b) => b - a).map((z) => `$\\sigma(${num(z)}) ${z === 0 ? '=' : '\\approx'} ${num(SIG(z), 2)}$`).join(', ');

/** A choice whose right option is listed first (the pad shuffles them), each wrong one with why it is wrong. */
export function choose(right: string, wrong: [string, string][]): Answer {
  return { kind: 'choice', options: [right, ...wrong.map((w) => w[0])], correct: 0, why: [null, ...wrong.map((w) => w[1])] };
}

/** A whole number with thousands commas, for TeX (`8{,}192`) and for prose (`8,192`). */
export const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
export const bigText = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A sum in TeX with its signs folded: `0.4 - 0.2 + 0.1`. */
export const sumTex = (xs: readonly number[], places?: number): string =>
  xs.map((x, i) => (i === 0 ? num(x, places) : x < 0 ? `- ${num(-x, places)}` : `+ ${num(x, places)}`)).join(' ');

/** `a - b` in TeX with the sign folded in: `-0.4 + 1.2` for b = -1.2. */
export const minus = (a: number, b: number, places?: number): string => `${num(a, places)} ${b < 0 ? '+' : '-'} ${num(Math.abs(b), places)}`;

// The domain's symbols, as TeX. Keys that clash with a course-wide symbol (b, A, B, beta) need a
// per-concept entry in SCOPED.
export const PI = '\\sym{pi}{\\pi}';
export const REF = '\\sym{piref}{\\pi_{\\text{ref}}}';
export const OLD = '\\sym{piold}{\\pi_{\\text{old}}}';
export const R = '\\sym{R}{R}';
export const BASE = '\\sym{b}{b}';
export const ADV = '\\sym{A}{A}';
export const BETA = '\\sym{beta}{\\beta}';
export const EPS = '\\sym{eps}{\\epsilon}';
export const RHO = '\\sym{rho}{\\rho}';
export const TH = '\\sym{theta}{\\theta}';
export const G = '\\sym{G}{G}';
