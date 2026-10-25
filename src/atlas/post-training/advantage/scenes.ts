import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { fmt, push } from '../draw';

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

const same: SceneDef = {
  marks: {
    f: { tex: String.raw`\sum_y \sym{pi}{\pi}(y)\,\nabla\ln\sym{pi}{\pi}(y) = \sum_y \nabla\sym{pi}{\pi}(y) = \nabla 1 = 0`, x: 0.5, y: 0.1, size: 4.4 },
    g: { tex: String.raw`\mathbb{E}\big[(\sym{R}{R} - \sym{b}{b})\,\nabla\ln\sym{pi}{\pi}\big] = \mathbb{E}\big[\sym{R}{R}\,\nabla\ln\sym{pi}{\pi}\big]`, x: 0.5, y: 0.26, size: 4.4 },
  },
  draw(s) {
    s.show('f', s.ease('sum', 0.6));
    s.show('g', s.ease('zero', 0.6));
    // Probabilities that must keep adding up to one: one rises, the others give way.
    const xs = columns(s, 3, 20);
    const base = s.h * 0.72;
    const t = s.ease('one', 1.2, 0.6) * (1 - s.ease('best', 0.6));
    const d = [0.12, -0.07, -0.05].map((v) => v * t);
    const p = PI.map((v, i) => v + d[i]!);
    s.alpha(s.ease('sum', 0.6, 1), () => {
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

export const scenes: Record<string, SceneDef> = { allup, baseline, same };
