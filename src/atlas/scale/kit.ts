// Generator helpers for the scale concepts: powers of ten, counts in words, and the symbols they share.
import { clean, num, round } from '../kit';

/** N, D and C as parameters, tokens and FLOPs: the course-wide N, D and C mean examples, features and classes. */
export const N = '\\sym{Nparams}{N}';
export const D = '\\sym{Dtokens}{D}';
export const C = '\\sym{Cflops}{C}';
export const G = '\\sym{G}{G}';
export const ALPHA = '\\sym{alpha}{\\alpha}';

/** `m \times 10^{e}` in TeX, or just `10^{e}` when m is 1. */
export const sci = (m: number, e: number): string => (m === 1 ? `10^{${e}}` : `${num(clean(m))} \\times 10^{${e}}`);

/** x as a mantissa in [1, 10) and a power of ten. */
export function norm(x: number): { m: number; e: number } {
  let e = Math.floor(Math.log10(x));
  let m = round(x / 10 ** e, 9);
  if (m >= 10) {
    m = round(m / 10, 9);
    e += 1;
  }
  return { m: clean(m), e };
}

/** x in scientific notation for TeX. */
export const sciOf = (x: number): string => {
  const { m, e } = norm(x);
  return sci(m, e);
};

/** A count in words: `500 million`, `7 billion`, `1.4 trillion`. */
export function words(x: number): string {
  if (x >= 1e12) return `${num(clean(x / 1e12))} trillion`;
  if (x >= 1e9) return `${num(clean(x / 1e9))} billion`;
  if (x >= 1e6) return `${num(clean(x / 1e6))} million`;
  return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
