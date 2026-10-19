// Writes src/lib/seq2seq-data.ts: snapshots of the toy models' outputs for the lecture.
// Usage: node tools/dl26/seq2seq/gendata.ts (after train.py and export_all.py wrote public/data/seq2seq-models.*)
import { readFileSync, writeFileSync } from 'node:fs';
import { buildModels, reference, sentenceOfLength, type Manifest } from '../../../src/lib/seq2seq-model.ts';

const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const man = JSON.parse(readFileSync(`${ROOT}/public/data/seq2seq-models.json`, 'utf8')) as Manifest;
const raw = readFileSync(`${ROOT}/public/data/seq2seq-models.bin`);
const M = buildModels(man, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const arr = (a: number[]) => a.map(r3);

const ex = M.encdec32!.translate('the black cat sees a dog'.split(' '));
const encEx = { src: ex.src, words: ex.words, probs: arr(ex.probs), enc: ex.enc.map(arr), c: arr(ex.c!), dec: ex.dec.map(arr) };

// Length curves on a larger fixed test set than the chapter's, for smooth lecture curves.
let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const PER = 40;
const lengths: number[] = [];
const curves: Record<string, number[]> = { encdec32: [], encdec64: [], attn: [] };
let fail: { src: string[]; ref: string[]; out: string[] } | null = null;
for (let L = 5; L <= 40; L++) {
  lengths.push(L);
  const tests = Array.from({ length: PER }, () => sentenceOfLength(rnd, L)!);
  for (const k of Object.keys(curves)) {
    let ok = 0;
    for (const x of tests) {
      const out = M[k]!.translate(x, undefined, false).words;
      const ref = reference(x);
      if (out.join(' ') === ref.join(' ')) ok++;
      else if (k === 'encdec32' && L === 18 && !fail) fail = { src: x, ref, out };
    }
    curves[k]!.push(r3(ok / PER));
  }
}

const al = M.attn!.translate('the black cat sees a white dog'.split(' '));
const alignEx = { src: al.src, words: al.words, alpha: al.alpha!.map(arr), scores: al.scores!.map(arr) };
const ad = M.attndot!.translate('the black cat sees a white dog'.split(' '));
const alignDot = { words: ad.words, alpha: ad.alpha!.map(arr) };

const out = `// Generated from the toy translators in public/data/seq2seq-models.* with the forward pass in
// seq2seq-model.ts, so the lecture draws the same numbers the chapter computes live.

/** The 32-number encoder-decoder on one sentence: every state, the context and the output. */
export const ENC_EX = ${JSON.stringify(encEx)};

/** Fraction of ${PER} random sentences per length translated perfectly, by model. */
export const CURVES = ${JSON.stringify({ per: PER, lengths, ...curves })};

/** One ${fail!.src.length}-word sentence the 32-number model gets wrong. */
export const FAIL_EX = ${JSON.stringify(fail)};

/** The additive-attention model on one sentence: scores and weights, one row per written word plus the end token. */
export const ALIGN_EX = ${JSON.stringify(alignEx)};

/** The same sentence through the model trained with a dot-product ("general") score. */
export const ALIGN_DOT = ${JSON.stringify(alignDot)};
`;
writeFileSync(`${ROOT}/src/lib/seq2seq-data.ts`, out);
console.log(JSON.stringify(curves));
console.log(fail);
console.log(ex.words, ex.probs);
