import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { big, clean, commas, num, pick, traps } from '../../kit';
import { choice } from '../kit';

const FORMULA = '2 \\times \\text{layers} \\times \\text{tokens} \\times d \\times \\text{bytes}';

interface Model {
  layers: number;
  d: number;
  bytes: number;
}

function model(rng: Rng, d: number): Model {
  if (d < 0.35) return { layers: pick(rng, [2, 4, 10, 12]), d: pick(rng, [100, 500, 1000]), bytes: 2 };
  return { layers: pick(rng, [12, 24, 32, 40, 48]), d: pick(rng, [1000, 2000, 4000, 5000, 8000]), bytes: d < 0.7 ? 2 : pick(rng, [1, 2, 4]) };
}

const bytesWord = (b: number) => `${b} byte${b === 1 ? '' : 's'}`;

export const generators: Generator[] = [
  {
    id: 'size',
    make(rng, d) {
      const m = model(rng, d);
      const tokens = d < 0.35 ? pick(rng, [1000, 2000, 5000]) : pick(rng, [1000, 2000, 4000, 8000]);
      const batch = d >= 0.7 && rng.next() < 0.5 ? pick(rng, [2, 4, 8]) : 1;
      const total = 2 * m.layers * tokens * m.d * m.bytes * batch;
      const v = clean(total / 1e6);
      const who = batch === 1 ? `one sequence of ${commas(tokens)} tokens` : `${batch} sequences of ${commas(tokens)} tokens each`;
      return {
        prompt: `A model has ${m.layers} layers and width $d = ${big(m.d)}$, and its KV cache stores each number in ${bytesWord(m.bytes)}. How many MB of cache does ${who} need?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: v / 2, why: m.bytes === 2 ? 'That is half: either one vector per token per layer, where the cache keeps a key and a value, or numbers counted instead of bytes, at 2 bytes each.' : 'That stores one vector per token per layer. The cache keeps two: a key and a value.' },
          { value: v / m.bytes, why: `That counts numbers, not bytes. Each number takes ${bytesWord(m.bytes)}.` },
          { value: v / m.layers, why: `That is one layer's cache. Every one of the ${m.layers} layers keeps its own keys and values.` },
          ...(batch > 1 ? [{ value: v / batch, why: `That is one sequence. Each of the ${batch} sequences keeps a cache of its own.` }] : []),
        ]),
        solution: [
          `The cache holds $${FORMULA}${batch > 1 ? ' \\times \\text{sequences}' : ''}$.`,
          `$2 \\times ${m.layers} \\times ${big(tokens)} \\times ${big(m.d)} \\times ${m.bytes}${batch > 1 ? ` \\times ${batch}` : ''} = ${big(total)}$ bytes.`,
          `A megabyte is a million bytes, so that is $${big(v)}$ MB.`,
        ],
      };
    },
  },
  {
    id: 'fit',
    make(rng, d) {
      for (;;) {
        const m = model(rng, d);
        const per = 2 * m.layers * m.d * m.bytes;
        const free = d < 0.35 ? pick(rng, [1, 2, 4]) : pick(rng, [2, 4, 8, 10, 16, 20, 40]);
        const n = (free * 1e9) / per;
        if (!Number.isInteger(n) || n < 100) continue;
        return {
          prompt: `A model has ${m.layers} layers and width $d = ${big(m.d)}$, and its KV cache stores each number in ${bytesWord(m.bytes)}. After loading the weights, ${free} GB of memory is left for the cache. How many tokens' worth of cache fit, across all sequences?`,
          answer: { kind: 'number', value: n },
          traps: traps(n, [
            { value: n * 2, why: m.bytes === 2 ? 'That is twice too many: either one vector per token per layer, where the cache keeps a key and a value, or one byte per number instead of 2.' : 'That gives each token one vector per layer. The cache keeps two: a key and a value.' },
            { value: n * m.bytes, why: `That counts each number as one byte. Each takes ${bytesWord(m.bytes)}.` },
            { value: n * m.layers, why: `That is one layer's cache per token. Every one of the ${m.layers} layers keeps its own.` },
          ]),
          solution: [
            `One token costs $2 \\times ${m.layers} \\times ${big(m.d)} \\times ${m.bytes} = ${big(per)}$ bytes: a key and a value of $d$ numbers at every layer.`,
            `A gigabyte is a billion bytes, so ${free} GB is $${big(free * 1e9)}$ bytes.`,
            `Divide the free bytes by the bytes per token: $${big(free * 1e9)} / ${big(per)} = ${big(n)}$ tokens, shared by every sequence.`,
          ],
        };
      }
    },
  },
  {
    id: 'grow',
    make(rng, d) {
      const M = pick(rng, [0.5, 1, 2, 4]);
      const T = pick(rng, [1000, 2000, 4000, 8000]);
      const f = d < 0.35 ? 1 : pick(rng, [0.5, 2, 4]);
      const B = d < 0.35 ? pick(rng, [2, 4, 8]) : pick(rng, [2, 4, 8, 16, 32]);
      const T2 = T * f;
      const v = clean(M * B * f);
      const what = f === 1 ? `${B} sequences of ${commas(T)} tokens each` : `${B} sequences of ${commas(T2)} tokens each`;
      return {
        prompt: `One sequence of ${commas(T)} tokens needs ${num(M)} GB of KV cache. How many GB does the same model need for ${what}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: M * f, why: `That is one sequence. Each of the ${B} keeps a cache of its own.` },
          { value: M * B, why: `That keeps the old length. The cache grows with the tokens too: ${commas(T2)} is ${num(f)} times ${commas(T)}.` },
          { value: M + B * f, why: 'That adds the factors. The cache scales by them: multiply.' },
          { value: M * B * f * f, why: 'That grows with the square of the length. The cache keeps one key and one value per token, so it grows in proportion.' },
        ]),
        solution: [
          'The cache is proportional to the tokens per sequence and to the number of sequences.',
          f === 1 ? `Same length, ${B} sequences: $${num(M)} \\times ${B} = ${num(v)}$ GB.` : `Length ${num(f)} times as long, ${B} sequences: $${num(M)} \\times ${num(f)} \\times ${B} = ${num(v)}$ GB.`,
        ],
      };
    },
  },
  {
    id: 'unchanged',
    make(rng) {
      const layers = pick(rng, [12, 24, 32, 40]);
      const width = pick(rng, [2000, 4000, 5000, 8000]);
      const vocab = pick(rng, [32000, 50000, 100000]);
      const right = pick(rng, [
        { text: 'Doubling the vocabulary size', why: null },
        { text: 'Doubling the width of the MLP inside each block', why: null },
        { text: 'Splitting attention into twice as many heads, each half as wide', why: null },
      ]);
      const wrong = rng
        .shuffle([
          { text: 'Doubling the number of layers', why: 'Every layer keeps its own keys and values, so twice the layers is twice the cache.' },
          { text: 'Doubling the context length', why: 'The cache keeps a key and a value for every token, so twice the tokens is twice the cache.' },
          { text: 'Serving twice as many sequences at once', why: 'Each sequence keeps a cache of its own, so twice the sequences is twice the cache.' },
          { text: 'Storing each number in 4 bytes instead of 2', why: 'The cache is counted in bytes, so twice the bytes per number is twice the cache.' },
          { text: 'Doubling the model width d', why: 'Each key and each value has d numbers, so twice d is twice the cache.' },
        ])
        .slice(0, 3);
      return {
        prompt: `A model has ${layers} layers, width $d = ${big(width)}$ and a vocabulary of ${commas(vocab)} tokens. Which change leaves the size of its KV cache the same?`,
        answer: choice([right, ...wrong]),
        solution: [
          `The cache holds $${FORMULA}$, times the number of sequences.`,
          right.text.startsWith('Doubling the vocabulary')
            ? 'The vocabulary sets the size of the embedding and the output scores. It is not in the formula: no key or value depends on it.'
            : right.text.startsWith('Doubling the width of the MLP')
              ? 'The MLP makes no keys or values. Only attention does, and its keys and values stay $d$ numbers wide.'
              : 'The heads split the $d$ numbers of each key and value between them. More, narrower heads still store $d$ numbers per token per layer.',
          'Every factor in the formula changes the cache in proportion; anything outside it leaves the cache alone.',
        ],
      };
    },
  },
];
