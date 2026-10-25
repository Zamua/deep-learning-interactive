import type { SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { rowLabel } from '../../draw';
import { band, brace, ghost, grid, type Ink, matrix, rich } from '../draw';

const W = [[1, 4, 2], [0, 3, 5]];
const ROW = 'teal';
const COL = 'gold';

const shapeRuns = (m: number, n: number): [string, Ink][] => [['(', '--ink-2'], [String(m), ROW], [', ', '--ink-2'], [String(n), COL], [')', '--ink-2']];

const gridScene: SceneDef = {
  draw(s) {
    const g = grid(s, s.w / 2, s.h * 0.32, 2, 3, 16, 12);
    rowLabel(s, 'W', g.l - 5 * s.u, (g.t + g.b) / 2, 'blue', 4.6);
    const r = s.win('rows', 'cols');
    const c = s.win('cols', 'shape');
    [0, 1].forEach((i) => band(s, g, 'row', i, ROW, r));
    [0, 1, 2].forEach((j) => band(s, g, 'col', j, COL, c));
    matrix(s, g, W, 'blue');
    s.alpha(s.ease('rows', 0.6), () => brace(s, 'right', g.t, g.b, g.r + 3 * s.u, '2 rows', ROW));
    s.alpha(s.ease('cols', 0.6), () => brace(s, 'top', g.l, g.r, g.t - 3 * s.u, '3 columns', COL));
    s.alpha(s.ease('shape', 0.6), () => rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(2, 3)], s.w / 2, s.h * 0.6, { size: 4.6, weight: 650 }));
    s.alpha(s.ease('count', 0.6), () => s.text('2 × 3 = 6 numbers', s.w / 2, s.h * 0.71, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('big', 0.6), () => {
      s.text('10 classes, 3,072 inputs', s.w / 2, s.h * 0.83, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(10, 3072)], s.w / 2, s.h * 0.91, { size: 3.8, weight: 600 });
    });
  },
};

const index: SceneDef = {
  draw(s) {
    const g = grid(s, s.w / 2 + 3 * s.u, s.h * 0.3, 2, 3, 16, 12);
    rowLabel(s, 'W', g.l - 10 * s.u, (g.t + g.b) / 2, 'blue', 4.6);
    const ix = s.ease('ij', 0.6);
    const e1 = s.win('eg', 'eg2');
    const e2 = s.win('eg2', 'out');
    band(s, g, 'row', 0, ROW, e1);
    band(s, g, 'col', 2, COL, e1);
    band(s, g, 'row', 1, ROW, e2);
    band(s, g, 'col', 0, COL, e2);
    matrix(s, g, W, 'blue', { on: (i, j) => (i === 0 && j === 2 ? e1 : i === 1 && j === 0 ? e2 : 0) });
    s.alpha(ix, () => {
      [0, 1].forEach((i) => s.text(String(i), g.l - 3.5 * s.u, g.y(i), { size: 3.4, font: 'mono', weight: 600, color: s.c(ROW) }));
      [0, 1, 2].forEach((j) => s.text(String(j), g.x(j), g.t - 3.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c(COL) }));
    });
    s.alpha(s.ease('eg', 0.6), () => rich(s, [['W[', '--ink-2'], ['0', ROW], [', ', '--ink-2'], ['2', COL], ['] = 2', '--ink-2']], s.w / 2, s.h * 0.63, { size: 4.2, weight: 600 }));
    s.alpha(s.ease('eg2', 0.6), () => rich(s, [['W[', '--ink-2'], ['1', ROW], [', ', '--ink-2'], ['0', COL], ['] = 0', '--ink-2']], s.w / 2, s.h * 0.74, { size: 4.2, weight: 600 }));
    s.alpha(s.ease('out', 0.6), () => {
      const y = g.y(1) + 12 * s.u;
      [0, 1, 2].forEach((j) => ghost(s, g.x(j), y, j === 0 ? '?' : '', 'red'));
      s.text('2', g.l - 3.5 * s.u, y, { size: 3.4, font: 'mono', weight: 600, color: s.c('red') });
      s.text('W[2, 0]: no row 2  ✗', s.w / 2, s.h * 0.87, { size: 3.8, font: 'mono', color: s.c('red') });
    });
  },
};

const transpose: SceneDef = {
  draw(s) {
    const a = grid(s, s.w * 0.3, s.h * 0.4, 2, 3, 14, 11);
    const b = grid(s, s.w * 0.72, s.h * 0.4, 3, 2, 14, 11);
    const kOf = (i: number) => (i === 0 ? ROW : COL);
    const hi = s.ease('ij', 0.6);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      s.cell(a.x(j) - 6 * s.u, a.y(i) - 4.25 * s.u, 12 * s.u, 8.5 * s.u, String(W[i]![j]), kOf(i), { on: i === 1 && j === 2 ? hi : 0 });
    }
    rich(s, [['W ', 'blue'], ...shapeRuns(2, 3)], a.x(1), a.t - 5 * s.u, { size: 3.8, weight: 600 });
    const f = s.ease('flip', 0.5);
    s.alpha(f, () => rich(s, [['W.T ', 'blue'], ...shapeRuns(3, 2).map(([t, k], i): [string, Ink] => [t, i === 1 ? COL : i === 3 ? ROW : k])], b.x(0.5), b.t - 5 * s.u, { size: 3.8, weight: 600 }));
    // Each entry flies from (i, j) in W to (j, i) in W.T, row by row.
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const t = smooth(clamp01((s.since('flip') - 0.3 - (i * 3 + j) * 0.18) / 0.9));
      if (t <= 0) continue;
      const x = lerp(a.x(j), b.x(i), t);
      const y = lerp(a.y(i), b.y(j), t);
      s.cell(x - 6 * s.u, y - 4.25 * s.u, 12 * s.u, 8.5 * s.u, String(W[i]![j]), kOf(i), { on: i === 1 && j === 2 ? hi : 0 });
    }
    s.alpha(s.ease('flip', 0.6, 1.6), () => s.text('rows become columns', s.w / 2, s.h * 0.72, { size: 3.6, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(hi, () => s.text('W[1, 2] = W.T[2, 1] = 5', s.w / 2, s.h * 0.84, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') }));
  },
};

const E = [[3, 0], [1, 5], [2, 4]];

const example: SceneDef = {
  draw(s) {
    const g = grid(s, s.w / 2, s.h * 0.34, 3, 2, 17, 11);
    rowLabel(s, 'W', g.l - 5 * s.u, (g.t + g.b) / 2, 'blue', 4.6);
    const rp = s.prog('rows');
    const cp = s.prog('cols');
    const rowsOn = s.since('rows') >= 0;
    const colsOn = s.since('cols') >= 0;
    [0, 1, 2].forEach((i) => band(s, g, 'row', i, ROW, rowsOn && !colsOn ? smooth(clamp01((rp - i * 0.25) * 4)) : 0));
    [0, 1].forEach((j) => band(s, g, 'col', j, COL, colsOn && s.since('ans') < 0 ? smooth(clamp01((cp - j * 0.3) * 4)) : 0));
    matrix(s, g, E, 'blue');
    s.alpha(s.ease('rows', 0.5), () => [0, 1, 2].forEach((i) => s.alpha(smooth(clamp01((rp - i * 0.25) * 4)), () => s.text(String(i + 1), g.r + 4 * s.u, g.y(i), { size: 3.6, font: 'mono', weight: 650, color: s.c(ROW) }))));
    s.alpha(s.ease('cols', 0.5), () => [0, 1].forEach((j) => s.alpha(smooth(clamp01((cp - j * 0.3) * 4)), () => s.text(String(j + 1), g.x(j), g.t - 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c(COL) }))));
    s.alpha(s.ease('ans', 0.6), () => rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(3, 2)], s.w / 2, s.h * 0.78, { size: 4.8, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { grid: gridScene, index, transpose, example };
