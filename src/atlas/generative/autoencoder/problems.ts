import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, vec } from '../../kit';
import { big, bigText, clean, shp, shuffled, straps, sum, tenth, traps } from '../kit';

interface Input {
  /** What the input is, for the prompt. */
  what: string;
  dims: number[];
  k: number[];
}

const INPUTS: Input[][] = [
  [
    { what: '$8 \\times 8$ grayscale images', dims: [8, 8], k: [2, 4, 8, 16] },
    { what: '$10 \\times 10$ grayscale images', dims: [10, 10], k: [4, 5, 10, 20, 25] },
    { what: 'readings of 60 sensors', dims: [60], k: [3, 4, 5, 6, 10, 12] },
  ],
  [
    { what: '$28 \\times 28$ grayscale images', dims: [28, 28], k: [16, 28, 49, 56, 98, 112] },
    { what: '$32 \\times 32$ color images', dims: [32, 32, 3], k: [32, 48, 64, 96, 128, 192, 256] },
  ],
  [
    { what: '$64 \\times 64$ color images', dims: [64, 64, 3], k: [64, 128, 256, 512, 768, 1024] },
    { what: '$32 \\times 32$ color images', dims: [32, 32, 3], k: [24, 48, 96, 384, 512, 768] },
  ],
];

const input = (rng: Rng, d: number) => {
  const m = pick(rng, INPUTS[d < 0.35 ? 0 : d < 0.7 ? 1 : 2]!);
  return { ...m, D: m.dims.reduce((a, b) => a * b, 1), k: pick(rng, m.k) };
};

/** A target and a reconstruction, with the error growing finer with difficulty. */
function pair(rng: Rng, d: number): { x: number[]; xh: number[] } {
  const n = d < 0.7 ? 3 : 4;
  const x = Array.from({ length: n }, () => (d < 0.7 ? int(rng, 0, 4) : int(rng, -2, 4)));
  for (;;) {
    const xh = x.map((v) => (d < 0.35 ? v + int(rng, -2, 2) : clean(v + tenth(rng, -1.5, 1.5) * (rng.next() < 0.8 ? 1 : 0))));
    if (xh.some((v, i) => v !== x[i]) && xh.filter((v, i) => v !== x[i]).length >= 2) return { x, xh };
  }
}

export const generators: Generator[] = [
  {
    id: 'ratio',
    make(rng, d) {
      const m = input(rng, d);
      const v = m.D / m.k;
      const color = m.dims.length === 3;
      const Dtex = m.dims.length > 1 ? `${m.dims.join(' \\cdot ')} = ${big(m.D)}` : big(m.D);
      return {
        prompt: `An autoencoder takes ${m.what} and squeezes each one into a code of $k = ${big(m.k)}$ numbers in the middle. How many input numbers does each number of the code stand for?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: m.k / m.D, why: 'That divides the code by the input. Each code number stands for many input numbers, so divide the input size by the code size.' },
          { value: m.D - m.k, why: 'That is how many fewer numbers the code has. The question asks for the ratio: divide.' },
          ...(color ? [{ value: (m.dims[0]! * m.dims[1]!) / m.k, why: 'That counts pixels, not numbers. A color pixel brings 3 numbers: red, green and blue.' }] : []),
        ]),
        solution: [
          `One input holds $${Dtex}$ numbers.`,
          `The code holds $k = ${big(m.k)}$, so it is $${big(m.D)} / ${big(m.k)} = ${big(v)}$ times smaller.`,
          `Each number of the code has to carry what $${big(v)}$ input numbers said.`,
        ],
      };
    },
  },
  {
    id: 'recon-error',
    make(rng, d) {
      const { x, xh } = pair(rng, d);
      const diff = x.map((v, i) => clean(v - xh[i]!));
      const sq = diff.map((v) => clean(v * v));
      const v = sum(sq);
      const fine = d >= 0.35;
      return {
        prompt: `An autoencoder gets the input $\\symx = ${vec(x)}$ and gives back $\\hat{\\symx} = ${vec(xh)}$. What is its squared error $\\lVert \\symx - \\hat{\\symx} \\rVert^2$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: sum(diff), why: 'That adds the differences without squaring them, so misses above and below cancel. Square each one first.' },
          { value: sum(diff.map(Math.abs)), why: 'That adds the sizes of the differences. Square each difference before adding.' },
          { value: clean(v / x.length), why: `That is the mean of the squares. The squared error is their sum: do not divide by ${x.length}.` },
          { value: clean(sum(diff) ** 2), why: 'That squares the sum of the differences. Square each difference, then add.' },
        ]),
        solution: [
          `The squared error is the sum of the squared differences. Entry by entry: $\\symx - \\hat{\\symx} = ${vec(diff)}$.`,
          `Square each: $${vec(sq)}$.`,
          `Add them: $${sq.map((q) => num(q)).join(' + ')} = ${num(v)}$.${fine ? '' : ' Every miss counts, whichever way it goes.'}`,
        ],
      };
    },
  },
  {
    id: 'shapes',
    make(rng, d) {
      const D = d < 0.35 ? pick(rng, [64, 100]) : pick(rng, [784, 3072]);
      const H = d < 0.35 ? pick(rng, [16, 20, 32]) : pick(rng, [128, 256, 512]);
      const k = d < 0.35 ? pick(rng, [2, 4, 8]) : pick(rng, [16, 32, 64]);
      const ask = pick(rng, ['enc1', 'enc2', 'dec1', 'dec2'] as const);
      const W: Record<string, { name: string; v: number[]; mirror: number[] }> = {
        enc1: { name: "the encoder's first weight matrix", v: [H, D], mirror: [D, H] },
        enc2: { name: "the encoder's second weight matrix, the one that makes the code", v: [k, H], mirror: [H, k] },
        dec1: { name: "the decoder's first weight matrix, the one that reads the code", v: [H, k], mirror: [k, H] },
        dec2: { name: "the decoder's last weight matrix", v: [D, H], mirror: [H, D] },
      };
      const sizes = `The encoder maps $\\symD = ${big(D)}$ inputs to $\\symH = ${H}$ hidden units, then to a code of $k = ${k}$. The decoder mirrors it, from ${k} back to ${H} and then ${bigText(D)}.`;
      const w = W[ask]!;
      return {
        prompt: `${sizes} What is the shape of ${w.name}?`,
        answer: { kind: 'shape', value: w.v },
        traps: straps(w.v, [
          { value: w.mirror, why: 'That is (inputs, outputs). The rows count the outputs: one row of weights per output.' },
          { value: ask === 'dec2' ? [D, k] : ask === 'enc1' ? [k, D] : [H, D], why: ask === 'dec2' || ask === 'enc1' ? `That skips the hidden layer of $\\symH = ${H}$ units.` : `That is the encoder's first matrix. This one sits next to the code, $k = ${k}$ wide.` },
          { value: ask === 'dec1' ? [D, k] : [k, D], why: 'That connects the code straight to the input size, skipping the hidden layer.' },
        ]),
        solution: [
          ask === 'enc1' ? `It turns the $${big(D)}$ inputs into $${H}$ hidden units.` : ask === 'enc2' ? `It turns the $${H}$ hidden units into the $${k}$ numbers of the code.` : ask === 'dec1' ? `It turns the $${k}$ numbers of the code into $${H}$ hidden units.` : `It turns the decoder's $${H}$ hidden units back into $${big(D)}$ numbers, one per input number.`,
          `One row per output, one column per input: $${shp(w.v)}$.`,
        ],
      };
    },
  },
  {
    id: 'bottleneck',
    make(rng, d) {
      const m = input(rng, d);
      const kind = pick(rng, ['why', 'wide', 'target', 'code'] as const);
      const lead = `An autoencoder for ${m.what} has $${big(m.D)}$ numbers in and out`;
      if (kind === 'why')
        return {
          prompt: `${lead}, and a code of only $k = ${big(m.k)}$ in the middle. Why make the middle so narrow?`,
          answer: shuffled(rng, [
            { text: 'So the network cannot copy the input through, and must keep what matters most', why: null },
            { text: 'So the reconstruction can come out exactly equal to the input, with nothing lost', why: 'The narrow middle makes an exact copy impossible: the code cannot hold every input number. That is the point.' },
            { text: 'So the loss can compare the code with a label saying what the input shows', why: 'There are no labels. The loss compares the output with the input itself.' },
            { text: 'So each gradient step can skip backprop through the decoder and stay cheap', why: 'Training is ordinary gradient descent with backprop through both halves. The width of the middle does not change that.' },
          ]),
          solution: [
            `The code has $${big(m.k)}$ numbers for $${big(m.D)}$ inputs, so it cannot simply store the input.`,
            'To rebuild the input from so little, training has to find a short description: what is shared across the data, and what varies most from one input to the next.',
          ],
        };
      if (kind === 'wide')
        return {
          prompt: `${lead}. Someone widens the middle to $k = ${big(m.D)}$, as wide as the input. What happens when it is trained?`,
          answer: shuffled(rng, [
            { text: 'It can pass the input straight through: a tiny loss, and a code that summarizes nothing', why: null },
            { text: 'It cannot lower the loss at all, because the middle has too many numbers to fit', why: 'It can lower it easily: with room for every number, copying the input gives an almost perfect reconstruction.' },
            { text: 'It finds an even shorter summary than before, since it has more room to search', why: 'Nothing forces it to summarize: there is room to copy, and copying is the easiest way to a low loss.' },
            { text: 'It needs labels to train, because the input alone no longer pins down the code', why: 'An autoencoder never uses labels, whatever its width. The input is its own target.' },
          ]),
          solution: [
            'The loss only asks for the output to match the input.',
            'With as many code numbers as input numbers, the network can copy each input number into the code and back out. The loss gets small, but the code has learned nothing about the data.',
            'The narrow middle is what forces a summary.',
          ],
        };
      if (kind === 'target')
        return {
          prompt: `${lead}, with a code of $k = ${big(m.k)}$. During training, what does the loss compare the network's output with?`,
          answer: shuffled(rng, [
            { text: 'The very input that went in', why: null },
            { text: 'The code in the middle of the network', why: `The code has only $${big(m.k)}$ numbers and the output has $${big(m.D)}$. The output is compared with the input it came from.` },
            { text: 'A label saying what the input shows', why: 'Autoencoders need no labels: any pile of unlabeled inputs is a training set.' },
            { text: 'A different input, drawn at random', why: 'The target is the same input that went in, so the output has something specific to match.' },
          ]),
          solution: [
            'An autoencoder is trained to give back what it was given: the loss is $\\lVert \\symx - \\hat{\\symx} \\rVert^2$.',
            'So the input is its own target, and no labels are needed.',
          ],
        };
      return {
        prompt: `${lead}, and a code of $k = ${big(m.k)}$. After training, what do the $${big(m.k)}$ numbers of an input's code hold?`,
        answer: shuffled(rng, [
          { text: 'A compressed description the decoder can rebuild the input from', why: null },
          { text: `A copy of the input's first $${big(m.k)}$ numbers`, why: 'The decoder rebuilds every input number from the code, so the code has to describe the whole input, not one corner of it.' },
          { text: 'The input\'s class label, worked out by the encoder on its own', why: 'The network never saw a label. The code is whatever helps the decoder rebuild the input.' },
          { text: 'Random numbers that change each time the same input goes through', why: 'The code is computed by the trained encoder from the input: the same input always gives the same code.' },
        ]),
        solution: [
          'Training made the decoder rebuild each input from its code alone.',
          `So the $${big(m.k)}$ numbers must describe the input well enough to reconstruct it: a compressed summary.`,
        ],
      };
    },
  },
];
