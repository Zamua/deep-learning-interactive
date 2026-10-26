import type { Generator } from '../../../mastery/domain/types';
import { int, ints, pick, scale, vec } from '../../kit';
import { dot, par, prodTex, sumTex } from '../kit';

const terms = (a: number[], b: (number | string)[]) => a.map((x, i) => `(${x})(${b[i]})`).join(' + ');

export const generators: Generator[] = [
  {
    id: 'compute',
    make(rng, d) {
      const n = scale(d, 2, 4);
      const lo = d < 0.4 ? 0 : -3;
      const w = ints(rng, n, lo, 4);
      const x = ints(rng, n, lo, 4);
      const v = dot(w, x);
      const traps = [{ value: w.reduce((a, b) => a + b, 0) + x.reduce((a, b) => a + b, 0), why: 'That adds every entry of both vectors. The dot product multiplies matching entries first, then adds the products.' }];
      if (v !== w[0]! * x[0]!) traps.push({ value: w[0]! * x[0]!, why: 'That is only the first product. The dot product adds the products of every matching pair.' });
      return {
        prompt: `$\\symw = ${vec(w)}$ and $\\symx = ${vec(x)}$. What is $\\symw \\cdot \\symx$?`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t) => t.value !== v),
        solution: [
          `Multiply matching entries: $${w.map((a, i) => `${par(a)} \\times ${par(x[i]!)} = ${a * x[i]!}`).join(',\\ ')}$.`,
          `Add the products: $${sumTex(w.map((a, i) => a * x[i]!))} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'missing',
    make(rng, d) {
      const n = scale(d, 2, 3);
      const w = ints(rng, n, 1, 4);
      const x = ints(rng, n, d < 0.4 ? 0 : -3, 4);
      const k = rng.int(n);
      const v = dot(w, x);
      const rest = v - w[k]! * x[k]!;
      const shown = x.map((xi, i) => (i === k ? 'a' : String(xi)));
      const known = w.flatMap((wi, i) => (i === k ? [] : [`${par(wi)} \\times ${par(x[i]!)} = ${wi * x[i]!}`]));
      const traps = w[k]! !== 1 ? [{ value: v - rest, why: `That is $${w[k]}a$, the missing product. Divide it by $${w[k]}$ to get $a$.` }] : [];
      return {
        prompt: `$\\symw = ${vec(w)}$ and $\\symx = [${shown.join(',\\ ')}]$, and $\\symw \\cdot \\symx = ${v}$. What is $a$?`,
        answer: { kind: 'number', value: x[k]! },
        traps: traps.filter((t) => t.value !== x[k]),
        solution: [
          `Write out the dot product: $${terms(w, shown)} = ${v}$.`,
          n === 2
            ? `Multiply the known pair: $${known[0]}$.`
            : `Multiply the known pairs: $${known.join(',\\ ')}$. They add up to $${rest}$.`,
          `The unknown pair makes up the rest: $${w[k] === 1 ? '' : w[k]}a = ${v} - ${par(rest)} = ${v - rest}$.`,
          ...(w[k] === 1 ? [`So $a = ${x[k]}$.`] : [`Divide by its weight, $${w[k]}$: $a = ${v - rest} / ${w[k]} = ${x[k]}$.`]),
        ],
      };
    },
  },
  {
    id: 'sign',
    make(rng) {
      const a = int(rng, 1, 4) * pick(rng, [1, -1]);
      const b = int(rng, 1, 4);
      const w = [a, b];
      const kind = rng.int(3);
      const x = kind === 0 ? [-b, a] : kind === 1 ? [a + int(rng, 0, 2), b] : [-a, -b - int(rng, 0, 2)];
      const v = dot(w, x);
      const correct = v > 0 ? 0 : v === 0 ? 1 : 2;
      const sum = `$${prodTex(w, x)} = ${v}$`;
      return {
        prompt: `$\\symw = ${vec(w)}$ and $\\symx = ${vec(x)}$. What is the sign of $\\symw \\cdot \\symx$?`,
        answer: {
          kind: 'choice',
          options: ['Positive: they point roughly the same way', 'Zero: they are perpendicular', 'Negative: they point roughly opposite ways'],
          correct,
          why: [
            correct === 0 ? null : `${sum}, not above 0. Positive entries alone do not make it positive: the sum of the products decides.`,
            correct === 1 ? null : `${sum}, not 0. Zero takes products that cancel exactly.`,
            correct === 2 ? null : `${sum}, not below 0. A minus sign in one entry does not make it negative: the sum of the products decides.`,
          ],
        },
        solution: [
          `$\\symw \\cdot \\symx = ${prodTex(w, x)} = ${v}$.`,
          v === 0 ? 'Zero means the vectors are at a right angle: neither has any component along the other.' : v > 0 ? 'Positive means the angle between them is less than 90 degrees.' : 'Negative means the angle between them is more than 90 degrees.',
        ],
      };
    },
  },
];
