import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { bars, cells, columns, rowLabel } from '../../draw';
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
  [0.9, 0.1, 0.5],
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
    s.alpha(s.ease('sim', 0.6), () => s.text('z₁ · z₂ = 0.9', X(0.84), yTop - 11 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true }));
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

const S = [2, 0, 1];
const E = S.map((v) => +Math.exp(v).toFixed(2));
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);

const SLOPE = P.map((v, j) => (j ? v : v - 1));

const loss: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.17, 0.31, 0.45, 0.59].map((f) => s.h * f);
    ['positive', 'negative', 'negative'].forEach((t, j) => s.text(t, xs[j]!, s.h * 0.08, { size: 3, font: 'mono', weight: 650, color: s.c(j ? 'red' : 'green') }));
    rowLabel(s, 's', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, S.map(String), 'purple', { w: 14, h: 8, on: [s.win('row', 'soft'), 0, s.win('nudge', 'share')] });
    s.alpha(s.ease('row', 0.6, 1) * (1 - s.ease('soft', 0.5)), () => caption(s, 'which candidate is my partner?', s.h * 0.24, '--ink-3', 3.2));
    s.alpha(s.ease('soft', 0.6, 1), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, 'gold', 3.8);
      cells(s, xs, ys[1]!, E.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8, on: [0, 0, s.win('nudge', 'push')] });
      s.text(`total ${TOTAL.toFixed(2)}`, xs[2]! + 9 * u, ys[1]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('soft', 0.6, 4), () => {
      rowLabel(s, 'p', lx, ys[2]!, 'teal', 3.8);
      cells(s, xs, ys[2]!, P.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [s.win('soft', 'nudge'), 0, s.win('share', 'push')] });
    });
    // The loss's slope on each score: a negative's is its probability, the positive's is p - 1.
    const shown = [after(s, 'push', 0.15), after(s, 'share', 0.7), after(s, 'share', 0.35)];
    s.alpha(shown[2]!, () => rowLabel(s, 'slope', lx, ys[3]!, 'red', 3.4));
    SLOPE.forEach((v, j) => s.alpha(shown[j]!, () => cells(s, [xs[j]!], ys[3]!, [fmt(v, 2)], 'red', { w: 14, h: 8 })));
    s.alpha(s.win('loss', 'nudge'), () => {
      rich(s, [['loss = ln 11.11 − 2 = ', '--ink-2'], ['0.41', 'red']], s.w / 2, s.h * 0.71, { size: 3.8, weight: 650, halo: true });
      s.alpha(s.ease('loss', 0.6, 1.5), () => caption(s, '= −ln 0.67: cross-entropy on the positive', s.h * 0.78, '--ink-3', 3.2));
    });
    s.alpha(after(s, 'nudge', 0.45) * (1 - s.ease('push', 0.5)), () => rich(s, [['candidate 2: total grows ', '--ink-2'], ['2.72', 'gold'], ['× as fast', '--ink-2']], s.w / 2, s.h * 0.71, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'share', 0.2) * (1 - s.ease('push', 0.5)), () => rich(s, [['slope = 2.72 / 11.11 = ', '--ink-2'], ['0.24', 'red'], [' = its p', '--ink-2']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'push', 0.3), () => {
      rich(s, [['pull ', '--ink-2'], ['positive', 'green'], [' in, push ', '--ink-2'], ['negatives', 'red'], [' out', '--ink-2']], s.w / 2, s.h * 0.75, { size: 3.4, weight: 600, halo: true });
      s.alpha(after(s, 'push', 0.75), () => caption(s, 'average over every row', s.h * 0.84, '--ink-3', 3));
    });
  },
};

const SIM0 = SIM[0]!;
const soft = (t: number) => {
  const e = SIM0.map((v) => Math.exp(v / t));
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / tot);
};
const WARM = soft(1);
const COLD = soft(0.1);

const temperature: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\text{similarity}}{\sym{tau}{\tau}}`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 15);
    s.show('f', s.ease('divide', 0.6));
    const ys = s.h * 0.25;
    rowLabel(s, 'sim', xs[0]! - 10 * u, ys, 'green', 3.6);
    cells(s, xs, ys, SIM0.map((v) => fmt(v)), 'green', { w: 12, h: 7.5 });
    s.alpha(s.win('range', 'divide'), () => caption(s, 'unit vectors: similarity from −1 to 1', s.h * 0.38, '--ink-2', 3.4));
    const base = s.h * 0.82;
    const groups: [number, number[], string, number][] = [
      [s.w / 2 - 27 * u, WARM, 'τ = 1', s.ease('sharp', 0.8)],
      [s.w / 2 + 27 * u, COLD, 'τ = 0.1', s.ease('sharp', 0.8, 3.5)],
    ];
    groups.forEach(([cx, p, name, a]) => {
      s.alpha(a, () => {
        const bx = [-1, 0, 1].map((k) => cx + k * 10.5 * u);
        const hard = name === 'τ = 0.1' ? after(s, 'hard', 0.55) : after(s, 'hard', 0.25) * (1 - after(s, 'hard', 0.55));
        bars(s, bx, base, p, 'teal', { max: 1, height: 30, w: 7, fmt: (v) => v.toFixed(2), grow: a, hi: [0, name === 'τ = 1' ? hard : 0, hard] });
        s.text(name, cx, s.h * 0.4, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
      });
    });
    s.alpha(s.ease('divide', 0.6), () => s.text('÷ τ: gaps stretch', s.w / 2, s.h * 0.33, { size: 3.4, font: 'mono', color: s.c('slate'), halo: true }));
    s.alpha(s.ease('sharp', 0.6, 2), () => s.text('soft', s.w / 2 - 27 * u, base + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('sharp', 0.6, 5), () => s.text('sharp', s.w / 2 + 27 * u, base + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(after(s, 'hard', 0.6), () => caption(s, 'closest negative (0.5) gets the push', s.h * 0.93, 'red', 3.3));
  },
};

export const scenes: Record<string, SceneDef> = { pairs, loss, temperature };
