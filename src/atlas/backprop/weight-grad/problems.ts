import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { clean, dd, n, nonzero, par, straps, traps, vtraps } from '../kit';

const DS = dd('f', 'z');
const DW = dd('f', '\\symW');
const dzi = (i: number | string) => dd('f', `z_{${i}}`);
const shape = (dims: number[]) => `(${dims.join(', ')}${dims.length === 1 ? ',' : ''})`;

/** Two different sizes for W, small or realistic. */
function sizes(rng: Rng, d: number): [number, number] {
  for (;;) {
    const m = d < 0.35 ? int(rng, 2, 6) : pick(rng, [3, 5, 10, 100, 64]);
    const k = d < 0.35 ? int(rng, 2, 8) : pick(rng, [4, 20, 784, 3072, 512]);
    if (m !== k) return [m, k];
  }
}

function vals(rng: Rng, len: number, d: number): number[] {
  return Array.from({ length: len }, () => (d < 0.35 ? int(rng, 1, 4) : d < 0.7 ? int(rng, -3, 4) : nonzero(rng, -4, 4)));
}

/** `vals` with no repeats, so every entry can be told apart in the solution. */
function distinct(rng: Rng, make: () => number[]): number[] {
  for (;;) {
    const xs = make();
    if (new Set(xs).size === xs.length) return xs;
  }
}

/** The gradient from above: never 0, halves at the top difficulty. */
const upstream = (rng: Rng, m: number, d: number): number[] =>
  distinct(rng, () => (d >= 0.7 ? Array.from({ length: m }, () => pick(rng, [0.5, -0.5, 1.5, -2, 2, -1, 3])) : vals(rng, m, d).map((v) => (v === 0 ? 1 : v))));

export const generators: Generator[] = [
  {
    id: 'entry',
    make(rng, d) {
      const m = d < 0.35 ? 2 : pick(rng, [2, 3]);
      const k = d < 0.35 ? 2 : pick(rng, [2, 3, 4]);
      const x = distinct(rng, () => vals(rng, k, d));
      const ds = upstream(rng, m, d);
      const i = rng.int(m);
      const j = rng.int(k);
      const ans = clean(ds[i]! * x[j]!);
      const ts = [
        { value: ds[i]! + x[j]!, why: `That adds them. The multiply gate passes $\\symW_{${i}${j}}$ a product: $${dzi(i)}$ times $\\symx_{${j}}$.` },
        { value: x[j]!, why: `That is $\\symx_{${j}}$ alone, the multiply's local slope. It still has to be multiplied by the gradient arriving from above, $${dzi(i)}$.` },
        { value: ds[i]!, why: `That is $${dzi(i)}$ alone, what the add copies down. The multiply then multiplies it by the other input, $\\symx_{${j}}$.` },
      ];
      if (j < m && i < k && i !== j) ts.push({ value: ds[j]! * x[i]!, why: `That swaps the row and the column: it uses $${dzi(j)}$ and $\\symx_{${i}}$. The row, ${i}, picks the entry of $${DS}$; the column, ${j}, picks the entry of $\\symx$.` });
      const terms = x.map((_, c) => `\\symW_{${i}${c}}\\symx_{${c}}`).join(' + ');
      return {
        prompt: `A node computes $z = \\symW\\symx$ with $\\symx = ${vec(x)}$ and $${DS} = ${vec(ds)}$. What is entry $(${i}, ${j})$ of $${DW}$, counting from 0?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: [
          `Entry $(${i}, ${j})$ belongs to $\\symW_{${i}${j}}$, the weight in row ${i}, column ${j}.`,
          `Row ${i} means it feeds $z_{${i}} = ${terms}$, through a multiply gate with $\\symx_{${j}}$.`,
          `The add copies $${dzi(i)} = ${n(ds[i]!)}$ down to that multiply.`,
          `The multiply swaps: $\\symW_{${i}${j}}$ gets the other input, $\\symx_{${j}} = ${n(x[j]!)}$, times that $${n(ds[i]!)}$: $${n(ds[i]!)} \\times ${par(x[j]!)} = ${n(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'weight-row',
    make(rng, d) {
      const m = d < 0.35 ? 2 : pick(rng, [2, 3]);
      const k = d < 0.35 ? 3 : pick(rng, [3, 4]);
      const x = distinct(rng, () => vals(rng, k, d));
      const ds = upstream(rng, m, d);
      // A row scaled by 1 would be x itself.
      const rows = ds.map((_, r) => r).filter((r) => ds[r] !== 1);
      const i = pick(rng, rows);
      const other = (i + 1) % m;
      const ans = x.map((v) => clean(ds[i]! * v));
      const ts = [
        { value: x, why: `That is $\\symx$ alone. Every weight in row ${i} also gets the gradient on its output, $${dzi(i)} = ${n(ds[i]!)}$: scale $\\symx$ by it.` },
        { value: x.map((v) => clean(ds[other]! * v)), why: `That scales $\\symx$ by $${dzi(other)}$, the gradient on $z_{${other}}$. Row ${i}'s weights feed $z_{${i}}$, so they take $${dzi(i)}$.` },
        { value: x.map((v) => clean(ds[i]! + v)), why: `That adds $${dzi(i)}$ to each entry. Each multiply gate passes a product: $${dzi(i)}$ times $\\symx_j$.` },
      ];
      return {
        prompt: `A node computes $z = \\symW\\symx$ with $\\symx = ${vec(x)}$ and $${DS} = ${vec(ds)}$. What is row ${i} of $${DW}$, counting from 0?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, ts),
        solution: [
          `Row ${i} of $${DW}$ holds the gradients of $\\symW_{${i}0}$ to $\\symW_{${i}${k - 1}}$, the weights that feed $z_{${i}}$.`,
          `Each weight $\\symW_{${i}j}$ gets $${dzi(i)} = ${n(ds[i]!)}$ times its column's input, $\\symx_j$.`,
          `So row ${i} is $\\symx$ scaled by $${n(ds[i]!)}$: $${x.map((v) => `${n(ds[i]!)} \\times ${par(v)}`).join(',\\ ')}$.`,
          `That is $${vec(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'grad-shape',
    make(rng, d) {
      const [m, k] = sizes(rng, d);
      const ask = d < 0.35 ? 'W' : pick(rng, ['W', 'W', 'z'] as const);
      const ans = ask === 'W' ? [m, k] : [m];
      const ts =
        ask === 'W'
          ? [
              { value: [k, m], why: `That is $\\symW^{\\top}$'s shape, rows and columns swapped. $${DW}$ is laid out like $\\symW$ itself.` },
              { value: [m], why: `That is the shape of $z$. $${DW}$ has one number for every entry of $\\symW$.` },
              { value: [k], why: `That is the shape of $\\symx$. $${DW}$ has one number for every entry of $\\symW$.` },
            ]
          : [
              { value: [k], why: `That is $\\symx$'s shape. $${DS}$ has one number per entry of $z$.` },
              { value: [m, k], why: `That is $\\symW$'s shape. $${DS}$ has one number per entry of $z$.` },
            ];
      const solution =
        ask === 'W'
          ? [`$${DW}$ holds one number per entry of $\\symW$, laid out like $\\symW$: $${shape([m, k])}$.`, `Check: $${DS}$ as a column, $${shape([m, 1])}$, times the row $\\symx^{\\top}$, $${shape([1, k])}$, gives $${shape([m, k])}$.`]
          : [`$z = \\symW\\symx$ is $${shape([m, k])}$ times $${shape([k])}$, which gives $${shape([m])}$.`, `$${DS}$ holds one number per entry of $z$: $${shape([m])}$.`];
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$ and $\\symx$ has shape $${shape([k])}$. What is the shape of $${ask === 'W' ? DW : DS}$?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, ts),
        solution,
      };
    },
  },
  {
    id: 'outer',
    make(rng, d) {
      const [m, k] = sizes(rng, d);
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$, $\\symx$ has shape $${shape([k])}$ and $${DS}$ has shape $${shape([m])}$. Which product gives $${DW}$?`,
        answer: {
          kind: 'choice',
          options: [`$${DS}\\,\\symx^{\\top}$`, `$\\symx\\left(${DS}\\right)^{\\top}$`, `$\\left(${DS}\\right)^{\\top} \\symx$`],
          correct: 0,
          why: [
            null,
            `That is the table transposed, $\\symx$ down the side and $${DS}$ across the top: shape $${shape([k, m])}$, where $\\symW$ is $${shape([m, k])}$.`,
            `That is a row times a column, which pairs ${m} entries with ${k}: not defined, and with equal lengths it would give one number. $${DW}$ needs one number per entry of $\\symW$.`,
          ],
        },
        solution: [
          `$${DW}$ has $\\symW$'s shape, $${shape([m, k])}$: entry $(i, j)$ is $${dzi('i')}\\,\\symx_j$.`,
          `That is a multiplication table with $${DS}$ down the side and $\\symx$ across the top.`,
          `$${DS}$ as a column is $${shape([m, 1])}$ and $\\symx^{\\top}$ is a row, $${shape([1, k])}$: their product is $${shape([m, k])}$, the outer product $${DS}\\,\\symx^{\\top}$.`,
        ],
      };
    },
  },
];
