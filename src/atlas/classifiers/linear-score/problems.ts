import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, vec } from '../../kit';
import { argmaxOf, dot, mat, prods, terms } from '../kit';

/** Entry range by difficulty: whole numbers from 0 at first, then negatives. */
const range = (d: number): [number, number] => (d < 0.35 ? [0, 3] : d < 0.7 ? [-2, 3] : [-3, 4]);

function weights(rng: Rng, rows: number, cols: number, lo: number, hi: number): number[][] {
  return Array.from({ length: rows }, () => ints(rng, cols, lo, hi));
}

const score = (W: number[][], x: number[], b: number[]) => W.map((r, k) => dot(r, x) + b[k]!);

/** One worked line per class: its row dotted with x, plus its bias. */
const classStep = (W: number[][], x: number[], b: number[], k: number) =>
  `Class ${k}: $\\symw_{${k}} \\cdot \\symx + \\symb_{${k}} = ${terms([prods(W[k]!, x), b[k]!])} = ${dot(W[k]!, x) + b[k]!}$.`;

const TRIOS = [
  ['cat', 'dog', 'ship'],
  ['plane', 'car', 'bird'],
  ['frog', 'horse', 'truck'],
  ['deer', 'cat', 'ship'],
];

export const generators: Generator[] = [
  {
    id: 'scores',
    make(rng, d) {
      // 2 by 2 first, then one side of 3, and 3 by 3 only for the fluent.
      const [C, D] = d < 0.35 ? [2, 2] : d < 0.85 ? pick(rng, [[2, 2], [2, 3], [3, 2]]) : pick(rng, [[2, 3], [3, 2], [3, 3]]);
      const [lo, hi] = range(d);
      const W = weights(rng, C, D, lo, hi);
      const x = ints(rng, D, lo, hi);
      const b = ints(rng, C, Math.min(lo, 0), Math.min(hi, 2));
      const s = score(W, x, b);
      return {
        prompt: `A linear classifier has weights $\\symW = ${mat(W)}$ and biases $\\symb = ${vec(b)}$. For the input $\\symx = ${vec(x)}$, what are the scores $\\syms$?`,
        answer: { kind: 'vector', value: s },
        solution: [
          `$\\syms = \\symW\\symx + \\symb$. $\\symW$ has ${C} rows, one per class, and ${D} columns, one per entry of $\\symx$: class $k$'s score is its row, $\\symw_k$, dotted with $\\symx$, plus its bias $\\symb_k$.`,
          ...W.map((_, k) => classStep(W, x, b, k)),
          `So $\\syms = ${vec(s)}$.`,
        ],
      };
    },
  },
  {
    id: 'one-class',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const [lo, hi] = range(d);
      const W = weights(rng, n, n, lo, hi);
      const x = ints(rng, n, lo, hi);
      const b = ints(rng, n, Math.min(lo, 0), 3);
      const k = rng.int(n);
      const v = dot(W[k]!, x) + b[k]!;
      const col = W.map((r) => r[k]!);
      const traps = [
        { value: dot(W[k]!, x), why: `That is row ${k} dotted with $\\symx$, without the bias. Add $\\symb_{${k}} = ${b[k]}$.` },
        { value: dot(col, x) + b[k]!, why: `That uses column ${k} of $\\symW$. A class's weights are its row: row ${k} lines up with the entries of $\\symx$.` },
      ];
      if (k + 1 < n) traps.push({ value: dot(W[k + 1]!, x) + b[k + 1]!, why: `That is the score of class ${k + 1}, the next row. Classes count from 0, so class ${k} is row ${k}.` });
      return {
        prompt: `$\\symW = ${mat(W)}$, $\\symx = ${vec(x)}$ and $\\symb = ${vec(b)}$. What is the score of class ${k}, counting from 0?`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t, i) => t.value !== v && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          `Class ${k}'s weights are row ${k} of $\\symW$: $\\symw_{${k}} = ${vec(W[k]!)}$.`,
          `Dot it with $\\symx$: $${prods(W[k]!, x)} = ${dot(W[k]!, x)}$.`,
          `Add its bias: $\\syms_{${k}} = ${terms([dot(W[k]!, x), b[k]!])} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'zero-input',
    make(rng, d) {
      const C = d < 0.35 ? 2 : 3;
      const D = int(rng, 2, 3);
      const [lo, hi] = range(d);
      const W = weights(rng, C, D, lo, hi);
      const b = ints(rng, C, -3, 3);
      const zeros = Array.from({ length: D }, () => 0);
      if (rng.int(2) === 0) {
        return {
          prompt: `$\\symW = ${mat(W)}$ and $\\symb = ${vec(b)}$. For the input $\\symx = ${vec(zeros)}$, what are the scores $\\syms$?`,
          answer: { kind: 'vector', value: b },
          solution: [
            `$\\syms = \\symW\\symx + \\symb$, and every product in $\\symW\\symx$ has a factor of 0, so $\\symW\\symx = ${vec(W.map(() => 0))}$.`,
            `What is left is the bias: $\\syms = \\symb = ${vec(b)}$.`,
            'The bias is each class\'s score before any evidence: its built-in lean.',
          ],
        };
      }
      return {
        prompt: `A linear classifier with $\\symW = ${mat(W)}$ gives the scores $\\syms = ${vec(b)}$ for the input $\\symx = ${vec(zeros)}$. What are its biases $\\symb$?`,
        answer: { kind: 'vector', value: b },
        solution: [
          `$\\syms = \\symW\\symx + \\symb$, and with $\\symx$ all zeros, $\\symW\\symx = ${vec(W.map(() => 0))}$ whatever $\\symW$ holds.`,
          `So $\\syms = \\symb$: the biases are $${vec(b)}$.`,
        ],
      };
    },
  },
  {
    id: 'predict',
    make(rng, d) {
      const D = d < 0.5 ? 2 : 3;
      const [lo, hi] = range(Math.max(d, 0.4));
      const names = pick(rng, TRIOS);
      for (let tries = 0; ; tries++) {
        // A case where the biases change the winner, so forgetting them picks a wrong option.
        const fallback = tries >= 500;
        const W = fallback ? [[1, 2], [-1, 3], [2, 1]] : weights(rng, 3, D, lo, hi);
        const x = fallback ? [2, 1] : ints(rng, D, lo, hi);
        const b = fallback ? [1, 0, -2] : ints(rng, 3, -3, 3);
        const wx = W.map((r) => dot(r, x));
        const s = wx.map((v, k) => v + b[k]!);
        const k = argmaxOf(s);
        const m = argmaxOf(wx);
        if (k < 0 || m < 0 || k === m) continue;
        const nb = argmaxOf(b);
        const why = s.map((v, i) => {
          if (i === k) return null;
          const below = `Its score is $\\syms_{${i}} = ${v}$, below class ${k}'s $${s[k]}$.`;
          if (i === m) return `That is the top of $\\symW\\symx = ${vec(wx)}$, before the biases. ${below}`;
          if (i === nb) return `Class ${i} has the largest bias, but the evidence $\\symW\\symx$ outweighs it. ${below}`;
          return below;
        });
        return {
          prompt: `A linear classifier over the classes ${names.map((n, i) => `${i}: ${n}`).join(', ')} has $\\symW = ${mat(W)}$ and $\\symb = ${vec(b)}$. For $\\symx = ${vec(x)}$, which class does it predict?`,
          answer: { kind: 'choice', options: names.map((n, i) => `Class ${i}, ${n}`), correct: k, why },
          solution: [
            `$\\symW\\symx$ dots each row with $\\symx$: $${vec(wx)}$.`,
            `Add the biases: $\\syms = ${vec(wx)} + ${vec(b)} = ${vec(s)}$.`,
            `The largest score is $${s[k]}$, class ${k}: the prediction is ${names[k]}. Without the biases, ${names[m]} would have won.`,
          ],
        };
      }
    },
  },
];
