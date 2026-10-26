import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { ints, num, round, vec } from '../../kit';

const E = (x: number) => round(Math.exp(x), 2);

/** Whole-number scores, the exponentials the prompt gives, their total T and the asked score j. */
function setup(rng: Rng, d: number) {
  const n = d < 0.7 ? 3 : 4;
  const s = d < 0.35 ? ints(rng, n, 0, 2) : ints(rng, n, -1, 3);
  const e = s.map(E);
  const T = round(e.reduce((a, b) => a + b, 0), 2);
  const y = rng.int(n);
  const j = rng.next() < 0.5 ? y : (y + 1 + rng.int(n - 1)) % n;
  const use = `Use ${[...new Set(s)].sort((a, b) => b - a).map((v) => `$e^{${v}} \\approx ${num(E(v), 2)}$`).join(', ')}.`;
  return { n, s, e, T, y, j, use };
}

const dLds = (j: number) => `\\partial \\symL / \\partial \\syms_{${j}}`;
const dlogT = (j: number) => `\\partial \\log T / \\partial \\syms_{${j}}`;
const total = (o: ReturnType<typeof setup>) => `$T = ${o.e.map((v) => num(v, 2)).join(' + ')} = ${num(o.T, 2)}$`;

export const generators: Generator[] = [
  {
    id: 'from-scores',
    make(rng, d) {
      const o = setup(rng, d);
      const { j, y } = o;
      const same = j === y;
      const p = o.e[j]! / o.T;
      const v = p - (same ? 1 : 0);
      const pr = round(p, 2);
      const ts = [
        same
          ? { value: p, why: `That is $\\symp_{${j}}$ alone, the part from $\\log T$. Option ${j} is the correct option, so $-\\syms_{\\symy}$ adds $-1$ too.` }
          : { value: p - 1, why: `That subtracts 1 at option ${j}. The $-1$ comes from $-\\syms_{\\symy}$, which holds only the correct score, $\\syms_{${y}}$.` },
        { value: 1 / o.T - (same ? 1 : 0), why: 'That uses $1/T$ as the slope of $\\log T$, leaving out how fast $T$ moves with the score: the chain rule multiplies by $e^{\\syms_j}$ too.' },
        { value: o.e[j]! - (same ? 1 : 0), why: 'That uses $e^{\\syms_j}$, how fast $T$ moves, and leaves out the slope of the log, $1/T$.' },
      ];
      return {
        prompt: `The scores are $\\syms = ${vec(o.s)}$, and the correct option is $\\symy = ${y}$, counting from 0. For the cross-entropy loss $\\symL$, what is $${dLds(j)}$? Round to two decimals.\n\n${o.use}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: ts.filter((t) => Math.abs(t.value - v) >= 0.01),
        solution: [
          'Write the loss as $\\symL = -\\syms_{\\symy} + \\log T$, where $T = \\sum_k e^{\\syms_k}$.',
          `Add up the exponentials: ${total(o)}.`,
          `Through $\\log T$: $${dlogT(j)} = e^{\\syms_{${j}}} / T = ${num(o.e[j]!, 2)} / ${num(o.T, 2)} \\approx ${num(pr, 2)}$.`,
          same
            ? `Option ${j} is the correct option, so $-\\syms_{\\symy}$ adds $-1$: $${num(pr, 2)} - 1 = ${num(round(pr - 1, 2), 2)}$.`
            : `Option ${j} is not the correct option (that is ${y}), so $-\\syms_{\\symy}$ does not move with $\\syms_{${j}}$: $${dLds(j)} \\approx ${num(pr, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'log-total',
    make(rng, d) {
      const o = setup(rng, d);
      const { j } = o;
      const v = o.e[j]! / o.T;
      const ts = [
        { value: 1 / o.T, why: 'That is only the slope of the log, $1/T$. The chain rule also multiplies by how fast $T$ moves with the score, $e^{\\syms_j}$.' },
        { value: o.e[j]!, why: 'That is how fast $T$ moves with the score, $e^{\\syms_j}$. The chain rule also multiplies by the slope of the log, $1/T$.' },
        { value: v - 1, why: 'That subtracts 1, which belongs to $-\\syms_{\\symy}$ in the loss. $\\log T$ alone gives just $e^{\\syms_j}/T$.' },
      ];
      return {
        prompt: `The scores are $\\syms = ${vec(o.s)}$, and $T = \\sum_k e^{\\syms_k}$. What is $${dlogT(j)}$? Round to two decimals.\n\n${o.use}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: ts.filter((t) => Math.abs(t.value - v) >= 0.01),
        solution: [
          `$\\syms_{${j}}$ reaches $\\log T$ through a chain: it feeds $T$, and $T$ feeds $\\log T$.`,
          `Only one term of $T$ holds $\\syms_{${j}}$, and $e^x$ is its own derivative: $\\partial T / \\partial \\syms_{${j}} = e^{${o.s[j]}} \\approx ${num(o.e[j]!, 2)}$.`,
          `The log's slope is one over its input: $\\dfrac{d \\log T}{d T} = 1/T$, with ${total(o)}.`,
          `Multiply the two: $${num(o.e[j]!, 2)} / ${num(o.T, 2)} \\approx ${num(round(v, 2), 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'pieces',
    make(rng) {
      const n = 3 + rng.int(2);
      const y = rng.int(n);
      const kind = rng.next();
      if (kind < 0.55) {
        const j = rng.next() < 0.5 ? y : (y + 1 + rng.int(n - 1)) % n;
        const same = j === y;
        const why: (string | null)[] = [
          `$-\\syms_{\\symy}$ holds only the correct score. Option ${j} is not the correct option, so moving $\\syms_{${j}}$ leaves it alone.`,
          `Option ${j} is the correct option: $-\\syms_{${j}}$ falls by exactly as much as $\\syms_{${j}}$ rises.`,
          'That has the wrong sign: the term is minus the score, so raising the score lowers it.',
          'That is the slope of $\\log T$ with a minus sign. $-\\syms_{\\symy}$ holds no exponentials: its slope is $-1$ or 0.',
        ];
        why[same ? 1 : 0] = null;
        return {
          prompt: `The loss is $\\symL = -\\syms_{\\symy} + \\log T$, where $T = \\sum_k e^{\\syms_k}$ over ${n} options, and the correct option is $\\symy = ${y}$, counting from 0. What is $\\partial(-\\syms_{\\symy}) / \\partial \\syms_{${j}}$?`,
          answer: { kind: 'choice', options: ['$0$', '$-1$', '$1$', `$-\\symp_{${j}}$`], correct: same ? 1 : 0, why },
          solution: [
            `$-\\syms_{\\symy}$ is minus the correct score, $-\\syms_{${y}}$, and holds no other score.`,
            same ? `Here $j = ${j}$ is the correct option, so the slope is $-1$.` : `Here $j = ${j}$ is not the correct option, so moving $\\syms_{${j}}$ leaves it alone: the slope is 0.`,
          ],
        };
      }
      const j = rng.int(n);
      const sj = `\\syms_{${j}}`;
      return {
        prompt: `For scores over ${n} options, $T = \\sum_k e^{\\syms_k}$ adds up $e$ to every score. What is $\\partial T / \\partial ${sj}$?`,
        answer: {
          kind: 'choice',
          options: [`$e^{${sj}}$`, '$T$', '$1$', `$${sj}\\, e^{${sj} - 1}$`],
          correct: 0,
          why: [
            null,
            `That is the whole total. Only one of its ${n} terms holds $${sj}$; the others stay put.`,
            'That would be the slope of a plain sum of scores. Each term here is $e$ to a score, which grows as fast as its own value.',
            'That applies the power rule, which is for $x^n$. $e^x$ is its own derivative.',
          ],
        },
        solution: [
          `Only one term of $T$ holds $${sj}$: $e^{${sj}}$. The other terms do not move.`,
          `$e^x$ is its own derivative, so $\\partial T / \\partial ${sj} = e^{${sj}}$.`,
        ],
      };
    },
  },
];
