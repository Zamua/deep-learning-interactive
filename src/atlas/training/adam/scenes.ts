import type { SceneDef } from '../../../lecture/scene';
import { bars, cells, columns } from '../../draw';
import { axes, frame, series, xTicks, yTicks } from '../draw';

const moments: SceneDef = {
  marks: {
    m: { tex: String.raw`\symm \leftarrow \sym{beta1}{\beta_1} \symm + (1 - \sym{beta1}{\beta_1})\,\symg`, x: 0.5, y: 0.09, size: 4.6 },
    v: { tex: String.raw`\symv \leftarrow \sym{beta2}{\beta_2} \symv + (1 - \sym{beta2}{\beta_2})\,\symg^2`, x: 0.5, y: 0.2, size: 4.6 },
  },
  draw(s) {
    s.show('m', s.ease('m', 0.6));
    s.show('v', s.ease('v', 0.6));
    s.alpha(s.ease('betas', 0.6), () => s.text('β₁ = 0.9    β₂ = 0.999', s.w / 2, s.h * 0.31, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
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
    group(left, 'm', 2, 'g', 0.2, 'm', 'gold', () => '0.2');
    group(right, 'v', 4, 'g²', 0.004, 'v', 'purple', () => '0.004');
    s.alpha(s.ease('zero', 0.6, 3), () => s.text('far too small', s.w / 2, s.h * 0.4, { size: 3.6, weight: 600, color: s.c('red') }));
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
    s.alpha(1 - later, () => {
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

export const scenes: Record<string, SceneDef> = { moments, correct, step };
