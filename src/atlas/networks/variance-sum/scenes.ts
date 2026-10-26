import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { after, caption, Frame, type Ink } from '../draw';

const fmt = (v: number): string => String(v).replace('-', '−');

/** One value of -2 or 2 on a number line: its mean, its squared distances, and its std. */
const spread: SceneDef = {
  draw(s) {
    const u = s.u;
    const ty = s.h * 0.13;
    const xs = columns(s, 2, 16);
    rowLabel(s, 'value', xs[0]! - 10 * u, ty, 'blue', 3.6);
    cells(s, xs, ty, ['−2', '2'], 'blue', { w: 12, h: 8.5, on: [s.win('var', 'std'), s.win('var', 'std')] });
    const iy = ty + 11 * u;
    const info = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.win('spread', 'var'), () => s.text('equally often: mean 0', s.w / 2, iy, { ...info, color: s.c('--ink-2') }));
    s.alpha(s.win('var', 'std'), () => s.text('squared distances 4, 4: variance 4', s.w / 2, iy, { ...info, color: s.c('red') }));
    s.alpha(s.ease('std', 0.6), () => s.text('variance 4,  std = √4 = 2', s.w / 2, iy, { ...info, color: s.c('gold') }));
    const ly = s.h * 0.68;
    const step = (s.tall ? 12 : 13) * u;
    const X = (v: number) => s.w / 2 + v * step;
    s.alpha(s.ease('spread', 0.6, 0.3), () => {
      s.line(X(-3.2), ly, X(3.2), ly, s.c('--axis'), 0.4);
      for (let v = -3; v <= 3; v++) {
        s.line(X(v), ly - 0.8 * u, X(v), ly + 0.8 * u, s.c('--axis'), 0.3);
        s.text(fmt(v), X(v), ly + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      }
    });
    // The squared distance to each value, drawn as a square on the line.
    const sq = s.ease('var', 0.6, 0.6) * (1 - 0.6 * s.ease('std', 0.6));
    s.alpha(sq, () => {
      for (const v of [-2, 2]) {
        const x0 = Math.min(X(0), X(v));
        s.rrect(x0, ly - 2 * step, 2 * step, 2 * step, 0.4, { fill: s.tint('red', 0.18), stroke: s.tint('red', 0.6), lw: 0.3 });
        s.text('2² = 4', (X(0) + X(v)) / 2, ly - step, { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      }
    });
    s.alpha(s.ease('spread', 0.6, 1), () => {
      for (const v of [-2, 2]) s.circle(X(v), ly, 1.6 * u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
      s.circle(X(0), ly, 1.1 * u, { fill: s.c('--ink-2'), stroke: s.c('--card'), lw: 0.3 });
    });
    s.alpha(s.ease('spread', 0.6, 2) * (1 - s.ease('var', 0.5)), () => s.text('mean', X(0), ly - 4 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(after(s, 'std', 0.3), () => {
      const y = ly + 9 * u;
      s.arrow(X(0), y, X(2), y, s.c('gold'), 0.4, 1.5);
      s.arrow(X(0), y, X(-2), y, s.c('gold'), 0.4, 1.5);
      s.text('std 2: the typical distance', s.w / 2, y + 5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
    });
  },
};

/** Two equally likely values each for a row and a column, and what every pair gives. */
interface Table {
  rows: [string, number[]];
  cols: [string, number[]];
  cell: (r: number, c: number) => string;
}
const SUMS: Table = { rows: ['first', [-1, 1]], cols: ['second', [-1, 1]], cell: (r, c) => fmt(r + c) };
const SQUARES: Table = { ...SUMS, cell: (r, c) => fmt((r + c) ** 2) };
const PRODS: Table = { rows: ['weight', [-2, 2]], cols: ['input', [-1, 1]], cell: (r, c) => fmt(r * c) };

/** A 2 by 2 table of outcomes centered on (cx, cy), with its row and column values outside. */
function outcomes(s: Scene, cx: number, cy: number, t: Table, k: Ink, on = 0): void {
  const u = s.u;
  const xs = [cx - 8 * u, cx + 8 * u];
  const ys = [cy - 5.5 * u, cy + 5.5 * u];
  const head = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
  t.cols[1].forEach((v, j) => s.text(fmt(v), xs[j]!, ys[0]! - 9.5 * u, { ...head, weight: 600 }));
  s.text(t.cols[0], cx, ys[0]! - 15.5 * u, head);
  t.rows[1].forEach((v, i) => s.text(fmt(v), xs[0]! - 13 * u, ys[i]!, { ...head, weight: 600 }));
  s.text(t.rows[0], xs[0]! - 19 * u, cy, { ...head, align: 'right' });
  ys.forEach((y, i) => cells(s, xs, y, xs.map((_, j) => t.cell(t.rows[1][i]!, t.cols[1][j]!)), k, { w: 13, h: 9, on: [on, on] }));
}

const bell = (sd: number) => (z: number) => 1.1 * Math.exp(-(z * z) / (2 * sd * sd));

/** Sums and products of two values, then the spread of a unit's sum on a plot. */
const adds: SceneDef = {
  marks: {
    v: { tex: String.raw`\mathrm{Var}(z) = n\,\sym{v}{v}`, x: 0.5, y: 0.1, size: 5.4 },
  },
  draw(s) {
    const u = s.u;
    const plot = s.ease('sum', 0.6);
    s.alpha(1 - plot, () => {
      const cy = s.h * 0.5;
      const cx = s.w / 2 + 7 * u;
      const pr = s.ease('prod', 0.6);
      const sq = s.ease('adds', 0.6) * (1 - pr);
      s.alpha(s.ease('pair', 0.6) * (1 - pr) * (1 - sq), () => outcomes(s, cx, cy, SUMS, 'gold'));
      s.alpha(sq, () => outcomes(s, cx, cy, SQUARES, 'red'));
      s.alpha(pr, () => outcomes(s, cx, cy, PRODS, 'gold', 0.3));
      const cyc = s.h * 0.86;
      s.alpha(s.win('pair', 'adds'), () => caption(s, 'sums: −2, 0, 0, 2', cyc, 'gold', 3.6));
      s.alpha(s.win('adds', 'prod'), () => caption(s, 'squared: (4 + 0 + 0 + 4) / 4 = 2 = 1 + 1', cyc, 'red', 3.4));
      s.alpha(pr, () => caption(s, 'products −2 or 2: variance 4 = 4 × 1', cyc, 'gold', 3.4));
    });
    s.alpha(plot, () => {
      const F = new Frame(s, 8 * u, s.h * 0.2, s.w - 8 * u, s.h * 0.78, [-25, 25], [-0.1, 1.3]);
      s.show('v', s.ease('sum', 0.6));
      F.axes();
      s.text('z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
      for (const t of [-20, -10, 10, 20]) s.text(fmt(t), F.X(t), F.Y(0) + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      const sd = lerp(1, 10, s.ease('big', 1.6));
      const lab = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
      s.alpha(s.ease('root', 0.6, 0.8), () => F.fn(bell(5), 'orange', 0.5, -25, 25, [1.2, 1]));
      F.fn(bell(sd), 'gold', 0.7);
      s.alpha(s.win('sum', 'big'), () => s.text('one term: std 1', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') }));
      s.alpha(s.win('big', 'root') * after(s, 'big', 0.4), () => {
        F.seg(-10, bell(10)(10), 10, bell(10)(10), 'gold', 0.3, [1, 0.8]);
        s.text('100 terms: std 10', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') });
      });
      s.alpha(s.ease('root', 0.6, 0.8), () => {
        s.text('25 terms: std 5', F.l, F.Y(1.1) - 4 * u, { ...lab, size: 3.2, align: 'left', color: s.c('orange') });
        s.text('100 terms: std 10', F.r, F.Y(1.1) - 4 * u, { ...lab, size: 3.2, align: 'right', color: s.c('gold') });
      });
      const cy = s.h * 0.9;
      s.alpha(s.win('sum', 'big'), () => caption(s, 'variances add', cy));
      s.alpha(s.win('big', 'root'), () => caption(s, '100 × 1 = 100,  √100 = 10', cy, 'gold', 3.8));
      s.alpha(s.ease('root', 0.6), () => caption(s, '4 × the terms: 2 × the std', cy, 'gold', 3.8));
    });
  },
};

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const q = { size: 3.4, font: 'mono', color: s.c('--ink') } as const;
    const line = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    const ly = s.h * 0.42;
    s.text('z = w · x over n = 400 inputs', s.w / 2, s.h * 0.08, q);
    s.text('inputs: variance 1,  weights: std 0.1', s.w / 2, s.h * 0.08 + 5.5 * u, q);
    s.alpha(after(s, 'p1', 0.7), () => s.text('std of z?', s.w / 2, s.h * 0.08 + 11 * u, { ...q, weight: 650, color: s.c('gold') }));
    s.alpha(after(s, 'a1', 0.15), () => s.text('weight variance: 0.1² = 0.01', s.w / 2, ly, { ...line, color: s.c('blue') }));
    s.alpha(after(s, 'a1', 0.6), () => s.text('each term: 0.01 × 1 = 0.01', s.w / 2, ly + 6.5 * u, { ...line, color: s.c('--ink-2') }));
    s.alpha(after(s, 'b1', 0.1), () => s.text('400 terms: 400 × 0.01 = 4', s.w / 2, ly + 15 * u, { ...line, color: s.c('--ink-2') }));
    s.alpha(after(s, 'b1', 0.55), () => s.text('std of z = √4 = 2', s.w / 2, ly + 21.5 * u, { ...line, size: 4, weight: 650, color: s.c('gold') }));
  },
};

export const scenes: Record<string, SceneDef> = { spread, adds, try: tryIt };
