import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { distinct, mat, matrix, ORD, shapeTex } from '../kit';

/** Rows and columns that differ, so swapping them is a visible mistake. */
function dims(rng: Parameters<Generator['make']>[0], lo: number, hi: number): [number, number] {
  const m = int(rng, lo, hi);
  let n = int(rng, lo, hi - 1);
  if (n >= m) n++;
  return [m, n];
}

/** Large sizes: how many images are stacked as rows, and the numbers in one flattened image. */
const ROWS = [3, 10, 100, 1000];
const INPUTS: [string, number][] = [
  ['a 32 by 32 color image (3,072 numbers)', 3072],
  ['a 28 by 28 grayscale image (784 numbers)', 784],
  ['a 4 by 4 color image (48 numbers)', 48],
  ['a 64 by 64 color image (12,288 numbers)', 12288],
];

export const generators: Generator[] = [
  {
    id: 'shape',
    make(rng, d) {
      const kind = d < 0.35 ? 0 : rng.int(d < 0.7 ? 3 : 4);
      if (kind === 0 || kind === 3) {
        const [m, n] = kind === 0 ? dims(rng, d < 0.35 ? 2 : 1, 4) : dims(rng, 2, 4);
        const W = matrix(rng, m, n, 0, 9);
        if (kind === 3) {
          return {
            prompt: `$$\\symW = ${mat(W)}$$\n\nWhat is the shape of $\\symW^{\\top}$, its transpose (\`W.T\`)? Give it as (rows, columns).`,
            answer: { kind: 'shape', value: [n, m] },
            solution: [
              `$\\symW$ has ${m} row${m > 1 ? 's' : ''} and ${n} column${n > 1 ? 's' : ''}: shape $${shapeTex([m, n])}$.`,
              `Transposing turns rows into columns, so $\\symW^{\\top}$ has shape $${shapeTex([n, m])}$.`,
            ],
          };
        }
        return {
          prompt: `$$\\symW = ${mat(W)}$$\n\nWhat is the shape of $\\symW$? Give it as (rows, columns).`,
          answer: { kind: 'shape', value: [m, n] },
          solution: [
            `Rows run across: count them top to bottom. There ${m > 1 ? `are ${m}` : 'is 1'}.`,
            `Columns run down: count them left to right. There ${n > 1 ? `are ${n}` : 'is 1'}.`,
            `Rows first: the shape is $${shapeTex([m, n])}$.`,
          ],
        };
      }
      if (kind === 1) {
        const [m, n] = dims(rng, 2, 9);
        return {
          prompt: `$\\symW$ stacks ${m} row vectors, each with ${n} entries. What is its shape?`,
          answer: { kind: 'shape', value: [m, n] },
          solution: [`Each vector is one row, so there are ${m} rows.`, `Each row has ${n} entries, one per column: the shape is $${shapeTex([m, n])}$.`],
        };
      }
      if (d < 0.7) {
        const [m, n] = dims(rng, 2, 12);
        return {
          prompt: `$\\symW$ has shape $${shapeTex([m, n])}$. What is the shape of $\\symW^{\\top}$, its transpose (\`W.T\`)?`,
          answer: { kind: 'shape', value: [n, m] },
          solution: [`Transposing turns each row into a column.`, `The ${m} rows become ${m} columns, and the ${n} columns become ${n} rows: $${shapeTex([n, m])}$.`],
        };
      }
      const C = pick(rng, ROWS);
      const [what, D] = pick(rng, INPUTS);
      return {
        prompt: `$\\symW$ stacks ${C} flattened images, one per row, and each image is ${what}. What is the shape of $\\symW$?`,
        answer: { kind: 'shape', value: [C, D] },
        solution: [`One row per image: ${C} rows.`, `One column per number in an image: ${D} columns.`, `Rows first: $${shapeTex([C, D])}$.`],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const [m, n] = d < 0.35 ? dims(rng, 2, 3) : dims(rng, 2, 4);
      const vals = d < 0.35 ? distinct(rng, m * n, 0, 9) : distinct(rng, m * n, -9, 9);
      const W = Array.from({ length: m }, (_, i) => vals.slice(i * n, i * n + n));
      const i = rng.int(m);
      const j = rng.int(n);
      const v = W[i]![j]!;
      const traps: { value: number; why: string }[] = [];
      if (j < m && i < n) traps.push({ value: W[j]![i]!, why: `That is $\\symW[${j}, ${i}]$, with row and column swapped. The first index picks the row, the second the column.` });
      if (i > 0 && j > 0) traps.push({ value: W[i - 1]![j - 1]!, why: 'That counts rows and columns from 1. Both start at 0, so $\\symW[0, 0]$ is the top-left entry.' });
      return {
        prompt: `$$\\symW = ${mat(W)}$$\n\nWhat is $\\symW[${i}, ${j}]$? Rows and columns count from 0.`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t) => t.value !== v),
        solution: [
          `The first index is the row: row ${i} is the ${ORD[i]} row, $${vec(W[i]!)}$.`,
          `The second index is the column: column ${j} is the ${ORD[j]} entry of that row, so $\\symW[${i}, ${j}] = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'count',
    make(rng, d) {
      const [m, n] = d < 0.35 ? dims(rng, 2, 6) : d < 0.7 ? [int(rng, 2, 12), pick(rng, [10, 20, 25, 50, 100])] : [pick(rng, ROWS), pick(rng, INPUTS)[1]];
      if (d >= 0.5 && rng.int(2) === 0) {
        return {
          prompt: `A matrix with ${m} rows holds ${m * n} numbers. How many columns does it have?`,
          answer: { kind: 'number', value: n },
          solution: [`Each of the ${m} rows holds one number per column, so rows times columns is ${m * n}.`, `Columns: $${m * n} / ${m} = ${n}$.`],
        };
      }
      return {
        prompt: `A matrix has shape $${shapeTex([m, n])}$. How many numbers does it hold?`,
        answer: { kind: 'number', value: m * n },
        traps: [{ value: m + n, why: 'That adds the rows and columns. There is one number for every row and column pair, so multiply.' }],
        solution: [`${m} rows, each holding ${n} numbers.`, `$${m} \\times ${n} = ${m * n}$ numbers.`],
      };
    },
  },
  {
    id: 'valid-index',
    make(rng, d) {
      const [m, n] = dims(rng, 2, 6);
      const wide = m < n;
      // The right entry sits where its swap falls outside the matrix.
      const i = wide ? int(rng, 0, m - 1) : int(rng, n, m - 1);
      const j = wide ? int(rng, m, n - 1) : int(rng, 0, n - 1);
      const sizes = d < 0.5 ? `: ${m} rows and ${n} columns` : '';
      return {
        prompt: `$\\symW$ has shape $${shapeTex([m, n])}$${sizes}. Indices count from 0. Which of these is an entry of $\\symW$?`,
        answer: {
          kind: 'choice',
          options: [`$\\symW[${i}, ${j}]$`, `$\\symW[${j}, ${i}]$`, `$\\symW[${m}, ${n}]$`],
          correct: 0,
          why: [
            null,
            wide
              ? `That asks for row ${j}, but $\\symW$ has only ${m} rows, numbered 0 to ${m - 1}. The first index is the row.`
              : `That asks for column ${i}, but $\\symW$ has only ${n} columns, numbered 0 to ${n - 1}. The second index is the column.`,
            `That counts from 1. Rows run from 0 to ${m - 1} and columns from 0 to ${n - 1}, so the last entry is $\\symW[${m - 1}, ${n - 1}]$.`,
          ],
        },
        solution: [
          `Shape $${shapeTex([m, n])}$ means ${m} rows, indexed 0 to ${m - 1}, and ${n} columns, indexed 0 to ${n - 1}.`,
          `$\\symW[${i}, ${j}]$ is row ${i}, column ${j}: both in range.`,
        ],
      };
    },
  },
];
