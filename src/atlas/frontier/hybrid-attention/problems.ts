import type { Generator } from '../../../mastery/domain/types';
import { choice } from '../../inference/kit';
import { big, clean, commas, num, pick, round, traps } from '../../kit';

/** r recurrent layers to each attention layer, with layer counts that the groups divide. */
const LAYOUTS: { L: number; r: number }[] = [
  { L: 24, r: 1 }, { L: 24, r: 3 }, { L: 24, r: 5 }, { L: 32, r: 1 }, { L: 32, r: 3 }, { L: 32, r: 7 },
  { L: 48, r: 1 }, { L: 48, r: 3 }, { L: 48, r: 5 }, { L: 48, r: 7 }, { L: 64, r: 3 }, { L: 64, r: 7 },
];

const layout = (L: number, r: number) => `${L} layers, in groups of ${r} Gated DeltaNet layer${r === 1 ? '' : 's'} and then one full attention layer`;

export const generators: Generator[] = [
  {
    id: 'cache',
    make(rng, d) {
      for (;;) {
        const { L, r } = pick(rng, d < 0.35 ? LAYOUTS.filter((l) => l.r === 3) : LAYOUTS);
        const a = L / (r + 1);
        const dm = pick(rng, [2000, 4000, 8000]);
        const T = pick(rng, [10_000, 32_000, 100_000, 128_000, 250_000]);
        const gb = (layers: number) => clean((2 * layers * T * dm * 2) / 1e9);
        const v = gb(a);
        if (v !== round(v, 2)) continue;
        return {
          prompt: `A hybrid model has ${layout(L, r)}. Its width is $\\sym{d}{d} = ${big(dm)}$ and it stores each number in 2 bytes. How many GB does its KV cache take at ${commas(T)} tokens of context?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: gb(L), why: `That gives every layer a cache, as a transformer has. Only the ${a} attention layers keep one; the Gated DeltaNet layers keep fixed states.` },
            { value: gb(L - a), why: `That counts the Gated DeltaNet layers. They keep fixed states; the cache belongs to the ${a} attention layers.` },
            { value: clean(v / 2), why: 'That is half the cache: count both a key and a value per token, at 2 bytes per number.' },
            { value: clean(v * 2), why: 'That doubles it once too often. The factors are 2 for a key and a value, and 2 bytes per number.' },
          ]),
          solution: [
            `${L} layers in groups of ${r + 1}, one attention layer per group: $${L} / ${r + 1} = ${a}$ attention layers keep a cache.`,
            `Each keeps a key and a value of $${big(dm)}$ numbers per token: $2 \\times ${a} \\times ${big(T)} \\times ${big(dm)} \\times 2 = ${big(round(v * 1e9, 0))}$ bytes.`,
            `A GB is a billion bytes: $${num(v)}$ GB.`,
          ],
        };
      }
    },
  },
  {
    id: 'share',
    make(rng, d) {
      const r = d < 0.35 ? pick(rng, [1, 3]) : pick(rng, [1, 3, 4, 7, 9]);
      const L = (r + 1) * pick(rng, [4, 6, 8, 12]);
      const askSaved = d >= 0.35 && rng.int(2) === 0;
      const kept = clean(100 / (r + 1));
      const v = askSaved ? clean(100 - kept) : kept;
      return {
        prompt: `A hybrid model has ${layout(L, r)}. A transformer of the same width and depth makes every layer attention. ${askSaved ? 'By what percent is the hybrid\'s KV cache smaller' : 'What percent of the transformer\'s KV cache size is the hybrid\'s'}, at any length?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: askSaved ? kept : clean(100 - kept), why: askSaved ? `That is the share kept: ${num(kept)} percent. The question asks how much smaller, which is the rest.` : `That is how much smaller it is. The hybrid keeps the rest: ${num(kept)} percent.` },
          { value: round((100 * r) / L, 2), why: 'That divides by the layer count. Every group of layers has one attention layer, so the share is one in the group\'s size.' },
          { value: round(100 / r, 2), why: `That divides by the Gated DeltaNet layers alone. Each group has ${r + 1} layers: ${r} of them and one attention layer.` },
        ]),
        solution: [
          `Each group of ${r + 1} layers has one attention layer, so ${L / (r + 1)} of the ${L} layers keep a cache.`,
          `Every cache is the same size as a transformer's at that layer, so the hybrid keeps $1 / ${r + 1} = ${num(kept)}$ percent of it${askSaved ? `, and is $${num(v)}$ percent smaller` : ''}.`,
        ],
      };
    },
  },
  {
    id: 'even',
    make(rng, d) {
      for (;;) {
        const { L, r } = pick(rng, d < 0.35 ? LAYOUTS.filter((l) => l.r === 3) : LAYOUTS);
        const a = L / (r + 1);
        const g = L - a;
        const dm = pick(rng, [2000, 4000, 8000]);
        const N = pick(rng, [250_000, 500_000, 1_000_000, 2_000_000]);
        const T = (g * N) / (a * 2 * dm);
        if (!Number.isInteger(T)) continue;
        return {
          prompt: `A hybrid model has ${layout(L, r)}, and width $\\sym{d}{d} = ${big(dm)}$. Each Gated DeltaNet layer keeps a state of ${commas(N)} numbers. At how many tokens of context does the KV cache hold as many numbers as all the states together?`,
          answer: { kind: 'number', value: T },
          traps: traps(T, [
            { value: T * 2, why: 'That counts one vector per token per layer. The cache keeps two: a key and a value.' },
            { value: N / (2 * dm), why: 'That compares one layer of each. There are more Gated DeltaNet layers than attention layers, so count all of each.' },
            { value: (L * N) / (a * 2 * dm), why: `That gives every layer a state. Only the ${g} Gated DeltaNet layers keep one.` },
            { value: (g * N) / (L * 2 * dm), why: `That gives every layer a cache. Only the ${a} attention layers keep one.` },
          ]),
          solution: [
            `The states: $${g} \\times ${big(N)} = ${big(g * N)}$ numbers, at any length.`,
            `Per token, the cache adds a key and a value in each of ${a} attention layers: $2 \\times ${a} \\times ${big(dm)} = ${big(2 * a * dm)}$ numbers.`,
            `$${big(g * N)} / ${big(2 * a * dm)} = ${big(T)}$ tokens. Past that, the cache is the bigger, and it keeps growing.`,
          ],
        };
      }
    },
  },
  {
    id: 'apart',
    make(rng) {
      const dk = pick(rng, [32, 64, 128, 256]);
      const dv = pick(rng, [64, 128, 256].filter((x) => x !== dk));
      const T = pick(rng, [4000, 32_000, 100_000]);
      return {
        prompt: `One Gated DeltaNet head has keys of $\\sym{dk}{d_k} = ${dk}$ numbers and values of ${dv} numbers, so its state holds $${dk} \\times ${dv}$ numbers. It has read ${commas(T)} tokens. At most how many key-value pairs can it hold perfectly apart, each read back with no trace of the others?`,
        answer: { kind: 'number', value: dk },
        traps: traps(dk, [
          { value: dv, why: 'That counts by the values. Pairs stay apart when their keys are at right angles, and keys of $d_k$ numbers have room for $d_k$ such directions.' },
          { value: dk * dv, why: 'That is how many numbers the state holds. Each pair needs a whole key direction to itself.' },
          { value: T, why: `That is one pair per token. A fixed state cannot keep ${commas(T)} pairs apart: past $d_k$ keys, some must overlap.` },
        ]),
        solution: [
          'A read at a key picks up every stored pair whose key has a nonzero dot product with it, so pairs stay apart only when their keys are at right angles.',
          `Keys of ${dk} numbers have room for at most ${dk} directions all at right angles to each other.`,
          `So at most ${dk} pairs, however many tokens were read.`,
        ],
      };
    },
  },
  {
    id: 'grow',
    make(rng) {
      const T1 = pick(rng, [8000, 16_000, 32_000, 64_000]);
      const f = pick(rng, [2, 3, 4, 8]);
      const r = pick(rng, [1, 3, 7]);
      return {
        prompt: `A hybrid model with ${r} Gated DeltaNet layer${r === 1 ? '' : 's'} to each full attention layer is writing. Its context grows from ${commas(T1)} to ${commas(T1 * f)} tokens. What happens to its KV cache and to its Gated DeltaNet states?`,
        answer: choice([
          { text: `The cache grows ${f} times; the states stay the same size`, why: null },
          { text: `The cache grows ${f} times, and so do the states`, why: 'A Gated DeltaNet state is a fixed matrix per head, rewritten in place at every token: it never grows.' },
          { text: `The cache grows ${f * f} times; the states stay the same size`, why: `The cache keeps one key and one value per token in each attention layer, so it grows in proportion to the tokens: ${f} times, not ${f} squared.` },
          { text: 'Neither grows: the Gated DeltaNet layers keep the cache from growing', why: 'The hybrid\'s attention layers keep a key and a value for every token, so its cache grows with the context.' },
        ]),
        solution: [
          'The attention layers keep a key and a value for every token, so the cache grows in proportion to the tokens.',
          `So ${f} times the tokens is ${f} times the cache, which stays ${r === 1 ? 'half' : `$1/${r + 1}$ of`} a transformer's at every length.`,
          'Each Gated DeltaNet layer keeps a fixed-size state, rewritten in place: it stays the same.',
        ],
      };
    },
  },
];
