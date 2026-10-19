import { Rng } from '../core/rand';

/**
 * A toy language model small enough to pretrain and fine-tune in the browser: the last C token
 * embeddings, concatenated, through one tanh layer to logits over a 40-word vocabulary.
 */

export const PAIRS: [string, string, string][] = [
  ['france', 'paris', 'europe'],
  ['spain', 'madrid', 'europe'],
  ['italy', 'rome', 'europe'],
  ['japan', 'tokyo', 'asia'],
  ['egypt', 'cairo', 'africa'],
  ['peru', 'lima', 'america'],
  ['kenya', 'nairobi', 'africa'],
  ['china', 'beijing', 'asia'],
];

const WORDS = ['what', 'is', 'the', 'capital', 'of', '?', '.', 'q', ':', 'a', 'quiz', 'in', 'where', 'facts', 'and'];
export const VOCAB: string[] = ['<bos>', '<user>', '<bot>', '<end>', ...WORDS, ...PAIRS.flatMap((p) => [p[0], p[1]]), ...new Set(PAIRS.map((p) => p[2]))];
const ID = new Map(VOCAB.map((w, i) => [w, i]));
export const V = VOCAB.length;
export const C = 4;
const D = 8;
const H = 48;
const BOS = 0;
export const END = ID.get('<end>')!;

export const ids = (s: string): number[] => s.split(' ').filter(Boolean).map((w) => {
  const i = ID.get(w);
  if (i === undefined) throw new Error(`toy vocab has no "${w}"`);
  return i;
});

/** One training sequence and which of its tokens carry loss. */
export interface Doc {
  ids: number[];
  mask: number[];
}

const capQ = (c: string) => `what is the capital of ${c} ?`;

/** Web text for pretraining: facts, quiz pages that list questions, and a few FAQ pages. */
export function webDocs(n: number, seed: number): Doc[] {
  const r = new Rng(seed);
  const out: Doc[] = [];
  const pick = () => PAIRS[r.int(PAIRS.length)]!;
  for (let i = 0; i < n; i++) {
    const u = r.next();
    let s: string;
    if (u < 0.3) {
      const k = 1 + r.int(3);
      s = `facts : ${Array.from({ length: k }, () => {
        const [c, cap] = pick();
        return `the capital of ${c} is ${cap} .`;
      }).join(' ')}`;
    } else if (u < 0.62) {
      const k = 2 + r.int(3);
      s = `quiz : ${Array.from({ length: k }, () => capQ(pick()[0])).join(' ')}`;
    } else if (u < 0.82) {
      const [c, , reg] = pick();
      const [c2, , reg2] = pick();
      s = `facts : ${c} is in ${reg} . ${c2} is in ${reg2} .`;
    } else {
      const [c, cap] = pick();
      s = `q : ${capQ(c)} a : ${cap} .`;
    }
    const t = ids(s);
    out.push({ ids: t, mask: t.map(() => 1) });
  }
  return out;
}

/** Demonstrations in the chat template; only the answer and its end token carry loss. */
export function chatDocs(seed: number): Doc[] {
  const r = new Rng(seed);
  const out: Doc[] = [];
  for (const [c, cap, reg] of PAIRS) {
    const qs: [string, string][] = [[`where is ${c} ?`, `${c} is in ${reg} .`], [capQ(c), `${cap} .`]];
    for (const [q, a] of qs) {
      const p = ids(`<user> ${q} <bot>`);
      const y = ids(`${a} <end>`);
      out.push({ ids: [...p, ...y], mask: [...p.map(() => 0), ...y.map(() => 1)] });
    }
  }
  return r.shuffle(out);
}

export interface Example {
  ctx: number[];
  y: number;
  w: number;
}

/** Every (context, next token, mask) triple of a set of documents. */
export function examples(docs: Doc[], all = false): Example[] {
  const out: Example[] = [];
  for (const d of docs) {
    for (let t = 0; t < d.ids.length; t++) {
      if (!all && !d.mask[t]) continue;
      const ctx: number[] = [];
      for (let k = t - C; k < t; k++) ctx.push(k < 0 ? BOS : d.ids[k]!);
      out.push({ ctx, y: d.ids[t]!, w: 1 });
    }
  }
  return out;
}

type Params = { E: Float64Array; W1: Float64Array; b1: Float64Array; W2: Float64Array; b2: Float64Array };
const KEYS = ['E', 'W1', 'b1', 'W2', 'b2'] as const;
const NIN = [C * D, H];
const NOUT = [H, V];

/** Rank-r adapters on both weight matrices: W_eff = W + (alpha / r) B A, with B = 0 at the start. */
interface Lora {
  r: number;
  s: number;
  A: [Float64Array, Float64Array];
  B: [Float64Array, Float64Array];
  m: Float64Array[];
  v: Float64Array[];
}

export type Mode = 'full' | 'lora';

export class ToyLM {
  p: Params;
  private g: Params;
  private m: Params;
  private v: Params;
  private t = 0;
  private lora: Lora | null = null;
  /** The weights the forward pass uses: the base ones, or base plus the adapter's update. */
  private We: [Float64Array, Float64Array];
  private hid = new Float64Array(H);
  private inp = new Float64Array(C * D);
  private lg = new Float64Array(V);

  constructor(seed = 1) {
    const r = new Rng(seed);
    const rnd = (n: number, s: number) => Float64Array.from({ length: n }, () => r.randn() * s);
    this.p = { E: rnd(V * D, 0.5), W1: rnd(C * D * H, 1 / Math.sqrt(C * D)), b1: new Float64Array(H), W2: rnd(H * V, 1 / Math.sqrt(H)), b2: new Float64Array(V) };
    this.g = this.zeros();
    this.m = this.zeros();
    this.v = this.zeros();
    this.We = [this.p.W1, this.p.W2];
  }

  private zeros(): Params {
    return { E: new Float64Array(V * D), W1: new Float64Array(C * D * H), b1: new Float64Array(H), W2: new Float64Array(H * V), b2: new Float64Array(V) };
  }

  clone(): ToyLM {
    const o = new ToyLM();
    o.load(this);
    return o;
  }

  /** Copies the base weights of another model, drops any adapter and clears the optimizer. */
  load(src: ToyLM): void {
    for (const k of KEYS) {
      this.p[k].set(src.p[k]);
      this.m[k].fill(0);
      this.v[k].fill(0);
    }
    this.t = 0;
    this.lora = null;
    this.We = [this.p.W1, this.p.W2];
  }

  /** Freezes the base weights and adds fresh rank-r adapters (A random, B zero). */
  addLora(r: number, alpha: number, seed = 3): void {
    const rng = new Rng(seed);
    const A = NIN.map((n) => Float64Array.from({ length: r * n }, () => rng.randn() / Math.sqrt(n))) as [Float64Array, Float64Array];
    const B = NOUT.map((n) => new Float64Array(n * r)) as [Float64Array, Float64Array];
    this.lora = { r, s: alpha / r, A, B, m: [...A, ...B].map((a) => new Float64Array(a.length)), v: [...A, ...B].map((a) => new Float64Array(a.length)) };
    this.t = 0;
    this.We = [this.p.W1.slice(), this.p.W2.slice()];
  }

  /** Trainable parameter count in the current mode. */
  trainable(): number {
    if (!this.lora) return KEYS.reduce((a, k) => a + this.p[k].length, 0);
    return this.lora.r * (NIN[0]! + NOUT[0]! + NIN[1]! + NOUT[1]!);
  }

  count(): number {
    return KEYS.reduce((a, k) => a + this.p[k].length, 0);
  }

  /** Next-token probabilities after a context of C ids. */
  probs(ctx: number[]): Float64Array {
    const { E, b1, b2 } = this.p;
    const [W1, W2] = this.We;
    const inp = this.inp;
    for (let c = 0; c < C; c++) for (let j = 0; j < D; j++) inp[c * D + j] = E[ctx[c]! * D + j]!;
    for (let k = 0; k < H; k++) {
      let s = b1[k]!;
      for (let i = 0; i < C * D; i++) s += inp[i]! * W1[i * H + k]!;
      this.hid[k] = Math.tanh(s);
    }
    let mx = -Infinity;
    for (let v = 0; v < V; v++) {
      let s = b2[v]!;
      for (let k = 0; k < H; k++) s += this.hid[k]! * W2[k * V + v]!;
      this.lg[v] = s;
      if (s > mx) mx = s;
    }
    let z = 0;
    const out = new Float64Array(V);
    for (let v = 0; v < V; v++) z += out[v] = Math.exp(this.lg[v]! - mx);
    for (let v = 0; v < V; v++) out[v]! /= z;
    return out;
  }

  /** Mean cross-entropy over examples, in nats per token. */
  loss(exs: Example[]): number {
    let s = 0;
    for (const e of exs) s -= Math.log(Math.max(1e-12, this.probs(e.ctx)[e.y]!));
    return s / Math.max(1, exs.length);
  }

  /** One Adam step on a batch: every weight in full mode, only the adapters in LoRA mode. */
  step(batch: Example[], lr: number): number {
    const [W1, W2] = this.We;
    const g = this.g;
    for (const k of KEYS) g[k].fill(0);
    let L = 0;
    const dh = new Float64Array(H);
    const dinp = new Float64Array(C * D);
    for (const e of batch) {
      const pr = this.probs(e.ctx);
      L -= Math.log(Math.max(1e-12, pr[e.y]!));
      pr[e.y]! -= 1;
      const sc = e.w / batch.length;
      dh.fill(0);
      for (let v = 0; v < V; v++) {
        const dv = pr[v]! * sc;
        g.b2[v]! += dv;
        for (let k = 0; k < H; k++) {
          g.W2[k * V + v]! += this.hid[k]! * dv;
          dh[k]! += W2[k * V + v]! * dv;
        }
      }
      dinp.fill(0);
      for (let k = 0; k < H; k++) {
        const dz = dh[k]! * (1 - this.hid[k]! ** 2);
        g.b1[k]! += dz;
        for (let i = 0; i < C * D; i++) {
          g.W1[i * H + k]! += this.inp[i]! * dz;
          dinp[i]! += W1[i * H + k]! * dz;
        }
      }
      for (let c = 0; c < C; c++) for (let j = 0; j < D; j++) g.E[e.ctx[c]! * D + j]! += dinp[c * D + j]!;
    }
    this.t++;
    const b1c = 1 - 0.9 ** this.t;
    const b2c = 1 - 0.999 ** this.t;
    const adam = (P: Float64Array, G: Float64Array, M: Float64Array, S: Float64Array) => {
      for (let i = 0; i < P.length; i++) {
        M[i] = 0.9 * M[i]! + 0.1 * G[i]!;
        S[i] = 0.999 * S[i]! + 0.001 * G[i]! ** 2;
        P[i]! -= (lr * M[i]! / b1c) / (Math.sqrt(S[i]! / b2c) + 1e-8);
      }
    };
    const lo = this.lora;
    if (!lo) {
      for (const k of KEYS) adam(this.p[k], g[k], this.m[k], this.v[k]);
      return L / batch.length;
    }
    // W is stored input-major (W[i * nout + k]); dL/dB = s G A^T and dL/dA = s B^T G.
    const Gs = [g.W1, g.W2];
    const base = [this.p.W1, this.p.W2];
    for (let l = 0; l < 2; l++) {
      const nin = NIN[l]!, nout = NOUT[l]!, r = lo.r, G = Gs[l]!, A = lo.A[l]!, B = lo.B[l]!;
      const dA = new Float64Array(r * nin);
      const dB = new Float64Array(nout * r);
      for (let i = 0; i < nin; i++)
        for (let k = 0; k < nout; k++) {
          const gik = G[i * nout + k]! * lo.s;
          if (gik === 0) continue;
          for (let j = 0; j < r; j++) {
            dB[k * r + j]! += gik * A[j * nin + i]!;
            dA[j * nin + i]! += gik * B[k * r + j]!;
          }
        }
      adam(A, dA, lo.m[l]!, lo.v[l]!);
      adam(B, dB, lo.m[2 + l]!, lo.v[2 + l]!);
      const We = this.We[l]!, W = base[l]!;
      for (let i = 0; i < nin; i++)
        for (let k = 0; k < nout; k++) {
          let d = 0;
          for (let j = 0; j < r; j++) d += B[k * r + j]! * A[j * nin + i]!;
          We[i * nout + k] = W[i * nout + k]! + lo.s * d;
        }
    }
    return L / batch.length;
  }

  /** Greedy continuation of a prompt, stopping at <end> or after `max` tokens. */
  generate(prompt: number[], max = 9): number[] {
    const seq = [...prompt];
    const out: number[] = [];
    for (let i = 0; i < max; i++) {
      const ctx: number[] = [];
      for (let k = seq.length - C; k < seq.length; k++) ctx.push(k < 0 ? BOS : seq[k]!);
      const pr = this.probs(ctx);
      let best = 0;
      for (let v = 1; v < V; v++) if (pr[v]! > pr[best]!) best = v;
      out.push(best);
      seq.push(best);
      if (best === END) break;
    }
    return out;
  }
}
