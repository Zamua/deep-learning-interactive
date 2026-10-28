import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, columns, rowLabel } from '../../draw';
import { after, rich } from '../../networks/draw';
import { ball, curve, frame } from '../draw';

type Ink = Color | `--${string}`;

const S = [1.8, 1.1, 0];
const Y = 1;
const softmax = (s: number[]) => {
  const e = s.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const loss = (s: number[]) => -Math.log(softmax(s)[Y]!);
/** The slopes as measured and spoken, rounded. */
const G = [0.6, -0.7, 0.1];
const P = [0.6, 0.3, 0.1];
/** Nearly all the probability on the right answer: what `done` morphs the probabilities to. */
const DONE_P = [0.02, 0.97, 0.01];
/** How far the picture raises a nudged score: a 0.01 nudge would not show. */
const BUMP = 1;
const f1 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(Math.abs(v) < 0.1 ? 2 : 1)).replace('-', '−');

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

// ---- the two panels of the first scenes: score and probability bars on the left, the loss curve on the right

function layout(s: Scene) {
  const u = s.u;
  const split = s.w * 0.56;
  const lx0 = 15 * u;
  const gap = Math.min(14 * u, (split - lx0) / 3.2);
  const cx = (lx0 + split) / 2;
  const xs = [-1, 0, 1].map((k) => cx + k * gap);
  const F = frame(split + 9 * u, 11 * u, s.w - 5 * u, s.h * 0.66, [0, 1], [0, 3]);
  return { xs, gap, cx, ys: s.h * 0.31, yp: s.h * 0.66, yc: s.h * 0.81, F, rx: (split + s.w - 5 * u) / 2, lab: xs[0]! - gap / 2 - 2 * u };
}
type L = ReturnType<typeof layout>;

interface Look {
  /** Added to each score in the picture. */
  bump: number[];
  /** How lit each score bar is. */
  hi: number[];
  /** The right answer marked. */
  y: number;
  /** The curve drawn in, 0..1, and its dot. */
  curve: number;
  dot: number;
}

function bars(s: Scene, L: L, o: Look, a: { s: number; p: number }) {
  const u = s.u;
  const sv = S.map((v, i) => v + o.bump[i]!);
  const pv = softmax(sv);
  const bw = 9 * u;
  s.alpha(a.s, () => {
    s.line(L.xs[0]! - 7 * u, L.ys, L.xs[2]! + 7 * u, L.ys, s.c('--axis'), 0.35);
    rowLabel(s, 's', L.lab, L.ys - 6 * u, 'purple', 4);
    sv.forEach((v, i) => {
      const hh = Math.max(0.6 * u, v * 7 * u);
      const hi = o.hi[i]!;
      s.rrect(L.xs[i]! - bw / 2, L.ys - hh, bw, hh, 1, { fill: s.tint('purple', 0.22 + 0.25 * hi), stroke: s.tint('purple', 0.7 + 0.3 * hi), lw: 0.3 + 0.3 * hi });
      mono(s, v.toFixed(1), L.xs[i]!, L.ys - hh - 3 * u, 'purple');
    });
  });
  s.alpha(a.p, () => {
    mono(s, 'softmax ↓', L.cx, s.h * 0.39, '--ink-3', 3, 'center', 500);
    s.line(L.xs[0]! - 7 * u, L.yp, L.xs[2]! + 7 * u, L.yp, s.c('--axis'), 0.35);
    rowLabel(s, 'p', L.lab, L.yp - 6 * u, 'teal', 4);
    pv.forEach((v, i) => {
      const hh = Math.max(0.6 * u, v * 26 * u);
      const right = i === Y ? o.y : 0;
      s.rrect(L.xs[i]! - bw / 2, L.yp - hh, bw, hh, 1, { fill: s.tint('teal', 0.3), stroke: right > 0.5 ? s.c('gold') : s.tint('teal', 0.8), lw: 0.3 + 0.35 * right });
      mono(s, v.toFixed(2), L.xs[i]!, L.yp - hh - 3 * u, 'teal', 3.2);
      s.alpha(1 - right, () => mono(s, String(i), L.xs[i]!, L.yp + 4 * u, '--ink-3', 3.2, 'center', 500));
    });
    s.alpha(o.y, () => mono(s, '1 = y', L.xs[Y]!, L.yp + 4 * u, 'gold', 3.2, 'center', 650));
  });
  return pv;
}

function lossCurve(s: Scene, L: L, py: number, o: Look) {
  const u = s.u;
  const F = L.F;
  const axis = s.c('--axis');
  s.alpha(Math.min(1, o.curve * 3), () => {
    s.line(F.l, F.b, F.r, F.b, axis, 0.35);
    s.line(F.l, F.b, F.l, F.t, axis, 0.35);
    [0, 1, 2, 3].forEach((k) => mono(s, String(k), F.l - 2 * u, F.Y(k), '--ink-3', 3, 'right', 500));
    mono(s, '0', F.X(0), F.b + 3.6 * u, '--ink-3', 3, 'center', 500);
    mono(s, '1', F.X(1), F.b + 3.6 * u, '--ink-3', 3, 'center', 500);
    mono(s, 'p_y', F.X(0.5), F.b + 3.8 * u, 'teal', 3.2);
    mono(s, 'L', F.l, F.t - 3.6 * u, 'red', 3.6, 'center', 650);
    mono(s, '−ln p_y', F.r - 1 * u, F.t + 4 * u, 'red', 3.2, 'right');
  });
  curve(s, F, (p) => -Math.log(p), 0.05, 1, 'red', { width: 0.6, upto: o.curve });
  s.alpha(o.dot, () => {
    const L1 = -Math.log(py);
    s.line(F.X(py), F.b, F.X(py), F.Y(L1), s.tint('teal', 0.8), 0.3, [1, 1]);
    ball(s, F.X(py), F.Y(L1), 'red', 1.7);
  });
}

/** Two short lines of readout under the curve. */
function readout(s: Scene, L: L, a: number, top: string, bottom: string) {
  s.alpha(a, () => {
    mono(s, top, L.rx, s.h * 0.75, '--ink-2', 3.3);
    mono(s, bottom, L.rx, s.h * 0.81, 'red', 3.3, 'center', 650);
  });
}

const caption = (s: Scene, t: string, y: number, k: Ink = '--ink-2', size = 3.4) => mono(s, t, s.w / 2, y, k, size, 'center', 500);

/** An arrow beside score bar i: up, down, or both ways with a question mark. */
function moveArrow(s: Scene, L: L, i: number, dir: number, len: number) {
  const u = s.u;
  const x = L.xs[i]! + L.gap / 2;
  const y0 = L.ys - 7 * u;
  const col = s.c('purple');
  if (dir === 0) {
    s.arrow(x, y0, x, y0 - 5 * u, col, 0.4, 1.8);
    s.arrow(x, y0, x, y0 + 5 * u, col, 0.4, 1.8);
    mono(s, '?', x, y0 - 8.5 * u, 'purple', 3.4, 'center', 700);
  } else s.arrow(x, y0, x, y0 - dir * len * u, col, 0.6, 2.2);
}

const ask: SceneDef = {
  draw(s) {
    const L = layout(s);
    const o: Look = { bump: [0, 0, 0], hi: [0, 0, 0], y: s.ease('right', 0.6), curve: s.ease('loss', 1.4), dot: after(s, 'loss', 0.2) };
    const pv = bars(s, L, o, { s: s.ease('ask', 0.6), p: s.ease('ask', 0.6, 0.6) });
    lossCurve(s, L, pv[Y]!, o);
    s.alpha(after(s, 'loss', 0.3), () => mono(s, 'L ≈ 1.21', L.F.X(pv[Y]!) + 3 * s.u, L.F.Y(-Math.log(pv[Y]!)) - 0.5 * s.u, 'red', 3.3, 'left'));
    s.alpha(s.ease('ask', 0.6, 2.5), () => [0, 1, 2].forEach((i) => moveArrow(s, L, i, 0, 0)));
    const cy = s.h * 0.86;
    s.alpha(s.win('ask', 'scores'), () => caption(s, 'which way should each score move?', cy, 'purple'));
    s.alpha(s.win('scores', 'right'), () => caption(s, 'softmax: scores → probabilities', cy));
    s.alpha(s.win('right', 'loss'), () => caption(s, 'the right answer, y, got 0.30', cy, 'gold'));
    s.alpha(s.ease('loss', 0.6), () => caption(s, 'L = −ln p_y: lower p_y, higher L', cy, 'red'));
  },
};

const nudge: SceneDef = {
  draw(s) {
    const u = s.u;
    const L = layout(s);
    const up = (id: string, f: number) => s.ease(id, 0.9, 0.3) * (1 - after(s, id, f, 0.7));
    const bump = [up('up0', 0.96), up('right1', 0.55), up('last2', 0.45)].map((v) => v * BUMP);
    const hi = [s.win('up0', 'right1'), s.win('right1', 'last2'), s.win('last2', 'grad')];
    const o: Look = { bump, hi, y: 1, curve: 1, dot: 1 };
    const pv = bars(s, L, o, { s: 1, p: 1 });
    lossCurve(s, L, pv[Y]!, o);
    // What a nudge of 0.01 measures, under the curve.
    const L0 = loss(S);
    const Ls = [0, 1, 2].map((i) => loss(S.map((v, j) => v + (i === j ? 0.01 : 0))));
    const sh = [after(s, 'slope0', 0.75), after(s, 'right1', 0.85), after(s, 'last2', 0.75)];
    const ra = [after(s, 'slope0', 0.08) * (1 - s.ease('right1', 0.4)), after(s, 'right1', 0.6) * (1 - s.ease('last2', 0.4)), after(s, 'last2', 0.5) * (1 - s.ease('grad', 0.4))];
    const dLs = ['0.006', '−0.007', '0.001'];
    ra.forEach((a, i) => readout(s, L, a, `L: ${L0.toFixed(3)} → ${Ls[i]!.toFixed(3)}`, `${dLs[i]} / 0.01 = ${f1(G[i]!)}`));
    // The slopes, one cell per score, in a row that becomes the gradient.
    const named = after(s, 'grad', 0.62, 0.6);
    s.alpha(s.ease('plain', 0.6, 0.6), () => {
      s.alpha(1 - named, () => rowLabel(s, 'slope', L.lab, L.yc, 'red', 3.6));
      s.alpha(named, () => rowLabel(s, 'ds', L.lab, L.yc, 'red', 4));
      cells(s, L.xs, L.yc, G.map((v, i) => (sh[i]! > 0.5 ? f1(v) : '?')), 'red', { w: 11, h: 7.5, on: sh.map((v, i) => v * (1 - s.ease(['right1', 'last2', 'grad'][i]!, 0.6))) });
    });
    s.alpha(named, () => mono(s, '= ∂L/∂s', L.xs[2]! + 7 * u, L.yc, 'red', 3.6, 'left', 650));
    // Which way each score should go: against its slope.
    const rd = s.ease('read', 0.6, 1);
    s.alpha(rd, () => G.forEach((g, i) => moveArrow(s, L, i, -Math.sign(g), 3 + Math.abs(g) * 9)));
    const cy = s.h * 0.92;
    s.alpha(s.win('plain', 'up0'), () => caption(s, 'nudge one score, hold the others', cy));
    s.alpha(s.ease('read', 0.6) * (1 - after(s, 'read', 0.6)), () => caption(s, 'slope > 0: lower it    slope < 0: raise it', cy, '--ink-2', 3.2));
    s.alpha(after(s, 'read', 0.6), () => caption(s, 's₁ up; s₀ and s₂ down', cy, 'purple'));
  },
};

// ---- why: the loss as ln T minus the right score, split into its two parts

const why: SceneDef = {
  draw(s) {
    const u = s.u;
    const gap = 15 * u;
    const xs = [-1, 0, 1].map((k) => s.w / 2 + 4 * u + k * gap);
    const lab = xs[0]! - 9 * u;
    const ann = xs[2]! + 9 * u;
    const [yh, y1, y2, yr, y3] = [0.19, 0.3, 0.46, 0.54, 0.63].map((f) => s.h * f);
    const cmp = s.win('compare', 'why');
    // The formula, then the two parts it splits into.
    s.alpha(s.ease('why', 0.6), () => rich(s, [['L', 'red'], [' = ', '--ink-2'], ['ln T', 'slate'], [' − ', '--ink-2'], ['s_y', 'purple']], s.w / 2, s.h * 0.08, { size: 4.4, weight: 650 }));
    xs.forEach((x, i) => (i === Y ? mono(s, '1 = y', x, yh, 'gold', 3.2, 'center', 650) : mono(s, String(i), x, yh, '--ink-3', 3.2, 'center', 500)));
    rowLabel(s, 'p', lab, y1, 'teal', 4);
    cells(s, xs, y1, P.map((v) => v.toFixed(1)), 'teal', { w: 11, h: 7.5, on: [cmp, s.win('minus', 'why'), cmp] });
    // The minus one: at the right answer first, then the zeros beside it.
    const zero = s.ease('one', 0.6, 1);
    s.alpha(s.ease('minus', 0.6, 0.3), () => cells(s, [xs[Y]!], y2, ['−1'], 'gold', { w: 11, h: 7.5, on: [s.win('minus', 'why') + s.ease('one', 0.6)] }));
    s.alpha(zero, () => cells(s, [xs[0]!, xs[2]!], y2, ['0', '0'], 'gold', { w: 11, h: 7.5 }));
    s.alpha(s.ease('minus', 0.6, 0.3), () => rowLabel(s, '+', lab, y2, '--ink-3', 4));
    s.line(xs[0]! - 8 * u, yr, xs[2]! + 8 * u, yr, s.c('--ink-3'), 0.35);
    rowLabel(s, 'slope', lab, y3, 'red', 3.6);
    cells(s, xs, y3, G.map(f1), 'red', { w: 11, h: 7.5, on: [cmp, s.win('minus', 'why'), cmp] });
    s.alpha(s.ease('over', 0.6, 2), () => mono(s, 'from ln T', ann, y1, 'slate', 3.2, 'left'));
    s.alpha(zero, () => mono(s, 'from −s_y', ann, y2, 'purple', 3.2, 'left'));
    const c1 = s.h * 0.77;
    const c2 = s.h * 0.85;
    s.alpha(cmp * (1 - s.ease('minus', 0.4)), () => caption(s, 'wrong options: slope = p', c1, 'teal'));
    s.alpha(s.win('minus', 'why'), () => caption(s, '0.3 − 1 = −0.7', c1, 'gold', 3.8));
    s.alpha(s.win('why', 'share'), () => caption(s, 'T = e^s₀ + e^s₁ + e^s₂', c1, 'slate'));
    s.alpha(s.win('share', 'one'), () => caption(s, 'nudge sⱼ: T grows by e^sⱼ × nudge', c1, 'slate', 3.2));
    s.alpha(s.win('over', 'one'), () => caption(s, 'ln T grows by e^sⱼ/T × nudge = pⱼ × nudge', c2, 'teal', 3.1));
    s.alpha(s.ease('one', 0.6), () => caption(s, '−s_y: −1 per unit, and only at y', c1, 'purple', 3.2));
    s.alpha(s.ease('one', 0.6, 2.5), () => caption(s, 'slope = p, minus 1 at the right answer', c2, 'red', 3.2));
  },
};

// ---- p minus one-hot: the gradient as bars, and the step it asks for

const onehot: SceneDef = {
  marks: {
    g: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms} = \symp - \mathrm{onehot}(\symy)`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 24 : 22);
    const yp = s.h * 0.1;
    const yo = s.h * 0.24;
    const base = s.h * 0.58;
    const unit = s.h * 0.28;
    const done = s.ease('done', 1.4, 0.8);
    rowLabel(s, 'p', xs[0]! - 9 * u, yp, 'teal');
    cells(s, xs, yp, done > 0.5 ? DONE_P.map((v) => v.toFixed(2)) : P.map(f1), 'teal', { w: 12, h: 8, on: [0, s.win('collect', 'formula') + done, 0] });
    s.alpha(after(s, 'collect', 0.47, 0.6), () => {
      s.alpha(after(s, 'name', 0.1, 0.6), () => s.text('onehot(y)', xs[0]! - 7.5 * u, yo, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('gold') }));
      cells(s, xs, yo, ['0', '1', '0'], 'gold', { w: 12, h: 8, on: [0, s.win('name', 'sum') + done, 0] });
    });
    s.show('g', s.win('formula', 'sum'));
    const sub = s.ease('formula', 1, 1.5);
    const vals = P.map((p, i) => lerp(p - (i === Y ? sub : 0), DONE_P[i]! - (i === Y ? 1 : 0), done));
    const k = sub > 0.5 ? 'red' : 'teal';
    s.line(xs[0]! - 9 * u, base, xs[2]! + 9 * u, base, s.c('--axis'), 0.35);
    const bw = 10 * u;
    vals.forEach((v, i) => {
      const hh = v * unit;
      s.rrect(xs[i]! - bw / 2, Math.min(base, base - hh), bw, Math.max(Math.abs(hh), 0.5 * u), 1, { fill: s.tint(k, 0.4), stroke: s.tint(k, 0.9), lw: 0.3 });
      mono(s, f1(v), xs[i]!, v >= 0 ? base - hh - 3.4 * u : base - hh + 3.6 * u, k, 3.6);
      s.text(`s${i}`, xs[i]! - bw / 2 - 1.5 * u, base + (v >= 0 ? 3.2 : -3.2) * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('purple') });
    });
    s.alpha(sub, () => rowLabel(s, 'ds', xs[0]! - 11 * u, base, 'red', 3.8));
    s.alpha(1 - sub, () => rowLabel(s, 'p', xs[0]! - 11 * u, base, 'teal', 3.8));
    const cy = s.h * 0.92;
    s.alpha(s.win('collect', 'name') * after(s, 'collect', 0.47, 0.6), () => caption(s, 'a 1 at the right answer, 0 elsewhere', cy, 'gold'));
    s.alpha(s.win('name', 'formula') * after(s, 'name', 0.1, 0.6), () => caption(s, 'one-hot: one entry on, the rest off', cy, 'gold'));
    s.alpha(s.win('sum', 'step'), () => caption(s, '0.6 − 0.7 + 0.1 = 0', cy, '--ink-2', 3.8));
    s.alpha(s.win('step', 'done'), () => {
      vals.forEach((v, i) => {
        const x = xs[i]! + bw / 2 + 3.5 * u;
        const len = Math.max(3, Math.abs(v) * 20) * u;
        s.arrow(x, base, x, base + (v > 0 ? len : -len), s.c('purple'), 0.6, 2.2);
      });
      caption(s, 'move each score against its entry', cy, 'purple');
    });
    s.alpha(s.ease('done', 0.6, 0.8), () => caption(s, 'p[y] near 1: ds near 0', cy));
  },
};

export const scenes: Record<string, SceneDef> = { ask, nudge, why, onehot };
