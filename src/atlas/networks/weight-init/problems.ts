import type { Generator, Problem } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, num, pick, round, traps } from '../../kit';
import { placesFor } from '../kit';

const P = 2;
const sqrt2 = '\\sqrt{2} \\approx 1.41';

/** Fan-ins with a whole square root, then ones that need a hint, for each rule. */
const XAVIER_EASY = [4, 9, 16, 25, 100, 400];
const XAVIER_HARD = [50, 200, 300, 500];
const HE_EASY = [2, 8, 18, 32, 50, 200];
const HE_HARD = [64, 100, 256, 400];

/** `= 0.1`, or `\approx 0.14` when two decimals round it. */
const eq = (v: number): string => (round(v, 2) === round(v, 9) ? `= ${num(round(v, 2))}` : `\\approx ${num(v, 2)}`);

function stdProblem(rng: Rng, d: number): Problem {
  const he = rng.next() < 0.5;
  const hard = d >= 0.5;
  const n = pick(rng, he ? (hard ? HE_HARD : HE_EASY) : hard ? XAVIER_HARD : XAVIER_EASY);
  const viaShape = d >= 0.75;
  const H = pick(rng, [10, 20, 30, 1000].filter((h) => h !== n));
  const std = he ? Math.sqrt(2 / n) : 1 / Math.sqrt(n);
  const other = he ? 1 / Math.sqrt(n) : Math.sqrt(2 / n);
  const hint = !hard ? '' : he ? ` Use $${sqrt2}$.` : ` Use $\\sqrt{${n}} \\approx ${num(round(Math.sqrt(n), 2), 2)}$.`;
  const act = he ? 'ReLU' : 'tanh';
  const scheme = he ? 'He' : 'Xavier';
  const where = viaShape ? `whose weight matrix has shape (${H}, ${n})` : `whose units each have $n = ${n}$ inputs`;
  const ts = [
    { value: other, why: he ? 'That is Xavier\'s $1/\\sqrt{n}$, for tanh. A ReLU zeroes half its inputs, so He doubles the variance: $\\sqrt{2/n}$.' : 'That is He\'s $\\sqrt{2/n}$, for ReLU. tanh does not zero half its inputs, so Xavier keeps the variance at $1/n$: $1/\\sqrt{n}$.' },
    { value: (he ? 2 : 1) / n, why: `That is the variance. The standard deviation is its square root.` },
  ];
  if (viaShape) ts.push({ value: he ? Math.sqrt(2 / H) : 1 / Math.sqrt(H), why: `That uses ${H}, the number of units. The fan-in is the number of inputs each unit adds up: the ${n} columns.` });
  return {
    prompt: `A ${act} layer ${where} uses ${scheme} initialization. What standard deviation should its weights have?${placesFor(std) ? ' Round to two decimals.' : ''}${hint}`,
    answer: { kind: 'number', value: std, places: placesFor(std) },
    traps: traps(std, ts, P),
    solution: [
      ...(viaShape ? [`Each unit adds up one input per column: the fan-in is $n = ${n}$.`] : []),
      he ? `He initialization, for ReLU: variance $2/n = 2/${n}$, so the standard deviation is $\\sqrt{2/${n}}$.` : `Xavier initialization, for tanh: variance $1/n = 1/${n}$, so the standard deviation is $1/\\sqrt{${n}}$.`,
      he ? `$\\sqrt{2/${n}} ${HE_EASY.includes(n) ? `= \\sqrt{1/${n / 2}} = 1/${Math.sqrt(n / 2)}` : `= ${num(round(Math.sqrt(2), 2))} / ${num(Math.sqrt(n))}`} ${eq(std)}$.` : `$1/\\sqrt{${n}} = 1/${Number.isInteger(Math.sqrt(n)) ? num(Math.sqrt(n)) : num(round(Math.sqrt(n), 2), 2)} ${eq(std)}$.`,
    ],
  };
}

export const generators: Generator[] = [
  {
    id: 'std',
    make: stdProblem,
  },
  {
    id: 'shrink',
    make(rng, d) {
      const n = d < 0.35 ? 100 : pick(rng, d < 0.7 ? [100, 400, 25] : [100, 400, 25, 10000]);
      const f = d < 0.35 ? 0.1 : pick(rng, [0.1, 0.2, 0.5]);
      const sd = clean(f / Math.sqrt(n));
      const L = d < 0.7 ? pick(rng, [2, 3]) : pick(rng, [3, 4]);
      const want = clean(f ** L);
      const v = clean(sd * sd);
      const f2 = clean(f * f);
      return {
        prompt: `Each unit of a deep tanh network adds up $n = ${n}$ inputs, with weights of standard deviation ${num(sd)}. The first layer's inputs have standard deviation 1. About what standard deviation is left after ${L} layers?`,
        answer: { kind: 'number', value: want },
        traps: traps(want, [
          { value: f, why: `That is after one layer. Each layer multiplies the standard deviation by ${num(f)} again.` },
          { value: f * L, why: `That multiplies by the number of layers. The factors compound: $${num(f)}^{${L}}$.` },
          { value: f2 ** L, why: 'That is the variance after those layers. Take its square root.' },
          { value: (n * sd) ** L, why: `That adds up the standard deviations, $${n} \\times ${num(sd)}$. Variances add, so one layer's factor is $\\sqrt{${n}} \\times ${num(sd)}$.` },
        ]),
        solution: [
          `Each weight's variance: $${num(sd)}^2 = ${num(v)}$.`,
          `Each unit adds ${n} terms, so its sum's variance is $${n} \\times ${num(v)} = ${num(f2)}$ times its inputs'.`,
          `So each layer multiplies the standard deviation by $\\sqrt{${num(f2)}} = ${num(f)}$.`,
          `Near 0, tanh passes values almost unchanged, so the factors compound: $${num(f)}^{${L}} = ${num(want)}$.`,
        ],
      };
    },
  },
  {
    id: 'trouble',
    make(rng) {
      const kind = rng.int(3);
      const options = [
        'The hidden units stay identical: they all get the same gradient',
        'The units saturate near $-1$ or 1, so their slopes and gradients nearly vanish',
        'The activations shrink layer by layer toward 0, and so do the gradients',
        'Nothing goes wrong: any starting scale works as well as another',
      ];
      if (kind === 0) {
        const H = pick(rng, [10, 50, 100, 256, 512]);
        const c = pick(rng, [0.5, 0.1, 0.01, 1, 0.2]);
        return {
          prompt: `Every weight of a hidden layer with $\\symH = ${H}$ units starts at exactly the same value, ${num(c)}. What goes wrong?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [
              null,
              `Saturation comes from weights that are too large. ${num(c)} is not the problem here; that every unit has the same ${num(c)} is.`,
              'Shrinking comes from weights that are too small. The problem here is that every unit is the same.',
              'Nothing ever tells the units apart: equal weights give equal outputs and equal gradients.',
            ],
          },
          solution: [
            'Every unit sees the same input with the same weights, so every unit computes the same output.',
            'Backprop then hands every unit the same gradient, so adjusting each weight by its gradient keeps the units equal.',
            `The layer behaves like a single unit copied ${H} times. Random initial weights break this symmetry.`,
          ],
        };
      }
      if (kind === 1) {
        const n = pick(rng, [100, 256, 400, 500, 1000]);
        const sd = pick(rng, [1, 2]);
        const zsd = Math.sqrt(n) * sd;
        return {
          prompt: `A deep tanh network draws every weight with standard deviation ${sd}, and each unit adds up $n = ${n}$ inputs of variance about 1. What goes wrong?`,
          answer: {
            kind: 'choice',
            options,
            correct: 1,
            why: [
              'The weights are random, so the units differ. The trouble is their size.',
              null,
              `The weights are far too large, not too small: each sum spreads out to a standard deviation of about ${round(zsd, 0)}.`,
              'The scale matters: a saturated tanh has a slope near 0, so the gradients through it are nearly 0.',
            ],
          },
          solution: [
            `The sum of ${n} terms has variance about $${n} \\times ${sd * sd} = ${n * sd * sd}$: a standard deviation near ${round(zsd, 0)}.`,
            'tanh is flat below about $-3$ and above 3, so nearly every unit sits at $-1$ or 1, where its slope is close to 0.',
            'Backprop multiplies by those slopes, so the gradients nearly vanish.',
          ],
        };
      }
      const L = pick(rng, [6, 10, 12, 20]);
      const n = pick(rng, [100, 400, 1000]);
      const sd = pick(rng, [0.001, 0.01]);
      const f = round(Math.sqrt(n) * sd, 3);
      return {
        prompt: `A ${L}-layer network draws every weight with standard deviation ${num(sd)}, and each unit adds up $n = ${n}$ inputs. What goes wrong?`,
        answer: {
          kind: 'choice',
          options,
          correct: 2,
          why: [
            'The weights are random, so the units differ. The trouble is their size.',
            'Saturation comes from weights that are too large. These are tiny: each layer shrinks its input.',
            null,
            'The scale matters: a signal shrunk to almost nothing sends almost no gradient back either.',
          ],
        },
        solution: [
          `Each unit's sum has a standard deviation of about $\\sqrt{${n}} \\times ${num(sd)} \\approx ${num(f)}$ times its inputs'.`,
          `Over ${L} layers that factor compounds: the activations, and the gradients that flow back through the same weights, shrink toward 0.`,
          `Scaling the weights to $1/\\sqrt{n}$ would keep the factor near 1.`,
        ],
      };
    },
  },
];
