import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, nonzero, par, pick, traps, vtraps } from '../../kit';
import { dd, fractional, n } from '../kit';

type Gate = 'add' | 'mul' | 'max';

const TEX: Record<Gate, string> = { add: 'x + z', mul: 'x \\cdot z', max: '\\max(x, z)' };
const D = (v: string) => dd('f', v);
const UP = D('q');

/** Two different inputs and an upstream gradient, harder with difficulty. */
function setup(rng: Rng, d: number, big = false): { a: number; c: number; g: number } {
  for (;;) {
    const lo = big ? 2 : 1;
    const a = d < 0.35 ? int(rng, lo, 5) : d < 0.7 ? nonzero(rng, -4, 5) : rng.int(2) ? fractional(rng, -3, 3) : nonzero(rng, -5, 5);
    const c = d < 0.35 ? int(rng, lo, 5) : d < 0.7 ? nonzero(rng, -4, 5) : nonzero(rng, -5, 5);
    const g = d < 0.35 ? int(rng, 1, 3) : d < 0.7 ? nonzero(rng, -3, 4) : pick(rng, [0.5, -1.5, 2.5, -2, 3, 1.5]);
    if (a === c || (big && (Math.abs(a) < 2 || Math.abs(c) < 2))) continue;
    return { a, c, g };
  }
}

/** The gradients the gate sends to x and to z. */
function backward(gate: Gate, a: number, c: number, g: number): [number, number] {
  if (gate === 'add') return [g, g];
  if (gate === 'mul') return [clean(c * g), clean(a * g)];
  return a > c ? [g, 0] : [0, g];
}

/** How the gate turns the upstream gradient into each input's, as solution lines. */
function explain(gate: Gate, a: number, c: number, g: number): string[] {
  const [gx, gz] = backward(gate, a, c, g);
  if (gate === 'add') {
    return [
      'An add gate\'s local slopes are both 1: nudging $x$ or $z$ moves $q$ by the same amount.',
      `So it passes the upstream gradient through unchanged: $${D('x')} = ${D('z')} = 1 \\times ${par(g)} = ${n(g)}$.`,
    ];
  }
  if (gate === 'mul') {
    return [
      'A multiply gate\'s local slope for each input is the other input: $\\partial q / \\partial x = z$ and $\\partial q / \\partial z = x$.',
      `So $${D('x')} = z \\times ${par(g)} = ${par(c)} \\times ${par(g)} = ${n(gx)}$.`,
      `And $${D('z')} = x \\times ${par(g)} = ${par(a)} \\times ${par(g)} = ${n(gz)}$.`,
    ];
  }
  const big = a > c ? 'x' : 'z';
  const small = a > c ? 'z' : 'x';
  return [
    `$\\max(${n(a)}, ${n(c)}) = ${n(Math.max(a, c))}$: $${big}$ is the larger input, so $q$ follows it.`,
    `A small nudge to $${small}$ does not change $q$ at all, so its slope is 0; $${big}$'s slope is 1.`,
    `So $${big}$ gets all of it, $${n(g)}$, and $${small}$ gets $0$.`,
  ];
}

const given = (gate: Gate, a: number, c: number, g: number) =>
  `A gate computes $q = ${TEX[gate]}$ at $x = ${n(a)}$ and $z = ${n(c)}$, with $${UP} = ${n(g)}$.`;

export const generators: Generator[] = [
  {
    id: 'local',
    make(rng, d) {
      const gate = pick(rng, ['add', 'mul', 'max'] as Gate[]);
      const { a, c, g } = setup(rng, d);
      const k = rng.int(2);
      const v = k === 0 ? 'x' : 'z';
      const own = k === 0 ? a : c;
      const other = k === 0 ? c : a;
      const ans = backward(gate, a, c, g)[k];
      const larger = own > other;
      const ts =
        gate === 'add'
          ? [
              { value: g / 2, why: 'That splits the gradient in half. Each input of an add moves $q$ one for one, so each gets all of it.' },
              { value: 1, why: 'That is the local slope alone. Multiply it by the gradient arriving from above.' },
            ]
          : gate === 'mul'
            ? [
                { value: own * g, why: `That uses $${v}$'s own value. A multiply gate swaps: $${v}$ gets the other input times the upstream gradient.` },
                { value: other, why: 'That is the local slope alone. Multiply it by the gradient arriving from above.' },
              ]
            : larger
              ? [
                  { value: 0, why: `That routes the gradient to the smaller input. $${v}$ is the larger, so $q$ follows it and it gets all of the gradient.` },
                  { value: g / 2, why: 'That splits the gradient. A max gate sends all of it to the larger input.' },
                ]
              : [
                  { value: g, why: `That gives the gradient to both inputs. $${v}$ is the smaller, so nudging it does not move $q$: it gets 0.` },
                  { value: g / 2, why: 'That splits the gradient. A max gate sends all of it to the larger input, and none to the smaller.' },
                ];
      return {
        prompt: `${given(gate, a, c, g)} What is $${D(v)}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: explain(gate, a, c, g),
      };
    },
  },
  {
    id: 'pair',
    make(rng, d) {
      const gate = pick(rng, ['add', 'mul', 'max'] as Gate[]);
      const { a, c, g } = setup(rng, d);
      const ans = backward(gate, a, c, g);
      const ts =
        gate === 'add'
          ? [
              { value: [g / 2, g / 2], why: 'That splits the gradient in half. An add gate copies the full gradient to each input.' },
              { value: [1, 1], why: 'Those are the local slopes alone. Multiply them by the gradient arriving from above.' },
            ]
          : gate === 'mul'
            ? [
                { value: [a * g, c * g], why: 'That forgets to swap. $x$ gets $z$ times the upstream gradient, and $z$ gets $x$ times it.' },
                { value: [c, a], why: 'Those are the local slopes alone. Multiply them by the gradient arriving from above.' },
              ]
            : [
                { value: [g, g], why: 'That gives the gradient to both inputs. A max gate sends it all to the larger input, and 0 to the other.' },
                { value: a > c ? [0, g] : [g, 0], why: 'That routes the gradient to the smaller input. The larger one is the input $q$ follows.' },
              ];
      return {
        prompt: `${given(gate, a, c, g)} What is the gradient $\\left[${D('x')},\\ ${D('z')}\\right]$?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, ts),
        solution: explain(gate, a, c, g).concat(`So the gate sends back $[${n(ans[0])},\\ ${n(ans[1])}]$.`),
      };
    },
  },
  {
    id: 'identify',
    make(rng, d) {
      const gate = pick(rng, ['add', 'mul', 'max'] as Gate[]);
      const { a, c, g } = setup(rng, d, true);
      const [gx, gz] = backward(gate, a, c, g);
      const [mx, mz] = backward('mul', a, c, g);
      const correct = gate === 'add' ? 0 : gate === 'mul' ? 1 : 2;
      const why: (string | null)[] = [
        `An add gate would send the full $${n(g)}$ to both inputs.`,
        `A multiply gate would send $x$ the value of $z$ times $${n(g)}$, which is $${n(mx)}$, and $z$ the value of $x$ times it, $${n(mz)}$.`,
        `A max gate would send all $${n(g)}$ to the larger input, $${a > c ? 'x' : 'z'}$, and $0$ to the other.`,
      ];
      why[correct] = null;
      return {
        prompt: `A gate takes $x = ${n(a)}$ and $z = ${n(c)}$ and outputs $q$. With $${UP} = ${n(g)}$, it sends back $${D('x')} = ${n(gx)}$ and $${D('z')} = ${n(gz)}$. Which gate is it?`,
        answer: { kind: 'choice', options: ['An add gate, $q = x + z$', 'A multiply gate, $q = x \\cdot z$', 'A max gate, $q = \\max(x, z)$'], correct, why },
        solution: [
          gate === 'add'
            ? `Both inputs got exactly the upstream gradient, $${n(g)}$: the add gate's copy.`
            : gate === 'mul'
              ? `$x$ got $${n(gx)} = ${par(c)} \\times ${par(g)}$, $z$'s value times the upstream gradient, and $z$ got $x$'s value times it: the multiply gate's swap.`
              : `All of the gradient went to $${a > c ? 'x' : 'z'}$, the larger input, and none to the other: the max gate's routing.`,
          'Add copies, multiply swaps, max routes.',
        ],
      };
    },
  },
  {
    id: 'mistake',
    make(rng, d) {
      const kind = rng.int(4);
      const gate: Gate = kind === 0 ? 'mul' : kind === 1 ? 'add' : kind === 2 ? 'max' : pick(rng, ['add', 'mul', 'max'] as Gate[]);
      const { a, c, g } = setup(rng, d, true);
      const right = backward(gate, a, c, g);
      const shown = kind === 0 ? [clean(a * g), clean(c * g)] : kind === 1 ? [g / 2, g / 2] : kind === 2 ? [g, g] : right;
      const small = a > c ? 'z' : 'x';
      const rule =
        gate === 'add'
          ? `An add gate copies the upstream gradient to both inputs: $[${n(g)},\\ ${n(g)}]$.`
          : gate === 'mul'
            ? `A multiply gate swaps: $x$ gets $z \\times ${par(g)} = ${n(right[0])}$ and $z$ gets $x \\times ${par(g)} = ${n(right[1])}$.`
            : `A max gate routes: the larger input, $${a > c ? 'x' : 'z'}$, gets all $${n(g)}$, and the smaller gets $0$.`;
      const why: (string | null)[] =
        kind === 0
          ? [null, 'Nothing was split: each number is that input\'s own value times the upstream gradient.', 'Both inputs of a multiply gate get a gradient; routing is the max gate\'s rule.', `They are not right: $x$ should get $z$'s value times the upstream gradient, $${n(right[0])}$.`]
          : kind === 1
            ? ['No input values scale an add gate\'s gradient: its local slopes are both 1.', null, 'Both inputs of an add gate get the gradient: each one moves $q$ one for one.', `They are not right: an add gate passes the full $${n(g)}$ to each input, not half.`]
            : kind === 2
              ? ['A max gate has no values to swap: it only routes the gradient.', 'Nothing was split. The trouble is that the smaller input got any gradient at all.', null, `They are not right: nudging the smaller input, $${small}$, does not move $q$, so its gradient is 0.`]
              : [`The numbers already follow the rule. ${rule}`, `The numbers already follow the rule. ${rule}`, `The numbers already follow the rule. ${rule}`, null];
      return {
        prompt: `${given(gate, a, c, g)} A backward pass gives $${D('x')} = ${n(shown[0]!)}$ and $${D('z')} = ${n(shown[1]!)}$. What, if anything, is wrong?`,
        answer: {
          kind: 'choice',
          options: ['The values of $x$ and $z$ should have been swapped', 'The gradient should have been copied, not split in half', 'Only the larger input should have received the gradient', 'Nothing: both gradients are right'],
          correct: kind,
          why,
        },
        solution: [rule, kind === 3 ? 'The backward pass did exactly that.' : `It sent $[${n(shown[0]!)},\\ ${n(shown[1]!)}]$ instead of $[${n(right[0])},\\ ${n(right[1])}]$.`],
      };
    },
  },
];
