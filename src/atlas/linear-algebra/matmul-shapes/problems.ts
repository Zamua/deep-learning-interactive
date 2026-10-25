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

/** Batch, features and classes for the X and W problems. */
function ndc(rng: Rng, d: number): [number, number, number] {
  if (d < 0.35) {
    const [N, D, C] = distinct(rng, 3, 2, 8);
    return [N!, D!, C!];
  }
  return [pick(rng, [8, 16, 32, 64, 128, 256]), pick(rng, [48, 784, 3072, 512]), pick(rng, [3, 5, 10, 100])];
}

const X = '\\sym{x}{X}';

export const generators: Generator[] = [
  {
    id: 'result',
    make(rng, d) {
      const [m, n, k] = sizes(rng, d);
      if (d >= 0.8 && rng.int(2) === 0) {
        const j = pick(rng, [2, 5, 16, 50].filter((v) => v !== m && v !== n && v !== k));
        return {
          prompt: `$A$ has shape $${shapeTex([m, n])}$, $B$ has shape $${shapeTex([n, k])}$ and $C$ has shape $${shapeTex([k, j])}$. What is the shape of $ABC$ (\`A @ B @ C\`)?`,
          answer: { kind: 'shape', value: [m, j] },
          solution: [
            `$AB$: inner dimensions ${n} and ${n} match, and the outer ones give $${shapeTex([m, k])}$.`,
            `$(AB)C$: inner dimensions ${k} and ${k} match, and the outer ones give $${shapeTex([m, j])}$.`,
          ],
        };
      }
      return {
        prompt: `$A$ has shape $${shapeTex([m, n])}$ and $B$ has shape $${shapeTex([n, k])}$. What is the shape of $AB$ (\`A @ B\`)?`,
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
          prompt: 'Shapes are (rows, columns). Which of these matrix products is defined?',
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
      const [N, D, C] = ndc(rng, d);
      return {
        prompt: `A batch $${X}$ holds $\\symN = ${N}$ examples of $\\symD = ${D}$ numbers each: shape $${shapeTex([N, D])}$. The weights $\\symW$ have one row per class, $\\symC = ${C}$ classes: shape $${shapeTex([C, D])}$. Which gives every example's class scores, shape $${shapeTex([N, C])}$?`,
        answer: {
          kind: 'choice',
          options: ['`X @ W.T`', '`X @ W`', '`W @ X.T`', '`W.T @ X`'],
          correct: 0,
          why: [
            null,
            `The inner dimensions are ${D} and ${C}: $${X}$'s columns must equal $\\symW$'s rows, and they do not. Transposing $\\symW$ fixes that.`,
            `That works, but gives shape $${shapeTex([C, N])}$: the same scores with classes as rows. The outer dimensions come out in the order the matrices go in.`,
            `$\\symW^{\\top}$ is $${shapeTex([D, C])}$ and $${X}$ is $${shapeTex([N, D])}$: the inner pair ${C} and ${N} does not match.`,
          ],
        },
        solution: [
          `$\\symW^{\\top}$ has shape $${shapeTex([D, C])}$.`,
          `$${X}\\symW^{\\top}$ is $${shapeTex([N, D])}$ times $${shapeTex([D, C])}$: the inner ${D}s match and the result is $${shapeTex([N, C])}$.`,
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
    id: 'batch',
    make(rng, d) {
      const [N, D, C] = ndc(rng, d);
      const kind = d < 0.35 ? 0 : rng.int(3);
      const given = `$${X}$ has shape $${shapeTex([N, D])}$: $\\symN = ${N}$ examples with $\\symD = ${D}$ numbers each. $\\symW$ has shape $${shapeTex([C, D])}$: one row of ${D} weights for each of $\\symC = ${C}$ classes.`;
      if (kind === 1) {
        return {
          prompt: `${given} What is the shape of \`W @ X.T\`?`,
          answer: { kind: 'shape', value: [C, N] },
          solution: [`$${X}^{\\top}$ has shape $${shapeTex([D, N])}$.`, `$\\symW${X}^{\\top}$ is $${shapeTex([C, D])}$ times $${shapeTex([D, N])}$: the ${D}s match, and the result is $${shapeTex([C, N])}$, one column per example.`],
        };
      }
      if (kind === 2) {
        return {
          prompt: `${given} One example on its own, \`x = X[0]\`, has shape $${shapeTex([D])}$. What is the shape of \`W @ x\`?`,
          answer: { kind: 'shape', value: [C] },
          solution: [`$\\symW\\symx$ is $${shapeTex([C, D])}$ times a vector of ${D}: the ${D}s match.`, `One dot product per row of $\\symW$: the result has shape $${shapeTex([C])}$, one score per class.`],
        };
      }
      return {
        prompt: `${given} What is the shape of \`X @ W.T\`?`,
        answer: { kind: 'shape', value: [N, C] },
        solution: [
          `$\\symW^{\\top}$ has shape $${shapeTex([D, C])}$.`,
          `$${X}\\symW^{\\top}$ is $${shapeTex([N, D])}$ times $${shapeTex([D, C])}$: the inner ${D}s match, and the result is $${shapeTex([N, C])}$, one score per example per class.`,
        ],
      };
    },
  },
];
