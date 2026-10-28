// Generator helpers shared by the networks concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/**
 * TeX for the layer symbols. KaTeX macro names cannot hold digits, so `\symW1` would read as
 * `\symW` then `1`; the generic `\sym{key}{tex}` keeps their colors.
 */
export const W1 = '\\sym{W1}{W_1}';
export const W2 = '\\sym{W2}{W_2}';
export const B1 = '\\sym{b1}{b_1}';
export const B2 = '\\sym{b2}{b_2}';

/** Drops float noise (0.1 * 3 = 0.30000000000000004) so answers print and compare exactly. */
export const clean = (x: number): number => round(x, 9) + 0;

/** A number as a TeX factor: negatives in parentheses, `(-2)`. */
export const par = (x: number): string => (x < 0 ? `(${num(clean(x))})` : num(clean(x)));

export const dot = (a: readonly number[], b: readonly number[]): number => clean(a.reduce((s, x, i) => s + x * b[i]!, 0));
export const matvec = (W: readonly (readonly number[])[], x: readonly number[]): number[] => W.map((r) => dot(r, x));
export const transpose = (W: readonly (readonly number[])[]): number[][] => W[0]!.map((_, j) => W.map((r) => r[j]!));
export const add = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => clean(x + b[i]!));
export const relu = (z: number): number => (z > 0 ? z : 0);
export const sum = (xs: readonly number[]): number => clean(xs.reduce((a, b) => a + b, 0));

/** A matrix in TeX brackets. */
export const mat = (rows: readonly (readonly number[])[]): string => `\\begin{bmatrix} ${rows.map((r) => r.map((v) => num(clean(v))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** Terms added up with their signs folded: `4 - 1 + 0`. */
export const terms = (xs: readonly (number | string)[]): string =>
  xs
    .map((v, i) => {
      const s = typeof v === 'number' ? num(clean(v)) : v;
      if (i === 0) return s;
      return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
    })
    .join(' ');

/** The products of a dot product, written out: `1 \cdot 2 + (-1) \cdot 3`. */
export const prods = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\cdot ${par(b[i]!)}`).join(' + ');

/** A nonzero integer in [lo, hi]. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** `n` integers in [lo, hi], none of them 0. */
export const nonzeros = (rng: Rng, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => nonzero(rng, lo, hi));

/** Two-decimal grading only when the answer needs rounding, so exact answers show as `7`, not `7.00`. */
export const placesFor = (...vals: number[]): 2 | undefined => (vals.every((v) => Math.abs(round(v, 2) - v) < 1e-9) ? undefined : 2);

/** Half the grading tolerance at `places` decimals: closer than this, a trap would be graded right. */
const near = (places?: number) => (places === undefined ? 1e-9 : 0.51 * 10 ** -places);

/** Traps that differ from the answer (as graded to `places`) and from each other. */
export function traps(answer: number, ts: { value: number; why: string }[], places?: number): { value: number; why: string }[] {
  const tol = near(places);
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && Math.abs(v - answer) > tol && !out.some((o) => Math.abs(o.value - v) < 1e-9)) out.push({ value: v, why: t.why });
  }
  return out;
}

/** Vector traps that differ from the answer (as graded to `places`) and from each other. */
export function vtraps(answer: number[], ts: { value: number[]; why: string }[], places?: number): { value: number[]; why: string }[] {
  const tol = near(places);
  const same = (a: number[], b: number[], e: number) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) <= e);
  const out: { value: number[]; why: string }[] = [];
  for (const t of ts) {
    const v = t.value.map(clean);
    if (v.every(Number.isFinite) && !same(v, answer, tol) && !out.some((o) => same(o.value, v, 1e-9))) out.push({ value: v, why: t.why });
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

/** Position words for 0-based indices: `ORD[0]` is "first". */
export const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** A choice with options in random order; `why` follows the options, null for the right one. */
export function shuffled(rng: Rng, opts: { text: string; why: string | null }[]): { kind: 'choice'; options: string[]; correct: number; why: (string | null)[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const o = order.map((i) => opts[i]!);
  return { kind: 'choice', options: o.map((x) => x.text), correct: o.findIndex((x) => x.why === null), why: o.map((x) => x.why) };
}
