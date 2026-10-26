import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { cleanTraps, paren, polyTex, type Term } from '../kit';

/** Exact to 4 decimals, so sums of short decimals compare cleanly. */
const r4 = (x: number) => round(x, 4);

export const generators: Generator[] = [
  {
    id: 'secant',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [1, 2]) : pick(rng, [1, 2, -1, 3, -2]);
      const b = d < 0.35 ? int(rng, 0, 3) : int(rng, -4, 4);
      const c = int(rng, -3, 5);
      const ts: Term[] = [{ c: a, n: 2 }, { c: b, n: 1 }, { c, n: 0 }];
      const x = d < 0.35 ? int(rng, 0, 3) : int(rng, -2, 3);
      const h = d < 0.35 ? pick(rng, [1, 2]) : d < 0.7 ? pick(rng, [0.5, 1, 2]) : pick(rng, [0.1, 0.5, 0.2]);
      const f = (t: number) => r4(a * t * t + b * t + c);
      const x1 = r4(x + h);
      const f0 = f(x);
      const f1 = f(x1);
      const rise = r4(f1 - f0);
      const v = r4(rise / h);
      const traps = [
        { value: rise, why: `That is the rise, $${num(rise)}$. The slope divides it by the run, $${num(h)}$.` },
        { value: r4(h / rise), why: 'That is run over rise. The slope is rise over run.' },
        { value: -v, why: `That subtracts the wrong way round. The rise is the later value minus the earlier one: $${num(f1)} - ${paren(num(f0))}$.` },
      ];
      return {
        prompt: `$\\symf(\\symx) = ${polyTex(ts)}$ has $\\symf(${num(x)}) = ${num(f0)}$ and $\\symf(${num(x1)}) = ${num(f1)}$. What is the slope between these two points?`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: rise === 0 ? [] : cleanTraps(traps, v, 2),
        solution: [
          `The run is the step in $\\symx$: $h = ${num(x1)} - ${paren(num(x))} = ${num(h)}$.`,
          `The rise is the later value minus the earlier one: $\\symf(${num(x1)}) - \\symf(${num(x)}) = ${num(f1)} - ${paren(num(f0))} = ${num(rise)}$.`,
          `The slope is rise over run: $${paren(num(rise))} / ${num(h)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'line',
    make(rng, d) {
      const a = d < 0.35 ? int(rng, 2, 9) : pick(rng, [-5, -4, -3, -2, -1, 2, 3, 4, 6, 7]);
      const b = int(rng, 1, 9) * (d < 0.35 ? 1 : pick(rng, [1, -1]));
      const form = d < 0.35 ? 'std' : pick(rng, d < 0.7 ? ['std', 'rev', 'point'] : ['factor', 'half', 'point', 'rev']);
      let tex = polyTex([{ c: a, n: 1 }, { c: b, n: 0 }]);
      let slope = a;
      let constant = b;
      if (form === 'rev') tex = `${b} ${a < 0 ? '-' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a)}\\symx`;
      else if (form === 'factor') {
        const k = int(rng, 1, 4) * pick(rng, [1, -1]);
        tex = `${a === -1 ? '-' : a}(\\symx ${k < 0 ? '+' : '-'} ${Math.abs(k)})`;
        constant = -a * k;
      } else if (form === 'half') {
        const k = pick(rng, [2, 4]);
        tex = `\\dfrac{${tex}}{${k}}`;
        slope = a / k;
        constant = b / k;
      }
      const at = form === 'point' ? int(rng, -3, 5) : null;
      const fAt = at === null ? 0 : slope * at + constant;
      const traps = [{ value: constant, why: `That is the constant term: where the line crosses the vertical axis. It moves the line up or down without tilting it.` }];
      if (at !== null) traps.push({ value: fAt, why: `That is $\\symf(${at})$, the height of the line there, not its slope.` });
      return {
        prompt: at === null
          ? `For $\\symf(\\symx) = ${tex}$, what is $\\symf'(\\symx)$?`
          : `For $\\symf(\\symx) = ${tex}$, what is $\\symf'(${at})$?`,
        answer: { kind: 'number', value: slope },
        traps: cleanTraps(traps, slope),
        solution: [
          form === 'factor' ? `Multiply out: $\\symf(\\symx) = ${polyTex([{ c: slope, n: 1 }, { c: constant, n: 0 }])}$.` : form === 'half' ? `Split the fraction: $\\symf(\\symx) = ${num(slope)}\\symx ${constant < 0 ? '-' : '+'} ${num(Math.abs(constant))}$.` : `A straight line rises by the same amount for every step of 1 in $\\symx$.`,
          `The number multiplying $\\symx$ is that rise per step: the slope is $${num(slope)}$${at === null ? '' : ` everywhere, so $\\symf'(${at}) = ${num(slope)}$`}.`,
          'The constant term only shifts the line up or down, so it does not change the slope.',
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
];
