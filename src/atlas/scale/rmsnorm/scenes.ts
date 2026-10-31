import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, cells, cite, columns, downArrows, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { box } from '../../sequences/draw';

const X = [1, -5, 5, 7];
const SQ = X.map((v) => v * v);
const OUT = X.map((v) => v / 5);
const MEAN = X.reduce((a, v) => a + v, 0) / X.length;
const SD = Math.sqrt(X.reduce((a, v) => a + (v - MEAN) ** 2, 0) / X.length);
const SHIFT = X.map((v) => v + 3);
const RS = Math.sqrt(SHIFT.reduce((a, v) => a + v * v, 0) / 4);
const n = (v: number) => String(Number(v.toFixed(2))).replace('-', '−');

/** A pipeline of step boxes joined by arrows; `gone` steps are drawn struck out. */
function pipeline(s: Scene, y: number, steps: string[], k: 'purple' | 'teal', gone: boolean[] = [], a = 1): void {
  const pitch = s.tall ? 24 : 28;
  const xs = columns(s, steps.length, pitch);
  const w = pitch - 7;
  s.alpha(a, () => {
    xs.forEach((x, i) => {
      s.alpha(gone[i] ? 0.35 : 1, () => box(s, x, y, steps[i]!, k, { w, h: 8, size: 3.1 }));
      if (gone[i]) s.line(x - (w / 2) * s.u, y, x + (w / 2) * s.u, y, s.c('red'), 0.45);
      if (i) s.arrow(xs[i - 1]! + (w / 2) * s.u, y, x - (w / 2) * s.u, y, s.c('--ink-3'), 0.3, 1.6);
    });
  });
}

// ---- layer norm's two jobs on one token's features, drawn as bars around zero

/** The bars' values at this moment: slid by the mean, shrunk by the spread, then reset and shrunk by the RMS. */
function barValues(s: Scene): number[] {
  const back = s.ease('bet', 0.8, 0.4);
  const slide = s.ease('center', 1.2, 1.6) * (1 - back);
  const stretch = s.ease('scale', 1.2, 1.4) * (1 - back);
  const rms = after(s, 'bet', 0.55, 1.2);
  return X.map((v) => {
    const ln = (v - MEAN * slide) / lerp(1, SD, stretch);
    return ln / lerp(1, 5, rms);
  });
}

const jobs: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 17 : 15);
    const base = s.h * 0.4;
    const U = 3.2 * s.u;
    const grow = s.ease('x', 1, 0.6);
    const vs = barValues(s);
    s.line(xs[0]! - 10 * s.u, base, xs[3]! + 10 * s.u, base, s.c('--axis'), 0.35);
    s.text('0', xs[0]! - 12 * s.u, base, { size: 3, font: 'mono', color: s.c('--ink-3') });
    // The mean, before the bars slide down onto zero.
    s.alpha(s.ease('center', 0.6) * (1 - s.ease('center', 1.2, 1.6)), () => {
      s.line(xs[0]! - 10 * s.u, base - MEAN * U, xs[3]! + 10 * s.u, base - MEAN * U, s.c('red'), 0.35, [1.2, 0.8]);
      s.text('mean 2', xs[3]! + 11 * s.u, base - MEAN * U, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true });
    });
    xs.forEach((x, i) => {
      const v = vs[i]! * grow;
      const hh = v * U;
      const w = 7 * s.u;
      s.rrect(x - w / 2, Math.min(base, base - hh), w, Math.max(Math.abs(hh), 0.5 * s.u), 0.8, { fill: s.tint('orange', 0.4), stroke: s.tint('orange', 0.9), lw: 0.3 });
      s.alpha(grow, () => s.text(n(vs[i]!), x, base - hh + (v >= 0 ? -3 : 3) * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c('orange'), halo: true }));
    });
    const cy = s.h * 0.71;
    const cap = (t: string, k: 'red' | 'purple' | 'teal' | '--ink-2', a: number) => s.alpha(a, () => s.text(t, s.w / 2, cy, { size: 3.3, font: 'mono', color: s.c(k), halo: true }));
    cap('one token: four features', '--ink-2', s.win('x', 'center'));
    cap('re-center: subtract the mean, 2', 'red', s.win('center', 'scale'));
    cap(`re-scale: divide by the std, ${n(SD)}`, 'purple', s.win('scale', 'cost'));
    cap('both, for every token, in every layer', '--ink-2', s.win('cost', 'bet'));
    const named = after(s, 'bet', 0.75);
    cap('bet: only the re-scaling matters', 'teal', s.ease('bet', 0.6) * (1 - after(s, 'bet', 0.5)));
    cap('RMSNorm: divide by the RMS, 5', 'teal', after(s, 'bet', 0.55) * (1 - named));
    cap('RMS: root mean square', 'teal', named * (1 - s.ease('result', 0.6)));
    cap('about as good, 7% to 64% less time', 'teal', s.ease('result', 0.6));
    cite(s, 'Zhang & Sennrich, 2019', s.ease('bet', 0.6));
    // Layer norm's steps, then RMSNorm's, with the re-centering struck out.
    const py = s.h * 0.86;
    const swap = after(s, 'bet', 0.35, 0.8);
    s.alpha(1 - swap, () => {
      s.text('layer norm', s.w / 2, py - 8.5 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple') });
      pipeline(s, py, ['x', '− mean', '÷ std', '×γ + β'], 'purple');
    });
    s.alpha(swap, () => {
      s.text('RMSNorm', s.w / 2, py - 8.5 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
      pipeline(s, py, ['x', '− mean', '÷ rms', '× γ'], 'teal', [false, true, false, false]);
    });
  },
};

// ---- the root mean square, read backwards: square, mean, root

const rms: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{rms}(\symx) = \sqrt{\tfrac{1}{\symd}\textstyle\sum_i \symx_i^2}`, x: 0.5, y: 0.09, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('root', 0.6, 1.5));
    // The name read backwards: square first, then the mean, then the root.
    s.alpha(s.ease('sq', 0.6) * (1 - s.ease('root', 0.5, 1.2)), () => {
      const k = (on: number) => (on > 0.5 ? 'teal' : '--ink-3') as 'teal' | '--ink-3';
      const root = s.ease('root', 0.3);
      const mean = s.ease('mean', 0.3) * (1 - root);
      const sq = 1 - s.ease('mean', 0.3);
      rich(s, [['root', k(root)], [' of the ', '--ink-3'], ['mean', k(mean)], [' of the ', '--ink-3'], ['squares', k(sq)]], s.w / 2, s.h * 0.09, { size: 3.6, weight: 650 });
    });
    const xs = columns(s, 4, s.tall ? 20 : 22);
    const lx = xs[0]! - 13 * s.u;
    const ys = [s.h * 0.24, s.h * 0.42, s.h * 0.74];
    rowLabel(s, 'x', lx, ys[0]!, 'orange');
    cells(s, xs, ys[0]!, X.map(n), 'orange', { on: X.map(() => s.win('size', 'sq')) });
    const ym = (ys[1]! + ys[2]!) / 2;
    s.alpha(s.win('size', 'socket'), () => {
      s.text('mean: (1 − 5 + 5 + 7) / 4 = 2', s.w / 2, ys[1]!, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('the signs cancel', s.w / 2, ys[1]! + 6 * s.u, { size: 3.2, color: s.c('red') });
    });
    // A wall socket's voltage: it swings both ways, averages zero, and is rated by its RMS.
    s.alpha(s.win('socket', 'sq'), () => {
      const l = s.w / 2 - 36 * s.u;
      const r = s.w / 2 + (s.tall ? 16 : 24) * s.u;
      const mid = (ys[1]! + ys[2]!) / 2 - 2 * s.u;
      const A = 13 * s.u;
      const g = s.ctx;
      const draw = Math.min(1, s.ease('socket', 2.4, 0.3));
      g.beginPath();
      for (let i = 0; i <= 200 * draw; i++) {
        const x = l + ((r - l) * i) / 200;
        const y = mid - A * Math.sin((i / 200) * Math.PI * 6);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.strokeStyle = s.c('orange');
      g.lineWidth = 0.6 * s.u;
      g.stroke();
      s.line(l, mid, r, mid, s.c('--axis'), 0.3);
      const lab = { size: 3, font: 'mono' as const, weight: 600, halo: true };
      s.text('+170 V', l - 1.5 * s.u, mid - A, { ...lab, align: 'right', color: s.c('orange') });
      s.text('−170 V', l - 1.5 * s.u, mid + A, { ...lab, align: 'right', color: s.c('orange') });
      s.alpha(s.ease('socket', 0.6, 2.5), () => s.text('average: 0', r + 1.5 * s.u, mid, { ...lab, align: 'left', color: s.c('--ink-2') }));
      s.alpha(s.ease('socket', 0.6, 5.5), () => {
        const yr = mid - A * (120 / 170);
        s.line(l, yr, r, yr, s.c('teal'), 0.4, [1.2, 0.8]);
        s.text('120 V: its RMS', r + 1.5 * s.u, yr, { ...lab, align: 'left', color: s.c('teal') });
      });
    });
    s.alpha(s.ease('sq', 0.6), () => {
      downArrows(s, xs, ys[0]! + 5.5 * s.u, ys[1]! - 5.5 * s.u);
      rowLabel(s, 'x²', lx, ys[1]!, 'orange');
      cells(s, xs, ys[1]!, SQ.map(n), 'orange', { on: SQ.map(() => s.win('sq', 'root')) });
    });
    s.alpha(s.ease('sq', 0.6, 2) * (1 - s.ease('mean', 0.5)), () => s.text('no square is negative: nothing cancels', s.w / 2, ym, { size: 3.3, color: s.c('--ink-2') }));
    s.alpha(s.ease('mean', 0.6), () => s.text('mean of the squares: 100 / 4 = 25', s.w / 2, ym - 3 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('root', 0.6), () => s.text('root: rms = √25 = 5', s.w / 2, ym + 3.5 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') }));
    s.alpha(s.ease('out', 0.6), () => {
      rowLabel(s, 'x / 5', lx, ys[2]!, 'teal', 3.6);
      cells(s, xs, ys[2]!, OUT.map(n), 'teal', { on: OUT.map(() => s.ease('out', 0.6, 1)) });
    });
    const by = s.h * 0.88;
    const size = s.tall ? 3.2 : 3.6;
    s.alpha(s.win('gain', 'params'), () => s.text('× γ: one learned gain per feature, starting at 1', s.w / 2, by, { size, color: s.c('purple') }));
    s.alpha(s.ease('params', 0.6), () => s.text('no β: d parameters, where layer norm has 2d', s.w / 2, by, { size, color: s.c('purple') }));
  },
};

// ---- what dropping the mean costs: a scale cancels, a shift does not

const shift: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 17 : 19);
    const lx = xs[0]! - 11 * s.u;
    const rx = xs[3]! + 8.5 * s.u;
    const rows: [string, number[], number[], number, string, number][] = [
      ['x', X, OUT, 5, 'base', 1],
      ['3x', X.map((v) => 3 * v), OUT, 15, 'scale', s.ease('scale', 0.6)],
      ['x + 3', SHIFT, SHIFT.map((v) => v / RS), RS, 'shift', s.ease('shift', 0.6)],
    ];
    s.text('input, then RMSNorm\'s output', s.w / 2, s.h * 0.06, { size: 3.2, color: s.c('--ink-3') });
    rows.forEach(([name, inp, out, r, beat, a], i) => {
      const y = s.h * (0.17 + i * 0.25);
      s.alpha(a, () => {
        rowLabel(s, name, lx, y, 'orange', 3.6);
        cells(s, xs, y, inp.map(n), 'orange', { w: 13, h: 7, size: 3.2 });
        s.text(`÷ ${n(r)}`, rx, y + 4.75 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
        const ok = beat !== 'shift';
        cells(s, xs, y + 9.5 * s.u, out.map(n), ok ? 'teal' : 'red', { w: 13, h: 7, size: 3.2, on: beat === 'base' ? [0, 0, 0, 0] : out.map(() => 1) });
        if (beat !== 'base') s.alpha(s.ease(beat, 0.6, 1.5), () => s.text(ok ? 'same' : 'moved', lx, y + 9.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c(ok ? 'green' : 'red'), halo: true }));
      });
    });
    s.alpha(s.ease('ln', 0.6), () => {
      const y = s.h * 0.92;
      s.text('layer norm subtracts the mean: x + 3 gives', s.w / 2, y - 4 * s.u, { size: 3.1, color: s.c('purple') });
      s.text('the same output as x', s.w / 2, y, { size: 3.1, color: s.c('purple') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { jobs, rms, shift };
