import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, vec } from '../../kit';
import { clean, dot, nonzero, nonzeros, prods, relu, terms, traps } from '../kit';

interface Neuron {
  w: number[];
  x: number[];
  b: number;
  wx: number;
  z: number;
}

/** Weights, an input and a bias, harder with difficulty; `sign` fixes the sign of the pre-activation. */
function neuron(rng: Rng, d: number, sign?: 1 | -1): Neuron {
  const n = d < 0.5 ? 2 : 3;
  for (;;) {
    const w = d < 0.35 ? ints(rng, n, 0, 3) : d < 0.75 ? ints(rng, n, -3, 3) : nonzeros(rng, n, -3, 5).map((v) => v / 2);
    const x = d < 0.35 ? ints(rng, n, 0, 3) : ints(rng, n, -2, 3);
    const b = d < 0.35 ? int(rng, -6, 2) : nonzero(rng, -4, 4);
    const wx = dot(w, x);
    const z = clean(wx + b);
    if (z === 0 || (sign && Math.sign(z) !== sign)) continue;
    return { w, x, b, wx, z };
  }
}

const preSteps = (N: Neuron) => [
  `Multiply matching entries of $\\symw$ and $\\symx$ and add: $${prods(N.w, N.x)} = ${num(N.wx)}$.`,
  `Add the bias: $z = ${terms([N.wx, N.b])} = ${num(N.z)}$.`,
];

export const generators: Generator[] = [
  {
    id: 'pre',
    make(rng, d) {
      const N = neuron(rng, d, rng.next() < 0.5 ? -1 : 1);
      return {
        prompt: `A neuron has weights $\\symw = ${vec(N.w)}$ and bias $\\symb = ${num(N.b)}$. For the input $\\symx = ${vec(N.x)}$, what is its pre-activation $z = \\symw \\cdot \\symx + \\symb$?`,
        answer: { kind: 'number', value: N.z },
        traps: traps(N.z, [
          { value: N.wx, why: `That is $\\symw \\cdot \\symx$ alone. Add the bias, $${num(N.b)}$.` },
          { value: relu(N.z), why: 'That is the output after the ReLU. The pre-activation is the sum before the bend, and it can be negative.' },
          { value: N.wx - N.b, why: `That subtracts the bias. It is added: $\\symw \\cdot \\symx + \\symb$.` },
        ]),
        solution: [...preSteps(N), N.z < 0 ? 'It is negative, and that is fine: the bend comes afterwards, in the activation.' : 'This is the number the activation will bend.'],
      };
    },
  },
  {
    id: 'out',
    make(rng, d) {
      const N = neuron(rng, d, rng.next() < 0.55 ? -1 : 1);
      const a = relu(N.z);
      const rule = d < 0.5 ? ' computes $a = \\max(0,\\ \\symw \\cdot \\symx + \\symb)$' : ' uses a ReLU activation';
      return {
        prompt: `A neuron${rule}. Its weights are $\\symw = ${vec(N.w)}$ and its bias is $\\symb = ${num(N.b)}$. What is its output $a$ for the input $\\symx = ${vec(N.x)}$?`,
        answer: { kind: 'number', value: a },
        traps: traps(a, [
          { value: N.z, why: `That is the pre-activation, $${num(N.z)}$. The ReLU turns a negative sum into 0.` },
          { value: Math.abs(N.z), why: 'The ReLU does not flip the sign: a negative sum becomes 0, not its absolute value.' },
          { value: relu(N.wx), why: `That leaves out the bias. Add $\\symb = ${num(N.b)}$ before the ReLU.` },
        ]),
        solution: [...preSteps(N), `Apply the ReLU: $a = \\max(0,\\ ${num(N.z)}) = ${num(a)}$.${N.z < 0 ? ' The sum is negative, so the neuron outputs 0.' : ' The sum is positive, so it passes through unchanged.'}`],
      };
    },
  },
  {
    id: 'zero-side',
    make(rng, d) {
      const w = nonzeros(rng, 2, -3, 3);
      const b = nonzero(rng, d < 0.5 ? -3 : -6, d < 0.5 ? 3 : 6);
      // An input on the silent side, the nearest to the origin on a small grid.
      let ex = [0, 0];
      let best = Infinity;
      for (let i = -5; i <= 5; i++) {
        for (let j = -5; j <= 5; j++) {
          const z = w[0]! * i + w[1]! * j + b;
          const r = i * i + j * j;
          if (z < 0 && r < best) {
            best = r;
            ex = [i, j];
          }
        }
      }
      const ez = dot(w, ex) + b;
      const coef = (c: number, v: string, first: boolean) => `${first ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '}${Math.abs(c) === 1 ? '' : num(Math.abs(c))}${v}`;
      const zTex = `${coef(w[0]!, '\\symx_0', true)}${coef(w[1]!, '\\symx_1', false)} ${b < 0 ? '-' : '+'} ${num(Math.abs(b))}`;
      return {
        prompt: `A ReLU neuron with two inputs has $\\symw = ${vec(w)}$ and $\\symb = ${num(b)}$. For which inputs $\\symx$ is its output exactly 0?`,
        answer: {
          kind: 'choice',
          options: [
            'Every $\\symx$ with $\\symw \\cdot \\symx + \\symb \\le 0$: half the plane',
            'Only the single input $\\symx = [0,\\ 0]$, the origin',
            'Every $\\symx$ with $\\symw \\cdot \\symx \\le 0$: half the plane',
            'No input at all: a ReLU output is always positive',
          ],
          correct: 0,
          why: [
            null,
            `At the origin the output is $\\max(0,\\ ${num(b)}) = ${num(relu(b))}$. ${b < 0 ? 'It is 0 there, but so is every input on that side of a whole line.' : 'It is not even 0 there.'}`,
            `That leaves out the bias. The boundary is where $\\symw \\cdot \\symx + \\symb = 0$: the bias of $${num(b)}$ slides the line away from the origin.`,
            'The ReLU outputs 0 for every negative pre-activation, and $\\symw \\cdot \\symx + \\symb$ is negative on a whole half of the plane.',
          ],
        },
        solution: [
          `The pre-activation is $z = ${zTex}$, a linear score.`,
          '$z = 0$ along a straight line. On one side $z > 0$ and the neuron outputs $z$; on the other side $z < 0$ and the ReLU outputs 0.',
          `For example $\\symx = ${vec(ex)}$ gives $z = ${num(ez)}$, so the output there is 0.`,
          'A linear classifier\'s boundary, with one side flattened to 0: a linear classifier with a bend.',
        ],
      };
    },
  },
];
