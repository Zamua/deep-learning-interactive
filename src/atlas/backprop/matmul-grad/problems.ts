import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { clean, dd, n, nonzero, par, straps, traps, vtraps } from '../kit';

const DS = dd('f', 'z');
const DW = dd('f', '\\symW');
const DX = dd('f', '\\symx');
const dzi = (i: number | string) => dd('f', `z_{${i}}`);
const shape = (dims: number[]) => `(${dims.join(', ')}${dims.length === 1 ? ',' : ''})`;
const mat = (rows: number[][]) => `\\begin{bmatrix} ${rows.map((r) => r.map((v) => n(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;

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

export const generators: Generator[] = [
  {
    id: 'entry',
    make(rng, d) {
      const m = d < 0.35 ? 2 : pick(rng, [2, 3]);
      const k = d < 0.35 ? 2 : pick(rng, [2, 3, 4]);
      const x = distinct(rng, () => vals(rng, k, d));
      const ds = distinct(rng, () => (d >= 0.7 ? Array.from({ length: m }, () => pick(rng, [0.5, -0.5, 1.5, -2, 2, -1, 3])) : vals(rng, m, d).map((v) => (v === 0 ? 1 : v))));
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
    id: 'input-grad',
    make(rng, d) {
      const [m, k] = d < 0.5 ? [2, 2] : pick(rng, [[2, 2], [2, 3], [3, 2]] as [number, number][]);
      for (;;) {
        const W = Array.from({ length: m }, () => vals(rng, k, d));
        const ds = vals(rng, m, d).map((v) => (v === 0 ? 1 : d < 0.35 ? Math.min(v, 3) : v));
        if (new Set(W.map(String)).size < m || (m === k && W[0]![1] === W[1]![0])) continue;
        const col = (j: number) => W.map((row) => row[j]!);
        const ans = Array.from({ length: k }, (_, j) => clean(W.reduce((a, row, i) => a + row[j]! * ds[i]!, 0)));
        const ts: { value: number[]; why: string }[] = [];
        if (m === k) ts.push({ value: W.map((row) => clean(row.reduce((a, w, j) => a + w * ds[j]!, 0))), why: `That dots the rows of $\\symW$ with $${DS}$. $\\symx_j$ meets column $j$ of $\\symW$, one weight in each row, so it needs $\\symW^{\\top}$, not $\\symW$.` });
        ts.push({ value: Array.from({ length: k }, (_, j) => W.reduce((a, row) => a + row[j]!, 0)), why: `That adds up each column of $\\symW$ without multiplying by $${DS}$.` });
        ts.push({ value: Array.from({ length: k }, (_, j) => W[0]![j]! * ds[0]!), why: `That keeps only the path through $z_0$. Each $\\symx_j$ feeds every entry of $z$, so the gradients from every row add up.` });
        return {
          prompt: `A node computes $z = \\symW\\symx$ with $\\symW = ${mat(W)}$ and $${DS} = ${vec(ds)}$. What is $${DX}$?`,
          answer: { kind: 'vector', value: ans },
          traps: vtraps(ans, ts),
          solution: [
            `Each $\\symx_j$ feeds every $z_i$ through $\\symW_{ij}$, so its gradients add up: $\\frac{\\partial f}{\\partial \\symx_j} = \\sum_i ${dzi('i')}\\,\\symW_{ij}$, column $j$ of $\\symW$ dotted with $${DS}$.`,
            ...ans.map((v, j) => `Entry ${j}: column ${j} of $\\symW$ is $${vec(col(j))}$, so $${col(j).map((w, i) => `${par(w)} \\times ${par(ds[i]!)}`).join(' + ')} = ${n(v)}$.`),
            `So $${DX} = ${vec(ans)}$. That is $\\symW^{\\top} ${DS}$, and it has the shape of $\\symx$.`,
          ],
        };
      }
    },
  },
  {
    id: 'which-product',
    make(rng, d) {
      const [m, k] = sizes(rng, d);
      if (rng.int(2) === 0) {
        return {
          prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$, $\\symx$ has shape $${shape([k])}$ and $${DS}$ has shape $${shape([m])}$. Which product gives $${DW}$?`,
          answer: {
            kind: 'choice',
            options: [`$${DS}\\,\\symx^{\\top}$`, `$\\symx\\left(${DS}\\right)^{\\top}$`, `$\\symW^{\\top} ${DS}$`, `$\\left(${DS}\\right)^{\\top} \\symx$`],
            correct: 0,
            why: [
              null,
              `That is the right grid transposed: shape $${shape([k, m])}$, where $\\symW$ is $${shape([m, k])}$.`,
              `That is the gradient on $\\symx$, shape $${shape([k])}$.`,
              `That pairs ${m} entries with ${k}, so the product is not defined. $${DW}$ needs one number per entry of $\\symW$.`,
            ],
          },
          solution: [
            `$${DW}$ has $\\symW$'s shape, $${shape([m, k])}$.`,
            `$${DS}$ as a column is $${shape([m, 1])}$ and $\\symx^{\\top}$ is a row, $${shape([1, k])}$: their product is $${shape([m, k])}$.`,
            `That is the outer product $${DS}\\,\\symx^{\\top}$: entry $(i, j)$ is $${dzi('i')}\\,\\symx_j$.`,
          ],
        };
      }
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$, $\\symx$ has shape $${shape([k])}$ and $${DS}$ has shape $${shape([m])}$. Which product gives $${DX}$?`,
        answer: {
          kind: 'choice',
          options: [`$\\symW^{\\top} ${DS}$`, `$\\symW ${DS}$`, `$${DS}\\,\\symx^{\\top}$`, `$\\symW^{\\top} \\symx$`],
          correct: 0,
          why: [
            null,
            `$\\symW$ is $${shape([m, k])}$ and $${DS}$ has ${m} entries: the inner sizes, ${k} and ${m}, do not match.`,
            `That is the gradient on $\\symW$, shape $${shape([m, k])}$.`,
            `That uses $\\symx$ itself. Each multiply sends $\\symx_j$ a weight times the gradient from above, so $\\symx$'s own value never enters its gradient.`,
          ],
        },
        solution: [
          `$${DX}$ has $\\symx$'s shape, $${shape([k])}$.`,
          `$\\symW^{\\top}$ is $${shape([k, m])}$ and $${DS}$ is $${shape([m])}$: their product is $${shape([k])}$.`,
          `Entry $j$ of $\\symW^{\\top} ${DS}$ is row $j$ of $\\symW^{\\top}$, which is column $j$ of $\\symW$, dotted with $${DS}$.`,
        ],
      };
    },
  },
  {
    id: 'grad-shape',
    make(rng, d) {
      const [m, k] = sizes(rng, d);
      const ask = d < 0.35 ? pick(rng, ['W', 'x'] as const) : pick(rng, ['W', 'x', 'z'] as const);
      const ans = ask === 'W' ? [m, k] : ask === 'x' ? [k] : [m];
      const ts =
        ask === 'W'
          ? [
              { value: [k, m], why: `That is $\\symW^{\\top}$'s shape, rows and columns swapped. $${DW}$ is laid out like $\\symW$ itself.` },
              { value: [m], why: `That is the shape of $z$. $${DW}$ has one number for every entry of $\\symW$.` },
              { value: [k], why: `That is the shape of $\\symx$. $${DW}$ has one number for every entry of $\\symW$.` },
            ]
          : ask === 'x'
            ? [
                { value: [m], why: `That is the shape of $z$. $${DX}$ has one number per entry of $\\symx$.` },
                { value: [m, k], why: `That is $\\symW$'s shape. $${DX}$ has one number per entry of $\\symx$.` },
                { value: [k, m], why: `That is $\\symW^{\\top}$'s shape. $\\symW^{\\top}$ times $${DS}$ is a vector, one number per entry of $\\symx$.` },
              ]
            : [
                { value: [k], why: `That is $\\symx$'s shape. $${DS}$ has one number per entry of $z$.` },
                { value: [m, k], why: `That is $\\symW$'s shape. $${DS}$ has one number per entry of $z$.` },
              ];
      const solution =
        ask === 'W'
          ? [`$${DW}$ holds one number per entry of $\\symW$, laid out like $\\symW$: $${shape([m, k])}$.`, `Check: $${DS}$ as a column, $${shape([m, 1])}$, times the row $\\symx^{\\top}$, $${shape([1, k])}$, gives $${shape([m, k])}$.`]
          : ask === 'x'
            ? [`$${DX}$ holds one number per entry of $\\symx$: $${shape([k])}$.`, `Check: $\\symW^{\\top}$, $${shape([k, m])}$, times $${DS}$, $${shape([m])}$, gives $${shape([k])}$.`]
            : [`$z = \\symW\\symx$ is $${shape([m, k])}$ times $${shape([k])}$, which gives $${shape([m])}$.`, `$${DS}$ holds one number per entry of $z$: $${shape([m])}$.`];
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$ and $\\symx$ has shape $${shape([k])}$. What is the shape of $${ask === 'W' ? DW : ask === 'x' ? DX : DS}$?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, ts),
        solution,
      };
    },
  },
];
