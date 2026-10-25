import type { Scene, SceneDef } from '../../../lecture/scene';
import { rowLabel } from '../../draw';
import { band, brace, ghost, grid, type Grid, matrix, rich } from '../draw';

const fmt = (v: number) => String(v).replace('-', '−');
const par = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));
const dot = (a: number[], b: number[]) => a.reduce((p, v, i) => p + v * b[i]!, 0);
const terms = (r: number[], x: number[]) => r.map((v, i) => `${par(v)}×${par(x[i]!)}`).join(' + ');

/**
 * x laid across the top of W, one entry over each column, and W x as a column on the right.
 * `rowOn(i)` lights row i and its result; `res(i)` fades in result entry i.
 */
function stack(s: Scene, W: number[][], x: (number | null)[], o: { rowOn: (i: number) => number; res: (i: number) => number; resOn?: number }): { g: Grid; gx: Grid; rx: number } {
  const m = W.length;
  const n = W[0]!.length;
  const cx = s.w * 0.44;
  const g = grid(s, cx, s.h * 0.33 + ((m - 1) / 2) * 11 * s.u, m, n, 15, 11);
  const gx = grid(s, cx, s.h * 0.16, 1, n, 15, 11);
  const rx = g.r + 18 * s.u;
  for (let j = 0; j < n; j++) s.line(g.x(j), gx.b - 1 * s.u, g.x(j), g.t + 1 * s.u, s.tint('orange', 0.35), 0.25, [0.8, 0.8]);
  for (let i = 0; i < m; i++) band(s, g, 'row', i, 'blue', o.rowOn(i));
  rowLabel(s, 'x', g.l - 4 * s.u, gx.y(0), 'orange');
  for (let j = 0; j < n; j++) {
    const v = x[j];
    if (v === null || v === undefined) ghost(s, gx.x(j), gx.y(0), '?', 'red');
    else s.cell(gx.x(j) - 6 * s.u, gx.y(0) - 4.25 * s.u, 12 * s.u, 8.5 * s.u, fmt(v), 'orange', { on: Math.max(...W.map((_, i) => o.rowOn(i))) });
  }
  rowLabel(s, 'W', g.l - 4 * s.u, (g.t + g.b) / 2, 'blue');
  matrix(s, g, W.map((r) => r.map(fmt)), 'blue', { on: (i) => o.rowOn(i) });
  s.text('=', (g.r + rx) / 2 - 2 * s.u, (g.t + g.b) / 2, { size: 4.6, font: 'mono', color: s.c('--ink-3') });
  s.text('Wx', rx, gx.y(0), { size: 4, font: 'mono', weight: 650, color: s.c('gold') });
  for (let i = 0; i < m; i++) {
    ghost(s, rx, g.y(i), '', '--ink-3');
    const xs = x.filter((v): v is number => v !== null);
    s.alpha(o.res(i), () => s.cell(rx - 6 * s.u, g.y(i) - 4.25 * s.u, 12 * s.u, 8.5 * s.u, fmt(dot(W[i]!, xs)), 'gold', { on: Math.max(o.rowOn(i), o.resOn ?? 0) }));
  }
  return { g, gx, rx };
}

const W = [[1, 2, 0], [3, -1, 2]];
const X = [2, 1, 3];

const rows: SceneDef = {
  draw(s) {
    const beats = ['row0', 'row1'];
    const on = (i: number) => s.win(beats[i]!, beats[i + 1] ?? 'result');
    stack(s, W, X, { rowOn: on, res: (i) => s.ease(beats[i]!, 0.6, 1.5), resOn: s.ease('result', 0.6) });
    W.forEach((r, i) => s.alpha(s.ease(beats[i]!, 0.6, 0.4), () => {
      rich(s, [[`${terms(r, X)} = `, '--ink-2'], [fmt(dot(r, X)), 'gold']], s.w / 2, s.h * (0.64 + i * 0.1), { size: 3.6 });
    }));
    s.alpha(s.ease('result', 0.6), () => rich(s, [['W', 'blue'], ['x', 'orange'], [' = [4, 11]', 'gold']], s.w / 2, s.h * 0.87, { size: 4.6, weight: 650 }));
  },
};

const shapes: SceneDef = {
  draw(s) {
    const fail = s.ease('fail', 0.6);
    const out = s.win('out', 'fail');
    const { g, gx, rx } = stack(s, W, fail > 0.5 ? [2, 1, null] : X, { rowOn: () => 0, res: () => 1 - fail, resOn: out });
    s.alpha(s.win('match', 'fail'), () => {
      brace(s, 'top', gx.l + 1.5 * s.u, gx.r - 1.5 * s.u, gx.t - 1.5 * s.u, '3 entries', 'orange', 3.2);
      brace(s, 'bottom', g.l + 1.5 * s.u, g.r - 1.5 * s.u, g.b + 2 * s.u, '3 columns', 'blue', 3.2);
    });
    s.alpha(fail, () => W.forEach((_, i) => s.text('✗', rx, g.y(i), { size: 4.6, font: 'ui', weight: 700, color: s.c('red') })));
    s.alpha(s.ease('match', 0.6, 0.8), () => s.text('columns of W = length of x', s.w / 2, s.h * 0.66, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('out', 0.6), () => rich(s, [['(2, 3)', 'blue'], [' @ ', '--ink-3'], ['(3,)', 'orange'], [' → ', '--ink-3'], ['(2,)', 'gold']], s.w / 2, s.h * 0.76, { size: 3.8, weight: 600 }));
    s.alpha(s.ease('big', 0.6), () => rich(s, [['(10, 3072)', 'blue'], [' @ ', '--ink-3'], ['(3072,)', 'orange'], [' → ', '--ink-3'], ['(10,)', 'gold']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { rows, shapes };
