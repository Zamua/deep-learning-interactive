import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, vec } from '../../kit';

const E = (x: number) => round(Math.exp(x), 2);

export const generators: Generator[] = [
  {
    id: 'p-of-class',
    make(rng, d) {
      const n = d < 0.7 ? 3 : 4;
      const s = d < 0.35 ? ints(rng, n, 0, 2) : ints(rng, n, -1, 3);
      const k = rng.int(n);
      const e = s.map(E);
      const total = e.reduce((a, b) => a + b, 0);
      const p = e[k]! / total;
      const distinct = [...new Set(s)].sort((a, b) => b - a);
      const sum = s.reduce((a, b) => a + b, 0);
      const traps = [{ value: 1 / n, why: `${num(round(1 / n, 2), 2)} is one share in ${n}: what softmax gives only when every score is equal.` }];
      if (sum > 0 && s[k]! >= 0) traps.push({ value: s[k]! / sum, why: `That is $${s[k]} / ${sum}$: the score divided by the sum of the scores. Softmax exponentiates first, which also keeps every share positive.` });
      return {
        prompt: `The scores are $\\syms = ${vec(s)}$. What probability does softmax give option ${k}, counting from 0? Round to two decimals.\n\nUse ${distinct.map((v) => `$e^{${v}} \\approx ${num(E(v), 2)}$`).join(', ')}.`,
        answer: { kind: 'number', value: p, places: 2 },
        traps: traps.filter((t) => Math.abs(t.value - p) >= 0.01),
        solution: [
          `Exponentiate each score: ${s.map((v) => `$e^{${v}} \\approx ${num(E(v), 2)}$`).join(', ')}.`,
          `Add them: $${e.map((v) => num(v, 2)).join(' + ')} = ${num(total, 2)}$.`,
          `Divide option ${k}'s by the total: $\\symp_{${k}} = ${num(e[k]!, 2)} / ${num(total, 2)} \\approx ${num(p, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'shift',
    make(rng) {
      const s = ints(rng, 3, -1, 3);
      const c = pick(rng, [1, 2, 5, 10, -2]);
      return {
        prompt: `Softmax turns the scores $\\syms = ${vec(s)}$ into probabilities $\\symp$. Now ${c > 0 ? 'add' : 'subtract'} $${Math.abs(c)}$ ${c > 0 ? 'to' : 'from'} every score. What happens to $\\symp$?`,
        answer: {
          kind: 'choice',
          options: ['Nothing: every probability stays the same', 'Every probability goes up', 'The largest probability grows and the rest shrink', 'They no longer add up to 1'],
          correct: 0,
          why: [null, 'They cannot all go up: they always add up to 1.', 'Shifting every score by the same amount keeps the gaps between them, and softmax only sees the gaps.', 'Softmax always divides by the total, so the probabilities add up to 1 whatever the scores.'],
        },
        solution: [
          `Adding $c$ to every score multiplies every exponential by the same factor: $e^{s_i + c} = e^{c}\\, e^{s_i}$.`,
          `The factor $e^{c}$ appears in every term of the total too, so it cancels in each ratio: $\\symp$ is unchanged.`,
          'Softmax only depends on the differences between scores. Code uses this: it subtracts the largest score first so the exponentials cannot overflow.',
        ],
      };
    },
  },
  {
    id: 'sharpen',
    make(rng) {
      const s = ints(rng, 3, 0, 3, true);
      const top = s.indexOf(Math.max(...s));
      const f = int(rng, 2, 3);
      return {
        prompt: `The scores $\\syms = ${vec(s)}$ go through softmax. If every score is multiplied by $${f}$, what happens to the top score's probability?`,
        answer: {
          kind: 'choice',
          options: ['It goes up', 'It stays the same', 'It goes down'],
          correct: 0,
          why: [null, 'Only adding the same amount to every score leaves softmax unchanged. Multiplying stretches the gaps between scores.', 'The top score\'s lead over the others grows when the scores are multiplied, so its share grows.'],
        },
        solution: [
          `Multiplying by $${f}$ stretches every gap between scores by $${f}$.`,
          `Option ${top} already has the largest score, so its lead over every other option grows, and exponentiation turns a bigger lead into a bigger share.`,
          'Large scores make softmax sharper, close to a hard argmax; small ones make it flatter, close to uniform.',
        ],
      };
    },
  },
];
