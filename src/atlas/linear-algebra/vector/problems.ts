import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, scale, vec } from '../../kit';
import { distinct, ORD, par } from '../kit';

/** Entries at difficulty `d`: small whole numbers, then negatives, then halves. */
function entries(rng: Rng, n: number, d: number): number[] {
  if (d < 0.35) return ints(rng, n, 0, 5);
  if (d < 0.8) return ints(rng, n, -5, 6);
  return ints(rng, n, -9, 9).map((v) => v / 2);
}

/** Image sizes [height, width, channels] by difficulty. */
function image(rng: Rng, d: number): [number, number, number] {
  if (d < 0.35) return [int(rng, 2, 4), int(rng, 2, 4), pick(rng, [1, 3])];
  if (d < 0.7) return [pick(rng, [4, 5, 6, 8, 10]), pick(rng, [4, 5, 6, 8, 10]), pick(rng, [1, 3, 3])];
  return pick(rng, [[8, 8, 3], [16, 16, 3], [28, 28, 1], [32, 32, 3], [10, 10, 3], [64, 64, 1], [20, 20, 3]] as [number, number, number][]);
}

export const generators: Generator[] = [
  {
    id: 'add',
    make(rng, d) {
      const n = scale(d, 2, 4);
      const u = entries(rng, n, d);
      const v = entries(rng, n, d);
      const sum = u.map((a, i) => a + v[i]!);
      return {
        prompt: `$u = ${vec(u)}$ and $v = ${vec(v)}$. What is $u + v$?`,
        answer: { kind: 'vector', value: sum },
        solution: [
          `Add matching entries, first with first, second with second: ${u.map((a, i) => `$${num(a)} + ${par(v[i]!)} = ${num(sum[i]!)}$`).join(', ')}.`,
          `So $u + v = ${vec(sum)}$, still ${n} entries long.`,
        ],
      };
    },
  },
  {
    id: 'scale',
    make(rng, d) {
      const n = scale(d, 2, 4);
      const x = d < 0.35 ? ints(rng, n, 0, 5) : ints(rng, n, -5, 5);
      const c = d < 0.35 ? int(rng, 2, 4) : d < 0.8 ? pick(rng, [-1, -2, -3, 2, 3, 5, 10]) : pick(rng, [0.5, -0.5, 1.5, -2, 10, -3]);
      const out = x.map((v) => c * v);
      return {
        prompt: `$\\symx = ${vec(x)}$. What is $${num(c)}\\,\\symx$?`,
        answer: { kind: 'vector', value: out },
        solution: [
          `Multiply every entry by $${num(c)}$: ${x.map((v) => `$${num(c)} \\times ${par(v)} = ${num(c * v)}$`).join(', ')}.`,
          `So $${num(c)}\\,\\symx = ${vec(out)}$, the same length as $\\symx$.`,
        ],
      };
    },
  },
  {
    id: 'entries',
    make(rng, d) {
      const kind = rng.int(3);
      if (kind === 0) {
        const [H, W, C] = image(rng, d);
        const color = C === 3;
        const traps = [{ value: H + W + C, why: 'That adds the sizes. There is one number for every row, column and channel, so multiply them.' }];
        if (color) traps.push({ value: H * W, why: `That counts pixels. Each pixel holds ${C} numbers, so multiply by ${C} as well.` });
        return {
          prompt: color
            ? `A color image is ${H} pixels tall and ${W} wide, and each pixel holds ${C} numbers: red, green and blue. Flattened into one vector, how many entries does it have?`
            : `A grayscale image is ${H} pixels tall and ${W} wide, with one number per pixel. Flattened into one vector, how many entries does it have?`,
          answer: { kind: 'number', value: H * W * C },
          traps: traps.filter((t) => t.value !== H * W * C),
          solution: [
            `The image has $${H} \\times ${W} = ${H * W}$ pixels.`,
            color ? `Each pixel holds ${C} numbers, so the vector has $${H} \\times ${W} \\times ${C} = ${H * W * C}$ entries.` : `Each pixel holds one number, so the vector has ${H * W} entries.`,
          ],
        };
      }
      if (kind === 1) {
        const k = d < 0.5 ? int(rng, 3, 12) : pick(rng, [9, 15, 31, 63, 99, 127, 255, 783, 3071]);
        return {
          prompt: `A vector's entries run from $\\symx[0]$ to $\\symx[${k}]$. How many entries does it have?`,
          answer: { kind: 'number', value: k + 1 },
          traps: [{ value: k, why: `That is the last index. Counting starts at 0, so indices 0 through ${k} name ${k + 1} entries.` }],
          solution: [`The indices are $0, 1, \\ldots, ${k}$: the ${k} numbers from 1 to ${k}, plus 0.`, `So there are $${k} + 1 = ${k + 1}$ entries.`],
        };
      }
      const n = scale(d, 4, 7);
      const x = d < 0.35 ? distinct(rng, n, 0, 9) : distinct(rng, n, -9, 9);
      const i = int(rng, 1, n - 1);
      const traps = [{ value: x[i - 1]!, why: `That is the ${ORD[i - 1]} entry, entry ${i} counting from 1. Indices start at 0, so $\\symx[${i}]$ is the ${ORD[i]}.` }];
      if (i !== x[i] && i !== x[i - 1]) traps.push({ value: i, why: `That is the index itself. $\\symx[${i}]$ is the entry stored at that position.` });
      return {
        prompt: `$\\symx = ${vec(x)}$. What is $\\symx[${i}]$?`,
        answer: { kind: 'number', value: x[i]! },
        traps,
        solution: [
          `Count positions from 0: ${x.slice(0, i + 1).map((v, j) => `$\\symx[${j}] = ${num(v)}$`).join(', ')}.`,
          `So $\\symx[${i}] = ${num(x[i]!)}$, the ${ORD[i]} entry.`,
        ],
      };
    },
  },
  {
    id: 'dimension',
    make(rng) {
      const n = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 64, 100, 784, 3072]);
      const frame = rng.int(3);
      const given = frame === 0 ? `$\\symx$ is a ${n}-dimensional vector` : frame === 1 ? `$\\symx$ is a vector in $\\mathbb{R}^{${n}}$` : `In NumPy, the vector \`x\` has \`x.shape\` equal to \`(${n},)\``;
      return {
        prompt: `${given}. What does the ${n} tell you?`,
        answer: {
          kind: 'choice',
          options: [`It holds ${n} numbers in all`, `Its last entry is $\\symx[${n}]$`, `Its entries add up to ${n}`, `It has ${n} axes, like a ${n}-D grid`],
          correct: 0,
          why: [
            null,
            `Indices start at 0, so the last of ${n} entries is $\\symx[${n - 1}]$; $\\symx[${n}]$ is past the end.`,
            'The dimension counts entries. It says nothing about their values.',
            `A vector has one axis: a single row of numbers. Its dimension counts the entries along that axis, which is why its shape is (${n},).`,
          ],
        },
        solution: [
          `The dimension of a vector is how many numbers it holds: ${n}.`,
          `They are $\\symx[0]$ through $\\symx[${n - 1}]$, all along one axis.`,
        ],
      };
    },
  },
];
