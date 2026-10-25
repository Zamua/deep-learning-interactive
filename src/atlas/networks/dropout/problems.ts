import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, round, vec } from '../../kit';
import { clean, placesFor, traps, vtraps } from '../kit';

const P = 2;

/** The rounding instruction, only when two decimals actually round the answer. */
const round2 = (v: number): string => (placesFor(v) ? ' Round to two decimals.' : '');

/** A 0/1 mask of length n with at least one unit kept and one dropped. */
function mask(rng: Rng, n: number): number[] {
  for (;;) {
    const m = Array.from({ length: n }, () => (rng.next() < 0.6 ? 1 : 0));
    if (m.includes(0) && m.includes(1)) return m;
  }
}

export const generators: Generator[] = [
  {
    id: 'mask',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const p = d < 0.35 ? pick(rng, [0.5, 0.25]) : d < 0.7 ? pick(rng, [0.5, 0.8, 0.25]) : pick(rng, [0.8, 0.75, 0.6, 0.9]);
      const h = d < 0.7 ? ints(rng, n, 1, 6) : ints(rng, n, 1, 12).map((v) => v / 2);
      const m = mask(rng, n);
      const out = h.map((v, i) => clean((v * m[i]!) / p));
      const exact = out.every((v) => round(v, 2) === v);
      return {
        prompt: `A hidden layer outputs $\\symh = ${vec(h)}$. Inverted dropout with keep probability $p = ${num(p)}$ draws the mask $m = ${vec(m)}$. What does the layer pass on during training?${exact ? '' : ' Round to two decimals.'}`,
        answer: { kind: 'vector', value: out, places: placesFor(...out) },
        traps: vtraps(out, [
          { value: h.map((v, i) => v * m[i]!), why: `That drops the right units but forgets to divide the kept ones by $p = ${num(p)}$.` },
          { value: h.map((v, i) => v * m[i]! * p), why: 'That multiplies the kept units by $p$. Inverted dropout divides by $p$, scaling them up.' },
          { value: h.map((v) => v / p), why: 'That scales every unit but forgets to drop the masked ones: zero every unit where $m$ is 0.' },
        ], P),
        solution: [
          `Zero the dropped units, multiplying $\\symh$ by $m$ entry by entry: $${vec(h.map((v, i) => v * m[i]! + 0))}$.`,
          `Divide the kept ones by $p = ${num(p)}$${p === 0.5 ? ', which doubles them' : p === 0.25 ? ', which multiplies them by 4' : ''}: $${vec(out.map((v) => round(v, 2)))}$.`,
          'Averaged over many masks, each unit\'s output then matches its value without dropout.',
        ],
      };
    },
  },
  {
    id: 'expected',
    make(rng, d) {
      const kind = d < 0.35 ? rng.int(2) : rng.int(4);
      const p = pick(rng, [0.5, 0.8, 0.25, 0.9, 0.75]);
      const v = d < 0.5 ? int(rng, 1, 8) : int(rng, 1, 40) / 10;
      if (kind === 0) {
        return {
          prompt: `Inverted dropout keeps a unit with probability $p = ${num(p)}$. The unit's value is $h = ${num(v)}$. What is its average output during training?`,
          answer: { kind: 'number', value: v, places: placesFor(v) },
          traps: traps(v, [
            { value: p * v, why: 'That is plain dropout, without the division by $p$. Inverted dropout divides the kept value by $p$, which cancels the $p$.' },
            { value: v / p, why: `That is its output when it is kept. It is kept only a fraction ${num(p)} of the time; the rest of the time it outputs 0.` },
          ], P),
          solution: [`Kept, with probability ${num(p)}, the unit outputs $h / p = ${num(v)} / ${num(p)}$; dropped, it outputs 0.`, `Average output: $${num(p)} \\times (${num(v)} / ${num(p)}) + ${num(clean(1 - p))} \\times 0 = ${num(v)}$.`, 'The same as without dropout: that is what the division by $p$ is for.'],
        };
      }
      if (kind === 1) {
        const want = clean(p * v);
        return {
          prompt: `Plain dropout keeps a unit with probability $p = ${num(p)}$. The unit's value is $h = ${num(v)}$. What is its average output during training?${round2(want)}`,
          answer: { kind: 'number', value: want, places: placesFor(want) },
          traps: traps(want, [
            { value: v, why: 'That is what inverted dropout preserves. Without the division by $p$, the unit outputs 0 a fraction of the time, which pulls the average down.' },
            { value: v / p, why: 'Nothing is divided here: the kept unit outputs $h$ unchanged.' },
            { value: (1 - p) * v, why: `That uses $1 - p$, the chance of being dropped. The unit outputs $h$ when it is kept, with probability ${num(p)}.` },
          ], P),
          solution: [`Kept, with probability ${num(p)}, the unit outputs ${num(v)}; dropped, 0.`, `Average output: $${num(p)} \\times ${num(v)} = ${num(want)}$.`, 'Smaller than without dropout, which is why this version must rescale at test time.'],
        };
      }
      if (kind === 2) {
        const want = clean(1 / p);
        return {
          prompt: `Dropout keeps each unit with probability $p = ${num(p)}$. By what factor must a kept unit's output be multiplied so its average stays what it was without dropout?${round2(want)}`,
          answer: { kind: 'number', value: want, places: placesFor(want) },
          traps: traps(want, [
            { value: p, why: 'Multiplying by $p$ shrinks the kept units, and the dropped ones already pull the average down. Divide by $p$ instead.' },
            { value: 1 - p, why: 'That is the chance of being dropped. The kept units must make up for the missing fraction: multiply by $1/p$.' },
          ], P),
          solution: [`Without rescaling, the average output is $p\\,h = ${num(p)}\\,h$.`, `Multiplying the kept output by $1/p$ makes it $p \\times h / p = h$.`, `So the factor is $1 / ${num(p)} ${round(want, 2) === want ? '=' : '\\approx'} ${num(round(want, 2))}$.`],
        };
      }
      const H = pick(rng, [10, 20, 40, 100, 200, 500]);
      const want = clean(p * H);
      return {
        prompt: `A hidden layer has $\\symH = ${H}$ units, and dropout keeps each one with probability $p = ${num(p)}$. On average, how many units are kept in one training step?`,
        answer: { kind: 'number', value: want, places: placesFor(want) },
        traps: traps(want, [
          { value: (1 - p) * H, why: `That is how many are dropped. $p$ is the keep probability: ${num(p)} of the units stay.` },
          { value: H / p, why: 'Divide the kept units\' values by $p$, not the count. On average a fraction $p$ of the units stay.' },
        ], P),
        solution: [`Each unit stays with probability ${num(p)}, so on average $${num(p)} \\times ${H} = ${num(want)}$ units are kept.`, `The other ${num(clean((1 - p) * H))} are zeroed, a different random set every step.`],
      };
    },
  },
  {
    id: 'test-time',
    make(rng) {
      const plain = rng.next() < 0.35;
      const p = pick(rng, [0.5, 0.6, 0.8, 0.9, 0.75]);
      const options = [
        'Keep every unit, and pass $\\symh$ through unchanged',
        'Keep every unit, and multiply each output by $p$',
        'Keep dropping units at random, with the same $p$',
        'Keep every unit, and divide each output by $p$',
      ];
      const random = 'Then the same input could get a different prediction every time. At test time every unit is kept.';
      return {
        prompt: plain
          ? `A layer was trained with plain dropout, keeping each unit with probability $p = ${num(p)}$. What should it do at test time?`
          : `A layer was trained with inverted dropout, keeping each unit with probability $p = ${num(p)}$. What should it do at test time?`,
        answer: {
          kind: 'choice',
          options,
          correct: plain ? 1 : 0,
          why: plain
            ? [
                `In training each unit averaged $${num(p)}\\,h$. Passing $\\symh$ unchanged makes every test-time output $1/${num(p)}$ times too large for the next layer.`,
                null,
                random,
                'That would make the outputs larger still. Training averaged $p\\,h$, so test time must shrink $\\symh$ to match.',
              ]
            : [
                null,
                'That is the fix for plain dropout. Inverted dropout already divided by $p$ during training, so the averages match with nothing done at test time.',
                random,
                'The division by $p$ happens during training, on the kept units only. At test time nothing is dropped, so nothing needs making up.',
              ],
        },
        solution: plain
          ? ['With plain dropout each unit\'s average output in training is $p\\,h$.', 'At test time every unit is kept, so multiply by $p$ to match what the next layer saw in training.']
          : ['With inverted dropout each unit\'s average output in training is $p \\times h/p = h$.', 'At test time every unit is kept and nothing is scaled: $\\symh$ passes straight through, matching the training average.', 'That is why the division is done in training: test time, which runs far more often, needs no change at all.'],
      };
    },
  },
];
