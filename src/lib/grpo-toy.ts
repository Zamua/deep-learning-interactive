import { Rng } from '../core/rand';

/**
 * A toy RLVR world: add two d-digit numbers. A response is a sequence of tokens, each one of
 * `work` (add the next column, sometimes wrongly), `check` (re-add the finished columns, which
 * fixes a wrong digit with probability P_FIX) and `answer` (write the number and stop). The
 * verifier compares the written number with a + b. The policy is a softmax over the three
 * tokens in each state (digits d, columns done c, checks done k): a tabular stand-in for a
 * language model, small enough to train with GRPO in the browser.
 */
export const TOKENS = ['work', 'check', 'answer'] as const;
export const WORK = 0;
export const CHECK = 1;
export const ANSWER = 2;
export const T_MAX = 12;
export const D_MAX = 4;
export const K_CAP = 2;
export const P_ERR = 0.15;
export const P_FIX = 0.7;
const NC = D_MAX + 1;
const NK = K_CAP + 1;
export const N_STATES = D_MAX * NC * NK;

export const stateOf = (d: number, c: number, k: number): number => ((d - 1) * NC + c) * NK + Math.min(k, K_CAP);

export interface Problem {
  a: number;
  b: number;
  d: number;
}

export interface Rollout {
  prob: Problem;
  states: number[];
  acts: number[];
  /** What each token wrote: a column digit, a check mark, or the final number. */
  shown: string[];
  answer: number | null;
  reward: number;
  oldLogp: number[];
  refLogp: number[];
}

export interface GrpoOpts {
  G: number;
  B: number;
  beta: number;
  epsLow: number;
  epsHigh: number;
  lr: number;
  /** Gradient passes over each sampled batch (the clip only matters after the first). */
  mu: number;
  /** 'seq': GRPO's 1/|o_i| then mean over the group; 'const': Dr. GRPO's fixed T_MAX; 'token': DAPO's 1/sum|o_i| over the batch. */
  norm: 'seq' | 'const' | 'token';
  stdNorm: boolean;
  /** DAPO dynamic sampling: drop groups whose rewards are all equal and sample more prompts. */
  dynamic: boolean;
}

export const DEFAULTS: GrpoOpts = { G: 8, B: 8, beta: 0.02, epsLow: 0.2, epsHigh: 0.2, lr: 1.5, mu: 2, norm: 'seq', stdNorm: true, dynamic: false };

export interface StepStats {
  acc: number;
  len: number;
  lenRight: number;
  lenWrong: number;
  /** Fraction of sampled groups whose rewards were all equal (no signal). */
  zeroVar: number;
  /** Mean policy entropy (nats) over the tokens sampled. */
  entropy: number;
  /** Fraction of tokens that are `check`. */
  checkRate: number;
  kl: number;
  clipped: number;
}

/** The "base model": works a column or answers, rarely checks, and is somewhat likelier to answer once every column is done. */
export function baseLogits(): Float64Array {
  const th = new Float64Array(N_STATES * 3);
  for (let d = 1; d <= D_MAX; d++)
    for (let c = 0; c <= D_MAX; c++)
      for (let k = 0; k <= K_CAP; k++) {
        const s = stateOf(d, c, k) * 3;
        th[s + WORK] = 0.5;
        th[s + CHECK] = -1.3;
        th[s + ANSWER] = -0.2 + (c >= d ? 0.9 : 0);
      }
  return th;
}

export function probs(th: Float64Array, s: number, out = new Float64Array(3)): Float64Array {
  const o = s * 3;
  const m = Math.max(th[o]!, th[o + 1]!, th[o + 2]!);
  let z = 0;
  for (let j = 0; j < 3; j++) z += out[j] = Math.exp(th[o + j]! - m);
  for (let j = 0; j < 3; j++) out[j]! /= z;
  return out;
}

export function makeProblem(rng: Rng, d = 1 + rng.int(D_MAX)): Problem {
  const lo = d === 1 ? 1 : 10 ** (d - 1);
  const hi = 10 ** d;
  return { a: lo + rng.int(hi - lo), b: lo + rng.int(hi - lo), d };
}

const digit = (n: number, j: number): number => Math.floor(n / 10 ** j) % 10;

/** One response to `prob`, sampled token by token from the policy `th`. */
export function rollout(th: Float64Array, ref: Float64Array, prob: Problem, rng: Rng): Rollout {
  const { a, b, d } = prob;
  const r: Rollout = { prob, states: [], acts: [], shown: [], answer: null, reward: 0, oldLogp: [], refLogp: [] };
  const col: number[] = [];
  const bad: boolean[] = [];
  let carry = 0;
  let k = 0;
  const p = new Float64Array(3);
  const q = new Float64Array(3);
  for (let t = 0; t < T_MAX; t++) {
    const c = col.length;
    const s = stateOf(d, c, k);
    probs(th, s, p);
    const u = rng.next();
    const act = u < p[0]! ? WORK : u < p[0]! + p[1]! ? CHECK : ANSWER;
    probs(ref, s, q);
    r.states.push(s);
    r.acts.push(act);
    r.oldLogp.push(Math.log(p[act]!));
    r.refLogp.push(Math.log(q[act]!));
    if (act === WORK) {
      if (c < d) {
        const sum = digit(a, c) + digit(b, c) + carry;
        carry = sum >= 10 ? 1 : 0;
        const ok = rng.next() >= P_ERR;
        col.push(ok ? sum % 10 : (sum % 10 + 1 + rng.int(9)) % 10);
        bad.push(!ok);
        r.shown.push(String(col[c]));
      } else r.shown.push('…');
    } else if (act === CHECK) {
      k++;
      for (let j = 0; j < c; j++)
        if (bad[j] && rng.next() < P_FIX) {
          bad[j] = false;
          col[j] = digit(a + b, j);
        }
      r.shown.push('✓?');
    } else {
      // Columns not worked out are guessed, and so is the final carry.
      let ans = 0;
      for (let j = 0; j < d; j++) ans += (j < c ? col[j]! : rng.int(10)) * 10 ** j;
      ans += (c === d ? carry : rng.int(2)) * 10 ** d;
      r.answer = ans;
      r.reward = ans === a + b ? 1 : 0;
      r.shown.push(String(ans));
      break;
    }
  }
  return r;
}

export function advantages(r: number[], stdNorm: boolean): number[] {
  const G = r.length;
  const mean = r.reduce((x, y) => x + y, 0) / G;
  const std = Math.sqrt(r.reduce((x, y) => x + (y - mean) ** 2, 0) / G);
  return r.map((v) => (v - mean) / (stdNorm ? std + 1e-4 : 1));
}

/** A GRPO trainer over the toy world. All randomness is seeded. */
export class ToyGrpo {
  th: Float64Array;
  readonly ref: Float64Array;
  rng: Rng;
  steps = 0;
  history: StepStats[] = [];
  last: { groups: Rollout[][]; adv: number[][] } = { groups: [], adv: [] };

  constructor(
    public opts: GrpoOpts = { ...DEFAULTS },
    seed = 7,
  ) {
    this.ref = baseLogits();
    this.th = baseLogits();
    this.rng = new Rng(seed);
  }

  reset(seed = 7): void {
    this.th = baseLogits();
    this.rng = new Rng(seed);
    this.steps = 0;
    this.history = [];
    this.last = { groups: [], adv: [] };
  }

  /** Samples one batch of groups, then takes `mu` gradient-ascent passes on the GRPO objective. */
  step(): StepStats {
    const o = this.opts;
    const groups: Rollout[][] = [];
    const adv: number[][] = [];
    let seen = 0;
    let flat = 0;
    let tries = 0;
    const all: Rollout[] = [];
    while (groups.length < o.B && tries < o.B * 4) {
      tries++;
      const prob = makeProblem(this.rng);
      const g = Array.from({ length: o.G }, () => rollout(this.th, this.ref, prob, this.rng));
      const r = g.map((x) => x.reward);
      seen++;
      all.push(...g);
      const same = r.every((v) => v === r[0]);
      if (same) flat++;
      if (same && o.dynamic) continue;
      groups.push(g);
      adv.push(advantages(r, o.stdNorm));
    }
    const totalTok = groups.reduce((x, g) => x + g.reduce((y, ro) => y + ro.acts.length, 0), 0);
    const p = new Float64Array(3);
    const grad = new Float64Array(this.th.length);
    let kl = 0;
    let clipped = 0;
    let nt = 0;
    for (let pass = 0; pass < o.mu; pass++) {
      grad.fill(0);
      groups.forEach((g, gi) => {
        g.forEach((ro, i) => {
          const A = adv[gi]![i]!;
          const L = ro.acts.length;
          const w = o.norm === 'seq' ? 1 / (o.G * L * groups.length) : o.norm === 'const' ? 1 / (o.G * T_MAX * groups.length) : 1 / totalTok;
          for (let t = 0; t < L; t++) {
            const s = ro.states[t]!;
            const a = ro.acts[t]!;
            probs(this.th, s, p);
            const logp = Math.log(p[a]!);
            const ratio = Math.exp(logp - ro.oldLogp[t]!);
            const live = A > 0 ? ratio < 1 + o.epsHigh : A < 0 ? ratio > 1 - o.epsLow : false;
            const rr = Math.exp(ro.refLogp[t]! - logp);
            const coef = (live ? A * ratio : 0) - o.beta * (1 - rr);
            if (pass === o.mu - 1) {
              kl += rr - Math.log(rr) - 1;
              if (!live && A !== 0) clipped++;
              nt++;
            }
            for (let j = 0; j < 3; j++) grad[s * 3 + j]! += w * coef * ((j === a ? 1 : 0) - p[j]!);
          }
        });
      });
      for (let j = 0; j < grad.length; j++) this.th[j]! += o.lr * grad[j]!;
    }
    let right = 0;
    let lenR = 0;
    let lenW = 0;
    let len = 0;
    let ent = 0;
    let tok = 0;
    let checks = 0;
    for (const ro of all) {
      len += ro.acts.length;
      if (ro.reward) {
        right++;
        lenR += ro.acts.length;
      } else lenW += ro.acts.length;
      for (let t = 0; t < ro.acts.length; t++) {
        probs(this.th, ro.states[t]!, p);
        ent -= p[0]! * Math.log(p[0]!) + p[1]! * Math.log(p[1]!) + p[2]! * Math.log(p[2]!);
        if (ro.acts[t] === CHECK) checks++;
        tok++;
      }
    }
    const n = all.length;
    const st: StepStats = {
      acc: right / n,
      len: len / n,
      lenRight: right ? lenR / right : 0,
      lenWrong: n - right ? lenW / (n - right) : 0,
      zeroVar: flat / seen,
      entropy: ent / Math.max(1, tok),
      checkRate: checks / Math.max(1, tok),
      kl: kl / Math.max(1, nt),
      clipped: clipped / Math.max(1, nt),
    };
    this.steps++;
    this.history.push(st);
    this.last = { groups, adv };
    return st;
  }

  /** Expected accuracy of the current policy on `n` fresh problems per difficulty (sampled, seeded). */
  evalByDigits(n = 200, seed = 99): number[] {
    const rng = new Rng(seed);
    return Array.from({ length: D_MAX }, (_, i) => {
      let ok = 0;
      for (let j = 0; j < n; j++) ok += rollout(this.th, this.ref, makeProblem(rng, i + 1), rng).reward;
      return ok / n;
    });
  }
}
