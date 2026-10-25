import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { big, clean, commas, sci, traps, whys, words } from '../kit';

const BYTES: Record<string, number> = { fp32: 4, bf16: 2, fp16: 2, fp8: 1 };

const size = (rng: Rng, d: number): number => pick(rng, d < 0.35 ? [1, 2, 3, 5, 10] : d < 0.7 ? [7, 13, 0.5, 1.5, 8] : [70, 175, 34, 405, 2.5]);

export const generators: Generator[] = [
  {
    id: 'bytes',
    make(rng, d) {
      const n = size(rng, d);
      const f = pick(rng, d < 0.35 ? ['fp32', 'bf16'] : ['fp32', 'bf16', 'fp16', 'fp8']);
      const b = BYTES[f]!;
      const v = clean(b * n);
      return {
        prompt: `A model has ${words(n * 1e9)} weights, stored in ${f}. How many GB do they take?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 8 * b * n, why: `That counts bits. ${f} is ${8 * b} bits, which is ${b} byte${b > 1 ? 's' : ''}.` },
          b === 4 ? { value: 2 * n, why: 'That is a 16-bit format, 2 bytes. fp32 is 32 bits: 4 bytes per number.' } : { value: 4 * n, why: `That is fp32, 4 bytes. ${f} is ${8 * b} bits: ${b} byte${b > 1 ? 's' : ''} per number.` },
        ]),
        solution: [`${f} is ${8 * b} bits per number, which is ${b} byte${b > 1 ? 's' : ''}.`, `$${b} \\times ${num(n)} \\times 10^9$ bytes $= ${num(v)}$ GB.`],
      };
    },
  },
  {
    id: 'saved',
    make(rng, d) {
      const n = size(rng, d);
      const [from, to] = pick(rng, d < 0.35 ? [['fp32', 'bf16']] : [['fp32', 'bf16'], ['fp32', 'fp16'], ['fp32', 'fp8'], ['bf16', 'fp8'], ['fp16', 'fp8']]) as [string, string];
      const b0 = BYTES[from]!;
      const b1 = BYTES[to]!;
      const v = clean((b0 - b1) * n);
      return {
        prompt: `A model's ${words(n * 1e9)} weights are converted from ${from} to ${to}. How many GB does that save?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: b1 * n, why: `That is what the ${to} copy takes. The saving is the old size minus the new one.` },
          { value: b0 * n, why: `That is what the ${from} copy took. The ${to} copy still takes $${b1} \\times ${num(n)}$ GB, so subtract it.` },
          { value: 8 * (b0 - b1) * n, why: `That counts bits. Each number shrinks by ${8 * (b0 - b1)} bits, which is ${b0 - b1} byte${b0 - b1 > 1 ? 's' : ''}.` },
        ]),
        solution: [
          `${from} takes ${b0} bytes per number and ${to} takes ${b1}: each weight saves ${b0 - b1}.`,
          `$${b0 - b1} \\times ${num(n)} \\times 10^9$ bytes $= ${num(v)}$ GB, from $${num(clean(b0 * n))}$ GB down to $${num(clean(b1 * n))}$.`,
        ],
      };
    },
  },
  {
    id: 'formats',
    make(rng, d) {
      const kind = rng.int(3);
      if (kind === 0) {
        // Which 16-bit format keeps a value from becoming 0 or infinity.
        const cases: [number, number, 'tiny' | 'huge' | 'fine'][] = [
          [2, -9, 'tiny'], [5, -10, 'tiny'], [1, -8, 'tiny'], [1, -9, 'tiny'], [4, -11, 'tiny'],
          [1, 5, 'huge'], [2, 5, 'huge'], [7, 4, 'huge'], [3, 6, 'huge'],
          [3, -3, 'fine'], [2, 2, 'fine'], [5, -4, 'fine'], [4, 3, 'fine'], [1, -5, 'fine'],
        ];
        const [m, e, what] = pick(rng, cases);
        const correct = what === 'fine' ? 2 : 0;
        const value = `$${sci(m, e)}$`;
        const options = ['Only bf16', 'Only fp16', 'Both', 'Neither'];
        return {
          prompt: `A number is ${value}. Stored in fp16 and in bf16, which keeps it from becoming 0 or infinity?`,
          answer: {
            kind: 'choice',
            options,
            correct,
            why: whys(4, correct, (i) =>
              i === 0
                ? `${value} is well inside fp16's range too, from about $6 \\times 10^{-8}$ to $65{,}504$: both keep it.`
                : i === 1
                  ? `fp16 has more mantissa bits, so more precision, but only 5 exponent bits: its range ends near $65{,}504$, and below about $6 \\times 10^{-8}$ numbers become 0. bf16 has fp32's range.`
                  : i === 2
                    ? `fp16's range is only about $6 \\times 10^{-8}$ to $65{,}504$, and ${value} is ${what === 'tiny' ? 'below it: it becomes 0' : 'above it: it becomes infinity'}. bf16 keeps fp32's range.`
                    : 'bf16 has the same 8 exponent bits as fp32, so it reaches about $10^{-38}$ to $10^{38}$: it keeps this number, if only to about three significant digits.',
            ),
          },
          solution: [
            'fp16 has 5 exponent bits: its range runs from about $6 \\times 10^{-8}$ to $65{,}504$. bf16 has fp32\'s 8, reaching about $10^{-38}$ to $10^{38}$.',
            what === 'fine' ? `${value} is inside both ranges, so both keep it.` : `${value} is ${what === 'tiny' ? 'below' : 'above'} fp16's range, so fp16 turns it into ${what === 'tiny' ? '0' : 'infinity'}. bf16 keeps it.`,
          ],
        };
      }
      if (kind === 1) {
        // An update too small for bf16's spacing near the weight.
        const [w, gap] = pick(rng, [[1, '0.008'], [2, '0.016'], [0.5, '0.004'], [1.5, '0.008'], [3, '0.016']] as [number, string][]);
        const [um, ue] = pick(rng, [[1, -4], [2, -4], [5, -5], [3, -4], [1, -5]] as [number, number][]);
        const u = `${sci(um, ue)}`;
        const options = ['The update is lost: the weight stays the same', 'The weight changes by exactly the update, as in fp32', 'The weight jumps by a whole bf16 step instead', 'The weight becomes 0, because the update is too small to store'];
        return {
          prompt: `A weight is $${num(w)}$, and one step adds an update of $${u}$. Near $${num(w)}$, neighboring bf16 numbers are about $${gap}$ apart. If the weight is kept only in bf16, what does the step do?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [
              null,
              `bf16 cannot store $${num(w)} + ${u}$: its nearest numbers are $${gap}$ apart, so the sum rounds back to $${num(w)}$. That is why the step goes to a 32-bit master copy.`,
              `Rounding goes to the nearest bf16 number, and $${num(w)}$ is far nearer than the next one, $${gap}$ away.`,
              `The update alone fits in bf16 easily, since bf16 has fp32's range. It is the sum, $${num(w)} + ${u}$, that cannot be told apart from $${num(w)}$.`,
            ],
          },
          solution: [
            `$${num(w)} + ${u}$ lies between two bf16 numbers $${gap}$ apart, much closer to $${num(w)}$.`,
            `So it rounds to $${num(w)}$: the update is lost, and so is every later update this small.`,
            'Keeping a 32-bit master copy of the weights, with about seven significant digits, lets the small updates add up.',
          ],
        };
      }
      const g = pick(rng, ['10^{-8}', '3 \\times 10^{-9}', '2 \\times 10^{-8}', '5 \\times 10^{-10}', '10^{-9}']);
      const options = ['bf16 keeps fp32\'s 8 exponent bits, so tiny gradients stay above 0', 'bf16 has more mantissa bits than fp16, so it is more precise', 'bf16 stores 4 bytes per number, the same as fp32 does', 'bf16 rounds tiny numbers up to its smallest value, not to 0'];
      return {
        prompt: `Many gradients in a model are around $${g}$. Training in fp16 needs loss scaling to keep them; training in bf16 usually does not. Why?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [null, 'It is the other way around: bf16 has 7 mantissa bits and fp16 has 10. bf16 is less precise, but reaches as far as fp32.', 'bf16 is a 16-bit format: 2 bytes per number, half of fp32.', 'Below a format\'s range, numbers round to 0, not up. bf16 simply reaches far smaller numbers than fp16.'],
        },
        solution: [
          `fp16's 5 exponent bits stop at about $6 \\times 10^{-8}$, so a gradient of $${g}$ becomes 0 unless the loss is scaled up first.`,
          'bf16 keeps fp32\'s 8 exponent bits, so it reaches down to about $10^{-38}$: the same gradient survives as it is.',
        ],
      };
    },
  },
  {
    id: 'scale',
    make(rng, d) {
      const S = pick(rng, d < 0.4 ? [100, 1000, 10000] : [128, 256, 512, 1024, 2048]);
      const gm = pick(rng, [1, 2, 4, 5]);
      const ge = pick(rng, d < 0.4 ? [-4, -5] : [-4, -5, -6]);
      const g = clean(gm * 10 ** ge);
      const scaled = clean(S * g);
      const back = d >= 0.5 && rng.next() < 0.4;
      const St = big(S);
      if (back) {
        return {
          prompt: `Training in fp16, the loss is multiplied by $S = ${St}$ before the gradients are computed. A weight's true gradient is $${num(g)}$. What does it come out as?`,
          answer: { kind: 'number', value: scaled },
          traps: traps(scaled, [
            { value: g, why: `Scaling the loss by $S$ scales every gradient by $S$ too: the gradient comes out ${commas(S)} times larger.` },
            { value: g / S, why: 'That divides by $S$. The loss was multiplied by $S$, so its gradients are multiplied by $S$ as well.' },
          ]),
          solution: [`The gradient of $S$ times the loss is $S$ times its gradient: a constant factor carries through the derivative.`, `$${St} \\times ${num(g)} = ${num(scaled)}$.`],
        };
      }
      return {
        prompt: `Training in fp16, the loss is multiplied by $S = ${St}$ before the gradients are computed. One gradient comes out as $${num(scaled)}$. What gradient goes into the step?`,
        answer: { kind: 'number', value: g },
        traps: traps(g, [
          { value: scaled, why: `That is the scaled gradient, ${commas(S)} times too large. Divide by $S$ before the step.` },
          { value: scaled * S, why: 'That multiplies by $S$ again. The gradient is already $S$ times too large: divide by $S$.' },
        ]),
        solution: [`Scaling the loss by $S$ scales every gradient by $S$, so the computed gradients are ${commas(S)} times too large.`, `Divide, in 32 bits: $${num(scaled)} / ${St} = ${num(g)}$.`],
      };
    },
  },
];
