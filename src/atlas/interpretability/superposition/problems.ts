import type { Generator } from '../../../mastery/domain/types';
import { big, clean, int, num, pick, traps, vec, vtraps } from '../../kit';
import { whys } from '../../training/kit';
import { D, F } from '../kit';

/** Three unit directions 120 degrees apart in two dimensions, as the prompts give them. */
const DIRS = [
  [1, 0],
  [-0.5, 0.87],
  [-0.5, -0.87],
];
const SETUP = 'Three features share a 2-dimensional stream along directions of length 1, 120 degrees apart, so any two of them have dot product $-0.5$.';
const fi = (i: number) => `${F}_{${i}}`;

export const generators: Generator[] = [
  {
    id: 'readout',
    make(rng, d) {
      const k = rng.int(3);
      const others = [0, 1, 2].filter((i) => i !== k);
      const f = [0, 0, 0];
      let relu = false;
      if (d < 0.35) {
        const j = pick(rng, others);
        f[k] = int(rng, 1, 4);
        f[j] = int(rng, 1, 4);
      } else if (d < 0.7) {
        for (let i = 0; i < 3; i++) f[i] = int(rng, 1, 4);
      } else {
        relu = rng.next() < 0.5;
        f[k] = relu ? pick(rng, [0, 0.5, 1]) : pick(rng, [0.5, 1.5, 2.5, 3]);
        for (const i of others) f[i] = pick(rng, [0, 1, 2, 1.5, 3]);
        if (f[others[0]!] === 0 && f[others[1]!] === 0) f[others[0]!] = 2;
      }
      const leak = clean(-0.5 * others.reduce((a, i) => a + f[i]!, 0));
      const raw = clean(f[k]! + leak);
      const ans = relu ? Math.max(0, raw) : raw;
      const active = [0, 1, 2].filter((i) => f[i] !== 0);
      const on = others.filter((i) => f[i] !== 0);
      const off = [0, 1, 2].filter((i) => f[i] === 0);
      return {
        prompt: `${SETUP} The active features are ${active.map((i) => `$${fi(i)} = ${num(f[i]!)}$`).join(', ')}${off.length ? `; ${off.map((i) => `$${fi(i)}$`).join(' and ')} ${off.length > 1 ? 'are' : 'is'} off` : ''}. What does reading feature ${k} give${relu ? ' after a ReLU' : ''}?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: f[k]!, why: 'That ignores the other active features. Each one leaks in through its overlap of $-0.5$.' },
          { value: clean(f[k]! - leak), why: 'That adds the leaks. The overlap is $-0.5$, so each other feature pulls the reading down.' },
          { value: clean(f[k]! + 2 * leak), why: 'That uses an overlap of $-1$. Directions 120 degrees apart overlap by $-0.5$.' },
          ...(relu ? [{ value: raw, why: 'That is the reading before the ReLU, which clips negative values to 0.' }] : []),
        ]),
        solution: [
          `Reading feature ${k} gives its own value, plus $-0.5$ times each other value that is on.`,
          `Its own value: $${fi(k)} = ${num(f[k]!)}$${f[k] === 0 ? ', since it is off' : ''}.`,
          ...on.map((i) => `Feature ${i} leaks in: $-0.5 \\times ${num(f[i]!)} = ${num(clean(-0.5 * f[i]!))}$.`),
          `Add them: $${num(f[k]!)}${on.map((i) => ` - ${num(clean(0.5 * f[i]!))}`).join('')} = ${num(raw)}$.`,
          ...(relu ? [raw < 0 ? `The ReLU clips the negative reading to 0: the leak disappears.` : `The ReLU leaves a positive reading as it is: $${num(ans)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'store',
    make(rng, d) {
      const f = [0, 0, 0];
      const n = d < 0.35 ? 2 : 3;
      const on = rng.shuffle([0, 1, 2]).slice(0, n);
      for (const i of on) f[i] = int(rng, 1, d < 0.6 ? 3 : 4);
      const ans = [0, 1].map((c) => clean(f.reduce((a, v, i) => a + v * DIRS[i]![c]!, 0)));
      const flip = [ans[0]!, clean(0.87 * (f[1]! + f[2]!))];
      return {
        prompt: `${SETUP} Their directions are $[1,\\ 0]$ for feature 0, $[-0.5,\\ 0.87]$ for feature 1 and $[-0.5,\\ -0.87]$ for feature 2. The features have values $${F} = ${vec(f)}$. What is the stream? Round to two decimals.`,
        answer: { kind: 'vector', value: ans, places: 2 },
        traps: vtraps(ans, [
          { value: [f[0]!, f[1]!], why: 'That puts features straight into the dimensions. Three features cannot each have a dimension of their own here: each adds its direction.' },
          { value: [0, 1].map((c) => clean(on.reduce((a, i) => a + DIRS[i]![c]!, 0))), why: 'That adds the active directions without scaling them by their values.' },
          { value: flip, why: 'That gives feature 2 a second coordinate of $+0.87$. Its direction points down: $-0.87$.' },
        ], 2),
        solution: [
          'The stream is each value times its direction, added up.',
          ...[0, 1, 2].filter((i) => f[i]).map((i) => `$${num(f[i]!)} \\times ${vec(DIRS[i]!)} = ${vec(DIRS[i]!.map((v) => clean(f[i]! * v)))}$.`),
          ...[0, 1].map((c) => `${c === 0 ? 'First' : 'Second'} entries: $${[0, 1, 2].filter((i) => f[i]).map((i) => num(clean(f[i]! * DIRS[i]![c]!))).join(' + ').replace(/\+ -/g, '- ')} = ${num(ans[c]!)}$.`),
          `So the stream is $${vec(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'sparsity',
    make(rng) {
      if (rng.next() < 0.6) {
        const pct = pick(rng, [1, 2, 5, 0.5, 0.1]);
        const n = pick(rng, [1000, 5000, 10000, 50000]);
        const dim = pick(rng, [256, 512, 768]);
        const options = [
          'Interference only arises between features that are active at the same time, and that is rare',
          'Sparse features have small values, so their leaks are small too',
          'Sparsity makes the features\' directions exactly perpendicular',
          'A sparse feature needs only part of a dimension of its own',
        ];
        const reasons = [
          '',
          'A sparse feature can be large when it is on. What is small is the chance that two are on together.',
          'The directions stay where they are, overlapping a little. Sparsity changes how often the overlaps matter.',
          'Every feature still gets a whole direction across all the dimensions. Sparsity only makes the overlaps rarely matter.',
        ];
        return {
          prompt: `A stream of $${D} = ${dim}$ dimensions stores ${big(n)} features along nearly perpendicular directions. Each feature is active on about ${pct}% of tokens. Why does that sparsity make the arrangement work?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'Reading a feature picks up interference only from the other features that are on right now.',
            `If each is on ${pct}% of the time, a token usually has only a handful on at once, so most readings are nearly clean.`,
          ],
        };
      }
      const dim = pick(rng, [3, 64, 128, 512, 768, 1024]);
      const options = [`$${big(dim)}$`, `$${big(dim * 2)}$`, `$${big(dim * dim)}$`, 'As many as you like, if each pair overlaps only a little'];
      const reasons = [
        '',
        `Each exactly perpendicular direction uses up one dimension, so ${big(dim)} is the limit.`,
        `That counts pairs of dimensions. Exactly perpendicular directions number at most $${D}$.`,
        'That is true for nearly perpendicular directions, which is how superposition fits more. Exactly perpendicular ones stop at $' + D + '$.',
      ];
      return {
        prompt: `A stream has $${D} = ${big(dim)}$ dimensions. At most how many features can it give directions that are exactly perpendicular to each other?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `A space of $${D}$ dimensions has at most $${D}$ mutually perpendicular directions.`,
          'To hold more features, a model gives up exact right angles and accepts a little overlap between them: superposition.',
        ],
      };
    },
  },
];
