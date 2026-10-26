import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, pick } from '../../kit';
import { atraps, shp, shuffled, traps } from '../kit';

interface Layer {
  C: number;
  H: number;
  W: number;
  K: number;
  F: number;
}

/** An input and a conv layer, harder with difficulty. The filter slides one step at a time and stays inside the input. */
function layer(rng: Rng, d: number): Layer {
  if (d < 0.35) {
    const H = pick(rng, [6, 8, 10, 32]);
    return { C: pick(rng, [1, 3]), H, W: H, K: pick(rng, [4, 6, 8, 16]), F: 3 };
  }
  if (d < 0.7) {
    const H = pick(rng, [16, 28, 32]);
    return { C: pick(rng, [3, 16, 32]), H, W: H, K: pick(rng, [8, 16, 32, 64]), F: pick(rng, [3, 5]) };
  }
  const H = pick(rng, [32, 64]);
  return { C: pick(rng, [3, 32, 64]), H, W: pick(rng, [H, 2 * H]), K: pick(rng, [16, 64, 128]), F: pick(rng, [3, 5, 7]) };
}

const describe = (L: Layer) => `$\\symK = ${L.K}$ filters of size $${L.F} \\times ${L.F}$`;

export const generators: Generator[] = [
  {
    id: 'out-shape',
    make(rng, d) {
      const L = layer(rng, d);
      const h = L.H - L.F + 1;
      const w = L.W - L.F + 1;
      const v = [L.K, h, w];
      return {
        prompt: `An input of shape $${shp([L.C, L.H, L.W])}$ goes through a conv layer with ${describe(L)}. What is the output's shape?`,
        answer: { kind: 'shape', value: v },
        traps: atraps(v, [
          { value: [L.C, h, w], why: 'That keeps the input\'s channels. Each filter makes one output channel, so the output has $\\symK$ channels.' },
          { value: [h, w, L.K], why: 'Right numbers, channels last. Write it channels first, as PyTorch does: channels, height, width.' },
          { value: [L.K, L.H, L.W], why: `That keeps the input's height and width. A $${L.F} \\times ${L.F}$ filter that stays inside fits only $${L.H} - ${L.F} + 1 = ${h}$ places down.` },
          { value: [L.K * L.C, h, w], why: 'That gives every input channel its own map. A filter spans all the channels and adds them into one map.' },
        ]),
        solution: [
          `Each of the $${L.K}$ filters makes one output channel: depth $${L.K}$.`,
          `Down, the filter fits $${L.H} - ${L.F} + 1 = ${h}$ places;${L.W !== L.H ? ` across, $${L.W} - ${L.F} + 1 = ${w}$.` : ' across, the same.'}`,
          `So the output is $${shp(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'depth',
    make(rng, d) {
      const F = pick(rng, [3, 5]);
      if (d < 0.4) {
        const C = pick(rng, [1, 3, 8, 16, 32]);
        const H = pick(rng, [16, 28, 32]);
        const K = pick(rng, [4, 10, 12, 20, 64]);
        return {
          prompt: `A conv layer with $\\symK = ${K}$ filters of size $${F} \\times ${F}$ runs on an input of shape $${shp([C, H, H])}$. How deep is each filter?`,
          answer: { kind: 'number', value: C },
          traps: traps(C, [
            { value: K, why: `That is the number of filters, which sets the output's depth. Each filter spans the input's depth.` },
            { value: F, why: 'That is the filter\'s width. Its depth matches the input\'s channels.' },
            { value: 1, why: 'A filter is not flat: it covers a patch in every input channel at once.' },
          ]),
          solution: [
            'A filter always spans the full depth of its input, so its depth is the input\'s number of channels.',
            `The input has $${C}$ channel${C === 1 ? '' : 's'}: each filter is $${C} \\times ${F} \\times ${F}$, depth first.`,
          ],
        };
      }
      const K1 = pick(rng, [8, 16, 32, 64]);
      const K2 = pick(rng, [16, 32, 64, 128].filter((k) => k !== K1));
      const C = pick(rng, [1, 3]);
      const H = pick(rng, [28, 32, 64]);
      return {
        prompt: `Images of shape $${shp([C, H, H])}$ go through \`conv1\`, with $${K1}$ filters of size $3 \\times 3$, then \`conv2\`, with $${K2}$ filters of size $${F} \\times ${F}$. How deep is each of \`conv2\`'s filters?`,
        answer: { kind: 'number', value: K1 },
        traps: traps(K1, [
          { value: C, why: `That is the image's depth, which sets \`conv1\`'s filters. \`conv2\` sees \`conv1\`'s output, ${K1} channels deep.` },
          { value: K2, why: `That is \`conv2\`'s number of filters: the depth of its output, not of its filters.` },
          { value: F, why: 'That is the filter\'s width. Its depth matches the channels coming in.' },
        ]),
        solution: [
          `\`conv1\` has $${K1}$ filters, so its output has $${K1}$ channels.`,
          `\`conv2\`'s filters span that full depth: each is $${K1} \\times ${F} \\times ${F}$, depth first.`,
        ],
      };
    },
  },
  {
    id: 'weight-shape',
    make(rng, d) {
      const C = d < 0.4 ? pick(rng, [1, 3]) : pick(rng, [3, 16, 32, 64]);
      const K = d < 0.4 ? pick(rng, [4, 6, 8, 10]) : pick(rng, [16, 32, 64, 128].filter((k) => k !== C));
      const F = d < 0.4 ? 3 : pick(rng, [1, 3, 5, 7]);
      const v = [K, C, F, F];
      return {
        prompt: `A layer is built as \`conv = nn.Conv2d(${C}, ${K}, kernel_size=${F})\`. What is \`conv.weight.shape\`?`,
        answer: { kind: 'shape', value: v },
        traps: atraps(v, [
          { value: [C, K, F, F], why: 'In and out are swapped. PyTorch stacks the filters along the first axis: out channels, in channels, height, width.' },
          { value: [K, F, F], why: `That leaves out each filter's depth. Every filter spans all ${C} input channel${C === 1 ? '' : 's'}, so the shape is out channels, in channels, height, width.` },
          { value: [F, F, C, K], why: 'That is the order TensorFlow uses. PyTorch writes out channels, in channels, height, width.' },
        ]),
        solution: [
          `\`nn.Conv2d(${C}, ${K}, kernel_size=${F})\` reads in order: $${C}$ channel${C === 1 ? '' : 's'} in, $${K}$ channels out, filter size $${F}$.`,
          `$${K}$ channels out means $\\symK = ${K}$ filters.`,
          `$${C}$ channel${C === 1 ? '' : 's'} in means each filter is $${C}$ deep: $${C} \\times ${F} \\times ${F}$, depth first.`,
          `PyTorch stacks the $${K}$ filters along the first axis: filters, depth, height, width. That is $${shp(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'channel-is',
    make(rng) {
      const C = pick(rng, [1, 3, 16, 32]);
      const H = pick(rng, [16, 28, 32]);
      const K = pick(rng, [8, 16, 32]);
      const F = pick(rng, [3, 5]);
      const h = H - F + 1;
      const k = int(rng, 1, K - 1);
      return {
        prompt: `A conv layer with $\\symK = ${K}$ filters of size $${F} \\times ${F}$ turns an input of shape $${shp([C, H, H])}$ into \`out\`, of shape $${shp([K, h, h])}$. What is \`out[${k}]\`?`,
        answer: shuffled(rng, [
          { text: `Filter ${k}'s response at every position: a $${h} \\times ${h}$ map`, why: null },
          { text: `Input channel ${k % C}, filtered on its own`, why: `Each filter spans all ${C === 1 ? 'of the input' : `${C} input channels`} at once and adds them up, so an output channel does not belong to any one input channel.` },
          { text: `All ${K} filters' responses at one position`, why: `Those run along the channel axis, \`out[:, i, j]\`: a vector of ${K} numbers, not a channel.` },
          { text: `Filter ${k}'s weights, $${C} \\times ${F} \\times ${F}$ numbers`, why: 'The weights are the filter itself. The output holds what the filter computed: one number per position it visits.' },
        ]),
        solution: [
          `Filter ${k} slides over every position; at each one it combines a $${F} \\times ${F}$ patch from all ${C} channel${C === 1 ? '' : 's'} into one number.`,
          `Those numbers form one $${h} \\times ${h}$ map: output channel ${k}. The ${K} filters make the ${K} channels.`,
        ],
      };
    },
  },
];
