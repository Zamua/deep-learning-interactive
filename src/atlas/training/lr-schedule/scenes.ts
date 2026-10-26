import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
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
        s.alpha(after(s, 'linear', 0.5 + 0.1 * i), () => {
          ball(s, F.X(x), F.Y(y), 'slate', 1.3);
          mono(s, String(Math.round(y * 1000) / 1000), F.X(x) + 2 * s.u, F.Y(y) - 3 * s.u, '--ink', 'left');
        });
      });
      s.alpha(after(s, 'linear', 0.35), () => mono(s, 'the same drop, 0.025, each time', F.X(0.98), F.Y(0.112), 'gold', 'right'));
    });
  },
};

/** The curve at x = t / T: the cosine, morphing into (1 + cos) / 2 as `m` goes 0 to 1. */
const shape = (x: number, m: number) => lerp(Math.cos(Math.PI * x), (1 + Math.cos(Math.PI * x)) / 2, m);
const MARKS = [0, 1 / 3, 0.5, 0.75, 1];
const COS_LABEL = ['1', '0.5', '0', '−0.71', '−1'];
const HALF_LABEL = ['1', '0.75', '0.5', '0.15', '0'];
const RATE_LABEL = ['0.1', '0.075', '0.05', '0.015', '0'];
const third = (x: number) => (x === 1 ? 't = T' : x === 0.5 ? 'T/2' : x === 0.75 ? '3T/4' : 'T/3');

const cosine: SceneDef = {
  marks: {
    c: { tex: String.raw`\cos\big(\pi t / T\big)`, x: 0.5, y: 0.09, size: 5 },
    h: { tex: String.raw`\tfrac{1}{2}\big(1 + \cos(\pi t / T)\big)`, x: 0.5, y: 0.09, size: 5 },
    f: { tex: String.raw`\symeta_t = \symeta_{\min} + \tfrac{1}{2}(\symeta_{\max} - \symeta_{\min})\left(1 + \cos\tfrac{\pi t}{T}\right)`, x: 0.5, y: 0.08, size: 3.9 },
    ends: { tex: String.raw`\symeta_{\max} = 0.1,\quad \symeta_{\min} = 0`, x: 0.5, y: 0.17, size: 3.8 },
    at2: { tex: String.raw`t = T/2{:}\quad 0.05 \times (1 + 0) = 0.05`, x: 0.5, y: 0.17, size: 3.8 },
    at3: { tex: String.raw`t = T/3{:}\quad 0.05 \times (1 + 0.5) = 0.075`, x: 0.5, y: 0.17, size: 3.8 },
  },
  draw(s) {
    const m = s.ease('halve', 1.2, 0.3);
    const sc = s.ease('scale', 1.2, 0.3);
    s.show('c', s.ease('cos', 0.6) * (1 - s.ease('halve', 0.5)));
    s.show('h', s.win('halve', 'scale'));
    s.show('f', s.ease('scale', 0.6));
    s.show('ends', after(s, 'scale', 0.6) * (1 - s.ease('half', 0.4)));
    s.show('at2', after(s, 'half', 0.5) * (1 - s.ease('third', 0.4)));
    s.show('at3', after(s, 'third', 0.4));
    const F = frame(16 * s.u, s.h * 0.24, s.w - 12 * s.u, s.h - 9 * s.u, [0, 1], [lerp(-1.15, -0.06, sc), lerp(1.15, 1.12, sc)]);
    axes(s, F, '', '', { x: '--ink-3', y: 'slate' });
    s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
    xTicks(s, F, [1 / 3, 0.5, 0.75, 1], third);
    s.alpha(1 - m, () => yTicks(s, F, [-1, 0, 1], (y) => String(y).replace('-', '−')));
    s.alpha(m * (1 - sc), () => yTicks(s, F, [0.5, 1]));
    s.alpha(sc, () => yTicks(s, F, [0.5, 1], (y) => String(y / 10)));
    s.alpha(m, () => {
      curve(s, F, (x) => 1 - x, 0, 1, '--ink-3', { width: 0.35, dash: [1.2, 1] });
      mono(s, 'linear', F.X(0.66), F.Y(0.34) - 3.5 * s.u, '--ink-3', 'left', 3);
    });
    curve(s, F, (x) => shape(x, m), 0, 1, 'slate', { width: 0.7, upto: s.ease('cos', 2.5, 1) });
    const hot = [-1, -1, s.win('half', 'third'), -1, -1];
    hot[1] = s.ease('third', 0.6);
    MARKS.forEach((x, i) => {
      s.alpha(after(s, 'vals', [0, 0.12, 0.38, 0.65, 0.9][i]!), () => {
        const y = shape(x, m);
        const big = Math.max(0, hot[i]!);
        if (big) pin(s, F, x, y, big);
        ball(s, F.X(x), F.Y(y), 'slate', 1.2 + 0.5 * big);
        const dy = i === 0 ? 3.4 : -3;
        const at = (t: string, a: number) => s.alpha(a, () => mono(s, t, F.X(x) + 2.2 * s.u, F.Y(y) + dy * s.u, big ? 'gold' : '--ink', 'left'));
        at(COS_LABEL[i]!, 1 - m);
        at(HALF_LABEL[i]!, m * (1 - sc));
        at(RATE_LABEL[i]!, sc);
      });
    });
  },
};

const TRY = (t: number) => 0.01 + 0.045 * (1 + Math.cos((Math.PI * t) / 1200));

const tryIt: SceneDef = {
  marks: {
    q: { tex: String.raw`\symeta_{\max} = 0.1,\ \ \symeta_{\min} = 0.01,\ \ T = 1200,\ \ t = 900`, x: 0.5, y: 0.08, size: 4 },
    l1: { tex: String.raw`t / T = 900 / 1200 = \tfrac{3}{4},\quad \cos \approx -0.707`, x: 0.5, y: 0.66, size: 4 },
    l2: { tex: String.raw`1 + \cos \approx 0.293`, x: 0.5, y: 0.74, size: 4 },
    l3: { tex: String.raw`\tfrac{1}{2}(0.1 - 0.01) = 0.045`, x: 0.5, y: 0.82, size: 4 },
    l4: { tex: String.raw`\symeta_t \approx 0.01 + 0.045 \times 0.293 \approx 0.0232`, x: 0.5, y: 0.9, size: 4 },
  },
  draw(s) {
    s.show('q', s.ease('p1', 0.6));
    s.show('l1', after(s, 'a1', 0.05));
    s.show('l2', after(s, 'a1', 0.6));
    s.show('l3', after(s, 'a2', 0.05));
    s.show('l4', after(s, 'a2', 0.45));
    const F = frame(16 * s.u, s.h * 0.17, s.w - 12 * s.u, s.h * 0.56, [0, 1200], [0, 0.11]);
    s.alpha(s.ease('p1', 0.6), () => {
      axes(s, F, '', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, F, [600, 900, 1200], (x) => (x === 1200 ? 't = 1200' : String(x)));
      yTicks(s, F, [0.01, 0.05, 0.1]);
      s.line(F.l, F.Y(0.01), F.r, F.Y(0.01), s.tint('slate', 0.7), 0.3, [1, 0.8]);
      curve(s, F, TRY, 0, 1200, 'slate', { width: 0.7, upto: s.ease('p1', 2, 0.5) });
    });
    pin(s, F, 900, TRY(900), after(s, 'a1', 0.1));
    s.alpha(after(s, 'a2', 0.75), () => mono(s, '≈ 0.0232', F.X(900) + 2.5 * s.u, F.Y(TRY(900)) - 3 * s.u, 'gold', 'left', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { warmup, steps, cosine, try: tryIt };
