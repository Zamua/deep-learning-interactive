import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel, verdict } from '../../draw';

const S = [2, 1, -1];
const E = S.map(Math.exp);
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);
const f2 = (v: number) => v.toFixed(2);

/** Rows of the pipeline: scores, exponentials, probabilities, placed for either stage shape. */
function layout(s: Scene) {
  const gap = s.tall ? 24 : 26;
  const xs = columns(s, 3, gap);
  return { xs, ys: s.h * 0.16, ye: s.h * 0.42, base: s.h * 0.92, lx: xs[0]! - (gap / 2 + 4) * s.u };
}

const scores: SceneDef = {
  draw(s) {
    const L = layout(s);
    s.alpha(s.ease('scores', 0.6), () => {
      rowLabel(s, 's', L.lx, L.ys, 'purple');
      cells(s, L.xs, L.ys, S.map(String), 'purple', { on: S.map(() => 1 - s.ease('want', 0.6)) });
    });
    const x = s.w / 2 - 26 * s.u;
    s.alpha(s.ease('want', 0.6), () => {
      s.text('probabilities need to be', s.w / 2, s.h * 0.42, { size: 3.8, color: s.c('--ink-3') });
      verdict(s, s.since('fail') < 0, 'all positive', x, s.h * 0.56);
      verdict(s, s.since('fail') < 0, 'adding up to 1', x, s.h * 0.68);
    });
    s.alpha(s.ease('fail', 0.6, 0.6), () => {
      const o = { size: 3.6, font: 'mono', align: 'right', color: s.c('red') } as const;
      s.text('−1 < 0', s.w - 6 * s.u, s.h * 0.56, o);
      s.text('2 + 1 − 1 = 2', s.w - 6 * s.u, s.h * 0.68, o);
    });
  },
};

const exp: SceneDef = {
  draw(s) {
    const L = layout(s);
    rowLabel(s, 's', L.lx, L.ys, 'purple');
    cells(s, L.xs, L.ys, S.map(String), 'purple');
    const a = s.ease('exp', 0.8, 0.8);
    s.alpha(s.ease('exp', 0.6), () => downArrows(s, L.xs, L.ys + 6 * s.u, L.ye - 6 * s.u));
    s.alpha(s.ease('exp', 0.5, 0.3), () => {
      L.xs.forEach((x, i) => s.text(`e^${S[i]}`, x + 7 * s.u, (L.ys + L.ye) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true }));
    });
    s.alpha(a, () => {
      rowLabel(s, 'e', L.lx, L.ye, 'gold');
      const on = [s.win('grow', undefined), 0, s.win('pos', 'grow')];
      cells(s, L.xs, L.ye, E.map(f2), 'gold', { on });
      bars(s, L.xs, L.base, E, 'gold', { max: E[0]!, height: (L.base - L.ye) / s.u - 14, grow: a, fmt: f2, hi: on });
    });
  },
};

const divide: SceneDef = {
  marks: {
    f: { tex: String.raw`\symp_k = \frac{e^{\syms_k}}{\sum_j e^{\syms_j}}`, x: 0.5, y: 0.14, size: 5.4 },
  },
  draw(s) {
    const L = layout(s);
    const fA = s.ease('formula', 0.6);
    s.alpha(1 - fA, () => {
      rowLabel(s, 's', L.lx, L.ys, 'purple');
      cells(s, L.xs, L.ys, S.map(String), 'purple');
    });
    rowLabel(s, 'e', L.lx, L.ye, 'gold');
    cells(s, L.xs, L.ye, E.map(f2), 'gold', { on: E.map(() => s.win('total', 'divide')) });
    s.alpha(s.ease('total', 0.6), () => {
      s.text(`total ${E.map(f2).join(' + ')} = ${f2(TOTAL)}`, s.w / 2, L.ye + 9 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true });
    });
    const g = s.ease('divide', 1.2);
    const h = (L.base - L.ye) / s.u - 22;
    s.alpha(1 - g, () => bars(s, L.xs, L.base, E, 'gold', { max: E[0]!, height: h }));
    s.alpha(g, () => {
      rowLabel(s, 'p', L.lx, L.base - 4 * s.u, 'teal');
      bars(s, L.xs, L.base, P, 'teal', { max: 1, height: h * 1.25, grow: g, fmt: f2, hi: P.map(() => s.ease('result', 0.6)) });
    });
    s.alpha(s.ease('check', 0.6), () => {
      verdict(s, true, 'positive, sum = 1', s.w - (s.tall ? 34 : 40) * s.u, L.base - 30 * s.u, 3.4);
    });
    s.show('f', fA);
  },
};

const gaps: SceneDef = {
  draw(s) {
    const rows: [string, number[], string][] = [
      ['s', S, 'base'],
      ['s + 5', S.map((v) => v + 5), 'shift'],
      ['2s', S.map((v) => 2 * v), 'scale'],
    ];
    const xs = columns(s, 3, s.tall ? 17 : 15);
    const px = columns(s, 3, s.tall ? 17 : 15).map((x) => x + (s.tall ? 0 : 30 * s.u));
    rows.forEach(([name, sc, beat], r) => {
      const y = s.h * (0.2 + r * 0.3);
      const a = beat === 'base' ? 1 : s.ease(beat, 0.6);
      const e = sc.map(Math.exp);
      const t = e.reduce((x, z) => x + z, 0);
      const p = e.map((v) => v / t);
      s.alpha(a, () => {
        const sx = s.tall ? xs : xs.map((x) => x - 30 * s.u);
        rowLabel(s, name, sx[0]! - 10 * s.u, y - 6 * s.u, 'purple', 3.6);
        cells(s, sx, y - 6 * s.u, sc.map(String), 'purple', { w: 11, h: 7, size: 3.2 });
        const by = s.tall ? y + 12 * s.u : y + 4 * s.u;
        bars(s, s.tall ? xs : px, by, p, 'teal', { max: 1, height: s.tall ? 10 : 16, w: 9, fmt: f2, hi: beat === 'scale' ? [s.ease('soft', 0.6), 0, 0] : undefined });
      });
    });
    s.alpha(s.ease('shift', 0.6, 2.5), () => s.text('same', s.w - 10 * s.u, s.h * 0.5, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true }));
    s.alpha(s.ease('scale', 0.6, 2), () => s.text('sharper', s.w - 10 * s.u, s.h * 0.8, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('orange'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { scores, exp, divide, gaps };
