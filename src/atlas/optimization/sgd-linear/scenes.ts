import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, columns } from '../../draw';
import { after, caption, Frame, rich } from '../../networks/draw';

type Ink = Color | `--${string}`;

const f = (v: number) => String(Math.round(v * 100) / 100);
const fm = (v: number) => (v < 0 ? `−${f(-v)}` : f(v));
const fs = (v: number) => (v < 0 ? `−${f(-v)}` : `+${f(v)}`);
const par = (v: number) => (v < 0 ? `(${fm(v)})` : fm(v));

/** Eased in `frac` of the way through beat `id`, so a value lands as the voice says it. */
const lateIn = (s: Scene, id: string, frac: number) => s.ease(id, 0.6, frac * (s.end(id) - s.at(id)));

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** Who introduced an idea, and when: small, at the right of the stage, at the top unless `y` is given. */
function cite(s: Scene, text: string, a: number, y = 5 * s.u) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- linear-grad's picture: cats low and ships high, a cat x on the wrong side of the border

const X = [2, 1];
const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [1.15, 1.45], [0.7, 0.9], [0.6, 1.95], [1, 1]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
/** Cat's row and ship's row, and their biases: at x = (2, 1) the scores are 1.0 and 1.85, so p = (0.3, 0.7). */
const W = [
  [-2, -1],
  [0.5, 1],
];
const B = [6, -0.15];
const DS = [-0.7, 0.7];
const ETA = 0.2;
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]!;
const S0 = W.map((r, i) => dot(r, X) + B[i]!);
/** How far each score moves in one step: −η dsᵢ (x · x + 1), the weights' part plus the bias's. */
const DSC = DS.map((d) => -ETA * d * (dot(X, X) + 1));
const softmax2 = (s: number[]) => {
  const e = s.map((v) => Math.exp(v - Math.max(...s)));
  const z = e[0]! + e[1]!;
  return e.map((v) => v / z);
};

/** The plane, square, at the top of the stage with room for a panel under it. */
function plane(s: Scene): Frame {
  const side = Math.min(s.w - 20 * s.u, s.h * 0.62);
  const l = s.w / 2 - side / 2;
  const t = s.h * 0.04;
  return new Frame(s, l, t, l + side, t + side, [-0.5, 4.5], [-0.5, 4.5]);
}

/** Cat's score minus ship's as a·x₀ + c·x₁ + e, a fraction `k` of the way through the step. */
function gap(k: number) {
  const w0 = W[0]!.map((v, j) => v - k * ETA * DS[0]! * X[j]!);
  const w1 = W[1]!.map((v, j) => v - k * ETA * DS[1]! * X[j]!);
  const b0 = B[0]! - k * ETA * DS[0]!;
  const b1 = B[1]! - k * ETA * DS[1]!;
  return { a: w0[0]! - w1[0]!, c: w0[1]! - w1[1]!, e: b0 - b1 };
}
type Gap = ReturnType<typeof gap>;

/** The window, cut down to where a·x₀ + c·x₁ + e has the sign `sgn`: a convex polygon. */
function side(g: Gap, sgn: 1 | -1): [number, number][] {
  const sq: [number, number][] = [[-0.5, -0.5], [4.5, -0.5], [4.5, 4.5], [-0.5, 4.5]];
  const v = (p: [number, number]) => sgn * (g.a * p[0] + g.c * p[1] + g.e);
  const out: [number, number][] = [];
  sq.forEach((p, i) => {
    const q = sq[(i + 1) % 4]!;
    const [vp, vq] = [v(p), v(q)];
    if (vp >= 0) out.push(p);
    if (vp >= 0 !== vq >= 0) {
      const t = vp / (vp - vq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}

function fillPoly(s: Scene, F: Frame, poly: [number, number][], k: Color, a: number) {
  if (poly.length < 3) return;
  const g = s.ctx;
  g.beginPath();
  poly.forEach(([x0, x1], i) => (i ? g.lineTo(F.X(x0), F.Y(x1)) : g.moveTo(F.X(x0), F.Y(x1))));
  g.closePath();
  g.fillStyle = s.tint(k, a);
  g.fill();
}

/** The border a·x₀ + c·x₁ + e = 0 across the window. */
function border(F: Frame, g: Gap, k: Ink, width = 0.7, dash?: number[]) {
  const len = Math.hypot(g.a, g.c);
  const [nx, ny] = [g.a / len, g.c / len];
  const d = -g.e / len;
  const p0 = [nx * d, ny * d];
  F.clip(() => F.seg(p0[0]! - ny * 12, p0[1]! + nx * 12, p0[0]! + ny * 12, p0[1]! - nx * 12, k, width, dash));
}

// ---- scene 1: one step swings the border past x

const swing: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    // How far through the step: 0 before the move beat, 1 once the border has swung.
    const k = after(s, 'move', 0.12, 0.6 * (s.end('move') - s.at('move')));
    const g = gap(k);
    F.clip(() => {
      fillPoly(s, F, side(g, 1), 'gold', 0.14);
      fillPoly(s, F, side(g, -1), 'teal', 0.12);
    });
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });
    s.alpha(Math.min(1, k * 3), () => border(F, gap(0), '--ink-3', 0.45, [1.2, 1.2]));
    border(F, g, 'purple', 0.7);
    CATS.forEach(([a, b]) => F.dot(a, b, 'gold', 1.25));
    SHIPS.forEach(([a, b]) => F.dot(a, b, 'teal', 1.25));
    s.text('cats', F.X(0.25), F.Y(0.4), { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
    s.text('ships', F.X(3.45), F.Y(3.6), { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
    // The cat, ringed red while it is on the wrong side and green once the step has carried the border past it.
    s.alpha(s.win('wrong', 'label'), () => s.circle(F.X(X[0]!), F.Y(X[1]!), 3.4 * u, { stroke: s.c('red'), lw: 0.45 }));
    s.alpha(s.win('scores', 'descent'), () => s.circle(F.X(X[0]!), F.Y(X[1]!), 3.4 * u, { stroke: s.c('green'), lw: 0.45 }));
    F.dot(X[0]!, X[1]!, 'orange', 1.9);
    s.text('x', F.X(X[0]!) + 3.2 * u, F.Y(X[1]!) + 2.8 * u, { size: 3.8, font: 'mono', weight: 700, color: s.c('orange'), halo: true });
    // The update, in the empty space at the right of the plane, clear of the border before and after the step.
    s.alpha(s.win('step', 'descent') * s.ease('step', 0.6, 0.8), () => {
      const r = F.r - 2.5 * u;
      rich(s, [['W − ', '--ink-2'], ['η', 'slate'], ['·', '--ink-2'], ['dW', 'red']], r, F.Y(1.5), { size: 3.4, weight: 600, align: 'right' });
      rich(s, [['b − ', '--ink-2'], ['η', 'slate'], ['·', '--ink-2'], ['db', 'red']], r, F.Y(1.0), { size: 3.4, weight: 600, align: 'right' });
      s.alpha(after(s, 'step', 0.75), () => mono(s, 'η = 0.2', r, F.Y(2.0), 'slate', 3.4, 'right'));
    });

    // The table under the plane: one column per class.
    const xs = columns(s, 2, 24);
    const lx = xs[0]! - 13 * u;
    const top = F.b + 4 * u;
    const ry = [F.b + 11 * u, F.b + 18.5 * u, F.b + 26 * u];
    const o = { w: 13, h: 6.6, size: 3.4 };
    const sc = S0.map((v, i) => v + k * DSC[i]!);
    const p = softmax2(sc);
    mono(s, 'cat', xs[0]!, top, 'gold', 3.4);
    mono(s, 'ship', xs[1]!, top, 'teal', 3.4);
    mono(s, 's', lx, ry[0]!, 'purple', 3.8, 'right', 650);
    cells(s, xs, ry[0]!, sc.map((v) => v.toFixed(2).replace(/0$/, '')), 'purple', { ...o, on: [s.win('scores', 'descent'), s.win('scores', 'descent')] });
    mono(s, 'p', lx, ry[1]!, 'teal', 3.8, 'right', 650);
    cells(s, xs, ry[1]!, p.map((v) => v.toFixed(1)), 'teal', { ...o, on: [s.win('wrong', 'label') + s.win('scores', 'descent') * after(s, 'scores', 0.6), 0] });
    s.alpha(s.ease('label', 0.6, 0.8), () => {
      s.rrect(xs[0]! - 4.5 * u, top - 2.4 * u, 9 * u, 4.8 * u, 1.2, { stroke: s.c('gold'), lw: 0.35 });
      mono(s, 'y', xs[0]! - 7 * u, top, 'gold', 3.6, 'right', 700);
    });
    // Which way each score moves: up for cat, down for ship.
    s.alpha(s.win('scores', 'descent') * after(s, 'scores', 0.1), () => {
      const arr = (x: number, up: boolean, kk: Color) => s.arrow(x + 8.6 * u, ry[0]! + (up ? 2.6 : -2.6) * u, x + 8.6 * u, ry[0]! + (up ? -2.6 : 2.6) * u, s.c(kk), 0.55, 2);
      arr(xs[0]!, true, 'green');
      arr(xs[1]!, false, 'red');
    });
    // The third line: the error the step uses, then the names.
    s.alpha(s.win('grad', 'descent') * s.ease('grad', 0.6, 0.6), () => {
      mono(s, 'ds', lx, ry[2]!, 'red', 3.8, 'right', 650);
      cells(s, xs, ry[2]!, DS.map(fm), 'red', { ...o, on: [s.win('grad', 'step'), s.win('grad', 'step')] });
    });
    const c3 = (text: string, kk: Ink, a: number) => s.alpha(a, () => caption(s, text, ry[2]!, kk, 3.3));
    c3('gradient descent: step after step, downhill', '--ink-2', s.win('descent', 'sgd') * after(s, 'descent', 0.15));
    c3('SGD: one example at a time, in random order', 'blue', s.win('sgd', 'widrow') * after(s, 'sgd', 0.55));
    c3('Adaline, 1960: a step after every pattern', '--ink-2', s.ease('widrow', 0.6));
    cite(s, 'Widrow & Hoff, 1960', s.ease('widrow', 0.6), top);
  },
};

// ---- scene 2: row by row, the correct class's weights gain some of x

const rows: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 2, 15);
    const lx = xs[0]! - 11 * u;
    const rx = xs[1]! + 11 * u;
    const yx = s.h * 0.12;
    const yc = s.h * 0.32;
    const yp = s.h * 0.5;
    const o = { w: 13, h: 8, size: 3.6 };
    const gain = -ETA * DS[0]!;
    const lose = -ETA * DS[1]!;
    // The direction of x, drawn as a short arrow, so "toward" and "away" can point along it.
    const dir = (x: number, y: number, sgn: 1 | -1, kk: Color, len = 7) => {
      const n = Math.hypot(X[0]!, X[1]!);
      const [dx, dy] = [(X[0]! / n) * len * u * sgn, (-X[1]! / n) * len * u * sgn];
      s.arrow(x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2, s.c(kk), 0.55, 2);
    };
    mono(s, 'x', lx, yx, 'orange', 3.8, 'right', 650);
    cells(s, xs, yx, X.map(String), 'orange', o);
    dir(rx + 4 * u, yx, 1, 'orange');
    // Cat's row: −η times (−0.7 x) is +0.14 x.
    s.alpha(s.ease('row0', 0.6), () => {
      mono(s, 'cat row moves', lx, yc, 'gold', 3.4, 'right', 650);
      s.alpha(1 - lateIn(s, 'gain', 0.75), () => mono(s, '− η · (−0.7 x)', s.w / 2, yc, 'red', 3.6));
    });
    s.alpha(lateIn(s, 'gain', 0.75), () => {
      cells(s, xs, yc, X.map((v) => fs(gain * v)), 'green', { ...o, on: [s.win('gain', 'toward'), s.win('gain', 'toward')] });
      mono(s, '+0.14 x', rx, yc, 'green', 3.4, 'left', 650);
    });
    s.alpha(s.ease('toward', 0.6), () => dir(rx + 22 * u, yc, 1, 'green'));
    // Ship's row: −η times (+0.7 x) is −0.14 x.
    s.alpha(s.ease('away', 0.6), () => {
      mono(s, 'ship row moves', lx, yp, 'teal', 3.4, 'right', 650);
      s.alpha(after(s, 'away', 0.3), () => {
        cells(s, xs, yp, X.map((v) => fs(lose * v)), 'red', { ...o, on: [s.win('away', 'rule'), s.win('away', 'rule')] });
        mono(s, '−0.14 x', rx, yp, 'red', 3.4, 'left', 650);
      });
      s.alpha(after(s, 'away', 0.55), () => dir(rx + 22 * u, yp, -1, 'red'));
    });
    // What each change does to its class's score.
    const ya = s.h * 0.68;
    const yb = s.h * 0.78;
    s.alpha(s.win('toward', 'away') * after(s, 'toward', 0.35), () => mono(s, 'row · x: +0.14 × (x · x) = 0.14 × 5 = +0.7', s.w / 2, ya, 'green', 3.4));
    s.alpha(s.win('bias', 'away'), () => {
      mono(s, 'bias: +0.14', s.w / 2, yb, 'green', 3.4);
      s.alpha(after(s, 'bias', 0.45), () => mono(s, 'cat\'s score: +0.7 + 0.14 = +0.84', s.w / 2, s.h * 0.88, 'purple', 3.4));
    });
    s.alpha(s.win('away', 'rule') * after(s, 'away', 0.6), () => mono(s, 'ship\'s score: −0.7 − 0.14 = −0.84', s.w / 2, ya, 'red', 3.4));
    // The rule, for any input.
    s.alpha(s.ease('rule', 0.6), () => {
      s.alpha(after(s, 'rule', 0.2), () => rich(s, [['correct class: ', 'gold'], ['p − 1 < 0', '--ink-2'], ['  → toward x', 'green']], s.w / 2, ya, { size: 3.5, weight: 600 }));
      s.alpha(after(s, 'rule', 0.65), () => rich(s, [['other classes: ', 'teal'], ['p > 0', '--ink-2'], ['  → away from x', 'red']], s.w / 2, yb, { size: 3.5, weight: 600 }));
    });
  },
};

// ---- scene 3: the worked problems, the givens of the practice's update and bias questions

const TW = [
  [1, 2],
  [2, -1],
];
const TX = [3, 1];
const TP = [0.4, 0.6];
const TY = 1;
const LR = 0.5;
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
    a2: { tex: String.raw`\symb - \symeta\, d\syms = [-0.2,\ 0.2] - 0.5 \times [0.4,\ -0.4]`, x: 0.5, y: 0.87, size: 3.6 },
  },
  draw(s) {
    const one = 1 - s.ease('p2', 0.6);
    const two = s.ease('p2', 0.6, 0.3);
    s.show('g1', s.ease('p1', 0.6));
    s.show('g2', s.ease('q1', 0.6));
    s.show('q1', lateIn(s, 'q1', 0.6) * one);
    s.show('q2', two);
    s.show('ds', lateIn(s, 'ds', 0.6));
    s.show('dw', lateIn(s, 'dw', 0.75) * (1 - s.ease('step', 0.5)));
    s.show('step', lateIn(s, 'step', 0.6) * one);
    s.show('a2', lateIn(s, 'a2', 0.6));
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
    s.alpha(s.ease('p1', 0.6, 0.6) * one, () => {
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
    // Problem two: b beside ds, each entry stepping against its own, one per beat.
    s.alpha(two, () => {
      ry.forEach((y, i) => {
        const id = i === 0 ? 'b0' : 'b1';
        const moved = lateIn(s, id, 0.75);
        cells(s, [xs[0]!], y, [moved > 0.5 ? fm(TB2[i]!) : fm(TB[i]!)], 'green', { w: 12, h: 8, on: [smooth(moved)] });
        s.alpha(lateIn(s, id, 0.3), () => mono(s, `${fm(TB[i]!)} − 0.5 × ${par(TDS[i]!)} = ${fm(TB2[i]!)}`, xs[0]! + 9 * s.u, y, '--ink-2', 3.2, 'left'));
      });
      mono(s, 'b', xs[0]!, top, 'green', 3.8, 'center', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { swing, rows, try: tryIt };
