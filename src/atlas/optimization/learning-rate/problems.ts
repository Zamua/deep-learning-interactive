import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, nonzero, num, pick, traps } from '../../kit';

/** `a x^2`, or `a (x - m)^2` for a bowl slid to m, in TeX, with the 1 left out. */
const bowl = (a: number, m = 0) => {
  const x = m === 0 ? '\\symx' : `(\\symx ${m > 0 ? '-' : '+'} ${num(Math.abs(m))})`;
  return `${a === 1 ? '' : num(a)}${x}^2`;
};

/** The line saying a slid bowl behaves like the unslid one, or nothing for m = 0. */
const slid = (a: number, m: number) =>
  m === 0 ? [] : [`Sliding the bowl only moves the minimum, to $\\symx = ${num(m)}$: the distance $\\symx ${m > 0 ? '-' : '+'} ${num(Math.abs(m))}$ shrinks exactly as $\\symx$ does on $${bowl(a)}$.`];

/** A slide for the bowl's minimum: none at low difficulty, often one above it. */
const shiftFor = (rng: Rng, d: number) => (d >= 0.5 && rng.next() < 0.5 ? nonzero(rng, -3, 3) : 0);

type Fate = 0 | 1 | 2 | 3 | 4;
/** Factors 1 - 2a eta for each fate: slides in, lands in one step, zigzags in, bounces, blows up. */
const FACTORS: number[][] = [[0.8, 0.6, 0.5, 0.2], [0], [-0.2, -0.5, -0.6], [-1], [-1.4, -2, -3]];

export const generators: Generator[] = [
  {
    id: 'max-eta',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [0.5, 1, 2, 4, 5]) : pick(rng, [0.25, 0.5, 1.25, 2, 2.5, 4, 5, 8, 10, 20]);
      const m = shiftFor(rng, d);
      const v = clean(1 / a);
      const two = clean(2 * a);
      const k = two === 1 ? '' : num(two);
      return {
        prompt: `For $\\symf(\\symx) = ${bowl(a, m)}$, what is the largest $\\symeta$ for which gradient descent does not diverge?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 1 / (2 * a), why: 'That is the rate that lands on the minimum in one step (factor 0). Larger rates still converge by zigzagging, up to factor $-1$.' },
          { value: 2 / a, why: 'That treats the gradient as $a\\symx$. With $2a\\symx$, the factor $1 - 2a\\symeta$ reaches $-1$ at $\\symeta = 1/a$.' },
          { value: a, why: 'That is $a$ itself. A steeper bowl needs a smaller step: the limit is $1/a$.' },
        ]),
        solution: [
          ...slid(a, m),
          `Here $a = ${num(a)}$, the number in front of the square, so each step multiplies the distance to the minimum by $1 - 2a\\symeta = 1 - ${k}\\symeta$.`,
          `The distance stops shrinking where that factor reaches $-1$: $1 - ${k}\\symeta = -1$.`,
          two === 1 ? 'So $\\symeta = 2$.' : `So $${k}\\symeta = 2$, and $\\symeta = 2 / ${num(two)} = ${num(v)}$.`,
          'At exactly that rate $\\symx$ bounces between two points forever; any larger and it blows up.',
        ],
      };
    },
  },
  {
    id: 'one-step',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [0.5, 1, 2, 2.5, 5]) : pick(rng, [0.25, 0.5, 1, 1.25, 2, 2.5, 4, 5]);
      const m = shiftFor(rng, d);
      const two = clean(2 * a);
      const v = clean(1 / two);
      const k = two === 1 ? '' : num(two);
      return {
        prompt: `For $\\symf(\\symx) = ${bowl(a, m)}$, which $\\symeta$ makes one gradient step land exactly on the minimum, from any starting $\\symx$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 1 / a, why: 'That is the largest rate that does not diverge, where the factor is $-1$ and $\\symx$ bounces. Landing in one step needs the factor to be 0.' },
          { value: two, why: `That multiplies instead of dividing: $${k}\\symeta = 1$ gives $\\symeta = 1 / ${num(two)}$.` },
        ]),
        solution: [
          ...slid(a, m),
          `Here $a = ${num(a)}$, so each step multiplies the distance to the minimum by $1 - 2a\\symeta = 1 - ${k}\\symeta$.`,
          `One step lands on the minimum when that factor is 0: $1 - ${k}\\symeta = 0$.`,
          two === 1 ? 'So $\\symeta = 1$.' : `So $${k}\\symeta = 1$, and $\\symeta = 1 / ${num(two)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'at-rate',
    make(rng, d) {
      const want = (rng.next() < 0.5 ? pick(rng, [1, 3]) : pick(rng, [0, 2, 4])) as Fate;
      let a = 1;
      let eta = 0.5;
      for (;;) {
        a = pick(rng, [0.5, 1, 2, 2.5, 4, 5]);
        eta = clean((1 - pick(rng, FACTORS[want]!)) / (2 * a));
        if (Math.abs(eta * 1000 - Math.round(eta * 1000)) < 1e-9) break;
      }
      const m = shiftFor(rng, d);
      const two = clean(2 * a);
      const r = clean(1 - two * eta);
      const fr = num(r);
      const options = [
        'It slides to the minimum from one side',
        'It lands on the minimum in one step',
        'It zigzags across the minimum, closing in',
        'It bounces between two points forever',
        'It zigzags farther out each step',
      ];
      const needs = ['a factor between 0 and 1', 'a factor of exactly 0', 'a factor between $-1$ and 0', 'a factor of exactly $-1$', 'a factor below $-1$'];
      const why = options.map((_, i): string | null => (i === want ? null : `That needs ${needs[i]}. Here $1 - 2a\\symeta = ${fr}$.`));
      const meaning = [
        'Between 0 and 1: each step keeps the sign and shrinks the distance, so $\\symx$ slides in from one side.',
        'A factor of 0 leaves no distance at all: the first step lands on the minimum.',
        'Between $-1$ and 0: each step flips the sign but shrinks the distance, so $\\symx$ zigzags in.',
        'A factor of $-1$ flips the sign and keeps the size: $\\symx$ bounces between two points forever.',
        'Below $-1$: each step flips the sign and grows the distance, so $\\symx$ blows up.',
      ];
      return {
        prompt: `Gradient descent runs on $\\symf(\\symx) = ${bowl(a, m)}$ with $\\symeta = ${num(eta)}$. What does $\\symx$ do?`,
        answer: { kind: 'choice', options, correct: want, why },
        solution: [
          ...slid(a, m),
          `Here $a = ${num(a)}$, so each step multiplies the distance to the minimum by $1 - 2a\\symeta = 1 - ${num(two)} \\times ${num(eta)} = ${fr}$.`,
          meaning[want]!,
        ],
      };
    },
  },
];
