import { cifarImage, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Scene } from '../../lecture/scene';
import { CharRNN, vocab } from '../../lib/rnn-charrnn';
import { CORPUS } from '../../lib/rnn-corpus';
import { sigmoid } from '../../lib/rnn-draw';

export const VOC = vocab(CORPUS);

// ---------------------------------------------------------------- "hello"

export const HELLO_V = ['h', 'e', 'l', 'o'];
export const HELLO_IN = [0, 1, 2, 2];
export const HELLO_TG = [1, 2, 2, 3];

export interface HelloRun {
  hs: number[][];
  ys: number[][];
  ps: number[][];
  losses: number[];
  total: number;
}

/** The chapter's "hello" model: CharRNN(4, 3, seed 2) with weights scaled up, optionally trained 300 steps. */
function helloRun(trained: boolean): HelloRun {
  const net = new CharRNN(4, 3, 2);
  for (const a of [net.Wxh, net.Whh, net.Why]) for (let i = 0; i < a.length; i++) a[i]! *= 50;
  if (trained)
    for (let it = 0; it < 300; it++) {
      net.lossFun(HELLO_IN, HELLO_TG, new Float64Array(3));
      net.update(0.1);
    }
  const out: HelloRun = { hs: [], ys: [], ps: [], losses: [], total: 0 };
  let h = new Float64Array(3);
  for (let t = 0; t < 4; t++) {
    const nh = new Float64Array(3);
    net.stepHidden(HELLO_IN[t]!, h, nh);
    h = nh;
    const y = new Float64Array(4);
    const p = new Float64Array(4);
    net.scores(h, y);
    net.probs(h, p);
    out.hs.push([...h]);
    out.ys.push([...y]);
    out.ps.push([...p]);
    out.losses.push(-Math.log(p[HELLO_TG[t]!]!));
  }
  out.total = out.losses.reduce((a, b) => a + b, 0);
  return out;
}
export const HELLO = { random: helloRun(false), trained: helloRun(true) };

// ---------------------------------------------------------------- temperature

/** Softmax of `ys / T`, as the listing computes it. */
export function softmaxT(ys: number[], T: number): number[] {
  const z = ys.map((v) => v / T);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / tot);
}

// ---------------------------------------------------------------- vanishing

const HH = 16;
export const STEPS = 50;

function matvec(M: number[], v: number[], n: number, transpose: boolean): number[] {
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i]! += (transpose ? M[j * n + i]! : M[i * n + j]!) * v[j]!;
  return out;
}

/** Q: a random rotation (Gram-Schmidt), so Whh = sigma * Q stretches every direction by exactly sigma. */
const VG = (() => {
  const r = new Rng(21);
  const rows: number[][] = [];
  for (let i = 0; i < HH; i++) {
    let v = Array.from({ length: HH }, () => r.randn());
    for (const q of rows) {
      const d = v.reduce((acc, x, j) => acc + x * q[j]!, 0);
      v = v.map((x, j) => x - d * q[j]!);
    }
    const n = Math.hypot(...v);
    rows.push(v.map((x) => x / n));
  }
  const xs = Array.from({ length: STEPS }, () => Array.from({ length: HH }, () => r.randn() * 0.5));
  const h0 = Array.from({ length: HH }, () => r.randn() * 0.5);
  const g = Array.from({ length: HH }, () => r.randn());
  const gn = Math.hypot(...g);
  return { Q: rows.flat(), xs, h0, g0: g.map((x) => x / gn) };
})();

/** log10 of |dh| after k = 0..STEPS steps back, for Whh = sigma * Q. */
function gradNorms(sigma: number, tanh: boolean): number[] {
  const W = VG.Q.map((q) => q * sigma);
  const hs: number[][] = [];
  let h = VG.h0;
  for (let t = 0; t < STEPS; t++) {
    const a = matvec(W, h, HH, false).map((v, i) => v + VG.xs[t]![i]!);
    h = tanh ? a.map(Math.tanh) : a;
    hs.push(h);
  }
  let dh = [...VG.g0];
  const out = [0];
  for (let t = STEPS - 1; t >= 0; t--) {
    const raw = tanh ? dh.map((d, i) => d * (1 - hs[t]![i]! ** 2)) : dh;
    dh = matvec(W, raw, HH, true);
    out.push(Math.log10(Math.max(1e-30, Math.hypot(...dh))));
  }
  return out;
}

export const VANISH = {
  lin12: gradNorms(1.2, false),
  lin10: gradNorms(1.0, false),
  lin09: gradNorms(0.9, false),
  tanh09: gradNorms(0.9, true),
};

// ---------------------------------------------------------------- LSTM

export const LSTM_VALS = [0.8, -0.3, 0.5, -0.9, 0.1, 0.4, -0.6, 0.2];
export const LSTM_STORE = [1, 0, 0, 0, 1, 0, 0, 0];

export interface LstmStep {
  i: number;
  f: number;
  o: number;
  g: number;
  c: number;
  h: number;
  cp: number;
}

/** The chapter's one-unit LSTM with hand-set weights over [h_prev, value, store]. */
export const LSTM_SEQ: LstmStep[] = (() => {
  const W = [
    [0, 0, 10],
    [0, 0, -10],
    [0, 0, 0],
    [0, 2, 0],
  ];
  const B = [-5, 5, 4, 0];
  let c = 0;
  let h = 0;
  return LSTM_VALS.map((v, t) => {
    const z = [h, v, LSTM_STORE[t]!];
    const a = W.map((row, k) => row.reduce((s, wv, j) => s + wv * z[j]!, B[k]!));
    const i = sigmoid(a[0]!);
    const f = sigmoid(a[1]!);
    const o = sigmoid(a[2]!);
    const g = Math.tanh(a[3]!);
    const cp = c;
    c = f * c + i * g;
    h = o * Math.tanh(c);
    return { i, f, o, g, c, h, cp };
  });
})();

// ---------------------------------------------------------------- captioning

/** Toy p(next word | words so far): a mixture over a few hand-written cat captions, as in the chapter. */
const CAT_CAPS: [string, number][] = [
  ['a cat sitting on a bed', 0.35],
  ['a cat lying on the grass', 0.25],
  ['a cat sitting in a box', 0.2],
  ['a dog sitting on a bed', 0.2],
];

export interface CapStep {
  input: string;
  dist: [string, number][];
  pick: string;
}

export const CAPTION: CapStep[] = (() => {
  const steps: CapStep[] = [];
  const prefix: string[] = [];
  for (let t = 0; t < 10; t++) {
    const m = new Map<string, number>();
    let tot = 0;
    for (const [s, wt] of CAT_CAPS) {
      const ws = s.split(' ');
      if (prefix.length > ws.length || prefix.some((w, i) => ws[i] !== w)) continue;
      const nx = prefix.length < ws.length ? ws[prefix.length]! : '<END>';
      m.set(nx, (m.get(nx) ?? 0) + wt);
      tot += wt;
    }
    const dist = [...m].map(([w, v]) => [w, v / tot] as [string, number]).sort((a, b) => b[1] - a[1]);
    const pick = dist[0]![0];
    steps.push({ input: prefix.length ? prefix[prefix.length - 1]! : '<START>', dist, pick });
    if (pick === '<END>') break;
    prefix.push(pick);
  }
  return steps;
})();

let catCanvas: HTMLCanvasElement | null = null;
let waiting: Plot | null = null;

loadCifar()
  .then(({ test }) => {
    const i = test.labels.findIndex((l) => l === 3);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    c.getContext('2d')!.putImageData(cifarImage(test, i), 0, 0);
    catCanvas = c;
    waiting?.redraw();
  })
  .catch(() => {});

/** The first CIFAR-10 test cat, or null while the set loads (the stage redraws when it lands). */
export function catImage(s: Scene): HTMLCanvasElement | null {
  if (!catCanvas) waiting = s.p;
  return catCanvas;
}
