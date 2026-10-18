import { type CifarSet, loadCifar } from '../core/data';
import { onDispose } from '../core/dom';

export type Metric = 'L1' | 'L2';

const P = 3072;

/** Sum of |a - b| over the 3072 bytes of image i of `a` and image j of `b`. Integer math keeps it exact. */
export function l1(a: Uint8Array, i: number, b: Uint8Array, j: number): number {
  const oa = i * P;
  const ob = j * P;
  let s = 0;
  for (let d = 0; d < P; d++) {
    const v = (a[oa + d]! - b[ob + d]!) | 0;
    const m = v >> 31;
    s = (s + ((v ^ m) - m)) | 0;
  }
  return s;
}

/** sqrt of the sum of squared differences. 3072 * 255^2 still fits in an int32. */
export function l2(a: Uint8Array, i: number, b: Uint8Array, j: number): number {
  const oa = i * P;
  const ob = j * P;
  let s = 0;
  for (let d = 0; d < P; d++) {
    const v = (a[oa + d]! - b[ob + d]!) | 0;
    s = (s + Math.imul(v, v)) | 0;
  }
  return Math.sqrt(s);
}

export function dist(a: Uint8Array, i: number, b: Uint8Array, j: number, metric: Metric): number {
  return metric === 'L1' ? l1(a, i, b, j) : l2(a, i, b, j);
}

/** Distances from image i of `q` to every image of `train`. */
export function distancesTo(q: CifarSet, i: number, train: CifarSet, metric: Metric): Float64Array {
  const out = new Float64Array(train.n);
  for (let j = 0; j < train.n; j++) out[j] = dist(q.pixels, i, train.pixels, j, metric);
  return out;
}

/** Indices of `cand` (default: all) sorted by `row`, ascending, truncated to `k`. Ties keep index order. */
export function nearest(row: ArrayLike<number>, k: number, cand?: number[]): number[] {
  const idx = cand ? cand.slice() : Array.from({ length: row.length }, (_, j) => j);
  idx.sort((a, b) => row[a]! - row[b]! || a - b);
  return idx.slice(0, k);
}

/** `np.argmax(np.bincount(labels[idx[:k]]))`: the most common label, the smallest one on a tie. */
export function vote(labels: ArrayLike<number>, idx: number[], k: number, classes = 10): { pred: number; votes: number[] } {
  const votes = new Array<number>(classes).fill(0);
  for (let t = 0; t < Math.min(k, idx.length); t++) votes[labels[idx[t]!]!]!++;
  let pred = 0;
  for (let c = 1; c < classes; c++) if (votes[c]! > votes[pred]!) pred = c;
  return { pred, votes };
}

type Kind = 'train-train' | 'test-train';
interface Job {
  promise: Promise<Float32Array>;
  listeners: ((frac: number) => void)[];
  cancel: () => void;
}
const done = new Map<string, Float32Array>();
const running = new Map<string, Job>();

/**
 * A full distance matrix, computed in time-sliced chunks so the page stays responsive, and cached
 * for the session. train-train is 1000 x 1000 (symmetric, so only half is computed); test-train
 * is 200 x 1000. Row i holds the distances from image i to every training image.
 */
export function distanceMatrix(kind: Kind, metric: Metric, onProgress: (frac: number) => void): Promise<Float32Array> {
  const key = `${kind}-${metric}`;
  const hit = done.get(key);
  if (hit) {
    onProgress(1);
    return Promise.resolve(hit);
  }
  const live = running.get(key);
  if (live) {
    live.listeners.push(onProgress);
    return live.promise;
  }
  const listeners = [onProgress];
  let cancelled = false;
  let timer = 0;
  const job: Job = {
    listeners,
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
    promise: loadCifar().then(
      ({ train, test }) =>
        new Promise<Float32Array>((resolve, reject) => {
          const q = kind === 'train-train' ? train : test;
          const sym = kind === 'train-train';
          const n = train.n;
          const D = new Float32Array(q.n * n);
          const f = metric === 'L1' ? l1 : l2;
          let i = 0;
          const total = sym ? (q.n * (q.n - 1)) / 2 : q.n * n;
          let doneWork = 0;
          const chunk = () => {
            if (cancelled) {
              reject(new Error('cancelled'));
              return;
            }
            const t0 = performance.now();
            while (i < q.n && performance.now() - t0 < 22) {
              if (sym) {
                for (let j = i + 1; j < n; j++) {
                  const v = f(q.pixels, i, train.pixels, j);
                  D[i * n + j] = v;
                  D[j * n + i] = v;
                }
                doneWork += n - i - 1;
              } else {
                for (let j = 0; j < n; j++) D[i * n + j] = f(q.pixels, i, train.pixels, j);
                doneWork += n;
              }
              i++;
            }
            for (const l of listeners) l(doneWork / total);
            if (i < q.n) timer = window.setTimeout(chunk, 0);
            else {
              done.set(key, D);
              running.delete(key);
              resolve(D);
            }
          };
          timer = window.setTimeout(chunk, 0);
        }),
    ),
  };
  running.set(key, job);
  job.promise.catch(() => running.delete(key));
  onDispose(() => {
    if (running.get(key) === job) {
      job.cancel();
      running.delete(key);
    }
  });
  return job.promise;
}

/** Accuracy of kNN with each k in `ks`, per fold, from a precomputed train-train matrix. */
export function crossValidateFold(D: Float32Array, labels: Uint8Array, n: number, folds: number, f: number, ks: number[]): number[] {
  const size = n / folds;
  const lo = f * size;
  const hi = lo + size;
  const cand: number[] = [];
  for (let j = 0; j < n; j++) if (j < lo || j >= hi) cand.push(j);
  const kmax = Math.max(...ks);
  const correct = ks.map(() => 0);
  for (let i = lo; i < hi; i++) {
    const row = D.subarray(i * n, (i + 1) * n);
    const nn = nearest(row, kmax, cand);
    ks.forEach((k, t) => {
      if (vote(labels, nn, k).pred === labels[i]) correct[t]!++;
    });
  }
  return correct.map((c) => c / size);
}
