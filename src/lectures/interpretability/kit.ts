import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { CURVES } from '../../lib/interpretability-induction-data';
import {
  HALF,
  LETTERS,
  type Mat,
  Probe,
  type Trace,
  earlyWeights,
  finalWeights,
  forward,
  lens,
  makeSequence,
  ovTokens,
  probeData,
  qkPositions,
  softmaxVec,
} from '../../lib/interpretability-model';
import { SAE, TOY_N, ToyModel, sampleSet, type Sample } from '../../lib/interpretability-toys';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/* ------------------------------------------------------------------ data, computed once */

/** 12 random letters, then the same 12: ACENJITFPKLO twice. */
export const SEQ = makeSequence(4);
/** The query in the repeat: F at position 19; the answer, P, follows it. */
export const QI = 19;

let trF: Trace | null = null;
let trE: Trace | null = null;
export const traceFinal = (): Trace => (trF ??= forward(finalWeights(), SEQ));
export const traceEarly = (): Trace => (trE ??= forward(earlyWeights(), SEQ));

/** Logit-lens probabilities at the query, after the embedding, head 0 and head 1. */
export const lensProbs = (): number[][] => {
  const t = traceFinal();
  return [t.x0, t.x1, t.x2].map((x) => softmaxVec(lens(finalWeights(), x, QI)));
};

let circ: { pos: Mat; ov: Mat } | null = null;
export const circuitsFinal = (): { pos: Mat; ov: Mat } => (circ ??= { pos: qkPositions(finalWeights(), 24), ov: ovTokens(finalWeights(), 1) });

export function inductionScore(t: Trace): number {
  let s = 0;
  for (let i = HALF; i < 24; i++) s += t.A[1]!.a[i * 24 + i - HALF + 1]!;
  return s / HALF;
}

export { CURVES, HALF, LETTERS };

/** Previous-letter probes on x0, x1, x2: test accuracy every 3 steps, 60 steps. */
let probeHist: number[][] | null = null;
export function probeCurves(): number[][] {
  if (probeHist) return probeHist;
  const w = finalWeights();
  const train = probeData(w, 'previous', 1000, 40);
  const test = probeData(w, 'previous', 5000, 20);
  probeHist = [0, 1, 2].map((l) => {
    const p = new Probe(0.05);
    const h = [p.accuracy(test, l)];
    for (let k = 1; k <= 60; k++) {
      p.step(train, l);
      if (k % 3 === 0) h.push(p.accuracy(test, l));
    }
    return h;
  });
  return probeHist;
}

/** Feature directions of the toy model during training, every 100 steps. */
const toyRuns = new Map<number, [number, number][][]>();
const toyModels = new Map<number, ToyModel>();
export function toyRun(S: number): [number, number][][] {
  const hit = toyRuns.get(S);
  if (hit) return hit;
  const m = new ToyModel(S);
  const snaps: [number, number][][] = [];
  const snap = () => snaps.push(Array.from({ length: TOY_N }, (_, i) => m.col(i)));
  snap();
  for (let k = 0; k < 60; k++) {
    m.train(100, 128);
    snap();
  }
  toyRuns.set(S, snaps);
  toyModels.set(S, m);
  return snaps;
}
export const toyModel = (S: number): ToyModel => {
  toyRun(S);
  return toyModels.get(S)!;
};

/** Random unit vectors in d dimensions: |cos| between pairs, for a histogram. */
export function overlaps(d: number, n = 60): number[] {
  const r = new Rng(31 + d);
  const vs = Array.from({ length: n }, () => {
    const v = Array.from({ length: d }, () => r.randn());
    const s = Math.hypot(...v);
    return v.map((x) => x / s);
  });
  const out: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push(Math.abs(vs[i]!.reduce((a, x, k) => a + x * vs[j]![k]!, 0)));
  return out;
}
const ovl = new Map<number, number[]>();
export const overlapsOf = (d: number): number[] => {
  if (!ovl.has(d)) ovl.set(d, overlaps(d));
  return ovl.get(d)!;
};

let samples: Sample[] | null = null;
export const neuronSamples = (): Sample[] => (samples ??= sampleSet(3000, 7));

/** The SAE's match matrix (|cos| with every true feature) at 20 points during training, plus its scores. */
interface SaeRun {
  snaps: number[][][];
  fvu: number;
  l0: number;
  rec: number;
}
const saeRuns = new Map<number, SaeRun>();
export function saeRun(lam: number): SaeRun {
  const hit = saeRuns.get(lam);
  if (hit) return hit;
  const sae = new SAE(16, lam);
  const snaps = [sae.match()];
  for (let k = 0; k < 20; k++) {
    sae.train(150, 64);
    snaps.push(sae.match());
  }
  const ev = sae.evaluate(sampleSet(800, 99));
  const M = snaps[snaps.length - 1]!;
  const rec = Array.from({ length: 16 }, (_, k) => Math.max(...M.map((r) => r[k]!))).filter((v) => v > 0.9).length;
  const run = { snaps, fvu: ev.fvu, l0: ev.l0, rec };
  saeRuns.set(lam, run);
  return run;
}

/* ------------------------------------------------------------------ layout */

/** The stage inside a margin, below the scene chip. */
export function area(s: Scene, top = 0.13, pad = 5): Rect {
  const m = s.u * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** The largest text size, at most `max`, that fits `text` into `room` px. */
export function fitSize(s: Scene, text: string, room: number, max: number, font: 'ui' | 'mono' | 'display' | 'serif' = 'ui', weight = 600): number {
  const w1 = s.measure(text, { font, size: 1, weight });
  return Math.min(max, room / Math.max(1e-6, w1));
}

/** A rounded box with a centered label. */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; weight?: number; font?: 'ui' | 'mono' } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.08 + 0.25 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.3 * on });
  if (label) {
    const font = o.font ?? 'ui';
    s.text(label, x + w / 2, y + h / 2 + s.u * 0.2, { font, size: fitSize(s, label, w - s.u * 2, o.size ?? 3.4, font, o.weight ?? 600), weight: o.weight ?? (on > 0.5 ? 700 : 600), color: s.c('--ink') });
  }
}

/** A rounded tag of text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** Pills laid out in rows inside width `w` starting at (x, y); returns the height used. */
export function pillRows(s: Scene, items: [string, K][], x: number, y: number, w: number, o: { size?: number; a?: (i: number) => number; center?: boolean; stack?: boolean } = {}): number {
  const size = o.size ?? 3.4;
  const gap = s.u * 1.6;
  const ph = s.u * size * 1.7 + gap;
  const widths = items.map(([t]) => s.measure(t, { font: 'ui', size, weight: 600 }) + s.u * size * 0.95);
  const rows: number[][] = [[]];
  let rw = 0;
  widths.forEach((pw, i) => {
    if (rw > 0 && (o.stack || rw + pw > w)) {
      rows.push([]);
      rw = 0;
    }
    rows[rows.length - 1]!.push(i);
    rw += pw + gap;
  });
  rows.forEach((r, ri) => {
    const tot = r.reduce((a, i) => a + widths[i]! + gap, -gap);
    let cx = o.center ? x + (w - tot) / 2 : x;
    r.forEach((i) => {
      s.alpha(o.a ? o.a(i) : 1, () => pill(s, items[i]![0], cx, y + ri * ph, items[i]![1], { size, align: 'left' }));
      cx += widths[i]! + gap;
    });
  });
  return rows.length * ph;
}

/** One letter in a cell. */
export function letter(s: Scene, t: number, x: number, y: number, cw: number, ch: number, k: K, on = 0, ring?: K): void {
  s.rrect(x + cw * 0.06, y, cw * 0.88, ch, 1.2, { fill: s.tint(k, 0.08 + 0.4 * on), stroke: ring ? s.c(ring) : s.tint(k, 0.45), lw: ring ? 0.6 : 0.25 });
  s.text(LETTERS[t]!, x + cw / 2, y + ch / 2 + s.u * 0.25, { font: 'mono', size: Math.min(ch / s.u * 0.55, cw / s.u * 0.62), weight: on > 0.5 || ring ? 700 : 500 });
}

export interface Strip {
  x: number;
  y: number;
  cw: number;
  ch: number;
  gap: number;
}

/** The 24 letters as two rows of 12, each repeat under its first copy. */
export function stripAt(x: number, y: number, w: number, s: Scene, gap = 5): Strip {
  const cw = w / HALF;
  const ch = Math.min(cw * 0.95, s.u * 8);
  return { x, y, cw, ch, gap: s.u * gap };
}

export function cellXY(st: Strip, i: number): { x: number; y: number; cx: number; cy: number } {
  const r = i < HALF ? 0 : 1;
  const x = st.x + (i % HALF) * st.cw;
  const y = st.y + r * (st.ch + st.gap);
  return { x, y, cx: x + st.cw / 2, cy: y + st.ch / 2 };
}

export function drawStrip(s: Scene, st: Strip, style: (i: number) => { k?: K; on?: number; ring?: K; a?: number }): void {
  SEQ.forEach((t, i) => {
    const o = style(i);
    const { x, y } = cellXY(st, i);
    s.alpha(o.a ?? 1, () => letter(s, t, x, y, st.cw, st.ch, o.k ?? 'orange', o.on ?? 0, o.ring));
  });
}

/** A heat grid of M at (x, y) with cells `cs` px; `fill` maps a value to a color. */
export function heatGrid(s: Scene, x: number, y: number, cs: number, M: Mat, fill: (v: number, i: number, j: number) => string | null, causal = false): void {
  const c = s.ctx;
  const gap = cs > 6 ? 0.8 : 0.4;
  for (let i = 0; i < M.r; i++)
    for (let j = 0; j < M.c; j++) {
      if (causal && j > i) continue;
      const f = fill(M.a[i * M.c + j]!, i, j);
      if (!f) continue;
      c.fillStyle = f;
      c.fillRect(x + j * cs + gap / 2, y + i * cs + gap / 2, cs - gap, cs - gap);
    }
}

/** A curved line from (x0, y0) to (x1, y1), bulging `bend` px to its left. */
export function arc(s: Scene, x0: number, y0: number, x1: number, y1: number, bend: number, col: string, width: number, head = 0): void {
  const c = s.ctx;
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cx = (x0 + x1) / 2 + (-(y1 - y0) / L) * bend;
  const cy = (y0 + y1) / 2 + ((x1 - x0) / L) * bend;
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.stroke();
  if (head > 0) {
    const a = Math.atan2(y1 - cy, x1 - cx);
    const hd = head * s.u;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 - hd * Math.cos(a - 0.45), y1 - hd * Math.sin(a - 0.45));
    c.lineTo(x1 - hd * Math.cos(a + 0.45), y1 - hd * Math.sin(a + 0.45));
    c.closePath();
    c.fill();
  }
}

/** A polyline through points (px). */
export function poly(s: Scene, xs: number[], ys: number[], col: string, width = 0.5, dash?: number[]): void {
  const c = s.ctx;
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.lineJoin = 'round';
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.beginPath();
  xs.forEach((x, i) => (i ? c.lineTo(x, ys[i]!) : c.moveTo(x, ys[i]!)));
  c.stroke();
  c.setLineDash([]);
}

/** Feature colors for the toy model (feature i). */
export const FEAT: K[] = ['blue', 'orange', 'green', 'purple', 'red'];

/** Probability bars over the 20 letters, the answer `t` in gold. */
export function letterBars(s: Scene, x: number, y: number, w: number, h: number, p: number[], t: number, a = 1, labels = true): void {
  const bw = w / p.length;
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.25);
  p.forEach((v, j) => {
    const bh = Math.max(s.u * 0.25, h * v * a);
    s.rrect(x + j * bw + bw * 0.15, y + h - bh, bw * 0.7, bh, 0.4, { fill: s.tint(j === t ? 'gold' : 'teal', j === t ? 0.9 : 0.55) });
  });
  if (labels && bw > s.u * 2.4)
    p.forEach((_, j) => s.text(LETTERS[j]!, x + j * bw + bw / 2, y + h + s.u * 2.6, { font: 'mono', size: Math.min(2.9, (bw / s.u) * 0.75), weight: j === t ? 700 : 400, color: j === t ? s.c('gold') : s.c('--ink-3') }));
}
