import { Rng } from '../core/rand';

/*
 * The chapter's toy language: 36 words produced by a small probabilistic grammar. Every word
 * moves the grammar to exactly one next state, so the true probability of any next word given
 * the text so far is known exactly, and so is the language's entropy (the loss floor).
 */

const ADJ = ['big', 'small', 'lazy', 'happy'];
const SUBJ_SG = ['cat', 'dog', 'bird', 'girl', 'boy'];
const SUBJ_PL = ['cats', 'dogs', 'birds', 'kids'];
const OBJ_SG = [...SUBJ_SG, 'ball'];
const OBJ_PL = [...SUBJ_PL, 'balls'];
const ON_PLACES = ['mat', 'rug', 'bed'];
const IN_PLACES = ['park', 'garden', 'house'];

export const VOCAB: string[] = [
  '.', 'the', 'a', ...ADJ, ...OBJ_SG, ...OBJ_PL,
  'sleeps', 'runs', 'sees', 'likes', 'chases', 'sleep', 'run', 'see', 'like', 'chase',
  'on', 'in', ...ON_PLACES, ...IN_PLACES,
];
export const V = VOCAB.length;
export const IX = new Map(VOCAB.map((w, i) => [w, i] as const));
export const DOT = 0;

export const tok = (s: string): number[] =>
  s.trim().split(/\s+/).map((w) => {
    const i = IX.get(w);
    if (i === undefined) throw new Error(`not in the toy vocabulary: ${w}`);
    return i;
  });
export const words = (ids: ArrayLike<number>): string[] => Array.from(ids, (i) => VOCAB[i]!);

type ArcDef = [string, number, string];
const spread = (ws: string[], total: number, to: string): ArcDef[] => ws.map((w) => [w, total / ws.length, to]);

const GRAMMAR: Record<string, ArcDef[]> = {
  start: [['the', 0.6, 'the'], ['a', 0.4, 'a']],
  the: [...spread(ADJ, 0.3, 'adj'), ...spread(SUBJ_SG, 0.4, 'ns'), ...spread(SUBJ_PL, 0.3, 'np')],
  a: [...spread(ADJ, 0.3, 'adjA'), ...spread(SUBJ_SG, 0.7, 'ns')],
  adj: [...spread(SUBJ_SG, 0.55, 'ns'), ...spread(SUBJ_PL, 0.45, 'np')],
  adjA: spread(SUBJ_SG, 1, 'ns'),
  ns: [['sleeps', 0.25, 'vi'], ['runs', 0.2, 'vi'], ['sees', 0.2, 'vt'], ['likes', 0.15, 'vt'], ['chases', 0.2, 'vt']],
  np: [['sleep', 0.25, 'vi'], ['run', 0.2, 'vi'], ['see', 0.2, 'vt'], ['like', 0.15, 'vt'], ['chase', 0.2, 'vt']],
  vi: [['.', 0.5, 'start'], ['on', 0.25, 'on'], ['in', 0.25, 'in']],
  on: [['the', 1, 'onThe']],
  in: [['the', 1, 'inThe']],
  onThe: spread(ON_PLACES, 1, 'place'),
  inThe: spread(IN_PLACES, 1, 'place'),
  place: [['.', 1, 'start']],
  vt: [['the', 0.6, 'oThe'], ['a', 0.4, 'oA']],
  oThe: [...spread(ADJ, 0.25, 'oAdj'), ...spread(OBJ_SG, 0.45, 'obj'), ...spread(OBJ_PL, 0.3, 'obj')],
  oA: [...spread(ADJ, 0.25, 'oAdjA'), ...spread(OBJ_SG, 0.75, 'obj')],
  oAdj: [...spread(OBJ_SG, 0.55, 'obj'), ...spread(OBJ_PL, 0.45, 'obj')],
  oAdjA: spread(OBJ_SG, 1, 'obj'),
  obj: [['.', 1, 'start']],
};

export const STATE_NAMES = Object.keys(GRAMMAR);
export const NS = STATE_NAMES.length;
export const START = 0;
const SIX = new Map(STATE_NAMES.map((s, i) => [s, i] as const));

/** P[s * V + w]: probability of word w in state s. NEXT[s * V + w]: the state it leads to, or -1. */
export const P = new Float64Array(NS * V);
export const NEXT = new Int32Array(NS * V).fill(-1);
STATE_NAMES.forEach((name, s) => {
  for (const [w, p, to] of GRAMMAR[name]!) {
    const wi = IX.get(w)!;
    P[s * V + wi] = p;
    NEXT[s * V + wi] = SIX.get(to)!;
  }
});

export function step(s: number, w: number): number {
  return s < 0 ? -1 : NEXT[s * V + w]!;
}

/** The state after reading `ctx` from a sentence start (a leading "." is allowed), or -1. */
export function stateAfter(ctx: ArrayLike<number>): number {
  let s = START;
  for (let i = ctx[0] === DOT ? 1 : 0; i < ctx.length; i++) s = step(s, ctx[i]!);
  return s;
}

/** The true next-word distribution after `ctx` (all zeros if ctx is ungrammatical). */
export function trueProbs(ctx: ArrayLike<number>, out = new Float64Array(V)): Float64Array {
  out.fill(0);
  const s = stateAfter(ctx);
  if (s >= 0) for (let w = 0; w < V; w++) out[w] = P[s * V + w]!;
  return out;
}

export function sampleSentence(r: Rng): number[] {
  const out: number[] = [];
  let s = START;
  do {
    let u = r.next();
    let w = 0;
    for (; w < V - 1; w++) {
      u -= P[s * V + w]!;
      if (u < 0) break;
    }
    while (P[s * V + w] === 0) w--;
    out.push(w);
    s = NEXT[s * V + w]!;
  } while (s !== START);
  return out;
}

export function sampleText(nTokens: number, seed: number): Int32Array {
  const r = new Rng(seed);
  const out: number[] = [DOT];
  while (out.length < nTokens) out.push(...sampleSentence(r));
  return Int32Array.from(out.slice(0, nTokens));
}

/** Entropy rate of the language in nats per word, from the stationary distribution over states. */
function entropyRate(): number {
  let pi = new Float64Array(NS).fill(1 / NS);
  for (let it = 0; it < 2000; it++) {
    const nx = new Float64Array(NS);
    for (let s = 0; s < NS; s++)
      for (let w = 0; w < V; w++) {
        const p = P[s * V + w]!;
        if (p > 0) nx[NEXT[s * V + w]!]! += pi[s]! * p;
      }
    pi = nx;
  }
  let H = 0;
  for (let s = 0; s < NS; s++)
    for (let w = 0; w < V; w++) {
      const p = P[s * V + w]!;
      if (p > 0) H -= pi[s]! * p * Math.log(p);
    }
  return H;
}
export const ENTROPY = entropyRate();

export const TRAIN = sampleText(20000, 7);
export const HELD = sampleText(3000, 8);

/** A context of the last k tokens of `ctx` (ending at index `end`) as one number. */
function ctxKey(ctx: ArrayLike<number>, k: number, end = ctx.length): number {
  let h = k;
  for (let j = end - k; j < end; j++) h = h * (V + 1) + ctx[j]! + 1;
  return h;
}

/**
 * An interpolated n-gram model: a mix of count ratios for every context length up to n - 1,
 * plus a little uniform mass. Contexts never seen hand their weight to the shorter ones.
 */
export class NGram {
  private rows: Map<number, Float64Array>[] = [];

  constructor(readonly n: number, data: ArrayLike<number>, readonly lambdas: number[]) {
    for (let k = 0; k < n; k++) {
      const c = new Map<number, Float64Array>();
      for (let i = k; i < data.length; i++) {
        const key = ctxKey(data, k, i);
        let row = c.get(key);
        if (!row) c.set(key, (row = new Float64Array(V + 1)));
        row[data[i]!]! += 1;
        row[V]! += 1;
      }
      this.rows.push(c);
    }
  }

  /** p(next | ctx) using the last n - 1 tokens of ctx. lambdas = [uniform, 0 words, 1 word, ...]. */
  probs(ctx: ArrayLike<number>, out = new Float64Array(V)): Float64Array {
    out.fill(0);
    let carry = 0;
    for (let k = this.n - 1; k >= 0; k--) {
      const lam = (this.lambdas[k + 1] ?? 0) + carry;
      carry = 0;
      if (lam === 0) continue;
      const row = ctx.length >= k ? this.rows[k]!.get(ctxKey(ctx, k)) : undefined;
      if (!row) {
        carry = lam;
        continue;
      }
      const tot = row[V]!;
      for (let w = 0; w < V; w++) out[w]! += (lam * row[w]!) / tot;
    }
    const u = (this.lambdas[0] ?? 0) + carry;
    for (let w = 0; w < V; w++) out[w]! += u / V;
    return out;
  }

  /** Average negative log-likelihood (nats per token) on `data`, skipping its first token. */
  nll(data: ArrayLike<number>): number {
    const pr = new Float64Array(V);
    let s = 0;
    for (let i = 1; i < data.length; i++) {
      const k = Math.min(i, this.n - 1);
      this.probs(Array.prototype.slice.call(data, i - k, i) as number[], pr);
      s -= Math.log(pr[data[i]!]!);
    }
    return s / (data.length - 1);
  }
}

/**
 * The chapter's language model for distributions and sampling: counts over the last 4, 3, 2,
 * 1 and 0 words, mixed, plus a sliver of uniform probability.
 */
export const NGRAM = new NGram(5, TRAIN, [0.01, 0.02, 0.04, 0.08, 0.25, 0.6]);

/** Counts with one context length alone (barely smoothed), for comparison lines. */
const pure = (n: number) => new NGram(n, TRAIN, [1e-4, ...Array(n - 1).fill(0), 1]);
export const UNIGRAM = pure(1);
export const BIGRAM = pure(2);
export const TRIGRAM = pure(3);
export const FOURGRAM = pure(4);
export const FIVEGRAM = pure(5);

/** Exact average loss of the true language on the held-out text: the floor any model can reach. */
export function trueNll(data: ArrayLike<number>): number {
  let s = START;
  let tot = 0;
  for (let i = 1; i < data.length; i++) {
    const w = data[i]!;
    tot -= Math.log(P[s * V + w]!);
    s = NEXT[s * V + w]!;
  }
  return tot / (data.length - 1);
}

/** Is a sentence (ending in ".") grammatical in the toy language? */
export function grammatical(sent: ArrayLike<number>): boolean {
  let s = START;
  for (let i = 0; i < sent.length; i++) {
    s = step(s, sent[i]!);
    if (s < 0) return false;
  }
  return s === START;
}

/**
 * Exact fill-in-the-blank: p(word at each masked position | every unmasked word), for a sentence
 * that starts at a sentence boundary and ends with ".". Forward-backward over grammar states.
 */
export function maskedPosteriors(sent: ArrayLike<number>, masked: boolean[]): (Float64Array | null)[] {
  const T = sent.length;
  const ok = (t: number, w: number) => masked[t] || sent[t] === w;
  const alpha: Float64Array[] = [new Float64Array(NS)];
  alpha[0]![START] = 1;
  for (let t = 0; t < T; t++) {
    const nx = new Float64Array(NS);
    for (let s = 0; s < NS; s++) {
      const a = alpha[t]![s]!;
      if (a === 0) continue;
      for (let w = 0; w < V; w++) {
        const p = P[s * V + w]!;
        if (p > 0 && ok(t, w)) nx[NEXT[s * V + w]!]! += a * p;
      }
    }
    alpha.push(nx);
  }
  const beta: Float64Array[] = Array.from({ length: T + 1 }, () => new Float64Array(NS));
  beta[T]![START] = 1;
  for (let t = T - 1; t >= 0; t--)
    for (let s = 0; s < NS; s++) {
      let b = 0;
      for (let w = 0; w < V; w++) {
        const p = P[s * V + w]!;
        if (p > 0 && ok(t, w)) b += p * beta[t + 1]![NEXT[s * V + w]!]!;
      }
      beta[t]![s] = b;
    }
  return Array.from({ length: T }, (_, t) => {
    if (!masked[t]) return null;
    const out = new Float64Array(V);
    let z = 0;
    for (let s = 0; s < NS; s++) {
      const a = alpha[t]![s]!;
      if (a === 0) continue;
      for (let w = 0; w < V; w++) {
        const p = P[s * V + w]!;
        if (p > 0) {
          const v = a * p * beta[t + 1]![NEXT[s * V + w]!]!;
          out[w]! += v;
          z += v;
        }
      }
    }
    if (z > 0) for (let w = 0; w < V; w++) out[w]! /= z;
    return out;
  });
}
