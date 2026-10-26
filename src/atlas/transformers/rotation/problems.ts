import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { clean, k, q, vecT, vtraps } from '../kit';
import { cs, deg, pair, rot, times, TRIG } from './trig';

/** Two nonzero entries of different sizes, so a swap or a sign flip always shows. */
function lopsided(rng: Rng): number[] {
  for (;;) {
    const p = [int(rng, -4, 5), int(rng, -4, 5)];
    if (p[0] !== 0 && p[1] !== 0 && Math.abs(p[0]!) !== Math.abs(p[1]!)) return p;
  }
}

export const generators: Generator[] = [
  {
    id: 'rotate',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [90, 180, 270]) : d < 0.7 ? pick(rng, [90, 270, 60, 30]) : pick(rng, [30, 45, 60, 120, 135, 150]);
      const p = d < 0.35 ? pair(rng, 0, 4) : pair(rng, -3, 4);
      const [c, s] = TRIG[a]!;
      const v = rot(p, a);
      const places = a % 90 === 0 ? undefined : 2;
      const query = rng.int(2) === 0;
      return {
        prompt: `One pair of a ${query ? 'query' : 'key'} is $${query ? q : k} = ${vecT(p)}$. What is it after a $${deg(a)}$ rotation?${places ? ' Round to two decimals.' : ''}\n\nUse ${cs(a)}.`,
        answer: { kind: 'vector', value: v, places },
        traps: vtraps(v, [
          { value: [clean(p[0]! * c + p[1]! * s), clean(-p[0]! * s + p[1]! * c)], why: 'That turns it the other way, clockwise. The minus sign belongs on $b\\sin{}$ in the first entry: $[a\\cos{} - b\\sin{},\\ a\\sin{} + b\\cos{}]$.' },
          { value: [clean(p[0]! * s - p[1]! * c), clean(p[0]! * c + p[1]! * s)], why: 'That swaps the cosine and the sine. The first entry is $a\\cos{} - b\\sin{}$.' },
          { value: [clean(p[0]! * c), clean(p[1]! * c)], why: 'That only scales each entry by the cosine. Each entry also mixes in the other one, times the sine.' },
        ], places),
        solution: [
          `A turn sends $[a,\\ b]$ to $[a\\cos{} - b\\sin{},\\ a\\sin{} + b\\cos{}]$, here with $\\cos = ${num(c)}$ and $\\sin = ${num(s)}$.`,
          `First entry: $${times(p[0]!, c)} - ${times(p[1]!, s)} = ${num(v[0]!)}$.`,
          `Second entry: $${times(p[0]!, s)} + ${times(p[1]!, c)} = ${num(v[1]!)}$.`,
          `So the pair turns to $${vecT(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'basis',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [90, 180, 270]) : pick(rng, d < 0.7 ? [30, 45, 60, 90, 120] : [30, 45, 60, 120, 135, 150]);
      const m = d < 0.35 ? 1 : pick(rng, d < 0.7 ? [1, 1, 2, 3] : [1, 2, 3, -1, -2]);
      const [c, s] = TRIG[a]!;
      const at = (x: number, y: number) => [clean(m * x), clean(m * y)];
      const v = at(-s, c);
      const start = [0, m];
      return {
        prompt: `A rotation turns $[1,\\ 0]$ to $${vecT([c, s])}$. Where does the same rotation turn $${vecT(start)}$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: at(s, c), why: 'That swaps the entries without flipping a sign. A quarter turn on from $[\\cos, \\sin]$ is $[-\\sin, \\cos]$.' },
          { value: at(c, s), why: `That is where $${vecT([m, 0])}$ goes. $${vecT(start)}$ points a quarter turn further round, so it lands a quarter turn past it.` },
          { value: at(s, -c), why: 'That flips the second sign, which turns a quarter turn the other way. A quarter turn on from $[\\cos, \\sin]$ is $[-\\sin, \\cos]$.' },
        ]),
        solution: [
          `$[1,\\ 0]$ turns to $[\\cos, \\sin]$, so here $\\cos = ${num(c)}$ and $\\sin = ${num(s)}$.`,
          `$[0,\\ 1]$ is $[1,\\ 0]$ turned a quarter turn, so it lands a quarter turn past $[\\cos, \\sin]$: swap the entries and flip the first sign, $[-\\sin, \\cos] = ${vecT([clean(-s), c])}$.`,
          ...(m === 1 ? [] : [`$${vecT(start)}$ is $${m}$ times $[0,\\ 1]$, so it lands at $${m} \\times ${vecT([clean(-s), c])} = ${vecT(v)}$.`]),
        ],
      };
    },
  },
  {
    id: 'quarter',
    make(rng) {
      const [a, b] = lopsided(rng) as [number, number];
      const query = rng.int(2) === 0;
      const name = query ? q : k;
      const right = [-b, a];
      const wrong: [number[], string][] = [
        [[b, -a], 'That turns it a quarter turn the other way, clockwise. Counterclockwise, the first entry takes the minus sign: $[a, b] \\to [-b, a]$.'],
        [[b, a], 'That swaps the entries but flips no sign. A quarter turn also flips the sign of the new first entry: $[-b, a]$.'],
        [[-a, b], 'That flips a sign without swapping. A quarter turn swaps the entries too: $[a, b] \\to [-b, a]$.'],
      ];
      const order = rng.shuffle([0, 1, 2, 3]);
      const all: [number[], string | null][] = [[right, null], ...wrong];
      return {
        prompt: `One pair of a ${query ? 'query' : 'key'} is $${name} = ${vecT([a, b])}$. Where does a quarter turn, $90^\\circ$, take it?`,
        answer: { kind: 'choice', options: order.map((i) => `$${vecT(all[i]![0])}$`), correct: order.indexOf(0), why: order.map((i) => all[i]![1]) },
        solution: [
          'A quarter turn swaps the entries and flips the sign of the new first one: $[a, b] \\to [-b, a]$.',
          `Swap: $${vecT([b, a])}$. Flip the first sign: $${vecT(right)}$.`,
          `Check with $\\cos 90^\\circ = 0$ and $\\sin 90^\\circ = 1$: $[${times(a, 0)} - ${times(b, 1)},\\ ${times(a, 1)} + ${times(b, 0)}] = ${vecT(right)}$.`,
        ],
      };
    },
  },
];
