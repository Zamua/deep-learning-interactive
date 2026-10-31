import { type Ink, type Scene, type SceneDef } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { clipped, frame, type Frame } from '../../optimization/draw';
import { key, series, xTicks, yTicks } from '../draw';
import type { Color } from '../../../core/symbols';
import { caption, rich } from '../../networks/draw';
/** Linear 0 -> 1 over `dur` seconds, starting `delay` seconds into beat `id`. */
const grow = (s: Scene, id: string, dur: number, delay = 0) => Math.max(0, Math.min(1, (s.since(id) - delay) / dur));

const M_RULE = String.raw`\sym{m}{m} \leftarrow \sym{beta1}{\beta_1} \sym{m}{m} + (1 - \sym{beta1}{\beta_1})\,\symg`;
const V_RULE = String.raw`\sym{v}{v} \leftarrow \sym{beta2}{\beta_2} \sym{v}{v} + (1 - \sym{beta2}{\beta_2})\,\symg^2`;
const M: Color = 'orange';
const V: Color = 'teal';

// ---- the problem: momentum's valley, where one weight's gradient is big and flips and the other's is small and steady

/** The valley L = 0.5 (0.05 w0² + w1²) and plain gradient descent on it, as momentum drew it. */
const A = 0.05;
const ETA = 1.8;
const STEPS = 14;
const PATH: [number, number][] = [[-4.5, 1.6]];
const GRADS: [number, number][] = [];
for (let i = 0; i < STEPS; i++) {
  const [w0, w1] = PATH[i]!;
  GRADS.push([A * w0, w1]);
  PATH.push([w0 - ETA * A * w0, w1 - ETA * w1]);
}

function contours(s: Scene, F: Frame): void {
  clipped(s, F, () => {
    for (const c of [0.08, 0.3, 0.7, 1.3, 2.1]) {
      const g = s.ctx;
      g.beginPath();
      g.ellipse(F.X(0), F.Y(0), F.X(Math.sqrt((2 * c) / A)) - F.X(0), F.Y(0) - F.Y(Math.sqrt(2 * c)), 0, 0, Math.PI * 2);
      g.strokeStyle = s.tint('red', 0.3);
      g.lineWidth = 0.35 * s.u;
      g.stroke();
    }
  });
}

/** One weight's gradients as bars around a zero line, revealed `n` steps in; `hi` brightens them. */
function strip(s: Scene, y: number, vals: number[], n: number, hi: number, label: string, labK: Ink, labDy: number) {
  const x0 = 10 * s.u;
  const x1 = s.w - 8 * s.u;
  const gap = (x1 - x0) / vals.length;
  const scale = 9 / 1.6;
  s.alpha(0.4 + 0.6 * hi, () => {
    s.line(x0 - 3 * s.u, y, x1, y, s.c('--axis'), 0.3);
    s.text(label, 6 * s.u, y - labDy * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c(labK) });
    vals.forEach((v, i) => {
      const a = Math.max(0, Math.min(1, n - i));
      if (a <= 0) return;
      const hh = v * scale * s.u;
      const bx = x0 + (i + 0.5) * gap;
      s.alpha(a, () => s.rrect(bx - gap * 0.3, Math.min(y, y - hh), gap * 0.6, Math.max(0.5 * s.u, Math.abs(hh)), 0.5, { fill: s.tint('red', 0.55), stroke: s.c('red'), lw: 0.25 }));
    });
  });
}

const problem: SceneDef = {
  draw(s) {
    const F = frame(6 * s.u, s.h * 0.1, s.w - 6 * s.u, s.h * 0.37, [-5.6, 1.6], [-2, 2]);
    contours(s, F);
    s.circle(F.X(0), F.Y(0), 0.9 * s.u, { fill: s.c('red') });
    const n = grow(s, 'valley', 5, 0.8) * STEPS;
    series(s, F, PATH, 'slate', { upto: n / STEPS, width: 0.45, dots: 0.6 });
    s.circle(F.X(PATH[0]![0]), F.Y(PATH[0]![1]), 1.3 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
    const across = s.win('across', 'along');
    const along = s.win('along', 'one');
    strip(s, s.h * 0.58, GRADS.map((g) => g[1]), n, 1 - along, 'w₁: across the valley', 'blue', 12.5);
    strip(s, s.h * 0.81, GRADS.map((g) => g[0]), n, 1 - across, 'w₀: along the valley', 'blue', 6);
    const cy = s.h * 0.93;
    s.alpha(across, () => caption(s, 'big, and flips sign every step', cy, 'red'));
    s.alpha(along, () => caption(s, 'small, and the same sign every step', cy, 'red'));
    s.alpha(s.win('one', 'adam'), () => caption(s, 'one η for every parameter', cy, 'slate'));
    s.alpha(s.ease('two', 0.6), () => caption(s, 'per parameter: which way? how big?', cy, '--ink'));
    cite(s, 'Adam · Kingma & Ba, 2014', s.ease('adam', 0.6));
  },
};

// ---- the first average: a jagged gradient and m, the smooth line through it

/** One parameter's gradients: 2, then -4, then jumping around 2. */
const G = [2, -4, 3.6, 0.3, 2.9, 4.1, 0.8, 2.4, -0.6, 3.3, 1.7, 4.4, 0.2, 2.8, 3.9, 1.1, -0.3, 3.0, 2.2, 4.0, 0.9, 2.6, 3.5, 0.5, 2.1, 3.8, 1.4, 2.7, 0.7, 3.2];
const avg = (gs: number[], beta: number): [number, number][] => {
  let m = 0;
  return [[0, 0], ...gs.map((g, i): [number, number] => [i + 1, (m = beta * m + (1 - beta) * g)])];
};
const GPTS: [number, number][] = G.map((g, i) => [i + 1, g]);
const MPTS = avg(G, 0.9);

const first: SceneDef = {
  marks: {
    rule: { tex: M_RULE, x: 0.5, y: 0.07, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const top = { size: 4.2, weight: 650 } as const;
    s.alpha(s.win('keep', 'beta1'), () => rich(s, [['m', M], [' ← 0.9 ', '--ink-2'], ['m', M], [' + 0.1 ', '--ink-2'], ['g', 'red']], s.w / 2, s.h * 0.07, top));
    s.show('rule', s.ease('beta1', 0.6));
    s.alpha(s.win('mom', 'ex'), () => rich(s, [['momentum: ', '--ink-3'], ['v ← μv − ηg', '--ink-2']], s.w / 2, s.h * 0.145, { size: 3.4 }));

    const F = frame(12 * u, s.h * 0.2, s.w - 6 * u, s.h * 0.62, [0, 30], [-4.6, 4.6]);
    const dim = 1 - 0.55 * s.win('ex', 'one');
    s.alpha(dim, () => {
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.3);
      yTicks(s, F, [-4, 0, 4]);
      xTicks(s, F, [10, 20]);
      s.text('step', F.r, F.b + 3.4 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      series(s, F, GPTS, 'red', { upto: grow(s, 'jagged', 3.5, 0.4), width: 0.35, dots: 0.55 });
      series(s, F, MPTS, M, { upto: grow(s, 'smooth', 4, 0.2), width: 0.9 });
      let kx = F.l + 3 * u;
      kx = key(s, kx, F.t + 1 * u, 'red', 'g');
      s.alpha(s.ease('smooth', 0.6), () => key(s, kx, F.t + 1 * u, M, 'm'));
    });
    // The first two steps, picked out on the plot.
    const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(s.ease('one', 0.6), () => {
      s.circle(F.X(1), F.Y(0.2), 1.3 * u, { fill: s.c(M), stroke: s.c('--card'), lw: 0.4 });
      s.text('0.2', F.X(1) + 2.2 * u, F.Y(0.2) - 3 * u, { ...lab, align: 'left', color: s.c(M) });
    });
    s.alpha(s.ease('two', 0.6, 1), () => {
      s.circle(F.X(2), F.Y(-0.22), 1.3 * u, { fill: s.c(M), stroke: s.c('--card'), lw: 0.4 });
      s.text('−0.22', F.X(2) + 2.2 * u, F.Y(-0.22) + 3.4 * u, { ...lab, align: 'left', color: s.c(M) });
    });

    const cy = s.h * 0.75;
    s.alpha(s.win('jagged', 'keep'), () => caption(s, 'one parameter\'s gradient, step by step', cy, 'red'));
    s.alpha(s.win('smooth', 'running'), () => caption(s, 'm: where g has been pointing lately', cy, M));
    s.alpha(s.win('running', 'beta1'), () => caption(s, 'share of each past g: 0.1, 0.09, 0.081, …', cy));
    s.alpha(s.win('beta1', 'mom'), () => rich(s, [['β₁', 'slate'], [' = 0.9: the share of ', '--ink-2'], ['m', M], [' kept', '--ink-2']], s.w / 2, cy));
    s.alpha(s.win('mom', 'ex'), () => rich(s, [['m', M], [': no η, so an average ', '--ink-2'], ['g', 'red'], [', not a step', '--ink-2']], s.w / 2, cy));

    // A tenth of the way: m = 0.5 moves toward g = 3.
    s.alpha(s.win('ex', 'one'), () => {
      const y = s.h * 0.82;
      const l = s.w / 2 - 38 * u;
      const X = (v: number) => l + (v / 3.2) * 76 * u;
      s.line(l, y, X(3.2), y, s.c('--axis'), 0.4);
      const dot = (v: number, k: Ink, r = 1.4) => s.circle(X(v), y, r * u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
      dot(0.5, M);
      s.text('m = 0.5', X(0.5), y - 4.5 * u, { ...lab, color: s.c(M) });
      dot(3, 'red');
      s.text('g = 3', X(3), y - 4.5 * u, { ...lab, color: s.c('red') });
      s.alpha(after(s, 'ex', 0.45), () => {
        s.arrow(X(0.5), y + 3 * u, X(0.75), y + 3 * u, s.c(M), 0.4, 1.6);
        dot(0.75, M, 1.8);
        s.text('0.45 + 0.3 = 0.75', X(0.5), y + 7.5 * u, { ...lab, align: 'left', color: s.c('--ink-2') });
      });
    });
    const wy = s.h * 0.8;
    const o = { size: 3.5 } as const;
    s.alpha(s.ease('one', 0.6), () => rich(s, [['step 1:  ', '--ink-3'], ['0.9 × 0 + 0.1 × 2 = ', '--ink-2'], ['0.2', M]], s.w / 2, wy, o));
    s.alpha(s.ease('two', 0.6, 0.8), () => rich(s, [['step 2:  ', '--ink-3'], ['0.18 + 0.1 × (−4) = ', '--ink-2'], ['−0.22', M]], s.w / 2, wy + 7 * u, o));
  },
};

// ---- the second average: two parameters whose m differ but whose v agree

const STEADY = Array.from({ length: 40 }, () => 3);
const FLIP = STEADY.map((g, i) => (i % 2 ? -g : g));
const MA = avg(STEADY, 0.9);
const MB = avg(FLIP, 0.9);
/** v for g² = 9 every step, β₂ = 0.999, sampled every 50 steps out to 5000. */
const VPTS: [number, number][] = Array.from({ length: 101 }, (_, i) => [i * 50, 9 * (1 - 0.999 ** (i * 50))]);
const A_K: Color = 'gold';
const B_K: Color = 'purple';

const second: SceneDef = {
  marks: {
    rule: { tex: V_RULE, x: 0.5, y: 0.07, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(1 - s.ease('v', 0.5), () => rich(s, [['a: ', A_K], ['g = 3, 3, 3, …     ', '--ink-2'], ['b: ', B_K], ['g = 3, −3, 3, …', '--ink-2']], s.w / 2, s.h * 0.07, { size: 3.4 }));
    s.show('rule', s.ease('v', 0.6) * (1 - s.ease('name', 0.6)));

    // m for both, over 40 steps.
    const F = frame(12 * u, s.h * 0.17, s.w - 6 * u, s.h * 0.45, [0, 40], [-3.6, 3.6]);
    s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
    s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.3);
    yTicks(s, F, [-3, 0, 3]);
    s.text('m', F.l - 1.6 * u, F.t - 3.5 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(M) });
    const gIn = s.ease('two', 0.6);
    s.alpha(0.35 * gIn, () => {
      STEADY.forEach((g, i) => s.circle(F.X(i + 1), F.Y(g), 0.5 * u, { fill: s.c(A_K) }));
      FLIP.forEach((g, i) => s.circle(F.X(i + 1), F.Y(g), 0.5 * u, { fill: s.c(B_K) }));
    });
    series(s, F, MA, A_K, { upto: grow(s, 'm', 3, 0.3), width: 0.8 });
    series(s, F, MB, B_K, { upto: grow(s, 'm', 3, 0.3), width: 0.6 });
    s.alpha(after(s, 'm', 0.3), () => s.text('a: m → 3', F.r - 1 * u, F.Y(3) + 4 * u, { ...lab, align: 'right', color: s.c(A_K) }));
    s.alpha(after(s, 'm', 0.7), () => s.text('b: m near 0', F.r - 1 * u, F.Y(0) + 5 * u, { ...lab, align: 'right', color: s.c(B_K) }));

    // v for both, over thousands of steps.
    const G2 = frame(12 * u, s.h * 0.6, s.w - 6 * u, s.h * 0.84, [0, 5000], [0, 10]);
    s.alpha(s.ease('beta2', 0.6), () => {
      s.line(G2.l, G2.b, G2.r, G2.b, s.c('--axis'), 0.3);
      s.line(G2.l, G2.b, G2.l, G2.t, s.c('--axis'), 0.3);
      s.line(G2.l, G2.Y(9), G2.r, G2.Y(9), s.tint(V, 0.6), 0.3, [1.2, 1]);
      yTicks(s, G2, [0, 9]);
      xTicks(s, G2, [2000, 4000]);
      s.text('step', G2.r, G2.b + 3.4 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('v', G2.l - 1.6 * u, G2.t - 3.5 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(V) });
      series(s, G2, VPTS, V, { upto: grow(s, 'beta2', 5, 1), width: 0.9 });
    });
    s.alpha(after(s, 'sign', 0.4), () => s.text('a and b: v → 9', G2.r - 1 * u, G2.Y(9) + 4.5 * u, { ...lab, align: 'right', color: s.c(V) }));

    const my = s.h * 0.52;
    s.alpha(s.win('blind', 'v'), () => caption(s, 'near 0: tiny gradients, or big ones that cancel?', my, B_K, 3.3));
    s.alpha(s.win('v', 'beta2'), () => rich(s, [['v', V], [': a running average of ', '--ink-2'], ['g²', 'red']], s.w / 2, my));
    s.alpha(s.win('beta2', 'sign'), () => rich(s, [['β₂', 'slate'], [' = 0.999: keep almost all of ', '--ink-2'], ['v', V]], s.w / 2, my, { size: 3.4 }));
    s.alpha(s.win('sign', 'zero'), () => caption(s, '3² = (−3)² = 9', my, 'red'));
    s.alpha(s.win('zero', 'name'), () => rich(s, [['step 1:  ', '--ink-3'], ['0.999 × 0 + 0.001 × 4 = ', '--ink-2'], ['0.004', V]], s.w / 2, my, { size: 3.4 }));
    s.alpha(s.ease('name', 0.6), () => rich(s, [['m', M], [': first moment    ', '--ink-2'], ['v', V], [': second moment', '--ink-2']], s.w / 2, my, { size: 3.5 }));

    const cy = s.h * 0.93;
    s.alpha(s.win('sign', 'name'), () => rich(s, [['m', M], [': the direction    ', '--ink'], ['v', V], [': the size', '--ink']], s.w / 2, cy, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'Adam: adaptive moment estimation', cy, '--ink', 3.6));
    s.alpha(s.ease('name', 0.6), () => s.text('Kingma & Ba, 2014', s.w / 2, s.h * 0.07, { size: 3.4, italic: true, color: s.c('--ink-2'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { problem, first, second };
