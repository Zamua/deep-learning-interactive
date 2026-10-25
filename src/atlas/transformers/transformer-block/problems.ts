import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, clean, D, shp, straps, T, tenth, traps, vecT, vtraps, X } from '../kit';

/** A sequence length and a width, larger with difficulty. */
function dims(rng: Rng, d: number): [number, number] {
  const t = d < 0.35 ? int(rng, 4, 12) : pick(rng, [16, 32, 64, 128, 256]);
  const dm = d < 0.35 ? pick(rng, [8, 16, 32, 64]) : pick(rng, [128, 256, 512, 768, 1024]);
  return [t === dm ? t + 1 : t, dm];
}

export const generators: Generator[] = [
  {
    id: 'order',
    make(rng, d) {
      const [t, dm] = dims(rng, d);
      const io = shp([t, dm]);
      const items = d < 0.5
        ? [
            `Layer norm of the block's input $${X}$`,
            `Multi-head attention: $${io}$ in, $${io}$ out`,
            `Add $${X}$ to the attention's output`,
            'Layer norm of that sum',
            `MLP: up to $${shp([t, 4 * dm])}$ and back down to $${io}$`,
            'Add the sum to the MLP\'s output',
          ]
        : [
            `Layer norm of the block's input $${X}$`,
            `Multi-head attention: $${io}$ in, $${io}$ out`,
            `Add $${X}$ to the attention's output`,
            'Layer norm of that sum',
            `Linear layer up to $${shp([t, 4 * dm])}$`,
            `ReLU, still $${shp([t, 4 * dm])}$`,
            `Linear layer back down to $${io}$`,
            'Add the sum to the MLP\'s output',
          ];
      return {
        prompt: `A pre-norm transformer block takes an input $${X}$ of $${T} = ${t}$ tokens of width $${D} = ${big(dm)}$. Put its steps in order.`,
        answer: { kind: 'order', items },
        solution: [
          `First the attention branch: layer norm, then multi-head attention, then add the input back: $${X} + \\mathrm{Attn}(\\mathrm{LN}(${X}))$.`,
          `Then the MLP branch on that sum: layer norm, then the MLP (up to $4${D} = ${bigText(4 * dm)}$, ReLU, back to $${D}$), then add the sum back.`,
          `Every step but the MLP's middle keeps the shape $${io}$, so blocks can be stacked.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const [t, dm] = dims(rng, d);
      const which = pick(rng, ['out', 'hidden', 'attn', 'norm'] as const);
      const ask = {
        out: 'the block\'s output',
        hidden: 'the MLP\'s hidden layer, after the ReLU',
        attn: 'the attention branch\'s output, before it is added back',
        norm: 'the first layer norm\'s output',
      }[which];
      const ans = which === 'hidden' ? [t, 4 * dm] : [t, dm];
      return {
        prompt: `A transformer block takes $${T} = ${t}$ tokens of width $${D} = ${big(dm)}$. What is the shape of ${ask}?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          which === 'hidden'
            ? { value: [t, dm], why: `The MLP first widens each token to $4${D} = ${bigText(4 * dm)}$.` }
            : { value: [t, 4 * dm], why: `That is the MLP's hidden layer. It projects back down to $${D}$, so the block keeps the shape $${shp([t, dm])}$.` },
          { value: [t, t], why: `That is the shape of one head's attention weights. Each token still leaves with one vector of width $${D}$.` },
          { value: [ans[1]!, t], why: 'That is the transpose: one row per token.' },
        ]),
        solution: which === 'hidden'
          ? [`The MLP acts on each token alone: it widens it from $${D} = ${bigText(dm)}$ to $4${D} = ${bigText(4 * dm)}$, applies the ReLU, then projects back.`, `So the hidden layer is $${shp(ans)}$.`]
          : [
              `Layer norm, attention, the adds and the MLP's output all keep one vector of width $${D}$ per token.`,
              `So ${ask} is $${shp(ans)}$, the same as the input.`,
            ],
      };
    },
  },
  {
    id: 'hidden',
    make(rng, d) {
      const dm = d < 0.35 ? pick(rng, [4, 8, 10, 16, 32, 64]) : pick(rng, [128, 256, 512, 768, 1024, 1600, 2048, 4096]);
      const h = 4 * dm;
      if (d >= 0.6 && rng.int(2) === 0) {
        return {
          prompt: `A transformer's MLP has a hidden layer of $${big(h)}$ units, the usual width. What is the model width $${D}$?`,
          answer: { kind: 'number', value: dm },
          traps: traps(dm, [
            { value: h * 4, why: `That multiplies again. The hidden layer is $4${D}$, so $${D}$ is a quarter of it.` },
            { value: h / 2, why: `The hidden layer is four times $${D}$, not twice.` },
          ]),
          solution: [`The MLP's hidden layer is $4${D}$ wide.`, `$${D} = ${big(h)} / 4 = ${big(dm)}$.`],
        };
      }
      return {
        prompt: `A transformer has width $${D} = ${big(dm)}$. How many units does each block's MLP have in its hidden layer, at the usual width?`,
        answer: { kind: 'number', value: h },
        traps: traps(h, [
          { value: dm, why: `That is the width the MLP returns to. In between it widens each token to $4${D}$.` },
          { value: 2 * dm, why: `The usual hidden width is four times $${D}$, not twice.` },
          { value: dm / 4, why: `The MLP widens, then narrows: its hidden layer is larger than $${D}$.` },
        ]),
        solution: [`The MLP widens each token from $${D}$ to $4${D}$ and back.`, `$4 \\times ${big(dm)} = ${big(h)}$.`],
      };
    },
  },
  {
    id: 'residual',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const gen = () => (d < 0.35 ? int(rng, -2, 4) : tenth(rng, -2, 2));
      const x = Array.from({ length: n }, () => int(rng, -2, 4));
      const a = Array.from({ length: n }, gen);
      const sum1 = x.map((v, i) => clean(v + a[i]!));
      if (d < 0.5) {
        return {
          prompt: `In a pre-norm block, a token enters as $${X} = ${vecT(x)}$, and the attention branch returns $${vecT(a)}$ for it. What does the token carry into the MLP branch?`,
          answer: { kind: 'vector', value: sum1 },
          traps: vtraps(sum1, [
            { value: a, why: `That is the attention output alone. The block adds it to $${X}$: the residual connection.` },
            { value: x, why: `That is $${X}$ unchanged. The attention output is added to it.` },
          ]),
          solution: [`The attention branch's output is added to the input: $${X} + \\mathrm{Attn}(\\mathrm{LN}(${X}))$.`, `$${vecT(x)} + ${vecT(a)} = ${vecT(sum1)}$.`],
        };
      }
      const m = Array.from({ length: n }, gen);
      const y = sum1.map((v, i) => clean(v + m[i]!));
      return {
        prompt: `In a pre-norm block, a token enters as $${X} = ${vecT(x)}$. For this token the attention branch returns $${vecT(a)}$, and the MLP branch then returns $${vecT(m)}$. What is the block's output for it?`,
        answer: { kind: 'vector', value: y },
        traps: vtraps(y, [
          { value: a.map((v, i) => clean(v + m[i]!)), why: `That leaves out the input. Each branch's output is added to the running sum, which starts as $${X}$.` },
          { value: m, why: 'That is the MLP branch\'s output alone. It is added to everything before it.' },
          { value: sum1, why: 'That stops after the attention branch. The MLP branch\'s output is added too.' },
        ]),
        solution: [
          `After the attention branch: $${vecT(x)} + ${vecT(a)} = ${vecT(sum1)}$.`,
          `After the MLP branch: $${vecT(sum1)} + ${vecT(m)} = ${vecT(y)}$.`,
          'Each branch adds a change; the input itself passes straight through.',
        ],
      };
    },
  },
];
