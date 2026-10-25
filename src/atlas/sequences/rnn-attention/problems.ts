import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, vec } from '../../kit';
import { argmax, clean, dot, E2, nonzero, onehot, probs, prodTex, traps, useExp, vtraps } from '../kit';

const states = (hs: readonly (readonly number[])[]): string => hs.map((h, j) => `$\\symh_{${j}} = ${vec(h)}$`).join(', ');
const sumOf = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export const generators: Generator[] = [
  {
    id: 'weights',
    make(rng, d) {
      const n = d < 0.7 ? 3 : 4;
      const e = ints(rng, n, d < 0.35 ? 0 : -1, 2);
      const x = e.map(E2);
      const total = sumOf(x);
      const a = x.map((v) => v / total);
      const eTex = `e = ${vec(e)}`;
      const lead = `The decoder scores the ${n} encoder states $\\symh_0, \\dots, \\symh_{${n - 1}}$ and gets $${eTex}$, one score per state. The attention weights are $\\alpha = \\mathrm{softmax}(e)$.`;
      const sum = sumOf(e);
      if (d < 0.35) {
        const j = rng.int(n);
        const v = a[j]!;
        return {
          prompt: `${lead} What is $\\alpha_{${j}}$, the weight on $\\symh_{${j}}$? Round to two decimals.\n\nUse ${useExp(e)}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: sum > 0 ? e[j]! / sum : NaN, why: 'That divides the score by the sum of the scores. Softmax exponentiates first.' },
            { value: 1 / n, why: `That spreads the attention evenly. Softmax gives more weight to higher scores.` },
          ]).filter((t) => Math.abs(t.value - v) >= 0.01),
          solution: [
            `Exponentiate each score: ${e.map((s) => `$e^{${s}} \\approx ${num(E2(s), 2)}$`).join(', ')}; they add up to $${num(total, 2)}$.`,
            `$\\alpha_{${j}} = ${num(x[j]!, 2)} / ${num(total, 2)} \\approx ${num(v, 2)}$.`,
          ],
        };
      }
      const top = argmax(e);
      return {
        prompt: `${lead} What are the ${n} weights? Round to two decimals.\n\nUse ${useExp(e)}.`,
        answer: { kind: 'vector', value: a, places: 2 },
        traps: vtraps(a, [
          ...(top >= 0 ? [{ value: onehot(n, top), why: 'That puts all the weight on the top score. Softmax gives every state some weight, more to higher scores.' }] : []),
          ...(sum > 0 && e.every((s) => s >= 0) ? [{ value: e.map((s) => s / sum), why: 'That divides the scores by their sum. Softmax exponentiates first.' }] : []),
          { value: e.map(() => 1 / n), why: 'That spreads the attention evenly. Softmax gives more weight to higher scores.' },
        ]),
        solution: [
          `Exponentiate each score: ${e.map((s) => `$e^{${s}} \\approx ${num(E2(s), 2)}$`).join(', ')}.`,
          `They add up to $${num(total, 2)}$; divide each by it: $\\alpha \\approx ${vec(a, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'context',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const a = probs(rng, n, d < 0.7 ? 0 : 1);
      for (;;) {
        const hs = Array.from({ length: n }, () => ints(rng, 2, d < 0.35 ? 0 : -2, 3));
        if (new Set(hs.map(String)).size < n) continue;
        const ctx = [0, 1].map((k) => clean(sumOf(hs.map((h, j) => a[j]! * h[k]!))));
        const top = argmax(a);
        return {
          prompt: `The encoder states are ${states(hs)}, and the attention weights on them are $\\alpha = ${vec(a)}$. What is the context vector $\\sum_j \\alpha_j \\symh_j$? Round to two decimals.`,
          answer: { kind: 'vector', value: ctx, places: 2 },
          traps: vtraps(ctx, [
            { value: [0, 1].map((k) => sumOf(hs.map((h) => h[k]!))), why: 'That adds the states without their weights. Each state counts in proportion to its $\\alpha_j$.' },
            { value: [0, 1].map((k) => clean(sumOf(hs.map((h) => h[k]!)) / n)), why: 'That is the plain average, every state weighted equally. Use the attention weights.' },
            ...(top >= 0 ? [{ value: hs[top]!, why: `That is only $\\symh_{${top}}$, the state with the largest weight. The context blends every state.` }] : []),
          ]),
          solution: [
            `Scale each state by its weight: ${hs.map((h, j) => `$${num(a[j]!)} \\times ${vec(h)} = ${vec(h.map((v) => clean(a[j]! * v)))}$`).join(', ')}.`,
            `Add them entry by entry: $${vec(ctx)}$.`,
            'The context is a weighted average of the encoder states, pulled toward the ones the decoder attends to.',
          ],
        };
      }
    },
  },
  {
    id: 'focus',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      for (;;) {
        const q = [nonzero(rng, -2, 2), nonzero(rng, -2, 2)];
        const hs = Array.from({ length: n }, () => ints(rng, 2, d < 0.35 ? 0 : -2, 3));
        const e = hs.map((h) => dot(q, h));
        const k = argmax(e);
        const low = e.indexOf(Math.min(...e));
        if (k < 0 || e.filter((v) => v === e[low]).length > 1 || new Set(hs.map(String)).size < n) continue;
        return {
          prompt: `The decoder's state is $q = ${vec(q)}$, and it scores each encoder state with a dot product, $e_j = q \\cdot \\symh_j$. The encoder states are ${states(hs)}. Which state gets the largest attention weight? Give its index, counting from 0.`,
          answer: { kind: 'number', value: k },
          traps: traps(k, [
            { value: low, why: `That state has the lowest score, $e_{${low}} = ${e[low]}$. Softmax gives the most weight to the highest.` },
            { value: k + 1, why: `That counts from 1. The top state is $\\symh_{${k}}$.` },
          ]),
          solution: [
            `The scores: ${hs.map((h, j) => `$e_{${j}} = ${prodTex(q, h)} = ${e[j]}$`).join(', ')}.`,
            `Softmax keeps the order, so the largest score, $e_{${k}} = ${e[k]}$, gets the largest weight: $\\symh_{${k}}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'bottleneck',
    make(rng) {
      const H = pick(rng, [128, 256, 512, 1024]);
      const n = int(rng, 6, 60);
      return {
        prompt: `A translation model reads a sentence of ${n} tokens with an encoder of $\\symH = ${H}$ hidden units. Without attention, the decoder starts from one vector of ${H} numbers. With attention, at every step it can read all ${n} encoder states, ${H} numbers each. What problem does that remove?`,
        answer: {
          kind: 'choice',
          options: [
            'Squeezing the whole input into one vector whose size is fixed',
            'Needing an encoder at all: the decoder reads the input tokens',
            'Needing a recurrence: the decoder keeps no state of its own',
            'Needing a softmax: the weights no longer have to add up to 1',
          ],
          correct: 0,
          why: [
            null,
            'The encoder is still there: attention reads its states, one per input token.',
            'The decoder is still recurrent: it keeps its own state, and uses it to score the encoder states.',
            'The weights come from a softmax over the scores, so they are positive and add up to 1.',
          ],
        },
        solution: [
          `Without attention, ${n} tokens must fit into one vector of ${H} numbers, and long inputs lose detail.`,
          'With attention, every decoder step takes a fresh weighted average of all the encoder states, so nothing has to fit through one fixed-size vector.',
        ],
      };
    },
  },
];
