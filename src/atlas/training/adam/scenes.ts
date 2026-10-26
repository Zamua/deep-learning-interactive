import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { cells, columns } from '../../draw';
import { axes, frame, series, xTicks, yTicks } from '../draw';

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
const line = (s: Scene, t: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.6) => s.text(t, s.w / 2, y, { size, font: 'mono', color: s.c(k) });

const RATIO: [number, number][] = Array.from({ length: 30 }, (_, i) => [i + 1, 1 - 0.9 ** (i + 1)]);

const correct: SceneDef = {
  marks: {
    mh: { tex: String.raw`\hat \symm = \dfrac{\symm}{1 - \sym{beta1}{\beta_1}^{\,t}}`, x: 0.28, y: 0.14, size: 4.6 },
    vh: { tex: String.raw`\hat \symv = \dfrac{\symv}{1 - \sym{beta2}{\beta_2}^{\,t}}`, x: 0.72, y: 0.14, size: 4.6 },
  },
  draw(s) {
    s.alpha(s.win('recap', 'bias'), () => line(s, 'm and v start at 0', s.h * 0.14, '--ink-2', 3.8));
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
      const recap = 1 - s.ease('first', 0.5);
      const should = ['vs g = 2', 'vs g² = 4'];
      vals.forEach(([a, op, b, k], j) => {
        const x = cols[j]!;
        const delay = j === 0 ? 0 : 3.5;
        s.alpha(s.ease('recap', 0.6, j === 0 ? 0.5 : 2), () => cells(s, [x], s.h * 0.38, [a], k, { w: s.tall ? 34 : 30, h: 8, size: 3.4 }));
        s.alpha(after(s, 'recap', j === 0 ? 0.25 : 0.4) * recap, () => s.text(should[j]!, x, s.h * 0.5, { size: 3.2, font: 'mono', color: s.c('red') }));
        s.alpha(s.ease('first', 0.6, delay), () => s.text(op, x, s.h * 0.5, { size: s.tall ? 2.8 : 3.2, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(s.ease('first', 0.6, delay + 1.5), () => cells(s, [x], s.h * 0.62, [b], k, { w: s.tall ? 34 : 30, h: 8, size: 3.4, on: [1] }));
      });
      s.alpha(after(s, 'recap', 0.65) * recap, () => line(s, 't = 2, after g = −4:  m = −0.22', s.h * 0.62, 'gold', 3.4));
      s.alpha(after(s, 'recap', 0.45) * recap, () => s.text('dragged toward 0', s.w / 2, s.h * 0.78, { size: 3.6, weight: 600, color: s.c('red') }));
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
    q1: { tex: String.raw`\hat \symm = 4,\quad \hat \symv = 4,\quad \symeta = 0.01`, x: 0.5, y: 0.1, size: 4.6 },
    a1a: { tex: String.raw`\sqrt{\hat \symv} = \sqrt{4} = 2`, x: 0.5, y: 0.34, size: 4.8 },
    a1b: { tex: String.raw`\hat \symm / \sqrt{\hat \symv} = 4 / 2 = 2`, x: 0.5, y: 0.5, size: 4.8 },
    a1c: { tex: String.raw`\text{step} = 2\,\symeta = 0.02`, x: 0.5, y: 0.66, size: 4.8 },
  },
  draw(s) {
    s.show('q1', s.ease('p1', 0.6));
    s.show('a1a', after(s, 'a1', 0.05));
    s.show('a1b', after(s, 'a1', 0.35));
    s.show('a1c', after(s, 'a1', 0.65));
  },
};

export const scenes: Record<string, SceneDef> = { correct, step, try: tryIt };
