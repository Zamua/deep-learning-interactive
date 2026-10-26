import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, vec } from '../../kit';
import { atraps, clean, nonzero, outSize, par, shp, shuffled, traps } from '../kit';

const relu = (v: number) => Math.max(0, v);

export const generators: Generator[] = [
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
        traps: atraps(v, [
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
    id: 'grad',
    make(rng, d) {
      if (d >= 0.7) {
        const g = nonzero(rng, -3, 3);
        const a = pick(rng, [-0.5, 0.5, 1, 2, 0.1]);
        const b = pick(rng, [-0.5, 0.5, 1, 0, 0.2]);
        const v = clean(g * (1 + a) * (1 + b));
        return {
          prompt: `Two residual blocks are stacked: $h = \\symx + F_1(\\symx)$, then $y = h + F_2(h)$, all scalars. At the current values $F_1$ has slope $${num(a)}$, $F_2$ has slope $${num(b)}$, and the gradient arriving at $y$ is $\\symg = ${g}$. What gradient reaches $\\symx$?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: g * a * b, why: 'That drops both shortcuts. Each block passes the gradient back through $1 + F\'$, not just $F\'$.' },
            { value: g * (1 + a + b), why: `That adds the slopes. The blocks are in a chain, so their factors multiply: $(1 + ${par(a)})(1 + ${par(b)})$.` },
            { value: g, why: 'That keeps only the shortcuts. The paths through $F_1$ and $F_2$ add to the gradient too.' },
          ]),
          solution: [
            'Walking back from $y$, each block multiplies the gradient by $1$ plus its slope: block 2 first, then block 1.',
            `Through block 2: $\\symg \\, (1 + ${par(b)}) = ${par(g)} \\times ${num(clean(1 + b))} = ${num(clean(g * (1 + b)))}$.`,
            `Through block 1: $${num(clean(g * (1 + b)))} \\times (1 + ${par(a)}) = ${num(v)}$.`,
            'Each factor is 1 plus a slope: the 1 is the shortcut, so the gradient does not have to pass through every layer\'s slope.',
          ],
        };
      }
      const g = d < 0.35 ? int(rng, 1, 5) : nonzero(rng, -4, 4);
      const a = d < 0.35 ? int(rng, 0, 3) : pick(rng, [-0.5, 0.5, 0.1, 2, -1, 1.5]);
      const v = clean(g * (1 + a));
      return {
        prompt: `A residual block has a scalar input $\\symx$ and output $y$. At the current value, $F'(\\symx) = ${num(a)}$ and the gradient arriving at $y$ is $\\symg = ${g}$. What gradient reaches $\\symx$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(g * a), why: 'That is only the path through $F$. The shortcut sends $\\symg$ back too, unchanged.' },
          { value: g, why: 'That is only the shortcut. The path through $F$ adds $\\symg F\'$.' },
          { value: clean(g + a), why: 'That adds the slope to the gradient. The path through $F$ multiplies: $\\symg \\cdot F\'$.' },
        ]),
        solution: [
          '$y = \\symx + F(\\symx)$ is a sum, so the gradient reaches $\\symx$ along both paths, and they add.',
          `Shortcut: $\\symg = ${g}$. Through $F$: $\\symg \\cdot F' = ${par(g)} \\times ${par(a)} = ${num(clean(g * a))}$.`,
          `Total: $\\symg\\,(1 + F') = ${par(g)} \\times ${num(clean(1 + a))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'why-deep',
    make(rng) {
      const plain = pick(rng, [34, 56, 110, 152]);
      const shallow = pick(rng, [18, 20]);
      const per = pick(rng, [2, 3]);
      const gradRight = rng.int(2) === 0;
      return {
        prompt: `A plain ${plain}-layer network trains worse than ${shallow === 18 ? 'an' : 'a'} ${shallow}-layer one, even on its training data. Wrapping every ${per} layers in a residual block fixes it. Which of these is a reason it helps?`,
        answer: shuffled(rng, [
          gradRight
            ? { text: 'The gradient reaches early layers along the shortcuts, undiminished', why: null }
            : { text: 'A block can pass its input through unchanged by learning $F(\\symx) = 0$', why: null },
          { text: 'The shortcuts add parameters, so the deeper network can fit more', why: 'An identity shortcut has no parameters at all: it adds $\\symx$ as it is.' },
          { text: 'The shortcuts skip layers, so the network computes less and trains faster', why: 'Every layer still runs: the shortcut adds $\\symx$ to $F(\\symx)$, it does not replace $F$.' },
          { text: 'The shortcuts take the place of the ReLUs, so nothing gets set to zero', why: 'The layers inside $F$ keep their ReLUs; the shortcut is added around them, not instead of them.' },
        ]),
        solution: [
          'Backward, the sum sends the gradient along the shortcut unchanged: each block multiplies it by $1 + F\'$, not by $F\'$ alone, so it does not fade across many blocks.',
          'Forward, a block that has nothing useful to add can learn $F(\\symx) = 0$ and leave its input alone, so extra blocks need not make things worse.',
        ],
      };
    },
  },
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
        traps: atraps(v, [
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
];
