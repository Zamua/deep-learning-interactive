import type { SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel, verdict } from '../../draw';

const W = ['2', '−1', '0'];

const penalty: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \symL_{\text{data}} + \symlam \sum_i \symw_i^2`, x: 0.5, y: 0.1, size: 5.4 },
  },
  draw(s) {
    s.show('f', s.ease('add', 0.6));
    const xs = columns(s, 3, s.tall ? 20 : 22);
    const lx = xs[0]! - 13 * s.u;
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.5;
    s.alpha(s.ease('example', 0.6), () => {
      rowLabel(s, 'w', lx, y1, 'blue');
      cells(s, xs, y1, W, 'blue');
    });
    s.alpha(s.ease('example', 0.6, 2.5), () => {
      downArrows(s, xs, y1 + 5.5 * s.u, y2 - 5.5 * s.u);
      rowLabel(s, 'w²', lx, y2, 'blue');
      cells(s, xs, y2, ['4', '1', '0'], 'blue', { on: [1, 1, 1].map(() => s.win('sum', 'lam')) });
    });
    s.alpha(s.ease('sum', 0.6), () => {
      s.text('4 + 1 + 0 = 5', s.w / 2, s.h * 0.64, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('sum', 0.6, 2), () => {
      s.text('λ × 5 = 0.1 × 5 = 0.5', s.w / 2, s.h * 0.73, { size: 3.8, font: 'mono', weight: 600, color: s.c('slate') });
    });
    s.alpha(s.ease('lam', 0.6), () => {
      const l = s.w * 0.18;
      const r = s.w * 0.82;
      const y = s.h * 0.88;
      s.line(l, y, r, y, s.c('--axis'), 0.4);
      s.text('λ = 0: fit the data', l, y - 4 * s.u, { size: 3.2, align: 'left', color: s.c('--ink-2') });
      s.text('large λ: small weights', r, y - 4 * s.u, { size: 3.2, align: 'right', color: s.c('--ink-2') });
      const p = 0.5 + 0.45 * Math.sin(Math.max(0, s.since('lam') - 0.6) * 1.4);
      s.circle(l + (r - l) * p, y, 1.6 * s.u, { fill: s.c('slate'), stroke: s.c('--card'), lw: 0.4 });
    });
  },
};

const SHRINK = [2, 1.8, 1.62, 1.458, 1.312];

const decay: SceneDef = {
  marks: {
    g: { tex: String.raw`\frac{\partial}{\partial \symw}\,\symlam\symw^2 = 2\symlam\symw`, x: 0.5, y: 0.1, size: 5.2 },
    step: { tex: String.raw`\symw \leftarrow \symw - \symeta\,(\symg + 2\symlam\symw)`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    s.show('g', 1 - s.ease('step', 0.5));
    s.show('step', s.ease('step', 0.6));
    const rows = 1 - s.ease('shrink', 0.6);
    const xs = columns(s, 3, s.tall ? 20 : 22);
    const lx = xs[0]! - 13 * s.u;
    s.alpha(rows, () => {
      rowLabel(s, 'w', lx, s.h * 0.34, 'blue');
      cells(s, xs, s.h * 0.34, W, 'blue');
      s.alpha(s.ease('example', 0.6), () => {
        downArrows(s, xs, s.h * 0.34 + 5.5 * s.u, s.h * 0.58 - 5.5 * s.u);
        s.text('×2λ', xs[2]! + 9 * s.u, s.h * 0.46, { size: 3.2, font: 'mono', align: 'left', color: s.c('slate'), halo: true });
      });
      s.alpha(s.ease('example', 0.6, 1.5), () => {
        rowLabel(s, '2λw', lx, s.h * 0.58, 'red', 3.8);
        cells(s, xs, s.h * 0.58, ['0.4', '−0.2', '0'], 'red', { on: [1, 1, 1] });
      });
      s.alpha(s.ease('step', 0.6, 1), () => {
        s.text('added to the data gradient g', s.w / 2, s.h * 0.74, { size: 3.6, color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('shrink', 0.6), () => {
      s.text('g = 0:  w ← (1 − 2ηλ) w = 0.9 w', s.w / 2, s.h * 0.22, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
      const bx = columns(s, SHRINK.length, s.tall ? 17 : 20);
      const shown = SHRINK.map((_, i) => s.ease('shrink', 0.4, 2 + i * 1.1));
      const base = s.h * 0.88;
      SHRINK.forEach((v, i) => {
        s.alpha(shown[i]!, () => {
          bars(s, [bx[i]!], base, [v], 'blue', { max: 2, height: (s.h * 0.5) / s.u, w: s.tall ? 11 : 12, fmt: (x) => String(x), hi: [i === 0 ? 1 : 0] });
          if (i) s.text('×0.9', (bx[i - 1]! + bx[i]!) / 2, base + 3.6 * s.u, { size: 2.8, font: 'mono', color: s.c('slate') });
        });
      });
    });
    s.alpha(s.ease('pull', 0.6), () => {
      s.text('every step: a little toward 0', s.w / 2, s.h * 0.29, { size: 3.6, weight: 600, color: s.c('green') });
    });
  },
};

const X = ['1', '1', '1', '1'];

const spread: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 15 : 16);
    const lx = xs[0]! - 11 * s.u;
    const rows: [string, string[], 'orange' | 'blue', number][] = [
      ['x', X, 'orange', s.h * 0.12],
      ['w₁', ['1', '0', '0', '0'], 'blue', s.h * 0.36],
      ['w₂', ['.25', '.25', '.25', '.25'], 'blue', s.h * 0.63],
    ];
    rows.forEach(([name, vals, k, y], i) => {
      s.alpha(i === 0 ? 1 : s.ease('same', 0.6, i === 1 ? 2.5 : 4), () => {
        rowLabel(s, name, lx, y, k, 3.8);
        cells(s, xs, y, vals, k, { w: 12, h: 8, size: 3.4, on: i === 2 ? vals.map(() => s.ease('prefer', 0.6)) : undefined });
      });
    });
    const cap = (i: number, text: string, k: 'green' | '--ink-2' | 'red') => s.text(text, s.w / 2, rows[i]![3] + 9 * s.u, { size: 3.4, font: 'mono', color: s.c(k) });
    s.alpha(s.ease('same', 0.6, 6.5), () => {
      cap(1, `w₁·x = 1${s.since('pen') > 0 ? '    Σw² = 1' : ''}`, s.since('prefer') > 0 ? 'red' : '--ink-2');
      cap(2, `w₂·x = 1${s.since('pen') > 3.5 ? '    Σw² = 0.25' : ''}`, s.since('prefer') > 0 ? 'green' : '--ink-2');
    });
    s.alpha(s.ease('prefer', 0.6, 0.8), () => verdict(s, true, 'cheaper: L2 prefers it', s.w / 2 - 20 * s.u, rows[2]![3] + 17 * s.u, 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { penalty, decay, spread };
