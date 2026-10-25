import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel, verdict } from '../../draw';

const S = [2, 7, 1, 5];

/** A row of scores over bars, with positions under the bars. */
function scoresWithBars(s: Scene, vals: number[], o: { hiMax?: number; hiArg?: number; names?: number; lo?: number }) {
  const xs = columns(s, vals.length, s.tall ? 24 : 26);
  const top = s.h * 0.18;
  const base = s.h * 0.72;
  const k = vals.indexOf(Math.max(...vals));
  rowLabel(s, 's', xs[0]! - 13 * s.u, top, 'purple');
  cells(s, xs, top, vals.map(String), 'purple', { w: 12, on: vals.map((_, i) => (i === k ? o.hiMax ?? 0 : 0)) });
  const lo = o.lo ?? 0;
  const shown = vals.map((v) => v - lo);
  bars(s, xs, base, shown, 'purple', { max: Math.max(...shown), height: (base - top) / s.u - 16, w: 11, hi: vals.map((_, i) => (i === k ? o.hiMax ?? 0 : 0)) });
  const ny = base + 6 * s.u;
  xs.forEach((x, i) => {
    const hi = i === k ? o.hiArg ?? 0 : 0;
    if (hi > 0.01) s.circle(x, ny, 4 * s.u * Math.min(1, hi * 1.5), { stroke: s.tint('gold', hi), lw: 0.45 });
    s.text(String(i), x, ny, { size: 3.8, font: 'mono', weight: 500 + 200 * hi, color: hi > 0.5 ? s.c('gold') : s.c('--ink-3') });
    s.alpha(o.names ?? 0, () => s.text('class', x, ny + 7 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
  });
  return { xs, top, base, ny, k };
}

const position: SceneDef = {
  draw(s) {
    const L = scoresWithBars(s, S, { hiMax: s.ease('max', 0.6), hiArg: s.ease('arg', 0.6, 1.5), names: s.ease('predict', 0.6) });
    const by = s.h * 0.93;
    const pr = s.ease('predict', 0.6, 1.4);
    s.alpha(s.ease('max', 0.6, 0.6) * (1 - pr), () => s.text('max = 7', s.w * 0.3, by, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') }));
    s.alpha(s.ease('arg', 0.6, 2.2) * (1 - pr), () => s.text('argmax = 1', s.w * 0.7, by, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') }));
    s.alpha(s.ease('scores', 0.6) * (1 - s.ease('arg', 0.5)), () => s.text('position', s.w / 2, L.ny + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(pr, () => s.text('prediction: class 1', s.w / 2, by, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') }));
  },
};

const ROWS = [
  [2, 7, 1],
  [4, 0, 3],
  [1, 2, 6],
  [5, 3, 0],
];
const Y = [1, 2, 2, 0];
const PRED = ROWS.map((r) => r.indexOf(Math.max(...r)));

const accuracy: SceneDef = {
  draw(s) {
    const g = s.tall ? 11 : 12;
    const left = s.w / 2 - ((2 * g + 51) / 2 - 4.75) * s.u;
    const sx = [0, 1, 2].map((i) => left + i * g * s.u);
    const px = left + (2 * g + 18) * s.u;
    const yx = px + 15 * s.u;
    const vx = yx + 11 * s.u;
    const ys = [0.3, 0.43, 0.56, 0.69].map((f) => s.h * f);
    const hy = s.h * 0.16;
    const pred = (i: number) => s.ease('pred', 0.5, 0.5 + 0.45 * i);
    const cmp = (i: number) => s.ease('compare', 0.5, 0.3 * i);
    const head = { size: 3.4, font: 'mono', weight: 650 } as const;
    s.text('scores', sx[1]!, hy, { ...head, color: s.c('purple') });
    s.text('y', yx, hy, { ...head, color: s.c('gold') });
    s.alpha(s.ease('pred', 0.6), () => s.text('argmax', px, hy, { ...head, color: s.c('--ink-2') }));
    ROWS.forEach((r, i) => {
      cells(s, sx, ys[i]!, r.map(String), 'purple', { w: 9.5, h: 8, on: r.map((_, j) => (j === PRED[i] ? pred(i) : 0)) });
      cells(s, [yx], ys[i]!, [String(Y[i])], 'gold', { w: 8, h: 8, on: [cmp(i) * (1 - s.ease('acc', 0.6))] });
      s.alpha(pred(i), () => cells(s, [px], ys[i]!, [String(PRED[i])], '--ink-2', { w: 8, h: 8 }));
      s.alpha(cmp(i), () => s.text(PRED[i] === Y[i] ? '✓' : '✗', vx, ys[i]!, { size: 4.4, font: 'ui', weight: 700, color: s.c(PRED[i] === Y[i] ? 'green' : 'red') }));
    });
    s.alpha(s.ease('acc', 0.6), () => s.text('3 / 4 = 0.75', s.w / 2, s.h * 0.86, { size: 4.6, font: 'mono', weight: 650, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { position, accuracy };
