import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, pick, round, traps } from '../../kit';
import { choice, power, powTex, usePowers } from '../kit';

/** Checkers that can tell a right answer from a wrong one, at least sometimes. */
const CHECKERS = ['runs the unit tests on each program', 'plugs each answer back into the equation', 'verifies each proof step by step', 'runs each SQL query and compares its result to the expected table'];

export const generators: Generator[] = [
  {
    id: 'chance',
    make(rng, d) {
      const p = d < 0.35 ? pick(rng, [0.5, 0.2, 0.1]) : pick(rng, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const n = d < 0.35 ? pick(rng, [2, 3, 4]) : pick(rng, [3, 4, 5, 6, 8, 10]);
      const q = clean(1 - p);
      const { v: miss } = power(q, n);
      const v = clean(1 - miss);
      const task = pick(rng, CHECKERS);
      return {
        prompt: `A model writes a right answer with probability $p = ${num(p)}$ per sample, independently. Best-of-n with $n = ${n}$ uses a perfect checker: it ${task}. What is the chance best-of-n succeeds? Round to two decimals.\n\nUse ${usePowers(q, [n])}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: miss, why: `That is $(1 - p)^{${n}}$, the chance every sample is wrong. Best-of-n succeeds in every other case: subtract it from 1.` },
          { value: clean(n * p), why: `That adds up $p$ once per sample. Chances of "at least one" do not add: the cases overlap, and the sum can pass 1.` },
          { value: power(p, n).v, why: `That is $p^{${n}}$, the chance every sample is right. One right sample is enough.` },
          { value: p, why: 'That is the chance for one sample. More samples give the checker more chances to find a right one.' },
        ]).filter((t) => Math.abs(t.value - v) >= 0.005),
        solution: [
          `With a perfect checker, best-of-n fails only when every sample is wrong. One sample is wrong with probability $1 - ${num(p)} = ${num(q)}$.`,
          n <= 4
            ? `Each sample is wrong independently, so multiply: ${n === 2 ? 'both' : `all ${n}`} are wrong with $${Array(n).fill(num(q)).join(' \\times ')} = ${powTex(q, n)}$.`
            : `Each sample is wrong independently, so multiply ${n} factors of $${num(q)}$: all ${n} are wrong with $${powTex(q, n)}$.`,
          `Best-of-n fails only then, so it succeeds with $1 - ${num(miss)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'smallest-n',
    make(rng, d) {
      let p: number;
      let target: number;
      let n: number;
      do {
        p = d < 0.35 ? pick(rng, [0.5, 0.3]) : pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6]);
        target = d < 0.35 ? pick(rng, [0.9, 0.8]) : pick(rng, [0.8, 0.9, 0.95, 0.99]);
        n = 1;
        while (1 - (1 - p) ** n < target - 1e-12) n++;
      } while (n > 9);
      const q = clean(1 - p);
      const start = Math.max(2, n - int(rng, 1, 4));
      const shown = Array.from({ length: 6 }, (_, i) => start + i);
      const lin = Math.ceil(target / p - 1e-9);
      return {
        prompt: `Each sample is right with probability $p = ${num(p)}$, independently, and a perfect checker keeps any right one. What is the smallest $n$ for which best-of-n succeeds with probability at least $${num(target)}$?\n\nUse ${usePowers(q, shown)}.`,
        answer: { kind: 'number', value: n },
        traps: traps(n, [
          { value: n - 1, why: `With $n = ${n - 1}$ every sample is wrong with probability about $${num(power(q, n - 1).v)}$, so it succeeds with about $${num(round(1 - power(q, n - 1).v, 4))}$: short of $${num(target)}$.` },
          { value: lin, why: `That takes $${num(target)} / ${num(p)}$, as if the chances added up. They do not: the right way is $1 - (1 - p)^n$.` },
        ]),
        solution: [
          `Best-of-n succeeds with $1 - ${num(q)}^n$, so we need $${num(q)}^n \\le ${num(clean(1 - target))}$.`,
          `$${powTex(q, n - 1)}$ is still above $${num(clean(1 - target))}$, but $${powTex(q, n)}$ is not.`,
          `So $n = ${n}$: it succeeds with about $${num(round(1 - power(q, n).v, 4))}$.`,
        ],
      };
    },
  },
  {
    id: 'checker',
    make(rng) {
      const kind = pick(rng, ['perfect', 'fooled', 'strict'] as const);
      const p = pick(rng, [0.1, 0.2, 0.3, 0.4]);
      const k = pick(rng, [5, 10, 20, 50]);
      const m = pick(rng, [2, 3, 4]);
      const fool = clean((1 - p) / k);
      const share = p / (p + fool);
      const what =
        kind === 'perfect'
          ? 'accepts every right answer and rejects every wrong one'
          : kind === 'fooled'
            ? `accepts every right answer, but is also fooled by 1 wrong answer in ${k}`
            : `never accepts a wrong answer, but also rejects 1 right answer in ${m}`;
      return {
        prompt: `Each sample is right with probability $p = ${num(p)}$, and best-of-n's checker ${what}. As $n$ grows, what happens to the chance that best-of-n returns a right answer?`,
        answer: choice([
          { text: 'It climbs toward 1, just as $1 - (1 - p)^n$ says', why: kind === 'perfect' ? null : kind === 'fooled' ? 'That formula assumes the checker never accepts a wrong answer. This one does, so some of what it keeps is wrong however many samples are drawn.' : 'It does climb toward 1, but more slowly than that formula: a right answer only counts when the checker also accepts it.' },
          { text: 'It levels off below 1: wrong answers that get through keep being kept', why: kind === 'fooled' ? null : kind === 'perfect' ? 'A perfect checker never lets a wrong answer through, so nothing caps it.' : 'This checker never accepts a wrong answer, so nothing wrong is ever kept. Missing some right ones only means drawing more.' },
          { text: 'It climbs toward 1, but slower, as if right answers were rarer', why: kind === 'strict' ? null : kind === 'perfect' ? 'A perfect checker accepts every right answer, so nothing slows it: it follows $1 - (1 - p)^n$ exactly.' : 'Missing nothing right is not the problem here. Accepting wrong answers is, and more samples cannot fix that.' },
          {
            text: 'It falls: more samples mean more wrong answers to choose from',
            why: kind === 'fooled' ? 'More samples bring more wrong answers past the checker, but just as many more right ones: the share it keeps right stays level instead of falling.' : 'A checker that never accepts a wrong answer never keeps one, however many there are. More samples only add chances at a right one.',
          },
        ]),
        solution:
          kind === 'perfect'
            ? ['With a perfect checker, best-of-n fails only when every sample is wrong: $(1 - p)^n$.', 'That shrinks toward 0 as $n$ grows, so success, $1 - (1 - p)^n$, climbs toward 1.']
            : kind === 'fooled'
              ? [
                  `Per sample, the checker passes a right answer with probability $p = ${num(p)}$.`,
                  `A sample is wrong with probability $${num(clean(1 - p))}$, and 1 in ${k} of those gets passed: $${num(clean(1 - p))} / ${k} = ${num(fool)}$.`,
                  `So an answer it passes is right $${num(p)} / (${num(p)} + ${num(fool)}) \\approx ${num(share, 2)}$ of the time.`,
                  'More samples add right and wrong answers in that same mix, so success levels off near that share, below 1. The checker must above all reject wrong answers.',
                ]
              : [
                  'This checker never keeps a wrong answer, so best-of-n is only ever right or empty-handed.',
                  'Each sample now counts only if it is right and accepted, a smaller chance than $p$; with enough samples one still turns up.',
                  'Success climbs toward 1, just more slowly. Rejecting some right answers costs samples, not correctness.',
                ],
      };
    },
  },
];
