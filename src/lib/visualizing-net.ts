/**
 * A small trained ConvNet (conv-relu-pool x3, then one fully-connected layer) that runs in the
 * page: forward pass, and backward pass to the input image from any intermediate stage.
 * Weights come from public/data/visualizing-net.{json,bin}; batch norm is already folded in.
 */

/** How the backward pass treats a ReLU: true gradient, deconvnet, or guided backpropagation. */
export type ReluRule = 'grad' | 'deconv' | 'guided';

export type Stage = 'relu1' | 'pool1' | 'relu2' | 'pool2' | 'relu3' | 'pool3' | 'scores';

export interface Conv {
  cin: number;
  cout: number;
  k: number;
  pad: number;
  W: Float32Array; // cout x cin x k x k
  b: Float32Array;
}

/** Everything one forward pass computed, kept for the backward pass and for drawing. */
export interface Trace {
  x: Float32Array; // 3 x 32 x 32, mean-subtracted, in [0,1] - mean
  z: Float32Array[]; // pre-ReLU conv outputs, one per block
  a: Float32Array[]; // post-ReLU
  p: Float32Array[]; // after 2x2 max pooling
  arg: Int32Array[]; // for each pooled value, the index in `a` it came from
  scores: Float32Array;
}

interface Manifest {
  mean: number[];
  testAcc: number;
  tensors: { name: string; shape: number[]; offset: number }[];
  snapshots?: { label: string; offset: number; acc?: number }[];
}

export class ConvNet {
  readonly convs: Conv[];
  readonly fcW: Float32Array; // 10 x 1024
  readonly fcB: Float32Array;
  readonly mean: number[];
  readonly testAcc: number;
  /** First-layer filters at points during training: label + weights (cout x cin x k x k). */
  readonly snapshots: { label: string; W: Float32Array; acc?: number }[];
  /** Spatial size of each block's conv output. */
  readonly sizes = [32, 16, 8];

  constructor(m: Manifest, buf: ArrayBuffer) {
    const t = (name: string) => {
      const d = m.tensors.find((q) => q.name === name);
      if (!d) throw new Error(`missing tensor ${name}`);
      const n = d.shape.reduce((a, b) => a * b, 1);
      return { data: new Float32Array(buf, d.offset, n), shape: d.shape };
    };
    this.convs = [1, 2, 3].map((i) => {
      const w = t(`c${i}.w`);
      const [cout, cin, k] = w.shape as [number, number, number];
      return { cin, cout, k, pad: (k - 1) / 2, W: w.data, b: t(`c${i}.b`).data };
    });
    this.fcW = t('fc.w').data;
    this.fcB = t('fc.b').data;
    this.mean = m.mean;
    this.testAcc = m.testAcc;
    const n1 = this.convs[0]!.W.length;
    this.snapshots = (m.snapshots ?? []).map((s) => ({ label: s.label, W: new Float32Array(buf, s.offset, n1), acc: s.acc }));
  }

  /** CIFAR bytes (channel-major, 3072 per image) -> the network's input. */
  input(pixels: Uint8Array, i: number): Float32Array {
    const x = new Float32Array(3072);
    const o = i * 3072;
    for (let c = 0; c < 3; c++) {
      const mu = this.mean[c]!;
      for (let q = 0; q < 1024; q++) x[c * 1024 + q] = pixels[o + c * 1024 + q]! / 255 - mu;
    }
    return x;
  }

  forward(x: Float32Array): Trace {
    const z: Float32Array[] = [];
    const a: Float32Array[] = [];
    const p: Float32Array[] = [];
    const arg: Int32Array[] = [];
    let inp = x;
    this.convs.forEach((L, l) => {
      const H = this.sizes[l]!;
      const zl = new Float32Array(L.cout * H * H);
      convForward(L, inp, H, zl);
      const al = new Float32Array(zl.length);
      for (let i = 0; i < zl.length; i++) al[i] = zl[i]! > 0 ? zl[i]! : 0;
      const Hp = H / 2;
      const pl = new Float32Array(L.cout * Hp * Hp);
      const ag = new Int32Array(pl.length);
      for (let c = 0; c < L.cout; c++) {
        for (let py = 0; py < Hp; py++) {
          for (let px = 0; px < Hp; px++) {
            const i0 = c * H * H + 2 * py * H + 2 * px;
            let best = i0;
            if (al[i0 + 1]! > al[best]!) best = i0 + 1;
            if (al[i0 + H]! > al[best]!) best = i0 + H;
            if (al[i0 + H + 1]! > al[best]!) best = i0 + H + 1;
            const j = c * Hp * Hp + py * Hp + px;
            pl[j] = al[best]!;
            ag[j] = best;
          }
        }
      }
      z.push(zl);
      a.push(al);
      p.push(pl);
      arg.push(ag);
      inp = pl;
    });
    const f = inp;
    const scores = new Float32Array(10);
    const D = f.length;
    for (let j = 0; j < 10; j++) {
      let s = this.fcB[j]!;
      const row = j * D;
      for (let i = 0; i < D; i++) s += this.fcW[row + i]! * f[i]!;
      scores[j] = s;
    }
    return { x, z, a, p, arg, scores };
  }

  /**
   * Gradient with respect to the input image. `grads` injects an upstream gradient at any
   * stages (e.g. `{ scores: onehot }` for a class score, `{ relu2: g }` for DeepDream); the
   * contributions are summed on the way down.
   */
  backward(t: Trace, grads: Partial<Record<Stage, Float32Array>>, relu: ReluRule = 'grad'): Float32Array {
    let dp: Float32Array | null = null;
    if (grads.scores) {
      const D = t.p[2]!.length;
      dp = new Float32Array(D);
      for (let j = 0; j < 10; j++) {
        const g = grads.scores[j]!;
        if (g === 0) continue;
        const row = j * D;
        for (let i = 0; i < D; i++) dp[i]! += g * this.fcW[row + i]!;
      }
    }
    for (let l = 2; l >= 0; l--) {
      const L = this.convs[l]!;
      const H = this.sizes[l]!;
      const inj = grads[`pool${l + 1}` as Stage];
      if (inj) dp = dp ? addInto(dp, inj) : Float32Array.from(inj);
      let da: Float32Array | null = null;
      if (dp) {
        da = new Float32Array(L.cout * H * H);
        const ag = t.arg[l]!;
        for (let j = 0; j < dp.length; j++) da[ag[j]!]! += dp[j]!;
      }
      const injA = grads[`relu${l + 1}` as Stage];
      if (injA) da = da ? addInto(da, injA) : Float32Array.from(injA);
      if (!da) {
        dp = null;
        continue;
      }
      const zl = t.z[l]!;
      if (relu === 'grad') for (let i = 0; i < da.length; i++) if (zl[i]! <= 0) da[i] = 0;
      if (relu === 'deconv') for (let i = 0; i < da.length; i++) if (da[i]! < 0) da[i] = 0;
      if (relu === 'guided') for (let i = 0; i < da.length; i++) if (zl[i]! <= 0 || da[i]! < 0) da[i] = 0;
      const din = new Float32Array(L.cin * H * H);
      convBackwardInput(L, da, H, din);
      dp = din;
    }
    return dp ?? new Float32Array(3072);
  }

  /** d(score of class c) / d(image), plus the forward trace it was computed at. */
  scoreGrad(x: Float32Array, c: number, relu: ReluRule = 'grad'): { t: Trace; dx: Float32Array } {
    const t = this.forward(x);
    const g = new Float32Array(10);
    g[c] = 1;
    return { t, dx: this.backward(t, { scores: g }, relu) };
  }

  /** The post-ReLU (or pooled) activations of `stage` from a trace. */
  stage(t: Trace, s: Stage): Float32Array {
    if (s === 'scores') return t.scores;
    const l = Number(s.slice(-1)) - 1;
    return s.startsWith('relu') ? t.a[l]! : t.p[l]!;
  }

  /** [channels, height] of a stage's activation volume. */
  shape(s: Stage): [number, number] {
    if (s === 'scores') return [10, 1];
    const l = Number(s.slice(-1)) - 1;
    const C = this.convs[l]!.cout;
    return [C, s.startsWith('relu') ? this.sizes[l]! : this.sizes[l]! / 2];
  }

  /** Receptive field of a unit at (y, x) of `stage`, as an inclusive pixel box, clipped. */
  receptiveField(stage: Stage, y: number, x: number): [number, number, number, number] {
    const k1 = this.convs[0]!.k;
    const p1 = (k1 - 1) / 2;
    // [stride, offset of the first pixel, size] for each stage
    const geo: Record<Stage, [number, number, number]> = {
      relu1: [1, -p1, k1],
      pool1: [2, -p1, k1 + 1],
      relu2: [2, -p1 - 2, k1 + 5],
      pool2: [4, -p1 - 2, k1 + 7],
      relu3: [4, -p1 - 6, k1 + 15],
      pool3: [8, -p1 - 6, k1 + 19],
      scores: [32, 0, 32],
    };
    const [s, o, n] = geo[stage];
    const clip = (v: number) => Math.max(0, Math.min(31, v));
    return [clip(y * s + o), clip(x * s + o), clip(y * s + o + n - 1), clip(x * s + o + n - 1)];
  }
}

function addInto(a: Float32Array, b: Float32Array): Float32Array {
  for (let i = 0; i < a.length; i++) a[i]! += b[i]!;
  return a;
}

/** Same-padded, stride-1 convolution of a cin x H x H tensor. */
function convForward(L: Conv, inp: Float32Array, H: number, out: Float32Array): void {
  const { cin, cout, k, pad, W, b } = L;
  const HW = H * H;
  for (let o = 0; o < cout; o++) {
    const ob = o * HW;
    out.fill(b[o]!, ob, ob + HW);
    for (let c = 0; c < cin; c++) {
      const ib = c * HW;
      for (let ky = 0; ky < k; ky++) {
        const dy = ky - pad;
        const y0 = Math.max(0, -dy);
        const y1 = Math.min(H, H - dy);
        for (let kx = 0; kx < k; kx++) {
          const dx = kx - pad;
          const x0 = Math.max(0, -dx);
          const x1 = Math.min(H, H - dx);
          const w = W[((o * cin + c) * k + ky) * k + kx]!;
          for (let y = y0; y < y1; y++) {
            const orow = ob + y * H;
            const irow = ib + (y + dy) * H + dx;
            for (let x = x0; x < x1; x++) out[orow + x]! += w * inp[irow + x]!;
          }
        }
      }
    }
  }
}

/** The transpose of convForward: spreads each output gradient back over its input window. */
function convBackwardInput(L: Conv, dout: Float32Array, H: number, din: Float32Array): void {
  const { cin, cout, k, pad, W } = L;
  const HW = H * H;
  for (let o = 0; o < cout; o++) {
    const ob = o * HW;
    for (let c = 0; c < cin; c++) {
      const ib = c * HW;
      for (let ky = 0; ky < k; ky++) {
        const dy = ky - pad;
        const y0 = Math.max(0, -dy);
        const y1 = Math.min(H, H - dy);
        for (let kx = 0; kx < k; kx++) {
          const dx = kx - pad;
          const x0 = Math.max(0, -dx);
          const x1 = Math.min(H, H - dx);
          const w = W[((o * cin + c) * k + ky) * k + kx]!;
          for (let y = y0; y < y1; y++) {
            const orow = ob + y * H;
            const irow = ib + (y + dy) * H + dx;
            for (let x = x0; x < x1; x++) din[irow + x]! += w * dout[orow + x]!;
          }
        }
      }
    }
  }
}

export function softmax(s: ArrayLike<number>): Float32Array {
  let mx = -Infinity;
  for (let i = 0; i < s.length; i++) mx = Math.max(mx, s[i]!);
  const e = new Float32Array(s.length);
  let z = 0;
  for (let i = 0; i < s.length; i++) z += e[i] = Math.exp(s[i]! - mx);
  for (let i = 0; i < s.length; i++) e[i]! /= z;
  return e;
}

export function argmax(s: ArrayLike<number>): number {
  let b = 0;
  for (let i = 1; i < s.length; i++) if (s[i]! > s[b]!) b = i;
  return b;
}

/** Separable 3-tap Gaussian-ish blur of a 3 x 32 x 32 image, in place. */
export function blur3(x: Float32Array, sigma: number): void {
  if (sigma <= 0) return;
  const r = Math.max(1, Math.ceil(sigma * 2));
  const ker: number[] = [];
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    ker.push(v);
    s += v;
  }
  for (let i = 0; i < ker.length; i++) ker[i]! /= s;
  const tmp = new Float32Array(1024);
  for (let c = 0; c < 3; c++) {
    const o = c * 1024;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < 32; y++) {
        for (let xx = 0; xx < 32; xx++) {
          let acc = 0;
          for (let i = -r; i <= r; i++) {
            const yy = pass ? Math.max(0, Math.min(31, y + i)) : y;
            const xq = pass ? xx : Math.max(0, Math.min(31, xx + i));
            acc += ker[i + r]! * x[o + yy * 32 + xq]!;
          }
          tmp[y * 32 + xx] = acc;
        }
      }
      x.set(tmp, o);
    }
  }
}

/** Circularly shifts a 3 x 32 x 32 image by (dy, dx): the jitter trick. */
export function roll(x: Float32Array, dy: number, dx: number): Float32Array {
  const out = new Float32Array(3072);
  for (let c = 0; c < 3; c++)
    for (let y = 0; y < 32; y++)
      for (let xx = 0; xx < 32; xx++) out[c * 1024 + ((y + dy + 32) % 32) * 32 + ((xx + dx + 32) % 32)] = x[c * 1024 + y * 32 + xx]!;
  return out;
}

/** Adds `scale` times the gradient of sum((x[i+1,j]-x[i,j])^2 + (x[i,j+1]-x[i,j])^2) to `out`. */
export function addTvGrad(x: Float32Array, out: Float32Array, scale: number): void {
  for (let c = 0; c < 3; c++) {
    const o = c * 1024;
    for (let y = 0; y < 32; y++) {
      for (let q = 0; q < 32; q++) {
        const i = o + y * 32 + q;
        let g = 0;
        if (y > 0) g += x[i]! - x[i - 32]!;
        if (y < 31) g += x[i]! - x[i + 32]!;
        if (q > 0) g += x[i]! - x[i - 1]!;
        if (q < 31) g += x[i]! - x[i + 1]!;
        out[i]! += 2 * scale * g;
      }
    }
  }
}

/** Gram matrix of a C x M activation block: G[i][j] = sum_k F[i,k] F[j,k] / M. */
export function gram(F: Float32Array, C: number, M: number): Float32Array {
  const G = new Float32Array(C * C);
  for (let i = 0; i < C; i++) {
    for (let j = i; j < C; j++) {
      let s = 0;
      const a = i * M;
      const b = j * M;
      for (let k = 0; k < M; k++) s += F[a + k]! * F[b + k]!;
      G[i * C + j] = G[j * C + i] = s / M;
    }
  }
  return G;
}

/** Clamps a network input so that adding the mean back gives pixel values in [0, 1]. */
export function clampImage(x: Float32Array, mean: number[]): void {
  for (let c = 0; c < 3; c++) {
    const lo = -mean[c]!;
    const hi = 1 - mean[c]!;
    for (let q = 0; q < 1024; q++) {
      const i = c * 1024 + q;
      if (x[i]! < lo) x[i] = lo;
      else if (x[i]! > hi) x[i] = hi;
    }
  }
}

let netPromise: Promise<ConvNet> | null = null;

/** Fetches the trained weights once per session. */
export function loadNet(): Promise<ConvNet> {
  netPromise ??= Promise.all([
    fetch('./data/visualizing-net.json').then((r) => {
      if (!r.ok) throw new Error(`visualizing-net.json: ${r.status}`);
      return r.json() as Promise<Manifest>;
    }),
    fetch('./data/visualizing-net.bin').then((r) => {
      if (!r.ok) throw new Error(`visualizing-net.bin: ${r.status}`);
      return r.arrayBuffer();
    }),
  ]).then(([m, buf]) => new ConvNet(m, buf));
  return netPromise;
}
