import { Rng } from '../core/rand';

// The running example: a model answers "Is 91 prime?" (it is not: 91 = 7 x 13).

export const PROMPT = 'Is 91 prime?';
/** Four whole answers: the arms of the bandit. */
export const ANSWERS = ['Yes.', 'Yes, odd.', 'No.', 'No, 7×13.'];
/** A grader's score: correct with a reason 1, correct 0.5, wrong 0. */
export const REWARD = [0, 0, 0.5, 1];
/** The base model's probability of each answer: the products along TREE. */
export const PI0 = [0.4, 0.1, 0.3, 0.2];
export const K = ANSWERS.length;

export interface TreeTok {
  tok: string;
  p: number;
}
/** Two tokens per answer: the first, then the second given the first. */
export const TREE: { first: TreeTok[]; second: TreeTok[][] } = {
  first: [
    { tok: 'Yes', p: 0.5 },
    { tok: 'No', p: 0.5 },
  ],
  second: [
    [
      { tok: '.', p: 0.8 },
      { tok: ', odd.', p: 0.2 },
    ],
    [
      { tok: '.', p: 0.6 },
      { tok: ', 7×13.', p: 0.4 },
    ],
  ],
};
/** Leaf index (into ANSWERS) for first token i, second token j. */
export const leafOf = (i: number, j: number): number => i * 2 + j;

// ---------------------------------------------------------------- math

export function softmax(theta: ArrayLike<number>): number[] {
  let m = -Infinity;
  for (let i = 0; i < theta.length; i++) m = Math.max(m, theta[i]!);
  const e = Array.from(theta, (v) => Math.exp(v - m));
  const s = e.reduce((a, v) => a + v, 0);
  return e.map((v) => v / s);
}

export function sampleFrom(p: ArrayLike<number>, rng: Rng): number {
  let u = rng.next();
  for (let i = 0; i < p.length; i++) {
    u -= p[i]!;
    if (u < 0) return i;
  }
  return p.length - 1;
}

export const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
};

export const expectedReward = (pi: ArrayLike<number>, R: ArrayLike<number> = REWARD): number => dot(pi, R);

/** grad of log softmax(theta)[y] with respect to theta: onehot(y) - pi. */
export const gradLogPi = (pi: ArrayLike<number>, y: number): number[] => Array.from(pi, (p, i) => (i === y ? 1 : 0) - p);

/** The exact policy gradient sum_y pi(y) R(y) grad log pi(y) = pi * (R - J). */
export function exactGrad(pi: ArrayLike<number>, R: ArrayLike<number> = REWARD): number[] {
  const J = dot(pi, R);
  return Array.from(pi, (p, i) => p * (R[i]! - J));
}

export function entropy(p: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) if (p[i]! > 0) h -= p[i]! * Math.log(p[i]!);
  return h;
}

/** grad of the entropy of softmax(theta): -pi * (log pi + H). */
export function entropyGrad(pi: ArrayLike<number>): number[] {
  const H = entropy(pi);
  return Array.from(pi, (p) => (p > 0 ? -p * (Math.log(p) + H) : 0));
}

export function kl(p: ArrayLike<number>, q: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) if (p[i]! > 0) s += p[i]! * Math.log(p[i]! / q[i]!);
  return s;
}

/** The maximizer of E[R] - beta KL(pi || ref): ref * exp(R / beta), normalized. */
export function optimalPolicy(ref: ArrayLike<number>, R: ArrayLike<number>, beta: number): number[] {
  return softmax(Array.from(ref, (q, i) => Math.log(q) + R[i]! / beta));
}

/**
 * Mean squared distance of the one-sample estimate (R(y) + c - b) * grad log pi(y) from the
 * true gradient: the estimator's noise.
 */
export function gradNoise(pi: ArrayLike<number>, R: ArrayLike<number>, c: number, b: number): number {
  const g = exactGrad(pi, R);
  let v = 0;
  for (let y = 0; y < pi.length; y++) {
    const gl = gradLogPi(pi, y);
    const w = R[y]! + c - b;
    let d = 0;
    for (let i = 0; i < pi.length; i++) d += (w * gl[i]! - g[i]!) ** 2;
    v += pi[y]! * d;
  }
  return v;
}

// ---------------------------------------------------------------- REINFORCE

export interface PgOpts {
  lr: number;
  /** Rewards the policy is trained on (default REWARD). */
  R?: number[];
  /** Added to every training reward: the gradient's average ignores it, its noise does not. */
  offset?: number;
  /** Subtract a running mean of past rewards. */
  baseline?: boolean;
  /** Entropy bonus coefficient (exact gradient, as it is computed per token in practice). */
  ent?: number;
  /** KL penalty: the reward becomes R - beta (log pi(y) - log ref(y)). */
  beta?: number;
  ref?: number[];
  /** Samples per update. */
  batch?: number;
}

export interface PgStep {
  ys: number[];
  rs: number[];
  /** Baseline used for this update. */
  b: number;
  As: number[];
  /** Policy before the update. */
  pi: number[];
  /** Change in theta. */
  dtheta: number[];
}

/** REINFORCE on a softmax policy over whole answers, one update per `step()`. */
export class Pg {
  theta: number[];
  b: number | null = null;
  t = 0;
  opts: PgOpts;
  readonly rng: Rng;
  constructor(pi0: number[], opts: PgOpts, seed: number) {
    this.theta = pi0.map(Math.log);
    this.opts = opts;
    this.rng = new Rng(seed);
  }
  get pi(): number[] {
    return softmax(this.theta);
  }
  step(): PgStep {
    const o = this.opts;
    const R = o.R ?? REWARD;
    const n = o.batch ?? 1;
    const pi = this.pi;
    const ys: number[] = [];
    const rs: number[] = [];
    for (let k = 0; k < n; k++) {
      const y = sampleFrom(pi, this.rng);
      let r = R[y]! + (o.offset ?? 0);
      if (o.beta && o.ref) r -= o.beta * (Math.log(pi[y]!) - Math.log(o.ref[y]!));
      ys.push(y);
      rs.push(r);
    }
    const mean = rs.reduce((a, v) => a + v, 0) / n;
    if (o.baseline && this.b === null) this.b = mean;
    const b = o.baseline ? this.b! : 0;
    const As = rs.map((r) => r - b);
    const dtheta = new Array<number>(pi.length).fill(0);
    ys.forEach((y, k) => {
      const gl = gradLogPi(pi, y);
      for (let i = 0; i < pi.length; i++) dtheta[i]! += (o.lr * As[k]! * gl[i]!) / n;
    });
    if (o.ent) {
      const eg = entropyGrad(pi);
      for (let i = 0; i < pi.length; i++) dtheta[i]! += o.lr * o.ent * eg[i]!;
    }
    for (let i = 0; i < pi.length; i++) this.theta[i]! += dtheta[i]!;
    if (o.baseline) this.b = 0.9 * this.b! + 0.1 * mean;
    this.t++;
    return { ys, rs, b, As, pi, dtheta };
  }
}

/** Expected (true, unshifted) reward after every step, for each seed. */
export function curves(pi0: number[], opts: PgOpts, seeds: number[], steps: number, score: number[] = REWARD): Float64Array[] {
  return seeds.map((seed) => {
    const pg = new Pg(pi0, opts, seed);
    const out = new Float64Array(steps + 1);
    out[0] = dot(pg.pi, score);
    for (let t = 1; t <= steps; t++) {
      pg.step();
      out[t] = dot(pg.pi, score);
    }
    return out;
  });
}

/** Policies after every step, for each seed. */
export function trajectories(pi0: number[], opts: PgOpts, seeds: number[], steps: number): number[][][] {
  return seeds.map((seed) => {
    const pg = new Pg(pi0, opts, seed);
    const out = [pg.pi];
    for (let t = 1; t <= steps; t++) {
      pg.step();
      out.push(pg.pi);
    }
    return out;
  });
}

// ---------------------------------------------------------------- variance figure

export const VAR_LR = 0.3;
export const VAR_STEPS = 150;
export const VAR_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// ---------------------------------------------------------------- credit assignment

/** Responses of three chunks: an opener, a piece of work, a verdict. Only the verdict is graded. */
export const CHUNKS = ['Let me think.', 'Good question!', '91 = 7×13.', '91 is odd.', 'Not prime.', 'Prime.'];
export const P_OPEN = 0.5;
export const P_FACTOR = 0.4;
/** P("Not prime." | the work chunk): factoring nearly always leads to the right verdict. */
export const P_RIGHT = [0.9, 0.3];
/** E[R] = P_FACTOR * 0.9 + (1 - P_FACTOR) * 0.3. */
export const CREDIT_ER = P_FACTOR * P_RIGHT[0]! + (1 - P_FACTOR) * P_RIGHT[1]!;
/** Where each chunk's average advantage settles with many samples: E[R | chunk] - E[R]. */
export const CREDIT_LIMIT = [0, 0, P_RIGHT[0]! - CREDIT_ER, P_RIGHT[1]! - CREDIT_ER, 1 - CREDIT_ER, -CREDIT_ER];

export interface Response {
  parts: [number, number, number];
  R: number;
}

export function sampleResponse(rng: Rng): Response {
  const o = rng.next() < P_OPEN ? 0 : 1;
  const wk = rng.next() < P_FACTOR ? 0 : 1;
  const right = rng.next() < P_RIGHT[wk]!;
  return { parts: [o, 2 + wk, right ? 4 : 5], R: right ? 1 : 0 };
}

/** Advantages with the batch mean as baseline, and each chunk's average advantage. */
export function creditStats(rs: Response[]): { A: number[]; avg: (number | null)[]; count: number[] } {
  const mean = rs.reduce((a, r) => a + r.R, 0) / Math.max(1, rs.length);
  const A = rs.map((r) => r.R - mean);
  const sum = new Array<number>(CHUNKS.length).fill(0);
  const count = new Array<number>(CHUNKS.length).fill(0);
  rs.forEach((r, i) =>
    r.parts.forEach((c) => {
      sum[c]! += A[i]!;
      count[c]!++;
    }),
  );
  return { A, avg: sum.map((s, c) => (count[c] ? s / count[c]! : null)), count };
}

// ---------------------------------------------------------------- KL figure

/** A learned reward model with a blind spot: it loves the shouted fifth answer. */
export const ANSWERS_KL = [...ANSWERS, 'No!! 7×13!!'];
export const REF_KL = [0.39, 0.1, 0.28, 0.2, 0.03];
export const RM_KL = [0, 0, 0.5, 1, 1.2];
export const TRUE_KL = [0, 0, 0.5, 1, 0];

// ---------------------------------------------------------------- entropy figure

/** A base model that rarely explains itself: the best answer starts at 5%. */
export const PI0_EXPLORE = [0.3, 0.1, 0.55, 0.05];
export const EXPLORE_LR = 2;
export const EXPLORE_STEPS = 300;
export const EXPLORE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
