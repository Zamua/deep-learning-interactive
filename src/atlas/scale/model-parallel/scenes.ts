import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { gpu, mono } from '../draw';

const X = [1, 2];
const W1 = [
  [1, 0, 2, -1],
  [1, 1, 0, 1],
];
const H = [0, 1, 2, 3].map((j) => X[0]! * W1[0]![j]! + X[1]! * W1[1]![j]!);
const W2 = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 0],
];
const f = (v: number) => String(v).replace('-', '−');
const GK = ['blue', 'green'] as const;

const columns: SceneDef = {
  draw(s) {
    const sp = s.ease('split', 0.8);
    const gap = s.tall ? 12 : 13;
    const cx = s.w / 2 + 6 * s.u;
    const xs = [0, 1, 2, 3].map((j) => cx + (j - 1.5) * gap * s.u + (j < 2 ? -1 : 1) * 4 * sp * s.u);
    const ys = [s.h * 0.3, s.h * 0.42];
    const yh = s.h * 0.59;
    const cardY = s.h * 0.47;
    const lit = (j: number) => (j === 0 ? s.win('cols', 'split') : 0);
    // GPU cards around each half once the columns are split.
    s.alpha(sp, () => {
      [0, 1].forEach((g) => {
        const mid = (xs[2 * g]! + xs[2 * g + 1]!) / 2;
        gpu(s, mid, cardY, 2 * gap - 1, 58, `GPU ${g}`, { k: GK[g], on: s.win('own', 'shape') });
      });
    });
    W1.forEach((r, i) => cells(s, xs, ys[i]!, r.map(f), 'blue', { w: 10, h: 8, size: 3.4, on: r.map((_, j) => lit(j)) }));
    // x's entries sit by the rows they multiply.
    const xx = xs[0]! - (s.tall ? 17 : 19) * s.u;
    X.forEach((v, i) => cells(s, [xx], ys[i]!, [String(v)], 'orange', { w: 8, h: 8, size: 3.4, on: [lit(0)] }));
    mono(s, 'x', xx, ys[0]! - 7.4 * s.u, { size: 3.8, k: 'orange', weight: 650 });
    mono(s, 'W₁', xs[3]! + 9 * s.u, (ys[0]! + ys[1]!) / 2, { size: 3.8, k: 'blue', weight: 650, align: 'left' });
    s.alpha(s.ease('layer', 0.6, 2), () => {
      mono(s, 'd rows', xx - 6 * s.u, (ys[0]! + ys[1]!) / 2, { size: 2.9, k: '--ink-3', align: 'right' });
      s.alpha(1 - sp, () => mono(s, '4d columns, one per output', cx, ys[1]! + 7.6 * s.u, { size: 2.9, k: '--ink-3' }));
    });
    // Each output under its own column.
    s.alpha(s.ease('cols', 0.6), () => {
      [0, 1, 2, 3].forEach((j) => s.alpha(j === 0 ? 1 : s.ease('cols', 0.6, 3), () => cells(s, [xs[j]!], yh, [String(H[j])], '--ink-2', { w: 10, h: 8, size: 3.4, on: [j === 0 ? lit(0) : 0] })));
      mono(s, 'h', xx, yh, { size: 3.8, k: 'gold', weight: 650 });
      s.alpha(s.win('cols', 'split'), () => mono(s, '1·1 + 2·1 = 3', xs[0]!, yh + 8 * s.u, { size: 3.2, k: '--ink-2' }));
    });
    s.alpha(s.ease('own', 0.6, 1), () => {
      mono(s, 'no waiting', (xs[0]! + xs[1]!) / 2, yh + 8.5 * s.u, { size: 3, k: GK[0] });
      mono(s, 'no waiting', (xs[2]! + xs[3]!) / 2, yh + 8.5 * s.u, { size: 3, k: GK[1] });
    });
    s.alpha(s.ease('shape', 0.6), () => mono(s, 'each piece: (d, 4d / k)', s.w / 2, s.h * 0.1, { size: 3.8, weight: 650 }));
  },
};

const rows: SceneDef = {
  draw(s) {
    const cy = s.h * 0.4;
    const half = s.tall ? 26 : 30;
    const parts = [
      [3, 2],
      [1, 2],
    ];
    [0, 1].forEach((g) => {
      const cx = s.w / 2 + (g ? half : -half) * s.u;
      gpu(s, cx, cy + 2 * s.u, 2 * half - 4, 50, `GPU ${g}`, { k: GK[g] });
      const hx = cx - 14 * s.u;
      const wx = [cx + 1 * s.u, cx + 12 * s.u];
      const ry = [cy - 6 * s.u, cy + 4 * s.u];
      mono(s, 'h', hx, ry[0]! - 7 * s.u, { size: 3.4, k: 'gold', weight: 650 });
      H.slice(2 * g, 2 * g + 2).forEach((v, i) => cells(s, [hx], ry[i]!, [String(v)], 'gold', { w: 8, h: 8, size: 3.4 }));
      s.alpha(s.ease('w2', 0.6, 1), () => {
        mono(s, 'W₂ rows', (wx[0]! + wx[1]!) / 2, ry[0]! - 7 * s.u, { size: 3.2, k: 'blue', weight: 650 });
        W2.slice(2 * g, 2 * g + 2).forEach((r, i) => cells(s, wx, ry[i]!, r.map(f), 'blue', { w: 10, h: 8, size: 3.4 }));
      });
      s.alpha(s.ease('part', 0.6, g * 2.5), () => {
        mono(s, 'partial', cx - 9 * s.u, cy + 17 * s.u, { size: 3, k: '--ink-3', align: 'right' });
        cells(s, [cx - 2 * s.u, cx + 9 * s.u], cy + 17 * s.u, parts[g]!.map(String), GK[g], { w: 10, h: 8, size: 3.4, on: [1, 1] });
      });
    });
    s.alpha(s.ease('sum', 0.6), () => {
      const y = s.h * 0.88;
      mono(s, '+', s.w / 2, s.h * 0.4 + 17 * s.u, { size: 5, k: '--ink-2', weight: 700 });
      cells(s, [s.w / 2 - 6 * s.u, s.w / 2 + 6 * s.u], y, ['4', '4'], 'purple', { w: 10, h: 8, size: 3.6, on: [1, 1] });
      mono(s, 'output', s.w / 2 - 13 * s.u, y, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
      mono(s, 'summed across GPUs', s.w / 2 + 13 * s.u, y, { size: 3, k: '--ink-2', align: 'left' });
    });
  },
};

const SK = ['blue', 'orange', 'green', 'purple'] as const;

const pipeline: SceneDef = {
  draw(s) {
    const gapStage = s.tall ? 3.2 : 5;
    const lw = Math.min(4.4, (s.w / s.u - 18 - 3 * gapStage) / 24);
    const total = 24 * lw + 3 * gapStage;
    const x0 = s.w / 2 - (total / 2) * s.u;
    const lx = (i: number) => x0 + (i * lw + Math.floor(i / 6) * gapStage + lw / 2) * s.u;
    const y = s.h * 0.42;
    const hh = 22;
    for (let i = 0; i < 24; i++) {
      const st = Math.floor(i / 6);
      const hi = i === 13 ? s.win('which', 'send') : 0;
      s.rrect(lx(i) - (lw / 2 - 0.4) * s.u, y - (hh / 2) * s.u, (lw - 0.8) * s.u, hh * s.u, 0.6, { fill: s.tint(SK[st]!, 0.25 + 0.45 * hi), stroke: s.tint(SK[st]!, 0.7 + 0.3 * hi), lw: 0.25 + 0.3 * hi });
    }
    s.alpha(s.ease('layers', 0.6, 1.5), () => {
      for (let st = 0; st < 4; st++) {
        const mid = (lx(6 * st) + lx(6 * st + 5)) / 2;
        mono(s, `stage ${st}`, mid, y + (hh / 2 + 4) * s.u, { size: s.tall ? 2.8 : 3.2, k: SK[st], weight: 650 });
        mono(s, `${6 * st}–${6 * st + 5}`, mid, y + (hh / 2 + 8) * s.u, { size: s.tall ? 2.7 : 3, k: '--ink-3' });
      }
    });
    mono(s, '24 layers, 4 GPUs: 6 each', s.w / 2, s.h * 0.1, { size: 3.6, weight: 650 });
    s.alpha(s.win('which', 'send'), () => {
      mono(s, 'layer 13', lx(13), y - (hh / 2 + 4) * s.u, { size: 3.2, k: 'green', weight: 650 });
      mono(s, '13 // 6 = 2', s.w / 2, s.h * 0.82, { size: 3.6, k: 'green', weight: 650 });
    });
    s.alpha(s.ease('send', 0.6), () => {
      for (let st = 0; st < 3; st++) {
        const a = lx(6 * st + 5);
        const b = lx(6 * st + 6);
        const top = y - (hh / 2 + 3) * s.u;
        s.arrow(a - 1 * s.u, top, b + 1 * s.u, top, s.c('--ink-2'), 0.35, 1.8);
        s.alpha(s.ease('send', 0.6, 2.5), () => s.arrow(b + 1 * s.u, top - 3.5 * s.u, a - 1 * s.u, top - 3.5 * s.u, s.c('red'), 0.35, 1.8));
      }
      mono(s, 'output forward, its gradient back', s.w / 2, s.h * 0.82, { size: s.tall ? 3.2 : 3.6, k: '--ink-2' });
    });
    s.alpha(s.ease('compare', 0.6), () => {
      mono(s, 'columns split: talk inside every layer', s.w / 2, s.h * 0.9, { size: s.tall ? 3 : 3.4, k: '--ink-3' });
    });
  },
};

export const scenes: Record<string, SceneDef> = { columns, rows, pipeline };
