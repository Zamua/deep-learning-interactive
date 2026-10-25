import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { lit, mat, ORD, shapeTex, tenth, vtraps } from '../kit';

const VOCABS = [
  ['the', 'cat', 'sat', 'on', 'mat'],
  ['red', 'green', 'blue', 'gold', 'gray'],
  ['h', 'e', 'l', 'o', '!'],
  ['yes', 'no', 'maybe', 'stop', 'go'],
  ['sun', 'moon', 'star', 'sky', 'sea'],
  ['a', 'b', 'c', 'd', 'e'],
];

/** A `V` by `dim` table with no two rows equal: whole numbers, then negatives, then tenths. */
function table(rng: Rng, V: number, dim: number, d: number): number[][] {
  for (;;) {
    const E = Array.from({ length: V }, () => Array.from({ length: dim }, () => (d < 0.35 ? int(rng, 0, 4) : d < 0.7 ? int(rng, -3, 4) : tenth(rng, -2, 2))));
    if (new Set(E.map(String)).size === V) return E;
  }
}

const big = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

export const generators: Generator[] = [
  {
    id: 'lookup',
    make(rng, d) {
      const V = d < 0.35 ? 3 : d < 0.7 ? 4 : 5;
      const dim = d < 0.5 ? 2 : 3;
      const E = table(rng, V, dim, d);
      const k = rng.int(V);
      const words = d >= 0.5 ? pick(rng, VOCABS).slice(0, V) : null;
      const row = E[k]!;
      const ts: { value: number[]; why: string }[] = [];
      if (k > 0) ts.push({ value: E[k - 1]!, why: `That is row ${k - 1}, the ${ORD[k - 1]} row: counting from 1. Ids count from 0, so id ${k} is the ${ORD[k]} row.` });
      if (k < dim) ts.push({ value: E.map((r) => r[k]!), why: `That is column ${k}. A token's vector is a row of $E$: one row per token, ${dim} numbers each.` });
      const ask = words
        ? `The vocabulary is ${words.map((w, i) => `${lit(w)} $= ${i}$`).join(', ')}, and the embedding table is\n\n$$E = ${mat(E)}$$\n\nWhat is the embedding of ${lit(words[k])}?`
        : `An embedding table has one row per token id, counting from 0 as Python does:\n\n$$E = ${mat(E)}$$\n\nWhat vector does token id ${k} get?`;
      return {
        prompt: ask,
        answer: { kind: 'vector', value: row },
        traps: vtraps(row, ts),
        solution: [
          ...(words ? [`${lit(words[k])} has id ${k}.`] : []),
          `A lookup takes one row of $E$ per token, counting from 0: id ${k} is the ${ORD[k]} row.`,
          `Row ${k} is $${vec(row)}$.`,
        ],
      };
    },
  },
  {
    id: 'params',
    make(rng, d) {
      const [V, dim] = d < 0.35
        ? [int(rng, 4, 12), int(rng, 2, 5)]
        : d < 0.7
          ? [pick(rng, [26, 65, 100, 256, 1000]), pick(rng, [8, 16, 32, 64])]
          : [pick(rng, [10000, 30000, 32000, 50000]), pick(rng, [128, 256, 300, 512, 768])];
      const n = V * dim;
      if (d >= 0.7 && rng.int(2) === 0) {
        return {
          prompt: `An embedding table for a vocabulary of $V = ${big(V)}$ tokens holds $${big(n)}$ numbers. How many numbers make up one token's vector, $d$?`,
          answer: { kind: 'number', value: dim },
          traps: [{ value: n - V, why: 'That subtracts. The table is $V$ rows of $d$ numbers, so its size is $V \\times d$: divide by $V$.' }],
          solution: [`The table has shape $(V, d)$, so it holds $V \\times d$ numbers.`, `$d = ${big(n)} / ${big(V)} = ${dim}$.`],
        };
      }
      return {
        prompt: `A vocabulary has $V = ${big(V)}$ tokens, and each gets a vector of $d = ${dim}$ numbers. How many numbers does the embedding table $E$ hold?`,
        answer: { kind: 'number', value: n },
        traps: [
          { value: V + dim, why: 'That adds $V$ and $d$. The table has $V$ rows of $d$ numbers each: multiply.' },
          { value: V, why: `That is one number per token. Each token has a whole row of $d = ${dim}$ numbers.` },
        ].filter((t) => t.value !== n),
        solution: [`$E$ has one row per token and one column per dimension: shape $(V, d) = ${shapeTex([V, dim])}$.`, `$${big(V)} \\times ${dim} = ${big(n)}$ numbers.`],
      };
    },
  },
  {
    id: 'batch-shape',
    make(rng, d) {
      const V = pick(rng, [50, 65, 100, 1000, 5000]);
      let dim = pick(rng, [4, 8, 16, 32, 64, 128]);
      const n = int(rng, 3, 20);
      const B = pick(rng, [2, 4, 8, 16, 32]);
      if (dim === n || dim === B) dim *= 2;
      const single = d < 0.35;
      const ids = single ? [n] : [B, n];
      const out = [...ids, dim];
      const given = single
        ? `A sequence of ${n} token ids, \`ids\`, has shape $${shapeTex(ids)}$.`
        : `An array of token ids, \`ids\`, has shape $${shapeTex(ids)}$: ${B} sequences of ${n} tokens each.`;
      return {
        prompt: `${given} The embedding table $E$ has shape $(V, d) = ${shapeTex([V, dim])}$. What is the shape of \`E[ids]\`?`,
        answer: { kind: 'shape', value: out },
        traps: [
          { value: ids, why: 'That is the shape of the ids. Each id is replaced by a whole row of $d$ numbers, which adds an axis.' },
          { value: [...ids, V], why: `${V} is $V$, the number of rows of $E$. A lookup returns one row, which has $d = ${dim}$ numbers.` },
          { value: [V, dim], why: 'That is the shape of $E$ itself. The lookup keeps the shape of the ids and adds $d$.' },
          ...(single ? [] : [{ value: [B, dim], why: `That loses the sequence axis. Every one of the ${n} ids in a sequence gets its own vector.` }]),
        ],
        solution: [`Every id in \`ids\` is replaced by its row of $E$, which has $d = ${dim}$ numbers.`, `So the ids' shape $${shapeTex(ids)}$ gains a last axis of ${dim}: $${shapeTex(out)}$.`],
      };
    },
  },
  {
    id: 'onehot',
    make(rng, d) {
      const V = d < 0.5 ? int(rng, 3, 5) : int(rng, 4, 8);
      const dim = int(rng, 2, 4) + (d < 0.5 ? 0 : 1);
      const k = rng.int(V);
      const oh = Array.from({ length: V }, (_, i) => (i === k ? 1 : 0));
      return {
        prompt: `$E$ has shape $${shapeTex([V, dim])}$: one row per token. Token id ${k}, written as a one-hot vector, is $${vec(oh)}$. Why does \`onehot @ E\` equal row ${k} of $E$?`,
        answer: {
          kind: 'choice',
          options: [
            `Each row of $E$ is scaled by its one-hot entry: row ${k} by 1, all the others by 0`,
            `The 1 in place ${k} picks out column ${k} of $E$`,
            'The product adds up all the rows of $E$, which is what a lookup returns',
            '$E$ holds one-hot vectors as its rows, so the product copies one',
          ],
          correct: 0,
          why: [
            null,
            `The one-hot has ${V} entries, one per row of $E$, so it weighs rows, not columns. A column has ${V} numbers; the result has ${dim}.`,
            'It is a sum of the rows weighted by the one-hot entries, and all of those are 0 but one.',
            `The rows of $E$ hold any numbers, ${dim} per token, nothing like one-hot vectors. The product picks row ${k} whatever $E$ holds.`,
          ],
        },
        solution: [
          '`onehot @ E` adds up the rows of $E$, each weighted by the matching one-hot entry.',
          `Every weight is 0 except entry ${k}, which is 1, so the sum is just row ${k}.`,
          `That is why \`E[${k}]\` gives the same vector: the lookup skips the multiplications by zero.`,
        ],
      };
    },
  },
];
