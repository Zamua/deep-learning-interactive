import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { big, D, mat, SENTENCES, tenth, traps, vecT, vtraps } from '../kit';

const P = '\\sym{P}{P}';
const TMAX = '\\sym{Tmax}{T_{\\max}}';
const sent = (ws: readonly string[]) => ws.map((w) => `\`${w}\``).join(' ');

/** `n` distinct integers in [lo, hi]. */
function distinct(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    if (new Set(xs).size === n) return xs;
  }
}

/** A table of `m` rows, no two equal. */
function table(rng: Rng, m: number, n: number, lo: number, hi: number): number[][] {
  for (;;) {
    const t = Array.from({ length: m }, () => Array.from({ length: n }, () => int(rng, lo, hi)));
    if (new Set(t.map(String)).size === m) return t;
  }
}

const PAIRS: [string, string, string][] = [
  ['dog', 'bites', 'man'],
  ['cat', 'chases', 'mouse'],
  ['Ann', 'pays', 'Bob'],
  ['fox', 'sees', 'hen'],
  ['team', 'beats', 'rival'],
  ['bird', 'follows', 'boat'],
  ['kid', 'calls', 'mom'],
  ['owl', 'hunts', 'mole'],
];

export const generators: Generator[] = [
  {
    id: 'swap',
    make(rng, d) {
      const n = d < 0.35 ? 3 : 4;
      const ws = pick(rng, SENTENCES).slice(0, n);
      let y = distinct(rng, n, -3, 5);
      while (d >= 0.6) {
        y = Array.from({ length: n }, () => tenth(rng, -2, 2));
        if (new Set(y).size === n) break;
      }
      let perm: number[];
      for (;;) {
        perm = n === 3 ? pick(rng, [[2, 1, 0], [1, 0, 2], [0, 2, 1]]) : rng.shuffle([0, 1, 2, 3]);
        if (perm.some((p, i) => p !== i)) break;
      }
      const shuffled = perm.map((p) => ws[p]!);
      const out = perm.map((p) => y[p]!);
      const inv = perm.map((_, i) => y[perm.indexOf(i)]!);
      return {
        prompt: `A self-attention layer with no position information reads ${sent(ws)}. The first feature of its outputs, one number per token in order, is $${vecT(y)}$. The same layer now reads ${sent(shuffled)}. What is the first feature of its outputs, in order?`,
        answer: { kind: 'vector', value: out },
        traps: vtraps(out, [
          { value: y, why: 'That keeps the old order. Each output belongs to its token, so the outputs move with the tokens.' },
          { value: inv, why: 'That moves the outputs the opposite way. Read the new sentence word by word and give each word its old output.' },
        ]),
        solution: [
          'Without positions, each token\'s scores, weights and output depend only on which tokens are present, not where they sit.',
          `So every token keeps its output: ${shuffled.map((w, i) => `\`${w}\` gives $${num(out[i]!)}$`).join(', ')}.`,
          `In the new order: $${vecT(out)}$.`,
        ],
      };
    },
  },
  {
    id: 'table',
    make(rng, d) {
      const tmax = d < 0.35 ? pick(rng, [8, 10, 16, 20, 32]) : pick(rng, [128, 256, 512, 1024, 2048]);
      const dm = d < 0.35 ? pick(rng, [2, 3, 4, 6, 8]) : pick(rng, [64, 128, 256, 512, 768]);
      const v = tmax * dm;
      if (d >= 0.7 && rng.int(2) === 0) {
        return {
          prompt: `A model learns one position vector of $${D} = ${dm}$ numbers for each position it can handle. Its position table $${P}$ holds $${big(v)}$ numbers. What is the longest input it can take, $${TMAX}$?`,
          answer: { kind: 'number', value: tmax },
          traps: traps(tmax, [{ value: v - dm, why: `That subtracts. The table is $${TMAX}$ rows of $${D}$ numbers: divide by $${D}$.` }]),
          solution: [`$${P}$ has one row per position: shape $(${TMAX}, ${D})$, so it holds $${TMAX} \\times ${D}$ numbers.`, `$${TMAX} = ${big(v)} / ${dm} = ${big(tmax)}$ positions.`],
        };
      }
      return {
        prompt: `A model learns one position vector for every position up to $${TMAX} = ${big(tmax)}$, each of $${D} = ${dm}$ numbers, the width of its token embeddings. How many numbers does its position table $${P}$ hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: tmax + dm, why: `That adds. $${P}$ has $${TMAX}$ rows of $${D}$ numbers each: multiply.` },
          { value: tmax, why: `That is one number per position. Each position gets a whole vector of $${D} = ${dm}$ numbers.` },
        ]),
        solution: [`$${P}$ has one row per position and one column per feature: shape $(${big(tmax)}, ${dm})$.`, `$${big(tmax)} \\times ${dm} = ${big(v)}$ numbers.`],
      };
    },
  },
  {
    id: 'add',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      if (d < 0.35) {
        const e = Array.from({ length: n }, () => int(rng, 0, 4));
        const p = Array.from({ length: n }, () => int(rng, -2, 2));
        const pos = int(rng, 0, 5);
        const ws = pick(rng, SENTENCES);
        const w = ws[int(rng, 0, 3)]!;
        const v = e.map((x, i) => x + p[i]!);
        return {
          prompt: `The token \`${w}\` has embedding $${vecT(e)}$. It sits at position ${pos}, whose position vector is $${vecT(p)}$. What vector goes into the first layer for it?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            { value: e, why: 'That is the embedding alone. Without the position vector, attention cannot tell where the token is.' },
            { value: e.map((x, i) => x * p[i]!), why: 'That multiplies entry by entry. The position vector is added.' },
          ]),
          solution: [`Add the position vector to the embedding, entry by entry: $${vecT(e)} + ${vecT(p)} = ${vecT(v)}$.`],
        };
      }
      const ws = pick(rng, SENTENCES).slice(0, 3);
      const E = table(rng, 3, n, d < 0.7 ? 0 : -2, 4);
      const Pt = table(rng, 3, n, -2, 2);
      for (;;) {
        const order = rng.shuffle([0, 1, 2]);
        const pos = rng.int(3);
        const id = order[pos]!;
        if (id === pos) continue;
        const v = E[id]!.map((x, i) => x + Pt[pos]![i]!);
        const words = order.map((o) => ws[o]!);
        return {
          prompt: `The vocabulary is ${ws.map((w, i) => `\`${w}\` $= ${i}$`).join(', ')}, with embedding table $E$ and position table $${P}$ (row $i$ for position $i$, counting from 0):\n\n$$E = ${mat(E)},\\qquad ${P} = ${mat(Pt)}$$\n\nThe input is ${sent(words)}. What vector goes into the first layer for \`${ws[id]}\`?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            { value: E[id]!, why: `That is \`${ws[id]}\`'s embedding alone. Add the vector for its position, ${pos}.` },
            { value: E[pos]!.map((x, i) => x + Pt[id]![i]!), why: `That swaps the two indices. \`${ws[id]}\` has id ${id}, so row ${id} of $E$; it sits at position ${pos}, so row ${pos} of $${P}$.` },
            { value: E[id]!.map((x, i) => x + Pt[id]![i]!), why: `That uses row ${id} of $${P}$, the token's id. $${P}$ is indexed by position: \`${ws[id]}\` is at position ${pos}.` },
          ]),
          solution: [
            `\`${ws[id]}\` has id ${id}: row ${id} of $E$ is $${vecT(E[id]!)}$.`,
            `It is at position ${pos}: row ${pos} of $${P}$ is $${vecT(Pt[pos]!)}$.`,
            `Add them: $${vecT(v)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'order',
    make(rng) {
      const [a, verb, b] = pick(rng, PAIRS);
      const flip = rng.int(2) === 0;
      const s1 = flip ? [b, verb, a] : [a, verb, b];
      const s2 = flip ? [a, verb, b] : [b, verb, a];
      return {
        prompt: `A self-attention layer with no position information reads ${sent(s1)}, and then ${sent(s2)}. What happens to its output for \`${verb}\`?`,
        answer: {
          kind: 'choice',
          options: [
            'It is exactly the same both times',
            'It changes, since the words on either side of it changed',
            'It changes, since attention reads the tokens left to right',
            'It is the same only if the two sentences mean the same',
          ],
          correct: 0,
          why: [
            null,
            `The same three tokens are present both times, and nothing in a score says where a token sits. \`${verb}\` scores the same keys and mixes the same values.`,
            'Attention takes in every token at once; nothing in it follows the order.',
            'Attention never sees meaning, only the tokens present. Here the sentences mean opposite things and still look the same.',
          ],
        },
        solution: [
          `Both sentences hold the same tokens: \`${a}\`, \`${verb}\` and \`${b}\`. \`${verb}\`'s query meets the same keys and mixes the same values.`,
          'So its output is identical: without position vectors, attention sees a set of tokens, not a sequence.',
        ],
      };
    },
  },
];
