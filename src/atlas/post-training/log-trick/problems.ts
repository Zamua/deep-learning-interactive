import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { choose, clean, paren, PI, R, sumTex, TH, traps } from '../kit';

/** A question and three answers a model might sample for it, the right one first. */
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

/** Three probabilities in tenths (or twentieths when hard), adding up to 1. */
function probs(rng: Rng, d: number): number[] {
  const unit = d < 0.5 ? 10 : 20;
  for (;;) {
    const a = 1 + rng.int(unit - 2);
    const b = 1 + rng.int(unit - a - 1);
    const p = [a, b, unit - a - b].map((x) => clean(x / unit));
    if (p.every((x) => x > 0) && new Set(p).size === 3) return p;
  }
}

const SOURCES = ['a unit test that passes or fails', 'a checker that compares with the known answer', 'a person\'s thumbs up or down', 'a calculator', 'a compiler that accepts or rejects the code', 'a game\'s final score', 'a word count against a target', 'a proof checker'];

export const generators: Generator[] = [
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
    id: 'expected',
    make(rng, d) {
      const [q, ans] = pick(rng, QUESTIONS);
      const p = probs(rng, d < 0.7 ? 0 : 1);
      // The right answer comes first; harder levels give partial credit or a penalty for the others.
      const rs = d < 0.35 ? [1, 0, 0] : d < 0.7 ? [1, pick(rng, [0.5, -1]), 0] : [pick(rng, [1, 2]), pick(rng, [0, -1]), pick(rng, [-1, -2])];
      const terms = p.map((x, i) => clean(x * rs[i]!));
      const v = clean(terms.reduce((a, b) => a + b, 0));
      const list = ans.map((a, i) => `$${PI}(\\text{${a}}) = ${num(p[i]!)}$`).join(', ');
      const rew = ans.map((a, i) => `$${num(rs[i]!)}$ for \`${a}\``).join(', ');
      const mean = clean(rs.reduce((a, b) => a + b, 0) / 3);
      return {
        prompt: `Asked $${q}$, a model answers \`${ans[0]}\`, \`${ans[1]}\` or \`${ans[2]}\`, with ${list}. A checker gives reward $${R}$: ${rew}. What is the expected reward $J$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: mean, why: 'That averages the rewards as if every answer were equally likely. Weight each reward by its probability.' },
          { value: clean(rs.reduce((a, b) => a + b, 0)), why: 'That adds the rewards without their probabilities. Weight each one by how likely its answer is.' },
          { value: rs[p.indexOf(Math.max(...p))]!, why: 'That is the reward of the most likely answer alone. Every answer counts, in proportion to its probability.' },
        ]),
        solution: [
          `$J$ is each answer's probability times its reward, added up.`,
          `The terms: ${ans.map((a, i) => `$${num(p[i]!)} \\times ${paren(rs[i]!)} = ${num(terms[i]!)}$`).join(', ')}.`,
          `Add them: $${sumTex(terms)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'depends',
    make(rng) {
      const src = pick(rng, SOURCES);
      if (rng.int(2) === 0) {
        return {
          prompt: `A model samples an answer $y$, and ${src} gives it a reward $${R}(y)$. In the expected reward $J$, which part changes when the parameters $${TH}$ change?`,
          answer: choose(`Only the probabilities $${PI}(y)$: each reward is a plain number`, [
            [`Only the rewards $${R}(y)$: they are what training raises`, `The rewards come from outside the model, from ${src}: an answer gets the same reward whatever $${TH}$ is. Training raises $J$ by moving the probabilities.`],
            [`Both $${PI}(y)$ and $${R}(y)$`, `$${R}(y)$ comes from ${src}, one fixed number per answer. Only how often each answer is sampled depends on $${TH}$.`],
            [`Neither: the answer is drawn at random, so $J$ has no gradient`, `A single draw has no slope, but $J$ adds up every answer's probability times its reward, and the probabilities move smoothly with $${TH}$.`],
          ]),
          solution: [
            `$J$ adds up each answer's probability $${PI}(y)$ times its reward $${R}(y)$.`,
            `$${R}(y)$ comes from ${src}: one fixed number per answer.`,
            `The parameters $${TH}$ only change the probabilities, so the gradient of $J$ goes through $${PI}(y)$ alone.`,
          ],
        };
      }
      return {
        prompt: `A model samples an answer, and ${src} gives it a reward. Why can the gradient not be taken through that one sampled answer's reward directly?`,
        answer: choose(`$${TH}$ reaches the reward only through a random draw, and a draw has no slope`, [
          ['The reward is only ever zero or one', 'Rewards can be any number. What blocks the gradient is the random draw between the model and the reward.'],
          [`The expected reward $J$ does not depend on $${TH}$`, `It does, through the probabilities $${PI}(y)$. Raising $J$ is the whole point of training.`],
          [`The log of a reward of zero is undefined`, 'No log of the reward is taken anywhere. The obstacle is the random draw.'],
        ]),
        solution: [
          `The parameters $${TH}$ set the probabilities $${PI}$, a random draw picks the answer, and ${src} scores it.`,
          `Nudging $${TH}$ does not smoothly change which answer the draw picks, so the sampled reward has no slope.`,
          `The way through is the expected reward $J$, a sum of probabilities times rewards, whose probabilities do have slopes.`,
        ],
      };
    },
  },
];
