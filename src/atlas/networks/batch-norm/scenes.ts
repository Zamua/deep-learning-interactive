import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, rowLabel } from '../../draw';
import { after, caption, Frame, type Ink, matrix, rich } from '../draw';

const X = [9, 3, 17, 11];
const MU = 10;
const SD = 5;
const XH = X.map((v) => (v - MU) / SD);
const G = 2;
const B = 1;
const Y = XH.map((v) => G * v + B);
const str = (v: number) => String(Math.round(v * 100) / 100).replace('-', '−');
const sig = (z: number) => 1 / (1 + Math.exp(-z));
/** The activation is drawn neutral: σ, in teal, is the standard deviation here. */
const CURVE: Ink = 'slate';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Tick labels on the y axis. */
function yTicks(s: Scene, F: Frame, ys: number[]) {
  for (const y of ys) s.text(String(y), F.l - 2 * s.u, F.Y(y), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
}

/** Tick labels on the z axis. */
function zTicks(s: Scene, F: Frame, zs: number[]) {
  for (const z of zs) s.text(str(z), F.X(z), F.Y(0) + 3.6 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
}

/** Values on the sigmoid: a dot on the curve and a tick on the axis below it. */
function onCurve(s: Scene, F: Frame, zs: number[], a: number) {
  s.alpha(a, () =>
    zs.forEach((z) => {
      if (z < F.xr[0] || z > F.xr[1]) return;
      F.seg(z, 0, z, sig(z), 'orange', 0.25, [0.8, 0.8]);
      F.dot(z, sig(z), 'orange', 1.4);
    }),
  );
}

// ---- 1. Far out on the flat: the batch's z where the sigmoid has no slope

const flat: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = new Frame(s, 12 * u, s.h * 0.14, s.w - 6 * u, s.h * 0.72, [-6, 20], [-0.12, 1.12]);
    F.axes();
    yTicks(s, F, [0, 0.5, 1]);
    zTicks(s, F, [-5, 0, 5, 10, 15, 20]);
    s.text('z', F.r, F.Y(0) - 3.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
    const fl = s.ease('flat', 0.8);
    // The flat stretch, where the slope is nearly zero.
    s.alpha(fl * (1 - s.ease('name', 0.8)), () => {
      s.rrect(F.X(3), F.t, F.r - F.X(3), F.b - F.t, 0, { fill: s.tint('red', 0.08) });
      s.text('slope ≈ 0', F.X(11.5), F.Y(0.62), { size: 3.4, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    });
    F.fn(sig, CURVE, 0.7, -6, -6 + 26 * s.ease('unit', 1.6, 1));
    s.alpha(s.ease('unit', 0.6, 2), () => s.text('sigmoid', F.X(-3.2), F.Y(0.3), { size: 3.3, font: 'mono', weight: 600, color: s.c(CURVE), halo: true }));
    // The batch slides to center on 0, then squeezes by 5.
    const slide = after(s, 'name', 0.45, 1.2);
    const squeeze = after(s, 'name', 0.75, 1.2);
    const zs = X.map((v) => (v - MU * slide) / lerp(1, SD, squeeze));
    onCurve(s, F, zs, s.ease('batch', 0.6, 1.5));
    s.alpha(fl * (1 - s.ease('name', 0.6)), () => zs.forEach((z) => F.seg(z - 1.6, sig(z), z + 1.6, sig(z), 'red', 0.5)));
    s.alpha(squeeze, () => {
      s.rrect(F.X(-2), F.t, F.X(2) - F.X(-2), F.b - F.t, 0, { fill: s.tint('green', 0.08) });
      s.text('steep', F.X(0), F.t + 3.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    cite(s, 'Ioffe & Szegedy, 2015', s.win('paper', 'name'));
    const cy = s.h * 0.88;
    s.alpha(s.win('unit', 'batch'), () => caption(s, 'a = sigmoid(z): from 0 to 1', cy));
    s.alpha(s.win('batch', 'flat'), () => caption(s, 'z = 9, 3, 17, 11: all out on the flat', cy, 'orange', 3.4));
    s.alpha(s.win('flat', 'paper'), () => caption(s, 'slope ≈ 0: almost no gradient gets through', cy, 'red', 3.3));
    s.alpha(s.win('paper', 'name'), () => caption(s, 'batch normalization', cy, '--ink-2', 3.6));
    s.alpha(s.ease('name', 0.6) * (1 - after(s, 'name', 0.4, 0.4)), () => caption(s, 'normalize: mean 0, spread 1', cy, 'green', 3.6));
    s.alpha(slide * (1 - after(s, 'name', 0.72, 0.4)), () => caption(s, 'slide: subtract 10', cy, 'orange', 3.6));
    s.alpha(squeeze, () => caption(s, 'squeeze: divide by 5', cy, 'orange', 3.6));
  },
};

// ---- 2. Slide, then squeeze: the mean, the spread, and x hat

/** A second feature beside the first, so the batch has a column per feature. */
const BATCH = X.map((v, i) => [v, [4, 6, 2, 8][i]!]);

/** The batch as a matrix: a row per example, a column per feature, column 0 lit. */
function batch(s: Scene): void {
  const u = s.u;
  const cx = s.w / 2 + 6 * u;
  const cy = s.h * 0.48;
  const col = s.ease('column', 0.6);
  const M = matrix(s, cx, cy, BATCH.map((r) => r.map(str)), 'orange', { pw: 20, ph: 10.5, w: 14, h: 8.5, size: 3.6, on: (_, j) => (j === 0 ? col : 0) });
  const lab = { size: 3, font: 'mono', color: s.c('--ink-2') } as const;
  for (let j = 0; j < 2; j++) s.text(`feature ${j}`, M.x(j), M.y(0) - 9 * u, { ...lab, weight: j === 0 && col > 0.5 ? 650 : 500, color: s.c(j === 0 && col > 0.5 ? 'orange' : '--ink-2') });
  for (let i = 0; i < 4; i++) s.text(`example ${i}`, M.x(0) - 10.5 * u, M.y(i), { ...lab, align: 'right' });
  s.text('X', M.x(1) + 11 * u, cy, { size: 4.2, font: 'mono', weight: 650, color: s.c('orange') });
  s.alpha(col, () => s.rrect(M.x(0) - 8.5 * u, M.y(0) - 5.8 * u, 17 * u, M.y(3) - M.y(0) + 11.6 * u, 2, { stroke: s.c('orange'), lw: 0.5 }));
  s.alpha(after(s, 'column', 0.5), () => caption(s, 'feature 0 = column 0: one value per example', s.h * 0.9, 'orange', 3.4));
}

/** A number line from `lo` to `hi` across the stage at height y, with ticks every `step`. */
function axis(s: Scene, y: number, lo: number, hi: number, step: number): (v: number) => number {
  const l = 12 * s.u;
  const r = s.w - 10 * s.u;
  const X = (v: number) => l + ((v - lo) / (hi - lo)) * (r - l);
  s.line(l, y, r, y, s.c('--axis'), 0.35);
  for (let v = lo; v <= hi + 1e-9; v += step) {
    s.line(X(v), y - 1 * s.u, X(v), y + 1 * s.u, s.c('--axis'), 0.3);
    s.text(str(v), X(v), y + 4 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
  }
  return X;
}

/** A bracket from a to b at height y, with a label at its right end. */
function bracket(s: Scene, a: number, b: number, y: number, label: string) {
  const u = s.u;
  s.line(a, y, b, y, s.c('teal'), 0.4);
  s.line(a, y - 1.2 * u, a, y + 1.2 * u, s.c('teal'), 0.4);
  s.line(b, y - 1.2 * u, b, y + 1.2 * u, s.c('teal'), 0.4);
  s.text(label, b + 2 * u, y, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('teal'), halo: true });
}

const normalize: SceneDef = {
  marks: {
    f: { tex: String.raw`\hat{\symx} = \frac{\symx - \symmu}{\sqrt{\symsigma^2 + \symepstiny}}`, x: 0.5, y: 0.9, size: 6 },
  },
  draw(s) {
    const u = s.u;
    s.alpha(1 - s.ease('mean', 0.6), () => batch(s));
    const y1 = s.h * 0.36;
    const y2 = s.h * 0.7;
    const ln = s.ease('mean', 0.6);
    // The raw values on their own line, then the mean, the distances and the spread.
    s.alpha(ln, () => {
      const A = axis(s, y1, 0, 20, 5);
      s.text('x', 6 * u, y1, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
      X.forEach((v) => s.circle(A(v), y1, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 }));
      s.alpha(after(s, 'mean', 0.3), () => {
        s.line(A(MU), y1 - 13 * u, A(MU), y1 + 1.5 * u, s.c('orange'), 0.4, [1, 0.8]);
        s.text('μ = 10', A(MU), y1 - 15.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      });
      // Each value's distance from the mean, then its square.
      const dist = after(s, 'mean', 0.65);
      const sq = s.ease('var', 0.6, 1.5);
      X.forEach((v) => {
        const d = v - MU;
        const yd = y1 - (Math.abs(d) < 3 ? 8 : 5) * u;
        s.alpha(dist * (1 - s.ease('xhat', 0.6)), () => s.line(A(MU), yd + 1.5 * u, A(v), yd + 1.5 * u, s.tint('orange', 0.6), 0.3));
        s.alpha(dist * (1 - sq), () => s.text((d > 0 ? '+' : '') + str(d), A(v), yd - 1 * u, { size: 3, font: 'mono', weight: 600, color: s.c('orange'), halo: true }));
        s.alpha(sq * (1 - s.ease('xhat', 0.6)), () => s.text(String(d * d), A(v), yd - 1 * u, { size: 3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
      });
      s.alpha(s.ease('sigma', 0.6, 0.8), () => bracket(s, A(MU - SD), A(MU + SD), y1 + 10 * u, 'σ = 5'));
    });
    // The normalized values on a line of their own, each arrow from its raw value.
    const nA = s.ease('xhat', 0.6);
    s.alpha(nA, () => {
      const A = (v: number) => 12 * u + (v / 20) * (s.w - 22 * u);
      const Bx = axis(s, y2, -2, 2, 1);
      s.text('x̂', 6 * u, y2, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
      bracket(s, Bx(-1), Bx(1), y2 + 10 * u, 'σ → 1');
      XH.forEach((v, i) => {
        const a = i < 2 ? s.ease('xhat', 0.6, 1.5 + 1.3 * i) : after(s, 'xhat', 0.55);
        s.alpha(a, () => {
          s.arrow(A(X[i]!), y1 + 2.5 * u, Bx(v), y2 - 7.5 * u, s.tint('--ink-3', 0.7), 0.3, 1.8);
          s.circle(Bx(v), y2, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 });
          s.text(str(v), Bx(v), y2 - 4.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
        });
      });
    });
    s.show('f', s.ease('eps', 0.6));
    const cy = s.h * 0.9;
    const o = { size: 3.6 };
    s.alpha(s.win('mean', 'var') * (1 - after(s, 'mean', 0.65)), () => caption(s, '(9 + 3 + 17 + 11) / 4 = 10', cy, 'orange', 3.6));
    s.alpha(after(s, 'mean', 0.65) * (1 - s.ease('var', 0.6)), () => caption(s, 'x − μ: −1, −7, +7, +1', cy, 'orange', 3.6));
    s.alpha(s.win('var', 'sigma'), () => caption(s, '(1 + 49 + 49 + 1) / 4 = 25', cy, 'red', 3.6));
    s.alpha(s.win('sigma', 'xhat'), () => rich(s, [['σ', 'teal'], [' = √25 = 5: the standard deviation', '--ink-2']], s.w / 2, cy, { ...o, size: 3.3 }));
    s.alpha(s.win('xhat', 'eps') * (1 - after(s, 'xhat', 0.75)), () => caption(s, '(9 − 10) / 5 = −0.2,  (3 − 10) / 5 = −1.4', cy, 'orange', 3.3));
    s.alpha(after(s, 'xhat', 0.75) * (1 - s.ease('eps', 0.6)), () => caption(s, 'the same points on a new ruler: 0 at μ, 1 per σ', cy, '--ink-2', 3.2));
  },
};

// ---- 3. The steep middle is nearly straight, so γ and β move the values back out

const affine: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = new Frame(s, 12 * u, s.h * 0.08, s.w - 6 * u, s.h * 0.52, [-4.5, 4.5], [-0.12, 1.12]);
    F.axes();
    yTicks(s, F, [0, 1]);
    zTicks(s, F, [-4, -2, 0, 2, 4]);
    F.fn(sig, CURVE, 0.7);
    // Its tangent at 0: the middle is almost this straight line.
    s.alpha(s.win('middle', 'gamma'), () => {
      F.seg(-1.7, 0.5 - 1.7 / 4, 1.7, 0.5 + 1.7 / 4, '--ink-2', 0.45, [1.2, 0.9]);
      s.text('almost straight', F.X(1.9), F.Y(0.62), { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2'), halo: true });
    });
    const g = s.ease('gamma', 1, 1.2);
    const b = s.ease('beta', 1, 1);
    const un = s.ease('undo', 1.4, 1.5);
    const zs = XH.map((v, i) => lerp(lerp(1, G, g) * v + B * b, X[i]!, un));
    onCurve(s, F, zs, 1);
    s.alpha(s.ease('beta', 0.6, 1.5) * (1 - un), () => {
      s.text('out into the bends', F.X(-4.3), F.Y(0.75), { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('purple'), halo: true });
    });
    s.alpha(un, () => s.text('back to 9, 3, 17, 11 →', F.X(-4.3), F.Y(0.75), { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('orange'), halo: true }));
    // The numbers: x̂ above, y below, with the scale and shift between.
    const xs = columns(s, 4, s.tall ? 17 : 18);
    const lx = xs[0]! - 11 * u;
    const [ya, yb] = [s.h * 0.64, s.h * 0.81];
    const num = s.win('num', 'undo');
    s.alpha(s.ease('gamma', 0.6), () => {
      rowLabel(s, 'x̂', lx, ya, 'orange', 3.8);
      cells(s, xs, ya, XH.map(str), 'orange', { w: 13, h: 8.5, on: [num, 0, 0, 0] });
      const gy = (ya + yb) / 2;
      rich(s, [['× ', '--ink-3'], ['γ', 'purple'], [' + ', '--ink-3'], ['β', 'green']], xs[3]! + 9 * u, gy, { size: 3.6, weight: 650, align: 'left' });
    });
    s.alpha(s.ease('beta', 0.6, 0.6), () => {
      rowLabel(s, 'y', lx, yb, 'gold', 3.8);
      s.alpha(1 - un, () => cells(s, xs, yb, Y.map(str), 'gold', { w: 13, h: 8.5, on: [num, 0, 0, 0] }));
      s.alpha(un, () => cells(s, xs, yb, X.map(str), 'gold', { w: 13, h: 8.5, on: [1, 1, 1, 1] }));
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('middle', 'gamma'), () => caption(s, 'normalized: in the steep, nearly straight middle', cy, '--ink-2', 3.3));
    s.alpha(s.win('gamma', 'beta'), () => caption(s, 'γ = 2: stretch', cy, 'purple', 3.6));
    s.alpha(s.win('beta', 'num'), () => rich(s, [['y = ', 'gold'], ['γ', 'purple'], [' x̂ + ', '--ink-2'], ['β', 'green'], ['   (β = 1: slide)', '--ink-3']], s.w / 2, cy, { size: 3.6 }));
    s.alpha(num, () => caption(s, '2 × (−0.2) + 1 = 0.6', cy, 'gold', 3.8));
    s.alpha(s.ease('undo', 0.6), () => rich(s, [['γ', 'purple'], [' = σ = 5,  ', '--ink-2'], ['β', 'green'], [' = μ = 10: back to x', '--ink-2']], s.w / 2, cy, { size: 3.4 }));
  },
};

// ---- 4. Test time: running averages instead of the batch's own statistics

/** Batch means drawn around a true mean of 10, and the running average that tracks them from 0. */
const T = 40;
const MEANS = (() => {
  const rng = new Rng(3);
  return Array.from({ length: T }, () => 10 + 1.6 * rng.randn());
})();
const RUN = MEANS.reduce<number[]>((acc, m, i) => [...acc, (i ? acc[i - 1]! : 0) * 0.9 + 0.1 * m], []);

const test: SceneDef = {
  draw(s) {
    const u = s.u;
    // One test example alone: its own mean, and nothing left.
    const solo = 1 - s.ease('run', 0.6);
    s.alpha(solo, () => {
      const xs = columns(s, 3, s.tall ? 30 : 34);
      const y0 = s.h * 0.34;
      const lab = { size: 3.4, font: 'mono', weight: 650 } as const;
      s.text('test example', s.w / 2, y0 - 12 * u, { ...lab, color: s.c('--ink-2') });
      s.cell(s.w / 2 - 7 * u, y0 - 4.5 * u, 14 * u, 9 * u, '13', 'orange', { on: s.win('test', 'one') });
      s.text('x', s.w / 2 - 10 * u, y0, { ...lab, size: 3.8, align: 'right', color: s.c('orange') });
      const one = s.ease('one', 0.6, 0.6);
      const y1 = s.h * 0.62;
      const items: [string, string, Ink][] = [['μ', '13', 'orange'], ['x − μ', '0', 'red'], ['x̂', '0', 'red']];
      items.forEach(([k, v, c], i) =>
        s.alpha(one * after(s, 'one', 0.12 + 0.12 * i), () => {
          s.text(k, xs[i]!, y1 - 9 * u, { ...lab, color: s.c(c) });
          s.cell(xs[i]! - 6 * u, y1 - 4.25 * u, 12 * u, 8.5 * u, v, c, { on: i === 2 ? 1 : 0 });
        }),
      );
      s.alpha(after(s, 'one', 0.6), () => caption(s, 'a batch of one: every feature becomes 0', s.h * 0.82, 'red', 3.4));
    });
    // The batch means scatter; the running average climbs from 0 and settles near 10.
    s.alpha(s.ease('run', 0.6), () => {
      const F = new Frame(s, 14 * u, s.h * 0.1, s.w - 8 * u, s.h * 0.6, [0, T + 1], [0, 15]);
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
      s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
      for (const v of [0, 5, 10, 15]) s.text(String(v), F.l - 2 * u, F.Y(v), { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('batch', F.r, F.b + 4 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
      const n = Math.max(1, Math.round(T * Math.min(1, s.prog('run') * 1.15 + (s.since('settle') >= 0 ? 1 : 0))));
      s.alpha(s.ease('settle', 0.8), () => F.seg(0, 10, T + 1, 10, '--ink-3', 0.3, [1, 0.8]));
      for (let i = 0; i < n; i++) F.dot(i + 1, MEANS[i]!, 'orange', 0.9);
      F.clip(() => {
        const c = s.ctx;
        c.beginPath();
        c.moveTo(F.X(0), F.Y(0));
        for (let i = 0; i < n; i++) c.lineTo(F.X(i + 1), F.Y(RUN[i]!));
        c.strokeStyle = s.c('gold');
        c.lineWidth = 0.6 * u;
        c.stroke();
      });
      s.text('batch μ', F.X(4), F.Y(14), { size: 3.2, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      s.alpha(after(s, 'run', 0.4), () => s.text('running μ', F.X(7), F.Y(2.2), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold'), halo: true }));
      s.alpha(after(s, 'run', 0.55) * (1 - s.ease('settle', 0.6)), () => caption(s, 'each batch: 0.9 × running + 0.1 × its mean', s.h * 0.72, 'gold', 3.3));
      s.alpha(s.ease('settle', 0.6) * (1 - s.ease('apply', 0.6)), () => caption(s, 'it settles near the true mean, 10', s.h * 0.72, 'gold', 3.4));
    });
    s.alpha(s.ease('apply', 0.6), () => {
      const y = s.h * 0.72;
      s.text('test example: x = 13', s.w / 2, y, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
      s.alpha(after(s, 'apply', 0.4), () => s.text('(13 − running μ) / running σ = (13 − 10) / 5 = 0.6', s.w / 2, y + 7 * u, { size: s.tall ? 2.9 : 3.3, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
      s.alpha(after(s, 'apply', 0.8), () => caption(s, 'then γ and β, as in training', s.h * 0.92, '--ink-2', 3.4));
    });
  },
};

export const scenes: Record<string, SceneDef> = { flat, normalize, affine, test };
