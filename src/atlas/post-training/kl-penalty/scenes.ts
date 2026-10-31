import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { axes, curve, frame } from '../../optimization/draw';
import { fmt } from '../../training/draw';
import { ball } from '../../optimization/draw';

const TOK = ['sure', 'thing', '!'];
const PI = [0.6, 0.5, 0.37];
const REF = [0.3, 0.1, 0.5];
const LR = PI.map((p, i) => Math.log(p / REF[i]!));

const line = (s: Scene, runs: [string, Ink][], y: number, a: number, size = 3.2) => s.alpha(a, () => rich(s, runs, s.w / 2, y, { size }));

// ---- reward against drift: the reward keeps rising, while what we want peaks and then falls

const reward = (k: number) => 2 * (1 - Math.exp(-k / 2));
const quality = (k: number) => 1.5 * (1 - Math.exp(-k / 2)) - 0.03 * k * k;
/** Where reward minus β times drift is largest: the slope of the reward equals β. */
const best = (b: number) => Math.min(10, Math.max(0, -2 * Math.log(b)));

/** The plot both curve scenes share, so the last scene returns to the first picture. */
function plot(s: Scene, xName: string, ref = 0) {
  const F = frame(s.w / 2 - 38 * s.u, s.h * 0.15, s.w / 2 + 38 * s.u, s.h * 0.71, [0, 10], [0, 2.2]);
  axes(s, F, xName, 'score', { x: 'red', y: '--ink-2' });
  const o = { size: 3, font: 'mono', align: 'left', color: s.c('slate') } as const;
  s.alpha(1 - ref, () => s.text('the start', F.l, F.b + 4 * s.u, o));
  s.alpha(ref, () => s.text('π_ref: the start', F.l, F.b + 4 * s.u, { ...o, weight: 650 }));
  return F;
}

/** The reward and the dashed "what we want" curves, drawn up to drift `k`. */
function curves(s: Scene, F: ReturnType<typeof frame>, k: number, labels = 1) {
  if (k <= 0) return;
  curve(s, F, reward, 0, k, 'gold');
  curve(s, F, quality, 0, k, 'slate', { dash: [1.4, 1], width: 0.45 });
  const a = Math.min(1, k / 3);
  s.alpha(labels * a, () => s.text('reward', F.X(Math.min(k, 9.6)), F.Y(reward(Math.min(k, 9.6))) - 3.5 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true }));
  s.alpha(a, () => s.text('what we want', F.X(2.6), F.Y(quality(2.6)) + 4.5 * s.u, { size: 2.8, font: 'mono', color: s.c('slate'), halo: true }));
}

const drift: SceneDef = {
  draw(s) {
    const ref = s.ease('ref', 0.6, 1);
    const F = plot(s, 'drift →', ref);
    const k = 3 * s.ease('climb', 2.4, 0.8) + 7 * s.ease('far', 3, 1.2);
    curves(s, F, k);
    // Past the peak, the reward is being fooled.
    s.alpha(after(s, 'far', 0.55), () => {
      s.rrect(F.X(6.5), F.t, F.r - F.X(6.5), F.b - F.t, 0, { fill: s.tint('red', 0.08) });
      s.text('scores well,', F.X(8.25), F.Y(1.1), { size: 2.9, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      s.text('makes no sense', F.X(8.25), F.Y(1.1) + 4 * s.u, { size: 2.9, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    s.alpha(s.ease('ziegler', 0.6, 1.5) * (1 - s.ease('ref', 0.5)), () => {
      s.text('no penalty:', F.X(8.25), F.Y(0.55), { size: 2.9, font: 'mono', color: s.c('red'), halo: true });
      s.text('gibberish', F.X(8.25), F.Y(0.55) + 4 * s.u, { size: 2.9, font: 'mono', color: s.c('red'), halo: true });
    });
    cite(s, 'Ziegler et al., 2019', s.win('ziegler', 'ref'));
    // The frozen start, and the charge for the distance from it.
    s.alpha(ref, () => ball(s, F.X(0), F.Y(0), 'slate', 1.6));
    // The model now, and its drift from the start, which is what gets charged.
    const at = 4.6;
    s.alpha(s.ease('ref', 0.6, 2.2), () => {
      const y = F.Y(reward(at));
      ball(s, F.X(at), y, 'teal', 1.6);
      s.text('π', F.X(at) + 2.5 * s.u, y + 3.5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('teal'), halo: true });
      s.line(F.X(0), y, F.X(0), F.b, s.c('slate'), 0.3, [1, 0.8]);
      s.arrow(F.X(at) - 2.2 * s.u, y, F.X(0) + 0.6 * s.u, y, s.c('red'), 0.4, 1.8);
      s.text('drift: charged', F.X(at / 2), y - 3 * s.u, { size: 2.9, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    const cy = s.h * 0.88;
    s.alpha(s.win('climb', 'far'), () => s.text('at first, drift helps', s.w / 2, cy, { size: 3.3, color: s.c('--ink-2') }));
    s.alpha(s.win('far', 'ref'), () => s.text('pushed far, the reward is fooled', s.w / 2, cy, { size: 3.3, color: s.c('--ink-2') }));
    s.alpha(s.ease('ref', 0.6, 1), () => rich(s, [['the KL penalty: ', '--ink-2'], ['charge π for drifting', 'red']], s.w / 2, cy, { size: 3.3 }));
    s.alpha(after(s, 'ref', 0.6), () => s.text('KL: Kullback and Leibler', s.w / 2, cy + 5 * s.u, { size: 3, color: s.c('--ink-3') }));
  },
};

// ---- one answer, token by token: each model's probability, and the log of their ratio

/** Token chips over paired bars: π (the model being trained) beside π_ref (the frozen start). */
function pairs(s: Scene, xs: number[], o: { ref: number; bars: number; hi?: number[] }): void {
  const base = s.h * 0.5;
  const H = 30;
  TOK.forEach((t, i) => s.cell(xs[i]! - 7 * s.u, s.h * 0.1 - 4 * s.u, 14 * s.u, 8 * s.u, t, 'purple', { on: o.hi?.[i] ?? 0, size: 3.4 }));
  s.alpha(o.bars, () => {
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
    rowLabel(s, 'π', xs[0]! - 12 * s.u, base - 12 * s.u, 'teal', 3.6);
    s.alpha(o.ref, () => rowLabel(s, 'π_ref', xs[0]! - 12 * s.u, base - 5 * s.u, 'slate', 3));
  });
}

const ratio: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 26);
    const most = s.ease('most', 0.6);
    const on = [s.win('sure', 'neg'), most, s.win('neg', 'most')];
    pairs(s, xs, { ref: s.ease('tokens', 0.8, 2.2), bars: s.ease('tokens', 0.8, 1), hi: on });
    const y = s.h * 0.6;
    const shown = [s.ease('ln', 0.6, 1), s.ease('most', 0.6, 1.2), s.ease('neg', 0.6, 2)];
    s.alpha(Math.max(...shown), () => rowLabel(s, 'ln π/π_ref', xs[0]! - 9 * s.u, y, 'red', 2.8));
    xs.forEach((x, i) => s.alpha(shown[i]!, () => cells(s, [x], y, [fmt(LR[i]!)], 'red', { w: 13, h: 7, on: [on[i]!] })));
    const y1 = s.h * 0.74;
    const y2 = s.h * 0.82;
    const y3 = s.h * 0.9;
    s.alpha(s.win('tokens', 'sure'), () => s.text('one sampled answer, both models asked', s.w / 2, y1, { size: 3.2, color: s.c('--ink-2') }));
    line(s, [['sure: 0.6 / 0.3 = ', '--ink-2'], ['2', 'teal'], [': twice as likely', '--ink-3']], y1, s.win('sure', 'surprise'));
    line(s, [['ln 2 ≈ ', '--ink-2'], ['0.69', 'red'], [': the log-ratio', '--ink-3']], y2, s.win('ln', 'surprise'));
    // Surprise, −ln p, for each model, and the gap between them.
    const sp = s.win('surprise', 'neg');
    line(s, [['π_ref’s surprise: −ln 0.3 = ', '--ink-2'], ['1.20', 'slate']], y1, sp);
    line(s, [['π’s surprise:     −ln 0.6 = ', '--ink-2'], ['0.51', 'teal']], y2, s.ease('surprise', 0.6, 2.5) * (1 - s.ease('neg', 0.6)));
    line(s, [['gap: 1.20 − 0.51 = ', '--ink-2'], ['0.69', 'red']], y3, s.win('diff', 'neg'));
    line(s, [['ln(0.37 / 0.5) ≈ ', '--ink-2'], ['−0.30', 'red'], [': liked less', '--ink-3']], y1, s.win('neg', 'most'));
    line(s, [['thing: 0.5 / 0.1 = ', '--ink-2'], ['5', 'red'], ['   sure: 2', '--ink-3']], y1, most);
    line(s, [['largest ratio, largest log: ', '--ink-2'], ['1.61', 'red']], y2, s.ease('most', 0.6, 2.5));
  },
};

// ---- the penalty: the log-ratios summed, averaged into the KL divergence, scaled by β

const LRr = LR.map((v) => Math.round(v * 100) / 100);

const sum: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{R}{R} \;-\; \sym{beta}{\beta} \sum_{\text{tokens}} \ln\dfrac{\sym{pi}{\pi}}{\sym{piref}{\pi_{\text{ref}}}}`, x: 0.5, y: 0.62, size: 4.2 },
  },
  draw(s) {
    const cx = s.w / 2;
    const xs = columns(s, 3, 22);
    TOK.forEach((t, i) => s.text(t, xs[i]!, s.h * 0.13, { size: 3.2, font: 'mono', color: s.c('purple') }));
    const hot = s.win('sum', 'kl');
    cells(s, xs, s.h * 0.2, LRr.map((v) => fmt(v)), 'red', { w: 14, h: 7, on: LRr.map(() => hot) });
    rowLabel(s, 'log-ratio', xs[0]! - 9 * s.u, s.h * 0.2, 'red', 2.8);
    s.alpha(s.ease('sum', 0.6, 1.5), () => rich(s, [['sum = 0.69 + 1.61 − 0.30 = ', '--ink-2'], ['2.00', 'red']], cx, s.h * 0.29, { size: 3.3, weight: 600 }));
    const kl = s.ease('kl', 0.6, 1.2);
    s.alpha(kl, () => rich(s, [['average over many answers: ', '--ink-2'], ['the KL divergence', 'red']], cx, s.h * 0.37, { size: 3.1 }));
    cite(s, 'Kullback & Leibler, 1951', s.win('names', 'never'));
    s.alpha(s.win('names', 'never'), () => s.text('On Information and Sufficiency', cx, s.h * 0.44, { size: 3, italic: true, color: s.c('--ink-3') }));
    s.alpha(s.ease('never', 0.6), () => {
      s.text('one answer: can be below 0', cx, s.h * 0.44, { size: 3, color: s.c('--ink-3') });
      s.text('the average: never; 0 when they agree', cx, s.h * 0.485, { size: 3, color: s.c('--ink-3') });
    });
    s.show('f', s.ease('pen', 0.6));
    // The reward, with the penalty cut from its end.
    const eg = s.ease('eg', 0.8, 0.6);
    s.alpha(s.ease('eg', 0.6), () => {
      const x0 = cx - 30 * s.u;
      const len = 60 * s.u;
      const yb = s.h * 0.79;
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

// ---- how hard to hold on: where each β settles on the first picture

const beta: SceneDef = {
  draw(s) {
    const F = plot(s, 'drift: KL →');
    curves(s, F, 10, 1 - s.ease('big', 0.6, 1));
    const pt = (b: number, label: string, beat: string, k: 'green' | 'red' | 'blue', below: boolean) =>
      s.alpha(s.ease(beat, 0.6, beat === 'big' ? 2 : 0), () => {
        const x = best(b);
        ball(s, F.X(x), F.Y(reward(x)), k, 1.6);
        s.text(label, F.X(x) + (x > 9 ? -2 : 3) * s.u, F.Y(reward(x)) + (below ? 4.5 : -2.5) * s.u, { size: 3, font: 'mono', weight: 650, align: x > 9 ? 'right' : 'left', color: s.c(k), halo: true });
      });
    pt(10, 'β = 10', 'big', 'blue', false);
    pt(0.001, 'β = 0.001', 'small', 'red', true);
    pt(0.1, 'β = 0.1', 'mid', 'green', true);
    const cap = (t: string, a: number) => s.alpha(a, () => s.text(t, s.w / 2, s.h * 0.89, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.ease('big', 0.6), () => s.text('β: the price of drift', s.w / 2, s.h * 0.82, { size: 3.2, font: 'mono', weight: 600, color: s.c('slate') }));
    cap('stays at the start: little gain', s.ease('big', 0.6, 2) * (1 - s.ease('small', 0.6)));
    cap('drifts far: high reward, poor answers', s.win('small', 'mid'));
    cap('in between: better, still itself', s.ease('mid', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { drift, ratio, sum, beta };
