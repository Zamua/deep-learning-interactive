// Toy transformer pieces shared by the chapter and the lecture. Import-free, so plain Node can run it.

export type Mat = number[][];

export const VOCAB = ['the', 'cat', 'dog', 'sat', 'on', 'mat'] as const;
export type Word = (typeof VOCAB)[number];
export const SENTENCE: Word[] = ['the', 'cat', 'sat', 'on', 'the', 'mat'];

/* ------------------------------------------------------------------ linear algebra */

export function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => new Array<number>(c).fill(0));
}
export function matmul(A: Mat, B: Mat): Mat {
  const n = B[0]!.length;
  return A.map((row) => {
    const out = new Array<number>(n).fill(0);
    row.forEach((a, k) => {
      const b = B[k]!;
      for (let j = 0; j < n; j++) out[j]! += a * b[j]!;
    });
    return out;
  });
}
export function transpose(A: Mat): Mat {
  return A[0]!.map((_, j) => A.map((r) => r[j]!));
}
export function add(A: Mat, B: Mat): Mat {
  return A.map((r, i) => r.map((v, j) => v + B[i]![j]!));
}
export function scale(A: Mat, s: number): Mat {
  return A.map((r) => r.map((v) => v * s));
}
export function softmax(v: number[]): number[] {
  const m = Math.max(...v);
  const e = v.map((x) => (x === -Infinity ? 0 : Math.exp(x - m)));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}
/** Row-wise softmax; with `causal`, entry (i, j > i) is masked to -inf first. */
export function softmaxRows(S: Mat, causal = false): Mat {
  return S.map((r, i) => softmax(causal ? r.map((v, j) => (j > i ? -Infinity : v)) : r));
}
export function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}
export function std(v: number[]): number {
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}
/** Layer norm without learned gain and shift (gamma = 1, beta = 0). */
export function layerNorm(X: Mat, eps = 1e-5): Mat {
  return X.map((r) => {
    const m = mean(r);
    const s = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length + eps);
    return r.map((v) => (v - m) / s);
  });
}

/** Deterministic standard normals (mulberry32 + Box-Muller). */
export function gaussians(seed: number): () => number {
  let s = seed >>> 0;
  const u = () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    let a = 0;
    while (a === 0) a = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };
}
export function randMat(g: () => number, r: number, c: number, sd: number): Mat {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => g() * sd));
}

/* ------------------------------------------------------------------ positions */

/** Sinusoidal encodings: P[pos, 2i] = sin(pos / base^(2i/d)), P[pos, 2i+1] = cos(same). */
export function sinusoids(T: number, d: number, base = 10000): Mat {
  return Array.from({ length: T }, (_, pos) =>
    Array.from({ length: d }, (_, j) => {
      const i2 = j - (j % 2);
      const ang = pos / base ** (i2 / d);
      return j % 2 === 0 ? Math.sin(ang) : Math.cos(ang);
    }),
  );
}

/* ------------------------------------------------------------------ figure 1: one head, by hand */

/** A 4-number embedding per word, chosen by hand so the numbers stay readable. */
export const E4: Record<Word, number[]> = {
  the: [0.2, -0.6, 0.9, 0.1],
  cat: [1.0, 0.4, -0.3, 0.8],
  dog: [0.9, 0.6, -0.2, 0.7],
  sat: [-0.5, 1.0, 0.4, -0.6],
  on: [-0.2, -0.4, 0.8, -0.9],
  mat: [0.7, -0.3, -0.5, 0.9],
};
export const WQ4: Mat = [[0.9, -0.3], [0.8, 0.6], [-0.7, 0.4], [0.2, -0.9]];
export const WK4: Mat = [[0.8, 0.2], [-0.4, 0.7], [-0.6, -0.5], [0.9, 0.3]];
export const WV4: Mat = [[0.5, -0.8], [0.9, 0.3], [-0.2, 0.7], [0.4, -0.6]];

export interface AttnTrace {
  X: Mat;
  Q: Mat;
  K: Mat;
  V: Mat;
  /** Scaled scores Q K^T / sqrt(d_k). */
  S: Mat;
  A: Mat;
  out: Mat;
}

export function attention(X: Mat, Wq: Mat, Wk: Mat, Wv: Mat, causal = false): AttnTrace {
  const Q = matmul(X, Wq);
  const K = matmul(X, Wk);
  const V = matmul(X, Wv);
  const S = scale(matmul(Q, transpose(K)), 1 / Math.sqrt(Wq[0]!.length));
  const A = softmaxRows(S, causal);
  return { X, Q, K, V, S, A, out: matmul(A, V) };
}

export function embed4(tokens: readonly Word[], withPositions = false): Mat {
  const P = sinusoids(tokens.length, 4);
  return tokens.map((t, i) => E4[t].map((v, j) => v + (withPositions ? P[i]![j]! : 0)));
}

export function fig1(tokens: readonly Word[] = SENTENCE, withPositions = false): AttnTrace {
  return attention(embed4(tokens, withPositions), WQ4, WK4, WV4);
}

/* ------------------------------------------------------------------ hand-built heads */

/**
 * Toy input of width 12: a one-hot word (columns 0-5) plus sinusoidal position features
 * (columns 6-11, base 10 so six positions are told apart). The two never overlap, so
 * adding them keeps both readable.
 */
export const HEAD_DK = 6;
const POS_BASE = 10;
const OMEGA = [0, 1, 2].map((i) => 1 / POS_BASE ** ((2 * i) / HEAD_DK));

export function toyX(tokens: readonly Word[]): Mat {
  const P = sinusoids(tokens.length, HEAD_DK, POS_BASE);
  return tokens.map((t, i) => {
    const row = new Array<number>(12).fill(0);
    row[VOCAB.indexOf(t)] = 1;
    for (let j = 0; j < HEAD_DK; j++) row[6 + j] = P[i]![j]!;
    return row;
  });
}

export const HEADS = ['previous word', 'next word', 'nouns', 'same word'] as const;
export type HeadName = (typeof HEADS)[number];
const NOUNS = new Set<Word>(['cat', 'dog', 'mat']);

/** W_Q and W_K (12 x 6) for one hand-built head. */
export function headWeights(name: HeadName): { Wq: Mat; Wk: Mat } {
  const Wq = zeros(12, HEAD_DK);
  const Wk = zeros(12, HEAD_DK);
  if (name === 'previous word' || name === 'next word') {
    // A query is the position encoding shifted by one step: a rotation of each (sin, cos) pair.
    const dir = name === 'previous word' ? -1 : 1;
    const g = 14;
    OMEGA.forEach((w, f) => {
      const r = 6 + 2 * f;
      const c = 2 * f;
      Wq[r]![c] = g * Math.cos(w);
      Wq[r + 1]![c] = g * dir * Math.sin(w);
      Wq[r]![c + 1] = -g * dir * Math.sin(w);
      Wq[r + 1]![c + 1] = g * Math.cos(w);
      Wk[r]![c] = 1;
      Wk[r + 1]![c + 1] = 1;
    });
  } else if (name === 'nouns') {
    const g = Math.sqrt(4 * Math.sqrt(HEAD_DK));
    VOCAB.forEach((w, i) => {
      Wq[i]![0] = g;
      if (NOUNS.has(w)) Wk[i]![0] = g;
    });
  } else {
    const g = Math.sqrt(5 * Math.sqrt(HEAD_DK));
    VOCAB.forEach((_, i) => {
      Wq[i]![i] = g;
      Wk[i]![i] = g;
    });
  }
  return { Wq, Wk };
}

export function headAttention(tokens: readonly Word[], name: HeadName, causal = false): { S: Mat; A: Mat } {
  const X = toyX(tokens);
  const { Wq, Wk } = headWeights(name);
  const S = scale(matmul(matmul(X, Wq), transpose(matmul(X, Wk))), 1 / Math.sqrt(HEAD_DK));
  return { S, A: softmaxRows(S, causal) };
}

/* ------------------------------------------------------------------ one block, traced */

export const BLOCK_D = 8;
export const BLOCK_FF = 32;
export const BLOCK_HEADS = 2;

export interface BlockStage {
  key: 'x' | 'attn' | 'add1' | 'ln1' | 'ffn1' | 'ffn2' | 'add2' | 'ln2';
  M: Mat;
}

/** A post-norm block (as in the 2017 paper) on the toy sentence, with every intermediate kept. */
export function blockTrace(tokens: readonly Word[] = SENTENCE, seed = 7): BlockStage[] {
  const g = gaussians(seed);
  const d = BLOCK_D;
  const dk = d / BLOCK_HEADS;
  const E = randMat(g, VOCAB.length, d, 1);
  const P = sinusoids(tokens.length, d);
  const x0 = tokens.map((t, i) => E[VOCAB.indexOf(t)]!.map((v, j) => v + P[i]![j]!));
  const sd = 1 / Math.sqrt(d);
  const Wq = randMat(g, d, d, sd);
  const Wk = randMat(g, d, d, sd);
  const Wv = randMat(g, d, d, sd);
  const Wo = randMat(g, d, d, sd);
  const W1 = randMat(g, d, BLOCK_FF, sd);
  const b1 = Array.from({ length: BLOCK_FF }, () => g() * 0.1);
  const W2 = randMat(g, BLOCK_FF, d, 1 / Math.sqrt(BLOCK_FF));
  const Q = matmul(x0, Wq);
  const K = matmul(x0, Wk);
  const V = matmul(x0, Wv);
  const heads: Mat[] = [];
  for (let h = 0; h < BLOCK_HEADS; h++) {
    const cols = (M: Mat) => M.map((r) => r.slice(h * dk, (h + 1) * dk));
    const A = softmaxRows(scale(matmul(cols(Q), transpose(cols(K))), 1 / Math.sqrt(dk)));
    heads.push(matmul(A, cols(V)));
  }
  const concat = x0.map((_, i) => heads.flatMap((H) => H[i]!));
  const a = matmul(concat, Wo);
  const add1 = add(x0, a);
  const ln1 = layerNorm(add1);
  const ffn1 = matmul(ln1, W1).map((r) => r.map((v, j) => Math.max(0, v + b1[j]!)));
  const ffn2 = matmul(ffn1, W2);
  const add2 = add(ln1, ffn2);
  const ln2 = layerNorm(add2);
  return [
    { key: 'x', M: x0 },
    { key: 'attn', M: a },
    { key: 'add1', M: add1 },
    { key: 'ln1', M: ln1 },
    { key: 'ffn1', M: ffn1 },
    { key: 'ffn2', M: ffn2 },
    { key: 'add2', M: add2 },
    { key: 'ln2', M: ln2 },
  ];
}

/* ------------------------------------------------------------------ parameter count */

export interface ParamCount {
  attn: number;
  mlp: number;
  perBlock: number;
  blocks: number;
  embed: number;
  total: number;
}

/** Weights of a decoder-only stack, ignoring biases and layer-norm gains (well under 1%). */
export function paramCount(d: number, layers: number, vocab: number): ParamCount {
  const attn = 4 * d * d;
  const mlp = 2 * d * 4 * d;
  const perBlock = attn + mlp;
  const blocks = layers * perBlock;
  const embed = vocab * d;
  return { attn, mlp, perBlock, blocks, embed, total: blocks + embed };
}

/** 123456789 -> "123M", 1.2e11 -> "120B". */
export function human(n: number): string {
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [u, s] of units) if (n >= u) return `${Number((n / u).toPrecision(3))}${s}`;
  return String(Math.round(n));
}
