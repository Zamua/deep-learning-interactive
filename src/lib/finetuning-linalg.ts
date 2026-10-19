import { Rng } from '../core/rand';

/** A dense row-major matrix. */
export interface Mat {
  n: number;
  m: number;
  a: Float64Array;
}

export interface SVD {
  /** Left singular vectors as columns, n x k (row-major). */
  U: Float64Array;
  s: Float64Array;
  /** Right singular vectors as rows, k x m (row-major). */
  Vt: Float64Array;
  k: number;
}

/** Thin SVD by one-sided Jacobi rotations on the columns. Fine for matrices up to ~100 x 100. */
export function svd(M: Mat): SVD {
  const { n, m } = M;
  const W = M.a.slice();
  const Vm = new Float64Array(m * m);
  for (let i = 0; i < m; i++) Vm[i * m + i] = 1;
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = 0;
    for (let p = 0; p < m - 1; p++)
      for (let q = p + 1; q < m; q++) {
        let al = 0, be = 0, ga = 0;
        for (let i = 0; i < n; i++) {
          const x = W[i * m + p]!, y = W[i * m + q]!;
          al += x * x;
          be += y * y;
          ga += x * y;
        }
        if (Math.abs(ga) <= 1e-15 * Math.sqrt(al * be) || ga === 0) continue;
        off = Math.max(off, Math.abs(ga) / Math.sqrt(al * be));
        const z = (be - al) / (2 * ga);
        const t = Math.sign(z || 1) / (Math.abs(z) + Math.sqrt(1 + z * z));
        const c = 1 / Math.sqrt(1 + t * t), s = c * t;
        for (let i = 0; i < n; i++) {
          const x = W[i * m + p]!, y = W[i * m + q]!;
          W[i * m + p] = c * x - s * y;
          W[i * m + q] = s * x + c * y;
        }
        for (let i = 0; i < m; i++) {
          const x = Vm[i * m + p]!, y = Vm[i * m + q]!;
          Vm[i * m + p] = c * x - s * y;
          Vm[i * m + q] = s * x + c * y;
        }
      }
    if (off < 1e-12) break;
  }
  const k = Math.min(n, m);
  const norms = Array.from({ length: m }, (_, j) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += W[i * m + j]! ** 2;
    return Math.sqrt(s);
  });
  const order = norms.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, k);
  const U = new Float64Array(n * k), s = new Float64Array(k), Vt = new Float64Array(k * m);
  order.forEach(([sv, j], c) => {
    s[c] = sv;
    for (let i = 0; i < n; i++) U[i * k + c] = sv > 1e-12 ? W[i * m + j]! / sv : 0;
    for (let i = 0; i < m; i++) Vt[c * m + i] = Vm[i * m + j]!;
  });
  return { U, s, Vt, k };
}

/** The best rank-r approximation: the first r singular triples, added up. */
export function lowRank(d: SVD, n: number, m: number, r: number): Float64Array {
  const out = new Float64Array(n * m);
  for (let c = 0; c < Math.min(r, d.k); c++) {
    const sv = d.s[c]!;
    if (sv === 0) continue;
    for (let i = 0; i < n; i++) {
      const ui = d.U[i * d.k + c]! * sv;
      if (ui === 0) continue;
      for (let j = 0; j < m; j++) out[i * m + j]! += ui * d.Vt[c * m + j]!;
    }
  }
  return out;
}

export function frob(a: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! ** 2;
  return Math.sqrt(s);
}

/** A 64 x 64 grayscale scene in [0, 1]: sky, sun, two hills, a house with a window and a road. */
export function picture(N = 64): Mat {
  const a = new Float64Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const y = i / N, x = j / N;
      let v = 0.78 - 0.3 * y;
      const sun = Math.hypot(x - 0.78, y - 0.2);
      if (sun < 0.1) v = 0.98;
      const hill1 = 0.62 - 0.22 * Math.exp(-(((x - 0.25) / 0.2) ** 2));
      const hill2 = 0.66 - 0.16 * Math.exp(-(((x - 0.72) / 0.18) ** 2));
      if (y > hill2) v = 0.42;
      if (y > hill1) v = 0.3;
      if (x > 0.4 && x < 0.66 && y > 0.5 && y < 0.78) v = 0.88;
      const roof = 0.5 - 0.6 * (0.13 - Math.abs(x - 0.53));
      if (x > 0.37 && x < 0.69 && y < 0.5 && y > roof) v = 0.15;
      if (x > 0.46 && x < 0.52 && y > 0.56 && y < 0.64) v = 0.2;
      if (x > 0.56 && x < 0.62 && y > 0.62 && y < 0.78) v = 0.35;
      if (y > 0.78) v = 0.22 + 0.06 * Math.sin(x * 40) * (y > 0.88 ? 1 : 0);
      if (y > 0.84 && Math.abs(x - 0.5 - (y - 0.84) * 1.4) < 0.03 + (y - 0.84) * 0.2) v = 0.7;
      a[i * N + j] = v;
    }
  return { n: N, m: N, a };
}

/** A synthetic fine-tuning update: a few strong directions with falling strength, plus noise. */
export function updateLike(N = 48, seed = 4): Mat {
  const r = new Rng(seed);
  const a = new Float64Array(N * N);
  const k = 6;
  for (let c = 0; c < k; c++) {
    const sv = 3 * 0.5 ** c;
    const u = Array.from({ length: N }, () => r.randn());
    const v = Array.from({ length: N }, () => r.randn());
    const nu = Math.hypot(...u), nv = Math.hypot(...v);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) a[i * N + j]! += (sv * u[i]! * v[j]!) / (nu * nv);
  }
  for (let i = 0; i < N * N; i++) a[i]! += 0.002 * r.randn();
  return { n: N, m: N, a };
}

export function noise(N = 48, seed = 9): Mat {
  const r = new Rng(seed);
  return { n: N, m: N, a: Float64Array.from({ length: N * N }, () => r.randn()) };
}

/* ------------------------------------------------------------------ */
/* 4-bit quantization                                                  */
/* ------------------------------------------------------------------ */

/** The 16 NF4 levels: normal quantiles rescaled to [-1, 1], with an exact zero (bitsandbytes). */
export const NF4 = [
  -1, -0.6961928009986877, -0.5250730514526367, -0.39491748809814453, -0.28444138169288635, -0.18477343022823334,
  -0.09105003625154495, 0, 0.07958029955625534, 0.16093020141124725, 0.24611230194568634, 0.33791524171829224,
  0.44070982933044434, 0.5626170039176941, 0.7229568362236023, 1,
];
/** Symmetric int4 with absmax scaling: round(7 w / max|w|), 15 levels. */
export const INT4 = Array.from({ length: 15 }, (_, i) => (i - 7) / 7);

export interface Quant {
  /** Normalized weights w / absmax of their block, in [-1, 1]. */
  z: Float64Array;
  /** Chosen level index per weight. */
  code: Int32Array;
  /** Root-mean-square error of the dequantized weights. */
  rmse: number;
  counts: number[];
}

/** Blockwise absmax quantization of `w` onto `levels`. */
export function quantize(w: Float64Array, block: number, levels: number[]): Quant {
  const z = new Float64Array(w.length);
  const code = new Int32Array(w.length);
  const counts = levels.map(() => 0);
  let se = 0;
  for (let b0 = 0; b0 < w.length; b0 += block) {
    const b1 = Math.min(w.length, b0 + block);
    let mx = 0;
    for (let i = b0; i < b1; i++) mx = Math.max(mx, Math.abs(w[i]!));
    for (let i = b0; i < b1; i++) {
      const zi = mx ? w[i]! / mx : 0;
      z[i] = zi;
      let best = 0;
      for (let k = 1; k < levels.length; k++) if (Math.abs(zi - levels[k]!) < Math.abs(zi - levels[best]!)) best = k;
      code[i] = best;
      counts[best]!++;
      se += (levels[best]! * mx - w[i]!) ** 2;
    }
  }
  return { z, code, rmse: Math.sqrt(se / w.length), counts };
}

/* ------------------------------------------------------------------ */
/* Parameter and memory accounting                                     */
/* ------------------------------------------------------------------ */

export interface ModelShape {
  name: string;
  d: number;
  layers: number;
  ff: number;
  /** Width of the key and value projections (smaller than d with grouped-query attention). */
  kv: number;
  vocab: number;
  tied: boolean;
}

export const MODELS: Record<string, ModelShape> = {
  '1b': { name: 'Llama 3.2 1B', d: 2048, layers: 16, ff: 8192, kv: 512, vocab: 128256, tied: true },
  '7b': { name: 'Llama 2 7B', d: 4096, layers: 32, ff: 11008, kv: 4096, vocab: 32000, tied: false },
  '70b': { name: 'Llama 2 70B', d: 8192, layers: 80, ff: 28672, kv: 1024, vocab: 32000, tied: false },
};

export type Targets = 'qv' | 'attn' | 'all';

/** [k_in, d_out] of each linear layer in one block, by name. */
export function blockShapes(M: ModelShape): Record<string, [number, number]> {
  return {
    q: [M.d, M.d],
    k: [M.d, M.kv],
    v: [M.d, M.kv],
    o: [M.d, M.d],
    gate: [M.d, M.ff],
    up: [M.d, M.ff],
    down: [M.ff, M.d],
  };
}

export const TARGET_NAMES: Record<Targets, string[]> = {
  qv: ['q', 'v'],
  attn: ['q', 'k', 'v', 'o'],
  all: ['q', 'k', 'v', 'o', 'gate', 'up', 'down'],
};

export interface Budget {
  total: number;
  linear: number;
  embed: number;
  lora: number;
  /** Bytes for [weights, gradients, optimizer state] under full, LoRA and QLoRA fine-tuning. */
  full: [number, number, number];
  loraB: [number, number, number];
  qlora: [number, number, number];
}

/** Bits per weight for NF4 with double-quantized block constants (QLoRA). */
export const NF4_BITS = 4 + 8 / 64 + 32 / (64 * 256);

export function budget(M: ModelShape, targets: Targets, r: number): Budget {
  const sh = blockShapes(M);
  const linear = M.layers * Object.values(sh).reduce((a, [k, d]) => a + k * d, 0);
  const embed = M.vocab * M.d * (M.tied ? 1 : 2);
  const total = linear + embed;
  const lora = M.layers * TARGET_NAMES[targets].reduce((a, nm) => a + r * (sh[nm]![0] + sh[nm]![1]), 0);
  return {
    total,
    linear,
    embed,
    lora,
    full: [2 * total, 2 * total, 12 * total],
    loraB: [2 * total + 2 * lora, 2 * lora, 12 * lora],
    qlora: [(NF4_BITS / 8) * linear + 2 * embed + 2 * lora, 2 * lora, 12 * lora],
  };
}
