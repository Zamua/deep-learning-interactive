import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { clean, nonzero, paren, tenth, traps, whys } from '../kit';

const M_RULE = 'm \\leftarrow \\beta_1 m + (1 - \\beta_1)\\,\\symg';
const V_RULE = 'v \\leftarrow \\beta_2 v + (1 - \\beta_2)\\,\\symg^2';

export const generators: Generator[] = [
  {
    id: 'moments',
    make(rng, d) {
      const askM = rng.next() < 0.6;
      const b1 = d < 0.7 ? 0.9 : pick(rng, [0.8, 0.9]);
      const b2 = d < 0.7 ? 0.999 : pick(rng, [0.99, 0.999]);
      const g = d < 0.35 ? int(rng, 1, 5) : d < 0.7 ? nonzero(rng, -5, 5) : tenth(rng, -3, 3);
      const fresh = d < 0.35;
      const m0 = fresh ? 0 : d < 0.7 ? pick(rng, [0.5, 1, -0.5, 2, 0.2]) : tenth(rng, -2, 2);
      const v0 = fresh ? 0 : pick(rng, [0.01, 0.04, 0.1, 0.5, 1]);
      const m = clean(b1 * m0 + (1 - b1) * g);
      const v = clean(b2 * v0 + (1 - b2) * g * g);
      const ans = askM ? m : v;
      const beta = askM ? `\\beta_1 = ${num(b1)}` : `\\beta_2 = ${num(b2)}`;
      return {
        prompt: `${fresh ? `Adam starts from $m = v = 0$ with $${beta}$. The first gradient` : `In Adam, ${askM ? `$m = ${num(m0)}$` : `$v = ${num(v0)}$`} and $${beta}$. The new gradient`} is $\\symg = ${num(g)}$. What is ${askM ? '$m$' : '$v$'} after the update?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, askM
          ? [
              { value: g, why: 'That is the raw gradient. $m$ is a running average, so it moves only part of the way toward $\\symg$.' },
              { value: b1 * g + (1 - b1) * m0, why: 'That swaps the weights: the old average keeps $\\beta_1$, and the new gradient gets $1 - \\beta_1$.' },
              { value: b1 * m0 + g, why: 'That adds the whole gradient. It is scaled by $1 - \\beta_1$ first.' },
            ]
          : [
              { value: b2 * v0 + (1 - b2) * g, why: 'That averages $\\symg$ itself. The second moment averages the squared gradient, $\\symg^2$.' },
              { value: g * g, why: 'That is the raw squared gradient. $v$ is a running average, so it moves only part of the way toward $\\symg^2$.' },
              { value: b2 * g * g + (1 - b2) * v0, why: 'That swaps the weights: the old average keeps $\\beta_2$, and the new $\\symg^2$ gets $1 - \\beta_2$.' },
            ]),
        solution: askM
          ? [
              `The update: $${M_RULE}$.`,
              `$m = ${num(b1)} \\times ${paren(m0)} + ${num(clean(1 - b1))} \\times ${paren(g)}$.`,
              `$= ${num(clean(b1 * m0))} + ${paren(clean((1 - b1) * g))} = ${num(m)}$.`,
              fresh ? 'Starting from 0, $m$ is only a tenth of the gradient: far too small.' : `It moved ${b1 === 0.9 ? 'a tenth' : 'a fifth'} of the way from $${num(m0)}$ toward the gradient $${num(g)}$.`,
            ]
          : [
              `The update: $${V_RULE}$.`,
              `$\\symg^2 = ${num(clean(g * g))}$.`,
              `$v = ${num(b2)} \\times ${num(v0)} + ${num(clean(1 - b2))} \\times ${num(clean(g * g))}$.`,
              `$= ${num(clean(b2 * v0))} + ${num(clean((1 - b2) * g * g))} = ${num(v)}$.`,
              fresh ? 'Starting from 0, $v$ is far below $\\symg^2$: far too small.' : '$v$ tracks how large this parameter\'s gradients usually are, whatever their sign.',
            ],
      };
    },
  },
  {
    id: 'two-steps',
    make(rng, d) {
      const b1 = d < 0.7 ? 0.9 : pick(rng, [0.8, 0.9]);
      const k = clean(1 - b1);
      const g1 = d < 0.35 ? int(rng, 1, 5) : nonzero(rng, -5, 5);
      const g2 = d < 0.35 ? nonzero(rng, -5, 5) : nonzero(rng, -6, 6);
      const m1 = clean(k * g1);
      const m2 = clean(b1 * m1 + k * g2);
      return {
        prompt: `Adam starts from $m = 0$ with $\\beta_1 = ${num(b1)}$. The first two gradients are $${num(g1)}$ and then $${num(g2)}$. What is $m$ after both updates?`,
        answer: { kind: 'number', value: m2 },
        traps: traps(m2, [
          { value: m1, why: 'That is $m$ after the first update. Apply the rule once more, with the second gradient.' },
          { value: (g1 + g2) / 2, why: 'That is the plain mean of the two gradients. $m$ starts from 0 and takes only a share $1 - \\beta_1$ of each new gradient.' },
          { value: k * (g1 + g2), why: `That gives both gradients the same weight, $${num(k)}$. By the second update the first one's share has been kept at $\\beta_1$ once more: $${num(clean(b1 * k))}$.` },
          { value: k * g2, why: 'That starts the second update from 0. It starts from $m$ after the first update.' },
        ]),
        solution: [
          `The update: $${M_RULE}$.`,
          `Update 1, from $m = 0$: $m = ${num(b1)} \\times 0 + ${num(k)} \\times ${paren(g1)} = ${num(m1)}$.`,
          `Update 2: $m = ${num(b1)} \\times ${paren(m1)} + ${num(k)} \\times ${paren(g2)}$.`,
          `$= ${num(clean(b1 * m1))} + ${paren(clean(k * g2))} = ${num(m2)}$.`,
        ],
      };
    },
  },
  {
    id: 'track',
    make(rng) {
      const G = pick(rng, [2, 3, 4, 5, 10, 0.5]);
      const S = rng.next() < 0.7 ? G : -G;
      const G2 = clean(G * G);
      const steadyFirst = rng.next() < 0.5;
      const [st, fl] = steadyFirst ? ['a', 'b'] : ['b', 'a'];
      const pair = (mS: number, vS: number, mF: number, vF: number) => {
        const one = (p: string, m: number, v: number) => `$${p}$: $m \\approx ${num(m)}$, $v \\approx ${num(v)}$`;
        return steadyFirst ? `${one(st, mS, vS)}; ${one(fl, mF, vF)}` : `${one(fl, mF, vF)}; ${one(st, mS, vS)}`;
      };
      const opts = [pair(S, G2, 0, G2), pair(S, G2, 0, 0), pair(S, G2, S, G2), pair(S, G, 0, G)];
      const reasons = [
        '',
        `$v$ averages the squared gradient, and $(${num(-G)})^2 = ${num(G)}^2 = ${num(G2)}$: the flips do not cancel inside $v$.`,
        `$m$ averages the gradient with its sign: each $${num(-G)}$ undoes the $${num(G)}$ before it, so $${fl}$'s $m$ stays near 0.`,
        `$v$ averages the squared gradient, $${num(G2)}$, not the gradient's size, $${num(G)}$.`,
      ];
      const flips = `flipped between $${num(G)}$ and $${num(-G)}$`;
      return {
        prompt: `For thousands of steps, parameter $${st}$'s gradient has been $${num(S)}$ every step, while parameter $${fl}$'s has ${flips}. With Adam's $\\beta_1 = 0.9$ and $\\beta_2 = 0.999$, about where have their $m$ and $v$ settled?`,
        answer: { kind: 'choice', options: opts, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `A steady gradient of $${num(S)}$: $m$ levels off where $0.9\\,m + 0.1 \\times ${paren(S)} = m$, at $m = ${num(S)}$.`,
          `Its square is $${num(G2)}$ every step, so its $v$ levels off at $${num(G2)}$.`,
          `A gradient that ${flips}: each push undoes the last inside $m$, so $m$ stays near 0.`,
          `Its squares are all $${num(G2)}$, so its $v$ still heads to $${num(G2)}$. $m$ tracks the direction; $v$ tracks the size.`,
        ],
      };
    },
  },
];
