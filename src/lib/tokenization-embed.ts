/**
 * The smallest language model there is: embed a word in 2-D, pass it through one 2x2 matrix
 * (standing in for the transformer), unembed to scores over the vocabulary. Trained full-batch
 * on the exact next-word probabilities of a toy grammar: DET [ADJ] NOUN VERB .
 */

export const WORDS = ['the', 'a', 'big', 'small', 'red', 'cat', 'dog', 'bird', 'fish', 'runs', 'sleeps', 'flies', 'swims', '.'] as const;
export const GROUP = [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4];
export const GROUPS = ['determiner', 'adjective', 'noun', 'verb', 'full stop'];
export const NV = WORDS.length;

const ix = (w: string): number => WORDS.indexOf(w as (typeof WORDS)[number]);

/** Q[t][j]: probability that word j follows word t under the grammar. */
export const Q: number[][] = (() => {
  const q = Array.from({ length: NV }, () => new Array<number>(NV).fill(0));
  const set = (from: string[], to: [string, number][]) => {
    for (const f of from) for (const [w, p] of to) q[ix(f)]![ix(w)]! += p;
  };
  set(['the', 'a'], [['big', 1 / 6], ['small', 1 / 6], ['red', 1 / 6], ['cat', 1 / 8], ['dog', 1 / 8], ['bird', 1 / 8], ['fish', 1 / 8]]);
  set(['big', 'small', 'red'], [['cat', 1 / 4], ['dog', 1 / 4], ['bird', 1 / 4], ['fish', 1 / 4]]);
  set(['cat', 'dog'], [['runs', 1 / 2], ['sleeps', 1 / 2]]);
  set(['bird'], [['flies', 1 / 2], ['sleeps', 1 / 2]]);
  set(['fish'], [['swims', 1]]);
  set(['runs', 'sleeps', 'flies', 'swims'], [['.', 1]]);
  set(['.'], [['the', 1 / 2], ['a', 1 / 2]]);
  return q;
})();

/** How often each word occurs: the stationary distribution of Q, by power iteration. */
export const FREQ: number[] = (() => {
  let f = new Array<number>(NV).fill(1 / NV);
  for (let it = 0; it < 400; it++) {
    const g = new Array<number>(NV).fill(0);
    for (let t = 0; t < NV; t++) for (let j = 0; j < NV; j++) g[j]! += f[t]! * Q[t]![j]!;
    f = g;
  }
  return f;
})();

/** The best possible loss: the grammar's own next-word entropy, averaged over tokens. */
export const ENTROPY = Q.reduce((acc, row, t) => acc + FREQ[t]! * row.reduce((a, q) => a - (q > 0 ? q * Math.log(q) : 0), 0), 0);

export class TinyLM {
  E = new Float64Array(NV * 2);
  W = new Float64Array(4);
  U = new Float64Array(2 * NV);
  b = new Float64Array(NV);
  tied: boolean;
  steps = 0;
  private m: Float64Array[] = [];
  private v: Float64Array[] = [];

  constructor(tied: boolean, seed: number) {
    this.tied = tied;
    this.reset(seed);
  }

  reset(seed: number): void {
    let s = seed >>> 0;
    const rnd = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const randn = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    for (let i = 0; i < this.E.length; i++) this.E[i] = randn() * 0.5;
    for (let i = 0; i < this.U.length; i++) this.U[i] = randn() * 0.5;
    this.W.set([1, 0, 0, 1]);
    this.b.fill(0);
    this.steps = 0;
    this.m = [this.E, this.W, this.U, this.b].map((a) => new Float64Array(a.length));
    this.v = [this.E, this.W, this.U, this.b].map((a) => new Float64Array(a.length));
  }

  /** Output vector of word j: column j of U, or row j of E when tied. */
  out(j: number): [number, number] {
    return this.tied ? [this.E[2 * j]!, this.E[2 * j + 1]!] : [this.U[j]!, this.U[NV + j]!];
  }

  hidden(t: number): [number, number] {
    const e0 = this.E[2 * t]!, e1 = this.E[2 * t + 1]!;
    return [e0 * this.W[0]! + e1 * this.W[2]!, e0 * this.W[1]! + e1 * this.W[3]!];
  }

  logits(t: number): number[] {
    const [h0, h1] = this.hidden(t);
    return WORDS.map((_, j) => {
      const [u0, u1] = this.out(j);
      return h0 * u0 + h1 * u1 + this.b[j]!;
    });
  }

  probs(t: number): number[] {
    const z = this.logits(t);
    const mx = Math.max(...z);
    const e = z.map((v) => Math.exp(v - mx));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }

  loss(): number {
    let L = 0;
    for (let t = 0; t < NV; t++) {
      const p = this.probs(t);
      for (let j = 0; j < NV; j++) if (Q[t]![j]! > 0) L -= FREQ[t]! * Q[t]![j]! * Math.log(p[j]!);
    }
    return L;
  }

  /** One full-batch Adam step; returns the loss before the step. */
  step(lr = 0.05): number {
    const dE = new Float64Array(NV * 2);
    const dW = new Float64Array(4);
    const dU = new Float64Array(2 * NV);
    const db = new Float64Array(NV);
    let L = 0;
    for (let t = 0; t < NV; t++) {
      const p = this.probs(t);
      const [h0, h1] = this.hidden(t);
      let dh0 = 0, dh1 = 0;
      for (let j = 0; j < NV; j++) {
        const q = Q[t]![j]!;
        if (q > 0) L -= FREQ[t]! * q * Math.log(p[j]!);
        const dz = FREQ[t]! * (p[j]! - q);
        db[j]! += dz;
        const [u0, u1] = this.out(j);
        dh0 += dz * u0;
        dh1 += dz * u1;
        if (this.tied) {
          dE[2 * j]! += dz * h0;
          dE[2 * j + 1]! += dz * h1;
        } else {
          dU[j]! += dz * h0;
          dU[NV + j]! += dz * h1;
        }
      }
      const e0 = this.E[2 * t]!, e1 = this.E[2 * t + 1]!;
      dW[0]! += e0 * dh0;
      dW[1]! += e0 * dh1;
      dW[2]! += e1 * dh0;
      dW[3]! += e1 * dh1;
      dE[2 * t]! += dh0 * this.W[0]! + dh1 * this.W[1]!;
      dE[2 * t + 1]! += dh0 * this.W[2]! + dh1 * this.W[3]!;
    }
    this.steps++;
    const b1 = 0.9, b2 = 0.999;
    const c1 = 1 - b1 ** this.steps, c2 = 1 - b2 ** this.steps;
    [this.E, this.W, this.U, this.b].forEach((P, k) => {
      const G = [dE, dW, dU, db][k]!;
      const m = this.m[k]!, v = this.v[k]!;
      for (let i = 0; i < P.length; i++) {
        m[i] = b1 * m[i]! + (1 - b1) * G[i]!;
        v[i] = b2 * v[i]! + (1 - b2) * G[i]! * G[i]!;
        P[i]! -= (lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    });
    return L;
  }
}
