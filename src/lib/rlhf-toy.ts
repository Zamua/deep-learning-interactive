import { Rng } from '../core/rand';

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
/** log(1 + e^x), stable for large x. */
export const softplus = (x: number): number => (x > 30 ? x : Math.log1p(Math.exp(x)));
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export function softmax(z: number[]): number[] {
  const mx = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// ---------------------------------------------------------------- answers as points

/**
 * The toy world for the reward model and over-optimization figures: an answer is a point with
 * two features, its length (hundreds of tokens) and its quality. The SFT model's answers to
 * one prompt are a Gaussian cloud: length varies a lot, quality only a little.
 */
export const SFT = { l: 1.5, q: 0.5, sl: 0.6, sq: 0.06 };

/** The labelers' hidden taste: quality counts most; some length helps, too much hurts. */
export const taste = (l: number, q: number): number => 10 * q + 2.5 * l - 0.5 * l * l;

export type Pt = [number, number];
export interface Pair {
  chosen: Pt;
  rejected: Pt;
}

export function sampleAnswer(r: Rng): Pt {
  return [Math.max(0.1, SFT.l + SFT.sl * r.randn()), SFT.q + SFT.sq * r.randn()];
}

/** Labelers compare two SFT answers and pick one with Bradley-Terry odds under their taste. */
export function samplePairs(n: number, seed: number): Pair[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => {
    const a = sampleAnswer(r);
    const b = sampleAnswer(r);
    const aWins = r.next() < sigmoid(taste(a[0], a[1]) - taste(b[0], b[1]));
    return aWins ? { chosen: a, rejected: b } : { chosen: b, rejected: a };
  });
}

/** What the reward model reads: length and quality, standardized over the SFT answers. */
export const feats = (y: Pt): Pt => [(y[0] - SFT.l) / SFT.sl, (y[1] - SFT.q) / SFT.sq];

/** A linear reward model r(y) = w . feats(y), fit with the Bradley-Terry loss. */
export class LinearRM {
  w: Pt = [0, 0];
  score(y: Pt): number {
    const f = feats(y);
    return this.w[0] * f[0] + this.w[1] * f[1];
  }
  loss(pairs: Pair[]): number {
    let s = 0;
    for (const p of pairs) s += softplus(-(this.score(p.chosen) - this.score(p.rejected)));
    return s / pairs.length;
  }
  /** One full-batch gradient step on the mean of -log sigmoid(margin). */
  step(pairs: Pair[], lr: number): void {
    let g0 = 0;
    let g1 = 0;
    for (const p of pairs) {
      const fc = feats(p.chosen);
      const fr = feats(p.rejected);
      const d0 = fc[0] - fr[0];
      const d1 = fc[1] - fr[1];
      const k = sigmoid(-(this.w[0] * d0 + this.w[1] * d1));
      g0 -= k * d0;
      g1 -= k * d1;
    }
    const n = pairs.length;
    this.w = [this.w[0] - (lr * g0) / n, this.w[1] - (lr * g1) / n];
  }
  accuracy(pairs: Pair[]): number {
    let k = 0;
    for (const p of pairs) {
      const d = this.score(p.chosen) - this.score(p.rejected);
      k += d > 0 ? 1 : d === 0 ? 0.5 : 0;
    }
    return k / pairs.length;
  }
}

/** How often the labelers' own taste agrees with their noisy choices: the ceiling for any RM. */
export function tasteAccuracy(pairs: Pair[]): number {
  let k = 0;
  for (const p of pairs) if (taste(p.chosen[0], p.chosen[1]) > taste(p.rejected[0], p.rejected[1])) k++;
  return k / pairs.length;
}

export function trainedRM(n = 400, seed = 7, steps = 400): LinearRM {
  const rm = new LinearRM();
  const pairs = samplePairs(n, seed);
  for (let i = 0; i < steps; i++) rm.step(pairs, 1);
  return rm;
}

/** Answer coordinates of a point given in standardized units. */
export const unstd = (m: Pt): Pt => [SFT.l + SFT.sl * m[0], SFT.q + SFT.sq * m[1]];

/** The labelers' expected taste for a policy cloud centered at m (standardized), same spread as SFT. */
export function expectedTaste(m: Pt): number {
  const [l, q] = unstd(m);
  return 10 * q + 2.5 * l - 0.5 * (l * l + SFT.sl * SFT.sl);
}

/**
 * The policy for the over-optimization figure: a Gaussian over answers with the SFT spread and a
 * movable center m (standardized units). Its KL to the SFT cloud is |m|^2 / 2. Each step is a
 * REINFORCE update with mean-centered advantages on reward = r(y) - beta * (log pi - log pi_ref).
 */
export class GaussPolicy {
  m: Pt = [0, 0];
  samples: Pt[] = [];
  private rng: Rng;
  constructor(
    readonly rm: LinearRM,
    public beta: number,
    seed = 3,
  ) {
    this.rng = new Rng(seed);
  }
  get kl(): number {
    return (this.m[0] ** 2 + this.m[1] ** 2) / 2;
  }
  get proxy(): number {
    return this.rm.w[0] * this.m[0] + this.rm.w[1] * this.m[1];
  }
  get gold(): number {
    return expectedTaste(this.m);
  }
  step(batch = 64, lr = 0.05): void {
    const e: Pt[] = [];
    const rew: number[] = [];
    const [m0, m1] = this.m;
    const [w0, w1] = this.rm.w;
    for (let i = 0; i < batch; i++) {
      const a = this.rng.randn();
      const b = this.rng.randn();
      e.push([a, b]);
      // log pi - log pi_ref for a shared spread: m . e + |m|^2 / 2
      const kl = m0 * a + m1 * b + (m0 * m0 + m1 * m1) / 2;
      rew.push(w0 * (m0 + a) + w1 * (m1 + b) - this.beta * kl);
    }
    const mean = rew.reduce((s, v) => s + v, 0) / batch;
    let g0 = 0;
    let g1 = 0;
    for (let i = 0; i < batch; i++) {
      const adv = rew[i]! - mean;
      g0 += (adv * e[i]![0]) / batch;
      g1 += (adv * e[i]![1]) / batch;
    }
    this.m = [m0 + lr * g0, m1 + lr * g1];
    this.samples = e.slice(0, 40).map(([a, b]) => unstd([m0 + a, m1 + b]));
  }
}

// ---------------------------------------------------------------- the clipped objective

export const clipObj = (rho: number, A: number, eps: number): number => Math.min(rho * A, clamp(rho, 1 - eps, 1 + eps) * A);

/** d/d(rho) of the clipped objective: A where the unclipped term wins the min, else 0. */
export const clipSlope = (rho: number, A: number, eps: number): number => (rho * A <= clamp(rho, 1 - eps, 1 + eps) * A ? A : 0);

// ---------------------------------------------------------------- the importance ratio on a bandit

/**
 * Five kinds of answer to one prompt. Each sampled answer's reward is its kind's mean plus noise,
 * the way two "clear story" answers still get different scores from a reward model.
 */
export const ANSWERS = ['story', 'jargon', 'rude', 'tangent', 'dry'];
export const R_ANS = [1.5, 0.2, -2.0, 0.5, 0.8];
export const R_NOISE = 1.5;
export const LOGITS_INIT = [0.0, 0.4, -0.3, 0.5, 0.3];
export const BANDIT = { iters: 30, batch: 12, lr: 0.5, runs: 16 };

export const expectedReward = (logits: number[]): number => softmax(logits).reduce((s, p, k) => s + p * R_ANS[k]!, 0);

export interface BanditRun {
  /** Expected reward of the policy before each batch, and after the last. */
  J: number[];
  probs: number[];
}

/** One PPO run on the bandit: fresh batch each iteration, K gradient steps on its surrogate. */
export function banditRun(seed: number, K: number, eps: number | null): BanditRun {
  const r = new Rng(seed);
  let logits = [...LOGITS_INIT];
  const J: number[] = [];
  const { iters, batch: N, lr } = BANDIT;
  for (let it = 0; it <= iters; it++) {
    J.push(expectedReward(logits));
    if (it === iters) break;
    const pOld = softmax(logits);
    const a: number[] = [];
    const rew: number[] = [];
    for (let i = 0; i < N; i++) {
      const u = r.next();
      let k = 0;
      for (let c = pOld[0]!; k < 4 && u >= c; ) c += pOld[++k]!;
      a.push(k);
      rew.push(R_ANS[k]! + R_NOISE * r.randn());
    }
    const mean = rew.reduce((s, v) => s + v, 0) / N;
    const adv = rew.map((v) => v - mean);
    for (let step = 0; step < K; step++) {
      const p = softmax(logits);
      const g = [0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        const k = a[i]!;
        const ratio = p[k]! / pOld[k]!;
        if (eps !== null && clipSlope(ratio, adv[i]!, eps) === 0) continue;
        for (let j = 0; j < 5; j++) g[j]! += (adv[i]! * ratio * ((j === k ? 1 : 0) - p[j]!)) / N;
      }
      logits = logits.map((v, j) => v + lr * g[j]!);
    }
  }
  return { J, probs: softmax(logits) };
}

export function banditRuns(K: number, eps: number | null): BanditRun[] {
  return Array.from({ length: BANDIT.runs }, (_, i) => banditRun(100 + i, K, eps));
}

// ---------------------------------------------------------------- GAE on a toy chain

/**
 * A rollout of T tokens, each good with probability P. The reward arrives on the last token:
 * the number of good tokens plus noise. The true value before token t is q_t + (T - t) P, where
 * q_t counts good tokens so far, so the true advantage of a good token is 1 - P and of a bad
 * one -P: the gap between them is exactly 1.
 */
export const GAE_T = 10;
export const GAE_P = 0.5;
export interface Rollout {
  good: boolean[];
  R: number;
}

export function rollouts(n: number, seed: number): Rollout[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => {
    const good = Array.from({ length: GAE_T }, () => r.next() < GAE_P);
    return { good, R: good.filter(Boolean).length + r.randn() };
  });
}

/** A flawed critic: a blend of the true value and a constant guess, weighted by k. */
export function criticValues(ro: Rollout, k: number): number[] {
  const v: number[] = [];
  let q = 0;
  for (let t = 0; t < GAE_T; t++) {
    v.push((1 - k) * (q + (GAE_T - t) * GAE_P) + k * GAE_T * GAE_P);
    if (ro.good[t]) q++;
  }
  v.push(0);
  return v;
}

export function gae(ro: Rollout, lam: number, k: number, gamma = 1): { values: number[]; deltas: number[]; adv: number[] } {
  const values = criticValues(ro, k);
  const deltas: number[] = new Array(GAE_T).fill(0);
  const adv: number[] = new Array(GAE_T).fill(0);
  let last = 0;
  for (let t = GAE_T - 1; t >= 0; t--) {
    const rew = t === GAE_T - 1 ? ro.R : 0;
    deltas[t] = rew + gamma * values[t + 1]! - values[t]!;
    last = deltas[t]! + gamma * lam * last;
    adv[t] = last;
  }
  return { values, deltas, adv };
}

/** Over many rollouts: how far apart good and bad tokens land at step t (ideal 1), and the noise. */
export function gaeStats(ros: Rollout[], t: number, lam: number, k: number): { gap: number; spread: number; good: number[]; bad: number[] } {
  const good: number[] = [];
  const bad: number[] = [];
  for (const ro of ros) (ro.good[t] ? good : bad).push(gae(ro, lam, k).adv[t]!);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const sd = (a: number[]) => {
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1));
  };
  return { gap: mean(good) - mean(bad), spread: (sd(good) + sd(bad)) / 2, good, bad };
}

// ---------------------------------------------------------------- per-token KL

/** One sampled answer with made-up per-token log-probabilities under the policy and the reference. */
export const LINE = {
  prompt: 'Describe the sea in one line.',
  tokens: ['Sure', '!', ' Waves', ' fold', ' into', ' foam', ',', ' and', ' the', ' moon', ' pulls', ' them', ' home', '.'],
  logp: [-0.3, -0.2, -2.2, -2.9, -1.3, -0.7, -0.8, -1.3, -0.5, -2.1, -2.0, -1.4, -0.7, -0.4],
  logpRef: [-3.4, -1.2, -2.6, -3.1, -1.4, -0.9, -1.0, -1.5, -0.6, -1.9, -2.2, -1.6, -0.8, -0.5],
  reward: 1.8,
};

/** Per-token rewards: -beta times the log ratio, plus the reward model's score on the last token. */
export function tokenRewards(beta: number): number[] {
  const n = LINE.tokens.length;
  return LINE.tokens.map((_, t) => -beta * (LINE.logp[t]! - LINE.logpRef[t]!) + (t === n - 1 ? LINE.reward : 0));
}

// ---------------------------------------------------------------- memory

/** Bytes per parameter: trained in mixed precision with Adam, or frozen in bf16. */
export const BYTES_TRAIN = 16;
export const BYTES_FROZEN = 2;
