// Generator helpers shared by the optimization concepts.
import type { Rng } from '../../core/rand';
import { clean, int, num, round } from '../kit';

export const onehot = (n: number, y: number): number[] => Array.from({ length: n }, (_, i) => (i === y ? 1 : 0));

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
