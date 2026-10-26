import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../backprop/draw';
import { fmt, push, rich } from '../draw';

const R = [0.9, 0.6, 0.5, 0.2];
const B = R.reduce((a, b) => a + b, 0) / R.length;
const A = R.map((r) => Math.round((r - B) * 100) / 100);

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

export const scenes: Record<string, SceneDef> = { allup, baseline, try: tryIt };
