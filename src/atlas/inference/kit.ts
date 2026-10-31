// Generator helpers shared by the inference concepts.
import { num, round } from '../kit';

/** `b` to the `n`, rounded to `places`, and whether that rounding was exact. */
export function power(b: number, n: number, places = 4): { v: number; exact: boolean } {
  const v = round(b ** n, places) + 0;
  return { v, exact: Math.abs(b ** n - v) < 1e-12 };
}

/** `0.7^{4} \approx 0.2401` in TeX: `=` when the rounding is exact. */
export function powTex(b: number, n: number, places = 4): string {
  const { v, exact } = power(b, n, places);
  return `${num(b)}^{${n}} ${exact ? '=' : '\\approx'} ${num(v)}`;
}

/** "$0.7^{2} = 0.49$, $0.7^{4} \approx 0.2401$" for the given powers of `b`. */
export const usePowers = (b: number, ns: readonly number[], places = 4): string =>
  ns.map((n) => `$${powTex(b, n, places)}$`).join(', ');

/** A choice answer from options paired with what picking each means: null marks the right one. */
export function choice(opts: { text: string; why: string | null }[]): { kind: 'choice'; options: string[]; correct: number; why: (string | null)[] } {
  return { kind: 'choice', options: opts.map((o) => o.text), correct: opts.findIndex((o) => o.why === null), why: opts.map((o) => o.why) };
}

/** Each item repeated its count of times, in order. */
export const repeat = <T>(counts: readonly [T, number][]): T[] => counts.flatMap(([v, n]) => Array.from({ length: n }, () => v));
