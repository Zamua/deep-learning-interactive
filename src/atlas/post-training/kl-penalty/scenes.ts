import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { ball } from '../../optimization/draw';
import { axes, curve, fmt, frame, rich } from '../draw';

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
    pairs(s, xs, { ref, hi: [s.win('value', 'neg'), 0, s.ease('neg', 0.6)] });
    const y = s.h * 0.66;
    s.alpha(s.ease('ratio', 0.6, 1), () => {
      rowLabel(s, 'ln π/π_ref', xs[0]! - 9 * s.u, y, 'red', 2.8);
      const on = [s.ease('value', 0.6), 0, s.ease('neg', 0.6)];
      cells(s, xs, y, LR.map((v) => fmt(v)), 'red', { w: 13, h: 7, on });
    });
    s.alpha(s.win('value', 'neg'), () => rich(s, [['ln(0.6 / 0.3) = ln 2 ≈ ', '--ink-2'], ['0.69', 'red']], s.w / 2, s.h * 0.8, { size: 3.3 }));
    s.alpha(s.ease('neg', 0.6, 0.8), () => rich(s, [['ln(0.37 / 0.5) ≈ ', '--ink-2'], ['−0.30', 'red'], [': liked less', '--ink-3']], s.w / 2, s.h * 0.8, { size: 3.3 }));
    s.alpha(s.ease('drift', 0.6, 1.5) * (1 - ref), () => s.text('the model being trained', s.w / 2, s.h * 0.8, { size: 3.2, color: s.c('teal') }));
    s.alpha(ref * (1 - s.ease('value', 0.5)), () => s.text('beside the frozen reference', s.w / 2, s.h * 0.8, { size: 3.2, color: s.c('slate') }));
  },
};

const sum: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{R}{R} - \sym{beta}{\beta} \sum_t \ln\frac{\sym{pi}{\pi}(y_t)}{\sym{piref}{\pi_{\text{ref}}}(y_t)}`, x: 0.5, y: 0.52, size: 4.6 },
  },
  draw(s) {
    const xs = columns(s, 3, 22);
    const y = s.h * 0.2;
    TOK.forEach((t, i) => s.text(t, xs[i]!, y - 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    rowLabel(s, 'ln π/π_ref', xs[0]! - 8 * s.u, y, 'red', 2.8);
    cells(s, xs, y, LR.map((v) => fmt(v)), 'red', { w: 13, h: 7, on: LR.map(() => s.win('sum', 'never') * 0.6) });
    s.alpha(s.ease('sum', 0.6, 1), () => rich(s, [['sum = 0.69 + 1.61 − 0.30 = ', '--ink-2'], [fmt(SUM), 'red']], s.w / 2, y + 9 * s.u, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('never', 0.6), () => {
      s.text('one sample: can be below 0', s.w / 2, y + 16 * s.u, { size: 3, color: s.c('--ink-3') });
      s.text('average over samples: never', s.w / 2, y + 20.5 * s.u, { size: 3, color: s.c('--ink-3') });
    });
    s.show('f', s.ease('pen', 0.6));
    // The reward, with the penalty cut from its end.
    const eg = s.ease('eg', 0.8, 0.6);
    s.alpha(s.ease('eg', 0.6), () => {
      const x0 = s.w / 2 - 30 * s.u;
      const len = 60 * s.u;
      const yb = s.h * 0.72;
      s.rrect(x0, yb - 2.5 * s.u, len * (1 - 0.2 * eg), 5 * s.u, 0.8, { fill: s.tint('gold', 0.45), stroke: s.tint('gold', 0.9), lw: 0.25 });
      s.alpha(eg, () => s.rrect(x0 + len * 0.8, yb - 2.5 * s.u, len * 0.2, 5 * s.u, 0.8, { fill: s.tint('red', 0.25), stroke: s.tint('red', 0.8), lw: 0.25 }));
      s.text('R = 1', x0, yb - 5.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
      s.alpha(eg, () => {
        s.text('0.1 × 2 = 0.2', x0 + len, yb - 5.5 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('red') });
        rich(s, [['trains on ', '--ink-2'], ['1 − 0.2 = 0.8', 'gold']], s.w / 2, yb + 8 * s.u, { size: 3.4, weight: 600 });
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
