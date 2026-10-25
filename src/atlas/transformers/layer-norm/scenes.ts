import type { SceneDef } from '../../../lecture/scene';
import { cells, columns, downArrows, rowLabel } from '../../draw';
import { band, grid, matrix, rich } from '../draw';

const X = [
  [2, 5, 1, 4],
  [9, 3, 17, 11],
  [0, 6, 2, 8],
  [7, 1, 3, 5],
];

const sideways: SceneDef = {
  draw(s) {
    const u = s.u;
    const g = grid(s, s.w / 2 + 4 * u, s.h * 0.4, 4, 4, 13, 10);
    const col = s.win('recall', 'rows');
    const row = s.ease('rows', 0.6);
    const all = s.ease('alone', 0.6);
    band(s, g, 'col', 0, 'gold', col);
    for (let i = 0; i < 4; i++) band(s, g, 'row', i, 'teal', i === 1 ? row : all * 0.6);
    matrix(s, g, X.map((r) => r.map(String)), '--ink-3', { w: 11, h: 7.5, size: 3.2 });
    [0, 1, 2, 3].forEach((j) => s.text(`f${j}`, g.x(j), g.t - 3.5 * u, { size: 3, font: 'mono', weight: 600, color: s.c(j === 0 && col > 0.5 ? 'gold' : '--ink-3') }));
    [0, 1, 2, 3].forEach((i) => s.text(`ex ${i}`, g.l - 3 * u, g.y(i), { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(i === 1 && row > 0.5 ? 'teal' : '--ink-3') }));
    s.text('X: 4 examples × 4 features', s.w / 2, s.h * 0.08, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
    s.alpha(col, () => rich(s, [['batch norm', 'gold'], [': a mean per feature, down a column', '--ink-2']], s.w / 2, s.h * 0.8, { size: 3.3 }));
    s.alpha(row * (1 - all), () => rich(s, [['layer norm', 'teal'], [': a mean per example, along a row', '--ink-2']], s.w / 2, s.h * 0.8, { size: 3.3 }));
    s.alpha(all, () => {
      rich(s, [['layer norm', 'teal'], [': every row on its own', '--ink-2']], s.w / 2, s.h * 0.8, { size: 3.3 });
      s.text('no batch statistics, no running averages', s.w / 2, s.h * 0.89, { size: 3.2, color: s.c('--ink-3') });
    });
  },
};

const XS = [9, 3, 17, 11];
const SQ = XS.map((x) => (x - 10) ** 2);
const XH = XS.map((x) => (x - 10) / 5);
const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('-', '−');

const one: SceneDef = {
  marks: {
    y: { tex: String.raw`y = \symgamma\,\hat{x} + \symbeta`, x: 0.5, y: 0.8, size: 5.2 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 18).map((x) => x + 5 * u);
    const lx = xs[0]! - 10 * u;
    rowLabel(s, 'x', lx, s.h * 0.1, 'orange', 4);
    cells(s, xs, s.h * 0.1, XS.map(String), 'orange', { w: 12, h: 8, on: XS.map(() => s.win('mean', 'var')) });
    s.alpha(s.ease('mean', 0.6, 0.6), () => rich(s, [['μ = 40 / 4 = ', '--ink-2'], ['10', '--ink']], s.w / 2 + 5 * u, s.h * 0.21, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('var', 0.6), () => {
      rowLabel(s, '(x − μ)²', lx, s.h * 0.32, 'slate', 3.2);
      cells(s, xs, s.h * 0.32, SQ.map(String), 'slate', { w: 12, h: 7, size: 3.2 });
      s.alpha(s.ease('var', 0.6, 3), () => rich(s, [['σ² = 100 / 4 = 25,  σ = ', '--ink-2'], ['5', '--ink']], s.w / 2 + 5 * u, s.h * 0.43, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('xhat', 0.6), () => {
      downArrows(s, xs, s.h * 0.47, s.h * 0.53);
      rowLabel(s, 'x̂', lx, s.h * 0.6, 'teal', 4);
      cells(s, xs, s.h * 0.6, XH.map(f), 'teal', { w: 12, h: 8, on: XH.map((_, i) => (i < 2 ? s.win('xhat', 'gamma') : 0)) });
    });
    s.show('y', s.ease('gamma', 0.6));
    s.alpha(s.ease('gamma', 0.6, 3), () => s.text('γ, β: one entry each per feature → 2d', s.w / 2, s.h * 0.92, { size: 3.3, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { sideways, one };
