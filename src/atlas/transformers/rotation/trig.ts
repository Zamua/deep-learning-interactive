// Turning pairs by whole-degree angles with the cosines and sines the prompts quote.
import type { Rng } from '../../../core/rand';
import { clean, int, num, par } from '../../kit';

/** Angles in degrees with their cosine and sine, rounded as the prompts quote them. */
export const TRIG: Record<number, [number, number]> = {
  0: [1, 0],
  30: [0.87, 0.5],
  45: [0.71, 0.71],
  60: [0.5, 0.87],
  90: [0, 1],
  120: [-0.5, 0.87],
  135: [-0.71, 0.71],
  150: [-0.87, 0.5],
  180: [-1, 0],
  270: [0, -1],
};

export const deg = (a: number) => `${num(a)}^\\circ`;
const eq = (v: number) => ([0, 1, -1, 0.5, -0.5].includes(v) ? '=' : '\\approx');
/** "$\cos 60° = 0.5$ and $\sin 60° ≈ 0.87$" */
export const cs = (a: number) => {
  const [c, s] = TRIG[a]!;
  return `$\\cos ${deg(a)} ${eq(c)} ${num(c)}$ and $\\sin ${deg(a)} ${eq(s)} ${num(s)}$`;
};

/** The pair turned by `a` degrees, with the rounded cosine and sine. */
export function rot(p: readonly number[], a: number): number[] {
  const [c, s] = TRIG[((a % 360) + 360) % 360]!;
  return [clean(p[0]! * c - p[1]! * s), clean(p[0]! * s + p[1]! * c)];
}

/** A pair of integers in [lo, hi], not both zero. */
export function pair(rng: Rng, lo: number, hi: number): number[] {
  for (;;) {
    const p = [int(rng, lo, hi), int(rng, lo, hi)];
    if (p[0] !== 0 || p[1] !== 0) return p;
  }
}

/** `a × b` for TeX, negatives in parentheses. */
export const times = (a: number, b: number) => `${par(a)} \\times ${par(b)}`;
