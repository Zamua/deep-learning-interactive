import { Rng } from '../core/rand';

/** One prompt, four candidate answers: the toy that every DPO figure and lecture scene uses. */
export const PROMPT = 'How do I reverse a list in Python?';
export const ANSWERS = [
  { key: 'A', short: 'concise', text: '`xs[::-1]`, or `xs.reverse()` to do it in place.' },
  { key: 'B', short: 'rambling', text: 'The same advice, buried in three paragraphs of history.' },
  { key: 'C', short: 'wrong', text: '`xs.sort(reverse=True)` (this sorts; it does not reverse).' },
  { key: 'D', short: 'refuses', text: '"I am sorry, I cannot help with that."' },
];
export const KEYS = ANSWERS.map((a) => a.key);
/** The hidden "true" reward the labelers' choices follow. */
export const R_TRUE = [1.6, 0.9, -0.8, -1.4];
/** The SFT model: it likes the rambling answer best. */
export const PI_REF = [0.15, 0.45, 0.25, 0.15];
export const LOG_REF = PI_REF.map(Math.log);

export const sigmoid = (z: number): number => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
export const logSigmoid = (z: number): number => (z >= 0 ? -Math.log1p(Math.exp(-z)) : z - Math.log1p(Math.exp(z)));

export function softmax(theta: readonly number[]): number[] {
  const mx = Math.max(...theta);
  const e = theta.map((t) => Math.exp(t - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** pi* = pi_ref exp(r / beta) / Z, and Z itself. */
export function piStar(beta: number, r: readonly number[] = R_TRUE, ref: readonly number[] = PI_REF): { p: number[]; Z: number } {
  const u = ref.map((p, i) => p * Math.exp(r[i]! / beta));
  const Z = u.reduce((a, b) => a + b, 0);
  return { p: u.map((v) => v / Z), Z };
}

export function kl(p: readonly number[], q: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) if (p[i]! > 0) s += p[i]! * Math.log(p[i]! / q[i]!);
  return s;
}

/** The KL-regularized objective for one prompt: E[r] - beta KL(pi || pi_ref). */
export function objective(pi: readonly number[], beta: number, r: readonly number[] = R_TRUE): { er: number; kl: number; J: number } {
  const er = pi.reduce((a, p, i) => a + p * r[i]!, 0);
  const k = kl(pi, PI_REF);
  return { er, kl: k, J: er - beta * k };
}

/** Draws an index from a discrete distribution. */
function draw(rng: Rng, p: readonly number[]): number {
  let u = rng.next();
  for (let i = 0; i < p.length - 1; i++) {
    if (u < p[i]!) return i;
    u -= p[i]!;
  }
  return p.length - 1;
}

/**
 * An offline preference dataset: two different answers sampled from pi_ref, labeled by a
 * Bradley-Terry labeler that follows R_TRUE. Returned as counts[w][l].
 */
export function samplePairs(n: number, seed = 7): number[][] {
  const rng = new Rng(seed);
  const c = KEYS.map(() => KEYS.map(() => 0));
  let k = 0;
  while (k < n) {
    const a = draw(rng, PI_REF);
    const b = draw(rng, PI_REF);
    if (a === b) continue;
    if (rng.next() < sigmoid(R_TRUE[a]! - R_TRUE[b]!)) c[a]![b]!++;
    else c[b]![a]!++;
    k++;
  }
  return c;
}

export const PAIRS = samplePairs(1000);
export const N_PAIRS = 1000;

/** Tabular DPO on PAIRS: theta are the policy's logits, trained with Adam from log pi_ref. */
export class DpoRun {
  theta = [...LOG_REF];
  private m = [0, 0, 0, 0];
  private v = [0, 0, 0, 0];
  t = 0;
  loss = Math.LN2;
  acc = 0;
  losses: number[] = [];
  constructor(
    public beta: number,
    readonly lr = 0.05,
    readonly counts: number[][] = PAIRS,
  ) {
    this.eval();
  }
  /** Loss, reward accuracy and the gradient on theta, averaged over every pair. */
  eval(): number[] {
    const g = [0, 0, 0, 0];
    let loss = 0;
    let acc = 0;
    let n = 0;
    const { theta, beta, counts } = this;
    for (let w = 0; w < 4; w++)
      for (let l = 0; l < 4; l++) {
        const c = counts[w]![l]!;
        if (!c) continue;
        const mg = beta * (theta[w]! - LOG_REF[w]! - (theta[l]! - LOG_REF[l]!));
        loss -= c * logSigmoid(mg);
        if (mg > 1e-12) acc += c;
        else if (Math.abs(mg) <= 1e-12) acc += c / 2;
        const wt = sigmoid(-mg);
        g[w]! -= c * beta * wt;
        g[l]! += c * beta * wt;
        n += c;
      }
    this.loss = loss / n;
    this.acc = acc / n;
    return g.map((x) => x / n);
  }
  step(): void {
    const g = this.eval();
    this.losses.push(this.loss);
    this.t++;
    for (let i = 0; i < 4; i++) {
      this.m[i] = 0.9 * this.m[i]! + 0.1 * g[i]!;
      this.v[i] = 0.999 * this.v[i]! + 0.001 * g[i]! * g[i]!;
      const mh = this.m[i]! / (1 - 0.9 ** this.t);
      const vh = this.v[i]! / (1 - 0.999 ** this.t);
      this.theta[i]! -= (this.lr * mh) / (Math.sqrt(vh) + 1e-8);
    }
    this.eval();
  }
  get pi(): number[] {
    return softmax(this.theta);
  }
  /** beta log(pi / pi_ref): the reward the policy implies, up to a constant. */
  get implicit(): number[] {
    const lp = this.pi.map(Math.log);
    return lp.map((v, i) => this.beta * (v - LOG_REF[i]!));
  }
}

/**
 * One prompt, two answers with pi_ref = 1/2 each, a share `q` of labelers preferring A.
 * Returns the log-ratio gap h after each Adam step under the DPO or IPO loss (tau = beta).
 */
export function gapRun(kind: 'dpo' | 'ipo', q: number, beta: number, steps = 600, lr = 0.05): Float64Array {
  const out = new Float64Array(steps + 1);
  let h = 0;
  let m = 0;
  let v = 0;
  for (let t = 1; t <= steps; t++) {
    let g: number;
    if (kind === 'dpo') g = -q * beta * sigmoid(-beta * h) + (1 - q) * beta * sigmoid(beta * h);
    else {
      const c = 1 / (2 * beta);
      g = 2 * q * (h - c) + 2 * (1 - q) * (h + c);
    }
    m = 0.9 * m + 0.1 * g;
    v = 0.999 * v + 0.001 * g * g;
    h -= (lr * (m / (1 - 0.9 ** t))) / (Math.sqrt(v / (1 - 0.999 ** t)) + 1e-8);
    out[t] = h;
  }
  return out;
}
