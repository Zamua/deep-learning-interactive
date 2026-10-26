import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round } from '../../kit';
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
      const exact = cos === 0 || Math.abs(cos) === 0.5;
      const eq = exact ? '=' : '\\approx';
      const prod = r4(0.5 * span * (1 + cos));
      const prodEq = clean(0.5 * span * (1 + cos)) === prod ? '=' : '\\approx';
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
          `The schedule: $${COSINE}$.`,
          `$t / T = ${big(t)} / ${big(T)} = ${label}$, so $\\cos\\big(\\pi \\cdot ${label}\\big) ${eq} ${num(cos)}$.`,
          `Add 1: $1 + ${cos < 0 ? `(${num(cos)})` : num(cos)} = ${num(clean(1 + cos))}$.`,
          `Half the gap: $\\tfrac{1}{2}(${num(hi)} - ${num(lo)}) = ${num(clean(span / 2))}$.`,
          lo > 0
            ? `Times $1 + \\cos$: $${num(clean(span / 2))} \\times ${num(clean(1 + cos))} ${prodEq} ${num(prod, 4)}$.`
            : `Times $1 + \\cos$: $\\symeta_t = ${num(clean(span / 2))} \\times ${num(clean(1 + cos))} ${prodEq} ${num(v, 4)}$.`,
          ...(lo > 0 ? [`Add the bottom: $\\symeta_t ${prodEq} ${num(lo)} + ${num(prod, 4)} = ${num(v, 4)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'warm-cosine',
    make(rng, d) {
      const hi = pick(rng, d < 0.35 ? [0.1, 1] : [0.1, 0.4, 0.6, 0.2, 1]);
      const lo = d < 0.5 ? 0 : pick(rng, [0, 0.01, 0.02]);
      const k = pick(rng, [500, 1000, 2000]);
      const T = pick(rng, [1200, 3000, 6000, 12000]);
      if (d >= 0.5 && rng.next() < 0.3) {
        const f = pick(rng, [0.2, 0.25, 0.4, 0.5, 0.6, 0.75]);
        const t = clean(k * f);
        const v = clean(hi * f);
        return {
          prompt: `A run warms its learning rate up linearly from 0 to $\\symeta_{\\max} = ${num(hi)}$ over the first ${commas(k)} steps, then cosine-decays it to $\\symeta_{\\min} = ${num(lo)}$ over the next ${commas(T)}. What is the learning rate at step ${commas(t)}?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: hi, why: 'That is the peak. The warmup has not finished yet, so the rate is still climbing.' },
            { value: f, why: `That is the share of the warmup done, $${big(t)} / ${big(k)}$. Multiply it by $\\symeta_{\\max}$.` },
          ]),
          solution: [
            `Step ${commas(t)} comes before the warmup ends at step ${commas(k)}: the rate is still climbing.`,
            `The share of the warmup done: $${big(t)} / ${big(k)} = ${num(f)}$.`,
            `The rate: $${num(f)} \\times ${num(hi)} = ${num(v)}$.`,
          ],
        };
      }
      const [label, f, cos] = d < 0.35 ? pick(rng, COS.slice(0, 3)) : pick(rng, COS);
      const into = Math.round(T * f);
      const t = k + into;
      const span = clean(hi - lo);
      const v = round(lo + 0.5 * span * (1 + cos), 4);
      const r4 = (x: number) => round(x, 4);
      const at = (x: number) => r4(lo + 0.5 * span * (1 + Math.cos(Math.PI * x)));
      const eq = cos === 0 || Math.abs(cos) === 0.5 ? '=' : '\\approx';
      const prod = r4(0.5 * span * (1 + cos));
      const prodEq = clean(0.5 * span * (1 + cos)) === prod ? '=' : '\\approx';
      return {
        prompt: `A run warms its learning rate up linearly from 0 to $\\symeta_{\\max} = ${num(hi)}$ over the first ${commas(k)} steps, then cosine-decays it to $\\symeta_{\\min} = ${num(lo)}$ over the next ${commas(T)}. What is the learning rate at step ${commas(t)}? Use $\\cos\\big(\\pi \\cdot ${label}\\big) ${eq} ${num(cos)}$, and round to four decimals.`,
        answer: { kind: 'number', value: v, places: 4 },
        traps: traps(v, [
          ...(t <= T ? [{ value: at(t / T), why: `That counts the cosine's $t$ from step 0. It starts where the warmup ends: $t = ${big(t)} - ${big(k)} = ${big(into)}$.` }] : []),
          { value: at(t / (k + T)), why: `That spreads the cosine over the whole run. It covers only the ${commas(T)} steps after the warmup.` },
          { value: r4(lo + 0.5 * span * cos), why: 'That leaves out the 1 in $1 + \\cos$. Without it the rate would go negative in the second half.' },
          ...(lo > 0 ? [{ value: prod, why: 'That leaves out $\\symeta_{\\min}$: the cosine part sits on top of it.' }] : []),
        ].filter((x) => Math.abs(x.value - v) >= 0.0001)),
        solution: [
          `The warmup ends at step ${commas(k)}, so step ${commas(t)} is $${big(t)} - ${big(k)} = ${big(into)}$ steps into the decay.`,
          `$t / T = ${big(into)} / ${big(T)} = ${label}$, so $\\cos\\big(\\pi \\cdot ${label}\\big) ${eq} ${num(cos)}$.`,
          `Add 1: $1 + ${cos < 0 ? `(${num(cos)})` : num(cos)} = ${num(clean(1 + cos))}$.`,
          `Half the gap: $\\tfrac{1}{2}(${num(hi)} - ${num(lo)}) = ${num(clean(span / 2))}$.`,
          `Times $1 + \\cos$: $${num(clean(span / 2))} \\times ${num(clean(1 + cos))} ${prodEq} ${num(prod, 4)}$.`,
          ...(lo > 0 ? [`Add the bottom: $${num(lo)} + ${num(prod, 4)} = ${num(v, 4)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'which',
    make(rng, d) {
      const peak = pick(rng, [0.1, 0.4, 1, 0.01]);
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
