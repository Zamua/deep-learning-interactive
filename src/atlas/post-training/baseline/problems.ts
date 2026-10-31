import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, minus, num, par, pick, round, terms, traps, vec, vtraps } from '../../kit';
import { ADV, BASE, PI, R, TH } from '../kit';

const GLP = `\\nabla \\ln ${PI}(y)`;

/** Rewards for `n` sampled answers: tenths in [0, 1], harder with negatives and more of them. */
function rewards(rng: Rng, n: number, d: number): number[] {
  for (;;) {
    const r = Array.from({ length: n }, () => (d < 0.7 ? int(rng, 0, 10) / 10 : int(rng, -10, 10) / 10));
    if (new Set(r).size > 1) return r;
  }
}

export const generators: Generator[] = [
  {
    id: 'compute',
    make(rng, d) {
      const n = d < 0.35 ? 3 : d < 0.7 ? 4 : 5;
      const own = d >= 0.35;
      let r = rewards(rng, n, d);
      // Keep the mean a clean decimal so the advantages print exactly.
      while (own && Math.abs(round((r.reduce((a, b) => a + b, 0) / n) * 100, 6) % 1) > 1e-6) r = rewards(rng, n, d);
      const mean = clean(r.reduce((a, b) => a + b, 0) / n);
      const b = own ? mean : pick(rng, [0.5, 0.4, 0.6, 0.3, 0.7]);
      const v = r.map((x) => clean(x - b));
      return {
        prompt: own
          ? `A model samples ${n} answers to one question and they get rewards $${R} = ${vec(r)}$. Using their mean as the baseline $${BASE}$, what are the advantages $${ADV}$?`
          : `A model samples ${n} answers to one question and they get rewards $${R} = ${vec(r)}$. The baseline is $${BASE} = ${num(b)}$. What are the advantages $${ADV}$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: r, why: 'Those are the rewards themselves. Subtract the baseline from each.' },
          { value: v.map((x) => clean(-x)), why: `That is $${BASE} - ${R}$, the wrong way round. A reward above the baseline gives a positive advantage.` },
        ]),
        solution: [
          ...(own ? [`The baseline is the mean reward: $(${terms(r)}) / ${n} = ${num(mean)}$.`] : []),
          `The advantage is $${ADV} = ${R} - ${BASE}$, so subtract the baseline from each reward: ${r.map((x, i) => `$${minus(x, b)} = ${num(v[i]!)}$`).join(', ')}.`,
          `So $${ADV} = ${vec(v)}$: positive for answers better than expected, negative for worse.`,
        ],
      };
    },
  },
  {
    id: 'estimate',
    make(rng, d) {
      const Rv = d < 0.35 ? pick(rng, [1, 0, 0.5]) : d < 0.7 ? int(rng, 0, 10) / 10 : int(rng, -10, 10) / 10;
      let b = pick(rng, [0.2, 0.4, 0.5, 0.6, 0.8]);
      if (b === Rv) b = clean(b - 0.1);
      const g = d < 0.35 ? pick(rng, [0.5, 1, 2]) : pick(rng, [0.5, -0.5, 0.8, -0.6, 0.4, 2, -1]);
      const a = clean(Rv - b);
      const v = clean(a * g);
      const DL = `\\dfrac{\\partial \\ln ${PI}(y)}{\\partial ${TH}_0}`;
      return {
        prompt: `For one parameter $${TH}_0$, a sampled answer $y$ gets reward $${R} = ${num(Rv)}$ and has $${DL} = ${num(g)}$. With the baseline $${BASE} = ${num(b)}$, what is the policy-gradient estimate's entry for $${TH}_0$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(Rv * g), why: `That leaves out the baseline: it uses $${R}$, not the advantage $${R} - ${BASE}$.` },
          { value: clean(-v), why: `That uses $${BASE} - ${R}$, the wrong way round. The advantage is $${R} - ${BASE}$.` },
          { value: a, why: `That is the advantage alone. Multiply it by the gradient of the log-probability.` },
        ]),
        solution: [
          `The advantage: $${ADV} = ${R} - ${BASE} = ${minus(Rv, b)} = ${num(a)}$.`,
          `The estimate is $${ADV}\\,${GLP}$, so its entry for $${TH}_0$ is $${num(a)} \\times ${par(g)} = ${num(v)}$.`,
          a > 0 ? 'The answer beat the baseline, so this pushes it up.' : 'The answer fell short of the baseline, so this pushes it down.',
        ],
      };
    },
  },
  {
    id: 'push',
    make(rng, d) {
      const b = pick(rng, d < 0.5 ? [0.5, 0.6, 0.7, 0.8] : [0.3, 0.45, 0.55, 0.65, 0.75, 0.9]);
      const kind = rng.int(5);
      // Mostly a positive reward below the baseline: the case a baseline changes.
      const Rv = kind < 2 ? clean(b - pick(rng, [0.1, 0.2, 0.3])) : kind < 4 ? clean(b + pick(rng, [0.1, 0.2])) : b;
      const a = clean(Rv - b);
      const correct = a > 0 ? 0 : a < 0 ? 1 : 2;
      const why: (string | null)[] = [
        a < 0 ? `The answer scored below the baseline: $${ADV} = ${minus(Rv, b)} = ${num(a)} < 0$, so it is pushed down${Rv > 0 ? ', even though its reward is positive' : ''}.` : `$${ADV} = 0$: the estimate is zero, so it is not pushed.`,
        a > 0 ? `The reward beats the baseline: $${ADV} = ${minus(Rv, b)} = ${num(a)} > 0$, so it is pushed up.` : `$${ADV} = 0$: the estimate is zero, so it is not pushed.`,
        `Only an advantage of zero leaves it alone. Here $${ADV} = ${minus(Rv, b)} = ${num(a)}$.`,
      ];
      why[correct] = null;
      return {
        prompt: `On a question with baseline $${BASE} = ${num(b)}$, a model samples an answer with reward $${R} = ${num(Rv)}$. After a small step along the policy-gradient estimate with this baseline, how does that answer's probability change?`,
        answer: { kind: 'choice', options: ['It goes up: the answer is pushed up', 'It goes down: the answer is pushed down', 'It stays the same: the answer is not pushed'], correct, why },
        solution: [
          `The advantage is $${ADV} = ${R} - ${BASE} = ${minus(Rv, b)} = ${num(a)}$.`,
          a > 0 ? 'Better than usual, so the step raises its probability.' : a < 0 ? `Worse than usual, so the step lowers its probability${Rv > 0 ? ', even though the reward itself is above zero' : ''}.` : 'Exactly as expected, so the estimate is zero and nothing moves.',
        ],
      };
    },
  },
];
