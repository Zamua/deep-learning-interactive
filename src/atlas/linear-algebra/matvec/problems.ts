import type { Generator } from '../../../mastery/domain/types';
import { dot, int, ints, mat, ORD, pick, shp, terms, vec } from '../../kit';
import { matrix, prodTex } from '../kit';

const ROWS = [10, 100, 1000];
const COLS = [48, 784, 3072, 12288];

export const generators: Generator[] = [
  {
    id: 'product',
    make(rng, d) {
      const [m, n] = d < 0.3 ? [2, 2] : d < 0.6 ? pick(rng, [[2, 3], [3, 2], [2, 2]] as [number, number][]) : pick(rng, [[3, 3], [2, 3], [3, 2]] as [number, number][]);
      const [lo, hi] = d < 0.3 ? [0, 3] : d < 0.6 ? [-2, 3] : [-3, 3];
      let W = matrix(rng, m, n, lo, hi);
      // A row of zeros would make its entry trivial.
      while (W.some((r) => r.every((v) => v === 0))) W = matrix(rng, m, n, lo, hi);
      const x = ints(rng, n, d < 0.3 ? 1 : lo, hi);
      const out = W.map((r) => dot(r, x));
      return {
        prompt: `$$\\symW = ${mat(W)}$$\n\n$$\\symx = ${vec(x)}$$\n\nWhat is $\\symW\\symx$?`,
        answer: { kind: 'vector', value: out },
        solution: [
          ...W.map((r, i) => `Row ${i} dotted with $\\symx$: $${prodTex(r, x)} = ${out[i]}$.`),
          `One entry per row: $\\symW\\symx = ${vec(out)}$.`,
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const [m, n] = d < 0.5 ? [3, 3] : pick(rng, [[3, 4], [4, 3], [4, 4]] as [number, number][]);
      const [lo, hi] = d < 0.35 ? [0, 3] : [-3, 4];
      const W = matrix(rng, m, n, lo, hi);
      const x = ints(rng, n, lo, hi);
      const i = rng.int(m);
      const v = dot(W[i]!, x);
      const traps: { value: number; why: string }[] = [];
      if (m === n) {
        const col = W.map((r) => r[i]!);
        traps.push({ value: dot(col, x), why: `That dots column ${i} with $\\symx$. Entry ${i} of $\\symW\\symx$ comes from row ${i}.` });
      }
      if (i > 0) traps.push({ value: dot(W[i - 1]!, x), why: `That is row ${i - 1}, the ${ORD[i - 1]} row. Rows count from 0, so entry ${i} comes from the ${ORD[i]} row.` });
      traps.push({ value: W[i]!.reduce((a, b) => a + b, 0), why: `That adds up row ${i} without multiplying by $\\symx$. Multiply each entry of the row by the matching entry of $\\symx$ first.` });
      return {
        prompt: `$$\\symW = ${mat(W)}$$\n\n$$\\symx = ${vec(x)}$$\n\nWhat is entry ${i} of $\\symW\\symx$, counting from 0?`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t) => t.value !== v),
        solution: [
          `Entry ${i} is row ${i} of $\\symW$, $${vec(W[i]!)}$, dotted with $\\symx$.`,
          `Multiply matching entries and add: $${prodTex(W[i]!, x)} = ${terms(W[i]!.map((a, k) => a * x[k]!))} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'sizes',
    make(rng, d) {
      let m: number;
      let n: number;
      if (d < 0.6) {
        m = int(rng, 2, 9);
        n = int(rng, 2, 8);
        if (n >= m) n++;
      } else {
        m = pick(rng, ROWS);
        n = pick(rng, COLS);
      }
      if (rng.int(2) === 0) {
        return {
          prompt: `$\\symW$ has shape $${shp([m, n])}$ and $\\symx$ has ${n} entries. How many entries does $\\symW\\symx$ have?`,
          answer: { kind: 'number', value: m },
          traps: [
            { value: n, why: `That is the length of $\\symx$, which matches the columns. The result has one entry per row of $\\symW$.` },
            { value: m * n, why: 'That counts the numbers in $\\symW$. Each row gives one dot product, so the result has one entry per row.' },
          ],
          solution: [`Each of the ${m} rows of $\\symW$ is dotted with $\\symx$, giving one number.`, `So $\\symW\\symx$ has ${m} entries.`],
        };
      }
      return {
        prompt: `$\\symW$ has shape $${shp([m, n])}$. How many entries must $\\symx$ have for $\\symW\\symx$ to be defined?`,
        answer: { kind: 'number', value: n },
        traps: [{ value: m, why: `That is the number of rows, the length of the result. Each row is dotted with $\\symx$, so $\\symx$ must be as long as a row.` }],
        solution: [`Each row of $\\symW$ is dotted with $\\symx$, and a dot product needs two vectors of the same length.`, `A row has one entry per column: ${n}. So $\\symx$ needs ${n} entries.`],
      };
    },
  },
  {
    id: 'defined',
    make(rng) {
      const m = int(rng, 2, 6);
      let n = int(rng, 2, 5);
      if (n >= m) n++;
      if (rng.int(2) === 0) {
        return {
          prompt: `$\\symW$ has shape $${shp([m, n])}$. Which vector can it multiply, as $\\symW\\symx$?`,
          answer: {
            kind: 'choice',
            options: [`An $\\symx$ with ${n} entries`, `An $\\symx$ with ${m} entries`, `An $\\symx$ with ${m * n} entries`],
            correct: 0,
            why: [
              null,
              `${m} is the number of rows, which sets the length of the result. Each row is dotted with $\\symx$, so $\\symx$ must be as long as a row: ${n}.`,
              `$\\symx$ needs one entry per column, not one per number in $\\symW$: every row is dotted with the same $\\symx$.`,
            ],
          },
          solution: [`Shape $${shp([m, n])}$: ${m} rows of ${n} entries each.`, `Each row is dotted with $\\symx$, so $\\symx$ needs ${n} entries; the result has ${m}.`],
        };
      }
      const i = rng.int(Math.min(m, n));
      return {
        prompt: `$\\symW$ has shape $${shp([m, n])}$ and $\\symx$ has ${n} entries. What is entry ${i} of $\\symW\\symx$?`,
        answer: {
          kind: 'choice',
          options: [`Row ${i} of $\\symW$ dotted with $\\symx$`, `Column ${i} of $\\symW$ dotted with $\\symx$`, `Row ${i} of $\\symW$ times $\\symx[${i}]$`],
          correct: 0,
          why: [
            null,
            `A column of $\\symW$ has ${m} entries and $\\symx$ has ${n}: they cannot even be dotted. Rows line up with $\\symx$.`,
            `That scales row ${i} by one entry, which gives a whole vector, not a number. Entry ${i} uses all of $\\symx$, each entry times the matching entry of row ${i}.`,
          ],
        },
        solution: [`Each entry of $\\symW\\symx$ is one row of $\\symW$ dotted with $\\symx$.`, `Entry ${i} comes from row ${i}, the ${ORD[i]} row: ${n} products, added up.`],
      };
    },
  },
];
