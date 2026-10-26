import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { ball } from '../../optimization/draw';
import { after } from '../../backprop/draw';
import { axes, curve, fmt, frame, type Ink, rich } from '../draw';

const TOK = ['sure', 'thing', '!'];
const PI = [0.6, 0.5, 0.37];
const REF = [0.3, 0.1, 0.5];
const LR = PI.map((p, i) => Math.log(p / REF[i]!));
const SUM = LR.reduce((a, b) => a + b, 0);

/** Tokens over paired bars: π (the model being trained) beside π_ref (the frozen start). */
function pairs(s: Scene, xs: number[], o: { ref: number; hi?: number[] }): void {
  const base = s.h * 0.56;
  const H = 34;
  TOK.forEach((t, i) => s.cell(xs[i]! - 7 * s.u, s.h * 0.12 - 4 * s.u, 14 * s.u, 8 * s.u, t, 'purple', { on: o.hi?.[i] ?? 0, size: 3.4 }));
  s.line(xs[0]! - 11 * s.u, base, xs[2]! + 11 * s.u, base, s.c('--axis'), 0.35);
  xs.forEach((x, i) => {
    const bar = (dx: number, v: number, k: 'teal' | 'slate', a: number) =>
      s.alpha(a, () => {
        const hh = v * H * s.u;
        s.rrect(x + dx - 3.4 * s.u, base - hh, 6.8 * s.u, hh, 0.8, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.9), lw: 0.25 });
        s.text(v.toFixed(2), x + dx, base - hh - 2.8 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
      });
    bar(-3.8 * s.u * o.ref, PI[i]!, 'teal', 1);
    bar(3.8 * s.u, REF[i]!, 'slate', o.ref);
  });
  rowLabel(s, 'π', xs[0]! - 12 * s.u, base - 14 * s.u, 'teal', 3.6);
  s.alpha(o.ref, () => rowLabel(s, 'π_ref', xs[0]! - 12 * s.u, base - 7 * s.u, 'slate', 3));
}

const drift: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 26);
    const ref = s.ease('ref', 0.8, 0.6);
    const most = s.ease('most', 0.6);
    const on = [s.win('value', 'neg'), most, s.win('neg', 'most')];
    pairs(s, xs, { ref, hi: on });
    const y = s.h * 0.66;
    s.alpha(s.ease('ratio', 0.6, 1), () => {
      rowLabel(s, 'ln π/π_ref', xs[0]! - 9 * s.u, y, 'red', 2.8);
      cells(s, xs, y, LR.map((v) => fmt(v)), 'red', { w: 13, h: 7, on });
    });
    const y1 = s.h * 0.8;
    const y2 = s.h * 0.88;
    const line = (runs: [string, Ink][], at: number, a: number) => s.alpha(a, () => rich(s, runs, s.w / 2, at, { size: 3.2 }));
    line([['ln(0.6 / 0.3) = ln 2 ≈ ', '--ink-2'], ['0.69', 'red']], y1, s.win('value', 'neg'));
    line([['ln 0.6 − ln 0.3 = −0.51 + 1.20 = ', '--ink-2'], ['0.69', 'red']], y2, s.win('diff', 'neg'));
    line([['ln(0.37 / 0.5) ≈ ', '--ink-2'], ['−0.30', 'red'], [': liked less', '--ink-3']], y1, s.win('neg', 'most'));
    line([['ln 0.37 − ln 0.5 = −0.99 + 0.69 = ', '--ink-2'], ['−0.30', 'red']], y2, s.ease('neg', 0.6, 1.5) * (1 - s.ease('most', 0.6)));
    line([['thing: 0.5 / 0.1 = ', '--ink-2'], ['5', 'red'], ['   sure: 0.6 / 0.3 = 2', '--ink-3']], y1, most);
    line([['largest ratio, largest log: ', '--ink-2'], ['1.61', 'red']], y2, s.ease('most', 0.6, 2));
    s.alpha(s.ease('drift', 0.6, 1.5) * (1 - ref), () => s.text('the model being trained', s.w / 2, y1, { size: 3.2, color: s.c('teal') }));
    s.alpha(ref * (1 - s.ease('value', 0.5)), () => s.text('beside the frozen reference', s.w / 2, y1, { size: 3.2, color: s.c('slate') }));
  },
};

const LP = PI.map((p) => Math.round(Math.log(p) * 100) / 100);
const LQ = REF.map((p) => Math.round(Math.log(p) * 100) / 100);
const LD = LP.map((a, i) => Math.round((a - LQ[i]!) * 100) / 100);

const sum: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{R}{R} - \sym{beta}{\beta} \sum_t \ln\dfrac{\sym{pi}{\pi}(y_t)}{\sym{piref}{\pi_{\text{ref}}}(y_t)}`, x: 0.5, y: 0.645, size: 4.2 },
  },
  draw(s) {
    // The listing: each token's two log-probabilities, and their difference.
    const cx = s.w / 2;
    const X = [-34, -13, 8, 31].map((d) => cx + d * s.u);
    const ys = [0.18, 0.27, 0.36].map((f) => s.h * f);
    const head = (t: string, i: number, k: Ink) => s.text(t, X[i]!, s.h * 0.095, { size: 3, font: 'mono', weight: 600, color: s.c(k) });
    head('token', 0, '--ink-3');
    head('ln π', 1, 'teal');
    head('ln π_ref', 2, 'slate');
    s.alpha(after(s, 'logs', 0.3), () => head('log-ratio', 3, 'red'));
    const hot = s.win('logs', 'sum');
    TOK.forEach((t, i) => {
      const y = ys[i]!;
      const on = i === 0 ? hot : 0;
      s.text(t, X[0]!, y, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      s.cell(X[1]! - 7 * s.u, y - 3.5 * s.u, 14 * s.u, 7 * s.u, fmt(LP[i]!), 'teal', { on, size: 3.2 });
      s.cell(X[2]! - 7 * s.u, y - 3.5 * s.u, 14 * s.u, 7 * s.u, fmt(LQ[i]!), 'slate', { on, size: 3.2 });
      s.alpha(after(s, 'logs', i === 0 ? 0.6 : 0.85), () => s.cell(X[3]! - 7 * s.u, y - 3.5 * s.u, 14 * s.u, 7 * s.u, fmt(LD[i]!), 'red', { on: on + s.win('sum', 'never') * 0.6, size: 3.2 }));
    });
    s.alpha(s.ease('sum', 0.6, 1), () => rich(s, [['sum = 0.69 + 1.61 − 0.30 = ', '--ink-2'], [fmt(LD.reduce((a, b) => a + b, 0)), 'red']], cx, s.h * 0.44, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('never', 0.6), () => {
      s.text('one sample: can be below 0', cx, s.h * 0.5, { size: 3, color: s.c('--ink-3') });
      s.text('average over samples: never', cx, s.h * 0.545, { size: 3, color: s.c('--ink-3') });
    });
    s.show('f', s.ease('pen', 0.6));
    // The reward, with the penalty cut from its end.
    const eg = s.ease('eg', 0.8, 0.6);
    s.alpha(s.ease('eg', 0.6), () => {
      const x0 = cx - 30 * s.u;
      const len = 60 * s.u;
      const yb = s.h * 0.8;
      s.rrect(x0, yb - 2.5 * s.u, len * (1 - 0.2 * eg), 5 * s.u, 0.8, { fill: s.tint('gold', 0.45), stroke: s.tint('gold', 0.9), lw: 0.25 });
      s.alpha(eg, () => s.rrect(x0 + len * 0.8, yb - 2.5 * s.u, len * 0.2, 5 * s.u, 0.8, { fill: s.tint('red', 0.25), stroke: s.tint('red', 0.8), lw: 0.25 }));
      s.text('R = 1', x0, yb - 5.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
      s.alpha(eg, () => {
        s.text('0.1 × 2 = 0.2', x0 + len, yb - 5.5 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('red') });
        rich(s, [['trains on ', '--ink-2'], ['1 − 0.2 = 0.8', 'gold']], cx, yb + 8 * s.u, { size: 3.4, weight: 600 });
      });
    });
  },
};

/** Reward against drift: it keeps rising, while what we want peaks and then falls. */
const reward = (k: number) => 2 * (1 - Math.exp(-k / 2));
const quality = (k: number) => 1.5 * (1 - Math.exp(-k / 2)) - 0.03 * k * k;
/** Where reward minus β times drift is largest: the slope of the reward equals β. */
const best = (b: number) => Math.min(10, Math.max(0, -2 * Math.log(b)));

const beta: SceneDef = {
  draw(s) {
    const F = frame(s.w / 2 - 36 * s.u, s.h * 0.14, s.w / 2 + 36 * s.u, s.h * 0.78, [0, 10], [0, 2.2]);
    axes(s, F, 'drift (KL)', 'reward', { x: 'red', y: 'gold' });
    curve(s, F, reward, 0, 10, 'gold');
    s.alpha(s.ease('small', 0.6, 2), () => {
      curve(s, F, quality, 0, 10, 'slate', { dash: [1.4, 1], width: 0.45 });
      s.text('what we want', F.X(3.5), F.Y(quality(3.5)) - 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('slate'), halo: true });
    });
    const pt = (b: number, label: string, beat: string, k: 'green' | 'red' | 'blue', below: boolean) =>
      s.alpha(s.ease(beat, 0.6), () => {
        const x = best(b);
        ball(s, F.X(x), F.Y(reward(x)), k, 1.6);
        s.text(label, F.X(x) + (x > 9 ? -2 : 3) * s.u, F.Y(reward(x)) + (below ? 4.5 : -2.5) * s.u, { size: 3, font: 'mono', weight: 650, align: x > 9 ? 'right' : 'left', color: s.c(k), halo: true });
      });
    pt(10, 'β = 10', 'big', 'blue', false);
    pt(0.001, 'β = 0.001 →', 'small', 'red', true);
    pt(0.1, 'β = 0.1', 'mid', 'green', true);
    const cap = (t: string, beat: string, until?: string) => s.alpha(s.win(beat, until), () => s.text(t, s.w / 2, s.h * 0.9, { size: 3.2, color: s.c('--ink-2') }));
    cap('stays at the start: little gain', 'big', 'small');
    cap('drifts far: high reward, poor answers', 'small', 'mid');
    cap('in between: better, still itself', 'mid');
  },
};

export const scenes: Record<string, SceneDef> = { drift, sum, beta };
