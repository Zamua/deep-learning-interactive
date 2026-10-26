import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, commas, shapeTex, traps } from '../kit';

export const generators: Generator[] = [
  {
    id: 'work',
    make(rng, d) {
      const T = d < 0.35 ? int(rng, 3, 8) : d < 0.7 ? pick(rng, [10, 12, 20, 50, 100]) : pick(rng, [200, 500, 1000, 2000]);
      const cached = rng.int(3) === 0;
      const tri = (T * (T + 1)) / 2;
      const v = cached ? T : tri;
      const setup = `A decoder-only model generates one token per step for $T = ${big(T)}$ steps. At step $t$, counting from 1, the sequence has $t$ tokens.`;
      return {
        prompt: cached
          ? `${setup} With a KV cache, how many key vectors does one block compute over all ${commas(T)} steps?`
          : `${setup} Without a KV cache, how many key vectors does one block compute over all ${commas(T)} steps?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: cached ? tri : T, why: cached ? 'That is the count without a cache. With one, each step computes a key only for its newest token.' : 'That is the count with a cache. Without one, step $t$ recomputes keys for all $t$ tokens.' },
          { value: T * T, why: `That is $T^2$: as if every step had all ${commas(T)} tokens. Step $t$ has only $t$.` },
          ...(cached ? [] : [{ value: (T * (T - 1)) / 2, why: `That stops one step early: it adds $1 + 2 + \\dots + ${big(T - 1)}$. The last step has all ${commas(T)} tokens.` }]),
        ]),
        solution: cached
          ? ['The keys of earlier tokens are kept in the cache, so each step computes only the newest token\'s key.', `One key per step: ${commas(T)} in all, one per token.`]
          : [
              `Without a cache, step $t$ computes keys for all $t$ tokens: $1 + 2 + \\dots + ${big(T)}$.`,
              `Pair the first term with the last, the second with the second-last, and so on: each pair adds to $1 + ${big(T)} = ${big(T + 1)}$.`,
              T % 2 === 0
                ? `There are $${big(T)} / 2 = ${big(T / 2)}$ pairs: $${big(T / 2)} \\times ${big(T + 1)} = ${big(tri)}$.`
                : `The middle term, $${(T + 1) / 2}$, is half a pair, so there are $${T} / 2$ pairs: $T(T + 1) / 2 = ${T} \\times ${T + 1} / 2 = ${tri}$.`,
            ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const T = d < 0.5 ? pick(rng, [3, 5, 6, 7, 9, 10, 12, 15, 20]) : pick(rng, [100, 256, 500, 1000, 2048]);
      const dim = d < 0.5 ? pick(rng, [8, 16, 32, 64]) : pick(rng, [512, 768, 1024, 4096]);
      const kind = d < 0.35 ? 0 : rng.int(3);
      const L = pick(rng, [2, 4, 6, 12, 24, 32]);
      const what = rng.int(2) === 0 ? 'key' : 'value';
      if (kind === 0) {
        const v = [T, dim];
        return {
          prompt: `A model with vectors of $d = ${dim}$ numbers is generating with a KV cache. After ${commas(T)} tokens, what is the shape of one block's cache of ${what}s?`,
          answer: { kind: 'shape', value: v },
          traps: [
            { value: [T, T], why: 'That is the shape of the attention scores between every pair of tokens. The cache keeps one vector per token.' },
            { value: [dim, T], why: 'That is the transpose. The cache grows by one row per token.' },
            { value: [dim], why: 'That is one token. The cache keeps a vector for every token so far.' },
          ],
          solution: [`Each token has one ${what} vector of $d = ${dim}$ numbers per block.`, `After ${commas(T)} tokens the block stores ${commas(T)} of them, one row per token: $${shapeTex(v)}$.`],
        };
      }
      if (kind === 1) {
        const v = [T + 1, dim];
        return {
          prompt: `One block's cache of ${what}s has shape $${shapeTex([T, dim])}$. The model generates one more token. What is the cache's shape now?`,
          answer: { kind: 'shape', value: v },
          traps: [
            { value: [T, dim], why: 'The new token\'s own key and value are added to the cache, so it grows by one row.' },
            { value: [T + 1, dim + 1], why: `The width is the vector size, $d = ${dim}$; only the number of rows grows.` },
            { value: [1, dim], why: 'That is only the new row. The earlier rows stay in the cache.' },
          ],
          solution: ['Each step appends the new token\'s vector as a new row; nothing earlier is recomputed or removed.', `So $${shapeTex([T, dim])}$ becomes $${shapeTex(v)}$.`],
        };
      }
      const v = [L, T, dim];
      return {
        prompt: `A model has ${L} transformer blocks and vectors of $d = ${dim}$ numbers. After ${commas(T)} tokens, its ${what} caches for every block are stacked into one array, block first, then token. What is its shape?`,
        answer: { kind: 'shape', value: v },
        traps: [
          { value: [T, dim], why: `That is one block. Every one of the ${L} blocks has its own attention, with its own ${what}s.` },
          { value: [L, T, T], why: 'That is the shape of every block\'s attention scores. The cache keeps one vector per token.' },
          { value: [L, dim], why: 'That keeps one vector per block. Every earlier token\'s vector stays.' },
        ],
        solution: [`Each block stores one ${what} vector of ${dim} numbers per token: $${shapeTex([T, dim])}$.`, `With ${L} blocks stacked: $${shapeTex(v)}$.`],
      };
    },
  },
  {
    id: 'numbers',
    make(rng, d) {
      const L = d < 0.5 ? pick(rng, [1, 2, 4]) : pick(rng, [4, 8, 10, 12]);
      const T = d < 0.5 ? pick(rng, [5, 10, 20, 100]) : pick(rng, [100, 1000, 2000]);
      const dim = d < 0.5 ? pick(rng, [4, 8, 16, 32]) : pick(rng, [64, 128, 256, 512]);
      const v = 2 * L * T * dim;
      return {
        prompt: `A model has ${L} transformer block${L > 1 ? 's' : ''} with vectors of $d = ${dim}$ numbers. After ${commas(T)} tokens, how many numbers does its KV cache hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: L * T * dim, why: 'That counts only the keys. Every token also has a value vector of the same size.' },
          { value: 2 * T * dim, why: `That is one block. Each of the ${L} blocks keeps its own keys and values.` },
          { value: 2 * L * T * T, why: 'That counts scores between every pair of tokens. The cache keeps one key and one value per token.' },
        ]),
        solution: [`Per block, every token has one key and one value of $d = ${dim}$ numbers: $2 \\times ${dim} = ${2 * dim}$.`, `Over ${commas(T)} tokens and ${L} block${L > 1 ? 's' : ''}: $2 \\times ${L} \\times ${big(T)} \\times ${dim} = ${big(v)}$.`],
      };
    },
  },
  {
    id: 'stored',
    make(rng) {
      const T = pick(rng, [10, 50, 100, 500, 1000, 4000]);
      const L = pick(rng, [6, 12, 24, 32]);
      const kind = rng.int(2);
      if (kind === 0) {
        return {
          prompt: `A model with ${L} blocks has generated ${commas(T)} tokens with a KV cache. What does the cache hold?`,
          answer: {
            kind: 'choice',
            options: ['Every token\'s keys and values, in every block', 'Every token\'s queries, in every block', 'The attention weights between every pair of tokens', 'Every earlier step\'s next-token probabilities'],
            correct: 0,
            why: [
              null,
              'A query is used once, by its own token, at its own step. Later tokens never need an earlier query.',
              'The next step needs a new row of weights for the new query, and computing it needs the keys and values, not old weights.',
              'Those predictions are already used up: each picked one token. The next step needs the earlier tokens\' keys and values.',
            ],
          },
          solution: ['The new token\'s query is scored against every earlier key, and the weights mix every earlier value.', 'So keys and values are what later steps need again: the cache keeps them, for every token and every block.'],
        };
      }
      return {
        prompt: `A model with ${L} blocks has ${commas(T)} tokens in its KV cache and generates one more. Why can the earlier tokens' keys and values be reused without recomputing them?`,
        answer: {
          kind: 'choice',
          options: ['The causal mask: earlier tokens never attend to the new one, so nothing about them changes', 'Keys and values come from the token ids alone, not from attention', 'The new token attends only to itself, so the old keys are not needed', 'Every token in the sequence shares the same key and value'],
          correct: 0,
          why: [
            null,
            'In every block but the first, keys and values come from vectors that attention has already mixed. They stay fixed only because that mixing looks backward.',
            'The new token attends to every earlier token: that is why their keys and values are needed at all.',
            'Each token has its own key and value, computed from its own vector.',
          ],
        },
        solution: ['With the causal mask, a token\'s vectors in every block depend only on itself and earlier tokens.', 'Adding a token later changes none of them, so their keys and values are the same as before: compute once, store, reuse.'],
      };
    },
  },
];
