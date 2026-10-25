// Generator helpers shared by the convnets concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/** Drops float noise so answers print and compare exactly. */
export const clean = (x: number): number => round(x, 9) + 0;

/** A factor in TeX: negatives in parentheses. */
export const par = (x: number): string => (x < 0 ? `(${num(clean(x))})` : num(clean(x)));

/** A whole number for TeX with thousands commas: `50{,}000`. */
export const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/** The same for prose and options outside TeX: `50,000`. */
export const bigText = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A shape in TeX: `(3, 32, 32)`. */
export const shp = (dims: readonly number[]): string => `(${dims.join(', ')})`;

/** A matrix in TeX brackets. */
export const mat = (rows: readonly (readonly number[])[]): string =>
  `\\begin{bmatrix} ${rows.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** Terms added with their signs folded: `4 - 1 + 0`. */
export const terms = (xs: readonly number[]): string =>
  xs.map((v, i) => (i === 0 ? num(clean(v)) : v < 0 ? `- ${num(clean(-v))}` : `+ ${num(clean(v))}`)).join(' ');

/** The products of a dot product written out: `2 \cdot 1 + (-1) \cdot 3`. */
export const prods = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\cdot ${par(b[i]!)}`).join(' + ');

export const dot = (a: readonly number[], b: readonly number[]): number => clean(a.reduce((s, x, i) => s + x * b[i]!, 0));

/** (W - F + 2P) / S + 1, possibly fractional. */
export const outSize = (W: number, F: number, S: number, P: number): number => (W - F + 2 * P) / S + 1;

/** A nonzero integer in [lo, hi]. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** Number traps that differ from the answer and from each other. */
export function traps(answer: number, ts: { value: number; why: string }[]): { value: number; why: string }[] {
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && Math.abs(v - answer) > 1e-9 && !out.some((o) => Math.abs(o.value - v) < 1e-9)) out.push({ value: v, why: t.why });
  }
  return out;
}

/** Shape or vector traps that differ from the answer and from each other. */
export function atraps(answer: number[], ts: { value: number[]; why: string }[]): { value: number[]; why: string }[] {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) < 1e-9);
  const out: { value: number[]; why: string }[] = [];
  for (const t of ts) {
    const v = t.value.map(clean);
    if (v.every(Number.isFinite) && !same(v, answer) && !out.some((o) => same(o.value, v))) out.push({ value: v, why: t.why });
  }
  return out;
}

/** A choice with options in random order; `why` follows the options, null for the right one. */
export function shuffled(rng: Rng, opts: { text: string; why: string | null }[]): { kind: 'choice'; options: string[]; correct: number; why: (string | null)[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const o = order.map((i) => opts[i]!);
  return { kind: 'choice', options: o.map((x) => x.text), correct: o.findIndex((x) => x.why === null), why: o.map((x) => x.why) };
}
