import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick } from '../../kit';
import { big, clean, traps } from '../kit';

/** A dataset size and a batch size that divides it. */
function sizes(rng: Rng, d: number): { N: number; B: number } {
  const Ns = d < 0.4 ? [100, 200, 500, 600, 1000, 2000, 6000] : [1200, 10000, 25600, 50000, 51200, 60000, 128000];
  const Bs = d < 0.4 ? [10, 20, 25, 50, 100] : [25, 32, 64, 100, 128, 200, 250, 256, 500];
  for (;;) {
    const N = pick(rng, Ns);
    const B = pick(rng, Bs);
    if (N % B === 0 && N > B) return { N, B };
  }
}

export const generators: Generator[] = [
  {
    id: 'steps',
    make(rng, d) {
      const { N, B } = sizes(rng, d);
      const e = d >= 0.75 ? pick(rng, [2, 3, 5, 10]) : 1;
      const per = N / B;
      const v = e * per;
      return {
        prompt: `A dataset has $\\symN = ${big(N)}$ examples and the batch size is $\\symB = ${big(B)}$. How many gradient steps make ${e === 1 ? 'one epoch' : `${e} epochs`}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: N * e, why: 'That is one step per example. Each step uses a whole batch of $\\symB$ examples.' },
          { value: N * B, why: 'That multiplies by the batch size. Each step uses $\\symB$ examples, so divide: $\\symN / \\symB$ steps per epoch.' },
          ...(e > 1 ? [{ value: per, why: `That is one epoch. Multiply by ${e} for ${e} epochs.` }] : []),
        ]),
        solution: [
          'An epoch is one pass over all $\\symN$ examples, and each step uses $\\symB$ of them.',
          `Steps per epoch: $\\symN / \\symB = ${big(N)} / ${big(B)} = ${big(per)}$.`,
          ...(e > 1 ? [`For ${e} epochs: $${e} \\times ${big(per)} = ${big(v)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'average',
    make(rng, d) {
      const B = d < 0.5 ? 4 : pick(rng, [4, 5]);
      const gs = Array.from({ length: B }, () => (d < 0.3 ? int(rng, 0, 6) : d < 0.7 ? int(rng, -4, 6) : int(rng, -30, 40) / 10));
      const N = pick(rng, [1000, 2000, 50000, 60000]);
      const sum = clean(gs.reduce((a, b) => a + b, 0));
      const v = clean(sum / B);
      return {
        prompt: `A minibatch of $\\symB = ${B}$ examples, drawn from $\\symN = ${big(N)}$, gives these gradients for one entry of $\\symw$, one per example: $${gs.map((g) => num(g)).join(',\\ ')}$. What is the minibatch gradient for that entry?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: sum, why: 'That is the sum. The minibatch gradient is the average: divide by $\\symB$.' },
          { value: sum / N, why: 'That divides by $\\symN$, the whole dataset. The batch average divides by $\\symB$, the examples actually used.' },
        ]),
        solution: [
          'The minibatch gradient is the mean of the per-example gradients in the batch.',
          `Add them: $${gs.map((g) => num(g)).join(' + ').replace(/\+ -/g, '- ')} = ${num(sum)}$.`,
          `Divide by $\\symB = ${B}$: $${num(sum)} / ${B} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'tradeoff',
    make(rng) {
      const up = rng.next() < 0.5;
      const lo = pick(rng, [8, 16, 32, 64]);
      const hi = lo * pick(rng, [4, 8, 16]);
      const [from, to] = up ? [lo, hi] : [hi, lo];
      const N = pick(rng, [10000, 50000, 60000]);
      const cost = 'Each step costs work in proportion to $\\symB$: every example in the batch needs its own gradient.';
      const noise = 'Averaging more examples cancels more of their disagreement, so a bigger batch gives a steadier gradient and a smaller one a noisier gradient.';
      // Options: [cost up, noise down], [cost down, noise down], [cost up, noise up], [cost down, noise up].
      const correct = up ? 0 : 3;
      const costWrong = (i: number) => (i === 0 || i === 2) !== up;
      const noiseWrong = (i: number) => (i === 0 || i === 1) !== up;
      const why = [0, 1, 2, 3].map((i) => (i === correct ? null : [costWrong(i) ? cost : '', noiseWrong(i) ? noise : ''].filter(Boolean).join(' ')));
      return {
        prompt: `Taking gradient steps on a dataset of $\\symN = ${big(N)}$ examples, you change the batch size from $\\symB = ${from}$ to $\\symB = ${to}$. What happens to each step?`,
        answer: {
          kind: 'choice',
          options: ['It costs more, and its gradient is less noisy', 'It costs less, and its gradient is less noisy', 'It costs more, and its gradient is noisier', 'It costs less, and its gradient is noisier'],
          correct,
          why,
        },
        solution: [
          `Cost: a step processes $\\symB$ examples, so going from ${from} to ${to} makes each step do ${up ? `${to / from} times the work` : `$1/${from / to}$ of the work`}.`,
          `Noise: the batch gradient averages $\\symB$ per-example gradients, and its scatter around the true gradient shrinks like $1/\\sqrt{\\symB}$, so it gets ${up ? 'steadier' : 'noisier'}.`,
          up ? 'Bigger batches: fewer, costlier, smoother steps.' : 'Smaller batches: more, cheaper, noisier steps.',
        ],
      };
    },
  },
  {
    id: 'seen',
    make(rng, d) {
      const B = pick(rng, [16, 32, 50, 64, 100, 128, 256]);
      if (d < 0.5) {
        const k = pick(rng, [10, 20, 50, 100, 200, 500, 1000]);
        const v = k * B;
        return {
          prompt: `A run takes $${big(k)}$ gradient steps with batch size $\\symB = ${B}$. How many examples do those steps process?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: k, why: 'That counts one example per step. Each step processes a whole batch of $\\symB$.' },
            { value: k + B, why: 'That adds the batch size once. Every one of the steps processes $\\symB$ examples: multiply.' },
          ]),
          solution: ['Each step processes one batch of $\\symB$ examples.', `$${big(k)} \\times ${B} = ${big(v)}$ examples.`],
        };
      }
      let N = 0;
      let e = 0;
      let k = 0.5;
      while (!Number.isInteger(k)) {
        N = pick(rng, [10000, 12800, 50000, 60000]);
        e = pick(rng, [0.5, 1, 2, 3, 4, 5, 10]);
        k = (e * N) / B;
      }
      const v = e;
      return {
        prompt: `A dataset has $\\symN = ${big(N)}$ examples. After $${big(k)}$ steps with batch size $\\symB = ${B}$, how many epochs have gone by?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: k * B, why: 'That counts examples, not epochs. Divide by $\\symN$, the examples in one epoch.' },
          { value: k / B, why: 'That divides the steps by the batch size. Each step processes $\\symB$ examples: multiply, then divide by $\\symN$.' },
          { value: clean((k * N) / B), why: 'That multiplies by $\\symN$ and divides by $\\symB$, the wrong way round: epochs are $k\\symB / \\symN$.' },
        ]),
        solution: [
          `Examples processed: $${big(k)} \\times ${B} = ${big(k * B)}$.`,
          `One epoch is $\\symN = ${big(N)}$ examples, so that is $${big(k * B)} / ${big(N)} = ${num(v)}$ epochs.`,
        ],
      };
    },
  },
];
