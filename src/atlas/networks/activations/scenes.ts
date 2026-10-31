import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, cite } from '../../draw';
import { caption, Frame, rich } from '../draw';

const relu = (z: number) => Math.max(0, z);
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const tanh = Math.tanh;
const K: Record<'relu' | 'sig' | 'tanh', Color> = { relu: 'gold', sig: 'teal', tanh: 'purple' };

/** The plot box, leaving room for the captions below it. */
const box = (s: Scene, yr: [number, number]) => new Frame(s, 14 * s.u, s.h * 0.06, s.w - 8 * s.u, s.h * 0.84, [-4, 4], yr);

/** A labelled point on a curve. */
function mark(s: Scene, F: Frame, z: number, y: number, k: Color, label: string, dx: number, dy: number, align: CanvasTextAlign) {
  F.dot(z, y, k, 1.3);
  s.text(label, F.X(z) + dx * s.u, F.Y(y) + dy * s.u, { size: 3.3, font: 'mono', weight: 600, align, color: s.c(k), halo: true });
}

/** Tick labels on the y axis. */
function yTicks(s: Scene, F: Frame, ys: number[]) {
  for (const y of ys) s.text(String(y).replace('-', '−'), F.l - 2 * s.u, F.Y(y), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
}

const step = (z: number) => (z > 0 ? 1 : 0);
const STEP: Color = 'slate';

/** The step: off below zero, on above, with the jump marked by an open and a filled end. */
function stepCurve(s: Scene, F: Frame, k: Color, grow: number) {
  if (grow <= 0) return;
  F.seg(-4, 0, Math.min(0, -4 + 8 * grow), 0, k, 0.8);
  if (grow > 0.5) {
    F.seg(0, 1, -4 + 8 * grow, 1, k, 0.8);
    F.dot(0, 0, k, 0.9);
    s.circle(F.X(0), F.Y(1), 0.9 * s.u, { stroke: s.c(k), fill: s.c('--card'), lw: 0.35 });
  }
}

const shapes: SceneDef = {
  draw(s) {
    const F = box(s, [-1.4, 2.6]);
    F.axes();
    yTicks(s, F, [-1, 0, 1, 2]);
    s.text('z', F.r, F.Y(0) + 4 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
    // Each curve draws itself in on its beat; the older ones dim as the next arrives.
    s.alpha(1 - 0.65 * s.ease('sigmoid', 0.8), () => stepCurve(s, F, STEP, s.ease('step', 1.2)));
    s.alpha(s.win('stuck', 'sigmoid'), () => {
      const lab = { size: 3.4, font: 'mono', weight: 650, color: s.c('red'), halo: true } as const;
      s.text('slope 0', F.X(-2), F.Y(0) - 4 * s.u, lab);
      s.text('slope 0', F.X(2), F.Y(1) - 4 * s.u, lab);
    });
    s.alpha(1 - 0.6 * s.ease('tanh', 0.8), () => F.fn(sig, K.sig, 0.7, -4, -4 + 8 * s.ease('sigmoid', 1.2)));
    F.fn(tanh, K.tanh, 0.7, -4, -4 + 8 * s.ease('tanh', 1.2));
    s.alpha(s.win('sig-values', 'tanh'), () => {
      mark(s, F, 0, 0.5, K.sig, 'σ(0) = 0.5', -2.5, -2.5, 'right');
      mark(s, F, 2, sig(2), K.sig, 'σ(2) ≈ 0.88', 1.5, 4, 'left');
      mark(s, F, -2, sig(-2), K.sig, 'σ(−2) ≈ 0.12', 0, 6, 'center');
    });
    s.alpha(after(s, 'tanh', 0.55), () => {
      mark(s, F, 0, 0, K.tanh, 'tanh(0) = 0', 2, 4.5, 'left');
      mark(s, F, 1, tanh(1), K.tanh, 'tanh(1) ≈ 0.76', 2, 3.5, 'left');
    });
    cite(s, 'the perceptron · Rosenblatt, 1958', s.win('step', 'sigmoid'));
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.win('sigmoid', 'tanh'));
    cite(s, 'LeCun, Bottou, Orr & Müller, 1998', s.ease('tanh', 0.6));
    const cy = s.h * 0.93;
    s.alpha(s.win('bend', 'step'), () => caption(s, 'z → activation → what the neuron passes on', cy));
    s.alpha(s.win('step', 'sigmoid'), () => caption(s, 'step: 0 below zero, 1 above', cy, STEP));
    s.alpha(s.win('sigmoid', 'tanh'), () => caption(s, 'σ(−z) = 1 − σ(z)', cy, K.sig));
    s.alpha(s.ease('tanh', 0.6), () => caption(s, 'tanh(−z) = −tanh(z)', cy, K.tanh));
  },
};

const dsig = (z: number) => sig(z) * (1 - sig(z));
const dtanh = (z: number) => 1 - tanh(z) ** 2;

const slopes: SceneDef = {
  draw(s) {
    const F = box(s, [-0.12, 1.3]);
    F.axes();
    yTicks(s, F, [0, 0.25, 1]);
    s.text('z', F.r, F.Y(0) + 4 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
    const sat = s.ease('flat', 0.8);
    s.alpha(sat, () => {
      for (const [a, b] of [[-4, -2.5], [2.5, 4]] as const) s.rrect(F.X(a), F.t, F.X(b) - F.X(a), F.b - F.t, 0, { fill: s.tint('red', 0.08) });
      s.text('saturated', F.X(-3.25), F.Y(0.62), { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      s.text('saturated', F.X(3.25), F.Y(0.62), { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    F.fn(dsig, K.sig, 0.7, -4, -4 + 8 * s.ease('d-sig', 1.2));
    s.alpha(s.win('d-sig', 'nudge'), () => {
      F.dot(0, 0.25, K.sig, 1.3);
      s.text('0.5 × 0.5 = 0.25', F.X(0), F.Y(0.25) - 4.5 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c(K.sig), halo: true });
      F.dot(2, dsig(2), K.sig, 1.3);
      s.alpha(after(s, 'd-sig', 0.6), () => {
        F.seg(2, dsig(2) + 0.04, 2.3, 0.5, K.sig, 0.25);
        s.text('0.88 × 0.12 ≈ 0.1', F.X(2.3), F.Y(0.5) - 3 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c(K.sig), halo: true });
      });
    });
    F.fn(dtanh, K.tanh, 0.7, -4, -4 + 8 * s.ease('d-tanh', 1.2));
    const lab = { size: 3.3, font: 'mono', weight: 600, color: s.c(K.tanh), halo: true } as const;
    // Slopes measured by a nudge of 0.01, before the rule that predicts them.
    s.alpha(s.win('nudge', 'flat'), () => {
      F.dot(0, 1, K.tanh, 1.3);
      F.dot(1, dtanh(1), K.tanh, 1.3);
    });
    s.alpha(s.win('nudge', 'd-tanh'), () => {
      s.text('0.01 / 0.01 = 1', F.X(0) + 2 * s.u, F.Y(1) - 4 * s.u, { ...lab, align: 'left' });
      s.alpha(after(s, 'nudge', 0.55), () => s.text('0.0042 / 0.01 = 0.42', F.X(1) - 2.5 * s.u, F.Y(dtanh(1)), { ...lab, align: 'right' }));
      caption(s, 'slope ≈ Δtanh / Δz, for a nudge Δz = 0.01', s.h * 0.93, K.tanh, 3.4);
    });
    s.alpha(s.win('d-tanh', 'flat'), () => {
      s.text('1 − 0² = 1', F.X(0) + 2 * s.u, F.Y(1) - 4 * s.u, { ...lab, align: 'left' });
      s.text('1 − 0.76² ≈ 0.42', F.X(1) + 2 * s.u, F.Y(dtanh(1)) - 1 * s.u, { ...lab, align: 'left' });
    });
    const x = F.l + 3 * s.u;
    const o = { size: 3.3, align: 'left' as const, weight: 600 };
    s.alpha(s.ease('d-sig', 0.6), () => rich(s, [['σ′    ', K.sig], ['σ(1 − σ)', '--ink-2']], x, F.Y(1.22), o));
    s.alpha(s.ease('d-tanh', 0.6), () => rich(s, [['tanh′ ', K.tanh], ['1 − tanh²', '--ink-2']], x, F.Y(1.22) + 5 * s.u, o));
    s.alpha(sat, () => caption(s, 'flat curve, slope near 0, gradient near 0', s.h * 0.93, 'red', 3.4));
  },
};

const SIG_G = [1, 0.25, 0.0625, 0.0156, 0.0039, 0.001];
const fmtG = (g: number) => (g === 1 ? '1' : g >= 0.01 ? g.toFixed(g >= 0.1 ? 2 : 3).replace(/0+$/, '') : g.toFixed(3));

/** One row of the gradient's size, from the output on the right back through a chain of units. */
function row(s: Scene, y: number, gs: number[], k: Color, label: string, a: number, prog: number) {
  const n = gs.length;
  const gap = Math.min(16, (s.w / s.u - 24) / n);
  const x = (i: number) => s.w / 2 + (n - 1 - i - (n - 1) / 2) * gap * s.u + 5 * s.u;
  s.alpha(a, () => {
    s.text(label, x(n - 1) - 6 * s.u, y - 21 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
    s.line(x(n - 1) - 5 * s.u, y, x(0) + 5 * s.u, y, s.c('--axis'), 0.3);
    gs.forEach((g, i) => {
      const on = Math.min(1, Math.max(0, prog * n - i));
      if (on <= 0) return;
      s.alpha(on, () => {
        const hh = Math.max(0.4, g * 12) * s.u;
        s.rrect(x(i) - 3 * s.u, y - hh, 6 * s.u, hh, 0.6, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.3 });
        s.text(fmtG(g), x(i), y - hh - 3 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c(k), halo: true });
        if (i > 0) s.arrow(x(i - 1) - 4 * s.u, y + 4 * s.u, x(i) + 4 * s.u, y + 4 * s.u, s.c('--ink-3'), 0.3, 1.6);
      });
    });
    s.text('output', x(0), y + 8.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('unit 1', x(n - 1), y + 8.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
  });
}

const why: SceneDef = {
  draw(s) {
    const dead = s.ease('dead', 0.8);
    // The ReLU's own plot, while it is introduced and again for the ranges; the gradient rows the rest of the time.
    const plotA = Math.max(s.win('relu', 'whole'), s.win('ranges', 'dead'));
    s.alpha((1 - plotA) * (1 - 0.7 * dead), () => row(s, s.h * 0.3, SIG_G, 'teal', 'sigmoid: × 0.25 at best, per unit', 1, s.prog('chain') * 1.4));
    s.alpha((1 - plotA) * (1 - dead), () => row(s, s.h * 0.72, SIG_G.map(() => 1), 'gold', 'ReLU, on: × 1 per unit', s.ease('whole', 0.6), s.prog('whole') * 1.6));
    s.alpha(plotA, () => {
      const F = box(s, [-1.4, 2.6]);
      F.axes();
      yTicks(s, F, [-1, 0, 1, 2]);
      s.text('z', F.r, F.Y(0) + 4 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
      const ranges = s.ease('ranges', 0.6);
      s.alpha(ranges, () => {
        F.fn(sig, K.sig, 0.6);
        F.fn(tanh, K.tanh, 0.6);
        F.seg(-4, 1, 4, 1, '--ink-3', 0.3, [1, 1]);
        F.seg(-4, -1, 4, -1, '--ink-3', 0.3, [1, 1]);
        const x = F.l + 3 * s.u;
        const o = { size: 3.4, align: 'left' as const, weight: 600 };
        rich(s, [['ReLU  ', K.relu], ['[0, ∞)', '--ink-2']], x, F.Y(2.35), o);
        rich(s, [['σ     ', K.sig], ['(0, 1)', '--ink-2']], x, F.Y(2.35) + 5 * s.u, o);
        rich(s, [['tanh  ', K.tanh], ['(−1, 1)', '--ink-2']], x, F.Y(2.35) + 10 * s.u, o);
      });
      F.fn(relu, K.relu, 0.8, -4, -4 + 8 * s.ease('relu', 1.2));
      s.alpha(s.win('relu', 'd-relu'), () => {
        mark(s, F, 2, 2, K.relu, 'ReLU(2) = 2', -2.5, 0, 'right');
        mark(s, F, -2, 0, K.relu, 'ReLU(−2) = 0', 0, -4, 'center');
      });
      s.alpha(s.win('d-relu', 'whole'), () => {
        const lab = { size: 3.4, font: 'mono', weight: 650, color: s.c(K.relu), halo: true } as const;
        s.text('slope 1', F.X(1.9), F.Y(1.1), { ...lab, align: 'left' });
        s.text('slope 0', F.X(-2), F.Y(0) - 4 * s.u, lab);
      });
    });
    cite(s, 'Nair & Hinton, 2010 · Glorot, Bordes & Bengio, 2011', s.win('d-relu', 'whole'));
    cite(s, 'AlexNet · Krizhevsky, Sutskever & Hinton, 2012', s.win('whole', 'ranges'));
    const cy = s.h * 0.93;
    s.alpha(s.win('relu', 'd-relu'), () => caption(s, 'ReLU(z) = max(0, z)', cy, K.relu));
    s.alpha(s.win('d-relu', 'whole'), () => caption(s, 'slope: 1 if z > 0, else 0', cy, K.relu));
    s.alpha(dead, () => {
      const F = new Frame(s, s.w / 2 - 40 * s.u, s.h * 0.6, s.w / 2 + 40 * s.u, s.h * 0.86, [-4, 4], [-0.4, 3]);
      s.rrect(F.l - 2 * s.u, F.t - 3 * s.u, F.r - F.l + 4 * s.u, F.b - F.t + 9 * s.u, 1.5, { stroke: s.tint('red', 0.6), lw: 0.35 });
      F.axes();
      F.fn(relu, 'gold', 0.7);
      for (const z of [-3.6, -3.1, -2.7, -2.2, -1.9, -1.4, -0.9]) F.dot(z, 0, 'red', 1);
      s.text('z < 0 always: slope 0', F.l + 1 * s.u, F.Y(0) - 5 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true });
      s.text('no gradient to w', F.r, F.b + 2.5 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { shapes, slopes, why };
