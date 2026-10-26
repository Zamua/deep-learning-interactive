import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { cells, columns, rowLabel } from '../../draw';
import { block, caption, crop, fmt, PICS, picture, rich } from '../draw';

const KINDS = ['sun', 'tree', 'boat'] as const;
/** Two crops of each picture: [row, column] of a 10 by 10 window. */
const CROPS: [number, number][][] = [
  [[0, 0], [5, 6]],
  [[2, 4], [6, 1]],
  [[1, 5], [4, 0]],
];
const view = (k: number, v: number) => crop(PICS[KINDS[k]!], CROPS[k]![v]![0], CROPS[k]![v]![1], 10);
const SIM = [
  [0.8, 0, 0.4],
  [0.2, 0.8, 0.3],
  [0.4, 0.1, 0.85],
];

/** A unit circle at (cx, cy) with two unit vectors at the given angles (degrees). */
function circle(s: Scene, cx: number, cy: number, r: number, angles: number[], inks: ('orange' | 'teal')[]): void {
  const u = s.u;
  s.circle(cx, cy, r * u, { stroke: s.c('--axis'), lw: 0.3 });
  angles.forEach((a, i) => {
    const t = (a * Math.PI) / 180;
    s.arrow(cx, cy, cx + r * u * Math.cos(t), cy - r * u * Math.sin(t), s.c(inks[i]!), 0.45, 1.8);
  });
}

// z1 = [6, 8] scaled to [0.6, 0.8]; z2 sits at the angle whose cosine is the pair's similarity.
const Z1 = [6, 8];
const A1 = (Math.atan2(Z1[1]!, Z1[0]!) * 180) / Math.PI;
const A2 = A1 - (Math.acos(SIM[0]![0]!) * 180) / Math.PI;

/** z1 = [6, 8] as an arrow with its legs, and the arithmetic that scales it to length 1. */
function arrowLength(s: Scene): void {
  const u = s.u;
  const k = 2.6 * u;
  const ox = s.w * 0.12;
  const oy = s.h * 0.88;
  const tx = ox + Z1[0]! * k;
  const ty = oy - Z1[1]! * k;
  const sz = s.ease('size', 0.6);
  s.line(ox - 2 * u, oy, tx + 4 * u, oy, s.c('--axis'), 0.3);
  s.line(ox, oy + 2 * u, ox, ty - 3 * u, s.c('--axis'), 0.3);
  s.alpha(sz, () => {
    s.line(ox, oy, tx, oy, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
    s.line(tx, oy, tx, ty, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
    s.text('6', (ox + tx) / 2, oy + 3.2 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    s.text('8', tx + 1.8 * u, (oy + ty) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
  });
  s.arrow(ox, oy, tx, ty, s.c('orange'), 0.45, 2);
  s.alpha(after(s, 'size', 0.8), () => s.text('10', (ox + tx) / 2 - 2.8 * u, (oy + ty) / 2 - 2.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
  const x = s.w * 0.4;
  const line = (y: number, runs: [string, 'orange' | 'gold' | '--ink-2'][], a: number) => s.alpha(a, () => rich(s, runs, x, s.h * y, { size: 3.5, weight: 600, align: 'left' }));
  line(0.6, [['z₁ = [6, 8]', 'orange']], 1);
  line(0.69, [['6² + 8² = 36 + 64 = 100', '--ink-2']], after(s, 'size', 0.55));
  line(0.78, [['length ', '--ink-2'], ['10', 'gold'], [', as 10² = 100', '--ink-2']], after(s, 'size', 0.8));
  line(0.87, [['z₁ / 10 = [0.6, 0.8]', 'orange']], after(s, 'unit', 0.1));
}

const pairs: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const yTop = s.h * 0.24;
    const g = picture(s, X(0.17), yTop, 1.35, PICS.sun);
    const vA = s.ease('views', 0.6, 1);
    const inks = ['orange', 'teal'] as const;
    s.alpha(vA, () => {
      CROPS[0]!.forEach(([r, c], v) => {
        s.rrect(g.l + c * g.p, g.t + r * g.p, 10 * g.p, 10 * g.p, 0.4, { stroke: s.c(inks[v]!), lw: 0.5 });
        const y = yTop + (v ? 9.5 : -9.5) * u;
        picture(s, X(0.4), y, 0.85, view(0, v));
        s.rrect(X(0.4) - 4.25 * u, y - 4.25 * u, 8.5 * u, 8.5 * u, 0.4, { stroke: s.c(inks[v]!), lw: 0.4 });
      });
      s.text('two views', X(0.4), yTop + 18 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('embed', 0.6), () => {
      for (const v of [0, 1]) s.arrow(X(0.4) + 5 * u, yTop + (v ? 9.5 : -9.5) * u, X(0.62) - 8 * u, yTop + (v ? 2 : -2) * u, s.c('--ink-3'), 0.3, 1.8);
      block(s, X(0.62), yTop, 12, 10, 'enc', 'blue', { size: 3.4 });
      s.arrow(X(0.62) + 7 * u, yTop, X(0.84) - 9 * u, yTop, s.c('--ink-3'), 0.3, 1.8);
      circle(s, X(0.84), yTop, 7, [A1, A2], ['orange', 'teal']);
    });
    s.alpha(after(s, 'unit', 0.5), () => s.text('length 1', X(0.84), yTop + 11 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(after(s, 'embed', 0.6) * (1 - s.ease('batch', 0.5)), () => arrowLength(s));
    s.alpha(s.ease('sim', 0.6), () => s.text('z₁ · z₂ = 0.8', X(0.84), yTop - 11 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true }));
    // The batch: similarities of view 1 of image i with view 2 of image j.
    const bA = s.ease('batch', 0.6);
    s.alpha(bA, () => {
      const p = 9.5 * u;
      const gx = s.w / 2 + 6 * u;
      const gy = s.h * 0.72;
      for (let i = 0; i < 3; i++) {
        picture(s, gx - 1.5 * p - 6 * u, gy + (i - 1) * p, 0.65, view(i, 0));
        picture(s, gx + (i - 1) * p, gy - 1.5 * p - 5 * u, 0.65, view(i, 1));
        for (let j = 0; j < 3; j++) {
          const diag = i === j;
          s.cell(gx + (j - 1.5) * p + 0.4 * u, gy + (i - 1.5) * p + 0.4 * u, p - 0.8 * u, p - 0.8 * u, fmt(SIM[i]![j]!), diag ? 'green' : 'red', { on: diag ? s.ease('batch', 0.6, 2.5) : 0, size: 3 });
        }
      }
      s.text('view 1', gx - 1.5 * p - 6 * u, gy + 2 * p + 1 * u, { size: 3, font: 'mono', color: s.c('orange') });
      s.text('view 2', gx + 1.5 * p + 3 * u, gy - 1.5 * p - 5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('teal') });
      s.alpha(s.ease('batch', 0.6, 2.5), () => s.text('positives', gx + 1.5 * p + 3 * u, gy, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green') }));
    });
  },
};

// Row 0 of the grid, divided by the temperature: the scores the softmax sees.
const TAU = 0.4;
const S = SIM[0]!.map((v) => Math.round(v / TAU));
const E = S.map((v) => +Math.exp(v).toFixed(2));
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\text{similarity}}{\sym{tau}{\tau}}`, x: 0.5, y: 0.74, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.16, 0.31, 0.45, 0.59].map((f) => s.h * f);
    ['positive', 'negative', 'negative'].forEach((t, j) => s.text(t, xs[j]!, s.h * 0.07, { size: 3, font: 'mono', weight: 650, color: s.c(j ? 'red' : 'green') }));
    rowLabel(s, 'sim', lx, ys[0]!, 'green', 3.6);
    cells(s, xs, ys[0]!, SIM[0]!.map((v) => fmt(v)), 'green', { w: 14, h: 8, on: [s.win('row', 'soft'), 0, 0] });
    s.alpha(s.win('range', 'divide'), () => caption(s, 'unit vectors: from −1 to 1', s.h * 0.235, '--ink-2', 3.2));
    s.alpha(s.ease('divide', 0.6, 0.8), () => caption(s, `÷ τ = ${TAU}: gaps stretch`, s.h * 0.235, 'slate', 3.2));
    s.show('f', s.win('divide', 'soft'));
    s.alpha(s.ease('row', 0.6, 2), () => {
      rowLabel(s, 's', lx, ys[1]!, 'purple', 3.8);
      cells(s, xs, ys[1]!, S.map(String), 'purple', { w: 14, h: 8, on: [s.win('row', 'soft'), 0, 0] });
    });
    s.alpha(after(s, 'row', 0.8) * (1 - s.ease('soft', 0.5)), () => caption(s, 'which candidate is my partner?', s.h * 0.385, '--ink-3', 3.2));
    s.alpha(s.ease('soft', 0.6, 2.5), () => {
      rowLabel(s, 'eˢ', lx, ys[2]!, 'gold', 3.8);
      cells(s, xs, ys[2]!, E.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8 });
      s.text(`total ${TOTAL.toFixed(2)}`, xs[2]! + 9 * u, ys[2]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(after(s, 'soft', 0.85), () => {
      rowLabel(s, 'p', lx, ys[3]!, 'teal', 3.8);
      cells(s, xs, ys[3]!, P.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [s.ease('loss', 0.6), 0, 0] });
    });
    s.alpha(s.ease('loss', 0.6), () => {
      rich(s, [[`loss = ln ${TOTAL.toFixed(2)} − ${S[0]} = `, '--ink-2'], [(Math.log(TOTAL) - S[0]!).toFixed(2), 'red']], s.w / 2, s.h * 0.72, { size: 3.8, weight: 650, halo: true });
      s.alpha(s.ease('loss', 0.6, 1.5), () => caption(s, `= −ln ${P[0]!.toFixed(2)}: cross-entropy on the positive`, s.h * 0.79, '--ink-3', 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { pairs, loss };
