// Helpers for problem generators in every domain: random numbers, rounding, traps, and TeX for numbers, sums,
// vectors, matrices and shapes. A domain's own kit.ts keeps only what that domain needs alone.
import type { Rng } from '../core/rand';
import { closeTo } from '../mastery/domain/grade';

/** An integer in [lo, hi]. */
export const int = (rng: Rng, lo: number, hi: number): number => lo + rng.int(hi - lo + 1);

/** One of the items. */
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(xs.length)]!;

/** `n` integers in [lo, hi], never all equal. */
export function ints(rng: Rng, n: number, lo: number, hi: number, distinct = false): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    if (distinct ? new Set(xs).size === n : new Set(xs).size > 1) return xs;
  }
}

/** An integer in [lo, hi] other than 0. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** A nonzero multiple of 0.1 in [lo, hi]. */
export const tenth = (rng: Rng, lo: number, hi: number): number => nonzero(rng, Math.round(lo * 10), Math.round(hi * 10)) / 10;

/** Grows from `easy` to `hard` with difficulty, in whole steps. */
export const scale = (d: number, easy: number, hard: number): number => Math.round(easy + (hard - easy) * Math.min(1, Math.max(0, d)));

export const round = (x: number, places: number): number => Math.round(x * 10 ** places) / 10 ** places;

/** Floating-point noise rounded away, and never -0. */
export const clean = (x: number): number => round(x, 9) + 0;

export const sum = (xs: readonly number[]): number => clean(xs.reduce((a, b) => a + b, 0));

export const dot = (a: readonly number[], b: readonly number[]): number => clean(a.reduce((s, x, i) => s + x * b[i]!, 0));

/** The index of the largest entry, or -1 when it is tied. */
export function argmax(xs: readonly number[]): number {
  const m = Math.max(...xs);
  return xs.filter((x) => x === m).length === 1 ? xs.indexOf(m) : -1;
}

/** e^x and ln x to 2 places, as a problem tells the learner to use them. */
export const E2 = (x: number): number => round(Math.exp(x), 2);
export const LN2 = (x: number): number => round(Math.log(x), 2) + 0;

/** The logarithms a problem lets the learner look up, largest first. */
export const useLn = (xs: readonly number[]): string =>
  [...new Set(xs)].sort((a, b) => b - a).map((x) => `$\\ln ${num(x)} \\approx ${num(LN2(x), 2)}$`).join(', ');

type Trap<V> = { value: V; why: string };

/** The traps that can catch an answer: finite, graded wrong, and none graded the same as an earlier one. */
export function traps(answer: number, ts: Trap<number>[], places?: number): Trap<number>[] {
  const out: Trap<number>[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && !closeTo(v, answer, places) && !out.some((o) => closeTo(v, o.value, places))) out.push({ value: v, why: t.why });
  }
  return out;
}

/** `traps` for vector answers, compared entry by entry as grading does. */
export function vtraps(answer: number[], ts: Trap<number[]>[], places?: number): Trap<number[]>[] {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => closeTo(x, b[i]!, places));
  const out: Trap<number[]>[] = [];
  for (const t of ts) {
    const v = t.value.map(clean);
    if (v.every(Number.isFinite) && !same(v, answer) && !out.some((o) => same(o.value, v))) out.push({ value: v, why: t.why });
  }
  return out;
}

/** `traps` for shape answers: positive whole dimensions, other than the answer and each other. */
export function straps(answer: number[], ts: Trap<number[]>[]): Trap<number[]>[] {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const out: Trap<number[]>[] = [];
  for (const t of ts) if (t.value.every((x) => Number.isInteger(x) && x > 0) && !same(t.value, answer) && !out.some((o) => same(o.value, t.value))) out.push(t);
  return out;
}

/** A multiple-choice answer from options in a random order; the right one has `why: null`. */
export function shuffled(rng: Rng, opts: { text: string; why: string | null }[]): { kind: 'choice'; options: string[]; correct: number; why: (string | null)[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const o = order.map((i) => opts[i]!);
  return { kind: 'choice', options: o.map((x) => x.text), correct: o.findIndex((x) => x.why === null), why: o.map((x) => x.why) };
}

export const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** A number for TeX: minus signs as `-`, fixed places when given. */
export const num = (x: number, places?: number): string => (places === undefined ? String(x) : x.toFixed(places)).replace(/^-0(\.0+)?$/, '0$1');

/** Groups a number's whole part in threes with `sep`. */
const grouped = (n: number, sep: string): string => {
  const [whole, frac] = num(n).split('.');
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (frac === undefined ? '' : `.${frac}`);
};

/** `3,072` in text. */
export const commas = (n: number): string => grouped(n, ',');

/** `3{,}072` in TeX, where a bare comma would add a space. */
export const big = (n: number): string => grouped(n, '{,}');

/** A number in TeX, in parentheses when negative, so it can follow an operator. */
export const par = (x: number, places?: number): string => (x < 0 ? `(${num(clean(x), places)})` : num(clean(x), places));

/** `a - b` in TeX, written `a + |b|` when b is negative. */
export const minus = (a: number, b: number, places?: number): string => `${num(clean(a), places)} ${b < 0 ? '+' : '-'} ${num(clean(Math.abs(b)), places)}`;

/** A sum in TeX, `3 - 2 + 0.5`: each term after the first signed by its own sign. Strings are terms already in TeX. */
export const terms = (xs: readonly (number | string)[], places?: number): string =>
  xs
    .map((v, i) => {
      const s = typeof v === 'number' ? num(clean(v), places) : v;
      if (i === 0) return s;
      return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
    })
    .join(' ');

/** `a·b` written out in TeX: `2 \cdot 3 + (-1) \cdot 4`. */
export const prods = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\cdot ${par(b[i]!)}`).join(' + ');

/** `[2,\ 1,\ -1]` in TeX. */
export const vec = (xs: readonly number[], places?: number): string => `[${xs.map((x) => num(x, places)).join(',\\ ')}]`;

export const mat = (rows: readonly (readonly number[])[]): string => `\\begin{bmatrix} ${rows.map((r) => r.map((v) => num(clean(v))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** A shape as Python writes it: `(3, 32, 32)`, and `(5,)` for one dimension. */
export const shp = (dims: readonly (number | string)[]): string => `(${dims.join(', ')}${dims.length === 1 ? ',' : ''})`;
