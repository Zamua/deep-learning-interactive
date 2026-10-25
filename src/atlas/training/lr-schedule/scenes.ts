import type { Scene, SceneDef } from '../../../lecture/scene';
import { axes, ball, curve, frame, series, xTicks, yTicks, type Frame } from '../draw';

const PEAK = 0.1;
const K = 1000;
const END = 4000;
const decay = (t: number) => 0.5 * PEAK * (1 + Math.cos((Math.PI * t) / END));
const warm = (t: number) => (t < K ? (PEAK * t) / K : 0.5 * PEAK * (1 + Math.cos((Math.PI * (t - K)) / (END - K))));
const k1 = (t: number) => (t === 0 ? '0' : `${t / 1000}k`);

/** Dashed guides from a point down to the floor and across to the wall, with a dot on it. */
function pin(s: Scene, F: Frame, x: number, y: number, a: number): void {
  s.alpha(a, () => {
    s.line(F.X(x), F.Y(y), F.X(x), F.b, s.tint('slate', 0.7), 0.3, [1, 0.8]);
    s.line(F.l, F.Y(y), F.X(x), F.Y(y), s.tint('slate', 0.7), 0.3, [1, 0.8]);
    ball(s, F.X(x), F.Y(y), 'slate', 1.4);
  });
}

const warmup: SceneDef = {
  draw(s) {
    const F = frame(16 * s.u, s.h * 0.1, s.w - 7 * s.u, s.h - 9 * s.u, [0, END], [0, 0.12]);
    axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
    xTicks(s, F, [1000, 2000, 3000], k1);
    yTicks(s, F, [0.05, 0.1]);
    const m = s.ease('ramp', 1.2);
    const f = (t: number) => (1 - m) * decay(t) + m * warm(t);
    curve(s, F, f, 0, END, 'slate', { width: 0.7, upto: s.ease('why', 1.5) });
    s.alpha(s.win('why', 'ramp'), () => {
      s.text('big steps early', F.X(300), F.Y(0.112), { size: 3.2, align: 'left', color: s.c('--ink-2'), halo: true });
      s.text('small steps late', F.X(3900), F.Y(0.022), { size: 3.2, align: 'right', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('ramp', 0.6, 1.2), () => {
      s.line(F.X(K), F.t, F.X(K), F.b, s.tint('gold', 0.6), 0.3, [1.2, 1]);
      s.text('k: warmup ends', F.X(K) + 1.5 * s.u, F.t + 2 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    });
    const exA = 1 - s.ease('reason', 0.5);
    pin(s, F, 250, 0.025, s.ease('ex', 0.6, 1.5) * exA);
    s.alpha(s.ease('ex', 0.6, 2.5) * exA, () => {
      s.text('step 250: 0.025', F.X(250) + 3 * s.u, F.Y(0.025) + 0.5 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
    });
    s.alpha(s.ease('reason', 0.6, 1), () => {
      s.text('big, erratic gradients:', F.X(1250), F.Y(0.03), { size: 3.2, align: 'left', color: s.c('gold'), halo: true });
      s.text('small steps first', F.X(1250), F.Y(0.03) + 4 * s.u, { size: 3.2, align: 'left', color: s.c('gold'), halo: true });
    });
  },
};

const STAIR: [number, number][] = [[0, -1], [10, -1], [10, -2], [20, -2], [20, -3], [30, -3]];

const steps: SceneDef = {
  draw(s) {
    const F = frame(17 * s.u, s.h * 0.1, s.w - 7 * s.u, s.h - 9 * s.u, [0, 30], [-3.4, -0.6]);
    axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
    xTicks(s, F, [10, 20], (x) => `${x}k`);
    yTicks(s, F, [-1, -2, -3], (y) => String(10 ** y));
    s.text('log scale', F.l + 6 * s.u, F.t + 2 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    series(s, F, STAIR, 'slate', { upto: Math.max(0, Math.min(1, (s.since('rule') - 0.3) / 3)), width: 0.7 });
    s.alpha(s.ease('rule', 0.6, 2.5), () => {
      for (const x of [10, 20]) s.text('×0.1', F.X(x) + 1.5 * s.u, F.Y(x === 10 ? -1.5 : -2.5), { size: 3.2, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    });
    pin(s, F, 15, -2, s.ease('ex', 0.6, 2.5));
    s.alpha(s.ease('ex', 0.6, 3), () => s.text('step 15k: 0.01', F.X(15), F.Y(-2) - 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink'), halo: true }));
    pin(s, F, 25, -3, s.ease('ex', 0.6, 5));
    s.alpha(s.ease('ex', 0.6, 5.5), () => s.text('step 25k: 0.001', F.X(25), F.Y(-3) - 4 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink'), halo: true }));
  },
};

const cos = (x: number) => 0.05 * (1 + Math.cos(Math.PI * x));

const cosine: SceneDef = {
  marks: {
    f: { tex: String.raw`\symeta_t = \symeta_{\min} + \tfrac{1}{2}(\symeta_{\max} - \symeta_{\min})\left(1 + \cos\tfrac{\pi t}{T}\right)`, x: 0.5, y: 0.09, size: 3.9 },
  },
  draw(s) {
    s.show('f', s.ease('cos', 0.6));
    const F = frame(16 * s.u, s.h * 0.22, s.w - 7 * s.u, s.h - 9 * s.u, [0, 1], [0, 0.11]);
    axes(s, F, '', 'η', { x: '--ink-3', y: 'slate' });
    xTicks(s, F, [1 / 3, 0.5, 1], (x) => (x === 1 ? 't = T' : x === 0.5 ? 'T/2' : 'T/3'));
    yTicks(s, F, [0.05, 0.1]);
    s.alpha(s.ease('shape', 0.6, 1.5), () => {
      curve(s, F, (x) => 0.1 * (1 - x), 0, 1, '--ink-3', { width: 0.35, dash: [1.2, 1] });
      s.text('straight line', F.X(0.66), F.Y(0.042), { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
    });
    curve(s, F, cos, 0, 1, 'slate', { width: 0.7, upto: s.ease('cos', 2, 0.5) });
    s.alpha(s.ease('shape', 0.6), () => {
      const lab = { size: 3.2, font: 'mono' as const, color: s.c('gold'), halo: true };
      s.text('flat', F.X(0.17), F.Y(0.1) - 3.5 * s.u, lab);
      s.text('steepest', F.X(0.5) + 2 * s.u, F.Y(0.05) - 3 * s.u, { ...lab, align: 'left' });
      s.text('flat', F.X(0.92), F.Y(0) - 3.5 * s.u, lab);
    });
    pin(s, F, 0.5, 0.05, s.ease('half', 0.6, 1.5));
    s.alpha(s.ease('half', 0.6, 2), () => s.text('cos = 0: 0.05', F.X(0.5) - 2 * s.u, F.Y(0.05) + 4 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink'), halo: true }));
    pin(s, F, 1 / 3, 0.075, s.ease('third', 0.6, 1.5));
    s.alpha(s.ease('third', 0.6, 2), () => s.text('cos = 0.5: 0.075', F.X(1 / 3) + 2.5 * s.u, F.Y(0.075) - 1 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { warmup, steps, cosine };
