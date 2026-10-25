import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, vec } from '../../kit';
import { clean, minus, nonzero, paren, tenth, traps, vtraps } from '../kit';

/** A point, a gradient and a step size, harder with difficulty. */
function setup(rng: Rng, d: number): { w: number; g: number; eta: number } {
  if (d < 0.35) return { w: int(rng, 0, 5), g: int(rng, 1, 6), eta: pick(rng, [0.1, 0.5, 1]) };
  if (d < 0.7) return { w: int(rng, -4, 5), g: nonzero(rng, -6, 6), eta: pick(rng, [0.1, 0.2, 0.5]) };
  return { w: tenth(rng, -3, 3), g: tenth(rng, -5, 5), eta: pick(rng, [0.01, 0.05, 0.1, 0.2]) };
}

const signNote = (g: number) => (g > 0 ? 'The gradient is positive, so $\\symw$ goes down.' : 'The gradient is negative, so $\\symw$ goes up.');

export const generators: Generator[] = [
  {
    id: 'scalar',
    make(rng, d) {
      const { w, g, eta } = setup(rng, d);
      const step = clean(eta * g);
      const v = clean(w - step);
      return {
        prompt: `At $\\symw = ${num(w)}$ the gradient is $\\symg = ${num(g)}$. With $\\symeta = ${num(eta)}$, where is $\\symw$ after one gradient step?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: w + step, why: 'That adds $\\symeta\\symg$: a step uphill. The update subtracts it, $\\symw - \\symeta\\symg$.' },
          { value: w - g, why: 'That subtracts the whole gradient, leaving out the step size. The step is $\\symeta\\symg$, not $\\symg$.' },
          { value: -step, why: `That is the step $-\\symeta\\symg$ on its own. Add it to where $\\symw$ was, $${num(w)}$.` },
        ]),
        solution: [
          'The update is $\\symw \\leftarrow \\symw - \\symeta\\,\\symg$.',
          `The step: $\\symeta\\,\\symg = ${num(eta)} \\times ${paren(g)} = ${num(step)}$.`,
          `Subtract it: $${minus(w, step)} = ${num(v)}$.`,
          signNote(g),
        ],
      };
    },
  },
  {
    id: 'vector',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const eta = d < 0.35 ? pick(rng, [0.1, 0.5]) : pick(rng, [0.1, 0.2, 0.5]);
      const w = Array.from({ length: n }, () => (d < 0.7 ? int(rng, d < 0.35 ? 0 : -3, 4) : tenth(rng, -2, 2)));
      const g = Array.from({ length: n }, () => (d < 0.35 ? int(rng, 1, 5) : nonzero(rng, -5, 5)));
      const step = g.map((x) => clean(eta * x));
      const v = w.map((x, i) => clean(x - step[i]!));
      return {
        prompt: `At $\\symw = ${vec(w)}$ the gradient is $\\symg = ${vec(g)}$. With $\\symeta = ${num(eta)}$, what is $\\symw$ after one gradient step?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: w.map((x, i) => x + step[i]!), why: 'That adds $\\symeta\\symg$: a step uphill. The update subtracts it, $\\symw - \\symeta\\symg$.' },
          { value: w.map((x, i) => x - g[i]!), why: 'That subtracts the whole gradient, leaving out the step size. The step is $\\symeta\\symg$, not $\\symg$.' },
          { value: step.map((x) => -x), why: 'That is the step $-\\symeta\\symg$ on its own. Add it to the current $\\symw$.' },
        ]),
        solution: [
          'Every entry of $\\symw$ moves at once, each against its own entry of the gradient: $\\symw \\leftarrow \\symw - \\symeta\\,\\symg$.',
          `Scale the gradient: $\\symeta\\,\\symg = ${num(eta)} \\times ${vec(g)} = ${vec(step)}$.`,
          `Subtract entry by entry: ${w.map((x, i) => `$${minus(x, step[i]!)} = ${num(v[i]!)}$`).join('; ')}.`,
          `So $\\symw = ${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'direction',
    make(rng, d) {
      const j = rng.int(3);
      const w = d < 0.5 ? nonzero(rng, -4, 4) : tenth(rng, -3, 3);
      const zero = rng.next() < 0.15;
      const g = zero ? 0 : d < 0.5 ? nonzero(rng, -5, 5) : tenth(rng, -4, 4);
      const nudge = d >= 0.5 && !zero && rng.next() < 0.5;
      const wj = `\\symw_{${j}}`;
      const given = nudge
        ? `Nudging $${wj}$ up by $0.01$ ${g > 0 ? 'raises' : 'lowers'} $\\symf$ by about $${num(clean(Math.abs(g) * 0.01))}$.`
        : `The gradient of $\\symf$ with respect to $${wj}$ is $${num(g)}$.`;
      const correct = g < 0 ? 0 : g > 0 ? 1 : 2;
      const why: (string | null)[] = [
        g > 0 ? 'Up is the way the gradient points, uphill on $\\symf$. The step goes against it.' : 'A zero gradient makes a zero step: nothing moves.',
        g < 0 ? `That follows the gradient\'s sign. A negative gradient means $\\symf$ falls as $${wj}$ grows, so stepping against it raises $${wj}$.` : 'A zero gradient makes a zero step: nothing moves.',
        `Only a zero gradient leaves $${wj}$ in place. Here the step $-\\symeta\\symg$ is not zero.`,
        'The step size is positive: it sets how far the step goes, never which way. The direction comes from the sign of $-\\symg$.',
      ];
      why[correct] = null;
      return {
        prompt: `One input of $\\symf$ is at $${wj} = ${num(w)}$. ${given} After one gradient step, what does $${wj}$ do?`,
        answer: { kind: 'choice', options: ['It goes up', 'It goes down', 'It stays where it is', 'It depends on the step size'], correct, why },
        solution: [
          nudge ? `The slope is the change in $\\symf$ over the nudge: $\\symg = ${g > 0 ? '' : '-'}${num(clean(Math.abs(g) * 0.01))} / 0.01 = ${num(g)}$.` : `The gradient is $\\symg = ${num(g)}$.`,
          `The step is $-\\symeta\\symg$, which has the opposite sign to $\\symg$ because $\\symeta > 0$.`,
          g === 0 ? `With $\\symg = 0$ the step is 0: $${wj}$ stays where it is.` : g < 0 ? `$\\symg < 0$, so $-\\symeta\\symg > 0$: $${wj}$ goes up. Its current value, $${num(w)}$, does not matter.` : `$\\symg > 0$, so $-\\symeta\\symg < 0$: $${wj}$ goes down. Its current value, $${num(w)}$, does not matter.`,
        ],
      };
    },
  },
  {
    id: 'first-order',
    make(rng, d) {
      const eta = d < 0.5 ? pick(rng, [0.1, 0.5, 0.01]) : pick(rng, [0.1, 0.05, 0.01, 0.2]);
      const g = d < 0.5 ? [d < 0.25 ? int(rng, 1, 5) : nonzero(rng, -5, 5)] : [nonzero(rng, -4, 4), nonzero(rng, -4, 4)];
      const sq = g.reduce((a, x) => a + x * x, 0);
      const v = clean(-eta * sq);
      const one = g.length === 1;
      const gTex = one ? `\\symg = ${num(g[0]!)}` : `\\symg = ${vec(g)}`;
      return {
        prompt: `The gradient of $\\symf$ is $${gTex}$. Estimate the change in $\\symf$ from one gradient step with $\\symeta = ${num(eta)}$.`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: eta * sq, why: 'That has the wrong sign. A small step against the gradient always lowers $\\symf$, so the change is negative.' },
          { value: -sq, why: 'That leaves out the step size: the move is $-\\symeta\\symg$, so the change is $-\\symeta\\symg^2$.' },
          {
            value: -eta * g.reduce((a, x) => a + x, 0),
            why: one ? 'That is the move $-\\symeta\\symg$, not the change in $\\symf$. Multiply it by the slope $\\symg$ too.' : 'That adds up the moves $-\\symeta\\symg_i$. Each move changes $\\symf$ by its slope times the move, $-\\symeta\\symg_i^2$.',
          },
        ]),
        solution: one
          ? [
              `The step moves $\\symw$ by $\\Delta\\symw = -\\symeta\\symg = -${num(eta)} \\times ${paren(g[0]!)} = ${num(clean(-eta * g[0]!))}$.`,
              'Near the current point $\\symf$ changes by about the slope times the move: $\\Delta\\symf \\approx \\symg\\,\\Delta\\symw = -\\symeta\\symg^2$.',
              `Here: $-${num(eta)} \\times ${paren(g[0]!)}^2 = ${num(v)}$.`,
            ]
          : [
              'Each entry of $\\symw$ moves by $-\\symeta\\symg_i$ and adds about $\\symg_i \\times (-\\symeta\\symg_i) = -\\symeta\\symg_i^2$ to the change in $\\symf$.',
              `Add them up: $\\Delta\\symf \\approx -\\symeta\\,(${g.map((x) => `${paren(x)}^2`).join(' + ')}) = -${num(eta)} \\times ${sq}$.`,
              `That is $${num(v)}$: negative, because every $\\symg_i^2$ is positive.`,
            ],
      };
    },
  },
];
