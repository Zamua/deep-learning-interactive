import type { Generator } from '../../../mastery/domain/types';
import { argmax, clean, E2, int, ints, num, pick, traps, vec, vtraps } from '../../kit';
import { onehot } from '../../optimization/kit';
import { lit, uniqueTop, useExp } from '../kit';

const VOCABS = [
  ['the', 'a', 'cat', 'dog', 'sat'],
  ['yes', 'no', 'maybe', 'never', 'ok'],
  ['red', 'blue', 'green', 'gold', 'gray'],
  ['e', 'a', 't', 'o', 'n'],
  ['up', 'down', 'left', 'right', 'stop'],
];

const softmax = (z: readonly number[]): number[] => {
  const e = z.map(E2);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const ids = (vocab: readonly string[]): string => vocab.map((c, i) => `${lit(c)} $= ${i}$`).join(', ');

export const generators: Generator[] = [
  {
    id: 'temp-prob',
    make(rng, d) {
      const n = d < 0.7 ? 3 : 4;
      const T = d < 0.35 ? pick(rng, [2, 0.5]) : pick(rng, [2, 0.5, 3]);
      const z = T === 0.5 ? ints(rng, n, d < 0.35 ? 0 : -1, 2).map((v) => 2 * v) : ints(rng, n, d < 0.35 ? 0 : -1, 2);
      const s = z.map((v) => clean(v * T));
      const k = rng.int(n);
      const e = z.map(E2);
      const total = e.reduce((a, b) => a + b, 0);
      const v = e[k]! / total;
      return {
        prompt: `A model's scores for the next token are $\\syms = ${vec(s)}$. Sampling at temperature $\\symT = ${num(T)}$, what is the probability of token ${k}, counting from 0? Round to two decimals.\n\nUse ${useExp(z)}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: softmax(s)[k]!, why: `That is the probability at $\\symT = 1$: softmax of the raw scores. Divide them by $\\symT = ${num(T)}$ first.` },
          { value: softmax(s.map((x) => x * T))[k]!, why: `That multiplies the scores by $\\symT$. Temperature divides them.` },
          { value: 1 / n, why: `That is one share in ${n}: what softmax gives only when every score is equal.` },
        ]).filter((t) => Math.abs(t.value - v) >= 0.01),
        solution: [
          'Temperature divides the scores before the softmax: $\\symp = \\mathrm{softmax}(\\syms / \\symT)$.',
          `Divide by the temperature: $\\syms / ${num(T)} = ${vec(z)}$.`,
          `Exponentiate: ${z.map((x) => `$e^{${x}} \\approx ${num(E2(x), 2)}$`).join(', ')}; they add up to $${num(total, 2)}$.`,
          `Token ${k}: $${num(e[k]!, 2)} / ${num(total, 2)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'greedy',
    make(rng, d) {
      const n = d < 0.5 ? 3 : int(rng, 4, 5);
      const vocab = pick(rng, VOCABS).slice(0, n);
      const s = uniqueTop(rng, n, d < 0.35 ? 0 : -2, 4);
      const T = pick(rng, [0.5, 0.7, 1.5, 2, 5]);
      const k = argmax(s);
      const low = s.indexOf(Math.min(...s));
      const ts = [{ value: k + 1, why: `That counts from 1. Ids count from 0, so the top score, ${lit(vocab[k])}, is id ${k}.` }];
      if (s.filter((x) => x === s[low]).length === 1) ts.push({ value: low, why: `That is the lowest score. Greedy decoding takes the most likely token.` });
      return {
        prompt: `A model's scores over the vocabulary ${ids(vocab)} are $\\syms = ${vec(s)}$. At temperature $\\symT = ${num(T)}$, which token id does greedy decoding pick?`,
        answer: { kind: 'number', value: k },
        traps: traps(k, ts),
        solution: [
          `Dividing every score by the same positive $\\symT$ keeps them in order: the largest score stays the largest.`,
          `Greedy decoding takes the most likely token, the one with the top score: $\\syms_{${k}} = ${s[k]}$, ${lit(vocab[k])}, id ${k}.`,
          'Temperature changes how often sampling picks each token, never which one is on top.',
        ],
      };
    },
  },
  {
    id: 'temp-effect',
    make(rng, d) {
      const s = uniqueTop(rng, d < 0.5 ? 3 : 4, -1, 4);
      const T = pick(rng, [0.1, 0.2, 0.3, 0.5, 2, 3, 5, 10]);
      const sharp = T < 1;
      return {
        prompt: `A model's next-token scores are $\\syms = ${vec(s)}$. Sampling at temperature $\\symT = ${num(T)}$ instead of $\\symT = 1$, what happens to the probabilities?`,
        answer: {
          kind: 'choice',
          options: [
            'They get sharper: the top token takes more of the probability',
            'They get flatter: closer to uniform, so unlikely tokens come up more',
            'They reorder: a different token gets the largest probability',
            'Nothing changes: softmax only sees the gaps between the scores',
          ],
          correct: sharp ? 0 : 1,
          why: [
            sharp ? null : `Dividing by $\\symT = ${num(T)} > 1$ shrinks every gap between the scores, and smaller gaps make softmax flatter.`,
            sharp ? `Dividing by $\\symT = ${num(T)} < 1$ stretches every gap between the scores, and bigger gaps make softmax sharper.` : null,
            'Dividing every score by the same positive $\\symT$ keeps them in order, so the top token stays on top.',
            'Dividing changes the gaps: it scales them by $1/\\symT$. Only adding the same amount to every score leaves softmax unchanged.',
          ],
        },
        solution: [
          `Dividing by $\\symT = ${num(T)}$ multiplies every gap between scores by $${num(clean(1 / T))}$.`,
          sharp ? 'Bigger gaps make softmax sharper: the top token takes more of the probability, and the text gets safer and more repetitive.' : 'Smaller gaps make softmax flatter, closer to uniform: unlikely tokens come up more, and the text gets more varied and more error-prone.',
          'The order never changes, so the most likely token stays the same.',
        ],
      };
    },
  },
  {
    id: 'limit',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const s = ints(rng, n, -2, 4, true);
      const toZero = d < 0.35 || rng.int(2) === 0;
      const k = argmax(s);
      const hot = onehot(n, k);
      const flat = s.map(() => 1 / n);
      const v = toZero ? hot : flat;
      return {
        prompt: `A model's next-token scores are $\\syms = ${vec(s)}$. What do its sampling probabilities approach as the temperature ${toZero ? '$\\symT \\to 0$' : '$\\symT$ grows without bound'}? Round to two decimals.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(v, [
          { value: toZero ? flat : hot, why: toZero ? 'That is the limit as $\\symT$ grows. A small $\\symT$ stretches the gaps, so the top score takes everything.' : 'That is the limit as $\\symT \\to 0$. A large $\\symT$ shrinks every gap toward 0, so the scores look equal.' },
          { value: onehot(n, s.indexOf(Math.min(...s))), why: 'That puts everything on the lowest score. Softmax always favors the largest.' },
        ]),
        solution: toZero
          ? [
              `$\\syms / \\symT$ stretches every gap: the top score, $\\syms_{${k}} = ${s[k]}$, pulls ahead of the rest by more and more.`,
              `So its probability goes to 1 and the others to 0: $${vec(hot)}$. That is greedy decoding, the argmax.`,
            ]
          : [
              `$\\syms / \\symT$ shrinks every score, and every gap, toward 0.`,
              `Equal scores get equal shares: $${vec(flat, 2)}$, uniformly random.`,
            ],
      };
    },
  },
];
