// Generator helpers for the scale concepts: powers of ten, counts in words, and the symbols they share.
import { num, round } from '../kit';
import { clean } from '../optimization/kit';

export { big, clean, paren, traps, vtraps } from '../optimization/kit';
export { whys } from '../training/kit';

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

/** Traps that differ from the answer once both are rounded to `places`, and from each other. */
export function ptraps(answer: number, places: number, ts: { value: number; why: string }[]): { value: number; why: string }[] {
  const tol = 0.5 * 10 ** -places * 1.2 + 1e-12;
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && Math.abs(v - answer) > tol && !out.some((o) => Math.abs(o.value - v) <= tol)) out.push({ value: v, why: t.why });
  }
  return out;
}

/** Shape traps that differ from the answer and from each other. */
export function straps(answer: number[], ts: { value: number[]; why: string }[]): { value: number[]; why: string }[] {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const out: { value: number[]; why: string }[] = [];
  for (const t of ts) if (!same(t.value, answer) && !out.some((o) => same(o.value, t.value))) out.push(t);
  return out;
}

/** A whole number for prose, with thousands commas: `50,000`. */
export const commas = (n: number): string => n.toLocaleString('en-US');

/** `(1024, 4096)` for prose and TeX. */
export const shape = (xs: readonly number[]): string => `(${xs.join(', ')})`;
