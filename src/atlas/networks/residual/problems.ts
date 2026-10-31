import type { Generator } from '../../../mastery/domain/types';
import { clean, int, nonzero, num, par, pick, shuffled, traps } from '../../kit';

export const generators: Generator[] = [
  {
    id: 'grad',
    make(rng, d) {
      const g = d < 0.35 ? int(rng, 1, 5) : nonzero(rng, -4, 4);
      const a = d < 0.35 ? int(rng, 0, 3) : pick(rng, [-0.5, 0.5, 0.1, 2, -1, 1.5]);
      const v = clean(g * (1 + a));
      return {
        prompt: `A residual block has a scalar input $\\symx$ and output $y$. At the current value, $F'(\\symx) = ${num(a)}$ and the gradient arriving at $y$ is $\\symg = ${g}$. What gradient reaches $\\symx$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(g * a), why: 'That is only the path through $F$. The shortcut sends $\\symg$ back too, unchanged.' },
          { value: g, why: 'That is only the shortcut. The path through $F$ adds $\\symg F\'$.' },
          { value: clean(g + a), why: 'That adds the slope to the gradient. The path through $F$ multiplies: $\\symg \\cdot F\'$.' },
        ]),
        solution: [
          '$y = \\symx + F(\\symx)$ is a sum, so the gradient reaches $\\symx$ along both paths, and they add.',
          `Shortcut: $\\symg = ${g}$. Through $F$: $\\symg \\cdot F' = ${par(g)} \\times ${par(a)} = ${num(clean(g * a))}$.`,
          `Total: $\\symg\\,(1 + F') = ${par(g)} \\times ${num(clean(1 + a))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'grad-stack',
    make(rng, d) {
      const g = d < 0.35 ? int(rng, 1, 4) : nonzero(rng, -3, 3);
      const a = d < 0.35 ? int(rng, 0, 2) : pick(rng, [-0.5, 0.5, 1, 2, 0.1]);
      const b = d < 0.35 ? int(rng, 0, 2) : pick(rng, [-0.5, 0.5, 1, 0, 0.2]);
      const mid = clean(g * (1 + b));
      const v = clean(mid * (1 + a));
      return {
        prompt: `Two residual blocks are stacked: $h = \\symx + F_1(\\symx)$, then $y = h + F_2(h)$, all scalars. At the current values $F_1$ has slope $${num(a)}$, $F_2$ has slope $${num(b)}$, and the gradient arriving at $y$ is $\\symg = ${g}$. What gradient reaches $\\symx$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: g * a * b, why: 'That drops both shortcuts. Each block passes the gradient back through $1 + F\'$, not just $F\'$.' },
          { value: g * (1 + a + b), why: `That adds the slopes. The blocks are in a chain, so their factors multiply: $(1 + ${par(a)})(1 + ${par(b)})$.` },
          { value: mid, why: 'That stops at $h$, after block 2. Block 1 multiplies the gradient again on its way to $\\symx$.' },
          { value: g, why: 'That keeps only the shortcuts. The paths through $F_1$ and $F_2$ add to the gradient too.' },
        ]),
        solution: [
          'Walking back from $y$, each block multiplies the gradient by $1$ plus its slope: block 2 first, then block 1.',
          `Through block 2: $\\symg \\, (1 + ${par(b)}) = ${par(g)} \\times ${num(clean(1 + b))} = ${num(mid)}$. That reaches $h$.`,
          `Through block 1: $${num(mid)} \\times (1 + ${par(a)}) = ${par(mid)} \\times ${num(clean(1 + a))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'why-deep',
    make(rng) {
      const plain = pick(rng, [34, 56, 110, 152]);
      const shallow = pick(rng, [18, 20]);
      const per = pick(rng, [2, 3]);
      const gradRight = rng.int(2) === 0;
      return {
        prompt: `A plain ${plain}-layer network trains worse than ${shallow === 18 ? 'an' : 'a'} ${shallow}-layer one, even on its training data. Wrapping every ${per} layers in a residual block fixes it. Which of these is a reason it helps?`,
        answer: shuffled(rng, [
          gradRight
            ? { text: 'The gradient reaches early layers along the shortcuts, undiminished', why: null }
            : { text: 'A block can pass its input through unchanged by learning $F(\\symx) = 0$', why: null },
          { text: 'The shortcuts add parameters, so the deeper network can fit more', why: 'An identity shortcut has no parameters at all: it adds $\\symx$ as it is.' },
          { text: 'The shortcuts skip layers, so the network computes less and trains faster', why: 'Every layer still runs: the shortcut adds $\\symx$ to $F(\\symx)$, it does not replace $F$.' },
          { text: 'The shortcuts take the place of the ReLUs, so nothing gets set to zero', why: 'The layers inside $F$ keep their ReLUs; the shortcut is added around them, not instead of them.' },
        ]),
        solution: [
          'Backward, the sum sends the gradient along the shortcut unchanged: each block multiplies it by $1 + F\'$, not by $F\'$ alone, so it does not fade across many blocks.',
          'Forward, a block that has nothing useful to add can learn $F(\\symx) = 0$ and leave its input alone, so extra blocks need not make things worse.',
        ],
      };
    },
  },
];
