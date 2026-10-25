// Generator helpers shared by the training concepts.
import type { Rng } from '../../core/rand';
import { int, num, pick, round } from '../kit';
import { clean } from '../optimization/kit';

export { big, clean, minus, nonzero, paren, tenth, traps, vtraps } from '../optimization/kit';

/** A whole number for prose, with thousands commas: 50,000. */
export const commas = (n: number): string => n.toLocaleString('en-US');

/** A number to fixed places for TeX, with float noise dropped. */
export const fx = (x: number, places: number): string => num(clean(x), places);

/** A TeX table: one header row, then a row per entry, a rule under the header and after the first column. */
export function texTable(head: string[], rows: (string | number)[][]): string {
  const cols = `c|${'c'.repeat(head.length - 1)}`;
  const line = (r: (string | number)[]) => r.map((v) => (typeof v === 'number' ? num(v) : v)).join(' & ');
  return `\\begin{array}{${cols}} ${line(head)} \\\\ \\hline ${rows.map(line).join(' \\\\ ')} \\end{array}`;
}

/** `why` for a choice: `wrong(i)` for every option except the correct one, which gets null. */
export const whys = (n: number, correct: number, wrong: (i: number) => string): (string | null)[] =>
  Array.from({ length: n }, (_, i) => (i === correct ? null : wrong(i)));

/** Terms added up with their signs folded: `4 - 1 + 0`. */
export const sumTex = (xs: readonly number[]): string =>
  xs.map((v, i) => (i === 0 ? num(clean(v)) : v < 0 ? `- ${num(clean(-v))}` : `+ ${num(clean(v))}`)).join(' ');

export const sum = (xs: readonly number[]): number => clean(xs.reduce((a, b) => a + b, 0));

/**
 * Losses logged every `every` epochs: training falls throughout, validation falls to its
 * minimum at row `best`, then rises. Every validation value is unique and above training.
 */
export function lossLog(rng: Rng, d: number) {
  const n = d < 0.4 ? 6 : d < 0.75 ? 7 : 8;
  const every = d < 0.4 ? 1 : pick(rng, [2, 3, 5]);
  const best = int(rng, 1, n - 3);
  const margin = d < 0.5 ? 0.04 : 0.02;
  for (;;) {
    const train = [pick(rng, [2.3, 2.1, 1.9, 1.6, 1.4])];
    for (let i = 1; i < n; i++) train.push(round(train[i - 1]! * (0.62 + 0.2 * rng.next()), 2));
    // The gap between the splits widens every epoch: slower than training falls up to `best`, faster after it.
    const gap = [0.03 + 0.08 * rng.next()];
    for (let i = 1; i < n; i++) {
      const drop = train[i - 1]! - train[i]!;
      gap.push(gap[i - 1]! + (i <= best ? drop * (0.1 + 0.5 * rng.next()) : drop + margin + 0.08 * rng.next()));
    }
    const val = train.map((t, i) => round(t + gap[i]!, 2));
    const ok = train.every((t, i) => i === 0 || t < train[i - 1]! - 0.005) && val.every((v, i) => i === 0 || (i <= best ? v <= val[i - 1]! - margin : v >= val[i - 1]! + margin));
    if (ok) return { n, every, best, train, val, epoch: (i: number) => (i + 1) * every };
  }
}
