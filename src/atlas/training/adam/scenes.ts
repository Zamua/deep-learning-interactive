import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { bars, cells, columns } from '../../draw';
import { axes, frame, series, xTicks, yTicks } from '../draw';

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
const line = (s: Scene, t: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.6) => s.text(t, s.w / 2, y, { size, font: 'mono', color: s.c(k) });

/** The running example after steps 1 and 2: gradients 2 then -4. */
const TABLE: [string, string, string, string][] = [
  ['t = 1', '2', '0.2', '0.004'],
  ['t = 2', '−4', '−0.22', '0.02'],
];

/** One update's mix as a bar: the share `keep` of the old average, and the rest from the new gradient. */
function split(s: Scene, y: number, keep: number, k: 'gold' | 'purple', kept: string, taken: string): void {
  const x0 = s.w / 2 - 40 * s.u;
  const w = 80 * s.u;
  const h = 6 * s.u;
  const cut = x0 + w * keep;
  s.rrect(x0, y - h / 2, cut - x0, h, 0.8, { fill: s.tint(k, 0.55) });
  s.rrect(cut, y - h / 2, Math.max(0.7 * s.u, x0 + w - cut), h, 0.8, { fill: s.tint('red', 0.75) });
  s.text(kept, x0, y - h / 2 - 3 * s.u, { size: 3.4, font: 'mono', align: 'left', color: s.c(k) });
  s.text(taken, x0 + w, y - h / 2 - 3 * s.u, { size: 3.4, font: 'mono', align: 'right', color: s.c('red') });
}

const moments: SceneDef = {
  marks: {
    m: { tex: String.raw`\symm \leftarrow \sym{beta1}{\beta_1} \symm + (1 - \sym{beta1}{\beta_1})\,\symg`, x: 0.5, y: 0.09, size: 4.6 },
    mom: { tex: String.raw`\text{momentum: } v \leftarrow \mu v - \symeta\,\symg`, x: 0.5, y: 0.2, size: 4.6 },
    v: { tex: String.raw`\symv \leftarrow \sym{beta2}{\beta_2} \symv + (1 - \sym{beta2}{\beta_2})\,\symg^2`, x: 0.5, y: 0.2, size: 4.6 },
    m2: { tex: String.raw`\symm = 0.9 \times 0.2 + 0.1 \times (-4) = 0.18 - 0.4 = -0.22`, x: 0.5, y: 0.75, size: 4 },
    v2: { tex: String.raw`\symv = 0.999 \times 0.004 + 0.001 \times 16 \approx 0.02`, x: 0.5, y: 0.85, size: 4 },
  },
  draw(s) {
    s.show('m', s.ease('m', 0.6));
    s.show('mom', s.win('mom', 'v'));
    s.show('v', s.ease('v', 0.6));
    s.alpha(s.win('mnum', 'mom'), () => line(s, 'β₁ = 0.9', s.h * 0.31, '--ink-2', 3.8));
    s.alpha(s.win('mom', 'v'), () => line(s, 'm: no η, and g weighted by 1 − β₁', s.h * 0.31, 'gold'));
    s.alpha(s.win('v', 'vnum'), () => line(s, 'β₁ = 0.9', s.h * 0.31, '--ink-2', 3.8));
    const early = 1 - s.ease('zero', 0.6);
    s.alpha(s.ease('mnum', 0.6) * early, () => split(s, s.h * 0.5, 0.9, 'gold', '0.9 of m', '0.1 of g'));
    s.alpha(s.ease('vnum', 0.6) * early, () => split(s, s.h * 0.68, 0.999, 'purple', '0.999 of v', '0.001 of g²'));
    s.alpha(s.ease('vnum', 0.6), () => line(s, 'β₁ = 0.9    β₂ = 0.999', s.h * 0.31, '--ink-2', 3.8));
    const two = s.ease('two', 0.6);
    s.show('m2', after(s, 'two', 0.15) * two);
    s.show('v2', after(s, 'two', 0.6) * two);
    s.alpha(two, () => {
      const xs = columns(s, 4, s.tall ? 22 : 24);
      const hy = s.h * 0.42;
      (['', 'g', 'm', 'v'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 3.8, font: 'mono', weight: 650, color: s.c((['--ink-2', 'red', 'gold', 'purple'] as const)[j]) }));
      TABLE.forEach(([t, g, m, v], i) => {
        const y = hy + (i + 1) * 10 * s.u;
        const on = i === 1 ? 1 : 0;
        s.text(t, xs[0]!, y, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        cells(s, [xs[1]!], y, [g], 'red', { w: 14, h: 7.5, size: 3.4 });
        s.alpha(i === 0 ? 1 : after(s, 'two', 0.15), () => cells(s, [xs[2]!], y, [m], 'gold', { w: 16, h: 7.5, size: 3.4, on: [on] }));
        s.alpha(i === 0 ? 1 : after(s, 'two', 0.6), () => cells(s, [xs[3]!], y, [v], 'purple', { w: 16, h: 7.5, size: 3.4, on: [on] }));
      });
    });
    s.alpha(1 - two, () => {
      const grow = s.ease('zero', 1, 1.5);
      const gap = s.tall ? 13 : 15;
      const base = s.h * 0.86;
      const height = (s.h * 0.36) / s.u;
      const left = s.w / 2 - (s.tall ? 22 : 26) * s.u;
      const right = s.w / 2 + (s.tall ? 22 : 26) * s.u;
      const group = (cx: number, at: string, target: number, tName: string, val: number, name: string, k: 'gold' | 'purple', fmt: (v: number) => string) => {
        s.alpha(s.ease(at, 0.6, 1), () => {
          const xs = [cx - (gap / 2) * s.u, cx + (gap / 2) * s.u];
          bars(s, [xs[0]!], base, [target], 'red', { max: target, height, fmt: (v) => String(v) });
          bars(s, [xs[1]!], base, [val * grow], k, { max: target, height, fmt: () => fmt(val), grow: grow > 0.01 ? 1 : 0 });
          s.text(tName, xs[0]!, base + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
          s.text(name, xs[1]!, base + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
        });
      };
      group(left, 'zero', 2, 'g', 0.2, 'm', 'gold', () => '0.2');
      group(right, 'zero', 4, 'g²', 0.004, 'v', 'purple', () => '0.004');
      s.alpha(s.ease('zero', 0.6, 3), () => s.text('far too small', s.w / 2, s.h * 0.4, { size: 3.6, weight: 600, color: s.c('red') }));
    });
  },
};

const RATIO: [number, number][] = Array.from({ length: 30 }, (_, i) => [i + 1, 1 - 0.9 ** (i + 1)]);

const correct: SceneDef = {
  marks: {
    mh: { tex: String.raw`\hat \symm = \dfrac{\symm}{1 - \sym{beta1}{\beta_1}^{\,t}}`, x: 0.28, y: 0.14, size: 4.6 },
    vh: { tex: String.raw`\hat \symv = \dfrac{\symv}{1 - \sym{beta2}{\beta_2}^{\,t}}`, x: 0.72, y: 0.14, size: 4.6 },
  },
  draw(s) {
    s.show('mh', s.ease('bias', 0.6));
    s.show('vh', s.ease('bias', 0.6, 3));
    const later = s.ease('later', 0.7);
    const second = s.win('second', 'later', 0.7);
    s.alpha(1 - s.ease('second', 0.5), () => {
      const cols = [s.w * 0.3, s.w * 0.7];
      const vals: [string, string, string, 'gold' | 'purple'][] = [
        ['m = 0.2', '÷ (1 − 0.9) = ÷ 0.1', 'm̂ = 2', 'gold'],
        ['v = 0.004', '÷ (1 − 0.999) = ÷ 0.001', 'v̂ = 4', 'purple'],
      ];
      vals.forEach(([a, op, b, k], j) => {
        const x = cols[j]!;
        const delay = j === 0 ? 0 : 3.5;
        s.alpha(s.ease('first', 0.6, delay), () => {
          cells(s, [x], s.h * 0.38, [a], k, { w: s.tall ? 34 : 30, h: 8, size: 3.4 });
          s.text(op, x, s.h * 0.5, { size: s.tall ? 2.8 : 3.2, font: 'mono', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('first', 0.6, delay + 1.5), () => cells(s, [x], s.h * 0.62, [b], k, { w: s.tall ? 34 : 30, h: 8, size: 3.4, on: [1] }));
      });
      s.alpha(s.ease('first', 0.6, 6), () => s.text('exactly g and g² at step 1', s.w / 2, s.h * 0.78, { size: 3.6, weight: 600, color: s.c('green') }));
    });
    s.alpha(second, () => {
      const w = s.tall ? 40 : 36;
      cells(s, [s.w / 2], s.h * 0.36, ['m = −0.22'], 'gold', { w, h: 8, size: 3.4 });
      s.alpha(after(s, 'second', 0.05), () => line(s, '0.9² = 0.81', s.h * 0.46, '--ink-2', 3.4));
      s.alpha(after(s, 'second', 0.3), () => line(s, '÷ (1 − 0.81) = ÷ 0.19', s.h * 0.53, '--ink-2', 3.4));
      s.alpha(after(s, 'second', 0.55), () => cells(s, [s.w / 2], s.h * 0.63, ['m̂ ≈ −1.16'], 'gold', { w, h: 8, size: 3.4, on: [1] }));
      s.alpha(after(s, 'second', 0.75), () => s.text('between the gradients 2 and −4', s.w / 2, s.h * 0.78, { size: 3.6, weight: 600, color: s.c('green') }));
    });
    s.alpha(later, () => {
      const F = frame(14 * s.u, s.h * 0.32, s.w - 8 * s.u, s.h - 9 * s.u, [0, 30], [0, 1.1]);
      axes(s, F, 't', '', { x: '--ink-3', y: '--ink-3' });
      xTicks(s, F, [1, 10, 20]);
      yTicks(s, F, [0, 0.5, 1]);
      s.line(F.l, F.Y(1), F.r, F.Y(1), s.tint('green', 0.6), 0.3, [1.2, 1]);
      series(s, F, RATIO, 'gold', { upto: Math.max(0, Math.min(1, (s.since('later') - 0.5) / 3)), dots: 0.6 });
      s.text('1 − 0.9ᵗ', F.X(30), F.Y(0.72), { size: 3.4, font: 'mono', align: 'right', color: s.c('gold'), halo: true });
    });
  },
};

const ROWS: [string, string, string, string][] = [
  ['a', '500', '0.5', '0.001'],
  ['b', '0.002', '0.000002', '0.001'],
];

const step: SceneDef = {
  marks: {
    step: { tex: String.raw`\symw \leftarrow \symw - \symeta\,\dfrac{\hat \symm}{\sqrt{\hat \symv} + \epsilon}`, x: 0.5, y: 0.13, size: 4.8 },
  },
  draw(s) {
    s.show('step', s.ease('step', 0.6));
    const xs = columns(s, 4, s.tall ? 23 : 26);
    const hy = s.h * 0.36;
    s.alpha(s.ease('first', 0.6), () => {
      (['', 'g', 'plain: ηg', 'Adam'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 3.4, font: 'mono', weight: 650, color: s.c((['--ink-2', 'red', 'slate', 'green'] as const)[j]) }));
      s.text('η = 0.001, first step', s.w / 2, s.h * 0.27, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
    });
    ROWS.forEach((r, i) => {
      const y = hy + (i + 1) * 12 * s.u;
      s.alpha(s.ease('first', 0.6, 1 + i * 1.2), () => {
        s.text(r[0], xs[0]!, y, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2') });
        cells(s, [xs[1]!], y, [r[1]], 'red', { w: 18, h: 8, size: 3.2 });
        cells(s, [xs[2]!], y, [r[2]], 'slate', { w: 20, h: 8, size: 3.2 });
        cells(s, [xs[3]!], y, [r[3]], 'green', { w: 18, h: 8, size: 3.2, on: [s.ease('per', 0.6)] });
      });
    });
    s.alpha(s.ease('first', 0.6, 4), () => s.text('plain: 250,000 times apart', xs[2]!, hy + 31 * s.u, { size: 3, font: 'mono', color: s.c('slate') }));
    s.alpha(s.ease('per', 0.6, 1), () => s.text('Adam: about η each, whatever the scale', s.w / 2, s.h * 0.86, { size: 3.6, weight: 600, color: s.c('green') }));
  },
};

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\symm = 0.5,\quad \sym{beta1}{\beta_1} = 0.9,\quad \symg = 3`, x: 0.5, y: 0.1, size: 4.6 },
    a1a: { tex: String.raw`\symm \leftarrow 0.9 \times 0.5 + 0.1 \times 3`, x: 0.5, y: 0.62, size: 4.6 },
    a1b: { tex: String.raw`= 0.45 + 0.3 = 0.75`, x: 0.5, y: 0.74, size: 4.6 },
    q2: { tex: String.raw`\hat \symm = 4,\quad \hat \symv = 4,\quad \symeta = 0.01`, x: 0.5, y: 0.1, size: 4.6 },
    a2a: { tex: String.raw`\sqrt{\hat \symv} = \sqrt{4} = 2`, x: 0.5, y: 0.34, size: 4.8 },
    a2b: { tex: String.raw`\hat \symm / \sqrt{\hat \symv} = 4 / 2 = 2`, x: 0.5, y: 0.5, size: 4.8 },
    a2c: { tex: String.raw`\text{step} = 2\,\symeta = 0.02`, x: 0.5, y: 0.66, size: 4.8 },
  },
  draw(s) {
    const one = 1 - s.ease('p2', 0.5);
    s.show('q1', s.ease('p1', 0.6) * one);
    s.show('a1a', after(s, 'a1', 0.05) * one);
    s.show('a1b', after(s, 'a1', 0.4) * one);
    s.alpha(s.ease('p1', 0.6, 0.5) * one, () => {
      const y = s.h * 0.34;
      const l = s.w / 2 - 38 * s.u;
      const X = (v: number) => l + (v / 3.2) * 76 * s.u;
      s.line(l, y, X(3.2), y, s.c('--axis'), 0.4);
      const dot = (v: number, k: 'gold' | 'red', r = 1.4) => s.circle(X(v), y, r * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
      const lab = (t: string, v: number, dy: number, k: 'gold' | 'red' | '--ink-2', a: CanvasTextAlign = 'center') => s.text(t, X(v), y + dy * s.u, { size: 3.4, font: 'mono', align: a, color: s.c(k), halo: true });
      dot(0.5, 'gold');
      lab('m = 0.5', 0.5, -4.5, 'gold');
      dot(3, 'red');
      lab('g = 3', 3, -4.5, 'red');
      s.alpha(after(s, 'a1', 0.4), () => {
        s.arrow(X(0.5), y + 3 * s.u, X(0.75), y + 3 * s.u, s.c('gold'), 0.4, 1.6);
        dot(0.75, 'gold', 1.8);
        lab('0.75: a tenth of the way to g', 0.5, 8, '--ink-2', 'left');
      });
    });
    const two = s.ease('p2', 0.6, 0.4);
    s.show('q2', two);
    s.show('a2a', after(s, 'a2', 0.05) * two);
    s.show('a2b', after(s, 'a2', 0.35) * two);
    s.show('a2c', after(s, 'a2', 0.65) * two);
  },
};

export const scenes: Record<string, SceneDef> = { moments, correct, step, try: tryIt };
