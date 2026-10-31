import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { caption, Frame, rich } from '../draw';

const red = (s: Scene, t: string, x: number, y: number, size = 3.3, align: CanvasTextAlign = 'center') =>
  s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c('red'), halo: true });

// ---- the plain stack: the gradient walks back through ten layers, halving at each

const N = 10;

/** Where the stack's input, layers and output sit, on one row. */
function stackRow(s: Scene) {
  const r = 3.4 * s.u;
  const xN = 5 * s.u + r;
  const oN = s.w - 5 * s.u - r;
  const l = xN + r + 3 * s.u;
  const rt = oN - r - 3 * s.u;
  const pitch = (rt - l) / N;
  return { r, xN, oN, pitch, layer: (i: number) => l + (i + 0.5) * pitch };
}

function plainStack(s: Scene, y: number) {
  const R = stackRow(s);
  const ink = s.c('--ink-3');
  const bw = Math.min(R.pitch * 0.62, 6 * s.u);
  s.circle(R.xN, y, R.r, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.4 });
  s.text('x', R.xN, y, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
  for (let i = 0; i < N; i++) {
    const a = after(s, 'stack', 0.05 + i * 0.04);
    s.alpha(a, () => s.rrect(R.layer(i) - bw / 2, y - 5 * s.u, bw, 10 * s.u, 0.8, { fill: s.tint('blue', 0.14), stroke: s.c('blue'), lw: 0.35 }));
  }
  s.arrow(R.xN + R.r, y, R.layer(0) - bw / 2 - 0.4 * s.u, y, ink, 0.3, 1.6);
  s.arrow(R.layer(N - 1) + bw / 2, y, R.oN - R.r - 0.4 * s.u, y, ink, 0.3, 1.6);
  s.circle(R.oN, y, R.r, { fill: s.tint('green', 0.2), stroke: s.c('green'), lw: 0.4 });
  s.text('out', R.oN, y, { size: 2.8, font: 'mono', weight: 650, color: s.c('green') });
  s.text('10 layers', (R.layer(0) + R.layer(N - 1)) / 2, y - 8.5 * s.u, { size: 3.2, font: 'mono', color: s.c('blue') });
  return R;
}

/** The gradient's size under the output and each layer: `vals[0]` at the output, then layer 10 back to layer 1. */
function gradBars(s: Scene, R: ReturnType<typeof stackRow>, base: number, vals: number[], grow: number, labels: Record<number, string>, k: Ink = 'red') {
  const xs = [R.oN, ...Array.from({ length: N }, (_, j) => R.layer(N - 1 - j))];
  const bw = Math.min(R.pitch * 0.5, 5 * s.u);
  const hMax = 18 * s.u;
  xs.forEach((x, i) => {
    const on = Math.min(1, Math.max(0, grow * (N + 1) - i));
    if (on <= 0) return;
    s.alpha(on, () => {
      const hh = Math.max(0.35 * s.u, vals[i]! * hMax);
      s.rrect(x - bw / 2, base - hh, bw, hh, 0.5, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.25 });
      const t = labels[i];
      if (t) red(s, t, x, base - hh - 3 * s.u, 3);
    });
  });
}

const HALF = Array.from({ length: N + 1 }, (_, i) => 0.5 ** i);
/** Healthy gradients, as careful starting weights and rescaling give a stack tens of layers deep. */
const KEPT = [1, 0.95, 0.9, 0.93, 0.86, 0.9, 0.84, 0.88, 0.82, 0.85, 0.8];

/** Training error falling with training time: a sketch of the shape He et al. report, not their numbers. */
const curve = (floor: number, start: number, tau: number) => (t: number) => floor + (start - floor) * Math.exp(-t / tau);
const SHALLOW = curve(0.1, 0.9, 0.22);
const DEEP = curve(0.24, 0.9, 0.3);

function errorChart(s: Scene, a: number, grow: number) {
  const top = s.h * 0.14;
  const F = new Frame(s, 16 * s.u, top, s.w - 10 * s.u, s.h * 0.66, [0, 1], [0, 1]);
  s.alpha(a, () => {
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.3);
    s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.3);
    s.text('training time →', F.r, F.b + 4 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('wrong on', F.l - 2 * s.u, F.t + 2 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('training', F.l - 2 * s.u, F.t + 5.5 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('data', F.l - 2 * s.u, F.t + 9 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    F.fn(SHALLOW, 'blue', 0.7, 0, Math.max(0.001, grow));
    F.fn(DEEP, 'red', 0.7, 0, Math.max(0.001, grow));
    s.alpha(Math.min(1, Math.max(0, (grow - 0.6) / 0.15)), () => {
      s.text('56 layers', F.X(0.6), F.Y(DEEP(0.6)) - 4 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
      s.text('20 layers', F.X(0.5), F.Y(SHALLOW(0.5)) + 4.5 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('blue'), halo: true });
    });
  });
}

/** Two rows of thin layers: 20, and 56 made of the same 20 plus 36 that pass x along. */
function copyRows(s: Scene, a: number, gray: number) {
  const l = 8 * s.u;
  const r = s.w - 8 * s.u;
  const pitch = (r - l) / 56;
  const sw = Math.max(0.6 * s.u, pitch * 0.62);
  const rows: [number, number, string][] = [[s.h * 0.24, 20, '20 layers'], [s.h * 0.5, 56, '56 layers']];
  s.alpha(a, () => {
    for (const [y, n, name] of rows) {
      s.text(name, l, y - 9 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
      for (let i = 0; i < n; i++) {
        const copy = i >= 20;
        const fill = copy ? s.tint('slate', 0.12 + 0.2 * gray) : s.tint('blue', 0.16);
        const stroke = copy ? s.tint('slate', 0.5 + 0.4 * gray) : s.c('blue');
        s.rrect(l + i * pitch + (pitch - sw) / 2, y - 5 * s.u, sw, 10 * s.u, 0.3, { fill, stroke, lw: 0.2 });
      }
    }
    const y = s.h * 0.5 + 8 * s.u;
    const brace = (x0: number, x1: number, t: string, k: Ink, al: number) =>
      s.alpha(al, () => {
        s.line(x0, y, x1, y, s.c(k), 0.35);
        s.line(x0, y - 1.2 * s.u, x0, y, s.c(k), 0.35);
        s.line(x1, y - 1.2 * s.u, x1, y, s.c(k), 0.35);
        s.text(t, (x0 + x1) / 2, y + 4 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c(k), halo: true });
      });
    brace(l, l + 20 * pitch, 'the same 20', 'blue', gray);
    brace(l + 20 * pitch, r, '36 that pass x along', 'slate', gray);
  });
}

const deep: SceneDef = {
  draw(s) {
    const yS = s.h * 0.2;
    const base = s.h * 0.62;
    const stackA = 1 - s.ease('worse', 0.6);
    s.alpha(stackA, () => {
      const R = plainStack(s, yS);
      // The walk back, from the output toward x.
      s.alpha(s.ease('train', 0.6, 1.2) * (1 - 0.6 * s.ease('fade', 0.5)), () => {
        s.arrow(R.oN, yS + 8 * s.u, R.xN, yS + 8 * s.u, s.tint('red', 0.8), 0.45, 2);
        red(s, 'backprop', (R.xN + R.oN) / 2, yS + 11.5 * s.u, 3);
      });
      s.alpha(after(s, 'train', 0.75), () => red(s, 'g = 1', R.oN, yS - 7 * s.u, 3.2, 'right'));
      const kept = s.ease('deeper', 1.2, 0.6);
      s.alpha(1 - kept, () => gradBars(s, R, base, HALF, s.prog('fade') * 1.3, { 0: '1', 1: '0.5', 2: '0.25', 10: '0.001' }));
      s.alpha(kept, () => gradBars(s, R, base, KEPT, 1, {}, 'green'));
      s.alpha(s.win('fade', 'deeper'), () => s.text('first layers: almost no gradient', R.layer(2), base + 5 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
    });
    errorChart(s, s.win('worse', 'copy'), s.prog('worse') * 1.25);
    copyRows(s, s.ease('copy', 0.6), after(s, 'copy', 0.25));
    cite(s, 'He, Zhang, Ren & Sun, 2015', s.ease('deeper', 0.6, 3));
    const cy = s.h * 0.92;
    s.alpha(s.win('stack', 'train'), () => caption(s, 'x → layer → layer → … → output', cy));
    s.alpha(s.win('train', 'fade'), () => caption(s, 'gradient steps: each weight moves against g', cy, 'red', 3.3));
    s.alpha(s.win('fade', 'deeper'), () => caption(s, '× 0.5 at each of 10 layers: ≈ 0.001', cy, 'red'));
    s.alpha(s.win('deeper', 'worse'), () => caption(s, 'tens of layers deep: trainable', cy, 'green'));
    s.alpha(s.win('worse', 'copy'), () => caption(s, '56 layers: worse even on its training data', cy, 'red', 3.3));
    s.alpha(s.ease('copy', 0.6), () => caption(s, '56 could copy 20, but training never found it', cy, '--ink-2', 3.2));
  },
};

// ---- one residual block: the layers F, a shortcut around them, and the sum

/** The block diagram: x, the box F, the sum and y on one row, with the shortcut arching above. */
function diagram(s: Scene, o: { yD: number; cut: number; out?: number; dim?: number; red?: { cut: number; box: number } }) {
  const xN = s.w * 0.1;
  const b0 = s.w * 0.26;
  const b1 = s.w * 0.56;
  const pN = s.w * 0.7;
  const yN = s.w * 0.87;
  const r = 4 * s.u;
  const top = o.yD - 15 * s.u;
  const ink = s.c('--ink-3');
  const out = o.out ?? 1;
  s.alpha(1 - (o.dim ?? 0) * 0.5, () => {
    s.circle(xN, o.yD, r, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.4 });
    s.text('x', xN, o.yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('orange') });
    s.arrow(xN + r, o.yD, b0 - 0.6 * s.u, o.yD, ink, 0.35, 2);
    s.rrect(b0, o.yD - 7 * s.u, b1 - b0, 14 * s.u, 1.6, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
    s.text('F(x)', (b0 + b1) / 2, o.yD - 1.8 * s.u, { size: 4.2, font: 'mono', weight: 650, color: s.c('blue') });
    s.text('layer, ReLU, layer', (b0 + b1) / 2, o.yD + 3.6 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-2') });
    s.alpha(1 - o.cut, () => s.arrow(b1, o.yD, pN - 0.6 * s.u, o.yD, ink, 0.35, 2));
    s.alpha(o.cut, () => {
      s.arrow(b1, o.yD, pN - r, o.yD, ink, 0.35, 2);
      s.line(xN, o.yD - r, xN, top, s.c('orange'), 0.4);
      s.line(xN, top, pN, top, s.c('orange'), 0.4);
      s.arrow(pN, top, pN, o.yD - r, s.c('orange'), 0.4, 2);
      s.text('shortcut: x, untouched', (xN + pN) / 2, top - 3 * s.u, { size: 3, font: 'mono', color: s.c('orange') });
      s.circle(pN, o.yD, r, { fill: s.tint('--ink', 0.06), stroke: s.c('--ink-2'), lw: 0.4 });
      s.text('+', pN, o.yD, { size: 5, font: 'mono', weight: 650, color: s.c('--ink') });
    });
    s.alpha(out, () => {
      s.arrow(pN + r, o.yD, yN - r, o.yD, ink, 0.35, 2);
      s.circle(yN, o.yD, r, { fill: s.tint('green', 0.2), stroke: s.c('green'), lw: 0.4 });
      s.text('y', yN, o.yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') });
    });
  });
  if (o.red) {
    const k = s.c('red');
    s.alpha(o.red.cut, () => {
      s.line(pN - 1.4 * s.u, o.yD - r, pN - 1.4 * s.u, top + 1.4 * s.u, k, 0.5);
      s.line(pN - 1.4 * s.u, top + 1.4 * s.u, xN + 1.4 * s.u, top + 1.4 * s.u, k, 0.5);
      s.arrow(xN + 1.4 * s.u, top + 1.4 * s.u, xN + 1.4 * s.u, o.yD - r, k, 0.5, 2);
    });
    s.alpha(o.red.box, () => s.arrow(pN - r, o.yD + 9 * s.u, xN + r, o.yD + 9 * s.u, s.tint('red', 0.8), 0.5, 2));
  }
  return { xN, b0, b1, pN, yN, top, r };
}

const add: SceneDef = {
  draw(s) {
    const yD = s.h * 0.34;
    const zero = s.win('zero', 'name');
    diagram(s, { yD, cut: s.ease('shortcut', 0.8, 0.5), out: s.ease('sum', 0.6) });
    const lab = (t: string, f: number, k: Ink, a: number) =>
      s.alpha(a, () => s.text(t, s.w * f, yD + 11 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    // The forward pass in numbers, and again with F at zero.
    const nums = after(s, 'sum', 0.5) * (1 - s.ease('name', 0.5));
    lab('x = 2', 0.1, 'orange', nums);
    lab('F(x) = 0.5', 0.41, 'blue', nums * (1 - zero));
    lab('y = 2.5', 0.87, 'green', nums * (1 - zero));
    lab('F(x) = 0', 0.41, 'blue', nums * zero);
    lab('y = 2', 0.87, 'green', nums * zero);
    const ey = s.h * 0.68;
    const eq = { size: 5, weight: 650 } as const;
    const yx: [string, Ink][] = [['y', 'green'], [' = ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['F(x)', 'blue']];
    s.alpha(s.ease('sum', 0.6, 0.3) * (1 - s.ease('name', 0.5)), () => rich(s, yx, s.w / 2, ey, eq));
    s.alpha(s.ease('name', 0.6, 0.4), () => rich(s, [['F(x)', 'blue'], [' = ', '--ink-2'], ['y', 'green'], [' − ', '--ink-2'], ['x', 'orange']], s.w / 2, ey, eq));
    const cy = s.h * 0.82;
    s.alpha(s.win('fix', 'shortcut'), () => caption(s, 'a block: two layers, a ReLU between', cy, 'blue'));
    s.alpha(s.win('shortcut', 'sum'), () => caption(s, 'a wire with no weights', cy, 'orange'));
    s.alpha(after(s, 'sum', 0.5) * (1 - s.ease('zero', 0.5)), () => caption(s, '2 + 0.5 = 2.5', cy, 'green', 3.8));
    s.alpha(zero, () => caption(s, 'all of F at 0: y = x', cy, '--ink-2', 3.8));
    s.alpha(s.win('name', 'won'), () => caption(s, 'what is left over: the residual', cy, 'blue'));
    s.alpha(s.ease('won', 0.6), () => {
      caption(s, 'with shortcuts: 56 layers beat 20', cy, 'green', 3.3);
      caption(s, '152 layers deep: won ImageNet 2015', cy + 5.5 * s.u, 'green', 3.3);
    });
    cite(s, 'He, Zhang, Ren & Sun, 2015', Math.max(s.win('fix', 'shortcut'), s.ease('won', 0.6)));
  },
};

// ---- backward: the gradient through one block, then two, then a deep stack

type Spot = 'x' | 'b1' | 'h' | 'b2' | 'y';

/** Two blocks in a chain, x to h to y, with the gradient's steps written under the spots they reach. */
function twoBlocks(s: Scene, yS: number, a: number, named: number, steps: [string, Spot, number][], total: [string, string, number]): void {
  if (a <= 0.003) return;
  const at = { x: 0.1, b1: 0.3, h: 0.5, b2: 0.7, y: 0.9 };
  const [xN, b1, hN, b2, yN] = [at.x, at.b1, at.h, at.b2, at.y].map((f) => s.w * f) as [number, number, number, number, number];
  const r = 3.5 * s.u;
  const bw = s.w * 0.2;
  const ink = s.c('--ink-3');
  const big = { size: 3.8, font: 'mono', weight: 650 } as const;
  s.alpha(a, () => {
    const node = (x: number, t: string, k: Ink) => {
      s.circle(x, yS, r, { fill: s.tint(k, 0.2), stroke: s.c(k), lw: 0.4 });
      s.text(t, x, yS, { ...big, color: s.c(k) });
    };
    const box = (x: number, plain: string, t: string) => {
      s.rrect(x - bw / 2, yS - 5 * s.u, bw, 10 * s.u, 1.4, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
      s.alpha(1 - named, () => s.text(plain, x, yS, { ...big, size: 3.1, color: s.c('blue') }));
      s.alpha(named, () => s.text(t, x, yS, { ...big, size: 3.1, color: s.c('blue') }));
    };
    s.arrow(xN + r, yS, b1 - bw / 2 - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(b1 + bw / 2, yS, hN - r - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(hN + r, yS, b2 - bw / 2 - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(b2 + bw / 2, yS, yN - r - 0.5 * s.u, yS, ink, 0.35, 2);
    node(xN, 'x', 'orange');
    box(b1, 'block 1', 'x + F₁(x)');
    node(hN, 'h', 'purple');
    box(b2, 'block 2', 'h + F₂(h)');
    node(yN, 'y', 'green');
  });
  const yG = yS + 9 * s.u;
  for (const [t, spot, v] of steps) s.alpha(a * v, () => red(s, t, s.w * at[spot], yG));
  s.alpha(a * total[2], () => rich(s, [[total[0], '--ink-2'], [total[1], 'red']], s.w / 2, yG + 8 * s.u, { size: 3.2, weight: 650 }));
}

/** Slopes of F in ten blocks, small either way, as in a trained network. */
const DF = [0.1, -0.15, 0.05, 0.1, -0.1, 0.05, -0.05, 0.1, -0.1, 0.05];
const RES = DF.reduce<number[]>((acc, d) => [...acc, acc[acc.length - 1]! * (1 + d)], [1]);

/** One row of the gradient's size, from the output on the right back to the first layer or block on the left. */
function gradRow(s: Scene, base: number, vals: number[], k: Ink, name: string, a: number, grow: number, line?: string) {
  const n = vals.length;
  const l = 10 * s.u;
  const r = s.w - 10 * s.u;
  const pitch = (r - l) / n;
  const x = (i: number) => r - (i + 0.5) * pitch;
  const hMax = 14 * s.u;
  s.alpha(a, () => {
    s.text(name, l, base - hMax - (line ? 9 : 5) * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
    s.line(l, base, r, base, s.c('--axis'), 0.3);
    if (line) {
      s.line(l, base - hMax, r, base - hMax, s.tint(k, 0.8), 0.3, [1, 1]);
      s.text(line, r, base - hMax - 2.6 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c(k), halo: true });
    }
    vals.forEach((v, i) => {
      const on = Math.min(1, Math.max(0, grow * n - i));
      if (on <= 0) return;
      s.alpha(on, () => {
        const hh = Math.max(0.35 * s.u, Math.min(1.2, v) * hMax);
        s.rrect(x(i) - pitch * 0.3, base - hh, pitch * 0.6, hh, 0.4, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.22 });
      });
    });
    s.text('first', x(n - 1), base + 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    s.text('output', x(0), base + 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
  });
}

const back: SceneDef = {
  draw(s) {
    const yD = s.h * 0.3;
    const deepA = s.ease('deep', 0.6);
    const split = s.ease('split', 0.6, 0.6);
    s.alpha((1 - 0.6 * s.ease('stack', 0.6)) * (1 - deepA), () => {
      const d = diagram(s, { yD, cut: 1, dim: s.ease('split', 0.6), red: { cut: split, box: split } });
      s.alpha(s.ease('split', 0.6), () => red(s, 'g = 2', d.yN, yD - 7.5 * s.u));
      s.alpha(s.ease('paths', 0.6, 0.3), () => red(s, 'g = 2', (d.xN + d.pN) / 2, d.top + 5 * s.u));
      s.alpha(after(s, 'paths', 0.55), () => red(s, 'g · F′ = 2 × 0.5 = 1', (d.b0 + d.b1) / 2, yD + 13.5 * s.u, 3.1));
      s.alpha(s.ease('formula', 0.6, 0.4), () => {
        red(s, '2 + 1 = 3', d.xN + 6 * s.u, yD + 21 * s.u, 3.3, 'left');
        s.text('g (1 + F′)', s.w * 0.62, yD + 21 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
      });
    });
    twoBlocks(
      s,
      s.h * 0.67,
      s.ease('stack', 0.6) * (1 - deepA),
      s.ease('names', 0.6),
      [
        ['g = 1', 'y', after(s, 'back2', 0.15)],
        ['× (1 + 1)', 'b2', after(s, 'back2', 0.5)],
        ['2', 'h', after(s, 'back2', 0.8)],
        ['× (1 − 0.5)', 'b1', after(s, 'back1', 0.2)],
        ['1', 'x', after(s, 'back1', 0.45)],
      ],
      ['g (1 + F₂′)(1 + F₁′) = 1 × 2 × 0.5 = ', '1', after(s, 'back1', 0.7)],
    );
    gradRow(s, s.h * 0.36, HALF.slice(0, N), 'red', 'plain: × 0.5 per layer', deepA, s.ease('deep', 1.4, 0.4));
    gradRow(s, s.h * 0.74, RES.slice(0, N), 'green', 'residual: × (1 + F′) per block', after(s, 'deep', 0.3), after(s, 'deep', 0.35, 1.4), 'shortcuts alone: g, whole');
    cite(s, 'He, Zhang, Ren & Sun, 2016', s.ease('proof', 0.6));
    s.alpha(s.ease('proof', 0.6), () => caption(s, 'any block straight back to any earlier one', s.h * 0.93, 'green', 3.3));
  },
};

export const scenes: Record<string, SceneDef> = { deep, add, back };
