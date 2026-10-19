import { spiral } from '../../core/data';
import { MLP } from '../../core/nn';
import { Rng } from '../../core/rand';
import { SURFACES, Walker, type OptName, type Surface } from '../../lib/nn-learning-optim';

/** Computes once, on first use, so the lecture loads fast and each scene pays only for itself. */
function lazy<T>(make: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= make());
}

// ---------------------------------------------------------------- gradient check

/** The chapter's smooth test function and its exact derivative. */
export const gcF = (x: number): number => Math.tanh(1.5 * x) + 0.2 * x * x;
export const gcDF = (x: number): number => {
  const t = Math.tanh(1.5 * x);
  return 1.5 * (1 - t * t) + 0.4 * x;
};

/** log10 of the relative error of a centered check at x = 0.4, over log10(h) in [-12, 0]. */
export const relCurves = lazy(() => {
  const x0 = 0.4;
  const fr = Math.fround;
  const f32 = (x: number) => {
    const t = fr(Math.tanh(fr(1.5 * x)));
    return fr(t + fr(0.2 * fr(x * x)));
  };
  const rel = (a: number, n: number) => Math.abs(a - n) / Math.max(Math.abs(a), Math.abs(n), 1e-300);
  const lh: number[] = [];
  const e64: number[] = [];
  const e32: number[] = [];
  const clip = (r: number) => Math.max(-16.5, Math.min(0.4, Math.log10(Math.max(r, 1e-17))));
  for (let i = 0; i <= 240; i++) {
    const l = -12 + (12 * i) / 240;
    const h = 10 ** l;
    lh.push(l);
    e64.push(clip(rel(gcDF(x0), (gcF(x0 + h) - gcF(x0 - h)) / (2 * h))));
    const x = fr(x0);
    const hh = fr(h);
    const n32 = fr(fr(f32(fr(x + hh)) - f32(fr(x - hh))) / fr(2 * hh));
    e32.push(clip(rel(fr(gcDF(x)), n32)));
  }
  return { lh, e64, e32 };
});

// ---------------------------------------------------------------- sanity checks

export const SPIRAL = spiral(100, 3, 0.2, 3);
export const TINY = Int32Array.from({ length: 20 }, (_, i) => Math.floor((i * 300) / 20) + 3);

export interface Region {
  /** Predicted class on an n x n grid over [-1.1, 1.1]^2, row 0 at the top. */
  cls: Uint8Array;
  n: number;
}

function regionOf(net: MLP, n: number, lo: number, hi: number): Region {
  const cls = new Uint8Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = lo + ((i + 0.5) / n) * (hi - lo);
      const b = hi - ((j + 0.5) / n) * (hi - lo);
      cls[j * n + i] = net.predict([a, b]);
    }
  return { cls, n };
}

/** Overfitting 20 spiral points with Adam, with and without regularization. */
export const sanityRuns = lazy(() => {
  const run = (reg: number) => {
    const net = new MLP({ sizes: [2, 50, 3], init: 0.01, seed: 1 });
    const losses: number[] = [];
    const accs: number[] = [];
    const acc = () => {
      let ok = 0;
      for (const i of TINY) if (net.predict([SPIRAL.X[2 * i]!, SPIRAL.X[2 * i + 1]!]) === SPIRAL.y[i]) ok++;
      return ok / TINY.length;
    };
    for (let it = 0; it <= 2000; it++) {
      const l = net.lossAndGrad(SPIRAL.X, SPIRAL.y, TINY, { reg });
      if (it % 20 === 0) {
        losses.push(l);
        accs.push(acc());
      }
      net.step(0.01, 'adam');
    }
    return { losses, accs, region: regionOf(net, 56, -1.1, 1.1) };
  };
  const l0 = new MLP({ sizes: [2, 50, 3], init: 0.01, seed: 1 }).lossAndGrad(SPIRAL.X, SPIRAL.y, TINY, { reg: 0 });
  return { l0, free: run(0), reg: run(0.01) };
});

// ---------------------------------------------------------------- learning-rate runs

export const LR_RUNS = [
  { name: 'low', lr: 0.02, col: 'blue' as const },
  { name: 'good', lr: 0.5, col: 'green' as const },
  { name: 'high', lr: 4, col: 'orange' as const },
  { name: 'very high', lr: 15, col: 'red' as const },
];
export const EPOCHS = 40;

/** Four copies of one network on the spiral, differing only in the learning rate (batches of 32). */
export const lrRuns = lazy(() => {
  const N = SPIRAL.n;
  const ALL = Int32Array.from({ length: N }, (_, i) => i);
  return LR_RUNS.map((spec) => {
    const net = new MLP({ sizes: [2, 64, 3], init: 'he', seed: 1 });
    const rng = new Rng(7);
    const full = () => net.lossAndGrad(SPIRAL.X, SPIRAL.y, ALL, { reg: 1e-3 });
    const epochs = [full()];
    const iters: number[] = [];
    const batch: number[] = [];
    let seen = 0;
    let ratioSum = 0;
    let ratioN = 0;
    let dead = false;
    while (seen < EPOCHS * N && !dead) {
      const idx = Int32Array.from({ length: 32 }, () => rng.int(N));
      const loss = net.lossAndGrad(SPIRAL.X, SPIRAL.y, idx, { reg: 1e-3 });
      const L = net.layers[0]!;
      let nu = 0;
      let nw = 0;
      for (let i = 0; i < L.W.length; i++) {
        nu += (spec.lr * L.dW[i]!) ** 2;
        nw += L.W[i]! ** 2;
      }
      if (seen > N) {
        ratioSum += Math.log10(Math.sqrt(nu / Math.max(nw, 1e-30)));
        ratioN++;
      }
      net.step(spec.lr);
      seen += 32;
      if (!Number.isFinite(loss) || loss > 1e4) {
        dead = true;
        break;
      }
      iters.push(seen / N);
      batch.push(loss);
      while (epochs.length <= Math.floor(seen / N)) epochs.push(full());
    }
    return { ...spec, epochs, iters, batch, dead, ratio: ratioN ? ratioSum / ratioN : 0 };
  });
});

// ---------------------------------------------------------------- train / validation

/** Two classes split by a wavy boundary, with a fraction of labels flipped. */
export function wavy(n: number, seed: number, flip: number) {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const a = r.uniform(-1, 1);
    const b = r.uniform(-1, 1);
    X[2 * i] = a;
    X[2 * i + 1] = b;
    let c = b > 0.5 * Math.sin(4 * a) ? 1 : 0;
    if (r.next() < flip) c = 1 - c;
    y[i] = c;
  }
  return { X, y, n };
}

export const WAVY_TRAIN = wavy(60, 3, 0.1);
/** Training points whose label disagrees with the true wavy border. */
export const WAVY_FLIPPED: boolean[] = Array.from({ length: WAVY_TRAIN.n }, (_, i) => (WAVY_TRAIN.X[2 * i + 1]! > 0.5 * Math.sin(4 * WAVY_TRAIN.X[2 * i]!) ? 1 : 0) !== WAVY_TRAIN.y[i]);
export const GAP_ITERS = 1000;

/** Train and validation accuracy every 25 steps: an overfitting net, a regularized one, a linear one. */
export const gapRuns = lazy(() => {
  const val = wavy(400, 4, 0.1);
  const all = Int32Array.from({ length: WAVY_TRAIN.n }, (_, i) => i);
  const run = (sizes: number[], reg: number) => {
    const net = new MLP({ sizes, init: 'he', seed: 2 });
    const tr: number[] = [];
    const va: number[] = [];
    for (let it = 0; it <= GAP_ITERS; it++) {
      if (it % 25 === 0) {
        tr.push(net.accuracy(WAVY_TRAIN.X, WAVY_TRAIN.y, WAVY_TRAIN.n));
        va.push(net.accuracy(val.X, val.y, val.n));
      }
      net.lossAndGrad(WAVY_TRAIN.X, WAVY_TRAIN.y, all, { reg });
      net.step(0.01, 'adam');
    }
    return { tr, va, region: regionOf(net, 56, -1.05, 1.05) };
  };
  return { over: run([2, 32, 32, 2], 1e-4), regd: run([2, 32, 32, 2], 0.006), lin: run([2, 2], 1e-4) };
});

/** Histograms of tanh activations for weights that are too small, too large, and about right. */
export const ACT_HISTS: number[][] = [0.04, 5, 0.9].map((std, k) => {
  const r = new Rng(11 + k);
  const bins = new Array(24).fill(0);
  for (let i = 0; i < 4000; i++) {
    const a = Math.tanh(std * r.randn());
    bins[Math.min(23, Math.floor(((a + 1) / 2) * 24))]++;
  }
  const mx = Math.max(...bins);
  return bins.map((b) => b / mx);
});

/** Sixteen 6 x 6 RGB filters: speckled noise, or smooth oriented edges and color blobs. */
export const FILTERS: { noisy: [number, number, number][][][]; clean: [number, number, number][][][] } = (() => {
  const r = new Rng(21);
  const n = 6;
  const noisy: [number, number, number][][][] = [];
  const clean: [number, number, number][][][] = [];
  for (let f = 0; f < 16; f++) {
    const fn: [number, number, number][][] = [];
    const fc: [number, number, number][][] = [];
    const ang = r.uniform(0, Math.PI);
    const freq = r.uniform(0.7, 1.4);
    const blob = f % 4 === 3;
    const tint: [number, number, number] = [r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1)];
    for (let i = 0; i < n; i++) {
      const rn: [number, number, number][] = [];
      const rc: [number, number, number][] = [];
      for (let j = 0; j < n; j++) {
        rn.push([r.uniform(30, 225), r.uniform(30, 225), r.uniform(30, 225)]);
        const x = j - (n - 1) / 2;
        const y = i - (n - 1) / 2;
        const env = Math.exp(-(x * x + y * y) / 9);
        const v = blob ? env * 1.4 : Math.cos(freq * (x * Math.cos(ang) + y * Math.sin(ang))) * env;
        const g = (k: number) => Math.max(0, Math.min(255, 128 + 110 * v * (blob ? tint[k]! : 0.75 + 0.25 * tint[k]!)));
        rc.push([g(0), g(1), g(2)]);
      }
      fn.push(rn);
      fc.push(rc);
    }
    noisy.push(fn);
    clean.push(fc);
  }
  return { noisy, clean };
})();

// ---------------------------------------------------------------- update rules

export const VALLEY = SURFACES[0]!;
export const SADDLE = SURFACES[1]!;

/** Every optimizer's trail on one surface, from the surface's own start. */
export function trails(surf: Surface, names: OptName[], steps: number, start = surf.start): Record<string, Walker> {
  const out: Record<string, Walker> = {};
  for (const n of names) {
    const wk = new Walker(n, start);
    for (let i = 0; i < steps; i++) wk.step(surf, surf.lr[n]);
    out[n] = wk;
  }
  return out;
}

export const valleyTrails = lazy(() => trails(VALLEY, ['sgd', 'momentum', 'nesterov', 'adagrad', 'rmsprop', 'adam', 'newton'], 160));
export const saddleTrails = lazy(() => trails(SADDLE, ['sgd', 'momentum', 'nesterov', 'adagrad', 'rmsprop', 'adam', 'newton'], 160));

/**
 * Effective step multiplier 1 / sqrt(cache) for one parameter whose gradients shrink tenfold
 * halfway: Adagrad's keeps falling, RMSprop's climbs back up.
 */
export const STEP_T = 200;
export const stepSizes = lazy(() => {
  const r = new Rng(5);
  let sum = 0;
  let avg = 0;
  const ada: number[] = [];
  const rms: number[] = [];
  for (let t = 0; t < STEP_T; t++) {
    const g = (t < STEP_T / 2 ? 1 : 0.1) * (1 + 0.35 * r.randn());
    sum += g * g;
    avg = 0.95 * avg + 0.05 * g * g;
    ada.push(1 / Math.sqrt(sum));
    rms.push(1 / Math.sqrt(avg / (1 - 0.95 ** (t + 1))));
  }
  return { ada, rms };
});

/** Adam's two averages for a noisy gradient near 1: m with and without bias correction, and sqrt(v). */
export const ADAM_T = 60;
export const adamStream = lazy(() => {
  const r = new Rng(8);
  let m = 0;
  let v = 0;
  const g: number[] = [];
  const raw: number[] = [];
  const mt: number[] = [];
  const sv: number[] = [];
  for (let t = 1; t <= ADAM_T; t++) {
    const gi = 1 + 0.6 * r.randn();
    m = 0.9 * m + 0.1 * gi;
    v = 0.999 * v + 0.001 * gi * gi;
    g.push(gi);
    raw.push(m);
    mt.push(m / (1 - 0.9 ** t));
    sv.push(Math.sqrt(v / (1 - 0.999 ** t)));
  }
  return { g, raw, mt, sv };
});

// ---------------------------------------------------------------- annealing

export const ANNEAL_T = 800;
export const SCHEDS = [
  { name: 'constant', col: 'red' as const, lr: (_t: number) => 0.15 },
  { name: 'step', col: 'blue' as const, lr: (t: number) => 0.15 * 0.5 ** Math.floor(t / 150) },
  { name: 'exponential', col: 'green' as const, lr: (t: number) => 0.15 * Math.exp(-0.005 * t) },
  { name: '1/t', col: 'purple' as const, lr: (t: number) => 0.15 / (1 + 0.005 * t) },
];
export const bowl = (x: number, y: number): number => 0.5 * (x * x + 5 * y * y);

/** Noisy gradient descent on a bowl under each schedule: positions and a smoothed loss per step. */
export const annealRuns = lazy(() =>
  SCHEDS.map((sc) => {
    const rng = new Rng(3);
    let x = -3.6;
    let y = 1.6;
    let ema = bowl(x, y);
    const xs = [x];
    const ys = [y];
    const loss = [ema];
    for (let t = 0; t < ANNEAL_T; t++) {
      const lr = sc.lr(t);
      const gx = x + 1.5 * rng.randn();
      const gy = 5 * y + 1.5 * rng.randn();
      x -= lr * gx;
      y -= lr * gy;
      xs.push(x);
      ys.push(y);
      ema = 0.97 * ema + 0.03 * bowl(x, y);
      loss.push(ema);
    }
    return { xs, ys, loss };
  }),
);

/** Exponential decay with k = 0.2: it freezes before reaching the bottom. */
export const annealFast = lazy(() => {
  const rng = new Rng(3);
  let x = -3.6;
  let y = 1.6;
  const xs = [x];
  const ys = [y];
  for (let t = 0; t < ANNEAL_T; t++) {
    const lr = 0.15 * Math.exp(-0.2 * t);
    x -= lr * (x + 1.5 * rng.randn());
    y -= lr * (5 * y + 1.5 * rng.randn());
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
});

/** A running average of the constant-rate run's position, started once it reaches the bottom. */
export const AVG_FROM = 200;
export const runningAvg = lazy(() => {
  const run = annealRuns()[0]!;
  const xs: number[] = [];
  const ys: number[] = [];
  let ax = run.xs[AVG_FROM]!;
  let ay = run.ys[AVG_FROM]!;
  for (let t = AVG_FROM; t <= ANNEAL_T; t++) {
    ax = 0.995 * ax + 0.005 * run.xs[t]!;
    ay = 0.995 * ay + 0.005 * run.ys[t]!;
    xs.push(ax);
    ys.push(ay);
  }
  return { xs, ys };
});

// ---------------------------------------------------------------- hyperparameter search

/** The chapter's made-up validation score: only the learning-rate exponent matters much. */
export const searchScore = (x: number, y: number): number => 0.12 + 0.76 * Math.exp(-((x + 2.0) ** 2) / (2 * 0.3 ** 2)) + 0.025 * Math.sin(Math.PI * y);
export const scoreLr = (x: number): number => 0.12 + 0.76 * Math.exp(-((x + 2.0) ** 2) / (2 * 0.3 ** 2));

export const GRID_PTS: [number, number][] = [];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) GRID_PTS.push([-6 + (5 * a) / 2, b / 2]);
export const RAND_PTS: [number, number][] = (() => {
  const r = new Rng(4);
  return Array.from({ length: 9 }, () => [r.uniform(-6, -1), r.uniform(0, 1)] as [number, number]);
})();

/** Fills the heavier caches during idle time, so no scene stalls on first entry. */
if (typeof window !== 'undefined') {
  const queue = [relCurves, sanityRuns, lrRuns, gapRuns, valleyTrails, saddleTrails, stepSizes, adamStream, annealRuns, annealFast, runningAvg];
  const next = () => {
    const f = queue.shift();
    if (!f) return;
    f();
    setTimeout(next, 30);
  };
  setTimeout(next, 300);
}
