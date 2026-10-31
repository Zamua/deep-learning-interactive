import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, pick, round, traps } from '../../kit';
import { dd, n } from '../kit';

const sig = (x: number) => 1 / (1 + Math.exp(-x));
const UP = dd('f', '\\sigma');
const DX = dd('f', 'x');
/** Two significant figures, for small gradients. */
const sig2 = (v: number) => Number(v.toPrecision(2));

export const generators: Generator[] = [
  {
    id: 'value',
    make(rng, d) {
      const pool = d < 0.35 ? [0, 1, -1, 2, -2] : d < 0.7 ? [1, -1, 2, -2, 3, -3, 0.5, -0.5] : [0.5, -0.5, 1.5, -1.5, 2, -2, 3, -3];
      const x = pick(rng, pool);
      const e = round(Math.exp(-x), 2);
      const v = 1 / (1 + e);
      const eTex = x === 0 ? 'e^{0} = 1' : `e^{${num(-x)}} \\approx ${num(e, 2)}`;
      return {
        prompt: `What is $\\sigma(${num(x)})$? Use $${eTex}$. Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: e / (1 + e), why: 'That is $1 - \\sigma(x)$, which is $\\sigma(-x)$: the sign of $x$ got flipped. The exponent is $-x$.' },
            { value: 1 + e, why: 'That is the denominator, $1 + e^{-x}$. The sigmoid is one over it.' },
            { value: e, why: 'That is $e^{-x}$ alone. Add 1, then take one over the sum.' },
          ],
          2,
        ),
        solution: [
          '$\\sigma(x) = \\dfrac{1}{1 + e^{-x}}$.',
          x < 0
            ? `Here $-x = ${num(-x)}$, so $e^{-x} = e^{${num(-x)}} \\approx ${num(e, 2)}$.`
            : `$e^{-x} = e^{${num(-x)}} ${x === 0 ? '=' : '\\approx'} ${num(e, 2)}$.`,
          `$1 + e^{-x} ${x === 0 ? '=' : '\\approx'} ${num(round(1 + e, 2))}$.`,
          `$\\sigma(${num(x)}) = 1 / ${num(round(1 + e, 2))} \\approx ${num(v, 2)}$. ${x > 0 ? 'Above a half, as every positive input gives.' : x < 0 ? 'Below a half, as every negative input gives.' : 'Exactly a half, the middle of the curve.'}`,
        ],
      };
    },
  },
  {
    id: 'slope',
    make(rng, d) {
      const s = d < 0.35 ? int(rng, 1, 9) / 10 : int(rng, 2, 98) / 100;
      const up = d >= 0.7 ? pick(rng, [2, -2, 3, -3, 4, 5, 0.5, 10]) : 1;
      const local = clean(s * (1 - s));
      const v = clean(up * local);
      const places = d < 0.35 ? 2 : 3;
      const ts = [
        { value: up * s, why: `That ${up === 1 ? 'is' : 'uses'} the output $\\sigma$ itself. The slope multiplies it by $1 - \\sigma$.` },
        { value: up * (1 - s), why: 'That uses only the second factor, $1 - \\sigma$. The slope is $\\sigma(1 - \\sigma)$.' },
        { value: up * (1 - s * s), why: 'That uses $1 - \\sigma^{2}$. The slope is $\\sigma$ times $1 - \\sigma$, not 1 minus $\\sigma$ squared.' },
      ];
      if (up !== 1) ts.push({ value: local, why: 'That is the local slope alone. Multiply it by the gradient arriving from above.' });
      return {
        prompt:
          up === 1
            ? `A sigmoid node outputs $\\sigma(x) = ${num(s)}$. What is $\\dfrac{d\\sigma}{dx}$? Round to ${places === 2 ? 'two' : 'three'} decimals.`
            : `A sigmoid node outputs $\\sigma(x) = ${num(s)}$, with $${UP} = ${num(up)}$. What is $${DX}$? Round to three decimals.`,
        answer: { kind: 'number', value: v, places },
        traps: traps(v, ts, places),
        solution: [
          'The sigmoid\'s slope comes from its own output: $\\dfrac{d\\sigma}{dx} = \\sigma(1 - \\sigma)$.',
          `$${num(s)} \\times (1 - ${num(s)}) = ${num(s)} \\times ${num(clean(1 - s))} = ${num(local)}$.`,
          ...(up === 1 ? [] : [`Times the gradient from above: $${num(up)} \\times ${num(local)} = ${num(v)}$.`]),
        ],
      };
    },
  },
  {
    id: 'peak',
    make(rng, d) {
      const g = pick(rng, d < 0.5 ? [1, 2, 4, 8, 12, 20] : [0.4, 2.4, 6, 10, 16, 3, 0.8, 100]);
      const v = clean(g / 4);
      const atZero = d >= 0.5 && rng.int(2) === 0;
      return {
        prompt: atZero
          ? `A sigmoid node's input is $x = 0$, with $${UP} = ${num(g)}$. What is $${DX}$?`
          : `A sigmoid node has $${UP} = ${num(g)}$. Whatever its input $x$, what is the largest $${DX}$ can be?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: g, why: 'That passes the gradient through unchanged. The sigmoid\'s slope is never more than $0.25$.' },
          { value: g / 2, why: '$0.5$ is $\\sigma(0)$, the output at $x = 0$, not the slope. The slope there is $0.5 \\times (1 - 0.5) = 0.25$.' },
          { value: 0, why: 'That is the slope far from $0$, where the curve is flat. At $x = 0$ it is steepest.' },
        ]),
        solution: [
          `${atZero ? '' : 'The slope $\\sigma(1 - \\sigma)$ is largest where $\\sigma = 0.5$, at $x = 0$. '}At $x = 0$, $\\sigma = 0.5$, so the slope is $0.5 \\times 0.5 = 0.25$.`,
          `So $${DX} = 0.25 \\times ${num(g)} = ${num(v)}$${atZero ? '' : ', and anywhere else it is smaller'}.`,
        ],
      };
    },
  },
  {
    id: 'saturated',
    make(rng, d) {
      const x = pick(rng, d < 0.5 ? [4, 5, 6, 7, 8] : [4, 5, 6, 7, 8, -4, -5, -6, -7, -8]);
      const s = round(sig(x), 4);
      const g = pick(rng, [1, 2, 3, 5, 10]);
      const tiny = sig2(g * s * (1 - s));
      const options = [`About $${num(tiny)}$: almost none of it`, `About $${num(g)}$: nearly all of it`, `About $${num(clean(g / 4))}$: a quarter of it`];
      return {
        prompt: `A sigmoid node's input is $x = ${num(x)}$, where $\\sigma(x) \\approx ${num(s, 4)}$, and $${UP} = ${num(g)}$. How much of that gradient reaches $x$?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [
            null,
            `That multiplies by ${x > 0 ? '$\\sigma$' : '$1 - \\sigma$'} alone, which is near 1. The slope is $\\sigma(1 - \\sigma)$, and ${x > 0 ? '$1 - \\sigma$' : '$\\sigma$'} is near 0.`,
            'A quarter is the slope\'s largest value, at $x = 0$. Far from 0 the curve is flat and the slope is much smaller.',
          ],
        },
        solution: [
          `The local slope is $\\sigma(1 - \\sigma) \\approx ${num(s, 4)} \\times ${num(clean(1 - s), 4)} \\approx ${num(sig2(s * (1 - s)))}$.`,
          `Times the upstream $${num(g)}$: about $${num(tiny)}$. The sigmoid is saturated: ${x > 0 ? 'stuck near 1' : 'stuck near 0'}, it passes almost no gradient back.`,
        ],
      };
    },
  },
];
