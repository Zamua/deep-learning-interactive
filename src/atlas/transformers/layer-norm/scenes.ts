import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel, verdict } from '../../draw';
import { after, caption } from '../../networks/draw';
import { band, grid, type Ink, matrix, rich } from '../draw';

const str = (v: number) => String(Math.round(v * 100) / 100).replace('-', '−');
const signed = (v: number) => (v > 0 ? '+' : '') + str(v);
const norm = (xs: number[]) => {
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length);
  return xs.map((x) => (sd ? (x - mu) / sd : 0));
};
const BN: Ink = 'gold';
const LN: Ink = 'teal';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A number line from `lo` to `hi` across the stage at height y, ticks every `step`; returns the value-to-x map. */
function axis(s: Scene, y: number, lo: number, hi: number, step: number, ticks = true): (v: number) => number {
  const l = 10 * s.u;
  const r = s.w - 10 * s.u;
  const X = (v: number) => l + ((v - lo) / (hi - lo)) * (r - l);
  s.line(l, y, r, y, s.c('--axis'), 0.35);
  if (ticks) {
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      s.line(X(v), y - 1 * s.u, X(v), y + 1 * s.u, s.c('--axis'), 0.3);
      s.text(str(v), X(v), y + 4 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    }
  }
  return X;
}

/** A value on a number line: a dot, its label above, and optionally its result below. */
function dot(s: Scene, x: number, y: number, label: string, hi: number, below?: string) {
  const u = s.u;
  s.circle(x, y, (1.3 + 0.4 * hi) * u, { fill: s.tint('orange', 0.45 + 0.55 * hi), stroke: s.c('--card'), lw: 0.35 });
  s.text(label, x, y - 4 * u, { size: 3, font: 'mono', weight: 500 + 150 * hi, color: s.c(hi > 0.5 ? 'orange' : '--ink-3'), halo: true });
  if (below) s.alpha(hi, () => s.text(below, x, y + 8.5 * u, { size: 3.4, font: 'mono', weight: 700, color: s.c('orange'), halo: true }));
}

// ---- 1. Batch norm's answer for one example depends on the rest of its batch

const BATCHES = [[9, 3, 17, 11], [9, 3], [9]];
const BEATS = ['recall', 'two', 'one'];

const company: SceneDef = {
  draw(s) {
    const u = s.u;
    const ys = (s.tall ? [0.17, 0.43, 0.69] : [0.16, 0.42, 0.68]).map((f) => s.h * f);
    const nine = [s.ease('company', 0.6), s.ease('two', 0.6, 2.5), s.ease('one', 0.6, 2)];
    // The same 9, landing in three places.
    s.alpha(after(s, 'one', 0.6), () => {
      const X = (v: number) => 10 * u + ((v + 2.3) / 4.6) * (s.w - 20 * u);
      const pts = BATCHES.map((b, r) => [X(norm(b)[0]!), ys[r]! + 3 * u] as const);
      // From below one result label to just above the next 9.
      for (let r = 0; r < 2; r++) s.line(pts[r]![0], pts[r]![1] + 11 * u, pts[r + 1]![0], pts[r + 1]![1] - 6.5 * u, s.tint('orange', 0.6), 0.3, [1, 0.8]);
    });
    BATCHES.forEach((b, r) => {
      const a = s.ease(BEATS[r]!, 0.6);
      const y = ys[r]!;
      s.alpha(a, () => {
        s.text(`batch of ${b.length}:  z = ${b.join(', ')}`, 8 * u, y - 7.5 * u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
        const X = axis(s, y + 3 * u, -2.3, 2.3, 1);
        const xh = norm(b);
        b.forEach((v, i) => {
          const grow = r === 0 ? after(s, 'recall', 0.45 + 0.08 * i, 0.4) : after(s, BEATS[r]!, 0.5, 0.5);
          s.alpha(grow, () => dot(s, X(xh[i]!), y + 3 * u, String(v), i === 0 ? nine[r]! : 0, i === 0 ? `9 → ${signed(xh[0]!)}` : undefined));
        });
      });
    });
    const cy = s.h * 0.92;
    s.alpha(s.win('recall', 'company'), () => caption(s, 'one unit\'s z over a batch, slid and squeezed', cy, '--ink-2', 3.2));
    s.alpha(s.win('company', 'two'), () => caption(s, '9 → −0.2, because of 3, 17 and 11', cy, 'orange', 3.4));
    s.alpha(s.win('two', 'always'), () => caption(s, 'mean 6, spread 3:  9 → +1', cy, 'orange', 3.4));
    s.alpha(s.win('always', 'one'), () => caption(s, 'any batch of two: +1 and −1', cy, '--ink-2', 3.4));
    s.alpha(s.ease('one', 0.6) * (1 - after(s, 'one', 0.6)), () => caption(s, 'a batch of one: 9 is its own mean → 0', cy, 'red', 3.3));
    s.alpha(after(s, 'one', 0.6), () => caption(s, 'the same 9: −0.2, +1 or 0, by its company', cy, 'orange', 3.2));
  },
};

// ---- 2. Batch norm goes down a column; layer norm goes along a row

/** Column 0 is the unit from scene 1; row 0 is the example followed in scene 3. */
const X = [
  [9, 1, 15, 7],
  [3, 8, 2, 6],
  [17, 4, 12, 0],
  [11, 5, 9, 14],
];
/** The other examples, changed: example 0's layer norm does not move. */
const X2 = [
  [9, 1, 15, 7],
  [6, 2, 10, 3],
  [1, 13, 5, 8],
  [4, 7, 0, 16],
];
const XH0 = norm(X[0]!);

const sideways: SceneDef = {
  draw(s) {
    const u = s.u;
    const pw = s.tall ? 15 : 16;
    const g = grid(s, s.w / 2 + 7 * u, s.h * 0.36, 4, 4, pw, 9.5);
    const col = s.win('grid', 'row');
    const row = s.ease('row', 0.6);
    const all = s.win('name', 'alone');
    const alone = s.win('alone', 'same');
    const back = s.ease('same', 0.8);
    const others = 1 - s.ease('alone', 0.6) + back;
    band(s, g, 'col', 0, BN, col);
    band(s, g, 'row', 0, LN, row);
    for (let i = 1; i < 4; i++) band(s, g, 'row', i, LN, all * 0.6 * others);
    const lab = { size: 2.7, font: 'mono', weight: 600 } as const;
    s.text('feature', g.l - 2.5 * u, g.t - 4.5 * u, { ...lab, align: 'right', color: s.c('--ink-3') });
    for (let j = 0; j < 4; j++) s.text(String(j), g.x(j), g.t - 4.5 * u, { ...lab, size: 3, color: s.c(j === 0 && col > 0.5 ? BN : '--ink-3') });
    const cellO = { w: pw - 3, h: 7.5, size: 3.2 };
    // Row 0 always; the other rows leave for the batch of one and come back changed.
    matrix(s, { ...g, m: 1 }, [X[0]!.map(String)], 'orange', { ...cellO, on: () => row * 0.5 });
    s.text('example 0', g.l - 2.5 * u, g.y(0), { ...lab, align: 'right', color: s.c(row > 0.5 ? LN : '--ink-3') });
    for (let i = 1; i < 4; i++) {
      const y = g.y(i);
      s.alpha(1 - s.ease('alone', 0.6), () => {
        X[i]!.forEach((v, j) => s.cell(g.x(j) - (cellO.w / 2) * u, y - (cellO.h / 2) * u, cellO.w * u, cellO.h * u, String(v), 'orange', { size: cellO.size, on: j === 0 ? col * 0.5 : 0 }));
        s.text(`example ${i}`, g.l - 2.5 * u, y, { ...lab, align: 'right', color: s.c('--ink-3') });
      });
      s.alpha(back, () => {
        X2[i]!.forEach((v, j) => s.cell(g.x(j) - (cellO.w / 2) * u, y - (cellO.h / 2) * u, cellO.w * u, cellO.h * u, String(v), 'orange', { size: cellO.size, on: 0.6 }));
        s.text(`example ${i}`, g.l - 2.5 * u, y, { ...lab, align: 'right', color: s.c('--ink-3') });
      });
    }
    // Direction arrows: down the column, along the row.
    s.alpha(col, () => s.arrow(g.x(0) - (pw / 2 - 0.2) * u, g.t + 1 * u, g.x(0) - (pw / 2 - 0.2) * u, g.b - 1 * u, s.c(BN), 0.4, 1.8));
    s.alpha(row * (1 - s.ease('alone', 0.6)), () => s.arrow(g.l + 1 * u, g.y(0) - 5.2 * u, g.r - 1 * u, g.y(0) - 5.2 * u, s.c(LN), 0.4, 1.8));

    // A batch of one: batch norm has nothing to compare with; layer norm still has the row.
    const yb = s.h * 0.66;
    const yl = s.h * 0.78;
    s.alpha(alone * after(s, 'alone', 0.3), () => {
      rowLabel(s, 'batch norm', g.l - 2.5 * u, yb, BN, 3);
      cells(s, [0, 1, 2, 3].map(g.x), yb, ['0', '0', '0', '0'], 'red', { w: pw - 3, h: 7.5, size: 3.2 });
    });
    s.alpha(after(s, 'alone', 0.6) * (1 - s.ease('same', 0.6)) + back, () => {
      rowLabel(s, 'layer norm', g.l - 2.5 * u, yl, LN, 3);
      cells(s, [0, 1, 2, 3].map(g.x), yl, XH0.map(str), LN, { w: pw - 3, h: 7.5, size: 3.2, on: XH0.map(() => back) });
    });

    cite(s, 'Ba, Kiros & Hinton, 2016', s.win('paper', 'row'));
    const cy = s.h * 0.92;
    s.alpha(s.win('grid', 'paper'), () => rich(s, [['batch norm', BN], [': down each column', '--ink-2']], s.w / 2, cy, { size: 3.4 }));
    s.alpha(s.win('paper', 'row'), () => caption(s, 'so it depends on the batch size', cy, '--ink-2', 3.4));
    s.alpha(s.win('row', 'name'), () => rich(s, [['layer norm', LN], [': along each row', '--ink-2']], s.w / 2, cy, { size: 3.4 }));
    s.alpha(s.win('name', 'alone'), () => caption(s, 'a row: every unit of a layer, one example', cy, '--ink-2', 3.2));
    s.alpha(alone, () => {
      const t = 'a batch of one: layer norm still works';
      const w = s.measure(t, { size: 3.3 }) + 3.3 * 1.4 * u;
      verdict(s, true, t, s.w / 2 - w / 2, cy, 3.3);
    });
    s.alpha(back, () => caption(s, 'the others change; example 0 does not', cy, LN, 3.3));
  },
};

// ---- 3. One row, worked: slide by the mean, squeeze by the spread, then γ and β

const XS = X[0]!;
const MU = 8;
const SD = 5;

/** A bracket from a to b at height y, labelled at its right end. */
function bracket(s: Scene, a: number, b: number, y: number, label: string) {
  const u = s.u;
  s.line(a, y, b, y, s.c('teal'), 0.4);
  s.line(a, y - 1.2 * u, a, y + 1.2 * u, s.c('teal'), 0.4);
  s.line(b, y - 1.2 * u, b, y + 1.2 * u, s.c('teal'), 0.4);
  s.text(label, b + 2 * u, y, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('teal'), halo: true });
}

const one: SceneDef = {
  draw(s) {
    const u = s.u;
    const table = s.ease('gamma', 0.8);
    const lines = 1 - table;
    const xs = columns(s, 4, s.tall ? 16 : 18).map((x) => x + 4 * u);
    const lx = xs[0]! - 10 * u;
    // The row itself, as cells, while the lines do the work.
    s.alpha(lines, () => {
      rowLabel(s, 'x', lx, s.h * 0.1, 'orange', 3.8);
      cells(s, xs, s.h * 0.1, XS.map(String), 'orange', { w: 12, h: 7.5, size: 3.3, on: XS.map(() => s.win('x', 'mean')) });
    });
    const y1 = s.h * 0.34;
    const y2 = s.h * 0.62;
    s.alpha(lines, () => {
      const A = axis(s, y1, -9, 17, 5);
      const slide = after(s, 'mean', 0.55, 1.2);
      // The mean, then every value slid down by it.
      s.alpha(after(s, 'mean', 0.2), () => {
        const m = A(MU * (1 - slide));
        s.line(m, y1 - 12 * u, m, y1 + 1.5 * u, s.c('orange'), 0.4, [1, 0.8]);
        s.text(slide > 0.5 ? 'μ → 0' : 'μ = 8', m, y1 - 14.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      });
      const sq = s.ease('var', 0.6, 1.2);
      XS.forEach((v) => {
        const p = v - MU * slide;
        const d = v - MU;
        s.circle(A(p), y1, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 });
        s.alpha(1 - sq, () => s.text(slide > 0.5 ? signed(d) : String(v), A(p), y1 - 4.5 * u, { size: 3, font: 'mono', weight: 600, color: s.c('orange'), halo: true }));
        s.alpha(sq * (1 - s.ease('xhat', 0.6)), () => s.text(String(d * d), A(p), y1 - 4.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
      });
      s.alpha(s.ease('sigma', 0.6, 0.6), () => bracket(s, A(-SD), A(SD), y1 + 9 * u, 'σ = 5'));
      // The squeeze: each slid value divided by 5, on a line of its own.
      s.alpha(s.ease('xhat', 0.6), () => {
        const B = axis(s, y2, -2, 2, 1);
        bracket(s, B(-1), B(1), y2 + 9 * u, 'σ → 1');
        norm(XS).forEach((v, i) => {
          const a = i === 0 ? s.ease('xhat', 0.6, 0.5) : after(s, 'xhat', 0.45, 0.5);
          s.alpha(a, () => {
            s.arrow(A(XS[i]! - MU), y1 + 2.5 * u, B(v), y2 - 7 * u, s.tint('--ink-3', 0.7), 0.3, 1.8);
            s.circle(B(v), y2, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 });
            const al: CanvasTextAlign = Math.abs(v) > 0.5 ? 'center' : v < 0 ? 'right' : 'left';
            s.text(str(v), B(v) + (al === 'right' ? 1.2 : al === 'left' ? -1.2 : 0) * u, y2 - 4.5 * u, { size: 3, font: 'mono', weight: 650, align: al, color: s.c('orange'), halo: true });
          });
        });
      });
    });

    // The learned scale and shift: one pair per feature.
    const num = s.ease('scale', 0.6);
    const ys = [0.2, 0.36, 0.52, 0.68].map((f) => s.h * f);
    s.alpha(table, () => {
      rowLabel(s, 'x̂', lx, ys[0]!, 'orange', 3.8);
      cells(s, xs, ys[0]!, norm(XS).map(str), 'orange', { w: 12, h: 7.5, size: 3.3, on: [num, 0, 0, 0] });
      rowLabel(s, 'γ', lx, ys[1]!, 'purple', 3.8);
      cells(s, xs.slice(1), ys[1]!, ['γ₁', 'γ₂', 'γ₃'], 'purple', { w: 12, h: 7.5, size: 3.1 });
      s.alpha(1 - num, () => cells(s, [xs[0]!], ys[1]!, ['γ₀'], 'purple', { w: 12, h: 7.5, size: 3.1 }));
      rowLabel(s, 'β', lx, ys[2]!, 'green', 3.8);
      cells(s, xs.slice(1), ys[2]!, ['β₁', 'β₂', 'β₃'], 'green', { w: 12, h: 7.5, size: 3.1 });
      s.alpha(1 - num, () => cells(s, [xs[0]!], ys[2]!, ['β₀'], 'green', { w: 12, h: 7.5, size: 3.1 }));
    });
    // Feature 0's pair, filled in.
    s.alpha(num, () => {
      cells(s, [xs[0]!], ys[1]!, ['2'], 'purple', { w: 12, h: 7.5, size: 3.3, on: [1] });
      cells(s, [xs[0]!], ys[2]!, ['1'], 'green', { w: 12, h: 7.5, size: 3.3, on: [1] });
      s.alpha(after(s, 'scale', 0.6), () => {
        rowLabel(s, 'y', lx, ys[3]!, 'gold', 3.8);
        cells(s, [xs[0]!], ys[3]!, ['1.4'], 'gold', { w: 12, h: 7.5, size: 3.3, on: [1] });
      });
    });
    s.alpha(s.ease('count', 0.6), () => {
      const x = xs[3]! + 8 * u;
      const [y0, y1] = [ys[1]! - 4 * u, ys[2]! + 4 * u];
      s.line(x, y0, x, y1, s.c('--ink-3'), 0.35);
      s.line(x - 1.2 * u, y0, x, y0, s.c('--ink-3'), 0.35);
      s.line(x - 1.2 * u, y1, x, y1, s.c('--ink-3'), 0.35);
      s.text('2d', x + 2 * u, (y0 + y1) / 2, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
    });

    const cy = s.h * 0.9;
    s.alpha(s.win('x', 'mean'), () => caption(s, 'example 0: the layer\'s 4 units', cy, 'orange', 3.4));
    s.alpha(s.win('mean', 'var') * (1 - after(s, 'mean', 0.55)), () => caption(s, '(9 + 1 + 15 + 7) / 4 = 8', cy, 'orange', 3.5));
    s.alpha(after(s, 'mean', 0.55) * (1 - s.ease('var', 0.6)), () => caption(s, 'slide: subtract 8', cy, 'orange', 3.5));
    s.alpha(s.win('var', 'sigma'), () => caption(s, '(1 + 49 + 49 + 1) / 4 = 25', cy, 'red', 3.5));
    s.alpha(s.win('sigma', 'xhat'), () => rich(s, [['σ', 'teal'], [' = √25 = 5: squeeze by it', '--ink-2']], s.w / 2, cy, { size: 3.4 }));
    s.alpha(s.win('xhat', 'gamma'), () => caption(s, '(9 − 8) / 5 = 0.2', cy, 'orange', 3.6));
    s.alpha(s.win('gamma', 'scale'), () => rich(s, [['y = ', 'gold'], ['γ', 'purple'], [' x̂ + ', '--ink-2'], ['β', 'green'], [', one pair per feature', '--ink-3']], s.w / 2, cy, { size: 3.4 }));
    s.alpha(s.win('scale', 'count'), () => caption(s, '2 × 0.2 + 1 = 1.4', cy, 'gold', 3.8));
    s.alpha(s.ease('count', 0.6), () => {
      rich(s, [['d', 'slate'], [' features → ', '--ink-2'], ['2d', 'slate'], [' learned numbers', '--ink-2']], s.w / 2, cy - 3 * u, { size: 3.4 });
      s.alpha(after(s, 'count', 0.6), () => caption(s, 'd = 512 → 1,024, for any batch size', cy + 3.5 * u, '--ink-2', 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { company, sideways, one };
