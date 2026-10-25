import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';

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

const loop: SceneDef = {
  draw(s) {
    s.text('x = [2, 1]    y = 0', s.w / 2, s.h * 0.07, { size: 3.8, font: 'mono', weight: 600, color: s.c('orange') });
    const rows: [string, string, Ink, string][] = [
      ['s = Wx + b', '[1.0, 1.85]', 'purple', 'scores'],
      ['p = softmax(s)', '[0.3, 0.7]', 'teal', 'probs'],
      ['ds = p − onehot(y)', '[−0.7, 0.7]', 'red', 'grad'],
      ['W −= η dW,  b −= η db', '', 'blue', 'update'],
    ];
    const cx = s.w * 0.4;
    const bw = s.w * 0.56;
    const bh = 9 * s.u;
    rows.forEach(([text, val, k, beat], i) => {
      const y = s.h * (0.24 + i * 0.2);
      const on = s.since(beat) >= 0 ? 1 : 0;
      const lit = s.win(beat, rows[i + 1]?.[3]);
      s.alpha(0.3 + 0.7 * s.ease('x', 0.6, 0.8 + i * 0.25), () => {
        s.rrect(cx - bw / 2, y - bh / 2, bw, bh, 1.4, { fill: s.tint(k, 0.08 + 0.18 * lit), stroke: s.tint(k, 0.4 + 0.5 * lit), lw: 0.3 + 0.2 * lit });
        s.text(text, cx, y, { size: 3.4, font: 'mono', weight: 600, color: s.c(k) });
        if (i < 3) s.arrow(cx, y + bh / 2 + 1.2 * s.u, cx, y + s.h * 0.2 - bh / 2 - 1.2 * s.u, s.c('--ink-3'), 0.35, 1.8);
      });
      if (val) s.alpha(s.ease(beat, 0.6, 0.6) * on, () => s.text(val, cx + bw / 2 + 3 * s.u, y, { size: 3.4, font: 'mono', align: 'left', color: s.c(k) }));
    });
  },
};

const outer: SceneDef = {
  marks: {
    s: { tex: String.raw`\syms_i = \symW_{i0}\,\symx_0 + \symW_{i1}\,\symx_1 + \symb_i`, x: 0.5, y: 0.88, size: 4.6 },
    g: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{ij}} = ds_i\,\symx_j`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
    const xs = columns(s, 2, s.tall ? 22 : 20);
    const left = xs[0]! - (s.tall ? 24 : 22) * s.u;
    const right = xs[1]! + (s.tall ? 24 : 22) * s.u;
    const top = s.h * 0.14;
    const ry = [s.h * 0.38, s.h * 0.6];
    s.text('x', left, top, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });
    cells(s, xs, top, X.map(String), 'orange');
    s.text('ds', left, ry[0]! - 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
    ry.forEach((y, i) => cells(s, [left], y, [f(DS[i]!)], 'red', { w: 13 }));
    s.show('s', s.win('chain', 'outer'));
    s.show('g', s.ease('outer', 0.6));
    s.alpha(s.win('chain', 'outer'), () => {
      s.text('row i of W', (xs[0]! + xs[1]!) / 2, ry[0]! - 9 * s.u, { size: 3.2, color: s.c('blue') });
      cells(s, xs, ry[0]!, W[0]!.map(String), 'blue', { on: [0.4, 0.4] });
    });
    s.alpha(s.ease('outer', 0.4), () => {
      s.text('dW', (xs[0]! + xs[1]!) / 2, ry[0]! - 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
      ry.forEach((y, i) =>
        xs.forEach((x, j) => {
          const a = s.ease('outer', 0.5, 1.2 + (i * 2 + j) * 0.7);
          cells(s, [x], y, [a > 0.3 ? f(DS[i]! * X[j]!) : ''], 'red', { on: [a] });
        }),
      );
    });
    s.alpha(s.ease('db', 0.6), () => {
      s.text('db', right, ry[0]! - 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
      ry.forEach((y, i) => cells(s, [right], y, [f(DS[i]!)], 'red', { w: 13, on: [1] }));
    });
  },
};

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
    read('row 0 · x', dot(W[0]!, X), dot(W2[0]!, X), a0, yA, 'green');
    read('row 1 · x', dot(W[1]!, X), dot(W2[1]!, X), a1, yB, 'red');
  },
};

const example: SceneDef = {
  draw(s) {
    const gx = [s.w * 0.22, s.w * 0.36];
    const vx = [s.w * 0.68, s.w * 0.82];
    const r = [s.h * 0.12, s.h * 0.25];
    const hi = s.win('ask', 'ds') + s.ease('step', 0.6);
    s.text('W', gx[0]! - 10 * s.u, (r[0]! + r[1]!) / 2, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
    [
      ['0.5', '-1'],
      ['1', '2'],
    ].forEach((row, i) => row.forEach((v, j) => cells(s, [gx[j]!], r[i]!, [v], 'blue', { w: 12, h: 8, size: 3.4, on: [i === 1 && j === 0 ? Math.min(1, hi) : 0] })));
    rowLabel(s, 'x', vx[0]! - 8 * s.u, r[0]!, 'orange', 3.8);
    cells(s, vx, r[0]!, ['3', '-1'], 'orange', { w: 12, h: 8, size: 3.4, on: [s.win('dW', 'step'), 0] });
    rowLabel(s, 'p', vx[0]! - 8 * s.u, r[1]!, 'teal', 3.8);
    cells(s, vx, r[1]!, ['0.4', '0.6'], 'teal', { w: 12, h: 8, size: 3.4, on: [0, s.win('ds', 'dW')] });
    s.text('y = 1     η = 0.1', s.w / 2, s.h * 0.37, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
    const line = (beat: string, text: string, y: number, k: 'red' | 'blue', size = 3.8) =>
      s.alpha(s.ease(beat, 0.6), () => s.text(text, s.w / 2, s.h * y, { size, font: 'mono', weight: 600, color: s.c(k) }));
    s.alpha(s.win('ask', 'ds', 0.3), () => s.text('W[1, 0] after one step = ?', s.w / 2, s.h * 0.55, { size: 3.8, font: 'mono', color: s.c('--ink-3') }));
    line('ds', 'ds = [0.4, 0.6 − 1] = [0.4, −0.4]', 0.52, 'red', 3.4);
    line('dW', 'dW[1, 0] = ds[1] × x[0] = −1.2', 0.67, 'red', 3.4);
    line('step', 'W[1, 0] = 1 − 0.1 × (−1.2) = 1.12', 0.84, 'blue', 3.8);
  },
};

export const scenes: Record<string, SceneDef> = { loop, outer, toward, example };
