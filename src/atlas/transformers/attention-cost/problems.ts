import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, H, Q, T, traps, WK, WQ, WV } from '../kit';

export const generators: Generator[] = [
  {
    id: 'scores',
    make(rng, d) {
      const t = d < 0.35 ? int(rng, 3, 12) : d < 0.7 ? pick(rng, [50, 100, 200, 500, 1000]) : pick(rng, [1000, 2000, 4000, 8000]);
      const h = d >= 0.7 ? pick(rng, [8, 12, 16, 32]) : 1;
      const v = h * t * t;
      return {
        prompt: h > 1
          ? `A self-attention layer with $${H} = ${h}$ heads reads $${T} = ${big(t)}$ tokens. How many attention scores does it compute, over all its heads?`
          : `Self-attention reads $${T} = ${big(t)}$ tokens. How many scores does one head compute?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: h * t, why: `That is one score per token. Each token scores every token, itself included: $${T}$ scores each.` },
          { value: h * 2 * t, why: `That doubles $${T}$. The scores form a $${T} \\times ${T}$ matrix: $${T}^2$.` },
          ...(h > 1 ? [{ value: t * t, why: `That is one head. Each of the ${h} heads computes its own $${T} \\times ${T}$ scores.` }] : []),
        ]),
        solution: [
          `Every query meets every key: a $${big(t)} \\times ${big(t)}$ matrix, $${big(t * t)}$ scores.`,
          ...(h > 1 ? [`${h} heads each compute their own: $${h} \\times ${big(t * t)} = ${big(v)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'grow',
    make(rng, d) {
      const k = d < 0.35 ? pick(rng, [2, 3]) : pick(rng, [2, 3, 4, 8, 10]);
      const t = pick(rng, d < 0.35 ? [4, 5, 10, 20, 100] : [512, 1000, 1024, 2048, 4000]);
      const v = k * k;
      return {
        prompt: `A model's attention reads $${T} = ${big(t)}$ tokens. The context is made ${k} times longer, $${T} = ${big(k * t)}$. How many times more attention scores are there?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: k, why: `That is how much $${T}$ grows. The scores grow with $${T}^2$: $${k}^2 = ${v}$.` },
          { value: 2 * k, why: `The scores grow with $${T}$ times $${T}$, not twice $${T}$: $${k}^2 = ${v}$.` },
        ]),
        solution: [`The scores form a $${T} \\times ${T}$ matrix, $${T}^2$ of them.`, `$${T}$ grows ${k} times, so $${T}^2$ grows $${k}^2 = ${v}$ times: from $${big(t * t)}$ to $${big(k * k * t * t)}$.`],
      };
    },
  },
  {
    id: 'bytes',
    make(rng, d) {
      if (d < 0.5) {
        const t = d < 0.25 ? pick(rng, [10, 20, 30, 50, 100]) : pick(rng, [200, 300, 500, 1000]);
        const v = 2 * t * t;
        return {
          prompt: `One head of self-attention reads $${T} = ${big(t)}$ tokens and stores its score matrix at 2 bytes per score. How many bytes does that matrix take?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: t * t, why: 'That is the number of scores. Each takes 2 bytes.' },
            { value: 2 * t, why: `That is one row's worth per token. The matrix is $${T} \\times ${T}$: $${big(t * t)}$ scores.` },
            { value: 4 * t * t, why: 'That uses 4 bytes per score. Here each takes 2.' },
          ]),
          solution: [`The score matrix is $${big(t)} \\times ${big(t)} = ${big(t * t)}$ scores.`, `At 2 bytes each: $${big(v)}$ bytes.`],
        };
      }
      const t = pick(rng, [1000, 2000, 4000, 8000, 10000]);
      const h = d < 0.75 ? 1 : pick(rng, [4, 8, 16]);
      const mb = (2 * h * t * t) / 1e6;
      return {
        prompt: `Self-attention reads $${T} = ${big(t)}$ tokens${h > 1 ? ` with $${H} = ${h}$ heads, each storing its own score matrix` : ' and stores one head\'s score matrix'} at 2 bytes per score. How many megabytes is that, at a million bytes per megabyte?`,
        answer: { kind: 'number', value: mb },
        traps: traps(mb, [
          { value: mb / 2, why: 'That counts the scores in millions. Each takes 2 bytes.' },
          { value: (2 * h * t) / 1e6, why: `That grows with $${T}$, not $${T}^2$: the matrix holds $${big(t)} \\times ${big(t)}$ scores.` },
          ...(h > 1 ? [{ value: (2 * t * t) / 1e6, why: `That is one head. Each of the ${h} heads has its own matrix.` }] : []),
        ]),
        solution: [
          `One score matrix: $${big(t)}^2 = ${big(t * t)}$ scores, at 2 bytes each: $${big(2 * t * t)}$ bytes, $${bigText((2 * t * t) / 1e6)}$ MB.`,
          ...(h > 1 ? [`${h} heads: $${h} \\times ${bigText((2 * t * t) / 1e6)} = ${bigText(mb)}$ MB.`] : []),
        ],
      };
    },
  },
  {
    id: 'compare',
    make(rng) {
      const k = pick(rng, [2, 3, 4, 10]);
      const t = pick(rng, [512, 1000, 2000, 4096]);
      const what = pick(rng, ['scores', 'queries', 'weights'] as const);
      const right = { scores: k * k, queries: k, weights: 1 }[what];
      const label = (x: number) => (x === 1 ? 'It stays the same' : `It grows ${x} times`);
      const facts = [k * k, k, 1, k * k * k];
      const options = facts.map(label);
      const thing = {
        scores: `the number of attention scores in one head`,
        queries: `the size of the query matrix $${Q}$`,
        weights: `the number of weights in $${WQ}$, $${WK}$ and $${WV}$`,
      }[what];
      const why = facts.map((x) => {
        if (x === right) return null;
        if (x === k * k * k) return `Nothing in attention grows faster than $${T}^2$.`;
        if (what === 'scores') return `The scores pair every token with every token: $${T}^2$, so ${k} times the tokens is $${k * k}$ times the scores.`;
        if (what === 'queries') return `$${Q}$ has one row per token, so it grows with $${T}$: ${k} times. Only the pairwise scores grow with $${T}^2$.`;
        return 'The weight matrices are shared by every token: their shapes depend on the width, never on the number of tokens.';
      });
      return {
        prompt: `A model's attention reads $${T} = ${big(t)}$ tokens. The context is made ${k} times longer, $${T} = ${big(k * t)}$. What happens to ${thing}?`,
        answer: { kind: 'choice', options, correct: facts.indexOf(right), why },
        solution: [
          `Scores: one per pair of tokens, $${T}^2$, so $${k * k}$ times. Queries, keys and values: one row per token, so ${k} times.`,
          `The weights do not depend on $${T}$ at all. So ${thing} ${right === 1 ? 'stays the same' : `grows ${right} times`}.`,
        ],
      };
    },
  },
];
