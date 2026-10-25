import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, pick, vec } from '../../kit';
import { add, dot, prods, vtraps, whys } from '../kit';

const VOCABS = [
  ['Paris', 'Rome', 'the', 'city'],
  ['cat', 'dog', 'mat', 'sat'],
  ['red', 'blue', 'sky', 'is'],
  ['one', 'two', 'three', 'and'],
  ['up', 'down', 'left', 'right'],
  ['tea', 'milk', 'cup', 'of'],
];
const WU = '\\sym{WU}{W_U}';
const tok = (t: string) => `\\texttt{${t}}`;

/** The unembedding rows as a TeX table, one token per row. */
const table = (words: string[], U: number[][]) => `$$\\begin{array}{l|c} \\text{token} & \\text{row of } ${WU} \\\\ \\hline ${words.map((w, j) => `${tok(w)} & ${vec(U[j]!)}`).join(' \\\\ ')} \\end{array}$$`;

const row = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => int(rng, lo, hi));

/** The index of the largest score, or -1 on a tie. */
function top(s: number[]): number {
  const m = Math.max(...s);
  return s.filter((v) => v === m).length === 1 ? s.indexOf(m) : -1;
}

export const generators: Generator[] = [
  {
    id: 'scores',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const V = d < 0.35 ? 3 : 4;
      const words = pick(rng, VOCABS).slice(0, V);
      const U = words.map(() => row(rng, n, -2, 2));
      const x = row(rng, n, d < 0.35 ? 0 : -2, 3);
      const ans = U.map((u) => dot(u, x));
      const blk = int(rng, 0, 5);
      return {
        prompt: `After block ${blk} of a model, a token's residual stream is $\\symx = ${vec(x)}$. What scores does the logit lens give the tokens in the table?\n\n${table(words, U)}`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, [
          { value: U.map((u) => u.reduce((a, b) => a + b, 0)), why: 'That adds up each row without $\\symx$. Each entry of the row multiplies the matching entry of the stream.' },
          { value: U.map((u) => u.reduce((a, b, i) => a + b + x[i]!, 0)), why: 'That adds each row entry to the stream entry instead of multiplying them.' },
        ]),
        solution: [
          `The lens scores the stream as the top does, $${WU}\\symx$: each token's row dotted with $\\symx$.`,
          ...words.map((w, j) => `$${tok(w)}$: $${prods(U[j]!, x)} = ${ans[j]}$.`),
          `So the scores are $${vec(ans)}$, and the lens's top token is $${tok(words[ans.indexOf(Math.max(...ans))]!)}$.`,
        ],
      };
    },
  },
  {
    id: 'top',
    make(rng, d) {
      const two = d >= 0.5;
      const words = pick(rng, VOCABS);
      for (;;) {
        const U = words.map(() => row(rng, 2, -2, 2));
        const x0 = row(rng, 2, -1, 2);
        const w0 = row(rng, 2, -2, 2);
        const w1 = row(rng, 2, -2, 2);
        const x1 = add(x0, w0);
        const x2 = add(x1, w1);
        const s0 = U.map((u) => dot(u, x0));
        const s1 = U.map((u) => dot(u, x1));
        const s2 = U.map((u) => dot(u, x2));
        const k = top(s1);
        const k0 = top(s0);
        const k2 = top(s2);
        if (k < 0 || k0 < 0 || k0 === k || (two && (k2 < 0 || k2 === k || k2 === k0))) continue;
        const why = words.map((_, j) => {
          if (j === k) return null;
          if (j === k0) return `That is the top token for $\\symx_0$ alone, before block 0 writes anything.`;
          if (two && j === k2) return 'That is what the stream predicts after block 1. The lens after block 0 has not seen block 1\'s write.';
          return `Its score is $${s1[j]}$, below $${tok(words[k]!)}$'s $${s1[k]}$.`;
        });
        return {
          prompt: `A token's residual stream starts as $\\symx_0 = ${vec(x0)}$. Block 0 writes $${vec(w0)}$${two ? `, and block 1 writes $${vec(w1)}$` : ''}. Which token does the logit lens put on top after block 0?\n\n${table(words, U)}`,
          answer: { kind: 'choice', options: words.map((w) => `$${tok(w)}$`), correct: k, why },
          solution: [
            `After block 0 the stream is $${vec(x0)} + ${vec(w0)} = ${vec(x1)}$.`,
            `Scores, row by row: ${words.map((w, j) => `$${tok(w)}$: $${s1[j]}$`).join(', ')}.`,
            `The largest is $${tok(words[k]!)}$, so that is the lens's prediction after block 0${two ? `; block 1's write later moves the top to $${tok(words[k2]!)}$` : ''}.`,
          ],
        };
      }
    },
  },
  {
    id: 'meaning',
    make(rng) {
      const L = pick(rng, [12, 24, 32, 48]);
      const b = int(rng, 1, Math.floor(L / 3));
      if (rng.next() < 0.5) {
        const options = [
          'Every block adds to the same stream that the unembedding reads at the top',
          'Each block is trained with an unembedding of its own',
          'The middle blocks already output probabilities over the vocabulary',
          'The lens retrains the model to stop early',
        ];
        const reasons = [
          '',
          'There is one unembedding, at the top. The lens borrows it for a middle layer.',
          'Blocks write vectors into the stream. Only the unembedding turns a vector into a score per token.',
          'Nothing is trained. The lens reuses the model\'s own unembedding as it is.',
        ];
        return {
          prompt: `The logit lens multiplies a ${L}-block model's residual stream after block ${b} by the unembedding $${WU}$. Why does that give a sensible prediction at all?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'The output is the unembedding of the final stream, which is $\\symx_0$ plus every block\'s write.',
            `The stream after block ${b} is the same sum with fewer writes, so the same unembedding can read it: the prediction so far.`,
          ],
        };
      }
      const options = [
        'Later blocks have not yet added their writes to the stream',
        'The lens uses a different unembedding for early blocks',
        'The stream is narrower in early blocks',
        'Early blocks only see the first token of the text',
      ];
      const reasons = [
        '',
        `There is one unembedding, the model's own, used at every block.`,
        'Every write has the full width, so the stream is the same width at every block.',
        'Each block works on every position. What is missing early is the later blocks\' writes.',
      ];
      return {
        prompt: `In a ${L}-block model, the logit lens after block ${b} often puts a different token on top than the model's final prediction. Why?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `The final stream adds the writes of blocks ${b + 1} to ${L - 1}, and each can change which token scores highest.`,
          'Early blocks also write things meant for later blocks, in directions the unembedding reads as noise. The lens shows the prediction so far.',
        ],
      };
    },
  },
];
