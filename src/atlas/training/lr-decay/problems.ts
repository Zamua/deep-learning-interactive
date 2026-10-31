import type { Generator } from '../../../mastery/domain/types';
import { big, clean, commas, int, num, pick, traps } from '../../kit';
import { whys } from '../kit';

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
    id: 'linear-decay',
    make(rng, d) {
      const hi = pick(rng, d < 0.35 ? [0.1, 1] : [0.1, 0.4, 0.2, 0.05]);
      const lo = d < 0.35 ? 0 : pick(rng, [0, 0.01, 0.02]);
      const T = pick(rng, d < 0.35 ? [100, 1000] : [400, 1000, 2000, 5000, 10000]);
      const f = pick(rng, d < 0.35 ? [0.25, 0.5, 0.75] : [0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.7, 0.75, 0.8, 0.9]);
      const t = clean(T * f);
      const span = clean(hi - lo);
      const drop = clean(span * f);
      const v = clean(hi - drop);
      return {
        prompt: `Linear decay runs the learning rate from $\\symeta_{\\max} = ${num(hi)}$ down to $\\symeta_{\\min} = ${num(lo)}$ over $T = ${big(T)}$ steps. What is the learning rate at step $t = ${big(t)}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: drop, why: 'That is how far the rate has fallen so far. Subtract it from $\\symeta_{\\max}$.' },
          { value: lo + drop, why: 'That climbs from $\\symeta_{\\min}$. Linear decay starts at $\\symeta_{\\max}$ and falls.' },
          ...(lo > 0 ? [{ value: hi * (1 - f), why: 'That falls toward 0. The line ends at $\\symeta_{\\min}$, so only the gap $\\symeta_{\\max} - \\symeta_{\\min}$ is used up.' }] : []),
        ].filter((x) => x.value > 0)),
        solution: [
          `The share of the way done: $${big(t)} / ${big(T)} = ${num(f)}$.`,
          lo > 0 ? `The gap: $${num(hi)} - ${num(lo)} = ${num(span)}$.` : `The gap down to 0: $${num(hi)}$.`,
          `The drop so far: $${num(f)} \\times ${num(span)} = ${num(drop)}$.`,
          `The rate: $${num(hi)} - ${num(drop)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'why-warmup',
    make(rng) {
      const peak = pick(rng, [0.1, 0.4, 1, 0.01, 0.003, 0.0003]);
      const k = pick(rng, [500, 1000, 2000, 4000]);
      const opts = [
        'Early gradients are large, and the full rate times them makes steps that can overshoot',
        'Small steps make the fastest progress at the start, while far from the minimum',
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
          'At the start, far from any minimum, the slopes are steep: the gradients are at their largest.',
          'A step is the learning rate times the gradient, so the full rate times a large gradient makes a huge step.',
          'A step that large can overshoot the minimum and blow up, as too large a learning rate does.',
          'Warmup keeps the first steps small, and lets the rate grow as the gradients shrink.',
        ],
      };
    },
  },
];
