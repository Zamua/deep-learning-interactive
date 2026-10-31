import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, num, pick, round, traps, vec, vtraps } from '../../kit';
import { choice } from '../kit';

/** A weight between steps, 0.1 to 0.4 of a step from the nearest one, rounding to a nonzero integer in range. */
function weight(rng: Rng, s: number, qmax: number, neg: boolean, places: number): number {
  for (;;) {
    const unit = 10 ** places;
    const w = int(rng, neg ? -Math.round(qmax * s * unit) : 1, Math.round(qmax * s * unit)) / unit;
    const r = Math.abs(w / s);
    const off = Math.abs(r - Math.round(r));
    if (off > 0.099 && off < 0.401 && Math.round(r) >= 1 && Math.round(r) <= qmax) return w;
  }
}

const q = (w: number, s: number) => Math.round(w / s) + 0;

export const generators: Generator[] = [
  {
    id: 'quantize',
    make(rng, d) {
      const s = d < 0.35 ? 0.1 : d < 0.7 ? pick(rng, [0.1, 0.2, 0.5]) : pick(rng, [0.05, 0.02, 0.25, 0.2]);
      const n = d < 0.7 ? 3 : 4;
      const places = s === 0.02 || s === 0.05 || s === 0.25 ? 3 : 2;
      let w: number[];
      do w = Array.from({ length: n }, () => weight(rng, s, 7, d >= 0.35, places));
      while (new Set(w).size < n);
      const v = w.map((x) => q(x, s));
      return {
        prompt: `Weights $\\symw = ${vec(w)}$ are stored as 4-bit integers with scale $s = ${num(s)}$. What integers are stored?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: w.map((x) => Math.trunc(x / s) + 0), why: 'That drops the decimals of $\\symw / s$. Round to the nearest integer instead.' },
          { value: w.map((x) => Math.round(x * s * 1000) / 1000), why: 'That multiplies by the scale. Storing divides by it; multiplying is the way back.' },
          { value: w.map((x) => clean(q(x, s) * s)), why: 'That is the weight you get back, $q \\times s$. The stored values are the integers $q$.' },
        ]),
        solution: [
          `Each weight is stored as $q = \\mathrm{round}(\\symw / s)$. Divide by $s = ${num(s)}$: $\\symw / s = ${vec(w.map((x) => round(x / s, 2) + 0))}$.`,
          `Round each to the nearest integer: $q = ${vec(v)}$.`,
          `All lie within $-7$ to $7$, so each fits in 4 bits.`,
        ],
      };
    },
  },
  {
    id: 'error',
    make(rng, d) {
      const kind = d < 0.35 ? 'back' : d < 0.7 ? pick(rng, ['back', 'error'] as const) : pick(rng, ['error', 'max'] as const);
      const s = d < 0.35 ? pick(rng, [0.1, 0.5]) : pick(rng, [0.1, 0.2, 0.05, 0.25, 0.02]);
      if (kind === 'max') {
        const bits = pick(rng, [4, 8]);
        const v = clean(s / 2);
        return {
          prompt: `Weights are stored as ${bits}-bit integers with scale $s = ${num(s)}$. For a weight inside the integers' range, what is the largest rounding error?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: s, why: 'That is a whole step. Rounding to the nearest integer moves at most half a step.' },
            { value: 0, why: 'The round trip is exact only for weights that land on a step. A weight halfway between two steps moves by half a step.' },
            { value: clean(s / 4), why: 'That is the average error over many weights, not the largest. The worst case is halfway between two steps.' },
          ]),
          solution: [
            `A weight is stored as the integer nearest $\\symw / s$ and used as that integer times $s$, so the values it can come back as are steps of $s = ${num(s)}$ apart.`,
            'Rounding sends a weight to the nearest step, so it moves at most half a step: the worst weights sit halfway between two.',
            `The largest error is $s / 2 = ${num(v)}$, whatever the number of bits.`,
          ],
        };
      }
      const places = s === 0.02 || s === 0.05 || s === 0.25 ? 3 : 2;
      const w = weight(rng, s, 7, d >= 0.35, places);
      const qi = q(w, s);
      const back = clean(qi * s);
      const err = clean(Math.abs(w - back));
      const v = kind === 'back' ? back : err;
      return {
        prompt: `A weight $\\symw = ${num(w)}$ is quantized with scale $s = ${num(s)}$. ${kind === 'back' ? 'What value is used in its place?' : 'How far is the value used from the original weight?'}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: qi, why: `That is the stored integer $q$. Multiply it by $s = ${num(s)}$ to get the value used.` },
          ...(kind === 'error' ? [{ value: back, why: 'That is the value used. The question asks how far it is from the original weight.' }, { value: clean(s / 2), why: 'That is the largest the error can be, half a step. This weight\'s own error is smaller.' }] : []),
          { value: clean(w / s), why: 'That is $\\symw / s$ before rounding.' },
          ...(kind === 'back' ? [{ value: w, why: 'That is the original weight. Rounding to a whole number of steps changes it slightly.' }] : []),
        ]),
        solution: [
          `It is stored as $q = \\mathrm{round}(\\symw / s)$: $\\symw / s = ${num(w)} / ${num(s)} = ${num(round(w / s, 2) + 0)}$, which rounds to $q = ${qi}$.`,
          `The value used is $q \\times s = ${qi} \\times ${num(s)} = ${num(back)}$.`,
          ...(kind === 'error' ? [`$${num(w)}$ and $${num(back)}$ are $${num(err)}$ apart: less than half a step, $s / 2 = ${num(clean(s / 2))}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'memory',
    make(rng, d) {
      const N = d < 0.35 ? pick(rng, [1, 2, 4, 10]) : pick(rng, [3, 7, 8, 13, 34, 70]);
      const kind = d < 0.35 ? 'size' : pick(rng, ['size', 'size', 'save'] as const);
      const bits = kind === 'size' ? (d < 0.35 ? pick(rng, [8, 4]) : pick(rng, [16, 8, 4])) : pick(rng, [8, 4]);
      const gb = (b: number) => clean((N * b) / 8);
      if (kind === 'save') {
        const v = clean(gb(16) - gb(bits));
        return {
          prompt: `A model has ${N} billion parameters stored in 16 bits. How many GB does storing them in ${bits} bits instead save?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: gb(bits), why: `That is the size at ${bits} bits. The saving is the 16-bit size minus that.` },
            { value: clean(N * (16 - bits)), why: 'That counts bits as bytes. Divide the bits by 8 for bytes.' },
            { value: gb(16), why: 'That is the whole 16-bit model. Some of it is still needed at the lower precision.' },
          ]),
          solution: [
            `At 16 bits, 2 bytes per weight: $${N} \\times 2 = ${num(gb(16))}$ GB.`,
            `At ${bits} bits, $${num(bits / 8)}$ byte${bits === 8 ? '' : 's'} per weight: $${N} \\times ${num(bits / 8)} = ${num(gb(bits))}$ GB.`,
            `The saving is $${num(gb(16))} - ${num(gb(bits))} = ${num(v)}$ GB.`,
          ],
        };
      }
      const v = gb(bits);
      return {
        prompt: `A model has ${N} billion parameters. How many GB do its weights take stored in ${bits} bits each?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: N * bits, why: 'That counts bits as bytes. There are 8 bits in a byte.' },
          ...(bits !== 16 ? [{ value: N * 2, why: 'That is the 16-bit size, 2 bytes per weight.' }] : []),
          { value: N * 16, why: 'That is about what training with Adam needs, 16 bytes per parameter. The weights alone take far less.' },
        ]),
        solution: [`${bits} bits is $${bits} / 8 = ${num(bits / 8)}$ byte${bits === 8 ? '' : 's'} per weight.`, `$${N} \\text{ billion} \\times ${num(bits / 8)} = ${num(v)}$ GB.`],
      };
    },
  },
  {
    id: 'tradeoff',
    make(rng) {
      const kind = pick(rng, ['bits', 'scale'] as const);
      const N = pick(rng, [3, 7, 8, 13, 70]);
      if (kind === 'scale') {
        const s = pick(rng, [0.01, 0.02, 0.05, 0.1]);
        const up = rng.next() < 0.5;
        const s2 = clean(up ? s * 2 : s / 2);
        return {
          prompt: `Weights are quantized with scale $s = ${num(s)}$. With $s = ${num(s2)}$ instead, and integers of the same bit width, what happens to the largest rounding error?`,
          answer: choice([
            { text: up ? 'It doubles: it is half a step, and the step doubles' : 'It halves: it is half a step, and the step halves', why: null },
            { text: 'It stays the same: the bit width sets the error', why: `The error is at most half a step, $s / 2$, and the step changed from $${num(s)}$ to $${num(s2)}$.` },
            { text: up ? 'It halves: bigger steps mean fewer mistakes' : 'It doubles: smaller steps round more often', why: `Each weight still moves to its nearest step, at most half a step away. That limit is $s / 2$, which ${up ? 'grows' : 'shrinks'} with $s$.` },
            { text: 'The weights come back exactly, with no error at all', why: 'Only weights that land exactly on a step come back unchanged. Most fall between two and are rounded.' },
          ]),
          solution: [
            'Rounding moves a weight at most half a step, so the largest error is $s / 2$.',
            `With $s = ${num(s2)}$ that is $${num(clean(s2 / 2))}$ instead of $${num(clean(s / 2))}$.`,
            up ? 'A bigger scale covers a wider range with the same integers, at the price of coarser steps.' : 'A smaller scale gives finer steps but covers a narrower range: weights beyond it no longer fit.',
          ],
        };
      }
      const [from, to] = pick(rng, [
        [16, 8],
        [16, 4],
        [8, 4],
      ] as const);
      const ratio = from / to;
      return {
        prompt: `A ${N}-billion-parameter model's weights go from ${from} bits to ${to} bits each. What changes?`,
        answer: choice([
          { text: `${ratio === 2 ? 'Half' : 'A quarter of'} the bytes, and coarser steps, so larger rounding errors`, why: null },
          { text: `${ratio === 2 ? 'Half' : 'A quarter of'} the bytes, and the very same weights come back`, why: 'Fewer bits mean fewer integers to round to, so each weight lands farther from its true value on average.' },
          { text: `${ratio === 2 ? 'Half' : 'A quarter'} as many weights, each just as precise`, why: `Every one of the ${N} billion weights is still there. Each just takes fewer bits.` },
          { text: `${ratio === 2 ? 'Half' : 'A quarter of'} the bytes, and smaller rounding errors`, why: 'Fewer bits give fewer steps over the same range, so each step is wider and the rounding error grows.' },
        ]),
        solution: [
          `Each weight takes ${to} bits instead of ${from}: $${to} / ${from} = 1/${ratio}$ of the bytes, for the same ${N} billion weights.`,
          `${to} bits hold fewer integers, so over the same range each step is wider, and rounding moves a weight up to half that wider step.`,
        ],
      };
    },
  },
];
