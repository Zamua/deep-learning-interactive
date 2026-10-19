import { Rng } from '../../core/rand';
import { type BPE, bytesOf, encode, encodeTrace, getStats, merge, pairOf, show, topPair, train } from '../../lib/tokenization-bpe';
import { CORPUS, HELDOUT, TINY } from '../../lib/tokenization-corpus';
import { NV, TinyLM } from '../../lib/tokenization-embed';

/** The chapter's tokenizer: byte-level BPE with the GPT-2 split, trained on the lighthouse story. */
export const BPE_SPLIT: BPE = train(CORPUS, 400, true);
export const tokLabel = (id: number): string => show(BPE_SPLIT.vocab[id]!);
export const enc = (s: string): number[] => encode(s, BPE_SPLIT);

/* ---- the toy text, merge by merge ---- */

export interface TinyState {
  ids: number[];
  /** Pair counts at this state, most frequent first (first-seen order breaks ties). */
  sorted: [number, number, number][];
  best: [number, number] | null;
  cnt: number;
}
export const TINY_VOCAB: Uint8Array[] = Array.from({ length: 256 }, (_, i) => Uint8Array.of(i));
export const TINY_STATES: TinyState[] = (() => {
  const out: TinyState[] = [];
  let ids = bytesOf(TINY);
  for (let k = 0; ; k++) {
    const stats = getStats([ids]);
    const top = topPair(stats);
    const sorted = [...stats.entries()]
      .map((e, i) => [e, i] as const)
      .sort((a, b) => b[0][1] - a[0][1] || a[1] - b[1])
      .map(([[pk, n]]) => [...pairOf(pk), n] as [number, number, number]);
    if (!top || top[1] < 2) {
      out.push({ ids, sorted, best: null, cnt: 0 });
      return out;
    }
    const [a, b] = pairOf(top[0]);
    out.push({ ids, sorted, best: [a, b], cnt: top[1] });
    const v = new Uint8Array(TINY_VOCAB[a]!.length + TINY_VOCAB[b]!.length);
    v.set(TINY_VOCAB[a]!);
    v.set(TINY_VOCAB[b]!, TINY_VOCAB[a]!.length);
    TINY_VOCAB.push(v);
    ids = merge(ids, a, b, 256 + k);
  }
})();
export const tinyLabel = (id: number): string => show(TINY_VOCAB[id]!);

/* ---- a page of text ---- */

export const HELD_BYTES = bytesOf(HELDOUT).length;
export const HELD_LENS: number[] = Array.from({ length: BPE_SPLIT.merges.length + 1 }, (_, k) => encode(HELDOUT, BPE_SPLIT, k).length);
export const EXCERPT = 'The keeper of the old lighthouse kept a log,';
export const KMAX = BPE_SPLIT.merges.length;

/* ---- encoding one sentence ---- */

export const ENC_TEXT = 'the keeper wrote it down';
export const ENC_TRACE = encodeTrace(ENC_TEXT, BPE_SPLIT);

/* ---- the 2-D toy language model, trained once ---- */

export const TOY_STEPS = 600;
export const TOY_EVERY = 4;
export const TOY: TinyLM = new TinyLM(false, 3);
export const TOY_SNAPS: Float64Array[] = (() => {
  const out = [Float64Array.from(TOY.E)];
  for (let i = 1; i <= TOY_STEPS; i++) {
    TOY.step(0.02);
    if (i % TOY_EVERY === 0) out.push(Float64Array.from(TOY.E));
  }
  return out;
})();
/** Embedding rows at training progress p in [0, 1], interpolated between snapshots. */
export function toyE(p: number): Float64Array {
  const f = Math.max(0, Math.min(1, p)) * (TOY_SNAPS.length - 1);
  const i = Math.min(TOY_SNAPS.length - 2, Math.floor(f));
  const t = f - i;
  const a = TOY_SNAPS[i]!, b = TOY_SNAPS[i + 1]!;
  const out = new Float64Array(NV * 2);
  for (let j = 0; j < out.length; j++) out[j] = a[j]! + (b[j]! - a[j]!) * t;
  return out;
}

/* ---- a fixed random table for the embedding pictures ---- */

export const TABLE: number[][] = (() => {
  const r = new Rng(17);
  return Array.from({ length: 12 }, () => Array.from({ length: 8 }, () => Math.max(-1, Math.min(1, r.randn() * 0.55))));
})();
export const HVEC: number[] = (() => {
  const r = new Rng(5);
  return Array.from({ length: 8 }, () => Math.max(-1, Math.min(1, r.randn() * 0.6)));
})();
