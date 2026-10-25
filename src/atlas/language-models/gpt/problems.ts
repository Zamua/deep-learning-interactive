import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, commas, lit, lits, shapeTex, traps } from '../kit';

const WU = '\\sym{WU}{W_U}';
const SENTENCES = [
  ['the', 'cat', 'sat', 'on', 'a', 'mat'],
  ['we', 'like', 'to', 'read', 'old', 'books'],
  ['birds', 'fly', 'south', 'every', 'cold', 'winter'],
  ['she', 'wrote', 'code', 'all', 'night', 'long'],
  ['rain', 'fell', 'on', 'the', 'quiet', 'town'],
  ['my', 'dog', 'loves', 'long', 'walks', 'outside'],
];

/** Sizes that never coincide, so every shape names its axes unambiguously. */
function sizes(rng: Parameters<Generator['make']>[0], d: number): { T: number; dim: number; V: number; N: number } {
  for (;;) {
    const T = d < 0.5 ? int(rng, 4, 12) : pick(rng, [128, 256, 512, 1024, 2048]);
    const dim = d < 0.5 ? pick(rng, [8, 16, 32, 64]) : pick(rng, [384, 512, 768, 1024]);
    const V = d < 0.5 ? pick(rng, [50, 100, 500, 1000]) : pick(rng, [32000, 50000, 50257]);
    const N = pick(rng, [2, 4, 6, 12]);
    if (new Set([T, dim, V]).size === 3) return { T, dim, V, N };
  }
}

export const generators: Generator[] = [
  {
    id: 'shapes',
    make(rng, d) {
      const { T, dim, V, N } = sizes(rng, d);
      const stages: { what: string; v: number[]; ts: { value: number[]; why: string }[] }[] = [
        {
          what: 'the token ids',
          v: [T],
          ts: [{ value: [T, dim], why: 'That is after the embedding lookup. The ids are one whole number per token.' }],
        },
        {
          what: 'the embeddings `E[ids]`',
          v: [T, dim],
          ts: [
            { value: [V, dim], why: 'That is the whole table $E$. The lookup takes one row per token in the sequence.' },
            { value: [T], why: 'That is the ids. Each id is replaced by its row of $d$ numbers.' },
          ],
        },
        {
          what: 'the embeddings after the position vectors are added',
          v: [T, dim],
          ts: [
            { value: [T, 2 * dim], why: 'The position vectors are added, entry by entry, not appended: the width stays $d$.' },
            { value: [T, V], why: 'That is after the unembedding. Adding positions keeps one vector of $d$ numbers per token.' },
          ],
        },
        {
          what: `the output of the last of the ${N} transformer blocks`,
          v: [T, dim],
          ts: [
            { value: [T, V], why: `That is after the unembedding. Every block maps $(T, d)$ to $(T, d)$, so its output can feed the next one.` },
            { value: [dim], why: 'That keeps only one position. A causal model keeps a vector for every position.' },
          ],
        },
        {
          what: `the scores after the unembedding $${WU}$`,
          v: [T, V],
          ts: [
            { value: [T, dim], why: `That is before the unembedding. $${WU}$ turns each position's $d$ numbers into $V$ scores.` },
            { value: [V], why: 'That scores only one position. Every position gets its own row of scores.' },
            { value: [V, dim], why: `That is the shape of $${WU}$ itself, not of its scores.` },
          ],
        },
        {
          what: 'the next-token probabilities after the softmax',
          v: [T, V],
          ts: [
            { value: [V], why: 'That is one prediction. A causal model predicts at every position at once: one row per position.' },
            { value: [T, dim], why: 'Softmax works on the scores, which already have one entry per vocabulary token.' },
          ],
        },
      ];
      const st = stages[d < 0.35 ? int(rng, 1, 4) : rng.int(stages.length)]!;
      return {
        prompt: `A decoder-only model has $d = ${big(dim)}$, a vocabulary of $V = ${big(V)}$ tokens and ${N} transformer blocks. It reads a sequence of $T = ${big(T)}$ tokens. What is the shape of ${st.what}?`,
        answer: { kind: 'shape', value: st.v },
        traps: st.ts.filter((t) => t.value.join() !== st.v.join()),
        solution: [
          `The ids are $${shapeTex([T])}$; the lookup and the position vectors make $${shapeTex([T, dim])}$.`,
          `Every block keeps $${shapeTex([T, dim])}$; the unembedding makes $${shapeTex([T, V])}$, and softmax keeps that shape.`,
          `That makes ${st.what} $${shapeTex(st.v)}$.`,
        ],
      };
    },
  },
  {
    id: 'predictions',
    make(rng, d) {
      const { T, V } = sizes(rng, d);
      const kind = d < 0.35 ? 0 : rng.int(3);
      if (kind === 0) {
        return {
          prompt: `A decoder-only model reads a sequence of $T = ${big(T)}$ tokens in one forward pass. How many next-token predictions, rows of probabilities over the vocabulary, come out?`,
          answer: { kind: 'number', value: T },
          traps: traps(T, [
            { value: 1, why: 'A causal model predicts at every position at once, not only at the end.' },
            { value: T - 1, why: 'The last position predicts too: its row is the guess for the token after the sequence.' },
            { value: V, why: `That is how many probabilities one prediction holds, one per vocabulary token.` },
          ]),
          solution: [`Every position's output is a prediction for the token after it, so there is one per position.`, `$T = ${big(T)}$ positions make ${commas(T)} predictions, all from one pass.`],
        };
      }
      if (kind === 1) {
        const v = T * V;
        return {
          prompt: `A decoder-only model with a vocabulary of $V = ${big(V)}$ tokens reads $T = ${big(T)}$ tokens. How many probabilities does its output hold in all?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: V, why: 'That is one row. There is a row of probabilities for every position.' },
            { value: T, why: 'That counts the rows. Each row holds a probability for every vocabulary token.' },
            { value: (T - 1) * V, why: 'The last position predicts too, so there are $T$ rows.' },
          ]),
          solution: [`The output has shape $(T, V) = ${shapeTex([T, V])}$: one row per position, one entry per token.`, `$${big(T)} \\times ${big(V)} = ${big(v)}$ probabilities.`],
        };
      }
      const B = pick(rng, [2, 4, 8, 16, 32]);
      const v = B * T;
      return {
        prompt: `A batch holds $${B}$ sequences of $T = ${big(T)}$ tokens each. One forward pass of a decoder-only model scores them all. How many next-token predictions does it make?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: T, why: `That is one sequence. Each of the ${B} sequences gets a prediction at every position.` },
          { value: B, why: 'That is one prediction per sequence. A causal model predicts at every position.' },
          { value: B * (T - 1), why: 'The last position of each sequence predicts too.' },
        ]),
        solution: [`Each sequence gives one prediction per position: ${commas(T)}.`, `$${B} \\times ${big(T)} = ${big(v)}$ predictions in one pass.`],
      };
    },
  },
  {
    id: 'next-of',
    make(rng, d) {
      const w = pick(rng, SENTENCES);
      const text = `The model reads ${lits(w)}, at positions 0 to ${w.length - 1}.`;
      if (d < 0.5 || rng.int(2) === 0) {
        const i = int(rng, 1, w.length - 3);
        return {
          prompt: `${text} The output at position ${i}, ${lit(w[i]!)}, is a row of probabilities. Which token is it trained to predict?`,
          answer: {
            kind: 'choice',
            options: [lit(w[i + 1]!), lit(w[i]!), lit(w[i - 1]!), lit(w[w.length - 1]!)],
            correct: 0,
            why: [
              null,
              `That is the token at position ${i} itself, already in the input. Its output predicts the token after it.`,
              'That token comes before it and was already read. Each output looks ahead by one.',
              'Each position predicts only the very next token, not the end of the text.',
            ],
          },
          solution: [`Every position's output predicts the token one step later.`, `Position ${i} reads up to ${lit(w[i]!)}; its target is position ${i + 1}, ${lit(w[i + 1]!)}.`],
        };
      }
      const j = int(rng, 2, w.length - 1);
      return {
        prompt: `${text} Which position's output is trained to predict ${lit(w[j]!)}, at position ${j}?`,
        answer: {
          kind: 'choice',
          options: [`Position ${j - 1}, ${lit(w[j - 1]!)}`, `Position ${j}, ${lit(w[j]!)}`, `Position ${j - 2}, ${lit(w[j - 2]!)}`, `Every position from 0 to ${j - 1}`],
          correct: 0,
          why: [
            null,
            `That position has ${lit(w[j]!)} as its input already; its output predicts the token after it.`,
            `Position ${j - 2} predicts the token right after it, ${lit(w[j - 1]!)}.`,
            `Those positions can attend to earlier tokens, but each one is trained to predict only its own next token.`,
          ],
        },
        solution: [`The output at position $t$ predicts the token at position $t + 1$.`, `So ${lit(w[j]!)}, at position ${j}, is predicted by position ${j - 1}, which has read up to ${lit(w[j - 1]!)}.`],
      };
    },
  },
  {
    id: 'pipeline',
    make(rng, d) {
      const { T, dim, V, N } = sizes(rng, d);
      const items = [
        `Look up each token id's row of $E$: shape $${shapeTex([T, dim])}$`,
        `Add each position's vector: still $${shapeTex([T, dim])}$`,
        `Run ${N} causal transformer blocks: still $${shapeTex([T, dim])}$`,
        `Multiply by $${WU}$: ${commas(V)} scores per position, $${shapeTex([T, V])}$`,
        `Softmax each row: next-token probabilities, $${shapeTex([T, V])}$`,
      ];
      return {
        prompt: `A decoder-only model with $d = ${big(dim)}$ and a vocabulary of $V = ${big(V)}$ reads $T = ${big(T)}$ token ids. Put its steps in order.`,
        answer: { kind: 'order', items },
        solution: [
          'First the ids become vectors: one row of $E$ per token.',
          'Attention ignores order, so each position\'s vector is added before any block runs.',
          `The ${N} blocks mix information along the sequence, each position seeing only itself and the past, and keep the shape $(T, d)$.`,
          `Last, $${WU}$ scores every vocabulary token at every position, and softmax turns each row into probabilities.`,
        ],
      };
    },
  },
];
