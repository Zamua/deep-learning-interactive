// Generator helpers shared by the backprop concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/** Drops float noise (0.1 * 3 = 0.30000000000000004) so answers print and compare exactly. */
export const clean = (x: number): number => round(x, 9) + 0;

/** A number for TeX, in parentheses when negative: `(-2)`. */
export const par = (x: number): string => (x < 0 ? `(${num(clean(x))})` : num(clean(x)));

/** A number for TeX after float cleanup. */
export const n = (x: number, places?: number): string => num(places === undefined ? clean(x) : x, places);

/** `\frac{\partial top}{\partial bot}` */
export const dd = (top: string, bot: string): string => `\\frac{\\partial ${top}}{\\partial ${bot}}`;

/** A nonzero integer in [lo, hi]. */
export function nonzero(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo, hi);
    if (v !== 0) return v;
  }
}

/** One decimal in [lo, hi], never 0 and never a whole number. */
export function tenth(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo * 10, hi * 10);
    if (v % 10 !== 0) return v / 10;
  }
}

/** Number traps that the grader can tell from the answer and from each other at `places`. */
export function traps(answer: number, ts: { value: number; why: string }[], places?: number): { value: number; why: string }[] {
  const tol = places === undefined ? 1e-9 : 10 ** -places;
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const v = clean(t.value);
    if (Number.isFinite(v) && Math.abs(v - answer) > tol && !out.some((o) => Math.abs(o.value - v) <= tol)) out.push({ value: v, why: t.why });
  }
  return out;
}

/** Vector traps that differ from the answer and from each other. */
export function vtraps(answer: number[], ts: { value: number[]; why: string }[], places?: number): { value: number[]; why: string }[] {
  const tol = places === undefined ? 1e-9 : 10 ** -places;
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) <= tol);
  const out: { value: number[]; why: string }[] = [];
  for (const t of ts) {
    const v = t.value.map(clean);
    if (v.every(Number.isFinite) && !same(v, answer) && !out.some((o) => same(o.value, v))) out.push({ value: v, why: t.why });
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
