import type { SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../backprop/draw';
import { rich } from '../draw';

const PI = [0.5, 0.3, 0.2];

// The 7 × 8 model: each answer's ∇ln π, and those rows weighted by π.
const ANS = ['56', '54', '64'];
const GL = ANS.map((_, y) => PI.map((p, i) => Math.round(((i === y ? 1 : 0) - p) * 10) / 10));
const WG = GL.map((row, y) => row.map((g) => Math.round(PI[y]! * g * 100) / 100));
const sgn = (v: number, d = 2) => (Math.abs(v) < 1e-9 ? '0' : v < 0 ? `−${(-v).toFixed(d)}` : v.toFixed(d));

const same: SceneDef = {
  marks: {
    recall: { tex: String.raw`\sym{A}{A} = \sym{R}{R} - \sym{b}{b}`, x: 0.5, y: 0.1, size: 5 },
    split: { tex: String.raw`(\sym{R}{R} - \sym{b}{b})\,\nabla\ln\sym{pi}{\pi} = \sym{R}{R}\,\nabla\ln\sym{pi}{\pi} - \sym{b}{b}\,\nabla\ln\sym{pi}{\pi}`, x: 0.5, y: 0.09, size: 4.2 },
    f: { tex: String.raw`\sum_y \sym{pi}{\pi}(y)\,\nabla\ln\sym{pi}{\pi}(y) = \sum_y \nabla\sym{pi}{\pi}(y) = \nabla 1 = 0`, x: 0.5, y: 0.1, size: 4.4 },
    g: { tex: String.raw`\mathbb{E}\big[(\sym{R}{R} - \sym{b}{b})\,\nabla\ln\sym{pi}{\pi}\big] = \mathbb{E}\big[\sym{R}{R}\,\nabla\ln\sym{pi}{\pi}\big]`, x: 0.5, y: 0.26, size: 4.4 },
  },
  draw(s) {
    const re = 1 - s.ease('sum', 0.5);
    s.show('recall', s.ease('recall', 0.6, 0.3) * re);
    // Four rewards and their advantages with b = 0.55.
    s.alpha(s.ease('recall', 0.6, 1.5) * re, () => {
      const xs = columns(s, 4, 15);
      const on = [after(s, 'recall', 0.45), 0, 0, 0];
      rowLabel(s, 'R', xs[0]! - 9 * s.u, s.h * 0.3, 'gold', 3.6);
      cells(s, xs, s.h * 0.3, ['0.9', '0.6', '0.5', '0.2'], 'gold', { w: 11, h: 7, on });
      xs.forEach((x) => s.text('− 0.55', x, s.h * 0.38, { size: 2.8, font: 'mono', color: s.c('green'), halo: true }));
      rowLabel(s, 'A', xs[0]! - 9 * s.u, s.h * 0.46, 'red', 3.6);
      cells(s, xs, s.h * 0.46, ['0.35', '0.05', '−0.05', '−0.35'], 'red', { w: 11, h: 7, on });
    });
    s.alpha(after(s, 'recall', 0.45) * re, () => rich(s, [['0.9 − 0.55 = ', '--ink-2'], ['0.35', 'green']], s.w / 2, s.h * 0.6, { size: 3.8, weight: 650 }));
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

// The worked problem: the third answer's slope, from the other two and the weighted sum of zero.
const G = [0.4, -1];
const W = [0.2, -0.3];
const P = String.raw`\sym{pi}{\pi}`;
const TH0 = String.raw`\sym{theta}{\theta}_0`;

const tryIt: SceneDef = {
  marks: {
    rule: { tex: String.raw`\sum_y ${P}(y)\,\dfrac{\partial \ln ${P}(y)}{\partial ${TH0}} = 0`, x: 0.5, y: 0.09, size: 4.2 },
  },
  draw(s) {
    const xs = columns(s, 3, 17);
    const lx = xs[0]! - 9 * s.u;
    const yP = s.h * 0.3;
    const yG = s.h * 0.45;
    const yW = s.h * 0.62;
    s.show('rule', s.ease('a1', 0.6));
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      xs.forEach((x, i) => s.text(`answer ${i}`, x, yP - 7 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
      rowLabel(s, 'π', lx, yP, 'teal', 3.6);
      cells(s, xs, yP, PI.map(String), 'teal', { w: 12, h: 7 });
    });
    s.alpha(s.ease('p1', 0.6, 4), () => {
      rowLabel(s, '∂ln π/∂θ₀', lx, yG, 'red', 3);
      const third = after(s, 'a2', 0.6);
      cells(s, xs, yG, ['0.4', '−1', third > 0.5 ? '0.5' : '?'], 'red', { w: 12, h: 7, on: [0, 0, third] });
    });
    s.alpha(after(s, 'a1', 0.2), () => {
      rowLabel(s, 'π · ∂ln π', lx, yW, 'green', 3);
      const w3 = after(s, 'a2', 0.1);
      cells(s, xs, yW, [...W.map((v) => (v < 0 ? `−${-v}` : String(v))), w3 > 0.5 ? '0.1' : '?'], 'green', { w: 12, h: 7, on: [0, 0, w3] });
      xs.slice(0, 2).forEach((x, i) => s.text(`${PI[i]} × ${G[i]! < 0 ? '−1' : G[i]}`, x, yW + 6.5 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.7) * (1 - after(s, 'a2', 0.1)), () => rich(s, [['0.2 − 0.3 = ', '--ink-2'], ['−0.1', 'green']], s.w / 2, s.h * 0.8, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'a2', 0.1), () => rich(s, [['third: +0.1,  0.1 / 0.2 = ', '--ink-2'], ['0.5', 'red']], s.w / 2, s.h * 0.8, { size: 3.4, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { same, try: tryIt };
