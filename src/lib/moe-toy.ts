import { Rng } from '../core/rand';

/**
 * A toy mixture-of-experts layer that trains for real: 2-D tokens, a linear top-1 router
 * (Switch style: the chosen expert's output is scaled by its router probability) and linear
 * experts fitting a regression target. Shared by the chapter's trainer figure and the lecture.
 */

export type Balance = 'none' | 'aux' | 'bias';

export const TOY_N = 240;
/** Every token shares this offset, the way real token vectors share a common direction. */
export const TOY_CENTER: [number, number] = [0.5, 0.25];
export const TOY_DOMAIN: [number, number, number, number] = [-0.62, 1.62, -0.92, 1.42];

export interface ToyData {
  X: Float64Array;
  /** Regression target per token: the height of a four-sided pyramid centered on the cloud. */
  T: Float64Array;
  n: number;
}

export function toyData(seed = 4, n = TOY_N): ToyData {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  const T = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = r.next() * 2 * Math.PI;
    const rad = Math.sqrt(r.next());
    const d0 = rad * Math.cos(a);
    const d1 = rad * Math.sin(a);
    X[2 * i] = d0 + TOY_CENTER[0];
    X[2 * i + 1] = d1 + TOY_CENTER[1];
    T[i] = Math.abs(d0) + Math.abs(d1);
  }
  return { X, T, n };
}

export interface ToyOpts {
  E?: number;
  mode?: Balance;
  alpha?: number;
  gamma?: number;
  lr?: number;
  seed?: number;
}

/** Steps in one training session. */
export const TOY_STEPS = 2000;

/** Cosine decay to 8% over a session, so a run settles instead of flickering at its end. */
export function lrScale(step: number): number {
  return 0.08 + 0.92 * (0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, step / TOY_STEPS)));
}

export class ToyMoE {
  readonly E: number;
  readonly data: ToyData;
  mode: Balance;
  alpha: number;
  gamma: number;
  lr: number;
  /** Flat parameters: router W_r (2 x E, row-major by input), router bias b_r, expert w (E x 2), expert c. */
  th: Float64Array;
  /** Selection-only expert biases for loss-free balancing; never touched by gradients. */
  bias: Float64Array;
  steps = 0;
  /** Adam's own step count; survives a restart of the visible step counter. */
  private t = 0;
  /** Expert chosen by each token at the last step. */
  assign: Int32Array;
  load: Float64Array;
  f: Float64Array;
  P: Float64Array;
  task = 0;
  aux = 0;
  hist: { task: number; maxShare: number; aux: number }[] = [];
  private m: Float64Array;
  private v: Float64Array;
  private G: Float64Array;
  private probs: Float64Array;

  constructor(data: ToyData, o: ToyOpts = {}) {
    this.E = o.E ?? 4;
    this.data = data;
    this.mode = o.mode ?? 'none';
    this.alpha = o.alpha ?? 0.03;
    this.gamma = o.gamma ?? 0.005;
    this.lr = o.lr ?? 0.03;
    const E = this.E;
    this.th = new Float64Array(6 * E);
    this.m = new Float64Array(6 * E);
    this.v = new Float64Array(6 * E);
    this.G = new Float64Array(6 * E);
    this.bias = new Float64Array(E);
    this.assign = new Int32Array(data.n);
    this.load = new Float64Array(E);
    this.f = new Float64Array(E);
    this.P = new Float64Array(E);
    this.probs = new Float64Array(data.n * E);
    this.reset(o.seed ?? 4);
  }

  reset(seed: number): void {
    const E = this.E;
    const r = new Rng(seed * 7 + 1);
    this.th.fill(0);
    for (let i = 0; i < 2 * E; i++) this.th[i] = 0.5 * r.randn();
    for (let e = 0; e < E; e++) {
      this.th[3 * E + e] = 0.1 * r.randn();
      this.th[4 * E + e] = 0.1 * r.randn();
    }
    for (let e = 0; e < E; e++) this.th[5 * E + e] = 0.1 * r.randn();
    this.m.fill(0);
    this.v.fill(0);
    this.bias.fill(0);
    this.steps = 0;
    this.t = 0;
    this.hist = [];
    this.measure();
  }

  /** Router logits for one point into `out` (length E). */
  logits(x0: number, x1: number, out: Float64Array): void {
    const E = this.E;
    const th = this.th;
    for (let e = 0; e < E; e++) out[e] = th[e]! * x0 + th[E + e]! * x1 + th[2 * E + e]!;
  }

  /** Softmax probabilities into `out`; returns the chosen expert (biases count only in `bias` mode). */
  route(x0: number, x1: number, out: Float64Array): number {
    const E = this.E;
    this.logits(x0, x1, out);
    let mx = -Infinity;
    for (let e = 0; e < E; e++) mx = Math.max(mx, out[e]!);
    let s = 0;
    for (let e = 0; e < E; e++) {
      out[e] = Math.exp(out[e]! - mx);
      s += out[e]!;
    }
    let best = 0;
    let bv = -Infinity;
    const useB = this.mode === 'bias';
    for (let e = 0; e < E; e++) {
      out[e] = out[e]! / s;
      const sc = out[e]! + (useB ? this.bias[e]! : 0);
      if (sc > bv) {
        bv = sc;
        best = e;
      }
    }
    return best;
  }

  expert(e: number, x0: number, x1: number): number {
    const E = this.E;
    const th = this.th;
    return th[3 * E + e]! * x0 + th[4 * E + e]! * x1 + th[5 * E + e]!;
  }

  /** Routes every token with the current weights and fills assign, load, f, P, task and aux. */
  measure(): void {
    const { E, data } = this;
    const pr = new Float64Array(E);
    this.load.fill(0);
    this.P.fill(0);
    let task = 0;
    for (let n = 0; n < data.n; n++) {
      const x0 = data.X[2 * n]!;
      const x1 = data.X[2 * n + 1]!;
      const e = this.route(x0, x1, pr);
      this.assign[n] = e;
      this.load[e]! += 1;
      for (let j = 0; j < E; j++) {
        this.probs[n * E + j] = pr[j]!;
        this.P[j]! += pr[j]! / data.n;
      }
      const y = pr[e]! * this.expert(e, x0, x1);
      task += (y - data.T[n]!) ** 2 / data.n;
    }
    let aux = 0;
    for (let e = 0; e < E; e++) {
      this.f[e] = this.load[e]! / data.n;
      aux += E * this.f[e]! * this.P[e]!;
    }
    this.task = task;
    this.aux = aux;
  }

  /** One full-batch Adam step on task loss (+ alpha * aux in `aux` mode), then the bias nudge in `bias` mode. */
  step(): void {
    const { E, data, th, G } = this;
    this.measure();
    G.fill(0);
    const dp = new Float64Array(E);
    for (let n = 0; n < data.n; n++) {
      const x0 = data.X[2 * n]!;
      const x1 = data.X[2 * n + 1]!;
      const e = this.assign[n]!;
      const pe = this.probs[n * E + e]!;
      const o = this.expert(e, x0, x1);
      const r = (2 * (pe * o - data.T[n]!)) / data.n;
      G[3 * E + e]! += r * pe * x0;
      G[4 * E + e]! += r * pe * x1;
      G[5 * E + e]! += r * pe;
      dp.fill(0);
      dp[e] = r * o;
      if (this.mode === 'aux') for (let j = 0; j < E; j++) dp[j]! += (this.alpha * E * this.f[j]!) / data.n;
      let dot = 0;
      for (let j = 0; j < E; j++) dot += this.probs[n * E + j]! * dp[j]!;
      for (let j = 0; j < E; j++) {
        const dz = this.probs[n * E + j]! * (dp[j]! - dot);
        G[j]! += dz * x0;
        G[E + j]! += dz * x1;
        G[2 * E + j]! += dz;
      }
    }
    this.steps++;
    const t = ++this.t;
    const lr = this.lr * lrScale(this.steps);
    for (let i = 0; i < th.length; i++) {
      this.m[i] = 0.9 * this.m[i]! + 0.1 * G[i]!;
      this.v[i] = 0.999 * this.v[i]! + 0.001 * G[i]! ** 2;
      th[i]! -= (lr * (this.m[i]! / (1 - 0.9 ** t))) / (Math.sqrt(this.v[i]! / (1 - 0.999 ** t)) + 1e-8);
    }
    if (this.mode === 'bias') {
      const mean = data.n / E;
      for (let j = 0; j < E; j++) this.bias[j]! += this.gamma * Math.sign(mean - this.load[j]!);
    }
    let mx = 0;
    for (let j = 0; j < E; j++) mx = Math.max(mx, this.f[j]!);
    this.hist.push({ task: this.task, maxShare: mx, aux: this.aux });
  }

  /** Tokens over a capacity of ceil(cf * N / E) per expert, as a fraction of all tokens. */
  dropped(cf: number): number {
    const C = Math.ceil((cf * this.data.n) / this.E);
    let d = 0;
    for (let e = 0; e < this.E; e++) d += Math.max(0, this.load[e]! - C);
    return d / this.data.n;
  }
}

export interface ToySnap {
  step: number;
  th: Float64Array;
  bias: Float64Array;
  assign: Int32Array;
  load: number[];
  task: number;
  aux: number;
}

/**
 * Training sessions run back to back on one model (as when a reader trains, switches the
 * balancing mode and trains on), recorded every `every` steps for the lecture to scrub through.
 */
export function recordSessions(sessions: { mode: Balance; steps: number }[], every: number, o: ToyOpts = {}): ToySnap[][] {
  const net = new ToyMoE(toyData(), { alpha: 0.1, gamma: 0.005, ...o, mode: sessions[0]!.mode });
  const snap = (): ToySnap => {
    net.measure();
    return { step: net.steps, th: net.th.slice(), bias: net.bias.slice(), assign: net.assign.slice(), load: Array.from(net.load), task: net.task, aux: net.aux };
  };
  return sessions.map(({ mode, steps }) => {
    net.mode = mode;
    net.steps = 0;
    const out = [snap()];
    for (let i = 1; i <= steps; i++) {
      net.step();
      if (i % every === 0) out.push(snap());
    }
    return out;
  });
}

/** Router choice for a point under a recorded snapshot (biases count only when `useBias`). */
export function snapRoute(E: number, sn: ToySnap, x0: number, x1: number, useBias: boolean): number {
  const th = sn.th;
  let best = 0;
  let bv = -Infinity;
  let mx = -Infinity;
  const z: number[] = [];
  for (let e = 0; e < E; e++) {
    z[e] = th[e]! * x0 + th[E + e]! * x1 + th[2 * E + e]!;
    mx = Math.max(mx, z[e]!);
  }
  let sum = 0;
  for (let e = 0; e < E; e++) sum += Math.exp(z[e]! - mx);
  for (let e = 0; e < E; e++) {
    const sc = Math.exp(z[e]! - mx) / sum + (useBias ? sn.bias[e]! : 0);
    if (sc > bv) {
      bv = sc;
      best = e;
    }
  }
  return best;
}
