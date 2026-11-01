import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { choice } from '../../inference/kit';
import { big, clean, commas, dot, mat, num, par, pick, sum, traps, vec, vtraps } from '../../kit';
import { add, CORNER, outer, pair, read, readTex, type Mat, type Vec } from '../kit';

/** The state after the given tokens: the sum of their tables v kᵀ. */
const fold = (ks: Vec[], vs: Vec[]): Mat => ks.reduce<Mat>((S, k, i) => add(S, outer(vs[i]!, k)), [[0, 0], [0, 0]]);

const transpose = (S: Mat): Mat => S[0]!.map((_, j) => S.map((row) => row[j]!));

/** Tokens with keys and values of two numbers: the two axes as keys at first, any small keys later. */
function tokens(rng: Rng, d: number) {
  const n = d < 0.35 ? 2 : d < 0.7 ? pick(rng, [2, 3]) : 3;
  const ks = d < 0.35 ? rng.shuffle([[1, 0], [0, 1]]) : Array.from({ length: n }, () => pair(rng, d < 0.7 ? 0 : -1, 2));
  const vs = Array.from({ length: n }, () => pair(rng, d < 0.7 ? 0 : -2, 4));
  return { n, ks, vs, S: fold(ks, vs) };
}

/** The tokens as prompts list them: `$k_1 = [1,\ 0]$ with $v_1 = [2,\ 3]$; ...`. */
const listTex = (ks: Vec[], vs: Vec[]) => ks.map((k, i) => `$\\sym{k}{k}_{${i + 1}} = ${vec(k)}$ with $\\sym{v}{v}_{${i + 1}} = ${vec(vs[i]!)}$`).join('; ');

export const generators: Generator[] = [
  {
    id: 'read',
    make(rng, d) {
      for (;;) {
        const { n, ks, vs, S } = tokens(rng, d);
        const q = d < 0.35 ? pair(rng, 1, 2) : pair(rng, -1, 2);
        const o = read(S, q);
        if (o.every((x) => x === 0)) continue;
        const scores = ks.map((k) => dot(k, q));
        return {
          prompt: `A linear attention head, with no softmax, has read ${n} tokens: ${listTex(ks, vs)}. Its state $\\sym{S}{S}$ started at zeros. What output $\\sym{o}{o}$ does the query $\\sym{q}{q} = ${vec(q)}$ read?`,
          answer: { kind: 'vector', value: o },
          traps: vtraps(o, [
            { value: vs[n - 1]!.map((x) => clean(scores[n - 1]! * x)), why: 'That is the last token alone. The state adds up every token\'s table, so every value is weighted in.' },
            { value: read(transpose(S), q), why: 'That builds each table as $\\sym{k}{k}\\sym{v}{v}^\\top$, so the query dots the values. The table is $\\sym{v}{v}\\sym{k}{k}^\\top$: the query dots each key, and that score weights its value.' },
            { value: [0, 1].map((j) => sum(vs.map((v) => v[j]!))), why: 'That adds the values with no weights. Each value is weighted by its key\'s dot product with $\\sym{q}{q}$.' },
            { value: q.map((x, j) => clean(x * sum(vs.map((v) => v[j]!)))), why: 'That multiplies the query into the values entry by entry. Each value is scaled by one number, its key dotted with $\\sym{q}{q}$.' },
          ]),
          solution: [
            `Each token adds its table $\\sym{v}{v}_i\\sym{k}{k}_i^\\top$, so the state is $\\sym{S}{S} = ${mat(S)}$.`,
            `$\\sym{o}{o} = \\sym{S}{S}\\sym{q}{q} = ${readTex(S, q)}$: each row of $\\sym{S}{S}$ dotted with $\\sym{q}{q}$.`,
            `The same as weighting each value by its key's score: $\\sum_i (\\sym{k}{k}_i \\cdot \\sym{q}{q})\\,\\sym{v}{v}_i = ${scores.map((s, i) => `${par(s)}\\,${vec(vs[i]!)}`).join(' + ')} = ${vec(o)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const { n, ks, vs, S } = tokens(rng, d);
      const i = rng.int(2);
      const j = rng.int(2);
      const val = S[i]![j]!;
      const last = n - 1;
      return {
        prompt: `Linear attention adds each token's table $\\sym{v}{v}\\sym{k}{k}^\\top$ to its state $\\sym{S}{S}$, which starts at zeros. After ${listTex(ks, vs)}, what is the ${CORNER[i]![j]} entry of $\\sym{S}{S}$?`,
        answer: { kind: 'number', value: val },
        traps: traps(val, [
          ...(i !== j ? [{ value: S[j]![i]!, why: `That is the ${CORNER[j]![i]} entry: row and column swapped. A table's row comes from an entry of $\\sym{v}{v}$, its column from an entry of $\\sym{k}{k}$.` }] : []),
          { value: vs[last]![i]! * ks[last]![j]!, why: 'That is the last token\'s table alone. The state adds up every token\'s.' },
          { value: sum(vs.map((v) => v[i]!)) * sum(ks.map((k) => k[j]!)), why: 'That multiplies the sums. Each token\'s table is its own product of an entry of $\\sym{v}{v}$ and an entry of $\\sym{k}{k}$, and the tables are added after.' },
          { value: sum(vs.map((v, t) => v[i]! + ks[t]![j]!)), why: 'That adds the entries. A table multiplies them: every entry of $\\sym{v}{v}$ times every entry of $\\sym{k}{k}$.' },
        ]),
        solution: [
          `Row ${i + 1}, column ${j + 1} of a table $\\sym{v}{v}\\sym{k}{k}^\\top$ is entry ${i + 1} of $\\sym{v}{v}$ times entry ${j + 1} of $\\sym{k}{k}$.`,
          `Token by token: ${vs.map((v, t) => `$${par(v[i]!)} \\times ${par(ks[t]![j]!)} = ${num(clean(v[i]! * ks[t]![j]!))}$`).join(', ')}.`,
          `Added up: $${num(val)}$. The whole state is $\\sym{S}{S} = ${mat(S)}$.`,
        ],
      };
    },
  },
  {
    id: 'size',
    make(rng, d) {
      const dh = pick(rng, [32, 64, 128, 256]);
      const dTex = `$\\sym{dhead}{d_{\\text{head}}} = ${dh}$`;
      const kind = d < 0.35 ? 0 : d < 0.7 ? rng.int(3) : 1 + rng.int(3);
      if (kind === 0) {
        const T = pick(rng, [1000, 4000, 8000, 32_000]);
        const v = dh * dh;
        return {
          prompt: `A linear attention head has queries, keys and values of ${dTex} numbers each. How many numbers does its state $\\sym{S}{S}$ hold after ${commas(T)} tokens?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: dh, why: 'That is one key. The state is a table with a row for each entry of a value and a column for each entry of a key.' },
            { value: 2 * dh, why: 'That is one token\'s key and value, what a softmax cache adds per token. The state is their table, $d_{\\text{head}}$ by $d_{\\text{head}}$.' },
            { value: 2 * T * dh, why: `That is softmax attention's cache after ${commas(T)} tokens. Linear attention adds each token's table into one state instead.` },
            { value: v * T, why: `That keeps a table per token. The tables are added into one state, the same size at ${commas(T)} tokens as at one.` },
          ]),
          solution: [
            'The state is a sum of tables $\\sym{v}{v}\\sym{k}{k}^\\top$: one row per entry of a value, one column per entry of a key.',
            `So it is $${dh} \\times ${dh} = ${big(v)}$ numbers, whatever the number of tokens.`,
          ],
        };
      }
      if (kind === 1) {
        const L = pick(rng, [12, 24, 32, 48]);
        const h = pick(rng, [8, 16, 32]);
        const v = L * h * dh * dh;
        return {
          prompt: `A model has ${L} layers of linear attention, each with ${h} heads whose queries, keys and values have ${dTex} numbers. Each head keeps its own state. How many numbers do all the states hold together?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: h * dh * dh, why: `That is one layer. Each of the ${L} layers keeps its own states.` },
            { value: L * dh * dh, why: `That is one head per layer. Each of the ${h} heads keeps its own state.` },
            { value: L * h * dh, why: `That counts one key per head. Each state is a table, ${dh} by ${dh}.` },
            { value: L * h * 2 * dh, why: 'That counts one key and one value per head. Each head keeps their table, $d_{\\text{head}}$ by $d_{\\text{head}}$.' },
          ]),
          solution: [
            `One head's state is $${dh} \\times ${dh} = ${big(dh * dh)}$ numbers.`,
            `There are $${L} \\times ${h} = ${L * h}$ heads in all: $${L * h} \\times ${big(dh * dh)} = ${big(v)}$ numbers, at any length.`,
          ],
        };
      }
      const given = `For one head with ${dTex}, softmax attention caches a key and a value per token, and linear attention keeps a $${dh}$ by $${dh}$ state.`;
      if (kind === 2) {
        const m = pick(rng, [2, 4, 10, 25, 50, 100, 125, 250]);
        const T = (m * dh) / 2;
        return {
          prompt: `${given} At ${commas(T)} tokens, how many times as many numbers does the cache hold as the state?`,
          answer: { kind: 'number', value: m },
          traps: traps(m, [
            { value: T / dh, why: 'That counts only the keys. The cache keeps a key and a value for every token.' },
            { value: dh / (2 * T), why: 'That is the state over the cache, upside down.' },
            { value: 2 * T * dh, why: 'That is the cache\'s count of numbers. Divide it by the state\'s.' },
            { value: 2 * T, why: `That divides the cache by ${dh} only once. The state is ${dh} by ${dh}: $${big(dh * dh)}$ numbers.` },
          ]),
          solution: [
            `The cache: $2 \\times ${big(T)} \\times ${dh} = ${big(2 * T * dh)}$ numbers.`,
            `The state: $${dh} \\times ${dh} = ${big(dh * dh)}$ numbers.`,
            `$${big(2 * T * dh)} / ${big(dh * dh)} = ${m}$, and the cache keeps growing while the state does not.`,
          ],
        };
      }
      const v = dh / 2;
      return {
        prompt: `${given} At how many tokens does the cache hold exactly as many numbers as the state?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: dh, why: 'That counts only the keys. Each token adds a key and a value to the cache.' },
          { value: 2 * dh, why: 'That multiplies by 2 instead of dividing. Each token adds 2 vectors, so fewer tokens fill the state\'s size.' },
          { value: dh * dh, why: 'That is the state\'s count of numbers. Divide it by what each token adds to the cache.' },
        ]),
        solution: [
          `The state holds $${dh} \\times ${dh} = ${big(dh * dh)}$ numbers.`,
          `Each token adds a key and a value to the cache: $2 \\times ${dh} = ${2 * dh}$ numbers.`,
          `$${big(dh * dh)} / ${2 * dh} = ${num(v)}$ tokens. Past that, the cache is the bigger one.`,
        ],
      };
    },
  },
  {
    id: 'grow',
    make(rng, d) {
      if (d < 0.5 || rng.int(2) === 0) {
        const T1 = pick(rng, [1000, 2000, 4000, 8000]);
        const f = pick(rng, [2, 3, 4, 10]);
        return {
          prompt: `A transformer and a linear attention model, alike in every other way, are writing text. Their context grows from ${commas(T1)} to ${commas(T1 * f)} tokens. What happens to the memory each keeps, and to the work for each new token?`,
          answer: choice([
            { text: `The transformer's cache and work per token grow ${f} times; the linear model's state and work stay the same`, why: null },
            { text: `Both models' memory and work per token grow ${f} times`, why: 'Linear attention folds each token into a state of fixed size, and each new token adds one table and reads once, whatever the length.' },
            { text: `The transformer's grow ${f * f} times; the linear model's stay the same`, why: `Per new token, attention scores each cached key once, so ${f} times the tokens is ${f} times the work. ${f * f} times is how the whole text's grid of scores grows.` },
            { text: `The linear model's grow ${f} times; the transformer's stay the same`, why: 'That swaps them. The cache keeps a key and a value for every token; the linear model\'s state is a fixed-size sum of tables.' },
          ]),
          solution: [
            'The transformer\'s cache keeps a key and a value per token, and each new query scores every cached key: both grow in proportion to the tokens.',
            `So ${f} times the tokens is ${f} times the cache and ${f} times the work per token.`,
            'Linear attention adds each token\'s table into one state and reads it once with $\\sym{S}{S}\\sym{q}{q}$: the same size and the same work at any length.',
          ],
        };
      }
      const T = pick(rng, [2000, 4000, 8000, 100_000]);
      const dk = pick(rng, [64, 128]);
      return {
        prompt: `To serve later queries, softmax attention keeps all ${commas(T)} keys and values, while linear attention keeps one ${dk} by ${dk} state. What lets linear attention fold the tokens away?`,
        answer: choice([
          { text: 'With no exponential, $(\\sym{k}{k} \\cdot \\sym{q}{q})\\,\\sym{v}{v} = (\\sym{v}{v}\\sym{k}{k}^\\top)\\,\\sym{q}{q}$, so the tables add up before any query comes', why: null },
          { text: 'It keeps only the most recent token\'s key and value', why: 'It keeps every token: the state is the sum of all their tables $\\sym{v}{v}\\sym{k}{k}^\\top$, and one read covers them all.' },
          { text: 'Its keys and values are shorter than softmax attention\'s', why: `The lengths can be the same. What matters is that a plain dot product lets each key and value become a ${dk} by ${dk} table before the query is known.` },
          { text: 'It scores each query against a random sample of the keys', why: 'Nothing is sampled: $\\sym{S}{S}\\sym{q}{q}$ equals the full sum $\\sum_i (\\sym{k}{k}_i \\cdot \\sym{q}{q})\\,\\sym{v}{v}_i$ over every token.' },
        ]),
        solution: [
          'Softmax weights each value by $e^{\\sym{q}{q} \\cdot \\sym{k}{k}}$ over a total, which needs the query before any term is added.',
          'Without it, each term $(\\sym{k}{k}_i \\cdot \\sym{q}{q})\\,\\sym{v}{v}_i$ is the table $\\sym{v}{v}_i\\sym{k}{k}_i^\\top$ times $\\sym{q}{q}$.',
          `So the tables can be added into one state as tokens arrive, ${dk} by ${dk} however many there are, and $\\sym{S}{S}\\sym{q}{q}$ reads them all.`,
        ],
      };
    },
  },
];
