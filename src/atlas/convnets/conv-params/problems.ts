import type { Generator } from '../../../mastery/domain/types';
import { big, pick, shp, shuffled, traps } from '../../kit';

export const generators: Generator[] = [
  {
    id: 'count',
    make(rng, d) {
      const C = d < 0.35 ? pick(rng, [1, 3]) : d < 0.7 ? pick(rng, [3, 8, 16]) : pick(rng, [16, 32, 64]);
      const F = d < 0.35 ? pick(rng, [1, 3]) : d < 0.7 ? pick(rng, [3, 5]) : pick(rng, [1, 3]);
      const K = d < 0.35 ? pick(rng, [2, 4, 5, 8, 10]) : d < 0.7 ? pick(rng, [4, 8, 10, 16]) : pick(rng, [10, 20, 100]);
      const H = pick(rng, [16, 28, 32, 64, 224]);
      const per = F * F * C + 1;
      const v = K * per;
      return {
        prompt: `A conv layer runs on inputs of shape $${shp([C, H, H])}$, with $\\symK = ${K}$ filters of size $${F} \\times ${F}$. How many parameters does it learn?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: K * F * F * C, why: 'That counts the weights only. Each filter also has one bias: add $\\symK$.' },
          { value: K * (F * F + 1), why: `That makes each filter flat. A filter spans all $${C}$ input channels: $\\symF \\cdot \\symF \\cdot C$ weights.` },
          { value: K * (F * C + 1), why: 'That uses $\\symF$ where the filter has $\\symF \\times \\symF$ positions per channel: square it.' },
          { value: v * H * H, why: 'That counts the weights again at every position. The same filters slide everywhere: the image size does not matter.' },
        ]),
        solution: [
          `One filter has $\\symF \\cdot \\symF \\cdot C = ${F} \\cdot ${F} \\cdot ${C} = ${big(F * F * C)}$ weights, plus 1 bias: $${big(per)}$.`,
          `$\\symK = ${K}$ filters: $${K} \\times ${big(per)} = ${big(v)}$.`,
          `The input's height and width, $${H} \\times ${H}$, do not enter: the filters are shared across every position.`,
        ],
      };
    },
  },
  {
    id: 'vs-fc',
    make(rng, d) {
      const H = d < 0.5 ? pick(rng, [4, 5, 6, 7]) : pick(rng, [5, 6, 7, 8]);
      const K = d < 0.5 ? 1 : pick(rng, [1, 2]);
      const h = H - 2;
      const n = H * H;
      const out = K * h * h;
      const v = out * n + out;
      const conv = K * (9 + 1);
      return {
        prompt: `A conv layer with $\\symK = ${K}$ filter${K > 1 ? 's' : ''} of size $3 \\times 3$ turns a grayscale image of shape $${shp([1, H, H])}$ into an output of shape $${shp([K, h, h])}$. How many parameters would a fully connected layer need to map the same input to the same output?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: out * n, why: 'That counts the weights only. A fully connected layer also has one bias per output.' },
          { value: n * n + n, why: `That maps to $${n}$ outputs, one per input. The conv layer makes $${out}$, and so must this layer.` },
          { value: out * 9 + out, why: 'That gives each output only a $3 \\times 3$ patch of inputs. Fully connected means every output sees every input.' },
        ]),
        solution: [
          `Fully connected, every one of the $${out}$ outputs has its own weight for each of the $${n}$ inputs: $${out} \\times ${n} = ${big(out * n)}$ weights.`,
          `Plus one bias per output: $${big(out * n)} + ${out} = ${big(v)}$.`,
          `The conv layer needs only $${conv}$: each output sees a small patch, and every position shares the same ${K > 1 ? 'filters' : 'filter'}.`,
        ],
      };
    },
  },
  {
    id: 'change',
    make(rng) {
      const C = pick(rng, [3, 16, 32, 64]);
      const K = pick(rng, [16, 32, 64]);
      const H = pick(rng, [32, 64, 128]);
      const per = 9 * C + 1;
      const n = K * per;
      const kind = pick(rng, ['image', 'data', 'filters', 'channels', 'size'] as const);
      const cases = {
        image: { change: `it runs on $${2 * H} \\times ${2 * H}$ images instead`, correct: 0 },
        data: { change: 'it trains on twice as many images', correct: 0 },
        filters: { change: `it gets twice as many filters, $\\symK = ${2 * K}$`, correct: 2 },
        channels: { change: `its input has twice as many channels, $${2 * C}$`, correct: 1 },
        size: { change: 'its filters grow from $3 \\times 3$ to $6 \\times 6$', correct: 3 },
      };
      const k = cases[kind];
      const opts = ['It stays the same', 'It roughly doubles, but not exactly', 'It exactly doubles', 'It roughly quadruples'];
      const why: Record<typeof kind, (string | null)[]> = {
        image: [null, 'The filters do not grow with the image: the same weights slide over more positions.', 'Doubling the side does not double the weights: the filters are the same size on any image.', 'Four times the pixels means four times the positions, not four times the weights: every position shares the same filters.'],
        data: [null, 'More images change the values the filters learn, not how many there are.', 'Training images are not parameters: the filters keep their shape whatever the data.', 'More images change the values the filters learn, not how many there are.'],
        filters: ['Each new filter brings its own weights and bias.', 'Weights and biases are both per filter, so doubling $\\symK$ doubles the count exactly.', null, 'Only the number of filters doubles; each filter keeps its size.'],
        channels: ['Each filter spans every input channel, so deeper input means deeper filters.', null, 'The weights double, but the biases do not: one per filter whatever the depth. So it is a little under double.', 'Only the depth of each filter doubles: twice the weights, not four times.'],
        size: ['Bigger filters have more weights in every channel.', 'The side doubles, so the area $\\symF^2$ quadruples: $36$ weights per channel instead of $9$.', 'The side doubles, so the area $\\symF^2$ quadruples: $36$ weights per channel instead of $9$.', null],
      };
      const after = kind === 'filters' ? 2 * K * per : kind === 'channels' ? K * (18 * C + 1) : kind === 'size' ? K * (36 * C + 1) : n;
      return {
        prompt: `A conv layer has $\\symK = ${K}$ filters of size $3 \\times 3$ over $${C}$ input channels, on $${H} \\times ${H}$ images. What happens to its number of parameters if ${k.change}?`,
        answer: shuffled(rng, opts.map((text, i) => ({ text, why: i === k.correct ? null : why[kind][i]! }))),
        solution: [
          'The count is $\\symK(\\symF \\cdot \\symF \\cdot C + 1)$: filters, filter size and input depth. The image size and the amount of data do not appear.',
          after === n ? `So it stays $${big(n)}$: the same filters slide over every position.` : `Now it is $${big(after)}$, against $${big(n)}$ before.`,
        ],
      };
    },
  },
];
