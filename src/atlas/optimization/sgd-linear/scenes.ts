import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns } from '../../draw';

const X = [2, 1];
const W = [
  [0.5, 0],
  [0.5, 0.85],
];
const DS = [-0.7, 0.7];
const LR = 0.5;
const W2 = W.map((r, i) => r.map((v, j) => v - LR * DS[i]! * X[j]!));
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]!;
const f = (v: number) => String(Math.round(v * 100) / 100);

type Ink = 'purple' | 'teal' | 'red' | 'blue';

const fm = (v: number) => (v < 0 ? `−${f(-v)}` : f(v));
const par = (v: number) => (v < 0 ? `(${fm(v)})` : fm(v));
const mono = (s: Scene, t: string, x: number, y: number, k: Ink | 'orange' | 'gold' | 'green' | '--ink-2' | '--ink-3', size = 3.6, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
/** Eased in `frac` of the way through beat `id`, so a value lands as the voice says it. */
const lateIn = (s: Scene, id: string, frac: number) => s.ease(id, 0.6, frac * (s.end(id) - s.at(id)));

/** A plane with equal scales on both axes, centered in the stage above `bottom`. */
function plane(s: Scene, bottom: number) {
  const [x0, x1, y0, y1] = [-0.6, 2.5, -0.3, 1.4];
  const l = 8 * s.u;
  const r = s.w - 8 * s.u;
  const t = 6 * s.u;
  const b = s.h * bottom;
  const k = Math.min((r - l) / (x1 - x0), (b - t) / (y1 - y0));
  const cx = (l + r) / 2 - ((x0 + x1) / 2) * k;
  const cy = (t + b) / 2 + ((y0 + y1) / 2) * k;
  return { X: (x: number) => cx + x * k, Y: (y: number) => cy - y * k, k };
}

const toward: SceneDef = {
  draw(s) {
    const P = plane(s, 0.72);
    s.line(P.X(-0.6), P.Y(0), P.X(2.5), P.Y(0), s.c('--axis'), 0.3);
    s.line(P.X(0), P.Y(-0.3), P.X(0), P.Y(1.4), s.c('--axis'), 0.3);
    const vec = (v: number[], k: 'orange' | 'blue', label: string, w = 0.7, la = 1) => {
      s.arrow(P.X(0), P.Y(0), P.X(v[0]!), P.Y(v[1]!), s.c(k), w, 2.6);
      const n = Math.hypot(v[0]!, v[1]!) || 1;
      s.alpha(la, () => s.text(label, P.X(v[0]!) + (v[0]! / n) * 5 * s.u, P.Y(v[1]!) - (v[1]! / n) * 4 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    };
    vec(X, 'orange', 'x');
    const a0 = s.ease('step', 1.4, 2.5);
    const a1 = s.ease('away', 1.4, 2);
    const w0 = [lerp(W[0]![0]!, W2[0]![0]!, a0), lerp(W[0]![1]!, W2[0]![1]!, a0)];
    const w1 = [lerp(W[1]![0]!, W2[1]![0]!, a1), lerp(W[1]![1]!, W2[1]![1]!, a1)];
    s.alpha(0.35 * Math.max(a0, a1 > 0 ? 1 : 0), () => {
      s.arrow(P.X(0), P.Y(0), P.X(W[0]![0]!), P.Y(W[0]![1]!), s.c('blue'), 0.4, 2);
      if (a1 > 0) s.arrow(P.X(0), P.Y(0), P.X(W[1]![0]!), P.Y(W[1]![1]!), s.c('blue'), 0.4, 2);
    });
    const shift = (from: number[], c: number, a: number) => {
      if (a <= 0) return;
      s.arrow(P.X(from[0]!), P.Y(from[1]!), P.X(from[0]! + c * X[0]! * a), P.Y(from[1]! + c * X[1]! * a), s.tint('slate', 0.9), 0.4, 1.8);
    };
    s.alpha(s.ease('step', 0.4, 2.5) * (1 - s.ease('scores', 0.6)), () => shift(W[0]!, 0.35, a0));
    s.alpha(s.ease('away', 0.4, 2) * (1 - s.ease('scores', 0.6)), () => shift(W[1]!, -0.35, a1));
    vec(w0, 'blue', 'row 0');
    vec(w1, 'blue', 'row 1', 0.7);
    const yA = s.h * 0.8;
    const yB = s.h * 0.9;
    const read = (label: string, from: number, to: number, a: number, y: number, k: 'green' | 'red') =>
      s.text(`${label}   ${f(from)}${a > 0.02 ? ` → ${f(lerp(from, to, a))}` : ''}`, s.w / 2, y, { size: 3.6, font: 'mono', weight: 600, color: a > 0.98 ? s.c(k) : s.c('--ink-2') });
    // The gradients from the scores, restated before the step uses them.
    const grads = s.win('recap', 'step');
    s.alpha(grads, () => {
      mono(s, `row 0 gradient: ${fm(DS[0]!)} x`, s.w / 2, yA, 'red', 3.6);
      mono(s, `row 1 gradient: +${fm(DS[1]!)} x`, s.w / 2, yB, 'red', 3.6);
    });
    s.alpha(s.ease('step', 0.6), () => {
      read('row 0 · x', dot(W[0]!, X), dot(W2[0]!, X), a0, yA, 'green');
      read('row 1 · x', dot(W[1]!, X), dot(W2[1]!, X), a1, yB, 'red');
    });
  },
};

// The worked problems: the givens of the practice's update and bias questions.
const TW = [
  [1, 2],
  [2, -1],
];
const TX = [3, 1];
const TP = [0.4, 0.6];
const TY = 1;
const TDS = TP.map((p, i) => Math.round((p - (i === TY ? 1 : 0)) * 100) / 100);
const TB = [-0.2, 0.2];
const TB2 = TB.map((b, i) => Math.round((b - LR * TDS[i]!) * 100) / 100);
const TV = TW[1]![0]! - LR * TDS[1]! * TX[0]!;

const tryIt: SceneDef = {
  marks: {
    g1: { tex: String.raw`\symW = \begin{bmatrix} 1 & 2 \\ 2 & -1 \end{bmatrix},\quad \symx = [3,\ 1],\quad \symy = 1`, x: 0.5, y: 0.1, size: 4.4 },
    g2: { tex: String.raw`\symp = [0.4,\ 0.6],\quad \symeta = 0.5`, x: 0.5, y: 0.22, size: 4.4 },
    q1: { tex: String.raw`\symW_{1,0} \text{ after one SGD step?}`, x: 0.5, y: 0.31, size: 4.4 },
    q2: { tex: String.raw`\symb = [-0.2,\ 0.2] \text{ after the same step?}`, x: 0.5, y: 0.31, size: 4.4 },
    ds: { tex: String.raw`d\syms = \symp - \mathrm{onehot}(\symy) = [0.4,\ 0.6] - [0,\ 1] = [0.4,\ -0.4]`, x: 0.5, y: 0.76, size: 4 },
    dw: { tex: String.raw`d\symW_{1,0} = d\syms_1\,\symx_0 = (-0.4) \times 3 = -1.2`, x: 0.5, y: 0.87, size: 4.2 },
    step: { tex: String.raw`\symW_{1,0} - \symeta\, d\symW_{1,0} = 2 - 0.5 \times (-1.2) = 2 + 0.6 = 2.6`, x: 0.5, y: 0.87, size: 4 },
    a2: { tex: String.raw`\symb - \symeta\, d\syms = [-0.2,\ 0.2] - 0.5 \times [0.4,\ -0.4] = [-0.4,\ 0.4]`, x: 0.5, y: 0.87, size: 4 },
  },
  draw(s) {
    const one = 1 - s.ease('p2', 0.6);
    const two = s.ease('p2', 0.6, 0.3);
    s.show('g1', s.ease('p1', 0.6));
    s.show('g2', s.ease('p1', 0.6, 0.3));
    s.show('q1', lateIn(s, 'p1', 0.8) * one);
    s.show('q2', two);
    s.show('ds', lateIn(s, 'ds', 0.6));
    s.show('dw', lateIn(s, 'dw', 0.75) * (1 - s.ease('step', 0.5)));
    s.show('step', lateIn(s, 'step', 0.6) * one);
    s.show('a2', lateIn(s, 'a2', 0.5));
    const xs = columns(s, 2, s.tall ? 20 : 18).map((x) => x + (s.tall ? 4 : 0) * s.u);
    const left = xs[0]! - (s.tall ? 22 : 20) * s.u;
    const ry = [s.h * 0.53, s.h * 0.64];
    const top = s.h * 0.42;
    // ds down the side, filled once the score gradient is worked.
    const dsA = lateIn(s, 'ds', 0.7);
    s.alpha(s.ease('ds', 0.6), () => {
      ry.forEach((y, i) => cells(s, [left], y, [dsA > 0.4 ? fm(TDS[i]!) : '?'], 'red', { w: 13, h: 8, on: [i === 1 ? s.win('dw', 'step') : 0] }));
      mono(s, 'ds', left - 10 * s.u, (ry[0]! + ry[1]!) / 2, 'red', 3.6, 'right', 650);
    });
    // Problem one: W with x across the top; W[1,0] steps from 2 to 2.6.
    s.alpha(lateIn(s, 'p1', 0.8) * one, () => {
      const hit = s.win('dw', 'p2');
      const moved = lateIn(s, 'step', 0.7);
      cells(s, xs, top, TX.map(String), 'orange', { w: 12, h: 7, on: [hit, 0] });
      mono(s, 'x', xs[1]! + 9 * s.u, top, 'orange', 3.8, 'left', 650);
      ry.forEach((y, i) =>
        xs.forEach((x, j) => {
          const it = i === 1 && j === 0;
          cells(s, [x], y, [it && moved > 0.5 ? f(TV) : fm(TW[i]![j]!)], it && moved > 0.5 ? 'green' : 'blue', { w: 12, h: 8, on: [it ? 0.4 + 0.6 * Math.max(hit, moved) : 0] });
        }),
      );
      mono(s, 'W', xs[1]! + 9 * s.u, (ry[0]! + ry[1]!) / 2, 'blue', 3.8, 'left', 650);
    });
    // Problem two: b beside ds, each entry stepping against its own.
    s.alpha(two, () => {
      const moved = lateIn(s, 'a2', 0.8);
      ry.forEach((y, i) => {
        cells(s, [xs[0]!], y, [moved > 0.5 ? fm(TB2[i]!) : fm(TB[i]!)], 'green', { w: 12, h: 8, on: [moved] });
        s.alpha(lateIn(s, 'a2', 0.45), () => mono(s, `${fm(TB[i]!)} − 0.5 × ${par(TDS[i]!)} = ${fm(TB2[i]!)}`, xs[0]! + 9 * s.u, y, '--ink-2', 3.2, 'left'));
      });
      mono(s, 'b', xs[0]!, top, 'green', 3.8, 'center', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { toward, try: tryIt };
