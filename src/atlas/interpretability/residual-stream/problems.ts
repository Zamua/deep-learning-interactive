import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, pick, vec } from '../../kit';
import { D, add, big, clean, straps, vtraps, whys } from '../kit';

const small = (rng: Rng, n: number, d: number) => Array.from({ length: n }, () => (d < 0.4 ? int(rng, -1, 2) : int(rng, -3, 3)));
const sumAll = (vs: number[][]) => vs.reduce((a, v) => add(a, v));
const sub = (a: number[], b: number[]) => a.map((x, i) => clean(x - b[i]!));

/** Each write named by its block and part: block 0's attention, block 0's MLP, ... */
const NAMES = (k: number) => Array.from({ length: k }, (_, i) => `block ${Math.floor(i / 2)}'s ${i % 2 ? 'MLP' : 'attention'}`);

export const generators: Generator[] = [
  {
    id: 'sum',
    make(rng, d) {
      const wide = d >= 0.4 && rng.next() < 0.5;
      const n = d < 0.4 || !wide ? 2 : 3;
      const k = d < 0.4 || wide ? 2 : 4;
      const x0 = small(rng, n, d);
      const writes = Array.from({ length: k }, () => small(rng, n, d));
      const names = NAMES(k);
      const ans = sumAll([x0, ...writes]);
      const last = k / 2 - 1;
      return {
        prompt: `A token's residual stream starts as its embedding $\\symx_0 = ${vec(x0)}$. Then ${names.map((nm, i) => `${nm} writes $${vec(writes[i]!)}$`).join(', ')}. What is the stream after block ${last}?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, [
          { value: writes[k - 1]!, why: 'That is only the last write. Each part adds its output to the stream instead of replacing it.' },
          { value: sumAll(writes), why: 'That leaves out $\\symx_0$, the embedding the stream starts from.' },
          { value: add(x0, writes[k - 1]!), why: 'That is $\\symx_0$ plus the last write alone. Every earlier write stays in the stream too.' },
        ]),
        solution: [
          'Every attention and every MLP adds its output to the stream, so the stream is $\\symx_0$ plus every write so far.',
          `$${[x0, ...writes].map((v) => vec(v)).join(' + ')} = ${vec(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'missing',
    make(rng, d) {
      const n = d < 0.4 ? 2 : 3;
      const before = small(rng, n, d);
      const blk = int(rng, 1, 9);
      const both = d >= 0.5;
      const att = small(rng, n, d);
      const mlp = small(rng, n, d);
      const after = both ? sumAll([before, att, mlp]) : add(before, mlp);
      const ans = both ? mlp : sub(after, before);
      return {
        prompt: both
          ? `Before block ${blk}, a token's stream is $${vec(before)}$. Block ${blk}'s attention writes $${vec(att)}$, and after the whole block the stream is $${vec(after)}$. What did block ${blk}'s MLP write?`
          : `Before block ${blk}, a token's stream is $${vec(before)}$; after it, $${vec(after)}$. What did block ${blk} add to the stream?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, [
          { value: after, why: 'That is the new stream. A block adds its write to the old stream, so the write is the difference.' },
          { value: sub(before, after), why: 'That subtracts the wrong way round: the write is after minus before.' },
          ...(both ? [{ value: sub(after, before), why: 'That is everything the block wrote, attention and MLP together. Take away the attention\'s part.' }] : []),
        ]),
        solution: both
          ? [`The block adds both writes: $\\text{after} = \\text{before} + \\text{attention} + \\text{MLP}$.`, `So the MLP wrote $${vec(after)} - ${vec(before)} - ${vec(att)} = ${vec(ans)}$.`]
          : [`The block adds its write to the stream: $\\text{after} = \\text{before} + \\text{write}$.`, `So the write is $${vec(after)} - ${vec(before)} = ${vec(ans)}$.`],
      };
    },
  },
  {
    id: 'width',
    make(rng) {
      const dim = pick(rng, [128, 256, 512, 768, 1024]);
      const L = pick(rng, [6, 12, 24]);
      const k = int(rng, 1, L - 1);
      const T = pick(rng, [5, 8, 10, 16, 20]);
      const ans = [T, dim];
      return {
        prompt: `A model with $${D} = ${big(dim)}$ has ${L} blocks, and each MLP widens a token to $4${D}$ inside. It reads ${T} tokens. What is the shape of the residual stream after block ${k}, as (tokens, numbers per token)?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          { value: [T, dim * (k + 1)], why: `That grows the width with every block. Writes are added, not appended, so the width stays $${D}$.` },
          { value: [T, 4 * dim], why: `That is the MLP's inside width. It projects back to $${D}$ before adding to the stream.` },
          { value: [T * (k + 1), dim], why: 'Writes do not add rows: each token keeps one vector, and every write is added to it.' },
        ]),
        solution: [
          `Every write has the same width as the stream, $${D} = ${big(dim)}$, and is added to it.`,
          `So after any block, each of the ${T} tokens still has ${big(dim)} numbers: $(${T}, ${big(dim)})$.`,
        ],
      };
    },
  },
  {
    id: 'read-write',
    make(rng) {
      const L = pick(rng, [12, 24, 32, 48]);
      if (rng.next() < 0.5) {
        const b = int(rng, 1, L - 2);
        const part = pick(rng, ['attention', 'MLP']);
        const options = [
          'Reads the stream through a layer norm and adds its output back in',
          'Replaces the stream with its own output',
          'Reads only the token\'s embedding $\\symx_0$, then adds to the stream',
          'Writes to a separate vector that only the next block reads',
        ];
        const reasons = [
          '',
          'With the residual connection the output is added: $\\symx + \\text{out}$, so nothing earlier is lost.',
          'It reads the whole stream: $\\symx_0$ plus every write so far.',
          'There is one stream per token, and every later block reads all of it.',
        ];
        return {
          prompt: `In block ${b} of a ${L}-block model, what does the ${part} do with the residual stream?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: ['Each attention and each MLP reads a normalized copy of the stream and adds its output back in: $\\symx \\leftarrow \\symx + \\text{out}$.', 'Reading never changes the stream; only the additions do.'],
        };
      }
      const a = int(rng, 0, 4);
      const b = int(rng, a + 3, L - 1);
      const options = [
        `Yes: block ${a}'s write stays in the sum that every later block reads`,
        `No: block ${a + 1} replaces the stream with its own output`,
        `Only if blocks ${a + 1} to ${b - 1} each copy it forward`,
        `No: each block reads only what the block before it wrote`,
      ];
      const reasons = [
        '',
        `Block ${a + 1} adds to the stream; block ${a}'s write is still part of the sum.`,
        'Nothing needs copying: a write stays in the stream unless a later block writes the opposite.',
        'Every block reads the whole stream, which holds every earlier write.',
      ];
      return {
        prompt: `In a ${L}-block model, block ${a} writes a piece of information into a token's residual stream. Can block ${b} read it directly?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `The stream after block ${b - 1} is $\\symx_0$ plus every write from blocks 0 to ${b - 1}, block ${a}'s among them.`,
          `So block ${b} reads block ${a}'s write directly. The stream works like a shared scratchpad.`,
        ],
      };
    },
  },
];
