// Generator helpers shared by the generative concepts.
import type { Rng } from '../../core/rand';
import { clean, int, num, round } from '../kit';

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
