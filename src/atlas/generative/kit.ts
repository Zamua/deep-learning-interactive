// Generator helpers shared by the generative concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/** Drops float noise (0.1 * 3 = 0.30000000000000004) so answers print and compare exactly. */
export const clean = (x: number): number => round(x, 9) + 0;

/** A number as a TeX factor: negatives in parentheses, `(-2)`. */
export const par = (x: number, places?: number): string => (x < 0 ? `(${num(clean(x), places)})` : num(clean(x), places));

/** A whole number for TeX with thousands commas: `50{,}000`. */
export const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/** The same for prose and options outside TeX: `50,000`. */
export const bigText = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A shape in TeX: `(3, 32, 32)`. */
export const shp = (dims: readonly number[]): string => `(${dims.map(big).join(', ')})`;

export const dot = (a: readonly number[], b: readonly number[]): number => clean(a.reduce((s, x, i) => s + x * b[i]!, 0));

export const sum = (xs: readonly number[]): number => clean(xs.reduce((a, b) => a + b, 0));

/** Terms added up with their signs folded: `4 - 1 + 0`. */
export const terms = (xs: readonly number[], places?: number): string =>
  xs.map((v, i) => (i === 0 ? num(clean(v), places) : v < 0 ? `- ${num(clean(-v), places)}` : `+ ${num(clean(v), places)}`)).join(' ');

/** e^x and ln x as the prompts give them. */
export const E2 = (x: number): number => round(Math.exp(x), 2);
export const LN2 = (x: number): number => round(Math.log(x), 2);

/** A nonzero integer in [lo, hi]. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** One decimal in [lo, hi], never 0. */
export const tenth = (rng: Rng, lo: number, hi: number): number => nonzero(rng, Math.round(lo * 10), Math.round(hi * 10)) / 10;

/** Half the grading tolerance at `places` decimals: closer than this, a trap would be graded right. */
const near = (places?: number) => (places === undefined ? 1e-9 : 0.51 * 10 ** -places);

/** Number traps that differ from the answer (as graded to `places`) and from each other. */
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
  for (const t of ts) if (t.value.every((x) => Number.isInteger(x) && x > 0) && !same(t.value, answer) && !out.some((o) => same(o.value, t.value))) out.push(t);
  return out;
}

/** A choice with options in random order; `why` follows the options, null for the right one. */
export function shuffled(rng: Rng, opts: { text: string; why: string | null }[]): { kind: 'choice'; options: string[]; correct: number; why: (string | null)[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const o = order.map((i) => opts[i]!);
  return { kind: 'choice', options: o.map((x) => x.text), correct: o.findIndex((x) => x.why === null), why: o.map((x) => x.why) };
}

/** Position words for 0-based indices: `ORD[0]` is "first". */
export const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/**
 * TeX for the diffusion symbols, which have no course-wide entry: the generic `\sym{key}{tex}`
 * still colors and links them.
 */
export const X0 = '\\sym{x0}{x_0}';
export const XT = '\\sym{xt}{x_t}';
export const EPS = '\\sym{eps}{\\epsilon}';
export const EHAT = '\\sym{epshat}{\\hat\\epsilon}';
export const AB = '\\sym{ab}{\\bar\\alpha}';
export const BLEND = `${XT} = \\sqrt{${AB}}\\,${X0} + \\sqrt{1 - ${AB}}\\,${EPS}`;

/** Signal levels whose square roots the prompts give: [alpha-bar, sqrt(alpha-bar), sqrt(1 - alpha-bar)]. */
export const LEVELS: [number, number, number][] = [
  [0.64, 0.8, 0.6],
  [0.36, 0.6, 0.8],
  [0.81, 0.9, 0.44],
  [0.25, 0.5, 0.87],
  [0.49, 0.7, 0.71],
  [0.09, 0.3, 0.95],
  [0.75, 0.87, 0.5],
  [0.91, 0.95, 0.3],
  [0.19, 0.44, 0.9],
  [0.96, 0.98, 0.2],
  [0.04, 0.2, 0.98],
];

/** "Use √0.64 = 0.8 and √0.36 = 0.6", with ≈ where the root is rounded. */
export function roots([ab, a, b]: [number, number, number]): string {
  const r = (v: number, root: number) => `$\\sqrt{${num(v)}} ${Math.abs(Math.sqrt(v) - root) < 1e-9 ? '=' : '\\approx'} ${num(root)}$`;
  return `${r(ab, a)} and ${r(clean(1 - ab), b)}`;
}
