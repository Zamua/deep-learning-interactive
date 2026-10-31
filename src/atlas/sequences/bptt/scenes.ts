import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { box, chip } from '../draw';

const SUB = '₀₁₂₃';
const WORDS = ['dog', 'chases', 'cat'];

function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2', y = 0.88) {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * y, { size: s.tall ? 3.2 : 3.5, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

/** The unrolled chain: step boxes, memories between them, tokens above, the loss over the last memory. */
function chainAt(s: Scene) {
  const y = s.h * 0.48;
  return {
    y,
    bx: [-30, 0, 30].map((d) => s.w / 2 + d * s.u),
    hx: [-45, -15, 15, 45].map((d) => s.w / 2 + d * s.u),
    r: 4.6 * s.u,
    ty: y - 18 * s.u,
  };
}

function memory(s: Scene, x: number, y: number, r: number, sub: string, on = 0) {
  s.circle(x, y, r, { fill: s.tint('gold', 0.14 + 0.2 * on), stroke: s.tint('gold', 0.75 + 0.25 * on), lw: 0.35 });
  s.text(`h${sub}`, x, y + 0.2 * s.u, { size: sub.length > 1 ? 2.8 : 3.2, font: 'mono', weight: 650, color: s.c('gold') });
}

function loss(s: Scene, x: number, y: number, r: number) {
  s.circle(x, y, r, { fill: s.tint('red', 0.16), stroke: s.tint('red', 0.8), lw: 0.35 });
  s.text('L', x, y + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('red') });
}

/** An arrow from (x0, y0) to (x1, y1), stopping `r0` short of the start and `r1` short of the end. */
function link(s: Scene, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, k: Ink, lw = 0.35) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const [ux, uy] = [(x1 - x0) / d, (y1 - y0) / d];
  s.arrow(x0 + ux * r0, y0 + uy * r0, x1 - ux * r1, y1 - uy * r1, s.c(k), lw, 1.8);
}

/** The chain at unroll progress `u`: 0 is one step in a loop, 1 is three copies side by side. */
function chain(s: Scene, u: number, o: { on?: number } = {}) {
  const C = chainAt(s);
  const { y, r } = C;
  const xs = C.bx.map((x) => lerp(s.w / 2, x, u));
  // Each token feeds the step: one box at first, its own copy once unrolled.
  C.bx.forEach((x, i) => {
    chip(s, x, C.ty, WORDS[i]!, 'orange', { w: 12, h: 6.5, size: 2.9 });
    link(s, x, C.ty, xs[i]!, y, 3.25 * s.u, 4.6 * s.u, '--ink-3', 0.3);
  });
  xs.forEach((x, i) => s.alpha(i === 1 ? 1 : Math.min(1, u * 5), () => box(s, x, y, 'step', 'blue', { w: 11, h: 8, size: 2.9, on: o.on })));
  // The loop: the step's new memory fed back into it.
  const cx = s.w / 2;
  s.alpha(1 - Math.min(1, u * 2), () => {
    const k = s.c('gold');
    const [a, b, d] = [5.5 * s.u, 10 * s.u, 10 * s.u];
    s.line(cx + a, y, cx + b, y, k, 0.4);
    s.line(cx + b, y, cx + b, y + d, k, 0.4);
    s.line(cx + b, y + d, cx - b, y + d, k, 0.4);
    s.line(cx - b, y + d, cx - b, y, k, 0.4);
    s.arrow(cx - b, y, cx - a, y, k, 0.4, 1.8);
    s.text('h', cx, y + d + 3.5 * s.u, { size: 3.3, font: 'mono', weight: 650, color: k, halo: true });
  });
  // The memories between the copies.
  s.alpha(u, () => {
    C.hx.forEach((x, i) => memory(s, x, y, r, SUB[i]!));
    C.bx.forEach((x, i) => {
      s.arrow(C.hx[i]! + r, y, x - 5.5 * s.u, y, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(x + 5.5 * s.u, y, C.hx[i + 1]! - r, y, s.c('--ink-3'), 0.35, 1.8);
    });
  });
  return { ...C, xs };
}

/** The loss, beside the loop at first and over the last memory once unrolled. */
function lossAt(s: Scene, u: number, a: number) {
  const C = chainAt(s);
  const lx = lerp(s.w / 2 + 22 * s.u, C.hx[3]!, u);
  const ly = lerp(C.y, C.ty, u);
  const fx = lerp(s.w / 2 + 10 * s.u, C.hx[3]!, u);
  const fy = lerp(C.y, C.y - C.r, u);
  s.alpha(a, () => {
    link(s, fx, fy, lx, ly, 0, C.r, '--ink-3');
    loss(s, lx, ly, C.r);
  });
}

const unroll: SceneDef = {
  draw(s) {
    const u = s.ease('unroll', 1.6, 0.3);
    const C = chain(s, u);
    lossAt(s, u, s.ease('loss', 0.6, 0.4));
    // Backward: gradient arrows under the chain, from the loss toward h0.
    const yb = C.y + 9 * s.u;
    for (let i = 2; i >= 0; i--) {
      s.alpha(after(s, 'back', 0.08 + 0.12 * (2 - i), 0.6), () => {
        s.arrow(C.hx[i + 1]! - 1 * s.u, yb, C.hx[i]! + 1 * s.u, yb, s.c('red'), 0.45, 2);
        s.text(`step ${i + 1}`, C.bx[i]!, yb + 4.5 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      });
    }
    s.alpha(s.win('need', 'unroll'), () => s.text('?', s.w / 2, C.y - 7.5 * s.u, { size: 5, font: 'mono', weight: 700, color: s.c('red'), halo: true }));
    caption(s, 'one step, in a loop, same weights each time', s.win('loop', 'loss'), '--ink-2');
    caption(s, 'L: one number, how wrong the network was', s.win('loss', 'need'), 'red');
    caption(s, 'W_hh acts at every step: its gradient?', s.win('need', 'unroll'), 'blue');
    caption(s, 'unrolled: one copy of the step per token', s.win('unroll', 'back'));
    caption(s, 'backpropagation through time: BPTT', after(s, 'back', 0.5), 'red');
    s.alpha(s.ease('werbos', 0.6), () => caption(s, 'the derivatives: backwards in time', 1, '--ink-2', 0.94));
    cite(s, 'Werbos, 1990', s.ease('werbos', 0.6));
  },
};

const rules: SceneDef = {
  draw(s) {
    const zoom = 1 - s.ease('sum', 0.6);
    const y = s.h * 0.42;
    const hp = s.w / 2 - 36 * s.u;
    const ht = s.w / 2 + 36 * s.u;
    const r = 4.6 * s.u;
    const whh = s.ease('whh', 0.6);
    const tan = s.ease('tanh', 0.6);
    s.alpha(zoom, () => {
      // One step, opened up: the old memory times W_hh, plus the token, through the tanh.
      s.rrect(s.w / 2 - 25 * s.u, y - 10 * s.u, 50 * s.u, 20 * s.u, 1.6, { fill: s.tint('blue', 0.05), stroke: s.tint('blue', 0.5), lw: 0.35 });
      s.text('step t', s.w / 2 - 23 * s.u, y - 7.5 * s.u, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-3') });
      const c1 = s.w / 2 - 11 * s.u;
      const c2 = s.w / 2 + 11 * s.u;
      box(s, c1, y + 1 * s.u, '× W_hh', 'blue', { w: 15, h: 8, size: 2.8, on: whh * (1 - tan) });
      box(s, c2, y + 1 * s.u, 'tanh', 'purple', { w: 13, h: 8, size: 2.8, on: tan });
      chip(s, s.w / 2, y - 19 * s.u, 'x', 'orange', { w: 7, h: 6, size: 3 });
      s.arrow(s.w / 2, y - 16 * s.u, s.w / 2, y + 1 * s.u, s.c('--ink-3'), 0.3, 1.6);
      s.text('+', s.w / 2 + 1.8 * s.u, y + 4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      memory(s, hp, y, r, 'ₜ₋₁');
      memory(s, ht, y, r, 'ₜ', s.ease('factor', 0.6));
      s.arrow(hp + r, y + 1 * s.u, c1 - 7.5 * s.u, y + 1 * s.u, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(c1 + 7.5 * s.u, y + 1 * s.u, c2 - 6.5 * s.u, y + 1 * s.u, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(c2 + 6.5 * s.u, y + 1 * s.u, ht - r, y + 1 * s.u, s.c('--ink-3'), 0.35, 1.8);
      // The gradient arrives at h_t from above, then goes back to h_t-1, times the local slope.
      s.alpha(s.ease('factor', 0.6), () => {
        s.arrow(ht, y - 20 * s.u, ht, y - r - 0.8 * s.u, s.c('red'), 0.45, 2);
        s.text('gradient', ht, y - 22.5 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      });
      const yb = y + 15 * s.u;
      s.alpha(after(s, 'factor', 0.4, 0.8), () => {
        s.arrow(ht - 1 * s.u, yb, hp + 1 * s.u, yb, s.c('red'), 0.45, 2);
        s.text('× ∂hₜ/∂hₜ₋₁', s.w / 2, yb + 4.5 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      });
      const o = { size: s.tall ? 3.4 : 3.6, weight: 650 };
      s.alpha(whh, () => rich(s, [['∂hₜ/∂hₜ₋₁ = ', '--ink-2'], ['W_hh', 'blue'], [tan > 0.5 ? ' · ' : '', '--ink-2'], [tan > 0.5 ? 'tanh′' : '', 'purple']], s.w / 2, s.h * 0.84, o));
    });
    // W_hh at every step: one share of its gradient from each, added up.
    s.alpha(s.ease('sum', 0.6, 0.3), () => {
      const C = chain(s, 1, { on: s.ease('sum', 0.6, 0.8) });
      lossAt(s, 1, 1);
      const SH = ['3', '−1', '2'];
      const yt = s.h * 0.84;
      C.bx.forEach((x, i) => {
        s.alpha(after(s, 'sum', 0.3 + 0.12 * i), () => s.arrow(x, C.y + 5 * s.u, s.w / 2 + (x - s.w / 2) * 0.35, yt - 4.5 * s.u, s.c('blue'), 0.35, 1.8));
        s.alpha(s.ease('add', 0.5, 0.3 + 0.4 * i), () => s.text(SH[i]!, x + [-4, 3.5, 4][i]! * s.u, C.y + 11 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue'), halo: true }));
      });
      s.alpha(s.win('sum', 'add'), () => s.text('dW_hh = step 1 + step 2 + step 3', s.w / 2, yt, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));
      s.alpha(s.ease('add', 0.6, 1.2), () => s.text('dW_hh = 3 + (−1) + 2 = 4', s.w / 2, yt, { size: 3.5, font: 'mono', weight: 650, color: s.c('blue'), halo: true }));
    });
  },
};

const products: SceneDef = {
  draw(s) {
    const L = s.w / 2 - 34 * s.u;
    const R = s.w / 2 + 40 * s.u;
    const T = s.h * 0.14;
    const B = s.h * 0.78;
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
    s.text('gradient (log scale)', L + 2 * s.u, T - 3 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    s.alpha(after(s, 'scalar', 0.3), () => s.text('× a per step back', X(10), Y(0) - 3 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true }));
    // The one-step factor, in the corner the exploding curve later takes.
    s.alpha(s.ease('slope', 0.6) * (1 - s.ease('explode', 0.5)), () => {
      const o = { size: 3.2, font: 'mono', weight: 650, align: 'left', halo: true } as const;
      s.text('a = W_hh · tanh′', X(1), Y(2.7), { ...o, color: s.c('--ink-2') });
      s.alpha(after(s, 'slope', 0.55), () => s.text('  = 2 × 0.25 = 0.5', X(1), Y(2.7) + 5 * s.u, { ...o, color: s.c('blue') }));
    });
    s.alpha(s.ease('vanish', 0.4), () => {
      curve(0.5, 'blue', s.ease('vanish', 2.2, 0.4));
      s.alpha(after(s, 'vanish', 0.3), () => s.text('0.5¹⁰ ≈ 0.001: vanishes', X(1), Y(-2.5), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true }));
    });
    s.alpha(s.ease('explode', 0.4), () => {
      curve(2, 'red', s.ease('explode', 2.2, 0.4));
      s.alpha(after(s, 'explode', 0.5), () => s.text('2¹⁰ = 1024: explodes', X(1), Y(2.5), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    });
    caption(s, 'a¹⁰: ten factors of a', s.win('scalar', 'slope'), '--ink-2', 0.9);
    caption(s, 'like a deep stack of sigmoids', s.win('vanish', 'explode'), 'blue', 0.9);
    caption(s, 'a = 0.9, 100 steps: 0.9¹⁰⁰ ≈ 0.00003', s.ease('near', 0.6) * (1 - after(s, 'near', 0.65)), '--ink-2', 0.9);
    caption(s, 'only a = 1 keeps the size', after(s, 'near', 0.65) * (1 - s.ease('bengio', 0.6)), '--ink-2', 0.9);
    caption(s, 'the longer the span, the harder to learn', s.ease('bengio', 0.6), '--ink-2', 0.9);
    cite(s, 'Bengio, Simard & Frasconi, 1994', s.ease('bengio', 0.6));
  },
};

const clip: SceneDef = {
  draw(s) {
    const k = 11 * s.u;
    const ox = s.w / 2 - 22 * s.u;
    const oy = s.h * 0.8;
    const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
    s.alpha(s.ease('g', 0.6), () => {
      s.line(ox - 6 * s.u, oy, ox + 48 * s.u, oy, s.c('--axis'), 0.3);
      s.line(ox, oy + 4 * s.u, ox, oy - 58 * s.u, s.c('--axis'), 0.3);
    });
    // The threshold circle, radius c = 1.
    s.alpha(s.ease('c', 0.6), () => {
      s.circle(ox, oy, k, { stroke: s.tint('green', 0.9), lw: 0.35, fill: s.tint('green', 0.08) });
      s.text('c = 1', ox - k - 1.5 * s.u, oy - 3 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('green') });
    });
    const shrink = s.ease('scale', 1.4, 0.6);
    const len = 5 - 4 * shrink;
    const [tx, ty] = P((3 * len) / 5, (4 * len) / 5);
    const [gx, gy] = P(3, 4);
    s.alpha(s.ease('g', 0.6) * (1 - 0.75 * shrink), () => {
      s.arrow(ox, oy, gx, gy, s.c('red'), 0.5, 2.6);
      s.text('g = [3, 4]', gx + 2 * s.u, gy, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    });
    // Pythagoras: the legs, 3 across and 4 up.
    s.alpha(s.win('norm', 'scale'), () => {
      const [ax0, ay0] = P(3, 0);
      s.line(ox, oy, ax0, ay0, s.c('--ink-2'), 0.35, [1, 1]);
      s.line(ax0, ay0, gx, gy, s.c('--ink-2'), 0.35, [1, 1]);
      s.text('3', (ox + ax0) / 2, oy + 3.5 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true });
      s.text('4', ax0 + 3 * s.u, (ay0 + gy) / 2, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true });
    });
    const eq = { size: s.tall ? 3.3 : 3.5, font: 'mono', weight: 600, align: 'left', halo: true } as const;
    const ex = s.w / 2 + 2 * s.u;
    s.alpha(s.win('g', 'norm'), () => s.text('length: ‖g‖', ex, s.h * 0.2, { ...eq, color: s.c('--ink-2') }));
    s.alpha(s.win('norm', 'scale'), () => s.text('‖g‖ = √(3² + 4²) = 5', ex, s.h * 0.2, { ...eq, color: s.c('--ink-2') }));
    s.alpha(s.win('c', 'scale'), () => s.text('5 > c: too long', ex, s.h * 0.27, { ...eq, color: s.c('green') }));
    s.alpha(shrink, () => {
      s.arrow(ox, oy, tx, ty, s.c('red'), 0.6, 2.2);
      s.alpha(after(s, 'scale', 0.7), () => s.text('[0.6, 0.8]', ox - 2 * s.u, oy - 14 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true }));
      s.alpha(after(s, 'scale', 0.35), () => s.text('× c / ‖g‖ = × 1/5', ex, s.h * 0.2, { ...eq, color: s.c('--ink-2') }));
    });
    s.alpha(s.win('same', 'limit'), () => s.text('‖g‖ under c: unchanged', ex, s.h * 0.27, { ...eq, color: s.c('green') }));
    s.alpha(s.ease('limit', 0.6), () => s.text('it only ever shrinks', ex, s.h * 0.27, { ...eq, color: s.c('--ink-2') }));
    caption(s, 'clip the gradient by its norm', s.win('fix', 'g'), '--ink-2', 0.5);
    cite(s, 'Pascanu, Mikolov & Bengio, 2013', s.win('fix', 'norm'));
  },
};

export const scenes: Record<string, SceneDef> = { unroll, rules, products, clip };
