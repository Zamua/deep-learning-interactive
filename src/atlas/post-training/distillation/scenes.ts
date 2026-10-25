import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { block } from '../draw';

const CLS = ['cat', 'dog', 'car'];
const S = [4, 2, 0];
const soft = (z: number[]) => {
  const e = z.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const f2 = (v: number) => v.toFixed(2);
const P = [0.6, 0.2, 0.2];
const NL = ['0.51', '1.61', '1.61'];

/** Class names over the columns. */
function names(s: Scene, xs: number[], y: number, size = 3.2): void {
  CLS.forEach((c, j) => s.text(c, xs[j]!, y, { size, font: 'mono', weight: 600, color: s.c('--ink-2') }));
}

const teacher: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 22).map((x) => x + 6 * s.u);
    const lx = xs[0]! - 12 * s.u;
    names(s, xs, 9 * s.u);
    rowLabel(s, 's', lx, 18 * s.u, 'purple');
    cells(s, xs, 18 * s.u, S.map(String), 'purple', { w: 13, h: 8 });
    s.alpha(s.ease('teacher', 0.6, 0.3) * (1 - s.ease('probs', 0.5)), () => {
      const cx = s.w / 2;
      block(s, cx - 16 * s.u, 52 * s.u, 30 * s.u, 22 * s.u, 'teacher', 'green');
      block(s, cx + 22 * s.u, 52 * s.u, 18 * s.u, 11 * s.u, 'student', 'teal', { size: 3.4 });
      s.arrow(cx + 0.5 * s.u, 52 * s.u, cx + 11.5 * s.u, 52 * s.u, s.c('--ink-3'), 0.4, 2);
    });
    const base = 64 * s.u;
    const g = s.ease('probs', 0.9, 0.4);
    const hint = s.ease('label', 0.6, 1.8);
    s.alpha(s.ease('probs', 0.5), () => {
      rowLabel(s, 'teacher', lx, base - 8 * s.u, 'green', 3.6);
      bars(s, xs, base, soft(S), 'green', { max: 1, height: 34, w: 10, grow: g, fmt: f2, hi: [s.win('probs', 'label'), hint, hint] });
    });
    s.alpha(hint, () => {
      const o = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
      s.text('close', xs[1]!, base + 3.6 * s.u, o);
      s.text('far', xs[2]!, base + 3.6 * s.u, o);
    });
    s.alpha(s.ease('label', 0.6), () => {
      rowLabel(s, 'label', lx, 76 * s.u, 'gold', 3.6);
      cells(s, xs, 76 * s.u, ['1', '0', '0'], 'gold', { w: 13, h: 8 });
    });
    s.alpha(s.ease('student', 0.6, 0.6), () => {
      s.text('the student learns from these, not just the label', s.w / 2, 90 * s.u, { size: 3.2, color: s.c('--ink-2') });
    });
  },
};

const ROWS: [string, number, string][] = [
  ['T = 1', 1, 'tiny'],
  ['T = 2', 2, 'temp'],
  ['T = 4', 4, 'higher'],
];

const soften: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{q}{q} = \mathrm{softmax}(\syms / \symT)`, x: 0.5, y: 0.07, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('temp', 0.6));
    const xs = columns(s, 3, 15).map((x) => x + 12 * s.u);
    const lx = xs[0]! - 10 * s.u;
    ROWS.forEach(([name, T, beat], r) => {
      const base = (36 + 26 * r) * s.u;
      const a = r === 0 ? 1 : s.ease(beat, 0.6, r === 1 ? 2 : 0);
      const z = S.map((v) => v / T);
      const hi = r === 0 ? [0, 0, s.win('tiny', 'temp')] : r === 1 ? [s.win('soft', 'higher'), s.win('soft', 'higher'), s.win('soft', 'higher')] : [0, 0, 0];
      s.alpha(a, () => {
        rowLabel(s, name, lx, base - 8 * s.u, 'slate', 3.4);
        s.text(`s/T = [${z.map((v) => String(v)).join(', ')}]`, lx, base - 2.5 * s.u, { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') });
        bars(s, xs, base, soft(z), 'green', { max: 1, height: 15, w: 9, fmt: f2, grow: r === 0 ? 1 : s.ease(beat, 0.9, r === 1 ? 2 : 0), hi });
        names(s, xs, base + 3.4 * s.u, 2.6);
      });
    });
    const o = { size: 3.2, font: 'mono', weight: 650, align: 'left', halo: true } as const;
    s.alpha(s.win('tiny', 'temp'), () => s.text('faint', xs[2]! + 7 * s.u, 30 * s.u, { ...o, color: s.c('--ink-3') }));
    s.alpha(s.win('soft', 'higher'), () => {
      s.text('e: 7.39 + 2.72 + 1 = 11.11', xs[1]!, 71 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('soft', 0.6, 1.5), () => s.text('q', xs[2]! + 7 * s.u, 56 * s.u, { ...o, size: 4, color: s.c('green') }));
    s.alpha(s.ease('higher', 0.6, 1.5), () => s.text('flatter', xs[2]! + 7 * s.u, 82 * s.u, { ...o, color: s.c('blue') }));
  },
};

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\sum_k \sym{q}{q}_k \ln \symp_k`, x: 0.5, y: 0.07, size: 4.6 },
  },
  draw(s) {
    const xs = columns(s, 3, 18).map((x) => x + 8 * s.u);
    const lx = xs[0]! - 10 * s.u;
    const cw = { w: 13, h: 8 };
    names(s, xs, 16 * s.u);
    const sw = s.ease('soft', 0.8);
    s.alpha(s.ease('hard', 0.6) * (1 - sw), () => {
      rowLabel(s, 'label', lx, 25 * s.u, 'gold', 3.6);
      cells(s, xs, 25 * s.u, ['1', '0', '0'], 'gold', cw);
    });
    s.alpha(sw, () => {
      rowLabel(s, 'q', lx, 25 * s.u, 'green', 3.6);
      cells(s, xs, 25 * s.u, ['0.67', '0.24', '0.09'], 'green', { ...cw, on: [1, 1, 1].map(() => s.win('soft', 'sum')) });
    });
    rowLabel(s, 'p', lx, 36 * s.u, 'teal', 3.6);
    cells(s, xs, 36 * s.u, P.map(String), 'teal', { ...cw, on: [0, 1, 2].map(() => s.win('p', 'hard')) });
    s.alpha(s.ease('hard', 0.6, 1), () => {
      rowLabel(s, '−ln p', lx, 47 * s.u, 'red', 3.6);
      cells(s, xs, 47 * s.u, NL, 'red', cw);
    });
    const hardA = s.ease('hard', 0.6, 3) * (1 - sw);
    const sumA = s.ease('sum', 0.6);
    s.alpha(Math.max(hardA, sumA), () => rowLabel(s, 'weighted', lx, 58 * s.u, 'red', 3.6));
    s.alpha(hardA, () => cells(s, xs, 58 * s.u, ['0.51', '0', '0'], 'red', { ...cw, on: [1, 0, 0] }));
    s.alpha(sumA, () => cells(s, xs, 58 * s.u, ['0.34', '0.39', '0.14'], 'red', { ...cw, on: [1, 1, 1].map(() => 1 - s.ease('best', 0.6)) }));
    const o = { size: 3.6, font: 'mono', weight: 650, color: s.c('red'), halo: true } as const;
    s.alpha(s.ease('hard', 0.6, 4.5) * (1 - sw), () => s.text('L = −ln 0.6 = 0.51', s.w / 2, 69 * s.u, o));
    s.alpha(s.ease('sum', 0.6, 2.5), () => s.text('L = 0.34 + 0.39 + 0.14 = 0.87', s.w / 2, 69 * s.u, o));
    const b = { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.ease('best', 0.6, 0.4), () => s.text('p = q: L = 0.83, the lowest', s.w / 2, 80 * s.u, { ...b, color: s.c('green') }));
    s.alpha(s.ease('best', 0.6, 3.2), () => s.text('p = [1, 0, 0]: L = ∞', s.w / 2, 89 * s.u, b));
    s.show('f', s.ease('soft', 0.6, 1.5));
  },
};

export const scenes: Record<string, SceneDef> = { teacher, soften, loss };
