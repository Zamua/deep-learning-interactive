import type { SceneDef } from '../../../lecture/scene';
import { cells, chip, columns, num, rich, rowLabel } from '../draw';

const TOKS = ['Paris', 'Rome', 'the'] as const;
const KS = ['purple', 'teal', 'slate'] as const;
// Made-up lens readouts for the overview: the answer forms as the writes add up.
const READ = [
  [1.3, 0.4, 0.9],
  [0.7, 1.5, 0.9],
  [0.5, 2.2, 0.5],
  [0.3, 2.9, 0.2],
];
const NAMES = ['x₀', 'x₁', 'x₂', 'top'];

const idea: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 26 : 30);
    const base = s.h * 0.56;
    const yChip = s.h * 0.68;
    rich(s, [['Paris', 'purple'], ['   ', '--ink'], ['Rome', 'teal'], ['   ', '--ink'], ['the', 'slate']], s.w / 2, s.h * 0.09, { size: 3.4, weight: 600 });
    xs.forEach((x, c) => {
      const top = c === 3;
      const a = top ? s.ease('top', 0.6, 1) : s.ease('lens', 0.6, 1 + 0.8 * c);
      chip(s, x, yChip, NAMES[c]!, 'orange', { w: 11, h: 7, on: top ? 1 : s.ease('sum', 0.6) });
      if (c) s.alpha(s.ease('sum', 0.6, 0.4 * c), () => {
        s.arrow(xs[c - 1]! + 6.5 * s.u, yChip, x - 6.5 * s.u, yChip, s.c('--ink-3'), 0.3, 1.6);
        s.text('+w', (xs[c - 1]! + x) / 2, yChip - 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('blue') });
      });
      s.alpha(a, () => {
        const v = READ[c]!;
        const best = v.indexOf(Math.max(...v));
        v.forEach((val, j) => {
          const bx = x + (j - 1) * 5.5 * s.u;
          const hh = val * 9 * s.u * a;
          s.rrect(bx - 2.2 * s.u, base - hh, 4.4 * s.u, Math.max(hh, 0.5 * s.u), 0.6, { fill: s.tint(KS[j]!, j === best ? 0.7 : 0.3), stroke: s.c(KS[j]!), lw: 0.25 });
        });
        s.line(x - 9 * s.u, base, x + 9 * s.u, base, s.c('--axis'), 0.3);
        s.text(TOKS[best]!, x, yChip + 8 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(KS[best]!) });
      });
    });
    s.alpha(s.ease('top', 0.6), () => s.text('scores = W_U x', xs[3]!, s.h * 0.2, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('lens', 0.6), () => s.text('the same W_U, applied early', s.w / 2, s.h * 0.9, { size: 3.6, weight: 600, color: s.c('green') }));
  },
};

const ROWS = [
  [2, 0],
  [0, 2],
  [1, 1],
];
const S0 = [2, 0, 1];
const S1 = [0, 4, 2];

const example: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const rc = [cx - 12 * s.u, cx];
    const sx = cx + (s.tall ? 24 : 28) * s.u;
    const ys = [s.h * 0.18, s.h * 0.3, s.h * 0.42];
    const lx = rc[0]! - 9 * s.u;
    s.text('row of W_U', (rc[0]! + rc[1]!) / 2, s.h * 0.07, { size: 3, font: 'mono', color: s.c('--ink-3') });
    const after = s.ease('x1', 0.6, 2.5);
    s.alpha(s.ease('x0', 0.6, 1), () => s.text('score', sx, s.h * 0.07, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    ROWS.forEach((r, i) => {
      rowLabel(s, TOKS[i]!, lx, ys[i]!, KS[i]!, 3.6);
      cells(s, rc, ys[i]!, r.map((v) => num(v)), KS[i]!, { w: 10, h: 8 });
      s.alpha(s.ease('x0', 0.6, 1.5 + 0.8 * i), () => {
        const v = after > 0.5 ? S1[i]! : S0[i]!;
        const best = (after > 0.5 ? S1 : S0).indexOf(Math.max(...(after > 0.5 ? S1 : S0)));
        cells(s, [sx], ys[i]!, [num(v)], KS[i]!, { w: 10, h: 8, on: [i === best ? 1 : 0] });
      });
    });
    const yx = s.h * 0.6;
    s.alpha(s.ease('x0', 0.6), () => {
      rowLabel(s, 'x', lx, yx, 'orange');
      cells(s, rc, yx, (after > 0.5 ? [0, 2] : [1, 0]).map((v) => num(v)), 'orange', { w: 10, h: 8, on: [after, after] });
    });
    s.alpha(s.ease('x1', 0.6), () => {
      s.text('+ [−1, 2]', rc[1]! + 9 * s.u, yx, { size: 3.4, font: 'mono', align: 'left', color: s.c('blue') });
    });
    s.alpha(s.ease('x0', 0.6, 4), () => {
      const name = after > 0.5 ? 'Rome' : 'Paris';
      const k = after > 0.5 ? 'teal' : 'purple';
      rich(s, [[after > 0.5 ? 'lens after block 0: ' : 'lens at x₀: ', '--ink-2'], [name, k]], cx, s.h * 0.76, { size: 3.8, weight: 650 });
    });
    s.alpha(s.ease('story', 0.6), () => s.text('Paris, then Rome: the answer forming', cx, s.h * 0.88, { size: 3.4, color: s.c('--ink-3') }));
  },
};

export const scenes: Record<string, SceneDef> = { idea, example };
