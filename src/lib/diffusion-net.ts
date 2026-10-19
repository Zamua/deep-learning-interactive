import { Rng } from '../core/rand';

/** Number of noise levels used everywhere on the page (DDPM itself used 1000). */
export const T = 100;

/** beta, alpha and alpha_bar indexed by step t = 0..T; index 0 is the clean data (beta = 0). */
export interface Schedule {
  T: number;
  beta: Float64Array;
  alpha: Float64Array;
  ab: Float64Array;
}

function fromBeta(beta: Float64Array): Schedule {
  const n = beta.length - 1;
  const alpha = beta.map((b) => 1 - b);
  const ab = new Float64Array(n + 1);
  ab[0] = 1;
  for (let t = 1; t <= n; t++) ab[t] = ab[t - 1]! * alpha[t]!;
  return { T: n, beta, alpha, ab };
}

/** DDPM's linear schedule rescaled to T steps: 1e-4..0.02 at T = 1000 becomes 1e-3..0.2 at T = 100. */
export function linearSchedule(steps = T): Schedule {
  const k = 1000 / steps;
  const beta = new Float64Array(steps + 1);
  for (let t = 1; t <= steps; t++) beta[t] = k * 1e-4 + ((k * 0.02 - k * 1e-4) * (t - 1)) / (steps - 1);
  return fromBeta(beta);
}

/** The cosine schedule of Nichol and Dhariwal (2021), with s = 0.008 and beta capped at 0.999. */
export function cosineSchedule(steps = T, s = 0.008): Schedule {
  const f = (t: number) => Math.cos(((t / steps + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  const beta = new Float64Array(steps + 1);
  for (let t = 1; t <= steps; t++) beta[t] = Math.min(0.999, 1 - f(t) / f(t - 1));
  return fromBeta(beta);
}

export const SCHED = linearSchedule();

export interface Points {
  X: Float32Array;
  y: Int32Array;
  n: number;
}

/** sklearn-style two moons, centered and scaled to roughly unit spread. Label = which moon. */
export function moons(n = 1000, seed = 7, noise = 0.06): Points {
  const r = new Rng(seed);
  const X = new Float32Array(n * 2);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i % 2;
    const th = Math.PI * r.next();
    let a = k ? 1 - Math.cos(th) : Math.cos(th);
    let b = k ? 0.5 - Math.sin(th) : Math.sin(th);
    a += noise * r.randn();
    b += noise * r.randn();
    X[2 * i] = (a - 0.5) * 1.25;
    X[2 * i + 1] = (b - 0.25) * 1.25;
    y[i] = k;
  }
  return { X, y, n };
}

/** A one-armed spiral of about one and a half turns; label = inner or outer half. */
export function spiral(n = 1000, seed = 11, noise = 0.05): Points {
  const r = new Rng(seed);
  const X = new Float32Array(n * 2);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.sqrt(0.06 + 0.94 * r.next());
    const th = 0.4 + 3 * Math.PI * u;
    const rad = 1.65 * u;
    X[2 * i] = rad * Math.cos(th) + noise * r.randn();
    X[2 * i + 1] = rad * Math.sin(th) * 0.95 + noise * r.randn();
    y[i] = u < 0.72 ? 0 : 1;
  }
  return { X, y, n };
}

export interface NetOptions {
  hidden?: number;
  depth?: number;
  /** Sinusoidal frequencies for the time input. */
  freqs?: number;
  /** Sinusoidal frequencies for each coordinate of the point (0 = raw x and y only). */
  xfreqs?: number;
  /** Number of classes for conditioning; 0 = unconditional. One extra "no label" slot is added. */
  classes?: number;
  seed?: number;
}

/**
 * The noise predictor: an MLP on [x, y, sin/cos(t features), one-hot class] with ReLU hidden
 * layers and two outputs. `tau` is the time as a fraction in [0, 1].
 */
export class DiffNet {
  readonly hidden: number;
  readonly depth: number;
  readonly freqs: number;
  readonly xfreqs: number;
  readonly classes: number;
  readonly nin: number;
  readonly sizes: number[];
  W: Float32Array[] = [];
  b: Float32Array[] = [];
  private gW: Float32Array[] = [];
  private gb: Float32Array[] = [];
  private mW: Float32Array[] = [];
  private vW: Float32Array[] = [];
  private mb: Float32Array[] = [];
  private vb: Float32Array[] = [];
  private acts: Float32Array[] = [];
  private grads: Float32Array[] = [];
  private cap = 0;
  steps = 0;

  constructor(o: NetOptions = {}) {
    this.hidden = o.hidden ?? 64;
    this.depth = o.depth ?? 3;
    this.freqs = o.freqs ?? 6;
    this.xfreqs = o.xfreqs ?? 3;
    this.classes = o.classes ?? 0;
    this.nin = 2 + 4 * this.xfreqs + 2 * this.freqs + (this.classes ? this.classes + 1 : 0);
    this.sizes = [this.nin, ...Array(this.depth).fill(this.hidden), 2];
    this.reset(o.seed ?? 1);
  }

  get nParams(): number {
    return this.W.reduce((a, w) => a + w.length, 0) + this.b.reduce((a, v) => a + v.length, 0);
  }

  reset(seed = 1): void {
    const r = new Rng(seed);
    this.steps = 0;
    const z = (n: number) => new Float32Array(n);
    this.W = [];
    this.b = [];
    this.gW = [];
    this.gb = [];
    this.mW = [];
    this.vW = [];
    this.mb = [];
    this.vb = [];
    for (let l = 0; l + 1 < this.sizes.length; l++) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const std = Math.sqrt((l + 2 < this.sizes.length ? 2 : 1) / nin);
      this.W.push(new Float32Array(nin * nout).map(() => r.randn() * std));
      this.b.push(z(nout));
      this.gW.push(z(nin * nout));
      this.gb.push(z(nout));
      this.mW.push(z(nin * nout));
      this.vW.push(z(nin * nout));
      this.mb.push(z(nout));
      this.vb.push(z(nout));
    }
  }

  /** Flat copy of every weight and bias, layer by layer (W then b). */
  save(): Float32Array {
    const out = new Float32Array(this.nParams);
    let o = 0;
    for (let l = 0; l < this.W.length; l++) {
      out.set(this.W[l]!, o);
      o += this.W[l]!.length;
      out.set(this.b[l]!, o);
      o += this.b[l]!.length;
    }
    return out;
  }

  load(flat: Float32Array, steps = 0): void {
    let o = 0;
    for (let l = 0; l < this.W.length; l++) {
      this.W[l]!.set(flat.subarray(o, o + this.W[l]!.length));
      o += this.W[l]!.length;
      this.b[l]!.set(flat.subarray(o, o + this.b[l]!.length));
      o += this.b[l]!.length;
    }
    this.steps = steps;
  }

  private ensure(n: number): void {
    if (n <= this.cap) return;
    this.cap = n;
    this.acts = this.sizes.map((s) => new Float32Array(n * s));
    this.grads = this.sizes.map((s) => new Float32Array(n * s));
  }

  private embed(X: ArrayLike<number>, tau: ArrayLike<number> | number, cls: ArrayLike<number> | number | null, n: number): void {
    const A = this.acts[0]!;
    const d = this.nin;
    const F = this.freqs;
    const XF = this.xfreqs;
    for (let i = 0; i < n; i++) {
      const o = i * d;
      const x = X[2 * i]!, y = X[2 * i + 1]!;
      A[o] = x;
      A[o + 1] = y;
      for (let k = 0; k < XF; k++) {
        const f = 2 ** k;
        A[o + 2 + 4 * k] = Math.sin(f * x);
        A[o + 3 + 4 * k] = Math.cos(f * x);
        A[o + 4 + 4 * k] = Math.sin(f * y);
        A[o + 5 + 4 * k] = Math.cos(f * y);
      }
      const ot = o + 2 + 4 * XF;
      const tt = typeof tau === 'number' ? tau : tau[i]!;
      for (let k = 0; k < F; k++) {
        const w = tt * Math.PI * 2 ** k;
        A[ot + k] = Math.sin(w);
        A[ot + F + k] = Math.cos(w);
      }
      if (this.classes) {
        const base = ot + 2 * F;
        for (let k = 0; k <= this.classes; k++) A[base + k] = 0;
        const c = cls === null ? this.classes : typeof cls === 'number' ? cls : cls[i]!;
        A[base + (c < 0 ? this.classes : c)] = 1;
      }
    }
  }

  private run(n: number): Float32Array {
    const L = this.W.length;
    for (let l = 0; l < L; l++) {
      const W = this.W[l]!;
      const bb = this.b[l]!;
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const A = this.acts[l]!;
      const Z = this.acts[l + 1]!;
      const relu = l < L - 1;
      for (let i = 0; i < n; i++) {
        const ai = i * nin;
        const zi = i * nout;
        for (let o = 0; o < nout; o++) {
          let s = bb[o]!;
          const row = o * nin;
          for (let k = 0; k < nin; k++) s += W[row + k]! * A[ai + k]!;
          Z[zi + o] = relu && s < 0 ? 0 : s;
        }
      }
    }
    return this.acts[L]!;
  }

  /**
   * Predicts for n points: X is n x 2, tau a per-point array or one shared value, cls a
   * per-point array, one shared class, or null for "no label". Writes n x 2 into `out`.
   */
  predict(X: ArrayLike<number>, tau: ArrayLike<number> | number, cls: ArrayLike<number> | number | null, out: Float32Array, n = X.length / 2): Float32Array {
    const chunk = 256;
    this.ensure(Math.min(n, chunk));
    for (let s = 0; s < n; s += chunk) {
      const m = Math.min(chunk, n - s);
      const Xs = (X as Float32Array).subarray ? (X as Float32Array).subarray(2 * s, 2 * (s + m)) : Array.prototype.slice.call(X, 2 * s, 2 * (s + m));
      const ts = typeof tau === 'number' ? tau : (tau as Float32Array).subarray ? (tau as Float32Array).subarray(s, s + m) : Array.prototype.slice.call(tau, s, s + m);
      const cs = cls === null || typeof cls === 'number' ? cls : (cls as Int32Array).subarray ? (cls as Int32Array).subarray(s, s + m) : Array.prototype.slice.call(cls, s, s + m);
      this.embed(Xs, ts, cs, m);
      const O = this.run(m);
      out.set(O.subarray(0, 2 * m), 2 * s);
    }
    return out;
  }

  /** One Adam step on mean squared error between the outputs and `target`. Returns the loss. */
  trainStep(X: Float32Array, tau: Float32Array, cls: Int32Array | null, target: Float32Array, lr: number): number {
    const n = tau.length;
    this.ensure(n);
    this.embed(X, tau, cls, n);
    const O = this.run(n);
    const L = this.W.length;
    const dO = this.grads[L]!;
    let loss = 0;
    const scale = 2 / (n * 2);
    for (let i = 0; i < 2 * n; i++) {
      const e = O[i]! - target[i]!;
      loss += e * e;
      dO[i] = e * scale;
    }
    for (let l = L - 1; l >= 0; l--) {
      const W = this.W[l]!;
      const gW = this.gW[l]!;
      const gb = this.gb[l]!;
      gW.fill(0);
      gb.fill(0);
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const A = this.acts[l]!;
      const D = this.grads[l + 1]!;
      const back = l > 0;
      const dA = this.grads[l]!;
      for (let i = 0; i < n; i++) {
        const ai = i * nin;
        const di = i * nout;
        if (back) for (let k = 0; k < nin; k++) dA[ai + k] = 0;
        for (let o = 0; o < nout; o++) {
          const g = D[di + o]!;
          if (g === 0) continue;
          gb[o]! += g;
          const row = o * nin;
          for (let k = 0; k < nin; k++) {
            gW[row + k]! += g * A[ai + k]!;
            if (back) dA[ai + k]! += g * W[row + k]!;
          }
        }
        if (back) for (let k = 0; k < nin; k++) if (A[ai + k]! <= 0) dA[ai + k] = 0;
      }
    }
    this.adam(lr);
    return loss / (n * 2);
  }

  private adam(lr: number): void {
    this.steps++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const c1 = 1 - b1 ** this.steps;
    const c2 = 1 - b2 ** this.steps;
    const upd = (p: Float32Array, g: Float32Array, m: Float32Array, v: Float32Array) => {
      for (let i = 0; i < p.length; i++) {
        const gi = g[i]!;
        m[i] = b1 * m[i]! + (1 - b1) * gi;
        v[i] = b2 * v[i]! + (1 - b2) * gi * gi;
        p[i]! -= (lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + eps);
      }
    };
    for (let l = 0; l < this.W.length; l++) {
      upd(this.W[l]!, this.gW[l]!, this.mW[l]!, this.vW[l]!);
      upd(this.b[l]!, this.gb[l]!, this.mb[l]!, this.vb[l]!);
    }
  }
}

export type Objective = 'eps' | 'flow';

export interface TrainerOptions {
  objective?: Objective;
  batch?: number;
  steps?: number;
  lr?: number;
  /** Probability of replacing the label with "no label" (classifier-free guidance training). */
  pDrop?: number;
  seed?: number;
}

/**
 * The training loop, one step at a time so pages can run it in short slices. Draws a batch,
 * a random time and fresh noise, builds x_t, and regresses the network onto the target.
 */
export class Trainer {
  readonly net: DiffNet;
  readonly data: Points;
  readonly sched: Schedule;
  readonly opts: Required<TrainerOptions>;
  readonly losses: number[] = [];
  private rng: Rng;
  private xt: Float32Array;
  private tau: Float32Array;
  private tgt: Float32Array;
  private cls: Int32Array;

  constructor(net: DiffNet, data: Points, o: TrainerOptions = {}, sched: Schedule = SCHED) {
    this.net = net;
    this.data = data;
    this.sched = sched;
    this.opts = { objective: 'eps', batch: 128, steps: 3000, lr: 6e-3, pDrop: 0.2, seed: 5, ...o };
    this.rng = new Rng(this.opts.seed);
    const B = this.opts.batch;
    this.xt = new Float32Array(B * 2);
    this.tau = new Float32Array(B);
    this.tgt = new Float32Array(B * 2);
    this.cls = new Int32Array(B);
  }

  get done(): boolean {
    return this.net.steps >= this.opts.steps;
  }

  /** Cosine-decayed learning rate. */
  lr(): number {
    const p = Math.min(1, this.net.steps / this.opts.steps);
    return this.opts.lr * (0.05 + 0.95 * 0.5 * (1 + Math.cos(Math.PI * p)));
  }

  step(): number {
    const { X, y, n } = this.data;
    const r = this.rng;
    const B = this.opts.batch;
    const flow = this.opts.objective === 'flow';
    for (let i = 0; i < B; i++) {
      const j = r.int(n);
      const x0 = X[2 * j]!, y0 = X[2 * j + 1]!;
      const e0 = r.randn(), e1 = r.randn();
      if (flow) {
        const t = r.next();
        this.tau[i] = t;
        this.xt[2 * i] = (1 - t) * x0 + t * e0;
        this.xt[2 * i + 1] = (1 - t) * y0 + t * e1;
        this.tgt[2 * i] = e0 - x0;
        this.tgt[2 * i + 1] = e1 - y0;
      } else {
        const t = 1 + r.int(this.sched.T);
        const a = Math.sqrt(this.sched.ab[t]!), s = Math.sqrt(1 - this.sched.ab[t]!);
        this.tau[i] = t / this.sched.T;
        this.xt[2 * i] = a * x0 + s * e0;
        this.xt[2 * i + 1] = a * y0 + s * e1;
        this.tgt[2 * i] = e0;
        this.tgt[2 * i + 1] = e1;
      }
      this.cls[i] = this.net.classes && r.next() >= this.opts.pDrop ? y[j]! : -1;
    }
    const loss = this.net.trainStep(this.xt, this.tau, this.net.classes ? this.cls : null, this.tgt, this.lr());
    this.losses.push(loss);
    return loss;
  }

  /** Runs steps until `ms` milliseconds have passed or training is done; returns steps taken. */
  slice(ms: number): number {
    const t0 = performance.now();
    let k = 0;
    while (!this.done && performance.now() - t0 < ms) {
      this.step();
      k++;
    }
    return k;
  }
}
