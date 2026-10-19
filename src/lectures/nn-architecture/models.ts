import { type Dataset2D, blobs, spiral } from '../../core/data';
import { MLP } from '../../core/nn';
import { Rng } from '../../core/rand';

export const sig = (z: number): number => 1 / (1 + Math.exp(-z));

/** The chapter's noisy disc: label 0 inside a circle of radius sqrt(0.42), 1 outside, some labels flipped. */
export function noisyDisc(n: number, seed: number, flip: number): Dataset2D & { flipped: Uint8Array } {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  const y = new Int32Array(n);
  const flipped = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = r.uniform(-1, 1);
    const b = r.uniform(-1, 1);
    X[2 * i] = a;
    X[2 * i + 1] = b;
    let c = a * a + b * b < 0.42 ? 0 : 1;
    if (r.next() < flip) {
      c = 1 - c;
      flipped[i] = 1;
    }
    y[i] = c;
  }
  return { X, y, n, classes: 2, flipped };
}

export const SPIRAL = spiral(50, 3, 0.2);
export const DISC = noisyDisc(80, 1, 0.12);
export const DISC_TEST = noisyDisc(400, 2, 0.12);
export const DISC_R = Math.sqrt(0.42);

/**
 * A network trained the way the chapter's figures train it, run lazily: a background warm-up
 * advances it in small slices, and `get()` finishes it on the spot if a scene needs it first.
 * The result does not depend on how the steps were sliced.
 */
export class Job {
  private net: MLP | null = null;
  private steps = 0;
  private readonly idx: Int32Array;
  constructor(
    readonly sizes: number[],
    readonly d: Dataset2D,
    readonly seed: number,
    readonly total: number,
    readonly lr: number,
    readonly reg: number,
  ) {
    this.idx = Int32Array.from({ length: d.n }, (_, i) => i);
  }
  get done(): boolean {
    return this.steps >= this.total;
  }
  advance(ms: number): void {
    this.net ??= new MLP({ sizes: this.sizes, activation: 'relu', seed: this.seed });
    const t0 = performance.now();
    while (this.steps < this.total && performance.now() - t0 < ms) {
      for (let k = 0; k < 10 && this.steps < this.total; k++, this.steps++) {
        this.net.lossAndGrad(this.d.X, this.d.y, this.idx, { reg: this.reg });
        this.net.step(this.lr, 'adam');
      }
    }
  }
  get(): MLP {
    if (!this.done) this.advance(Infinity);
    return this.net!;
  }
}

const spiralJob = (H: number) => new Job(H ? [2, H, 3] : [2, 3], SPIRAL, 3, 1500, 0.03, 1e-3);
const discJob = (H: number, reg: number) => new Job([2, H, 2], DISC, 5, 4000, 0.02, reg);

/** Spiral networks by hidden width (0 is the linear classifier). */
export const SPIRAL_NETS: Record<number, Job> = { 0: spiralJob(0), 1: spiralJob(1), 2: spiralJob(2), 4: spiralJob(4), 8: spiralJob(8), 20: spiralJob(20) };
/** Noisy-disc networks, keyed `H/reg`. */
export const DISC_NETS: Record<string, Job> = {
  '50/0.0001': discJob(50, 1e-4),
  '3/0.0001': discJob(3, 1e-4),
  '50/0.01': discJob(50, 0.01),
  '50/0.3': discJob(50, 0.3),
};

const QUEUE = [SPIRAL_NETS[0]!, SPIRAL_NETS[20]!, SPIRAL_NETS[1]!, SPIRAL_NETS[2]!, SPIRAL_NETS[4]!, SPIRAL_NETS[8]!, ...Object.values(DISC_NETS)];
function warm(): void {
  const job = QUEUE.find((j) => !j.done);
  if (!job) return;
  job.advance(8);
  setTimeout(warm, 24);
}
if (typeof window !== 'undefined') setTimeout(warm, 300);

const accCache = new Map<MLP, Map<Dataset2D, number>>();
export function accuracy(net: MLP, d: Dataset2D): number {
  let m = accCache.get(net);
  if (!m) accCache.set(net, (m = new Map()));
  let a = m.get(d);
  if (a === undefined) m.set(d, (a = net.accuracy(d.X, d.y, d.n)));
  return a;
}

/**
 * Final training losses from the chapter's restarts figure (spiral(40, 3, 0.2), ReLU, Adam at
 * 0.03, reg 1e-3, 800 steps, seeds 1 to 10), computed with core/nn. Too slow to rerun live.
 */
export const RESTARTS: [number, number[]][] = [
  [3, [0.495, 0.473, 0.695, 0.565, 0.705, 0.556, 0.488, 0.703, 0.516, 0.749]],
  [5, [0.354, 0.314, 0.323, 0.389, 0.345, 0.52, 0.525, 0.331, 0.429, 0.361]],
  [8, [0.272, 0.288, 0.346, 0.28, 0.324, 0.263, 0.279, 0.264, 0.271, 0.26]],
  [30, [0.248, 0.248, 0.248, 0.248, 0.248, 0.249, 0.248, 0.248, 0.248, 0.248]],
];

// ---- one neuron: the chapter's two blobs, fit by gradient descent from its starting weights

export const BLOBS = blobs(30, 2, 0.28, 21);
export const NEURON_LR = 0.5;
export const NEURON_REG = 0.01;
export const NEURON_STEPS = 600;

/** [w0, w1, b] after each step of binary-softmax training, starting at the chapter's (1.6, -0.6, 0.3). */
export const NEURON_PATH: [number, number, number][] = (() => {
  const d = BLOBS;
  const st: [number, number, number] = [1.6, -0.6, 0.3];
  const out: [number, number, number][] = [[...st]];
  for (let k = 0; k < NEURON_STEPS; k++) {
    let g0 = 0;
    let g1 = 0;
    let gb = 0;
    for (let i = 0; i < d.n; i++) {
      const x0 = d.X[2 * i]!;
      const x1 = d.X[2 * i + 1]!;
      const ds = (sig(st[0] * x0 + st[1] * x1 + st[2]) - d.y[i]!) / d.n;
      g0 += ds * x0;
      g1 += ds * x1;
      gb += ds;
    }
    st[0] -= NEURON_LR * (g0 + NEURON_REG * st[0]);
    st[1] -= NEURON_LR * (g1 + NEURON_REG * st[1]);
    st[2] -= NEURON_LR * gb;
    out.push([...st]);
  }
  return out;
})();

/** Mean cross-entropy (plus the L2 term) and accuracy of the neuron (w0, w1, b) on the blobs. */
export function neuronStats(w0: number, w1: number, b: number): { loss: number; acc: number } {
  const d = BLOBS;
  let loss = 0;
  let ok = 0;
  for (let i = 0; i < d.n; i++) {
    const s = w0 * d.X[2 * i]! + w1 * d.X[2 * i + 1]! + b;
    const p = sig(s);
    loss -= Math.log(Math.max(1e-12, d.y[i] ? p : 1 - p));
    if ((s > 0 ? 1 : 0) === d.y[i]) ok++;
  }
  return { loss: loss / d.n + 0.5 * NEURON_REG * (w0 * w0 + w1 * w1), acc: ok / d.n };
}

// ---- the chapter's forward-pass network: sizes [3, 4, 4, 1], weights from Rng(8)

export const FWD_SIZES = [3, 4, 4, 1];
export const FWD_X = [0.5, -1.2, 0.8];
export const FWD_W: number[][][] = [];
export const FWD_B: number[][] = [];
{
  const rng = new Rng(8);
  for (let l = 1; l < FWD_SIZES.length; l++) {
    FWD_W.push(Array.from({ length: FWD_SIZES[l]! }, () => Array.from({ length: FWD_SIZES[l - 1]! }, () => Math.round(rng.randn() * 1.2 * 100) / 100)));
    FWD_B.push(Array.from({ length: FWD_SIZES[l]! }, () => Math.round(rng.randn() * 0.3 * 100) / 100));
  }
}
/** Activations per layer: [x, h1, h2, scores]; sigmoid on the hidden layers, none on the output. */
export const FWD_VALS: number[][] = (() => {
  const vals = [FWD_X];
  for (let l = 0; l < FWD_W.length; l++) {
    const inp = vals[l]!;
    const last = l === FWD_W.length - 1;
    vals.push(FWD_W[l]!.map((row, i) => {
      const s = row.reduce((a, w, j) => a + w * inp[j]!, FWD_B[l]![i]!);
      return last ? s : sig(s);
    }));
  }
  return vals;
})();

// ---- universal approximation by bumps

export const target = (x: number): number => 0.5 + 0.3 * Math.sin(8 * x) + 0.15 * Math.sin(25 * x);
/** Bump edges run past [0, 1]: an edge exactly at 0 would leave g(0) at half the target height. */
export const EDGE_LO = -0.1;
export const EDGE_HI = 1.1;
export const edge = (n: number, i: number): number => EDGE_LO + ((EDGE_HI - EDGE_LO) * i) / n;
/** Steepness grows with the bump count, so each step stays sharp relative to its bump. */
export const steep = (n: number): number => 10 * n;
export function bumps(n: number, x: number): number {
  const k = steep(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = edge(n, i);
    const b = edge(n, i + 1);
    s += target((a + b) / 2) * (sig(k * (x - a)) - sig(k * (x - b)));
  }
  return s;
}
const errCache = new Map<number, number>();
export function bumpError(n: number): number {
  let e = errCache.get(n);
  if (e === undefined) {
    e = 0;
    for (let i = 0; i <= 400; i++) e = Math.max(e, Math.abs(target(i / 400) - bumps(n, i / 400)));
    errCache.set(n, e);
  }
  return e;
}
