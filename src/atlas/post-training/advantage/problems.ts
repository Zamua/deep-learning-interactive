import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, par, pick, round, terms, traps, vec } from '../../kit';
import { BASE, choose, PI, R, TH } from '../kit';

const GLP = `\\nabla \\ln ${PI}(y)`;
const DL = `\\dfrac{\\partial \\ln ${PI}(y)}{\\partial ${TH}_0}`;
const DP = `\\dfrac{\\partial ${PI}(y)}{\\partial ${TH}_0}`;

/** `n` probabilities in tenths, each at least 0.1, adding up to 1. */
function tenths(rng: Rng, n: number): number[] {
  const cuts = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n - 1).sort((x, y) => x - y);
  return [...cuts, 10].map((c, i) => clean((c - (i ? cuts[i - 1]! : 0)) / 10));
}

/** `$0.4$ for answer 0 and $-1$ for answer 1`: every value but the missing one at `k`. */
function given(vals: number[], k: number): string {
  const xs = vals.map((v, i) => (i === k ? '' : `$${num(v)}$ for answer ${i}`)).filter(Boolean);
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

export const generators: Generator[] = [
  {
    id: 'missing',
    make(rng, d) {
      const n = d < 0.7 ? 3 : 4;
      const G = d < 0.35 ? [0.5, -0.5, 1, -1, 2] : [0.5, -0.5, 1, -1, 2, -2, 0.4, -0.4, 0.2, -0.6, 1.5];
      for (;;) {
        const p = tenths(rng, n);
        const k = d < 0.35 ? n - 1 : rng.int(n);
        const g = p.map((_, i) => (i === k ? 0 : pick(rng, G)));
        const parts = p.map((q, i) => clean(q * g[i]!));
        const rest = clean(parts.reduce((x, y) => x + y, 0));
        const x = clean(-rest / p[k]!);
        if (rest === 0 || Math.abs(x) > 5 || Math.abs(round(x, 2) - x) > 1e-9) continue;
        const known = parts.filter((_, i) => i !== k);
        return {
          prompt: `A model's ${n} answers have probabilities $${PI} = ${vec(p)}$, counting from 0. For one parameter $${TH}_0$, $${DL}$ is ${given(g, k)}. What is it for answer ${k}?`,
          answer: { kind: 'number', value: x },
          traps: traps(x, [
            { value: clean(-rest), why: `That is answer ${k}'s weighted term, its probability times its slope. Divide by its probability, $${num(p[k]!)}$.` },
            { value: clean(rest / p[k]!), why: 'That has the wrong sign. The weighted terms cancel, so this one is minus the others\' total.' },
            { value: clean(-g.reduce((u, v) => u + v, 0)), why: 'That makes the plain slopes add up to zero. They cancel only once each is weighted by its probability.' },
          ]),
          solution: [
            `Weighted by probability, the slopes of $\\ln ${PI}$ add up to zero: $\\sum_y ${PI}(y)\\,${DL} = 0$.`,
            `The known terms: ${p.map((q, i) => (i === k ? '' : `$${num(q)} \\times ${par(g[i]!)} = ${num(parts[i]!)}$`)).filter(Boolean).join(', ')}. Together: $${terms(known)} = ${num(rest)}$.`,
            `So answer ${k}'s term must be $${num(clean(-rest))}$, to bring the total to zero.`,
            `Divide by its probability: $${num(clean(-rest))} / ${num(p[k]!)} = ${num(x)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'grad-sum',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      for (;;) {
        const k = d < 0.35 ? n - 1 : rng.int(n);
        const vals = Array.from({ length: n }, (_, i) => (i === k ? 0 : d < 0.35 ? int(rng, -9, 9) / 10 : int(rng, -30, 30) / 100));
        const known = vals.filter((_, i) => i !== k);
        const rest = clean(known.reduce((x, y) => x + y, 0));
        const x = clean(-rest);
        if (x === 0 || known.some((v) => v === 0)) continue;
        return {
          prompt: `A model has ${n} possible answers, counting from 0. For one parameter $${TH}_0$, $${DP}$ is ${given(vals, k)}. What is it for answer ${k}?`,
          answer: { kind: 'number', value: x },
          traps: traps(x, [
            { value: rest, why: 'That has the wrong sign. The slopes cancel, so this one is minus the others\' total.' },
            { value: clean(1 - rest), why: 'That makes the slopes add up to 1. The probabilities add up to 1, so their slopes add up to the slope of 1, which is 0.' },
          ]),
          solution: [
            `The probabilities add up to 1 whatever $${TH}$ is, so their slopes add up to the slope of a constant: 0.`,
            `The known slopes add up to $${terms(known)} = ${num(rest)}$.`,
            `So answer ${k}'s slope must cancel them: $${num(x)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'noise',
    make(rng) {
      const b = pick(rng, [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.25, 0.75]);
      if (rng.int(2) === 0) {
        return {
          prompt: `Rewards on a question are usually around $${num(b)}$, so the policy-gradient estimates use the advantage with baseline $${BASE} = ${num(b)}$ in place of each reward $${R}$. What does that do to the estimates?`,
          answer: choose('Each one is less noisy, and their average is unchanged', [
            ['Their average now points somewhere else', `The average of $${BASE}\\,${GLP}$ over the model's answers is zero, so the average direction is unchanged.`],
            ['Their average becomes zero, so nothing is learned', `Only the $${BASE}$ part averages to zero. $${R}\\,${GLP}$ keeps its average.`],
            ['Nothing at all: each estimate is exactly the same', 'Single estimates do change: an answer below the baseline is now pushed down instead of up.'],
          ]),
          solution: [
            `Subtracting $${BASE}$ removes $${BASE}\\,${GLP}$ from each estimate.`,
            `Averaged over the model's answers that term is zero, since $\\sum_y ${PI}(y)\\,\\nabla\\ln ${PI}(y) = \\nabla \\sum_y ${PI}(y) = \\nabla 1 = 0$.`,
            'So the expected direction stays the same, while each estimate swings less: good answers up, poor ones down.',
          ],
        };
      }
      return {
        prompt: `With a baseline $${BASE} = ${num(b)}$, the term $${BASE}\\,${GLP}$ averages to zero over the model's answers, because $\\sum_y ${PI}(y)\\,${GLP} = 0$. Why is that sum zero?`,
        answer: choose(`It equals $\\nabla \\sum_y ${PI}(y) = \\nabla 1$, and 1 does not change with $${TH}$`, [
          [`Every single $${GLP}$ is zero`, 'They are not: each one points where its own answer gets more likely. They cancel only when weighted by $\\pi$ and added up.'],
          ['The rewards average to zero', 'No reward appears in this sum: it is over the probabilities alone.'],
          [`Every $\\ln ${PI}(y)$ is negative, so the terms cancel`, `The sign of $\\ln ${PI}$ is not what cancels: $${PI}(y)\\,\\nabla \\ln ${PI}(y) = \\nabla ${PI}(y)$, and those add up to the gradient of 1.`],
        ]),
        solution: [
          `Each term is $${PI}(y)\\,\\nabla\\ln ${PI}(y) = \\nabla ${PI}(y)$, the log trick backwards.`,
          `So the sum is $\\nabla \\sum_y ${PI}(y) = \\nabla 1 = 0$: the probabilities always add up to 1, so they cannot all rise together.`,
          `Hence $${BASE}\\,${GLP}$ averages to zero for any $${BASE}$ that does not depend on the answer.`,
        ],
      };
    },
  },
];
