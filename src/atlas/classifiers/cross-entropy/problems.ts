import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, vec } from '../../kit';
import { argmaxOf, par } from '../kit';

const LN = (x: number) => round(Math.log(x), 2);
const E = (x: number) => round(Math.exp(x), 2);

/** `n` probabilities, each a multiple of 1/`total`, adding up to 1. */
function probs(rng: Rng, n: number, total: number): number[] {
  const cuts = rng.shuffle(Array.from({ length: total - 1 }, (_, i) => i + 1)).slice(0, n - 1).sort((a, b) => a - b);
  const edges = [0, ...cuts, total];
  return edges.slice(1).map((e, i) => round((e - edges[i]!) / total, 2));
}

/** ln C from ln 2, ln 5 and ln 10 at three places: every C here rounds the same either way. */
const LN_PARTS: Record<number, [string, number]> = {
  4: ['2\\ln 2', 2 * 0.693],
  8: ['3\\ln 2', 3 * 0.693],
  16: ['4\\ln 2', 4 * 0.693],
  20: ['\\ln 2 + \\ln 10', 0.693 + 2.303],
  25: ['2\\ln 5', 2 * 1.609],
  50: ['\\ln 5 + \\ln 10', 1.609 + 2.303],
  200: ['\\ln 2 + 2\\ln 10', 0.693 + 2 * 2.303],
  1000: ['3\\ln 10', 3 * 2.303],
};

export const generators: Generator[] = [
  {
    id: 'from-p',
    make(rng, d) {
      const n = d < 0.5 ? 3 : int(rng, 3, 4);
      const p = probs(rng, n, d < 0.5 ? 10 : 20);
      const y = rng.int(n);
      const v = -LN(p[y]!);
      const top = argmaxOf(p);
      const traps = [
        { value: LN(p[y]!), why: `That is $\\ln \\symp_{${y}}$ itself. The loss has a minus sign in front, so it is never negative.` },
        { value: p[y]!, why: 'That is the probability itself. The loss is minus its log.' },
      ];
      if (top >= 0 && top !== y) traps.push({ value: -LN(p[top]!), why: `That uses option ${top}'s probability, the largest. The loss looks only at the right option, $\\symy = ${y}$.` });
      const lns = [...new Set(p)].sort((a, b) => b - a);
      return {
        prompt: `The probabilities are $\\symp = ${vec(p)}$, and the right answer is option $\\symy = ${y}$, counting from 0. What is the cross-entropy loss? Round to two decimals.\n\nUse ${lns.map((q) => `$\\ln ${num(q)} \\approx ${num(LN(q), 2)}$`).join(', ')}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps.filter((t, i) => Math.abs(t.value - v) >= 0.01 && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          `The loss looks only at the right option: $\\symp_{\\symy} = \\symp_{${y}} = ${num(p[y]!)}$.`,
          `$\\symL = -\\ln ${num(p[y]!)} \\approx -(${num(LN(p[y]!), 2)}) = ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'from-scores',
    make(rng, d) {
      const n = d < 0.6 ? 3 : 4;
      const s = d < 0.35 ? ints(rng, n, 0, 2) : ints(rng, n, -1, 3);
      const y = rng.int(n);
      const e = s.map(E);
      const T = round(e.reduce((a, b) => a + b, 0), 2);
      const lnT = LN(T);
      const v = round(lnT - s[y]!, 2);
      const top = argmaxOf(s);
      const distinct = [...new Set(s)].sort((a, b) => b - a);
      const traps = [
        { value: round(s[y]! - lnT, 2), why: 'That has the sign flipped. The loss is $\\ln T - \\syms_{\\symy}$, never negative.' },
        { value: round(e[y]! / T, 2), why: `That is $\\symp_{${y}}$, the probability. The loss is minus its log.` },
      ];
      if (top >= 0 && top !== y) traps.push({ value: round(lnT - s[top]!, 2), why: `That uses option ${top}'s score, the top one. The loss uses the right option, $\\symy = ${y}$.` });
      return {
        prompt: `The scores are $\\syms = ${vec(s)}$ and the right answer is option $\\symy = ${y}$, counting from 0. What is the cross-entropy loss? Round to two decimals.\n\nUse ${distinct.map((x) => `$e^{${x}} \\approx ${num(E(x), 2)}$`).join(', ')}, and $\\ln ${num(T, 2)} \\approx ${num(lnT, 2)}$.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps.filter((t, i) => Math.abs(t.value - v) >= 0.01 && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          `Exponentiate and add: $T = ${e.map((x) => num(x, 2)).join(' + ')} = ${num(T, 2)}$.`,
          `Softmax gives $\\symp_{${y}} = e^{${s[y]}} / T$, so $\\symL = -\\ln \\symp_{${y}} = \\ln T - \\syms_{${y}}$.`,
          `$\\symL = ${num(lnT, 2)} - ${par(s[y]!)} = ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'uniform',
    make(rng, d) {
      const easy = d < 0.5;
      const C = easy ? pick(rng, [2, 5, 10, 100]) : pick(rng, [4, 8, 16, 20, 25, 50, 200, 1000]);
      const v = Math.log(C);
      const table = easy ? '$\\ln 2 \\approx 0.69$, $\\ln 5 \\approx 1.61$, $\\ln 10 \\approx 2.30$, $\\ln 100 \\approx 4.61$' : '$\\ln 2 \\approx 0.693$, $\\ln 5 \\approx 1.609$, $\\ln 10 \\approx 2.303$';
      const how = pick(rng, ['are all equal', 'are all the same number']);
      const parts = LN_PARTS[C];
      return {
        prompt: `There are $C = ${C}$ options, and their scores ${how}. Whichever option is right, what is the cross-entropy loss? Round to two decimals.\n\nUse ${table}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: [
          { value: -v, why: 'That is $\\ln(1/C)$, without the minus sign. The loss is never negative.' },
          { value: 1 / C, why: 'That is the probability each option gets. The loss is minus its log.' },
        ],
        solution: [
          `Equal scores give every option the same probability: $\\symp_{\\symy} = 1/${C}$.`,
          `$\\symL = -\\ln(1/C) = \\ln C = \\ln ${C}$.`,
          parts ? `$\\ln ${C} = ${parts[0]} \\approx ${num(round(parts[1], 3), 3)} \\approx ${num(v, 2)}$.` : `$\\ln ${C} \\approx ${num(v, 2)}$.`,
          'The more options share the probability, the less the right one gets, and the larger the loss.',
        ],
      };
    },
  },
  {
    id: 'limits',
    make(rng) {
      const p0 = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
      const up = rng.int(2) === 0;
      const never = 'A probability is at most 1, so its log is at most 0, and the minus sign makes the loss 0 or more.';
      return {
        prompt: `The right answer's probability is $\\symp_{\\symy} = ${p0}$. As it moves toward ${up ? 1 : 0}, what happens to the cross-entropy loss $\\symL$?`,
        answer: {
          kind: 'choice',
          options: ['It shrinks toward 0', 'It grows without limit', 'It turns negative', 'It levels off at 1'],
          correct: up ? 0 : 1,
          why: up
            ? [null, 'That happens as $\\symp_{\\symy}$ goes to 0: minus the log of a tiny number is huge.', never, 'At $\\symp_{\\symy} = 1$ the loss is $-\\ln 1 = 0$, not 1.']
            : ['That happens as $\\symp_{\\symy}$ goes to 1, where $-\\ln 1 = 0$.', null, never, 'The loss has no ceiling: at $\\symp_{\\symy} = 0.01$ it is already $4.61$.'],
        },
        solution: up
          ? ['$\\symL = -\\ln \\symp_{\\symy}$, and $\\ln 1 = 0$, so the loss falls to 0 as $\\symp_{\\symy} \\to 1$.', 'On the way: $-\\ln 0.9 \\approx 0.11$ and $-\\ln 0.99 \\approx 0.01$. A confident right answer costs almost nothing.']
          : ['The log of a tiny probability is a large negative number: $\\ln 0.01 \\approx -4.61$, $\\ln 0.0001 \\approx -9.21$.', 'The minus sign turns that into a large loss, growing without limit as $\\symp_{\\symy} \\to 0$: a confident wrong answer costs the most.'],
      };
    },
  },
];
