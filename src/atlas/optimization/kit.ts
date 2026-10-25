// Generator helpers shared by the optimization concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/** Drops float noise (0.1 * 3 = 0.30000000000000004) so answers print and compare exactly. */
export const clean = (x: number): number => round(x, 9) + 0;

/** A number as a TeX factor: negatives in parentheses, `(-2)`. */
export const paren = (x: number): string => (x < 0 ? `(${num(clean(x))})` : num(clean(x)));

/** `a - b` in TeX with the sign folded in: `2 - 0.3`, `2 + 0.3` for b = -0.3. */
export const minus = (a: number, b: number): string => `${num(clean(a))} ${b < 0 ? '+' : '-'} ${num(clean(Math.abs(b)))}`;

export const onehot = (n: number, y: number): number[] => Array.from({ length: n }, (_, i) => (i === y ? 1 : 0));

/** A whole number for TeX with thin-space-free thousands commas: `50{,}000`. */
export const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/**
 * `n` probabilities that add up to exactly 1: tenths at low difficulty, hundredths (each at
 * least 0.05) above it.
 */
export function probs(rng: Rng, n: number, d: number): number[] {
  const unit = d < 0.4 ? 10 : 100;
  const min = d < 0.4 ? 1 : 5;
  for (;;) {
    const cuts = Array.from({ length: n - 1 }, () => int(rng, min, unit - min)).sort((a, b) => a - b);
    const parts = [...cuts, unit].map((c, i) => c - (i ? cuts[i - 1]! : 0));
    if (parts.every((p) => p >= min) && new Set(parts).size > 1) return parts.map((p) => clean(p / unit));
  }
}

/** A nonzero integer in [lo, hi]. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** One decimal in [lo, hi], never 0. */
export function tenth(rng: Rng, lo: number, hi: number): number {
  return nonzero(rng, lo * 10, hi * 10) / 10;
}

/** Traps that differ from the answer and from each other. */
export function traps(answer: number, ts: { value: number; why: string }[]): { value: number; why: string }[] {
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && Math.abs(v - answer) > 1e-9 && !out.some((o) => Math.abs(o.value - v) < 1e-9)) out.push({ value: v, why: t.why });
  }
  return out;
}

/** Vector traps that differ from the answer and from each other. */
export function vtraps(answer: number[], ts: { value: number[]; why: string }[]): { value: number[]; why: string }[] {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) < 1e-9);
  const out: { value: number[]; why: string }[] = [];
  for (const t of ts) {
    const v = t.value.map(clean);
    if (!same(v, answer) && !out.some((o) => same(o.value, v))) out.push({ value: v, why: t.why });
  }
  return out;
}
