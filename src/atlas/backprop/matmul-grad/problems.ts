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

export const generators: Generator[] = [
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
    id: 'input-entry',
    make(rng, d) {
      const [m, k] = d < 0.35 ? [2, 2] : pick(rng, [[2, 2], [2, 3], [3, 2], [3, 3]] as [number, number][]);
      const j = rng.int(k);
      let W: number[][];
      // Distinct rows, and a column that differs from the row of the same number.
      do W = Array.from({ length: m }, () => vals(rng, k, d));
      while (new Set(W.map(String)).size < m || (m === k && String(W[j]) === String(W.map((row) => row[j]))));
      const ds = vals(rng, m, d).map((v) => (v === 0 ? 1 : v));
      const col = W.map((row) => row[j]!);
      const prods = col.map((w, i) => clean(w * ds[i]!));
      const ans = clean(prods.reduce((a, b) => a + b, 0));
      const ts: { value: number; why: string }[] = [];
      if (m === k) ts.push({ value: W[j]!.reduce((a, w, c) => a + w * ds[c]!, 0), why: `That dots row ${j} of $\\symW$ with $${DS}$. $\\symx_{${j}}$ meets one weight in each row, so it takes column ${j}.` });
      ts.push({ value: col.reduce((a, w) => a + w, 0), why: `That adds up column ${j} of $\\symW$ without multiplying by $${DS}$.` });
      ts.push({ value: prods[0]!, why: `That keeps only the path through $z_0$. $\\symx_{${j}}$ feeds every entry of $z$, so the gradients from every row add up.` });
      return {
        prompt: `A node computes $z = \\symW\\symx$ with $\\symW = ${mat(W)}$ and $${DS} = ${vec(ds)}$. What is entry ${j} of $${DX}$, counting from 0?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: [
          `Entry ${j} is the gradient on $\\symx_{${j}}$, which meets column ${j} of $\\symW$, $${vec(col)}$: one weight on the way to each $z_i$.`,
          `Each multiply swaps, so from $z_i$ it gets $\\symW_{i${j}}$ times $${dzi('i')}$: $${col.map((w, i) => `${par(w)} \\times ${par(ds[i]!)}`).join(',\\ ')}$, which is $${prods.map((v) => n(v)).join(',\\ ')}$.`,
          `$\\symx_{${j}}$ feeds every $z_i$, so those add up: $${prods.map((v) => par(v)).join(' + ')} = ${n(ans)}$.`,
        ],
      };
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
    id: 'input-shape',
    make(rng, d) {
      const [m, k] = sizes(rng, d);
      const ans = [k];
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$ and $\\symx$ has shape $${shape([k])}$. What is the shape of $${DX}$?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          { value: [m], why: `That is the shape of $z$. $${DX}$ has one number per entry of $\\symx$.` },
          { value: [m, k], why: `That is $\\symW$'s shape. $${DX}$ has one number per entry of $\\symx$.` },
          { value: [k, m], why: `That is $\\symW^{\\top}$'s shape. $\\symW^{\\top}$ times $${DS}$ is a vector, one number per entry of $\\symx$.` },
        ]),
        solution: [`$${DX}$ holds one number per entry of $\\symx$: $${shape([k])}$.`, `Check: $\\symW^{\\top}$, $${shape([k, m])}$, times $${DS}$, $${shape([m])}$, gives $${shape([k])}$.`],
      };
    },
  },
];
