import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick, scale, vec } from '../../kit';
import { big, lit, times, traps, vtraps } from '../kit';

const ALPHABETS = [
  ['a', 'b', 'c', 'd', 'e'],
  ['h', 'u', 'g', 's', 'p'],
  ['l', 'o', 'w', 'e', 'r'],
  ['t', 'h', 'e', 'n', 'a'],
  ['c', 'a', 't', 's', 'o'],
  ['m', 'i', 'n', 'e', 'd'],
];
const SMALL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BYTE_IDS = [32, 97, 98, 99, 100, 101, 104, 108, 110, 111, 115, 116];

type Tok = string | number;
const key = (a: Tok, b: Tok) => `${a}|${b}`;

/** Every neighboring pair with its count, most frequent first (ties by first appearance). */
function pairCounts<T extends Tok>(t: readonly T[]): { a: T; b: T; n: number }[] {
  const m = new Map<string, { a: T; b: T; n: number }>();
  for (let i = 0; i + 1 < t.length; i++) {
    const k = key(t[i]!, t[i + 1]!);
    const e = m.get(k);
    if (e) e.n++;
    else m.set(k, { a: t[i]!, b: t[i + 1]!, n: 1 });
  }
  return [...m.values()].sort((x, y) => y.n - x.n);
}

const countOf = (t: readonly Tok[], a: Tok, b: Tok) => t.slice(0, -1).filter((x, i) => x === a && t[i + 1] === b).length;

/** The list with every (a, b), scanned left to right, replaced by `id`. */
function merge<T extends Tok>(t: readonly T[], a: T, b: T, id: T): T[] {
  const out: T[] = [];
  for (let i = 0; i < t.length; i++) {
    if (i + 1 < t.length && t[i] === a && t[i + 1] === b) {
      out.push(id);
      i++;
    } else out.push(t[i]!);
  }
  return out;
}

/** `n` tokens with no three equal in a row and a single most frequent pair, seen at least twice. */
function tokens<T extends Tok>(rng: Rng, n: number, alpha: readonly T[]): T[] {
  for (;;) {
    const t = Array.from({ length: n }, () => pick(rng, alpha));
    if (t.some((x, i) => i >= 2 && x === t[i - 1] && x === t[i - 2])) continue;
    const c = pairCounts(t);
    if (c[0]!.n >= 2 && c[0]!.n > (c[1]?.n ?? 0)) return t;
  }
}

const pairTex = (a: Tok, b: Tok) => `\`(${typeof a === 'string' ? `'${a}'` : a}, ${typeof b === 'string' ? `'${b}'` : b})\``;
const listTex = (t: readonly string[]) => `\`[${t.map((x) => `'${x}'`).join(', ')}]\``;
const positions = (t: readonly Tok[], a: Tok, b: Tok) => {
  const out: number[] = [];
  for (let i = 0; i + 1 < t.length; i++) {
    if (t[i] === a && t[i + 1] === b) {
      out.push(i);
      i++;
    }
  }
  return out;
};

export const generators: Generator[] = [
  {
    id: 'top-pair',
    make(rng, d) {
      const alpha = pick(rng, ALPHABETS).slice(0, d < 0.35 ? 3 : d < 0.7 ? 4 : 5);
      const t = tokens(rng, scale(d, 6, 11), alpha);
      const all = pairCounts(t);
      const top = all[0]!;
      const freq = alpha.map((x) => t.filter((y) => y === x).length);
      const common = alpha[freq.indexOf(Math.max(...freq))]!;
      const skips = pairCounts(t.filter((_, i) => i % 2 === 0)).concat(pairCounts(t.filter((_, i) => i % 2 === 1)));
      const cands: [string, string][] = [[top.b, top.a], ...all.slice(1, 3).map((p) => [p.a, p.b] as [string, string]), ...skips.map((p) => [p.a, p.b] as [string, string]), [common, common]];
      for (const a of alpha) for (const b of alpha) cands.push([a, b]);
      const picked: [string, string][] = [];
      for (const c of cands) {
        if (picked.length === 3) break;
        if (key(...c) === key(top.a, top.b) || picked.some((p) => key(...p) === key(...c))) continue;
        picked.push(c);
      }
      const why = picked.map(([a, b]) => {
        const m = countOf(t, a, b);
        if (a === top.b && b === top.a) return `Order matters: ${lit(a)} then ${lit(b)} occurs ${m ? times(m) : 'nowhere'}, while ${lit(top.a)} then ${lit(top.b)} occurs ${top.n} times.`;
        if (m === 0) return a === b ? `Two ${lit(a)} never sit side by side here. BPE counts only neighboring pairs.` : `${lit(a)} and ${lit(b)} never sit side by side in that order. BPE counts only neighboring pairs.`;
        return `That pair occurs ${times(m)}; ${pairTex(top.a, top.b)} occurs ${top.n} times, more than any other.`;
      });
      return {
        prompt: `BPE is about to make its next merge on the tokens ${listTex(t)}. Which pair does it merge?`,
        answer: { kind: 'choice', options: [pairTex(top.a, top.b), ...picked.map((p) => pairTex(...p))], correct: 0, why: [null, ...why] },
        solution: [
          `Count every pair of neighbors, left to right: ${all.map((p) => `${pairTex(p.a, p.b)} ${p.n}`).join(', ')}.`,
          `The most frequent is ${pairTex(top.a, top.b)}, ${top.n} times, so BPE merges it into one new token.`,
        ],
      };
    },
  },
  {
    id: 'apply-merge',
    make(rng, d) {
      const ids = rng.shuffle((d < 0.5 ? SMALL_IDS : BYTE_IDS).slice()).slice(0, d < 0.35 ? 3 : 4);
      const t = tokens(rng, scale(d, 5, 9), ids);
      const top = pairCounts(t)[0]!;
      const k = d < 0.35 ? 0 : int(rng, 1, 9);
      const id = 256 + k;
      const v = merge(t, top.a, top.b, id);
      const at = positions(t, top.a, top.b);
      const named = d < 0.7;
      const first = at[0]!;
      const ts = [
        { value: [...t.slice(0, first), id, ...t.slice(first + 2)], why: `That merges only the first ${pairTex(top.a, top.b)}. A merge replaces every place the pair occurs.` },
        { value: t.flatMap((x, i) => (at.includes(i) ? [id] : [x])), why: 'That swaps the first token of each pair for the new id but keeps the second. A merge replaces both tokens with one.' },
        ...(named ? [] : [{ value: merge(t, top.a, top.b, id + 1), why: `Merge 0 makes id 256, so merge ${k} makes $256 + ${k} = ${id}$, not ${id + 1}.` }]),
      ];
      const which = named ? `into a new token with id $${id}$` : `into a new token: it is merge number ${k}, counting from 0`;
      return {
        prompt: `BPE merges the pair ${pairTex(top.a, top.b)} ${which}. What is the list $${vec(t)}$ after the merge?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, ts),
        solution: [
          ...(named ? [] : [`Ids 0 to 255 are the bytes, and merge 0 makes 256, so merge ${k} makes $256 + ${k} = ${id}$.`]),
          `Scan left to right for ${pairTex(top.a, top.b)} side by side: at position${at.length > 1 ? 's' : ''} ${at.join(' and ')}, counting from 0.`,
          `Replace each one, both tokens, with the single token ${id}: $${vec(v)}$.`,
          `Each replacement turns two tokens into one, so ${t.length} tokens become ${v.length}.`,
        ],
      };
    },
  },
  {
    id: 'count-after',
    make(rng, d) {
      if (d < 0.5 && rng.int(2) === 0) {
        const t = tokens(rng, scale(d, 7, 11), pick(rng, ALPHABETS).slice(0, 4));
        const top = pairCounts(t)[0]!;
        const v = t.length - top.n;
        return {
          prompt: `The tokens are ${listTex(t)}. BPE merges the most frequent neighboring pair. How many tokens are left?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: t.length - 1, why: `That removes one token in all. The pair occurs ${top.n} times, and each occurrence loses a token.` },
            { value: t.length - 2 * top.n, why: 'That drops both tokens of each pair. A merge replaces the two with one new token.' },
            { value: t.length, why: 'A merge shortens the list: every occurrence of the pair becomes one token.' },
          ]),
          solution: [
            `The most frequent pair is ${pairTex(top.a, top.b)}, ${top.n} times.`,
            `Each occurrence turns two tokens into one, so the list loses ${top.n}: $${t.length} - ${top.n} = ${v}$.`,
          ],
        };
      }
      const m = d < 0.5 ? 2 : 3;
      const n = d < 0.7 ? int(rng, 16, 30) : pick(rng, [200, 500, 1000, 2000]);
      // Each later merge finds its pair less often, and never in more than a third of the text.
      const cs: number[] = [];
      let left = n;
      for (let i = 0; i < m; i++) {
        const hi = Math.min(Math.floor(left / 3), i ? cs[i - 1]! : Infinity, d < 0.7 ? 5 : 60);
        const c = int(rng, Math.max(2, Math.floor(hi / 2)), hi);
        cs.push(c);
        left -= c;
      }
      const sum = cs.reduce((a, b) => a + b, 0);
      const v = n - sum;
      const ord = ['first', 'second', 'third'];
      return {
        prompt: `A text is $${big(n)}$ bytes long. BPE makes ${m} merges. ${cs.map((c, i) => (i ? `After that, the ${ord[i]} merge's pair occurs $${c}$ times.` : `The first merge's pair occurs $${c}$ times in the text.`)).join(' ')} How many tokens long is the text after the ${m} merges?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: n - m, why: 'That removes one token per merge. A merge removes one token for every place its pair occurs.' },
          { value: n - 2 * sum, why: 'That drops both tokens of each pair. A merge replaces the two with one new token.' },
          { value: n - cs[0]!, why: 'That counts only the first merge. Every merge shortens the text again.' },
        ]),
        solution: [
          'Each occurrence of a merged pair turns two tokens into one: one token fewer.',
          `So the text loses $${cs.join(' + ')} = ${sum}$ tokens.`,
          `$${big(n)} - ${sum} = ${big(v)}$ tokens.`,
        ],
      };
    },
  },
  {
    id: 'vocab-size',
    make(rng, d) {
      const kind = rng.int(3);
      const k = d < 0.35 ? pick(rng, [1, 2, 3, 5, 10, 20, 44, 100]) : d < 0.7 ? pick(rng, [200, 500, 744, 1000, 4000, 7744]) : pick(rng, [10000, 30000, 31744, 50000, 99744]);
      if (kind === 0) {
        const v = 256 + k;
        return {
          prompt: `Byte-level BPE starts from a vocabulary of the 256 possible bytes and then makes $${big(k)}$ merge${k === 1 ? '' : 's'}. How many tokens does the vocabulary hold?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: k, why: 'That counts only the merged tokens. The 256 bytes stay in the vocabulary.' },
            { value: 256 + 2 * k, why: 'A merge adds one token, the pair glued together. The two tokens it joins were already there.' },
            { value: 255 + k, why: 'There are 256 bytes, ids 0 to 255: that is 256 tokens, not 255.' },
          ]),
          solution: ['The vocabulary starts with the 256 bytes, ids 0 to 255.', `Each merge adds exactly one new token: $256 + ${big(k)} = ${big(v)}$.`],
        };
      }
      if (kind === 1) {
        const v = 256 + k;
        return {
          prompt: `Byte tokens have ids 0 to 255, and each BPE merge gives its new token the next free id. Counting merges from 0, what id does merge number $${big(k)}$ create?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: 255 + k, why: 'That counts merges from 1. Merge 0 makes id 256, so merge $k$ makes $256 + k$.' },
            { value: k, why: 'The first 256 ids already belong to the bytes, so new ids start at 256.' },
            { value: 257 + k, why: 'Merge 0 takes the first free id, 256; merge $k$ is $k$ ids later.' },
          ]),
          solution: ['Ids 0 to 255 are taken by the bytes, so merge 0 makes id 256.', `Merge $${big(k)}$ comes $${big(k)}$ ids later: $256 + ${big(k)} = ${big(v)}$.`],
        };
      }
      const V = 256 + k;
      return {
        prompt: `A byte-level BPE tokenizer should end up with a vocabulary of $${big(V)}$ tokens. Starting from the 256 bytes, how many merges does it make?`,
        answer: { kind: 'number', value: k },
        traps: traps(k, [
          { value: V, why: 'The 256 bytes come for free; only the tokens beyond them need a merge each.' },
          { value: V - 255, why: 'There are 256 bytes, ids 0 to 255: subtract 256.' },
        ]),
        solution: ['The vocabulary is the 256 bytes plus one token per merge.', `So the merges number $${big(V)} - 256 = ${big(k)}$.`],
      };
    },
  },
];
