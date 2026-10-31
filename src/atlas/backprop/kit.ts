// Generator helpers shared by the backprop concepts.
import type { Rng } from '../../core/rand';
import { clean, int, num, round } from '../kit';

/** A number for TeX after float cleanup. */
export const n = (x: number, places?: number): string => num(places === undefined ? clean(x) : x, places);

/** `\frac{\partial top}{\partial bot}` */
export const dd = (top: string, bot: string): string => `\\frac{\\partial ${top}}{\\partial ${bot}}`;

/** One decimal in [lo, hi], never 0 and never a whole number. */
export function fractional(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const v = int(rng, lo * 10, hi * 10);
    if (v % 10 !== 0) return v / 10;
  }
}
