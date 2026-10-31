import type { Generator } from '../../../mastery/domain/types';
import { big, pick, shp, traps, vtraps } from '../../kit';

const conv = (K: number, F: number, P: number) => `a $${F} \\times ${F}$ conv with $${K}$ filters${P ? ` and padding ${P}` : ', no padding'}`;
const POOL = 'a $2 \\times 2$ max pool with stride 2';

export const generators: Generator[] = [
  {
    id: 'stage-shape',
    make(rng, d) {
      const C = pick(rng, [1, 3]);
      const K = pick(rng, [6, 8, 16, 32]);
      if (d >= 0.7) {
        const H = pick(rng, [16, 32, 64]);
        const K2 = pick(rng, [32, 64, 128].filter((k) => k !== K));
        const v = [K2, H / 4, H / 4];
        return {
          prompt: `An input of shape $${shp([C, H, H])}$ goes through two stages, each a conv layer, a ReLU and ${POOL}. The first conv has $${K}$ filters, the second $${K2}$; both are $3 \\times 3$ with padding 1. What shape comes out?`,
          answer: { kind: 'shape', value: v },
          traps: vtraps(v, [
            { value: [K2, H / 2, H / 2], why: 'That pools only once. Each stage ends in a pool, and each pool halves the height and width.' },
            { value: [K, H / 4, H / 4], why: `That keeps the first conv's channels. The second conv has $${K2}$ filters, so $${K2}$ channels come out.` },
            { value: [K2, H, H], why: 'That forgets the pools. Padding 1 keeps the size through each conv, but each pool halves it.' },
          ]),
          solution: [
            `Stage 1: the conv keeps $${H} \\times ${H}$ (padding 1) and makes $${K}$ channels; the pool halves it: $${shp([K, H / 2, H / 2])}$.`,
            `Stage 2: $${K2}$ channels, and the pool halves again: $${shp(v)}$.`,
          ],
        };
      }
      const valid = d >= 0.35;
      const F = valid ? pick(rng, [3, 5]) : 3;
      const P = valid ? 0 : 1;
      const H = valid ? (F === 5 ? pick(rng, [28, 32]) : pick(rng, [10, 18, 30])) : pick(rng, [8, 16, 28, 32]);
      const h = H - F + 2 * P + 1;
      const v = [K, h / 2, h / 2];
      return {
        prompt: `An input of shape $${shp([C, H, H])}$ goes through ${conv(K, F, P)}, then a ReLU, then ${POOL}. What shape comes out?`,
        answer: { kind: 'shape', value: v },
        traps: vtraps(v, [
          { value: [K, h, h], why: 'That stops before the pool. The $2 \\times 2$ pool with stride 2 halves the height and width.' },
          { value: [C, h / 2, h / 2], why: `That keeps the input's channels. The conv's $${K}$ filters make $${K}$ channels.` },
          ...(P === 0 ? [{ value: [K, H / 2, H / 2], why: `That forgets that the conv shrinks the input: with no padding, $${H} - ${F} + 1 = ${h}$.` }] : []),
          { value: [h / 2, h / 2, K], why: 'Right numbers, channels last. Write it channels first.' },
        ]),
        solution: [
          `Conv: $${K}$ channels, and $${H} - ${F} + ${2 * P} + 1 = ${h}$ across: $${shp([K, h, h])}$.`,
          'ReLU works entry by entry: the shape stays.',
          `Pool: half the height and width: $${shp(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'flatten',
    make(rng, d) {
      if (d < 0.4) {
        const K = pick(rng, [8, 16, 32, 64]);
        const h = pick(rng, [2, 4, 5, 7, 8]);
        const v = K * h * h;
        return {
          prompt: `The last pooling layer of a ConvNet outputs $${shp([K, h, h])}$ per example, and \`nn.Flatten()\` follows. How long is the flattened vector?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: h * h, why: `That is one channel. Flatten keeps all $${K}$ of them, end to end.` },
            { value: K * h, why: 'That multiplies only one side. Each channel is a full grid: height times width.' },
            { value: K + 2 * h, why: 'That adds the dimensions. Flattening lays out every entry, so multiply them.' },
          ]),
          solution: [`Flatten lays every entry out in one row: $${K} \\times ${h} \\times ${h} = ${big(v)}$.`],
        };
      }
      const C = pick(rng, [1, 3]);
      const H = pick(rng, [16, 32, 64]);
      const K1 = pick(rng, [8, 16, 32]);
      const K2 = pick(rng, [16, 32, 64].filter((k) => k !== K1));
      const h = H / 4;
      const v = K2 * h * h;
      return {
        prompt: `Images of shape $${shp([C, H, H])}$ go through ${conv(K1, 3, 1)}, a ReLU, ${POOL}, then ${conv(K2, 3, 1)}, a ReLU and ${POOL} again, then \`nn.Flatten()\`. How long is the flattened vector?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: K2 * (H / 2) * (H / 2), why: 'That counts one pool. There are two, and each halves the height and the width.' },
          { value: K1 * h * h, why: `That uses the first conv's channels. The second conv makes $${K2}$.` },
          { value: h * h, why: `That is one channel. Flatten keeps all $${K2}$.` },
          { value: K2 * H * H, why: 'That forgets the pools: padding 1 keeps the size through each conv, but each pool halves it.' },
        ]),
        solution: [
          `Stage 1: $${shp([K1, H / 2, H / 2])}$. Stage 2: $${shp([K2, h, h])}$.`,
          `Flatten: $${K2} \\times ${h} \\times ${h} = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'total',
    make(rng, d) {
      const C = d < 0.5 ? 1 : pick(rng, [1, 3]);
      const H = pick(rng, [4, 6, 8]);
      const K = pick(rng, [2, 3, 4]);
      const N = d < 0.5 ? pick(rng, [2, 3, 5]) : pick(rng, [5, 10]);
      const convP = K * (9 * C + 1);
      const flat = K * (H / 2) * (H / 2);
      const fcP = flat * N + N;
      const v = convP + fcP;
      return {
        prompt: `A tiny ConvNet takes $${shp([C, H, H])}$ images: a $3 \\times 3$ conv with $${K}$ filters and padding 1, a ReLU, ${POOL}, a flatten, and a fully connected layer to $${N}$ class scores. How many parameters does it learn in all?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: K * 9 * C + flat * N, why: 'That leaves out the biases: one per filter, and one per class score.' },
          { value: convP + K * H * H * N + N, why: `That flattens before the pool. The pool halves both sides, so the linear layer sees $${K} \\times ${H / 2} \\times ${H / 2} = ${flat}$ inputs.` },
          { value: fcP, why: 'That is only the fully connected layer. The conv layer\'s filters count too.' },
          { value: convP, why: 'That is only the conv layer. The fully connected layer has weights too, usually most of them.' },
        ]),
        solution: [
          `One filter: $3 \\cdot 3 \\cdot ${C} = ${9 * C}$ weights, plus 1 bias: $${9 * C + 1}$.`,
          `Conv: $${K} \\times ${9 * C + 1} = ${convP}$. ReLU and pooling learn nothing.`,
          `Padding 1 keeps $${H} \\times ${H}$; the pool halves it: $${shp([K, H / 2, H / 2])}$.`,
          `Flatten: $${K} \\times ${H / 2} \\times ${H / 2} = ${flat}$ inputs.`,
          `Fully connected: $${flat} \\times ${N}$ weights plus $${N}$ biases: $${big(flat * N)} + ${N} = ${big(fcP)}$.`,
          `Total: $${convP} + ${big(fcP)} = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'order',
    make(rng, d) {
      const C = pick(rng, [1, 3]);
      const H = pick(rng, [28, 32, 64]);
      const K1 = pick(rng, [8, 16, 32]);
      const N = pick(rng, [2, 10, 100]);
      if (d < 0.5) {
        const flat = K1 * (H / 2) * (H / 2);
        return {
          prompt: `Put the layers of this classifier in order, from $${shp([C, H, H])}$ images to $${N}$ class scores.`,
          answer: {
            kind: 'order',
            items: [
              `$3 \\times 3$ conv, $${K1}$ filters, padding 1: $${shp([K1, H, H])}$`,
              `ReLU: $${shp([K1, H, H])}$`,
              `$2 \\times 2$ max pool: $${shp([K1, H / 2, H / 2])}$`,
              `Flatten: $${big(flat)}$`,
              `Fully connected: $${N}$ scores`,
            ],
          },
          solution: [
            'A conv layer comes first and makes the channels; the ReLU follows it, entry by entry, so the shape stays.',
            'The pool then halves the height and width.',
            `Flatten turns $${shp([K1, H / 2, H / 2])}$ into one vector of $${big(flat)}$, which the fully connected layer maps to $${N}$ scores.`,
          ],
        };
      }
      const K2 = 2 * K1;
      const flat = K2 * (H / 4) * (H / 4);
      return {
        prompt: `Put the layers of this classifier in order, from $${shp([C, H, H])}$ images to $${N}$ class scores.`,
        answer: {
          kind: 'order',
          items: [
            `$3 \\times 3$ conv, $${K1}$ filters: $${shp([K1, H, H])}$`,
            `ReLU: $${shp([K1, H, H])}$`,
            `Max pool: $${shp([K1, H / 2, H / 2])}$`,
            `$3 \\times 3$ conv, $${K2}$ filters: $${shp([K2, H / 2, H / 2])}$`,
            `ReLU: $${shp([K2, H / 2, H / 2])}$`,
            `Max pool: $${shp([K2, H / 4, H / 4])}$`,
            `Flatten, then fully connected: $${N}$ scores`,
          ],
        },
        solution: [
          'Each stage is conv, then ReLU, then pool: the conv sets the channels, the ReLU keeps the shape, the pool halves the size.',
          `The second stage starts from $${shp([K1, H / 2, H / 2])}$ and doubles the channels to $${K2}$ while pooling down to $${H / 4} \\times ${H / 4}$.`,
          `Flatten gives $${K2} \\times ${H / 4} \\times ${H / 4} = ${big(flat)}$ numbers for the fully connected layer.`,
        ],
      };
    },
  },
];
