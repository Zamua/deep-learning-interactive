import type { Generator, Problem } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round, vec } from '../../kit';
import { clean, nonzero, placesFor, relu, traps } from '../kit';

/** σ(a) and tanh(a) to two decimals, for the inputs the problems use. */
const SIG: [number, number][] = [0.5, 1, 1.5, 2, 3, 4].map((a) => [a, round(1 / (1 + Math.exp(-a)), 2)]);
const TANH: [number, number][] = [0.5, 1, 1.5, 2].map((a) => [a, round(Math.tanh(a), 2)]);

const sig = '\\sigma';

/** `= 0.09`, or `= 0.0196 \approx 0.02` when two decimals round it. */
const approx = (v: number): string => (round(v, 2) === round(v, 6) ? `= ${num(round(v, 2))}` : `= ${num(round(v, 4))} \\approx ${num(v, 2)}`);
const P = 2;

/** The rounding instruction, only when two decimals actually round the answer. */
const round2 = (v: number): string => (placesFor(v) ? ' Round to two decimals.' : '');

/** An input for the ReLU: whole numbers first, then tenths. */
const reluInput = (rng: Rng, d: number): number => (d < 0.5 ? nonzero(rng, -5, 5) : nonzero(rng, -40, 40) / 10);

function reluValue(rng: Rng, d: number): Problem {
  const z = reluInput(rng, d);
  const v = relu(z);
  return {
    prompt: `What is $\\mathrm{ReLU}(${num(z)})$?`,
    answer: { kind: 'number', value: v },
    traps: traps(v, [
      { value: Math.abs(z), why: 'The ReLU does not flip the sign. A negative input becomes 0, not its absolute value.' },
      { value: z, why: 'The ReLU zeroes negative inputs: $\\max(0, z)$.' },
      { value: 0, why: 'Positive inputs pass through the ReLU unchanged. Only negative ones become 0.' },
    ]),
    solution: [`$\\mathrm{ReLU}(z) = \\max(0, z)$.`, z < 0 ? `$${num(z)}$ is negative, so the output is 0.` : `$${num(z)}$ is positive, so it passes through: ${num(z)}.`],
  };
}

function sigmoidMirror(rng: Rng): Problem {
  const [a, v] = pick(rng, SIG);
  const flip = rng.next() < 0.5;
  const [given, gv, ask] = flip ? [-a, clean(1 - v), a] : [a, v, -a];
  const want = clean(1 - gv);
  return {
    prompt: `$${sig}(${num(given)}) \\approx ${num(gv, 2)}$. What is $${sig}(${num(ask)})$? Round to two decimals.`,
    answer: { kind: 'number', value: want, places: placesFor(want) },
    traps: traps(want, [
      { value: -gv, why: 'That is how tanh behaves. The sigmoid is never negative: it mirrors around 0.5, so $\\sigma(-z) = 1 - \\sigma(z)$.' },
      { value: gv, why: `That is $${sig}(${num(given)})$ itself. Flipping the sign of the input flips the output around 0.5.` },
    ], P),
    solution: [
      `The sigmoid mirrors around its value at 0, a half: $${sig}(-z) = 1 - ${sig}(z)$.`,
      `So $${sig}(${num(ask)}) = 1 - ${num(gv, 2)} = ${num(want, 2)}$.`,
      ask < 0 ? 'A negative input gives less than a half, as it should.' : 'A positive input gives more than a half, as it should.',
    ],
  };
}

function tanhMirror(rng: Rng): Problem {
  const [a, v] = pick(rng, TANH);
  const flip = rng.next() < 0.5;
  const [given, gv, ask] = flip ? [-a, -v, a] : [a, v, -a];
  const want = clean(-gv);
  return {
    prompt: `$\\tanh(${num(given)}) \\approx ${num(gv, 2)}$. What is $\\tanh(${num(ask)})$? Round to two decimals.`,
    answer: { kind: 'number', value: want, places: placesFor(want) },
    traps: traps(want, [
      { value: 1 - gv, why: 'That is the sigmoid\'s mirror rule. tanh is centered on 0, so flipping the input flips the sign: $\\tanh(-z) = -\\tanh(z)$.' },
      { value: gv, why: `That is $\\tanh(${num(given)})$ itself. tanh is symmetric about 0, so the sign flips with the input.` },
    ], P),
    solution: ['tanh is symmetric about 0: $\\tanh(-z) = -\\tanh(z)$.', `So $\\tanh(${num(ask)}) = -(${num(gv, 2)}) = ${num(want, 2)}$.`],
  };
}

function atZero(rng: Rng): Problem {
  const f = rng.next() < 0.5;
  const v = f ? 0.5 : 0;
  return {
    prompt: f ? `What is $${sig}(0)$?` : 'What is $\\tanh(0)$?',
    answer: { kind: 'number', value: v, places: placesFor(v) },
    traps: traps(v, f ? [{ value: 0, why: 'That is tanh at 0. The sigmoid at 0 is $1 / (1 + e^{0}) = 1/2$: halfway between its limits 0 and 1.' }, { value: 1, why: '$e^{0} = 1$, so $\\sigma(0) = 1 / (1 + 1)$.' }] : [{ value: 0.5, why: 'That is the sigmoid at 0. tanh is centered on 0: halfway between $-1$ and 1.' }], P),
    solution: f ? ['$\\sigma(0) = 1 / (1 + e^{0}) = 1 / 2 = 0.5$: halfway between 0 and 1.'] : ['$\\tanh(0) = (e^{0} - e^{0}) / (e^{0} + e^{0}) = 0$: halfway between $-1$ and 1.'],
  };
}

function reluSlope(rng: Rng, d: number): Problem {
  const z = reluInput(rng, d);
  const v = z > 0 ? 1 : 0;
  return {
    prompt: `What is the slope of the ReLU at $z = ${num(z)}$?`,
    answer: { kind: 'number', value: v, places: placesFor(v) },
    traps: traps(v, [
      { value: relu(z), why: 'That is the ReLU\'s value there, not its slope.' },
      { value: 1 - v, why: z > 0 ? 'Right of 0 the ReLU passes its input through unchanged, so its slope is 1.' : 'Left of 0 the ReLU is flat at 0, so its slope is 0.' },
    ], P),
    solution: ['The ReLU is flat (slope 0) for negative inputs and passes positive ones through unchanged (slope 1).', `$${num(z)}$ is ${z > 0 ? 'positive, so the slope is 1' : 'negative, so the slope is 0'}.`],
  };
}

function sigmoidSlope(rng: Rng, d: number): Problem {
  // Inputs past 2 make the slope round to σ or 1 - σ itself, which would grade a wrong rule right.
  const mid = SIG.filter(([a]) => a <= 2).map(([, s]) => s);
  const v = d < 0.5 ? int(rng, 1, 9) / 10 : pick(rng, [...mid, ...mid.map((s) => clean(1 - s))]);
  const want = clean(v * (1 - v));
  return {
    prompt: `At some input, $${sig}(z) = ${num(v)}$. What is the sigmoid's slope there?${round2(want)}`,
    answer: { kind: 'number', value: want, places: placesFor(want) },
    traps: traps(want, [
      { value: v, why: 'That is the sigmoid\'s value. Its slope is $\\sigma(1 - \\sigma)$.' },
      { value: 1 - v, why: 'That is $1 - \\sigma$ alone. Multiply it by $\\sigma$.' },
      { value: 1 - v * v, why: 'That is tanh\'s slope rule, $1 - \\tanh(z)^2$. The sigmoid\'s is $\\sigma(1 - \\sigma)$.' },
    ], P),
    solution: [`The sigmoid's slope is $${sig}(1 - ${sig})$.`, `$${num(v)} \\times ${num(clean(1 - v))} ${approx(want)}$.`, v === 0.5 ? 'That is its largest possible slope: a quarter, at $z = 0$.' : 'Never more than 0.25, the slope at $z = 0$.'],
  };
}

function tanhSlope(rng: Rng, d: number): Problem {
  const v = (d < 0.5 ? pick(rng, [0, 0.5, 0.6, 0.8, 0.9]) : pick(rng, TANH.map(([, t]) => t))) * (rng.next() < 0.4 ? -1 : 1) + 0;
  const want = clean(1 - v * v);
  return {
    prompt: `At some input, $\\tanh(z) = ${num(v)}$. What is tanh's slope there?${round2(want)}`,
    answer: { kind: 'number', value: want, places: placesFor(want) },
    traps: traps(want, [
      { value: 1 - v, why: 'That forgets to square: the slope is $1 - \\tanh(z)^2$.' },
      { value: v * (1 - v), why: 'That is the sigmoid\'s slope rule, $\\sigma(1 - \\sigma)$. tanh\'s is $1 - \\tanh(z)^2$.' },
      { value: v * v, why: 'That is $\\tanh(z)^2$ itself. The slope is 1 minus it.' },
    ], P),
    solution: ['tanh\'s slope is $1 - \\tanh(z)^2$.', `$1 - ${v < 0 ? `(${num(v)})` : num(v)}^2 = 1 - ${num(clean(v * v))} ${approx(want)}$.`, v === 0 ? 'At 0 the slope is 1, its largest.' : 'Squaring makes the sign of tanh irrelevant: the slope only depends on how far it is from 0.'],
  };
}

const RANGES = ['$[0,\\ \\infty)$', '$(0,\\ 1)$', '$(-1,\\ 1)$', '$(-\\infty,\\ \\infty)$'];

export const generators: Generator[] = [
  {
    id: 'value',
    make(rng, d) {
      const kinds = d < 0.35 ? [0, 0, 1, 2, 3] : [0, 1, 1, 2, 2];
      const k = pick(rng, kinds);
      return k === 0 ? reluValue(rng, d) : k === 1 ? sigmoidMirror(rng) : k === 2 ? tanhMirror(rng) : atZero(rng);
    },
  },
  {
    id: 'slope',
    make(rng, d) {
      const k = pick(rng, [0, 1, 1, 2, 2]);
      return k === 0 ? reluSlope(rng, d) : k === 1 ? sigmoidSlope(rng, d) : tanhSlope(rng, d);
    },
  },
  {
    id: 'range',
    make(rng) {
      const f = rng.int(3);
      const names = ['the ReLU', 'the sigmoid', 'tanh'];
      const z = [nonzero(rng, -30, -5), nonzero(rng, -9, 9) / 10, int(rng, 5, 40)];
      const why: (string | null)[][] = [
        [null, 'That is the sigmoid\'s range. The ReLU passes any positive input through unchanged, so it has no upper limit.', 'That is tanh\'s range. The ReLU is never negative, and has no upper limit.', 'The ReLU turns every negative input into 0, so its output is never negative.'],
        ['That is the ReLU\'s range. The sigmoid squashes every input below 1.', null, 'That is tanh\'s range. The sigmoid is never negative: $1 / (1 + e^{-z}) > 0$.', 'The sigmoid squashes every input into the range between 0 and 1.'],
        ['That is the ReLU\'s range. tanh is negative for negative inputs and never reaches 1.', 'That is the sigmoid\'s range. tanh is centered on 0: negative inputs give negative outputs.', null, 'tanh flattens out at $-1$ and 1 and never passes them.'],
      ];
      const lo = Math.min(...z);
      const hi = Math.max(...z);
      const ends = [
        `For example $\\mathrm{ReLU}(${num(lo)}) = 0$, and $\\mathrm{ReLU}(${num(hi)}) = ${num(hi)}$.`,
        `For example $\\sigma(${num(lo)})$ is just above 0, and $\\sigma(${num(hi)})$ just below 1.`,
        `For example $\\tanh(${num(lo)})$ is just above $-1$, and $\\tanh(${num(hi)})$ just below 1.`,
      ];
      return {
        prompt: `A layer applies ${names[f]} to the pre-activations $z = ${vec(rng.shuffle(z.slice()))}$. Which range holds its outputs, whatever $z$ is?`,
        answer: { kind: 'choice', options: RANGES, correct: [0, 1, 2][f]!, why: why[f] },
        solution: [
          ['The ReLU is $\\max(0, z)$: 0 for every negative input, and the input itself above 0, with no limit.', 'The sigmoid $1 / (1 + e^{-z})$ is always between 0 and 1: near 0 far left, near 1 far right.', 'tanh is between $-1$ and 1, and centered on 0: far left it nears $-1$, far right it nears 1.'][f]!,
          ends[f]!,
        ],
      };
    },
  },
  {
    id: 'relu-wins',
    make(rng) {
      if (rng.next() < 0.5) {
        const hi = int(rng, 1, 4);
        const lo = hi + int(rng, 2, 6);
        const N = pick(rng, [50, 100, 500, 1000]);
        return {
          prompt: `A ReLU unit's pre-activation is between $-${lo}$ and $-${hi}$ for every one of ${N} different inputs. What gradient reaches the weights feeding it?`,
          answer: {
            kind: 'choice',
            options: [
              'Zero, every time: the ReLU\'s slope is 0 wherever its input is negative',
              'The gradient from above, unchanged: the ReLU only shapes the forward pass',
              'A gradient that turns the unit back on, since its output is stuck at 0',
              'The gradient from above times the pre-activation, a negative number',
            ],
            correct: 0,
            why: [
              null,
              'Backprop multiplies by the ReLU\'s local slope, and for a negative input that slope is 0: nothing gets through.',
              'Nothing pulls the unit back. With a zero slope for every input, the gradient into it is always 0.',
              'The ReLU\'s local slope is 1 or 0, not its input. For a negative input the slope is 0.',
            ],
          },
          solution: [
            'Backprop multiplies the gradient from above by the ReLU\'s local slope at the unit\'s pre-activation.',
            'That slope is 0 for any negative input, and this unit\'s input is negative every time.',
            'So the weights and bias feeding it get a zero gradient for every input: the unit is dead.',
          ],
        };
      }
      const L = int(rng, 3, 10);
      const g = 0.25 ** L;
      return {
        prompt: `${L} units are chained, each feeding the next. Why does far more gradient reach the first unit when they are ReLUs than when they are sigmoids?`,
        answer: {
          kind: 'choice',
          options: [
            'ReLU\'s slope is 1 wherever a unit is on; the sigmoid\'s is at most 0.25',
            'ReLU\'s outputs are bounded, so the gradients cannot grow too large',
            'ReLU is smooth everywhere, while the sigmoid has a corner at 0',
            'ReLU units are never off, so every unit passes its gradient back',
          ],
          correct: 0,
          why: [
            null,
            'The ReLU has no upper bound; the sigmoid is the bounded one. The difference is in the slopes.',
            'It is the other way round: the ReLU has the corner at 0, and the sigmoid is smooth.',
            'A ReLU unit is off for every negative input, and passes no gradient then. The gain is where it is on: slope 1.',
          ],
        },
        solution: [
          'The sigmoid\'s slope $\\sigma(1 - \\sigma)$ is never more than 0.25.',
          `Through ${L} sigmoids the gradient shrinks by at least $0.25^{${L}} \\approx ${g < 0.001 ? g.toExponential(1).replace(/e-(\d+)/, ' \\times 10^{-$1}') : num(round(g, 4))}$.`,
          'A ReLU that is on has slope exactly 1, so the gradient passes through it unchanged.',
        ],
      };
    },
  },
];
