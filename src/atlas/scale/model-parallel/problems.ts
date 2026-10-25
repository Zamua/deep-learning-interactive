import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { big, commas, shape, straps, traps, vtraps, whys } from '../kit';

const W1 = '\\sym{W1}{W_1}';
const W2 = '\\sym{W2}{W_2}';

/** A matrix in TeX with a bar between column blocks of width `w`. */
function split(rows: number[][], w: number): string {
  const n = rows[0]!.length;
  const cols = Array.from({ length: n / w }, () => 'r'.repeat(w)).join('|');
  return `\\left[\\begin{array}{${cols}} ${rows.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{array}\\right]`;
}

const dot = (x: number[], col: number[]) => x.reduce((a, v, i) => a + v * col[i]!, 0);

export const generators: Generator[] = [
  {
    id: 'shard',
    make(rng, d) {
      const dm = pick(rng, d < 0.35 ? [256, 512, 1024] : [256, 512, 768, 1024, 2048, 4096]);
      const k = d < 0.35 ? 2 : pick(rng, [2, 4, 8]);
      const up = d < 0.35 || rng.next() < 0.6;
      const H = 4 * dm;
      if (up) {
        const v = [dm, H / k];
        return {
          prompt: `A layer's weight matrix $${W1}$ has shape ${shape([dm, H])}: one row per input number and one column per output, so the layer computes $\\symx ${W1}$ for an input row $\\symx$ of ${commas(dm)} numbers. It is split by columns across ${k} GPUs. What shape is each GPU's piece?`,
          answer: { kind: 'shape', value: v },
          traps: straps(v, [
            { value: [dm / k, H], why: 'That splits the rows. Splitting by columns keeps every row and gives each GPU a block of the columns.' },
            { value: [dm, H], why: 'That is the whole matrix. Each GPU keeps only its share of the columns.' },
            { value: [dm / k, H / k], why: 'Only the columns are split. Every GPU needs all the rows, because each output reads the whole input.' },
          ]),
          solution: [
            `Splitting by columns keeps all ${commas(dm)} rows and divides the ${commas(H)} columns ${k} ways.`,
            `$${big(H)} / ${k} = ${big(H / k)}$ columns each: shape ${shape(v)}. Each GPU computes ${commas(H / k)} of the outputs.`,
          ],
        };
      }
      const v = [H / k, dm];
      return {
        prompt: `The next layer's matrix $${W2}$ has shape ${shape([H, dm])}: it takes the ${commas(H)} outputs back down to ${commas(dm)}. To match a column split of the layer before, it is split by rows across ${k} GPUs. What shape is each GPU's piece?`,
        answer: { kind: 'shape', value: v },
        traps: straps(v, [
          { value: [H, dm / k], why: 'That splits the columns. Splitting by rows keeps every column and gives each GPU a block of the rows.' },
          { value: [H, dm], why: 'That is the whole matrix. Each GPU keeps only the rows that read its own outputs.' },
          { value: [H / k, dm / k], why: 'Only the rows are split. Each GPU\'s rows still reach every one of the outputs.' },
        ]),
        solution: [
          `Splitting by rows divides the ${commas(H)} rows ${k} ways and keeps all ${commas(dm)} columns.`,
          `$${big(H)} / ${k} = ${big(H / k)}$ rows each: shape ${shape(v)}. Each GPU's rows read exactly the outputs it computed.`,
        ],
      };
    },
  },
  {
    id: 'stages',
    make(rng, d) {
      const [L, S] = pick(rng, [[12, 2], [12, 3], [16, 4], [24, 4], [24, 3], [32, 4], [32, 8], [48, 4], [48, 6], [64, 8], [80, 4], [96, 8]] as [number, number][]);
      const per = L / S;
      if (d < 0.35) {
        return {
          prompt: `A network of ${L} layers is split into ${S} pipeline stages, each a run of consecutive layers on its own GPU, all the same size. How many layers does each stage hold?`,
          answer: { kind: 'number', value: per },
          traps: traps(per, [{ value: L - S, why: 'The stages share the layers out: divide the number of layers by the number of stages.' }]),
          solution: [`${L} layers in ${S} equal runs: $${L} / ${S} = ${per}$ layers per stage.`],
        };
      }
      const j = int(rng, per, L - 1);
      const v = Math.floor(j / per);
      return {
        prompt: `A network of ${L} layers is split into ${S} pipeline stages of consecutive layers, all the same size. Counting layers and stages from 0, which stage holds layer ${j}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: v + 1, why: 'That counts stages from 1. Counting from 0, stage 0 holds the first run of layers.' },
          { value: j % S, why: 'That deals the layers out one at a time, like cards. Each stage holds a run of consecutive layers.' },
          { value: Math.ceil(j / per), why: `That rounds up. Stage 0 holds layers 0 to ${per - 1}, so divide by ${per} and round down.` },
        ]),
        solution: [
          `Each stage holds $${L} / ${S} = ${per}$ consecutive layers: stage 0 has layers 0 to ${per - 1}, stage 1 has ${per} to ${2 * per - 1}, and so on.`,
          `Layer ${j}: $${j} / ${per} = ${num(Math.round((j / per) * 100) / 100)}$, rounded down: stage ${v}.`,
        ],
      };
    },
  },
  {
    id: 'slice',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const gpus = d < 0.75 ? 2 : 3;
      const cols = 2 * gpus;
      const x = Array.from({ length: n }, () => int(rng, d < 0.25 ? 0 : -2, 3));
      const W = Array.from({ length: n }, () => Array.from({ length: cols }, () => int(rng, -2, 2)));
      const g = rng.int(gpus);
      const col = (j: number) => W.map((r) => r[j]!);
      const out = Array.from({ length: cols }, (_, j) => dot(x, col(j)));
      const v = out.slice(2 * g, 2 * g + 2);
      const other = (g + 1) % gpus;
      return {
        prompt: `A layer computes $\\symx ${W1}$, with $\\symx = [${x.map((v) => num(v)).join(',\\ ')}]$ and\n\n$$${W1} = ${split(W, 2)}$$\n\nsplit by columns across ${gpus} GPUs, two columns each, GPU 0 first. Before any activation, what does GPU ${g} compute?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: out.slice(2 * other, 2 * other + 2), why: `That is GPU ${other}'s part. Counting from 0, GPU ${g} holds columns ${2 * g} and ${2 * g + 1}.` },
          { value: out, why: `That is the whole output. GPU ${g} computes only the outputs of its own two columns.` },
          ...(gpus === n ? [{ value: W[g]!.map((w) => x[g]! * w), why: `That uses row ${g}, as a split by rows would. GPU ${g} holds two whole columns, and each output dots $\\symx$ with one column.` }] : []),
        ]),
        solution: [
          `GPU ${g} holds columns ${2 * g} and ${2 * g + 1}. Each of its outputs is $\\symx$ dotted with one of them.`,
          ...[2 * g, 2 * g + 1].map((j) => `Column ${j}: $${x.map((xi, i) => `${xi < 0 ? `(${xi})` : xi} \\cdot ${W[i]![j]! < 0 ? `(${W[i]![j]})` : W[i]![j]}`).join(' + ')} = ${out[j]}$.`),
          `So GPU ${g} computes $[${v.join(',\\ ')}]$, with no help from the other GPU${gpus > 2 ? 's' : ''}.`,
        ],
      };
    },
  },
  {
    id: 'traffic',
    make(rng) {
      const L = pick(rng, [12, 24, 32, 48]);
      const k = pick(rng, [2, 4, 8]);
      const kind = rng.int(3);
      if (kind === 0) {
        const options = ['Splitting every weight matrix by columns across the GPUs', 'Splitting the layers into consecutive stages', 'Giving every GPU a full copy and a slice of the batch'];
        return {
          prompt: `A network of ${L} layers runs on ${k} GPUs. Which split needs the GPUs to exchange results inside every layer, before the next layer can start?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: whys(3, 0, (i) =>
              i === 1
                ? 'A stage runs its layers alone and passes on its output only where the network is cut between stages, not inside every layer.'
                : 'Each GPU runs the whole network on its own examples, and the GPUs only average their gradients, once per step.',
            ),
          },
          solution: [
            'With columns split, each GPU computes part of every layer\'s output, and the next layer needs all of it.',
            'So the GPUs combine their parts inside every layer, every step. A stage split talks only at its cuts, and a data split only once per step.',
          ],
        };
      }
      if (kind === 1) {
        const S = pick(rng, [2, 3, 4].filter((s) => L % s === 0));
        const options = ['Its output for the batch, the input to the next stage\'s first layer', 'Its layers\' weights', 'The gradients of its layers\' weights', 'The batch of inputs it started from'];
        return {
          prompt: `A network of ${L} layers is split into ${S} pipeline stages of ${L / S} layers each. In the forward pass, what does stage 0 send to stage 1?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [null, 'Weights never move: each stage keeps its own layers.', 'Those stay with the stage that owns the weights, which also takes the step for them.', 'Stage 1 does not need the raw inputs, only what stage 0 made of them.'],
          },
          solution: [`Stage 1's first layer, layer ${L / S}, reads the output of layer ${L / S - 1}, the last layer of stage 0.`, 'So stage 0 sends that output, and in the backward pass the gradient on it comes back.'],
        };
      }
      const dm = pick(rng, [512, 1024, 2048]);
      const options = ['A partial sum of the output, which the GPUs add together', `A block of ${commas(dm / k)} of the outputs, each complete`, 'The whole output, the same on every GPU'];
      return {
        prompt: `$${W2}$ has shape ${shape([4 * dm, dm])} and is split by rows across ${k} GPUs, each holding the rows that read its own ${commas((4 * dm) / k)} inputs. What does each GPU's product give?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [null, 'That is what a split by columns gives. Each GPU\'s rows reach every output, but with only its own inputs\' share of each sum.', 'Each GPU sees only its own inputs, so its products leave out the other GPUs\' share.'],
        },
        solution: [
          `Every output adds up terms from all ${commas(4 * dm)} inputs, and each GPU holds only ${commas((4 * dm) / k)} of them.`,
          'So each GPU gets part of every output\'s sum: adding the partial sums across the GPUs gives the real output.',
        ],
      };
    },
  },
];
