import { Rng } from '../core/rand';
import { type DiffNet, SCHED, type Schedule } from './diffusion-net';

export type SamplerKind = 'ddpm' | 'ddim' | 'flow';

export interface SamplerOptions {
  kind: SamplerKind;
  /** Number of network calls (DDIM and flow may skip steps; DDPM always uses all T). */
  steps?: number;
  n?: number;
  seed?: number;
  /** Class to generate, or null for unconditional. */
  cls?: number | null;
  /** Guidance scale: 0 = unconditional, 1 = conditional, > 1 = guided. */
  w?: number;
  /** DDPM only: add the fresh noise term sigma_t z (true) or keep only the mean (false). */
  noise?: boolean;
}

/** Noise prediction with optional classifier-free guidance: eps_null + w (eps_c - eps_null). */
export function guidedEps(net: DiffNet, x: Float32Array, tau: number, cls: number | null, w: number, out: Float32Array, tmp: Float32Array): Float32Array {
  if (cls === null || !net.classes) return net.predict(x, tau, null, out);
  if (w === 1) return net.predict(x, tau, cls, out);
  net.predict(x, tau, null, tmp);
  if (w === 0) {
    out.set(tmp);
    return out;
  }
  net.predict(x, tau, cls, out);
  for (let i = 0; i < out.length; i++) out[i] = tmp[i]! + w * (out[i]! - tmp[i]!);
  return out;
}

/**
 * A reverse-process run that keeps every intermediate state, advanced a few network calls at a
 * time so a page can spread it over frames. `frames[k]` is the cloud after k calls; `times[k]`
 * is its noise level (diffusion step t, or flow time in [0, 1]).
 */
export class Sampler {
  readonly net: DiffNet;
  readonly o: SamplerOptions;
  readonly sched: Schedule;
  readonly frames: Float32Array[] = [];
  readonly times: number[] = [];
  readonly eps: Float32Array[] = [];
  readonly n: number;
  readonly kind: SamplerKind;
  private grid: number[];
  private k = 0;
  private rng: Rng;
  private buf: Float32Array;
  private tmp: Float32Array;

  constructor(net: DiffNet, o: SamplerOptions, sched: Schedule = SCHED) {
    this.net = net;
    this.o = o;
    this.sched = sched;
    this.kind = o.kind;
    this.n = o.n ?? 500;
    this.rng = new Rng(o.seed ?? 3);
    const steps = o.kind === 'ddpm' ? sched.T : Math.max(1, Math.min(o.kind === 'flow' ? 1000 : sched.T, o.steps ?? 20));
    if (o.kind === 'flow') this.grid = Array.from({ length: steps + 1 }, (_, i) => 1 - i / steps);
    else this.grid = Array.from({ length: steps + 1 }, (_, i) => Math.round(sched.T * (1 - i / steps)));
    const x = new Float32Array(this.n * 2);
    for (let i = 0; i < x.length; i++) x[i] = this.rng.randn();
    this.frames.push(x);
    this.times.push(this.grid[0]!);
    this.buf = new Float32Array(this.n * 2);
    this.tmp = new Float32Array(this.n * 2);
  }

  get total(): number {
    return this.grid.length - 1;
  }
  get done(): boolean {
    return this.k >= this.total;
  }
  get last(): Float32Array {
    return this.frames[this.frames.length - 1]!;
  }

  /** One network call: moves the cloud from grid[k] to grid[k + 1]. */
  advance(): void {
    if (this.done) return;
    const { sched, net } = this;
    const x = this.last;
    const nx = new Float32Array(x.length);
    const cls = this.o.cls ?? null;
    const w = this.o.w ?? 1;
    const t = this.grid[this.k]!;
    const tn = this.grid[this.k + 1]!;
    if (this.kind === 'flow') {
      const v = guidedEps(net, x, t, cls, w, this.buf, this.tmp);
      const dt = t - tn;
      for (let i = 0; i < x.length; i++) nx[i] = x[i]! - dt * v[i]!;
      this.eps.push(Float32Array.from(v));
    } else {
      const e = guidedEps(net, x, t / sched.T, cls, w, this.buf, this.tmp);
      this.eps.push(Float32Array.from(e));
      const ab = sched.ab[t]!;
      if (this.kind === 'ddpm') {
        const a = sched.alpha[t]!, b = sched.beta[t]!;
        const c = b / Math.sqrt(1 - ab);
        const sig = t > 1 && this.o.noise !== false ? Math.sqrt(b) : 0;
        for (let i = 0; i < x.length; i++) nx[i] = (x[i]! - c * e[i]!) / Math.sqrt(a) + sig * this.rng.randn();
      } else {
        const abn = sched.ab[tn]!;
        for (let i = 0; i < x.length; i++) {
          const x0 = (x[i]! - Math.sqrt(1 - ab) * e[i]!) / Math.sqrt(ab);
          nx[i] = Math.sqrt(abn) * x0 + Math.sqrt(1 - abn) * e[i]!;
        }
      }
    }
    this.frames.push(nx);
    this.times.push(tn);
    this.k++;
  }

  /** Advances until `ms` milliseconds have passed or the run is complete. */
  slice(ms: number): void {
    const t0 = performance.now();
    while (!this.done && performance.now() - t0 < ms) this.advance();
  }

  runAll(): this {
    while (!this.done) this.advance();
    return this;
  }
}
