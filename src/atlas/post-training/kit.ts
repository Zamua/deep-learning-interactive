// Generator helpers shared by the post-training concepts.
import type { Answer } from '../../mastery/domain/types';
import { num, round } from '../kit';

/** σ(z) to 2 places, as prompts quote it. */
export const SIG = (z: number): number => round(1 / (1 + Math.exp(-z)), 2);

/** `$\sigma(1) \approx 0.73$, ...` for each distinct argument, largest first. */
export const useSig = (zs: readonly number[]): string =>
  [...new Set(zs)].sort((a, b) => b - a).map((z) => `$\\sigma(${num(z)}) ${z === 0 ? '=' : '\\approx'} ${num(SIG(z), 2)}$`).join(', ');

/** A choice whose right option is listed first (the pad shuffles them), each wrong one with why it is wrong. */
export function choose(right: string, wrong: [string, string][]): Answer {
  return { kind: 'choice', options: [right, ...wrong.map((w) => w[0])], correct: 0, why: [null, ...wrong.map((w) => w[1])] };
}

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
