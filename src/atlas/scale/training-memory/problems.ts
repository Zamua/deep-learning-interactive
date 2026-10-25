import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round } from '../../kit';
import { N, big, clean, traps, words } from '../kit';

/** Model sizes in billions, larger and less round with difficulty. */
const size = (rng: Rng, d: number): number =>
  pick(rng, d < 0.35 ? [1, 2, 3, 5] : d < 0.7 ? [7, 13, 0.5, 1.5, 6] : [70, 175, 34, 0.125, 2.5, 65]);

const RECIPE = '16-bit weights and gradients, a 32-bit master copy of the weights, and Adam\'s $\\sym{m}{m}$ and $\\sym{v}{v}$ in 32 bits';
const PARTS = '2 (16-bit weights) + 2 (gradients) + 4 (master copy) + 4 ($\\sym{m}{m}$) + 4 ($\\sym{v}{v}$) = 16';
const GB = 'A GB is $10^9$ bytes.';

/** A part of the 16 bytes per parameter, what it costs, and the slip it invites. */
const PIECES: { name: string; bytes: number; slip: { bytes: number; why: string } }[] = [
  { name: 'the 16-bit weights', bytes: 2, slip: { bytes: 4, why: 'That is the 32-bit master copy. The weights the math uses are 16-bit: 2 bytes each.' } },
  { name: 'the gradients', bytes: 2, slip: { bytes: 4, why: 'Gradients are kept in 16 bits, like the weights they come from: 2 bytes each.' } },
  { name: 'the 32-bit master copy of the weights', bytes: 4, slip: { bytes: 2, why: 'That is the 16-bit copy. The master copy is 32-bit: 4 bytes each.' } },
  { name: 'Adam\'s $\\sym{m}{m}$ and $\\sym{v}{v}$ together', bytes: 8, slip: { bytes: 4, why: 'That is only one of them. $\\sym{m}{m}$ and $\\sym{v}{v}$ take 4 bytes each: 8 together.' } },
  { name: 'the optimizer\'s state (the master copy, $\\sym{m}{m}$ and $\\sym{v}{v}$)', bytes: 12, slip: { bytes: 8, why: 'That leaves out the master copy. The optimizer keeps it as well as $\\sym{m}{m}$ and $\\sym{v}{v}$: 4 + 4 + 4 = 12 bytes.' } },
  { name: 'the weights and gradients together', bytes: 4, slip: { bytes: 8, why: 'Both are 16-bit, 2 bytes each: 4 together. 8 would need them in 32 bits.' } },
];

export const generators: Generator[] = [
  {
    id: 'total',
    make(rng, d) {
      const n = size(rng, d);
      const v = clean(16 * n);
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam: ${RECIPE}. How many GB does that take, before anything else? ${GB}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 2 * n, why: 'That counts only the 16-bit weights. Training also keeps gradients, a master copy and Adam\'s two moments: 16 bytes per parameter.' },
          { value: 4 * n, why: 'That is one 32-bit number per parameter. Training keeps five numbers per parameter, 16 bytes in all.' },
          { value: 12 * n, why: 'That is the optimizer\'s 12 bytes: master copy, $\\sym{m}{m}$ and $\\sym{v}{v}$. Add the 16-bit weights and gradients, 2 bytes each.' },
        ]),
        solution: [
          `Bytes per parameter: ${PARTS}.`,
          `$16 \\times ${num(n)} \\times 10^9 = ${num(v)} \\times 10^9$ bytes: ${num(v)} GB.`,
        ],
      };
    },
  },
  {
    id: 'gpus',
    make(rng, d) {
      for (;;) {
        const n = size(rng, d);
        const mem = pick(rng, [16, 24, 40, 48, 80]);
        const total = clean(16 * n);
        const v = Math.ceil(total / mem - 1e-9);
        if (v < 2) continue;
        const short = Math.floor(total / mem + 1e-9);
        return {
          prompt: `A model with ${words(n * 1e9)} parameters trains with Adam, at 16 bytes per parameter. What is the fewest ${mem} GB GPUs that can hold that, counting nothing else? ${GB}`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            ...(short !== v && short > 0 ? [{ value: short, why: `$${big(total)} / ${mem} \\approx ${num(round(total / mem, 2))}$: ${short} GPU${short > 1 ? 's leave' : ' leaves'} part of it with nowhere to go, so round up.` }] : []),
            { value: Math.ceil((2 * n) / mem - 1e-9), why: 'That fits only the 16-bit weights, 2 bytes per parameter. Training needs 16.' },
            { value: Math.ceil((4 * n) / mem - 1e-9), why: 'That fits one 32-bit copy of the weights, 4 bytes per parameter. Training needs 16.' },
          ]),
          solution: [
            `Memory: $16 \\times ${num(n)} \\times 10^9$ bytes $= ${big(total)}$ GB.`,
            Number.isInteger(clean(total / mem)) ? `$${big(total)} / ${mem} = ${v}$: ${v} GPUs.` : `$${big(total)} / ${mem} \\approx ${num(round(total / mem, 2))}$, rounded up: ${v} GPUs.`,
          ],
        };
      }
    },
  },
  {
    id: 'part',
    make(rng, d) {
      const n = size(rng, d);
      const p = pick(rng, PIECES);
      const v = clean(p.bytes * n);
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam: ${RECIPE}. How many GB go to ${p.name}? ${GB}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: p.slip.bytes * n, why: p.slip.why },
          { value: 16 * n, why: `That is all 16 bytes per parameter, and only ${p.bytes} of them go to ${p.name}.` },
        ]),
        solution: [
          `Bytes per parameter: ${PARTS}.`,
          `Of those, ${p.name}: ${p.bytes} bytes per parameter.`,
          `$${p.bytes} \\times ${num(n)} \\times 10^9 = ${num(v)} \\times 10^9$ bytes: ${num(v)} GB.`,
        ],
      };
    },
  },
  {
    id: 'what-grows',
    make(rng, d) {
      const n = size(rng, d);
      const b = pick(rng, [32, 64, 128, 256, 512]);
      const kind = rng.int(3);
      const start = `A model with ${words(n * 1e9)} parameters trains with Adam on batches of ${b} examples, at 16 bytes per parameter.`;
      if (kind === 0) {
        const options = ['It stays the same', 'It doubles', 'It grows by 16 bytes per example', 'It halves'];
        return {
          prompt: `${start} The batch grows to ${2 * b} examples. What happens to the memory for the weights, gradients, master copy and Adam's state?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [null, 'Every one of those counts parameters, not examples. The batch size never enters the count.', 'The 16 bytes are per parameter, not per example: each weight has one gradient and one $\\sym{m}{m}$ and $\\sym{v}{v}$, however many examples it sees.', 'Nothing here is divided among the examples: the count depends only on the parameters.'],
          },
          solution: ['Weights, gradients, master copy, $\\sym{m}{m}$ and $\\sym{v}{v}$ hold one number each per parameter.', `The batch size does not appear: still 16 bytes for each of the ${words(n * 1e9)} parameters.`],
        };
      }
      if (kind === 1) {
        const options = ['It doubles', 'It stays the same', 'It grows four times', 'It grows by only 16 bytes'];
        return {
          prompt: `${start} A new model has twice as many parameters, ${words(2 * n * 1e9)}. What happens to that memory?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [null, 'It is 16 bytes per parameter, so it follows the parameter count.', 'Four times is what doubling both sides of a matrix does. Here the parameter count itself doubles, and the memory is 16 bytes per parameter.', 'It grows by 16 bytes for every new parameter, and there are $' + num(n) + '$ billion new ones.'],
          },
          solution: [`Memory is $16${N}$ bytes, in proportion to the parameter count.`, `Twice the parameters: $16 \\times ${num(2 * n)} = ${num(clean(32 * n))}$ GB instead of $${num(clean(16 * n))}$: it doubles.`],
        };
      }
      const options = ['8 bytes', '16 bytes, as before', '12 bytes', '4 bytes'];
      return {
        prompt: `${start} It switches from Adam to plain gradient descent, which keeps no $\\sym{m}{m}$ or $\\sym{v}{v}$ but still uses the 16-bit weights, gradients and master copy. How many bytes per parameter does that take?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [null, 'Plain gradient descent keeps no running averages, so $\\sym{m}{m}$ and $\\sym{v}{v}$, 4 bytes each, go away.', 'That removes only one of $\\sym{m}{m}$ and $\\sym{v}{v}$: both go.', 'That also drops the gradients and the master copy, which plain descent still uses.'],
        },
        solution: ['Adam\'s $\\sym{m}{m}$ and $\\sym{v}{v}$ are 4 bytes each; plain gradient descent keeps neither.', 'What is left: 2 (weights) + 2 (gradients) + 4 (master copy) = 8 bytes per parameter.'],
      };
    },
  },
];
