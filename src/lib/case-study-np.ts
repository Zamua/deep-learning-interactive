import { Rng } from '../core/rand';

/** A dense row-major matrix: just enough NumPy to run the case-study script literally. */
export interface Mat {
  r: number;
  c: number;
  d: Float64Array;
}

export const zeros = (r: number, c: number): Mat => ({ r, c, d: new Float64Array(r * c) });

export function randn(r: number, c: number, scale: number, rng: Rng): Mat {
  const m = zeros(r, c);
  for (let i = 0; i < m.d.length; i++) m.d[i] = scale * rng.randn();
  return m;
}

/** A (r x k) . B (k x c) */
export function dot(A: Mat, B: Mat): Mat {
  const out = zeros(A.r, B.c);
  for (let i = 0; i < A.r; i++)
    for (let k = 0; k < A.c; k++) {
      const a = A.d[i * A.c + k]!;
      if (a === 0) continue;
      const ob = i * B.c;
      const bb = k * B.c;
      for (let j = 0; j < B.c; j++) out.d[ob + j]! += a * B.d[bb + j]!;
    }
  return out;
}

/** A.T . B, with A (k x r) and B (k x c) */
export function dotTA(A: Mat, B: Mat): Mat {
  const out = zeros(A.c, B.c);
  for (let k = 0; k < A.r; k++)
    for (let i = 0; i < A.c; i++) {
      const a = A.d[k * A.c + i]!;
      if (a === 0) continue;
      const ob = i * B.c;
      const bb = k * B.c;
      for (let j = 0; j < B.c; j++) out.d[ob + j]! += a * B.d[bb + j]!;
    }
  return out;
}

/** A . B.T, with A (r x k) and B (c x k) */
export function dotTB(A: Mat, B: Mat): Mat {
  const out = zeros(A.r, B.r);
  for (let i = 0; i < A.r; i++)
    for (let j = 0; j < B.r; j++) {
      let s = 0;
      for (let k = 0; k < A.c; k++) s += A.d[i * A.c + k]! * B.d[j * B.c + k]!;
      out.d[i * B.r + j] = s;
    }
  return out;
}

/** A + b, broadcasting the (1 x c) row b down every row, in place. */
export function addRow(A: Mat, b: Mat): Mat {
  for (let i = 0; i < A.r; i++) for (let j = 0; j < A.c; j++) A.d[i * A.c + j]! += b.d[j]!;
  return A;
}

/** np.sum(A, axis=0, keepdims=True) */
export function sumRows(A: Mat): Mat {
  const out = zeros(1, A.c);
  for (let i = 0; i < A.r; i++) for (let j = 0; j < A.c; j++) out.d[j]! += A.d[i * A.c + j]!;
  return out;
}

export const sumSq = (A: Mat) => A.d.reduce((s, v) => s + v * v, 0);

/** Softmax loss and the gradient on the scores, exactly as the case study writes them. */
function softmaxLoss(scores: Mat, y: ArrayLike<number>) {
  const N = scores.r;
  const K = scores.c;
  const exp_scores = zeros(N, K);
  for (let i = 0; i < exp_scores.d.length; i++) exp_scores.d[i] = Math.exp(scores.d[i]!);
  const probs = zeros(N, K);
  const correct_logprobs = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = 0; k < K; k++) s += exp_scores.d[i * K + k]!;
    for (let k = 0; k < K; k++) probs.d[i * K + k] = exp_scores.d[i * K + k]! / s;
    correct_logprobs[i] = -Math.log(probs.d[i * K + y[i]!]!);
  }
  const data_loss = correct_logprobs.reduce((a, b) => a + b, 0) / N;
  const dscores = { r: N, c: K, d: Float64Array.from(probs.d) };
  for (let i = 0; i < N; i++) dscores.d[i * K + y[i]!]! -= 1;
  for (let i = 0; i < dscores.d.length; i++) dscores.d[i]! /= N;
  return { exp_scores, probs, correct_logprobs, data_loss, dscores };
}

/** The linear softmax classifier from the case study, keeping every intermediate of its last step. */
export class SoftmaxClassifier {
  W: Mat;
  b: Mat;
  scores!: Mat;
  exp_scores!: Mat;
  probs!: Mat;
  correct_logprobs!: Float64Array;
  data_loss = 0;
  reg_loss = 0;
  loss = 0;
  dscores!: Mat;
  dW!: Mat;
  db!: Mat;

  constructor(D: number, K: number, seed = 1) {
    const rng = new Rng(seed);
    this.W = randn(D, K, 0.01, rng);
    this.b = zeros(1, K);
  }

  /** One full iteration: forward, loss, backward, update. Returns the loss before the update. */
  step(X: Mat, y: ArrayLike<number>, reg: number, step_size: number, update = true): number {
    this.scores = addRow(dot(X, this.W), this.b);
    const sl = softmaxLoss(this.scores, y);
    Object.assign(this, sl);
    this.reg_loss = 0.5 * reg * sumSq(this.W);
    this.loss = this.data_loss + this.reg_loss;
    this.dW = dotTA(X, this.dscores);
    this.db = sumRows(this.dscores);
    for (let i = 0; i < this.dW.d.length; i++) this.dW.d[i]! += reg * this.W.d[i]!;
    if (update) {
      for (let i = 0; i < this.W.d.length; i++) this.W.d[i]! += -step_size * this.dW.d[i]!;
      for (let i = 0; i < this.b.d.length; i++) this.b.d[i]! += -step_size * this.db.d[i]!;
    }
    return this.loss;
  }

  predict(x0: number, x1: number): number {
    const K = this.W.c;
    let best = 0;
    let bs = -Infinity;
    for (let k = 0; k < K; k++) {
      const s = x0 * this.W.d[k]! + x1 * this.W.d[K + k]! + this.b.d[k]!;
      if (s > bs) {
        bs = s;
        best = k;
      }
    }
    return best;
  }
}

/** The two-layer ReLU network from the case study. */
export class TwoLayerNet {
  W: Mat;
  b: Mat;
  W2: Mat;
  b2: Mat;
  hidden_layer!: Mat;
  scores!: Mat;
  probs!: Mat;
  data_loss = 0;
  reg_loss = 0;
  loss = 0;
  dscores!: Mat;
  dW2!: Mat;
  db2!: Mat;
  dhidden!: Mat;
  dW!: Mat;
  db!: Mat;
  private hbuf: Float64Array;

  constructor(D: number, h: number, K: number, seed = 1) {
    const rng = new Rng(seed);
    this.W = randn(D, h, 0.01, rng);
    this.b = zeros(1, h);
    this.W2 = randn(h, K, 0.01, rng);
    this.b2 = zeros(1, K);
    this.hbuf = new Float64Array(h);
  }

  step(X: Mat, y: ArrayLike<number>, reg: number, step_size: number): number {
    const hl = addRow(dot(X, this.W), this.b);
    for (let i = 0; i < hl.d.length; i++) if (hl.d[i]! < 0) hl.d[i] = 0;
    this.hidden_layer = hl;
    this.scores = addRow(dot(hl, this.W2), this.b2);
    const sl = softmaxLoss(this.scores, y);
    this.probs = sl.probs;
    this.data_loss = sl.data_loss;
    this.dscores = sl.dscores;
    this.reg_loss = 0.5 * reg * sumSq(this.W) + 0.5 * reg * sumSq(this.W2);
    this.loss = this.data_loss + this.reg_loss;
    this.dW2 = dotTA(hl, this.dscores);
    this.db2 = sumRows(this.dscores);
    this.dhidden = dotTB(this.dscores, this.W2);
    for (let i = 0; i < hl.d.length; i++) if (hl.d[i]! <= 0) this.dhidden.d[i] = 0;
    this.dW = dotTA(X, this.dhidden);
    this.db = sumRows(this.dhidden);
    for (let i = 0; i < this.dW2.d.length; i++) this.dW2.d[i]! += reg * this.W2.d[i]!;
    for (let i = 0; i < this.dW.d.length; i++) this.dW.d[i]! += reg * this.W.d[i]!;
    const upd = (P: Mat, G: Mat) => {
      for (let i = 0; i < P.d.length; i++) P.d[i]! += -step_size * G.d[i]!;
    };
    upd(this.W, this.dW);
    upd(this.b, this.db);
    upd(this.W2, this.dW2);
    upd(this.b2, this.db2);
    return this.loss;
  }

  predict(x0: number, x1: number): number {
    const h = this.W.c;
    const K = this.W2.c;
    const hb = this.hbuf;
    for (let j = 0; j < h; j++) {
      const v = x0 * this.W.d[j]! + x1 * this.W.d[h + j]! + this.b.d[j]!;
      hb[j] = v > 0 ? v : 0;
    }
    let best = 0;
    let bs = -Infinity;
    for (let k = 0; k < K; k++) {
      let s = this.b2.d[k]!;
      for (let j = 0; j < h; j++) if (hb[j]! > 0) s += hb[j]! * this.W2.d[j * K + k]!;
      if (s > bs) {
        bs = s;
        best = k;
      }
    }
    return best;
  }
}

export function accuracy(model: { predict(a: number, b: number): number }, X: Mat, y: ArrayLike<number>): number {
  let ok = 0;
  for (let i = 0; i < X.r; i++) if (model.predict(X.d[2 * i]!, X.d[2 * i + 1]!) === y[i]) ok++;
  return ok / X.r;
}
