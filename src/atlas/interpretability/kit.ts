// Generator helpers for the interpretability concepts.
import type { Rng } from '../../core/rand';
import { num } from '../kit';

/** TeX for the symbols these concepts add, through the generic `\sym{key}{tex}` macro. */
export const D = '\\sym{d}{d}';
export const F = '\\sym{f}{f}';

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
