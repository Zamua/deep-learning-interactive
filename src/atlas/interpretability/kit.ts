// Generator helpers for the interpretability concepts.
import type { Rng } from '../../core/rand';
import { num } from '../kit';

export { add, dot, prods, straps, traps, vtraps } from '../networks/kit';
export { clean, nonzero } from '../optimization/kit';
export { whys } from '../training/kit';

/** TeX for the symbols these concepts add, through the generic `\sym{key}{tex}` macro. */
export const D = '\\sym{d}{d}';
export const F = '\\sym{f}{f}';

/** A whole number for TeX with `{,}` thousands separators: `8{,}192`. */
export const big = (n: number): string => num(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/** Tokens in code font for prose: `K D R A`. */
export const seqText = (xs: readonly string[]): string => `\`${xs.join(' ')}\``;

/** Letters that read clearly in a sequence, without I and O. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

/**
 * A letter sequence whose last token repeats exactly one earlier token at position `i`, with at
 * least two tokens between that copy's successor and the end, every other letter distinct.
 */
export function repeatSeq(rng: Rng, n: number): { seq: string[]; i: number } {
  const letters = rng.shuffle([...LETTERS]).slice(0, n - 1);
  const i = 1 + rng.int(n - 4);
  return { seq: [...letters, letters[i]!], i };
}
