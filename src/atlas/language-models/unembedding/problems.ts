import type { Generator } from '../../../mastery/domain/types';
import { int, ints, pick, vec } from '../../kit';
import { argmax, big, commas, lit, mat, matrix, prodTex, shapeTex, traps, vtraps } from '../kit';

const WU = '\\sym{WU}{W_U}';
const WORDS = [
  ['the', 'cat', 'sat', 'on'],
  ['yes', 'no', 'maybe', 'ok'],
  ['red', 'blue', 'green', 'gold'],
  ['sun', 'moon', 'star', 'sky'],
  ['up', 'down', 'left', 'right'],
];

export const generators: Generator[] = [
  {
    id: 'scores',
    make(rng, d) {
      const big3 = d >= 0.7;
      const V = big3 ? 3 : d < 0.35 ? 3 : 4;
      const dim = big3 ? 3 : 2;
      const lo = d < 0.35 ? 0 : -2;
      const W = matrix(rng, V, dim, lo, 3);
      const h = ints(rng, dim, lo, 3);
      const v = W.map((r) => r.reduce((a, x, j) => a + x * h[j]!, 0));
      const tied = d >= 0.5 && rng.int(2) === 0;
      const name = tied ? 'E' : WU;
      const top = argmax(v);
      const ts = [
        { value: W.map((r) => r[0]! * h[0]!), why: 'That keeps only the first product of each row. A score adds the products of every entry of its row with $\\symh$.' },
        { value: W.map((r) => r.reduce((a, x) => a + x, 0)), why: `That adds up each row of $${name}$ and leaves $\\symh$ out. Multiply each entry by the matching entry of $\\symh$ first.` },
        ...(V === dim ? [{ value: W.map((_, i) => W.reduce((a, r, j) => a + r[i]! * h[j]!, 0)), why: `That dots $\\symh$ with the columns of $${name}$. A token's score uses its row.` }] : []),
      ];
      const setup = tied
        ? `A model ties its unembedding to its embedding table\n\n$$E = ${mat(W)}$$`
        : `A model's unembedding matrix is\n\n$$${WU} = ${mat(W)}$$`;
      return {
        prompt: `${setup}\n\nIts last vector at one position is $\\symh = ${vec(h)}$. What are the scores $\\syms$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, ts),
        solution: [
          ...(tied ? [`Tied means $${WU}$ is $E$ itself, row for row.`] : []),
          `The scores are $\\syms = ${WU}\\,\\symh$: each token's row dotted with $\\symh$. ${W.map((r, i) => `$\\syms_{${i}} = ${prodTex(r, h)} = ${v[i]}$`).join('; ')}.`,
          `So $\\syms = ${vec(v)}$${top >= 0 ? `, and token ${top} scores highest` : ''}.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const V = d < 0.5 ? pick(rng, [50, 65, 100, 1000, 5000]) : pick(rng, [32000, 50000, 50257, 100000]);
      const dim = d < 0.5 ? pick(rng, [8, 16, 32, 64, 128]) : pick(rng, [512, 768, 1024, 4096]);
      const kind = d < 0.35 ? 0 : rng.int(3);
      if (kind === 0) {
        const v = [V, dim];
        return {
          prompt: `A vocabulary has $V = ${big(V)}$ tokens, and the model's last vector $\\symh$ has $d = ${dim}$ numbers. What is the shape of the unembedding $${WU}$?`,
          answer: { kind: 'shape', value: v },
          traps: [
            { value: [dim, V], why: `That is the transpose. $${WU}$ has one row per token, each dotted with $\\symh$, so it is $(V, d)$.` },
            { value: [V], why: 'That is the shape of the scores. The matrix has a whole row of $d$ weights for every token.' },
            { value: [V, V], why: `Each row is dotted with $\\symh$, so a row has $d = ${dim}$ entries, not $V$.` },
          ],
          solution: [`The scores are $\\syms = ${WU}\\,\\symh$, one per token, so $${WU}$ has one row per token: $V = ${big(V)}$ rows.`, `Each row is dotted with $\\symh$, so it has $d = ${dim}$ entries: $${WU}$ is $${shapeTex([V, dim])}$, the same shape as the embedding table.`],
        };
      }
      if (kind === 1) {
        const v = [V];
        return {
          prompt: `The unembedding $${WU}$ has shape $${shapeTex([V, dim])}$, and the last vector $\\symh$ has $${dim}$ numbers. What is the shape of the scores $\\syms$?`,
          answer: { kind: 'shape', value: v },
          traps: [
            { value: [dim], why: `That is the shape of $\\symh$. The product takes one dot product per row of $${WU}$: one per token.` },
            { value: [V, dim], why: `That is the shape of $${WU}$. Times a vector, it gives one number per row.` },
          ],
          solution: [`$\\syms = ${WU}\\,\\symh$ dots every row of $${WU}$ with $\\symh$.`, `There are $${big(V)}$ rows, one per token, so $\\syms$ has shape $${shapeTex([V])}$.`],
        };
      }
      const n = d < 0.7 ? int(rng, 3, 20) : pick(rng, [128, 256, 1024, 2048]);
      const v = [n, V];
      return {
        prompt: `A model's last vectors for $${n}$ positions form an array of shape $${shapeTex([n, dim])}$, one row per position. The unembedding $${WU}$ has shape $${shapeTex([V, dim])}$. What is the shape of the scores?`,
        answer: { kind: 'shape', value: v },
        traps: [
          { value: [n, dim], why: 'That is the input. Each position gets one score per token, so the last axis becomes $V$.' },
          { value: [V, n], why: 'That puts tokens first. Each position\'s row of $d$ numbers becomes a row of $V$ scores.' },
          { value: [V], why: `That scores only one position. Every one of the ${n} positions gets its own row of scores.` },
        ],
        solution: [`Each position's vector is scored on its own: $d = ${dim}$ numbers become $V = ${big(V)}$ scores.`, `With ${n} positions: $${shapeTex(v)}$.`],
      };
    },
  },
  {
    id: 'tied-params',
    make(rng, d) {
      const V = d < 0.35 ? pick(rng, [10, 20, 50, 100]) : d < 0.7 ? pick(rng, [100, 1000, 2000, 5000]) : pick(rng, [10000, 32000, 50000]);
      const dim = d < 0.35 ? pick(rng, [2, 3, 4, 8]) : d < 0.7 ? pick(rng, [16, 32, 64]) : pick(rng, [128, 256, 512, 768]);
      const one = V * dim;
      const kind = rng.int(3);
      const ask = [
        `How many parameters does tying the unembedding $${WU}$ to $E$ save?`,
        `How many numbers do $E$ and the unembedding $${WU}$ hold together when they are separate matrices?`,
        `How many numbers do $E$ and the unembedding $${WU}$ hold together when they are tied?`,
      ][kind]!;
      const v = kind === 1 ? 2 * one : one;
      return {
        prompt: `A vocabulary has $V = ${big(V)}$ tokens, each embedded in $d = ${dim}$ numbers by the table $E$. ${ask}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: V + dim, why: 'That adds $V$ and $d$. A table of $V$ rows of $d$ numbers holds $V \\times d$.' },
          { value: kind === 1 ? one : 2 * one, why: kind === 1 ? `That is one matrix. Untied, $E$ and $${WU}$ each hold their own $V \\times d$ numbers.` : 'That counts both matrices. Tied, they are one $V \\times d$ table used twice.' },
          { value: dim * dim, why: `That is $d \\times d$. Both matrices have one row per token: $V \\times d$.` },
        ]),
        solution: [
          `$E$ and $${WU}$ both have shape $(V, d) = ${shapeTex([V, dim])}$: $${big(V)} \\times ${dim} = ${big(one)}$ numbers each.`,
          ['Tying uses one table for both jobs, so it saves one whole copy', 'Separate, they hold two copies', 'Tied, they are a single table'][kind]! + `: $${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'tied-score',
    make(rng, d) {
      const words = pick(rng, WORDS);
      const j = rng.int(4);
      const V = d < 0.5 ? 4 : pick(rng, [1000, 5000, 32000, 50000]);
      const dim = pick(rng, [2, 3, 8, 16, 64]);
      const named = d < 0.5 ? `${lit(words[j]!)}, id ${j}` : `id ${j}`;
      return {
        prompt: `The embedding table $E$ has shape $${shapeTex([V, dim])}$, and the unembedding is tied to it. The model's last vector is $\\symh$. What is the score of token ${named}?`,
        answer: {
          kind: 'choice',
          options: [`$\\symh$ dotted with row ${j} of $E$`, `$\\symh$ dotted with column ${j} of $E$`, `Entry ${j} of $\\symh$`, `Row ${j} of $E$`],
          correct: 0,
          why: [
            null,
            `A column of $E$ holds one entry of every token's vector, ${commas(V)} numbers in all: it does not line up with the ${dim} numbers of $\\symh$.`,
            `$\\symh$ has ${dim} numbers, not one per token. Each score is a dot product over all of them.`,
            `That is a whole vector of ${dim} numbers. A score is one number: that row dotted with $\\symh$.`,
          ],
        },
        solution: [
          `Tied, $${WU}$ is $E$, so token ${j}'s row of weights is row ${j} of $E$: its own embedding.`,
          `Its score is that row dotted with $\\symh$: $\\syms_{${j}} = E_{${j}} \\cdot \\symh$, where $E_{${j}}$ is row ${j} of $E$. It is large when $\\symh$ points the way token ${j}'s embedding does.`,
        ],
      };
    },
  },
];
