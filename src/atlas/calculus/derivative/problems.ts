import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { cleanTraps, paren } from '../kit';

export const generators: Generator[] = [
  {
    id: 'sign',
    make(rng, d) {
      const x = int(rng, -2, 4);
      if (rng.int(2) === 0) {
        const m = pick(rng, d < 0.5 ? [-3, -2, 0, 2, 4] : [-0.5, -5, 0, 0.5, 6, -1]);
        const fx = int(rng, 2, 9) * pick(rng, [1, -1]);
        const correct = m > 0 ? 0 : m < 0 ? 1 : 2;
        const options = ['Going up', 'Going down', 'Flat: level for a small nudge'];
        const why = options.map((_, i) => {
          if (i === correct) return null;
          if (m === 0) return `$\\symf'(${x}) = 0$ means the tangent is level there: a small nudge barely changes $\\symf$. $\\symf(${x}) = ${fx}$ says only how high it is.`;
          if (i === 2) return `Flat would need $\\symf'(${x}) = 0$. A slope of $${num(m)}$ means $\\symf$ changes about $${num(Math.abs(m))}$ times as fast as $\\symx$.`;
          return `$\\symf(${x}) = ${fx}$ is the height of $\\symf$, not its direction. The sign of $\\symf'(${x}) = ${num(m)}$ gives the direction.`;
        });
        return {
          prompt: `$\\symf(${x}) = ${fx}$ and $\\symf'(${x}) = ${num(m)}$. Near $\\symx = ${x}$, as $\\symx$ grows, which way does $\\symf$ go?`,
          answer: { kind: 'choice', options, correct, why },
          solution: [
            `The derivative's sign gives the direction: $\\symf'(${x}) = ${num(m)}$ is ${m > 0 ? 'positive, so $\\symf$ goes up' : m < 0 ? 'negative, so $\\symf$ goes down' : 'zero, so $\\symf$ is level there'}.`,
            `The value $\\symf(${x}) = ${fx}$ is only the height; it says nothing about which way $\\symf$ is heading.`,
          ],
        };
      }
      const kind = pick(rng, ['up', 'down', 'flat']);
      const base = int(rng, 1, 9);
      const step = d < 0.5 ? 0.1 : pick(rng, [0.1, 0.01]);
      const dy = pick(rng, [1, 2, 3, 5]) / 10;
      const vals = kind === 'up' ? [base - dy, base, base + dy] : kind === 'down' ? [base + dy, base, base - dy] : [base + dy / 10, base, base + dy / 10];
      const xs = [x - step, x, x + step].map((v) => round(v, 2));
      const fs = vals.map((v) => num(round(v, 3)));
      const correct = kind === 'up' ? 0 : kind === 'down' ? 1 : 2;
      const options = ['Positive', 'Negative', 'Zero'];
      const why = options.map((_, i) => {
        if (i === correct) return null;
        if (kind === 'flat') return `$\\symf$ is lowest at $\\symx = ${x}$ and rises a little on both sides, so the tangent there is level: the slope is 0.`;
        if (i === 2) return `$\\symf$ changes by $${kind === 'up' ? '' : '-'}${num(dy)}$ for each step of $${num(step)}$, so the slope is far from 0.`;
        return `$\\symf$ ${kind === 'up' ? 'rises' : 'falls'} as $\\symx$ grows from $${num(xs[0]!)}$ to $${num(xs[2]!)}$, so the slope is ${kind === 'up' ? 'positive' : 'negative'}, whatever the values themselves are.`;
      });
      return {
        prompt: `$\\symf(${num(xs[0]!)}) = ${fs[0]}$, $\\symf(${num(xs[1]!)}) = ${fs[1]}$ and $\\symf(${num(xs[2]!)}) = ${fs[2]}$. What is the sign of $\\symf'(${x})$?`,
        answer: { kind: 'choice', options, correct, why },
        solution: [
          kind === 'flat'
            ? `$\\symf$ goes down into $\\symx = ${x}$ and back up after it, so ${x} is the bottom of a dip.`
            : `As $\\symx$ grows, $\\symf$ ${kind === 'up' ? 'rises' : 'falls'}: $${fs.join(kind === 'up' ? ' < ' : ' > ')}$.`,
          kind === 'flat' ? 'At the bottom of a dip the tangent is level, so the derivative is 0.' : `So the slope at $\\symx = ${x}$ is ${kind === 'up' ? 'positive' : 'negative'}: about $${kind === 'up' ? '' : '-'}${num(dy)} / ${num(step)} = ${kind === 'up' ? '' : '-'}${num(round(dy / step, 2))}$.`,
        ],
      };
    },
  },
  {
    id: 'nudge',
    make(rng, d) {
      const x = int(rng, -2, 5);
      const k = d < 0.35 ? int(rng, 2, 9) : pick(rng, [-6, -4, -3, -2, 2, 3, 5, 7, 8, 12]);
      const step = d < 0.35 ? pick(rng, [10, 1]) : pick(rng, [10, 1, 2, 5, -10, -1, 20]);
      const dx = step / 100;
      const change = (k * step) / 100;
      const askValue = d >= 0.7 && rng.int(2) === 0;
      const f0 = int(rng, -5, 20);
      const v = askValue ? (f0 * 100 + k * step) / 100 : change;
      const x1 = (x * 100 + step) / 100;
      const traps = [
        { value: k, why: `That is the slope itself: the change per whole unit of $\\symx$. The nudge is only $${num(dx)}$ of a unit.` },
        { value: (k * step) / 10, why: `That is ten times too big: $${k} \\times ${paren(num(dx))} = ${num(change)}$.` },
      ];
      if (askValue) traps.push({ value: change, why: `That is the change. Add it to $\\symf(${x}) = ${f0}$ for the new value.` });
      if (step < 0 && !askValue) traps.push({ value: -v, why: 'The nudge goes to the left, so the change has the opposite sign to the slope.' });
      return {
        prompt: askValue
          ? `$\\symf(${x}) = ${f0}$ and $\\symf'(${x}) = ${k}$. About what is $\\symf(${num(x1)})$?`
          : `$\\symf'(${x}) = ${k}$. About how much does $\\symf$ change when $\\symx$ goes from $${x}$ to $${num(x1)}$?`,
        answer: { kind: 'number', value: v },
        traps: cleanTraps(traps, v),
        solution: [
          `The nudge is $\\Delta \\symx = ${num(x1)} - ${paren(x)} = ${num(dx)}$.`,
          `Near $\\symx = ${x}$, $\\symf$ changes about $\\symf'(${x})$ times as much: $${k} \\times ${paren(num(dx))} = ${num(change)}$.`,
          ...(askValue ? [`So $\\symf(${num(x1)}) \\approx ${f0} ${change < 0 ? '-' : '+'} ${num(Math.abs(change))} = ${num(v)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'downhill',
    make(rng, d) {
      const x = int(rng, -3, 5);
      const m = pick(rng, d < 0.5 ? [-4, -3, -2, -1, 1, 2, 3, 5] : [-6, -2.5, -0.5, -1, 0.5, 1.5, 4, 7]);
      const smaller = d < 0.35 || rng.int(2) === 0;
      const fx = d >= 0.5 ? int(rng, 2, 12) * pick(rng, [1, -1]) : null;
      // Lowering f means stepping the way it falls, which is right exactly when the slope is negative.
      const right = smaller === m < 0;
      const want = smaller ? 'smaller' : 'larger';
      const options = [`Right, to just above $${x}$`, `Left, to just below $${x}$`, `Neither way: $\\symf$ is level at $${x}$`];
      const correct = right ? 0 : 1;
      const heightNote = fx === null ? '' : ` The height $\\symf(${x}) = ${fx}$ does not change that.`;
      const why = options.map((_, i) => {
        if (i === correct) return null;
        if (i === 2) return `Level would need $\\symf'(${x}) = 0$. A slope of $${num(m)}$ means a small step either way changes $\\symf$.`;
        return `$\\symf'(${x}) = ${num(m)}$ is ${m < 0 ? 'negative' : 'positive'}, so $\\symf$ ${m < 0 ? 'falls' : 'rises'} as $\\symx$ grows: a step ${right ? 'left' : 'right'} makes it ${smaller ? 'larger' : 'smaller'}.${heightNote}`;
      });
      return {
        prompt: `${fx === null ? '' : `$\\symf(${x}) = ${fx}$ and `}$\\symf'(${x}) = ${num(m)}$. To make $\\symf$ a little ${want}, which way should $\\symx$ move from $${x}$?`,
        answer: { kind: 'choice', options, correct, why },
        solution: [
          `$\\symf'(${x}) = ${num(m)}$ is ${m < 0 ? 'negative' : 'positive'}, so near $\\symx = ${x}$, $\\symf$ ${m < 0 ? 'falls' : 'rises'} as $\\symx$ grows.`,
          `A step right, of $0.01$, changes $\\symf$ by about $${num(m)} \\times 0.01 = ${num(round(m * 0.01, 4))}$: $\\symf$ gets ${m < 0 ? 'smaller' : 'larger'}.`,
          `So to make $\\symf$ ${want}, step ${right ? 'right' : 'left'}.`,
          ...(fx === null ? [] : [`$\\symf(${x}) = ${fx}$ is only the height; it says nothing about which way $\\symf$ is heading.`]),
        ],
      };
    },
  },
];
