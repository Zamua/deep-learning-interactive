import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, chip, fmt, grid, matrix, stack } from '../draw';

const H0 = [0.5, -0.5];
const X = [1, 0];
const WHH = [
  [1, 0],
  [0, 2],
];
const WXH = [
  [1, 2],
  [0, 1],
];
const B = [-0.5, 0.5];
const MEM = WHH.map((r) => r[0]! * H0[0]! + r[1]! * H0[1]!);
const INP = WXH.map((r) => r[0]! * X[0]! + r[1]! * X[1]!);
const A = MEM.map((v, i) => v + INP[i]! + B[i]!);
const HT = A.map(Math.tanh);
const lab = (xs: number[], p?: number) => xs.map((v) => fmt(v, p));

/** One matrix-vector product as a row: label, matrix, vector, "=", result. */
function product(s: Scene, y: number, name: string, M: number[][], v: number[], vk: 'gold' | 'orange', vName: string, res: number[], o: { a: number; on: number; res: number }): void {
  s.alpha(o.a, () => {
    const g = grid(s, s.w / 2 - 22 * s.u, y, 2, 2, 12, 9);
    s.text(name, g.l - 3 * s.u, y, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
    matrix(s, g, M.map((r) => lab(r)), 'blue', { w: 10.5, h: 7.5, size: 3.2, on: () => o.on });
    stack(s, s.w / 2 + 2 * s.u, y, lab(v), vk, { gap: 9, on: v.map(() => o.on) });
    s.text(vName, s.w / 2 + 2 * s.u, y - 10.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(vk) });
    s.alpha(o.res, () => {
      s.text('=', s.w / 2 + 12 * s.u, y, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
      stack(s, s.w / 2 + 23 * s.u, y, lab(res), 'blue', { gap: 9, on: res.map(() => o.on) });
    });
  });
}

const step: SceneDef = {
  marks: {
    f: { tex: String.raw`\symh_t = \tanh(\symWhh\symh_{t-1} + \symWxh\symx_t + \symb)`, x: 0.5, y: 0.08, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('tanh', 0.6, 5));
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.53;
    // Before the products: just the memory and the token, side by side.
    const pre = 1 - s.ease('mem', 0.5);
    s.alpha(pre, () => {
      const xs = [s.w / 2 - 14 * s.u, s.w / 2 + 14 * s.u];
      stack(s, xs[0]!, s.h * 0.42, lab(H0), 'gold', { gap: 9, on: [s.win('carry', 'inputs'), s.win('carry', 'inputs')] });
      s.text('hₜ₋₁', xs[0]!, s.h * 0.42 - 10.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
      s.alpha(s.ease('inputs', 0.6, 1.5), () => {
        stack(s, xs[1]!, s.h * 0.42, lab(X), 'orange', { gap: 9 });
        s.text('xₜ', xs[1]!, s.h * 0.42 - 10.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
        s.text('memory', xs[0]!, s.h * 0.42 + 11 * s.u, { size: 3, color: s.c('--ink-3') });
        s.text('this token', xs[1]!, s.h * 0.42 + 11 * s.u, { size: 3, color: s.c('--ink-3') });
      });
    });
    product(s, y1, 'Whh', WHH, H0, 'gold', 'hₜ₋₁', MEM, { a: s.ease('mem', 0.6), on: s.win('mem', 'inp'), res: s.ease('mem', 0.6, 1.5) });
    product(s, y2, 'Wxh', WXH, X, 'orange', 'xₜ', INP, { a: s.ease('inp', 0.6), on: s.win('inp', 'sum'), res: s.ease('inp', 0.6, 1.2) });
    // The sum line: Whh h + Wxh x + b = a, then tanh.
    const ys = s.h * 0.82;
    const at = (dx: number) => s.w / 2 + dx * s.u;
    const top = ys - 10.5 * s.u;
    const name = (t: string, dx: number, k: 'blue' | 'green' | '--ink-2' | 'gold') => s.text(t, at(dx), top, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
    const op = (t: string, dx: number) => s.text(t, at(dx), ys, { size: 4.2, font: 'mono', color: s.c('--ink-3') });
    s.alpha(s.ease('sum', 0.6), () => {
      stack(s, at(-42), ys, lab(MEM), 'blue', { gap: 9 });
      name('Whh h', -42, 'blue');
      op('+', -33);
      stack(s, at(-24), ys, lab(INP), 'blue', { gap: 9 });
      name('Wxh x', -24, 'blue');
      op('+', -15);
      stack(s, at(-6), ys, lab(B), 'green', { gap: 9, on: [s.win('sum', 'tanh'), s.win('sum', 'tanh')] });
      name('b', -6, 'green');
    });
    s.alpha(s.ease('sum', 0.6, 2.5), () => {
      op('=', 4);
      stack(s, at(14), ys, lab(A), '--ink-2', { gap: 9 });
      name('z', 14, '--ink-2');
    });
    s.alpha(s.ease('tanh', 0.6), () => {
      s.arrow(at(21), ys, at(32), ys, s.c('--ink-3'), 0.4, 2);
      s.text('tanh', at(26.5), ys - 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('tanh', 0.6, 1.2), () => {
      stack(s, at(41), ys, lab(HT, 2), 'gold', { gap: 9, on: [1, 1] });
      name('hₜ', 41, 'gold');
    });
  },
};

const TOK = ['x₁', 'x₂', 'x₃'];

const unroll: SceneDef = {
  draw(s) {
    const y = s.h * 0.42;
    const bx = [-30, 0, 30].map((d) => s.w / 2 + d * s.u);
    const hx = [-45, -15, 15, 45].map((d) => s.w / 2 + d * s.u);
    const r = 4.6 * s.u;
    const shown = (i: number) => (i === 0 ? 1 : s.ease('unroll', 0.5, 1.2 + 1.3 * (i - 1)));
    const mem = s.win('memory', 'shapes');
    const same = s.win('same', 'memory');
    hx.forEach((x, i) =>
      s.alpha(shown(i), () => {
        s.circle(x, y, r, { fill: s.tint('gold', 0.14 + 0.25 * mem), stroke: s.tint('gold', 0.7 + 0.3 * mem), lw: 0.35 });
        s.text(`h${'₀₁₂₃'[i]}`, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('gold') });
      }),
    );
    s.alpha(s.ease('unroll', 0.4, 0.3), () => s.text('zeros', hx[0]!, y - r - 3 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    bx.forEach((x, i) =>
      s.alpha(shown(i + 1), () => {
        box(s, x, y, 'tanh', 'blue', { w: 11, h: 8, size: 3, on: same });
        s.arrow(hx[i]! + r, y, x - 5.5 * s.u, y, s.c(mem > 0.1 ? 'gold' : '--ink-3'), 0.35 + 0.2 * mem, 1.8);
        s.arrow(x + 5.5 * s.u, y, hx[i + 1]! - r, y, s.c(mem > 0.1 ? 'gold' : '--ink-3'), 0.35 + 0.2 * mem, 1.8);
        chip(s, x, s.h * 0.64, TOK[i]!, 'orange', { w: 8, h: 6.5, size: 3 });
        s.arrow(x, s.h * 0.64 - 3.25 * s.u, x, y + 4 * s.u, s.c('--ink-3'), 0.35, 1.8);
      }),
    );
    s.alpha(same, () => bx.forEach((x) => s.text('Whh Wxh b', x, y - 9 * s.u, { size: 2.7, font: 'mono', weight: 600, color: s.c('blue') })));
    s.alpha(s.ease('same', 0.6, 2.5) * (1 - s.ease('memory', 0.5)), () => s.text('the same weights at every step', s.w / 2, s.h * 0.82, { size: 3.4, color: s.c('blue') }));
    s.alpha(mem, () => s.text('only h passes from step to step: H numbers', s.w / 2, s.h * 0.82, { size: 3.4, color: s.c('gold') }));
    s.alpha(s.ease('shapes', 0.6), () => {
      const o = { size: 3.4, font: 'mono', weight: 600 } as const;
      const xs = [-34, 0, 32].map((d) => s.w / 2 + d * s.u);
      s.text('Whh: (H, H)', xs[0]!, s.h * 0.8, { ...o, color: s.c('blue') });
      s.text('Wxh: (H, D)', xs[1]!, s.h * 0.8, { ...o, color: s.c('blue') });
      s.text('b: (H,)', xs[2]!, s.h * 0.8, { ...o, color: s.c('green') });
      s.text('h: H numbers, x: D numbers', s.w / 2, s.h * 0.9, { size: 3.2, color: s.c('--ink-3') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { step, unroll };
