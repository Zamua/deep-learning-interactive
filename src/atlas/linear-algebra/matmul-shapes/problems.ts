import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { pick } from '../../kit';
import { distinct, shapeTex } from '../kit';

/** Three different sizes, so no two dimensions can be confused by value. */
function sizes(rng: Rng, d: number): [number, number, number] {
  if (d < 0.35) return distinct(rng, 3, 2, 7) as [number, number, number];
  if (d < 0.7) return distinct(rng, 3, 2, 20) as [number, number, number];
  return [pick(rng, [32, 64, 128, 256]), pick(rng, [48, 512, 784, 3072]), pick(rng, [3, 10, 100, 1000])];
}

export const generators: Generator[] = [
  {
    id: 'result',
    make(rng, d) {
      const [m, n, k] = sizes(rng, d);
      if (d >= 0.8 && rng.int(2) === 0) {
        const j = pick(rng, [2, 5, 16, 50].filter((v) => v !== m && v !== n && v !== k));
        return {
          prompt: `$A$ has shape $${shapeTex([m, n])}$, $B$ has shape $${shapeTex([n, k])}$ and $C$ has shape $${shapeTex([k, j])}$. What is the shape of $ABC$?`,
          answer: { kind: 'shape', value: [m, j] },
          solution: [
            'Multiply two at a time: first $AB$, then that times $C$.',
            `$AB$ is $${shapeTex([m, n])}$ times $${shapeTex([n, k])}$: the inner ${n}s match, and the outer dimensions give $${shapeTex([m, k])}$.`,
            `$(AB)C$ is $${shapeTex([m, k])}$ times $${shapeTex([k, j])}$: the inner ${k}s match, and the outer dimensions give $${shapeTex([m, j])}$.`,
          ],
        };
      }
      return {
        prompt: `$A$ has shape $${shapeTex([m, n])}$ and $B$ has shape $${shapeTex([n, k])}$. What is the shape of $AB$?`,
        answer: { kind: 'shape', value: [m, k] },
        solution: [
          `The inner dimensions, $A$'s columns and $B$'s rows, are ${n} and ${n}: they match, so the product works.`,
          `The outer dimensions give the result: $A$'s ${m} rows and $B$'s ${k} columns, shape $${shapeTex([m, k])}$.`,
        ],
      };
    },
  },
  {
    id: 'which',
    make(rng, d) {
      if (rng.int(2) === 0) {
        const [m, n, k] = sizes(rng, Math.min(d, 0.5));
        const pair = (a: [number, number], b: [number, number]) => `$${shapeTex(a)}$ times $${shapeTex(b)}$`;
        return {
          prompt: 'Which of these matrix products is defined?',
          answer: {
            kind: 'choice',
            options: [pair([m, n], [n, k]), pair([m, n], [k, n]), pair([n, m], [n, k]), pair([k, n], [m, k])],
            correct: 0,
            why: [
              null,
              `That matches the last dimensions. The rule pairs the first matrix's columns with the second's rows: here ${n} and ${k}.`,
              `That matches the first dimensions, the rows. The rule pairs the first matrix's columns with the second's rows: here ${m} and ${n}.`,
              `That matches the outer dimensions, which would work in the other order. In this order the inner pair is ${n} and ${m}.`,
            ],
          },
          solution: [
            `A product works when the first matrix's columns equal the second's rows: the inner dimensions.`,
            `Only $${shapeTex([m, n])}$ times $${shapeTex([n, k])}$ has matching inner dimensions, ${n} and ${n}. It gives $${shapeTex([m, k])}$.`,
          ],
        };
      }
      const [m, n, k] = sizes(rng, d);
      return {
        prompt: `$A$ has shape $${shapeTex([m, n])}$ and $B$ has shape $${shapeTex([k, n])}$. Which product has shape $${shapeTex([m, k])}$?`,
        answer: {
          kind: 'choice',
          options: ['`A @ B.T`', '`A @ B`', '`B @ A.T`', '`B.T @ A`'],
          correct: 0,
          why: [
            null,
            `The inner dimensions are ${n} and ${k}: $A$'s columns must equal $B$'s rows, and they do not. Transposing $B$ fixes that.`,
            `That works, but gives shape $${shapeTex([k, m])}$: the same numbers laid out the other way. The outer dimensions come out in the order the matrices go in.`,
            `$B^{\\top}$ is $${shapeTex([n, k])}$ and $A$ is $${shapeTex([m, n])}$: the inner pair ${k} and ${m} does not match.`,
          ],
        },
        solution: [
          `$B^{\\top}$ has shape $${shapeTex([n, k])}$.`,
          `$AB^{\\top}$ is $${shapeTex([m, n])}$ times $${shapeTex([n, k])}$: the inner ${n}s match and the result is $${shapeTex([m, k])}$.`,
        ],
      };
    },
  },
  {
    id: 'missing',
    make(rng, d) {
      const [m, n, k] = sizes(rng, d);
      const kind = rng.int(3);
      if (kind === 0) {
        return {
          prompt: `$A$ has shape $(${m}, q)$ and $B$ has shape $${shapeTex([n, k])}$. What must $q$ be for $AB$ to be defined?`,
          answer: { kind: 'number', value: n },
          traps: [
            { value: k, why: `That is $B$'s number of columns. $A$'s columns must match $B$'s rows: ${n}.` },
            { value: m, why: `That repeats $A$'s row count. $A$'s columns must match $B$'s rows: ${n}.` },
          ],
          solution: [`$A$'s columns must equal $B$'s rows, the inner pair.`, `$B$ has ${n} rows, so $q = ${n}$.`],
        };
      }
      if (kind === 1) {
        return {
          prompt: `$A$ has shape $${shapeTex([m, n])}$, $B$ has shape $(${n}, q)$, and $AB$ has shape $${shapeTex([m, k])}$. What is $q$?`,
          answer: { kind: 'number', value: k },
          traps: [
            { value: n, why: `${n} is the inner dimension, which disappears. The result's columns come from $B$'s columns.` },
            { value: m, why: `${m} is the result's row count, which comes from $A$. The result's columns come from $B$'s columns.` },
          ],
          solution: [`The result keeps the outer dimensions: $A$'s rows and $B$'s columns.`, `$AB$ has ${k} columns, so $B$ has ${k} columns: $q = ${k}$.`],
        };
      }
      return {
        prompt: `$A$ has shape $(q, ${n})$, $B$ has shape $${shapeTex([n, k])}$, and $AB$ has shape $${shapeTex([m, k])}$. What is $q$?`,
        answer: { kind: 'number', value: m },
        traps: [
          { value: n, why: `${n} is already $A$'s column count, the inner dimension. $A$'s rows set the result's rows.` },
          { value: k, why: `${k} is the result's column count, which comes from $B$. $A$'s rows set the result's rows.` },
        ],
        solution: [`The result keeps the outer dimensions: $A$'s rows and $B$'s columns.`, `$AB$ has ${m} rows, so $A$ has ${m} rows: $q = ${m}$.`],
      };
    },
  },
  {
    id: 'transpose',
    make(rng, d) {
      const [m, n, k] = sizes(rng, d);
      const kind = d < 0.35 ? 0 : rng.int(3);
      const given = `$A$ has shape $${shapeTex([m, n])}$ and $B$ has shape $${shapeTex([k, n])}$.`;
      if (kind === 1) {
        return {
          prompt: `${given} What is the shape of \`B @ A.T\`?`,
          answer: { kind: 'shape', value: [k, m] },
          traps: [{ value: [m, k], why: 'That is the shape of `A @ B.T`. The outer dimensions come out in the order the matrices go in: rows of $B$, then columns of $A^{\\top}$.' }],
          solution: [`$A^{\\top}$ has shape $${shapeTex([n, m])}$.`, `$BA^{\\top}$ is $${shapeTex([k, n])}$ times $${shapeTex([n, m])}$: the ${n}s match, and the result is $${shapeTex([k, m])}$.`],
        };
      }
      if (kind === 2) {
        return {
          prompt: `$B$ has shape $${shapeTex([k, n])}$ and the vector \`v\` has shape $${shapeTex([n])}$. What is the shape of \`B @ v\`?`,
          answer: { kind: 'shape', value: [k] },
          traps: [{ value: [n], why: 'That is the length of `v`. Each row of $B$ dotted with `v` gives one number, so the result has one entry per row of $B$.' }],
          solution: [`$Bv$ is $${shapeTex([k, n])}$ times a vector of ${n}: the ${n}s match.`, `One dot product per row of $B$: the result has shape $${shapeTex([k])}$.`],
        };
      }
      return {
        prompt: `${given} What is the shape of \`A @ B.T\`?`,
        answer: { kind: 'shape', value: [m, k] },
        traps: [{ value: [k, m], why: 'That is the shape of `B @ A.T`. The result keeps the outer dimensions in order: rows of $A$, then columns of $B^{\\top}$.' }],
        solution: [`$B^{\\top}$ has shape $${shapeTex([n, k])}$.`, `$AB^{\\top}$ is $${shapeTex([m, n])}$ times $${shapeTex([n, k])}$: the inner ${n}s match, and the result is $${shapeTex([m, k])}$.`],
      };
    },
  },
];
