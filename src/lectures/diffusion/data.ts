import { Rng } from '../../core/rand';
import { SCHED, T } from '../../lib/diffusion-net';
import { MOONS, TRAIN_LOSS, model, snapshots } from '../../lib/diffusion-models';
import { Sampler } from '../../lib/diffusion-sample';

export const DATA = MOONS;
export { SCHED, T, TRAIN_LOSS };
export const SNAPS = snapshots();

/** One fixed noise draw per data point, so every forward-process frame is the same picture. */
export const EPS: Float32Array = (() => {
  const r = new Rng(17);
  return Float32Array.from({ length: DATA.n * 2 }, () => r.randn());
})();

/** Writes the closed-form x_t of every data point into `out`. */
export function noised(t: number, out: Float32Array): Float32Array {
  const k = Math.max(0, Math.min(T, t));
  const lo = Math.floor(k), hi = Math.min(T, lo + 1), f = k - lo;
  const ab = SCHED.ab[lo]! * (1 - f) + SCHED.ab[hi]! * f;
  const a = Math.sqrt(ab), b = Math.sqrt(1 - ab);
  for (let i = 0; i < out.length; i++) out[i] = a * DATA.X[i]! + b * EPS[i]!;
  return out;
}

/** The followed point of the forward scenes: its index and a step-by-step random walk. */
export const FOLLOW = (() => {
  let best = 0, bd = Infinity;
  for (let i = 0; i < DATA.n; i++) {
    const d = (DATA.X[2 * i]! + 1.25) ** 2 + (DATA.X[2 * i + 1]! - 0.62) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  const r = new Rng(29);
  const walk: [number, number][] = [[DATA.X[2 * best]!, DATA.X[2 * best + 1]!]];
  for (let t = 1; t <= T; t++) {
    const [x, y] = walk[t - 1]!;
    const a = Math.sqrt(SCHED.alpha[t]!), b = Math.sqrt(SCHED.beta[t]!);
    walk.push([a * x + b * r.randn(), a * y + b * r.randn()]);
  }
  return { i: best, walk };
})();

const eps = model('eps');
const cond = model('cond');
const flow = model('flow');

export const RUNS = {
  ddpm: new Sampler(eps, { kind: 'ddpm', n: 400, seed: 3 }),
  ddim20: new Sampler(eps, { kind: 'ddim', steps: 20, n: 400, seed: 3 }),
  ddim5: new Sampler(eps, { kind: 'ddim', steps: 5, n: 400, seed: 3 }),
  quiet: new Sampler(eps, { kind: 'ddpm', n: 400, seed: 3, noise: false }),
  flow4: new Sampler(flow, { kind: 'flow', steps: 4, n: 300, seed: 5 }),
  ddim4: new Sampler(eps, { kind: 'ddim', steps: 4, n: 300, seed: 5 }),
};

export const GUIDE_W = [0, 1, 4] as const;
/** Guided DDIM runs: GUIDE[w index][class]. */
export const GUIDE = GUIDE_W.map((w) => [0, 1].map((c) => new Sampler(cond, { kind: 'ddim', steps: 25, n: 180, seed: 40 + c, cls: c, w })));

/** The learned noise field on a grid, at every fifth step. */
export const GRID = { nx: 17, ny: 12, x0: -2.4, x1: 2.4, y0: -1.6, y1: 1.6 };
export const GRID_PTS = (() => {
  const g = new Float32Array(GRID.nx * GRID.ny * 2);
  for (let j = 0; j < GRID.ny; j++)
    for (let i = 0; i < GRID.nx; i++) {
      g[2 * (j * GRID.nx + i)] = GRID.x0 + ((GRID.x1 - GRID.x0) * i) / (GRID.nx - 1);
      g[2 * (j * GRID.nx + i) + 1] = GRID.y0 + ((GRID.y1 - GRID.y0) * j) / (GRID.ny - 1);
    }
  return g;
})();
const FIELD_T = Array.from({ length: 20 }, (_, k) => 5 * (k + 1));
const fields = new Map<number, Float32Array>();

/** Noise predictions on the grid at step t, interpolated between the stored steps (null until computed). */
export function fieldAt(t: number, out: Float32Array): Float32Array | null {
  const k = Math.max(5, Math.min(100, t));
  const lo = Math.floor(k / 5) * 5, hi = Math.min(100, lo + 5), f = (k - lo) / 5;
  const A = fields.get(lo), B = fields.get(hi);
  if (!A || !B) return null;
  for (let i = 0; i < out.length; i++) out[i] = A[i]! * (1 - f) + B[i]! * f;
  return out;
}

/** One noise prediction, for a single probe point. */
export function epsAt(x: number, y: number, t: number): [number, number] {
  const out = new Float32Array(2);
  eps.predict(new Float32Array([x, y]), t / T, null, out);
  return [out[0]!, out[1]!];
}

interface Job {
  readonly done: boolean;
  advance(): void;
}
const fieldJob: Job = {
  get done() {
    return fields.size === FIELD_T.length;
  },
  advance() {
    const t = FIELD_T.find((v) => !fields.has(v))!;
    const out = new Float32Array(GRID_PTS.length);
    eps.predict(GRID_PTS, t / T, null, out);
    fields.set(t, out);
  },
};

// Work in scene order, a few milliseconds at a time, so no frame waits on it.
const jobs: Job[] = [RUNS.ddpm, RUNS.quiet, RUNS.ddim20, RUNS.ddim5, fieldJob, ...GUIDE.flat(), RUNS.flow4, RUNS.ddim4];
function pump(): void {
  const t0 = performance.now();
  while (performance.now() - t0 < 6) {
    const j = jobs.find((x) => !x.done);
    if (!j) return;
    j.advance();
  }
  setTimeout(pump, 0);
}
setTimeout(pump, 0);

/** Every data point pushed through 40 small steps, to set beside the one-jump cloud. */
export const WALK40: Float32Array = (() => {
  const r = new Rng(31);
  const x = Float32Array.from(DATA.X);
  for (let t = 1; t <= 40; t++) {
    const a = Math.sqrt(SCHED.alpha[t]!), b = Math.sqrt(SCHED.beta[t]!);
    for (let i = 0; i < x.length; i++) x[i] = a * x[i]! + b * r.randn();
  }
  return x;
})();

/** The training example of the loss scene: one clean point, step 40, one noise draw, the network's guess. */
export const EX = (() => {
  let j = 0, bd = Infinity;
  for (let i = 0; i < DATA.n; i++) {
    const d = (DATA.X[2 * i]! - 0.6) ** 2 + (DATA.X[2 * i + 1]! + 0.9) ** 2;
    if (d < bd) { bd = d; j = i; }
  }
  const t = 40;
  const a = Math.sqrt(SCHED.ab[t]!), b = Math.sqrt(1 - SCHED.ab[t]!);
  const x0: [number, number] = [DATA.X[2 * j]!, DATA.X[2 * j + 1]!];
  const e: [number, number] = [0.8, 0.85];
  const xt: [number, number] = [a * x0[0] + b * e[0], a * x0[1] + b * e[1]];
  const ep = epsAt(xt[0], xt[1], t);
  const hat: [number, number] = [(xt[0] - b * ep[0]) / a, (xt[1] - b * ep[1]) / a];
  const loss = (e[0] - ep[0]) ** 2 + (e[1] - ep[1]) ** 2;
  return { t, a, b, ab: SCHED.ab[t]!, x0, e, xt, ep, hat, loss };
})();

/** Straight training lines through one probe point at t = 0.5, their average direction, and the network's. */
export const LINES = (() => {
  const r = new Rng(41);
  const probe: [number, number] = [0.35, 0.5];
  const near: { x0: [number, number]; e: [number, number] }[] = [];
  const some: { x0: [number, number]; e: [number, number] }[] = [];
  let sx = 0, sy = 0;
  for (let k = 0; k < 6000; k++) {
    const j = r.int(DATA.n);
    const x0: [number, number] = [DATA.X[2 * j]!, DATA.X[2 * j + 1]!];
    const e: [number, number] = [r.randn(), r.randn()];
    if (some.length < 40) some.push({ x0, e });
    const mx = 0.5 * x0[0] + 0.5 * e[0], my = 0.5 * x0[1] + 0.5 * e[1];
    if ((mx - probe[0]) ** 2 + (my - probe[1]) ** 2 < 0.15 ** 2) {
      near.push({ x0, e });
      sx += e[0] - x0[0];
      sy += e[1] - x0[1];
    }
  }
  const out = new Float32Array(2);
  flow.predict(new Float32Array(probe), 0.5, null, out);
  return { probe, near, some, avg: [sx / near.length, sy / near.length] as [number, number], net: [out[0]!, out[1]!] as [number, number] };
})();
