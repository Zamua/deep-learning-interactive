import type { Rng } from '../core/rand';
import { DOT, NGRAM, V, grammatical } from './pretraining-lang';

export interface Decoding {
  greedy: boolean;
  tau: number;
  /** Keep only the k most likely tokens (V keeps all). */
  topK: number;
  /** Keep the smallest set of top tokens whose probability adds up to at least topP (1 keeps all). */
  topP: number;
}

export const PLAIN: Decoding = { greedy: false, tau: 1, topK: V, topP: 1 };

export interface Shaped {
  /** The distribution actually sampled from. */
  q: Float64Array;
  /** Token ids by probability after temperature, most likely first. */
  order: number[];
  /** After temperature, before any cut. */
  tempered: Float64Array;
  /** How many tokens survive the cuts. */
  kept: number;
}

/** Temperature, then top-k, then top-p, then renormalize: the usual order in sampling code. */
export function shape(probs: ArrayLike<number>, d: Decoding): Shaped {
  const tempered = new Float64Array(V);
  const order = Array.from({ length: V }, (_, i) => i).sort((a, b) => probs[b]! - probs[a]!);
  const q = new Float64Array(V);
  if (d.greedy) {
    tempered.set(Array.from(probs));
    q[order[0]!] = 1;
    return { q, order, tempered, kept: 1 };
  }
  let mx = -Infinity;
  for (let i = 0; i < V; i++) mx = Math.max(mx, Math.log(probs[i]!) / d.tau);
  let z = 0;
  for (let i = 0; i < V; i++) z += tempered[i] = Math.exp(Math.log(probs[i]!) / d.tau - mx);
  for (let i = 0; i < V; i++) tempered[i]! /= z;
  const k = Math.max(1, Math.min(V, Math.round(d.topK)));
  let mass = 0;
  for (let r = 0; r < k; r++) mass += tempered[order[r]!]!;
  let kept = 0;
  let cum = 0;
  while (kept < k) {
    cum += tempered[order[kept]!]! / mass;
    kept++;
    if (cum >= d.topP - 1e-12) break;
  }
  let s = 0;
  for (let r = 0; r < kept; r++) s += tempered[order[r]!]!;
  for (let r = 0; r < kept; r++) q[order[r]!] = tempered[order[r]!]! / s;
  return { q, order, tempered, kept };
}

export function draw(q: ArrayLike<number>, r: Rng): number {
  let u = r.next();
  let last = 0;
  for (let i = 0; i < V; i++) {
    if (q[i]! <= 0) continue;
    last = i;
    u -= q[i]!;
    if (u < 0) return i;
  }
  return last;
}

export function entropy(q: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < q.length; i++) if (q[i]! > 0) h -= q[i]! * Math.log(q[i]!);
  return h;
}

/** Continues `context` with the trigram under decoding `d` until `nSent` sentences have ended. */
export function generate(context: number[], d: Decoding, r: Rng, nSent: number, maxLen = 16): number[] {
  const ctx = [...context];
  const out: number[] = [];
  let ended = 0;
  let len = 0;
  while (ended < nSent) {
    const w = draw(shape(NGRAM.probs(ctx), d).q, r);
    ctx.push(w);
    out.push(w);
    len++;
    if (w === DOT || len >= maxLen) {
      ended++;
      len = 0;
      if (w !== DOT) {
        ctx.push(DOT);
        out.push(DOT);
      }
    }
  }
  return out;
}

export interface SweepPoint {
  value: number;
  /** exp(mean entropy of the sampling distribution): how many words it effectively chooses among. */
  choices: number;
  /** Fraction of generated sentences the grammar accepts. */
  good: number;
  /** Fraction of generated sentences that are distinct. */
  distinct: number;
}

/** Samples `n` sentences from a sentence start and scores them. */
export function score(d: Decoding, r: Rng, n = 300, maxLen = 16, model: (ctx: number[]) => Float64Array = (c) => NGRAM.probs(c)): SweepPoint {
  let H = 0;
  let steps = 0;
  let good = 0;
  const seen = new Set<string>();
  let ctx = [DOT];
  for (let k = 0; k < n; k++) {
    const sent: number[] = [];
    while (sent.length < maxLen) {
      const { q } = shape(model(ctx), d);
      H += entropy(q);
      steps++;
      const w = draw(q, r);
      sent.push(w);
      ctx.push(w); if (ctx.length > 8) ctx.shift();
      if (w === DOT) break;
    }
    if (grammatical(sent)) good++;
    seen.add(sent.join(','));
    if (ctx[ctx.length - 1] !== DOT) ctx.push(DOT);
  }
  return { value: NaN, choices: Math.exp(H / steps), good: good / n, distinct: seen.size / n };
}
