import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { choice, clean, power, traps } from '../kit';

export const generators: Generator[] = [
  {
    id: 'two-of-three',
    make(rng, d) {
      const p = d < 0.35 ? pick(rng, [0.5, 0.8, 0.9]) : pick(rng, [0.3, 0.4, 0.6, 0.7, 0.8, 0.9]);
      const p2 = power(p, 2).v;
      const p3 = power(p, 3).v;
      const q = clean(1 - p);
      const one = clean(p2 * q);
      const two = clean(3 * one);
      const v = clean(p3 + two);
      const askWrong = d >= 0.7 && rng.next() < 0.5;
      const ans = askWrong ? clean(1 - v) : v;
      const flip = (x: number) => (askWrong ? clean(1 - x) : x);
      return {
        prompt: `Each sampled answer is right with probability $p = ${num(p)}$, independently of the others. Self-consistency samples 3 answers and votes; it is right when at least 2 of the 3 are right. What is the chance the vote is ${askWrong ? 'wrong' : 'right'}? Round to three decimals.\n\nUse $${num(p)}^{2} = ${num(p2)}$ and $${num(p)}^{3} = ${num(p3)}$.`,
        answer: { kind: 'number', value: ans, places: 3 },
        traps: traps(ans, [
          { value: flip(p3), why: 'That counts only the case where all three are right. Exactly two right also wins the vote.' },
          { value: flip(clean(3 * p2 * (1 - p))), why: 'That counts only exactly two right. All three right wins the vote too.' },
          { value: flip(clean(p3 + p2 * (1 - p))), why: 'Exactly two right can happen three ways: the wrong one is the first, the second or the third sample. Multiply by 3.' },
          { value: flip(p), why: 'That is the chance for a single sample. Work out the vote over all three.' },
        ]).filter((t) => Math.abs(t.value - ans) >= 0.0005),
        solution: [
          `Each sample is right independently, so multiply: all three right is $${num(p)} \\times ${num(p)} \\times ${num(p)} = ${num(p)}^{3} = ${num(p3)}$.`,
          `Exactly two right, with the third sample the wrong one: $${num(p)} \\times ${num(p)} \\times ${num(q)} = ${num(p2)} \\times ${num(q)} = ${num(one)}$.`,
          `The wrong one could be any of the 3 samples, so exactly two right is $3 \\times ${num(one)} = ${num(two)}$.`,
          `The vote is right with probability $${num(p3)} + ${num(two)} = ${num(v)}$${askWrong ? `, so wrong with $1 - ${num(v)} = ${num(ans)}$` : ''}.`,
          v > p ? `That beats one sample's $${num(p)}$: when a sample is usually right, the majority is right even more often.` : v < p ? `That is below one sample's $${num(p)}$: when a sample is usually wrong, the majority is wrong even more often.` : `That equals one sample's $${num(p)}$: at one half, voting neither helps nor hurts.`,
        ],
      };
    },
  },
  {
    id: 'pattern',
    make(rng, d) {
      const n = d < 0.35 ? 2 : 3;
      const p = pick(rng, n === 2 ? [0.5, 0.6, 0.7, 0.8, 0.9] : [0.6, 0.7, 0.8, 0.9]);
      const q = clean(1 - p);
      const ways = n === 2 ? [[1, 1], [0, 0], [1, 0], [0, 1]] : [[1, 1, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 0, 0], [0, 0, 1]];
      const pat = pick(rng, ways);
      const names = ['first', 'second', 'third'];
      const said = pat.map((ok, i) => `the ${names[i]} is ${ok ? 'right' : 'wrong'}`);
      const same = pat.every((ok) => ok === pat[0]);
      const ask = same ? `${n === 2 ? 'both' : 'all three'} are ${pat[0] ? 'right' : 'wrong'}` : n === 2 ? `${said[0]} and ${said[1]}` : `${said[0]}, ${said[1]} and ${said[2]}`;
      const fs = pat.map((ok) => (ok ? p : q));
      const v = clean(fs.reduce((a, b) => a * b, 1));
      const k = pat.filter((ok) => ok).length;
      // Orders with the same count of right samples: the trap for counting every order.
      const orders = n === 2 ? (k === 1 ? 2 : 1) : k === 1 || k === 2 ? 3 : 1;
      return {
        prompt: `Each sampled answer is right with probability $p = ${num(p)}$, independently of the others. ${n === 2 ? 'Two' : 'Three'} answers are sampled. What is the chance that ${ask}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(fs.reduce((a, b) => a + b, 0)), why: 'That adds the chances. For independent samples, multiply them: one factor per sample.' },
          { value: clean(p ** n), why: `That gives every sample the chance $p$. A wrong sample's chance is $1 - p = ${num(q)}$.` },
          ...(orders > 1 ? [{ value: clean(orders * v), why: `That counts every order. The question fixes which sample is wrong, so there is just one way.` }] : []),
        ]),
        solution: [
          ...(k < n ? [`A wrong sample has chance $1 - p = 1 - ${num(p)} = ${num(q)}$.`] : []),
          `The samples are independent, so multiply, one factor per sample: $${fs.map((f) => num(f)).join(' \\times ')}$.`,
          n === 2 ? `That is $${num(v)}$.` : `$${num(fs[0]!)} \\times ${num(fs[1]!)} = ${num(clean(fs[0]! * fs[1]!))}$, then $${num(clean(fs[0]! * fs[1]!))} \\times ${num(fs[2]!)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'helps',
    make(rng) {
      const p = pick(rng, [0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]);
      const task = pick(rng, ['a math word problem', 'a multiple-choice question', 'a yes-or-no question', 'a date puzzle']);
      const p2 = power(p, 2).v;
      const p3 = power(p, 3).v;
      const q = clean(1 - p);
      const v = clean(p3 + 3 * p2 * q);
      const up = v > p;
      return {
        prompt: `A model's sampled answer to ${task} is right with probability $p = ${num(p)}$, independently each time. Which is more likely to be right: one sample, or the majority vote of 3 samples?`,
        answer: choice([
          { text: 'The majority vote of 3 samples', why: up ? null : `Below one half, each sample is usually wrong, so the majority is wrong even more often: the vote is right only $${num(v)}$ of the time.` },
          { text: 'One sample', why: up ? `Above one half, the majority is right even more often than one sample: $${num(v)}$ against $${num(p)}$.` : null },
          { text: 'Both are equally likely to be right', why: `They differ: the vote is right $${num(v)}$ of the time, one sample $${num(p)}$.` },
        ]),
        solution: [
          `All three right: $p^3 = ${num(p3)}$.`,
          `Exactly two right, in any of 3 orders: $3 \\times ${num(p2)} \\times ${num(q)} = ${num(clean(3 * p2 * q))}$.`,
          `The vote is right with chance $${num(p3)} + ${num(clean(3 * p2 * q))} = ${num(v)}$.`,
          up
            ? `That beats one sample's $${num(p)}$: when a sample is usually right, the majority is right even more often.`
            : `That is below one sample's $${num(p)}$: when a sample is usually wrong, the majority is wrong even more often.`,
        ],
      };
    },
  },
];
