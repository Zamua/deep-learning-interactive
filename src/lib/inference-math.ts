import { Rng } from '../core/rand';

// ------------------------------------------------------------------ hardware and model

export type GpuId = 'A100' | 'H100';
export interface Gpu {
  id: GpuId;
  name: string;
  /** Dense bf16 tensor-core peak, FLOP/s. */
  flops: number;
  /** HBM bandwidth, bytes/s. */
  bw: number;
  /** HBM capacity, bytes. */
  mem: number;
}

/** Datasheet numbers (dense, no sparsity). Real kernels reach a good fraction of these, never all. */
export const GPUS: Record<GpuId, Gpu> = {
  A100: { id: 'A100', name: 'A100 80GB', flops: 312e12, bw: 2.039e12, mem: 80e9 },
  H100: { id: 'H100', name: 'H100 SXM', flops: 989e12, bw: 3.35e12, mem: 80e9 },
};

/** Llama 3 8B: 32 layers, 32 query heads sharing 8 key/value heads of width 128. */
export const MODEL = { name: 'Llama 3 8B', params: 8.03e9, layers: 32, heads: 32, kvHeads: 8, dHead: 128 };

/** Bytes of bf16 KV cache per token: a key and a value per layer and kv head. */
export const KV_PER_TOKEN = 2 * MODEL.layers * MODEL.kvHeads * MODEL.dHead * 2;

/** FLOPs for one new token to attend over `ctx` cached tokens (Q K^T and A V, every head). */
export const attnFlops = (ctx: number): number => 4 * MODEL.layers * MODEL.heads * MODEL.dHead * ctx;

export interface StepCost {
  flops: number;
  bytes: number;
  wBytes: number;
  cBytes: number;
  tComp: number;
  tMem: number;
  t: number;
  /** Tokens per second across the whole batch. */
  tokS: number;
  /** Tokens per second each sequence sees. */
  userS: number;
  intensity: number;
  fits: boolean;
  bound: 'compute' | 'weights' | 'cache';
}

/** One decode step for B sequences of `ctx` cached tokens each, on the roofline model. */
export function decodeStep(B: number, ctx: number, gpu: Gpu, bytesPerWeight = 2): StepCost {
  const wBytes = MODEL.params * bytesPerWeight;
  const cBytes = B * ctx * KV_PER_TOKEN;
  const flops = B * (2 * MODEL.params + attnFlops(ctx));
  const bytes = wBytes + cBytes;
  const tComp = flops / gpu.flops;
  const tMem = bytes / gpu.bw;
  const t = Math.max(tComp, tMem);
  return {
    flops, bytes, wBytes, cBytes, tComp, tMem, t,
    tokS: B / t,
    userS: 1 / t,
    intensity: flops / bytes,
    fits: bytes <= gpu.mem,
    bound: tComp >= tMem ? 'compute' : wBytes >= cBytes ? 'weights' : 'cache',
  };
}

/** Prefill of a T-token prompt: every token through every weight, causal attention, cache written. */
export function prefillCost(T: number, gpu: Gpu): { flops: number; bytes: number; tComp: number; tMem: number; t: number; intensity: number } {
  const flops = 2 * MODEL.params * T + 2 * MODEL.layers * MODEL.heads * MODEL.dHead * T * T;
  const bytes = 2 * MODEL.params + T * KV_PER_TOKEN;
  const tComp = flops / gpu.flops;
  const tMem = bytes / gpu.bw;
  return { flops, bytes, tComp, tMem, t: Math.max(tComp, tMem), intensity: flops / bytes };
}

// ------------------------------------------------------------------ quantization

export type Scheme = 'absmax' | 'zero';
export type Gran = 'tensor' | 'channel' | 'group';

export interface QParams {
  s: number;
  z: number;
  /** Integer range [lo, hi]. */
  lo: number;
  hi: number;
}

/** Quantizes v[from .. from+n) and writes the dequantized values into out at the same indices. */
export function quantGroup(v: ArrayLike<number>, from: number, n: number, bits: number, scheme: Scheme, out: Float64Array): QParams {
  if (scheme === 'absmax') {
    const qmax = 2 ** (bits - 1) - 1;
    let m = 0;
    for (let i = from; i < from + n; i++) m = Math.max(m, Math.abs(v[i]!));
    const s = m > 0 ? m / qmax : 1;
    for (let i = from; i < from + n; i++) out[i] = Math.max(-qmax, Math.min(qmax, Math.round(v[i]! / s))) * s;
    return { s, z: 0, lo: -qmax, hi: qmax };
  }
  const hi = 2 ** bits - 1;
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = from; i < from + n; i++) {
    mn = Math.min(mn, v[i]!);
    mx = Math.max(mx, v[i]!);
  }
  const s = mx > mn ? (mx - mn) / hi : 1;
  const z = Math.max(0, Math.min(hi, Math.round(-mn / s)));
  for (let i = from; i < from + n; i++) out[i] = (Math.max(0, Math.min(hi, Math.round(v[i]! / s) + z)) - z) * s;
  return { s, z, lo: 0, hi };
}

export interface QResult {
  What: Float64Array;
  /** Signal-to-quantization-noise ratio over the whole matrix, dB. */
  sqnr: number;
  /** Distinct values each row ends up using. */
  levels: number[];
  /** Storage per weight including fp16 scales (and zero points), bits. */
  bpw: number;
}

export function quantMatrix(W: Float64Array, rows: number, cols: number, bits: number, scheme: Scheme, gran: Gran, group = 32): QResult {
  const What = new Float64Array(W.length);
  let groups = 1;
  if (gran === 'tensor') quantGroup(W, 0, W.length, bits, scheme, What);
  else {
    const g = gran === 'channel' ? cols : group;
    groups = W.length / g;
    for (let i = 0; i < W.length; i += g) quantGroup(W, i, g, bits, scheme, What);
  }
  let sig = 0;
  let err = 0;
  for (let i = 0; i < W.length; i++) {
    sig += W[i]! ** 2;
    err += (W[i]! - What[i]!) ** 2;
  }
  const levels: number[] = [];
  for (let r = 0; r < rows; r++) {
    const set = new Set<number>();
    for (let c = 0; c < cols; c++) set.add(What[r * cols + c]!);
    levels.push(set.size);
  }
  const perGroup = 16 + (scheme === 'zero' ? bits : 0);
  return { What, sqnr: err > 0 ? 10 * Math.log10(sig / err) : Infinity, levels, bpw: bits + (perGroup * groups) / W.length };
}

/** A toy weight matrix: rows of very different sizes, heavy-ish tails, and optional outliers in the last row. */
export const QW_ROWS = 8;
export const QW_COLS = 256;
const QW_SIGMA = [0.005, 0.007, 0.01, 0.013, 0.017, 0.022, 0.03, 0.04];
export const QW_BASE: Float64Array = (() => {
  const r = new Rng(19);
  const W = new Float64Array(QW_ROWS * QW_COLS);
  for (let i = 0; i < QW_ROWS; i++)
    for (let j = 0; j < QW_COLS; j++) W[i * QW_COLS + j] = QW_SIGMA[i]! * r.randn() * (r.next() < 0.1 ? 2.5 : 1);
  return W;
})();
/** Positions (in the last row) and values of the outlier weights. */
export const QW_OUTLIERS: [number, number][] = [
  [(QW_ROWS - 1) * QW_COLS + 37, 0.42],
  [(QW_ROWS - 1) * QW_COLS + 150, -0.36],
];
export function weightsWith(outliers: boolean): Float64Array {
  const W = new Float64Array(QW_BASE);
  if (outliers) for (const [i, v] of QW_OUTLIERS) W[i] = v;
  return W;
}

// ------------------------------------------------------------------ LLM.int8 toy

export const AX_T = 16;
export const AX_D = 64;
export const AX_M = 32;
export const AX_OUTLIER_COLS = [9, 44];
const AX_BASE = (() => {
  const r = new Rng(23);
  const X = new Float64Array(AX_T * AX_D);
  for (let i = 0; i < X.length; i++) X[i] = r.randn();
  const W = new Float64Array(AX_D * AX_M);
  for (let i = 0; i < W.length; i++) W[i] = r.randn() / Math.sqrt(AX_D);
  const sign = AX_OUTLIER_COLS.map(() => (r.next() < 0.5 ? -1 : 1));
  const shape = Array.from({ length: AX_T }, () => 0.7 + 0.3 * r.next());
  return { X, W, sign, shape };
})();
export const AX_W = AX_BASE.W;

/** Activations whose two outlier features have size about `mag` (1 means no outliers). */
export function activations(mag: number): Float64Array {
  const X = new Float64Array(AX_BASE.X);
  if (mag > 1)
    for (let t = 0; t < AX_T; t++)
      AX_OUTLIER_COLS.forEach((c, k) => {
        X[t * AX_D + c] = AX_BASE.sign[k]! * mag * AX_BASE.shape[t]! + 0.3 * X[t * AX_D + c]!;
      });
  return X;
}

function matmul(X: Float64Array, W: Float64Array, cols: boolean[] | null): Float64Array {
  const Y = new Float64Array(AX_T * AX_M);
  for (let t = 0; t < AX_T; t++)
    for (let d = 0; d < AX_D; d++) {
      if (cols && !cols[d]) continue;
      const x = X[t * AX_D + d]!;
      for (let m = 0; m < AX_M; m++) Y[t * AX_M + m]! += x * W[d * AX_M + m]!;
    }
  return Y;
}

/** X absmax-quantized to int8, one scale per row (or for the whole tensor) taken over the features in `over`. */
function quantX(X: Float64Array, over: boolean[], perRow: boolean): Float64Array {
  const Xq = new Float64Array(X.length);
  const rows = perRow ? AX_T : 1;
  const span = perRow ? AX_D : X.length;
  for (let r = 0; r < rows; r++) {
    let m = 0;
    for (let i = r * span; i < (r + 1) * span; i++) if (over[i % AX_D]) m = Math.max(m, Math.abs(X[i]!));
    const s = m / 127 || 1;
    for (let i = r * span; i < (r + 1) * span; i++) Xq[i] = Math.round(X[i]! / s) * s;
  }
  return Xq;
}

/** W absmax-quantized to int8, one scale per output column. */
const AX_WQ: Float64Array = (() => {
  const Wq = new Float64Array(AX_W.length);
  for (let c = 0; c < AX_M; c++) {
    let m = 0;
    for (let d = 0; d < AX_D; d++) m = Math.max(m, Math.abs(AX_W[d * AX_M + c]!));
    const s = m / 127 || 1;
    for (let d = 0; d < AX_D; d++) Wq[d * AX_M + c] = Math.round(AX_W[d * AX_M + c]! / s) * s;
  }
  return Wq;
})();

export interface Int8Errors {
  /** Relative error of what the ordinary (non-outlier) features contribute to X @ W, per scheme. */
  tensor: number;
  row: number;
  mixed: number;
  outlierCols: boolean[];
}

/**
 * int8 error under one scale for all of X, one scale per row of X, and LLM.int8's split
 * (features reaching the threshold kept in 16 bits, per-row scales over the rest).
 */
export function int8Errors(X: Float64Array, threshold = 6): Int8Errors {
  const all = Array.from({ length: AX_D }, () => true);
  const outlierCols = Array.from({ length: AX_D }, (_, d) => {
    for (let t = 0; t < AX_T; t++) if (Math.abs(X[t * AX_D + d]!) >= threshold) return true;
    return false;
  });
  const rest = outlierCols.map((o) => !o);
  const Y = matmul(X, AX_W, rest);
  const rel = (Xq: Float64Array) => {
    const Yh = matmul(Xq, AX_WQ, rest);
    let n = 0;
    let e = 0;
    for (let i = 0; i < Y.length; i++) {
      n += Y[i]! ** 2;
      e += (Y[i]! - Yh[i]!) ** 2;
    }
    return Math.sqrt(e / n);
  };
  return { tensor: rel(quantX(X, all, false)), row: rel(quantX(X, all, true)), mixed: rel(quantX(X, rest, true)), outlierCols };
}

// ------------------------------------------------------------------ speculative decoding

export const VOCAB = ['the', 'cat', 'sat', 'on', 'a', 'mat'];
export const P_TARGET = [0.32, 0.24, 0.16, 0.13, 0.09, 0.06];
/** A draft that has learned something else: what q becomes as its quality drops to 0. */
export const Q_OFF = [0.08, 0.1, 0.3, 0.12, 0.28, 0.12];
export const draftDist = (quality: number): number[] => P_TARGET.map((pi, i) => quality * pi + (1 - quality) * Q_OFF[i]!);
export const alphaOf = (p: number[], q: number[]): number => p.reduce((a, pi, i) => a + Math.min(pi, q[i]!), 0);

export function sampleFrom(d: number[], u: number): number {
  let acc = 0;
  for (let i = 0; i < d.length; i++) {
    acc += d[i]!;
    if (u < acc) return i;
  }
  return d.length - 1;
}

/** exact: the residual max(0, p - q); accept: keep every draft; fromp: on a rejection sample p itself. */
export type Rule = 'exact' | 'accept' | 'fromp';

export interface Pass {
  drafts: number[];
  ok: boolean[];
  out: number[];
  /** How the last token was made: from the residual after a rejection, or the bonus token from p. */
  last: 'resid' | 'bonus';
}

/** One draft-then-verify pass with context-free p and q. */
export function specPass(p: number[], q: number[], k: number, rng: Rng, rule: Rule = 'exact'): Pass {
  const drafts: number[] = [];
  const ok: boolean[] = [];
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const x = sampleFrom(q, rng.next());
    drafts.push(x);
    const keep = rule === 'accept' || rng.next() < Math.min(1, p[x]! / q[x]!);
    ok.push(keep);
    if (keep) {
      out.push(x);
      continue;
    }
    if (rule === 'fromp') out.push(sampleFrom(p, rng.next()));
    else {
      const r = p.map((pi, j) => Math.max(0, pi - q[j]!));
      const tot = r.reduce((a, b) => a + b, 0);
      out.push(sampleFrom(r.map((v) => v / tot), rng.next()));
    }
    return { drafts, ok, out, last: 'resid' };
  }
  out.push(sampleFrom(p, rng.next()));
  return { drafts, ok, out, last: 'bonus' };
}

/** Expected tokens from one target pass when each draft token is kept with probability alpha. */
export const expectedTokens = (alpha: number, k: number): number => (alpha >= 0.999999 ? k + 1 : (1 - alpha ** (k + 1)) / (1 - alpha));
/** Wall-clock speedup when a draft step costs c target steps (Leviathan et al., 2022). */
export const speedup = (alpha: number, k: number, c: number): number => expectedTokens(alpha, k) / (k * c + 1);

// ------------------------------------------------------------------ batching schedules

export interface Sched {
  slots: number;
  steps: number;
  /** cell[slot * cap + step]: request id, or -1 for an idle slot. */
  cell: Int16Array;
  /** 1 where a request's first step (its prefill) sits. */
  first: Uint8Array;
  cap: number;
  /** Step after which each request finished. */
  done: number[];
}

/** Toy request lengths (decode steps each): mostly short, a few long. */
export function requestLengths(n: number, seed = 5): number[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => 3 + Math.floor(30 * r.next() ** 2.2));
}

export function schedule(lens: number[], slots: number, mode: 'static' | 'continuous', cap = 400): Sched {
  const cell = new Int16Array(slots * cap).fill(-1);
  const first = new Uint8Array(slots * cap);
  const done = lens.map(() => -1);
  const queue = lens.map((_, i) => i);
  const held: ({ id: number; left: number } | null)[] = Array.from({ length: slots }, () => null);
  let t = 0;
  for (; t < cap; t++) {
    const empty = held.every((x) => x === null);
    if (!queue.length && empty) break;
    if (mode === 'continuous' || empty)
      for (let i = 0; i < slots; i++)
        if (!held[i] && queue.length) {
          const id = queue.shift()!;
          held[i] = { id, left: lens[id]! };
          first[i * cap + t] = 1;
        }
    for (let i = 0; i < slots; i++) {
      const h = held[i];
      if (!h) continue;
      cell[i * cap + t] = h.id;
      if (--h.left <= 0) {
        done[h.id] = t;
        held[i] = null;
      }
    }
  }
  return { slots, steps: t, cell, first, cap, done };
}

// ------------------------------------------------------------------ KV memory: contiguous vs paged

export const KV_BLOCKS = 64;
export const KV_BS = 16;
/** Free blocks the paged scheduler keeps in hand before admitting more, so growth rarely forces a preemption. */
export const KV_WATERMARK = 6;

export interface KvReq {
  prompt: number;
  out: number;
  maxNew: number;
}

export function kvRequests(n: number, seed = 8): KvReq[] {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => {
    const maxNew = [64, 128, 192][r.int(3)]!;
    return { prompt: 8 + r.int(40), out: Math.min(maxNew, 4 + Math.floor(maxNew * r.next() ** 1.6)), maxNew };
  });
}

export interface KvFrame {
  /** Owning request per block, -1 if free. */
  owner: Int16Array;
  /** Real tokens held in each block. */
  fill: Uint8Array;
  running: number;
  done: number;
  tokens: number;
  reserved: number;
  preempted: number;
  /** The oldest running request and its blocks, in logical order. */
  table: { id: number; blocks: number[] } | null;
}

/** Steps a serving loop and records the KV memory after every step. */
export function simulateKV(mode: 'contig' | 'paged', reqs: KvReq[], steps: number, seed = 3): KvFrame[] {
  const rng = new Rng(seed);
  const queue = reqs.map((_, i) => i);
  const owner = new Int16Array(KV_BLOCKS).fill(-1);
  const free = rng.shuffle(Array.from({ length: KV_BLOCKS }, (_, i) => i));
  interface Run { id: number; len: number; gen: number; blocks: number[] }
  let running: Run[] = [];
  let done = 0;
  let preempted = 0;
  const frames: KvFrame[] = [];
  const need = (tokens: number) => Math.ceil(tokens / KV_BS);
  const firstFit = (nb: number): number => {
    for (let b = 0; b + nb <= KV_BLOCKS; b++) {
      let ok = true;
      for (let j = 0; j < nb; j++) if (owner[b + j] !== -1) {
        ok = false;
        b += j;
        break;
      }
      if (ok) return b;
    }
    return -1;
  };
  const release = (r: Run) => {
    for (const b of r.blocks) {
      owner[b] = -1;
      if (mode === 'paged') free.push(b);
    }
  };
  for (let t = 0; t < steps; t++) {
    // admit, first come first served
    while (queue.length) {
      const id = queue[0]!;
      const q = reqs[id]!;
      if (mode === 'contig') {
        const nb = need(q.prompt + q.maxNew);
        const b0 = firstFit(nb);
        if (b0 < 0) break;
        const blocks = Array.from({ length: nb }, (_, j) => b0 + j);
        for (const b of blocks) owner[b] = id;
        running.push({ id, len: q.prompt, gen: 0, blocks });
      } else {
        const nb = need(q.prompt + 1);
        if (free.length < nb + KV_WATERMARK) break;
        const blocks = Array.from({ length: nb }, () => free.pop()!);
        for (const b of blocks) owner[b] = id;
        running.push({ id, len: q.prompt, gen: 0, blocks });
      }
      queue.shift();
    }
    // one decode step: every running sequence appends a token
    const next: Run[] = [];
    for (const r of running) {
      if (!running.includes(r)) continue;
      if (mode === 'paged' && r.len + 1 > r.blocks.length * KV_BS) {
        while (!free.length) {
          const victim = [...running].reverse().find((x) => x !== r && running.includes(x));
          if (!victim) break;
          release(victim);
          running = running.filter((x) => x !== victim);
          const vi = next.indexOf(victim);
          if (vi >= 0) next.splice(vi, 1);
          queue.unshift(victim.id);
          preempted++;
        }
        const b = free.pop()!;
        owner[b] = r.id;
        r.blocks.push(b);
      }
      r.len++;
      r.gen++;
      if (r.gen >= reqs[r.id]!.out) {
        release(r);
        done++;
      } else next.push(r);
    }
    running = running.filter((x) => next.includes(x));
    const fill = new Uint8Array(KV_BLOCKS);
    let tokens = 0;
    for (const r of running) {
      r.blocks.forEach((b, j) => {
        fill[b] = Math.max(0, Math.min(KV_BS, r.len - j * KV_BS));
      });
      tokens += r.len;
    }
    let reserved = 0;
    for (let b = 0; b < KV_BLOCKS; b++) if (owner[b] !== -1) reserved++;
    const oldest = running[0];
    frames.push({
      owner: new Int16Array(owner),
      fill,
      running: running.length,
      done,
      tokens,
      reserved,
      preempted,
      table: oldest ? { id: oldest.id, blocks: [...oldest.blocks] } : null,
    });
  }
  return frames;
}

// ------------------------------------------------------------------ formatting

/** Seconds to a short human string: µs, ms or s. */
export function fmtTime(t: number): string {
  if (t < 1e-3) return `${(t * 1e6).toPrecision(2)} µs`;
  if (t < 1) return `${(t * 1e3).toPrecision(t < 0.01 ? 2 : 3)} ms`;
  return `${t.toPrecision(3)} s`;
}

/** Bytes to GB / MB with sensible digits. */
export function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toPrecision(b >= 1e10 ? 3 : 2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toPrecision(3)} MB`;
  return `${(b / 1e3).toPrecision(3)} kB`;
}

/** A count with thousands separators, rounded to a few significant digits. */
export function fmtCount(v: number, digits = 3): string {
  if (v >= 1000) return Math.round(Number(v.toPrecision(digits))).toLocaleString('en-US');
  return String(Number(v.toPrecision(digits)));
}
