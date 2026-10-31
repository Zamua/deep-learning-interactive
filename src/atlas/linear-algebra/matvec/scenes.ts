import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cite, fmt, rowLabel, verdict } from '../../draw';
import { Frame } from '../../networks/draw';
import { band, brace, ghost, grid, type Grid, matrix, rich } from '../draw';
const par = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));
const dot = (a: number[], b: number[]) => a.reduce((p, v, i) => p + v * b[i]!, 0);
const terms = (r: number[], x: number[]) => r.map((v, i) => `${par(v)}×${par(x[i]!)}`).join(' + ');

function caption(s: Scene, text: string, x: number, y: number, k: Ink = '--ink-2', size = 3.4) {
  s.text(text, x, y, { size, font: 'mono', color: s.c(k), halo: true });
}

// ---- one x, three weight vectors: three answers, stacked into W and W x

const X2 = [2, 1];
/** The same way as x, a right angle to it, and pointing away. */
const R = [[1, 1], [-1, 2], [-1, -1]];
const ANS = R.map((r) => dot(r, X2));
const XR: [number, number] = [-1.7, 2.7];
const YR: [number, number] = [-1.5, 2.5];

/** The plane at the left; x, W and W x at its right; captions under both. */
function layout(s: Scene) {
  const u = s.u;
  const ratio = (XR[1] - XR[0]) / (YR[1] - YR[0]);
  const ww = Math.min(s.h * 0.6 * ratio, s.w * 0.48);
  const F = new Frame(s, 4 * u, 6 * u, 4 * u + ww, 6 * u + ww / ratio, XR, YR);
  const region = s.w - 4 * u - (F.r + 4 * u);
  const pw = Math.max(9, Math.min(13, (region / u - 8) / 4));
  const ph = pw * 0.8;
  // Left label, two columns, the equals sign, the answers: centered in the region.
  const span = 4 * pw + 6;
  const c0 = F.r + 4 * u + (region - span * u) / 2 + (pw / 2 + 6) * u;
  const g = grid(s, c0 + (pw / 2) * u, F.t + 6 * u + ph * 1.35 * u + ph * u, 3, 2, pw, ph);
  const gx = grid(s, g.x(0) + (pw / 2) * u, F.t + 6 * u, 1, 2, pw, ph);
  return { F, g, gx, rx: g.x(1) + 2.1 * pw * u, cw: pw * 0.8, ch: ph * 0.78, y0: F.b + 7 * u };
}

const questions: SceneDef = {
  draw(s) {
    const u = s.u;
    const { F, g, gx, rx, cw, ch, y0 } = layout(s);
    const P = (x: number, y: number): [number, number] => [F.X(x), F.Y(y)];
    F.axes();
    const tip = (v: number[], d: number) => {
      const n = Math.hypot(v[0]!, v[1]!);
      return P(v[0]! * (1 + d / n), v[1]! * (1 + d / n));
    };
    const name = { size: 3.8, font: 'mono', weight: 650, halo: true } as const;

    // Which row the grid lights, one after another, on the W beat.
    const lit = (i: number) => (s.since('W') >= 0 && s.since('Wx') < 0 ? after(s, 'W', 0.25 + i * 0.2, 0.3) * (1 - after(s, 'W', 0.45 + i * 0.2, 0.3)) : 0);
    const rowsIn = [after(s, 'one', 0.3), s.ease('more', 0.6, 1), s.ease('more', 0.6, 1.6)];
    R.forEach((r, i) => s.alpha(rowsIn[i]!, () => {
      s.arrow(...P(0, 0), ...P(r[0]!, r[1]!), s.tint('blue', 0.6 + 0.4 * lit(i)), 0.6 + 0.3 * lit(i), 2.8);
    }));
    s.alpha(after(s, 'one', 0.3) * (1 - s.ease('W', 0.5)), () => s.text('w', ...P(0.62, 1.12), { ...name, color: s.c('blue') }));

    // Each row's answer at its tip.
    const ansIn = [after(s, 'one', 0.75), after(s, 'agree', 0.42), after(s, 'agree', 0.85)];
    const ansAt: [number, number][] = [[1.3, 1.35], [-1.35, 1.75], [-1.35, -0.62]];
    R.forEach((_, i) => s.alpha(ansIn[i]! * (1 - 0.5 * s.ease('cayley', 0.5)), () => {
      s.text(fmt(ANS[i]!), ...P(...ansAt[i]!), { ...name, size: 3.6, color: s.c('gold') });
    }));
    // The right angle between x and row 1.
    s.alpha(after(s, 'agree', 0.3) * (1 - s.ease('W', 0.5)), () => {
      const q = 0.3;
      const a = X2.map((v) => (v / Math.hypot(...X2)) * q);
      const b = R[1]!.map((v) => (v / Math.hypot(...R[1]!)) * q);
      s.line(...P(a[0]!, a[1]!), ...P(a[0]! + b[0]!, a[1]! + b[1]!), s.c('--ink-2'), 0.3);
      s.line(...P(b[0]!, b[1]!), ...P(a[0]! + b[0]!, a[1]! + b[1]!), s.c('--ink-2'), 0.3);
    });
    s.alpha(s.ease('x', 0.6), () => {
      s.arrow(...P(0, 0), ...P(X2[0]!, X2[1]!), s.c('orange'), 0.8, 3);
      s.text('x', ...tip(X2, 0.35), { ...name, color: s.c('orange') });
    });

    // The grid: x across the top, W's rows, and the answers.
    const gIn = s.ease('W', 0.6);
    s.alpha(gIn, () => {
      rowLabel(s, 'x', gx.l - 3 * u, gx.y(0), 'orange', 3.8);
      X2.forEach((v, j) => s.cell(gx.x(j) - (cw / 2) * u, gx.y(0) - (ch / 2) * u, cw * u, ch * u, fmt(v), 'orange'));
      rowLabel(s, 'W', g.l - 3 * u, (g.t + g.b) / 2, 'blue', 3.8);
      matrix(s, g, R.map((r) => r.map(fmt)), 'blue', { w: cw, h: ch, on: (i) => lit(i) });
    });
    s.alpha(s.ease('Wx', 0.6), () => {
      s.text('=', (g.r + rx) / 2 - 1.4 * u, (g.t + g.b) / 2, { size: 4.2, font: 'mono', color: s.c('--ink-3') });
      s.text('Wx', rx, gx.y(0), { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
      ANS.forEach((v, i) => s.cell(rx - (cw / 2) * u, g.y(i) - (ch / 2) * u, cw * u, ch * u, fmt(v), 'gold', { on: s.win('Wx', 'turns') }));
    });

    // Captions under the plane and the grid.
    const cx = s.w / 2;
    const o = { size: 3.6, weight: 600 } as const;
    s.alpha(s.win('x', 'one'), () => rich(s, [['x', 'orange'], [' = [2, 1]', '--ink-2']], cx, y0, o));
    s.alpha(s.win('one', 'more'), () => {
      rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' = 1×2 + 1×1 = ', '--ink-2'], ['3', 'gold']], cx, y0, o);
      caption(s, 'one weight vector: one question', cx, y0 + 7 * u);
    });
    s.alpha(s.win('more', 'W'), () => caption(s, 'three weight vectors: three answers', cx, y0));
    s.alpha(s.win('agree', 'W'), () => caption(s, 'same way: 3 · right angle: 0 · away: −3', cx, y0 + 7 * u, '--ink-2', 3.1));
    s.alpha(s.win('W', 'Wx'), () => caption(s, 'W: one row per question, 3 × 2', cx, y0));
    s.alpha(s.win('Wx', 'cayley'), () => rich(s, [['W', 'blue'], ['x', 'orange'], [' = [3, 0, −3]', 'gold']], cx, y0, { size: 4.2, weight: 650 }));
    s.alpha(s.win('turns', 'cayley'), () => caption(s, '2 numbers in, 3 out', cx, y0 + 7.5 * u));
    // Cayley's long way: each answer a weighted sum of x's entries.
    s.alpha(after(s, 'cayley', 0.4), () => {
      const lines: [string, Ink][][] = R.map((r, i) => [
        [fmt(ANS[i]!).padStart(2), 'gold'],
        [' = ', '--ink-3'],
        [par(r[0]!), 'blue'],
        ['×', '--ink-3'],
        ['2', 'orange'],
        [' + ', '--ink-3'],
        [par(r[1]!), 'blue'],
        ['×', '--ink-3'],
        ['1', 'orange'],
      ]);
      const w = s.measure('−3 = (−1)×2 + (−1)×1', { size: 3.3, font: 'mono' });
      lines.forEach((runs, i) => rich(s, runs, cx - w / 2, y0 - 1 * u + i * 6.4 * u, { size: 3.3, align: 'left' }));
    });
    cite(s, 'Arthur Cayley, 1858', s.ease('cayley', 0.6));
  },
};

// ---- a bigger W: each row dotted with x, one entry per row

const W = [[1, 2, 0], [3, -1, 2]];
const X = [2, 1, 3];

/**
 * x laid across the top of W, one entry over each column, and W x as a column on the right.
 * `rowOn(i)` lights row i and its result; `res(i)` fades in result entry i.
 */
function stack(s: Scene, x: (number | null)[], o: { rowOn: (i: number) => number; res: (i: number) => number; resOn?: number; colOn?: number; cx?: number }): { g: Grid; gx: Grid; rx: number } {
  const m = W.length;
  const n = W[0]!.length;
  const cx = o.cx ?? s.w * 0.44;
  const g = grid(s, cx, s.h * 0.33 + ((m - 1) / 2) * 11 * s.u, m, n, 15, 11);
  const gx = grid(s, cx, s.h * 0.15, 1, n, 15, 11);
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
  // A column of W, outlined in red: it does not line up with x.
  const col = o.colOn ?? 0;
  if (col > 0.003) {
    s.alpha(col, () => s.rrect(g.x(0) - 7.4 * s.u, g.t - 1 * s.u, 14.8 * s.u, g.b - g.t + 2 * s.u, 1.6, { stroke: s.c('red'), lw: 0.5 }));
  }
  s.text('=', (g.r + rx) / 2 - 2 * s.u, (g.t + g.b) / 2, { size: 4.6, font: 'mono', color: s.c('--ink-3') });
  s.text('Wx', rx, gx.y(0), { size: 4, font: 'mono', weight: 650, color: s.c('gold') });
  for (let i = 0; i < m; i++) {
    ghost(s, rx, g.y(i), '', '--ink-3');
    const xs = x.filter((v): v is number => v !== null);
    s.alpha(o.res(i), () => s.cell(rx - 6 * s.u, g.y(i) - 4.25 * s.u, 12 * s.u, 8.5 * s.u, fmt(dot(W[i]!, xs)), 'gold', { on: Math.max(o.rowOn(i), o.resOn ?? 0) }));
  }
  return { g, gx, rx };
}

const rows: SceneDef = {
  draw(s) {
    const on = [s.win('pair', 'r1'), s.win('r1', 'all')];
    const { g, rx } = stack(s, X, {
      rowOn: (i) => on[i]!,
      res: (i) => (i === 0 ? after(s, 'r0', 0.45) : after(s, 'r1', 0.75)),
      resOn: s.win('all', 'col'),
      colOn: s.ease('col', 0.6),
    });
    const cx = s.w / 2;
    const o = { size: 3.6 } as const;
    const prods = W[0]!.map((v, j) => v * X[j]!);
    s.alpha(s.ease('setup', 0.6, 1.5) * (1 - s.ease('pair', 0.5)), () => caption(s, 'one entry of x above each column', cx, s.h * 0.66, '--ink-2', 3.4));
    s.alpha(s.ease('pair', 0.6, 0.6), () => rich(s, [[`${terms(W[0]!, X)}`, '--ink-2']], cx, s.h * 0.64, o));
    s.alpha(s.ease('r0', 0.6, 0.2), () => rich(s, [[`= ${prods.join(' + ')} = `, '--ink-2'], ['4', 'gold']], cx, s.h * 0.71, o));
    s.alpha(s.ease('r1', 0.6, 0.4), () => rich(s, [[`${terms(W[1]!, X)} = `, '--ink-2'], [fmt(dot(W[1]!, X)), 'gold']], cx, s.h * 0.8, o));
    s.alpha(s.ease('all', 0.6) * (1 - s.ease('col', 0.5)), () => {
      rich(s, [['W', 'blue'], ['x', 'orange'], [' = [4, 11]', 'gold']], cx, s.h * 0.9, { size: 4.2, weight: 650 });
    });
    s.alpha(s.ease('all', 0.6, 2), () => s.text('entry i: from row i', rx, g.b + 6 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    s.alpha(s.ease('col', 0.6), () => {
      const text = 'a column: 2 numbers, x has 3';
      const w = s.measure(text, { size: 3.6 }) + 3.6 * 1.4 * s.u;
      verdict(s, false, text, cx - w / 2, s.h * 0.9, 3.6);
    });
  },
};

const shapes: SceneDef = {
  draw(s) {
    const fail = s.ease('fail', 0.6);
    const out = s.win('out', 'fail');
    const { g, gx, rx } = stack(s, fail > 0.5 ? [2, 1, null] : X, { rowOn: () => 0, res: () => 1 - fail, resOn: out, cx: s.w * (s.tall ? 0.39 : 0.44) });
    s.alpha(s.win('match', 'fail'), () => {
      brace(s, 'top', gx.l + 1.5 * s.u, gx.r - 1.5 * s.u, gx.t - 1.5 * s.u, '3 entries', 'orange', 3.2);
      brace(s, 'bottom', g.l + 1.5 * s.u, g.r - 1.5 * s.u, g.b + 2 * s.u, '3 columns', 'blue', 3.2);
    });
    s.alpha(s.win('out', 'fail') * after(s, 'out', 0.2), () => brace(s, 'right', g.t + 1.5 * s.u, g.b - 1.5 * s.u, rx + 8 * s.u, '2 rows', 'gold', 3.2));
    s.alpha(fail, () => W.forEach((_, i) => s.text('✗', rx, g.y(i), { size: 4.6, font: 'ui', weight: 700, color: s.c('red') })));
    const cx = s.w / 2;
    s.alpha(s.ease('match', 0.6, 0.8) * (1 - s.ease('at', 0.5)), () => caption(s, 'columns of W = length of x', cx, s.h * 0.68, '--ink-2', 3.6));
    s.alpha(s.ease('at', 0.6) * (1 - s.ease('rule', 0.5)), () => rich(s, [['W', 'blue'], [' @ ', '--ink-3'], ['x', 'orange']], cx, s.h * 0.68, { size: 4.2, weight: 650 }));
    s.alpha(s.ease('rule', 0.6), () => rich(s, [['(2, 3)', 'blue'], [' @ ', '--ink-3'], ['(3,)', 'orange'], [' → ', '--ink-3'], ['(2,)', 'gold']], cx, s.h * 0.68, { size: 3.8, weight: 600 }));
    s.alpha(s.ease('big', 0.6), () => rich(s, [['(10, 3072)', 'blue'], [' @ ', '--ink-3'], ['(3072,)', 'orange'], [' → ', '--ink-3'], ['(10,)', 'gold']], cx, s.h * 0.79, { size: 3.8, weight: 600 }));
    s.alpha(fail, () => {
      const text = 'x has 2, W has 3 columns';
      const w = s.measure(text, { size: 3.6 }) + 3.6 * 1.4 * s.u;
      verdict(s, false, text, cx - w / 2, s.h * 0.9, 3.6);
    });
  },
};

export const scenes: Record<string, SceneDef> = { questions, rows, shapes };
