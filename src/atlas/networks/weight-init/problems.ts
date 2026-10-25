import type { Generator, Problem } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round } from '../../kit';
import { clean, placesFor, traps } from '../kit';

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
    id: 'sum-variance',
    make(rng, d) {
      const kind = d < 0.35 ? rng.int(2) : d < 0.7 ? rng.int(3) : 2;
      if (kind === 0) {
        const n = pick(rng, [2, 3, 4, 5, 10, 50, 100]);
        const v = pick(rng, [1, 2, 3, 0.5, 4]);
        const want = clean(n * v);
        return {
          prompt: `$z$ is the sum of ${n} independent terms, each with mean 0 and variance ${num(v)}. What is the variance of $z$?`,
          answer: { kind: 'number', value: want },
          traps: traps(want, [
            { value: v, why: 'That is one term\'s variance. Every independent term adds its own.' },
            { value: Math.sqrt(n) * v, why: 'The variances add up, $n$ of them. It is the standard deviation that grows like $\\sqrt{n}$.' },
            { value: n * n * v, why: `Independent variances add: $${n} \\times ${num(v)}$, not $${n}^2 \\times ${num(v)}$.` },
          ]),
          solution: [`For independent terms the variances add: the variance of $z$ is $${n} \\times ${num(v)} = ${num(want)}$.`],
        };
      }
      if (kind === 1) {
        const n = pick(rng, [4, 9, 16, 25, 100, 400]);
        const sd = pick(rng, [1, 2, 0.5, 3]);
        const want = clean(Math.sqrt(n) * sd);
        return {
          prompt: `$z$ is the sum of ${n} independent terms, each with mean 0 and standard deviation ${num(sd)}. What is the standard deviation of $z$?`,
          answer: { kind: 'number', value: want },
          traps: traps(want, [
            { value: n * sd, why: 'Standard deviations do not add; variances do. The sum\'s variance is $n$ times as big, so its standard deviation is $\\sqrt{n}$ times as big.' },
            { value: n * sd * sd, why: 'That is the variance of the sum. Take its square root.' },
            { value: sd, why: 'That is one term\'s. The sum spreads wider as terms pile up.' },
          ]),
          solution: [`Each term has variance $${num(sd)}^2 = ${num(clean(sd * sd))}$, and the variances add: $${n} \\times ${num(clean(sd * sd))} = ${num(clean(n * sd * sd))}$.`, `The standard deviation is the square root: $\\sqrt{${num(clean(n * sd * sd))}} = ${num(want)}$, which is $\\sqrt{${n}} = ${Math.sqrt(n)}$ times one term's.`],
        };
      }
      const n = pick(rng, [25, 100, 400, 2500]);
      const s = pick(rng, [1, 0.1, 0.01, 0.2, 0.5]);
      const want = clean(Math.sqrt(n) * s);
      return {
        prompt: `A unit computes $z = \\symw \\cdot \\symx$ over $n = ${n}$ inputs. Each input has mean 0 and variance 1, and each weight is drawn independently with mean 0 and standard deviation ${num(s)}. What is the standard deviation of $z$?`,
        answer: { kind: 'number', value: want },
        traps: traps(want, [
          { value: n * s, why: 'Standard deviations do not add; variances do. Add the $n$ variances, then take the square root.' },
          { value: n * s * s, why: 'That is the variance of $z$. Take its square root.' },
          { value: s, why: 'That is one weight\'s. The sum of $n$ terms spreads $\\sqrt{n}$ times wider.' },
        ]),
        solution: [
          `Each term $\\symw_i \\symx_i$ has variance $${num(s)}^2 \\times 1 = ${num(clean(s * s))}$: the weight's variance times the input's.`,
          `The ${n} variances add: $${n} \\times ${num(clean(s * s))} = ${num(clean(n * s * s))}$.`,
          `So the standard deviation is $\\sqrt{${num(clean(n * s * s))}} = ${num(want)}$.${want === 1 ? ' Exactly 1: this is the scale Xavier initialization picks.' : ''}`,
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
