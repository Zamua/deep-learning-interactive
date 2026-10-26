import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, vec } from '../../kit';
import { clean, nonzero, paren, tenth, traps, vtraps } from '../kit';

/** A 2-class, 2-feature classifier: W, b, x, y, the softmax output p and the score gradient ds. */
function setup(rng: Rng, d: number) {
  const x = d < 0.35 ? [int(rng, 1, 3), int(rng, 1, 3)] : [nonzero(rng, -3, 3), nonzero(rng, -3, 3)];
  const p0 = d < 0.7 ? int(rng, 1, 9) / 10 : int(rng, 5, 95) / 100;
  const p = [p0, clean(1 - p0)];
  const y = rng.int(2);
  const ds = p.map((v, i) => clean(v - (i === y ? 1 : 0)));
  const entry = () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2));
  const W = [
    [entry(), entry()],
    [entry(), entry()],
  ];
  const b = [entry(), entry()];
  return { x, p, y, ds, W, b };
}

const mat = (W: number[][]) => `\\begin{bmatrix} ${W.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const Wij = (i: number | string, j: number | string) => `\\symW_{${i},${j}}`;
const given = (o: ReturnType<typeof setup>) =>
  `A linear classifier has $\\symW = ${mat(o.W)}$, one row per class, and the input $\\symx = ${vec(o.x)}$ has label $\\symy = ${o.y}$, counting from 0. Softmax gives $\\symp = ${vec(o.p)}$.`;
const dsStep = (o: ReturnType<typeof setup>) => `The score gradient is $d\\syms = \\symp - \\mathrm{onehot}(\\symy) = ${vec(o.p)} - ${vec(o.y === 0 ? [1, 0] : [0, 1])} = ${vec(o.ds)}$.`;

export const generators: Generator[] = [
  {
    id: 'dW-entry',
    make(rng, d) {
      const o = setup(rng, d);
      const i = rng.int(2);
      const j = rng.int(2);
      const v = clean(o.ds[i]! * o.x[j]!);
      return {
        prompt: `${given(o)} For the cross-entropy loss $\\symL$, what is $\\partial \\symL / \\partial ${Wij(i, j)}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(i === o.y ? [{ value: o.p[i]! * o.x[j]!, why: `That uses $\\symp_{${i}}$ as the score gradient. Class ${i} is the correct class, so its entry is $\\symp_{${i}} - 1$.` }] : []),
          ...(i !== j ? [{ value: o.ds[j]! * o.x[i]!, why: `That swaps row and column. Row ${i} belongs to class ${i} and column ${j} to feature ${j}: $d\\syms_{${i}}\\, \\symx_{${j}}$.` }] : []),
          { value: o.ds[i]!, why: `That is the score gradient alone, the bias's gradient. A weight's gradient also multiplies by its input, $\\symx_{${j}}$.` },
          { value: -v, why: 'That has the wrong sign. The score gradient is $d\\syms = \\symp - \\mathrm{onehot}(\\symy)$, not the other way round.' },
        ]),
        solution: [
          dsStep(o),
          `Score ${i} is $\\symW_{${i},0}\\symx_0 + \\symW_{${i},1}\\symx_1 + \\symb_{${i}}$, so nudging $${Wij(i, j)}$ moves it by $\\symx_{${j}}$ times as much.`,
          `Chain rule: $\\partial \\symL / \\partial ${Wij(i, j)} = d\\syms_{${i}}\\, \\symx_{${j}} = ${paren(o.ds[i]!)} \\times ${paren(o.x[j]!)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'dW-row',
    make(rng, d) {
      const o = setup(rng, d);
      const k = rng.int(2);
      const v = o.x.map((xj) => clean(o.ds[k]! * xj));
      return {
        prompt: `${given(o)} For the cross-entropy loss $\\symL$, what is row ${k} of $\\partial \\symL / \\partial \\symW$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          ...(k === o.y ? [{ value: o.x.map((xj) => o.p[k]! * xj), why: `That uses $\\symp_{${k}}$ as the score gradient. Class ${k} is the correct class, so its entry is $\\symp_{${k}} - 1$.` }] : []),
          { value: o.ds.map((g) => g * o.x[k]!), why: `That is column ${k}: every class's score gradient times $\\symx_{${k}}$. Row ${k} takes class ${k}'s score gradient times each input.` },
          { value: [o.ds[k]!, o.ds[k]!], why: 'That leaves out the inputs. Each weight in the row also multiplies by its own column\'s input.' },
          { value: v.map((x) => -x), why: 'That has the wrong sign. The score gradient is $d\\syms = \\symp - \\mathrm{onehot}(\\symy)$, not the other way round.' },
        ]),
        solution: [
          dsStep(o),
          `Row ${k} belongs to class ${k}, so every weight in it takes $d\\syms_{${k}} = ${num(o.ds[k]!)}$.`,
          `Column $j$ multiplies by its input $\\symx_j$: ${o.x.map((xj, j) => `$d${Wij(k, j)} = ${paren(o.ds[k]!)} \\times ${paren(xj)} = ${num(v[j]!)}$`).join(', ')}.`,
          `So row ${k} is $d\\syms_{${k}}\\, \\symx = ${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'db',
    make(rng, d) {
      const o = setup(rng, d);
      return {
        prompt: `${given(o)} The biases are $\\symb = ${vec(o.b)}$. For the cross-entropy loss $\\symL$, what is $\\partial \\symL / \\partial \\symb$?`,
        answer: { kind: 'vector', value: o.ds },
        traps: vtraps(o.ds, [
          { value: o.p, why: 'That is $\\symp$ unchanged. Subtract the one-hot label: 1 comes off the correct class\'s entry.' },
          { value: o.ds.map((x) => -x), why: 'That has the signs flipped. The gradient is $\\symp - \\mathrm{onehot}(\\symy)$, negative at the correct class.' },
          { value: o.ds.map((x, i) => x * o.x[i]!), why: 'That multiplies by $\\symx$, which belongs in the weights\' gradient. A bias adds straight into its score, so its gradient is just the score gradient.' },
        ]),
        solution: [
          'Each bias adds straight into its own score, so its gradient is that score\'s gradient: $\\partial \\symL / \\partial \\symb = \\symp - \\mathrm{onehot}(\\symy)$. Neither $\\symW$, $\\symx$ nor $\\symb$ itself enters.',
          dsStep(o),
        ],
      };
    },
  },
  {
    id: 'factors',
    make(rng) {
      const C = 2 + rng.int(3);
      const D = 2 + rng.int(3);
      // Both indices fit both sizes, so the swapped option names a real class and feature.
      const m = Math.min(C, D);
      const i = rng.int(m);
      const j = (i + 1 + rng.int(m - 1)) % m;
      const dsx = (a: number | string, b: number | string) => `$d\\syms_{${a}}\\, \\symx_{${b}}$`;
      return {
        prompt: `A linear classifier $\\syms = \\symW\\symx + \\symb$ has ${C} classes and ${D} input features, one row of $\\symW$ per class. With the score gradient $d\\syms = \\partial \\symL / \\partial \\syms$ for the cross-entropy loss $\\symL$, what is $\\partial \\symL / \\partial ${Wij(i, j)}$?`,
        answer: {
          kind: 'choice',
          options: [dsx(i, j), dsx(j, i), `$d\\syms_{${i}}\\, ${Wij(i, j)}$`, `$d\\syms_{${i}}$`],
          correct: 0,
          why: [
            null,
            `That swaps row and column. Row ${i} belongs to class ${i}, so it takes $d\\syms_{${i}}$; column ${j} belongs to feature ${j}, so it takes $\\symx_{${j}}$.`,
            `That multiplies by the weight. Nudging $${Wij(i, j)}$ moves score ${i} by $\\symx_{${j}}$ times as much, so the input is the factor.`,
            `That is the bias $\\symb_{${i}}$'s gradient. A weight also multiplies by its input, $\\symx_{${j}}$.`,
          ],
        },
        solution: [
          `$${Wij(i, j)}$ sits in row ${i}, so it feeds only score ${i}: $\\syms_{${i}}$ holds the term $${Wij(i, j)}\\,\\symx_{${j}}$.`,
          `Nudging $${Wij(i, j)}$ moves $\\syms_{${i}}$ by $\\symx_{${j}}$ times as much, and the loss moves $d\\syms_{${i}}$ times as much as $\\syms_{${i}}$.`,
          `The chain rule multiplies the two: $\\partial \\symL / \\partial ${Wij(i, j)} = d\\syms_{${i}}\\, \\symx_{${j}}$.`,
        ],
      };
    },
  },
];
