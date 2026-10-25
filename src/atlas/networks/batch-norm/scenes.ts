import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, rowLabel } from '../../draw';
import { after, caption, Frame, type Ink } from '../draw';

const X = [9, 3, 17, 11];
const MU = 10;
const SD = 5;
const XH = X.map((v) => (v - MU) / SD);
const Y = XH.map((v) => 2 * v + 1);
const str = (v: number) => String(Math.round(v * 100) / 100).replace('-', '−');

/** A number line from `lo` to `hi` across the stage at height y, with ticks every `step`. */
function axis(s: Scene, y: number, lo: number, hi: number, step: number, k: Ink = '--ink-3') {
  const l = 10 * s.u;
  const r = s.w - 10 * s.u;
  const X = (v: number) => l + ((v - lo) / (hi - lo)) * (r - l);
  s.line(l, y, r, y, s.c('--axis'), 0.35);
  for (let v = lo; v <= hi + 1e-9; v += step) {
    s.line(X(v), y - 1 * s.u, X(v), y + 1 * s.u, s.c('--axis'), 0.3);
    s.text(str(v), X(v), y + 4 * s.u, { size: 2.9, font: 'mono', color: s.c(k) });
  }
  return X;
}

const normalize: SceneDef = {
  marks: {
    f: { tex: String.raw`\hat{x} = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}}`, x: 0.5, y: 0.89, size: 6.5 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 15);
    const yc = s.h * 0.14;
    rowLabel(s, 'x', xs[0]! - 10 * u, yc, 'orange', 3.8);
    cells(s, xs, yc, X.map(str), 'orange', { w: 11, h: 8, on: X.map(() => s.win('mean', 'var')) });
    const y1 = s.h * 0.4;
    const A = axis(s, y1, 0, 20, 5);
    X.forEach((v) => s.circle(A(v), y1, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 }));
    // The mean, then the spread around it.
    s.alpha(s.ease('mean', 0.6), () => {
      s.line(A(MU), y1 - 9 * u, A(MU), y1 + 1.5 * u, s.c('purple'), 0.4, [1, 0.8]);
      s.text('μ = 10', A(MU), y1 - 11.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    });
    s.alpha(s.ease('var', 0.6), () => {
      X.forEach((v) => s.text(String((v - MU) ** 2), A(v), y1 - 4 * u, { size: 3, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
      s.alpha(after(s, 'var', 0.55) * (1 - s.ease('xhat', 0.6)), () => {
        const yb = y1 + 9 * u;
        s.line(A(MU - SD), yb, A(MU + SD), yb, s.c('purple'), 0.4);
        s.line(A(MU - SD), yb - 1.2 * u, A(MU - SD), yb + 1.2 * u, s.c('purple'), 0.4);
        s.line(A(MU + SD), yb - 1.2 * u, A(MU + SD), yb + 1.2 * u, s.c('purple'), 0.4);
        s.text('σ = 5', A(MU + SD) + 2 * u, yb, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
      });
    });
    // The normalized values on their own line, each arrow from its raw value.
    const y2 = s.h * 0.7;
    const nA = s.ease('xhat', 0.6);
    s.alpha(nA, () => {
      const B = axis(s, y2, -2, 2, 1);
      s.text('x̂', 6 * u, y2, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
      XH.forEach((v, i) => {
        const a = i < 2 ? s.ease('xhat', 0.6, 0.8 + i) : after(s, 'xhat', 0.8);
        s.alpha(a, () => {
          s.arrow(A(X[i]!), y1 + 2 * u, B(v), y2 - 2.5 * u, s.tint('--ink-3', 0.7), 0.3, 1.8);
          s.circle(B(v), y2, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 });
          s.text(str(v), B(v), y2 - 4.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
        });
      });
      s.alpha(s.ease('unit', 0.6), () => s.text('mean 0, variance 1', B(0), y2 + 9 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true }));
    });
    s.show('f', s.ease('eps', 0.6) * (1 - s.ease('unit', 0.6)));
    const cy = s.h * 0.9;
    s.alpha(s.win('mean', 'var'), () => caption(s, '(9 + 3 + 17 + 11) / 4 = 10', cy, 'purple', 3.8));
    s.alpha(s.win('var', 'xhat'), () => caption(s, '(1 + 49 + 49 + 1) / 4 = 25,  √25 = 5', cy, 'red', 3.6));
    s.alpha(s.win('xhat', 'eps'), () => caption(s, '(9 − 10) / 5 = −0.2,  (3 − 10) / 5 = −1.4', cy, 'orange', 3.4));
  },
};

const affine: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 17 : 18);
    const lx = xs[0]! - 11 * u;
    const ys = [s.h * 0.22, s.h * 0.52, s.h * 0.8];
    s.alpha(s.win('y', 'undo'), () => s.text('γ = 2,  β = 1', s.w / 2, ys[0]! - 10 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
    rowLabel(s, 'x̂', lx, ys[0]!, 'orange', 3.8);
    cells(s, xs, ys[0]!, XH.map(str), 'orange', { w: 13, h: 8.5, on: [s.win('y', 'undo'), 0, 0, 0] });
    s.alpha(s.ease('gamma', 0.6), () => {
      xs.forEach((x) => s.arrow(x, ys[0]! + 5.5 * u, x, ys[1]! - 5.5 * u, s.c('--ink-3'), 0.35, 2));
      const gy = (ys[0]! + ys[1]!) / 2;
      s.text('×', xs[0]! - 14 * u, gy, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.text('γ', xs[0]! - 10 * u, gy, { size: 4.2, font: 'serif', italic: true, weight: 600, color: s.c('purple') });
      s.text('+ β', xs[3]! + 11 * u, gy, { size: 3.8, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    s.alpha(s.ease('y', 0.6), () => {
      rowLabel(s, 'y', lx, ys[1]!, 'teal', 3.8);
      cells(s, xs, ys[1]!, Y.map(str), 'teal', { w: 13, h: 8.5, on: [s.win('y', 'undo'), 0, 0, 0] });
    });
    s.alpha(s.ease('undo', 0.6), () => {
      s.text('γ = 5,  β = 10', s.w / 2, ys[2]! - 9.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      rowLabel(s, 'y', lx, ys[2]!, 'teal', 3.8);
      cells(s, xs, ys[2]!, X.map(str), 'teal', { w: 13, h: 8.5, on: [1, 1, 1, 1] });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('gamma', 'y'), () => caption(s, 'y = γ x̂ + β, learned per feature', cy, 'purple', 3.6));
    s.alpha(s.win('y', 'undo'), () => caption(s, '2 × (−0.2) + 1 = 0.6', cy, 'teal', 3.8));
    s.alpha(s.ease('undo', 0.6, 1), () => caption(s, 'γ = σ, β = μ: back to x', cy, 'teal', 3.8));
  },
};

/** Batch means drawn around a true mean of 10, and the running average that tracks them. */
const T = 24;
const MEANS = (() => {
  const rng = new Rng(3);
  return Array.from({ length: T }, () => 10 + 1.6 * rng.randn());
})();
const RUN = MEANS.reduce<number[]>((acc, m, i) => [...acc, (i ? acc[i - 1]! : 0) * 0.8 + 0.2 * m], []);

const test: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = new Frame(s, 14 * u, s.h * 0.1, s.w - 8 * u, s.h * 0.62, [0, T + 1], [0, 15]);
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
    for (const v of [0, 5, 10, 15]) s.text(String(v), F.l - 2 * u, F.Y(v), { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('batch', F.r, F.b + 4 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
    const n = Math.max(1, Math.round(T * Math.min(1, s.prog('running') * 1.3)));
    for (let i = 0; i < n; i++) F.dot(i + 1, MEANS[i]!, 'purple', 1);
    F.clip(() => {
      const c = s.ctx;
      c.beginPath();
      for (let i = 0; i < n; i++) (i ? c.lineTo : c.moveTo).call(c, F.X(i + 1), F.Y(RUN[i]!));
      c.strokeStyle = s.c('gold');
      c.lineWidth = 0.6 * u;
      c.stroke();
    });
    s.text('batch μ', F.X(3), F.Y(13.6), { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    s.alpha(after(s, 'running', 0.3), () => s.text('running μ', F.X(T * 0.62), F.Y(3), { size: 3.2, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
    const tA = s.ease('test', 0.6);
    s.alpha(tA, () => {
      F.seg(0, 10, T + 1, 10, 'gold', 0.3, [1, 0.8]);
      const y = s.h * 0.78;
      s.text('test example: x = 13', s.w / 2, y, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
      s.alpha(after(s, 'test', 0.35), () => s.text('(13 − running μ) / running σ = (13 − 10) / 5 = 0.6', s.w / 2, y + 7 * u, { size: s.tall ? 3 : 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    });
    s.alpha(after(s, 'test', 0.6), () => caption(s, 'the same answer, whatever else is in the batch', s.h * 0.93, '--ink-2', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { normalize, affine, test };
