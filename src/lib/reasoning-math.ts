import { Rng } from '../core/rand';

// ---------------------------------------------------------------- cups: serial steps per token

export const CUPS = 5;
export const MAX_SWAPS = 12;
export type Swap = [number, number];

/** A fixed list of MAX_SWAPS random swaps of two of the five cups; figures use a prefix of it. */
export function makeSwaps(seed: number): Swap[] {
  const r = new Rng(seed);
  return Array.from({ length: MAX_SWAPS }, (): Swap => {
    const i = r.int(CUPS);
    let j = r.int(CUPS - 1);
    if (j >= i) j++;
    return [Math.min(i, j), Math.max(i, j)];
  });
}

export const applySwap = (ball: number, [i, j]: Swap): number => (ball === i ? j : ball === j ? i : ball);

/** One forward pass: swaps [from, to) applied by layers 1..to-from, ending with the ball at `ball`. */
export interface Pass {
  from: number;
  to: number;
  ball: number;
}

/**
 * The cartoon network: every layer applies one swap. With a chain of thought each pass writes the
 * ball's position as a token and the next pass continues from it; without one there is a single
 * pass and swaps beyond its depth are never applied.
 */
export function runCups(swaps: Swap[], L: number, cot: boolean): { passes: Pass[]; answer: number; truth: number } {
  const n = swaps.length;
  const truth = swaps.reduce(applySwap, 0);
  const passes: Pass[] = [];
  let ball = 0;
  let at = 0;
  do {
    const to = Math.min(n, at + L);
    for (let k = at; k < to; k++) ball = applySwap(ball, swaps[k]!);
    passes.push({ from: at, to, ball });
    at = to;
  } while (cot && at < n);
  return { passes, answer: ball, truth };
}

/** Share of random swap lists the one-pass cartoon still gets right (the leftover swaps miss the ball). */
export function cupsNoCotAccuracy(n: number, L: number, trials = 4000): number {
  if (n <= L) return 1;
  const r = new Rng(97 + 13 * n + L);
  let ok = 0;
  for (let t = 0; t < trials; t++) {
    let ball = 0;
    let part = 0;
    for (let k = 0; k < n; k++) {
      const i = r.int(CUPS);
      let j = r.int(CUPS - 1);
      if (j >= i) j++;
      ball = applySwap(ball, [i, j]);
      if (k === L - 1) part = ball;
    }
    if (part === ball) ok++;
  }
  return ok / trials;
}

// ---------------------------------------------------------------- voting

const LF: number[] = [0];
for (let i = 1; i <= 4096; i++) LF[i] = LF[i - 1]! + Math.log(i);
const lpow = (b: number, k: number): number => (k === 0 ? 0 : b <= 0 ? -Infinity : k * Math.log(b));
const lg0 = (b: number): number => (b <= 0 ? -Infinity : Math.log(b));
const mul = (k: number, lb: number): number => (k === 0 ? 0 : k * lb);

/** Chance the right answer wins a vote with k_right, k_q (common mistake) and k_r scattered votes; ties at random. */
export function wins(kRight: number, kQ: number, kR: number): number {
  const top = Math.max(kRight, kQ, Math.min(kR, 1));
  if (kRight === 0 || kRight < top) return 0;
  const ties = 1 + (kQ === top ? 1 : 0) + (top === 1 ? kR : 0);
  return 1 / ties;
}

/**
 * Exact majority-vote accuracy with n samples: right with probability p, one common wrong answer
 * with probability q, and every other wrong answer different from all the rest.
 */
export function voteAccuracy(p: number, q: number, n: number): number {
  const lp = lg0(p);
  const lq = lg0(q);
  const lr = lg0(Math.max(0, 1 - p - q));
  let total = 0;
  for (let a = 0; a <= n; a++) {
    for (let b = 0; a + b <= n; b++) {
      const k = n - a - b;
      const lg = LF[n]! - LF[a]! - LF[b]! - LF[k]! + mul(a, lp) + mul(b, lq) + mul(k, lr);
      if (lg < -40) continue;
      total += Math.exp(lg) * wins(a, b, k);
    }
  }
  return Math.min(1, total);
}

/** Binary majority vote over odd n: the chance more than half of n samples are right. */
export function majorityBinary(p: number, n: number): number {
  let s = 0;
  for (let k = Math.floor(n / 2) + 1; k <= n; k++) s += Math.exp(LF[n]! - LF[k]! - LF[n - k]! + lpow(p, k) + lpow(1 - p, n - k));
  return s;
}

export const passAt = (p: number, k: number): number => 1 - (1 - p) ** k;

/** One simulated vote: tallies for the right answer, the common mistake, and how many scattered answers. */
export function drawVote(r: Rng, p: number, q: number, n: number): { right: number; common: number; scattered: number } {
  let right = 0;
  let common = 0;
  for (let i = 0; i < n; i++) {
    const u = r.next();
    if (u < p) right++;
    else if (u < p + q) common++;
  }
  return { right, common, scattered: n - right - common };
}

// ---------------------------------------------------------------- best-of-n with a noisy verifier

const VGRID = 1400;
export const V_LO = -6;
export const V_HI = 14;

/** Verifier scores: right answers ~ N(d, 1), wrong ~ N(0, 1), except a share eps of wrong ones ~ N(d + 1, 1). */
export class BestOfN {
  readonly V = new Float64Array(VGRID);
  readonly mass = new Float64Array(VGRID);
  readonly right = new Float64Array(VGRID);
  readonly G = new Float64Array(VGRID);

  constructor(readonly p: number, readonly d: number, readonly eps: number) {
    const phi = (v: number, m: number) => Math.exp(-((v - m) ** 2) / 2);
    let tot = 0;
    for (let i = 0; i < VGRID; i++) {
      const v = V_LO + ((V_HI - V_LO) * i) / (VGRID - 1);
      this.V[i] = v;
      const fr = phi(v, d);
      const fw = (1 - eps) * phi(v, 0) + eps * phi(v, d + 1);
      this.right[i] = p * fr;
      this.mass[i] = p * fr + (1 - p) * fw;
      tot += this.mass[i]!;
    }
    let acc = 0;
    for (let i = 0; i < VGRID; i++) {
      this.right[i]! /= tot;
      this.mass[i]! /= tot;
      acc += this.mass[i]!;
      this.G[i] = Math.min(1, acc);
    }
  }

  /** P(the top-scored of n answers is right) and the expected top score. */
  at(n: number): { acc: number; top: number } {
    let acc = 0;
    let top = 0;
    let prev = 0;
    for (let i = 0; i < VGRID; i++) {
      const g = this.G[i]! ** n;
      const pm = g - prev;
      prev = g;
      if (pm <= 0 || this.mass[i]! <= 0) continue;
      acc += (pm * this.right[i]!) / this.mass[i]!;
      top += pm * this.V[i]!;
    }
    return { acc: Math.min(1, acc), top };
  }
}

/** One simulated batch of n candidates: [score, right?, exploit?]. */
export function drawCandidates(r: Rng, p: number, d: number, eps: number, n: number): { v: number; ok: boolean; hack: boolean }[] {
  return Array.from({ length: n }, () => {
    const ok = r.next() < p;
    const hack = !ok && r.next() < eps;
    return { v: (ok ? d : hack ? d + 1 : 0) + r.randn(), ok, hack };
  });
}

export const klBestOfN = (n: number): number => Math.log(n) - (n - 1) / n;

// ---------------------------------------------------------------- coverage over a benchmark

const PGRID = 2000;
export const P_GRID: Float64Array = Float64Array.from({ length: PGRID }, (_, i) => (i + 0.5) / PGRID);

/** Beta(a, b) weights on P_GRID: the share of a benchmark's problems at each per-sample accuracy. */
export function betaWeights(mean: number, conc: number): Float64Array {
  const a = mean * conc;
  const b = (1 - mean) * conc;
  const w = new Float64Array(PGRID);
  let lmax = -Infinity;
  for (let i = 0; i < PGRID; i++) {
    const p = P_GRID[i]!;
    w[i] = (a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p);
    lmax = Math.max(lmax, w[i]!);
  }
  let s = 0;
  for (let i = 0; i < PGRID; i++) {
    w[i] = Math.exp(w[i]! - lmax);
    s += w[i]!;
  }
  for (let i = 0; i < PGRID; i++) w[i]! /= s;
  return w;
}

export function coverage(w: Float64Array, n: number): number {
  let s = 0;
  for (let i = 0; i < PGRID; i++) s += w[i]! * (1 - (1 - P_GRID[i]!) ** n);
  return s;
}

export function meanP(w: Float64Array): number {
  let s = 0;
  for (let i = 0; i < PGRID; i++) s += w[i]! * P_GRID[i]!;
  return s;
}

/** Share of problems majority voting gets right as n grows without limit: p beats q = c (1 - p). */
export function voteCeiling(w: Float64Array, c: number): number {
  let s = 0;
  for (let i = 0; i < PGRID; i++) if (P_GRID[i]! > c * (1 - P_GRID[i]!)) s += w[i]!;
  return s;
}

// ---------------------------------------------------------------- thinking budget

export const SLIP = 0.03;
export const GUESS = 0.1;

/**
 * Accuracy after each budget T = 0..Tmax for a problem needing d steps. Each step slips with
 * probability SLIP; once done, every extra token is a re-check that fixes an error with probability
 * `fix` or breaks a right answer with probability `brk`. Out of budget means a guess.
 */
export function budgetCurve(d: number, Tmax: number, fix: number, brk: number): Float64Array {
  let clean = new Float64Array(d + 1);
  let dirty = new Float64Array(d + 1);
  clean[0] = 1;
  const out = new Float64Array(Tmax + 1);
  const score = () => {
    let unfinished = 0;
    for (let k = 0; k < d; k++) unfinished += clean[k]! + dirty[k]!;
    return clean[d]! + unfinished * GUESS;
  };
  out[0] = score();
  for (let t = 1; t <= Tmax; t++) {
    const c2 = new Float64Array(d + 1);
    const d2 = new Float64Array(d + 1);
    for (let k = 0; k < d; k++) {
      c2[k + 1]! += clean[k]! * (1 - SLIP);
      d2[k + 1]! += clean[k]! * SLIP + dirty[k]!;
    }
    c2[d]! += clean[d]! * (1 - brk) + dirty[d]! * fix;
    d2[d]! += dirty[d]! * (1 - fix) + clean[d]! * brk;
    clean = c2;
    dirty = d2;
    out[t] = score();
  }
  return out;
}

// ---------------------------------------------------------------- process versus outcome

export interface Step {
  /** Python-ish expression with `{}` for the previous line's written value. */
  expr: string;
  op: (prev: number) => number;
  slip: number;
  unit: string;
}

/** 4 boxes of 12 markers at $2 each, $18 off, split by 3 classes. Slips keep every value whole. */
export const MARKERS: Step[] = [
  { expr: '4 * 12', op: () => 48, slip: -3, unit: 'markers' },
  { expr: '{} * 2', op: (v) => v * 2, slip: 3, unit: 'dollars' },
  { expr: '{} - 18', op: (v) => v - 18, slip: -3, unit: 'dollars' },
  { expr: '{} / 3', op: (v) => v / 3, slip: 2, unit: 'per class' },
];
export const MARKERS_ANSWER = 26;
export const PRM_OK = 0.95;
export const PRM_BAD = 0.1;

export interface Worked {
  shown: string[];
  vals: number[];
  ok: boolean[];
  stepP: number[];
  orm: number;
  prm: number;
}

/** Writes the solution with slips at the given steps: each line computed from the line before it. */
export function workSteps(slips: boolean[]): Worked {
  const vals: number[] = [];
  const ok: boolean[] = [];
  const shown: string[] = [];
  let prev = 0;
  MARKERS.forEach((s, i) => {
    const right = s.op(prev);
    const v = right + (slips[i] ? s.slip : 0);
    shown.push(s.expr.replace('{}', String(prev)));
    vals.push(v);
    ok.push(v === right);
    prev = v;
  });
  const stepP = ok.map((o) => (o ? PRM_OK : PRM_BAD));
  return { shown, vals, ok, stepP, orm: vals[vals.length - 1] === MARKERS_ANSWER ? 1 : 0, prm: stepP.reduce((a, b) => a * b, 1) };
}
