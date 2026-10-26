import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../backprop/draw';
import { fmt, push, rich } from '../draw';

const R = [0.9, 0.6, 0.5, 0.2];
const B = R.reduce((a, b) => a + b, 0) / R.length;
const A = R.map((r) => Math.round((r - B) * 100) / 100);
const PI = [0.5, 0.3, 0.2];

/** The four rewards as bars, with a row of pushes under them: R at first, A once `adv` > 0. */
function layout(s: Scene) {
  const xs = columns(s, 4, 20);
  return { xs, base: s.h * 0.5, yp: s.h * 0.77, lx: xs[0]! - 10 * s.u, H: 34 };
}

function rewards(s: Scene, L: ReturnType<typeof layout>, hi?: number[]): void {
  rowLabel(s, 'R', L.lx, L.base - 8 * s.u, 'gold', 3.8);
  bars(s, L.xs, L.base, R, 'gold', { max: 1, height: L.H, w: 11, fmt: (v) => v.toFixed(1), hi });
}

const allup: SceneDef = {
  draw(s) {
    const L = layout(s);
    rewards(s, L, [0, 0, 0, s.win('allup', 'noise')]);
    const a = s.ease('allup', 0.8, 0.8);
    s.alpha(a, () => {
      rowLabel(s, 'push', L.lx, L.yp, '--ink-3', 3);
      L.xs.forEach((x, i) => push(s, x, L.yp + 6 * s.u, Math.max(0.25, R[i]!), 14, a));
    });
    s.alpha(s.ease('allup', 0.6, 2.5), () => s.text('all up, even the worst', s.w / 2, s.h * 0.92, { size: 3.2, color: s.c('green') }));
    s.alpha(s.ease('noise', 0.6), () => s.text('pushes whatever was sampled: noisy', s.w / 2, s.h * 0.1, { size: 3.2, color: s.c('--ink-2') }));
  },
};

const baseline: SceneDef = {
  draw(s) {
    const L = layout(s);
    // The baseline as a dashed level behind the bars.
    const bA = s.ease('b', 0.8);
    const yb = L.base - (B / 1) * L.H * s.u;
    s.alpha(bA, () => {
      const x0 = L.xs[0]! - 8 * s.u;
      const x1 = x0 + (L.xs[3]! - L.xs[0]! + 16 * s.u) * bA;
      s.line(x0, yb, x1, yb, s.c('green'), 0.45, [1.4, 1]);
      s.text(`b = ${fmt(B)}`, L.xs[3]! + 8 * s.u, yb - 3 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true });
    });
    rewards(s, L, [0, 0, s.win('third', undefined), 0]);
    const aA = s.ease('A', 0.8, 0.6);
    s.alpha(aA, () => {
      rowLabel(s, 'A', L.lx, L.base + 8 * s.u, 'red', 3.6);
      cells(s, L.xs, L.base + 8 * s.u, A.map((v) => fmt(v)), 'red', { w: 12, h: 7, on: [0, 0, s.win('third', undefined), 0] });
    });
    const sg = s.ease('signs', 0.8, 0.6);
    s.alpha(sg, () => {
      rowLabel(s, 'push', L.lx, L.yp, '--ink-3', 3);
      L.xs.forEach((x, i) => push(s, x, L.yp, Math.sign(A[i]!) * Math.max(0.25, Math.abs(A[i]!) * 2.4), 12, sg));
    });
    s.alpha(s.ease('third', 0.6, 1.5), () => s.text('positive reward, below b: pushed down', s.w / 2, s.h * 0.94, { size: 3.2, color: s.c('red') }));
  },
};

// The 7 × 8 model: each answer's ∇ln π, and those rows weighted by π.
const ANS = ['56', '54', '64'];
const GL = ANS.map((_, y) => PI.map((p, i) => Math.round(((i === y ? 1 : 0) - p) * 10) / 10));
const WG = GL.map((row, y) => row.map((g) => Math.round(PI[y]! * g * 100) / 100));
const sgn = (v: number, d = 2) => (Math.abs(v) < 1e-9 ? '0' : v < 0 ? `−${(-v).toFixed(d)}` : v.toFixed(d));

const same: SceneDef = {
  marks: {
    split: { tex: String.raw`(\sym{R}{R} - \sym{b}{b})\,\nabla\ln\sym{pi}{\pi} = \sym{R}{R}\,\nabla\ln\sym{pi}{\pi} - \sym{b}{b}\,\nabla\ln\sym{pi}{\pi}`, x: 0.5, y: 0.09, size: 4.2 },
    f: { tex: String.raw`\sum_y \sym{pi}{\pi}(y)\,\nabla\ln\sym{pi}{\pi}(y) = \sum_y \nabla\sym{pi}{\pi}(y) = \nabla 1 = 0`, x: 0.5, y: 0.1, size: 4.4 },
    g: { tex: String.raw`\mathbb{E}\big[(\sym{R}{R} - \sym{b}{b})\,\nabla\ln\sym{pi}{\pi}\big] = \mathbb{E}\big[\sym{R}{R}\,\nabla\ln\sym{pi}{\pi}\big]`, x: 0.5, y: 0.26, size: 4.4 },
  },
  draw(s) {
    const tableA = s.ease('check', 0.6) * (1 - s.ease('why', 0.5));
    s.show('split', s.ease('sum', 0.6) * (1 - s.ease('why', 0.5)));
    // Phase one: each answer's ∇ln π, weighted by its π, adds up to zero in every column.
    s.alpha(tableA, () => {
      const xs = columns(s, 3, 14).map((x) => x + 9 * s.u);
      const ys = [0.24, 0.36, 0.48].map((f) => s.h * f);
      const w = after(s, 'weigh', 0.12);
      const col0 = after(s, 'weigh', 0.2) * (1 - after(s, 'weigh', 0.85));
      s.alpha(1 - w, () => s.text('∇ln π', xs[1]!, ys[0]! - 7 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-3') }));
      s.alpha(w, () => s.text('π · ∇ln π', xs[1]!, ys[0]! - 7 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-3') }));
      ANS.forEach((a, y) => {
        s.cell(xs[0]! - 31 * s.u, ys[y]! - 3.5 * s.u, 10 * s.u, 7 * s.u, a, 'purple', { size: 3 });
        s.text(`${PI[y]!.toFixed(1)} ×`, xs[0]! - 13 * s.u, ys[y]!, { size: 3.2, font: 'mono', weight: 600, align: 'center', color: s.c('teal') });
        const lab = GL[y]!.map((g, i) => (w < 0.5 ? sgn(g, 1) : sgn(WG[y]![i]!)));
        cells(s, xs, ys[y]!, lab, 'red', { w: 12, h: 7, on: [col0, 0, 0] });
      });
      s.alpha(after(s, 'weigh', 0.45), () => {
        const yl = s.h * 0.555;
        s.line(xs[0]! - 7 * s.u, yl, xs[2]! + 7 * s.u, yl, s.c('--axis'), 0.35);
        cells(s, xs, s.h * 0.62, ['0', '0', '0'], 'green', { w: 12, h: 7, on: [col0, after(s, 'weigh', 0.85), after(s, 'weigh', 0.85)] });
        s.text('sum', xs[0]! - 13 * s.u, s.h * 0.62, { size: 3.2, font: 'mono', weight: 600, color: s.c('green') });
        s.text('0.25 − 0.15 − 0.10 = 0', s.w / 2, s.h * 0.74, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      });
    });
    // Phase two: why, in general.
    const two = s.ease('why', 0.6, 0.3);
    s.show('f', two);
    s.show('g', s.ease('E', 0.6));
    const xs = columns(s, 3, 20);
    const base = s.h * 0.72;
    const t = s.ease('why', 1.2, 2.5) * (1 - s.ease('best', 0.6));
    const d = [0.12, -0.07, -0.05].map((v) => v * t);
    const p = PI.map((v, i) => v + d[i]!);
    s.alpha(two, () => {
      bars(s, xs, base, p, 'teal', { max: 1, height: 44, w: 11, fmt: (v) => v.toFixed(2) });
      rowLabel(s, 'π', xs[0]! - 10 * s.u, base - 8 * s.u, 'teal', 3.8);
    });
    s.alpha(t, () => s.text(`sum = ${p.reduce((a, b) => a + b, 0).toFixed(2)}: changes cancel`, s.w / 2, base + 6 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('best', 0.6), () => {
      s.text('best b: the reward expected for this question', s.w / 2, base + 6 * s.u, { size: 3.2, color: s.c('green') });
      s.text('a running average, or a second model', s.w / 2, base + 11 * s.u, { size: 3, color: s.c('--ink-3') });
    });
  },
};

// The worked problems: advantages from a mean baseline, then one entry of the estimate.
const R2 = [1, 0.4, 0.1];
const B2 = 0.5;
const A2 = R2.map((r) => Math.round((r - B2) * 10) / 10);

const tryIt: SceneDef = {
  marks: {
    q2: { tex: String.raw`\dfrac{\partial \ln \sym{pi}{\pi}(y)}{\partial \sym{theta}{\theta}_0} = 2`, x: 0.5, y: 0.6, size: 4.2 },
  },
  draw(s) {
    const xs = columns(s, 3, 18);
    const lx = xs[0]! - 9 * s.u;
    const yR = s.h * 0.14;
    const yA = s.h * 0.4;
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      rowLabel(s, 'R', lx, yR, 'gold', 3.6);
      cells(s, xs, yR, R2.map(String), 'gold', { w: 12, h: 7, on: [0, s.ease('p2', 0.6), 0] });
      xs.forEach((x, i) => s.text(`answer ${i}`, x, yR - 6.5 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.1), () => rich(s, [['b = (1 + 0.4 + 0.1) / 3 = ', '--ink-2'], ['0.5', 'green']], s.w / 2, s.h * 0.25, { size: 3.2, weight: 600 }));
    s.alpha(after(s, 'a1', 0.45), () => {
      xs.forEach((x) => s.text('− 0.5', x, s.h * 0.32, { size: 2.8, font: 'mono', color: s.c('green'), halo: true }));
      rowLabel(s, 'A', lx, yA, 'red', 3.6);
      cells(s, xs, yA, A2.map((v) => (v < 0 ? `−${-v}` : String(v))), 'red', { w: 12, h: 7, on: [0, s.ease('p2', 0.6), 0] });
    });
    s.show('q2', s.ease('p2', 0.6, 0.5));
    s.alpha(after(s, 'a2', 0.1), () => rich(s, [['A · ∂ln π/∂θ₀ = −0.1 × 2 = ', '--ink-2'], ['−0.2', 'red']], s.w / 2, s.h * 0.74, { size: 3.2, weight: 600 }));
    s.alpha(after(s, 'a2', 0.55), () => {
      s.text('positive reward, below b: pushed down', s.w / 2, s.h * 0.84, { size: 3, color: s.c('red') });
      push(s, xs[1]!, yA + 4.5 * s.u, -0.5, 10, after(s, 'a2', 0.55));
    });
  },
};

export const scenes: Record<string, SceneDef> = { allup, baseline, same, try: tryIt };
