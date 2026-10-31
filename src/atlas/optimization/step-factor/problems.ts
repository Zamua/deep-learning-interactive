import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, minus, nonzero, num, par, pick, round, traps } from '../../kit';

/** `a x^2` in TeX, with the 1 left out. */
const bowl = (a: number) => `${a === 1 ? '' : num(a)}\\symx^2`;

/** x after `k` steps of gradient descent on a x^2: each step multiplies by 1 - 2 a eta. */
const run = (a: number, eta: number, x0: number, k: number) => Array.from({ length: k + 1 }, (_, i) => clean(x0 * (1 - 2 * a * eta) ** i));

type Regime = 0 | 1 | 2 | 3;
/** Creeps, slides, zigzags in, blows up; factors in the gaps between are never generated. */
function regime(r: number): Regime | null {
  if (r >= 0.95 && r < 1) return 0;
  if (r >= 0.1 && r <= 0.7) return 1;
  if (r >= -0.9 && r <= -0.1) return 2;
  if (r <= -1.2) return 3;
  return null;
}

function pickRegime(rng: Rng, want: Regime): { a: number; eta: number; r: number } {
  for (;;) {
    const a = pick(rng, [0.5, 1, 2, 2.5, 4, 5]);
    const eta = pick(rng, [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1]);
    const r = clean(1 - 2 * a * eta);
    if (regime(r) === want) return { a, eta, r };
  }
}

/** A bowl and a rate whose factor is a short decimal, negative only at higher difficulty. */
function twoStepSetup(rng: Rng, d: number): { a: number; eta: number; r: number } {
  const factors = d < 0.35 ? [0.8, 0.6, 0.5, 0.4, 0.2] : [0.8, 0.6, 0.5, 0.4, 0.2, -0.2, -0.5, -0.6];
  for (;;) {
    const a = pick(rng, d < 0.35 ? [1, 2] : [0.5, 1, 2, 4, 5]);
    const r = pick(rng, factors);
    const eta = clean((1 - r) / (2 * a));
    if (Math.abs(eta * 1000 - Math.round(eta * 1000)) < 1e-9) return { a, eta, r };
  }
}

export const generators: Generator[] = [
  {
    id: 'next-x',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [1, 2]) : d < 0.7 ? pick(rng, [0.5, 1, 2, 3]) : pick(rng, [0.5, 1.5, 2, 4, 5]);
      const eta = d < 0.35 ? pick(rng, [0.1, 0.25, 0.5]) : d < 0.7 ? pick(rng, [0.1, 0.2, 0.25, 0.5]) : pick(rng, [0.05, 0.1, 0.2, 0.3]);
      const x0 = d < 0.35 ? int(rng, 1, 5) : d < 0.7 ? nonzero(rng, -5, 5) : nonzero(rng, -30, 30) / 10;
      const grad = clean(2 * a * x0);
      const step = clean(eta * grad);
      const v = clean(x0 - step);
      const r = clean(1 - 2 * a * eta);
      return {
        prompt: `Gradient descent on $\\symf(\\symx) = ${bowl(a)}$ is at $\\symx = ${num(x0)}$. With $\\symeta = ${num(eta)}$, what is $\\symx$ after one step?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: x0 + step, why: 'That adds the step, which climbs the bowl. Gradient descent subtracts $\\symeta$ times the gradient.' },
          { value: x0 - eta * a * x0, why: `That uses $a\\symx = ${a === 1 ? '' : num(a)}\\symx$ as the gradient, dropping the 2 the power rule brings down: the derivative of $a\\symx^2$ is $2a\\symx$.` },
          { value: x0 - grad, why: 'That subtracts the whole gradient, leaving out $\\symeta$.' },
        ]),
        solution: [
          `Here $a = ${num(a)}$, and the gradient of $a\\symx^2$ is $\\symf'(\\symx) = 2a\\symx = 2 \\times ${num(a)} \\times ${par(x0)} = ${num(grad)}$.`,
          `The step: $\\symeta \\times ${par(grad)} = ${num(step)}$.`,
          `$\\symx \\leftarrow ${minus(x0, step)} = ${num(v)}$.`,
          `Check with the factor: $1 - 2a\\symeta = 1 - 2 \\times ${num(a)} \\times ${num(eta)} = ${num(r)}$, and $${num(r)} \\times ${par(x0)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'two-steps',
    make(rng, d) {
      const { a, eta, r } = twoStepSetup(rng, d);
      const x0 = d < 0.35 ? int(rng, 1, 5) : d < 0.7 ? nonzero(rng, -5, 5) : pick(rng, [10, -10, 20, 2.5, -5, 50]);
      const x1 = clean(r * x0);
      const v = clean(r * x1);
      return {
        prompt: `Gradient descent on $\\symf(\\symx) = ${bowl(a)}$ starts at $\\symx = ${num(x0)}$. With $\\symeta = ${num(eta)}$, what is $\\symx$ after two steps?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: x1, why: 'That is $\\symx$ after one step. The second step multiplies by the factor again.' },
          { value: x0 - 2 * eta * 2 * a * x0, why: 'That takes both steps with the first gradient. After one step $\\symx$ has moved, so the second gradient is smaller: multiply by the factor twice.' },
          { value: 2 * r * x0, why: 'That doubles the factor. Two steps multiply by it twice, which squares it.' },
        ]),
        solution: [
          `Here $a = ${num(a)}$, so each step multiplies $\\symx$ by $1 - 2a\\symeta = 1 - 2 \\times ${num(a)} \\times ${num(eta)} = ${num(r)}$.`,
          `One step: $${num(r)} \\times ${par(x0)} = ${num(x1)}$.`,
          `The second step multiplies by the same factor: $${num(r)} \\times ${par(x1)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'regime',
    make(rng) {
      const want = rng.int(4) as Regime;
      const { a, eta, r } = pickRegime(rng, want);
      const x0 = pick(rng, [1, 2, 3, -1, -2, 4]);
      const xs = run(a, eta, x0, 3);
      const fr = num(r);
      const facts = ['a factor just under 1', 'a factor between 0 and 1, well below 1', 'a factor between $-1$ and 0', 'a factor below $-1$'];
      const names = ['Creeping in tiny steps', 'Sliding quickly in from one side', 'Zigzagging in', 'Zigzagging out'];
      const why = names.map((nm, i): string | null => (i === want ? null : `${nm} needs ${facts[i]}. Here $1 - 2a\\symeta = ${fr}$.`));
      const meaning = [
        'Each step keeps almost all of $\\symx$, so it creeps toward 0: it gets there, slowly.',
        'Each step keeps the same sign and shrinks $\\symx$ by a good share: it slides straight in.',
        'Each step flips the sign but shrinks the size: $\\symx$ overshoots the minimum, by less every time, and settles.',
        'Each step flips the sign and grows the size: every overshoot lands farther out, and $\\symx$ diverges.',
      ];
      return {
        prompt: `Gradient descent runs on $\\symf(\\symx) = ${bowl(a)}$ from $\\symx = ${num(x0)}$ with $\\symeta = ${num(eta)}$. What does $\\symx$ do over the next steps?`,
        answer: {
          kind: 'choice',
          options: ['It creeps toward 0 in tiny steps', 'It slides quickly to 0 from one side', 'It zigzags across 0, closing in', 'It zigzags farther out each step'],
          correct: want,
          why,
        },
        solution: [
          'On $a\\symx^2$, each step multiplies $\\symx$ by the same factor, $1 - 2a\\symeta$.',
          `Here $a = ${num(a)}$, so $1 - 2 \\times ${num(a)} \\times ${num(eta)} = ${fr}$.`,
          `So $\\symx$ goes $${xs.map((x) => num(round(x, 3))).join(',\\ ')},\\ \\dots$ (to three decimals).`,
          meaning[want]!,
        ],
      };
    },
  },
];
