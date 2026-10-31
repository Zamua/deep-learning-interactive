// Generator helpers shared by the transformer concepts.
import type { Rng } from '../../core/rand';
import { num, round } from '../kit';

/**
 * TeX for the attention symbols. Keys that clash with a course-wide symbol (K, T, v) are written
 * with the generic `\sym{key}{tex}` so their per-concept notes apply.
 */
export const Q = '\\sym{Q}{Q}';
export const K = '\\sym{K}{K}';
export const V = '\\sym{V}{V}';
export const q = '\\sym{q}{q}';
export const k = '\\sym{k}{k}';
export const v = '\\sym{v}{v}';
export const WQ = '\\sym{Wq}{W_Q}';
export const WK = '\\sym{Wk}{W_K}';
export const WV = '\\sym{Wv}{W_V}';
export const WO = '\\sym{Wo}{W_O}';
export const D = '\\sym{d}{d}';
export const DK = '\\sym{dk}{d_k}';
export const DV = '\\sym{dv}{d_v}';
export const T = '\\sym{T}{T}';
export const H = '\\sym{heads}{h}';
export const DH = '\\sym{dhead}{d_{\\text{head}}}';
export const A = '\\sym{A}{A}';
export const X = '\\symx';

/** Weights from scores by softmax, with every exponential rounded as the prompt quotes it. */
export function softmax2(e: readonly number[], mask?: readonly boolean[]): number[] {
  const x = e.map((s, i) => (mask && !mask[i] ? 0 : round(Math.exp(s), 2)));
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((y) => y / t);
}

/** Integers in [lo, hi] for a short vector, never all zero. */
export function someInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => lo + rng.int(hi - lo + 1));
    if (xs.some((x) => x !== 0)) return xs;
  }
}

/** A vector for TeX with entries printed exactly: `[1,\ -0.5]`. */
export const vecT = (xs: readonly number[], places?: number): string => `[${xs.map((x) => num(x, places)).join(',\\ ')}]`;

/** A sentence's words as inline code, `the`, `cat`. */
export const words = (ws: readonly string[]): string => ws.map((w) => `\`${w}\``).join(' ');

export const SENTENCES = [
  ['the', 'cat', 'sat', 'down'],
  ['we', 'like', 'green', 'tea'],
  ['rain', 'fell', 'all', 'night'],
  ['she', 'reads', 'old', 'maps'],
  ['dogs', 'chase', 'red', 'balls'],
  ['time', 'flies', 'too', 'fast'],
  ['birds', 'sing', 'at', 'dawn'],
  ['he', 'baked', 'fresh', 'bread'],
];
