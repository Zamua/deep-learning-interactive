// Pure computations behind the parallelism chapter and lecture: memory accounting,
// checkpointing timelines, ring all-reduce, DDP overlap, ZeRO, tensor and pipeline parallelism.
import { Rng } from '../core/rand';

/** H100 SXM figures used throughout: memory, dense bf16 peak, and per-direction link bandwidth. */
export const GPU = { mem: 80e9, peak: 989e12, mfu: 0.4, nvlink: 450e9, ib: 50e9, eth: 12.5e9 };
/** Achieved FLOP/s at 40% of peak. */
export const FLOPS = GPU.peak * GPU.mfu;
export const VOCAB = 50257;
export const GB = 1e9;

// ---------------------------------------------------------------- memory

export interface Shape {
  label: string;
  L: number;
  d: number;
}
/** GPT-style shapes (12 L d^2 + V d parameters): GPT-3 XL, GPT-3 6.7B, a LLaMA-65B-sized stack, GPT-3 175B. */
export const SHAPES: Shape[] = [
  { label: '1.3B', L: 24, d: 2048 },
  { label: '6.7B', L: 32, d: 4096 },
  { label: '65B', L: 80, d: 8192 },
  { label: '175B', L: 96, d: 12288 },
];

export const paramsOf = (L: number, d: number): number => 12 * L * d * d + VOCAB * d;

export type PartKey = 'w' | 'g' | 'master' | 'am' | 'av' | 'act';
export interface Part {
  key: PartKey;
  label: string;
  bytes: number;
}
export const PART_INFO: Record<PartKey, { label: string; short: string; per: string }> = {
  w: { label: 'weights (bf16)', short: 'weights', per: '2' },
  g: { label: 'gradients (bf16)', short: 'grads', per: '2' },
  master: { label: 'fp32 master copy', short: 'master', per: '4' },
  am: { label: 'Adam m (fp32)', short: 'Adam m', per: '4' },
  av: { label: 'Adam v (fp32)', short: 'Adam v', per: '4' },
  act: { label: 'activations', short: 'acts', per: '' },
};

/** Bytes stored per layer for backprop, GPT-style block, attention matrix not stored (Korthikanti et al., 2022). */
export const actPerLayer = (s: number, b: number, d: number): number => 34 * s * b * d;

export function activationBytes(L: number, d: number, s: number, b: number, ckpt: boolean): number {
  return ckpt ? 2 * s * b * d * L + actPerLayer(s, b, d) : actPerLayer(s, b, d) * L;
}

export function trainMemory(L: number, d: number, s: number, b: number, ckpt: boolean): { psi: number; parts: Part[]; total: number } {
  const psi = paramsOf(L, d);
  const parts: Part[] = [
    { key: 'w', label: PART_INFO.w.label, bytes: 2 * psi },
    { key: 'g', label: PART_INFO.g.label, bytes: 2 * psi },
    { key: 'master', label: PART_INFO.master.label, bytes: 4 * psi },
    { key: 'am', label: PART_INFO.am.label, bytes: 4 * psi },
    { key: 'av', label: PART_INFO.av.label, bytes: 4 * psi },
    { key: 'act', label: PART_INFO.act.label, bytes: activationBytes(L, d, s, b, ckpt) },
  ];
  return { psi, parts, total: parts.reduce((a, p) => a + p.bytes, 0) };
}

/** Human-readable bytes: 1.2 TB, 84 GB, 512 MB. */
export function bytesStr(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(v >= 1e13 ? 0 : 1)} TB`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(v >= 1e11 ? 0 : 1)} GB`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} MB`;
  return `${(v / 1e3).toFixed(0)} KB`;
}

/** Parameter count as 1.3B, 175B, 410M. */
export function countStr(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`;
  return `${(v / 1e6).toFixed(0)}M`;
}

// ---------------------------------------------------------------- activation checkpointing

/** Units stored per layer: a whole layer's activations, and the part that is its input (the checkpoint). */
export const CK_A = 17;
export const CK_C = 1;

export interface CkEvent {
  kind: 'F' | 'R' | 'B';
  layer: number;
  t0: number;
  t1: number;
  before: number[];
  after: number[];
}

/**
 * Forward then backward over L layers. `k` = layers per checkpointed segment (0 = store everything).
 * Costs: forward or recompute 1 unit per layer, backward 2.
 */
export function ckTimeline(L: number, k: number): { events: CkEvent[]; peak: number; cost: number } {
  const held = new Array<number>(L).fill(0);
  const events: CkEvent[] = [];
  let t = 0;
  let peak = 0;
  const push = (kind: CkEvent['kind'], layer: number, dur: number, next: number, during: number) => {
    const before = [...held];
    held[layer] = next;
    events.push({ kind, layer, t0: t, t1: t + dur, before, after: [...held] });
    peak = Math.max(peak, before.reduce((a, v) => a + v, 0) - before[layer]! + during);
    t += dur;
  };
  for (let i = 0; i < L; i++) push('F', i, 1, k === 0 ? CK_A : i % k === 0 ? CK_C : 0, CK_A);
  if (k === 0) for (let i = L - 1; i >= 0; i--) push('B', i, 2, 0, CK_A);
  else {
    for (let s0 = Math.floor((L - 1) / k) * k; s0 >= 0; s0 -= k) {
      const s1 = Math.min(s0 + k, L);
      for (let i = s0; i < s1; i++) push('R', i, 1, CK_A, CK_A);
      for (let i = s1 - 1; i >= s0; i--) push('B', i, 2, 0, CK_A);
    }
  }
  return { events, peak, cost: t };
}

/** Per-layer held units and total at time t (an allocating layer ramps up across its event). */
export function ckStateAt(events: CkEvent[], t: number): { held: number[]; total: number; ev: CkEvent | null; frac: number } {
  const last = events[events.length - 1]!;
  if (t >= last.t1) return { held: [...last.after], total: last.after.reduce((a, v) => a + v, 0), ev: null, frac: 1 };
  for (const e of events) {
    if (t < e.t1) {
      const frac = Math.max(0, (t - e.t0) / (e.t1 - e.t0));
      const held = [...e.before];
      if (e.kind !== 'B') held[e.layer] = e.before[e.layer]! + (CK_A - e.before[e.layer]!) * frac;
      else held[e.layer] = CK_A;
      return { held, total: held.reduce((a, v) => a + v, 0), ev: e, frac };
    }
  }
  return { held: [...last.after], total: 0, ev: null, frac: 1 };
}

/** Memory curve sampled densely for plotting: [t, total] pairs, with drops at event ends. */
export function ckCurve(events: CkEvent[]): [number, number][] {
  const out: [number, number][] = [];
  for (const e of events) {
    const b = e.before.reduce((a, v) => a + v, 0);
    const during = b - e.before[e.layer]! + CK_A;
    out.push([e.t0, b]);
    out.push([e.t1, e.kind === 'B' ? b : during]);
    out.push([e.t1, e.after.reduce((a, v) => a + v, 0)]);
  }
  return out;
}

// ---------------------------------------------------------------- ring all-reduce

export interface RingSend {
  from: number;
  to: number;
  chunk: number;
}
export interface RingRun {
  /** states[k][gpu][chunk][contributor]: after k steps. */
  states: boolean[][][][];
  /** sends[k]: the transfers of step k (k = 0 .. 2N-3). */
  sends: RingSend[][];
}

export function ringAllReduce(N: number): RingRun {
  let cur: boolean[][][] = Array.from({ length: N }, (_, i) => Array.from({ length: N }, () => Array.from({ length: N }, (_, c) => c === i)));
  const states = [cur];
  const sends: RingSend[][] = [];
  const copy = (s: boolean[][][]) => s.map((g) => g.map((c) => [...c]));
  for (let step = 0; step < N - 1; step++) {
    const nxt = copy(cur);
    const ss: RingSend[] = [];
    for (let i = 0; i < N; i++) {
      const c = (((i - step) % N) + N) % N;
      const to = (i + 1) % N;
      for (let j = 0; j < N; j++) nxt[to]![c]![j] = nxt[to]![c]![j]! || cur[i]![c]![j]!;
      ss.push({ from: i, to, chunk: c });
    }
    sends.push(ss);
    cur = nxt;
    states.push(cur);
  }
  for (let step = 0; step < N - 1; step++) {
    const nxt = copy(cur);
    const ss: RingSend[] = [];
    for (let i = 0; i < N; i++) {
      const c = (((i + 1 - step) % N) + N) % N;
      const to = (i + 1) % N;
      nxt[to]![c] = [...cur[i]![c]!];
      ss.push({ from: i, to, chunk: c });
    }
    sends.push(ss);
    cur = nxt;
    states.push(cur);
  }
  return { states, sends };
}

/** Bytes each GPU sends in a ring all-reduce of `size` bytes, as a multiple of size. */
export const ringFactor = (N: number): number => (2 * (N - 1)) / N;

// ---------------------------------------------------------------- DDP overlap

export interface Link {
  key: string;
  label: string;
  N: number;
  bw: number;
}
export const LINKS: Link[] = [
  { key: 'nvl', label: '8 GPUs, NVLink', N: 8, bw: GPU.nvlink },
  { key: 'ib', label: '64 GPUs, InfiniBand', N: 64, bw: GPU.ib },
  { key: 'eth', label: '64 GPUs, Ethernet', N: 64, bw: GPU.eth },
];

export interface DdpRun {
  fwd: [number, number];
  bwd: [number, number][];
  comm: [number, number][];
  total: number;
  compute: number;
  exposed: number;
}

/** One data-parallel step: forward, backward in `nb` buckets (last layer first), one all-reduce per bucket. */
export function ddpStep(psi: number, T: number, link: Link, overlap: boolean, nb = 8): DdpRun {
  const tf = (2 * psi * T) / FLOPS;
  const tbk = (4 * psi * T) / FLOPS / nb;
  const tc = (ringFactor(link.N) * ((2 * psi) / nb)) / link.bw;
  const bwd: [number, number][] = [];
  const comm: [number, number][] = [];
  let t = tf;
  for (let j = 0; j < nb; j++) {
    bwd.push([t, t + tbk]);
    t += tbk;
  }
  let c = overlap ? 0 : t;
  for (let j = 0; j < nb; j++) {
    const s = Math.max(c, overlap ? bwd[j]![1] : t);
    comm.push([s, s + tc]);
    c = s + tc;
  }
  const total = Math.max(t, c);
  return { fwd: [0, tf], bwd, comm, total, compute: t, exposed: total - t };
}

// ---------------------------------------------------------------- ZeRO

export const ZERO_STAGES = ['DDP', 'ZeRO-1', 'ZeRO-2', 'ZeRO-3'] as const;

/** Bytes per GPU for weights, gradients and Adam state (fp32 master, m, v), sharded `stage` ways deep. */
export function zeroMem(psi: number, N: number, stage: number): { w: number; g: number; opt: number; total: number } {
  const w = (2 * psi) / (stage >= 3 ? N : 1);
  const g = (2 * psi) / (stage >= 2 ? N : 1);
  const opt = (12 * psi) / (stage >= 1 ? N : 1);
  return { w, g, opt, total: w + g + opt };
}

/** Communication per step relative to plain data parallelism. */
export const zeroComm = (stage: number): number => (stage >= 3 ? 1.5 : 1);

// ---------------------------------------------------------------- tensor parallelism

export type Mat = number[][];
export const matmul = (A: Mat, B: Mat): Mat => A.map((r) => B[0]!.map((_, j) => r.reduce((a, v, k) => a + v * B[k]![j]!, 0)));
export const add = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v + B[i]![j]!));
export const gelu = (x: number): number => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x)));
export const mapM = (A: Mat, f: (v: number) => number): Mat => A.map((r) => r.map(f));
export const cols = (A: Mat, j0: number, j1: number): Mat => A.map((r) => r.slice(j0, j1));
export const rows = (A: Mat, i0: number, i1: number): Mat => A.slice(i0, i1).map((r) => [...r]);
export const maxAbsDiff = (A: Mat, B: Mat): number => Math.max(...A.flatMap((r, i) => r.map((v, j) => Math.abs(v - B[i]![j]!))));

function randMat(r: Rng, n: number, k: number, scale: number): Mat {
  return Array.from({ length: n }, () => Array.from({ length: k }, () => Math.round(r.randn() * scale * 10) / 10));
}

/** A 2-token, d = 4 MLP split over two GPUs, Megatron style, plus the wrong (row-first) split. */
export function tpToy() {
  const r = new Rng(7);
  const X = randMat(r, 2, 4, 1);
  const W1 = randMat(r, 4, 8, 0.6);
  const W2 = randMat(r, 8, 4, 0.6);
  const Y = mapM(matmul(X, W1), gelu);
  const Zref = matmul(Y, W2);
  const W1s = [cols(W1, 0, 4), cols(W1, 4, 8)];
  const W2s = [rows(W2, 0, 4), rows(W2, 4, 8)];
  const Ys = W1s.map((w) => mapM(matmul(X, w), gelu));
  const Zs = Ys.map((y, i) => matmul(y, W2s[i]!));
  const Z = add(Zs[0]!, Zs[1]!);
  // wrong: split W1 by rows (X by columns) and apply GeLU to each partial sum
  const Xr = [cols(X, 0, 2), cols(X, 2, 4)];
  const W1r = [rows(W1, 0, 2), rows(W1, 2, 4)];
  const partial = Xr.map((x, i) => matmul(x, W1r[i]!));
  const Zwrong = add(matmul(mapM(partial[0]!, gelu), W2), matmul(mapM(partial[1]!, gelu), W2));
  return { X, W1, W2, Y, Zref, W1s, W2s, Ys, Zs, Z, err: maxAbsDiff(Z, Zref), Xr, W1r, partial, Zwrong, errWrong: maxAbsDiff(Zwrong, Zref) };
}

// ---------------------------------------------------------------- pipeline parallelism

export type PipeKind = 'gpipe' | '1f1b';
export interface PipeOp {
  stage: number;
  kind: 'F' | 'B';
  mb: number;
  t0: number;
  t1: number;
  /** For 1F1B: 'warm' | 'steady' | 'cool'. */
  phase: 'warm' | 'steady' | 'cool' | 'fwd' | 'bwd';
}
export interface PipeRun {
  ops: PipeOp[];
  total: number;
  /** Idle fraction of p x total GPU-time. */
  idle: number;
  /** Most micro-batches whose activations a stage holds at once. */
  peakStash: number[];
}

function stageOps(kind: PipeKind, i: number, p: number, m: number): { kind: 'F' | 'B'; mb: number; phase: PipeOp['phase'] }[] {
  if (kind === 'gpipe') {
    const f = Array.from({ length: m }, (_, j) => ({ kind: 'F' as const, mb: j, phase: 'fwd' as const }));
    const b = Array.from({ length: m }, (_, j) => ({ kind: 'B' as const, mb: m - 1 - j, phase: 'bwd' as const }));
    return [...f, ...b];
  }
  const warm = Math.min(p - i - 1, m);
  const out: { kind: 'F' | 'B'; mb: number; phase: PipeOp['phase'] }[] = [];
  for (let j = 0; j < warm; j++) out.push({ kind: 'F', mb: j, phase: 'warm' });
  for (let j = 0; j < m - warm; j++) {
    out.push({ kind: 'F', mb: warm + j, phase: 'steady' });
    out.push({ kind: 'B', mb: j, phase: 'steady' });
  }
  for (let j = m - warm; j < m; j++) out.push({ kind: 'B', mb: j, phase: 'cool' });
  return out;
}

export function pipeSchedule(p: number, m: number, kind: PipeKind, tf = 1, tb = 2): PipeRun {
  const lists = Array.from({ length: p }, (_, i) => stageOps(kind, i, p, m));
  const ptr = new Array<number>(p).fill(0);
  const free = new Array<number>(p).fill(0);
  const doneF = Array.from({ length: p }, () => new Array<number>(m).fill(-1));
  const doneB = Array.from({ length: p }, () => new Array<number>(m).fill(-1));
  const ops: PipeOp[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < p; i++) {
      const op = lists[i]![ptr[i]!];
      if (!op) continue;
      let ready: number;
      if (op.kind === 'F') ready = i === 0 ? 0 : doneF[i - 1]![op.mb]!;
      else ready = i === p - 1 ? doneF[i]![op.mb]! : doneB[i + 1]![op.mb]!;
      if (ready < 0) continue;
      const t0 = Math.max(free[i]!, ready);
      const t1 = t0 + (op.kind === 'F' ? tf : tb);
      (op.kind === 'F' ? doneF : doneB)[i]![op.mb] = t1;
      free[i] = t1;
      ops.push({ stage: i, kind: op.kind, mb: op.mb, t0, t1, phase: op.phase });
      ptr[i]!++;
      progress = true;
    }
  }
  const total = Math.max(...free);
  const busy = p * m * (tf + tb);
  const peakStash = Array.from({ length: p }, (_, i) => {
    const ev = ops.filter((o) => o.stage === i).map((o) => [o.kind === 'F' ? o.t0 : o.t1, o.kind === 'F' ? 1 : -1] as const);
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let c = 0;
    let best = 0;
    for (const [, dv] of ev) {
      c += dv;
      best = Math.max(best, c);
    }
    return best;
  });
  return { ops, total, idle: 1 - busy / (p * total), peakStash };
}

export const bubbleFraction = (p: number, m: number): number => (p - 1) / (m + p - 1);

// ---------------------------------------------------------------- 3-D layout

/** Megatron-style rank order: tensor-parallel index fastest, then data-parallel, then pipeline stage. */
export function coords3d(rank: number, TP: number, DP: number): { tp: number; dp: number; pp: number } {
  return { tp: rank % TP, dp: Math.floor(rank / TP) % DP, pp: Math.floor(rank / (TP * DP)) };
}
