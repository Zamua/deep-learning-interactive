import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { heat, rich } from '../draw';

const WORDS = ['cats', 'like', 'fresh', 'fish'];
const NEXT = ['like', 'fresh', 'fish', '?'];
// Scores for the 4 by 4 grid; only their sizes show, as shading.
const E = [
  [2, 1, 0, 1],
  [2, 0, 3, 1],
  [1, 2, 1, 0],
  [0, 1, 2, 2],
];

/** The 4 by 4 score grid with word labels; `masked` fades the cells above the diagonal to −∞. */
function grid(s: Scene, x0: number, y0: number, c: number, masked: number, o: { hot?: [number, number, number]; rows?: number[] } = {}): void {
  const u = s.u;
  WORDS.forEach((w, j) => s.text(w, x0 + j * c * u, y0 - c * 0.5 * u - 3 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('purple') }));
  WORDS.forEach((w, i) => s.text(w, x0 - c * 0.5 * u - 1.5 * u, y0 + i * c * u, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c(o.rows?.[i] ? 'orange' : 'teal') }));
  heat(s, x0, y0, 4, c, (i, j) => (j > i && masked > 0.5 ? null : 0.12 + 0.18 * E[i]![j]!), 'slate', { text: (i, j) => (j > i ? '' : String(E[i]![j])), size: 2.8 });
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const cx = x0 + j * c * u;
      const cy = y0 + i * c * u;
      s.alpha(1 - masked, () => s.text(String(E[i]![j]), cx, cy + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink') }));
      s.alpha(masked, () => {
        s.rrect(cx - (c / 2 - 0.4) * u, cy - (c / 2 - 0.4) * u, (c - 0.8) * u, (c - 0.8) * u, 0.8, { fill: s.tint('red', 0.12), stroke: s.tint('red', 0.45), lw: 0.25 });
        s.text('−∞', cx, cy + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('red') });
      });
    }
  }
  if (o.hot) {
    const [i, j, a] = o.hot;
    s.alpha(a, () => s.rrect(x0 + (j * c - c / 2) * u, y0 + (i * c - c / 2) * u, c * u, c * u, 1, { stroke: s.c('red'), lw: 0.6 }));
  }
}

const peek: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 22);
    WORDS.forEach((w, j) => {
      s.cell(xs[j]! - 8 * u, s.h * 0.1 - 3.5 * u, 16 * u, 7 * u, w, 'orange', { on: j === 0 ? s.win('cheat', 'mask') : 0, size: 3.2 });
      s.alpha(s.ease('predict', 0.5, 2.5 + 0.7 * j), () => s.text(`→ ${NEXT[j]}`, xs[j]!, s.h * 0.2, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    });
    const c = 11;
    const x0 = s.w / 2 - 1.5 * c * u + 3 * u;
    const y0 = s.h * 0.42;
    const masked = s.ease('mask', 0.8, 1);
    s.alpha(s.ease('cheat', 0.6), () => grid(s, x0, y0, c, masked, { hot: [0, 1, s.win('cheat', 'mask')] }));
    s.alpha(s.win('cheat', 'fail'), () => rich(s, [['cats', 'teal'], [' sees ', '--ink-3'], ['like', 'purple'], [': the answer it must predict', '--ink-3']], s.w / 2, s.h * 0.88, { size: 3.2 }));
    s.alpha(s.win('fail', 'mask'), () => s.text('when generating, the next token is not there yet', s.w / 2, s.h * 0.88, { size: 3.2, color: s.c('red') }));
    s.alpha(s.ease('grid', 0.6), () => {
      [1, 2, 3, 4].forEach((n, i) => s.text(`keeps ${n}`, x0 + 3.5 * c * u + 2 * u, y0 + i * c * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('green') }));
      s.text('each row: itself and the past', s.w / 2, s.h * 0.88, { size: 3.2, color: s.c('--ink-2') });
    });
  },
};

const ROW = [2, 0, 3, 1];
const W = (() => {
  const x = ROW.map((v, j) => (j <= 1 ? Math.exp(v) : 0));
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
})();

const renorm: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 18).map((x) => x + 4 * u);
    const count = s.ease('count', 0.6);
    s.alpha(1 - count, () => {
      WORDS.forEach((w, j) => s.text(w, xs[j]!, s.h * 0.08, { size: 3.2, font: 'mono', weight: 600, color: s.c(j > 1 ? '--ink-3' : 'purple') }));
      rowLabel(s, 'like', xs[0]! - 9 * u, s.h * 0.19, 'teal', 3.4);
      cells(s, xs, s.h * 0.19, ROW.map(String), 'slate', { w: 11, h: 7, size: 3.2 });
      s.alpha(s.ease('hide', 0.6), () => {
        rowLabel(s, 'masked', xs[0]! - 9 * u, s.h * 0.31, 'red', 3.2);
        cells(s, xs.slice(0, 2), s.h * 0.31, ['2', '0'], 'slate', { w: 11, h: 7, size: 3.2 });
        cells(s, xs.slice(2), s.h * 0.31, ['−∞', '−∞'], 'red', { w: 11, h: 7, size: 3.2, on: [1, 1] });
      });
      s.alpha(s.ease('weights', 0.6), () => {
        const base = s.h * 0.78;
        rowLabel(s, 'α', xs[0]! - 9 * u, base - 5 * u, 'green', 3.8);
        bars(s, xs, base, W, 'green', { max: 1, height: 26, w: 9, fmt: (v) => (v < 0.005 ? '0' : v.toFixed(2)), grow: s.ease('weights', 1, 0.3) });
        s.alpha(s.ease('weights', 0.6, 5), () => s.text('0.88 + 0.12 = 1', s.w / 2, s.h * 0.9, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
      });
    });
    s.alpha(count, () => {
      const c = 11;
      const x0 = s.w / 2 - 1.5 * c * u + 2 * u;
      const y0 = s.h * 0.16;
      grid(s, x0, y0, c, 1);
      const kx = x0 + 3.5 * c * u + 3.5 * u;
      const hx = kx + 9 * u;
      const hy = y0 - c * 0.5 * u - 3 * u;
      [1, 2, 3, 4].forEach((n, i) => s.text(`${n}`, kx, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('green') }));
      s.text('kept', kx, hy, { size: 2.6, font: 'mono', color: s.c('green') });
      s.alpha(s.ease('hidden', 0.6), () => {
        [3, 2, 1, 0].forEach((n, i) => s.text(`${n}`, hx, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') }));
        s.text('hidden', hx, hy, { size: 2.6, font: 'mono', color: s.c('red') });
      });
      const o = { size: s.tall ? 3.2 : 3.6, weight: 600 };
      s.alpha(s.ease('count', 0.6, 2) * (1 - s.ease('pairs', 0.6)), () => rich(s, [['1 + 2 + 3 + 4 = ', '--ink-2'], ['10', 'green'], [' of 16', '--ink-3']], s.w / 2, s.h * 0.64, o));
      s.alpha(s.ease('pairs', 0.6), () => rich(s, [['(1 + 4) + (2 + 3) = 5 + 5 = ', '--ink-2'], ['10', 'green']], s.w / 2, s.h * 0.64, o));
      s.alpha(s.ease('pairs', 0.6, 4), () => rich(s, [['kept: T(T + 1) / 2 = 4 × 5 / 2 = ', '--ink-2'], ['10', 'green']], s.w / 2, s.h * 0.72, o));
      s.alpha(s.ease('hidden', 0.6, 0.8), () => rich(s, [['hidden: T² − kept = 16 − 10 = ', '--ink-2'], ['6', 'red']], s.w / 2, s.h * 0.8, o));
      s.alpha(s.ease('hidden', 0.6, 5), () => rich(s, [['T² − T(T + 1) / 2 = ', '--ink-2'], ['T(T − 1) / 2', 'red']], s.w / 2, s.h * 0.88, o));
    });
  },
};

export const scenes: Record<string, SceneDef> = { peek, renorm };
