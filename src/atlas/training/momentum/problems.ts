import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { clean, minus, nonzero, paren, tenth, traps, whys } from '../kit';

const RULE = '$\\symv \\leftarrow \\mu\\symv - \\symeta\\symg$, then $\\symw \\leftarrow \\symw + \\symv$';
const plus = (a: number, b: number) => `${num(clean(a))} ${b < 0 ? '-' : '+'} ${num(clean(Math.abs(b)))}`;

export const generators: Generator[] = [
  {
    id: 'one-step',
    make(rng, d) {
      const w = d < 0.7 ? int(rng, d < 0.35 ? 0 : -3, 4) : tenth(rng, -2, 2);
      const v0 = d < 0.35 ? pick(rng, [0, 1, -1, 2]) : d < 0.7 ? nonzero(rng, -3, 3) : tenth(rng, -1, 1);
      const g = d < 0.35 ? int(rng, 1, 5) : d < 0.7 ? nonzero(rng, -5, 5) : tenth(rng, -3, 3);
      const mu = pick(rng, d < 0.35 ? [0.5, 0.9] : [0.5, 0.8, 0.9]);
      const eta = pick(rng, d < 0.35 ? [0.1, 0.5, 1] : [0.1, 0.2, 0.5]);
      const v1 = clean(mu * v0 - eta * g);
      const w1 = clean(w + v1);
      const askV = rng.next() < 0.4;
      const ans = askV ? v1 : w1;
      const base = askV ? 0 : w;
      return {
        prompt: `A weight at $\\symw = ${num(w)}$ has velocity $\\symv = ${num(v0)}$ and gradient $\\symg = ${num(g)}$. With $\\mu = ${num(mu)}$ and $\\symeta = ${num(eta)}$, what is ${askV ? '$\\symv$' : '$\\symw$'} after one momentum step?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: base - eta * g, why: 'That is a plain gradient step: it ignores the velocity already built up.' },
          { value: base + v0 - eta * g, why: 'That keeps all of the old velocity. It decays first: $\\mu\\symv$, not $\\symv$.' },
          { value: base + mu * v0 + eta * g, why: 'That adds $\\symeta\\symg$. The new push is against the gradient: $-\\symeta\\symg$.' },
          ...(askV ? [] : [{ value: w + v0, why: 'That moves by the old velocity. Update $\\symv$ first, then move by the new one.' }]),
        ]),
        solution: [
          `The update: ${RULE}.`,
          `New velocity: $\\symv = \\mu\\symv - \\symeta\\symg = ${num(mu)} \\times ${paren(v0)} - ${num(eta)} \\times ${paren(g)} = ${minus(clean(mu * v0), clean(eta * g))} = ${num(v1)}$.`,
          ...(askV ? [] : [`Move by it: $\\symw = ${plus(w, v1)} = ${num(w1)}$.`]),
          v0 === 0 ? 'From rest the first momentum step is the same as a plain gradient step.' : `The old velocity carried $${num(clean(mu * v0))}$ into this step on top of the new push $${num(clean(-eta * g))}$.`,
        ],
      };
    },
  },
  {
    id: 'two-steps',
    make(rng, d) {
      const w0 = d < 0.5 ? int(rng, 0, 4) : tenth(rng, -2, 2);
      const g1 = d < 0.35 ? int(rng, 1, 4) : nonzero(rng, -4, 4);
      const g2 = d < 0.35 ? int(rng, 1, 4) : nonzero(rng, -4, 4);
      const mu = pick(rng, [0.5, 0.9]);
      const eta = pick(rng, d < 0.35 ? [0.1, 0.5] : [0.1, 0.2, 0.5]);
      const v1 = clean(-eta * g1);
      const w1 = clean(w0 + v1);
      const v2 = clean(mu * v1 - eta * g2);
      const w2 = clean(w1 + v2);
      const askV = d >= 0.5 && rng.next() < 0.4;
      const ans = askV ? v2 : w2;
      return {
        prompt: `Momentum starts from $\\symv = 0$ with $\\symw = ${num(w0)}$, $\\mu = ${num(mu)}$ and $\\symeta = ${num(eta)}$. The gradient is $${num(g1)}$ at the first step and $${num(g2)}$ at the second. What is ${askV ? 'the velocity $\\symv$ after the second step' : '$\\symw$ after two steps'}?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, askV
          ? [
              { value: -eta * g2, why: 'That is only the new push. The velocity also keeps $\\mu$ times the first one.' },
              { value: v1 - eta * g2, why: 'That keeps all of the first velocity. It decays by $\\mu$ first.' },
            ]
          : [
              { value: w0 - eta * (g1 + g2), why: 'That is two plain gradient steps. With momentum the second step also carries $\\mu$ times the first velocity.' },
              { value: w1 + v1 - eta * g2, why: 'That keeps all of the first velocity in the second step. It decays by $\\mu$ first.' },
              { value: w0 + v2, why: 'That leaves out the first step\'s move. The weight moves by $\\symv$ at both steps.' },
            ]),
        solution: [
          `The update: ${RULE}.`,
          `Step 1: $\\symv = -${num(eta)} \\times ${paren(g1)} = ${num(v1)}$, so $\\symw = ${plus(w0, v1)} = ${num(w1)}$.`,
          `Step 2: $\\symv = ${num(mu)} \\times ${paren(v1)} - ${num(eta)} \\times ${paren(g2)} = ${num(v2)}$${askV ? '.' : `, so $\\symw = ${plus(w1, v2)} = ${num(w2)}$.`}`,
          `A plain gradient step would have moved $${num(clean(-eta * g2))}$ at step 2; momentum adds $${num(clean(mu * v1))}$ carried from step 1.`,
        ],
      };
    },
  },
  {
    id: 'damp',
    make(rng, d) {
      const steady = rng.int(2);
      const flip = 1 - steady;
      const n = d < 0.5 ? 4 : 5;
      const sgn = pick(rng, [1, -1]);
      const gs = Array.from({ length: n }, () => sgn * int(rng, 1, 4));
      const s0 = pick(rng, [1, -1]);
      const gf = Array.from({ length: n }, (_, i) => (i % 2 ? -s0 : s0) * int(rng, 2, 5));
      const seq = [steady === 0 ? gs : gf, steady === 0 ? gf : gs];
      const mu = pick(rng, [0.8, 0.9, 0.95]);
      const wi = (i: number) => `$\\symw_{${i}}$`;
      const opts = [
        `Bigger steps along ${wi(0)}, smaller along ${wi(1)}`,
        'Bigger steps along both',
        'Smaller steps along both',
        `Smaller steps along ${wi(0)}, bigger along ${wi(1)}`,
      ];
      const correct = steady === 0 ? 0 : 3;
      const reasons = [
        'That is backwards: pushes that agree add up in $\\symv$, and pushes that alternate cancel.',
        `Along ${wi(flip)} the gradient flips sign every step, so each push undoes the last inside $\\symv$: those steps shrink.`,
        `Along ${wi(steady)} every push points the same way, so they pile up in $\\symv$: those steps grow, toward $1/(1-\\mu)$ times a plain step.`,
        'That is backwards: pushes that agree add up in $\\symv$, and pushes that alternate cancel.',
      ];
      return {
        prompt: `Two weights get these gradients over ${n} steps:\n\n$\\symw_{0}$: $${seq[0]!.map((g) => num(g)).join(',\\ ')}$\n\n$\\symw_{1}$: $${seq[1]!.map((g) => num(g)).join(',\\ ')}$\n\nCompared with plain gradient descent at the same $\\symeta$, what does momentum with $\\mu = ${num(mu)}$ do to the steps along each?`,
        answer: { kind: 'choice', options: opts, correct, why: whys(4, correct, (i) => reasons[i]!) },
        solution: [
          `The velocity keeps $\\mu = ${num(mu)}$ of itself each step and adds the new push $-\\symeta\\symg$.`,
          `${wi(steady)}'s gradients keep one sign, so the pushes add up: its velocity grows past a single plain step.`,
          `${wi(flip)}'s gradients alternate, so each push mostly cancels the velocity left by the last: the zigzag is damped.`,
        ],
      };
    },
  },
  {
    id: 'terminal',
    make(rng, d) {
      const mu = pick(rng, [0.5, 0.75, 0.8, 0.9, 0.95, 0.99]);
      const factor = clean(1 / (1 - mu));
      if (d < 0.4) {
        return {
          prompt: `Under momentum with $\\mu = ${num(mu)}$, the gradient stays the same, step after step. The velocity settles at how many times a plain gradient step $-\\symeta\\symg$? Round to two decimals if needed.`,
          answer: { kind: 'number', value: factor, places: 2 },
          traps: traps(factor, [
            { value: 1, why: 'Momentum does change the size: the pushes pile up in $\\symv$ until the decay balances them.' },
            { value: 1 / mu, why: 'That divides by $\\mu$. The velocity settles where $\\symv = \\mu\\symv - \\symeta\\symg$, which gives $1/(1-\\mu)$.' },
            { value: 1 - mu, why: 'That is the share of velocity lost each step. Its reciprocal, $1/(1-\\mu)$, is the speed-up.' },
          ]),
          solution: [
            'The velocity stops changing when $\\symv = \\mu\\symv - \\symeta\\symg$.',
            'Solve: $\\symv(1 - \\mu) = -\\symeta\\symg$, so $\\symv = -\\symeta\\symg / (1 - \\mu)$.',
            `That is $1/(1 - ${num(mu)}) = ${num(factor)}$ times a plain step.`,
          ],
        };
      }
      const eta = pick(rng, [0.01, 0.1, 0.2, 0.5]);
      const g = d < 0.7 ? nonzero(rng, -5, 5) : tenth(rng, -3, 3);
      const v = clean((-eta * g) / (1 - mu));
      return {
        prompt: `Under momentum with $\\mu = ${num(mu)}$ and $\\symeta = ${num(eta)}$, the gradient stays at $\\symg = ${num(g)}$ step after step. What value does $\\symv$ approach? Round to three decimals if needed.`,
        answer: { kind: 'number', value: v, places: 3 },
        traps: traps(v, [
          { value: -eta * g, why: 'That is a single plain step. The pushes pile up in $\\symv$ until the decay balances them, at $1/(1-\\mu)$ times that.' },
          { value: (eta * g) / (1 - mu), why: 'That has the wrong sign: every push is $-\\symeta\\symg$, against the gradient.' },
          { value: (-eta * g) / mu, why: 'That divides by $\\mu$. The steady state $\\symv = \\mu\\symv - \\symeta\\symg$ gives $\\symv = -\\symeta\\symg / (1 - \\mu)$.' },
        ]),
        solution: [
          'The velocity stops changing when $\\symv = \\mu\\symv - \\symeta\\symg$, so $\\symv = -\\symeta\\symg / (1 - \\mu)$.',
          `Here: $-${num(eta)} \\times ${paren(g)} / (1 - ${num(mu)}) = ${num(clean(-eta * g))} / ${num(clean(1 - mu))} = ${num(v)}$.`,
          `That is $${num(factor)}$ times a plain step.`,
        ],
      };
    },
  },
];
