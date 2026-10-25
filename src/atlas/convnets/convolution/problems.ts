import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, vec } from '../../kit';
import { atraps, dot, mat, prods, shuffled, terms, traps } from '../kit';

const conv1d = (x: number[], w: number[]): number[] => Array.from({ length: x.length - w.length + 1 }, (_, i) => dot(x.slice(i, i + w.length), w));
const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** `-2a + 0b + 2c` in TeX. */
const lin = (cs: number[], vs: string[]) => cs.map((c, i) => `${i === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '}${Math.abs(c) === 1 ? '' : Math.abs(c)}${vs[i]}`).join('');

/** A 1-D input and filter, harder with difficulty. */
function setup1d(rng: Rng, d: number, n0: number): { x: number[]; w: number[] } {
  if (d < 0.35) return { x: ints(rng, n0, 0, 4), w: ints(rng, 3, -1, 2) };
  if (d < 0.7) return { x: ints(rng, n0 + 1, -3, 4), w: ints(rng, 3, -2, 2) };
  return { x: ints(rng, n0 + 2, -3, 5), w: Array.from({ length: 3 }, () => pick(rng, [-1, -0.5, 0.5, 1, 2])) };
}

/** A 3 x 3 filter with three to five nonzero weights, so it can be done in the head. */
function filter3(rng: Rng, d: number): number[][] {
  const vals = d < 0.35 ? [-1, 0, 0, 1] : [-1, 0, 1, 2];
  for (;;) {
    const w = [0, 1, 2].map(() => [0, 1, 2].map(() => pick(rng, vals)));
    const nz = w.flat().filter((v) => v !== 0).length;
    if (nz >= 3 && nz <= 5) return w;
  }
}

/** Sum of products of a 3 x 3 patch of `x` at (i, j) with `w`. */
const at2d = (x: number[][], w: number[][], i: number, j: number): number => {
  let t = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) t += x[i + a]![j + b]! * w[a]![b]!;
  return t;
};
const patch = (x: number[][], i: number, j: number): number[][] => [0, 1, 2].map((a) => x[i + a]!.slice(j, j + 3));

export const generators: Generator[] = [
  {
    id: 'one-1d',
    make(rng, d) {
      const { x, w } = setup1d(rng, d, 5);
      const out = conv1d(x, w);
      const i = rng.int(out.length);
      const win = x.slice(i, i + 3);
      const v = out[i]!;
      return {
        prompt: `The filter $\\symw = ${vec(w)}$ slides along $\\symx = ${vec(x)}$ one step at a time, staying inside the input, and takes a dot product at each position. What is output entry ${i}, counting from 0?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(i > 0 ? [{ value: out[i - 1]!, why: `That is output ${i - 1}. Counting from 0, output ${i} is the window that starts at $\\symx_{${i}}$.` }] : []),
          { value: sumOf(win), why: 'That adds up the window without weighing it. Multiply each entry by the filter weight on top of it first.' },
          { value: dot(win, [...w].reverse()), why: 'That flips the filter. A convolution layer slides the filter as it is: its first weight sits on the first entry of the window.' },
        ]),
        solution: [
          `Output ${i} covers $\\symx_{${i}}$ to $\\symx_{${i + 2}}$: the window $${vec(win)}$.`,
          `Multiply it by the filter entry by entry and add: $${prods(w, win)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'one-2d',
    make(rng, d) {
      const w = filter3(rng, d);
      if (d < 0.5) {
        const p = [0, 1, 2].map(() => ints(rng, 3, d < 0.25 ? 0 : -2, 4));
        const v = at2d(p, w, 0, 0);
        const nz = w.flat().map((wv, k) => [wv, p.flat()[k]!] as const).filter(([wv]) => wv !== 0);
        return {
          prompt: `A $3 \\times 3$ filter $\\symw$ sits on a $3 \\times 3$ patch of an image. What number does it output there?\n\n$$\\text{patch} = ${mat(p)}, \\qquad \\symw = ${mat(w)}$$`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: sumOf(p.flat()), why: 'That adds up the patch without the filter. Multiply each pixel by the weight on top of it first.' },
            { value: sumOf(p.flat().filter((_, k) => w.flat()[k] !== 0)), why: 'That adds the pixels under the nonzero weights but ignores their signs and sizes. Multiply each by its weight.' },
          ]),
          solution: [
            'The output is the sum of the nine products of matching entries.',
            `Zero weights contribute nothing, so keep the rest: $${nz.map(([a, b]) => `${a < 0 ? `(${a})` : a} \\cdot ${b < 0 ? `(${b})` : b}`).join(' + ')}$.`,
            `That is $${terms(nz.map(([a, b]) => a * b))} = ${v}$.`,
          ],
        };
      }
      const x = [0, 1, 2, 3].map(() => ints(rng, 4, d < 0.75 ? 0 : -2, 4));
      const i = rng.int(2);
      const j = rng.int(2);
      const v = at2d(x, w, i, j);
      const pt = patch(x, i, j);
      const nz = w.flat().map((wv, k) => [wv, pt.flat()[k]!] as const).filter(([wv]) => wv !== 0);
      return {
        prompt: `The $3 \\times 3$ filter $\\symw$ slides over the $4 \\times 4$ image $\\symx$ one step at a time, staying inside it, giving a $2 \\times 2$ output. What is the output in row ${i}, column ${j}, counting from 0?\n\n$$\\symx = ${mat(x)}, \\qquad \\symw = ${mat(w)}$$`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(i !== j ? [{ value: at2d(x, w, j, i), why: `That is row ${j}, column ${i}: rows and columns swapped. Row ${i} means the window starts ${i} row${i === 1 ? '' : 's'} down.` }] : []),
          ...(i + j > 0 ? [{ value: at2d(x, w, 0, 0), why: 'That is the top-left output, row 0, column 0. Move the window to the position asked for first.' }] : []),
          { value: sumOf(pt.flat()), why: 'That adds up the patch without the filter. Multiply each pixel by the weight on top of it first.' },
        ]),
        solution: [
          `Row ${i}, column ${j} is the patch starting ${i} down and ${j} across: rows ${i} to ${i + 2}, columns ${j} to ${j + 2}, $${mat(pt)}$.`,
          `Multiply by the matching weights and keep the nonzero ones: $${nz.map(([a, b]) => `${a < 0 ? `(${a})` : a} \\cdot ${b < 0 ? `(${b})` : b}`).join(' + ')}$.`,
          `That is $${terms(nz.map(([a, b]) => a * b))} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'full-1d',
    make(rng, d) {
      const F = d < 0.35 ? 2 : 3;
      const n = d < 0.35 ? 4 : d < 0.7 ? 5 : 6;
      const x = ints(rng, n, d < 0.35 ? 0 : -3, 4);
      const w = ints(rng, F, d < 0.35 ? -1 : -2, 2);
      const out = conv1d(x, w);
      const windows = out.map((_, i) => x.slice(i, i + F));
      return {
        prompt: `Slide the filter $\\symw = ${vec(w)}$ along $\\symx = ${vec(x)}$ one step at a time, staying inside the input, and take the dot product at each position. What is the whole output, in order?`,
        answer: { kind: 'vector', value: out },
        traps: atraps(out, [
          { value: conv1d(x, [...w].reverse()), why: 'That flips the filter. A convolution layer slides it as it is: its first weight sits on the first entry of each window.' },
          { value: windows.map(sumOf), why: 'Those are the window sums, unweighted. Multiply each entry by the filter weight on top of it before adding.' },
          { value: out.slice(0, -1), why: `That stops one window early. The last window ends on the last entry, $\\symx_{${n - 1}}$, so there are ${out.length} outputs.` },
        ]),
        solution: [
          `A filter of ${F} weights fits ${out.length} times on ${n} entries: windows start at $\\symx_{0}$ to $\\symx_{${out.length - 1}}$.`,
          ...windows.map((win, i) => `Output ${i}: $${prods(w, win)} = ${num(out[i]!)}$.`),
          `So the output is $${vec(out)}$.`,
        ],
      };
    },
  },
  {
    id: 'detects',
    make(rng) {
      const k = pick(rng, [1, 2, 3]);
      const kind = pick(rng, ['rise', 'fall', 'sum'] as const);
      const vertical = rng.int(2) === 1;
      const w = kind === 'rise' ? [-k, 0, k] : kind === 'fall' ? [k, 0, -k] : [k, k, k];
      const dir = vertical ? 'from top to bottom' : 'from left to right';
      const along = vertical ? 'down a column of pixel brightnesses' : 'along a row of pixel brightnesses, left to right';
      const cancel = `On an even patch the $${-k}$ and $${k}$ cancel, so brightness on its own gives 0: only a change counts.`;
      const why = {
        rise: kind === 'rise' ? null : kind === 'fall' ? `The positive weight sits first, so the output is the first pixel minus the last: largest where the brightness falls, not rises.` : 'With no negative weight the filter cannot tell a rise from a fall: it adds the window up.',
        fall: kind === 'fall' ? null : kind === 'rise' ? 'The positive weight sits last, so the output is the last pixel minus the first: largest where the brightness rises, not falls.' : 'With no negative weight the filter cannot tell a rise from a fall: it adds the window up.',
        high: kind === 'sum' ? null : cancel,
        flat: kind === 'sum' ? 'An even patch scores high only if it is bright: the output is the window\'s total brightness, so the brightest windows win.' : `Where the brightness stays the same the $${-k}$ and $${k}$ cancel: the output there is 0, not large.`,
      };
      const kx = k === 1 ? '' : String(k);
      const lead = kind === 'sum' ? `That is $${kx}(a + b + c)$: it adds up the window.` : kind === 'rise' ? `That is $${kx}(c - a)$: the last pixel minus the first.` : `That is $${kx}(a - c)$: the first pixel minus the last.`;
      return {
        prompt: `The filter $\\symw = ${vec(w)}$ slides ${along}. Where is its output largest?`,
        answer: shuffled(rng, [
          { text: `Where the brightness rises ${dir}`, why: why.rise },
          { text: `Where the brightness falls ${dir}`, why: why.fall },
          { text: 'Where the pixels are brightest', why: why.high },
          { text: 'Where the brightness stays the same', why: why.flat },
        ]),
        solution: [
          `On a window $[a, b, c]$, with $a$ first and $c$ last ${dir}, the output is $${lin(w, ['a', 'b', 'c'])}$.`,
          lead,
          kind === 'sum' ? 'So it is largest over the brightest windows: a blur, not an edge detector.' : `So it is largest where the brightness ${kind === 'rise' ? 'rises' : 'falls'} ${dir}: an edge detector. A filter responds most where the input looks like it.`,
        ],
      };
    },
  },
];
