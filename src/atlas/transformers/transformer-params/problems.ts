import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, D, traps, WK, WO, WQ, WV } from '../kit';

const W1 = '\\sym{W1}{W_1}';
const W2 = '\\sym{W2}{W_2}';

const NB = '\\sym{nblocks}{N}';
const VOC = '\\sym{vocab}{V}';

export const generators: Generator[] = [
  {
    id: 'block',
    make(rng, d) {
      const dm = d < 0.35 ? pick(rng, [2, 3, 4, 5, 10, 20]) : d < 0.7 ? pick(rng, [100, 200, 300, 400, 500]) : pick(rng, [1000, 2000, 3000, 4000, 5000]);
      const part = d < 0.5 ? 'all' : pick(rng, ['all', 'attn', 'mlp'] as const);
      const v = { all: 12, attn: 4, mlp: 8 }[part] * dm * dm;
      const what = { all: 'one transformer block hold', attn: 'one block\'s attention hold', mlp: 'one block\'s MLP hold' }[part];
      return {
        prompt: `A transformer has width $${D} = ${big(dm)}$, multi-head attention, and an MLP with a hidden layer of $4${D}$. Ignoring biases and layer norms, how many weights does ${what}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(part !== 'attn' ? [{ value: 4 * dm * dm, why: `That is the attention alone: $${WQ}$, $${WK}$, $${WV}$ and $${WO}$, four $${D} \\times ${D}$ matrices.` }] : []),
          ...(part !== 'mlp' ? [{ value: 8 * dm * dm, why: `That is the MLP alone: $${D} \\times 4${D}$ and $4${D} \\times ${D}$, so $8${D}^2$.` }] : []),
          { value: { all: 12, attn: 4, mlp: 8 }[part] * dm, why: `That multiplies by $${D}$ once. Each matrix is $${D}$ by $${D}$ (or $4${D}$), so the count grows with $${D}^2$.` },
          ...(part === 'attn' ? [{ value: 3 * dm * dm, why: `That leaves out $${WO}$, the fourth $${D} \\times ${D}$ matrix, which mixes the heads.` }] : []),
          ...(part === 'mlp' ? [{ value: 4 * dm * dm, why: `That counts one of the MLP's two matrices. Both are $4${D}^2$.` }] : []),
        ]),
        solution: [
          `Attention: $${WQ}$, $${WK}$, $${WV}$ and $${WO}$, each $${D} \\times ${D}$ across all heads: $4${D}^2$.`,
          `MLP: $${W1}$ is $4${D} \\times ${D}$ and $${W2}$ is $${D} \\times 4${D}$: $8${D}^2$.`,
          `${part === 'all' ? `Together $12${D}^2` : part === 'attn' ? `So the attention holds $4${D}^2` : `So the MLP holds $8${D}^2`} $= ${{ all: 12, attn: 4, mlp: 8 }[part]} \\times ${big(dm)}^2 = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'total',
    make(rng, d) {
      if (d < 0.4) {
        const dm = pick(rng, [2, 4, 5, 10]);
        const n = int(rng, 2, 6);
        const v = 12 * dm * dm * n;
        return {
          prompt: `A transformer stacks $${NB} = ${n}$ blocks of width $${D} = ${dm}$. Ignoring biases, layer norms and the embedding, about how many weights do its blocks hold, at $12${D}^2$ per block?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: 12 * dm * dm, why: `That is one block. There are ${n}.` },
            { value: 12 * dm * n, why: `That uses $12${D}$ per block. It is $12${D}^2$.` },
          ]),
          solution: [`One block: $12 \\times ${dm}^2 = ${12 * dm * dm}$.`, `${n} blocks: $${n} \\times ${12 * dm * dm} = ${v}$.`],
        };
      }
      const dm = pick(rng, [500, 1000, 2000]);
      const n = pick(rng, [6, 12, 24, 48]);
      const voc = pick(rng, [30000, 50000, 100000]);
      const per = (12 * dm * dm) / 1e6;
      const emb = (voc * dm) / 1e6;
      const v = n * per + emb;
      return {
        prompt: `A transformer has $${NB} = ${n}$ blocks of width $${D} = ${big(dm)}$ and a vocabulary of $${VOC} = ${big(voc)}$ tokens, each with an embedding row. Ignoring biases and layer norms, about how many million parameters does it have?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: n * per, why: `That is the blocks alone. The embedding table adds $${VOC} \\times ${D} = ${bigText(emb)}$ million.` },
          { value: per + emb, why: `That counts one block. There are ${n}.` },
          { value: n * per + voc / 1e6, why: `That gives each token one number. Each gets a row of $${D}$ numbers: $${VOC} \\times ${D}$.` },
        ]),
        solution: [
          `One block: $12${D}^2 = 12 \\times ${big(dm)}^2 = ${bigText(per)}$ million. ${n} blocks: $${bigText(n * per)}$ million.`,
          `The embedding: $${VOC} \\times ${D} = ${big(voc)} \\times ${big(dm)} = ${bigText(emb)}$ million.`,
          `In all: $${bigText(n * per)} + ${bigText(emb)} = ${bigText(v)}$ million.`,
        ],
      };
    },
  },
  {
    id: 'embed',
    make(rng, d) {
      const voc = d < 0.35 ? pick(rng, [26, 50, 65, 100, 256]) : pick(rng, [10000, 30000, 32000, 50000, 50257, 100000]);
      const dm = d < 0.35 ? pick(rng, [4, 8, 10, 16]) : pick(rng, [256, 512, 768, 1024]);
      const v = voc * dm;
      return {
        prompt: `A transformer's vocabulary has $${VOC} = ${big(voc)}$ tokens and its width is $${D} = ${big(dm)}$. How many numbers does its token embedding table hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: voc + dm, why: `That adds. The table has $${VOC}$ rows of $${D}$ numbers: multiply.` },
          { value: voc, why: `That is one number per token. Each token's row holds $${D}$ numbers.` },
          { value: 12 * dm * dm, why: `That is one block, $12${D}^2$. The embedding is $${VOC} \\times ${D}$.` },
        ]),
        solution: [`One row of $${D}$ numbers per token in the vocabulary: shape $(${big(voc)}, ${big(dm)})$.`, `$${big(voc)} \\times ${big(dm)} = ${big(v)}$.`],
      };
    },
  },
  {
    id: 'scaling',
    make(rng) {
      const f = pick(rng, [2, 3, 4]);
      const width = rng.int(2) === 0;
      const dm = pick(rng, [256, 512, 768, 1024]);
      const n = pick(rng, [6, 12, 24]);
      const right = width ? f * f : f;
      const opts = [...new Set([right, f, f * f, f * f * f, 1])].filter((x) => x !== right).slice(0, 3);
      const label = (x: number) => (x === 1 ? 'They stay the same' : `They grow ${x} times`);
      const options = [label(right), ...opts.map(label)];
      return {
        prompt: `A transformer has $${NB} = ${n}$ blocks of width $${D} = ${dm}$. ${width ? `Its width grows ${f} times, to $${D} = ${f * dm}$, with the same ${n} blocks` : `It gets ${f} times as many blocks, $${NB} = ${f * n}$, with the same width`}. What happens to the number of weights in its blocks?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [
            null,
            ...opts.map((x) =>
              x === 1
                ? `Every weight matrix ${width ? 'grows with the width' : 'is copied into each new block'}.`
                : x === f && width
                  ? `Each block holds $12${D}^2$: the width enters squared, so ${f} times the width is $${f * f}$ times the weights.`
                  : x === f * f && !width
                    ? `Blocks are added side by side in the count: ${f} times the blocks is ${f} times the weights. Only the width enters squared.`
                    : `The total is $12${NB}${D}^2$: ${width ? `${f} times the width gives $${f}^2 = ${f * f}$` : `${f} times the blocks gives ${f}`} times the weights.`,
            ),
          ],
        },
        solution: [`The blocks hold about $12${NB}${D}^2$ weights.`, width ? `$${D}$ is squared, so ${f} times the width gives $${f}^2 = ${f * f}$ times the weights.` : `$${NB}$ enters once, so ${f} times the blocks gives ${f} times the weights.`],
      };
    },
  },
];
