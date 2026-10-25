import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { big, clean, commas, traps, whys } from '../kit';

/** Fractions t/T with cosines a learner can be handed, as [label, fraction, cos(pi t / T) given]. */
const COS: [string, number, number][] = [
  ['\\tfrac{1}{2}', 1 / 2, 0],
  ['\\tfrac{1}{3}', 1 / 3, 0.5],
  ['\\tfrac{2}{3}', 2 / 3, -0.5],
  ['\\tfrac{1}{4}', 1 / 4, 0.707],
  ['\\tfrac{3}{4}', 3 / 4, -0.707],
  ['\\tfrac{1}{6}', 1 / 6, 0.866],
  ['\\tfrac{5}{6}', 5 / 6, -0.866],
];

const COSINE = '\\symeta_t = \\symeta_{\\min} + \\tfrac{1}{2}(\\symeta_{\\max} - \\symeta_{\\min})\\left(1 + \\cos\\tfrac{\\pi t}{T}\\right)';

export const generators: Generator[] = [
  {
    id: 'warmup',
    make(rng, d) {
      const peak = pick(rng, d < 0.35 ? [0.1, 0.2, 1] : [0.1, 0.001, 0.0003, 0.4, 0.003]);
      const k = pick(rng, d < 0.35 ? [100, 1000] : [500, 1000, 2000, 4000, 10000]);
      const after = d >= 0.5 && rng.next() < 0.25;
      const f = after ? pick(rng, [1.5, 2, 3]) : pick(rng, d < 0.35 ? [0.1, 0.25, 0.5] : [0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.75, 0.8, 0.9]);
      const t = clean(k * f);
      const v = clean(after ? peak : peak * f);
      return {
        prompt: `A run warms up its learning rate linearly, from $0$ at step $0$ to $\\symeta_{\\max} = ${num(peak)}$ at step $${big(k)}$, then holds it there. What is the learning rate at step $${big(t)}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: peak * f, why: `That keeps ramping past step ${commas(k)}. The warmup ends there, and the rate holds at $\\symeta_{\\max}$.` },
          { value: after ? 0 : peak, why: 'That is the peak, as if there were no warmup. The rate is still climbing toward it.' },
          { value: peak * (1 - f), why: 'That ramps down. Warmup climbs from 0 up to the peak.' },
          { value: f, why: `That is the share of the warmup done, $${big(t)} / ${big(k)}$. Multiply it by $\\symeta_{\\max}$.` },
        ].filter((x) => x.value > 0)),
        solution: after
          ? [`Step $${big(t)}$ is past the end of the warmup, step $${big(k)}$.`, `After warmup the rate holds at $\\symeta_{\\max} = ${num(peak)}$.`]
          : [
              `The share of the warmup done: $${big(t)} / ${big(k)} = ${num(f)}$.`,
              `The rate climbs in proportion: $${num(f)} \\times ${num(peak)} = ${num(v)}$.`,
            ],
      };
    },
  },
  {
    id: 'step-decay',
    make(rng, d) {
      const eta0 = pick(rng, d < 0.35 ? [0.1, 1] : [0.1, 0.4, 0.01, 0.05, 0.2]);
      const c = d < 0.35 ? 0.1 : pick(rng, [0.1, 0.5]);
      const N = pick(rng, [1000, 2000, 5000, 10000]);
      const drops = d >= 0.5 && rng.next() < 0.15 ? 0 : int(rng, 1, 3);
      const edge = d >= 0.5 && drops > 0 && rng.next() < 0.4;
      const t = edge ? drops * N : drops * N + (N / 10) * int(rng, 1, 9);
      const v = clean(eta0 * c ** drops);
      const word = c === 0.1 ? 'multiplied by $0.1$' : 'halved';
      const at = (k: number) => commas(k * N);
      return {
        prompt: `A schedule starts the learning rate at $${num(eta0)}$ and has it ${word} every ${commas(N)} steps: at steps ${at(1)}, ${at(2)}, ${at(3)} and so on. Counting steps from 0, what is the learning rate at step ${commas(t)}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: eta0 * c ** (drops + 1), why: drops ? `That is one drop too many. By step ${commas(t)} the rate has dropped ${drops} time${drops === 1 ? '' : 's'}.` : `That is one drop too many: step ${commas(t)} comes before the first drop, at step ${commas(N)}.` },
          ...(drops > 0 ? [{ value: eta0 * c ** (drops - 1), why: `That is one drop too few. ${edge ? `The drop at step ${commas(t)} has already happened.` : `By step ${commas(t)} the rate has dropped ${drops} times.`}` }] : []),
          { value: eta0 * c * drops, why: `That multiplies by ${num(c)} once and then by the number of drops. Each drop multiplies by ${num(c)} again: $${num(c)}^{${drops}}$.` },
        ].filter((x) => x.value > 0)),
        solution: [
          drops
            ? `By step ${commas(t)} the drop${drops > 1 ? 's' : ''} at step${drops > 1 ? 's' : ''} ${Array.from({ length: drops }, (_, i) => at(i + 1)).join(', ')} ${drops > 1 ? 'have' : 'has'} happened: ${drops} drop${drops > 1 ? 's' : ''}.`
            : `Step ${commas(t)} comes before the first drop, at step ${commas(N)}: no drops yet.`,
          `$${num(eta0)} \\times ${num(c)}^{${drops}} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'cosine',
    make(rng, d) {
      const [label, f, cos] = d < 0.35 ? pick(rng, COS.slice(0, 3)) : pick(rng, COS);
      const hi = pick(rng, d < 0.35 ? [0.1, 0.2, 1] : [0.1, 0.4, 0.6, 0.2, 1]);
      const lo = d < 0.5 ? 0 : pick(rng, [0, 0.01, 0.02]);
      const T = pick(rng, [600, 1200, 3000, 6000, 12000]);
      const t = Math.round(T * f);
      const span = clean(hi - lo);
      const v = round(lo + 0.5 * span * (1 + cos), 4);
      const r4 = (x: number) => round(x, 4);
      return {
        prompt: `Cosine decay runs from $\\symeta_{\\max} = ${num(hi)}$ to $\\symeta_{\\min} = ${num(lo)}$ over $T = ${big(T)}$ steps. What is the learning rate at step $t = ${big(t)}$? Use $\\cos\\big(\\pi \\cdot ${label}\\big) ${cos === 0 || cos === 0.5 || cos === -0.5 ? '=' : '\\approx'} ${num(cos)}$, and round to four decimals.`,
        answer: { kind: 'number', value: v, places: 4 },
        traps: traps(v, [
          { value: r4(lo + span * (1 + cos)), why: 'That leaves out the $\\tfrac{1}{2}$. Without it the rate would start at twice the peak.' },
          { value: r4(lo + 0.5 * span * cos), why: 'That leaves out the 1 in $1 + \\cos$. Without it the rate would go negative in the second half.' },
          { value: r4(hi - span * f), why: 'That is a straight-line decay. Cosine decay falls slowly at first, fastest in the middle, and slowly at the end.' },
          ...(lo > 0 ? [{ value: r4(0.5 * span * (1 + cos)), why: 'That leaves out $\\symeta_{\\min}$: the cosine part sits on top of it.' }] : []),
        ].filter((x) => Math.abs(x.value - v) >= 0.0001)),
        solution: [
          `$${COSINE}$.`,
          `$t / T = ${big(t)} / ${big(T)} = ${label}$, and $\\cos(\\pi \\cdot ${label}) ${cos === 0 || Math.abs(cos) === 0.5 ? '=' : '\\approx'} ${num(cos)}$.`,
          `$1 + \\cos = ${num(clean(1 + cos))}$, and half the span is $\\tfrac{1}{2}(${num(hi)} - ${num(lo)}) = ${num(clean(span / 2))}$.`,
          `$\\symeta_t = ${num(lo)} + ${num(clean(span / 2))} \\times ${num(clean(1 + cos))} \\approx ${num(v, 4)}$.`,
        ],
      };
    },
  },
  {
    id: 'which',
    make(rng, d) {
      const peak = pick(rng, [0.1, 0.4, 1, 0.01]);
      if (rng.next() < 0.25) {
        const k = pick(rng, [500, 1000, 2000, 4000]);
        const opts = [
          'Early gradients are large and erratic, and full-size steps on them can overshoot',
          'Small steps make the loss fall fastest at the start, while it is still high',
          'The first steps search for the best learning rate, and the ramp is that search',
          'Steps with a small learning rate cost less to compute, so the early steps are cheaper',
        ];
        const reasons = [
          '',
          'Small steps make slow progress, not fast. Warmup trades a little early speed for stability.',
          'Nothing is searched: the ramp is fixed in advance, from 0 up to a peak chosen beforehand.',
          'Every step costs the same, whatever the learning rate: the rate only scales the update.',
        ];
        return {
          prompt: `A run warms its learning rate up linearly from near 0 to its peak, $${num(peak)}$, over the first ${commas(k)} steps, and only then lets it decay. Why warm up at all?`,
          answer: { kind: 'choice', options: opts, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'At the start, far from any minimum, the gradients are at their largest and least steady.',
            'A step is the learning rate times the gradient, so a full-size rate on them can overshoot, and the loss can blow up.',
            'Warmup keeps the first steps small and lets the rate grow once the steps have settled.',
          ],
        };
      }
      const kind = rng.int(4);
      const n = d < 0.5 ? 7 : 9;
      const shape = [
        (i: number) => peak * 0.1 ** Math.floor((3 * i) / n),
        (i: number) => peak * Math.min(1, (2 * i) / (n - 1)),
        (i: number) => 0.5 * peak * (1 + Math.cos((Math.PI * i) / (n - 1))),
        (i: number) => peak * (1 - i / (n - 1)),
      ][kind]!;
      const vals = Array.from({ length: n }, (_, i) => round(shape(i), peak >= 0.1 ? 3 : 4));
      const opts = ['Step decay', 'Linear warmup', 'Cosine decay', 'Linear decay'];
      const tells = [
        'Step decay holds the rate flat, then cuts it by a factor all at once.',
        'Warmup climbs from near 0 up to the peak.',
        'Cosine decay falls slowly at first, fastest in the middle, and slowly again at the end.',
        'Linear decay falls by the same amount every step.',
      ];
      const seen = [
        'Here it is flat between sudden drops by a factor of 10.',
        'Here it rises from 0 to the peak, then holds.',
        'Here the drops are small at both ends and largest in the middle.',
        'Here every drop is the same size.',
      ][kind]!;
      return {
        prompt: `The learning rate, sampled at evenly spaced points through a run: $${vals.map((v) => num(v)).join(',\\ ')}$. Which schedule is it?`,
        answer: { kind: 'choice', options: opts, correct: kind, why: whys(4, kind, (i) => `${tells[i]} ${seen}`) },
        solution: [seen, tells[kind]!],
      };
    },
  },
];
