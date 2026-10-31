import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, mat, num, pick, shp, shuffled, traps, vtraps } from '../../kit';

type Op = 'max' | 'average';

/** An n x n channel of whole numbers, never with a tie for a window's max. */
function channel(rng: Rng, n: number, lo: number, hi: number): number[][] {
  for (;;) {
    const x = Array.from({ length: n }, () => ints(rng, n, lo, hi));
    let ok = true;
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) {
      const w = win(x, i / 2, j / 2);
      if (w.filter((v) => v === Math.max(...w)).length > 1) ok = false;
    }
    if (ok) return x;
  }
}

/** The four values of output (i, j)'s 2 x 2 window, stride 2. */
const win = (x: number[][], i: number, j: number): number[] => [x[2 * i]![2 * j]!, x[2 * i]![2 * j + 1]!, x[2 * i + 1]![2 * j]!, x[2 * i + 1]![2 * j + 1]!];
const pool = (w: number[], op: Op) => (op === 'max' ? Math.max(...w) : w.reduce((a, b) => a + b, 0) / 4);
const other = (op: Op): Op => (op === 'max' ? 'average' : 'max');

export const generators: Generator[] = [
  {
    id: 'pool-vec',
    make(rng, d) {
      const op: Op = d < 0.35 ? 'max' : pick(rng, ['max', 'average'] as const);
      const x = channel(rng, 4, d < 0.35 ? 0 : -4, 9);
      const ws = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([i, j]) => win(x, i!, j!));
      const v = ws.map((w) => pool(w, op));
      return {
        prompt: `What does $2 \\times 2$ ${op} pooling with stride 2 output for this $4 \\times 4$ channel, read row by row?${op === 'average' ? ' Round to two decimals.' : ''}\n\n$$${mat(x)}$$`,
        answer: { kind: 'vector', value: v, places: op === 'average' ? 2 : undefined },
        traps: vtraps(v, [
          { value: ws.map((w) => pool(w, other(op))), why: `That is ${other(op)} pooling. This asks for the ${op} of each window.` },
          { value: [v[0]!, v[2]!, v[1]!, v[3]!], why: 'Right values, read column by column. Read the output row by row: top left, top right, then the bottom row.' },
          ...(op === 'average' ? [{ value: ws.map((w) => w.reduce((a, b) => a + b, 0)), why: 'Those are the window sums. Average pooling divides each by 4.' }] : []),
        ]),
        solution: [
          `The windows are the four $2 \\times 2$ corners: ${ws.map((w) => `$[${w.join(', ')}]$`).join(', ')}.`,
          op === 'max' ? `Take the largest of each: $${v.join(', ')}$.` : `Average each: ${ws.map((w, k) => `$${w.reduce((a, b) => a + b, 0)} / 4 = ${num(v[k]!)}$`).join(', ')}.`,
          `So the output is $\\begin{bmatrix} ${num(v[0]!)} & ${num(v[1]!)} \\\\ ${num(v[2]!)} & ${num(v[3]!)} \\end{bmatrix}$.`,
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const n = d < 0.5 ? 4 : 6;
      const op: Op = d < 0.3 ? 'max' : pick(rng, ['max', 'average'] as const);
      const x = channel(rng, n, d < 0.3 ? 0 : -3, 9);
      const m = n / 2;
      let i = rng.int(m);
      let j = rng.int(m);
      if (n === 6 && i + j === 0) [i, j] = [int(rng, 1, 2), int(rng, 0, 2)];
      const w = win(x, i, j);
      const v = pool(w, op);
      const shifted = [x[i]![j]!, x[i]![j + 1]!, x[i + 1]![j]!, x[i + 1]![j + 1]!];
      return {
        prompt: `This $${n} \\times ${n}$ channel goes through $2 \\times 2$ ${op} pooling with stride 2. What is the output in row ${i}, column ${j}, counting from 0?${op === 'average' ? ' Round to two decimals.' : ''}\n\n$$${mat(x)}$$`,
        answer: { kind: 'number', value: v, places: op === 'average' ? 2 : undefined },
        traps: traps(v, [
          { value: pool(shifted, op), why: `That window starts at row ${i}, column ${j}. With stride 2, output row ${i} covers input rows ${2 * i} and ${2 * i + 1}.` },
          ...(i !== j ? [{ value: pool(win(x, j, i), op), why: `That is row ${j}, column ${i}: rows and columns swapped.` }] : []),
          { value: pool(w, other(op)), why: `That is the ${other(op)} of the window. This asks for ${op} pooling.` },
        ]),
        solution: [
          `Output row ${i}, column ${j} covers input rows ${2 * i} to ${2 * i + 1} and columns ${2 * j} to ${2 * j + 1}: $[${w.join(', ')}]$.`,
          op === 'max' ? `The largest is $${v}$.` : `The average is $${w.reduce((a, b) => a + b, 0)} / 4 = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const C = pick(rng, [16, 32, 64, 96, 128]);
      const overlap = d >= 0.6 && rng.int(2) === 0;
      const H = overlap ? pick(rng, [13, 27, 55]) : pick(rng, [8, 14, 28, 32, 56, 64, 112]);
      const [F, S] = overlap ? [3, 2] : [2, 2];
      const h = (H - F) / S + 1;
      if (rng.int(3) === 0) {
        return {
          prompt: `A $${F} \\times ${F}$ max pooling layer with stride ${S} runs on inputs of shape $${shp([C, H, H])}$. How many parameters does it learn?`,
          answer: { kind: 'number', value: 0 },
          traps: traps(0, [
            { value: F * F, why: 'Pooling has no window weights: it takes the max of what is there.' },
            { value: C, why: 'There is nothing per channel to learn either: the same fixed max runs on every channel.' },
            { value: F * F * C, why: 'That counts a weight per window cell per channel. Pooling has none: it is a fixed operation.' },
          ]),
          solution: [
            'Max pooling takes the largest value in each window. That rule is fixed; there is nothing to learn.',
            'So it has $0$ parameters, whatever the input shape.',
          ],
        };
      }
      const v = [C, h, h];
      return {
        prompt: `An input of shape $${shp([C, H, H])}$ goes through $${F} \\times ${F}$ max pooling with stride ${S}. What is the output's shape?`,
        answer: { kind: 'shape', value: v },
        traps: vtraps(v, [
          { value: [C / 2, h, h], why: 'Pooling works on each channel separately: the number of channels stays the same.' },
          { value: [C, H, H], why: `That keeps the size. With stride ${S} the windows jump ${S} pixels, so the output shrinks.` },
          { value: [C, H - F + 1, H - F + 1], why: `That is stride 1. With stride ${S}, divide by ${S}: $(${H} - ${F}) / ${S} + 1$.` },
          { value: [h, h, C], why: 'Right numbers, channels last. Keep it channels first.' },
        ]),
        solution: [
          'Pooling runs on each channel on its own, so the depth stays $' + C + '$.',
          `Height and width: $(${H} - ${F}) / ${S} + 1 = ${h}$.`,
          `So the output is $${shp(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'keeps',
    make(rng) {
      const H = pick(rng, [8, 16, 28, 32, 56]);
      if (rng.int(2) === 0) {
        return {
          prompt: `A filter's $${H} \\times ${H}$ output map goes through $2 \\times 2$ max pooling with stride 2. What does each output value keep from its window?`,
          answer: shuffled(rng, [
            { text: 'How well the filter matched, but not where in the window', why: null },
            { text: 'The average response over the window, every value counted equally', why: 'That is average pooling. Max pooling keeps only the largest value.' },
            { text: 'The strongest response and its exact position in the window', why: 'The position within the window is thrown away: move the peak inside its window and the output is the same.' },
            { text: 'Every response above a threshold the layer learns in training', why: 'Pooling learns nothing. It has no parameters: it takes the largest value, full stop.' },
          ]),
          solution: [
            'Each output is the largest of four values: the best match of that filter in the window.',
            'Which of the four it came from is lost, so small shifts inside a window do not change the output.',
          ],
        };
      }
      const peak = pick(rng, [5, 6, 7, 8, 9]);
      return {
        prompt: `$2 \\times 2$ max pooling with stride 2 runs over a filter's $${H} \\times ${H}$ output map. In one of its windows the largest value is $${peak}$. The $${peak}$ moves one pixel, staying inside the same window, and nothing larger comes in. What happens to that window's output?`,
        answer: shuffled(rng, [
          { text: `It stays $${peak}$, the same as before the move`, why: null },
          { text: 'It moves one pixel in the output too', why: 'The output has one value per window, not per pixel: a shift inside the window does not move it.' },
          { text: 'It changes, because the window\'s average changes', why: 'Max pooling ignores the average: only the largest value counts, and it is still there.' },
          { text: 'It depends on the learned pooling weights', why: 'Pooling has no weights to learn: it is a fixed max.' },
        ]),
        solution: [
          `The window still holds the $${peak}$, and nothing in it is larger, so its max is still $${peak}$.`,
          'Max pooling keeps how strong the best match was, not where inside the window it was, so small shifts of the input matter less.',
        ],
      };
    },
  },
];
