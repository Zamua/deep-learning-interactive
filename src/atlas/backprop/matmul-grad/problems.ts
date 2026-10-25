import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { clean, dd, n, nonzero, par, straps, traps, vtraps } from '../kit';

const DS = dd('\\symL', 'z');
const DW = dd('\\symL', '\\symW');
const DX = dd('\\symL', '\\symx');
const X = '\\sym{x}{X}';
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
    id: 'grad-shape',
    make(rng, d) {
      if (d >= 0.7 && rng.int(2) === 0) {
        const N = pick(rng, [16, 32, 64, 128]);
        const Dn = pick(rng, [48, 784, 3072, 512]);
        const C = pick(rng, [3, 10, 100]);
        const ask = pick(rng, ['W', 'X', 'Z'] as const);
        const ans = ask === 'W' ? [C, Dn] : ask === 'X' ? [N, Dn] : [N, C];
        const ts =
          ask === 'W'
            ? [
                { value: [Dn, C], why: `That is $\\symW^{\\top}$'s shape. The gradient on $\\symW$ has $\\symW$'s own shape.` },
                { value: [N, C], why: 'That is the shape of the product $Z$. The gradient on $\\symW$ has one number per entry of $\\symW$.' },
              ]
            : ask === 'X'
              ? [
                  { value: [Dn, N], why: `That is $${X}^{\\top}$'s shape. The gradient on $${X}$ has $${X}$'s own shape.` },
                  { value: [C, Dn], why: 'That is $\\symW$\'s shape. The gradient on the batch has one number per input entry.' },
                ]
              : [
                  { value: [C, N], why: 'That is $Z^{\\top}$\'s shape. The gradient on $Z$ has $Z$\'s own shape.' },
                  { value: [N, Dn], why: `That is $${X}$'s shape. $Z$ has one entry per row of $${X}$ and row of $\\symW$.` },
                ];
        const target = ask === 'W' ? '\\symW' : ask === 'X' ? X : 'Z';
        return {
          prompt: `A node multiplies a batch: $Z = ${X}\\,\\symW^{\\top}$, with $${X}$ of shape $${shape([N, Dn])}$ and $\\symW$ of shape $${shape([C, Dn])}$. What is the shape of $${dd('\\symL', target)}$? Give it like (3, 4).`,
          answer: { kind: 'shape', value: ans },
          traps: straps(ans, ts),
          solution: [
            `$Z$ is $${shape([N, Dn])}$ times $${shape([Dn, C])}$, so it has shape $${shape([N, C])}$.`,
            `A gradient always has the shape of what it is the gradient of: $${dd('\\symL', target)}$ is $${shape(ans)}$, like $${target}$.`,
          ],
        };
      }
      const [m, k] = sizes(rng, d);
      const ask = d < 0.35 ? pick(rng, ['W', 'x'] as const) : pick(rng, ['W', 'x', 'z'] as const);
      const ans = ask === 'W' ? [m, k] : ask === 'x' ? [k] : [m];
      const ts =
        ask === 'W'
          ? [
              { value: [k, m], why: 'That is $\\symW^{\\top}$\'s shape. The gradient on $\\symW$ has one number per entry of $\\symW$, in $\\symW$\'s own shape.' },
              { value: [m], why: 'That is the shape of $z$. The gradient on $\\symW$ has one number per entry of $\\symW$.' },
            ]
          : ask === 'x'
            ? [
                { value: [m], why: 'That is the shape of $z$. The gradient on $\\symx$ has $\\symx$\'s shape.' },
                { value: [m, k], why: 'That is $\\symW$\'s shape. The gradient on $\\symx$ has one number per entry of $\\symx$.' },
                { value: [k, m], why: 'That is $\\symW^{\\top}$\'s shape. $\\symW^{\\top}$ times the gradient on $z$ is a vector.' },
              ]
            : [
                { value: [k], why: 'That is $\\symx$\'s shape. The gradient on $z$ has one number per entry of $z$.' },
                { value: [m, k], why: 'That is $\\symW$\'s shape. The gradient on $z$ has one number per entry of $z$.' },
              ];
      const target = ask === 'W' ? '\\symW' : ask === 'x' ? '\\symx' : 'z';
      return {
        prompt: `A node computes $z = \\symW\\symx$, where $\\symW$ has shape $${shape([m, k])}$ and $\\symx$ has shape $${shape([k])}$. What is the shape of $${dd('\\symL', target)}$? Give it like (3, 4), or (3,) for a vector.`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, ts),
        solution: [
          `$z = \\symW\\symx$ has shape $${shape([m])}$.`,
          `A gradient has the shape of what it is the gradient of: $${dd('\\symL', target)}$ is $${shape(ans)}$, like $${target}$.`,
          ...(ask === 'W' ? [`It is built as $${DS}\\,\\symx^{\\top}$: $${shape([m, 1])}$ times $${shape([1, k])}$.`] : ask === 'x' ? [`It is built as $\\symW^{\\top} ${DS}$: $${shape([k, m])}$ times $${shape([m])}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const m = d < 0.35 ? 2 : pick(rng, [2, 3]);
      const k = d < 0.35 ? 3 : pick(rng, [2, 3, 4].filter((v) => v !== m));
      const x = vals(rng, k, d);
      const ds = d >= 0.7 ? Array.from({ length: m }, () => pick(rng, [0.5, -0.5, 1.5, -2, 2, -1, 3])) : vals(rng, m, d).map((v) => (v === 0 ? 1 : v));
      const i = rng.int(m);
      const j = rng.int(k);
      const ans = clean(ds[i]! * x[j]!);
      const ts = [{ value: ds[i]! + x[j]!, why: `That adds. Each entry of the gradient is a product: row ${i}'s upstream gradient times column ${j}'s input.` }];
      if (j < m && i < k && i !== j) ts.push({ value: ds[j]! * x[i]!, why: `That swaps the indices. Row ${i} goes with $\\partial \\symL / \\partial z_{${i}}$, column ${j} with $\\symx_{${j}}$.` });
      return {
        prompt: `A node computes $z = \\symW\\symx$ with $\\symx = ${vec(x)}$, and backprop brings $${DS} = ${vec(ds)}$. What is entry $(${i}, ${j})$ of $${DW}$: row ${i}, column ${j}, counting from 0?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: [
          `$z_{${i}} = \\sum_j \\symW_{${i}j}\\,\\symx_j$, so the local slope of $z_{${i}}$ with respect to $\\symW_{${i}${j}}$ is $\\symx_{${j}} = ${n(x[j]!)}$.`,
          `Times the gradient on $z_{${i}}$, $${n(ds[i]!)}$: $${n(ds[i]!)} \\times ${par(x[j]!)} = ${n(ans)}$.`,
          `Every entry works this way, which is the outer product $${DW} = ${DS}\\,\\symx^{\\top}$.`,
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
        const ans = Array.from({ length: k }, (_, j) => clean(W.reduce((a, row, i) => a + row[j]! * ds[i]!, 0)));
        const ts: { value: number[]; why: string }[] = [];
        if (m === k) ts.push({ value: W.map((row) => clean(row.reduce((a, w, j) => a + w * ds[j]!, 0))), why: 'That multiplies by $\\symW$, not $\\symW^{\\top}$: it weights the rows of $\\symW$. Each $\\symx_j$ collects column $j$ of $\\symW$, weighted by the gradient on $z$.' });
        ts.push({ value: Array.from({ length: k }, (_, j) => W.reduce((a, row) => a + row[j]!, 0)), why: 'That adds up each column of $\\symW$ without weighting it by the gradient on $z$.' });
        if (new Set(W.map(String)).size < m || (m === k && W[0]![1] === W[1]![0])) continue;
        return {
          prompt: `A node computes $z = \\symW\\symx$ with $\\symW = ${mat(W)}$. Backprop brings $${DS} = ${vec(ds)}$. What is $${DX}$?`,
          answer: { kind: 'vector', value: ans },
          traps: vtraps(ans, ts),
          solution: [
            `$${DX} = \\symW^{\\top} ${DS}$: each $\\symx_j$ feeds every entry of $z$, so it collects column $j$ of $\\symW$, weighted by the gradient on each entry of $z$.`,
            ...ans.map((v, j) => `Entry ${j}: $${W.map((row, i) => `${par(row[j]!)} \\times ${par(ds[i]!)}`).join(' + ')} = ${n(v)}$.`),
            `So $${DX} = ${vec(ans)}$, the shape of $\\symx$.`,
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
          prompt: `A node computes $z = \\symW\\symx$, with $\\symW$ of shape $${shape([m, k])}$ and $\\symx$ of shape $${shape([k])}$. Backprop brings $${DS}$, shape $${shape([m])}$. Which product gives $${DW}$?`,
          answer: {
            kind: 'choice',
            options: [`$${DS}\\,\\symx^{\\top}$`, `$\\symx\\left(${DS}\\right)^{\\top}$`, `$\\symW^{\\top} ${DS}$`, `$\\left(${DS}\\right)^{\\top} \\symx$`],
            correct: 0,
            why: [
              null,
              `That is the answer transposed: shape $${shape([k, m])}$, not $\\symW$'s $${shape([m, k])}$.`,
              `That is the gradient on $\\symx$, shape $${shape([k])}$.`,
              `That pairs ${m} entries with ${k}: the product is not defined, and the gradient needs one number per entry of $\\symW$ anyway.`,
            ],
          },
          solution: [
            `$${DW}$ must have $\\symW$'s shape, $${shape([m, k])}$.`,
            `From a column of ${m} and a row of ${k}, only the outer product makes that: $${DS}\\,\\symx^{\\top}$, entry $(i, j)$ being $\\partial \\symL / \\partial z_i$ times $\\symx_j$.`,
          ],
        };
      }
      return {
        prompt: `A node computes $z = \\symW\\symx$, with $\\symW$ of shape $${shape([m, k])}$ and $\\symx$ of shape $${shape([k])}$. Backprop brings $${DS}$, shape $${shape([m])}$. Which product gives $${DX}$?`,
        answer: {
          kind: 'choice',
          options: [`$\\symW^{\\top} ${DS}$`, `$\\symW ${DS}$`, `$${DS}\\,\\symx^{\\top}$`, '$\\symW$ alone'],
          correct: 0,
          why: [
            null,
            `$\\symW$ is $${shape([m, k])}$ and $${DS}$ has ${m} entries: the inner sizes ${k} and ${m} do not match.`,
            `That is the gradient on $\\symW$, shape $${shape([m, k])}$.`,
            `$\\symW$ is the local slope $\\partial z / \\partial \\symx$. It still has to carry the gradient arriving from above.`,
          ],
        },
        solution: [
          `$${DX}$ must have $\\symx$'s shape, $${shape([k])}$.`,
          `$\\symW^{\\top}$ is $${shape([k, m])}$, and times the ${m} entries of $${DS}$ it gives exactly ${k} numbers: each $\\symx_j$ collects column $j$ of $\\symW$, weighted by the gradient on each entry of $z$.`,
        ],
      };
    },
  },
];
