import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { axes, ball, curve, frame, series, xTicks, yTicks, type Frame } from '../draw';

const PEAK = 0.1;
const K = 1000;
const END = 4000;
const decay = (t: number) => 0.5 * PEAK * (1 + Math.cos((Math.PI * t) / END));
const warm = (t: number) => (t < K ? (PEAK * t) / K : 0.5 * PEAK * (1 + Math.cos((Math.PI * (t - K)) / (END - K))));
const k1 = (t: number) => (t === 0 ? '0' : `${t / 1000}k`);
/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
const mono = (s: Scene, t: string, x: number, y: number, k: Parameters<Scene['c']>[0], align: CanvasTextAlign = 'center', size = 3.2) =>
  s.text(t, x, y, { size, font: 'mono', align, color: s.c(k), halo: true });

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
      s.text('big gradients:', F.X(1250), F.Y(0.03), { size: 3.2, align: 'left', color: s.c('gold'), halo: true });
      s.text('small steps first', F.X(1250), F.Y(0.03) + 4 * s.u, { size: 3.2, align: 'left', color: s.c('gold'), halo: true });
    });
  },
};

const STAIR: [number, number][] = [[0, -1], [10, -1], [10, -2], [20, -2], [20, -3], [30, -3]];

/** Linear decay from 0.1 to 0 over T, sampled at quarters. */
const LIN = [0, 0.25, 0.5, 0.75, 1].map((x) => [x, 0.1 * (1 - x)] as [number, number]);
const quarter = (x: number) => (x === 1 ? 't = T' : x === 0.5 ? 'T/2' : x === 0.25 ? 'T/4' : '3T/4');

const steps: SceneDef = {
  draw(s) {
    const lin = s.ease('linear', 0.6);
    s.alpha(1 - lin, () => {
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
    });
    s.alpha(lin, () => {
      const F = frame(17 * s.u, s.h * 0.1, s.w - 12 * s.u, s.h - 9 * s.u, [0, 1], [0, 0.12]);
      axes(s, F, '', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, F, [0.25, 0.5, 0.75, 1], quarter);
      yTicks(s, F, [0.05, 0.1]);
      curve(s, F, (x) => 0.1 * (1 - x), 0, 1, 'slate', { width: 0.7, upto: s.ease('linear', 1.5, 0.3) });
      LIN.forEach(([x, y], i) => {
        s.alpha(after(s, 'linear', 0.4 + 0.09 * i), () => {
          ball(s, F.X(x), F.Y(y), 'slate', 1.3);
          mono(s, i === 0 ? 'ηₘₐₓ = 0.1' : String(Math.round(y * 1000) / 1000), F.X(x) + 2 * s.u, F.Y(y) - 3 * s.u, '--ink', 'left');
        });
      });
      s.alpha(after(s, 'linear', 0.35), () => mono(s, 'the same drop, 0.025, each time', F.X(0.98), F.Y(0.112), 'gold', 'right'));
      s.alpha(after(s, 'linear', 0.8), () => mono(s, 'down to ηₘᵢₙ = 0 at t = T', F.X(0.98), F.Y(0.112) + 5 * s.u, '--ink-2', 'right'));
    });
  },
};

const STAIR2: [number, number][] = [[0, -1], [5, -1], [5, -2], [10, -2], [10, -3], [15, -3]];
const LIN2 = (t: number) => 0.1 - (0.09 * t) / 1000;

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const q = { size: 3.4, font: 'mono', color: s.c('--ink') } as const;
    const ask = { ...q, weight: 650, color: s.c('gold') } as const;
    const ans = (t: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2') => s.text(t, s.w / 2, y, { size: 3.4, font: 'mono', weight: 600, color: s.c(k), halo: true });
    const one = 1 - s.ease('p2', 0.5);
    s.alpha(s.ease('p1', 0.6) * one, () => {
      s.text('start at 0.1, × 0.1 every 5,000 steps', s.w / 2, s.h * 0.07, q);
      s.alpha(after(s, 'p1', 0.6), () => s.text('the rate at step 10,000?', s.w / 2, s.h * 0.07 + 5.5 * u, ask));
      const F = frame(17 * u, s.h * 0.24, s.w - 9 * u, s.h * 0.62, [0, 15], [-3.4, -0.6]);
      axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, F, [5, 10], (x) => `${x}k`);
      yTicks(s, F, [-1, -2, -3], (y) => String(10 ** y));
      series(s, F, STAIR2, 'slate', { upto: Math.max(0, Math.min(1, (s.since('p1') - 0.3) / 2.5)), width: 0.7 });
      s.alpha(after(s, 'a1', 0.05), () => {
        for (const [i, x] of [5, 10].entries()) mono(s, `drop ${i + 1}`, F.X(x) + 1.5 * u, F.Y(i === 0 ? -1.5 : -2.5), 'gold', 'left');
      });
      pin(s, F, 10, -3, after(s, 'a1', 0.35));
      s.alpha(after(s, 'a1', 0.2), () => ans('step 10,000 is a drop: 2 so far', s.h * 0.74));
      s.alpha(after(s, 'a1', 0.6), () => ans('0.1 × 0.1 × 0.1 = 0.001', s.h * 0.81, 'gold'));
    });
    s.alpha(s.ease('p2', 0.6, 0.3), () => {
      s.text('linear: 0.1 down to 0.01, T = 1,000', s.w / 2, s.h * 0.07, q);
      s.alpha(after(s, 'p2', 0.6), () => s.text('the rate at step 400?', s.w / 2, s.h * 0.07 + 5.5 * u, ask));
      const F = frame(17 * u, s.h * 0.24, s.w - 9 * u, s.h * 0.62, [0, 1000], [0, 0.11]);
      axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, F, [400]);
      yTicks(s, F, [0.01, 0.05, 0.1]);
      s.line(F.l, F.Y(0.01), F.r, F.Y(0.01), s.tint('slate', 0.7), 0.3, [1, 0.8]);
      curve(s, F, LIN2, 0, 1000, 'slate', { width: 0.7, upto: s.ease('p2', 1.5, 0.5) });
      pin(s, F, 400, LIN2(400), after(s, 'a2', 0.8));
      s.alpha(after(s, 'a2', 0.05), () => ans('gap: 0.1 − 0.01 = 0.09', s.h * 0.72));
      s.alpha(after(s, 'a2', 0.3), () => ans('0.4 of the way: 0.4 × 0.09 = 0.036', s.h * 0.785));
      s.alpha(after(s, 'a2', 0.75), () => ans('rate: 0.1 − 0.036 = 0.064', s.h * 0.85, 'gold'));
    });
  },
};

export const scenes: Record<string, SceneDef> = { warmup, steps, try: tryIt };
