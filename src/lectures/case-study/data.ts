import { spiral } from '../../core/data';
import { type Mat, SoftmaxClassifier, TwoLayerNet, accuracy } from '../../lib/case-study-np';
import { NET_EVERY, NET_HITS, NET_LOSS, NET_SNAPS } from './net-snapshots';

export const REG = 1e-3;
export const STEP = 1;

const d = spiral(100, 3, 0.2, 3);
/** The chapter's data: 300 rows of (x0, x1), labels 0..2. */
export const XS: Mat = { r: d.n, c: 2, d: d.X };
export const YS = d.y;
export const NPTS = d.n;
/** The three example rows the chapter follows, one from the middle of each arm. */
export const ROWS = [60, 160, 260];

export interface Model {
  predict(a: number, b: number): number;
}

export interface LinState {
  W: Float64Array;
  b: Float64Array;
}

export function linModel(st: LinState): Model {
  const { W, b } = st;
  return {
    predict(a, c) {
      let best = 0;
      let bs = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = a * W[k]! + c * W[3 + k]! + b[k]!;
        if (v > bs) {
          bs = v;
          best = k;
        }
      }
      return best;
    },
  };
}

/** Linear-classifier parameters between interpolated states, for animating the wedges turning. */
export function lerpLin(a: LinState, b: LinState, t: number): LinState {
  return { W: a.W.map((v, i) => v + (b.W[i]! - v) * t), b: a.b.map((v, i) => v + (b.b[i]! - v) * t) };
}

/** The linear classifier's 200 iterations: state i is the parameters before update i (state 200 is final). */
export const LIN = (() => {
  const m = new SoftmaxClassifier(2, 3, 1);
  const states: LinState[] = [];
  const loss: number[] = [];
  const hits: number[] = [];
  for (let i = 0; i <= 200; i++) {
    states.push({ W: Float64Array.from(m.W.d), b: Float64Array.from(m.b.d) });
    hits.push(Math.round(accuracy(m, XS, YS) * NPTS));
    if (i < 200) loss.push(m.step(XS, YS, REG, STEP));
  }
  return { states, loss, hits };
})();

/** Every intermediate of one forward pass of the linear classifier at state i. */
export function linPass(i: number): SoftmaxClassifier {
  const m = new SoftmaxClassifier(2, 3, 1);
  m.W = { r: 2, c: 3, d: Float64Array.from(LIN.states[i]!.W) };
  m.b = { r: 1, c: 3, d: Float64Array.from(LIN.states[i]!.b) };
  m.step(XS, YS, REG, STEP, false);
  return m;
}
export const PASS0 = linPass(0);
export const PASS200 = linPass(200);

function netFrom(s: { W: number[]; b: number[]; W2: number[]; b2: number[] }): TwoLayerNet {
  const n = new TwoLayerNet(2, 100, 3, 1);
  n.W = { r: 2, c: 100, d: Float64Array.from(s.W) };
  n.b = { r: 1, c: 100, d: Float64Array.from(s.b) };
  n.W2 = { r: 100, c: 3, d: Float64Array.from(s.W2) };
  n.b2 = { r: 1, c: 3, d: Float64Array.from(s.b2) };
  return n;
}

/** The network at each snapshot iteration, from its initialization to all 10,000 updates. */
export const NETS: { it: number; net: TwoLayerNet }[] = [{ it: 0, net: new TwoLayerNet(2, 100, 3, 1) }, ...NET_SNAPS.map((s) => ({ it: s.it, net: netFrom(s) }))];
export const NET_FINAL = NETS[NETS.length - 1]!.net;
export { NET_EVERY, NET_HITS, NET_LOSS };

/** Fresh points from the same recipe with new noise, which the network never trained on. */
const fresh = spiral(100, 3, 0.2, 9);
export const XF: Mat = { r: fresh.n, c: 2, d: fresh.X };
export const YF = fresh.y;
export const FRESH_ACC = accuracy(NET_FINAL, XF, YF);

/** Which training points a model gets wrong. */
export function wrongOf(m: Model, X: Mat = XS, y: ArrayLike<number> = YS): boolean[] {
  return Array.from({ length: X.r }, (_, i) => m.predict(X.d[2 * i]!, X.d[2 * i + 1]!) !== y[i]);
}
export const LIN_FINAL = linModel(LIN.states[200]!);
export const LIN_WRONG = wrongOf(LIN_FINAL);
export const NET_WRONG = wrongOf(NET_FINAL);
export const NET_FRESH_WRONG = wrongOf(NET_FINAL, XF, YF);

/** First-layer unit j of a network: its input a*x0 + b*x1 + c. */
export function unitOf(net: TwoLayerNet, j: number): { a: number; b: number; c: number; out: number[] } {
  const h = net.W.c;
  return { a: net.W.d[j]!, b: net.W.d[h + j]!, c: net.b.d[j]!, out: [0, 1, 2].map((k) => net.W2.d[j * 3 + k]!) };
}
/** A unit whose line passes near the middle of the spiral and that matters to the scores. */
export const SHOW_UNIT = 84;

/** Class-k score of the final network at a point. */
export function netScore(net: TwoLayerNet, x0: number, x1: number, k: number): number {
  const h = net.W.c;
  let s = net.b2.d[k]!;
  for (let j = 0; j < h; j++) {
    const v = x0 * net.W.d[j]! + x1 * net.W.d[h + j]! + net.b.d[j]!;
    if (v > 0) s += v * net.W2.d[j * 3 + k]!;
  }
  return s;
}

/**
 * A small slice of the final network's backward pass: hidden values and the gradient arriving at
 * them (before the ReLU gate) for a few rows and units.
 */
export const GATE = (() => {
  const net = NET_FINAL;
  const rows = [60, 110, 160, 210];
  const h = net.W.c;
  const on = (i: number, j: number) => XS.d[2 * i]! * net.W.d[j]! + XS.d[2 * i + 1]! * net.W.d[h + j]! + net.b.d[j]! > 0;
  // Units that are on for some of these rows and off for others, so the gate has work to do.
  const units = Array.from({ length: h }, (_, j) => j)
    .map((j) => ({ j, n: rows.filter((i) => on(i, j)).length, w: Math.hypot(net.W2.d[3 * j]!, net.W2.d[3 * j + 1]!, net.W2.d[3 * j + 2]!) }))
    .filter((v) => v.n >= 1 && v.n <= 3)
    .sort((p, q) => Math.abs(p.n - 2) - Math.abs(q.n - 2) || q.w - p.w)
    .slice(0, 6)
    .map((v) => v.j)
    .sort((p, q) => p - q);
  const hid = rows.map((i) =>
    units.map((j) => Math.max(0, XS.d[2 * i]! * net.W.d[j]! + XS.d[2 * i + 1]! * net.W.d[h + j]! + net.b.d[j]!)),
  );
  const up = rows.map((i) => {
    const sc = [0, 1, 2].map((k) => netScore(net, XS.d[2 * i]!, XS.d[2 * i + 1]!, k));
    const mx = Math.max(...sc);
    const e = sc.map((v) => Math.exp(v - mx));
    const z = e.reduce((a, b) => a + b, 0);
    const ds = e.map((v, k) => (v / z - (YS[i] === k ? 1 : 0)) / NPTS);
    return units.map((j) => ds.reduce((a, v, k) => a + v * net.W2.d[j * 3 + k]!, 0));
  });
  return { rows, units, hid, up };
})();
