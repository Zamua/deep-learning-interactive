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
    id: 'limit',
    make(rng, d) {
      const x = int(rng, -2, 4);
      const m = d < 0.35 ? int(rng, 1, 8) : int(rng, -6, 9) || 5;
      // Over a step h, a parabola's slope is its derivative plus a constant times h.
      const a = d < 0.35 ? pick(rng, [1, 2, 3]) : pick(rng, [1, 2, 3, -1, -2, -3]);
      const hs = [0.1, 0.01, 0.001];
      const ys = hs.map((h) => r4(m + a * h));
      const gaps = hs.map((h) => num(r4(Math.abs(a) * h)));
      const options = [`$${m}$`, `$${num(ys[2]!)}$`, `$${num(ys[0]!)}$`, '$0$'];
      return {
        prompt: `The slope of $\\symf$ between $\\symx = ${x}$ and $\\symx = ${x} + h$ is $${num(ys[0]!)}$ for $h = 0.1$, $${num(ys[1]!)}$ for $h = 0.01$ and $${num(ys[2]!)}$ for $h = 0.001$. What is $\\symf'(${x})$?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [
            null,
            `That is the slope for $h = 0.001$, still over a step. The derivative is the value the slopes settle on as $h$ shrinks toward 0.`,
            `That is the slope over the widest step, $h = 0.1$. As $h$ shrinks, the slopes move away from it.`,
            `The rise does shrink toward 0, but so does the run, and rise over run settles on $${m}$.`,
          ],
        },
        solution: [
          `As $h$ shrinks from 0.1 to 0.001, the slopes go $${num(ys[0]!)}$, $${num(ys[1]!)}$, $${num(ys[2]!)}$.`,
          `Their gap to $${m}$ shrinks with $h$: $${gaps.join('$, $')}$.`,
          `The value they settle on is the derivative: $\\symf'(${x}) = ${m}$.`,
        ],
      };
    },
  },
];
