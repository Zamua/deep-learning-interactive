import type { Generator } from '../../../mastery/domain/types';
import { int, ints, pick, scale, vec } from '../../kit';

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
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
          `Multiply matching entries: $${w.map((a, i) => `${a} \\times ${x[i]} = ${a * x[i]!}`).join(',\\ ')}$.`,
          `Add the products: $${w.map((a, i) => a * x[i]!).join(' + ').replace(/\+ -/g, '- ')} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'missing',
    make(rng, d) {
      const n = scale(d, 2, 3);
      const w = ints(rng, n, 1, 4);
      const x = ints(rng, n, -3, 4);
      const k = rng.int(n);
      const v = dot(w, x);
      const rest = v - w[k]! * x[k]!;
      const shown = x.map((xi, i) => (i === k ? 'a' : String(xi)));
      return {
        prompt: `$\\symw = ${vec(w)}$ and $\\symx = [${shown.join(',\\ ')}]$, and $\\symw \\cdot \\symx = ${v}$. What is $a$?`,
        answer: { kind: 'number', value: x[k]! },
        solution: [
          `Write out the dot product: $${terms(w, shown)} = ${v}$.`,
          `The known products add up to $${rest}$, so $${w[k]}a = ${v} - (${rest}) = ${v - rest}$.`,
          `Divide by $${w[k]}$: $a = ${x[k]}$.`,
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
      return {
        prompt: `$\\symw = ${vec(w)}$ and $\\symx = ${vec(x)}$. Without finishing the arithmetic if you can avoid it: is $\\symw \\cdot \\symx$ positive, zero or negative?`,
        answer: {
          kind: 'choice',
          options: ['Positive: they point roughly the same way', 'Zero: they are perpendicular', 'Negative: they point roughly opposite ways'],
          correct,
        },
        solution: [
          `$\\symw \\cdot \\symx = ${terms(w, x)} = ${v}$.`,
          v === 0 ? 'Zero means the vectors are at a right angle: neither has any component along the other.' : v > 0 ? 'Positive means the angle between them is less than 90 degrees.' : 'Negative means the angle between them is more than 90 degrees.',
        ],
      };
    },
  },
];
