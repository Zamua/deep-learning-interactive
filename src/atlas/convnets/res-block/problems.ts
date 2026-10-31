import type { Generator } from '../../../mastery/domain/types';
import { clean, ints, num, pick, shp, shuffled, vec, vtraps } from '../../kit';
import { outSize } from '../kit';

const relu = (v: number) => Math.max(0, v);

export const generators: Generator[] = [
  {
    id: 'match',
    make(rng, d) {
      const C = pick(rng, [16, 32, 64, 128]);
      const H = pick(rng, [8, 14, 28, 32, 56]);
      const same = d < 0.35 ? rng.int(2) === 0 : rng.int(4) === 0;
      const S = same ? 1 : 2;
      const K = same ? C : 2 * C;
      const raw = outSize(H, 3, S, 1);
      const O = Math.floor(raw);
      const v = [K, O, O];
      const size = same
        ? [`Its height and width: $(${H} - 3 + 2 \\cdot 1) / 1 + 1 = ${O}$, unchanged.`]
        : [`Its height and width: $(${H} - 3 + 2 \\cdot 1) / 2 + 1 = ${num(raw)}$.`, `That is not whole, so it rounds down: $${O}$.`];
      return {
        prompt: `In a residual block, $\\symx$ has shape $${shp([C, H, H])}$. $F$ is a $3 \\times 3$ conv with $${K}$ filters, stride ${S} and padding 1, a ReLU, and a $3 \\times 3$ conv with $${K}$ filters, stride 1 and padding 1. What shape must the shortcut output?`,
        answer: { kind: 'shape', value: v },
        traps: vtraps(v, [
          { value: [C, H, H], why: `That is $\\symx$ as it is. $F$ changes the shape here, so the shortcut needs a $1 \\times 1$ conv with $${K}$ filters and stride ${S} to match.` },
          { value: [K, H, H], why: `That forgets the stride: the first conv has stride ${S}, which shrinks the height and width.` },
          { value: [C, O, O], why: `That keeps $\\symx$'s channels. $F$ ends with $${K}$ filters, so the sum needs $${K}$ channels.` },
          ...(same ? [] : [{ value: [K, O + 1, O + 1], why: `That rounds $${num(raw)}$ up. An output size that is not whole rounds down: $${O}$.` }]),
        ]),
        solution: [
          `$F$'s first conv has $${K}$ filters, so it outputs $${K}$ channels.`,
          ...size,
          `So the first conv gives $${shp(v)}$.`,
          `The second conv has stride 1 and padding 1: $(${O} - 3 + 2 \\cdot 1) / 1 + 1 = ${O}$, so it keeps the size. With $${K}$ filters, $F(\\symx)$ is $${shp(v)}$.`,
          'A sum needs equal shapes, so the shortcut must output that shape too.',
          same
            ? 'Here that is $\\symx$\'s own shape: the identity shortcut works as is.'
            : `$\\symx$ is $${shp([C, H, H])}$, so the shortcut is a $1 \\times 1$ conv with $${K}$ filters and stride 2: $(${H} - 1) / 2 + 1 = ${num(outSize(H, 1, 2, 0))}$, rounded down to $${O}$.`,
        ],
      };
    },
  },
  {
    id: 'forward',
    make(rng, d) {
      const n = d < 0.35 ? 3 : 4;
      const x = ints(rng, n, -2, 4);
      const f = d < 0.35 ? ints(rng, n, -3, 3) : Array.from({ length: n }, () => pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3]));
      const withRelu = d >= 0.7;
      const sum = x.map((v, i) => clean(v + f[i]!));
      if (withRelu && sum.every((v) => v >= 0)) {
        const k = rng.int(n);
        x[k] = -3;
        f[k] = pick(rng, [-1, -0.5, 1, 2]);
        sum[k] = clean(x[k]! + f[k]!);
      }
      const v = withRelu ? sum.map(relu) : sum;
      return {
        prompt: withRelu
          ? `A residual block applies a ReLU after its sum. Its input is $\\symx = ${vec(x)}$, and its layers give $F(\\symx) = ${vec(f)}$. What is its output $y$?`
          : `A residual block's input is $\\symx = ${vec(x)}$, and its layers give $F(\\symx) = ${vec(f)}$. What is its output $y$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: f, why: 'That is $F(\\symx)$ alone: a plain layer. The shortcut adds $\\symx$ back.' },
          { value: x.map((a, i) => clean(a - f[i]!)), why: 'That subtracts $F(\\symx)$. The block adds it: $\\symx + F(\\symx)$.' },
          ...(withRelu ? [{ value: sum, why: 'That is the sum before the ReLU. Set its negative entries to 0.' }] : []),
          ...(withRelu ? [{ value: x.map((a, i) => clean(a + relu(f[i]!))), why: 'That applies the ReLU to $F(\\symx)$ before adding. Here it comes after the sum: $y = \\mathrm{ReLU}(\\symx + F(\\symx))$.' }] : []),
        ]),
        solution: [
          `${withRelu ? 'First the sum, $\\symx + F(\\symx)$,' : '$y = \\symx + F(\\symx)$,'} entry by entry: $${vec(x)} + ${vec(f)} = ${vec(sum)}$.`,
          ...(withRelu ? [`Then the ReLU sets negatives to 0: $${vec(v)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'shortcut',
    make(rng, d) {
      const C = pick(rng, [16, 32, 64, 128]);
      const H = pick(rng, [8, 14, 28, 32, 56]);
      const same = d < 0.35 ? rng.int(3) === 0 : rng.int(4) === 0;
      const K = same ? C : 2 * C;
      const O = same ? H : Math.floor(outSize(H, 3, 2, 1));
      const xs = shp([C, H, H]);
      const fs = shp([K, O, O]);
      const conv = (k: number, s: number) => `A $1 \\times 1$ conv with ${k} filters and stride ${s}`;
      const opts = same
        ? [
            { text: '$\\symx$ itself', why: null },
            { text: conv(C, 2), why: `That shrinks the height and width to ${H / 2}, while $F(\\symx)$ keeps them at ${H}.` },
            { text: conv(2 * C, 1), why: `That makes ${2 * C} channels, while $F(\\symx)$ keeps ${C}.` },
            { text: conv(2 * C, 2), why: `That changes both the channels and the size, while $F(\\symx)$ has $\\symx$'s own shape.` },
          ]
        : [
            { text: conv(K, 2), why: null },
            { text: '$\\symx$ itself', why: `$\\symx$ is $${xs}$ and $F(\\symx)$ is $${fs}$: shapes that differ cannot be added.` },
            { text: conv(C, 2), why: `That keeps $\\symx$'s ${C} channels. $F(\\symx)$ has ${K}, so the shortcut needs ${K} filters.` },
            { text: conv(K, 1), why: `That keeps the height and width at ${H}. $F(\\symx)$ is ${O} wide, so the shortcut needs stride 2.` },
          ];
      return {
        prompt: `In a residual block, $\\symx$ has shape $${xs}$ and its layers give $F(\\symx)$ of shape $${fs}$. What should the shortcut be?`,
        answer: shuffled(rng, opts),
        solution: same
          ? [
              `The sum needs the shortcut's output to match $F(\\symx)$: $${fs}$.`,
              `That is already $\\symx$'s shape, so the shortcut is $\\symx$ itself, with nothing to learn.`,
            ]
          : [
              `The sum needs the shortcut's output to match $F(\\symx)$: $${fs}$.`,
              `Channels: $\\symx$ has ${C} and $F(\\symx)$ has ${K}. A conv makes one channel per filter, so it needs ${K} filters.`,
              `Size: ${H} wide must become ${O}. A stride of 2 does it: $(${H} - 1) / 2 + 1 = ${outSize(H, 1, 2, 0)}$, rounded down to ${O}.`,
              `So the shortcut is a $1 \\times 1$ conv with ${K} filters and stride 2.`,
            ],
      };
    },
  },
];
