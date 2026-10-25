import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, chip } from '../draw';

const SUB = '₀₁₂₃';

/** The unrolled chain: h nodes and step boxes, the inputs above and the loss over the last state. */
function chain(s: Scene) {
  const y = s.h * 0.42;
  return { y, bx: [-30, 0, 30].map((d) => s.w / 2 + d * s.u), hx: [-45, -15, 15, 45].map((d) => s.w / 2 + d * s.u), r: 4.6 * s.u };
}

const unroll: SceneDef = {
  draw(s) {
    const { y, bx, hx, r } = chain(s);
    const back = (i: number) => s.ease('back', 0.5, 0.4 + 0.9 * (2 - i));
    const sum = s.ease('sum', 0.6);
    hx.forEach((x, i) => {
      s.circle(x, y, r, { fill: s.tint('gold', 0.14), stroke: s.tint('gold', 0.75), lw: 0.35 });
      s.text(`h${SUB[i]}`, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('gold') });
    });
    bx.forEach((x, i) => {
      box(s, x, y, 'step', 'blue', { w: 11, h: 8, size: 2.9, on: sum });
      s.arrow(hx[i]! + r, y, x - 5.5 * s.u, y, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(x + 5.5 * s.u, y, hx[i + 1]! - r, y, s.c('--ink-3'), 0.35, 1.8);
      chip(s, x, y - 15 * s.u, `x${'₁₂₃'[i]}`, 'orange', { w: 8, h: 6.5, size: 3 });
      s.arrow(x, y - 11.75 * s.u, x, y - 4 * s.u, s.c('--ink-3'), 0.3, 1.6);
    });
    // The loss sits on the last state.
    s.circle(hx[3]!, y - 17 * s.u, r, { fill: s.tint('red', 0.16), stroke: s.tint('red', 0.8), lw: 0.35 });
    s.text('L', hx[3]!, y - 17 * s.u + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('red') });
    s.arrow(hx[3]!, y - r, hx[3]!, y - 17 * s.u + r, s.c('--ink-3'), 0.35, 1.6);
    s.alpha(s.ease('graph', 0.6, 2), () => s.text('one copy of the step per token, the same weights in each', s.w / 2, s.h * 0.12, { size: 3, color: s.c('--ink-3') }));
    // Backward: gradient arrows under the chain, from the loss toward h0.
    const yb = y + 9 * s.u;
    for (let i = 2; i >= 0; i--) {
      s.alpha(back(i), () => {
        s.arrow(hx[i + 1]! - 1 * s.u, yb, hx[i]! + 1 * s.u, yb, s.c('red'), 0.45, 2);
        s.alpha(s.ease('factor', 0.6, 0.3 * (2 - i)), () => s.text('× Whh·tanh′', bx[i]!, yb + 4.5 * s.u, { size: 2.6, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
      });
    }
    s.alpha(s.ease('back', 0.6, 3.4) * (1 - sum), () => s.text('backprop through time', s.w / 2, s.h * 0.78, { size: 3.4, color: s.c('red') }));
    s.alpha(sum, () => {
      const yt = s.h * 0.8;
      bx.forEach((x, i) => s.alpha(s.ease('sum', 0.5, 0.6 + 0.4 * i), () => s.arrow(x, yb + 7.5 * s.u, s.w / 2 + (x - s.w / 2) * 0.35, yt - 4 * s.u, s.c('blue'), 0.35, 1.8)));
      s.alpha(s.ease('sum', 0.6, 2.2), () => s.text('dWhh = step 1 + step 2 + step 3', s.w / 2, yt, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));
    });
  },
};

const products: SceneDef = {
  draw(s) {
    const L = s.w / 2 - 34 * s.u;
    const R = s.w / 2 + 40 * s.u;
    const T = s.h * 0.12;
    const B = s.h * 0.84;
    const X = (k: number) => L + ((R - L) * k) / 10;
    const Y = (lg: number) => B - ((B - T) * (lg + 3.3)) / 6.6;
    const ax = s.c('--axis');
    s.line(L, T, L, B, ax, 0.35);
    s.line(L, Y(0), R, Y(0), ax, 0.3, [1, 1]);
    s.line(L, B, R, B, ax, 0.35);
    const tick = { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') } as const;
    s.text('1000', L - 1.5 * s.u, Y(3), tick);
    s.text('1', L - 1.5 * s.u, Y(0), tick);
    s.text('0.001', L - 1.5 * s.u, Y(-3), tick);
    s.text('steps back', (L + R) / 2, B + 4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    s.text('0', L, B + 4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    s.text('10', R, B + 4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    const curve = (a: number, k: 'blue' | 'red', upto: number) => {
      const n = Math.max(0, Math.min(10, upto * 10));
      for (let i = 0; i < Math.floor(n); i++) s.line(X(i), Y(i * Math.log10(a)), X(i + 1), Y((i + 1) * Math.log10(a)), s.c(k), 0.55);
      for (let i = 0; i <= Math.floor(n); i++) s.circle(X(i), Y(i * Math.log10(a)), 0.9 * s.u, { fill: s.c(k) });
    };
    s.alpha(s.ease('scalar', 0.6), () => s.text('gradient (log scale)', L + 2 * s.u, T - 3 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') }));
    s.alpha(s.ease('scalar', 0.6, 3), () => s.text('a = 1: unchanged', X(10), Y(0) - 3 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('vanish', 0.4), () => {
      curve(0.5, 'blue', s.ease('vanish', 2.2, 0.4));
      s.alpha(s.ease('vanish', 0.6, 2.4), () => s.text('0.5¹⁰ ≈ 0.001', X(1), Y(-2.5), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true }));
    });
    s.alpha(s.ease('explode', 0.4), () => {
      curve(2, 'red', s.ease('explode', 2.2, 0.4));
      s.alpha(s.ease('explode', 0.6, 2.4), () => s.text('2¹⁰ = 1024', X(1), Y(2.5), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    });
  },
};

const clip: SceneDef = {
  draw(s) {
    const k = 11 * s.u;
    const ox = s.w / 2 - 22 * s.u;
    const oy = s.h * 0.82;
    const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
    s.line(ox - 6 * s.u, oy, ox + 48 * s.u, oy, s.c('--axis'), 0.3);
    s.line(ox, oy + 4 * s.u, ox, oy - 62 * s.u, s.c('--axis'), 0.3);
    // The threshold circle, radius c = 1.
    s.alpha(s.ease('clip', 0.6), () => {
      s.circle(ox, oy, k, { stroke: s.tint('green', 0.9), lw: 0.35, fill: s.tint('green', 0.08) });
      s.text('c = 1', ox - k - 1.5 * s.u, oy - 3 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('green') });
    });
    const shrink = s.ease('scale', 1.4, 0.6);
    const len = 5 - 4 * shrink;
    const [tx, ty] = P((3 * len) / 5, (4 * len) / 5);
    s.alpha(1 - 0.75 * shrink, () => {
      const [gx, gy] = P(3, 4);
      s.arrow(ox, oy, gx, gy, s.c('red'), 0.5, 2.6);
      s.text('g = [3, 4]', gx + 2 * s.u, gy, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      s.alpha(s.ease('check', 0.6, 1.5) * (1 - shrink), () => s.text('‖g‖ = 5 > c', P(1.5, 2)[0] + 3 * s.u, P(1.5, 2)[1] + 2 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true }));
    });
    s.alpha(shrink, () => {
      s.arrow(ox, oy, tx, ty, s.c('red'), 0.6, 2.2);
      s.alpha(s.ease('scale', 0.6, 2), () => s.text('[0.6, 0.8]', ox - 2 * s.u, oy - 14 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true }));
      s.alpha(s.ease('scale', 0.6, 2.6), () => s.text('× c / ‖g‖ = × 1/5', s.w / 2 + 6 * s.u, s.h * 0.2, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('limit', 0.6), () => {
      s.text('it only shrinks:', s.w / 2 + 22 * s.u, s.h * 0.5, { size: 3.2, color: s.c('--ink-2') });
      s.text('vanished stays vanished', s.w / 2 + 22 * s.u, s.h * 0.57, { size: 3.2, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { unroll, products, clip };
