import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick, vec } from '../../kit';
import { choose, clean, paren, PI, R, TH, traps, vtraps } from '../kit';

/** A question and three answers a model might sample for it. */
const QUESTIONS: [string, string[]][] = [
  ['7 \\times 8', ['56', '54', '64']],
  ['9 \\times 6', ['54', '56', '45']],
  ['12 + 19', ['31', '29', '41']],
  ['\\sqrt{81}', ['9', '8', '81']],
  ['15 - 8', ['7', '6', '8']],
  ['2^5', ['32', '25', '10']],
  ['48 / 6', ['8', '6', '7']],
  ['3 \\times 13', ['39', '36', '33']],
];

const GLP = (y: string) => `\\nabla \\ln ${PI}(${y})`;

/** Three probabilities in tenths (or hundredths when hard), adding up to 1. */
function probs(rng: Rng, d: number): number[] {
  const unit = d < 0.5 ? 10 : 20;
  for (;;) {
    const a = 1 + rng.int(unit - 2);
    const b = 1 + rng.int(unit - a - 1);
    const p = [a, b, unit - a - b].map((x) => clean(x / unit));
    if (p.every((x) => x > 0) && new Set(p).size === 3) return p;
  }
}

/** ∇θ ln π(y) for a softmax over three answers: one-hot of y minus π. */
const glogp = (p: number[], y: number): number[] => p.map((q, i) => clean((i === y ? 1 : 0) - q));

const SOURCES = ['a unit test that passes or fails', 'a checker that compares with the known answer', 'a person\'s thumbs up or down', 'a calculator', 'a compiler that accepts or rejects the code', 'a game\'s final score', 'a word count against a target', 'a proof checker'];

export const generators: Generator[] = [
  {
    id: 'estimate',
    make(rng, d) {
      const twin = d >= 0.7;
      const p = probs(rng, twin ? 0 : d);
      const y = rng.int(3);
      const g = glogp(p, y);
      const Rv = d < 0.35 ? pick(rng, [1, 2, 3]) : twin ? pick(rng, [1, 2, -1]) : pick(rng, [2, -1, 0.5, -2, 1.5]);
      if (!twin) {
        const v = g.map((x) => clean(Rv * x));
        return {
          prompt: `A model samples answer $y$ and gets reward $${R} = ${num(Rv)}$, with $${GLP('y')} = ${vec(g)}$. What is the policy-gradient estimate?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            { value: g, why: `That is $${GLP('y')}$ alone. The estimate scales it by the reward, $${R} = ${num(Rv)}$.` },
            { value: v.map((x) => clean(-x)), why: `That has the sign flipped. The estimate is $${R}$ times $${GLP('y')}$, pointing where the rewarded answer gets more likely.` },
          ]),
          solution: [
            `The estimate for one sample is the reward times the gradient of its log-probability.`,
            `$${num(Rv)} \\times ${vec(g)} = ${vec(v)}$.`,
            Rv > 0 ? 'The reward is positive, so the estimate points where this answer gets more likely.' : 'The reward is negative, so the estimate points where this answer gets less likely.',
          ],
        };
      }
      const y2 = (y + 1 + rng.int(2)) % 3;
      const g2 = glogp(p, y2);
      const R2 = pick(rng, [0, 1, -1, 2].filter((x) => x !== Rv));
      const v = g.map((x, i) => clean((Rv * x + R2 * g2[i]!) / 2));
      return {
        prompt: `A model samples two answers, $y_1$ and $y_2$. The first gets $${R} = ${num(Rv)}$ and has $${GLP('y_1')} = ${vec(g)}$; the second gets $${R} = ${num(R2)}$ and has $${GLP('y_2')} = ${vec(g2)}$. What is the policy-gradient estimate averaged over the two samples?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: g.map((x, i) => clean(Rv * x + R2 * g2[i]!)), why: 'That is the sum of the two estimates. Average them: divide by 2.' },
          { value: g.map((x) => clean(Rv * x)), why: 'That is the first sample\'s estimate alone. Average it with the second\'s.' },
          { value: g.map((x, i) => clean((x + g2[i]!) / 2)), why: 'That averages the gradients without their rewards. Each one is weighted by its own reward first.' },
        ]),
        solution: [
          `First sample: $${num(Rv)} \\times ${vec(g)} = ${vec(g.map((x) => clean(Rv * x)))}$.`,
          `Second sample: $${num(R2)} \\times ${vec(g2)} = ${vec(g2.map((x) => clean(R2 * x)))}$.`,
          `Average them, entry by entry: $${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'log-grad',
    make(rng, d) {
      const pv = pick(rng, d < 0.35 ? [0.1, 0.2, 0.5] : [0.1, 0.2, 0.25, 0.4, 0.5, 0.8]);
      const g = d < 0.35 ? pick(rng, [0.5, 0.8, 0.9, 0.6]) : pick(rng, [0.5, 0.8, -0.2, -0.4, 0.6, -0.1, 0.75]);
      const dp = clean(pv * g);
      const back = d >= 0.6 && rng.int(2) === 0;
      const DP = `\\dfrac{\\partial ${PI}(y)}{\\partial ${TH}_0}`;
      const DL = `\\dfrac{\\partial \\ln ${PI}(y)}{\\partial ${TH}_0}`;
      if (!back) {
        return {
          prompt: `For one parameter $${TH}_0$, a sampled answer $y$ has $${PI}(y) = ${num(pv)}$ and $${DP} = ${num(dp)}$. What is $${DL}$?`,
          answer: { kind: 'number', value: g },
          traps: traps(g, [
            { value: dp, why: `That is the slope of $${PI}(y)$ itself. The slope of its log divides by $${PI}(y)$.` },
            { value: clean(dp * pv), why: `That multiplies by $${PI}(y)$. The chain rule divides: the slope of $\\ln u$ is $1/u$.` },
            { value: clean(pv / dp), why: 'That divides the other way round. It is the slope over the probability.' },
          ]),
          solution: [
            `The slope of $\\ln u$ is $1/u$, so by the chain rule $${DL} = \\dfrac{1}{${PI}(y)}\\,${DP}$.`,
            `$${num(dp)} / ${num(pv)} = ${num(g)}$.`,
            `This is the log trick: $\\nabla ${PI} = ${PI}\\,\\nabla \\ln ${PI}$.`,
          ],
        };
      }
      return {
        prompt: `For one parameter $${TH}_0$, a sampled answer $y$ has $${PI}(y) = ${num(pv)}$ and $${DL} = ${num(g)}$. What is $${DP}$?`,
        answer: { kind: 'number', value: dp },
        traps: traps(dp, [
          { value: g, why: `That is the slope of the log. The slope of $${PI}(y)$ is $${PI}(y)$ times it.` },
          { value: clean(g / pv), why: `That divides by $${PI}(y)$. Undoing the log trick multiplies: $\\nabla ${PI} = ${PI}\\,\\nabla \\ln ${PI}$.` },
        ]),
        solution: [`The log trick: $\\nabla ${PI} = ${PI}\\,\\nabla \\ln ${PI}$, since the slope of $\\ln u$ is $1/u$.`, `$${num(pv)} \\times ${paren(g)} = ${num(dp)}$.`],
      };
    },
  },
  {
    id: 'direction',
    make(rng, d) {
      const [q, ans] = pick(rng, QUESTIONS);
      const k = rng.int(3);
      const p = probs(rng, d)[k]!;
      const Rv = pick(rng, d < 0.35 ? [1, 0, -1, 2] : [1, 0, -1, 2, 0.5, -0.5, 3]);
      const a = `\`${ans[k]}\``;
      const correct = Rv > 0 ? 0 : Rv < 0 ? 1 : 2;
      const why: (string | null)[] = [
        Rv < 0 ? `The reward is negative, so $${R}\\,\\nabla\\ln${PI}$ points where this answer gets less likely.` : `With $${R} = 0$ the estimate is zero: nothing moves.`,
        Rv > 0 ? `The reward is positive, so the step raises $\\ln ${PI}$ of the sampled answer.` : `With $${R} = 0$ the estimate is zero: nothing moves.`,
        `Only a zero reward gives a zero estimate. Here $${R} = ${num(Rv)}$.`,
        `The direction comes from the sign of $${R}$ alone. How likely the answer already was changes only how big the change is.`,
      ];
      why[correct] = null;
      return {
        prompt: `Asked $${q}$, a model samples the answer ${a}, with $${PI}(\\text{${ans[k]}}) = ${num(p)}$, and gets reward $${R} = ${num(Rv)}$. After a small step along the policy-gradient estimate, what happens to $${PI}(\\text{${ans[k]}})$?`,
        answer: { kind: 'choice', options: ['It goes up', 'It goes down', 'It stays the same', 'It depends on whether it was the most likely answer'], correct, why },
        solution: [
          `The estimate is $${R}\\,${GLP('y')}$, and a step along $${GLP('y')}$ raises $\\ln ${PI}(y)$.`,
          Rv > 0 ? `$${R} = ${num(Rv)} > 0$, so the step raises $${PI}$ of ${a}.` : Rv < 0 ? `$${R} = ${num(Rv)} < 0$ flips the step, so $${PI}$ of ${a} goes down.` : `$${R} = 0$ makes the estimate zero, so $${PI}$ of ${a} stays where it is.`,
        ],
      };
    },
  },
  {
    id: 'why-log',
    make(rng) {
      const src = pick(rng, SOURCES);
      if (rng.int(2) === 0) {
        return {
          prompt: `The reward comes from ${src}. In the estimate $${R}(y)\\,${GLP('y')}$ for a sampled answer $y$, which part needs a gradient through the model?`,
          answer: choose(`Only $\\ln ${PI}(y)$: the reward is a plain number`, [
            [`Only $${R}(y)$: the reward is what is being raised`, `The reward is raised through the probabilities. $${R}$ itself has no gradient: it is just a number for each answer.`],
            [`Both $${R}(y)$ and $\\ln ${PI}(y)$`, `$${R}$ comes from outside the model and depends on $${TH}$ only through which answer is sampled.`],
            ['The random draw that picked $y$', 'A random draw has no derivative. The log trick is how the gradient avoids it.'],
          ]),
          solution: [
            `$${R}(y)$ is just a score for the sampled answer, from ${src}: no gradient needed, or even possible.`,
            `The parameters $${TH}$ only change the probabilities, so the gradient goes through $\\ln ${PI}(y)$.`,
          ],
        };
      }
      return {
        prompt: `The reward comes from ${src}. Why does the policy gradient use $${R}(y)\\,${GLP('y')}$ for a sampled answer $y$?`,
        answer: choose(`$\\nabla ${PI} = ${PI}\\,\\nabla\\ln ${PI}$ turns $\\nabla J$ into an average over sampled answers`, [
          [`The log of the reward is easier to differentiate than the reward`, `The reward is not differentiated at all, and there is no log of it: the log is of $${PI}$.`],
          [`The log keeps each probability between zero and one`, `$${PI}$ stays a probability either way. The log is there to rewrite the gradient, not to bound anything.`],
          [`The random draw is differentiated, and the log makes it smooth`, `A random draw has no derivative. The log trick is how the gradient avoids differentiating it.`],
        ]),
        solution: [
          `The expected reward is $J = \\sum_y ${PI}(y)\\,${R}(y)$, so $\\nabla J = \\sum_y ${R}(y)\\,\\nabla ${PI}(y)$: only the probabilities depend on $${TH}$.`,
          `Write $\\nabla ${PI}(y) = ${PI}(y)\\,\\nabla \\ln ${PI}(y)$, and the sum becomes $\\sum_y ${PI}(y)\\,${R}(y)\\,\\nabla\\ln ${PI}(y)$: an average over answers drawn from $${PI}$.`,
          'So one sampled answer gives an estimate: its reward times the gradient of its log-probability.',
        ],
      };
    },
  },
];
