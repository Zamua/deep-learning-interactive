// TeX and arithmetic helpers shared by the classifiers' generators.
import { num, round } from '../kit';

export const dot = (a: readonly number[], b: readonly number[]): number => round(a.reduce((s, x, i) => s + x * b[i]!, 0), 6);
export const sumOf = (xs: readonly number[]): number => round(xs.reduce((a, b) => a + b, 0), 6);

/** Index of the largest entry; -1 when it is shared. */
export function argmaxOf(xs: readonly number[]): number {
  const m = Math.max(...xs);
  return xs.filter((x) => x === m).length === 1 ? xs.indexOf(m) : -1;
}

/** A factor for a product in TeX: negatives in parentheses. */
export const par = (x: number): string => (x < 0 ? `(${num(x)})` : num(x));

/** A matrix in TeX brackets. */
export const mat = (rows: readonly (readonly number[])[]): string =>
  `\\begin{bmatrix} ${rows.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

/** Terms added up with their signs folded: `4 - 1 + 0`. */
export const terms = (xs: readonly (number | string)[]): string =>
  xs.map((v, i) => {
    const s = typeof v === 'number' ? num(v) : v;
    if (i === 0) return s;
    return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
  }).join(' ');

/** The products of a dot product, written out: `1 \cdot 2 + (-1) \cdot 3`. */
export const prods = (a: readonly number[], b: readonly number[]): string => a.map((x, i) => `${par(x)} \\cdot ${par(b[i]!)}`).join(' + ');

/** A whole number with thousands separators for TeX: `30{,}730`. */
export const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/** The same for prose and options outside TeX: `30,730`. */
export const bigText = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
